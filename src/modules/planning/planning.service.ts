import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanningDto, UpdatePlanningDto } from './dto/planning.dto';

interface PlanningFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  budgetId?: string;
  brandId?: string;
  allocateHeaderId?: string;
}

@Injectable()
export class PlanningService {
  constructor(private prisma: PrismaService) {}

  // ─── LIST ──────────────────────────────────────────────────────────────────

  async findAll(filters: PlanningFilters) {
    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 20;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.allocateHeaderId) where.allocate_header_id = BigInt(filters.allocateHeaderId);
    // Always exclude snapshot records from normal queries
    where.allocate_header = {
      ...(typeof where.allocate_header === 'object' ? where.allocate_header : {}),
      is_snapshot: false,
      ...(filters.brandId ? { brand_id: BigInt(filters.brandId) } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.planningHeader.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          allocate_header: { include: { brand: true } },
          _count: {
            select: {
              planning_collections: true,
              planning_genders: true,
              planning_categories: true,
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.planningHeader.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ─── GET ONE ───────────────────────────────────────────────────────────────

  async findOne(id: string | number) {
    try {
      const planning = await this.prisma.planningHeader.findUnique({
        where: { id: BigInt(id) },
        include: {
          creator: { select: { id: true, name: true, email: true } },
          allocate_header: { include: { brand: true } },
          planning_collections: {
            include: {
              season_type: true,
              store: true,
            },
          },
          planning_genders: {
            include: {
              gender: true,
              store: true,
            },
          },
          planning_categories: {
            include: {
              subcategory: {
                include: {
                  category: { include: { gender: true } },
                },
              },
            },
          },
        },
      });

      if (!planning) throw new NotFoundException('Planning header not found');
      return planning;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error(`[Planning.findOne] id=${id} error:`, err);
      throw err;
    }
  }

  // ─── HISTORICAL (for comparison) ──────────────────────────────────────────

  async findHistorical(params: {
    fiscalYear: number;
    seasonGroupName: string;
    seasonName: string;
    brandId: string;
  }) {
    const { fiscalYear, seasonGroupName, seasonName, brandId } = params;

    // Step 1: Find AllocateHeaders matching brand + budget.fiscal_year
    //         AND whose budget_allocates touch the target season_group + season
    const matchingHeaders = await this.prisma.allocateHeader.findMany({
      where: {
        brand_id: BigInt(brandId),
        is_snapshot: false,
        budget: { fiscal_year: fiscalYear },
        budget_allocates: {
          some: {
            season_group: { name: seasonGroupName },
            season: { name: seasonName },
          },
        },
      },
      select: { id: true },
    });

    if (matchingHeaders.length === 0) return null;

    const allocateHeaderIds = matchingHeaders.map(h => h.id);

    // Step 2: Find the best PlanningHeader (prefer final, then most recent approved)
    const planning = await this.prisma.planningHeader.findFirst({
      where: {
        allocate_header_id: { in: allocateHeaderIds },
        OR: [
          { status: 'APPROVED' },
          { is_final_version: true },
        ],
      },
      include: {
        planning_categories: {
          include: {
            subcategory: {
              include: { category: { include: { gender: true } } },
            },
          },
        },
        planning_collections: {
          include: { season_type: true, store: true },
        },
        planning_genders: {
          include: { gender: true, store: true },
        },
      },
      orderBy: [
        { is_final_version: 'desc' },
        { created_at: 'desc' },
      ],
    });

    return planning;
  }

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(dto: CreatePlanningDto, userId: string) {
    console.log('[PlanningService.create] allocateHeaderId:', dto.allocateHeaderId,
      'seasonTypes:', dto.seasonTypes?.length || 0,
      'genders:', dto.genders?.length || 0,
      'categories:', dto.categories?.length || 0);

    // Version = max version for this brand's allocate_header + 1
    const allocateHeaderIdBig = BigInt(dto.allocateHeaderId);
    // Find brand_id from allocate_header, then scope version to same brand
    const ah = await this.prisma.allocateHeader.findUnique({ where: { id: allocateHeaderIdBig }, select: { brand_id: true } });
    if (!ah) throw new NotFoundException('AllocateHeader not found');
    const versionWhere: any = { allocate_header: { brand_id: ah.brand_id, is_snapshot: false } };
    const lastHeader = await this.prisma.planningHeader.findFirst({
      where: versionWhere,
      orderBy: { version: 'desc' },
    });
    const version = (lastHeader?.version || 0) + 1;

    // Step 1: Create header
    const header = await this.prisma.planningHeader.create({
      data: {
        version,
        created_by: BigInt(userId),
        allocate_header_id: allocateHeaderIdBig,
      },
    });

    // Step 2: Bulk-insert child records using createMany (same pattern as update)
    if (dto.seasonTypes && dto.seasonTypes.length > 0) {
      await this.prisma.planningCollection.createMany({
        data: dto.seasonTypes.map(c => ({
          season_type_id: BigInt(c.seasonTypeId),
          store_id: BigInt(c.storeId),
          planning_header_id: header.id,
          actual_buy_pct: c.actualBuyPct || 0,
          actual_sales_pct: c.actualSalesPct || 0,
          actual_st_pct: c.actualStPct || 0,
          actual_moc: c.actualMoc || 0,
          proposed_buy_pct: c.proposedBuyPct,
          otb_proposed_amount: c.otbProposedAmount,
          pct_var_vs_last: c.pctVarVsLast || 0,
        })),
      });
    }

    if (dto.genders && dto.genders.length > 0) {
      await this.prisma.planningGender.createMany({
        data: dto.genders.map(g => ({
          gender_id: BigInt(g.genderId),
          store_id: BigInt(g.storeId),
          planning_header_id: header.id,
          actual_buy_pct: g.actualBuyPct || 0,
          actual_sales_pct: g.actualSalesPct || 0,
          actual_st_pct: g.actualStPct || 0,
          proposed_buy_pct: g.proposedBuyPct,
          otb_proposed_amount: g.otbProposedAmount,
          pct_var_vs_last: g.pctVarVsLast || 0,
        })),
      });
    }

    if (dto.categories && dto.categories.length > 0) {
      await this.prisma.planningCategory.createMany({
        data: dto.categories.map(cat => ({
          subcategory_id: BigInt(cat.subcategoryId),
          planning_header_id: header.id,
          actual_buy_pct: cat.actualBuyPct || 0,
          actual_sales_pct: cat.actualSalesPct || 0,
          actual_st_pct: cat.actualStPct || 0,
          proposed_buy_pct: cat.proposedBuyPct,
          otb_proposed_amount: cat.otbProposedAmount,
          var_lastyear_pct: cat.varLastyearPct || 0,
          otb_actual_amount: cat.otbActualAmount || 0,
          otb_actual_buy_pct: cat.otbActualBuyPct || 0,
        })),
      });
    }

    // Return full planning with includes
    return this.findOne(String(header.id));
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdatePlanningDto, userId: string) {
    const planning = await this.prisma.planningHeader.findUnique({ where: { id: BigInt(id) } });
    if (!planning) throw new NotFoundException('Planning header not found');

    if (dto.allocateHeaderId !== undefined) {
      await this.prisma.planningHeader.update({
        where: { id: BigInt(id) },
        data: { allocate_header_id: BigInt(dto.allocateHeaderId) },
      });
    }

    if (dto.seasonTypes) {
      await this.prisma.planningCollection.deleteMany({ where: { planning_header_id: BigInt(id) } });
      await this.prisma.planningCollection.createMany({
        data: dto.seasonTypes.map(c => ({
          season_type_id: BigInt(c.seasonTypeId),
          store_id: BigInt(c.storeId),
          planning_header_id: BigInt(id),
          actual_buy_pct: c.actualBuyPct || 0,
          actual_sales_pct: c.actualSalesPct || 0,
          actual_st_pct: c.actualStPct || 0,
          actual_moc: c.actualMoc || 0,
          proposed_buy_pct: c.proposedBuyPct,
          otb_proposed_amount: c.otbProposedAmount,
          pct_var_vs_last: c.pctVarVsLast || 0,
        })),
      });
    }

    if (dto.genders) {
      await this.prisma.planningGender.deleteMany({ where: { planning_header_id: BigInt(id) } });
      await this.prisma.planningGender.createMany({
        data: dto.genders.map(g => ({
          gender_id: BigInt(g.genderId),
          store_id: BigInt(g.storeId),
          planning_header_id: BigInt(id),
          actual_buy_pct: g.actualBuyPct || 0,
          actual_sales_pct: g.actualSalesPct || 0,
          actual_st_pct: g.actualStPct || 0,
          proposed_buy_pct: g.proposedBuyPct,
          otb_proposed_amount: g.otbProposedAmount,
          pct_var_vs_last: g.pctVarVsLast || 0,
        })),
      });
    }

    if (dto.categories) {
      await this.prisma.planningCategory.deleteMany({ where: { planning_header_id: BigInt(id) } });
      await this.prisma.planningCategory.createMany({
        data: dto.categories.map(cat => ({
          subcategory_id: BigInt(cat.subcategoryId),
          planning_header_id: BigInt(id),
          actual_buy_pct: cat.actualBuyPct || 0,
          actual_sales_pct: cat.actualSalesPct || 0,
          actual_st_pct: cat.actualStPct || 0,
          proposed_buy_pct: cat.proposedBuyPct,
          otb_proposed_amount: cat.otbProposedAmount,
          var_lastyear_pct: cat.varLastyearPct || 0,
          otb_actual_amount: cat.otbActualAmount || 0,
          otb_actual_buy_pct: cat.otbActualBuyPct || 0,
        })),
      });
    }

    return this.findOne(id);
  }

  // ─── COPY FROM EXISTING ────────────────────────────────────────────────────

  async createFromVersion(sourceId: string, userId: string) {
    const source = await this.prisma.planningHeader.findUnique({
      where: { id: BigInt(sourceId) },
      include: {
        planning_collections: true,
        planning_genders: true,
        planning_categories: true,
      },
    });

    if (!source) throw new NotFoundException('Source planning header not found');

    // Version = max version for this brand's allocate_header + 1
    const ah = await this.prisma.allocateHeader.findUnique({ where: { id: source.allocate_header_id }, select: { brand_id: true } });
    const versionWhere: any = ah ? { allocate_header: { brand_id: ah.brand_id, is_snapshot: false } } : {};
    const lastHeader = await this.prisma.planningHeader.findFirst({
      where: versionWhere,
      orderBy: { version: 'desc' },
    });
    const version = (lastHeader?.version || 0) + 1;

    return this.prisma.planningHeader.create({
      data: {
        version,
        created_by: BigInt(userId),
        allocate_header_id: source.allocate_header_id,
        planning_collections: {
          create: source.planning_collections.map(c => ({
            season_type: { connect: { id: c.season_type_id } },
            store: { connect: { id: c.store_id } },
            actual_buy_pct: c.actual_buy_pct,
            actual_sales_pct: c.actual_sales_pct,
            actual_st_pct: c.actual_st_pct,
            actual_moc: c.actual_moc,
            proposed_buy_pct: c.proposed_buy_pct,
            otb_proposed_amount: c.otb_proposed_amount,
            pct_var_vs_last: c.pct_var_vs_last,
          })),
        },
        planning_genders: {
          create: source.planning_genders.map(g => ({
            gender: { connect: { id: g.gender_id } },
            store: { connect: { id: g.store_id } },
            actual_buy_pct: g.actual_buy_pct,
            actual_sales_pct: g.actual_sales_pct,
            actual_st_pct: g.actual_st_pct,
            proposed_buy_pct: g.proposed_buy_pct,
            otb_proposed_amount: g.otb_proposed_amount,
            pct_var_vs_last: g.pct_var_vs_last,
          })),
        },
        planning_categories: {
          create: source.planning_categories.map(cat => ({
            subcategory: { connect: { id: cat.subcategory_id } },
            actual_buy_pct: cat.actual_buy_pct,
            actual_sales_pct: cat.actual_sales_pct,
            actual_st_pct: cat.actual_st_pct,
            proposed_buy_pct: cat.proposed_buy_pct,
            otb_proposed_amount: cat.otb_proposed_amount,
            var_lastyear_pct: cat.var_lastyear_pct,
            otb_actual_amount: cat.otb_actual_amount,
            otb_actual_buy_pct: cat.otb_actual_buy_pct,
          })),
        },
      },
      include: {
        creator: { select: { id: true, name: true } },
        planning_collections: { include: { season_type: true, store: true } },
        planning_genders: { include: { gender: true, store: true } },
        planning_categories: { include: { subcategory: true } },
      },
    });
  }

  // ─── SUBMIT ────────────────────────────────────────────────────────────────

  async submit(id: string, userId: string) {
    const planning = await this.prisma.planningHeader.findUnique({ where: { id: BigInt(id) } });
    if (!planning) throw new NotFoundException('Planning header not found');
    if (planning.status !== 'DRAFT') throw new BadRequestException(`Cannot submit with status: ${planning.status}`);
    return this.prisma.planningHeader.update({ where: { id: BigInt(id) }, data: { status: 'SUBMITTED' } });
  }

  // ─── APPROVE BY LEVEL ──────────────────────────────────────────────────────

  async approveByLevel(id: string, level: string, action: string, comment: string, userId: string) {
    const planning = await this.prisma.planningHeader.findUnique({ where: { id: BigInt(id) } });
    if (!planning) throw new NotFoundException('Planning header not found');
    if (planning.status !== 'SUBMITTED') throw new BadRequestException(`Cannot approve/reject with status: ${planning.status}. Must be SUBMITTED.`);
    const newStatus = action === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    return this.prisma.planningHeader.update({ where: { id: BigInt(id) }, data: { status: newStatus } });
  }

  // ─── FINALIZE ──────────────────────────────────────────────────────────────

  async finalize(id: string, userId: string) {
    const planning = await this.prisma.planningHeader.findUnique({ where: { id: BigInt(id) } });
    if (!planning) throw new NotFoundException('Planning header not found');
    return this.prisma.planningHeader.update({ where: { id: BigInt(id) }, data: { is_final_version: true } });
  }

  // ─── UPDATE DETAIL ─────────────────────────────────────────────────────────

  async updateDetail(planningId: string, detailId: string, dto: any, userId: string) {
    const planning = await this.prisma.planningHeader.findUnique({ where: { id: BigInt(planningId) } });
    if (!planning) throw new NotFoundException('Planning header not found');

    const updateData: any = {};
    if (dto.proposedBuyPct !== undefined) updateData.proposed_buy_pct = dto.proposedBuyPct;
    if (dto.otbProposedAmount !== undefined) updateData.otb_proposed_amount = dto.otbProposedAmount;
    if (dto.actualBuyPct !== undefined) updateData.actual_buy_pct = dto.actualBuyPct;
    if (dto.actualSalesPct !== undefined) updateData.actual_sales_pct = dto.actualSalesPct;
    if (dto.actualStPct !== undefined) updateData.actual_st_pct = dto.actualStPct;

    // Try updating each detail type by ID
    const id = BigInt(detailId);
    const collection = await this.prisma.planningCollection.findFirst({ where: { id, planning_header_id: BigInt(planningId) } });
    if (collection) return this.prisma.planningCollection.update({ where: { id }, data: updateData });

    const gender = await this.prisma.planningGender.findFirst({ where: { id, planning_header_id: BigInt(planningId) } });
    if (gender) return this.prisma.planningGender.update({ where: { id }, data: updateData });

    const category = await this.prisma.planningCategory.findFirst({ where: { id, planning_header_id: BigInt(planningId) } });
    if (category) {
      if (dto.varLastyearPct !== undefined) updateData.var_lastyear_pct = dto.varLastyearPct;
      if (dto.otbActualAmount !== undefined) updateData.otb_actual_amount = dto.otbActualAmount;
      if (dto.otbActualBuyPct !== undefined) updateData.otb_actual_buy_pct = dto.otbActualBuyPct;
      return this.prisma.planningCategory.update({ where: { id }, data: updateData });
    }

    throw new NotFoundException('Detail not found');
  }

  // ─── CATEGORY FILTER OPTIONS ────────────────────────────────────────────────

  async getCategoryFilterOptions(genderId?: string, categoryId?: string) {
    const genders = await this.prisma.gender.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const categoryWhere: any = { is_active: true };
    if (genderId) categoryWhere.gender_id = +genderId;

    const categories = await this.prisma.category.findMany({
      where: categoryWhere,
      select: { id: true, name: true, gender_id: true },
      orderBy: { name: 'asc' },
    });

    const subCategoryWhere: any = { is_active: true };
    if (categoryId) {
      subCategoryWhere.category_id = +categoryId;
    } else if (genderId) {
      subCategoryWhere.category = { gender_id: +genderId };
    }

    const subCategories = await this.prisma.subCategory.findMany({
      where: subCategoryWhere,
      select: { id: true, name: true, category_id: true },
      orderBy: { name: 'asc' },
    });

    return { genders, categories, subCategories };
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────

  async remove(id: string) {
    const planning = await this.prisma.planningHeader.findUnique({ where: { id: BigInt(id) } });
    if (!planning) throw new NotFoundException('Planning header not found');

    return this.prisma.planningHeader.delete({ where: { id: BigInt(id) } });
  }
}

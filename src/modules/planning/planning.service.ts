import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanningDto, UpdatePlanningDto, UpdatePlanningDetailDto } from './dto/planning.dto';

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
  private readonly logger = new Logger(PlanningService.name);

  constructor(private prisma: PrismaService) {}

  // ─── LIST ──────────────────────────────────────────────────────────────────

  async findAll(filters: PlanningFilters) {
    const page = Math.max(Number(filters.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 20, 1), 100);

    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.allocateHeaderId) where.allocate_header_id = BigInt(filters.allocateHeaderId);
    // Always exclude snapshot records from normal queries
    const allocateHeaderFilter: Record<string, unknown> = { is_snapshot: false };
    if (filters.brandId) allocateHeaderFilter.brand_id = BigInt(filters.brandId);
    if (filters.budgetId) allocateHeaderFilter.budget_id = BigInt(filters.budgetId);
    where.allocate_header = allocateHeaderFilter;

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
          allocate_header: {
            select: {
              id: true, brand_id: true, budget_id: true,
              brand: { select: { id: true, name: true } },
            },
          },
          planning_collections: {
            include: {
              season_type: { select: { id: true, name: true } },
              store: { select: { id: true, name: true, code: true } },
            },
          },
          planning_genders: {
            include: {
              gender: { select: { id: true, name: true } },
              store: { select: { id: true, name: true, code: true } },
            },
          },
          planning_categories: {
            include: {
              subcategory: {
                select: {
                  id: true, name: true, category_id: true,
                  category: {
                    select: { id: true, name: true, gender_id: true, gender: { select: { id: true, name: true } } },
                  },
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
      this.logger.error(`[Planning.findOne] id=${id} error:`, err);
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
    this.logger.debug('[PlanningService.create] allocateHeaderId:', dto.allocateHeaderId,
      'seasonTypes:', dto.seasonTypes?.length || 0,
      'genders:', dto.genders?.length || 0,
      'categories:', dto.categories?.length || 0);

    // Version = max version for this specific allocate_header + 1
    const allocateHeaderIdBig = BigInt(dto.allocateHeaderId);
    const ah = await this.prisma.allocateHeader.findUnique({ where: { id: allocateHeaderIdBig }, select: { brand_id: true } });
    if (!ah) throw new NotFoundException('AllocateHeader not found');

    const header = await this.prisma.$transaction(async (tx) => {
      // Scope version to this specific allocate_header_id (not brand-wide)
      const lastHeader = await tx.planningHeader.findFirst({
        where: { allocate_header_id: allocateHeaderIdBig },
        orderBy: { version: 'desc' },
      });
      const version = (lastHeader?.version || 0) + 1;

      // Step 1: Create header
      const created = await tx.planningHeader.create({
        data: {
          version,
          created_by: BigInt(userId),
          allocate_header_id: allocateHeaderIdBig,
        },
      });

      // Step 2: Bulk-insert child records using createMany
      if (dto.seasonTypes && dto.seasonTypes.length > 0) {
        await tx.planningCollection.createMany({
          data: dto.seasonTypes.map(c => ({
            season_type_id: BigInt(c.seasonTypeId),
            store_id: BigInt(c.storeId),
            planning_header_id: created.id,
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
        await tx.planningGender.createMany({
          data: dto.genders.map(g => ({
            gender_id: BigInt(g.genderId),
            store_id: BigInt(g.storeId),
            planning_header_id: created.id,
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
        await tx.planningCategory.createMany({
          data: dto.categories.map(cat => ({
            subcategory_id: BigInt(cat.subcategoryId),
            planning_header_id: created.id,
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

      return created;
    });

    // Return full planning with includes
    return this.findOne(String(header.id));
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdatePlanningDto, userId: string) {
    const planning = await this.prisma.planningHeader.findUnique({ where: { id: BigInt(id) } });
    if (!planning) throw new NotFoundException('Planning header not found');

    if (planning.created_by !== BigInt(userId)) {
      throw new ForbiddenException('You do not have permission to modify this planning');
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.allocateHeaderId !== undefined) {
        await tx.planningHeader.update({
          where: { id: BigInt(id) },
          data: { allocate_header_id: BigInt(dto.allocateHeaderId) },
        });
      }

      if (dto.seasonTypes) {
        await tx.planningCollection.deleteMany({ where: { planning_header_id: BigInt(id) } });
        await tx.planningCollection.createMany({
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
        await tx.planningGender.deleteMany({ where: { planning_header_id: BigInt(id) } });
        await tx.planningGender.createMany({
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
        await tx.planningCategory.deleteMany({ where: { planning_header_id: BigInt(id) } });
        await tx.planningCategory.createMany({
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
    });

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

    // Version = max version for this specific allocate_header + 1
    const lastHeader = await this.prisma.planningHeader.findFirst({
      where: { allocate_header_id: source.allocate_header_id },
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
    // Validate action parameter
    const validActions = ['APPROVED', 'REJECTED'];
    if (!validActions.includes(action)) {
      throw new BadRequestException(`Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`);
    }

    if (planning.status !== 'SUBMITTED') throw new BadRequestException(`Cannot approve/reject with status: ${planning.status}. Must be SUBMITTED.`);

    // Verify the caller is the designated approver for this level
    const workflowLevel = await this.prisma.approvalWorkflowLevel.findFirst({
      where: { level_order: Number(level) },
    });
    if (!workflowLevel) throw new NotFoundException(`Workflow level ${level} not found`);
    if (workflowLevel.approver_user_id !== BigInt(userId)) {
      throw new ForbiddenException('You are not the designated approver for this level');
    }

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

  async updateDetail(planningId: string, detailId: string, dto: UpdatePlanningDetailDto, userId: string) {
    const planning = await this.prisma.planningHeader.findUnique({ where: { id: BigInt(planningId) } });
    if (!planning) throw new NotFoundException('Planning header not found');

    const updateData: Record<string, unknown> = {};
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

  // ─── SALES HISTORY (from sales_history_agg) ────────────────────────────────

  /**
   * bySubCategory: raw SQL with window functions — %buy, %sale relative to category total
   * PARTITION BY gender_id, category_id so each sub's pct is within its own category group
   */
  private async aggregateBySubCategory(
    brandId: bigint, year: number, seasonId: bigint,
  ) {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      WITH base AS (
        SELECT
          s.gender_id,
          s.category_id,
          s.sub_category_id,

          SUM(ISNULL(s.buy,0)) AS sub_buy,
          SUM(SUM(ISNULL(s.buy,0)))
            OVER(PARTITION BY s.gender_id, s.category_id) AS total_category_buy,
          ISNULL(
            CAST(
              SUM(ISNULL(s.buy,0)) * 100.0 /
              NULLIF(SUM(SUM(ISNULL(s.buy,0))) OVER(PARTITION BY s.gender_id, s.category_id), 0)
            AS DECIMAL(10,2)), 0) AS buy_percent,

          SUM(ISNULL(s.sales_amt,0)) AS sub_sales_amt,
          SUM(SUM(ISNULL(s.sales_amt,0)))
            OVER(PARTITION BY s.gender_id, s.category_id) AS total_category_sales_amt,
          ISNULL(
            CAST(
              SUM(ISNULL(s.sales_amt,0)) * 100.0 /
              NULLIF(SUM(SUM(ISNULL(s.sales_amt,0))) OVER(PARTITION BY s.gender_id, s.category_id), 0)
            AS DECIMAL(10,2)), 0) AS sales_percent

        FROM dbo.sales_history_agg s
        WHERE s.[year] = @P1
          AND s.brand_id = @P2
          AND s.season_id = @P3
          AND s.sub_category_id IS NOT NULL
          AND s.category_id IS NOT NULL
        GROUP BY s.gender_id, s.category_id, s.sub_category_id
      )
      SELECT b.*,
             g.name AS gender_name,
             c.name AS category_name,
             sc.name AS sub_category_name,
             ISNULL(CAST(st_agg.st AS DECIMAL(10,4)), 0) AS st_value
      FROM base b
      LEFT JOIN dbo.gender g ON g.id = b.gender_id
      LEFT JOIN dbo.category c ON c.id = b.category_id
      LEFT JOIN dbo.sub_category sc ON sc.id = b.sub_category_id
      LEFT JOIN (
        SELECT gender_id, category_id, sub_category_id, AVG(st) AS st
        FROM dbo.sellthrough_by_subcategory_history_agg
        WHERE [year] = @P1 AND brand_id = @P2 AND season_id = @P3
        GROUP BY gender_id, category_id, sub_category_id
      ) st_agg ON st_agg.gender_id = b.gender_id
             AND st_agg.category_id = b.category_id
             AND st_agg.sub_category_id = b.sub_category_id
    `, year, brandId, seasonId);

    const bySubCategory: Record<string, any> = {};
    // Also build structured categories list
    const categoriesMap: Record<string, any> = {};

    for (const r of rows) {
      const key = `${r.gender_id}_${r.category_id}_${r.sub_category_id}`;
      bySubCategory[key] = {
        buyPct: Number(r.buy_percent) || 0,
        salesPct: Number(r.sales_percent) || 0,
        stPct: r.st_value != null ? Number(r.st_value) : 0,
        genderId: String(r.gender_id),
        genderName: r.gender_name || '',
        categoryId: String(r.category_id),
        categoryName: r.category_name || '',
        subCategoryId: String(r.sub_category_id),
        subCategoryName: r.sub_category_name || '',
      };

      // Build categories structure for the frontend
      const catKey = `${r.gender_id}_${r.category_id}`;
      if (!categoriesMap[catKey]) {
        categoriesMap[catKey] = {
          genderId: String(r.gender_id),
          genderName: r.gender_name || '',
          categoryId: String(r.category_id),
          categoryName: r.category_name || '',
          subCategories: [],
        };
      }
      categoriesMap[catKey].subCategories.push({
        id: String(r.sub_category_id),
        name: r.sub_category_name || '',
        dataKey: key,
      });
    }

    return { bySubCategory, categories: Object.values(categoriesMap) };
  }

  /**
   * aggregateByGenderStore: raw SQL with window functions
   * %buy/%sales relative to gender total (PARTITION BY gender_id), ST averaged
   * Key: gender_${genderId}_${storeId}
   */
  private async aggregateByGenderStore(
    brandId: bigint,
    year: number,
    seasonId: bigint,
  ): Promise<Record<string, { buyPct: number; salesPct: number; stPct: number }>> {
    const sql = `
      WITH base AS (
        SELECT
          store_id,
          gender_id,
          SUM(ISNULL(buy,0))       AS total_buy,
          SUM(ISNULL(sales_amt,0)) AS total_sales
        FROM dbo.sales_history_agg
        WHERE [year] = @P1 AND brand_id = @P2 AND season_id = @P3
          AND gender_id IS NOT NULL AND store_id IS NOT NULL
        GROUP BY store_id, gender_id
      )
      SELECT
        b.store_id,
        b.gender_id,
        ISNULL(CAST(b.total_buy * 100.0 /
          NULLIF(SUM(b.total_buy) OVER(PARTITION BY b.gender_id),0)
          AS DECIMAL(10,2)),0) AS buy_percent,
        ISNULL(CAST(b.total_sales * 100.0 /
          NULLIF(SUM(b.total_sales) OVER(PARTITION BY b.gender_id),0)
          AS DECIMAL(10,2)),0) AS sales_percent,
        ISNULL(CAST(st_agg.st AS DECIMAL(10,4)),0) AS st_percent
      FROM base b
      LEFT JOIN (
        SELECT store_id, gender_id, AVG(st) AS st
        FROM dbo.sellthrough_by_gender_history_agg
        WHERE [year] = @P1 AND brand_id = @P2 AND season_id = @P3
        GROUP BY store_id, gender_id
      ) st_agg ON st_agg.store_id = b.store_id AND st_agg.gender_id = b.gender_id
      ORDER BY b.gender_id, b.store_id
    `;

    const rows: any[] = await this.prisma.$queryRawUnsafe(sql, year, brandId, seasonId);
    const result: Record<string, { buyPct: number; salesPct: number; stPct: number }> = {};
    for (const r of rows) {
      const key = `gender_${r.gender_id}_${r.store_id}`;
      result[key] = {
        buyPct: Number(r.buy_percent) || 0,
        salesPct: Number(r.sales_percent) || 0,
        stPct: Number(r.st_percent) || 0,
      };
    }
    return result;
  }

  /**
   * aggregateBySeasonType: raw SQL with window functions
   * %buy/%sales relative to season_type total, ST averaged
   * Key: seasonType_${seasonTypeId}_${storeId}
   */
  private async aggregateBySeasonType(
    brandId: bigint,
    year: number,
    seasonId: bigint,
  ): Promise<Record<string, { buyPct: number; salesPct: number; stPct: number }>> {
    const sql = `
      WITH base AS (
        SELECT
          store_id,
          season_type_id,
          SUM(ISNULL(buy,0))       AS total_buy,
          SUM(ISNULL(sales_amt,0)) AS total_sales
        FROM dbo.sales_history_agg
        WHERE [year] = @P1 AND brand_id = @P2 AND season_id = @P3
          AND season_type_id IS NOT NULL AND store_id IS NOT NULL
        GROUP BY store_id, season_type_id
      )
      SELECT
        b.store_id,
        b.season_type_id,
        ISNULL(CAST(b.total_buy * 100.0 /
          NULLIF(SUM(b.total_buy) OVER(PARTITION BY b.season_type_id),0)
          AS DECIMAL(10,2)),0) AS buy_percent,
        ISNULL(CAST(b.total_sales * 100.0 /
          NULLIF(SUM(b.total_sales) OVER(PARTITION BY b.season_type_id),0)
          AS DECIMAL(10,2)),0) AS sales_percent,
        ISNULL(CAST(st_agg.st AS DECIMAL(10,4)),0) AS st_percent
      FROM base b
      LEFT JOIN (
        SELECT store_id, season_type_id, AVG(st) AS st
        FROM dbo.sellthrough_by_season_type_history_agg
        WHERE [year] = @P1 AND brand_id = @P2 AND season_id = @P3
        GROUP BY store_id, season_type_id
      ) st_agg ON st_agg.store_id = b.store_id AND st_agg.season_type_id = b.season_type_id
      ORDER BY b.season_type_id, b.store_id
    `;

    const rows: any[] = await this.prisma.$queryRawUnsafe(sql, year, brandId, seasonId);
    const result: Record<string, { buyPct: number; salesPct: number; stPct: number }> = {};
    for (const r of rows) {
      const key = `seasonType_${r.season_type_id}_${r.store_id}`;
      result[key] = {
        buyPct: Number(r.buy_percent) || 0,
        salesPct: Number(r.sales_percent) || 0,
        stPct: Number(r.st_percent) || 0,
      };
    }
    return result;
  }

  async findSalesHistory(params: {
    brandId: string;
    mode: 'same' | 'diff';
    year: number;
    seasonId: string;
    count?: number;
    tab?: 'category' | 'collection' | 'gender';
  }) {
    const { brandId, mode, year, seasonId, tab } = params;
    const count = params.count || 1;
    this.logger.debug(`[findSalesHistory] mode=${mode} brandId=${brandId} year=${year} seasonId=${seasonId} count=${count}`);

    try {
    const bId = BigInt(brandId);
    const sId = BigInt(seasonId);

    // Build list of target (year, seasonId) pairs
    let targetPeriods: { year: number; seasonId: bigint }[];

    if (mode === 'same') {
      // Same season, go back N years: year-1, year-2, ..., year-N
      targetPeriods = [];
      for (let i = 1; i <= count; i++) {
        targetPeriods.push({ year: year - i, seasonId: sId });
      }
    } else {
      // Diff: go back N seasons chronologically
      // Build flat ordered list: season_group (by id ASC) → season (by no ASC) within each group
      const seasonGroups = await this.prisma.seasonGroup.findMany({
        where: { is_active: true },
        orderBy: { id: 'asc' },
        include: {
          seasons: {
            where: { is_active: true },
            orderBy: [{ no: 'asc' }, { id: 'asc' }],
            select: { id: true, name: true, no: true },
          },
        },
      });

      // Flat chronological order within one year: SG1-S1, SG1-S2, SG2-S1, SG2-S2, ...
      const flatSeasons: { id: bigint; name: string; sgName: string }[] = [];
      for (const sg of seasonGroups) {
        for (const s of sg.seasons) {
          flatSeasons.push({ id: s.id, name: s.name, sgName: sg.name });
        }
      }

      if (flatSeasons.length === 0) {
        return { periods: [] };
      }

      // Find current season's index in the flat list
      const currentIdx = flatSeasons.findIndex(s => s.id === sId);
      if (currentIdx === -1) {
        this.logger.warn(`[findSalesHistory] seasonId=${seasonId} not found in flat season list`);
        return { periods: [] };
      }

      // Go backward: decrement index, wrap to previous year's last entry
      targetPeriods = [];
      let curYear = year;
      let curIdx = currentIdx;
      for (let i = 0; i < count; i++) {
        curIdx--;
        if (curIdx < 0) {
          curYear--;
          curIdx = flatSeasons.length - 1;
        }
        targetPeriods.push({ year: curYear, seasonId: flatSeasons[curIdx].id });
      }
    }

    this.logger.debug(`[findSalesHistory] targetPeriods: ${JSON.stringify(targetPeriods.map(p => ({ year: p.year, seasonId: String(p.seasonId) })))}`);

    if (targetPeriods.length === 0) {
      return { periods: [] };
    }

    // Fetch season names for labels
    const uniqueSeasonIds = [...new Set(targetPeriods.map(p => p.seasonId))];
    const seasonRecords = await this.prisma.season.findMany({
      where: { id: { in: uniqueSeasonIds } },
      include: { season_group: true },
    });
    const seasonMap = new Map(seasonRecords.map(s => [String(s.id), s]));

    // Aggregate each period — only compute what the active tab needs
    const periods = await Promise.all(targetPeriods.map(async (p) => {
      let bySubCategory: Record<string, any> = {};
      let bySeasonType: Record<string, any> = {};
      let byGenderStore: Record<string, any> = {};
      let categories: any[] = [];

      if (!tab || tab === 'category') {
        const res = await this.aggregateBySubCategory(bId, p.year, p.seasonId);
        bySubCategory = res.bySubCategory;
        categories = res.categories;
      }
      if (!tab || tab === 'collection') {
        bySeasonType = await this.aggregateBySeasonType(bId, p.year, p.seasonId);
      }
      if (!tab || tab === 'gender') {
        byGenderStore = await this.aggregateByGenderStore(bId, p.year, p.seasonId);
      }

      const season = seasonMap.get(String(p.seasonId));
      return {
        year: p.year,
        seasonId: String(p.seasonId),
        seasonName: season?.name || '',
        seasonGroupName: season?.season_group?.name || '',
        label: `${p.year} ${season?.season_group?.name || ''} ${season?.name || ''}`.trim(),
        bySubCategory,
        bySeasonType,
        byGenderStore,
        categories,
      };
    }));

    return { periods };

    } catch (err: any) {
      this.logger.error(`[findSalesHistory] Error: ${err?.message}`, err?.stack);
      throw err;
    }
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

  async remove(id: string, userId: string) {
    const planning = await this.prisma.planningHeader.findUnique({ where: { id: BigInt(id) } });
    if (!planning) throw new NotFoundException('Planning header not found');

    if (planning.created_by !== BigInt(userId)) {
      throw new ForbiddenException('You do not have permission to delete this planning');
    }

    return this.prisma.planningHeader.delete({ where: { id: BigInt(id) } });
  }
}

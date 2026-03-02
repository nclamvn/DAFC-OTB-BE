import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSKUProposalHeaderDto,
  AddProductDto,
  BulkAddProductsDto,
  UpdateSKUProposalDto,
  BulkSKUAllocateDto,
  BulkProposalSizingDto,
  CreateProposalSizingHeaderDto,
} from './dto/proposal.dto';

interface ProposalFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  allocateHeaderId?: string;
}

const toBigInt = (id: string | number | bigint) => BigInt(id);

/** Standard include for sizing header queries */
const SIZING_HEADER_INCLUDE = {
  creator: { select: { id: true, name: true } },
  proposal_sizings: {
    include: {
      subcategory_size: true,
      sku_proposal: { select: { id: true, product_id: true } },
    },
  },
} as const;

@Injectable()
export class ProposalService {
  constructor(private prisma: PrismaService) {}

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────

  /** Find entity or throw NotFoundException */
  private async findOrFail<T>(
    model: { findUnique: (args: any) => Promise<T | null> },
    id: string | number | bigint,
    label: string,
  ): Promise<T> {
    const entity = await model.findUnique({ where: { id: toBigInt(id) } });
    if (!entity) throw new NotFoundException(`${label} not found`);
    return entity;
  }

  /** Get next version number, scoped by a where clause */
  private async getNextVersion(
    model: { findFirst: (args: any) => Promise<any> },
    where: Record<string, any> = {},
  ): Promise<number> {
    const last = await model.findFirst({ where, orderBy: { version: 'desc' } });
    return (last?.version || 0) + 1;
  }

  /** Build conditional update data from DTO (skip undefined fields) */
  private pickDefined(dto: Record<string, any>, mapping: Record<string, string>): Record<string, any> {
    const data: Record<string, any> = {};
    for (const [dtoKey, dbKey] of Object.entries(mapping)) {
      if (dto[dtoKey] !== undefined) data[dbKey] = dto[dtoKey];
    }
    return data;
  }

  // ─── HISTORICAL (for previous year comparison) ───────────────────────

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

    // Step 2: Find best SKUProposalHeader (prefer final, then most recent approved)
    const proposal = await this.prisma.sKUProposalHeader.findFirst({
      where: {
        allocate_header_id: { in: allocateHeaderIds },
        OR: [
          { status: 'APPROVED' },
          { is_final_version: true },
        ],
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        allocate_header: { select: { id: true, brand_id: true, brand: { select: { id: true, name: true } } } },
        sku_proposals: {
          include: {
            product: {
              include: {
                brand: true,
                sub_category: {
                  include: { category: { include: { gender: true } } },
                },
              },
            },
            sku_allocates: { include: { store: true } },
          },
        },
        proposal_sizing_headers: {
          include: SIZING_HEADER_INCLUDE,
          orderBy: { version: 'asc' },
        },
      },
      orderBy: [
        { is_final_version: 'desc' },
        { created_at: 'desc' },
      ],
    });

    return proposal;
  }

  // ─── LIST SKU PROPOSAL HEADERS ─────────────────────────────────────────

  async findAll(filters: ProposalFilters) {
    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 20;

    const where: Record<string, any> = {};
    if (filters.status) where.status = filters.status;
    if (filters.allocateHeaderId) where.allocate_header_id = toBigInt(filters.allocateHeaderId);
    // Always exclude snapshot records from normal queries
    where.allocate_header = { is_snapshot: false };

    const [data, total] = await Promise.all([
      this.prisma.sKUProposalHeader.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          allocate_header: { select: { id: true, brand_id: true } },
          _count: { select: { sku_proposals: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.sKUProposalHeader.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ─── GET ONE ───────────────────────────────────────────────────────────

  async findOne(id: string | number) {
    const header = await this.prisma.sKUProposalHeader.findUnique({
      where: { id: toBigInt(id) },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        allocate_header: { select: { id: true, brand_id: true, brand: { select: { id: true, name: true } } } },
        sku_proposals: {
          include: {
            product: {
              include: {
                brand: true,
                sub_category: {
                  include: { category: { include: { gender: true } } },
                },
              },
            },
            sku_allocates: { include: { store: true } },
          },
        },
        proposal_sizing_headers: {
          include: SIZING_HEADER_INCLUDE,
          orderBy: { version: 'asc' },
        },
      },
    });

    if (!header) throw new NotFoundException('SKU Proposal Header not found');
    return header;
  }

  // ─── CREATE ────────────────────────────────────────────────────────────

  async create(dto: CreateSKUProposalHeaderDto, userId: string) {
    const allocateHeaderId = toBigInt(dto.allocateHeaderId);
    const versionWhere = { allocate_header_id: allocateHeaderId };
    const version = await this.getNextVersion(this.prisma.sKUProposalHeader, versionWhere);

    for (const item of dto.proposals) {
      const product = await this.prisma.product.findUnique({ where: { id: +item.productId } });
      if (!product) throw new BadRequestException(`Product not found: ${item.productId}`);
    }

    const header = await this.prisma.sKUProposalHeader.create({
      data: {
        version,
        allocate_header_id: allocateHeaderId,
        created_by: toBigInt(userId),
        sku_proposals: {
          create: dto.proposals.map(item => ({
            product_id: +item.productId,
            customer_target: item.customerTarget,
            unit_cost: item.unitCost,
            srp: item.srp,
          })),
        },
      },
      include: {
        creator: { select: { id: true, name: true } },
        sku_proposals: { include: { product: true } },
      },
    });

    // Auto-create 3 sizing choices (A=1, B=2, C=3) per SKUProposalHeader
    for (const v of [1, 2, 3]) {
      await this.prisma.proposalSizingHeader.create({
        data: {
          sku_proposal_header_id: header.id,
          version: v,
          created_by: toBigInt(userId),
        },
      });
    }

    return this.findOne(String(header.id));
  }

  // ─── ADD / BULK ADD PRODUCTS ───────────────────────────────────────────

  async addProduct(headerId: string, dto: AddProductDto, userId: string) {
    await this.findOrFail(this.prisma.sKUProposalHeader, headerId, 'SKU Proposal Header');

    const product = await this.prisma.product.findUnique({ where: { id: +dto.productId } });
    if (!product) throw new BadRequestException('Product not found');

    const existing = await this.prisma.sKUProposal.findFirst({
      where: { sku_proposal_header_id: +headerId, product_id: +dto.productId },
    });
    if (existing) throw new BadRequestException('Product already exists in this proposal');

    return this.prisma.sKUProposal.create({
      data: {
        sku_proposal_header_id: +headerId,
        product_id: +dto.productId,
        customer_target: dto.customerTarget,
        unit_cost: dto.unitCost,
        srp: dto.srp,
      },
      include: { product: true },
    });
  }

  async bulkAddProducts(headerId: string, dto: BulkAddProductsDto, userId: string) {
    const results: Array<{ success: boolean; productId: string; data?: any; error?: string }> = [];
    for (const productDto of dto.products) {
      try {
        const data = await this.addProduct(headerId, productDto, userId);
        results.push({ success: true, productId: productDto.productId, data });
      } catch (error: any) {
        results.push({ success: false, productId: productDto.productId, error: error.message });
      }
    }
    return results;
  }

  // ─── UPDATE / REMOVE SKU PROPOSAL ─────────────────────────────────────

  async updateProposal(proposalId: string, dto: UpdateSKUProposalDto) {
    await this.findOrFail(this.prisma.sKUProposal, proposalId, 'SKU Proposal');
    const updateData = this.pickDefined(dto, {
      customerTarget: 'customer_target',
      unitCost: 'unit_cost',
      srp: 'srp',
    });
    return this.prisma.sKUProposal.update({
      where: { id: toBigInt(proposalId) },
      data: updateData,
      include: { product: true },
    });
  }

  async removeProposal(proposalId: string) {
    await this.findOrFail(this.prisma.sKUProposal, proposalId, 'SKU Proposal');
    await this.prisma.sKUProposal.delete({ where: { id: toBigInt(proposalId) } });
    return { message: 'SKU Proposal removed' };
  }

  // ─── SKU ALLOCATE (per store) ─────────────────────────────────────────

  async createAllocations(dto: BulkSKUAllocateDto) {
    for (const alloc of dto.allocations) {
      const proposal = await this.prisma.sKUProposal.findUnique({ where: { id: +alloc.skuProposalId } });
      if (!proposal) throw new BadRequestException(`SKU Proposal not found: ${alloc.skuProposalId}`);
      const store = await this.prisma.store.findUnique({ where: { id: +alloc.storeId } });
      if (!store) throw new BadRequestException(`Store not found: ${alloc.storeId}`);
    }
    return this.prisma.$transaction(
      dto.allocations.map(alloc =>
        this.prisma.sKUAllocate.create({
          data: {
            sku_proposal_id: +alloc.skuProposalId,
            store_id: +alloc.storeId,
            quantity: alloc.quantity,
          },
          include: { store: true },
        }),
      ),
    );
  }

  async getStoreAllocations(skuProposalId: string) {
    return this.prisma.sKUAllocate.findMany({
      where: { sku_proposal_id: +skuProposalId },
      include: { store: true },
    });
  }

  async updateAllocation(allocationId: string, quantity: number) {
    await this.findOrFail(this.prisma.sKUAllocate, allocationId, 'Allocation');
    return this.prisma.sKUAllocate.update({
      where: { id: toBigInt(allocationId) },
      data: { quantity },
      include: { store: true },
    });
  }

  async deleteAllocation(allocationId: string) {
    await this.findOrFail(this.prisma.sKUAllocate, allocationId, 'Allocation');
    await this.prisma.sKUAllocate.delete({ where: { id: toBigInt(allocationId) } });
    return { message: 'Allocation deleted' };
  }

  // ─── PROPOSAL SIZING HEADER ───────────────────────────────────────────

  async createSizingHeader(dto: CreateProposalSizingHeaderDto, userId: string) {
    const proposalHeader = await this.prisma.sKUProposalHeader.findUnique({ where: { id: +dto.skuProposalHeaderId } });
    if (!proposalHeader) throw new BadRequestException(`SKU Proposal Header not found: ${dto.skuProposalHeaderId}`);

    // Enforce max 3 sizing choices (A, B, C)
    const existingCount = await this.prisma.proposalSizingHeader.count({
      where: { sku_proposal_header_id: +dto.skuProposalHeaderId },
    });
    if (existingCount >= 3) {
      throw new BadRequestException('Maximum 3 sizing choices (A, B, C) allowed per proposal header');
    }

    const version = await this.getNextVersion(
      this.prisma.proposalSizingHeader,
      { sku_proposal_header_id: +dto.skuProposalHeaderId },
    );

    return this.prisma.proposalSizingHeader.create({
      data: {
        sku_proposal_header_id: +dto.skuProposalHeaderId,
        version,
        created_by: toBigInt(userId),
        proposal_sizings: {
          create: dto.sizings.map(s => ({
            sku_proposal_id: +s.skuProposalId,
            subcategory_size_id: +s.subcategorySizeId,
            actual_salesmix_pct: s.actualSalesmixPct || 0,
            actual_st_pct: s.actualStPct || 0,
            proposal_quantity: s.proposalQuantity,
          })),
        },
      },
      include: SIZING_HEADER_INCLUDE,
    });
  }

  async getSizingHeadersByProposalHeader(skuProposalHeaderId: string) {
    await this.findOrFail(this.prisma.sKUProposalHeader, skuProposalHeaderId, 'SKU Proposal Header');
    return this.prisma.proposalSizingHeader.findMany({
      where: { sku_proposal_header_id: +skuProposalHeaderId },
      include: SIZING_HEADER_INCLUDE,
      orderBy: { version: 'asc' },
    });
  }

  async getSizingHeader(headerId: string) {
    const header = await this.prisma.proposalSizingHeader.findUnique({
      where: { id: toBigInt(headerId) },
      include: SIZING_HEADER_INCLUDE,
    });
    if (!header) throw new NotFoundException('Proposal Sizing Header not found');
    return header;
  }

  async updateSizingHeader(headerId: string, dto: any, userId: string) {
    const header = await this.findOrFail(this.prisma.proposalSizingHeader, headerId, 'Proposal Sizing Header') as any;

    const updateData: Record<string, any> = { updated_by: toBigInt(userId) };
    if (dto.isFinalVersion !== undefined) {
      updateData.is_final_version = dto.isFinalVersion;
      if (dto.isFinalVersion) {
        await this.prisma.proposalSizingHeader.updateMany({
          where: { sku_proposal_header_id: header.sku_proposal_header_id, id: { not: toBigInt(headerId) } },
          data: { is_final_version: false },
        });
      }
    }

    return this.prisma.proposalSizingHeader.update({
      where: { id: toBigInt(headerId) },
      data: updateData,
      include: SIZING_HEADER_INCLUDE,
    });
  }

  async deleteSizingHeader(headerId: string) {
    const header = await this.findOrFail(this.prisma.proposalSizingHeader, headerId, 'Proposal Sizing Header') as any;

    // Enforce min 3 sizing choices — cannot delete below 3
    const existingCount = await this.prisma.proposalSizingHeader.count({
      where: { sku_proposal_header_id: header.sku_proposal_header_id },
    });
    if (existingCount <= 3) {
      throw new BadRequestException('Cannot delete sizing choice — minimum 3 choices (A, B, C) required');
    }

    await this.prisma.proposalSizingHeader.delete({ where: { id: toBigInt(headerId) } });
    return { message: 'Proposal Sizing Header deleted' };
  }

  // ─── PROPOSAL SIZING (individual rows) ────────────────────────────────

  async createSizings(dto: BulkProposalSizingDto) {
    for (const s of dto.sizings) {
      const header = await this.prisma.proposalSizingHeader.findUnique({ where: { id: +s.proposalSizingHeaderId } });
      if (!header) throw new BadRequestException(`Proposal Sizing Header not found: ${s.proposalSizingHeaderId}`);
      const skuProposal = await this.prisma.sKUProposal.findUnique({ where: { id: +s.skuProposalId } });
      if (!skuProposal) throw new BadRequestException(`SKU Proposal not found: ${s.skuProposalId}`);
    }
    return this.prisma.$transaction(
      dto.sizings.map(s =>
        this.prisma.proposalSizing.create({
          data: {
            proposal_sizing_header_id: +s.proposalSizingHeaderId,
            sku_proposal_id: +s.skuProposalId,
            subcategory_size_id: +s.subcategorySizeId,
            actual_salesmix_pct: s.actualSalesmixPct || 0,
            actual_st_pct: s.actualStPct || 0,
            proposal_quantity: s.proposalQuantity,
          },
          include: { subcategory_size: true, sku_proposal: { select: { id: true, product_id: true } } },
        }),
      ),
    );
  }

  async getSizings(proposalSizingHeaderId: string) {
    return this.prisma.proposalSizing.findMany({
      where: { proposal_sizing_header_id: +proposalSizingHeaderId },
      include: { subcategory_size: true },
    });
  }

  async updateSizing(sizingId: string, quantity: number) {
    await this.findOrFail(this.prisma.proposalSizing, sizingId, 'Sizing');
    return this.prisma.proposalSizing.update({
      where: { id: toBigInt(sizingId) },
      data: { proposal_quantity: quantity },
      include: { subcategory_size: true },
    });
  }

  async deleteSizing(sizingId: string) {
    await this.findOrFail(this.prisma.proposalSizing, sizingId, 'Sizing');
    await this.prisma.proposalSizing.delete({ where: { id: toBigInt(sizingId) } });
    return { message: 'Sizing deleted' };
  }

  // ─── SUBMIT / APPROVE ────────────────────────────────────────────────

  async submit(id: string, userId: string) {
    const header = await this.findOrFail(this.prisma.sKUProposalHeader, id, 'SKU Proposal Header') as any;
    if (header.status !== 'DRAFT') throw new BadRequestException(`Cannot submit with status: ${header.status}`);
    return this.prisma.sKUProposalHeader.update({ where: { id: toBigInt(id) }, data: { status: 'SUBMITTED' } });
  }

  async approveByLevel(id: string, level: string, action: string, comment: string, userId: string) {
    const header = await this.findOrFail(this.prisma.sKUProposalHeader, id, 'SKU Proposal Header') as any;
    if (header.status !== 'SUBMITTED') {
      throw new BadRequestException(`Cannot approve/reject with status: ${header.status}. Must be SUBMITTED.`);
    }
    const newStatus = action === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    return this.prisma.sKUProposalHeader.update({ where: { id: toBigInt(id) }, data: { status: newStatus } });
  }

  // ─── UPDATE HEADER ────────────────────────────────────────────────────

  async updateHeader(id: string, dto: any, userId: string) {
    const header = await this.findOrFail(this.prisma.sKUProposalHeader, id, 'SKU Proposal Header') as any;
    if (header.status !== 'DRAFT') throw new ForbiddenException('Only draft proposals can be edited');
    const updateData: Record<string, any> = { updated_by: toBigInt(userId) };
    if (dto.isFinalVersion !== undefined) updateData.is_final_version = dto.isFinalVersion;
    return this.prisma.sKUProposalHeader.update({ where: { id: toBigInt(id) }, data: updateData });
  }

  // ─── STATISTICS ───────────────────────────────────────────────────────

  async getStatistics(budgetId?: string) {
    const where: Record<string, any> = { allocate_header: { is_snapshot: false } };
    if (budgetId) where.budget_id = toBigInt(budgetId);
    const total = await this.prisma.sKUProposalHeader.count({ where });
    return { totalProposals: total, byStatus: {} };
  }

  // ─── SAVE FULL PROPOSAL (products + store allocations + sizing) ──────

  async saveFullProposal(headerId: string, dto: {
    products: Array<{
      productId: string;
      customerTarget: string;
      unitCost: number;
      srp: number;
      allocations?: Array<{ storeId: string; quantity: number }>;
    }>;
    sizings?: Array<{
      version: number;
      isFinal?: boolean;
      rows?: Array<{ skuProposalProductId: string; subcategorySizeId: string; actualSalesmixPct?: number; actualStPct?: number; proposalQuantity: number }>;
    }>;
  }, userId: string) {
    await this.findOrFail(this.prisma.sKUProposalHeader, headerId, 'SKU Proposal Header');

    await this.prisma.$transaction(async (tx) => {
      // Delete existing children (cascade deletes sku_allocates)
      await tx.sKUProposal.deleteMany({ where: { sku_proposal_header_id: toBigInt(headerId) } });
      // Delete existing sizing headers (cascade deletes proposal_sizings)
      await tx.proposalSizingHeader.deleteMany({ where: { sku_proposal_header_id: toBigInt(headerId) } });

      // Re-create all SKU proposals + store allocations
      const productIdMap = new Map<string, bigint>(); // productId → skuProposal.id
      for (const prod of dto.products) {
        const skuProposal = await tx.sKUProposal.create({
          data: {
            sku_proposal_header_id: toBigInt(headerId),
            product_id: toBigInt(prod.productId),
            customer_target: prod.customerTarget || 'New',
            unit_cost: prod.unitCost || 0,
            srp: prod.srp || 0,
            created_by: toBigInt(userId),
          },
        });
        productIdMap.set(String(prod.productId), skuProposal.id);

        if (prod.allocations?.length) {
          await tx.sKUAllocate.createMany({
            data: prod.allocations.map(a => ({
              sku_proposal_id: skuProposal.id,
              store_id: toBigInt(a.storeId),
              quantity: a.quantity || 0,
            })),
          });
        }
      }

      // Create 3 sizing choices (A=1, B=2, C=3) at header level
      const sizingChoices = dto.sizings?.length === 3
        ? dto.sizings
        : [{ version: 1 }, { version: 2 }, { version: 3 }];
      for (const choice of sizingChoices) {
        const sizingRows = (choice.rows || [])
          .filter(r => productIdMap.has(r.skuProposalProductId))
          .map(r => ({
            sku_proposal_id: productIdMap.get(r.skuProposalProductId)!,
            subcategory_size_id: toBigInt(r.subcategorySizeId),
            actual_salesmix_pct: r.actualSalesmixPct || 0,
            actual_st_pct: r.actualStPct || 0,
            proposal_quantity: r.proposalQuantity || 0,
          }));

        await tx.proposalSizingHeader.create({
          data: {
            sku_proposal_header_id: toBigInt(headerId),
            version: choice.version,
            is_final_version: choice.isFinal ?? false,
            created_by: toBigInt(userId),
            ...(sizingRows.length ? {
              proposal_sizings: { create: sizingRows },
            } : {}),
          },
        });
      }
    });

    return this.findOne(headerId);
  }

  // ─── COPY PROPOSAL (save as new version) ──────────────────────────────

  async copyProposal(headerId: string, userId: string) {
    const source = await this.findOne(headerId);
    const allocateHeaderId = source.allocate_header_id;
    const versionWhere = { allocate_header_id: allocateHeaderId };
    const version = await this.getNextVersion(this.prisma.sKUProposalHeader, versionWhere);

    const newHeader = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sKUProposalHeader.create({
        data: { allocate_header_id: allocateHeaderId, version, created_by: toBigInt(userId) },
      });

      // Copy SKU proposals + allocations, build old→new ID map
      const skuIdMap = new Map<bigint, bigint>(); // old sku_proposal.id → new id
      for (const sp of source.sku_proposals) {
        const newProposal = await tx.sKUProposal.create({
          data: {
            sku_proposal_header_id: created.id,
            product_id: sp.product_id,
            customer_target: sp.customer_target,
            unit_cost: sp.unit_cost,
            srp: sp.srp,
            created_by: toBigInt(userId),
          },
        });
        skuIdMap.set(sp.id, newProposal.id);

        if (sp.sku_allocates?.length) {
          await tx.sKUAllocate.createMany({
            data: sp.sku_allocates.map((a: any) => ({
              sku_proposal_id: newProposal.id,
              store_id: a.store_id,
              quantity: a.quantity,
            })),
          });
        }
      }

      // Copy sizing headers (A, B, C) at header level with remapped sku_proposal_id
      const sizingHeaders = source.proposal_sizing_headers || [];
      if (sizingHeaders.length > 0) {
        for (const sh of sizingHeaders) {
          const sizingRows = ((sh as any).proposal_sizings || [])
            .filter((ps: any) => skuIdMap.has(ps.sku_proposal_id))
            .map((ps: any) => ({
              sku_proposal_id: skuIdMap.get(ps.sku_proposal_id)!,
              subcategory_size_id: ps.subcategory_size_id,
              actual_salesmix_pct: ps.actual_salesmix_pct || 0,
              actual_st_pct: ps.actual_st_pct || 0,
              proposal_quantity: ps.proposal_quantity || 0,
            }));

          await tx.proposalSizingHeader.create({
            data: {
              sku_proposal_header_id: created.id,
              version: sh.version,
              is_final_version: sh.is_final_version ?? false,
              created_by: toBigInt(userId),
              ...(sizingRows.length > 0 ? {
                proposal_sizings: { create: sizingRows },
              } : {}),
            },
          });
        }
      } else {
        // No existing sizing — create 3 empty choices
        for (const v of [1, 2, 3]) {
          await tx.proposalSizingHeader.create({
            data: { sku_proposal_header_id: created.id, version: v, created_by: toBigInt(userId) },
          });
        }
      }

      return created;
    });

    return this.findOne(String(newHeader.id));
  }

  // ─── DELETE HEADER ────────────────────────────────────────────────────

  async remove(id: string) {
    await this.findOrFail(this.prisma.sKUProposalHeader, id, 'SKU Proposal Header');
    return this.prisma.sKUProposalHeader.delete({ where: { id: toBigInt(id) } });
  }
}

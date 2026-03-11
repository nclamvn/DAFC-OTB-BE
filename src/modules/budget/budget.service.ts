import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import { CreateBudgetDto, UpdateBudgetDto, CreateAllocateDto, UpdateAllocateDto } from './dto/budget.dto';

interface BudgetFilters {
  fiscalYear?: number;
  status?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

  // ─── LIST BUDGETS ──────────────────────────────────────────────────────────

  async findAll(filters: BudgetFilters) {
    const { fiscalYear, status, page = 1, pageSize = 20 } = filters;

    const where: Prisma.BudgetWhereInput = {};
    if (fiscalYear) where.fiscal_year = fiscalYear;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.budget.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          brand: true,
          currency: true,
          allocate_headers: {
            where: { is_snapshot: false },
            include: {
              brand: { include: { group_brand: true } },
              budget_allocates: {
                include: { store: true, season_group: true, season: true },
              },
            },
            orderBy: { version: 'desc' },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.budget.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ─── GET ONE ───────────────────────────────────────────────────────────────

  async findOne(id: string | number | bigint) {
    const budget = await this.prisma.budget.findUnique({
      where: { id: BigInt(id) },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        brand: true,
        currency: true,
        allocate_headers: {
          where: { is_snapshot: false },
          include: {
            brand: { include: { group_brand: true } },
            creator: { select: { id: true, name: true, email: true } },
            budget_allocates: {
              include: { store: true, season_group: true, season: true },
            },
          },
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(dto: CreateBudgetDto, userId: string) {
    const budget = await this.prisma.budget.create({
      data: {
        name: dto.name,
        amount: dto.amount,
        description: dto.description,
        fiscal_year: dto.fiscalYear,
        created_by: BigInt(userId),
        ...(dto.brandId && { brand_id: BigInt(dto.brandId) }),
        ...(dto.currencyId && { currency_id: BigInt(dto.currencyId) }),
      },
    });

    if (dto.brandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: +dto.brandId } });
      if (!brand) throw new BadRequestException('Brand not found');

      if (dto.allocations && dto.allocations.length > 0) {
        await this.createAllocateHeader(budget.id, dto.brandId, dto.allocations, userId);
      } else {
        // Version = max version for this brand within the budget + 1
        const lastHeader = await this.prisma.allocateHeader.findFirst({
          where: { budget_id: budget.id, brand_id: BigInt(dto.brandId), is_snapshot: false },
          orderBy: { version: 'desc' },
        });
        const version = (lastHeader?.version || 0) + 1;
        await this.prisma.allocateHeader.create({
          data: {
            budget_id: budget.id,
            brand_id: BigInt(dto.brandId),
            version,
            is_final_version: false,
            created_by: BigInt(userId),
          },
        });
      }
    }

    return this.findOne(budget.id);
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateBudgetDto, userId: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id: BigInt(id) } });
    if (!budget) throw new NotFoundException('Budget not found');

    if (budget.created_by !== BigInt(userId)) {
      throw new ForbiddenException('You do not have permission to modify this budget');
    }

    if (budget.status !== 'DRAFT') {
      throw new ForbiddenException('Only draft budgets can be edited');
    }

    const updateData: Prisma.BudgetUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.amount !== undefined) updateData.amount = dto.amount;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.brandId !== undefined) updateData.brand = dto.brandId ? { connect: { id: BigInt(dto.brandId) } } : { disconnect: true };
    if (dto.currencyId !== undefined) updateData.currency = dto.currencyId ? { connect: { id: BigInt(dto.currencyId) } } : { disconnect: true };

    return this.prisma.budget.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
  }

  // ─── CREATE ALLOCATE HEADER ────────────────────────────────────────────────

  async createAllocateHeader(budgetId: string | number | bigint, brandId: string | number, allocations: CreateAllocateDto['allocations'], userId: string | number, isFinalVersion = false) {
    const budget = await this.prisma.budget.findUnique({ where: { id: BigInt(budgetId) } });
    if (!budget) throw new NotFoundException('Budget not found');

    const brand = await this.prisma.brand.findUnique({ where: { id: BigInt(brandId) } });
    if (!brand) throw new BadRequestException('Brand not found');

    // Version = max version for this brand within the budget + 1
    const lastHeader = await this.prisma.allocateHeader.findFirst({
      where: { budget_id: BigInt(budgetId), brand_id: BigInt(brandId), is_snapshot: false },
      orderBy: { version: 'desc' },
    });
    const version = (lastHeader?.version || 0) + 1;

    const validAllocations = allocations.filter(a => a.budgetAmount > 0);
    if (validAllocations.length === 0) {
      throw new BadRequestException('At least one allocation must have amount > 0');
    }

    return this.prisma.allocateHeader.create({
      data: {
        budget_id: BigInt(budgetId),
        brand_id: BigInt(brandId),
        version,
        is_final_version: isFinalVersion,
        created_by: BigInt(userId),
        budget_allocates: {
          create: allocations.map(a => ({
            store_id: BigInt(a.storeId),
            season_group_id: BigInt(a.seasonGroupId),
            season_id: BigInt(a.seasonId),
            budget_amount: a.budgetAmount,
          })),
        },
      },
      include: {
        brand: { include: { group_brand: true } },
        budget_allocates: {
          include: { store: true, season_group: true, season: true },
        },
      },
    });
  }

  // ─── UPDATE ALLOCATE HEADER ────────────────────────────────────────────────

  async updateAllocateHeader(headerId: string, dto: UpdateAllocateDto, userId: string) {
    const header = await this.prisma.allocateHeader.findUnique({
      where: { id: BigInt(headerId) },
    });
    if (!header) throw new NotFoundException('Allocate header not found');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isFinalVersion !== undefined) {
        await tx.allocateHeader.update({
          where: { id: BigInt(headerId) },
          data: { is_final_version: dto.isFinalVersion },
        });
      }

      await tx.budgetAllocate.deleteMany({ where: { allocate_header_id: BigInt(headerId) } });

      await tx.budgetAllocate.createMany({
        data: dto.allocations.map(a => ({
          allocate_header_id: BigInt(headerId),
          store_id: BigInt(a.storeId),
          season_group_id: BigInt(a.seasonGroupId),
          season_id: BigInt(a.seasonId),
          budget_amount: a.budgetAmount,
        })),
      });

      return tx.allocateHeader.findUnique({
        where: { id: BigInt(headerId) },
        include: {
          brand: { include: { group_brand: true } },
          budget_allocates: {
            include: { store: true, season_group: true, season: true },
          },
        },
      });
    });
  }

  // ─── SUBMIT ────────────────────────────────────────────────────────────────

  async submit(id: string, userId: string) {
    const budget = await this.prisma.budget.findUnique({
      where: { id: BigInt(id) },
      include: { allocate_headers: { where: { is_snapshot: false } } },
    });
    if (!budget) throw new NotFoundException('Budget not found');

    if (budget.created_by !== BigInt(userId)) {
      throw new ForbiddenException('You do not have permission to modify this budget');
    }

    if (budget.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot submit budget with status: ${budget.status}`);
    }

    return this.prisma.budget.update({
      where: { id: BigInt(id) },
      data: { status: 'APPROVED' },
    });
  }

  // ─── APPROVE BY LEVEL (unified handler for approvalHelper) ────────────────

  async approveByLevel(id: string, level: string, action: string, comment: string, userId: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id: BigInt(id) } });
    if (!budget) throw new NotFoundException('Budget not found');

    if (budget.status !== 'SUBMITTED') {
      throw new BadRequestException(`Cannot process budget with status: ${budget.status}. Must be SUBMITTED.`);
    }

    // Verify the approver is assigned to this level
    const workflowLevel = await this.prisma.approvalWorkflowLevel.findUnique({
      where: { id: BigInt(level) },
    });
    if (!workflowLevel) throw new BadRequestException('Approval workflow level not found');

    if (workflowLevel.approver_user_id !== BigInt(userId)) {
      throw new ForbiddenException('You are not the designated approver for this level');
    }

    if (action === 'REJECTED') return this.reject(id, userId);
    return this.approve(id, userId);
  }

  // ─── APPROVE ───────────────────────────────────────────────────────────────

  async approve(id: string, userId: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id: BigInt(id) } });
    if (!budget) throw new NotFoundException('Budget not found');

    if (budget.status !== 'SUBMITTED') {
      throw new BadRequestException(`Cannot approve budget with status: ${budget.status}. Must be SUBMITTED.`);
    }

    return this.prisma.budget.update({
      where: { id: BigInt(id) },
      data: { status: 'APPROVED' },
    });
  }

  // ─── REJECT ────────────────────────────────────────────────────────────────

  async reject(id: string, userId: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id: BigInt(id) } });
    if (!budget) throw new NotFoundException('Budget not found');

    if (budget.status !== 'SUBMITTED') {
      throw new BadRequestException(`Cannot reject budget with status: ${budget.status}. Must be SUBMITTED.`);
    }

    return this.prisma.budget.update({
      where: { id: BigInt(id) },
      data: { status: 'REJECTED' },
    });
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────

  async remove(id: string, userId: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id: BigInt(id) } });
    if (!budget) throw new NotFoundException('Budget not found');

    if (budget.created_by !== BigInt(userId)) {
      throw new ForbiddenException('You do not have permission to modify this budget');
    }

    if (budget.status !== 'DRAFT') {
      throw new ForbiddenException('Only draft budgets can be deleted');
    }

    return this.prisma.budget.delete({ where: { id: BigInt(id) } });
  }

  // ─── ARCHIVE ───────────────────────────────────────────────────────────────

  async archive(id: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id: BigInt(id) } });
    if (!budget) throw new NotFoundException('Budget not found');

    if (budget.status !== 'APPROVED') {
      throw new BadRequestException(`Only approved budgets can be archived. Current status: ${budget.status}`);
    }

    return this.prisma.budget.update({
      where: { id: BigInt(id) },
      data: { status: 'ARCHIVED' },
    });
  }

  // ─── SET FINAL ALLOCATE VERSION ────────────────────────────────────────────

  async setFinalVersion(headerId: string) {
    const header = await this.prisma.allocateHeader.findUnique({
      where: { id: BigInt(headerId) },
    });
    if (!header) throw new NotFoundException('Allocate header not found');

    return this.prisma.$transaction(async (tx) => {
      // Unset final for all other headers of same brand + budget (exclude snapshots)
      await tx.allocateHeader.updateMany({
        where: {
          budget_id: header.budget_id,
          brand_id: header.brand_id,
          id: { not: BigInt(headerId) },
          is_snapshot: false,
        },
        data: { is_final_version: false },
      });

      return tx.allocateHeader.update({
        where: { id: BigInt(headerId) },
        data: { is_final_version: true },
        include: {
          brand: { include: { group_brand: true } },
          budget_allocates: {
            include: { store: true, season_group: true, season: true },
          },
        },
      });
    });
  }

  // ─── STATISTICS ────────────────────────────────────────────────────────────

  async getStatistics(fiscalYear?: number) {
    const where: Prisma.BudgetWhereInput = {};
    if (fiscalYear) where.fiscal_year = fiscalYear;

    const [total, byStatus, totalAmount] = await Promise.all([
      this.prisma.budget.count({ where }),
      this.prisma.budget.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.budget.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const approvedBudgets = await this.prisma.budget.aggregate({
      where: { ...where, status: 'APPROVED' },
      _sum: { amount: true },
    });

    return {
      totalBudgets: total,
      totalAmount: totalAmount._sum.amount || 0,
      approvedAmount: approvedBudgets._sum.amount || 0,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import { CreateTicketDto } from './dto/ticket.dto';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface TicketFilters {
  status?: string;
  budgetId?: string;
  seasonGroupId?: string;
  seasonId?: string;
  createdBy?: string;
  page?: number;
  pageSize?: number;
}

export interface ValidationStep {
  step: number;
  label: string;
  status: 'pass' | 'fail' | 'skipped';
  details: string[];
}

export interface ValidationResult {
  valid: boolean;
  steps: ValidationStep[];
}

// ─── BigInt-safe JSON serializer ────────────────────────────────────────────────

const toBigInt = (v: string | number) => BigInt(v);

function serializeBigInt(data: any): any {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );
}

@Injectable()
export class TicketService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // VALIDATION — 4-step sequential check
  // ═══════════════════════════════════════════════════════════════════════════════

  async validateBudgetReadiness(budgetId: string): Promise<ValidationResult> {
    const steps: ValidationStep[] = [];

    // Load budget with non-snapshot allocate_headers to derive brand list
    const budget = await this.prisma.budget.findUnique({
      where: { id: toBigInt(budgetId) },
      include: {
        allocate_headers: {
          where: { is_snapshot: false },
          include: { brand: true },
        },
      },
    });
    if (!budget) throw new NotFoundException('Budget not found');

    // Derive distinct brands
    const brandMap = new Map<bigint, string>();
    for (const h of budget.allocate_headers) {
      if (!brandMap.has(h.brand_id)) {
        brandMap.set(h.brand_id, h.brand.name);
      }
    }
    const brandIds = [...brandMap.keys()];

    if (brandIds.length === 0) {
      return {
        valid: false,
        steps: [
          { step: 1, label: 'Budget Allocate Final đầy đủ cho tất cả Brand', status: 'fail' as const, details: ['Chưa có Allocate Header nào cho Budget này'] },
          { step: 2, label: 'Planning Final đầy đủ cho tất cả Brand', status: 'skipped' as const, details: ['Bỏ qua: Step 1 chưa đạt'] },
          { step: 3, label: 'SKU Proposal Final đầy đủ cho tất cả Brand', status: 'skipped' as const, details: ['Bỏ qua: Step 1 chưa đạt'] },
          { step: 4, label: 'Sizing hoàn tất (A, B, C) cho tất cả SKU Proposal', status: 'skipped' as const, details: ['Bỏ qua: Step 1 chưa đạt'] },
        ],
      };
    }

    // Cache final IDs for reuse across steps
    const finalAHMap = new Map<bigint, bigint>();
    const finalSPHMap = new Map<bigint, bigint>();

    // ──── STEP 1: Final AllocateHeader per brand ────────────────────────────────

    const step1Details: string[] = [];
    let step1Pass = true;

    for (const brandId of brandIds) {
      const finalAH = await this.prisma.allocateHeader.findFirst({
        where: {
          budget_id: toBigInt(budgetId),
          brand_id: brandId,
          is_final_version: true,
          is_snapshot: false,
        },
      });
      if (!finalAH) {
        step1Pass = false;
        step1Details.push(`Brand "${brandMap.get(brandId)}" chưa có Final Allocate version`);
      } else {
        finalAHMap.set(brandId, finalAH.id);
      }
    }

    steps.push({
      step: 1,
      label: 'Budget Allocate Final đầy đủ cho tất cả Brand',
      status: step1Pass ? 'pass' : 'fail',
      details: step1Details,
    });

    if (!step1Pass) {
      steps.push(
        { step: 2, label: 'Planning Final đầy đủ cho tất cả Brand', status: 'skipped', details: ['Bỏ qua: Step 1 chưa đạt'] },
        { step: 3, label: 'SKU Proposal Final đầy đủ cho tất cả Brand', status: 'skipped', details: ['Bỏ qua: Step 1 chưa đạt'] },
        { step: 4, label: 'Sizing hoàn tất (A, B, C) cho tất cả SKU Proposal', status: 'skipped', details: ['Bỏ qua: Step 1 chưa đạt'] },
      );
      return { valid: false, steps };
    }

    // ──── STEP 2: Final PlanningHeader per brand ────────────────────────────────

    const step2Details: string[] = [];
    let step2Pass = true;

    for (const brandId of brandIds) {
      const allocateHeaderId = finalAHMap.get(brandId)!;
      const finalPH = await this.prisma.planningHeader.findFirst({
        where: {
          allocate_header_id: allocateHeaderId,
          is_final_version: true,
        },
      });
      if (!finalPH) {
        step2Pass = false;
        step2Details.push(`Brand "${brandMap.get(brandId)}" chưa có Final Planning version`);
      }
    }

    steps.push({
      step: 2,
      label: 'Planning Final đầy đủ cho tất cả Brand',
      status: step2Pass ? 'pass' : 'fail',
      details: step2Details,
    });

    if (!step2Pass) {
      steps.push(
        { step: 3, label: 'SKU Proposal Final đầy đủ cho tất cả Brand', status: 'skipped', details: ['Bỏ qua: Step 2 chưa đạt'] },
        { step: 4, label: 'Sizing hoàn tất (A, B, C) cho tất cả SKU Proposal', status: 'skipped', details: ['Bỏ qua: Step 2 chưa đạt'] },
      );
      return { valid: false, steps };
    }

    // ──── STEP 3: Final SKUProposalHeader per brand ─────────────────────────────

    const step3Details: string[] = [];
    let step3Pass = true;

    for (const brandId of brandIds) {
      const allocateHeaderId = finalAHMap.get(brandId)!;
      const finalSPH = await this.prisma.sKUProposalHeader.findFirst({
        where: {
          allocate_header_id: allocateHeaderId,
          is_final_version: true,
        },
      });
      if (!finalSPH) {
        step3Pass = false;
        step3Details.push(`Brand "${brandMap.get(brandId)}" chưa có Final SKU Proposal version`);
      } else {
        finalSPHMap.set(brandId, finalSPH.id);
      }
    }

    steps.push({
      step: 3,
      label: 'SKU Proposal Final đầy đủ cho tất cả Brand',
      status: step3Pass ? 'pass' : 'fail',
      details: step3Details,
    });

    if (!step3Pass) {
      steps.push(
        { step: 4, label: 'Sizing hoàn tất (A, B, C) cho tất cả SKU Proposal', status: 'skipped', details: ['Bỏ qua: Step 3 chưa đạt'] },
      );
      return { valid: false, steps };
    }

    // ──── STEP 4: ProposalSizingHeaders (3 = A, B, C) per SKUProposalHeader ────

    const step4Details: string[] = [];
    let step4Pass = true;

    for (const brandId of brandIds) {
      const sphId = finalSPHMap.get(brandId)!;
      const sizingCount = await this.prisma.proposalSizingHeader.count({
        where: { sku_proposal_header_id: sphId },
      });
      if (sizingCount < 3) {
        step4Pass = false;
        step4Details.push(
          `Brand "${brandMap.get(brandId)}" có ${sizingCount}/3 Sizing version`,
        );
      }
    }

    steps.push({
      step: 4,
      label: 'Sizing hoàn tất (A, B, C) cho tất cả SKU Proposal',
      status: step4Pass ? 'pass' : 'fail',
      details: step4Details,
    });

    return { valid: step1Pass && step2Pass && step3Pass && step4Pass, steps };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SNAPSHOT — duplicate all Final records as is_snapshot = true
  // ═══════════════════════════════════════════════════════════════════════════════

  private async createSnapshotCopy(tx: Prisma.TransactionClient, budgetId: string, ticketId: bigint, userId: bigint) {
    // Load all Final AllocateHeaders (non-snapshot) with full hierarchy
    const finalHeaders = await tx.allocateHeader.findMany({
      where: {
        budget_id: toBigInt(budgetId),
        is_final_version: true,
        is_snapshot: false,
      },
      include: {
        budget_allocates: true,
        planning_headers: {
          where: { is_final_version: true },
          include: {
            planning_collections: true,
            planning_genders: true,
            planning_categories: true,
          },
        },
        sku_proposal_headers: {
          where: { is_final_version: true },
          include: {
            sku_proposals: {
              include: {
                sku_allocates: true,
              },
            },
            proposal_sizing_headers: {
              include: {
                proposal_sizings: true,
              },
            },
          },
        },
      },
    });

    for (const ah of finalHeaders) {
      // 1. Duplicate AllocateHeader
      const newAH = await tx.allocateHeader.create({
        data: {
          budget_id: ah.budget_id,
          brand_id: ah.brand_id,
          version: ah.version,
          is_final_version: ah.is_final_version,
          is_snapshot: true,
          ticket_id: ticketId,
          created_by: userId,
        },
      });

      // 2. Duplicate BudgetAllocates
      if (ah.budget_allocates.length > 0) {
        await tx.budgetAllocate.createMany({
          data: ah.budget_allocates.map(ba => ({
            allocate_header_id: newAH.id,
            store_id: ba.store_id,
            season_group_id: ba.season_group_id,
            season_id: ba.season_id,
            budget_amount: ba.budget_amount,
            created_by: userId,
          })),
        });
      }

      // 3. Duplicate Final PlanningHeaders + children
      for (const ph of ah.planning_headers) {
        const newPH = await tx.planningHeader.create({
          data: {
            allocate_header_id: newAH.id,
            version: ph.version,
            status: ph.status,
            is_final_version: ph.is_final_version,
            created_by: userId,
          },
        });

        if (ph.planning_collections.length > 0) {
          await tx.planningCollection.createMany({
            data: ph.planning_collections.map(pc => ({
              season_type_id: pc.season_type_id,
              store_id: pc.store_id,
              planning_header_id: newPH.id,
              actual_buy_pct: pc.actual_buy_pct,
              actual_sales_pct: pc.actual_sales_pct,
              actual_st_pct: pc.actual_st_pct,
              actual_moc: pc.actual_moc,
              proposed_buy_pct: pc.proposed_buy_pct,
              otb_proposed_amount: pc.otb_proposed_amount,
              pct_var_vs_last: pc.pct_var_vs_last,
              created_by: userId,
            })),
          });
        }

        if (ph.planning_genders.length > 0) {
          await tx.planningGender.createMany({
            data: ph.planning_genders.map(pg => ({
              gender_id: pg.gender_id,
              store_id: pg.store_id,
              planning_header_id: newPH.id,
              actual_buy_pct: pg.actual_buy_pct,
              actual_sales_pct: pg.actual_sales_pct,
              actual_st_pct: pg.actual_st_pct,
              proposed_buy_pct: pg.proposed_buy_pct,
              otb_proposed_amount: pg.otb_proposed_amount,
              pct_var_vs_last: pg.pct_var_vs_last,
              created_by: userId,
            })),
          });
        }

        if (ph.planning_categories.length > 0) {
          await tx.planningCategory.createMany({
            data: ph.planning_categories.map(pc => ({
              subcategory_id: pc.subcategory_id,
              planning_header_id: newPH.id,
              actual_buy_pct: pc.actual_buy_pct,
              actual_sales_pct: pc.actual_sales_pct,
              actual_st_pct: pc.actual_st_pct,
              proposed_buy_pct: pc.proposed_buy_pct,
              otb_proposed_amount: pc.otb_proposed_amount,
              var_lastyear_pct: pc.var_lastyear_pct,
              otb_actual_amount: pc.otb_actual_amount,
              otb_actual_buy_pct: pc.otb_actual_buy_pct,
              created_by: userId,
            })),
          });
        }
      }

      // 4. Duplicate Final SKUProposalHeaders + children
      for (const sph of ah.sku_proposal_headers) {
        const newSPH = await tx.sKUProposalHeader.create({
          data: {
            allocate_header_id: newAH.id,
            version: sph.version,
            status: sph.status,
            is_final_version: sph.is_final_version,
            created_by: userId,
          },
        });

        // Map old SKUProposal ID → new SKUProposal ID (for sizing remapping)
        const skuIdMap = new Map<bigint, bigint>();

        // 4a. Duplicate SKUProposals + SKUAllocates
        for (const sku of sph.sku_proposals) {
          const newSku = await tx.sKUProposal.create({
            data: {
              sku_proposal_header_id: newSPH.id,
              product_id: sku.product_id,
              customer_target: sku.customer_target,
              unit_cost: sku.unit_cost,
              srp: sku.srp,
              created_by: userId,
            },
          });
          skuIdMap.set(sku.id, newSku.id);

          if (sku.sku_allocates.length > 0) {
            await tx.sKUAllocate.createMany({
              data: sku.sku_allocates.map(sa => ({
                sku_proposal_id: newSku.id,
                store_id: sa.store_id,
                quantity: sa.quantity,
                created_by: userId,
              })),
            });
          }
        }

        // 4b. Duplicate ProposalSizingHeaders + ProposalSizings
        for (const psh of sph.proposal_sizing_headers) {
          const newPSH = await tx.proposalSizingHeader.create({
            data: {
              sku_proposal_header_id: newSPH.id,
              version: psh.version,
              is_final_version: psh.is_final_version,
              created_by: userId,
            },
          });

          if (psh.proposal_sizings.length > 0) {
            await tx.proposalSizing.createMany({
              data: psh.proposal_sizings.map(ps => ({
                proposal_sizing_header_id: newPSH.id,
                sku_proposal_id: skuIdMap.get(ps.sku_proposal_id) || ps.sku_proposal_id,
                subcategory_size_id: ps.subcategory_size_id,
                actual_salesmix_pct: ps.actual_salesmix_pct,
                actual_st_pct: ps.actual_st_pct,
                proposal_quantity: ps.proposal_quantity,
                created_by: userId,
              })),
            });
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LIST TICKETS
  // ═══════════════════════════════════════════════════════════════════════════════

  async findAll(filters: TicketFilters) {
    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 20;

    const where: Prisma.TicketWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.budgetId) where.budget_id = toBigInt(filters.budgetId);
    if (filters.seasonGroupId) where.season_group_id = toBigInt(filters.seasonGroupId);
    if (filters.seasonId) where.season_id = toBigInt(filters.seasonId);
    if (filters.createdBy) where.created_by = toBigInt(filters.createdBy);

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          budget: {
            include: {
              allocate_headers: {
                where: { is_final_version: true, is_snapshot: false },
                include: { brand: { include: { group_brand: true } } },
              },
            },
          },
          season_group: true,
          season: true,
          creator: { select: { id: true, name: true, email: true } },
          ticket_approval_logs: {
            include: {
              approver_user: { select: { id: true, name: true } },
              approval_workflow_level: true,
            },
            orderBy: { created_at: 'desc' as const },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' as const },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: serializeBigInt(data),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // GET ONE — includes snapshot data via relation
  // ═══════════════════════════════════════════════════════════════════════════════

  async findOne(id: string | number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: BigInt(id) },
      include: {
        budget: true,
        season_group: true,
        season: true,
        creator: { select: { id: true, name: true, email: true } },
        ticket_approval_logs: {
          include: {
            approver_user: { select: { id: true, name: true, email: true } },
            approval_workflow_level: true,
          },
          orderBy: { created_at: 'asc' as const },
        },
        // Load snapshot allocate headers with full hierarchy
        snapshot_allocate_headers: {
          include: {
            brand: { include: { group_brand: true } },
            budget_allocates: {
              include: { store: true, season_group: true, season: true },
            },
            planning_headers: {
              include: {
                planning_collections: {
                  include: { season_type: true, store: true },
                },
                planning_genders: {
                  include: { gender: true, store: true },
                },
                planning_categories: {
                  include: {
                    subcategory: {
                      include: { category: { include: { gender: true } } },
                    },
                  },
                },
              },
            },
            sku_proposal_headers: {
              include: {
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
                  include: {
                    proposal_sizings: {
                      include: {
                        subcategory_size: true,
                        sku_proposal: { select: { id: true, product_id: true } },
                      },
                    },
                  },
                  orderBy: { version: 'asc' as const },
                },
              },
            },
          },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    return serializeBigInt(ticket);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CREATE TICKET — validate + duplicate snapshot + create (atomic)
  // ═══════════════════════════════════════════════════════════════════════════════

  async create(dto: CreateTicketDto, userId: string) {
    // 1. Validate references exist
    const budget = await this.prisma.budget.findUnique({
      where: { id: toBigInt(dto.budgetId) },
    });
    if (!budget) throw new BadRequestException('Budget not found');

    const seasonGroup = await this.prisma.seasonGroup.findUnique({
      where: { id: toBigInt(dto.seasonGroupId) },
    });
    if (!seasonGroup) throw new BadRequestException('Season Group not found');

    const season = await this.prisma.season.findUnique({
      where: { id: toBigInt(dto.seasonId) },
    });
    if (!season) throw new BadRequestException('Season not found');

    // 2. Check for duplicate
    const existing = await this.prisma.ticket.findFirst({
      where: {
        budget_id: toBigInt(dto.budgetId),
        season_group_id: toBigInt(dto.seasonGroupId),
        season_id: toBigInt(dto.seasonId),
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Ticket đã tồn tại cho Budget + Season Group + Season này',
      );
    }

    // 3. Run 4-step validation
    const validation = await this.validateBudgetReadiness(dto.budgetId);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Budget chưa sẵn sàng để tạo Ticket',
        validation,
      });
    }

    // 4. Create ticket + snapshot in transaction
    const ticket = await this.prisma.$transaction(async (tx) => {
      // Create ticket first to get its ID
      const newTicket = await tx.ticket.create({
        data: {
          budget_id: toBigInt(dto.budgetId),
          season_group_id: toBigInt(dto.seasonGroupId),
          season_id: toBigInt(dto.seasonId),
          created_by: toBigInt(userId),
        },
      });

      // Duplicate all Final data as snapshot records
      await this.createSnapshotCopy(tx, dto.budgetId, newTicket.id, toBigInt(userId));

      // Return ticket with relations
      return tx.ticket.findUnique({
        where: { id: newTicket.id },
        include: {
          budget: true,
          season_group: true,
          season: true,
          creator: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return serializeBigInt(ticket);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // APPROVE / REJECT
  // ═══════════════════════════════════════════════════════════════════════════════

  async processApproval(
    ticketId: string,
    data: {
      approvalWorkflowLevelId: string;
      isApproved: boolean;
      comment?: string;
    },
    userId: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: BigInt(ticketId) },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.status !== 'PENDING' && ticket.status !== 'IN_REVIEW') {
      throw new BadRequestException(`Cannot process ticket with status: ${ticket.status}`);
    }

    const level = await this.prisma.approvalWorkflowLevel.findUnique({
      where: { id: +data.approvalWorkflowLevelId },
    });
    if (!level) throw new BadRequestException('Approval workflow level not found');

    if (level.approver_user_id !== BigInt(userId)) {
      throw new BadRequestException('You are not the designated approver for this level');
    }

    const log = await this.prisma.ticketApprovalLog.create({
      data: {
        ticket_id: +ticketId,
        approval_workflow_level_id: +data.approvalWorkflowLevelId,
        approver_user_id: BigInt(userId),
        is_approved: data.isApproved,
        comment: data.comment,
        approved_at: new Date(),
      },
      include: {
        approver_user: { select: { id: true, name: true } },
        approval_workflow_level: true,
      },
    });

    let newStatus = ticket.status;
    if (!data.isApproved) {
      newStatus = 'REJECTED';
    } else {
      const workflow = await this.prisma.approvalWorkflow.findFirst({
        where: {
          approval_workflow_levels: {
            some: { id: +data.approvalWorkflowLevelId },
          },
        },
        include: {
          approval_workflow_levels: {
            where: { is_required: true },
            orderBy: { level_order: 'asc' },
          },
        },
      });

      if (workflow) {
        const allLogs = await this.prisma.ticketApprovalLog.findMany({
          where: { ticket_id: +ticketId, is_approved: true },
        });
        const approvedLevelIds = new Set(allLogs.map(l => l.approval_workflow_level_id));
        const allRequiredApproved = workflow.approval_workflow_levels.every(
          lvl => approvedLevelIds.has(lvl.id),
        );
        newStatus = allRequiredApproved ? 'APPROVED' : 'IN_REVIEW';
      } else {
        newStatus = 'APPROVED';
      }
    }

    await this.prisma.ticket.update({
      where: { id: BigInt(ticketId) },
      data: { status: newStatus },
    });

    return serializeBigInt({ log, newStatus });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // APPROVAL HISTORY
  // ═══════════════════════════════════════════════════════════════════════════════

  async getApprovalHistory(ticketId: string) {
    const logs = await this.prisma.ticketApprovalLog.findMany({
      where: { ticket_id: +ticketId },
      include: {
        approver_user: { select: { id: true, name: true, email: true } },
        approval_workflow_level: true,
      },
      orderBy: { created_at: 'asc' },
    });
    return serializeBigInt(logs);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  async getStatistics() {
    const [total, byStatus] = await Promise.all([
      this.prisma.ticket.count(),
      this.prisma.ticket.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce(
        (acc, s) => {
          acc[s.status] = s._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}

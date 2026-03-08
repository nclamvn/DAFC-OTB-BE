import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import { CreateTicketDto } from './dto/ticket.dto';
import { MailService } from '../mail/mail.service';

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
  status: 'pass' | 'fail' | 'warn' | 'skipped';
  details: string[];
}

export interface ValidationResult {
  valid: boolean;
  hasWarnings?: boolean;
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
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

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
    // At least 1 brand must have final SKU proposal; others are warnings

    const step3Details: string[] = [];
    const step3Warnings: string[] = [];
    let step3HasAny = false;

    for (const brandId of brandIds) {
      const allocateHeaderId = finalAHMap.get(brandId)!;
      const finalSPH = await this.prisma.sKUProposalHeader.findFirst({
        where: {
          allocate_header_id: allocateHeaderId,
          is_final_version: true,
        },
      });
      if (!finalSPH) {
        step3Warnings.push(`Brand "${brandMap.get(brandId)}" chưa có Final SKU Proposal version`);
      } else {
        step3HasAny = true;
        finalSPHMap.set(brandId, finalSPH.id);
      }
    }

    const step3Pass = step3HasAny;
    if (!step3HasAny) {
      step3Details.push('Không có Brand nào có Final SKU Proposal version');
    }

    steps.push({
      step: 3,
      label: 'Ít nhất 1 Brand có SKU Proposal Final',
      status: step3Pass ? (step3Warnings.length > 0 ? 'warn' : 'pass') : 'fail',
      details: step3Pass ? step3Warnings : step3Details,
    });

    if (!step3Pass) {
      steps.push(
        { step: 4, label: 'Sizing hoàn tất cho SKU Proposal Final', status: 'skipped', details: ['Bỏ qua: Step 3 chưa đạt'] },
      );
      return { valid: false, steps };
    }

    // ──── STEP 4: ProposalSizingHeaders per brand (only brands with final SPH) ──
    // At least 1 brand must have sizing; others are warnings

    const step4Details: string[] = [];
    const step4Warnings: string[] = [];
    let step4HasAny = false;

    for (const brandId of finalSPHMap.keys()) {
      const sphId = finalSPHMap.get(brandId)!;
      const sizingCount = await this.prisma.proposalSizingHeader.count({
        where: { sku_proposal_header_id: sphId },
      });
      if (sizingCount < 3) {
        step4Warnings.push(
          `Brand "${brandMap.get(brandId)}" có ${sizingCount}/3 Sizing version`,
        );
      } else {
        step4HasAny = true;
      }
    }

    const step4Pass = step4HasAny;
    if (!step4HasAny) {
      step4Details.push('Không có Brand nào đủ 3 Sizing version (A, B, C)');
    }

    steps.push({
      step: 4,
      label: 'Sizing hoàn tất cho SKU Proposal Final',
      status: step4Pass ? (step4Warnings.length > 0 ? 'warn' : 'pass') : 'fail',
      details: step4Pass ? step4Warnings : step4Details,
    });

    const hasWarnings = steps.some(s => s.status === 'warn');
    return {
      valid: step1Pass && step2Pass && step3Pass && step4Pass,
      hasWarnings,
      steps,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SNAPSHOT — duplicate all Final records as is_snapshot = true
  // ═══════════════════════════════════════════════════════════════════════════════

  private async createSnapshotCopy(tx: Prisma.TransactionClient, budgetId: string, ticketId: bigint, userId: bigint) {
    // Load all Final AllocateHeaders (non-snapshot) with SKU proposals + sizing only
    // (BudgetAllocate and Planning are NOT snapshotted)
    const finalHeaders = await tx.allocateHeader.findMany({
      where: {
        budget_id: toBigInt(budgetId),
        is_final_version: true,
        is_snapshot: false,
      },
      include: {
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
      // 1. Duplicate AllocateHeader (as snapshot container)
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

      // 2. Duplicate Final SKUProposalHeaders + children
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

        // 2a. Duplicate SKUProposals + SKUAllocates
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

        // 2b. Duplicate ProposalSizingHeaders + ProposalSizings
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
        // Load snapshot allocate headers with SKU proposals + sizing only
        snapshot_allocate_headers: {
          include: {
            brand: { include: { group_brand: true } },
            sku_proposal_headers: {
              include: {
                sku_proposals: {
                  include: {
                    product: {
                      include: {
                        sub_category: {
                          include: { category: { include: { gender: true, brand: true } } },
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

    // 2. Check for duplicate — allow re-submission if previous was REJECTED
    const existing = await this.prisma.ticket.findFirst({
      where: {
        budget_id: toBigInt(dto.budgetId),
        season_group_id: toBigInt(dto.seasonGroupId),
        season_id: toBigInt(dto.seasonId),
        status: { notIn: ['REJECTED'] },
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
    // If there are warnings and force flag is not set, return warnings for confirmation
    if (validation.hasWarnings && !dto.force) {
      throw new BadRequestException({
        message: 'Một số Brand chưa hoàn tất SKU Proposal / Sizing',
        validation,
        requireConfirmation: true,
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

    // Send approval email to workflow approvers (non-blocking)
    this.sendApprovalNotification(ticket, dto.budgetId).catch(() => {});

    return serializeBigInt(ticket);
  }

  // ─── Send approval notification email (per-approver with action buttons) ──

  private async sendApprovalNotification(ticket: any, budgetId: string) {
    try {
      // Find brands linked to this budget's final allocate headers
      const finalHeaders = await this.prisma.allocateHeader.findMany({
        where: {
          budget_id: toBigInt(budgetId),
          is_final_version: true,
          is_snapshot: false,
        },
        include: {
          brand: { include: { group_brand: true } },
          sku_proposal_headers: {
            where: { is_final_version: true },
            include: {
              sku_proposals: {
                include: { sku_allocates: true },
              },
            },
          },
        },
      });

      // Collect approvers WITH their workflow level info
      const approverList: {
        userId: string;
        name: string;
        email: string;
        levelId: string;
        levelName: string;
      }[] = [];
      const seenKeys = new Set<string>();
      const groupBrandIds = new Set(finalHeaders.map(h => h.brand.group_brand_id).filter(Boolean));

      let hasWorkflow = false;
      for (const gbId of groupBrandIds) {
        const workflows = await this.prisma.approvalWorkflow.findMany({
          where: { group_brand_id: gbId },
          include: {
            approval_workflow_levels: {
              include: {
                approver_user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        });
        for (const wf of workflows) {
          for (const level of wf.approval_workflow_levels) {
            hasWorkflow = true;
            const u = level.approver_user;
            const key = `${u?.id}_${level.id}`;
            if (u?.email && !seenKeys.has(key)) {
              seenKeys.add(key);
              approverList.push({
                userId: String(u.id),
                name: u.name,
                email: u.email,
                levelId: String(level.id),
                levelName: level.level_name,
              });
            }
          }
        }
      }

      // Fallback: if no approval workflow configured, find admin users
      if (!hasWorkflow) {
        const adminRole = await this.prisma.role.findFirst({
          where: { name: { contains: 'admin' } },
        });
        if (adminRole) {
          const adminUsers = await this.prisma.user.findMany({
            where: { role_id: adminRole.id },
            select: { id: true, name: true, email: true },
          });
          for (const admin of adminUsers) {
            if (admin.email) {
              approverList.push({
                userId: String(admin.id),
                name: admin.name,
                email: admin.email,
                levelId: 'admin_default',
                levelName: 'Admin (Default)',
              });
            }
          }
        }
      }

      if (approverList.length === 0) return;

      // Calculate totals from final proposals
      let totalSKUs = 0;
      let totalOrder = 0;
      let totalValue = 0;
      const brandNames: string[] = [];

      for (const ah of finalHeaders) {
        brandNames.push(ah.brand.name);
        for (const sph of ah.sku_proposal_headers) {
          for (const sp of sph.sku_proposals) {
            totalSKUs++;
            const orderQty = sp.sku_allocates.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
            totalOrder += orderQty;
            totalValue += orderQty * (Number(sp.unit_cost) || 0);
          }
        }
      }

      // DEBUG: hardcode recipient for testing — remove in production
      const debugEmail = 'manh.le@tcdata.vn';
      const debugName = 'Manh Le';

      // Send individual email to each approver (with personalized action tokens)
      for (const approver of approverList) {
        await this.mailService.sendApprovalEmail({
          ticketId: String(ticket.id),
          budgetName: ticket.budget?.budget_name || '',
          brandName: brandNames.join(', '),
          seasonGroup: ticket.season_group?.name || '',
          season: ticket.season?.name || '',
          fiscalYear: String(ticket.budget?.fiscal_year || ''),
          creatorName: ticket.creator?.name || '',
          totalSKUs,
          totalOrder,
          totalValue,
          // DEBUG: override email for testing
          approverName: debugName || approver.name,
          approverEmail: debugEmail || approver.email,
          approverUserId: approver.userId,
          approvalWorkflowLevelId: approver.levelId,
          levelName: approver.levelName,
        });
      }
    } catch (err: any) {
      console.error('[TicketService] Failed to send approval notification:', err.message);
    }
  }

  // ─── Process email action (approve/reject from email link) ─────────────────

  async processEmailAction(token: string): Promise<string> {
    if (!token) {
      return this.mailService.buildResultHtml(false, '', '?', 'No token provided.');
    }

    let payload: any;
    try {
      payload = this.mailService.verifyActionToken(token);
    } catch (err: any) {
      const msg = err.name === 'TokenExpiredError'
        ? 'This link has expired (72h). Please log in to the system to approve/reject.'
        : 'Invalid or tampered link.';
      return this.mailService.buildResultHtml(false, '', '?', msg);
    }

    if (payload.type !== 'email_action') {
      return this.mailService.buildResultHtml(false, '', '?', 'Invalid token type.');
    }

    const { ticketId, approverUserId, approvalWorkflowLevelId, action } = payload;

    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: BigInt(ticketId) },
      });
      if (!ticket) {
        return this.mailService.buildResultHtml(false, action, ticketId, 'Ticket not found.');
      }
      if (!['PENDING', 'IN_REVIEW'].includes(ticket.status)) {
        return this.mailService.buildResultHtml(
          true, action, ticketId,
          `Ticket has already been ${ticket.status.toLowerCase()}. No further action needed.`,
        );
      }

      // Admin default fallback — no real workflow level
      if (approvalWorkflowLevelId === 'admin_default') {
        const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
        await this.prisma.ticket.update({
          where: { id: BigInt(ticketId) },
          data: { status: newStatus },
        });
        return this.mailService.buildResultHtml(true, action, ticketId,
          `Ticket #${ticketId} has been ${newStatus.toLowerCase()} by Admin.`);
      }

      // Check if already processed
      const existing = await this.prisma.ticketApprovalLog.findFirst({
        where: {
          ticket_id: BigInt(ticketId),
          approval_workflow_level_id: BigInt(approvalWorkflowLevelId),
          approver_user_id: BigInt(approverUserId),
        },
      });
      if (existing) {
        const prevAction = existing.is_approved ? 'approved' : 'rejected';
        return this.mailService.buildResultHtml(
          true, action, ticketId,
          `You have already ${prevAction} this ticket. No further action needed.`,
        );
      }

      // Process the approval using existing logic
      await this.processApproval(
        ticketId,
        {
          approvalWorkflowLevelId,
          isApproved: action === 'approve',
          comment: `${action === 'approve' ? 'Approved' : 'Rejected'} via email`,
        },
        approverUserId,
      );

      return this.mailService.buildResultHtml(true, action, ticketId);
    } catch (err: any) {
      return this.mailService.buildResultHtml(false, action, ticketId, err.message);
    }
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

    if (!['PENDING', 'SUBMITTED', 'IN_REVIEW'].includes(ticket.status)) {
      throw new BadRequestException(`Cannot process ticket with status: ${ticket.status}`);
    }

    // ── Admin direct approval (no workflow configured) ──
    if (data.approvalWorkflowLevelId === 'admin_default') {
      const adminUser = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        include: { role: true },
      });
      if (!adminUser?.role?.name?.toLowerCase().includes('admin')) {
        throw new BadRequestException('Only admin users can perform direct approval');
      }

      const newStatus = data.isApproved ? 'APPROVED' : 'REJECTED';
      await this.prisma.ticket.update({
        where: { id: BigInt(ticketId) },
        data: { status: newStatus },
      });

      return serializeBigInt({
        log: {
          ticket_id: ticketId,
          approver_user: { id: adminUser.id, name: adminUser.name },
          is_approved: data.isApproved,
          comment: data.comment,
          approved_at: new Date(),
        },
        newStatus,
      });
    }

    // ── Standard workflow approval ──
    const level = await this.prisma.approvalWorkflowLevel.findUnique({
      where: { id: BigInt(data.approvalWorkflowLevelId) },
    });
    if (!level) throw new BadRequestException('Approval workflow level not found');

    if (level.approver_user_id !== BigInt(userId)) {
      throw new BadRequestException('You are not the designated approver for this level');
    }

    const log = await this.prisma.ticketApprovalLog.create({
      data: {
        ticket_id: BigInt(ticketId),
        approval_workflow_level_id: BigInt(data.approvalWorkflowLevelId),
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
            some: { id: BigInt(data.approvalWorkflowLevelId) },
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
          where: { ticket_id: BigInt(ticketId), is_approved: true },
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
      where: { ticket_id: BigInt(ticketId) },
      include: {
        approver_user: { select: { id: true, name: true, email: true } },
        approval_workflow_level: true,
      },
      orderBy: { created_at: 'asc' },
    });
    return serializeBigInt(logs);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // COMPARE — diff current ticket vs previous rejected ticket
  // ═══════════════════════════════════════════════════════════════════════════════

  async compareWithPrevious(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: BigInt(ticketId) },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Find the most recent REJECTED ticket with same budget + season_group + season
    const previousTicket = await this.prisma.ticket.findFirst({
      where: {
        budget_id: ticket.budget_id,
        season_group_id: ticket.season_group_id,
        season_id: ticket.season_id,
        status: 'REJECTED',
        id: { not: ticket.id },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!previousTicket) {
      return serializeBigInt({ hasPrevious: false, previousTicketId: null, changes: null });
    }

    // Load snapshot data for both tickets
    const snapshotInclude = {
      brand: true,
      sku_proposal_headers: {
        include: {
          sku_proposals: {
            include: {
              product: {
                include: {
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
                include: { subcategory_size: true },
              },
            },
            orderBy: { version: 'asc' as const },
          },
        },
      },
    };

    const [currentSnaps, previousSnaps] = await Promise.all([
      this.prisma.allocateHeader.findMany({
        where: { ticket_id: ticket.id, is_snapshot: true },
        include: snapshotInclude,
      }),
      this.prisma.allocateHeader.findMany({
        where: { ticket_id: previousTicket.id, is_snapshot: true },
        include: snapshotInclude,
      }),
    ]);

    // Build flat SKU maps from snapshots: productId → { sku, name, orderQty, storeQty, sizing, unitCost, srp, brand, subCategory }
    const buildSkuMap = (snaps: any[]) => {
      const map = new Map<string, any>();
      for (const ah of snaps) {
        const brandName = ah.brand?.name || '';
        for (const sph of (ah.sku_proposal_headers || [])) {
          const sizingHeaders = sph.proposal_sizing_headers || [];
          const finalSizing = sizingHeaders.find((sh: any) => sh.is_final_version) || sizingHeaders[sizingHeaders.length - 1];
          const sizingBySkuId: Record<string, Record<string, number>> = {};
          if (finalSizing) {
            for (const ps of (finalSizing.proposal_sizings || [])) {
              const skuPropId = String(ps.sku_proposal_id);
              const sizeLabel = ps.subcategory_size?.name || String(ps.subcategory_size_id);
              if (!sizingBySkuId[skuPropId]) sizingBySkuId[skuPropId] = {};
              sizingBySkuId[skuPropId][sizeLabel] = Number(ps.proposal_quantity || 0);
            }
          }

          for (const sku of (sph.sku_proposals || [])) {
            const product = sku.product || {};
            const subCat = product.sub_category || {};
            const cat = subCat.category || {};
            const productId = String(product.id || sku.product_id);
            const allocates = sku.sku_allocates || [];
            const storeQty: Record<string, number> = {};
            let totalOrder = 0;
            for (const sa of allocates) {
              const storeCode = sa.store?.code || sa.store?.name || String(sa.store_id);
              storeQty[storeCode] = Number(sa.quantity || 0);
              totalOrder += Number(sa.quantity || 0);
            }

            map.set(productId, {
              productId,
              skuCode: product.sku_code || product.item_code || '',
              name: product.product_name || product.name || '',
              imageUrl: product.image_url || '',
              brand: brandName,
              category: cat.name || '',
              subCategory: subCat.name || '',
              gender: cat.gender?.name || '',
              unitCost: Number(sku.unit_cost || 0),
              srp: Number(sku.srp || 0),
              orderQty: totalOrder,
              storeQty,
              sizing: sizingBySkuId[String(sku.id)] || {},
              customerTarget: sku.customer_target || '',
            });
          }
        }
      }
      return map;
    };

    const currentMap = buildSkuMap(currentSnaps);
    const previousMap = buildSkuMap(previousSnaps);

    // Compute diff
    const added: any[] = [];
    const removed: any[] = [];
    const modified: any[] = [];

    // Find added & modified
    for (const [productId, curr] of currentMap) {
      const prev = previousMap.get(productId);
      if (!prev) {
        added.push(curr);
      } else {
        // Check for changes
        const changes: any = {};
        if (curr.orderQty !== prev.orderQty) {
          changes.orderQty = { from: prev.orderQty, to: curr.orderQty };
        }
        if (curr.unitCost !== prev.unitCost) {
          changes.unitCost = { from: prev.unitCost, to: curr.unitCost };
        }
        if (curr.srp !== prev.srp) {
          changes.srp = { from: prev.srp, to: curr.srp };
        }
        if (curr.customerTarget !== prev.customerTarget) {
          changes.customerTarget = { from: prev.customerTarget, to: curr.customerTarget };
        }

        // Store allocation changes
        const allStores = new Set([...Object.keys(curr.storeQty), ...Object.keys(prev.storeQty)]);
        const storeChanges: Record<string, { from: number; to: number }> = {};
        for (const store of allStores) {
          const cVal = curr.storeQty[store] || 0;
          const pVal = prev.storeQty[store] || 0;
          if (cVal !== pVal) storeChanges[store] = { from: pVal, to: cVal };
        }
        if (Object.keys(storeChanges).length > 0) changes.storeQty = storeChanges;

        // Sizing changes
        const allSizes = new Set([...Object.keys(curr.sizing), ...Object.keys(prev.sizing)]);
        const sizingChanges: Record<string, { from: number; to: number }> = {};
        for (const size of allSizes) {
          const cVal = curr.sizing[size] || 0;
          const pVal = prev.sizing[size] || 0;
          if (cVal !== pVal) sizingChanges[size] = { from: pVal, to: cVal };
        }
        if (Object.keys(sizingChanges).length > 0) changes.sizing = sizingChanges;

        if (Object.keys(changes).length > 0) {
          modified.push({ ...curr, changes, previous: prev });
        }
      }
    }

    // Find removed
    for (const [productId, prev] of previousMap) {
      if (!currentMap.has(productId)) {
        removed.push(prev);
      }
    }

    // Summary
    const currentTotal = [...currentMap.values()].reduce((s, v) => s + v.orderQty, 0);
    const previousTotal = [...previousMap.values()].reduce((s, v) => s + v.orderQty, 0);
    const currentValue = [...currentMap.values()].reduce((s, v) => s + v.orderQty * v.srp, 0);
    const previousValue = [...previousMap.values()].reduce((s, v) => s + v.orderQty * v.srp, 0);

    return serializeBigInt({
      hasPrevious: true,
      previousTicketId: String(previousTicket.id),
      previousTicketStatus: previousTicket.status,
      previousTicketDate: previousTicket.created_at,
      changes: {
        added,
        removed,
        modified,
        summary: {
          addedCount: added.length,
          removedCount: removed.length,
          modifiedCount: modified.length,
          currentSkuCount: currentMap.size,
          previousSkuCount: previousMap.size,
          orderDiff: currentTotal - previousTotal,
          currentOrder: currentTotal,
          previousOrder: previousTotal,
          valueDiff: currentValue - previousValue,
          currentValue,
          previousValue,
        },
      },
    });
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

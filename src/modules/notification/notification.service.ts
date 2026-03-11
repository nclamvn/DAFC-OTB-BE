import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotificationItem {
  id: string;
  type: 'approval' | 'status_change' | 'pending_action';
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success' | 'error';
  createdAt: Date;
  read: boolean;
}

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get notifications for a user by aggregating:
   * 1. Recent approval-related audit log entries on their submissions
   * 2. Items pending their review
   */
  async getNotifications(userId: string, limit = 20): Promise<NotificationItem[]> {
    const notifications: NotificationItem[] = [];

    // 1. Recent approval/rejection actions from audit log (last 7 days)
    const recentApprovalLogs = await this.prisma.auditLog.findMany({
      where: {
        action: { in: ['APPROVED', 'REJECTED'] },
        created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    // Filter: only approval actions on entities the user created
    for (const logEntry of recentApprovalLogs) {
      let isOwner = false;
      let entityName = '';

      if (logEntry.entity_type === 'budget') {
        const budget = await this.prisma.budget.findUnique({
          where: { id: BigInt(logEntry.entity_id) },
          select: { created_by: true, name: true },
        });
        if (budget && String(budget.created_by) === userId) {
          isOwner = true;
          entityName = budget.name;
        }
      } else if (logEntry.entity_type === 'planning') {
        const plan = await this.prisma.planningHeader.findUnique({
          where: { id: BigInt(logEntry.entity_id) },
          select: { created_by: true },
        });
        if (plan && String(plan.created_by) === userId) {
          isOwner = true;
          entityName = `Planning #${logEntry.entity_id}`;
        }
      } else if (logEntry.entity_type === 'proposal') {
        const proposal = await this.prisma.sKUProposalHeader.findUnique({
          where: { id: BigInt(logEntry.entity_id) },
          select: { created_by: true },
        });
        if (proposal && String(proposal.created_by) === userId) {
          isOwner = true;
          entityName = `Proposal #${logEntry.entity_id}`;
        }
      }

      if (isOwner) {
        const isApproved = logEntry.action === 'APPROVED';
        // Parse changes to extract approver info if available
        let approverName = 'A reviewer';
        let comment = '';
        let level = '';
        if (logEntry.changes) {
          try {
            const changes = JSON.parse(logEntry.changes);
            if (changes.approverName) approverName = changes.approverName;
            if (changes.comment) comment = changes.comment;
            if (changes.level) level = ` (L${changes.level})`;
          } catch {
            // ignore parse errors
          }
        }

        notifications.push({
          id: `audit-${String(logEntry.id)}`,
          type: 'approval',
          entityType: logEntry.entity_type,
          entityId: logEntry.entity_id,
          title: isApproved
            ? `${logEntry.entity_type} approved`
            : `${logEntry.entity_type} rejected`,
          message: `${approverName} ${isApproved ? 'approved' : 'rejected'} ${entityName}${level}${comment ? ': ' + comment : ''}`,
          severity: isApproved ? 'success' : 'error',
          createdAt: logEntry.created_at,
          read: false,
        });
      }
    }

    // 2. Pending items awaiting user's action (items in SUBMITTED or LEVEL1_APPROVED)
    const [pendingBudgets, pendingPlans, pendingProposals] = await Promise.all([
      this.prisma.budget.count({ where: { status: { in: ['SUBMITTED', 'LEVEL1_APPROVED'] } } }),
      this.prisma.planningHeader.count({ where: { status: { in: ['SUBMITTED', 'LEVEL1_APPROVED'] } } }),
      this.prisma.sKUProposalHeader.count({ where: { status: { in: ['SUBMITTED', 'LEVEL1_APPROVED'] } } }),
    ]);

    const totalPending = pendingBudgets + pendingPlans + pendingProposals;
    if (totalPending > 0) {
      notifications.push({
        id: 'pending-approvals',
        type: 'pending_action',
        entityType: 'all',
        entityId: '',
        title: 'Pending approvals',
        message: `${totalPending} item(s) awaiting review: ${pendingBudgets} budget(s), ${pendingPlans} plan(s), ${pendingProposals} proposal(s)`,
        severity: 'warning',
        createdAt: new Date(),
        read: false,
      });
    }

    // Sort by date desc, limit
    return notifications
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ── Retention policy constants (days) ──────────────────────────────────
export const AUDIT_LOG_RETENTION_DAYS = 365;
export const ARCHIVED_BUDGET_RETENTION_DAYS = 730;
export const IMPORT_SESSION_RETENTION_DAYS = 180;

export interface RetentionPolicy {
  auditLogRetentionDays: number;
  archivedBudgetRetentionDays: number;
  importSessionRetentionDays: number;
}

export interface CleanupResult {
  auditLogsDeleted: number;
  archivedBudgetsDeleted: number;
  importSessionsDeleted: number;
  importRecordsDeleted: number;
  executedAt: string;
  durationMs: number;
}

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the current data retention policy configuration.
   */
  getRetentionPolicy(): RetentionPolicy {
    return {
      auditLogRetentionDays: AUDIT_LOG_RETENTION_DAYS,
      archivedBudgetRetentionDays: ARCHIVED_BUDGET_RETENTION_DAYS,
      importSessionRetentionDays: IMPORT_SESSION_RETENTION_DAYS,
    };
  }

  /**
   * Runs a manual cleanup of old records based on the retention policy.
   * - Deletes audit logs older than AUDIT_LOG_RETENTION_DAYS
   * - Deletes ARCHIVED budgets older than ARCHIVED_BUDGET_RETENTION_DAYS
   * - Deletes import sessions/records older than IMPORT_SESSION_RETENTION_DAYS
   */
  async cleanup(): Promise<CleanupResult> {
    const start = Date.now();
    this.logger.log('Starting data retention cleanup...');

    const now = new Date();

    const auditLogCutoff = new Date(now);
    auditLogCutoff.setDate(auditLogCutoff.getDate() - AUDIT_LOG_RETENTION_DAYS);

    const archivedBudgetCutoff = new Date(now);
    archivedBudgetCutoff.setDate(archivedBudgetCutoff.getDate() - ARCHIVED_BUDGET_RETENTION_DAYS);

    const importSessionCutoff = new Date(now);
    importSessionCutoff.setDate(importSessionCutoff.getDate() - IMPORT_SESSION_RETENTION_DAYS);

    // 1. Delete old audit logs
    const auditLogResult = await this.prisma.auditLog.deleteMany({
      where: {
        created_at: { lt: auditLogCutoff },
      },
    });
    this.logger.log(
      `Deleted ${auditLogResult.count} audit logs older than ${AUDIT_LOG_RETENTION_DAYS} days (before ${auditLogCutoff.toISOString()})`,
    );

    // 2. Delete old ARCHIVED budgets (and cascading details)
    //    Only budgets with status=ARCHIVED are eligible for cleanup.
    const archivedBudgetResult = await this.prisma.budget.deleteMany({
      where: {
        status: 'ARCHIVED',
        updated_at: { lt: archivedBudgetCutoff },
      },
    });
    this.logger.log(
      `Deleted ${archivedBudgetResult.count} archived budgets older than ${ARCHIVED_BUDGET_RETENTION_DAYS} days (before ${archivedBudgetCutoff.toISOString()})`,
    );

    // 3. Delete old import records (by cutoff on importedAt)
    const importRecordResult = await this.prisma.importedRecord.deleteMany({
      where: {
        created_at: { lt: importSessionCutoff },
      },
    });
    this.logger.log(
      `Deleted ${importRecordResult.count} imported records older than ${IMPORT_SESSION_RETENTION_DAYS} days`,
    );

    // 4. Delete old import sessions
    const importSessionResult = await this.prisma.importSession.deleteMany({
      where: {
        created_at: { lt: importSessionCutoff },
      },
    });
    this.logger.log(
      `Deleted ${importSessionResult.count} import sessions older than ${IMPORT_SESSION_RETENTION_DAYS} days`,
    );

    const durationMs = Date.now() - start;
    this.logger.log(`Data retention cleanup completed in ${durationMs}ms`);

    return {
      auditLogsDeleted: auditLogResult.count,
      archivedBudgetsDeleted: archivedBudgetResult.count,
      importSessionsDeleted: importSessionResult.count,
      importRecordsDeleted: importRecordResult.count,
      executedAt: now.toISOString(),
      durationMs,
    };
  }
}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { BudgetModule } from './modules/budget/budget.module';
import { PlanningModule } from './modules/planning/planning.module';
import { ProposalModule } from './modules/proposal/proposal.module';
import { AiModule } from './modules/ai/ai.module';
import { ApprovalWorkflowModule } from './modules/approval-workflow/approval-workflow.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { OrderModule } from './modules/order/order.module';
import { ReceiptModule } from './modules/receipt/receipt.module';
import { ImportModule } from './modules/import/import.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DataRetentionModule } from './modules/data-retention/data-retention.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    MasterDataModule,
    BudgetModule,
    PlanningModule,
    ProposalModule,
    AiModule,
    ApprovalWorkflowModule,
    TicketModule,
    OrderModule,
    ReceiptModule,
    ImportModule,
    NotificationModule,
    DataRetentionModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

import { Controller, Post, Body } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('test')
  async testMail(@Body() body: { to?: string }) {
    const toEmail = body.to || 'test@example.com';

    await this.mailService.sendApprovalEmail({
      ticketId: '999',
      budgetName: 'Test Budget FY2026',
      brandName: 'Test Brand',
      seasonGroup: 'SS',
      season: 'Spring 2026',
      fiscalYear: '2026',
      creatorName: 'Test User',
      totalSKUs: 42,
      totalOrder: 1500,
      totalValue: 125000,
      approverName: 'Approver Test',
      approverEmail: toEmail,
      approverUserId: '1',
      approvalWorkflowLevelId: '1',
      levelName: 'Level 1 - Manager',
    });

    return { message: `Test email sent to ${toEmail}` };
  }
}

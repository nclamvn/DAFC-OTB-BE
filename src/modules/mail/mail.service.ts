import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as jwt from 'jsonwebtoken';

// ─── Email Action Token ──────────────────────────────────────────────────────

export interface EmailActionPayload {
  ticketId: string;
  approverUserId: string;
  approvalWorkflowLevelId: string;
  action: 'approve' | 'reject';
}

// ─── Dynamic Template Variables ──────────────────────────────────────────────

export interface ApprovalEmailData {
  ticketId: string;
  budgetName: string;
  brandName: string;
  seasonGroup: string;
  season: string;
  fiscalYear: string;
  creatorName: string;
  totalSKUs: number;
  totalOrder: number;
  totalValue: number;
  approverName: string;
  approverEmail: string;
  approverUserId: string;
  approvalWorkflowLevelId: string;
  levelName: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // SMTP TRANSPORTER (nodemailer)
  // ═══════════════════════════════════════════════════════════════════════════

  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) return this.transporter;

    const host = process.env.MAIL_HOST;
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;

    // If SMTP credentials are configured, use them (production)
    if (host && user && pass) {
      const port = parseInt(process.env.MAIL_PORT || '587', 10);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP transporter initialized: ${user}@${host}:${port}`);
      return this.transporter;
    }

    // Fallback: use Ethereal test account (dev/testing)
    this.logger.warn('SMTP not configured — creating Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    this.transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    this.logger.log(`Ethereal test account: ${testAccount.user}`);
    this.logger.log(`View emails at: https://ethereal.email/login (user: ${testAccount.user}, pass: ${testAccount.pass})`);
    return this.transporter;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN — sign & verify for email action buttons
  // ═══════════════════════════════════════════════════════════════════════════

  generateActionToken(payload: EmailActionPayload): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    return jwt.sign(
      { ...payload, type: 'email_action' },
      secret,
      { expiresIn: '72h' },
    );
  }

  verifyActionToken(token: string): EmailActionPayload & { type: string } {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not configured');
    return jwt.verify(token, secret) as EmailActionPayload & { type: string };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND APPROVAL EMAIL — per approver with action buttons
  // ═══════════════════════════════════════════════════════════════════════════

  async sendApprovalEmail(data: ApprovalEmailData): Promise<void> {
    const mailFrom = process.env.MAIL_FROM || process.env.MAIL_USER;
    if (!mailFrom) {
      this.logger.warn('MAIL_FROM / MAIL_USER not configured, skipping approval email');
      return;
    }

    const appUrl = process.env.APP_URL || 'http://localhost:4001';

    // Generate signed tokens for approve & reject
    const approveToken = this.generateActionToken({
      ticketId: data.ticketId,
      approverUserId: data.approverUserId,
      approvalWorkflowLevelId: data.approvalWorkflowLevelId,
      action: 'approve',
    });
    const rejectToken = this.generateActionToken({
      ticketId: data.ticketId,
      approverUserId: data.approverUserId,
      approvalWorkflowLevelId: data.approvalWorkflowLevelId,
      action: 'reject',
    });

    const approveUrl = `${appUrl}/api/tickets/email-action?token=${approveToken}`;
    const rejectUrl = `${appUrl}/api/tickets/email-action?token=${rejectToken}`;

    const subject = this.buildSubject(data);
    const htmlBody = this.buildApprovalHtml(data, approveUrl, rejectUrl);

    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: `"DAFC OTB System" <${mailFrom || 'test@ethereal.email'}>`,
        to: `"${data.approverName}" <${data.approverEmail}>`,
        subject,
        html: htmlBody,
      });
      this.logger.log(`Approval email sent to ${data.approverEmail} for ticket #${data.ticketId}`);

      // Log Ethereal preview URL (only works with test accounts)
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        this.logger.log(`📧 Preview email: ${previewUrl}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to send approval email for ticket #${data.ticketId}: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DYNAMIC TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  private buildSubject(data: ApprovalEmailData): string {
    return `[DAFC OTB] Approval Required — ${data.brandName} | ${data.seasonGroup} ${data.season} | FY${data.fiscalYear}`;
  }

  private formatCurrency(v: number): string {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(0);
  }

  private buildApprovalHtml(data: ApprovalEmailData, approveUrl: string, rejectUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F0EB;">
  <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:600px;margin:24px auto;background:#FAFAF8;border:1px solid #E8E0D6;border-radius:12px;overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6B4D30,#8B6914);padding:24px 28px;">
      <h1 style="margin:0;color:#FFFFFF;font-size:18px;font-weight:700;">DAFC OTB — Approval Required</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">A new ticket has been submitted for your review</p>
    </div>

    <!-- Body -->
    <div style="padding:24px 28px;">

      <!-- Greeting -->
      <p style="font-size:14px;color:#1A1A1A;margin:0 0 16px;">
        Hi <strong>${data.approverName}</strong>,
      </p>
      <p style="font-size:13px;color:#666;margin:0 0 20px;line-height:1.5;">
        <strong>${data.creatorName}</strong> has submitted a ticket for your approval as <strong>${data.levelName}</strong>.
      </p>

      <!-- Ticket Info -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:8px 0;color:#999;font-size:12px;width:140px;">Ticket ID</td>
          <td style="padding:8px 0;font-weight:600;color:#1A1A1A;">#${data.ticketId}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#999;font-size:12px;">Submitted by</td>
          <td style="padding:8px 0;font-weight:600;color:#1A1A1A;">${data.creatorName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#999;font-size:12px;">Brand</td>
          <td style="padding:8px 0;font-weight:600;color:#6B4D30;">${data.brandName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#999;font-size:12px;">Budget</td>
          <td style="padding:8px 0;font-weight:600;color:#1A1A1A;">${data.budgetName} — FY${data.fiscalYear}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#999;font-size:12px;">Season</td>
          <td style="padding:8px 0;font-weight:600;color:#1A1A1A;">${data.seasonGroup} — ${data.season}</td>
        </tr>
      </table>

      <!-- Summary Card -->
      <div style="background:#F5F0EB;border-radius:8px;padding:16px;margin-bottom:24px;">
        <div style="font-size:11px;color:#6B4D30;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Proposal Summary</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="text-align:center;padding:4px 8px;">
              <div style="font-size:11px;color:#999;">SKUs</div>
              <div style="font-size:20px;font-weight:700;color:#1A1A1A;">${data.totalSKUs}</div>
            </td>
            <td style="text-align:center;padding:4px 8px;">
              <div style="font-size:11px;color:#999;">Order Qty</div>
              <div style="font-size:20px;font-weight:700;color:#1A1A1A;">${data.totalOrder}</div>
            </td>
            <td style="text-align:center;padding:4px 8px;">
              <div style="font-size:11px;color:#999;">Total Value</div>
              <div style="font-size:20px;font-weight:700;color:#6B4D30;">${this.formatCurrency(data.totalValue)}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Action Buttons -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${approveUrl}" style="display:inline-block;background:#16A34A;color:#FFFFFF;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;margin-right:12px;">
          &#10003; Approve
        </a>
        <a href="${rejectUrl}" style="display:inline-block;background:#DC2626;color:#FFFFFF;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;">
          &#10007; Reject
        </a>
      </div>

      <p style="font-size:11px;color:#999;text-align:center;line-height:1.5;">
        Or log in to the DAFC OTB system to review details before deciding.<br/>
        These buttons expire in 72 hours.
      </p>

    </div>

    <!-- Footer -->
    <div style="background:#F5F0EB;padding:14px 28px;text-align:center;">
      <span style="font-size:11px;color:#999;">DAFC OTB System — DA Fashion Corporation</span>
    </div>
  </div>
</body>
</html>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULT PAGE — HTML response after clicking approve/reject
  // ═══════════════════════════════════════════════════════════════════════════

  buildResultHtml(success: boolean, action: string, ticketId: string, message?: string): string {
    const isApprove = action === 'approve';
    const color = success ? (isApprove ? '#16A34A' : '#DC2626') : '#999';
    const icon = success ? (isApprove ? '&#10003;' : '&#10007;') : '&#9888;';
    const title = success
      ? (isApprove ? 'Ticket Approved' : 'Ticket Rejected')
      : 'Action Failed';
    const desc = message || (success
      ? `Ticket #${ticketId} has been ${isApprove ? 'approved' : 'rejected'} successfully.`
      : 'Something went wrong processing your action.');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — DAFC OTB</title>
</head>
<body style="margin:0;padding:0;background:#F5F0EB;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:480px;margin:60px auto;background:#FAFAF8;border:1px solid #E8E0D6;border-radius:12px;overflow:hidden;text-align:center;">
    <div style="background:linear-gradient(135deg,#6B4D30,#8B6914);padding:20px;">
      <h1 style="margin:0;color:#FFF;font-size:16px;">DAFC OTB System</h1>
    </div>
    <div style="padding:40px 28px;">
      <div style="font-size:48px;color:${color};margin-bottom:16px;">${icon}</div>
      <h2 style="margin:0 0 8px;color:#1A1A1A;font-size:20px;">${title}</h2>
      <p style="color:#666;font-size:14px;line-height:1.5;margin:0 0 8px;">Ticket #${ticketId}</p>
      <p style="color:#999;font-size:13px;line-height:1.5;margin:0;">${desc}</p>
    </div>
    <div style="background:#F5F0EB;padding:14px;text-align:center;">
      <span style="font-size:11px;color:#999;">DAFC OTB — DA Fashion Corporation</span>
    </div>
  </div>
</body>
</html>`;
  }
}

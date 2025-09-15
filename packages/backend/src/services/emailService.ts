import nodemailer from 'nodemailer';
import { AppError } from '../utils/errors';

export interface EmailData {
  to: string;
  subject: string;
  body: string;
  type: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }>;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Send email
   */
  async sendEmail(data: EmailData): Promise<void> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@flowmarine.com',
        to: data.to,
        subject: data.subject,
        text: data.body,
        html: this.formatEmailBody(data.body, data.type),
        attachments: data.attachments
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new AppError('Failed to send email', 500, 'EMAIL_SEND_FAILED');
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(emails: EmailData[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        await this.sendEmail(email);
        sent++;
      } catch (error) {
        console.error(`Failed to send email to ${email.to}:`, error);
        failed++;
      }
    }

    return { sent, failed };
  }

  private formatEmailBody(body: string, type: string): string {
    // Convert plain text to HTML with basic formatting
    const htmlBody = body
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>FlowMarine</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background-color: #f3f4f6; padding: 10px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FlowMarine</h1>
          <p>Maritime Procurement Platform</p>
        </div>
        <div class="content">
          ${htmlBody}
        </div>
        <div class="footer">
          <p>This is an automated message from FlowMarine. Please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
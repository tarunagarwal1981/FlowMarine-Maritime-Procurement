import { PrismaClient } from '@prisma/client';
import { complianceReportingService } from './complianceReportingService';
import { websocketService } from './websocketService';
import { emailService } from './emailService';
import { logger } from '../utils/logger';
import { auditService } from './auditService';

const prisma = new PrismaClient();

export interface ComplianceNotificationConfig {
  certificateExpiryDays: number[];
  emailNotifications: boolean;
  websocketNotifications: boolean;
  smsNotifications: boolean;
  escalationRules: {
    critical: string[];
    high: string[];
    medium: string[];
  };
}

class ComplianceNotificationService {
  private config: ComplianceNotificationConfig = {
    certificateExpiryDays: [90, 60, 30, 14, 7, 1],
    emailNotifications: true,
    websocketNotifications: true,
    smsNotifications: false,
    escalationRules: {
      critical: ['ADMIN', 'SUPERINTENDENT'],
      high: ['SUPERINTENDENT', 'PROCUREMENT_MANAGER'],
      medium: ['PROCUREMENT_MANAGER', 'CAPTAIN']
    }
  };

  /**
   * Check for compliance issues and send notifications
   */
  async checkComplianceAndNotify(): Promise<void> {
    try {
      logger.info('Starting compliance check and notification process');

      // Get all vessels
      const vessels = await prisma.vessel.findMany({
        include: {
          certificates: true,
          assignments: {
            include: {
              user: true
            }
          }
        }
      });

      for (const vessel of vessels) {
        await this.checkVesselCompliance(vessel);
      }

      logger.info('Completed compliance check and notification process');
    } catch (error) {
      logger.error('Error in compliance check and notification process', { error });
      throw error;
    }
  }

  /**
   * Check compliance for a specific vessel
   */
  private async checkVesselCompliance(vessel: any): Promise<void> {
    try {
      // Get compliance alerts for this vessel
      const alerts = await complianceReportingService.getComplianceAlerts(vessel.id);

      // Process each alert
      for (const alert of alerts) {
        await this.processComplianceAlert(alert, vessel);
      }

      // Check for certificate expiry notifications
      await this.checkCertificateExpiryNotifications(vessel);

    } catch (error) {
      logger.error(`Error checking compliance for vessel ${vessel.id}`, { error, vesselId: vessel.id });
    }
  }

  /**
   * Process a compliance alert and send notifications
   */
  private async processComplianceAlert(alert: any, vessel: any): Promise<void> {
    try {
      // Check if we've already sent this alert recently
      const recentAlert = await this.checkRecentAlert(alert.id);
      if (recentAlert) {
        return;
      }

      // Determine recipients based on severity
      const recipients = await this.getAlertRecipients(alert.severity, vessel.id);

      // Send notifications
      if (this.config.websocketNotifications) {
        await this.sendWebSocketNotification(alert, recipients);
      }

      if (this.config.emailNotifications) {
        await this.sendEmailNotification(alert, recipients, vessel);
      }

      // Record the alert
      await this.recordAlert(alert, vessel.id);

      // Log audit trail
      await auditService.logAction({
        userId: 'SYSTEM',
        action: 'COMPLIANCE_ALERT_SENT',
        resource: `vessel/${vessel.id}`,
        details: {
          alertType: alert.type,
          severity: alert.severity,
          description: alert.description,
          recipients: recipients.map(r => r.id)
        }
      });

    } catch (error) {
      logger.error('Error processing compliance alert', { error, alert });
    }
  }

  /**
   * Check for certificate expiry notifications
   */
  private async checkCertificateExpiryNotifications(vessel: any): Promise<void> {
    try {
      const now = new Date();

      for (const certificate of vessel.certificates) {
        if (!certificate.expiryDate) continue;

        const daysUntilExpiry = Math.ceil(
          (certificate.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if we should send a notification for this certificate
        if (this.config.certificateExpiryDays.includes(daysUntilExpiry)) {
          await this.sendCertificateExpiryNotification(certificate, vessel, daysUntilExpiry);
        }
      }
    } catch (error) {
      logger.error('Error checking certificate expiry notifications', { error, vesselId: vessel.id });
    }
  }

  /**
   * Send certificate expiry notification
   */
  private async sendCertificateExpiryNotification(
    certificate: any, 
    vessel: any, 
    daysUntilExpiry: number
  ): Promise<void> {
    try {
      const severity = this.getCertificateExpirySeverity(daysUntilExpiry);
      const recipients = await this.getAlertRecipients(severity, vessel.id);

      const notification = {
        id: `CERT_EXPIRY_${certificate.id}_${daysUntilExpiry}`,
        type: 'CERTIFICATE_EXPIRY',
        severity,
        vesselId: vessel.id,
        description: `${certificate.certificateType} certificate for vessel ${vessel.name} expires in ${daysUntilExpiry} day(s)`,
        dueDate: certificate.expiryDate,
        resolved: false,
        createdAt: new Date(),
        certificateId: certificate.id,
        certificateType: certificate.certificateType
      };

      // Send notifications
      if (this.config.websocketNotifications) {
        await this.sendWebSocketNotification(notification, recipients);
      }

      if (this.config.emailNotifications) {
        await this.sendCertificateExpiryEmail(notification, recipients, vessel, certificate);
      }

      // Record the notification
      await this.recordAlert(notification, vessel.id);

    } catch (error) {
      logger.error('Error sending certificate expiry notification', { error, certificate });
    }
  }

  /**
   * Get alert recipients based on severity and vessel
   */
  private async getAlertRecipients(severity: string, vesselId: string): Promise<any[]> {
    try {
      const roleHierarchy = this.config.escalationRules[severity.toLowerCase() as keyof typeof this.config.escalationRules] || [];

      const recipients = await prisma.user.findMany({
        where: {
          AND: [
            {
              role: {
                in: roleHierarchy
              }
            },
            {
              OR: [
                {
                  vessels: {
                    some: {
                      vesselId: vesselId
                    }
                  }
                },
                {
                  role: {
                    in: ['ADMIN', 'SUPERINTENDENT']
                  }
                }
              ]
            },
            {
              isActive: true
            }
          ]
        }
      });

      return recipients;
    } catch (error) {
      logger.error('Error getting alert recipients', { error, severity, vesselId });
      return [];
    }
  }

  /**
   * Send WebSocket notification
   */
  private async sendWebSocketNotification(alert: any, recipients: any[]): Promise<void> {
    try {
      const notification = {
        id: alert.id,
        type: 'COMPLIANCE_ALERT',
        title: `${alert.type} Alert`,
        message: alert.description,
        severity: alert.severity,
        vesselId: alert.vesselId,
        timestamp: new Date(),
        data: alert
      };

      for (const recipient of recipients) {
        websocketService.sendToUser(recipient.id, 'compliance_alert', notification);
      }
    } catch (error) {
      logger.error('Error sending WebSocket notification', { error, alert });
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: any, recipients: any[], vessel: any): Promise<void> {
    try {
      const subject = `${alert.severity} Compliance Alert - ${vessel.name}`;
      const htmlContent = this.generateAlertEmailHTML(alert, vessel);

      for (const recipient of recipients) {
        await emailService.sendEmail({
          to: recipient.email,
          subject,
          html: htmlContent,
          priority: alert.severity === 'CRITICAL' ? 'high' : 'normal'
        });
      }
    } catch (error) {
      logger.error('Error sending email notification', { error, alert });
    }
  }

  /**
   * Send certificate expiry email
   */
  private async sendCertificateExpiryEmail(
    notification: any, 
    recipients: any[], 
    vessel: any, 
    certificate: any
  ): Promise<void> {
    try {
      const daysUntilExpiry = Math.ceil(
        (certificate.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      const subject = `Certificate Expiry Alert - ${vessel.name} - ${certificate.certificateType}`;
      const htmlContent = this.generateCertificateExpiryEmailHTML(vessel, certificate, daysUntilExpiry);

      for (const recipient of recipients) {
        await emailService.sendEmail({
          to: recipient.email,
          subject,
          html: htmlContent,
          priority: notification.severity === 'CRITICAL' ? 'high' : 'normal'
        });
      }
    } catch (error) {
      logger.error('Error sending certificate expiry email', { error, notification });
    }
  }

  /**
   * Check if we've sent this alert recently (within 24 hours)
   */
  private async checkRecentAlert(alertId: string): Promise<boolean> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const recentAlert = await prisma.complianceAlert.findFirst({
        where: {
          alertId,
          createdAt: {
            gte: twentyFourHoursAgo
          }
        }
      });

      return !!recentAlert;
    } catch (error) {
      logger.error('Error checking recent alert', { error, alertId });
      return false;
    }
  }

  /**
   * Record alert in database
   */
  private async recordAlert(alert: any, vesselId: string): Promise<void> {
    try {
      await prisma.complianceAlert.create({
        data: {
          alertId: alert.id,
          type: alert.type,
          severity: alert.severity,
          vesselId,
          description: alert.description,
          dueDate: alert.dueDate,
          resolved: false,
          alertData: alert
        }
      });
    } catch (error) {
      logger.error('Error recording alert', { error, alert });
    }
  }

  /**
   * Get certificate expiry severity based on days until expiry
   */
  private getCertificateExpirySeverity(daysUntilExpiry: number): string {
    if (daysUntilExpiry <= 0) return 'CRITICAL';
    if (daysUntilExpiry <= 7) return 'HIGH';
    if (daysUntilExpiry <= 30) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate alert email HTML
   */
  private generateAlertEmailHTML(alert: any, vessel: any): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: ${this.getSeverityColor(alert.severity)}; margin: 0;">
                ${alert.severity} Compliance Alert
              </h2>
            </div>
            
            <div style="background: white; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
              <h3>Alert Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Vessel:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">${vessel.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Alert Type:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">${alert.type}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Severity:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">
                    <span style="color: ${this.getSeverityColor(alert.severity)}; font-weight: bold;">
                      ${alert.severity}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Description:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">${alert.description}</td>
                </tr>
                ${alert.dueDate ? `
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Due Date:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">${alert.dueDate}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #e9ecef; border-radius: 8px;">
              <p style="margin: 0; font-size: 14px; color: #6c757d;">
                This is an automated compliance alert from FlowMarine. Please take appropriate action as required.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate certificate expiry email HTML
   */
  private generateCertificateExpiryEmailHTML(vessel: any, certificate: any, daysUntilExpiry: number): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
              <h2 style="color: #856404; margin: 0;">
                Certificate Expiry Notice
              </h2>
            </div>
            
            <div style="background: white; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
              <h3>Certificate Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Vessel:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">${vessel.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Certificate Type:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">${certificate.certificateType}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Expiry Date:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">${certificate.expiryDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Days Until Expiry:</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #eee;">
                    <span style="color: ${daysUntilExpiry <= 7 ? '#dc3545' : '#ffc107'}; font-weight: bold;">
                      ${daysUntilExpiry} day(s)
                    </span>
                  </td>
                </tr>
              </table>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #d1ecf1; border-radius: 8px; border-left: 4px solid #17a2b8;">
              <h4 style="margin-top: 0; color: #0c5460;">Action Required</h4>
              <p style="margin-bottom: 0;">
                Please ensure this certificate is renewed before the expiry date to maintain compliance with maritime regulations.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get color for severity level
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return '#dc3545';
      case 'HIGH': return '#fd7e14';
      case 'MEDIUM': return '#ffc107';
      case 'LOW': return '#28a745';
      default: return '#6c757d';
    }
  }

  /**
   * Schedule compliance checks (to be called by cron job)
   */
  async scheduleComplianceCheck(): Promise<void> {
    try {
      // Run compliance check every 6 hours
      setInterval(async () => {
        await this.checkComplianceAndNotify();
      }, 6 * 60 * 60 * 1000);

      logger.info('Compliance check scheduler started');
    } catch (error) {
      logger.error('Error starting compliance check scheduler', { error });
    }
  }
}

export const complianceNotificationService = new ComplianceNotificationService();
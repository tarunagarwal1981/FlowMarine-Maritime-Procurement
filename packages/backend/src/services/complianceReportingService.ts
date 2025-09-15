import { PrismaClient } from '@prisma/client';
import { auditService } from './auditService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface ComplianceReport {
  id: string;
  type: 'SOLAS' | 'MARPOL' | 'ISM';
  vesselId?: string;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
  generatedBy: string;
  data: any;
  status: 'DRAFT' | 'FINAL' | 'SUBMITTED';
}

export interface ComplianceAlert {
  id: string;
  type: 'CERTIFICATE_EXPIRY' | 'SAFETY_VIOLATION' | 'ENVIRONMENTAL_BREACH' | 'DOCUMENTATION_MISSING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  vesselId?: string;
  description: string;
  dueDate?: Date;
  resolved: boolean;
  createdAt: Date;
}

export interface AuditTrailReport {
  transactionId: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  timestamp: Date;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
}

class ComplianceReportingService {
  /**
   * Generate SOLAS compliance report
   * Covers safety equipment procurement and maintenance
   */
  async generateSOLASReport(vesselId: string, startDate: Date, endDate: Date, userId: string): Promise<ComplianceReport> {
    try {
      logger.info(`Generating SOLAS report for vessel ${vesselId}`, { vesselId, startDate, endDate });

      // Get safety-critical items and equipment
      const safetyItems = await prisma.requisitionItem.findMany({
        where: {
          requisition: {
            vesselId,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          item: {
            criticalityLevel: 'SAFETY_CRITICAL',
            category: {
              in: ['SAFETY_EQUIPMENT', 'NAVIGATION_EQUIPMENT', 'COMMUNICATION_EQUIPMENT', 'FIRE_SAFETY']
            }
          }
        },
        include: {
          item: true,
          requisition: {
            include: {
              vessel: true,
              requestedBy: true
            }
          }
        }
      });

      // Get vessel certificates related to SOLAS
      const certificates = await prisma.vesselCertificate.findMany({
        where: {
          vesselId,
          certificateType: {
            in: ['SAFETY_CONSTRUCTION', 'SAFETY_EQUIPMENT', 'RADIO_SAFETY', 'CARGO_SHIP_SAFETY']
          }
        }
      });

      // Check for expired or expiring certificates
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const expiringCertificates = certificates.filter(cert => 
        cert.expiryDate && cert.expiryDate <= thirtyDaysFromNow
      );

      // Generate compliance data
      const complianceData = {
        vessel: safetyItems[0]?.requisition.vessel,
        reportPeriod: { startDate, endDate },
        safetyEquipmentProcurement: {
          totalItems: safetyItems.length,
          totalValue: safetyItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
          categories: this.groupItemsByCategory(safetyItems),
          criticalItems: safetyItems.filter(item => item.urgencyLevel === 'EMERGENCY')
        },
        certificates: {
          total: certificates.length,
          valid: certificates.filter(cert => cert.expiryDate && cert.expiryDate > now).length,
          expiring: expiringCertificates.length,
          expired: certificates.filter(cert => cert.expiryDate && cert.expiryDate <= now).length,
          details: certificates.map(cert => ({
            type: cert.certificateType,
            issueDate: cert.issueDate,
            expiryDate: cert.expiryDate,
            status: cert.expiryDate && cert.expiryDate <= now ? 'EXPIRED' : 
                   cert.expiryDate && cert.expiryDate <= thirtyDaysFromNow ? 'EXPIRING' : 'VALID'
          }))
        },
        complianceScore: this.calculateSOLASComplianceScore(safetyItems, certificates),
        recommendations: this.generateSOLASRecommendations(safetyItems, certificates)
      };

      const report: ComplianceReport = {
        id: `SOLAS-${vesselId}-${Date.now()}`,
        type: 'SOLAS',
        vesselId,
        reportPeriod: { startDate, endDate },
        generatedAt: new Date(),
        generatedBy: userId,
        data: complianceData,
        status: 'DRAFT'
      };

      // Log audit trail
      await auditService.logAction({
        userId,
        action: 'GENERATE_SOLAS_REPORT',
        resource: `vessel/${vesselId}`,
        details: { reportId: report.id, period: { startDate, endDate } }
      });

      return report;
    } catch (error) {
      logger.error('Error generating SOLAS report', { error, vesselId, startDate, endDate });
      throw error;
    }
  }

  /**
   * Generate MARPOL compliance report
   * Covers environmental compliance and pollution prevention
   */
  async generateMARPOLReport(vesselId: string, startDate: Date, endDate: Date, userId: string): Promise<ComplianceReport> {
    try {
      logger.info(`Generating MARPOL report for vessel ${vesselId}`, { vesselId, startDate, endDate });

      // Get environmental-related items
      const environmentalItems = await prisma.requisitionItem.findMany({
        where: {
          requisition: {
            vesselId,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          item: {
            category: {
              in: ['ENVIRONMENTAL_EQUIPMENT', 'WASTE_MANAGEMENT', 'FUEL_ADDITIVES', 'WATER_TREATMENT']
            }
          }
        },
        include: {
          item: true,
          requisition: {
            include: {
              vessel: true
            }
          }
        }
      });

      // Get environmental certificates
      const environmentalCertificates = await prisma.vesselCertificate.findMany({
        where: {
          vesselId,
          certificateType: {
            in: ['POLLUTION_PREVENTION', 'SEWAGE_TREATMENT', 'BALLAST_WATER', 'AIR_POLLUTION']
          }
        }
      });

      const complianceData = {
        vessel: environmentalItems[0]?.requisition.vessel,
        reportPeriod: { startDate, endDate },
        environmentalEquipment: {
          totalItems: environmentalItems.length,
          totalValue: environmentalItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
          categories: this.groupItemsByCategory(environmentalItems)
        },
        certificates: environmentalCertificates.map(cert => ({
          type: cert.certificateType,
          issueDate: cert.issueDate,
          expiryDate: cert.expiryDate,
          status: this.getCertificateStatus(cert.expiryDate)
        })),
        complianceScore: this.calculateMARPOLComplianceScore(environmentalItems, environmentalCertificates),
        recommendations: this.generateMARPOLRecommendations(environmentalItems, environmentalCertificates)
      };

      const report: ComplianceReport = {
        id: `MARPOL-${vesselId}-${Date.now()}`,
        type: 'MARPOL',
        vesselId,
        reportPeriod: { startDate, endDate },
        generatedAt: new Date(),
        generatedBy: userId,
        data: complianceData,
        status: 'DRAFT'
      };

      await auditService.logAction({
        userId,
        action: 'GENERATE_MARPOL_REPORT',
        resource: `vessel/${vesselId}`,
        details: { reportId: report.id, period: { startDate, endDate } }
      });

      return report;
    } catch (error) {
      logger.error('Error generating MARPOL report', { error, vesselId, startDate, endDate });
      throw error;
    }
  }

  /**
   * Generate ISM compliance report
   * Covers safety management system compliance
   */
  async generateISMReport(vesselId: string, startDate: Date, endDate: Date, userId: string): Promise<ComplianceReport> {
    try {
      logger.info(`Generating ISM report for vessel ${vesselId}`, { vesselId, startDate, endDate });

      // Get management system related items and activities
      const managementItems = await prisma.requisitionItem.findMany({
        where: {
          requisition: {
            vesselId,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          item: {
            category: {
              in: ['SAFETY_MANAGEMENT', 'TRAINING_MATERIALS', 'DOCUMENTATION', 'MAINTENANCE_TOOLS']
            }
          }
        },
        include: {
          item: true,
          requisition: {
            include: {
              vessel: true,
              approvals: {
                include: {
                  approvedBy: true
                }
              }
            }
          }
        }
      });

      // Get ISM certificates
      const ismCertificates = await prisma.vesselCertificate.findMany({
        where: {
          vesselId,
          certificateType: {
            in: ['ISM_CERTIFICATE', 'SAFETY_MANAGEMENT', 'DOC_CERTIFICATE']
          }
        }
      });

      // Analyze approval workflows for compliance
      const approvalAnalysis = this.analyzeApprovalCompliance(managementItems);

      const complianceData = {
        vessel: managementItems[0]?.requisition.vessel,
        reportPeriod: { startDate, endDate },
        managementSystemItems: {
          totalItems: managementItems.length,
          totalValue: managementItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
          categories: this.groupItemsByCategory(managementItems)
        },
        certificates: ismCertificates.map(cert => ({
          type: cert.certificateType,
          issueDate: cert.issueDate,
          expiryDate: cert.expiryDate,
          status: this.getCertificateStatus(cert.expiryDate)
        })),
        approvalCompliance: approvalAnalysis,
        complianceScore: this.calculateISMComplianceScore(managementItems, ismCertificates, approvalAnalysis),
        recommendations: this.generateISMRecommendations(managementItems, ismCertificates, approvalAnalysis)
      };

      const report: ComplianceReport = {
        id: `ISM-${vesselId}-${Date.now()}`,
        type: 'ISM',
        vesselId,
        reportPeriod: { startDate, endDate },
        generatedAt: new Date(),
        generatedBy: userId,
        data: complianceData,
        status: 'DRAFT'
      };

      await auditService.logAction({
        userId,
        action: 'GENERATE_ISM_REPORT',
        resource: `vessel/${vesselId}`,
        details: { reportId: report.id, period: { startDate, endDate } }
      });

      return report;
    } catch (error) {
      logger.error('Error generating ISM report', { error, vesselId, startDate, endDate });
      throw error;
    }
  }

  /**
   * Generate comprehensive audit trail report
   */
  async generateAuditTrailReport(
    startDate: Date, 
    endDate: Date, 
    userId: string,
    filters?: {
      vesselId?: string;
      actionType?: string;
      userId?: string;
    }
  ): Promise<AuditTrailReport[]> {
    try {
      logger.info('Generating audit trail report', { startDate, endDate, filters });

      const whereClause: any = {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      };

      if (filters?.vesselId) {
        whereClause.resource = {
          contains: `vessel/${filters.vesselId}`
        };
      }

      if (filters?.actionType) {
        whereClause.action = filters.actionType;
      }

      if (filters?.userId) {
        whereClause.userId = filters.userId;
      }

      const auditLogs = await prisma.auditLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });

      const auditTrailReport: AuditTrailReport[] = auditLogs.map(log => ({
        transactionId: log.id,
        userId: log.userId,
        userName: `${log.user.firstName} ${log.user.lastName}`,
        action: log.action,
        resource: log.resource,
        timestamp: log.timestamp,
        changes: log.details,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent
      }));

      // Log the audit report generation
      await auditService.logAction({
        userId,
        action: 'GENERATE_AUDIT_TRAIL_REPORT',
        resource: 'system/audit',
        details: { 
          period: { startDate, endDate }, 
          filters,
          recordCount: auditTrailReport.length 
        }
      });

      return auditTrailReport;
    } catch (error) {
      logger.error('Error generating audit trail report', { error, startDate, endDate, filters });
      throw error;
    }
  }

  /**
   * Get compliance alerts for vessels
   */
  async getComplianceAlerts(vesselId?: string): Promise<ComplianceAlert[]> {
    try {
      const alerts: ComplianceAlert[] = [];
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      // Certificate expiry alerts
      const whereClause: any = {};
      if (vesselId) {
        whereClause.vesselId = vesselId;
      }

      const certificates = await prisma.vesselCertificate.findMany({
        where: whereClause,
        include: {
          vessel: true
        }
      });

      certificates.forEach(cert => {
        if (cert.expiryDate) {
          if (cert.expiryDate <= now) {
            alerts.push({
              id: `CERT_EXPIRED_${cert.id}`,
              type: 'CERTIFICATE_EXPIRY',
              severity: 'CRITICAL',
              vesselId: cert.vesselId,
              description: `${cert.certificateType} certificate has expired for vessel ${cert.vessel.name}`,
              dueDate: cert.expiryDate,
              resolved: false,
              createdAt: now
            });
          } else if (cert.expiryDate <= thirtyDaysFromNow) {
            alerts.push({
              id: `CERT_EXPIRING_${cert.id}`,
              type: 'CERTIFICATE_EXPIRY',
              severity: 'HIGH',
              vesselId: cert.vesselId,
              description: `${cert.certificateType} certificate expires within 30 days for vessel ${cert.vessel.name}`,
              dueDate: cert.expiryDate,
              resolved: false,
              createdAt: now
            });
          } else if (cert.expiryDate <= ninetyDaysFromNow) {
            alerts.push({
              id: `CERT_EXPIRING_90_${cert.id}`,
              type: 'CERTIFICATE_EXPIRY',
              severity: 'MEDIUM',
              vesselId: cert.vesselId,
              description: `${cert.certificateType} certificate expires within 90 days for vessel ${cert.vessel.name}`,
              dueDate: cert.expiryDate,
              resolved: false,
              createdAt: now
            });
          }
        }
      });

      return alerts.sort((a, b) => {
        const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error) {
      logger.error('Error getting compliance alerts', { error, vesselId });
      throw error;
    }
  }

  // Helper methods
  private groupItemsByCategory(items: any[]): Record<string, any> {
    return items.reduce((acc, item) => {
      const category = item.item.category;
      if (!acc[category]) {
        acc[category] = {
          count: 0,
          totalValue: 0,
          items: []
        };
      }
      acc[category].count++;
      acc[category].totalValue += item.totalPrice || 0;
      acc[category].items.push({
        name: item.item.name,
        quantity: item.quantity,
        price: item.totalPrice,
        urgency: item.urgencyLevel
      });
      return acc;
    }, {});
  }

  private getCertificateStatus(expiryDate: Date | null): string {
    if (!expiryDate) return 'NO_EXPIRY';
    
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    if (expiryDate <= now) return 'EXPIRED';
    if (expiryDate <= thirtyDaysFromNow) return 'EXPIRING';
    return 'VALID';
  }

  private calculateSOLASComplianceScore(items: any[], certificates: any[]): number {
    let score = 100;
    
    // Deduct points for expired certificates
    const expiredCerts = certificates.filter(cert => 
      cert.expiryDate && cert.expiryDate <= new Date()
    );
    score -= expiredCerts.length * 20;
    
    // Deduct points for missing safety equipment
    const safetyCriticalItems = items.filter(item => 
      item.item.criticalityLevel === 'SAFETY_CRITICAL'
    );
    if (safetyCriticalItems.length === 0) score -= 30;
    
    return Math.max(0, score);
  }

  private calculateMARPOLComplianceScore(items: any[], certificates: any[]): number {
    let score = 100;
    
    const expiredCerts = certificates.filter(cert => 
      cert.expiryDate && cert.expiryDate <= new Date()
    );
    score -= expiredCerts.length * 25;
    
    return Math.max(0, score);
  }

  private calculateISMComplianceScore(items: any[], certificates: any[], approvalAnalysis: any): number {
    let score = 100;
    
    const expiredCerts = certificates.filter(cert => 
      cert.expiryDate && cert.expiryDate <= new Date()
    );
    score -= expiredCerts.length * 20;
    
    // Factor in approval compliance
    if (approvalAnalysis.nonCompliantApprovals > 0) {
      score -= approvalAnalysis.nonCompliantApprovals * 5;
    }
    
    return Math.max(0, score);
  }

  private generateSOLASRecommendations(items: any[], certificates: any[]): string[] {
    const recommendations: string[] = [];
    
    const expiredCerts = certificates.filter(cert => 
      cert.expiryDate && cert.expiryDate <= new Date()
    );
    
    if (expiredCerts.length > 0) {
      recommendations.push(`Renew ${expiredCerts.length} expired safety certificate(s) immediately`);
    }
    
    const expiringCerts = certificates.filter(cert => {
      if (!cert.expiryDate) return false;
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      return cert.expiryDate <= thirtyDaysFromNow && cert.expiryDate > new Date();
    });
    
    if (expiringCerts.length > 0) {
      recommendations.push(`Schedule renewal for ${expiringCerts.length} certificate(s) expiring within 30 days`);
    }
    
    return recommendations;
  }

  private generateMARPOLRecommendations(items: any[], certificates: any[]): string[] {
    const recommendations: string[] = [];
    
    const expiredCerts = certificates.filter(cert => 
      cert.expiryDate && cert.expiryDate <= new Date()
    );
    
    if (expiredCerts.length > 0) {
      recommendations.push(`Renew ${expiredCerts.length} expired environmental certificate(s)`);
    }
    
    return recommendations;
  }

  private generateISMRecommendations(items: any[], certificates: any[], approvalAnalysis: any): string[] {
    const recommendations: string[] = [];
    
    if (approvalAnalysis.nonCompliantApprovals > 0) {
      recommendations.push('Review and improve approval workflow compliance');
    }
    
    const expiredCerts = certificates.filter(cert => 
      cert.expiryDate && cert.expiryDate <= new Date()
    );
    
    if (expiredCerts.length > 0) {
      recommendations.push(`Renew ${expiredCerts.length} expired ISM certificate(s)`);
    }
    
    return recommendations;
  }

  private analyzeApprovalCompliance(items: any[]): any {
    const totalApprovals = items.reduce((sum, item) => sum + (item.requisition.approvals?.length || 0), 0);
    const properlyApproved = items.filter(item => {
      const approvals = item.requisition.approvals || [];
      return approvals.length > 0 && approvals.every((approval: any) => approval.status === 'APPROVED');
    }).length;
    
    return {
      totalRequisitions: items.length,
      properlyApproved,
      nonCompliantApprovals: items.length - properlyApproved,
      complianceRate: items.length > 0 ? (properlyApproved / items.length) * 100 : 100
    };
  }
}

export const complianceReportingService = new ComplianceReportingService();
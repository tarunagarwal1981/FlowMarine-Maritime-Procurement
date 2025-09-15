import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { AuditService } from './auditService';
import { transactionHistoryService } from './transactionHistoryService';
import { documentVersionService } from './documentVersionService';

const prisma = new PrismaClient();

export interface ComplianceReport {
  id: string;
  reportType: 'SOLAS' | 'MARPOL' | 'ISM' | 'GDPR' | 'SOX' | 'FINANCIAL_AUDIT' | 'SECURITY_AUDIT';
  title: string;
  description: string;
  vesselId?: string;
  reportPeriodStart: Date;
  reportPeriodEnd: Date;
  generatedBy: string;
  generatedAt: Date;
  status: 'DRAFT' | 'COMPLETED' | 'REVIEWED' | 'APPROVED' | 'SUBMITTED';
  findings: ComplianceFinding[];
  recommendations: ComplianceRecommendation[];
  evidence: ComplianceEvidence[];
  metadata: Record<string, any>;
}

export interface ComplianceFinding {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  title: string;
  description: string;
  regulation: string;
  requirement: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'NOT_APPLICABLE';
  evidence: string[];
  remediation?: string;
  dueDate?: Date;
  assignedTo?: string;
}

export interface ComplianceRecommendation {
  id: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  title: string;
  description: string;
  category: string;
  estimatedEffort: string;
  estimatedCost?: number;
  currency?: string;
  targetDate?: Date;
  assignedTo?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED';
}

export interface ComplianceEvidence {
  id: string;
  type: 'DOCUMENT' | 'TRANSACTION' | 'AUDIT_LOG' | 'CERTIFICATE' | 'PHOTO' | 'VIDEO' | 'OTHER';
  title: string;
  description: string;
  sourceId: string;
  sourceType: string;
  url?: string;
  checksum?: string;
  collectedAt: Date;
  collectedBy: string;
  metadata: Record<string, any>;
}

export class AutomatedComplianceReportingService {
  /**
   * Generate SOLAS compliance report
   */
  static async generateSOLASReport(vesselId: string, reportPeriod: { start: Date; end: Date }, generatedBy: string): Promise<ComplianceReport> {
    try {
      logger.info('Generating SOLAS compliance report', { vesselId, reportPeriod });

      const vessel = await prisma.vessel.findUnique({
        where: { id: vesselId },
        include: {
          certificates: true,
          specifications: true,
        },
      });

      if (!vessel) {
        throw new Error(`Vessel not found: ${vesselId}`);
      }

      const findings: ComplianceFinding[] = [];
      const recommendations: ComplianceRecommendation[] = [];
      const evidence: ComplianceEvidence[] = [];

      // Check certificate compliance
      const certificateFindings = await this.checkCertificateCompliance(vessel, 'SOLAS');
      findings.push(...certificateFindings.findings);
      evidence.push(...certificateFindings.evidence);

      // Check safety equipment compliance
      const safetyFindings = await this.checkSafetyEquipmentCompliance(vesselId, reportPeriod);
      findings.push(...safetyFindings.findings);
      evidence.push(...safetyFindings.evidence);

      // Check emergency procedures compliance
      const emergencyFindings = await this.checkEmergencyProceduresCompliance(vesselId, reportPeriod);
      findings.push(...emergencyFindings.findings);
      evidence.push(...emergencyFindings.evidence);

      // Generate recommendations based on findings
      const generatedRecommendations = this.generateRecommendations(findings, 'SOLAS');
      recommendations.push(...generatedRecommendations);

      const report: ComplianceReport = {
        id: `solas-${vesselId}-${Date.now()}`,
        reportType: 'SOLAS',
        title: `SOLAS Compliance Report - ${vessel.name}`,
        description: `Comprehensive SOLAS compliance assessment for vessel ${vessel.name} (IMO: ${vessel.imoNumber})`,
        vesselId,
        reportPeriodStart: reportPeriod.start,
        reportPeriodEnd: reportPeriod.end,
        generatedBy,
        generatedAt: new Date(),
        status: 'COMPLETED',
        findings,
        recommendations,
        evidence,
        metadata: {
          vesselType: vessel.vesselType,
          flag: vessel.flag,
          totalFindings: findings.length,
          criticalFindings: findings.filter(f => f.severity === 'CRITICAL').length,
          nonCompliantItems: findings.filter(f => f.status === 'NON_COMPLIANT').length,
        },
      };

      // Store report
      await this.storeComplianceReport(report);

      // Log compliance event
      await AuditService.logComplianceEvent({
        userId: generatedBy,
        regulation: 'SOLAS',
        complianceType: 'SOLAS',
        action: 'COMPLIANCE_REPORT_GENERATED',
        vesselId,
        details: {
          reportId: report.id,
          totalFindings: findings.length,
          criticalFindings: findings.filter(f => f.severity === 'CRITICAL').length,
          reportPeriod,
        },
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate SOLAS report', {
        error: error.message,
        vesselId,
      });
      throw error;
    }
  }

  /**
   * Generate ISM compliance report
   */
  static async generateISMReport(vesselId: string, reportPeriod: { start: Date; end: Date }, generatedBy: string): Promise<ComplianceReport> {
    try {
      logger.info('Generating ISM compliance report', { vesselId, reportPeriod });

      const vessel = await prisma.vessel.findUnique({
        where: { id: vesselId },
        include: {
          certificates: true,
        },
      });

      if (!vessel) {
        throw new Error(`Vessel not found: ${vesselId}`);
      }

      const findings: ComplianceFinding[] = [];
      const recommendations: ComplianceRecommendation[] = [];
      const evidence: ComplianceEvidence[] = [];

      // Check ISM certificate validity
      const ismCertificate = vessel.certificates.find(cert => 
        cert.certificateType.includes('ISM') || cert.certificateType.includes('Safety Management')
      );

      if (!ismCertificate) {
        findings.push({
          id: `ism-cert-missing-${Date.now()}`,
          severity: 'CRITICAL',
          category: 'Certification',
          title: 'ISM Certificate Missing',
          description: 'No valid ISM (International Safety Management) certificate found for vessel',
          regulation: 'ISM Code',
          requirement: 'Valid ISM certificate required for commercial vessels',
          status: 'NON_COMPLIANT',
          evidence: [],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
      } else if (ismCertificate.expiryDate < new Date()) {
        findings.push({
          id: `ism-cert-expired-${Date.now()}`,
          severity: 'CRITICAL',
          category: 'Certification',
          title: 'ISM Certificate Expired',
          description: `ISM certificate expired on ${ismCertificate.expiryDate.toISOString().split('T')[0]}`,
          regulation: 'ISM Code',
          requirement: 'Valid ISM certificate required for commercial vessels',
          status: 'NON_COMPLIANT',
          evidence: [`certificate:${ismCertificate.id}`],
          dueDate: new Date(),
        });
      } else {
        findings.push({
          id: `ism-cert-valid-${Date.now()}`,
          severity: 'LOW',
          category: 'Certification',
          title: 'ISM Certificate Valid',
          description: `ISM certificate valid until ${ismCertificate.expiryDate.toISOString().split('T')[0]}`,
          regulation: 'ISM Code',
          requirement: 'Valid ISM certificate required for commercial vessels',
          status: 'COMPLIANT',
          evidence: [`certificate:${ismCertificate.id}`],
        });
      }

      // Check management system compliance
      const managementFindings = await this.checkManagementSystemCompliance(vesselId, reportPeriod);
      findings.push(...managementFindings.findings);
      evidence.push(...managementFindings.evidence);

      // Check crew training compliance
      const trainingFindings = await this.checkCrewTrainingCompliance(vesselId, reportPeriod);
      findings.push(...trainingFindings.findings);
      evidence.push(...trainingFindings.evidence);

      // Generate recommendations
      const generatedRecommendations = this.generateRecommendations(findings, 'ISM');
      recommendations.push(...generatedRecommendations);

      const report: ComplianceReport = {
        id: `ism-${vesselId}-${Date.now()}`,
        reportType: 'ISM',
        title: `ISM Compliance Report - ${vessel.name}`,
        description: `International Safety Management (ISM) Code compliance assessment for vessel ${vessel.name}`,
        vesselId,
        reportPeriodStart: reportPeriod.start,
        reportPeriodEnd: reportPeriod.end,
        generatedBy,
        generatedAt: new Date(),
        status: 'COMPLETED',
        findings,
        recommendations,
        evidence,
        metadata: {
          vesselType: vessel.vesselType,
          flag: vessel.flag,
          ismCertificateStatus: ismCertificate ? 'PRESENT' : 'MISSING',
          ismExpiryDate: ismCertificate?.expiryDate,
        },
      };

      await this.storeComplianceReport(report);

      await AuditService.logComplianceEvent({
        userId: generatedBy,
        regulation: 'ISM Code',
        complianceType: 'ISM',
        action: 'COMPLIANCE_REPORT_GENERATED',
        vesselId,
        details: {
          reportId: report.id,
          totalFindings: findings.length,
          criticalFindings: findings.filter(f => f.severity === 'CRITICAL').length,
        },
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate ISM report', {
        error: error.message,
        vesselId,
      });
      throw error;
    }
  }

  /**
   * Generate financial audit report
   */
  static async generateFinancialAuditReport(
    vesselId: string | null,
    reportPeriod: { start: Date; end: Date },
    generatedBy: string
  ): Promise<ComplianceReport> {
    try {
      logger.info('Generating financial audit report', { vesselId, reportPeriod });

      const findings: ComplianceFinding[] = [];
      const recommendations: ComplianceRecommendation[] = [];
      const evidence: ComplianceEvidence[] = [];

      // Get transaction history for the period
      const transactionReport = await transactionHistoryService.generateTransactionReport({
        startDate: reportPeriod.start,
        endDate: reportPeriod.end,
        vesselId: vesselId || undefined,
        includeCompliance: true,
      });

      // Check for financial irregularities
      const financialFindings = await this.checkFinancialCompliance(transactionReport);
      findings.push(...financialFindings.findings);
      evidence.push(...financialFindings.evidence);

      // Check procurement compliance
      const procurementFindings = await this.checkProcurementCompliance(transactionReport);
      findings.push(...procurementFindings.findings);
      evidence.push(...procurementFindings.evidence);

      // Check approval workflow compliance
      const approvalFindings = await this.checkApprovalWorkflowCompliance(transactionReport);
      findings.push(...approvalFindings.findings);
      evidence.push(...approvalFindings.evidence);

      // Generate recommendations
      const generatedRecommendations = this.generateRecommendations(findings, 'FINANCIAL_AUDIT');
      recommendations.push(...generatedRecommendations);

      const vesselName = vesselId ? (await prisma.vessel.findUnique({ where: { id: vesselId } }))?.name : 'All Vessels';

      const report: ComplianceReport = {
        id: `financial-audit-${vesselId || 'all'}-${Date.now()}`,
        reportType: 'FINANCIAL_AUDIT',
        title: `Financial Audit Report - ${vesselName}`,
        description: `Comprehensive financial compliance audit for ${vesselName}`,
        vesselId,
        reportPeriodStart: reportPeriod.start,
        reportPeriodEnd: reportPeriod.end,
        generatedBy,
        generatedAt: new Date(),
        status: 'COMPLETED',
        findings,
        recommendations,
        evidence,
        metadata: {
          totalTransactions: transactionReport.summary.totalTransactions,
          criticalActions: transactionReport.summary.criticalActions,
          complianceEvents: transactionReport.summary.complianceEvents,
          transactionsByType: transactionReport.summary.transactionsByType,
        },
      };

      await this.storeComplianceReport(report);

      await AuditService.logComplianceEvent({
        userId: generatedBy,
        regulation: 'Financial Controls',
        complianceType: 'SOX',
        action: 'FINANCIAL_AUDIT_REPORT_GENERATED',
        vesselId,
        details: {
          reportId: report.id,
          totalTransactions: transactionReport.summary.totalTransactions,
          totalFindings: findings.length,
        },
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate financial audit report', {
        error: error.message,
        vesselId,
      });
      throw error;
    }
  }

  /**
   * Check certificate compliance
   */
  private static async checkCertificateCompliance(vessel: any, regulationType: string): Promise<{
    findings: ComplianceFinding[];
    evidence: ComplianceEvidence[];
  }> {
    const findings: ComplianceFinding[] = [];
    const evidence: ComplianceEvidence[] = [];

    const requiredCertificates = this.getRequiredCertificates(regulationType, vessel.vesselType);

    for (const requiredCert of requiredCertificates) {
      const certificate = vessel.certificates.find((cert: any) => 
        cert.certificateType.toLowerCase().includes(requiredCert.type.toLowerCase())
      );

      if (!certificate) {
        findings.push({
          id: `cert-missing-${requiredCert.type}-${Date.now()}`,
          severity: requiredCert.critical ? 'CRITICAL' : 'HIGH',
          category: 'Certification',
          title: `${requiredCert.name} Missing`,
          description: `Required certificate ${requiredCert.name} not found`,
          regulation: regulationType,
          requirement: requiredCert.requirement,
          status: 'NON_COMPLIANT',
          evidence: [],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      } else {
        const daysUntilExpiry = Math.ceil((certificate.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
          findings.push({
            id: `cert-expired-${certificate.id}`,
            severity: 'CRITICAL',
            category: 'Certification',
            title: `${requiredCert.name} Expired`,
            description: `Certificate expired ${Math.abs(daysUntilExpiry)} days ago`,
            regulation: regulationType,
            requirement: requiredCert.requirement,
            status: 'NON_COMPLIANT',
            evidence: [`certificate:${certificate.id}`],
            dueDate: new Date(),
          });
        } else if (daysUntilExpiry < 90) {
          findings.push({
            id: `cert-expiring-${certificate.id}`,
            severity: daysUntilExpiry < 30 ? 'HIGH' : 'MEDIUM',
            category: 'Certification',
            title: `${requiredCert.name} Expiring Soon`,
            description: `Certificate expires in ${daysUntilExpiry} days`,
            regulation: regulationType,
            requirement: requiredCert.requirement,
            status: 'PARTIALLY_COMPLIANT',
            evidence: [`certificate:${certificate.id}`],
            dueDate: certificate.expiryDate,
            remediation: 'Renew certificate before expiry',
          });
        } else {
          findings.push({
            id: `cert-valid-${certificate.id}`,
            severity: 'LOW',
            category: 'Certification',
            title: `${requiredCert.name} Valid`,
            description: `Certificate valid until ${certificate.expiryDate.toISOString().split('T')[0]}`,
            regulation: regulationType,
            requirement: requiredCert.requirement,
            status: 'COMPLIANT',
            evidence: [`certificate:${certificate.id}`],
          });
        }

        evidence.push({
          id: `cert-evidence-${certificate.id}`,
          type: 'CERTIFICATE',
          title: certificate.certificateType,
          description: `Certificate ${certificate.certificateNumber} issued by ${certificate.issuedBy}`,
          sourceId: certificate.id,
          sourceType: 'vessel_certificate',
          url: certificate.documentUrl,
          collectedAt: new Date(),
          collectedBy: 'system',
          metadata: {
            certificateNumber: certificate.certificateNumber,
            issueDate: certificate.issueDate,
            expiryDate: certificate.expiryDate,
            issuedBy: certificate.issuedBy,
          },
        });
      }
    }

    return { findings, evidence };
  }

  /**
   * Get required certificates for regulation type
   */
  private static getRequiredCertificates(regulationType: string, vesselType: string): Array<{
    type: string;
    name: string;
    requirement: string;
    critical: boolean;
  }> {
    const certificates = [];

    if (regulationType === 'SOLAS') {
      certificates.push(
        {
          type: 'safety_construction',
          name: 'Safety Construction Certificate',
          requirement: 'SOLAS Chapter I, Regulation 12',
          critical: true,
        },
        {
          type: 'safety_equipment',
          name: 'Safety Equipment Certificate',
          requirement: 'SOLAS Chapter I, Regulation 12',
          critical: true,
        },
        {
          type: 'radio_safety',
          name: 'Radio Safety Certificate',
          requirement: 'SOLAS Chapter IV',
          critical: true,
        }
      );
    }

    if (regulationType === 'ISM') {
      certificates.push({
        type: 'safety_management',
        name: 'Safety Management Certificate',
        requirement: 'ISM Code, Section 13',
        critical: true,
      });
    }

    return certificates;
  }

  /**
   * Check safety equipment compliance
   */
  private static async checkSafetyEquipmentCompliance(vesselId: string, reportPeriod: { start: Date; end: Date }): Promise<{
    findings: ComplianceFinding[];
    evidence: ComplianceEvidence[];
  }> {
    const findings: ComplianceFinding[] = [];
    const evidence: ComplianceEvidence[] = [];

    // Check for safety equipment requisitions
    const safetyRequisitions = await prisma.requisition.findMany({
      where: {
        vesselId,
        createdAt: {
          gte: reportPeriod.start,
          lte: reportPeriod.end,
        },
        items: {
          some: {
            itemCatalog: {
              category: 'SAFETY_GEAR',
            },
          },
        },
      },
      include: {
        items: {
          include: {
            itemCatalog: true,
          },
        },
      },
    });

    if (safetyRequisitions.length === 0) {
      findings.push({
        id: `safety-equipment-no-activity-${Date.now()}`,
        severity: 'MEDIUM',
        category: 'Safety Equipment',
        title: 'No Safety Equipment Activity',
        description: 'No safety equipment requisitions found during reporting period',
        regulation: 'SOLAS',
        requirement: 'Regular maintenance and replacement of safety equipment',
        status: 'PARTIALLY_COMPLIANT',
        evidence: [],
        remediation: 'Review safety equipment inventory and maintenance schedule',
      });
    } else {
      findings.push({
        id: `safety-equipment-activity-${Date.now()}`,
        severity: 'LOW',
        category: 'Safety Equipment',
        title: 'Safety Equipment Activity Recorded',
        description: `${safetyRequisitions.length} safety equipment requisitions processed`,
        regulation: 'SOLAS',
        requirement: 'Regular maintenance and replacement of safety equipment',
        status: 'COMPLIANT',
        evidence: safetyRequisitions.map(req => `requisition:${req.id}`),
      });

      // Add evidence for each requisition
      for (const requisition of safetyRequisitions) {
        evidence.push({
          id: `safety-req-evidence-${requisition.id}`,
          type: 'TRANSACTION',
          title: `Safety Equipment Requisition ${requisition.requisitionNumber}`,
          description: `Requisition for safety equipment items`,
          sourceId: requisition.id,
          sourceType: 'requisition',
          collectedAt: new Date(),
          collectedBy: 'system',
          metadata: {
            requisitionNumber: requisition.requisitionNumber,
            totalAmount: requisition.totalAmount,
            itemCount: requisition.items.length,
            urgencyLevel: requisition.urgencyLevel,
          },
        });
      }
    }

    return { findings, evidence };
  }

  /**
   * Check emergency procedures compliance
   */
  private static async checkEmergencyProceduresCompliance(vesselId: string, reportPeriod: { start: Date; end: Date }): Promise<{
    findings: ComplianceFinding[];
    evidence: ComplianceEvidence[];
  }> {
    const findings: ComplianceFinding[] = [];
    const evidence: ComplianceEvidence[] = [];

    // Check for emergency overrides
    const emergencyOverrides = await prisma.emergencyOverride.findMany({
      where: {
        vesselId,
        createdAt: {
          gte: reportPeriod.start,
          lte: reportPeriod.end,
        },
      },
    });

    for (const override of emergencyOverrides) {
      const severity = override.requiresPostApproval && !override.postApprovalReason ? 'HIGH' : 'MEDIUM';
      const status = override.postApprovalReason ? 'COMPLIANT' : 'PARTIALLY_COMPLIANT';

      findings.push({
        id: `emergency-override-${override.id}`,
        severity,
        category: 'Emergency Procedures',
        title: 'Emergency Override Used',
        description: `Emergency override activated: ${override.reason}`,
        regulation: 'SOLAS',
        requirement: 'Emergency procedures must be properly documented and approved',
        status,
        evidence: [`emergency_override:${override.id}`],
        remediation: override.postApprovalReason ? undefined : 'Complete post-approval documentation',
      });

      evidence.push({
        id: `emergency-override-evidence-${override.id}`,
        type: 'TRANSACTION',
        title: 'Emergency Override',
        description: `Emergency override procedure activated`,
        sourceId: override.id,
        sourceType: 'emergency_override',
        collectedAt: new Date(),
        collectedBy: 'system',
        metadata: {
          reason: override.reason,
          approvedBy: override.approvedBy,
          requiresPostApproval: override.requiresPostApproval,
          postApprovalCompleted: !!override.postApprovalReason,
        },
      });
    }

    return { findings, evidence };
  }

  /**
   * Check management system compliance
   */
  private static async checkManagementSystemCompliance(vesselId: string, reportPeriod: { start: Date; end: Date }): Promise<{
    findings: ComplianceFinding[];
    evidence: ComplianceEvidence[];
  }> {
    const findings: ComplianceFinding[] = [];
    const evidence: ComplianceEvidence[] = [];

    // Check for proper approval workflows
    const approvals = await prisma.approval.findMany({
      where: {
        requisition: {
          vesselId,
          createdAt: {
            gte: reportPeriod.start,
            lte: reportPeriod.end,
          },
        },
      },
      include: {
        requisition: true,
      },
    });

    const totalRequisitions = await prisma.requisition.count({
      where: {
        vesselId,
        createdAt: {
          gte: reportPeriod.start,
          lte: reportPeriod.end,
        },
      },
    });

    if (totalRequisitions > 0) {
      const approvalRate = (approvals.length / totalRequisitions) * 100;

      if (approvalRate < 95) {
        findings.push({
          id: `management-approval-rate-${Date.now()}`,
          severity: approvalRate < 80 ? 'HIGH' : 'MEDIUM',
          category: 'Management System',
          title: 'Low Approval Workflow Compliance',
          description: `Only ${approvalRate.toFixed(1)}% of requisitions have proper approval records`,
          regulation: 'ISM Code',
          requirement: 'All procurement activities must follow approved procedures',
          status: 'PARTIALLY_COMPLIANT',
          evidence: [`approval_rate:${approvalRate}`],
          remediation: 'Review and strengthen approval workflow procedures',
        });
      } else {
        findings.push({
          id: `management-approval-compliant-${Date.now()}`,
          severity: 'LOW',
          category: 'Management System',
          title: 'Approval Workflow Compliant',
          description: `${approvalRate.toFixed(1)}% of requisitions have proper approval records`,
          regulation: 'ISM Code',
          requirement: 'All procurement activities must follow approved procedures',
          status: 'COMPLIANT',
          evidence: [`approval_rate:${approvalRate}`],
        });
      }
    }

    return { findings, evidence };
  }

  /**
   * Check crew training compliance
   */
  private static async checkCrewTrainingCompliance(vesselId: string, reportPeriod: { start: Date; end: Date }): Promise<{
    findings: ComplianceFinding[];
    evidence: ComplianceEvidence[];
  }> {
    const findings: ComplianceFinding[] = [];
    const evidence: ComplianceEvidence[] = [];

    // This would typically check training records, certificates, etc.
    // For now, we'll create a placeholder finding
    findings.push({
      id: `crew-training-placeholder-${Date.now()}`,
      severity: 'MEDIUM',
      category: 'Crew Training',
      title: 'Crew Training Records Review Required',
      description: 'Manual review of crew training records and certifications required',
      regulation: 'ISM Code',
      requirement: 'Crew must be properly trained and certified',
      status: 'UNDER_REVIEW',
      evidence: [],
      remediation: 'Conduct comprehensive review of crew training records',
    });

    return { findings, evidence };
  }

  /**
   * Check financial compliance
   */
  private static async checkFinancialCompliance(transactionReport: any): Promise<{
    findings: ComplianceFinding[];
    evidence: ComplianceEvidence[];
  }> {
    const findings: ComplianceFinding[] = [];
    const evidence: ComplianceEvidence[] = [];

    // Check for high-value transactions without proper approval
    const highValueTransactions = transactionReport.transactions.filter((t: any) => 
      t.amount && t.amount > 25000
    );

    for (const transaction of highValueTransactions) {
      // Check if transaction has proper approval trail
      const hasApproval = transaction.metadata?.approvalLevel >= 3; // Assuming level 3+ for high value

      if (!hasApproval) {
        findings.push({
          id: `financial-high-value-no-approval-${transaction.id}`,
          severity: 'HIGH',
          category: 'Financial Controls',
          title: 'High-Value Transaction Without Proper Approval',
          description: `Transaction of ${transaction.currency} ${transaction.amount} lacks proper approval documentation`,
          regulation: 'SOX',
          requirement: 'High-value transactions require senior management approval',
          status: 'NON_COMPLIANT',
          evidence: [`transaction:${transaction.id}`],
          remediation: 'Implement proper approval controls for high-value transactions',
        });
      }
    }

    // Check for unusual spending patterns
    const spendingByUser = transactionReport.summary.userActions;
    const averageSpending = Object.values(spendingByUser).reduce((a: any, b: any) => a + b, 0) / Object.keys(spendingByUser).length;

    for (const [user, count] of Object.entries(spendingByUser)) {
      if ((count as number) > averageSpending * 3) {
        findings.push({
          id: `financial-unusual-spending-${user.replace(/\s+/g, '-')}`,
          severity: 'MEDIUM',
          category: 'Financial Controls',
          title: 'Unusual Spending Pattern Detected',
          description: `User ${user} has ${count} transactions, significantly above average of ${averageSpending.toFixed(1)}`,
          regulation: 'Internal Controls',
          requirement: 'Monitor for unusual spending patterns',
          status: 'UNDER_REVIEW',
          evidence: [`user_spending:${user}`],
          remediation: 'Review user spending patterns and authorization levels',
        });
      }
    }

    return { findings, evidence };
  }

  /**
   * Check procurement compliance
   */
  private static async checkProcurementCompliance(transactionReport: any): Promise<{
    findings: ComplianceFinding[];
    evidence: ComplianceEvidence[];
  }> {
    const findings: ComplianceFinding[] = [];
    const evidence: ComplianceEvidence[] = [];

    // Check for proper RFQ processes
    const purchaseOrderTransactions = transactionReport.transactions.filter((t: any) => 
      t.transactionType === 'PURCHASE_ORDER'
    );

    for (const poTransaction of purchaseOrderTransactions) {
      // Check if PO has corresponding RFQ
      const hasRFQ = transactionReport.transactions.some((t: any) => 
        t.transactionType === 'RFQ' && t.entityId === poTransaction.entityId
      );

      if (!hasRFQ && poTransaction.amount && poTransaction.amount > 1000) {
        findings.push({
          id: `procurement-no-rfq-${poTransaction.id}`,
          severity: 'MEDIUM',
          category: 'Procurement Process',
          title: 'Purchase Order Without RFQ',
          description: `Purchase order ${poTransaction.entityId} created without proper RFQ process`,
          regulation: 'Procurement Policy',
          requirement: 'Purchase orders above $1,000 require RFQ process',
          status: 'NON_COMPLIANT',
          evidence: [`transaction:${poTransaction.id}`],
          remediation: 'Ensure RFQ process is followed for all significant purchases',
        });
      }
    }

    return { findings, evidence };
  }

  /**
   * Check approval workflow compliance
   */
  private static async checkApprovalWorkflowCompliance(transactionReport: any): Promise<{
    findings: ComplianceFinding[];
    evidence: ComplianceEvidence[];
  }> {
    const findings: ComplianceFinding[] = [];
    const evidence: ComplianceEvidence[] = [];

    // Check for proper approval levels
    const approvalTransactions = transactionReport.transactions.filter((t: any) => 
      t.transactionType === 'APPROVAL'
    );

    const requisitionTransactions = transactionReport.transactions.filter((t: any) => 
      t.transactionType === 'REQUISITION'
    );

    // Check approval rate
    const approvalRate = requisitionTransactions.length > 0 ? 
      (approvalTransactions.length / requisitionTransactions.length) * 100 : 0;

    if (approvalRate < 95 && requisitionTransactions.length > 0) {
      findings.push({
        id: `approval-workflow-low-rate-${Date.now()}`,
        severity: approvalRate < 80 ? 'HIGH' : 'MEDIUM',
        category: 'Approval Workflow',
        title: 'Low Approval Workflow Compliance',
        description: `Only ${approvalRate.toFixed(1)}% of requisitions have approval records`,
        regulation: 'Internal Controls',
        requirement: 'All requisitions must follow proper approval workflow',
        status: 'PARTIALLY_COMPLIANT',
        evidence: [`approval_rate:${approvalRate}`],
        remediation: 'Review and strengthen approval workflow procedures',
      });
    }

    return { findings, evidence };
  }

  /**
   * Generate recommendations based on findings
   */
  private static generateRecommendations(
    findings: ComplianceFinding[],
    reportType: string
  ): ComplianceRecommendation[] {
    const recommendations: ComplianceRecommendation[] = [];

    // Group findings by category
    const findingsByCategory = findings.reduce((acc, finding) => {
      if (!acc[finding.category]) {
        acc[finding.category] = [];
      }
      acc[finding.category].push(finding);
      return acc;
    }, {} as Record<string, ComplianceFinding[]>);

    // Generate recommendations for each category
    for (const [category, categoryFindings] of Object.entries(findingsByCategory)) {
      const criticalFindings = categoryFindings.filter(f => f.severity === 'CRITICAL');
      const highFindings = categoryFindings.filter(f => f.severity === 'HIGH');
      const nonCompliantFindings = categoryFindings.filter(f => f.status === 'NON_COMPLIANT');

      if (criticalFindings.length > 0) {
        recommendations.push({
          id: `rec-critical-${category.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          priority: 'URGENT',
          title: `Address Critical ${category} Issues`,
          description: `${criticalFindings.length} critical issues found in ${category}. Immediate action required.`,
          category,
          estimatedEffort: 'High',
          targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          status: 'OPEN',
        });
      }

      if (highFindings.length > 0) {
        recommendations.push({
          id: `rec-high-${category.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          priority: 'HIGH',
          title: `Resolve High Priority ${category} Issues`,
          description: `${highFindings.length} high priority issues found in ${category}.`,
          category,
          estimatedEffort: 'Medium',
          targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          status: 'OPEN',
        });
      }

      if (nonCompliantFindings.length > 0) {
        recommendations.push({
          id: `rec-compliance-${category.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          priority: 'MEDIUM',
          title: `Improve ${category} Compliance`,
          description: `${nonCompliantFindings.length} non-compliant items found in ${category}.`,
          category,
          estimatedEffort: 'Medium',
          targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
          status: 'OPEN',
        });
      }
    }

    // Add report-specific recommendations
    if (reportType === 'SOLAS') {
      recommendations.push({
        id: `rec-solas-general-${Date.now()}`,
        priority: 'MEDIUM',
        title: 'Regular SOLAS Compliance Review',
        description: 'Establish regular SOLAS compliance review schedule',
        category: 'General',
        estimatedEffort: 'Low',
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        status: 'OPEN',
      });
    }

    return recommendations;
  }

  /**
   * Store compliance report in database
   */
  private static async storeComplianceReport(report: ComplianceReport): Promise<void> {
    try {
      await prisma.complianceReportStorage.create({
        data: {
          reportId: report.id,
          reportType: report.reportType,
          title: report.title,
          description: report.description,
          vesselId: report.vesselId,
          reportPeriodStart: report.reportPeriodStart,
          reportPeriodEnd: report.reportPeriodEnd,
          generatedBy: report.generatedBy,
          generatedAt: report.generatedAt,
          status: report.status,
          findings: report.findings,
          recommendations: report.recommendations,
          evidence: report.evidence,
          metadata: report.metadata,
        },
      });

      logger.info('Compliance report stored', {
        reportId: report.id,
        reportType: report.reportType,
        vesselId: report.vesselId,
      });
    } catch (error) {
      logger.error('Failed to store compliance report', {
        error: error.message,
        reportId: report.id,
      });
      throw error;
    }
  }

  /**
   * Get stored compliance reports
   */
  static async getComplianceReports(filters: {
    reportType?: string;
    vesselId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ComplianceReport[]> {
    try {
      const where: any = {};

      if (filters.reportType) where.reportType = filters.reportType;
      if (filters.vesselId) where.vesselId = filters.vesselId;
      if (filters.status) where.status = filters.status;
      if (filters.startDate || filters.endDate) {
        where.generatedAt = {};
        if (filters.startDate) where.generatedAt.gte = filters.startDate;
        if (filters.endDate) where.generatedAt.lte = filters.endDate;
      }

      const reports = await prisma.complianceReportStorage.findMany({
        where,
        orderBy: { generatedAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
        include: {
          vessel: {
            select: {
              id: true,
              name: true,
              imoNumber: true,
            },
          },
          generator: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return reports as ComplianceReport[];
    } catch (error) {
      logger.error('Failed to get compliance reports', {
        error: error.message,
        filters,
      });
      throw error;
    }
  }

  /**
   * Update compliance report status
   */
  static async updateComplianceReportStatus(
    reportId: string,
    status: ComplianceReport['status'],
    updatedBy: string
  ): Promise<ComplianceReport> {
    try {
      const report = await prisma.complianceReportStorage.update({
        where: { reportId },
        data: { status },
      });

      // Log the status update
      await AuditService.logComplianceEvent({
        userId: updatedBy,
        regulation: 'Compliance Reporting',
        complianceType: 'SOX',
        action: 'COMPLIANCE_REPORT_STATUS_UPDATED',
        details: {
          reportId,
          newStatus: status,
          reportType: report.reportType,
        },
      });

      logger.info('Compliance report status updated', {
        reportId,
        status,
        updatedBy,
      });

      return report as ComplianceReport;
    } catch (error) {
      logger.error('Failed to update compliance report status', {
        error: error.message,
        reportId,
      });
      throw error;
    }
  }

  /**
   * Schedule automated compliance reporting
   */
  static scheduleAutomatedReporting(): void {
    // Schedule monthly SOLAS reports for all vessels
    setInterval(async () => {
      try {
        const vessels = await prisma.vessel.findMany({
          select: { id: true, name: true },
        });

        const reportPeriod = {
          start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
          end: new Date(new Date().getFullYear(), new Date().getMonth(), 0),
        };

        for (const vessel of vessels) {
          try {
            await this.generateSOLASReport(vessel.id, reportPeriod, 'system');
            await this.generateISMReport(vessel.id, reportPeriod, 'system');
          } catch (error) {
            logger.error('Failed to generate automated report', {
              error: error.message,
              vesselId: vessel.id,
            });
          }
        }

        // Generate fleet-wide financial audit report
        await this.generateFinancialAuditReport(null, reportPeriod, 'system');

        logger.info('Automated compliance reports generated');
      } catch (error) {
        logger.error('Failed to generate automated compliance reports', {
          error: error.message,
        });
      }
    }, 30 * 24 * 60 * 60 * 1000); // Monthly

    logger.info('Automated compliance reporting scheduler initialized');
  }
}

export const automatedComplianceReportingService = AutomatedComplianceReportingService;s = transactionReport.transactions.filter((t: any) => 
      t.transactionType === 'PURCHASE_ORDER'
    );

    const rfqs = transactionReport.transactions.filter((t: any) => 
      t.transactionType === 'RFQ'
    );

    if (purchaseOrders.length > 0 && rfqs.length === 0) {
      findings.push({
        id: `procurement-no-rfq-${Date.now()}`,
        severity: 'MEDIUM',
        category: 'Procurement Process',
        title: 'Purchase Orders Without RFQ Process',
        description: `${purchaseOrders.length} purchase orders created without corresponding RFQ process`,
        regulation: 'Procurement Policy',
        requirement: 'Competitive bidding required for procurement above threshold',
        status: 'PARTIALLY_COMPLIANT',
        evidence: purchaseOrders.map((po: any) => `purchase_order:${po.id}`),
        remediation: 'Ensure RFQ process is followed for all applicable purchases',
      });
    }

    return { findings, evidence };
  }

  /**
   * Check approval workflow compliance
   */
  private static async checkApprovalWorkflowCompliance(transactionReport: any): Promise<{
    findings: ComplianceFinding[];
    evidence: ComplianceEvidence[];
  }> {
    const findings: ComplianceFinding[] = [];
    const evidence: ComplianceEvidence[] = [];

    // Check for transactions that bypassed approval workflow
    const bypassedApprovals = transactionReport.transactions.filter((t: any) => 
      t.metadata?.emergencyOverride === true
    );

    if (bypassedApprovals.length > 0) {
      findings.push({
        id: `approval-workflow-bypassed-${Date.now()}`,
        severity: 'HIGH',
        category: 'Approval Workflow',
        title: 'Emergency Overrides Used',
        description: `${bypassedApprovals.length} transactions used emergency override procedures`,
        regulation: 'Internal Controls',
        requirement: 'Emergency overrides should be rare and properly documented',
        status: 'UNDER_REVIEW',
        evidence: bypassedApprovals.map((t: any) => `transaction:${t.id}`),
        remediation: 'Review emergency override usage and ensure proper documentation',
      });
    }

    return { findings, evidence };
  }

  /**
   * Generate recommendations based on findings
   */
  private static generateRecommendations(findings: ComplianceFinding[], reportType: string): ComplianceRecommendation[] {
    const recommendations: ComplianceRecommendation[] = [];

    // Group findings by category and severity
    const criticalFindings = findings.filter(f => f.severity === 'CRITICAL');
    const highFindings = findings.filter(f => f.severity === 'HIGH');

    // Generate recommendations for critical findings
    if (criticalFindings.length > 0) {
      recommendations.push({
        id: `rec-critical-${Date.now()}`,
        priority: 'URGENT',
        title: 'Address Critical Compliance Issues',
        description: `Immediately address ${criticalFindings.length} critical compliance issues`,
        category: 'Critical Issues',
        estimatedEffort: '1-2 weeks',
        targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'OPEN',
      });
    }

    // Generate recommendations for high findings
    if (highFindings.length > 0) {
      recommendations.push({
        id: `rec-high-${Date.now()}`,
        priority: 'HIGH',
        title: 'Resolve High-Priority Issues',
        description: `Address ${highFindings.length} high-priority compliance issues`,
        category: 'High Priority',
        estimatedEffort: '2-4 weeks',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'OPEN',
      });
    }

    // Add report-specific recommendations
    if (reportType === 'SOLAS' || reportType === 'ISM') {
      recommendations.push({
        id: `rec-cert-monitoring-${Date.now()}`,
        priority: 'MEDIUM',
        title: 'Implement Certificate Monitoring System',
        description: 'Set up automated alerts for certificate expiry dates',
        category: 'Process Improvement',
        estimatedEffort: '1-2 weeks',
        estimatedCost: 5000,
        currency: 'USD',
        targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'OPEN',
      });
    }

    if (reportType === 'FINANCIAL_AUDIT') {
      recommendations.push({
        id: `rec-financial-controls-${Date.now()}`,
        priority: 'HIGH',
        title: 'Strengthen Financial Controls',
        description: 'Implement additional controls for high-value transactions',
        category: 'Financial Controls',
        estimatedEffort: '3-4 weeks',
        estimatedCost: 10000,
        currency: 'USD',
        targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        status: 'OPEN',
      });
    }

    return recommendations;
  }

  /**
   * Store compliance report
   */
  private static async storeComplianceReport(report: ComplianceReport): Promise<void> {
    try {
      // In a real implementation, this would store the report in the database
      // For now, we'll just log it
      logger.info('Compliance report stored', {
        reportId: report.id,
        reportType: report.reportType,
        findingsCount: report.findings.length,
        recommendationsCount: report.recommendations.length,
      });

      // Store report metadata in audit log
      await AuditService.logAction(
        report.generatedBy,
        'CREATE',
        'compliance_report',
        report.id,
        undefined,
        {
          reportType: report.reportType,
          vesselId: report.vesselId,
          findingsCount: report.findings.length,
          recommendationsCount: report.recommendations.length,
        }
      );
    } catch (error) {
      logger.error('Failed to store compliance report', {
        error: error.message,
        reportId: report.id,
      });
      throw error;
    }
  }

  /**
   * Schedule automated compliance reporting
   */
  static scheduleAutomatedReporting(): void {
    // Schedule monthly SOLAS reports
    setInterval(async () => {
      try {
        const vessels = await prisma.vessel.findMany({
          where: { isActive: true },
        });

        const reportPeriod = {
          start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
          end: new Date(new Date().getFullYear(), new Date().getMonth(), 0),
        };

        for (const vessel of vessels) {
          await this.generateSOLASReport(vessel.id, reportPeriod, 'system');
          await this.generateISMReport(vessel.id, reportPeriod, 'system');
        }
      } catch (error) {
        logger.error('Automated compliance reporting failed', { error: error.message });
      }
    }, 30 * 24 * 60 * 60 * 1000); // Monthly

    // Schedule quarterly financial audits
    setInterval(async () => {
      try {
        const reportPeriod = {
          start: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3 - 3, 1),
          end: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 0),
        };

        await this.generateFinancialAuditReport(null, reportPeriod, 'system');
      } catch (error) {
        logger.error('Automated financial audit failed', { error: error.message });
      }
    }, 90 * 24 * 60 * 60 * 1000); // Quarterly

    logger.info('Automated compliance reporting scheduler initialized');
  }
}

export const automatedComplianceReportingService = AutomatedComplianceReportingService;
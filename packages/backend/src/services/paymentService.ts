import { PrismaClient, Invoice, InvoiceStatus } from '@prisma/client';
import { auditService } from './auditService';
import { logger } from '../utils/logger';
import axios from 'axios';

const prisma = new PrismaClient();

export interface BankingIntegrationConfig {
  apiUrl: string;
  apiKey: string;
  accountId: string;
  routingNumber: string;
}

export interface PaymentRequest {
  invoiceId: string;
  amount: number;
  currency: string;
  vendorBankDetails: {
    accountNumber: string;
    routingNumber: string;
    bankName: string;
    swiftCode?: string;
  };
  reference: string;
  description: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  reference: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  processedAt: Date;
  errorMessage?: string;
  bankResponse?: any;
}

export interface PaymentApprovalWorkflow {
  invoiceId: string;
  approvers: string[];
  currentLevel: number;
  maxLevel: number;
  isApproved: boolean;
  approvalHistory: Array<{
    approverId: string;
    level: number;
    status: 'APPROVED' | 'REJECTED';
    comments?: string;
    approvedAt: Date;
  }>;
}

export class PaymentService {
  private bankingConfig: BankingIntegrationConfig;

  constructor() {
    this.bankingConfig = {
      apiUrl: process.env.BANKING_API_URL || 'https://api.mockbank.com',
      apiKey: process.env.BANKING_API_KEY || 'mock-api-key',
      accountId: process.env.COMPANY_ACCOUNT_ID || 'COMP-001',
      routingNumber: process.env.COMPANY_ROUTING_NUMBER || '123456789'
    };
  }

  async initiatePayment(
    paymentRequest: PaymentRequest,
    userId: string
  ): Promise<PaymentResult> {
    try {
      // Validate invoice and get details
      const invoice = await prisma.invoice.findUnique({
        where: { id: paymentRequest.invoiceId },
        include: {
          purchaseOrder: {
            include: {
              vendor: true,
              vessel: true
            }
          }
        }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== InvoiceStatus.APPROVED) {
        throw new Error('Invoice must be approved before payment');
      }

      if (invoice.paidAmount && invoice.paidAmount >= invoice.totalAmount) {
        throw new Error('Invoice is already fully paid');
      }

      // Check if payment approval is required
      const requiresApproval = await this.checkPaymentApprovalRequired(invoice, paymentRequest.amount);
      
      if (requiresApproval) {
        // Create payment approval workflow
        const approvalWorkflow = await this.createPaymentApprovalWorkflow(
          paymentRequest.invoiceId,
          paymentRequest.amount,
          userId
        );
        
        return {
          success: false,
          reference: paymentRequest.reference,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          status: 'PENDING',
          processedAt: new Date(),
          errorMessage: 'Payment requires approval before processing'
        };
      }

      // Process payment directly
      const paymentResult = await this.processPaymentWithBank(paymentRequest);

      // Update invoice with payment information
      if (paymentResult.success) {
        await this.updateInvoicePaymentStatus(
          paymentRequest.invoiceId,
          paymentRequest.amount,
          paymentResult.transactionId!,
          paymentResult.reference
        );
      }

      // Audit log
      await auditService.log({
        userId,
        action: 'CREATE',
        resource: 'Payment',
        resourceId: paymentRequest.invoiceId,
        metadata: {
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          success: paymentResult.success,
          transactionId: paymentResult.transactionId
        },
        vesselId: invoice.purchaseOrder.vesselId
      });

      logger.info(`Payment ${paymentResult.success ? 'completed' : 'failed'}`, {
        invoiceId: paymentRequest.invoiceId,
        amount: paymentRequest.amount,
        transactionId: paymentResult.transactionId,
        userId
      });

      return paymentResult;

    } catch (error) {
      logger.error('Payment initiation failed:', error);
      throw error;
    }
  }

  private async processPaymentWithBank(paymentRequest: PaymentRequest): Promise<PaymentResult> {
    try {
      // In a real implementation, this would integrate with actual banking APIs
      // For now, we'll simulate the banking integration
      
      const bankingPayload = {
        fromAccount: {
          accountId: this.bankingConfig.accountId,
          routingNumber: this.bankingConfig.routingNumber
        },
        toAccount: {
          accountNumber: paymentRequest.vendorBankDetails.accountNumber,
          routingNumber: paymentRequest.vendorBankDetails.routingNumber,
          bankName: paymentRequest.vendorBankDetails.bankName,
          swiftCode: paymentRequest.vendorBankDetails.swiftCode
        },
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        reference: paymentRequest.reference,
        description: paymentRequest.description,
        metadata: {
          invoiceId: paymentRequest.invoiceId
        }
      };

      // Simulate API call to banking system
      const response = await this.callBankingAPI('/payments/transfer', bankingPayload);

      if (response.success) {
        return {
          success: true,
          transactionId: response.transactionId,
          reference: paymentRequest.reference,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          status: 'COMPLETED',
          processedAt: new Date(),
          bankResponse: response
        };
      } else {
        return {
          success: false,
          reference: paymentRequest.reference,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          status: 'FAILED',
          processedAt: new Date(),
          errorMessage: response.errorMessage,
          bankResponse: response
        };
      }

    } catch (error) {
      logger.error('Banking API call failed:', error);
      return {
        success: false,
        reference: paymentRequest.reference,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        status: 'FAILED',
        processedAt: new Date(),
        errorMessage: 'Banking system unavailable'
      };
    }
  }

  private async callBankingAPI(endpoint: string, payload: any): Promise<any> {
    try {
      // Simulate banking API response
      // In production, this would be a real API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

      // Mock successful response for amounts under $10,000
      if (payload.amount < 10000) {
        return {
          success: true,
          transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: 'COMPLETED',
          processedAt: new Date().toISOString(),
          fees: payload.amount * 0.001, // 0.1% fee
          exchangeRate: payload.currency === 'USD' ? 1 : 1.1
        };
      } else {
        // Mock failure for high amounts (simulating additional approval needed)
        return {
          success: false,
          errorCode: 'AMOUNT_LIMIT_EXCEEDED',
          errorMessage: 'Payment amount exceeds daily limit'
        };
      }

    } catch (error) {
      logger.error('Banking API error:', error);
      throw error;
    }
  }

  private async checkPaymentApprovalRequired(
    invoice: any,
    amount: number
  ): Promise<boolean> {
    // Payment approval thresholds
    const APPROVAL_THRESHOLDS = {
      ROUTINE: 5000,      // $5,000
      URGENT: 10000,      // $10,000
      EMERGENCY: 25000    // $25,000
    };

    // Check amount threshold
    if (amount >= APPROVAL_THRESHOLDS.ROUTINE) {
      return true;
    }

    // Check if vendor requires additional approval
    if (invoice.purchaseOrder.vendor.creditLimit && 
        amount > invoice.purchaseOrder.vendor.creditLimit) {
      return true;
    }

    // Check if this is a high-risk payment (first time vendor, etc.)
    const vendorPaymentHistory = await prisma.invoice.count({
      where: {
        purchaseOrder: {
          vendorId: invoice.purchaseOrder.vendorId
        },
        status: InvoiceStatus.PAID
      }
    });

    if (vendorPaymentHistory === 0 && amount > 1000) {
      return true; // First payment to vendor over $1,000 requires approval
    }

    return false;
  }

  private async createPaymentApprovalWorkflow(
    invoiceId: string,
    amount: number,
    requesterId: string
  ): Promise<PaymentApprovalWorkflow> {
    // Determine approval levels based on amount
    const approvers: string[] = [];
    let maxLevel = 1;

    if (amount >= 25000) {
      // Senior management approval required
      maxLevel = 3;
      // In a real system, these would be dynamically determined
      approvers.push('finance-manager-id', 'cfo-id', 'ceo-id');
    } else if (amount >= 10000) {
      // Finance manager approval required
      maxLevel = 2;
      approvers.push('finance-manager-id', 'cfo-id');
    } else {
      // Finance team approval required
      maxLevel = 1;
      approvers.push('finance-manager-id');
    }

    const workflow: PaymentApprovalWorkflow = {
      invoiceId,
      approvers,
      currentLevel: 1,
      maxLevel,
      isApproved: false,
      approvalHistory: []
    };

    // Store workflow in database (you might want to create a PaymentApproval model)
    // For now, we'll store it as metadata in the audit log
    await auditService.log({
      userId: requesterId,
      action: 'CREATE',
      resource: 'PaymentApproval',
      resourceId: invoiceId,
      metadata: {
        workflow,
        amount,
        status: 'PENDING_APPROVAL'
      }
    });

    return workflow;
  }

  private async updateInvoicePaymentStatus(
    invoiceId: string,
    paidAmount: number,
    transactionId: string,
    reference: string
  ): Promise<void> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const totalPaid = (invoice.paidAmount || 0) + paidAmount;
    const isFullyPaid = totalPaid >= invoice.totalAmount;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: totalPaid,
        paidDate: isFullyPaid ? new Date() : invoice.paidDate,
        paymentReference: reference,
        status: isFullyPaid ? InvoiceStatus.PAID : invoice.status
      }
    });
  }

  async approvePayment(
    invoiceId: string,
    approverId: string,
    approved: boolean,
    comments?: string
  ): Promise<{ approved: boolean; canProceedWithPayment: boolean }> {
    try {
      // Get the current approval workflow from audit logs
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          resource: 'PaymentApproval',
          resourceId: invoiceId,
          action: 'CREATE'
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      });

      if (auditLogs.length === 0) {
        throw new Error('Payment approval workflow not found');
      }

      const workflow = auditLogs[0].metadata as any;
      
      if (!workflow.workflow) {
        throw new Error('Invalid approval workflow');
      }

      const approvalWorkflow: PaymentApprovalWorkflow = workflow.workflow;

      // Check if approver is authorized for current level
      const currentApprover = approvalWorkflow.approvers[approvalWorkflow.currentLevel - 1];
      if (currentApprover !== approverId) {
        throw new Error('User not authorized to approve at this level');
      }

      // Record approval/rejection
      approvalWorkflow.approvalHistory.push({
        approverId,
        level: approvalWorkflow.currentLevel,
        status: approved ? 'APPROVED' : 'REJECTED',
        comments,
        approvedAt: new Date()
      });

      if (!approved) {
        // Payment rejected
        approvalWorkflow.isApproved = false;
        
        await auditService.log({
          userId: approverId,
          action: 'UPDATE',
          resource: 'PaymentApproval',
          resourceId: invoiceId,
          metadata: {
            workflow: approvalWorkflow,
            status: 'REJECTED',
            level: approvalWorkflow.currentLevel
          }
        });

        return { approved: false, canProceedWithPayment: false };
      }

      // Check if all levels are approved
      if (approvalWorkflow.currentLevel >= approvalWorkflow.maxLevel) {
        approvalWorkflow.isApproved = true;
        
        await auditService.log({
          userId: approverId,
          action: 'UPDATE',
          resource: 'PaymentApproval',
          resourceId: invoiceId,
          metadata: {
            workflow: approvalWorkflow,
            status: 'FULLY_APPROVED'
          }
        });

        return { approved: true, canProceedWithPayment: true };
      } else {
        // Move to next approval level
        approvalWorkflow.currentLevel++;
        
        await auditService.log({
          userId: approverId,
          action: 'UPDATE',
          resource: 'PaymentApproval',
          resourceId: invoiceId,
          metadata: {
            workflow: approvalWorkflow,
            status: 'PARTIALLY_APPROVED',
            nextLevel: approvalWorkflow.currentLevel
          }
        });

        return { approved: true, canProceedWithPayment: false };
      }

    } catch (error) {
      logger.error('Payment approval failed:', error);
      throw error;
    }
  }

  async getPaymentStatus(invoiceId: string): Promise<{
    invoice: any;
    paymentStatus: {
      isPaid: boolean;
      paidAmount: number;
      remainingAmount: number;
      paymentHistory: any[];
      pendingApprovals: any[];
    };
  }> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        purchaseOrder: {
          include: {
            vendor: true,
            vessel: true
          }
        }
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const paidAmount = invoice.paidAmount || 0;
    const remainingAmount = invoice.totalAmount - paidAmount;
    const isPaid = remainingAmount <= 0;

    // Get payment history from audit logs
    const paymentHistory = await prisma.auditLog.findMany({
      where: {
        resource: 'Payment',
        resourceId: invoiceId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get pending approvals
    const pendingApprovals = await prisma.auditLog.findMany({
      where: {
        resource: 'PaymentApproval',
        resourceId: invoiceId,
        metadata: {
          path: ['status'],
          equals: 'PENDING_APPROVAL'
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      invoice,
      paymentStatus: {
        isPaid,
        paidAmount,
        remainingAmount,
        paymentHistory,
        pendingApprovals
      }
    };
  }

  async handlePaymentException(
    invoiceId: string,
    exceptionType: 'BANK_ERROR' | 'INSUFFICIENT_FUNDS' | 'INVALID_ACCOUNT' | 'TIMEOUT',
    details: string,
    userId: string
  ): Promise<void> {
    try {
      // Log the exception
      await auditService.log({
        userId,
        action: 'CREATE',
        resource: 'PaymentException',
        resourceId: invoiceId,
        metadata: {
          exceptionType,
          details,
          timestamp: new Date(),
          requiresManualReview: true
        }
      });

      // Update invoice status if needed
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.DISPUTED,
          notes: `Payment exception: ${exceptionType} - ${details}`
        }
      });

      logger.error(`Payment exception for invoice ${invoiceId}`, {
        exceptionType,
        details,
        userId
      });

    } catch (error) {
      logger.error('Failed to handle payment exception:', error);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
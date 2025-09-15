import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { paymentService, PaymentRequest } from '../services/paymentService';
import { auditService } from '../services/auditService';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

const prisma = new PrismaClient();

export class PaymentController {
  async initiatePayment(req: Request, res: Response): Promise<void> {
    try {
      const {
        invoiceId,
        amount,
        currency = 'USD',
        vendorBankDetails,
        reference,
        description
      } = req.body;

      // Validate required fields
      if (!invoiceId || !amount || !vendorBankDetails || !reference) {
        throw new AppError('Missing required fields', 400, 'MISSING_REQUIRED_FIELDS');
      }

      // Validate vendor bank details
      if (!vendorBankDetails.accountNumber || !vendorBankDetails.routingNumber || !vendorBankDetails.bankName) {
        throw new AppError('Invalid vendor bank details', 400, 'INVALID_BANK_DETAILS');
      }

      // Verify invoice exists and user has access
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          purchaseOrder: {
            include: {
              vessel: true,
              vendor: true
            }
          }
        }
      });

      if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
      }

      // Check vessel access
      const userVessels = req.user.vessels.map((v: any) => v.id);
      if (!userVessels.includes(invoice.purchaseOrder.vesselId)) {
        throw new AppError('Access denied to vessel', 403, 'VESSEL_ACCESS_DENIED');
      }

      // Validate payment amount
      const remainingAmount = invoice.totalAmount - (invoice.paidAmount || 0);
      if (amount > remainingAmount) {
        throw new AppError('Payment amount exceeds remaining balance', 400, 'AMOUNT_EXCEEDS_BALANCE');
      }

      const paymentRequest: PaymentRequest = {
        invoiceId,
        amount: parseFloat(amount),
        currency,
        vendorBankDetails,
        reference,
        description: description || `Payment for invoice ${invoice.invoiceNumber}`
      };

      const result = await paymentService.initiatePayment(paymentRequest, req.user.id);

      logger.info(`Payment initiated for invoice ${invoice.invoiceNumber}`, {
        invoiceId,
        amount,
        success: result.success,
        userId: req.user.id
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Payment initiation failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to initiate payment'
        });
      }
    }
  }

  async approvePayment(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      const { approved, comments } = req.body;

      if (typeof approved !== 'boolean') {
        throw new AppError('Approval status is required', 400, 'MISSING_APPROVAL_STATUS');
      }

      // Verify invoice exists and user has access
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          purchaseOrder: {
            include: {
              vessel: true
            }
          }
        }
      });

      if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
      }

      // Check vessel access
      const userVessels = req.user.vessels.map((v: any) => v.id);
      if (!userVessels.includes(invoice.purchaseOrder.vesselId)) {
        throw new AppError('Access denied to vessel', 403, 'VESSEL_ACCESS_DENIED');
      }

      const result = await paymentService.approvePayment(
        invoiceId,
        req.user.id,
        approved,
        comments
      );

      logger.info(`Payment ${approved ? 'approved' : 'rejected'} for invoice ${invoice.invoiceNumber}`, {
        invoiceId,
        approved,
        canProceedWithPayment: result.canProceedWithPayment,
        userId: req.user.id
      });

      res.json({
        success: true,
        data: {
          approved: result.approved,
          canProceedWithPayment: result.canProceedWithPayment,
          message: approved 
            ? (result.canProceedWithPayment ? 'Payment fully approved and can proceed' : 'Payment approved, awaiting additional approvals')
            : 'Payment rejected'
        }
      });
    } catch (error) {
      logger.error('Payment approval failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to process payment approval'
        });
      }
    }
  }

  async getPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;

      const result = await paymentService.getPaymentStatus(invoiceId);

      // Check vessel access
      const userVessels = req.user.vessels.map((v: any) => v.id);
      if (!userVessels.includes(result.invoice.purchaseOrder.vesselId)) {
        throw new AppError('Access denied to vessel', 403, 'VESSEL_ACCESS_DENIED');
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get payment status failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to get payment status'
        });
      }
    }
  }

  async handlePaymentException(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      const { exceptionType, details } = req.body;

      const validExceptionTypes = ['BANK_ERROR', 'INSUFFICIENT_FUNDS', 'INVALID_ACCOUNT', 'TIMEOUT'];
      if (!validExceptionTypes.includes(exceptionType)) {
        throw new AppError('Invalid exception type', 400, 'INVALID_EXCEPTION_TYPE');
      }

      if (!details) {
        throw new AppError('Exception details are required', 400, 'MISSING_EXCEPTION_DETAILS');
      }

      // Verify invoice exists and user has access
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          purchaseOrder: {
            include: {
              vessel: true
            }
          }
        }
      });

      if (!invoice) {
        throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
      }

      // Check vessel access
      const userVessels = req.user.vessels.map((v: any) => v.id);
      if (!userVessels.includes(invoice.purchaseOrder.vesselId)) {
        throw new AppError('Access denied to vessel', 403, 'VESSEL_ACCESS_DENIED');
      }

      await paymentService.handlePaymentException(
        invoiceId,
        exceptionType,
        details,
        req.user.id
      );

      logger.info(`Payment exception handled for invoice ${invoice.invoiceNumber}`, {
        invoiceId,
        exceptionType,
        userId: req.user.id
      });

      res.json({
        success: true,
        message: 'Payment exception recorded and will be reviewed'
      });
    } catch (error) {
      logger.error('Handle payment exception failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to handle payment exception'
        });
      }
    }
  }

  async getPaymentHistory(req: Request, res: Response): Promise<void> {
    try {
      const {
        vesselId,
        vendorId,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'paidDate',
        sortOrder = 'desc'
      } = req.query;

      // Build where clause
      const where: any = {
        status: 'PAID',
        paidDate: {
          not: null
        }
      };

      // Filter by vessel access
      const userVessels = req.user.vessels.map((v: any) => v.id);
      if (vesselId) {
        if (!userVessels.includes(vesselId as string)) {
          throw new AppError('Access denied to vessel', 403, 'VESSEL_ACCESS_DENIED');
        }
        where.purchaseOrder = {
          vesselId: vesselId as string
        };
      } else {
        where.purchaseOrder = {
          vesselId: {
            in: userVessels
          }
        };
      }

      // Add vendor filter
      if (vendorId) {
        where.purchaseOrder = {
          ...where.purchaseOrder,
          vendorId: vendorId as string
        };
      }

      // Add date range filter
      if (startDate || endDate) {
        where.paidDate = {};
        if (startDate) {
          where.paidDate.gte = new Date(startDate as string);
        }
        if (endDate) {
          where.paidDate.lte = new Date(endDate as string);
        }
      }

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const [payments, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            purchaseOrder: {
              include: {
                vendor: true,
                vessel: true
              }
            }
          },
          orderBy: {
            [sortBy as string]: sortOrder as 'asc' | 'desc'
          },
          skip,
          take: parseInt(limit as string)
        }),
        prisma.invoice.count({ where })
      ]);

      // Calculate summary statistics
      const totalPaid = await prisma.invoice.aggregate({
        where,
        _sum: {
          paidAmount: true
        }
      });

      res.json({
        success: true,
        data: {
          payments,
          summary: {
            totalPayments: total,
            totalAmount: totalPaid._sum.paidAmount || 0
          },
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            pages: Math.ceil(total / parseInt(limit as string))
          }
        }
      });
    } catch (error) {
      logger.error('Get payment history failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to get payment history'
        });
      }
    }
  }

  async getPendingPayments(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId } = req.query;

      // Build where clause for approved invoices that haven't been paid
      const where: any = {
        status: 'APPROVED',
        OR: [
          { paidAmount: null },
          { paidAmount: { lt: prisma.invoice.fields.totalAmount } }
        ]
      };

      // Filter by vessel access
      const userVessels = req.user.vessels.map((v: any) => v.id);
      if (vesselId) {
        if (!userVessels.includes(vesselId as string)) {
          throw new AppError('Access denied to vessel', 403, 'VESSEL_ACCESS_DENIED');
        }
        where.purchaseOrder = {
          vesselId: vesselId as string
        };
      } else {
        where.purchaseOrder = {
          vesselId: {
            in: userVessels
          }
        };
      }

      const pendingPayments = await prisma.invoice.findMany({
        where,
        include: {
          purchaseOrder: {
            include: {
              vendor: true,
              vessel: true
            }
          }
        },
        orderBy: {
          dueDate: 'asc'
        }
      });

      // Calculate total pending amount
      const totalPending = pendingPayments.reduce((sum, invoice) => {
        const remainingAmount = invoice.totalAmount - (invoice.paidAmount || 0);
        return sum + remainingAmount;
      }, 0);

      res.json({
        success: true,
        data: {
          pendingPayments,
          summary: {
            count: pendingPayments.length,
            totalAmount: totalPending
          }
        }
      });
    } catch (error) {
      logger.error('Get pending payments failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to get pending payments'
        });
      }
    }
  }
}

export const paymentController = new PaymentController();
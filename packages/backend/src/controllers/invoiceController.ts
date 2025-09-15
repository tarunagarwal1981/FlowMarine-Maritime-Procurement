import { Request, Response } from 'express';
import { PrismaClient, InvoiceStatus } from '@prisma/client';
import { invoiceProcessingService } from '../services/invoiceProcessingService';
import { auditService } from '../services/auditService';
import { logger } from '../utils/logger';
import multer from 'multer';
import { AppError } from '../utils/errors';

const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  }
});

export const uploadMiddleware = upload.single('invoiceFile');

export class InvoiceController {
  async createInvoice(req: Request, res: Response): Promise<void> {
    try {
      const {
        invoiceNumber,
        purchaseOrderId,
        totalAmount,
        currency = 'USD',
        invoiceDate,
        dueDate,
        notes
      } = req.body;

      // Validate required fields
      if (!invoiceNumber || !purchaseOrderId || !totalAmount || !invoiceDate) {
        throw new AppError('Missing required fields', 400, 'MISSING_REQUIRED_FIELDS');
      }

      // Verify purchase order exists
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId }
      });

      if (!purchaseOrder) {
        throw new AppError('Purchase order not found', 404, 'PURCHASE_ORDER_NOT_FOUND');
      }

      // Check for duplicate invoice number
      const existingInvoice = await prisma.invoice.findUnique({
        where: { invoiceNumber }
      });

      if (existingInvoice) {
        throw new AppError('Invoice number already exists', 409, 'DUPLICATE_INVOICE_NUMBER');
      }

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          purchaseOrderId,
          totalAmount: parseFloat(totalAmount),
          currency,
          invoiceDate: new Date(invoiceDate),
          dueDate: dueDate ? new Date(dueDate) : null,
          notes,
          status: InvoiceStatus.RECEIVED
        },
        include: {
          purchaseOrder: {
            include: {
              vendor: true,
              vessel: true
            }
          }
        }
      });

      // Audit log
      await auditService.log({
        userId: req.user.id,
        action: 'CREATE',
        resource: 'Invoice',
        resourceId: invoice.id,
        newValues: invoice,
        vesselId: invoice.purchaseOrder.vesselId
      });

      logger.info(`Invoice created: ${invoice.invoiceNumber}`, {
        invoiceId: invoice.id,
        purchaseOrderId,
        userId: req.user.id
      });

      res.status(201).json({
        success: true,
        data: invoice
      });
    } catch (error) {
      logger.error('Create invoice failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create invoice'
        });
      }
    }
  }

  async processInvoiceOCR(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      const file = req.file;

      if (!file) {
        throw new AppError('Invoice file is required', 400, 'FILE_REQUIRED');
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

      // Process invoice with OCR
      const result = await invoiceProcessingService.processInvoice(
        invoiceId,
        file.buffer,
        req.user.id
      );

      logger.info(`Invoice OCR processing completed: ${invoice.invoiceNumber}`, {
        invoiceId,
        isValid: result.isValid,
        userId: req.user.id
      });

      res.json({
        success: true,
        data: {
          invoiceId,
          processingResult: result
        }
      });
    } catch (error) {
      logger.error('Invoice OCR processing failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to process invoice OCR'
        });
      }
    }
  }

  async performThreeWayMatching(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;

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

      // Perform three-way matching
      const result = await invoiceProcessingService.processInvoice(
        invoiceId,
        undefined, // No OCR processing
        req.user.id
      );

      logger.info(`Three-way matching completed: ${invoice.invoiceNumber}`, {
        invoiceId,
        isMatched: result.threeWayMatch?.isMatched,
        userId: req.user.id
      });

      res.json({
        success: true,
        data: {
          invoiceId,
          threeWayMatch: result.threeWayMatch,
          isValid: result.isValid,
          errors: result.errors,
          warnings: result.warnings
        }
      });
    } catch (error) {
      logger.error('Three-way matching failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to perform three-way matching'
        });
      }
    }
  }

  async getInvoiceStatus(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;

      const result = await invoiceProcessingService.getInvoiceProcessingStatus(invoiceId);

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
      logger.error('Get invoice status failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to get invoice status'
        });
      }
    }
  }

  async getInvoices(req: Request, res: Response): Promise<void> {
    try {
      const {
        vesselId,
        status,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build where clause
      const where: any = {};

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

      if (status) {
        where.status = status as InvoiceStatus;
      }

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const [invoices, total] = await Promise.all([
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

      res.json({
        success: true,
        data: {
          invoices,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total,
            pages: Math.ceil(total / parseInt(limit as string))
          }
        }
      });
    } catch (error) {
      logger.error('Get invoices failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to get invoices'
        });
      }
    }
  }

  async updateInvoiceStatus(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      const { status, notes } = req.body;

      if (!Object.values(InvoiceStatus).includes(status)) {
        throw new AppError('Invalid invoice status', 400, 'INVALID_STATUS');
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

      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status,
          notes: notes || invoice.notes
        },
        include: {
          purchaseOrder: {
            include: {
              vendor: true,
              vessel: true
            }
          }
        }
      });

      // Audit log
      await auditService.log({
        userId: req.user.id,
        action: 'UPDATE',
        resource: 'Invoice',
        resourceId: invoiceId,
        oldValues: { status: invoice.status },
        newValues: { status },
        vesselId: invoice.purchaseOrder.vesselId
      });

      logger.info(`Invoice status updated: ${invoice.invoiceNumber}`, {
        invoiceId,
        oldStatus: invoice.status,
        newStatus: status,
        userId: req.user.id
      });

      res.json({
        success: true,
        data: updatedInvoice
      });
    } catch (error) {
      logger.error('Update invoice status failed:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update invoice status'
        });
      }
    }
  }
}

export const invoiceController = new InvoiceController();
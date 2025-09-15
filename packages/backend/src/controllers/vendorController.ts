import { Request, Response, NextFunction } from 'express';
import { vendorService, VendorRegistrationData, VendorUpdateData, VendorPerformanceUpdate, VendorSearchFilters } from '../services/vendorService';
import { AppError } from '../utils/errors';
import { z } from 'zod';

// Validation schemas
const vendorRegistrationSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  code: z.string().min(1, 'Vendor code is required').max(20, 'Vendor code must be 20 characters or less'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  contactPersonName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
  taxId: z.string().optional(),
  registrationNumber: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditLimit: z.number().positive().optional(),
  creditLimitCurrency: z.string().optional(),
  serviceAreas: z.array(z.object({
    country: z.string(),
    region: z.string().optional(),
    ports: z.array(z.string())
  })).optional(),
  portCapabilities: z.array(z.object({
    portCode: z.string(),
    portName: z.string(),
    capabilities: z.array(z.string())
  })).optional(),
  certifications: z.array(z.object({
    certificationType: z.string(),
    certificateNumber: z.string(),
    issuedBy: z.string(),
    issueDate: z.string().transform(str => new Date(str)),
    expiryDate: z.string().transform(str => new Date(str)).optional(),
    documentUrl: z.string().url().optional()
  })).optional()
});

const vendorUpdateSchema = vendorRegistrationSchema.partial().extend({
  id: z.string().cuid()
});

const vendorPerformanceSchema = z.object({
  vendorId: z.string().cuid(),
  qualityRating: z.number().min(0).max(10).optional(),
  deliveryRating: z.number().min(0).max(10).optional(),
  priceRating: z.number().min(0).max(10).optional()
});

const vendorSearchSchema = z.object({
  country: z.string().optional(),
  region: z.string().optional(),
  portCode: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  minRating: z.number().min(0).max(10).optional(),
  isActive: z.boolean().optional(),
  isApproved: z.boolean().optional()
});

class VendorController {
  /**
   * Register a new vendor
   */
  async registerVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = vendorRegistrationSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const vendor = await vendorService.registerVendor(validatedData, userId);

      res.status(201).json({
        success: true,
        message: 'Vendor registered successfully',
        data: vendor
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update vendor information
   */
  async updateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const validatedData = vendorUpdateSchema.parse({ ...req.body, id: vendorId });
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const vendor = await vendorService.updateVendor(validatedData, userId);

      res.json({
        success: true,
        message: 'Vendor updated successfully',
        data: vendor
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vendor by ID
   */
  async getVendorById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const includeDecryptedBanking = req.query.includeBanking === 'true';

      const vendor = await vendorService.getVendorById(vendorId, includeDecryptedBanking);

      res.json({
        success: true,
        data: vendor
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search vendors with filters
   */
  async searchVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = vendorSearchSchema.parse(req.query);
      
      // Parse capabilities from comma-separated string if provided
      if (req.query.capabilities && typeof req.query.capabilities === 'string') {
        filters.capabilities = (req.query.capabilities as string).split(',');
      }

      const vendors = await vendorService.searchVendors(filters);

      res.json({
        success: true,
        data: vendors,
        count: vendors.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update vendor performance ratings
   */
  async updateVendorPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const validatedData = vendorPerformanceSchema.parse({ ...req.body, vendorId });
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const vendor = await vendorService.updateVendorPerformance(validatedData, userId);

      res.json({
        success: true,
        message: 'Vendor performance updated successfully',
        data: vendor
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve or reject vendor
   */
  async updateVendorApprovalStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const { isApproved } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      if (typeof isApproved !== 'boolean') {
        throw new AppError('isApproved must be a boolean', 400, 'INVALID_APPROVAL_STATUS');
      }

      const vendor = await vendorService.updateVendorApprovalStatus(vendorId, isApproved, userId);

      res.json({
        success: true,
        message: `Vendor ${isApproved ? 'approved' : 'rejected'} successfully`,
        data: vendor
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vendors by location and capabilities
   */
  async getVendorsByLocationAndCapabilities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { country, portCode, capabilities } = req.query;

      if (!country || typeof country !== 'string') {
        throw new AppError('Country is required', 400, 'COUNTRY_REQUIRED');
      }

      const capabilitiesArray = capabilities 
        ? (typeof capabilities === 'string' ? capabilities.split(',') : capabilities as string[])
        : undefined;

      const vendors = await vendorService.getVendorsByLocationAndCapabilities(
        country,
        portCode as string,
        capabilitiesArray
      );

      res.json({
        success: true,
        data: vendors,
        count: vendors.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vendor performance statistics
   */
  async getVendorPerformanceStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const stats = await vendorService.getVendorPerformanceStats(vendorId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all vendors (with pagination)
   */
  async getAllVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const filters: VendorSearchFilters = {};
      if (req.query.isActive !== undefined) {
        filters.isActive = req.query.isActive === 'true';
      }
      if (req.query.isApproved !== undefined) {
        filters.isApproved = req.query.isApproved === 'true';
      }

      const vendors = await vendorService.searchVendors(filters);
      const paginatedVendors = vendors.slice(skip, skip + limit);

      res.json({
        success: true,
        data: paginatedVendors,
        pagination: {
          page,
          limit,
          total: vendors.length,
          pages: Math.ceil(vendors.length / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get expiring vendor certifications
   */
  async getExpiringCertifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const daysAhead = parseInt(req.query.daysAhead as string) || 30;
      const certifications = await vendorService.getExpiringCertifications(daysAhead);

      res.json({
        success: true,
        data: certifications,
        count: certifications.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deactivate vendor
   */
  async deactivateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const vendor = await vendorService.updateVendor({ id: vendorId, isActive: false }, userId);

      res.json({
        success: true,
        message: 'Vendor deactivated successfully',
        data: vendor
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reactivate vendor
   */
  async reactivateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const vendor = await vendorService.updateVendor({ id: vendorId, isActive: true }, userId);

      res.json({
        success: true,
        message: 'Vendor reactivated successfully',
        data: vendor
      });
    } catch (error) {
      next(error);
    }
  }
}

export const vendorController = new VendorController();
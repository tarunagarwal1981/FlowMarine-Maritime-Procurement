import { Request, Response, NextFunction } from 'express';
import { vesselService } from '../services/vesselService.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

// Validation schemas
const createVesselSchema = z.object({
  name: z.string().min(1, 'Vessel name is required'),
  imoNumber: z.string().regex(/^\d{7}$/, 'IMO number must be 7 digits'),
  vesselType: z.string().min(1, 'Vessel type is required'),
  flag: z.string().min(1, 'Flag is required'),
  engineType: z.string().min(1, 'Engine type is required'),
  cargoCapacity: z.number().positive('Cargo capacity must be positive'),
  fuelConsumption: z.number().positive('Fuel consumption must be positive'),
  crewComplement: z.number().int().positive('Crew complement must be a positive integer'),
  currentLatitude: z.number().min(-90).max(90).optional(),
  currentLongitude: z.number().min(-180).max(180).optional(),
  currentDeparture: z.string().optional(),
  currentDestination: z.string().optional(),
  currentETA: z.string().datetime().optional(),
  currentRoute: z.string().optional(),
});

const updateVesselSchema = createVesselSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const positionUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: z.string().datetime().optional(),
});

const voyageUpdateSchema = z.object({
  departure: z.string().optional(),
  destination: z.string().optional(),
  eta: z.string().datetime().optional(),
  route: z.string().optional(),
});

const certificateSchema = z.object({
  certificateType: z.string().min(1, 'Certificate type is required'),
  certificateNumber: z.string().min(1, 'Certificate number is required'),
  issuedBy: z.string().min(1, 'Issuer is required'),
  issueDate: z.string().datetime(),
  expiryDate: z.string().datetime(),
  documentUrl: z.string().url().optional(),
});

const specificationSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  specification: z.string().min(1, 'Specification is required'),
  value: z.string().min(1, 'Value is required'),
  unit: z.string().optional(),
});

class VesselController {
  /**
   * Create a new vessel
   */
  async createVessel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = createVesselSchema.parse(req.body);
      
      // Convert string dates to Date objects
      const vesselData = {
        ...validatedData,
        currentETA: validatedData.currentETA ? new Date(validatedData.currentETA) : undefined,
      };

      const vessel = await vesselService.createVessel(vesselData, req.user!.id);

      res.status(201).json({
        success: true,
        data: vessel,
        message: 'Vessel created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get vessel by ID
   */
  async getVesselById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const vessel = await vesselService.getVesselById(id);

      if (!vessel) {
        res.status(404).json({
          success: false,
          error: 'Vessel not found',
        });
        return;
      }

      res.json({
        success: true,
        data: vessel,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vessel by IMO number
   */
  async getVesselByImoNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { imoNumber } = req.params;
      const vessel = await vesselService.getVesselByImoNumber(imoNumber);

      if (!vessel) {
        res.status(404).json({
          success: false,
          error: 'Vessel not found',
        });
        return;
      }

      res.json({
        success: true,
        data: vessel,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all vessels with filtering and pagination
   */
  async getVessels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = '1',
        limit = '50',
        vesselType,
        flag,
        isActive,
        search,
      } = req.query;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const options = {
        skip,
        take,
        vesselType: vesselType as string,
        flag: flag as string,
        isActive: isActive === 'false' ? false : true,
        search: search as string,
      };

      const result = await vesselService.getVessels(options);

      res.json({
        success: true,
        data: result.vessels,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          pages: Math.ceil(result.total / take),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update vessel information
   */
  async updateVessel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = updateVesselSchema.parse(req.body);

      // Convert string dates to Date objects
      const updateData = {
        ...validatedData,
        currentETA: validatedData.currentETA ? new Date(validatedData.currentETA) : undefined,
      };

      const vessel = await vesselService.updateVessel(id, updateData, req.user!.id);

      res.json({
        success: true,
        data: vessel,
        message: 'Vessel updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Update vessel position
   */
  async updateVesselPosition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = positionUpdateSchema.parse(req.body);

      const positionData = {
        ...validatedData,
        timestamp: validatedData.timestamp ? new Date(validatedData.timestamp) : undefined,
      };

      const vessel = await vesselService.updateVesselPosition(id, positionData, req.user!.id);

      res.json({
        success: true,
        data: {
          id: vessel.id,
          currentLatitude: vessel.currentLatitude,
          currentLongitude: vessel.currentLongitude,
          positionUpdatedAt: vessel.positionUpdatedAt,
        },
        message: 'Vessel position updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Update vessel voyage information
   */
  async updateVesselVoyage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = voyageUpdateSchema.parse(req.body);

      const voyageData = {
        ...validatedData,
        eta: validatedData.eta ? new Date(validatedData.eta) : undefined,
      };

      const vessel = await vesselService.updateVesselVoyage(id, voyageData, req.user!.id);

      res.json({
        success: true,
        data: {
          id: vessel.id,
          currentDeparture: vessel.currentDeparture,
          currentDestination: vessel.currentDestination,
          currentETA: vessel.currentETA,
          currentRoute: vessel.currentRoute,
        },
        message: 'Vessel voyage updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Add vessel certificate
   */
  async addVesselCertificate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = certificateSchema.parse(req.body);

      const certificateData = {
        vesselId: id,
        ...validatedData,
        issueDate: new Date(validatedData.issueDate),
        expiryDate: new Date(validatedData.expiryDate),
      };

      const certificate = await vesselService.addVesselCertificate(certificateData, req.user!.id);

      res.status(201).json({
        success: true,
        data: certificate,
        message: 'Certificate added successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Update vessel certificate
   */
  async updateVesselCertificate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { certificateId } = req.params;
      const validatedData = certificateSchema.partial().parse(req.body);

      const updateData = {
        ...validatedData,
        issueDate: validatedData.issueDate ? new Date(validatedData.issueDate) : undefined,
        expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : undefined,
      };

      const certificate = await vesselService.updateVesselCertificate(
        certificateId,
        updateData,
        req.user!.id
      );

      res.json({
        success: true,
        data: certificate,
        message: 'Certificate updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get expiring certificates
   */
  async getExpiringCertificates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { days = '30' } = req.query;
      const certificates = await vesselService.getExpiringCertificates(parseInt(days as string));

      res.json({
        success: true,
        data: certificates,
        message: `Found ${certificates.length} certificates expiring within ${days} days`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add vessel specification
   */
  async addVesselSpecification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = specificationSchema.parse(req.body);

      const specificationData = {
        vesselId: id,
        ...validatedData,
      };

      const specification = await vesselService.addVesselSpecification(specificationData, req.user!.id);

      res.status(201).json({
        success: true,
        data: specification,
        message: 'Specification added successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Update vessel specification
   */
  async updateVesselSpecification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { specificationId } = req.params;
      const validatedData = specificationSchema.partial().parse(req.body);

      const specification = await vesselService.updateVesselSpecification(
        specificationId,
        validatedData,
        req.user!.id
      );

      res.json({
        success: true,
        data: specification,
        message: 'Specification updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Delete vessel specification
   */
  async deleteVesselSpecification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { specificationId } = req.params;
      await vesselService.deleteVesselSpecification(specificationId, req.user!.id);

      res.json({
        success: true,
        message: 'Specification deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vessels accessible by current user
   */
  async getUserVessels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vessels = await vesselService.getVesselsByUser(req.user!.id);

      res.json({
        success: true,
        data: vessels,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deactivate vessel
   */
  async deactivateVessel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const vessel = await vesselService.deactivateVessel(id, req.user!.id);

      res.json({
        success: true,
        data: vessel,
        message: 'Vessel deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const vesselController = new VesselController();
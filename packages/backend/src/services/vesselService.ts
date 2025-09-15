import { PrismaClient, Vessel, VesselCertificate, VesselSpecification } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { auditService } from './auditService.js';

const prisma = new PrismaClient();

export interface VesselCreateData {
  name: string;
  imoNumber: string;
  vesselType: string;
  flag: string;
  engineType: string;
  cargoCapacity: number;
  fuelConsumption: number;
  crewComplement: number;
  currentLatitude?: number;
  currentLongitude?: number;
  currentDeparture?: string;
  currentDestination?: string;
  currentETA?: Date;
  currentRoute?: string;
}

export interface VesselUpdateData extends Partial<VesselCreateData> {
  isActive?: boolean;
}

export interface PositionUpdateData {
  latitude: number;
  longitude: number;
  timestamp?: Date;
}

export interface VoyageUpdateData {
  departure?: string;
  destination?: string;
  eta?: Date;
  route?: string;
}

export interface CertificateCreateData {
  vesselId: string;
  certificateType: string;
  certificateNumber: string;
  issuedBy: string;
  issueDate: Date;
  expiryDate: Date;
  documentUrl?: string;
}

export interface SpecificationCreateData {
  vesselId: string;
  category: string;
  specification: string;
  value: string;
  unit?: string;
}

class VesselService {
  /**
   * Create a new vessel with comprehensive data
   */
  async createVessel(data: VesselCreateData, userId: string): Promise<Vessel> {
    try {
      const vessel = await prisma.vessel.create({
        data: {
          ...data,
          positionUpdatedAt: data.currentLatitude && data.currentLongitude ? new Date() : undefined,
        },
        include: {
          certificates: true,
          specifications: true,
          assignments: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      await auditService.log({
        userId,
        action: 'CREATE',
        resource: 'vessel',
        resourceId: vessel.id,
        newValues: data,
      });

      logger.info('Vessel created successfully', {
        vesselId: vessel.id,
        imoNumber: vessel.imoNumber,
        userId,
      });

      return vessel;
    } catch (error) {
      logger.error('Failed to create vessel', { error, data, userId });
      throw error;
    }
  }

  /**
   * Get vessel by ID with all related data
   */
  async getVesselById(id: string): Promise<Vessel | null> {
    try {
      return await prisma.vessel.findUnique({
        where: { id },
        include: {
          certificates: {
            orderBy: { expiryDate: 'asc' },
          },
          specifications: {
            orderBy: { category: 'asc' },
          },
          assignments: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  email: true,
                },
              },
            },
          },
          requisitions: {
            where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] } },
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get vessel by ID', { error, id });
      throw error;
    }
  }

  /**
   * Get vessel by IMO number
   */
  async getVesselByImoNumber(imoNumber: string): Promise<Vessel | null> {
    try {
      return await prisma.vessel.findUnique({
        where: { imoNumber },
        include: {
          certificates: true,
          specifications: true,
          assignments: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get vessel by IMO number', { error, imoNumber });
      throw error;
    }
  }

  /**
   * Get all vessels with filtering and pagination
   */
  async getVessels(options: {
    skip?: number;
    take?: number;
    vesselType?: string;
    flag?: string;
    isActive?: boolean;
    search?: string;
  } = {}): Promise<{ vessels: Vessel[]; total: number }> {
    try {
      const { skip = 0, take = 50, vesselType, flag, isActive = true, search } = options;

      const where: any = { isActive };

      if (vesselType) {
        where.vesselType = vesselType;
      }

      if (flag) {
        where.flag = flag;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { imoNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [vessels, total] = await Promise.all([
        prisma.vessel.findMany({
          where,
          skip,
          take,
          include: {
            assignments: {
              where: { isActive: true },
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                  },
                },
              },
            },
            certificates: {
              where: {
                expiryDate: { gte: new Date() },
              },
              take: 5,
              orderBy: { expiryDate: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        }),
        prisma.vessel.count({ where }),
      ]);

      return { vessels, total };
    } catch (error) {
      logger.error('Failed to get vessels', { error, options });
      throw error;
    }
  }

  /**
   * Update vessel information
   */
  async updateVessel(id: string, data: VesselUpdateData, userId: string): Promise<Vessel> {
    try {
      const existingVessel = await prisma.vessel.findUnique({ where: { id } });
      if (!existingVessel) {
        throw new Error('Vessel not found');
      }

      const vessel = await prisma.vessel.update({
        where: { id },
        data,
        include: {
          certificates: true,
          specifications: true,
          assignments: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'vessel',
        resourceId: id,
        oldValues: existingVessel,
        newValues: data,
      });

      logger.info('Vessel updated successfully', { vesselId: id, userId });

      return vessel;
    } catch (error) {
      logger.error('Failed to update vessel', { error, id, data, userId });
      throw error;
    }
  }

  /**
   * Update vessel position with real-time tracking
   */
  async updateVesselPosition(id: string, positionData: PositionUpdateData, userId?: string): Promise<Vessel> {
    try {
      const vessel = await prisma.vessel.update({
        where: { id },
        data: {
          currentLatitude: positionData.latitude,
          currentLongitude: positionData.longitude,
          positionUpdatedAt: positionData.timestamp || new Date(),
        },
      });

      if (userId) {
        await auditService.log({
          userId,
          action: 'UPDATE',
          resource: 'vessel_position',
          resourceId: id,
          newValues: positionData,
        });
      }

      logger.info('Vessel position updated', {
        vesselId: id,
        latitude: positionData.latitude,
        longitude: positionData.longitude,
        userId,
      });

      return vessel;
    } catch (error) {
      logger.error('Failed to update vessel position', { error, id, positionData, userId });
      throw error;
    }
  }

  /**
   * Update vessel voyage information
   */
  async updateVesselVoyage(id: string, voyageData: VoyageUpdateData, userId: string): Promise<Vessel> {
    try {
      const existingVessel = await prisma.vessel.findUnique({ where: { id } });
      if (!existingVessel) {
        throw new Error('Vessel not found');
      }

      const vessel = await prisma.vessel.update({
        where: { id },
        data: {
          currentDeparture: voyageData.departure,
          currentDestination: voyageData.destination,
          currentETA: voyageData.eta,
          currentRoute: voyageData.route,
        },
        include: {
          certificates: true,
          specifications: true,
        },
      });

      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'vessel_voyage',
        resourceId: id,
        oldValues: {
          currentDeparture: existingVessel.currentDeparture,
          currentDestination: existingVessel.currentDestination,
          currentETA: existingVessel.currentETA,
          currentRoute: existingVessel.currentRoute,
        },
        newValues: voyageData,
      });

      logger.info('Vessel voyage updated', { vesselId: id, userId });

      return vessel;
    } catch (error) {
      logger.error('Failed to update vessel voyage', { error, id, voyageData, userId });
      throw error;
    }
  }

  /**
   * Add vessel certificate
   */
  async addVesselCertificate(data: CertificateCreateData, userId: string): Promise<VesselCertificate> {
    try {
      const certificate = await prisma.vesselCertificate.create({
        data,
      });

      await auditService.log({
        userId,
        action: 'CREATE',
        resource: 'vessel_certificate',
        resourceId: certificate.id,
        newValues: data,
        vesselId: data.vesselId,
      });

      logger.info('Vessel certificate added', {
        certificateId: certificate.id,
        vesselId: data.vesselId,
        userId,
      });

      return certificate;
    } catch (error) {
      logger.error('Failed to add vessel certificate', { error, data, userId });
      throw error;
    }
  }

  /**
   * Update vessel certificate
   */
  async updateVesselCertificate(
    id: string,
    data: Partial<CertificateCreateData>,
    userId: string
  ): Promise<VesselCertificate> {
    try {
      const existingCertificate = await prisma.vesselCertificate.findUnique({ where: { id } });
      if (!existingCertificate) {
        throw new Error('Certificate not found');
      }

      const certificate = await prisma.vesselCertificate.update({
        where: { id },
        data,
      });

      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'vessel_certificate',
        resourceId: id,
        oldValues: existingCertificate,
        newValues: data,
        vesselId: existingCertificate.vesselId,
      });

      logger.info('Vessel certificate updated', { certificateId: id, userId });

      return certificate;
    } catch (error) {
      logger.error('Failed to update vessel certificate', { error, id, data, userId });
      throw error;
    }
  }

  /**
   * Get expiring certificates (within specified days)
   */
  async getExpiringCertificates(days: number = 30): Promise<VesselCertificate[]> {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);

      return await prisma.vesselCertificate.findMany({
        where: {
          expiryDate: {
            lte: expiryDate,
            gte: new Date(),
          },
        },
        include: {
          vessel: {
            select: {
              id: true,
              name: true,
              imoNumber: true,
            },
          },
        },
        orderBy: { expiryDate: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to get expiring certificates', { error, days });
      throw error;
    }
  }

  /**
   * Add vessel specification
   */
  async addVesselSpecification(data: SpecificationCreateData, userId: string): Promise<VesselSpecification> {
    try {
      const specification = await prisma.vesselSpecification.create({
        data,
      });

      await auditService.log({
        userId,
        action: 'CREATE',
        resource: 'vessel_specification',
        resourceId: specification.id,
        newValues: data,
        vesselId: data.vesselId,
      });

      logger.info('Vessel specification added', {
        specificationId: specification.id,
        vesselId: data.vesselId,
        userId,
      });

      return specification;
    } catch (error) {
      logger.error('Failed to add vessel specification', { error, data, userId });
      throw error;
    }
  }

  /**
   * Update vessel specification
   */
  async updateVesselSpecification(
    id: string,
    data: Partial<SpecificationCreateData>,
    userId: string
  ): Promise<VesselSpecification> {
    try {
      const existingSpecification = await prisma.vesselSpecification.findUnique({ where: { id } });
      if (!existingSpecification) {
        throw new Error('Specification not found');
      }

      const specification = await prisma.vesselSpecification.update({
        where: { id },
        data,
      });

      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'vessel_specification',
        resourceId: id,
        oldValues: existingSpecification,
        newValues: data,
        vesselId: existingSpecification.vesselId,
      });

      logger.info('Vessel specification updated', { specificationId: id, userId });

      return specification;
    } catch (error) {
      logger.error('Failed to update vessel specification', { error, id, data, userId });
      throw error;
    }
  }

  /**
   * Delete vessel specification
   */
  async deleteVesselSpecification(id: string, userId: string): Promise<void> {
    try {
      const existingSpecification = await prisma.vesselSpecification.findUnique({ where: { id } });
      if (!existingSpecification) {
        throw new Error('Specification not found');
      }

      await prisma.vesselSpecification.delete({ where: { id } });

      await auditService.log({
        userId,
        action: 'DELETE',
        resource: 'vessel_specification',
        resourceId: id,
        oldValues: existingSpecification,
        vesselId: existingSpecification.vesselId,
      });

      logger.info('Vessel specification deleted', { specificationId: id, userId });
    } catch (error) {
      logger.error('Failed to delete vessel specification', { error, id, userId });
      throw error;
    }
  }

  /**
   * Get vessels by user access (for vessel access control)
   */
  async getVesselsByUser(userId: string): Promise<Vessel[]> {
    try {
      return await prisma.vessel.findMany({
        where: {
          assignments: {
            some: {
              userId,
              isActive: true,
            },
          },
        },
        include: {
          certificates: {
            where: {
              expiryDate: { gte: new Date() },
            },
            take: 3,
            orderBy: { expiryDate: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to get vessels by user', { error, userId });
      throw error;
    }
  }

  /**
   * Deactivate vessel (soft delete)
   */
  async deactivateVessel(id: string, userId: string): Promise<Vessel> {
    try {
      const vessel = await this.updateVessel(id, { isActive: false }, userId);
      
      logger.info('Vessel deactivated', { vesselId: id, userId });
      
      return vessel;
    } catch (error) {
      logger.error('Failed to deactivate vessel', { error, id, userId });
      throw error;
    }
  }
}

export const vesselService = new VesselService();
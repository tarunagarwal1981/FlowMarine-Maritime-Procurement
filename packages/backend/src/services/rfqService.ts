import { PrismaClient, RFQ, RFQStatus, Vendor, Requisition, Quote } from '@prisma/client';
import { AppError } from '../utils/errors';
import { auditService } from './auditService';
import { vendorService } from './vendorService';
import { emailService } from './emailService';

const prisma = new PrismaClient();

export interface RFQCreationData {
  requisitionId: string;
  title: string;
  description?: string;
  currency?: string;
  deliveryLocation?: string;
  deliveryDate?: Date;
  responseDeadline?: Date;
  vendorSelectionCriteria?: {
    countries?: string[];
    regions?: string[];
    portCodes?: string[];
    capabilities?: string[];
    minRating?: number;
    maxVendors?: number;
  };
}

export interface RFQUpdateData {
  id: string;
  title?: string;
  description?: string;
  deliveryLocation?: string;
  deliveryDate?: Date;
  responseDeadline?: Date;
  status?: RFQStatus;
}

export interface VendorSelectionResult {
  selectedVendors: Vendor[];
  selectionCriteria: any;
  totalEligibleVendors: number;
}

export interface RFQDistributionResult {
  rfqId: string;
  sentToVendors: string[];
  failedVendors: string[];
  totalSent: number;
}

class RFQService {
  /**
   * Create RFQ from approved requisition
   */
  async createRFQFromRequisition(data: RFQCreationData, userId: string): Promise<RFQ> {
    try {
      // Validate requisition exists and is approved
      const requisition = await prisma.requisition.findUnique({
        where: { id: data.requisitionId },
        include: {
          vessel: true,
          items: {
            include: {
              itemCatalog: true
            }
          }
        }
      });

      if (!requisition) {
        throw new AppError('Requisition not found', 404, 'REQUISITION_NOT_FOUND');
      }

      if (requisition.status !== 'APPROVED') {
        throw new AppError('Only approved requisitions can be converted to RFQ', 400, 'REQUISITION_NOT_APPROVED');
      }

      // Check if RFQ already exists for this requisition
      const existingRFQ = await prisma.rFQ.findFirst({
        where: { requisitionId: data.requisitionId }
      });

      if (existingRFQ) {
        throw new AppError('RFQ already exists for this requisition', 400, 'RFQ_ALREADY_EXISTS');
      }

      // Generate RFQ number
      const rfqNumber = await this.generateRFQNumber();

      // Set default response deadline if not provided (7 days from now)
      const responseDeadline = data.responseDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Create RFQ
      const rfq = await prisma.$transaction(async (tx) => {
        const newRFQ = await tx.rFQ.create({
          data: {
            rfqNumber,
            requisitionId: data.requisitionId,
            title: data.title,
            description: data.description,
            currency: data.currency || requisition.currency,
            deliveryLocation: data.deliveryLocation || requisition.deliveryLocation,
            deliveryDate: data.deliveryDate || requisition.deliveryDate,
            responseDeadline,
            status: 'DRAFT',
            issueDate: new Date()
          }
        });

        // Update requisition status
        await tx.requisition.update({
          where: { id: data.requisitionId },
          data: { status: 'CONVERTED_TO_RFQ' }
        });

        return newRFQ;
      });

      // Audit log
      await auditService.log({
        userId,
        action: 'CREATE',
        resource: 'rfq',
        resourceId: rfq.id,
        newValues: rfq,
        metadata: { requisitionId: data.requisitionId }
      });

      return rfq;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create RFQ from requisition', 500, 'RFQ_CREATION_FAILED');
    }
  }

  /**
   * Select vendors for RFQ based on criteria
   */
  async selectVendorsForRFQ(rfqId: string, criteria?: any): Promise<VendorSelectionResult> {
    try {
      const rfq = await prisma.rFQ.findUnique({
        where: { id: rfqId },
        include: {
          requisition: {
            include: {
              vessel: true,
              items: {
                include: {
                  itemCatalog: true
                }
              }
            }
          }
        }
      });

      if (!rfq) {
        throw new AppError('RFQ not found', 404, 'RFQ_NOT_FOUND');
      }

      // Determine selection criteria
      const selectionCriteria = criteria || this.buildDefaultSelectionCriteria(rfq);

      // Get eligible vendors based on criteria
      const eligibleVendors = await this.getEligibleVendors(rfq, selectionCriteria);

      // Score and rank vendors
      const scoredVendors = await this.scoreVendors(eligibleVendors, rfq, selectionCriteria);

      // Select top vendors based on maxVendors limit
      const maxVendors = selectionCriteria.maxVendors || 5;
      const selectedVendors = scoredVendors.slice(0, maxVendors);

      return {
        selectedVendors,
        selectionCriteria,
        totalEligibleVendors: eligibleVendors.length
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to select vendors for RFQ', 500, 'VENDOR_SELECTION_FAILED');
    }
  }

  /**
   * Distribute RFQ to selected vendors
   */
  async distributeRFQ(rfqId: string, vendorIds: string[], userId: string): Promise<RFQDistributionResult> {
    try {
      const rfq = await prisma.rFQ.findUnique({
        where: { id: rfqId },
        include: {
          requisition: {
            include: {
              vessel: true,
              items: {
                include: {
                  itemCatalog: true
                }
              }
            }
          }
        }
      });

      if (!rfq) {
        throw new AppError('RFQ not found', 404, 'RFQ_NOT_FOUND');
      }

      if (rfq.status !== 'DRAFT') {
        throw new AppError('RFQ must be in draft status to distribute', 400, 'INVALID_RFQ_STATUS');
      }

      // Validate vendors exist and are active
      const vendors = await prisma.vendor.findMany({
        where: {
          id: { in: vendorIds },
          isActive: true,
          isApproved: true
        }
      });

      if (vendors.length !== vendorIds.length) {
        throw new AppError('Some vendors are not found or not active', 400, 'INVALID_VENDORS');
      }

      const sentToVendors: string[] = [];
      const failedVendors: string[] = [];

      // Create RFQ-Vendor relationships and send notifications
      await prisma.$transaction(async (tx) => {
        // Create RFQ-Vendor relationships
        const rfqVendorData = vendorIds.map(vendorId => ({
          rfqId,
          vendorId,
          sentAt: new Date()
        }));

        await tx.rFQVendor.createMany({
          data: rfqVendorData
        });

        // Update RFQ status
        await tx.rFQ.update({
          where: { id: rfqId },
          data: { status: 'SENT' }
        });

        // Send email notifications to vendors
        for (const vendor of vendors) {
          try {
            await this.sendRFQNotification(rfq, vendor);
            sentToVendors.push(vendor.id);
          } catch (error) {
            console.error(`Failed to send RFQ notification to vendor ${vendor.id}:`, error);
            failedVendors.push(vendor.id);
          }
        }
      });

      // Audit log
      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'rfq_distribution',
        resourceId: rfqId,
        newValues: {
          status: 'SENT',
          vendorIds,
          sentToVendors,
          failedVendors
        }
      });

      return {
        rfqId,
        sentToVendors,
        failedVendors,
        totalSent: sentToVendors.length
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to distribute RFQ', 500, 'RFQ_DISTRIBUTION_FAILED');
    }
  }

  /**
   * Get RFQ by ID with related data
   */
  async getRFQById(id: string): Promise<any> {
    try {
      const rfq = await prisma.rFQ.findUnique({
        where: { id },
        include: {
          requisition: {
            include: {
              vessel: true,
              items: {
                include: {
                  itemCatalog: true
                }
              }
            }
          },
          vendors: {
            include: {
              vendor: {
                include: {
                  serviceAreas: true,
                  portCapabilities: true
                }
              }
            }
          },
          quotes: {
            include: {
              vendor: true,
              lineItems: {
                include: {
                  itemCatalog: true
                }
              }
            }
          }
        }
      });

      if (!rfq) {
        throw new AppError('RFQ not found', 404, 'RFQ_NOT_FOUND');
      }

      return rfq;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get RFQ', 500, 'RFQ_FETCH_FAILED');
    }
  }

  /**
   * Update RFQ
   */
  async updateRFQ(data: RFQUpdateData, userId: string): Promise<RFQ> {
    try {
      const existingRFQ = await prisma.rFQ.findUnique({
        where: { id: data.id }
      });

      if (!existingRFQ) {
        throw new AppError('RFQ not found', 404, 'RFQ_NOT_FOUND');
      }

      const updatedRFQ = await prisma.rFQ.update({
        where: { id: data.id },
        data: {
          title: data.title,
          description: data.description,
          deliveryLocation: data.deliveryLocation,
          deliveryDate: data.deliveryDate,
          responseDeadline: data.responseDeadline,
          status: data.status
        }
      });

      // Audit log
      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'rfq',
        resourceId: data.id,
        oldValues: existingRFQ,
        newValues: updatedRFQ
      });

      return updatedRFQ;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update RFQ', 500, 'RFQ_UPDATE_FAILED');
    }
  }

  /**
   * Get RFQs with filters
   */
  async getRFQs(filters: {
    status?: RFQStatus;
    vesselId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<RFQ[]> {
    try {
      const whereClause: any = {};

      if (filters.status) {
        whereClause.status = filters.status;
      }

      if (filters.vesselId) {
        whereClause.requisition = {
          vesselId: filters.vesselId
        };
      }

      if (filters.dateFrom || filters.dateTo) {
        whereClause.createdAt = {};
        if (filters.dateFrom) {
          whereClause.createdAt.gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          whereClause.createdAt.lte = filters.dateTo;
        }
      }

      const rfqs = await prisma.rFQ.findMany({
        where: whereClause,
        include: {
          requisition: {
            include: {
              vessel: true
            }
          },
          vendors: {
            include: {
              vendor: true
            }
          },
          quotes: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return rfqs;
    } catch (error) {
      throw new AppError('Failed to get RFQs', 500, 'RFQ_FETCH_FAILED');
    }
  }

  /**
   * Cancel RFQ
   */
  async cancelRFQ(rfqId: string, reason: string, userId: string): Promise<RFQ> {
    try {
      const rfq = await prisma.rFQ.findUnique({
        where: { id: rfqId }
      });

      if (!rfq) {
        throw new AppError('RFQ not found', 404, 'RFQ_NOT_FOUND');
      }

      if (rfq.status === 'CANCELLED') {
        throw new AppError('RFQ is already cancelled', 400, 'RFQ_ALREADY_CANCELLED');
      }

      const updatedRFQ = await prisma.rFQ.update({
        where: { id: rfqId },
        data: { status: 'CANCELLED' }
      });

      // Audit log
      await auditService.log({
        userId,
        action: 'UPDATE',
        resource: 'rfq_cancellation',
        resourceId: rfqId,
        oldValues: { status: rfq.status },
        newValues: { status: 'CANCELLED', reason }
      });

      return updatedRFQ;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to cancel RFQ', 500, 'RFQ_CANCELLATION_FAILED');
    }
  }

  // Private helper methods

  private async generateRFQNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.rFQ.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`)
        }
      }
    });
    return `RFQ-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private buildDefaultSelectionCriteria(rfq: any): any {
    const vessel = rfq.requisition.vessel;
    const deliveryLocation = rfq.deliveryLocation || rfq.requisition.deliveryLocation;

    // Extract country and port from delivery location
    const locationParts = deliveryLocation?.split(',') || [];
    const country = locationParts[locationParts.length - 1]?.trim();
    const portCode = this.extractPortCode(deliveryLocation);

    return {
      countries: country ? [country] : [],
      portCodes: portCode ? [portCode] : [],
      capabilities: ['delivery'],
      minRating: 6.0,
      maxVendors: 5
    };
  }

  private async getEligibleVendors(rfq: any, criteria: any): Promise<Vendor[]> {
    const whereClause: any = {
      isActive: true,
      isApproved: true
    };

    if (criteria.minRating) {
      whereClause.overallScore = { gte: criteria.minRating };
    }

    if (criteria.countries && criteria.countries.length > 0) {
      whereClause.serviceAreas = {
        some: {
          country: { in: criteria.countries }
        }
      };
    }

    if (criteria.portCodes && criteria.portCodes.length > 0) {
      whereClause.serviceAreas = {
        ...whereClause.serviceAreas,
        some: {
          ...whereClause.serviceAreas?.some,
          ports: { hasSome: criteria.portCodes }
        }
      };
    }

    if (criteria.capabilities && criteria.capabilities.length > 0) {
      whereClause.portCapabilities = {
        some: {
          capabilities: { hasSome: criteria.capabilities }
        }
      };
    }

    return await prisma.vendor.findMany({
      where: whereClause,
      include: {
        serviceAreas: true,
        portCapabilities: true,
        certifications: true
      }
    });
  }

  private async scoreVendors(vendors: Vendor[], rfq: any, criteria: any): Promise<Vendor[]> {
    // Score vendors based on:
    // - Overall performance score (40%)
    // - Location proximity (30%)
    // - Capability match (20%)
    // - Past performance with similar items (10%)

    const scoredVendors = vendors.map(vendor => {
      const performanceScore = vendor.overallScore || 0;
      const locationScore = this.calculateLocationScore(vendor, rfq, criteria);
      const capabilityScore = this.calculateCapabilityScore(vendor, criteria);
      const historyScore = 5; // Placeholder - would calculate based on past orders

      const totalScore = (
        (performanceScore * 0.4) +
        (locationScore * 0.3) +
        (capabilityScore * 0.2) +
        (historyScore * 0.1)
      );

      return {
        ...vendor,
        selectionScore: totalScore
      };
    });

    // Sort by selection score descending
    return scoredVendors.sort((a, b) => (b as any).selectionScore - (a as any).selectionScore);
  }

  private calculateLocationScore(vendor: any, rfq: any, criteria: any): number {
    // Calculate location score based on service areas and port capabilities
    let score = 0;

    if (criteria.countries) {
      const hasCountryMatch = vendor.serviceAreas.some((area: any) => 
        criteria.countries.includes(area.country)
      );
      if (hasCountryMatch) score += 5;
    }

    if (criteria.portCodes) {
      const hasPortMatch = vendor.serviceAreas.some((area: any) => 
        area.ports.some((port: string) => criteria.portCodes.includes(port))
      );
      if (hasPortMatch) score += 5;
    }

    return Math.min(score, 10);
  }

  private calculateCapabilityScore(vendor: any, criteria: any): number {
    if (!criteria.capabilities || criteria.capabilities.length === 0) {
      return 10;
    }

    const vendorCapabilities = vendor.portCapabilities.flatMap((pc: any) => pc.capabilities);
    const matchingCapabilities = criteria.capabilities.filter((cap: string) => 
      vendorCapabilities.includes(cap)
    );

    return (matchingCapabilities.length / criteria.capabilities.length) * 10;
  }

  private extractPortCode(location?: string): string | null {
    if (!location) return null;
    
    // Simple port code extraction - in real implementation, would use port database
    const portCodeMatch = location.match(/([A-Z]{5})/);
    return portCodeMatch ? portCodeMatch[1] : null;
  }

  private async sendRFQNotification(rfq: any, vendor: Vendor): Promise<void> {
    if (!vendor.contactEmail && !vendor.email) {
      throw new Error('Vendor has no email address');
    }

    const emailAddress = vendor.contactEmail || vendor.email;
    const subject = `New RFQ: ${rfq.title} - ${rfq.rfqNumber}`;
    
    const emailBody = `
      Dear ${vendor.contactPersonName || vendor.name},

      You have received a new Request for Quotation (RFQ) from FlowMarine.

      RFQ Details:
      - RFQ Number: ${rfq.rfqNumber}
      - Title: ${rfq.title}
      - Vessel: ${rfq.requisition.vessel.name}
      - Delivery Location: ${rfq.deliveryLocation}
      - Delivery Date: ${rfq.deliveryDate ? rfq.deliveryDate.toDateString() : 'TBD'}
      - Response Deadline: ${rfq.responseDeadline.toDateString()}

      Please log in to the FlowMarine vendor portal to view the complete RFQ details and submit your quotation.

      Best regards,
      FlowMarine Procurement Team
    `;

    await emailService.sendEmail({
      to: emailAddress!,
      subject,
      body: emailBody,
      type: 'rfq_notification'
    });
  }
}

export const rfqService = new RFQService();
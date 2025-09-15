/**
 * Requisition Service
 * Handles business logic for requisition management including creation, validation, and approval routing
 */

import { PrismaClient, Requisition, RequisitionStatus, UrgencyLevel, Vessel, User } from '@prisma/client';
import { auditService } from './auditService';
import { vesselService } from './vesselService';
import { itemCatalogService } from './itemCatalogService';
import { AppError } from '../utils/errors';

const prisma = new PrismaClient();

export interface CreateRequisitionData {
  vesselId: string;
  urgencyLevel: UrgencyLevel;
  totalAmount: number;
  currency: string;
  deliveryLocation?: string;
  deliveryDate?: Date;
  justification?: string;
  items: CreateRequisitionItemData[];
}

export interface CreateRequisitionItemData {
  itemCatalogId: string;
  quantity: number;
  unitPrice: number;
  urgencyLevel: UrgencyLevel;
  justification?: string;
  specifications?: Record<string, any>;
}

export interface RequisitionFilters {
  vesselId?: string;
  status?: RequisitionStatus;
  urgencyLevel?: UrgencyLevel;
  dateFrom?: Date;
  dateTo?: Date;
  requestedById?: string;
}

export interface RequisitionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  budgetValidation?: {
    withinBudget: boolean;
    availableBudget: number;
    requestedAmount: number;
  };
}

class RequisitionService {
  /**
   * Create a new requisition with validation
   */
  async createRequisition(
    data: CreateRequisitionData,
    requestedById: string
  ): Promise<Requisition> {
    // Validate vessel access
    const vessel = await vesselService.getVesselById(data.vesselId);
    if (!vessel) {
      throw new AppError('Vessel not found', 404, 'VESSEL_NOT_FOUND');
    }

    // Validate user has access to vessel
    const hasAccess = await vesselService.validateUserVesselAccess(requestedById, data.vesselId);
    if (!hasAccess) {
      throw new AppError('Access denied to vessel', 403, 'VESSEL_ACCESS_DENIED');
    }

    // Validate requisition data
    const validation = await this.validateRequisition(data, vessel);
    if (!validation.isValid) {
      throw new AppError(
        `Validation failed: ${validation.errors.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }

    // Generate requisition number
    const requisitionNumber = await this.generateRequisitionNumber(data.vesselId);

    // Create requisition with items
    const requisition = await prisma.requisition.create({
      data: {
        requisitionNumber,
        vesselId: data.vesselId,
        requestedById,
        urgencyLevel: data.urgencyLevel,
        status: RequisitionStatus.DRAFT,
        totalAmount: data.totalAmount,
        currency: data.currency,
        deliveryLocation: data.deliveryLocation,
        deliveryDate: data.deliveryDate,
        justification: data.justification,
        items: {
          create: data.items.map(item => ({
            itemCatalogId: item.itemCatalogId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            urgencyLevel: item.urgencyLevel,
            justification: item.justification,
            specifications: item.specifications
          }))
        }
      },
      include: {
        items: {
          include: {
            itemCatalog: true
          }
        },
        vessel: true,
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Log audit event
    await auditService.logEvent({
      userId: requestedById,
      action: 'REQUISITION_CREATED',
      resourceType: 'REQUISITION',
      resourceId: requisition.id,
      details: {
        requisitionNumber: requisition.requisitionNumber,
        vesselId: data.vesselId,
        totalAmount: data.totalAmount,
        currency: data.currency,
        itemCount: data.items.length
      }
    });

    return requisition;
  }

  /**
   * Get requisitions with filtering and pagination
   */
  async getRequisitions(
    filters: RequisitionFilters = {},
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    // Get user's accessible vessels
    const userVessels = await vesselService.getUserVessels(userId);
    const vesselIds = userVessels.map(v => v.id);

    const where: any = {
      vesselId: {
        in: vesselIds
      }
    };

    // Apply filters
    if (filters.vesselId) {
      where.vesselId = filters.vesselId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.urgencyLevel) {
      where.urgencyLevel = filters.urgencyLevel;
    }
    if (filters.requestedById) {
      where.requestedById = filters.requestedById;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo;
      }
    }

    const [requisitions, total] = await Promise.all([
      prisma.requisition.findMany({
        where,
        include: {
          items: {
            include: {
              itemCatalog: true
            }
          },
          vessel: true,
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          approvals: {
            include: {
              approver: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.requisition.count({ where })
    ]);

    return {
      requisitions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get a single requisition by ID
   */
  async getRequisitionById(id: string, userId: string): Promise<Requisition | null> {
    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            itemCatalog: true
          }
        },
        vessel: true,
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!requisition) {
      return null;
    }

    // Validate user has access to this requisition's vessel
    const hasAccess = await vesselService.validateUserVesselAccess(userId, requisition.vesselId);
    if (!hasAccess) {
      throw new AppError('Access denied to requisition', 403, 'REQUISITION_ACCESS_DENIED');
    }

    return requisition;
  }

  /**
   * Update a requisition (only if in DRAFT status)
   */
  async updateRequisition(
    id: string,
    updates: Partial<CreateRequisitionData>,
    userId: string
  ): Promise<Requisition> {
    const existingRequisition = await this.getRequisitionById(id, userId);
    if (!existingRequisition) {
      throw new AppError('Requisition not found', 404, 'REQUISITION_NOT_FOUND');
    }

    if (existingRequisition.status !== RequisitionStatus.DRAFT) {
      throw new AppError(
        'Can only update requisitions in DRAFT status',
        400,
        'INVALID_STATUS_FOR_UPDATE'
      );
    }

    // If updating items, validate them
    if (updates.items) {
      const vessel = await vesselService.getVesselById(existingRequisition.vesselId);
      const validation = await this.validateRequisition(
        { ...existingRequisition, ...updates } as CreateRequisitionData,
        vessel!
      );
      
      if (!validation.isValid) {
        throw new AppError(
          `Validation failed: ${validation.errors.join(', ')}`,
          400,
          'VALIDATION_ERROR'
        );
      }
    }

    // Update requisition
    const updatedRequisition = await prisma.requisition.update({
      where: { id },
      data: {
        urgencyLevel: updates.urgencyLevel,
        totalAmount: updates.totalAmount,
        currency: updates.currency,
        deliveryLocation: updates.deliveryLocation,
        deliveryDate: updates.deliveryDate,
        justification: updates.justification,
        ...(updates.items && {
          items: {
            deleteMany: {},
            create: updates.items.map(item => ({
              itemCatalogId: item.itemCatalogId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              urgencyLevel: item.urgencyLevel,
              justification: item.justification,
              specifications: item.specifications
            }))
          }
        })
      },
      include: {
        items: {
          include: {
            itemCatalog: true
          }
        },
        vessel: true,
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Log audit event
    await auditService.logEvent({
      userId,
      action: 'REQUISITION_UPDATED',
      resourceType: 'REQUISITION',
      resourceId: id,
      details: {
        updates: Object.keys(updates)
      }
    });

    return updatedRequisition;
  }

  /**
   * Submit requisition for approval
   */
  async submitRequisition(id: string, userId: string): Promise<Requisition> {
    const requisition = await this.getRequisitionById(id, userId);
    if (!requisition) {
      throw new AppError('Requisition not found', 404, 'REQUISITION_NOT_FOUND');
    }

    if (requisition.status !== RequisitionStatus.DRAFT) {
      throw new AppError(
        'Can only submit requisitions in DRAFT status',
        400,
        'INVALID_STATUS_FOR_SUBMISSION'
      );
    }

    // Update status to PENDING_APPROVAL
    const updatedRequisition = await prisma.requisition.update({
      where: { id },
      data: {
        status: RequisitionStatus.PENDING_APPROVAL,
        submittedAt: new Date()
      },
      include: {
        items: {
          include: {
            itemCatalog: true
          }
        },
        vessel: true,
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Log audit event
    await auditService.logEvent({
      userId,
      action: 'REQUISITION_SUBMITTED',
      resourceType: 'REQUISITION',
      resourceId: id,
      details: {
        requisitionNumber: requisition.requisitionNumber,
        totalAmount: requisition.totalAmount
      }
    });

    return updatedRequisition;
  }

  /**
   * Validate requisition against vessel specifications and business rules
   */
  private async validateRequisition(
    data: CreateRequisitionData,
    vessel: Vessel
  ): Promise<RequisitionValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!data.items || data.items.length === 0) {
      errors.push('Requisition must have at least one item');
    }

    if (data.totalAmount <= 0) {
      errors.push('Total amount must be greater than zero');
    }

    // Validate items
    for (const item of data.items) {
      if (item.quantity <= 0) {
        errors.push('Item quantities must be greater than zero');
      }

      if (item.unitPrice < 0) {
        errors.push('Item unit prices cannot be negative');
      }

      // Validate item exists and is compatible with vessel
      const catalogItem = await itemCatalogService.getItemById(item.itemCatalogId);
      if (!catalogItem) {
        errors.push(`Item with ID ${item.itemCatalogId} not found`);
        continue;
      }

      // Check vessel compatibility
      const isCompatible = catalogItem.compatibleVesselTypes.includes(vessel.vesselType) ||
                          catalogItem.compatibleEngineTypes.includes(vessel.engineType);
      
      if (!isCompatible) {
        warnings.push(
          `Item "${catalogItem.name}" may not be compatible with vessel type ${vessel.vesselType} or engine type ${vessel.engineType}`
        );
      }

      // Check criticality vs urgency alignment
      if (catalogItem.criticalityLevel === 'SAFETY_CRITICAL' && item.urgencyLevel === 'ROUTINE') {
        warnings.push(
          `Safety critical item "${catalogItem.name}" marked as routine urgency`
        );
      }
    }

    // Validate delivery requirements
    if (data.urgencyLevel === 'EMERGENCY' && !data.justification) {
      errors.push('Emergency requisitions require justification');
    }

    if (data.deliveryDate && data.deliveryDate < new Date()) {
      errors.push('Delivery date cannot be in the past');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate unique requisition number
   */
  private async generateRequisitionNumber(vesselId: string): Promise<string> {
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      select: { name: true }
    });

    const year = new Date().getFullYear();
    const vesselCode = vessel?.name.substring(0, 3).toUpperCase() || 'VES';
    
    // Get next sequence number for this vessel and year
    const lastRequisition = await prisma.requisition.findFirst({
      where: {
        vesselId,
        requisitionNumber: {
          startsWith: `${vesselCode}-${year}-`
        }
      },
      orderBy: {
        requisitionNumber: 'desc'
      }
    });

    let sequence = 1;
    if (lastRequisition) {
      const lastSequence = parseInt(lastRequisition.requisitionNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    return `${vesselCode}-${year}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Delete a requisition (only if in DRAFT status)
   */
  async deleteRequisition(id: string, userId: string): Promise<void> {
    const requisition = await this.getRequisitionById(id, userId);
    if (!requisition) {
      throw new AppError('Requisition not found', 404, 'REQUISITION_NOT_FOUND');
    }

    if (requisition.status !== RequisitionStatus.DRAFT) {
      throw new AppError(
        'Can only delete requisitions in DRAFT status',
        400,
        'INVALID_STATUS_FOR_DELETION'
      );
    }

    await prisma.requisition.delete({
      where: { id }
    });

    // Log audit event
    await auditService.logEvent({
      userId,
      action: 'REQUISITION_DELETED',
      resourceType: 'REQUISITION',
      resourceId: id,
      details: {
        requisitionNumber: requisition.requisitionNumber
      }
    });
  }

  /**
   * Get requisition statistics for dashboard
   */
  async getRequisitionStats(userId: string, vesselId?: string) {
    const userVessels = await vesselService.getUserVessels(userId);
    const vesselIds = vesselId ? [vesselId] : userVessels.map(v => v.id);

    const [
      totalCount,
      draftCount,
      pendingCount,
      approvedCount,
      emergencyCount,
      totalValue
    ] = await Promise.all([
      prisma.requisition.count({
        where: { vesselId: { in: vesselIds } }
      }),
      prisma.requisition.count({
        where: { 
          vesselId: { in: vesselIds },
          status: RequisitionStatus.DRAFT
        }
      }),
      prisma.requisition.count({
        where: { 
          vesselId: { in: vesselIds },
          status: RequisitionStatus.PENDING_APPROVAL
        }
      }),
      prisma.requisition.count({
        where: { 
          vesselId: { in: vesselIds },
          status: RequisitionStatus.APPROVED
        }
      }),
      prisma.requisition.count({
        where: { 
          vesselId: { in: vesselIds },
          urgencyLevel: UrgencyLevel.EMERGENCY
        }
      }),
      prisma.requisition.aggregate({
        where: { vesselId: { in: vesselIds } },
        _sum: { totalAmount: true }
      })
    ]);

    return {
      totalCount,
      draftCount,
      pendingCount,
      approvedCount,
      emergencyCount,
      totalValue: totalValue._sum.totalAmount || 0
    };
  }
}

export const requisitionService = new RequisitionService();
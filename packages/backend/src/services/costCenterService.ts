import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CostCenterHierarchy {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  children?: CostCenterHierarchy[];
  level: number;
}

export interface CostAllocation {
  costCenterId: string;
  costCenterCode: string;
  costCenterName: string;
  amount: number;
  currency: string;
  percentage?: number;
}

export class CostCenterService {
  /**
   * Create a new cost center
   */
  static async createCostCenter(data: {
    code: string;
    name: string;
    description?: string;
    parentId?: string;
  }) {
    try {
      // Validate parent exists if provided
      if (data.parentId) {
        const parent = await prisma.costCenter.findUnique({
          where: { id: data.parentId }
        });
        if (!parent) {
          throw new Error('Parent cost center not found');
        }
      }

      // Check if code already exists
      const existing = await prisma.costCenter.findUnique({
        where: { code: data.code }
      });
      if (existing) {
        throw new Error('Cost center code already exists');
      }

      const costCenter = await prisma.costCenter.create({
        data: {
          code: data.code,
          name: data.name,
          description: data.description,
          parentId: data.parentId
        },
        include: {
          parent: true,
          children: true
        }
      });

      logger.info(`Cost center created: ${costCenter.code}`);
      return costCenter;
    } catch (error) {
      logger.error('Error creating cost center:', error);
      throw error;
    }
  }

  /**
   * Get cost center hierarchy
   */
  static async getCostCenterHierarchy(): Promise<CostCenterHierarchy[]> {
    try {
      const costCenters = await prisma.costCenter.findMany({
        where: { isActive: true },
        include: {
          children: {
            where: { isActive: true },
            include: {
              children: {
                where: { isActive: true }
              }
            }
          }
        },
        orderBy: { code: 'asc' }
      });

      // Build hierarchy starting from root nodes
      const rootNodes = costCenters.filter(cc => !cc.parentId);
      return this.buildHierarchy(rootNodes, 0);
    } catch (error) {
      logger.error('Error fetching cost center hierarchy:', error);
      throw error;
    }
  }  /**

   * Build hierarchical structure
   */
  private static buildHierarchy(nodes: any[], level: number): CostCenterHierarchy[] {
    return nodes.map(node => ({
      id: node.id,
      code: node.code,
      name: node.name,
      description: node.description,
      parentId: node.parentId,
      isActive: node.isActive,
      level,
      children: node.children ? this.buildHierarchy(node.children, level + 1) : []
    }));
  }

  /**
   * Get cost center by code
   */
  static async getCostCenterByCode(code: string) {
    try {
      const costCenter = await prisma.costCenter.findUnique({
        where: { code },
        include: {
          parent: true,
          children: true,
          budgets: {
            where: {
              startDate: { lte: new Date() },
              endDate: { gte: new Date() }
            }
          }
        }
      });

      return costCenter;
    } catch (error) {
      logger.error('Error fetching cost center by code:', error);
      throw error;
    }
  }

  /**
   * Allocate costs to cost centers
   */
  static async allocateCosts(
    totalAmount: number,
    currency: string,
    allocations: Array<{
      costCenterId: string;
      percentage: number;
    }>
  ): Promise<CostAllocation[]> {
    try {
      // Validate percentages sum to 100
      const totalPercentage = allocations.reduce((sum, alloc) => sum + alloc.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error('Cost allocation percentages must sum to 100%');
      }

      // Get cost center details
      const costCenterIds = allocations.map(a => a.costCenterId);
      const costCenters = await prisma.costCenter.findMany({
        where: {
          id: { in: costCenterIds },
          isActive: true
        }
      });

      if (costCenters.length !== allocations.length) {
        throw new Error('One or more cost centers not found or inactive');
      }

      // Calculate allocations
      const result: CostAllocation[] = [];
      let remainingAmount = totalAmount;

      for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];
        const costCenter = costCenters.find(cc => cc.id === allocation.costCenterId);
        
        if (!costCenter) continue;

        let allocatedAmount: number;
        
        // For the last allocation, use remaining amount to avoid rounding errors
        if (i === allocations.length - 1) {
          allocatedAmount = remainingAmount;
        } else {
          allocatedAmount = Math.round((totalAmount * allocation.percentage / 100) * 100) / 100;
          remainingAmount -= allocatedAmount;
        }

        result.push({
          costCenterId: costCenter.id,
          costCenterCode: costCenter.code,
          costCenterName: costCenter.name,
          amount: allocatedAmount,
          currency,
          percentage: allocation.percentage
        });
      }

      return result;
    } catch (error) {
      logger.error('Error allocating costs:', error);
      throw error;
    }
  }  /**

   * Get cost center path (breadcrumb)
   */
  static async getCostCenterPath(costCenterId: string): Promise<string[]> {
    try {
      const path: string[] = [];
      let currentId: string | null = costCenterId;

      while (currentId) {
        const costCenter = await prisma.costCenter.findUnique({
          where: { id: currentId },
          select: { code: true, parentId: true }
        });

        if (!costCenter) break;

        path.unshift(costCenter.code);
        currentId = costCenter.parentId;
      }

      return path;
    } catch (error) {
      logger.error('Error getting cost center path:', error);
      return [];
    }
  }

  /**
   * Update cost center
   */
  static async updateCostCenter(
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
    }
  ) {
    try {
      const costCenter = await prisma.costCenter.update({
        where: { id },
        data,
        include: {
          parent: true,
          children: true
        }
      });

      logger.info(`Cost center updated: ${costCenter.code}`);
      return costCenter;
    } catch (error) {
      logger.error('Error updating cost center:', error);
      throw error;
    }
  }

  /**
   * Get cost centers for vessel
   */
  static async getCostCentersForVessel(vesselId: string) {
    try {
      // Get vessel-specific cost centers and general ones
      const costCenters = await prisma.costCenter.findMany({
        where: {
          isActive: true,
          OR: [
            { budgets: { some: { vesselId } } },
            { budgets: { some: { vesselId: null } } } // General cost centers
          ]
        },
        include: {
          budgets: {
            where: {
              OR: [
                { vesselId },
                { vesselId: null }
              ],
              startDate: { lte: new Date() },
              endDate: { gte: new Date() }
            }
          }
        },
        orderBy: { code: 'asc' }
      });

      return costCenters;
    } catch (error) {
      logger.error('Error fetching cost centers for vessel:', error);
      throw error;
    }
  }
}
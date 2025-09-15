import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DeliveryService } from '@/services/deliveryService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  delivery: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  purchaseOrder: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
} as unknown as PrismaClient;

vi.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

describe('DeliveryService', () => {
  let deliveryService: DeliveryService;

  beforeEach(() => {
    deliveryService = new DeliveryService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createDelivery', () => {
    it('should create a new delivery successfully', async () => {
      const deliveryData = {
        purchaseOrderId: 'po-123',
        vesselId: 'vessel-123',
        deliveryLocation: 'Port of Hamburg',
        scheduledDate: new Date('2024-02-15'),
        status: 'SCHEDULED' as const,
        trackingNumber: 'TRK-123456',
      };

      const mockDelivery = {
        id: 'delivery-123',
        ...deliveryData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.delivery.create.mockResolvedValue(mockDelivery);

      const result = await deliveryService.createDelivery(deliveryData);

      expect(mockPrisma.delivery.create).toHaveBeenCalledWith({
        data: deliveryData,
        include: {
          purchaseOrder: true,
          vessel: true,
          deliveryConfirmations: true,
        },
      });
      expect(result).toEqual(mockDelivery);
    });

    it('should throw error for invalid delivery data', async () => {
      const invalidData = {
        purchaseOrderId: '',
        vesselId: 'vessel-123',
        deliveryLocation: '',
        scheduledDate: new Date('2024-02-15'),
        status: 'SCHEDULED' as const,
      };

      await expect(deliveryService.createDelivery(invalidData))
        .rejects.toThrow('Purchase Order ID and delivery location are required');
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update delivery status successfully', async () => {
      const deliveryId = 'delivery-123';
      const newStatus = 'IN_TRANSIT';
      const userId = 'user-123';

      const mockUpdatedDelivery = {
        id: deliveryId,
        status: newStatus,
        updatedAt: new Date(),
      };

      mockPrisma.delivery.update.mockResolvedValue(mockUpdatedDelivery);

      const result = await deliveryService.updateDeliveryStatus(deliveryId, newStatus, userId);

      expect(mockPrisma.delivery.update).toHaveBeenCalledWith({
        where: { id: deliveryId },
        data: { 
          status: newStatus,
          updatedAt: expect.any(Date),
        },
        include: {
          purchaseOrder: true,
          vessel: true,
          deliveryConfirmations: true,
        },
      });
      expect(result).toEqual(mockUpdatedDelivery);
    });

    it('should create audit log when updating status', async () => {
      const deliveryId = 'delivery-123';
      const newStatus = 'DELIVERED';
      const userId = 'user-123';

      mockPrisma.delivery.update.mockResolvedValue({
        id: deliveryId,
        status: newStatus,
      });

      await deliveryService.updateDeliveryStatus(deliveryId, newStatus, userId);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          action: 'DELIVERY_STATUS_UPDATE',
          resourceType: 'DELIVERY',
          resourceId: deliveryId,
          details: {
            newStatus,
            timestamp: expect.any(Date),
          },
        },
      });
    });
  });

  describe('getDeliveriesByVessel', () => {
    it('should return deliveries for a specific vessel', async () => {
      const vesselId = 'vessel-123';
      const mockDeliveries = [
        {
          id: 'delivery-1',
          vesselId,
          status: 'SCHEDULED',
          deliveryLocation: 'Port A',
        },
        {
          id: 'delivery-2',
          vesselId,
          status: 'IN_TRANSIT',
          deliveryLocation: 'Port B',
        },
      ];

      mockPrisma.delivery.findMany.mockResolvedValue(mockDeliveries);

      const result = await deliveryService.getDeliveriesByVessel(vesselId);

      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith({
        where: { vesselId },
        include: {
          purchaseOrder: {
            include: {
              items: {
                include: {
                  item: true,
                },
              },
            },
          },
          vessel: true,
          deliveryConfirmations: true,
        },
        orderBy: { scheduledDate: 'asc' },
      });
      expect(result).toEqual(mockDeliveries);
    });
  });

  describe('confirmDelivery', () => {
    it('should confirm delivery with photo documentation', async () => {
      const deliveryId = 'delivery-123';
      const confirmationData = {
        confirmedBy: 'user-123',
        confirmationDate: new Date(),
        notes: 'All items received in good condition',
        photoUrls: ['photo1.jpg', 'photo2.jpg'],
      };

      const mockConfirmedDelivery = {
        id: deliveryId,
        status: 'DELIVERED',
        ...confirmationData,
      };

      mockPrisma.delivery.update.mockResolvedValue(mockConfirmedDelivery);

      const result = await deliveryService.confirmDelivery(deliveryId, confirmationData);

      expect(mockPrisma.delivery.update).toHaveBeenCalledWith({
        where: { id: deliveryId },
        data: {
          status: 'DELIVERED',
          deliveryConfirmations: {
            create: confirmationData,
          },
        },
        include: {
          purchaseOrder: true,
          vessel: true,
          deliveryConfirmations: true,
        },
      });
      expect(result).toEqual(mockConfirmedDelivery);
    });

    it('should throw error if delivery not found', async () => {
      const deliveryId = 'nonexistent-delivery';
      const confirmationData = {
        confirmedBy: 'user-123',
        confirmationDate: new Date(),
        notes: 'Test confirmation',
      };

      mockPrisma.delivery.update.mockRejectedValue(new Error('Delivery not found'));

      await expect(deliveryService.confirmDelivery(deliveryId, confirmationData))
        .rejects.toThrow('Delivery not found');
    });
  });

  describe('calculateEstimatedDeliveryTime', () => {
    it('should calculate delivery time based on distance and port capabilities', async () => {
      const vesselPosition = { latitude: 53.5511, longitude: 9.9937 }; // Hamburg
      const deliveryPort = { latitude: 51.5074, longitude: -0.1278 }; // London
      const urgencyLevel = 'ROUTINE';

      const estimatedTime = await deliveryService.calculateEstimatedDeliveryTime(
        vesselPosition,
        deliveryPort,
        urgencyLevel
      );

      expect(estimatedTime).toBeGreaterThan(0);
      expect(typeof estimatedTime).toBe('number');
    });

    it('should return faster delivery time for urgent items', async () => {
      const vesselPosition = { latitude: 53.5511, longitude: 9.9937 };
      const deliveryPort = { latitude: 51.5074, longitude: -0.1278 };

      const routineTime = await deliveryService.calculateEstimatedDeliveryTime(
        vesselPosition,
        deliveryPort,
        'ROUTINE'
      );

      const urgentTime = await deliveryService.calculateEstimatedDeliveryTime(
        vesselPosition,
        deliveryPort,
        'URGENT'
      );

      expect(urgentTime).toBeLessThan(routineTime);
    });
  });

  describe('getOverdueDeliveries', () => {
    it('should return deliveries that are overdue', async () => {
      const currentDate = new Date();
      const overdueDeliveries = [
        {
          id: 'delivery-1',
          scheduledDate: new Date(currentDate.getTime() - 86400000), // 1 day ago
          status: 'IN_TRANSIT',
        },
      ];

      mockPrisma.delivery.findMany.mockResolvedValue(overdueDeliveries);

      const result = await deliveryService.getOverdueDeliveries();

      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith({
        where: {
          scheduledDate: {
            lt: expect.any(Date),
          },
          status: {
            notIn: ['DELIVERED', 'CANCELLED'],
          },
        },
        include: {
          purchaseOrder: true,
          vessel: true,
        },
        orderBy: { scheduledDate: 'asc' },
      });
      expect(result).toEqual(overdueDeliveries);
    });
  });
});
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient, DeliveryStatus, POStatus } from '@prisma/client';
import { deliveryService } from '../services/deliveryService';
import { AppError } from '../utils/errors';

// Mock Prisma
const mockPrisma = {
  purchaseOrder: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  delivery: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  DeliveryStatus: {
    SCHEDULED: 'SCHEDULED',
    IN_TRANSIT: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    DELAYED: 'DELAYED',
    CANCELLED: 'CANCELLED',
  },
  POStatus: {
    DRAFT: 'DRAFT',
    SENT: 'SENT',
    ACKNOWLEDGED: 'ACKNOWLEDGED',
    IN_PROGRESS: 'IN_PROGRESS',
    DELIVERED: 'DELIVERED',
    INVOICED: 'INVOICED',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED',
  },
}));

// Mock audit service
vi.mock('../services/auditService', () => ({
  auditService: {
    log: vi.fn(),
  },
}));

describe('DeliveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createDelivery', () => {
    const mockPO = {
      id: 'po-1',
      poNumber: 'PO-202401-0001',
      status: 'SENT',
      vesselId: 'vessel-1',
      vendorId: 'vendor-1',
      vessel: {
        id: 'vessel-1',
        name: 'Test Vessel',
        imoNumber: '1234567',
      },
      vendor: {
        id: 'vendor-1',
        name: 'Test Vendor',
      },
    };

    const mockDelivery = {
      id: 'delivery-1',
      deliveryNumber: 'DEL-202401-0001',
      purchaseOrderId: 'po-1',
      status: 'SCHEDULED',
      scheduledDate: new Date('2024-02-15'),
      deliveryAddress: 'Port of New York',
      carrier: 'Express Shipping',
      trackingNumber: 'TRK123456',
      notes: 'Urgent delivery required',
      photoUrls: [],
    };

    it('should create delivery successfully', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(mockPO);
      mockPrisma.delivery.findFirst.mockResolvedValue(null);
      mockPrisma.delivery.count.mockResolvedValue(0);
      mockPrisma.delivery.create.mockResolvedValue(mockDelivery);
      mockPrisma.purchaseOrder.update.mockResolvedValue({ ...mockPO, status: 'IN_PROGRESS' });

      const result = await deliveryService.createDelivery({
        purchaseOrderId: 'po-1',
        scheduledDate: new Date('2024-02-15'),
        deliveryAddress: 'Port of New York',
        carrier: 'Express Shipping',
        trackingNumber: 'TRK123456',
        notes: 'Urgent delivery required',
      }, 'user-1');

      expect(result).toEqual(mockDelivery);
      expect(mockPrisma.delivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deliveryNumber: expect.stringMatching(/^DEL-\d{6}-\d{4}$/),
          purchaseOrderId: 'po-1',
          status: 'SCHEDULED',
          scheduledDate: new Date('2024-02-15'),
          deliveryAddress: 'Port of New York',
          carrier: 'Express Shipping',
          trackingNumber: 'TRK123456',
          notes: 'Urgent delivery required',
          photoUrls: [],
        }),
      });
    });

    it('should throw error if purchase order not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(
        deliveryService.createDelivery({
          purchaseOrderId: 'nonexistent',
          scheduledDate: new Date('2024-02-15'),
          deliveryAddress: 'Port of New York',
        }, 'user-1')
      ).rejects.toThrow(AppError);
    });

    it('should throw error if PO not in valid status', async () => {
      const draftPO = { ...mockPO, status: 'DRAFT' };
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(draftPO);

      await expect(
        deliveryService.createDelivery({
          purchaseOrderId: 'po-1',
          scheduledDate: new Date('2024-02-15'),
          deliveryAddress: 'Port of New York',
        }, 'user-1')
      ).rejects.toThrow(AppError);
    });

    it('should throw error if delivery already exists', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(mockPO);
      mockPrisma.delivery.findFirst.mockResolvedValue(mockDelivery);

      await expect(
        deliveryService.createDelivery({
          purchaseOrderId: 'po-1',
          scheduledDate: new Date('2024-02-15'),
          deliveryAddress: 'Port of New York',
        }, 'user-1')
      ).rejects.toThrow(AppError);
    });
  });

  describe('updateDelivery', () => {
    const mockDelivery = {
      id: 'delivery-1',
      deliveryNumber: 'DEL-202401-0001',
      purchaseOrderId: 'po-1',
      status: 'SCHEDULED',
      actualDate: null,
      receivedBy: null,
      notes: 'Original notes',
      purchaseOrder: {
        id: 'po-1',
        poNumber: 'PO-202401-0001',
        vesselId: 'vessel-1',
        vessel: { name: 'Test Vessel' },
      },
    };

    it('should update delivery status successfully', async () => {
      const updatedDelivery = {
        ...mockDelivery,
        status: 'IN_TRANSIT',
        notes: 'Original notes\n\nPackage picked up by carrier',
      };

      mockPrisma.delivery.findUnique.mockResolvedValue(mockDelivery);
      mockPrisma.delivery.update.mockResolvedValue(updatedDelivery);

      const result = await deliveryService.updateDelivery('delivery-1', {
        status: DeliveryStatus.IN_TRANSIT,
        notes: 'Package picked up by carrier',
      }, 'user-1');

      expect(result.status).toBe('IN_TRANSIT');
      expect(result.notes).toContain('Package picked up by carrier');
    });

    it('should update PO status when delivery is completed', async () => {
      const deliveredDelivery = {
        ...mockDelivery,
        status: 'DELIVERED',
        actualDate: new Date(),
        receivedBy: 'John Doe',
      };

      mockPrisma.delivery.findUnique.mockResolvedValue(mockDelivery);
      mockPrisma.delivery.update.mockResolvedValue(deliveredDelivery);
      mockPrisma.purchaseOrder.update.mockResolvedValue({ status: 'DELIVERED' });

      await deliveryService.updateDelivery('delivery-1', {
        status: DeliveryStatus.DELIVERED,
        actualDate: new Date(),
        receivedBy: 'John Doe',
      }, 'user-1');

      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po-1' },
        data: { status: 'DELIVERED' },
      });
    });

    it('should throw error if delivery not found', async () => {
      mockPrisma.delivery.findUnique.mockResolvedValue(null);

      await expect(
        deliveryService.updateDelivery('nonexistent', {
          status: DeliveryStatus.IN_TRANSIT,
        }, 'user-1')
      ).rejects.toThrow(AppError);
    });
  });

  describe('confirmDelivery', () => {
    const mockDelivery = {
      id: 'delivery-1',
      deliveryNumber: 'DEL-202401-0001',
      purchaseOrderId: 'po-1',
      status: 'IN_TRANSIT',
      notes: 'Package in transit',
      purchaseOrder: {
        id: 'po-1',
        poNumber: 'PO-202401-0001',
        vesselId: 'vessel-1',
        vendorId: 'vendor-1',
        vessel: { name: 'Test Vessel' },
        vendor: { name: 'Test Vendor' },
      },
    };

    it('should confirm delivery successfully', async () => {
      const confirmedDelivery = {
        ...mockDelivery,
        status: 'DELIVERED',
        actualDate: new Date('2024-02-15'),
        receivedBy: 'John Doe',
        photoUrls: ['photo1.jpg', 'photo2.jpg'],
        notes: 'Package in transit\n\nDelivery Confirmed: All items received in good condition',
      };

      mockPrisma.delivery.findUnique.mockResolvedValue(mockDelivery);
      mockPrisma.delivery.update.mockResolvedValue(confirmedDelivery);
      mockPrisma.purchaseOrder.update.mockResolvedValue({ status: 'DELIVERED' });

      const result = await deliveryService.confirmDelivery({
        deliveryId: 'delivery-1',
        receivedBy: 'John Doe',
        actualDate: new Date('2024-02-15'),
        photoUrls: ['photo1.jpg', 'photo2.jpg'],
        notes: 'All items received in good condition',
      }, 'user-1');

      expect(result.status).toBe('DELIVERED');
      expect(result.receivedBy).toBe('John Doe');
      expect(result.photoUrls).toEqual(['photo1.jpg', 'photo2.jpg']);
    });

    it('should handle discrepancies in confirmation', async () => {
      const confirmedDelivery = {
        ...mockDelivery,
        status: 'DELIVERED',
        notes: 'Package in transit\n\nDelivery Confirmed: Items received\nDiscrepancies: One item damaged',
      };

      mockPrisma.delivery.findUnique.mockResolvedValue(mockDelivery);
      mockPrisma.delivery.update.mockResolvedValue(confirmedDelivery);
      mockPrisma.purchaseOrder.update.mockResolvedValue({ status: 'DELIVERED' });

      const result = await deliveryService.confirmDelivery({
        deliveryId: 'delivery-1',
        receivedBy: 'John Doe',
        actualDate: new Date('2024-02-15'),
        photoUrls: ['photo1.jpg'],
        notes: 'Items received',
        discrepancies: 'One item damaged',
      }, 'user-1');

      expect(result.notes).toContain('Discrepancies: One item damaged');
    });

    it('should throw error if delivery not found', async () => {
      mockPrisma.delivery.findUnique.mockResolvedValue(null);

      await expect(
        deliveryService.confirmDelivery({
          deliveryId: 'nonexistent',
          receivedBy: 'John Doe',
          actualDate: new Date(),
          photoUrls: ['photo1.jpg'],
        }, 'user-1')
      ).rejects.toThrow(AppError);
    });

    it('should throw error if delivery already confirmed', async () => {
      const deliveredDelivery = { ...mockDelivery, status: 'DELIVERED' };
      mockPrisma.delivery.findUnique.mockResolvedValue(deliveredDelivery);

      await expect(
        deliveryService.confirmDelivery({
          deliveryId: 'delivery-1',
          receivedBy: 'John Doe',
          actualDate: new Date(),
          photoUrls: ['photo1.jpg'],
        }, 'user-1')
      ).rejects.toThrow(AppError);
    });
  });

  describe('getDeliveryTracking', () => {
    const mockDelivery = {
      id: 'delivery-1',
      deliveryNumber: 'DEL-202401-0001',
      status: 'IN_TRANSIT',
      scheduledDate: new Date('2024-02-15'),
      actualDate: null,
      deliveryAddress: 'Port of New York',
      carrier: 'Express Shipping',
      createdAt: new Date('2024-02-10'),
      purchaseOrder: {
        vessel: { name: 'Test Vessel' },
        vendor: { name: 'Test Vendor' },
      },
    };

    it('should return delivery tracking information', async () => {
      mockPrisma.delivery.findUnique.mockResolvedValue(mockDelivery);

      const result = await deliveryService.getDeliveryTracking('delivery-1');

      expect(result.deliveryId).toBe('delivery-1');
      expect(result.status).toBe('IN_TRANSIT');
      expect(result.trackingEvents).toBeInstanceOf(Array);
      expect(result.trackingEvents.length).toBeGreaterThan(0);
      expect(result.currentLocation).toBe('In Transit');
    });

    it('should throw error if delivery not found', async () => {
      mockPrisma.delivery.findUnique.mockResolvedValue(null);

      await expect(
        deliveryService.getDeliveryTracking('nonexistent')
      ).rejects.toThrow(AppError);
    });
  });

  describe('calculateEstimatedDeliveryTime', () => {
    it('should calculate delivery time between known ports', async () => {
      const result = await deliveryService.calculateEstimatedDeliveryTime(
        'GBLON',
        'USNYC',
        'standard'
      );

      expect(result.estimatedDays).toBeGreaterThan(0);
      expect(result.estimatedDate).toBeInstanceOf(Date);
      expect(result.factors).toHaveProperty('distance');
      expect(result.factors).toHaveProperty('carrier');
      expect(result.confidence).toMatch(/^(HIGH|MEDIUM|LOW)$/);
    });

    it('should throw error for unknown ports', async () => {
      await expect(
        deliveryService.calculateEstimatedDeliveryTime('UNKNOWN', 'USNYC', 'standard')
      ).rejects.toThrow(AppError);
    });
  });

  describe('getPortInfo', () => {
    it('should return port information for known port', async () => {
      const result = await deliveryService.getPortInfo('USNYC');

      expect(result).toBeTruthy();
      expect(result?.portCode).toBe('USNYC');
      expect(result?.portName).toBe('Port of New York');
      expect(result?.coordinates).toHaveProperty('latitude');
      expect(result?.coordinates).toHaveProperty('longitude');
    });

    it('should return null for unknown port', async () => {
      const result = await deliveryService.getPortInfo('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('searchPorts', () => {
    it('should find ports by code', async () => {
      const result = await deliveryService.searchPorts('NYC');

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].portCode).toBe('USNYC');
    });

    it('should find ports by name', async () => {
      const result = await deliveryService.searchPorts('London');

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].portName).toBe('Port of London');
    });

    it('should return empty array for no matches', async () => {
      const result = await deliveryService.searchPorts('NONEXISTENT');

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(0);
    });
  });

  describe('getDeliveriesByVessel', () => {
    const mockDeliveries = [
      {
        id: 'delivery-1',
        purchaseOrder: {
          vesselId: 'vessel-1',
          vendor: { name: 'Vendor 1' },
          vessel: { name: 'Test Vessel' },
        },
      },
      {
        id: 'delivery-2',
        purchaseOrder: {
          vesselId: 'vessel-1',
          vendor: { name: 'Vendor 2' },
          vessel: { name: 'Test Vessel' },
        },
      },
    ];

    it('should return deliveries for vessel', async () => {
      mockPrisma.delivery.findMany.mockResolvedValue(mockDeliveries);

      const result = await deliveryService.getDeliveriesByVessel('vessel-1');

      expect(result).toEqual(mockDeliveries);
      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith({
        where: {
          purchaseOrder: {
            vesselId: 'vessel-1',
          },
        },
        include: expect.any(Object),
        orderBy: { scheduledDate: 'desc' },
      });
    });

    it('should filter by status when provided', async () => {
      const scheduledDeliveries = mockDeliveries.filter(() => true);
      mockPrisma.delivery.findMany.mockResolvedValue(scheduledDeliveries);

      await deliveryService.getDeliveriesByVessel('vessel-1', DeliveryStatus.SCHEDULED);

      expect(mockPrisma.delivery.findMany).toHaveBeenCalledWith({
        where: {
          purchaseOrder: {
            vesselId: 'vessel-1',
          },
          status: 'SCHEDULED',
        },
        include: expect.any(Object),
        orderBy: { scheduledDate: 'desc' },
      });
    });
  });
});
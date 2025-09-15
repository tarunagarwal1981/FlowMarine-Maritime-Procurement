import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { vendorService, VendorRegistrationData } from '../services/vendorService';
import { AppError } from '../utils/errors';

// Mock Prisma
vi.mock('@prisma/client');
const mockPrisma = {
  vendor: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn()
  },
  vendorServiceArea: {
    createMany: vi.fn(),
    deleteMany: vi.fn()
  },
  vendorPortCapability: {
    createMany: vi.fn(),
    deleteMany: vi.fn()
  },
  vendorCertification: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn()
  },
  $transaction: vi.fn()
};

// Mock audit service
vi.mock('../services/auditService', () => ({
  auditService: {
    log: vi.fn()
  }
}));

// Mock encryption utilities
vi.mock('../utils/encryption', () => ({
  encrypt: vi.fn((text) => `encrypted_${text}`),
  decrypt: vi.fn((text) => text.replace('encrypted_', ''))
}));

describe('VendorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the transaction to execute the callback immediately
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      return await callback(mockPrisma);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerVendor', () => {
    const mockVendorData: VendorRegistrationData = {
      name: 'Test Vendor',
      code: 'TV001',
      email: 'test@vendor.com',
      phone: '+1234567890',
      country: 'USA',
      accountNumber: '1234567890',
      routingNumber: '987654321',
      serviceAreas: [
        {
          country: 'USA',
          region: 'East Coast',
          ports: ['USNYC', 'USMIA']
        }
      ],
      portCapabilities: [
        {
          portCode: 'USNYC',
          portName: 'New York',
          capabilities: ['delivery', 'customs']
        }
      ],
      certifications: [
        {
          certificationType: 'ISO 9001',
          certificateNumber: 'ISO001',
          issuedBy: 'ISO',
          issueDate: new Date('2023-01-01'),
          expiryDate: new Date('2026-01-01')
        }
      ]
    };

    it('should register a new vendor successfully', async () => {
      const mockVendor = {
        id: 'vendor1',
        ...mockVendorData,
        accountNumber: 'encrypted_1234567890',
        routingNumber: 'encrypted_987654321',
        isActive: true,
        isApproved: false
      };

      mockPrisma.vendor.findUnique.mockResolvedValue(null);
      mockPrisma.vendor.create.mockResolvedValue(mockVendor);
      mockPrisma.vendorServiceArea.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.vendorPortCapability.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.vendorCertification.createMany.mockResolvedValue({ count: 1 });

      const result = await vendorService.registerVendor(mockVendorData, 'user1');

      expect(result).toEqual(mockVendor);
      expect(mockPrisma.vendor.findUnique).toHaveBeenCalledWith({
        where: { code: 'TV001' }
      });
      expect(mockPrisma.vendor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Vendor',
          code: 'TV001',
          accountNumber: 'encrypted_1234567890',
          routingNumber: 'encrypted_987654321',
          isActive: true,
          isApproved: false
        })
      });
    });

    it('should throw error if vendor code already exists', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'existing', code: 'TV001' });

      await expect(vendorService.registerVendor(mockVendorData, 'user1'))
        .rejects.toThrow(AppError);
    });

    it('should handle registration without optional data', async () => {
      const minimalVendorData = {
        name: 'Minimal Vendor',
        code: 'MV001'
      };

      const mockVendor = {
        id: 'vendor2',
        ...minimalVendorData,
        isActive: true,
        isApproved: false
      };

      mockPrisma.vendor.findUnique.mockResolvedValue(null);
      mockPrisma.vendor.create.mockResolvedValue(mockVendor);

      const result = await vendorService.registerVendor(minimalVendorData, 'user1');

      expect(result).toEqual(mockVendor);
      expect(mockPrisma.vendorServiceArea.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.vendorPortCapability.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.vendorCertification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('updateVendor', () => {
    it('should update vendor successfully', async () => {
      const existingVendor = {
        id: 'vendor1',
        name: 'Old Name',
        code: 'TV001',
        accountNumber: 'encrypted_old_account'
      };

      const updateData = {
        id: 'vendor1',
        name: 'New Name',
        accountNumber: '9876543210'
      };

      const updatedVendor = {
        ...existingVendor,
        name: 'New Name',
        accountNumber: 'encrypted_9876543210'
      };

      mockPrisma.vendor.findUnique.mockResolvedValue(existingVendor);
      mockPrisma.vendor.update.mockResolvedValue(updatedVendor);

      const result = await vendorService.updateVendor(updateData, 'user1');

      expect(result).toEqual(updatedVendor);
      expect(mockPrisma.vendor.update).toHaveBeenCalledWith({
        where: { id: 'vendor1' },
        data: expect.objectContaining({
          name: 'New Name',
          accountNumber: 'encrypted_9876543210'
        })
      });
    });

    it('should throw error if vendor not found', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue(null);

      await expect(vendorService.updateVendor({ id: 'nonexistent' }, 'user1'))
        .rejects.toThrow(AppError);
    });
  });

  describe('getVendorById', () => {
    it('should get vendor by ID with decrypted banking details', async () => {
      const mockVendor = {
        id: 'vendor1',
        name: 'Test Vendor',
        accountNumber: 'encrypted_1234567890',
        routingNumber: 'encrypted_987654321',
        serviceAreas: [],
        portCapabilities: [],
        certifications: []
      };

      mockPrisma.vendor.findUnique.mockResolvedValue(mockVendor);

      const result = await vendorService.getVendorById('vendor1', true);

      expect(result.accountNumber).toBe('1234567890');
      expect(result.routingNumber).toBe('987654321');
    });

    it('should throw error if vendor not found', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue(null);

      await expect(vendorService.getVendorById('nonexistent'))
        .rejects.toThrow(AppError);
    });
  });

  describe('searchVendors', () => {
    it('should search vendors with filters', async () => {
      const mockVendors = [
        {
          id: 'vendor1',
          name: 'Vendor 1',
          overallScore: 8.5,
          isActive: true,
          serviceAreas: [],
          portCapabilities: [],
          certifications: []
        }
      ];

      mockPrisma.vendor.findMany.mockResolvedValue(mockVendors);

      const result = await vendorService.searchVendors({
        country: 'USA',
        minRating: 8.0,
        isActive: true
      });

      expect(result).toEqual(mockVendors);
      expect(mockPrisma.vendor.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isActive: true,
          overallScore: { gte: 8.0 },
          serviceAreas: {
            some: { country: 'USA' }
          }
        }),
        include: expect.any(Object),
        orderBy: expect.any(Array)
      });
    });
  });

  describe('updateVendorPerformance', () => {
    it('should update vendor performance ratings', async () => {
      const existingVendor = {
        id: 'vendor1',
        qualityRating: 7.0,
        deliveryRating: 8.0,
        priceRating: 6.0,
        overallScore: 7.0
      };

      const performanceUpdate = {
        vendorId: 'vendor1',
        qualityRating: 8.5,
        deliveryRating: 9.0
      };

      const expectedOverallScore = (6.0 * 0.4) + (9.0 * 0.3) + (8.5 * 0.2) + (5 * 0.1); // 7.0

      const updatedVendor = {
        ...existingVendor,
        qualityRating: 8.5,
        deliveryRating: 9.0,
        overallScore: expectedOverallScore
      };

      mockPrisma.vendor.findUnique.mockResolvedValue(existingVendor);
      mockPrisma.vendor.update.mockResolvedValue(updatedVendor);

      const result = await vendorService.updateVendorPerformance(performanceUpdate, 'user1');

      expect(result).toEqual(updatedVendor);
      expect(mockPrisma.vendor.update).toHaveBeenCalledWith({
        where: { id: 'vendor1' },
        data: expect.objectContaining({
          qualityRating: 8.5,
          deliveryRating: 9.0,
          priceRating: 6.0,
          overallScore: expectedOverallScore
        })
      });
    });
  });

  describe('getVendorsByLocationAndCapabilities', () => {
    it('should get vendors by location and capabilities', async () => {
      const mockVendors = [
        {
          id: 'vendor1',
          name: 'Local Vendor',
          serviceAreas: [],
          portCapabilities: [],
          certifications: []
        }
      ];

      mockPrisma.vendor.findMany.mockResolvedValue(mockVendors);

      const result = await vendorService.getVendorsByLocationAndCapabilities(
        'USA',
        'USNYC',
        ['delivery', 'customs']
      );

      expect(result).toEqual(mockVendors);
      expect(mockPrisma.vendor.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isActive: true,
          isApproved: true,
          serviceAreas: {
            some: {
              country: 'USA',
              ports: { has: 'USNYC' }
            }
          },
          portCapabilities: {
            some: {
              portCode: 'USNYC',
              capabilities: {
                hasSome: ['delivery', 'customs']
              }
            }
          }
        }),
        include: expect.any(Object),
        orderBy: { overallScore: 'desc' }
      });
    });
  });

  describe('getExpiringCertifications', () => {
    it('should get expiring certifications', async () => {
      const mockCertifications = [
        {
          id: 'cert1',
          certificationType: 'ISO 9001',
          expiryDate: new Date('2024-02-01'),
          vendor: { name: 'Test Vendor' }
        }
      ];

      mockPrisma.vendorCertification.findMany.mockResolvedValue(mockCertifications);

      const result = await vendorService.getExpiringCertifications(30);

      expect(result).toEqual(mockCertifications);
      expect(mockPrisma.vendorCertification.findMany).toHaveBeenCalledWith({
        where: {
          expiryDate: {
            lte: expect.any(Date),
            gte: expect.any(Date)
          }
        },
        include: { vendor: true },
        orderBy: { expiryDate: 'asc' }
      });
    });
  });
});
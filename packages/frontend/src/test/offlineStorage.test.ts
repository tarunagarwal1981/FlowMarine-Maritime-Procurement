/**
 * Offline Storage Tests
 * Tests for offline storage functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { offlineStorage, OfflineRequisition } from '../utils/offlineStorage';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock window events
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
const mockDispatchEvent = vi.fn();

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener
});

Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener
});

Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent
});

describe('OfflineStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize offline storage', () => {
      offlineStorage.initialize();
      
      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should set initial offline state', () => {
      navigator.onLine = false;
      offlineStorage.initialize();
      
      const state = offlineStorage.getOfflineState();
      expect(state.isOnline).toBe(false);
    });
  });

  describe('offline requisitions', () => {
    it('should save offline requisition', () => {
      const requisition: OfflineRequisition = {
        id: '',
        tempId: 'temp_123',
        vesselId: 'vessel_1',
        requestedById: 'user_1',
        urgencyLevel: 'ROUTINE',
        status: 'PENDING_SYNC',
        totalAmount: 100,
        currency: 'USD',
        items: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isOfflineCreated: true
      };

      localStorageMock.getItem.mockReturnValue('[]');
      
      offlineStorage.saveOfflineRequisition(requisition);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'flowmarine_offline_requisitions',
        expect.stringContaining('temp_123')
      );
    });

    it('should get offline requisitions', () => {
      const mockRequisitions = [
        {
          tempId: 'temp_123',
          vesselId: 'vessel_1',
          status: 'PENDING_SYNC'
        }
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockRequisitions));
      
      const requisitions = offlineStorage.getOfflineRequisitions();
      
      expect(requisitions).toEqual(mockRequisitions);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('flowmarine_offline_requisitions');
    });

    it('should remove offline requisition', () => {
      const mockRequisitions = [
        { tempId: 'temp_123', vesselId: 'vessel_1' },
        { tempId: 'temp_456', vesselId: 'vessel_2' }
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockRequisitions));
      
      offlineStorage.removeOfflineRequisition('temp_123');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'flowmarine_offline_requisitions',
        expect.not.stringContaining('temp_123')
      );
    });
  });

  describe('caching', () => {
    it('should cache essential data', async () => {
      const testData = {
        items: [
          {
            id: 'item_1',
            name: 'Test Item',
            category: 'ENGINE_PARTS',
            criticalityLevel: 'ROUTINE' as const,
            compatibleVesselTypes: ['CARGO'],
            compatibleEngineTypes: ['DIESEL'],
            unitOfMeasure: 'PCS'
          }
        ],
        vessels: [
          {
            id: 'vessel_1',
            name: 'Test Vessel',
            imoNumber: '1234567',
            vesselType: 'CARGO',
            engineType: 'DIESEL',
            cargoCapacity: 1000
          }
        ]
      };

      await offlineStorage.cacheEssentialData(testData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'flowmarine_cached_items',
        expect.stringContaining('Test Item')
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'flowmarine_cached_vessels',
        expect.stringContaining('Test Vessel')
      );
    });

    it('should get cached items', () => {
      const mockItems = [
        {
          id: 'item_1',
          name: 'Test Item',
          cachedAt: new Date().toISOString()
        }
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockItems));
      
      const items = offlineStorage.getCachedItems();
      
      expect(items).toEqual(mockItems);
    });

    it('should filter expired cache items', () => {
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 25); // 25 hours ago
      
      const mockItems = [
        {
          id: 'item_1',
          name: 'Fresh Item',
          cachedAt: new Date().toISOString()
        },
        {
          id: 'item_2',
          name: 'Expired Item',
          cachedAt: expiredDate.toISOString()
        }
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockItems));
      
      const items = offlineStorage.getCachedItems();
      
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Fresh Item');
    });
  });

  describe('sync queue', () => {
    it('should add item to sync queue', () => {
      localStorageMock.getItem.mockReturnValue('[]');
      
      offlineStorage.addToSyncQueue({
        type: 'CREATE_REQUISITION',
        data: { vesselId: 'vessel_1' },
        maxRetries: 3
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'flowmarine_sync_queue',
        expect.stringContaining('CREATE_REQUISITION')
      );
    });

    it('should get sync queue', () => {
      const mockQueue = [
        {
          id: 'sync_1',
          type: 'CREATE_REQUISITION',
          data: {},
          retryCount: 0
        }
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));
      
      const queue = offlineStorage.getSyncQueue();
      
      expect(queue).toEqual(mockQueue);
    });

    it('should remove item from sync queue', () => {
      const mockQueue = [
        { id: 'sync_1', type: 'CREATE_REQUISITION' },
        { id: 'sync_2', type: 'UPDATE_REQUISITION' }
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));
      
      offlineStorage.removeFromSyncQueue('sync_1');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'flowmarine_sync_queue',
        expect.not.stringContaining('sync_1')
      );
    });
  });

  describe('utility functions', () => {
    it('should generate temporary ID', () => {
      const tempId = offlineStorage.generateTempId();
      
      expect(tempId).toMatch(/^temp_\d+_[a-z0-9]+$/);
    });

    it('should clear all offline data', () => {
      offlineStorage.clearOfflineData();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledTimes(6); // All storage keys
    });

    it('should get storage statistics', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        switch (key) {
          case 'flowmarine_offline_requisitions':
            return JSON.stringify([{}, {}]); // 2 items
          case 'flowmarine_cached_items':
            return JSON.stringify([{}]); // 1 item
          default:
            return '[]';
        }
      });
      
      const stats = offlineStorage.getStorageStats();
      
      expect(stats.offlineRequisitions).toBe(2);
      expect(stats.cachedItems).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });
});
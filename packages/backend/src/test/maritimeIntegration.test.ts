import request from 'supertest';
import { app } from '../server';
import { aisGpsIntegrationService } from '../services/aisGpsIntegrationService';
import { impaCatalogIntegrationService } from '../services/impaCatalogIntegrationService';
import { portDatabaseIntegrationService } from '../services/portDatabaseIntegrationService';
import { vesselManagementIntegrationService } from '../services/vesselManagementIntegrationService';

// Mock external services
jest.mock('../services/aisGpsIntegrationService');
jest.mock('../services/impaCatalogIntegrationService');
jest.mock('../services/portDatabaseIntegrationService');
jest.mock('../services/vesselManagementIntegrationService');

const mockAisGpsService = aisGpsIntegrationService as jest.Mocked<typeof aisGpsIntegrationService>;
const mockImpaService = impaCatalogIntegrationService as jest.Mocked<typeof impaCatalogIntegrationService>;
const mockPortService = portDatabaseIntegrationService as jest.Mocked<typeof portDatabaseIntegrationService>;
const mockVmsService = vesselManagementIntegrationService as jest.Mocked<typeof vesselManagementIntegrationService>;

describe('Maritime Integration API', () => {
  let authToken: string;
  let vesselId: string;

  beforeAll(async () => {
    // Setup test authentication
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'captain@test.com',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
    vesselId = 'test-vessel-id';
  });

  describe('AIS/GPS Integration', () => {
    describe('GET /api/maritime/vessels/:vesselId/position', () => {
      it('should get vessel position successfully', async () => {
        const mockPosition = {
          vesselId: vesselId,
          imoNumber: '1234567',
          latitude: 37.7749,
          longitude: -122.4194,
          course: 180,
          speed: 12.5,
          heading: 180,
          timestamp: new Date(),
          source: 'AIS' as const
        };

        mockAisGpsService.getBestAvailablePosition.mockResolvedValue(mockPosition);

        const response = await request(app)
          .get(`/api/maritime/vessels/${vesselId}/position`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ imoNumber: '1234567' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockPosition);
        expect(mockAisGpsService.getBestAvailablePosition).toHaveBeenCalledWith(
          vesselId,
          '1234567',
          undefined
        );
      });

      it('should return 404 when position not available', async () => {
        mockAisGpsService.getBestAvailablePosition.mockResolvedValue(null);

        const response = await request(app)
          .get(`/api/maritime/vessels/${vesselId}/position`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ imoNumber: '1234567' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Vessel position not available');
      });

      it('should return 400 when IMO number is missing', async () => {
        const response = await request(app)
          .get(`/api/maritime/vessels/${vesselId}/position`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('IMO number is required');
      });
    });
  });

  describe('IMPA/ISSA Catalog Integration', () => {
    describe('GET /api/maritime/catalog/search', () => {
      it('should search IMPA catalog successfully', async () => {
        const mockResult = {
          items: [
            {
              impaCode: '123456',
              name: 'Test Item',
              description: 'Test Description',
              category: 'Engine Parts',
              subCategory: 'Filters',
              unitOfMeasure: 'EA',
              specifications: {},
              compatibleVesselTypes: ['Container'],
              compatibleEngineTypes: ['Diesel'],
              suppliers: [],
              lastUpdated: new Date()
            }
          ],
          total: 1,
          hasMore: false
        };

        mockImpaService.searchIMPACatalog.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/maritime/catalog/search')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            query: 'filter',
            source: 'impa',
            category: 'Engine Parts'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
      });

      it('should search combined catalog successfully', async () => {
        const mockResult = {
          impaItems: [],
          issaItems: [],
          total: 0
        };

        mockImpaService.getCombinedCatalogData.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/maritime/catalog/search')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ query: 'safety equipment' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
      });
    });

    describe('GET /api/maritime/catalog/items/:code', () => {
      it('should get IMPA item successfully', async () => {
        const mockItem = {
          impaCode: '123456',
          name: 'Test Item',
          description: 'Test Description',
          category: 'Engine Parts',
          subCategory: 'Filters',
          unitOfMeasure: 'EA',
          specifications: {},
          compatibleVesselTypes: ['Container'],
          compatibleEngineTypes: ['Diesel'],
          suppliers: [],
          lastUpdated: new Date()
        };

        mockImpaService.getIMPAItem.mockResolvedValue(mockItem);

        const response = await request(app)
          .get('/api/maritime/catalog/items/123456')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ source: 'impa' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockItem);
      });

      it('should return 404 when item not found', async () => {
        mockImpaService.getIMPAItem.mockResolvedValue(null);
        mockImpaService.getISSAItem.mockResolvedValue(null);

        const response = await request(app)
          .get('/api/maritime/catalog/items/999999')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Catalog item not found');
      });
    });

    describe('POST /api/maritime/catalog/sync', () => {
      it('should sync catalog updates successfully', async () => {
        const mockResult = {
          impaUpdates: 5,
          issaUpdates: 3,
          errors: []
        };

        mockImpaService.syncCatalogUpdates.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/maritime/catalog/sync')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ lastSyncDate: '2024-01-01T00:00:00Z' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
      });
    });
  });

  describe('Port Database Integration', () => {
    describe('GET /api/maritime/ports/search', () => {
      it('should search ports successfully', async () => {
        const mockPorts = [
          {
            portCode: 'USNYC',
            name: 'New York',
            country: 'United States',
            countryCode: 'US',
            region: 'North America',
            coordinates: { latitude: 40.7128, longitude: -74.0060 },
            timeZone: 'America/New_York',
            services: [],
            facilities: [],
            restrictions: [],
            contacts: [],
            operatingHours: {
              weekdays: '24/7',
              weekends: '24/7',
              holidays: 'Limited',
              emergencyContact: true
            },
            anchorageInfo: {
              available: true,
              capacity: 50,
              depth: 15,
              bottom: 'Sand',
              shelter: 'Good',
              restrictions: []
            },
            pilotageInfo: {
              compulsory: true,
              available: true,
              boardingArea: 'Ambrose Light',
              contactInfo: 'VHF Channel 12',
              advanceNotice: '4 hours'
            },
            lastUpdated: new Date()
          }
        ];

        mockPortService.searchPorts.mockResolvedValue(mockPorts);

        const response = await request(app)
          .get('/api/maritime/ports/search')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            query: 'New York',
            country: 'US'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockPorts);
      });
    });

    describe('GET /api/maritime/ports/:portCode', () => {
      it('should get port details successfully', async () => {
        const mockPort = {
          portCode: 'USNYC',
          name: 'New York',
          country: 'United States',
          countryCode: 'US',
          region: 'North America',
          coordinates: { latitude: 40.7128, longitude: -74.0060 },
          timeZone: 'America/New_York',
          services: [],
          facilities: [],
          restrictions: [],
          contacts: [],
          operatingHours: {
            weekdays: '24/7',
            weekends: '24/7',
            holidays: 'Limited',
            emergencyContact: true
          },
          anchorageInfo: {
            available: true,
            capacity: 50,
            depth: 15,
            bottom: 'Sand',
            shelter: 'Good',
            restrictions: []
          },
          pilotageInfo: {
            compulsory: true,
            available: true,
            boardingArea: 'Ambrose Light',
            contactInfo: 'VHF Channel 12',
            advanceNotice: '4 hours'
          },
          lastUpdated: new Date()
        };

        mockPortService.getPortDetails.mockResolvedValue(mockPort);

        const response = await request(app)
          .get('/api/maritime/ports/USNYC')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockPort);
      });
    });

    describe('GET /api/maritime/ports/nearest', () => {
      it('should find nearest ports successfully', async () => {
        const mockPorts = [
          {
            portCode: 'USNYC',
            name: 'New York',
            country: 'United States',
            countryCode: 'US',
            region: 'North America',
            coordinates: { latitude: 40.7128, longitude: -74.0060 },
            timeZone: 'America/New_York',
            services: [],
            facilities: [],
            restrictions: [],
            contacts: [],
            operatingHours: {
              weekdays: '24/7',
              weekends: '24/7',
              holidays: 'Limited',
              emergencyContact: true
            },
            anchorageInfo: {
              available: true,
              capacity: 50,
              depth: 15,
              bottom: 'Sand',
              shelter: 'Good',
              restrictions: []
            },
            pilotageInfo: {
              compulsory: true,
              available: true,
              boardingArea: 'Ambrose Light',
              contactInfo: 'VHF Channel 12',
              advanceNotice: '4 hours'
            },
            lastUpdated: new Date()
          }
        ];

        mockPortService.findNearestPorts.mockResolvedValue(mockPorts);

        const response = await request(app)
          .get('/api/maritime/ports/nearest')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            latitude: '40.7128',
            longitude: '-74.0060',
            radius: '100'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockPorts);
      });

      it('should return 400 when coordinates are missing', async () => {
        const response = await request(app)
          .get('/api/maritime/ports/nearest')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Latitude and longitude are required');
      });
    });

    describe('POST /api/maritime/ports/coordinate-delivery', () => {
      it('should coordinate delivery successfully', async () => {
        const mockResult = {
          confirmationNumber: 'DEL-123456',
          estimatedCost: 500,
          requiredDocuments: ['Bill of Lading', 'Commercial Invoice'],
          contactInfo: {
            contactType: 'Port Agent',
            name: 'John Smith',
            phone: '+1-555-0123',
            email: 'agent@port.com',
            radio: 'VHF Channel 12',
            emergencyOnly: false
          }
        };

        mockPortService.coordinateDelivery.mockResolvedValue(mockResult);

        const deliveryData = {
          portCode: 'USNYC',
          vesselId: vesselId,
          deliveryDate: '2024-02-01T10:00:00Z',
          deliveryWindow: {
            start: '2024-02-01T08:00:00Z',
            end: '2024-02-01T12:00:00Z'
          },
          contactPerson: 'Captain Smith',
          specialInstructions: 'Deliver to starboard side',
          customsRequirements: [],
          documentationRequired: ['Bill of Lading']
        };

        const response = await request(app)
          .post('/api/maritime/ports/coordinate-delivery')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deliveryData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
      });
    });

    describe('GET /api/maritime/ports/customs-requirements', () => {
      it('should get customs requirements successfully', async () => {
        const mockRequirements = [
          {
            documentType: 'Bill of Lading',
            required: true,
            deadline: new Date('2024-02-01T00:00:00Z'),
            authority: 'US Customs',
            notes: 'Original required'
          }
        ];

        mockPortService.getCustomsRequirements.mockResolvedValue(mockRequirements);

        const response = await request(app)
          .get('/api/maritime/ports/customs-requirements')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            portCode: 'USNYC',
            vesselFlag: 'LR',
            cargoType: 'Container'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockRequirements);
      });

      it('should return 400 when required parameters are missing', async () => {
        const response = await request(app)
          .get('/api/maritime/ports/customs-requirements')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ portCode: 'USNYC' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Port code, vessel flag, and cargo type are required');
      });
    });

    describe('GET /api/maritime/ports/transit-time', () => {
      it('should calculate transit time successfully', async () => {
        const mockResult = {
          distanceNM: 3500,
          transitTimeHours: 291.7,
          estimatedArrival: new Date('2024-02-15T12:00:00Z')
        };

        mockPortService.calculateTransitTime.mockResolvedValue(mockResult);

        const response = await request(app)
          .get('/api/maritime/ports/transit-time')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            fromPortCode: 'USNYC',
            toPortCode: 'GBSOU',
            vesselSpeed: '12'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
      });
    });
  });

  describe('Vessel Management System Integration', () => {
    describe('GET /api/maritime/vessels/:vesselId/vms-data', () => {
      it('should get vessel management data successfully', async () => {
        const mockData = {
          vesselId: vesselId,
          imoNumber: '1234567',
          dataType: 'POSITION',
          data: { latitude: 37.7749, longitude: -122.4194 },
          timestamp: new Date(),
          source: 'Test VMS',
          version: '1.0'
        };

        mockVmsService.exchangeVesselData.mockResolvedValue(mockData);

        const response = await request(app)
          .get(`/api/maritime/vessels/${vesselId}/vms-data`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            systemId: 'test-vms',
            dataType: 'POSITION'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockData);
      });
    });

    describe('GET /api/maritime/vessels/:vesselId/crew-manifest', () => {
      it('should get crew manifest successfully', async () => {
        const mockManifest = {
          vesselId: vesselId,
          manifestDate: new Date(),
          crew: [
            {
              id: 'crew-1',
              name: 'John Smith',
              rank: 'Captain',
              nationality: 'US',
              certificateNumber: 'CERT-123',
              certificateExpiry: new Date('2025-12-31'),
              signOnDate: new Date('2024-01-01'),
              emergencyContact: '+1-555-0123'
            }
          ],
          totalCrew: 1,
          officersCount: 1,
          ratingsCount: 0,
          lastUpdated: new Date()
        };

        mockVmsService.getCrewManifest.mockResolvedValue(mockManifest);

        const response = await request(app)
          .get(`/api/maritime/vessels/${vesselId}/crew-manifest`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ systemId: 'test-vms' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockManifest);
      });
    });

    describe('GET /api/maritime/vessels/:vesselId/integrated-dashboard', () => {
      it('should get integrated dashboard data successfully', async () => {
        const mockDashboard = {
          position: { latitude: 37.7749, longitude: -122.4194 },
          crew: null,
          maintenance: [],
          certificates: [],
          inventory: [],
          lastUpdated: new Date()
        };

        mockVmsService.getIntegratedDashboardData.mockResolvedValue(mockDashboard);

        const response = await request(app)
          .get(`/api/maritime/vessels/${vesselId}/integrated-dashboard`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ systemId: 'test-vms' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockDashboard);
      });
    });

    describe('POST /api/maritime/vessels/:vesselId/sync-procurement', () => {
      it('should sync procurement data successfully', async () => {
        const mockResult = {
          success: true,
          errors: []
        };

        mockVmsService.syncProcurementData.mockResolvedValue(mockResult);

        const procurementData = {
          requisitions: [],
          purchaseOrders: [],
          deliveries: []
        };

        const response = await request(app)
          .post(`/api/maritime/vessels/${vesselId}/sync-procurement`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ systemId: 'test-vms' })
          .send(procurementData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all routes', async () => {
      const response = await request(app)
        .get(`/api/maritime/vessels/${vesselId}/position`)
        .query({ imoNumber: '1234567' });

      expect(response.status).toBe(401);
    });

    it('should require vessel access for vessel-specific routes', async () => {
      // This would require a different vessel ID that the user doesn't have access to
      const unauthorizedVesselId = 'unauthorized-vessel';
      
      const response = await request(app)
        .get(`/api/maritime/vessels/${unauthorizedVesselId}/position`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ imoNumber: '1234567' });

      expect(response.status).toBe(403);
    });
  });
});

describe('Maritime Integration Services Unit Tests', () => {
  describe('AIS/GPS Integration Service', () => {
    it('should validate position data correctly', () => {
      const validPosition = {
        vesselId: 'test',
        imoNumber: '1234567',
        latitude: 37.7749,
        longitude: -122.4194,
        course: 180,
        speed: 12.5,
        heading: 180,
        timestamp: new Date(),
        source: 'AIS' as const
      };

      expect(aisGpsIntegrationService.validatePositionData(validPosition)).toBe(true);

      const invalidPosition = {
        ...validPosition,
        latitude: 91 // Invalid latitude
      };

      expect(aisGpsIntegrationService.validatePositionData(invalidPosition)).toBe(false);
    });

    it('should calculate distance correctly', () => {
      const pos1 = {
        vesselId: 'test',
        imoNumber: '1234567',
        latitude: 37.7749,
        longitude: -122.4194,
        course: 0,
        speed: 0,
        heading: 0,
        timestamp: new Date(),
        source: 'AIS' as const
      };

      const pos2 = {
        ...pos1,
        latitude: 40.7128,
        longitude: -74.0060
      };

      const distance = aisGpsIntegrationService.calculateDistance(pos1, pos2);
      expect(distance).toBeGreaterThan(2000); // Approximate distance between SF and NYC
      expect(distance).toBeLessThan(3000);
    });
  });
});
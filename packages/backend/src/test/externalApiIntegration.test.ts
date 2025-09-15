import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { ExternalApiIntegrationService } from '../services/externalApiIntegrationService';
import { BankingApiIntegrationService } from '../services/bankingApiIntegrationService';
import { redis } from '../config/redis';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock redis
vi.mock('../config/redis', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn()
  }
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('ExternalApiIntegrationService', () => {
  let service: ExternalApiIntegrationService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    };

    mockedAxios.create = vi.fn().mockReturnValue(mockAxiosInstance);
    
    service = new ExternalApiIntegrationService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('IMPA Catalog Integration', () => {
    it('should search IMPA catalog successfully', async () => {
      const mockResponse = {
        data: {
          items: [
            {
              impa_code: '123456',
              issa_code: 'ISSA123',
              name: 'Test Item',
              description: 'Test Description',
              category: 'ENGINE_PARTS',
              specifications: { type: 'test' },
              compatible_vessel_types: ['CONTAINER'],
              compatible_engine_types: ['DIESEL'],
              unit_of_measure: 'PCS',
              average_price: 100,
              lead_time: 7,
              suppliers: [],
              last_updated: '2024-01-01T00:00:00Z'
            }
          ],
          total: 1
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.searchIMPACatalog({
        searchTerm: 'test',
        category: 'ENGINE_PARTS'
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].impaCode).toBe('123456');
      expect(result.total).toBe(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/catalog/search', {
        params: {
          searchTerm: 'test',
          category: 'ENGINE_PARTS'
        }
      });
    });

    it('should return cached results when available', async () => {
      const cachedData = {
        items: [{ impaCode: '123456', name: 'Cached Item' }],
        total: 1
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.searchIMPACatalog({ searchTerm: 'test' });

      expect(result).toEqual(cachedData);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it('should get IMPA item details', async () => {
      const mockResponse = {
        data: {
          impa_code: '123456',
          name: 'Test Item',
          description: 'Test Description',
          category: 'ENGINE_PARTS',
          specifications: {},
          compatible_vessel_types: [],
          compatible_engine_types: [],
          unit_of_measure: 'PCS',
          suppliers: [],
          last_updated: '2024-01-01T00:00:00Z'
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getIMPAItemDetails('123456');

      expect(result.impaCode).toBe('123456');
      expect(result.name).toBe('Test Item');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/catalog/items/123456');
    });

    it('should get supplier pricing', async () => {
      const mockResponse = {
        data: {
          suppliers: [
            {
              supplierId: 'SUP001',
              supplierName: 'Test Supplier',
              price: 100,
              currency: 'USD',
              availability: 'IN_STOCK',
              leadTime: 7,
              minimumOrderQuantity: 1,
              location: 'Singapore'
            }
          ]
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getIMPASupplierPricing('123456', 'Singapore');

      expect(result).toHaveLength(1);
      expect(result[0].supplierId).toBe('SUP001');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/catalog/items/123456/suppliers', {
        params: { location: 'Singapore' }
      });
    });
  });

  describe('Port Database Integration', () => {
    it('should get port information', async () => {
      const mockResponse = {
        data: {
          port_code: 'SGSIN',
          port_name: 'Singapore',
          country: 'Singapore',
          latitude: 1.2966,
          longitude: 103.7764,
          services: ['CONTAINER', 'BULK'],
          customs_info: {
            clearance_time: 24,
            required_documents: ['BILL_OF_LADING'],
            fees: { customs: 100 }
          },
          logistics: {
            anchorage_depth: 20,
            berth_availability: true,
            cargo_handling_capacity: 1000,
            storage_capacity: 5000
          },
          contacts: {
            port_authority: 'MPA Singapore',
            customs_office: 'Singapore Customs',
            pilotage: 'PSA Pilots',
            tug_services: 'PSA Tugs'
          }
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getPortInformation('SGSIN');

      expect(result.portCode).toBe('SGSIN');
      expect(result.portName).toBe('Singapore');
      expect(result.coordinates.latitude).toBe(1.2966);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/ports/SGSIN');
    });

    it('should search ports by criteria', async () => {
      const mockResponse = {
        data: {
          ports: [
            {
              port_code: 'SGSIN',
              port_name: 'Singapore',
              country: 'Singapore',
              latitude: 1.2966,
              longitude: 103.7764,
              services: ['CONTAINER'],
              customs_info: {},
              logistics: {},
              contacts: {}
            }
          ]
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.searchPorts({
        country: 'Singapore',
        services: ['CONTAINER']
      });

      expect(result).toHaveLength(1);
      expect(result[0].portCode).toBe('SGSIN');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/ports/search', {
        params: {
          country: 'Singapore',
          services: ['CONTAINER']
        }
      });
    });
  });

  describe('Weather API Integration', () => {
    it('should get weather data', async () => {
      const mockResponse = {
        data: {
          location: { lat: 1.2966, lon: 103.7764 },
          current: {
            temp_c: 28,
            wind_kph: 15,
            wind_degree: 180,
            vis_km: 10
          },
          marine: {
            sea_state: 2,
            wave_height: 1.5
          },
          forecast: {
            forecastday: [
              {
                date: '2024-01-01',
                day: {
                  mintemp_c: 25,
                  maxtemp_c: 30,
                  maxwind_kph: 20,
                  totalprecip_mm: 0
                },
                marine: {
                  sea_state: 2,
                  wave_height: 1.5
                }
              }
            ]
          }
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getWeatherData({
        latitude: 1.2966,
        longitude: 103.7764
      });

      expect(result.location.latitude).toBe(1.2966);
      expect(result.current.temperature).toBe(28);
      expect(result.forecast).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/current', {
        params: {
          lat: 1.2966,
          lon: 103.7764,
          include_forecast: true
        }
      });
    });

    it('should get route weather forecast', async () => {
      const route = [
        { latitude: 1.2966, longitude: 103.7764 },
        { latitude: 22.3193, longitude: 114.1694 }
      ];

      const mockResponse = {
        data: {
          location: { lat: 1.2966, lon: 103.7764 },
          current: { temp_c: 28, wind_kph: 15, wind_degree: 180, vis_km: 10 },
          marine: { sea_state: 2, wave_height: 1.5 },
          forecast: { forecastday: [] }
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getRouteWeatherForecast(route);

      expect(result).toHaveLength(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Vessel Tracking Integration', () => {
    it('should get vessel position', async () => {
      const mockResponse = {
        data: {
          vessel_id: 'VESSEL001',
          imo_number: '1234567',
          position: {
            lat: 1.2966,
            lon: 103.7764,
            timestamp: '2024-01-01T12:00:00Z'
          },
          course: 180,
          speed: 15,
          status: 'UNDERWAY',
          destination: 'Hong Kong',
          eta: '2024-01-02T08:00:00Z',
          ais: {
            mmsi: '123456789',
            call_sign: 'TEST123',
            vessel_name: 'Test Vessel',
            vessel_type: 'Container Ship'
          }
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getVesselPosition('1234567');

      expect(result.imoNumber).toBe('1234567');
      expect(result.position.latitude).toBe(1.2966);
      expect(result.status).toBe('UNDERWAY');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/vessels/1234567/position');
    });

    it('should track multiple vessels', async () => {
      const imoNumbers = ['1234567', '7654321'];
      
      const mockResponse = {
        data: {
          vessel_id: 'VESSEL001',
          imo_number: '1234567',
          position: { lat: 1.2966, lon: 103.7764, timestamp: '2024-01-01T12:00:00Z' },
          course: 180,
          speed: 15,
          status: 'UNDERWAY',
          destination: 'Hong Kong',
          eta: '2024-01-02T08:00:00Z',
          ais: {
            mmsi: '123456789',
            call_sign: 'TEST123',
            vessel_name: 'Test Vessel',
            vessel_type: 'Container Ship'
          }
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.trackMultipleVessels(imoNumbers);

      expect(result).toHaveLength(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockAxiosInstance.get.mockRejectedValue(error);
      vi.mocked(redis.get).mockResolvedValue(null);

      await expect(service.searchIMPACatalog({ searchTerm: 'test' }))
        .rejects.toThrow('API Error');
    });

    it('should handle network timeouts', async () => {
      const timeoutError = { code: 'ECONNABORTED', message: 'timeout' };
      mockAxiosInstance.get.mockRejectedValue(timeoutError);
      vi.mocked(redis.get).mockResolvedValue(null);

      await expect(service.getPortInformation('SGSIN'))
        .rejects.toMatchObject({ message: 'timeout' });
    });
  });
});

describe('BankingApiIntegrationService', () => {
  let service: BankingApiIntegrationService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    };

    mockedAxios.create = vi.fn().mockReturnValue(mockAxiosInstance);
    
    service = new BankingApiIntegrationService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Exchange Rate Management', () => {
    it('should get current exchange rates', async () => {
      const mockResponse = {
        data: {
          rates: [
            {
              from_currency: 'USD',
              to_currency: 'EUR',
              rate: 0.85,
              timestamp: '2024-01-01T12:00:00Z',
              source: 'ECB',
              bid: 0.849,
              ask: 0.851,
              spread: 0.002
            }
          ]
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getCurrentExchangeRates(['USD', 'EUR']);

      expect(result).toHaveLength(1);
      expect(result[0].fromCurrency).toBe('USD');
      expect(result[0].toCurrency).toBe('EUR');
      expect(result[0].rate).toBe(0.85);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/rates', {
        params: {
          currencies: 'USD,EUR',
          include_spread: true
        }
      });
    });

    it('should get historical exchange rates', async () => {
      const mockResponse = {
        data: {
          rates: [
            {
              from_currency: 'USD',
              to_currency: 'EUR',
              rate: 0.85,
              timestamp: '2024-01-01T12:00:00Z',
              source: 'ECB',
              bid: 0.849,
              ask: 0.851,
              spread: 0.002
            }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getHistoricalExchangeRates(
        'USD',
        'EUR',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/rates/historical', {
        params: {
          from: 'USD',
          to: 'EUR',
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        }
      });
    });
  });

  describe('Account Management', () => {
    it('should get bank accounts', async () => {
      const mockResponse = {
        data: {
          accounts: [
            {
              account_id: 'ACC001',
              account_number: '1234567890',
              bank_code: 'BANK001',
              bank_name: 'Test Bank',
              currency: 'USD',
              balance: 100000,
              account_type: 'BUSINESS',
              status: 'ACTIVE',
              country: 'US'
            }
          ]
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getBankAccounts();

      expect(result).toHaveLength(1);
      expect(result[0].accountId).toBe('ACC001');
      expect(result[0].balance).toBe(100000);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/accounts');
    });

    it('should get account balance', async () => {
      const mockResponse = {
        data: { balance: 50000 }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getAccountBalance('ACC001');

      expect(result).toBe(50000);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/accounts/ACC001/balance');
    });
  });

  describe('Payment Processing', () => {
    it('should initiate payment successfully', async () => {
      const mockComplianceResponse = {
        data: {
          status: 'APPROVED',
          details: 'All checks passed'
        }
      };

      const mockPaymentResponse = {
        data: {
          payment_id: 'PAY001',
          status: 'PENDING',
          status_details: 'Payment initiated',
          fees: [],
          tracking_reference: 'TRK001'
        }
      };

      // Mock compliance checks
      mockAxiosInstance.post
        .mockResolvedValueOnce(mockComplianceResponse) // AML
        .mockResolvedValueOnce(mockComplianceResponse) // Sanctions
        .mockResolvedValueOnce(mockComplianceResponse) // KYC
        .mockResolvedValueOnce(mockPaymentResponse); // Payment

      const instruction = {
        paymentId: 'PAY001',
        fromAccount: 'ACC001',
        toAccount: 'ACC002',
        amount: 1000,
        currency: 'USD',
        paymentMethod: 'SWIFT' as const,
        urgency: 'STANDARD' as const,
        reference: 'Test Payment',
        beneficiaryDetails: {
          name: 'Test Beneficiary',
          address: '123 Test St',
          bankName: 'Test Bank',
          bankAddress: '456 Bank St',
          accountNumber: '9876543210',
          swiftCode: 'TESTUS33',
          country: 'US'
        }
      };

      const result = await service.initiatePayment(instruction);

      expect(result.paymentId).toBe('PAY001');
      expect(result.status).toBe('PENDING');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(4); // 3 compliance + 1 payment
    });

    it('should reject payment due to compliance issues', async () => {
      const mockComplianceResponse = {
        data: {
          status: 'REJECTED',
          details: 'Sanctions match found'
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockComplianceResponse);

      const instruction = {
        paymentId: 'PAY001',
        fromAccount: 'ACC001',
        toAccount: 'ACC002',
        amount: 1000,
        currency: 'USD',
        paymentMethod: 'SWIFT' as const,
        urgency: 'STANDARD' as const,
        reference: 'Test Payment',
        beneficiaryDetails: {
          name: 'Sanctioned Entity',
          address: '123 Test St',
          bankName: 'Test Bank',
          bankAddress: '456 Bank St',
          accountNumber: '9876543210',
          country: 'US'
        }
      };

      await expect(service.initiatePayment(instruction))
        .rejects.toThrow('Payment rejected due to compliance issues');
    });

    it('should get payment status', async () => {
      const mockResponse = {
        data: {
          payment_id: 'PAY001',
          status: 'COMPLETED',
          status_details: 'Payment completed successfully',
          fees: [
            {
              type: 'TRANSFER',
              amount: 25,
              currency: 'USD',
              description: 'Wire transfer fee'
            }
          ],
          exchange_rate_used: 1.0,
          actual_amount: 1000,
          completed_at: '2024-01-01T15:00:00Z',
          tracking_reference: 'TRK001'
        }
      };

      vi.mocked(redis.get).mockResolvedValue(null);
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await service.getPaymentStatus('PAY001');

      expect(result.paymentId).toBe('PAY001');
      expect(result.status).toBe('COMPLETED');
      expect(result.fees).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/payments/PAY001/status');
    });
  });

  describe('Compliance Checks', () => {
    it('should perform all compliance checks', async () => {
      const mockAMLResponse = {
        data: { status: 'APPROVED', details: 'No AML issues found' }
      };
      const mockSanctionsResponse = {
        data: { status: 'APPROVED', details: 'No sanctions match' }
      };
      const mockKYCResponse = {
        data: { status: 'APPROVED', details: 'KYC verified' }
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce(mockAMLResponse)
        .mockResolvedValueOnce(mockSanctionsResponse)
        .mockResolvedValueOnce(mockKYCResponse);

      const beneficiary = {
        name: 'Test Beneficiary',
        address: '123 Test St',
        bankName: 'Test Bank',
        bankAddress: '456 Bank St',
        accountNumber: '9876543210',
        country: 'US'
      };

      const result = await service.performComplianceChecks(beneficiary);

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('AML');
      expect(result[1].type).toBe('SANCTIONS');
      expect(result[2].type).toBe('KYC');
      expect(result.every(check => check.status === 'APPROVED')).toBe(true);
    });
  });
});
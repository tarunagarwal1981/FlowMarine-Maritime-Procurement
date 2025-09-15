import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken } from '../utils/jwt.js';

const prisma = new PrismaClient();

describe('Item Catalog Search and Management', () => {
  let authToken: string;
  let testUserId: string;
  let testItemId: string;

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'catalog.test@example.com',
        passwordHash: 'hashedpassword',
        firstName: 'Catalog',
        lastName: 'Tester',
        role: 'PROCUREMENT_MANAGER',
        emailVerified: true
      }
    });
    testUserId = testUser.id;
    authToken = generateAccessToken(testUserId);

    // Create test item
    const testItem = await prisma.itemCatalog.create({
      data: {
        name: 'Test Marine Engine Part',
        impaCode: 'TEST001',
        issaCode: 'TST001',
        category: 'ENGINE_PARTS',
        criticalityLevel: 'OPERATIONAL_CRITICAL',
        description: 'A test engine part for maritime vessels',
        unitOfMeasure: 'piece',
        averagePrice: 150.00,
        averagePriceCurrency: 'USD',
        leadTime: 14,
        compatibleVesselTypes: ['CARGO', 'TANKER'],
        compatibleEngineTypes: ['DIESEL', 'MARINE_DIESEL'],
        specifications: {
          dimensions: {
            length: { value: '100', unit: 'mm' },
            width: { value: '50', unit: 'mm' },
            height: { value: '25', unit: 'mm' }
          },
          weight: { value: '2.5', unit: 'kg' },
          material: 'Stainless Steel',
          manufacturer: 'Test Marine Co.'
        }
      }
    });
    testItemId = testItem.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.itemCatalog.deleteMany({
      where: { name: { contains: 'Test' } }
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'catalog.test' } }
    });
    await prisma.$disconnect();
  });

  describe('Advanced Search Functionality', () => {
    it('should search items by name with autocomplete', async () => {
      const response = await request(app)
        .get('/api/item-catalog/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'Test Marine' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Test Marine Engine Part');
    });

    it('should handle fuzzy search variations', async () => {
      const response = await request(app)
        .get('/api/item-catalog/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'engine part' }); // Should match "Engine Part"

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should search in specifications', async () => {
      const response = await request(app)
        .get('/api/item-catalog/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'Stainless Steel' }); // Should find items with this material

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should provide advanced autocomplete suggestions', async () => {
      const response = await request(app)
        .get('/api/item-catalog/autocomplete/advanced')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          query: 'Test',
          field: 'all',
          limit: '10'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Test Marine Engine Part');
      expect(response.body.data[0]).toHaveProperty('relevanceScore');
      expect(response.body.data[0]).toHaveProperty('matchedField');
    });

    it('should filter by vessel and engine compatibility', async () => {
      const response = await request(app)
        .get('/api/item-catalog/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          vesselType: 'CARGO',
          engineType: 'DIESEL'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      const item = response.body.data.find((item: any) => item.id === testItemId);
      expect(item).toBeDefined();
    });

    it('should search by IMPA code', async () => {
      const response = await request(app)
        .get('/api/item-catalog/impa/TEST001')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.impaCode).toBe('TEST001');
    });

    it('should search by ISSA code', async () => {
      const response = await request(app)
        .get('/api/item-catalog/issa/TST001')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.issaCode).toBe('TST001');
    });
  });

  describe('Pricing Analytics', () => {
    it('should get items with pricing analytics', async () => {
      const response = await request(app)
        .get('/api/item-catalog/search/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          includePricingTrends: 'true',
          includeLeadTimeTrends: 'true'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should update average pricing', async () => {
      const response = await request(app)
        .put(`/api/item-catalog/${testItemId}/pricing`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          price: 175.00,
          currency: 'USD',
          leadTime: 16
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.averagePrice).toBe(175.00);
      expect(response.body.data.leadTime).toBe(16);
    });

    it('should perform bulk pricing update from quotes', async () => {
      const response = await request(app)
        .post('/api/item-catalog/pricing/bulk-update')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemIds: [testItemId]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Specification Management', () => {
    it('should get specification templates', async () => {
      const response = await request(app)
        .get('/api/item-catalog/specifications/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ category: 'ENGINE_PARTS' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('dimensions');
      expect(response.body.data).toHaveProperty('weight');
      expect(response.body.data).toHaveProperty('material');
    });

    it('should update item specifications', async () => {
      const newSpecifications = {
        dimensions: {
          length: { value: '120', unit: 'mm' },
          width: { value: '60', unit: 'mm' },
          height: { value: '30', unit: 'mm' }
        },
        weight: { value: '3.0', unit: 'kg' },
        material: 'Marine Grade Stainless Steel',
        manufacturer: 'Updated Marine Co.',
        customField: 'Custom specification value'
      };

      const response = await request(app)
        .put(`/api/item-catalog/${testItemId}/specifications`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ specifications: newSpecifications });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.specifications.dimensions.length.value).toBe('120');
      expect(response.body.data.specifications.customField).toBe('Custom specification value');
    });

    it('should maintain specification history', async () => {
      // Get the updated item to verify specifications were saved
      const response = await request(app)
        .get(`/api/item-catalog/${testItemId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.specifications).toHaveProperty('lastUpdated');
      expect(response.body.data.specifications).toHaveProperty('updatedBy');
    });
  });

  describe('Vessel Compatibility', () => {
    it('should check vessel compatibility for items', async () => {
      const response = await request(app)
        .post('/api/item-catalog/compatibility/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemIds: [testItemId],
          vesselType: 'CARGO',
          engineType: 'DIESEL'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].compatible).toBe(true);
      expect(response.body.data[0].vesselTypeCompatible).toBe(true);
      expect(response.body.data[0].engineTypeCompatible).toBe(true);
    });

    it('should detect incompatible vessel types', async () => {
      const response = await request(app)
        .post('/api/item-catalog/compatibility/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemIds: [testItemId],
          vesselType: 'PASSENGER',
          engineType: 'DIESEL'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].compatible).toBe(false);
      expect(response.body.data[0].vesselTypeCompatible).toBe(false);
      expect(response.body.data[0].engineTypeCompatible).toBe(true);
    });
  });

  describe('Category Management', () => {
    it('should get maritime categories with counts', async () => {
      const response = await request(app)
        .get('/api/item-catalog/categories')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      const enginePartsCategory = response.body.data.find(
        (cat: any) => cat.category === 'ENGINE_PARTS'
      );
      expect(enginePartsCategory).toBeDefined();
      expect(enginePartsCategory.count).toBeGreaterThan(0);
    });

    it('should get items by category with criticality grouping', async () => {
      const response = await request(app)
        .get('/api/item-catalog/categories/ENGINE_PARTS')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('SAFETY_CRITICAL');
      expect(response.body.data).toHaveProperty('OPERATIONAL_CRITICAL');
      expect(response.body.data).toHaveProperty('ROUTINE');
      expect(response.body.data.OPERATIONAL_CRITICAL).toHaveLength(1);
    });
  });

  describe('Search Analytics', () => {
    it('should get search analytics', async () => {
      const response = await request(app)
        .get('/api/item-catalog/analytics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('categoryBreakdown');
      expect(response.body.data).toHaveProperty('criticalityBreakdown');
      expect(response.body.data).toHaveProperty('pricingStats');
      expect(response.body.data).toHaveProperty('leadTimeStats');
    });

    it('should filter analytics by vessel type', async () => {
      const response = await request(app)
        .get('/api/item-catalog/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ vesselType: 'CARGO' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overview.totalItems).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid item ID', async () => {
      const response = await request(app)
        .get('/api/item-catalog/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/item-catalog/search');

      expect(response.status).toBe(401);
    });

    it('should validate autocomplete query length', async () => {
      const response = await request(app)
        .get('/api/item-catalog/autocomplete/advanced')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ query: 'a' }); // Too short

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 2 characters');
    });
  });
});
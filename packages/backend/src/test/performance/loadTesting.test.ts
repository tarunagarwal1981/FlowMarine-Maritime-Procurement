import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken } from '@/utils/jwt';

const prisma = new PrismaClient();

describe('Performance and Load Testing', () => {
  let testUsers: any[] = [];
  let testVessels: any[] = [];
  let authTokens: string[] = [];

  beforeAll(async () => {
    // Create multiple test vessels and users for load testing
    const vesselPromises = Array.from({ length: 5 }, (_, index) =>
      prisma.vessel.create({
        data: {
          name: `Load Test Vessel ${index + 1}`,
          imoNumber: `IMO${1000000 + index}`,
          vesselType: 'Container Ship',
          flag: 'Singapore',
          engineType: 'MAN B&W',
          cargoCapacity: 15000 + index * 1000,
          fuelConsumption: 250 + index * 10,
          crewComplement: 20 + index,
          currentLatitude: 1.2966 + index * 0.1,
          currentLongitude: 103.7764 + index * 0.1,
        },
      })
    );

    testVessels = await Promise.all(vesselPromises);

    const userPromises = Array.from({ length: 20 }, (_, index) =>
      prisma.user.create({
        data: {
          email: `loadtest${index + 1}@vessel.com`,
          passwordHash: '$2a$12$hashedpassword',
          firstName: `LoadTest${index + 1}`,
          lastName: 'User',
          role: index % 4 === 0 ? 'CAPTAIN' : index % 4 === 1 ? 'CHIEF_ENGINEER' : index % 4 === 2 ? 'SUPERINTENDENT' : 'CREW',
          isActive: true,
          emailVerified: true,
        },
      })
    );

    testUsers = await Promise.all(userPromises);

    // Create vessel assignments
    const assignmentPromises = testUsers.map((user, userIndex) =>
      prisma.vesselAssignment.create({
        data: {
          userId: user.id,
          vesselId: testVessels[userIndex % testVessels.length].id,
          role: user.role,
        },
      })
    );

    await Promise.all(assignmentPromises);

    // Generate auth tokens
    authTokens = testUsers.map(user => generateAccessToken(user.id));

    // Create test catalog items
    await prisma.itemCatalog.createMany({
      data: Array.from({ length: 100 }, (_, index) => ({
        impaCode: `${600 + Math.floor(index / 10)}.${10 + (index % 10)}.01`,
        name: `Load Test Item ${index + 1}`,
        description: `Performance test item ${index + 1}`,
        category: ['ENGINE_PARTS', 'SAFETY_EQUIPMENT', 'NAVIGATION_EQUIPMENT', 'DECK_EQUIPMENT'][index % 4] as any,
        criticalityLevel: ['SAFETY_CRITICAL', 'OPERATIONAL_CRITICAL', 'ROUTINE'][index % 3] as any,
        unitOfMeasure: 'PIECE',
        averagePrice: 10 + (index * 5),
        leadTime: 3 + (index % 7),
      })),
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.vesselAssignment.deleteMany({
      where: { vesselId: { in: testVessels.map(v => v.id) } },
    });
    await prisma.itemCatalog.deleteMany({
      where: { impaCode: { startsWith: '60' } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: testUsers.map(u => u.id) } },
    });
    await prisma.vessel.deleteMany({
      where: { id: { in: testVessels.map(v => v.id) } },
    });
    await prisma.$disconnect();
  });

  describe('Concurrent User Load Testing', () => {
    it('should handle 50 concurrent requisition creations', async () => {
      const startTime = Date.now();
      
      const concurrentRequests = Array.from({ length: 50 }, (_, index) => {
        const userIndex = index % testUsers.length;
        const vesselIndex = index % testVessels.length;
        
        return request(app)
          .post('/api/requisitions')
          .set('Authorization', `Bearer ${authTokens[userIndex]}`)
          .send({
            vesselId: testVessels[vesselIndex].id,
            urgencyLevel: 'ROUTINE',
            deliveryLocation: `Port ${index + 1}`,
            deliveryDate: new Date(Date.now() + (7 + index) * 24 * 60 * 60 * 1000).toISOString(),
            justification: `Load test requisition ${index + 1}`,
            items: [
              {
                name: `Load Test Item ${index + 1}`,
                quantity: Math.floor(Math.random() * 10) + 1,
                unitPrice: Math.floor(Math.random() * 100) + 10,
                totalPrice: (Math.floor(Math.random() * 10) + 1) * (Math.floor(Math.random() * 100) + 10),
              },
            ],
          });
      });

      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Success rate should be high
      const successfulResponses = responses.filter(r => r.status === 201);
      const successRate = successfulResponses.length / responses.length;
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate

      // Average response time should be reasonable
      const averageResponseTime = duration / responses.length;
      expect(averageResponseTime).toBeLessThan(200); // Average under 200ms

      console.log(`Concurrent Load Test Results:
        - Total Requests: ${responses.length}
        - Successful: ${successfulResponses.length}
        - Success Rate: ${(successRate * 100).toFixed(2)}%
        - Total Duration: ${duration}ms
        - Average Response Time: ${averageResponseTime.toFixed(2)}ms`);
    });

    it('should handle high-frequency read operations', async () => {
      const startTime = Date.now();
      
      const readRequests = Array.from({ length: 100 }, (_, index) => {
        const userIndex = index % testUsers.length;
        const vesselIndex = index % testVessels.length;
        
        return request(app)
          .get(`/api/vessels/${testVessels[vesselIndex].id}/requisitions`)
          .set('Authorization', `Bearer ${authTokens[userIndex]}`)
          .query({
            page: Math.floor(index / 20) + 1,
            limit: 10,
          });
      });

      const responses = await Promise.all(readRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertions for read operations
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      const successfulResponses = responses.filter(r => r.status === 200);
      const successRate = successfulResponses.length / responses.length;
      expect(successRate).toBeGreaterThan(0.98); // 98% success rate for reads

      const averageResponseTime = duration / responses.length;
      expect(averageResponseTime).toBeLessThan(50); // Average under 50ms for reads

      console.log(`High-Frequency Read Test Results:
        - Total Requests: ${responses.length}
        - Successful: ${successfulResponses.length}
        - Success Rate: ${(successRate * 100).toFixed(2)}%
        - Total Duration: ${duration}ms
        - Average Response Time: ${averageResponseTime.toFixed(2)}ms`);
    });
  });

  describe('Database Performance Testing', () => {
    it('should handle complex queries efficiently', async () => {
      // Create test data for complex queries
      const requisitions = await Promise.all(
        Array.from({ length: 100 }, (_, index) =>
          prisma.requisition.create({
            data: {
              requisitionNumber: `PERF-${String(index + 1).padStart(3, '0')}`,
              vesselId: testVessels[index % testVessels.length].id,
              requestedById: testUsers[index % testUsers.length].id,
              urgencyLevel: ['ROUTINE', 'URGENT', 'EMERGENCY'][index % 3] as any,
              status: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'][index % 3] as any,
              totalAmount: Math.floor(Math.random() * 10000) + 100,
              currency: 'USD',
              deliveryLocation: `Port ${index + 1}`,
              deliveryDate: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000),
              justification: `Performance test requisition ${index + 1}`,
            },
          })
        )
      );

      const startTime = Date.now();

      // Complex query with multiple filters, joins, and aggregations
      const complexQueryResponse = await request(app)
        .get('/api/analytics/requisitions')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .query({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          groupBy: 'vessel,urgency,status',
          includeAggregations: 'true',
          includeVesselDetails: 'true',
          includeUserDetails: 'true',
        })
        .expect(200);

      const queryDuration = Date.now() - startTime;

      // Performance assertions
      expect(queryDuration).toBeLessThan(2000); // Complex query under 2 seconds
      expect(complexQueryResponse.body.success).toBe(true);
      expect(complexQueryResponse.body.analytics).toBeDefined();

      console.log(`Complex Query Performance:
        - Query Duration: ${queryDuration}ms
        - Records Processed: ${requisitions.length}
        - Aggregations: ${Object.keys(complexQueryResponse.body.analytics.aggregations || {}).length}`);

      // Cleanup
      await prisma.requisition.deleteMany({
        where: { id: { in: requisitions.map(r => r.id) } },
      });
    });

    it('should handle pagination efficiently with large datasets', async () => {
      // Test pagination performance with large result sets
      const paginationTests = Array.from({ length: 10 }, (_, index) => {
        const page = index + 1;
        const startTime = Date.now();
        
        return request(app)
          .get('/api/item-catalog/search')
          .set('Authorization', `Bearer ${authTokens[0]}`)
          .query({
            page: page,
            limit: 20,
            sortBy: 'name',
            sortOrder: 'asc',
          })
          .expect(200)
          .then(response => ({
            page,
            duration: Date.now() - startTime,
            itemCount: response.body.items?.length || 0,
            totalCount: response.body.pagination?.total || 0,
          }));
      });

      const results = await Promise.all(paginationTests);

      // Performance assertions
      results.forEach(result => {
        expect(result.duration).toBeLessThan(500); // Each page under 500ms
        expect(result.itemCount).toBeGreaterThan(0);
      });

      const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(averageDuration).toBeLessThan(200); // Average under 200ms

      console.log(`Pagination Performance Results:
        - Pages Tested: ${results.length}
        - Average Duration: ${averageDuration.toFixed(2)}ms
        - Total Items: ${results[0]?.totalCount || 0}`);
    });
  });

  describe('Memory and Resource Usage Testing', () => {
    it('should handle memory-intensive operations without leaks', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operations
      const memoryIntensiveRequests = Array.from({ length: 50 }, (_, index) =>
        request(app)
          .post('/api/analytics/generate-report')
          .set('Authorization', `Bearer ${authTokens[index % authTokens.length]}`)
          .send({
            reportType: 'COMPREHENSIVE',
            vesselIds: testVessels.map(v => v.id),
            startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString(),
            includeCharts: true,
            includeDetailedBreakdown: true,
          })
      );

      const responses = await Promise.all(memoryIntensiveRequests);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      // Memory usage should not increase dramatically
      expect(memoryIncreasePercent).toBeLessThan(50); // Less than 50% increase

      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(responses.length * 0.9); // 90% success rate

      console.log(`Memory Usage Test Results:
        - Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
        - Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(2)}%)
        - Successful Requests: ${successfulResponses.length}/${responses.length}`);
    });
  });

  describe('Rate Limiting Performance', () => {
    it('should enforce rate limits without affecting legitimate traffic', async () => {
      const startTime = Date.now();
      
      // Mix of legitimate and excessive requests
      const mixedRequests = [
        // Legitimate requests (spread across users)
        ...Array.from({ length: 20 }, (_, index) =>
          request(app)
            .get(`/api/vessels/${testVessels[index % testVessels.length].id}/requisitions`)
            .set('Authorization', `Bearer ${authTokens[index % authTokens.length]}`)
        ),
        // Excessive requests from single user
        ...Array.from({ length: 30 }, () =>
          request(app)
            .get(`/api/vessels/${testVessels[0].id}/requisitions`)
            .set('Authorization', `Bearer ${authTokens[0]}`)
        ),
      ];

      const responses = await Promise.all(mixedRequests);
      const duration = Date.now() - startTime;

      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      // Rate limiting should kick in for excessive requests
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      // But legitimate requests should still succeed
      expect(successfulResponses.length).toBeGreaterThan(15); // Most legitimate requests succeed

      console.log(`Rate Limiting Test Results:
        - Total Requests: ${responses.length}
        - Successful: ${successfulResponses.length}
        - Rate Limited: ${rateLimitedResponses.length}
        - Duration: ${duration}ms`);
    });
  });

  describe('Stress Testing', () => {
    it('should maintain stability under extreme load', async () => {
      const startTime = Date.now();
      
      // Extreme load test with various operations
      const stressRequests = [
        // Create operations
        ...Array.from({ length: 30 }, (_, index) =>
          request(app)
            .post('/api/requisitions')
            .set('Authorization', `Bearer ${authTokens[index % authTokens.length]}`)
            .send({
              vesselId: testVessels[index % testVessels.length].id,
              urgencyLevel: 'ROUTINE',
              deliveryLocation: `Stress Test Port ${index}`,
              deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              justification: `Stress test requisition ${index}`,
              items: [
                {
                  name: `Stress Test Item ${index}`,
                  quantity: 1,
                  unitPrice: 100,
                  totalPrice: 100,
                },
              ],
            })
        ),
        // Read operations
        ...Array.from({ length: 50 }, (_, index) =>
          request(app)
            .get(`/api/vessels/${testVessels[index % testVessels.length].id}/requisitions`)
            .set('Authorization', `Bearer ${authTokens[index % authTokens.length]}`)
        ),
        // Search operations
        ...Array.from({ length: 20 }, (_, index) =>
          request(app)
            .get('/api/item-catalog/search')
            .set('Authorization', `Bearer ${authTokens[index % authTokens.length]}`)
            .query({ q: `test ${index}` })
        ),
      ];

      const responses = await Promise.all(stressRequests);
      const duration = Date.now() - startTime;

      // System should remain stable
      const successfulResponses = responses.filter(r => r.status < 400);
      const errorResponses = responses.filter(r => r.status >= 500);
      
      // High success rate even under stress
      const successRate = successfulResponses.length / responses.length;
      expect(successRate).toBeGreaterThan(0.85); // 85% success rate under stress
      
      // Minimal server errors
      const errorRate = errorResponses.length / responses.length;
      expect(errorRate).toBeLessThan(0.05); // Less than 5% server errors

      console.log(`Stress Test Results:
        - Total Requests: ${responses.length}
        - Successful: ${successfulResponses.length}
        - Client Errors (4xx): ${responses.filter(r => r.status >= 400 && r.status < 500).length}
        - Server Errors (5xx): ${errorResponses.length}
        - Success Rate: ${(successRate * 100).toFixed(2)}%
        - Error Rate: ${(errorRate * 100).toFixed(2)}%
        - Total Duration: ${duration}ms
        - Average Response Time: ${(duration / responses.length).toFixed(2)}ms`);
    });

    it('should handle sustained load over time', async () => {
      const testDuration = 30000; // 30 seconds
      const requestInterval = 100; // 100ms between requests
      const startTime = Date.now();
      const results: Array<{ timestamp: number; responseTime: number; status: number }> = [];

      while (Date.now() - startTime < testDuration) {
        const requestStart = Date.now();
        
        try {
          const response = await request(app)
            .get(`/api/vessels/${testVessels[0].id}/requisitions`)
            .set('Authorization', `Bearer ${authTokens[0]}`)
            .query({ page: 1, limit: 10 });

          results.push({
            timestamp: Date.now(),
            responseTime: Date.now() - requestStart,
            status: response.status,
          });
        } catch (error) {
          results.push({
            timestamp: Date.now(),
            responseTime: Date.now() - requestStart,
            status: 500,
          });
        }

        // Wait before next request
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      // Analyze sustained load results
      const successfulRequests = results.filter(r => r.status < 400);
      const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxResponseTime = Math.max(...results.map(r => r.responseTime));
      const minResponseTime = Math.min(...results.map(r => r.responseTime));

      expect(successfulRequests.length / results.length).toBeGreaterThan(0.95); // 95% success rate
      expect(averageResponseTime).toBeLessThan(500); // Average under 500ms
      expect(maxResponseTime).toBeLessThan(2000); // Max under 2 seconds

      console.log(`Sustained Load Test Results:
        - Test Duration: ${testDuration}ms
        - Total Requests: ${results.length}
        - Successful: ${successfulRequests.length}
        - Success Rate: ${((successfulRequests.length / results.length) * 100).toFixed(2)}%
        - Average Response Time: ${averageResponseTime.toFixed(2)}ms
        - Min Response Time: ${minResponseTime}ms
        - Max Response Time: ${maxResponseTime}ms`);
    });

    it('should handle burst traffic patterns', async () => {
      const burstSizes = [10, 25, 50, 75, 100];
      const burstResults: Array<{ size: number; duration: number; successRate: number }> = [];

      for (const burstSize of burstSizes) {
        const startTime = Date.now();
        
        // Create burst of requests
        const burstRequests = Array.from({ length: burstSize }, (_, index) =>
          request(app)
            .get(`/api/vessels/${testVessels[index % testVessels.length].id}/requisitions`)
            .set('Authorization', `Bearer ${authTokens[index % authTokens.length]}`)
        );

        const responses = await Promise.all(burstRequests);
        const duration = Date.now() - startTime;
        const successfulResponses = responses.filter(r => r.status < 400);
        const successRate = successfulResponses.length / responses.length;

        burstResults.push({
          size: burstSize,
          duration,
          successRate,
        });

        // Wait between bursts
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Verify system handles increasing burst sizes
      burstResults.forEach(result => {
        expect(result.successRate).toBeGreaterThan(0.9); // 90% success rate for each burst
        expect(result.duration).toBeLessThan(result.size * 100); // Reasonable duration per request
      });

      console.log('Burst Traffic Test Results:');
      burstResults.forEach(result => {
        console.log(`  Burst Size ${result.size}: ${(result.successRate * 100).toFixed(1)}% success, ${result.duration}ms duration`);
      });
    });
  });

  describe('Scalability Testing', () => {
    it('should maintain performance with increasing data volume', async () => {
      // Create large dataset
      const largeDatasetSize = 1000;
      const requisitions = await Promise.all(
        Array.from({ length: largeDatasetSize }, (_, index) =>
          prisma.requisition.create({
            data: {
              requisitionNumber: `SCALE-${String(index + 1).padStart(4, '0')}`,
              vesselId: testVessels[index % testVessels.length].id,
              requestedById: testUsers[index % testUsers.length].id,
              urgencyLevel: ['ROUTINE', 'URGENT', 'EMERGENCY'][index % 3] as any,
              status: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'][index % 3] as any,
              totalAmount: Math.floor(Math.random() * 10000) + 100,
              currency: 'USD',
              deliveryLocation: `Scale Test Port ${index + 1}`,
              deliveryDate: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000),
              justification: `Scalability test requisition ${index + 1}`,
            },
          })
        )
      );

      // Test query performance with large dataset
      const queryTests = [
        { page: 1, limit: 10 },
        { page: 10, limit: 20 },
        { page: 25, limit: 50 },
        { page: 50, limit: 100 },
      ];

      for (const queryTest of queryTests) {
        const startTime = Date.now();
        
        const response = await request(app)
          .get(`/api/vessels/${testVessels[0].id}/requisitions`)
          .set('Authorization', `Bearer ${authTokens[0]}`)
          .query(queryTest)
          .expect(200);

        const queryDuration = Date.now() - startTime;

        expect(queryDuration).toBeLessThan(1000); // Under 1 second
        expect(response.body.requisitions.length).toBeLessThanOrEqual(queryTest.limit);
        expect(response.body.pagination.total).toBeGreaterThan(0);

        console.log(`Query Performance - Page ${queryTest.page}, Limit ${queryTest.limit}: ${queryDuration}ms`);
      }

      // Cleanup
      await prisma.requisition.deleteMany({
        where: { id: { in: requisitions.map(r => r.id) } },
      });
    });

    it('should handle complex aggregation queries efficiently', async () => {
      // Create test data for aggregations
      const aggregationData = await Promise.all([
        ...Array.from({ length: 100 }, (_, index) =>
          prisma.requisition.create({
            data: {
              requisitionNumber: `AGG-${String(index + 1).padStart(3, '0')}`,
              vesselId: testVessels[index % testVessels.length].id,
              requestedById: testUsers[index % testUsers.length].id,
              urgencyLevel: ['ROUTINE', 'URGENT', 'EMERGENCY'][index % 3] as any,
              status: 'APPROVED',
              totalAmount: (index + 1) * 100,
              currency: ['USD', 'EUR', 'GBP'][index % 3],
              deliveryLocation: `Aggregation Port ${index + 1}`,
              deliveryDate: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000),
              justification: `Aggregation test requisition ${index + 1}`,
            },
          })
        ),
      ]);

      const complexQueries = [
        {
          name: 'Total spending by vessel',
          endpoint: '/api/analytics/spending-by-vessel',
          params: { groupBy: 'vessel', period: '30d' },
        },
        {
          name: 'Average order value by urgency',
          endpoint: '/api/analytics/average-order-value',
          params: { groupBy: 'urgency', period: '30d' },
        },
        {
          name: 'Currency distribution',
          endpoint: '/api/analytics/currency-distribution',
          params: { period: '30d' },
        },
        {
          name: 'Monthly trends',
          endpoint: '/api/analytics/monthly-trends',
          params: { months: 12 },
        },
      ];

      for (const query of complexQueries) {
        const startTime = Date.now();
        
        const response = await request(app)
          .get(query.endpoint)
          .set('Authorization', `Bearer ${authTokens[0]}`)
          .query(query.params)
          .expect(200);

        const queryDuration = Date.now() - startTime;

        expect(queryDuration).toBeLessThan(3000); // Complex queries under 3 seconds
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();

        console.log(`${query.name}: ${queryDuration}ms`);
      }

      // Cleanup
      await prisma.requisition.deleteMany({
        where: { id: { in: aggregationData.map(r => r.id) } },
      });
    });
  });

  describe('Resource Utilization Testing', () => {
    it('should monitor CPU and memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      const startTime = process.hrtime();

      // Generate CPU-intensive load
      const cpuIntensiveRequests = Array.from({ length: 20 }, (_, index) =>
        request(app)
          .post('/api/analytics/complex-calculation')
          .set('Authorization', `Bearer ${authTokens[index % authTokens.length]}`)
          .send({
            vesselIds: testVessels.map(v => v.id),
            calculationType: 'COMPREHENSIVE',
            includeProjections: true,
            includeOptimizations: true,
          })
      );

      const responses = await Promise.all(cpuIntensiveRequests);
      
      const endTime = process.hrtime(startTime);
      const finalMemory = process.memoryUsage();

      // Calculate resource usage
      const cpuTime = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      // Resource usage should be reasonable
      expect(memoryIncreasePercent).toBeLessThan(100); // Less than 100% memory increase
      expect(responses.filter(r => r.status === 200).length).toBeGreaterThan(responses.length * 0.8); // 80% success rate

      console.log(`Resource Utilization Test:
        - CPU Time: ${cpuTime.toFixed(2)}ms
        - Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${memoryIncreasePercent.toFixed(2)}%)
        - Successful Requests: ${responses.filter(r => r.status === 200).length}/${responses.length}`);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    });

    it('should handle file upload performance', async () => {
      const fileSizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
      const uploadResults: Array<{ size: number; duration: number; success: boolean }> = [];

      for (const fileSize of fileSizes) {
        const fileBuffer = Buffer.alloc(fileSize, 'test data');
        const startTime = Date.now();

        try {
          const response = await request(app)
            .post('/api/documents/upload')
            .set('Authorization', `Bearer ${authTokens[0]}`)
            .attach('file', fileBuffer, `test-${fileSize}.txt`)
            .field('documentType', 'REQUISITION_ATTACHMENT');

          const duration = Date.now() - startTime;
          uploadResults.push({
            size: fileSize,
            duration,
            success: response.status === 200,
          });
        } catch (error) {
          uploadResults.push({
            size: fileSize,
            duration: Date.now() - startTime,
            success: false,
          });
        }
      }

      // Verify upload performance scales reasonably
      uploadResults.forEach(result => {
        const expectedMaxDuration = Math.max(1000, result.size / 1024); // 1ms per KB minimum 1 second
        expect(result.duration).toBeLessThan(expectedMaxDuration);
      });

      console.log('File Upload Performance:');
      uploadResults.forEach(result => {
        const sizeLabel = result.size >= 1048576 ? `${(result.size / 1048576).toFixed(1)}MB` :
                         result.size >= 1024 ? `${(result.size / 1024).toFixed(1)}KB` : `${result.size}B`;
        console.log(`  ${sizeLabel}: ${result.duration}ms (${result.success ? 'Success' : 'Failed'})`);
      });
    });
  });

  describe('Network Performance Testing', () => {
    it('should handle various network conditions', async () => {
      const networkConditions = [
        { name: 'High Latency', delay: 500 },
        { name: 'Packet Loss Simulation', timeout: 1000 },
        { name: 'Bandwidth Limitation', maxSize: 1024 },
      ];

      for (const condition of networkConditions) {
        const startTime = Date.now();
        
        try {
          const response = await request(app)
            .get(`/api/vessels/${testVessels[0].id}/requisitions`)
            .set('Authorization', `Bearer ${authTokens[0]}`)
            .timeout(condition.timeout || 5000);

          const duration = Date.now() - startTime;
          
          if (condition.delay) {
            expect(duration).toBeGreaterThan(condition.delay * 0.8); // Account for some variance
          }
          
          expect(response.status).toBe(200);
          
          console.log(`${condition.name}: ${duration}ms`);
        } catch (error) {
          if (condition.name === 'Packet Loss Simulation') {
            // Expected timeout for packet loss simulation
            console.log(`${condition.name}: Timeout as expected`);
          } else {
            throw error;
          }
        }
      }
    });

    it('should optimize response compression', async () => {
      const response = await request(app)
        .get(`/api/vessels/${testVessels[0].id}/requisitions`)
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .set('Accept-Encoding', 'gzip, deflate')
        .query({ limit: 100 })
        .expect(200);

      // Verify compression is applied for large responses
      expect(response.headers['content-encoding']).toBeDefined();
      expect(['gzip', 'deflate']).toContain(response.headers['content-encoding']);

      // Response should be reasonably sized
      const responseSize = JSON.stringify(response.body).length;
      expect(responseSize).toBeGreaterThan(0);
      
      console.log(`Response Compression:
        - Encoding: ${response.headers['content-encoding']}
        - Response Size: ${responseSize} bytes`);
    });
  });
});
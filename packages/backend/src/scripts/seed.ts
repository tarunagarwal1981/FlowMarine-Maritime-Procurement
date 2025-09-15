import { PrismaClient, UserRole, ItemCategory, CriticalityLevel, UrgencyLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (in development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Clearing existing data...');
    await prisma.auditLog.deleteMany();
    await prisma.approval.deleteMany();
    await prisma.requisitionItem.deleteMany();
    await prisma.requisition.deleteMany();
    await prisma.vesselSpecification.deleteMany();
    await prisma.vesselCertificate.deleteMany();
    await prisma.vesselAssignment.deleteMany();
    await prisma.userPermission.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.delegation.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.vessel.deleteMany();
    await prisma.user.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.itemCatalog.deleteMany();
    await prisma.costCenter.deleteMany();
    await prisma.systemSetting.deleteMany();
    await prisma.notificationTemplate.deleteMany();
    await prisma.exchangeRate.deleteMany();
  }

  // Create permissions
  console.log('👥 Creating permissions...');
  const permissions = await Promise.all([
    // User management
    prisma.permission.create({
      data: {
        name: 'user.create',
        description: 'Create new users',
        category: 'user_management'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'user.read',
        description: 'View user information',
        category: 'user_management'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'user.update',
        description: 'Update user information',
        category: 'user_management'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'user.delete',
        description: 'Delete users',
        category: 'user_management'
      }
    }),

    // Requisition management
    prisma.permission.create({
      data: {
        name: 'requisition.create',
        description: 'Create requisitions',
        category: 'procurement'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'requisition.read',
        description: 'View requisitions',
        category: 'procurement'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'requisition.update',
        description: 'Update requisitions',
        category: 'procurement'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'requisition.approve',
        description: 'Approve requisitions',
        category: 'procurement'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'requisition.emergency_override',
        description: 'Emergency override for requisitions',
        category: 'procurement'
      }
    }),

    // Vessel management
    prisma.permission.create({
      data: {
        name: 'vessel.create',
        description: 'Create vessels',
        category: 'vessel_management'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'vessel.read',
        description: 'View vessel information',
        category: 'vessel_management'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'vessel.update',
        description: 'Update vessel information',
        category: 'vessel_management'
      }
    }),

    // Financial management
    prisma.permission.create({
      data: {
        name: 'finance.read',
        description: 'View financial information',
        category: 'financial'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'finance.approve_payment',
        description: 'Approve payments',
        category: 'financial'
      }
    }),

    // Vendor management
    prisma.permission.create({
      data: {
        name: 'vendor.create',
        description: 'Create vendors',
        category: 'vendor_management'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'vendor.read',
        description: 'View vendor information',
        category: 'vendor_management'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'vendor.update',
        description: 'Update vendor information',
        category: 'vendor_management'
      }
    }),

    // Analytics and reporting
    prisma.permission.create({
      data: {
        name: 'analytics.read',
        description: 'View analytics and reports',
        category: 'analytics'
      }
    }),
    prisma.permission.create({
      data: {
        name: 'audit.read',
        description: 'View audit logs',
        category: 'security'
      }
    }),

    // System administration
    prisma.permission.create({
      data: {
        name: 'system.admin',
        description: 'System administration',
        category: 'system'
      }
    })
  ]);

  // Create users with different roles
  console.log('👤 Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 12);

  const users = await Promise.all([
    // Admin user
    prisma.user.create({
      data: {
        email: 'admin@flowmarine.com',
        passwordHash: hashedPassword,
        firstName: 'System',
        lastName: 'Administrator',
        role: UserRole.ADMIN,
        emailVerified: true
      }
    }),

    // Superintendent
    prisma.user.create({
      data: {
        email: 'superintendent@flowmarine.com',
        passwordHash: hashedPassword,
        firstName: 'James',
        lastName: 'Morrison',
        role: UserRole.SUPERINTENDENT,
        emailVerified: true
      }
    }),

    // Procurement Manager
    prisma.user.create({
      data: {
        email: 'procurement@flowmarine.com',
        passwordHash: hashedPassword,
        firstName: 'Sarah',
        lastName: 'Chen',
        role: UserRole.PROCUREMENT_MANAGER,
        emailVerified: true
      }
    }),

    // Finance Team
    prisma.user.create({
      data: {
        email: 'finance@flowmarine.com',
        passwordHash: hashedPassword,
        firstName: 'Michael',
        lastName: 'Rodriguez',
        role: UserRole.FINANCE_TEAM,
        emailVerified: true
      }
    }),

    // Captain
    prisma.user.create({
      data: {
        email: 'captain.atlantic@flowmarine.com',
        passwordHash: hashedPassword,
        firstName: 'Captain',
        lastName: 'Anderson',
        role: UserRole.CAPTAIN,
        emailVerified: true
      }
    }),

    // Chief Engineer
    prisma.user.create({
      data: {
        email: 'engineer.atlantic@flowmarine.com',
        passwordHash: hashedPassword,
        firstName: 'Robert',
        lastName: 'Thompson',
        role: UserRole.CHIEF_ENGINEER,
        emailVerified: true
      }
    }),

    // Vessel Crew
    prisma.user.create({
      data: {
        email: 'crew.atlantic@flowmarine.com',
        passwordHash: hashedPassword,
        firstName: 'Maria',
        lastName: 'Santos',
        role: UserRole.VESSEL_CREW,
        emailVerified: true
      }
    }),

    // Another Captain for Pacific vessel
    prisma.user.create({
      data: {
        email: 'captain.pacific@flowmarine.com',
        passwordHash: hashedPassword,
        firstName: 'Captain',
        lastName: 'Kim',
        role: UserRole.CAPTAIN,
        emailVerified: true
      }
    })
  ]);

  // Assign permissions to admin
  console.log('🔐 Assigning permissions...');
  const adminPermissions = permissions.map(permission => ({
    userId: users[0].id, // Admin user
    permissionId: permission.id
  }));

  await prisma.userPermission.createMany({
    data: adminPermissions
  });

  // Create vessels
  console.log('🚢 Creating vessels...');
  const vessels = await Promise.all([
    prisma.vessel.create({
      data: {
        name: 'MV Atlantic Pioneer',
        imoNumber: '9123456',
        vesselType: 'Container Ship',
        flag: 'Panama',
        engineType: 'MAN B&W 6S60MC-C',
        cargoCapacity: 14000,
        fuelConsumption: 180,
        crewComplement: 22,
        currentLatitude: 40.7128,
        currentLongitude: -74.0060,
        positionUpdatedAt: new Date(),
        currentDeparture: 'New York',
        currentDestination: 'Rotterdam',
        currentETA: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        currentRoute: 'Trans-Atlantic'
      }
    }),

    prisma.vessel.create({
      data: {
        name: 'MV Pacific Explorer',
        imoNumber: '9234567',
        vesselType: 'Bulk Carrier',
        flag: 'Liberia',
        engineType: 'Wartsila 6RT-flex58T-D',
        cargoCapacity: 82000,
        fuelConsumption: 220,
        crewComplement: 25,
        currentLatitude: 35.6762,
        currentLongitude: 139.6503,
        positionUpdatedAt: new Date(),
        currentDeparture: 'Tokyo',
        currentDestination: 'Long Beach',
        currentETA: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
        currentRoute: 'Trans-Pacific'
      }
    }),

    prisma.vessel.create({
      data: {
        name: 'MV Nordic Star',
        imoNumber: '9345678',
        vesselType: 'Tanker',
        flag: 'Norway',
        engineType: 'MAN B&W 7S70MC-C',
        cargoCapacity: 115000,
        fuelConsumption: 250,
        crewComplement: 28,
        currentLatitude: 59.9139,
        currentLongitude: 10.7522,
        positionUpdatedAt: new Date(),
        currentDeparture: 'Oslo',
        currentDestination: 'Houston',
        currentETA: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        currentRoute: 'North Atlantic'
      }
    })
  ]);

  // Create vessel assignments
  console.log('⚓ Creating vessel assignments...');
  await Promise.all([
    // Atlantic Pioneer assignments
    prisma.vesselAssignment.create({
      data: {
        userId: users[4].id, // Captain Anderson
        vesselId: vessels[0].id,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        isActive: true
      }
    }),
    prisma.vesselAssignment.create({
      data: {
        userId: users[5].id, // Chief Engineer Thompson
        vesselId: vessels[0].id,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        isActive: true
      }
    }),
    prisma.vesselAssignment.create({
      data: {
        userId: users[6].id, // Crew Santos
        vesselId: vessels[0].id,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        isActive: true
      }
    }),

    // Pacific Explorer assignments
    prisma.vesselAssignment.create({
      data: {
        userId: users[7].id, // Captain Kim
        vesselId: vessels[1].id,
        startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        isActive: true
      }
    })
  ]);

  // Create vessel certificates
  console.log('📋 Creating vessel certificates...');
  await Promise.all([
    prisma.vesselCertificate.create({
      data: {
        vesselId: vessels[0].id,
        certificateType: 'Safety Management Certificate',
        certificateNumber: 'SMC-2024-001',
        issuedBy: 'Panama Maritime Authority',
        issueDate: new Date('2024-01-15'),
        expiryDate: new Date('2025-01-15')
      }
    }),
    prisma.vesselCertificate.create({
      data: {
        vesselId: vessels[0].id,
        certificateType: 'International Load Line Certificate',
        certificateNumber: 'ILL-2024-001',
        issuedBy: 'Panama Maritime Authority',
        issueDate: new Date('2024-02-01'),
        expiryDate: new Date('2029-02-01')
      }
    }),
    prisma.vesselCertificate.create({
      data: {
        vesselId: vessels[1].id,
        certificateType: 'Safety Management Certificate',
        certificateNumber: 'SMC-2024-002',
        issuedBy: 'Liberian Registry',
        issueDate: new Date('2024-03-10'),
        expiryDate: new Date('2025-03-10')
      }
    })
  ]);

  // Create vessel specifications
  console.log('⚙️ Creating vessel specifications...');
  await Promise.all([
    // Atlantic Pioneer specifications
    prisma.vesselSpecification.create({
      data: {
        vesselId: vessels[0].id,
        category: 'Engine',
        specification: 'Main Engine Power',
        value: '12600',
        unit: 'kW'
      }
    }),
    prisma.vesselSpecification.create({
      data: {
        vesselId: vessels[0].id,
        category: 'Engine',
        specification: 'Auxiliary Engine',
        value: 'Caterpillar 3512B',
        unit: null
      }
    }),
    prisma.vesselSpecification.create({
      data: {
        vesselId: vessels[0].id,
        category: 'Dimensions',
        specification: 'Length Overall',
        value: '366',
        unit: 'm'
      }
    }),
    prisma.vesselSpecification.create({
      data: {
        vesselId: vessels[0].id,
        category: 'Dimensions',
        specification: 'Beam',
        value: '51',
        unit: 'm'
      }
    }),

    // Pacific Explorer specifications
    prisma.vesselSpecification.create({
      data: {
        vesselId: vessels[1].id,
        category: 'Engine',
        specification: 'Main Engine Power',
        value: '14280',
        unit: 'kW'
      }
    }),
    prisma.vesselSpecification.create({
      data: {
        vesselId: vessels[1].id,
        category: 'Cargo',
        specification: 'Cargo Hold Capacity',
        value: '82000',
        unit: 'DWT'
      }
    })
  ]);

  // Create cost centers
  console.log('💰 Creating cost centers...');
  const costCenters = await Promise.all([
    prisma.costCenter.create({
      data: {
        code: 'FLEET',
        name: 'Fleet Operations',
        description: 'Overall fleet management and operations'
      }
    }),
    prisma.costCenter.create({
      data: {
        code: 'MAINT',
        name: 'Maintenance',
        description: 'Vessel maintenance and repairs'
      }
    }),
    prisma.costCenter.create({
      data: {
        code: 'FUEL',
        name: 'Fuel and Lubricants',
        description: 'Fuel, lubricants, and consumables'
      }
    }),
    prisma.costCenter.create({
      data: {
        code: 'SAFETY',
        name: 'Safety Equipment',
        description: 'Safety equipment and compliance'
      }
    })
  ]);

  // Create budgets
  console.log('📊 Creating budgets...');
  await Promise.all([
    prisma.budget.create({
      data: {
        vesselId: vessels[0].id,
        costCenterId: costCenters[1].id, // Maintenance
        category: 'Engine Parts',
        amount: 150000,
        currency: 'USD',
        period: '2024-Q1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31')
      }
    }),
    prisma.budget.create({
      data: {
        vesselId: vessels[0].id,
        costCenterId: costCenters[3].id, // Safety
        category: 'Safety Equipment',
        amount: 50000,
        currency: 'USD',
        period: '2024-Q1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31')
      }
    }),
    prisma.budget.create({
      data: {
        vesselId: vessels[1].id,
        costCenterId: costCenters[1].id, // Maintenance
        category: 'Engine Parts',
        amount: 200000,
        currency: 'USD',
        period: '2024-Q1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31')
      }
    })
  ]);

  // Create item catalog with maritime-specific items
  console.log('📦 Creating item catalog...');
  const catalogItems = await Promise.all([
    // Engine Parts
    prisma.itemCatalog.create({
      data: {
        impaCode: '591101',
        issaCode: 'E001',
        name: 'Main Engine Cylinder Head',
        description: 'Cylinder head for MAN B&W 6S60MC-C main engine',
        category: ItemCategory.ENGINE_PARTS,
        criticalityLevel: CriticalityLevel.OPERATIONAL_CRITICAL,
        specifications: {
          material: 'Cast Iron',
          weight: '2500kg',
          manufacturer: 'MAN Energy Solutions'
        },
        compatibleVesselTypes: ['Container Ship', 'Bulk Carrier'],
        compatibleEngineTypes: ['MAN B&W 6S60MC-C', 'MAN B&W 7S60MC-C'],
        unitOfMeasure: 'each',
        averagePrice: 85000,
        leadTime: 45
      }
    }),

    prisma.itemCatalog.create({
      data: {
        impaCode: '591205',
        issaCode: 'E002',
        name: 'Fuel Injection Pump',
        description: 'High-pressure fuel injection pump for main engine',
        category: ItemCategory.ENGINE_PARTS,
        criticalityLevel: CriticalityLevel.OPERATIONAL_CRITICAL,
        specifications: {
          pressure: '1000 bar',
          flow_rate: '150 l/min'
        },
        compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker'],
        compatibleEngineTypes: ['MAN B&W 6S60MC-C', 'Wartsila 6RT-flex58T-D'],
        unitOfMeasure: 'each',
        averagePrice: 25000,
        leadTime: 30
      }
    }),

    // Safety Equipment
    prisma.itemCatalog.create({
      data: {
        impaCode: '751001',
        issaCode: 'S001',
        name: 'Life Jacket - SOLAS Approved',
        description: 'Adult life jacket compliant with SOLAS regulations',
        category: ItemCategory.SAFETY_GEAR,
        criticalityLevel: CriticalityLevel.SAFETY_CRITICAL,
        specifications: {
          buoyancy: '150N',
          certification: 'SOLAS/MED',
          size: 'Adult Universal'
        },
        compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker'],
        compatibleEngineTypes: [],
        unitOfMeasure: 'each',
        averagePrice: 85,
        leadTime: 7
      }
    }),

    prisma.itemCatalog.create({
      data: {
        impaCode: '751105',
        issaCode: 'S002',
        name: 'Emergency Fire Pump',
        description: 'Portable emergency fire pump for firefighting',
        category: ItemCategory.SAFETY_GEAR,
        criticalityLevel: CriticalityLevel.SAFETY_CRITICAL,
        specifications: {
          capacity: '500 GPM',
          pressure: '150 PSI',
          power: 'Diesel Engine'
        },
        compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker'],
        compatibleEngineTypes: [],
        unitOfMeasure: 'each',
        averagePrice: 15000,
        leadTime: 21
      }
    }),

    // Deck Equipment
    prisma.itemCatalog.create({
      data: {
        impaCode: '471001',
        issaCode: 'D001',
        name: 'Mooring Rope - Polypropylene',
        description: '24mm polypropylene mooring rope, 220m length',
        category: ItemCategory.DECK_EQUIPMENT,
        criticalityLevel: CriticalityLevel.OPERATIONAL_CRITICAL,
        specifications: {
          diameter: '24mm',
          length: '220m',
          material: 'Polypropylene',
          breaking_strength: '12 tonnes'
        },
        compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker'],
        compatibleEngineTypes: [],
        unitOfMeasure: 'coil',
        averagePrice: 1200,
        leadTime: 14
      }
    }),

    // Navigation Equipment
    prisma.itemCatalog.create({
      data: {
        impaCode: '431201',
        issaCode: 'N001',
        name: 'GPS Antenna',
        description: 'Marine GPS antenna for navigation system',
        category: ItemCategory.NAVIGATION,
        criticalityLevel: CriticalityLevel.OPERATIONAL_CRITICAL,
        specifications: {
          frequency: 'L1/L2',
          connector: 'TNC',
          cable_length: '30m'
        },
        compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker'],
        compatibleEngineTypes: [],
        unitOfMeasure: 'each',
        averagePrice: 850,
        leadTime: 10
      }
    }),

    // Maintenance Items
    prisma.itemCatalog.create({
      data: {
        impaCode: '811001',
        issaCode: 'M001',
        name: 'Marine Engine Oil - SAE 40',
        description: 'High-quality marine engine oil for main engines',
        category: ItemCategory.MAINTENANCE,
        criticalityLevel: CriticalityLevel.ROUTINE,
        specifications: {
          viscosity: 'SAE 40',
          type: 'Mineral',
          api_grade: 'CF'
        },
        compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker'],
        compatibleEngineTypes: ['MAN B&W 6S60MC-C', 'Wartsila 6RT-flex58T-D', 'MAN B&W 7S70MC-C'],
        unitOfMeasure: 'liter',
        averagePrice: 12,
        leadTime: 5
      }
    }),

    // Electrical Equipment
    prisma.itemCatalog.create({
      data: {
        impaCode: '641001',
        issaCode: 'EL001',
        name: 'Marine Cable - 3x16mm²',
        description: 'Marine-grade electrical cable, flame retardant',
        category: ItemCategory.ELECTRICAL,
        criticalityLevel: CriticalityLevel.OPERATIONAL_CRITICAL,
        specifications: {
          cores: '3',
          cross_section: '16mm²',
          insulation: 'XLPE',
          certification: 'IEC 60092'
        },
        compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker'],
        compatibleEngineTypes: [],
        unitOfMeasure: 'meter',
        averagePrice: 25,
        leadTime: 7
      }
    })
  ]);

  // Create sample requisitions
  console.log('📝 Creating sample requisitions...');
  const requisitions = await Promise.all([
    prisma.requisition.create({
      data: {
        requisitionNumber: 'REQ-2024-001',
        vesselId: vessels[0].id, // Atlantic Pioneer
        requestedById: users[5].id, // Chief Engineer Thompson
        urgencyLevel: UrgencyLevel.URGENT,
        totalAmount: 25000,
        currency: 'USD',
        deliveryLocation: 'Rotterdam Port',
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        justification: 'Fuel injection pump showing signs of wear, replacement needed before next voyage'
      }
    }),

    prisma.requisition.create({
      data: {
        requisitionNumber: 'REQ-2024-002',
        vesselId: vessels[0].id, // Atlantic Pioneer
        requestedById: users[6].id, // Crew Santos
        urgencyLevel: UrgencyLevel.ROUTINE,
        totalAmount: 1200,
        currency: 'USD',
        deliveryLocation: 'New York Port',
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        justification: 'Routine replacement of mooring ropes as per maintenance schedule'
      }
    }),

    prisma.requisition.create({
      data: {
        requisitionNumber: 'REQ-2024-003',
        vesselId: vessels[1].id, // Pacific Explorer
        requestedById: users[7].id, // Captain Kim
        urgencyLevel: UrgencyLevel.EMERGENCY,
        totalAmount: 15000,
        currency: 'USD',
        deliveryLocation: 'Tokyo Port',
        deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        justification: 'Emergency fire pump malfunction, immediate replacement required for safety compliance',
        emergencyOverride: true,
        emergencyReason: 'Safety equipment failure - SOLAS compliance requirement',
        emergencyApprovedBy: users[7].id,
        emergencyApprovedAt: new Date()
      }
    })
  ]);

  // Create requisition items
  console.log('📋 Creating requisition items...');
  await Promise.all([
    // Items for REQ-2024-001 (Fuel injection pump)
    prisma.requisitionItem.create({
      data: {
        requisitionId: requisitions[0].id,
        itemCatalogId: catalogItems[1].id, // Fuel Injection Pump
        quantity: 1,
        unitPrice: 25000,
        totalPrice: 25000,
        specifications: 'For MAN B&W 6S60MC-C main engine',
        notes: 'Urgent replacement needed'
      }
    }),

    // Items for REQ-2024-002 (Mooring rope)
    prisma.requisitionItem.create({
      data: {
        requisitionId: requisitions[1].id,
        itemCatalogId: catalogItems[4].id, // Mooring Rope
        quantity: 1,
        unitPrice: 1200,
        totalPrice: 1200,
        specifications: '24mm diameter, 220m length',
        notes: 'Routine maintenance replacement'
      }
    }),

    // Items for REQ-2024-003 (Emergency fire pump)
    prisma.requisitionItem.create({
      data: {
        requisitionId: requisitions[2].id,
        itemCatalogId: catalogItems[3].id, // Emergency Fire Pump
        quantity: 1,
        unitPrice: 15000,
        totalPrice: 15000,
        specifications: '500 GPM capacity, diesel powered',
        notes: 'Emergency replacement for safety compliance'
      }
    })
  ]);

  // Create approvals
  console.log('✅ Creating approvals...');
  await Promise.all([
    // Approval for REQ-2024-001 (pending superintendent approval)
    prisma.approval.create({
      data: {
        requisitionId: requisitions[0].id,
        approverId: users[1].id, // Superintendent Morrison
        level: 1,
        budgetLimit: 50000,
        costCenter: 'MAINT'
      }
    }),

    // Approval for REQ-2024-002 (auto-approved - under $500 threshold)
    prisma.approval.create({
      data: {
        requisitionId: requisitions[1].id,
        approverId: users[1].id, // Superintendent Morrison
        level: 1,
        status: 'APPROVED',
        approvedAt: new Date(),
        comments: 'Auto-approved - routine maintenance under threshold',
        budgetLimit: 5000,
        costCenter: 'MAINT'
      }
    }),

    // Approval for REQ-2024-003 (emergency override)
    prisma.approval.create({
      data: {
        requisitionId: requisitions[2].id,
        approverId: users[7].id, // Captain Kim (emergency override)
        level: 1,
        status: 'APPROVED',
        approvedAt: new Date(),
        comments: 'Emergency override - safety critical equipment failure',
        budgetLimit: 25000,
        costCenter: 'SAFETY'
      }
    })
  ]);

  // Create system settings
  console.log('⚙️ Creating system settings...');
  await Promise.all([
    prisma.systemSetting.create({
      data: {
        key: 'approval.auto_approve_threshold',
        value: '500',
        description: 'Auto-approve requisitions under this amount (USD)',
        category: 'approval_workflow'
      }
    }),
    prisma.systemSetting.create({
      data: {
        key: 'approval.superintendent_threshold',
        value: '5000',
        description: 'Superintendent approval required above this amount (USD)',
        category: 'approval_workflow'
      }
    }),
    prisma.systemSetting.create({
      data: {
        key: 'approval.procurement_manager_threshold',
        value: '25000',
        description: 'Procurement manager approval required above this amount (USD)',
        category: 'approval_workflow'
      }
    }),
    prisma.systemSetting.create({
      data: {
        key: 'security.max_login_attempts',
        value: '5',
        description: 'Maximum failed login attempts before account lockout',
        category: 'security'
      }
    }),
    prisma.systemSetting.create({
      data: {
        key: 'security.account_lockout_duration',
        value: '30',
        description: 'Account lockout duration in minutes',
        category: 'security'
      }
    }),
    prisma.systemSetting.create({
      data: {
        key: 'notification.email_enabled',
        value: 'true',
        description: 'Enable email notifications',
        category: 'notifications'
      }
    })
  ]);

  // Create notification templates
  console.log('📧 Creating notification templates...');
  await Promise.all([
    prisma.notificationTemplate.create({
      data: {
        name: 'requisition_approval_request',
        subject: 'Requisition Approval Required - {{requisitionNumber}}',
        body: 'A new requisition {{requisitionNumber}} from vessel {{vesselName}} requires your approval. Amount: {{totalAmount}} {{currency}}. Urgency: {{urgencyLevel}}.',
        type: 'email'
      }
    }),
    prisma.notificationTemplate.create({
      data: {
        name: 'requisition_approved',
        subject: 'Requisition Approved - {{requisitionNumber}}',
        body: 'Your requisition {{requisitionNumber}} has been approved by {{approverName}}. The procurement process will begin shortly.',
        type: 'email'
      }
    }),
    prisma.notificationTemplate.create({
      data: {
        name: 'emergency_override_notification',
        subject: 'Emergency Override Used - {{requisitionNumber}}',
        body: 'Emergency override was used for requisition {{requisitionNumber}} by {{captainName}} on vessel {{vesselName}}. Reason: {{emergencyReason}}',
        type: 'email'
      }
    }),
    prisma.notificationTemplate.create({
      data: {
        name: 'delivery_confirmation',
        subject: 'Delivery Confirmed - PO {{poNumber}}',
        body: 'Delivery has been confirmed for purchase order {{poNumber}} to vessel {{vesselName}} at {{deliveryLocation}}.',
        type: 'email'
      }
    })
  ]);

  // Create exchange rates
  console.log('💱 Creating exchange rates...');
  const today = new Date();
  await Promise.all([
    prisma.exchangeRate.create({
      data: {
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.85,
        date: today,
        source: 'ECB'
      }
    }),
    prisma.exchangeRate.create({
      data: {
        fromCurrency: 'USD',
        toCurrency: 'GBP',
        rate: 0.78,
        date: today,
        source: 'BOE'
      }
    }),
    prisma.exchangeRate.create({
      data: {
        fromCurrency: 'USD',
        toCurrency: 'JPY',
        rate: 150.25,
        date: today,
        source: 'BOJ'
      }
    }),
    prisma.exchangeRate.create({
      data: {
        fromCurrency: 'EUR',
        toCurrency: 'USD',
        rate: 1.18,
        date: today,
        source: 'ECB'
      }
    })
  ]);

  console.log('✅ Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`- Created ${permissions.length} permissions`);
  console.log(`- Created ${users.length} users`);
  console.log(`- Created ${vessels.length} vessels`);
  console.log(`- Created ${catalogItems.length} catalog items`);
  console.log(`- Created ${requisitions.length} requisitions`);
  console.log(`- Created ${costCenters.length} cost centers`);
  console.log('\n🔐 Test Login Credentials:');
  console.log('Admin: admin@flowmarine.com / password123');
  console.log('Superintendent: superintendent@flowmarine.com / password123');
  console.log('Captain: captain.atlantic@flowmarine.com / password123');
  console.log('Engineer: engineer.atlantic@flowmarine.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import { PrismaClient, ItemCategory, CriticalityLevel } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

interface SeedItem {
  impaCode?: string;
  issaCode?: string;
  name: string;
  description: string;
  category: ItemCategory;
  criticalityLevel: CriticalityLevel;
  specifications?: Record<string, any>;
  compatibleVesselTypes: string[];
  compatibleEngineTypes: string[];
  unitOfMeasure: string;
  averagePrice?: number;
  averagePriceCurrency: string;
  leadTime?: number;
}

const maritimeItems: SeedItem[] = [
  // Engine Parts - Safety Critical
  {
    impaCode: '311001',
    name: 'Main Engine Cylinder Head',
    description: 'High-pressure cylinder head for main propulsion engine',
    category: 'ENGINE_PARTS',
    criticalityLevel: 'SAFETY_CRITICAL',
    specifications: {
      material: 'Cast Iron',
      maxPressure: '150 bar',
      temperature: '450°C'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker'],
    compatibleEngineTypes: ['MAN B&W', 'Wartsila', 'Caterpillar'],
    unitOfMeasure: 'Each',
    averagePrice: 25000,
    averagePriceCurrency: 'USD',
    leadTime: 45
  },
  {
    impaCode: '311015',
    name: 'Fuel Injection Pump',
    description: 'High-pressure fuel injection pump for marine diesel engine',
    category: 'ENGINE_PARTS',
    criticalityLevel: 'SAFETY_CRITICAL',
    specifications: {
      pressure: '2000 bar',
      flow: '150 l/h'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo'],
    compatibleEngineTypes: ['MAN B&W', 'Wartsila', 'Caterpillar', 'Yanmar'],
    unitOfMeasure: 'Each',
    averagePrice: 8500,
    averagePriceCurrency: 'USD',
    leadTime: 30
  },
  {
    impaCode: '311025',
    name: 'Turbocharger Assembly',
    description: 'Complete turbocharger assembly for main engine',
    category: 'ENGINE_PARTS',
    criticalityLevel: 'OPERATIONAL_CRITICAL',
    specifications: {
      airFlow: '12000 m³/h',
      compressionRatio: '3.5:1'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker'],
    compatibleEngineTypes: ['MAN B&W', 'Wartsila'],
    unitOfMeasure: 'Each',
    averagePrice: 45000,
    averagePriceCurrency: 'USD',
    leadTime: 60
  },

  // Safety Gear - Safety Critical
  {
    issaCode: '74.101.01',
    name: 'Life Jacket - SOLAS Approved',
    description: 'Adult life jacket compliant with SOLAS regulations',
    category: 'SAFETY_GEAR',
    criticalityLevel: 'SAFETY_CRITICAL',
    specifications: {
      buoyancy: '150N',
      certification: 'SOLAS/MED',
      size: 'Adult Universal'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo', 'Passenger'],
    compatibleEngineTypes: [], // Not engine-specific
    unitOfMeasure: 'Each',
    averagePrice: 85,
    averagePriceCurrency: 'USD',
    leadTime: 14
  },
  {
    issaCode: '74.105.01',
    name: 'Emergency Escape Breathing Device',
    description: 'Self-contained emergency escape breathing apparatus',
    category: 'SAFETY_GEAR',
    criticalityLevel: 'SAFETY_CRITICAL',
    specifications: {
      duration: '15 minutes',
      certification: 'SOLAS/MED',
      weight: '2.5 kg'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo'],
    compatibleEngineTypes: [], // Not engine-specific
    unitOfMeasure: 'Each',
    averagePrice: 450,
    averagePriceCurrency: 'USD',
    leadTime: 21
  },
  {
    issaCode: '74.110.05',
    name: 'Fire Extinguisher - CO2 5kg',
    description: 'Carbon dioxide fire extinguisher for electrical fires',
    category: 'SAFETY_GEAR',
    criticalityLevel: 'SAFETY_CRITICAL',
    specifications: {
      capacity: '5 kg',
      type: 'CO2',
      certification: 'MED'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo', 'Passenger'],
    compatibleEngineTypes: [], // Not engine-specific
    unitOfMeasure: 'Each',
    averagePrice: 120,
    averagePriceCurrency: 'USD',
    leadTime: 7
  },

  // Deck Equipment - Operational Critical
  {
    impaCode: '751001',
    name: 'Anchor Chain - Grade 3',
    description: 'High-strength anchor chain for main anchoring system',
    category: 'DECK_EQUIPMENT',
    criticalityLevel: 'OPERATIONAL_CRITICAL',
    specifications: {
      diameter: '76mm',
      grade: 'Grade 3',
      breakingLoad: '1370 kN'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker'],
    compatibleEngineTypes: [], // Not engine-specific
    unitOfMeasure: 'Meter',
    averagePrice: 85,
    averagePriceCurrency: 'USD',
    leadTime: 30
  },
  {
    impaCode: '751015',
    name: 'Mooring Rope - Polyester',
    description: 'High-strength polyester mooring rope',
    category: 'DECK_EQUIPMENT',
    criticalityLevel: 'OPERATIONAL_CRITICAL',
    specifications: {
      diameter: '64mm',
      material: 'Polyester',
      breakingLoad: '980 kN'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo'],
    compatibleEngineTypes: [], // Not engine-specific
    unitOfMeasure: 'Meter',
    averagePrice: 12,
    averagePriceCurrency: 'USD',
    leadTime: 14
  },

  // Navigation Equipment - Safety Critical
  {
    impaCode: '431001',
    name: 'GPS Receiver - SOLAS Approved',
    description: 'Dual-frequency GPS receiver for navigation',
    category: 'NAVIGATION',
    criticalityLevel: 'SAFETY_CRITICAL',
    specifications: {
      channels: '12',
      accuracy: '< 10m',
      certification: 'SOLAS/MED'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo', 'Passenger'],
    compatibleEngineTypes: [], // Not engine-specific
    unitOfMeasure: 'Each',
    averagePrice: 2500,
    averagePriceCurrency: 'USD',
    leadTime: 21
  },
  {
    impaCode: '431025',
    name: 'Radar Antenna',
    description: 'X-band radar antenna for navigation radar',
    category: 'NAVIGATION',
    criticalityLevel: 'SAFETY_CRITICAL',
    specifications: {
      frequency: 'X-band',
      gain: '28 dBi',
      beamwidth: '1.2°'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo', 'Passenger'],
    compatibleEngineTypes: [], // Not engine-specific
    unitOfMeasure: 'Each',
    averagePrice: 3200,
    averagePriceCurrency: 'USD',
    leadTime: 28
  },

  // Electrical Equipment - Operational Critical
  {
    impaCode: '161001',
    name: 'Emergency Generator',
    description: 'Diesel emergency generator for emergency power',
    category: 'ELECTRICAL',
    criticalityLevel: 'SAFETY_CRITICAL',
    specifications: {
      power: '250 kW',
      voltage: '440V',
      frequency: '60Hz'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo'],
    compatibleEngineTypes: ['Caterpillar', 'Cummins', 'Perkins'],
    unitOfMeasure: 'Each',
    averagePrice: 85000,
    averagePriceCurrency: 'USD',
    leadTime: 90
  },
  {
    impaCode: '161015',
    name: 'LED Navigation Light',
    description: 'LED masthead navigation light - COLREG compliant',
    category: 'ELECTRICAL',
    criticalityLevel: 'SAFETY_CRITICAL',
    specifications: {
      type: 'LED',
      power: '25W',
      visibility: '6 nautical miles'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo', 'Passenger'],
    compatibleEngineTypes: [], // Not engine-specific
    unitOfMeasure: 'Each',
    averagePrice: 450,
    averagePriceCurrency: 'USD',
    leadTime: 14
  },

  // Maintenance Items - Routine
  {
    impaCode: '593001',
    name: 'Marine Engine Oil - SAE 40',
    description: 'High-performance marine engine lubricating oil',
    category: 'MAINTENANCE',
    criticalityLevel: 'ROUTINE',
    specifications: {
      viscosity: 'SAE 40',
      type: 'Mineral',
      certification: 'API CF'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo'],
    compatibleEngineTypes: ['MAN B&W', 'Wartsila', 'Caterpillar', 'Yanmar'],
    unitOfMeasure: 'Liter',
    averagePrice: 8.5,
    averagePriceCurrency: 'USD',
    leadTime: 7
  },
  {
    impaCode: '593015',
    name: 'Hydraulic Oil - ISO 46',
    description: 'Marine hydraulic system oil',
    category: 'MAINTENANCE',
    criticalityLevel: 'OPERATIONAL_CRITICAL',
    specifications: {
      viscosity: 'ISO 46',
      type: 'Synthetic',
      temperature: '-20°C to +100°C'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo'],
    compatibleEngineTypes: [], // Not engine-specific
    unitOfMeasure: 'Liter',
    averagePrice: 12,
    averagePriceCurrency: 'USD',
    leadTime: 5
  },

  // Catering Supplies - Routine
  {
    name: 'Galley Equipment - Commercial Oven',
    description: 'Commercial marine galley convection oven',
    category: 'CATERING',
    criticalityLevel: 'ROUTINE',
    specifications: {
      capacity: '6 trays',
      power: '15 kW',
      voltage: '440V'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo', 'Passenger'],
    compatibleEngineTypes: [], // Not engine-specific
    unitOfMeasure: 'Each',
    averagePrice: 3500,
    averagePriceCurrency: 'USD',
    leadTime: 21
  },
  {
    name: 'Fresh Water Maker Membrane',
    description: 'Reverse osmosis membrane for fresh water production',
    category: 'CATERING',
    criticalityLevel: 'OPERATIONAL_CRITICAL',
    specifications: {
      capacity: '10 m³/day',
      pressure: '55 bar',
      saltRejection: '99.4%'
    },
    compatibleVesselTypes: ['Container Ship', 'Bulk Carrier', 'Tanker', 'General Cargo', 'Passenger'],
    compatibleEngineTypes: [], // Not engine-specific
    unitOfMeasure: 'Each',
    averagePrice: 850,
    averagePriceCurrency: 'USD',
    leadTime: 14
  }
];

async function seedItemCatalog() {
  try {
    logger.info('Starting item catalog seeding...');

    // Clear existing items (optional - remove in production)
    await prisma.itemCatalog.deleteMany({});
    logger.info('Cleared existing item catalog entries');

    // Insert maritime items
    for (const item of maritimeItems) {
      try {
        await prisma.itemCatalog.create({
          data: item
        });
        logger.info(`Created item: ${item.name}`);
      } catch (error) {
        logger.error(`Error creating item ${item.name}:`, error);
      }
    }

    logger.info(`Successfully seeded ${maritimeItems.length} items in the catalog`);

    // Log summary by category
    const categoryCounts = await prisma.itemCatalog.groupBy({
      by: ['category'],
      _count: {
        id: true
      }
    });

    logger.info('Item catalog summary by category:');
    categoryCounts.forEach(cat => {
      logger.info(`  ${cat.category}: ${cat._count.id} items`);
    });

    // Log summary by criticality
    const criticalityCounts = await prisma.itemCatalog.groupBy({
      by: ['criticalityLevel'],
      _count: {
        id: true
      }
    });

    logger.info('Item catalog summary by criticality:');
    criticalityCounts.forEach(crit => {
      logger.info(`  ${crit.criticalityLevel}: ${crit._count.id} items`);
    });

  } catch (error) {
    logger.error('Error seeding item catalog:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedItemCatalog()
    .then(() => {
      logger.info('Item catalog seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Item catalog seeding failed:', error);
      process.exit(1);
    });
}

export { seedItemCatalog };
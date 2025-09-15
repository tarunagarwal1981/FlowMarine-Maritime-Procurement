import { Requisition } from '../types/requisition';

export const mockRequisitions: Requisition[] = [
  {
    id: 'req-001',
    requisitionNumber: 'REQ-2024-001',
    title: 'Engine Room Maintenance Supplies',
    description: 'Monthly maintenance supplies for main engine and auxiliary systems',
    vesselId: 'vessel-001',
    vesselName: 'MV Ocean Explorer',
    departmentId: 'dept-engine',
    departmentName: 'Engine Department',
    requestedBy: 'user-001',
    requestedByName: 'Chief Engineer John Smith',
    requestedDate: '2024-01-15T10:30:00Z',
    requiredDate: '2024-01-25T00:00:00Z',
    status: 'approved',
    priority: 'high',
    totalEstimatedValue: 15750.00,
    items: [
      {
        id: 'item-001',
        itemCode: 'ENG-001',
        description: 'Engine Oil SAE 40 - Marine Grade',
        quantity: 20,
        unit: 'Liters',
        estimatedPrice: 45.00,
        category: 'Lubricants',
        priority: 'high',
        brand: 'Shell',
        model: 'Rimula R4 X'
      },
      {
        id: 'item-002',
        itemCode: 'FIL-001',
        description: 'Fuel Filter Element',
        quantity: 6,
        unit: 'Pieces',
        estimatedPrice: 125.00,
        category: 'Filters',
        priority: 'high',
        brand: 'Caterpillar',
        model: '1R-0750'
      },
      {
        id: 'item-003',
        itemCode: 'GSK-001',
        description: 'Cylinder Head Gasket Set',
        quantity: 2,
        unit: 'Sets',
        estimatedPrice: 850.00,
        category: 'Engine Parts',
        priority: 'medium',
        specifications: 'For CAT 3512 Engine'
      }
    ],
    approvalHistory: [
      {
        id: 'approval-001',
        stepName: 'Department Head Approval',
        approverName: 'Captain Mike Johnson',
        approverRole: 'Vessel Captain',
        status: 'approved',
        comments: 'Approved for immediate procurement',
        timestamp: '2024-01-16T09:15:00Z'
      },
      {
        id: 'approval-002',
        stepName: 'Shore Management Approval',
        approverName: 'Sarah Wilson',
        approverRole: 'Fleet Manager',
        status: 'approved',
        comments: 'Budget approved',
        timestamp: '2024-01-16T14:30:00Z'
      }
    ],
    attachments: [
      {
        id: 'att-001',
        fileName: 'maintenance_schedule.pdf',
        fileSize: 245760,
        fileType: 'application/pdf',
        uploadedBy: 'Chief Engineer John Smith',
        uploadedAt: '2024-01-15T10:35:00Z',
        url: '/attachments/maintenance_schedule.pdf'
      }
    ],
    notes: 'Urgent requirement for scheduled maintenance',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-16T14:30:00Z'
  },
  {
    id: 'req-002',
    requisitionNumber: 'REQ-2024-002',
    title: 'Deck Department Safety Equipment',
    description: 'Safety equipment replacement and new additions for deck operations',
    vesselId: 'vessel-001',
    vesselName: 'MV Ocean Explorer',
    departmentId: 'dept-deck',
    departmentName: 'Deck Department',
    requestedBy: 'user-002',
    requestedByName: 'Chief Officer Lisa Brown',
    requestedDate: '2024-01-18T08:00:00Z',
    requiredDate: '2024-02-01T00:00:00Z',
    status: 'submitted',
    priority: 'medium',
    totalEstimatedValue: 8950.00,
    items: [
      {
        id: 'item-004',
        itemCode: 'SAF-001',
        description: 'Life Jackets - SOLAS Approved',
        quantity: 12,
        unit: 'Pieces',
        estimatedPrice: 85.00,
        category: 'Safety Equipment',
        priority: 'high',
        specifications: 'SOLAS 2010 compliant, Adult size'
      },
      {
        id: 'item-005',
        itemCode: 'SAF-002',
        description: 'Emergency Flares - Red Hand Flares',
        quantity: 24,
        unit: 'Pieces',
        estimatedPrice: 15.00,
        category: 'Safety Equipment',
        priority: 'medium',
        brand: 'Pains Wessex'
      },
      {
        id: 'item-006',
        itemCode: 'DEC-001',
        description: 'Mooring Rope - Polypropylene',
        quantity: 200,
        unit: 'Meters',
        estimatedPrice: 12.50,
        category: 'Deck Equipment',
        priority: 'low',
        specifications: '24mm diameter, breaking strength 6.5 tons'
      }
    ],
    approvalHistory: [
      {
        id: 'approval-003',
        stepName: 'Department Head Approval',
        approverName: 'Captain Mike Johnson',
        approverRole: 'Vessel Captain',
        status: 'pending',
        comments: '',
        timestamp: undefined
      }
    ],
    attachments: [],
    notes: 'Annual safety equipment audit requirements',
    createdAt: '2024-01-18T08:00:00Z',
    updatedAt: '2024-01-18T08:00:00Z'
  },
  {
    id: 'req-003',
    requisitionNumber: 'REQ-2024-003',
    title: 'Galley Provisions and Equipment',
    description: 'Monthly food provisions and kitchen equipment replacement',
    vesselId: 'vessel-002',
    vesselName: 'MV Atlantic Voyager',
    departmentId: 'dept-catering',
    departmentName: 'Catering Department',
    requestedBy: 'user-003',
    requestedByName: 'Chief Cook Maria Garcia',
    requestedDate: '2024-01-20T12:00:00Z',
    requiredDate: '2024-01-28T00:00:00Z',
    status: 'in_procurement',
    priority: 'medium',
    totalEstimatedValue: 4200.00,
    items: [
      {
        id: 'item-007',
        itemCode: 'FOD-001',
        description: 'Fresh Vegetables - Mixed',
        quantity: 50,
        unit: 'Kg',
        estimatedPrice: 3.50,
        category: 'Food & Provisions',
        priority: 'high'
      },
      {
        id: 'item-008',
        itemCode: 'FOD-002',
        description: 'Frozen Meat - Beef',
        quantity: 30,
        unit: 'Kg',
        estimatedPrice: 18.00,
        category: 'Food & Provisions',
        priority: 'high'
      },
      {
        id: 'item-009',
        itemCode: 'KIT-001',
        description: 'Commercial Blender',
        quantity: 1,
        unit: 'Piece',
        estimatedPrice: 450.00,
        category: 'Kitchen Equipment',
        priority: 'low',
        brand: 'Vitamix',
        model: 'VM0800A'
      }
    ],
    approvalHistory: [
      {
        id: 'approval-004',
        stepName: 'Department Head Approval',
        approverName: 'Captain Robert Davis',
        approverRole: 'Vessel Captain',
        status: 'approved',
        comments: 'Approved for next port call',
        timestamp: '2024-01-20T15:30:00Z'
      },
      {
        id: 'approval-005',
        stepName: 'Shore Management Approval',
        approverName: 'David Thompson',
        approverRole: 'Operations Manager',
        status: 'approved',
        comments: 'Procurement in progress',
        timestamp: '2024-01-21T10:00:00Z'
      }
    ],
    attachments: [
      {
        id: 'att-002',
        fileName: 'menu_plan.xlsx',
        fileSize: 156432,
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        uploadedBy: 'Chief Cook Maria Garcia',
        uploadedAt: '2024-01-20T12:05:00Z',
        url: '/attachments/menu_plan.xlsx'
      }
    ],
    createdAt: '2024-01-20T12:00:00Z',
    updatedAt: '2024-01-21T10:00:00Z'
  },
  {
    id: 'req-004',
    requisitionNumber: 'REQ-2024-004',
    title: 'Navigation Equipment Upgrade',
    description: 'Bridge navigation equipment upgrade and calibration',
    vesselId: 'vessel-001',
    vesselName: 'MV Ocean Explorer',
    departmentId: 'dept-navigation',
    departmentName: 'Navigation Department',
    requestedBy: 'user-004',
    requestedByName: 'Second Officer Tom Wilson',
    requestedDate: '2024-01-22T14:30:00Z',
    requiredDate: '2024-02-15T00:00:00Z',
    status: 'draft',
    priority: 'low',
    totalEstimatedValue: 25000.00,
    items: [
      {
        id: 'item-010',
        itemCode: 'NAV-001',
        description: 'GPS Chart Plotter',
        quantity: 1,
        unit: 'Piece',
        estimatedPrice: 8500.00,
        category: 'Navigation Equipment',
        priority: 'medium',
        brand: 'Furuno',
        model: 'GP-1971F'
      },
      {
        id: 'item-011',
        itemCode: 'NAV-002',
        description: 'Radar Display Unit',
        quantity: 1,
        unit: 'Piece',
        estimatedPrice: 12000.00,
        category: 'Navigation Equipment',
        priority: 'medium',
        brand: 'JRC',
        model: 'JMA-9100'
      }
    ],
    approvalHistory: [],
    attachments: [],
    notes: 'Equipment upgrade scheduled for next dry dock',
    createdAt: '2024-01-22T14:30:00Z',
    updatedAt: '2024-01-22T14:30:00Z'
  },
  {
    id: 'req-005',
    requisitionNumber: 'REQ-2024-005',
    title: 'Medical Supplies Replenishment',
    description: 'Monthly medical supplies and first aid equipment',
    vesselId: 'vessel-002',
    vesselName: 'MV Atlantic Voyager',
    departmentId: 'dept-medical',
    departmentName: 'Medical Department',
    requestedBy: 'user-005',
    requestedByName: 'Ship Medic Dr. James Lee',
    requestedDate: '2024-01-25T09:00:00Z',
    requiredDate: '2024-02-05T00:00:00Z',
    status: 'rejected',
    priority: 'urgent',
    totalEstimatedValue: 1850.00,
    items: [
      {
        id: 'item-012',
        itemCode: 'MED-001',
        description: 'Bandages - Sterile Gauze',
        quantity: 50,
        unit: 'Pieces',
        estimatedPrice: 2.50,
        category: 'Medical Supplies',
        priority: 'high'
      },
      {
        id: 'item-013',
        itemCode: 'MED-002',
        description: 'Antiseptic Solution',
        quantity: 10,
        unit: 'Bottles',
        estimatedPrice: 15.00,
        category: 'Medical Supplies',
        priority: 'high'
      }
    ],
    approvalHistory: [
      {
        id: 'approval-006',
        stepName: 'Department Head Approval',
        approverName: 'Captain Robert Davis',
        approverRole: 'Vessel Captain',
        status: 'rejected',
        comments: 'Budget exceeded for this month. Resubmit with essential items only.',
        timestamp: '2024-01-25T16:45:00Z'
      }
    ],
    attachments: [],
    notes: 'Medical inventory running low',
    createdAt: '2024-01-25T09:00:00Z',
    updatedAt: '2024-01-25T16:45:00Z'
  }
];

export const mockVessels = [
  { id: 'vessel-001', name: 'MV Ocean Explorer', type: 'Container Ship' },
  { id: 'vessel-002', name: 'MV Atlantic Voyager', type: 'Bulk Carrier' },
  { id: 'vessel-003', name: 'MV Pacific Star', type: 'Tanker' },
  { id: 'vessel-004', name: 'MV Nordic Wind', type: 'General Cargo' }
];

export const mockDepartments = [
  { id: 'dept-engine', name: 'Engine Department' },
  { id: 'dept-deck', name: 'Deck Department' },
  { id: 'dept-navigation', name: 'Navigation Department' },
  { id: 'dept-catering', name: 'Catering Department' },
  { id: 'dept-medical', name: 'Medical Department' },
  { id: 'dept-electrical', name: 'Electrical Department' }
];

export const mockItemCategories = [
  'Engine Parts',
  'Lubricants',
  'Filters',
  'Safety Equipment',
  'Deck Equipment',
  'Navigation Equipment',
  'Food & Provisions',
  'Kitchen Equipment',
  'Medical Supplies',
  'Electrical Components',
  'Tools & Hardware',
  'Cleaning Supplies'
];
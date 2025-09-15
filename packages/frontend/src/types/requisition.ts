export interface RequisitionItem {
  id: string;
  itemCode: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  specifications?: string;
  brand?: string;
  model?: string;
}

export interface Requisition {
  id: string;
  requisitionNumber: string;
  title: string;
  description?: string;
  vesselId: string;
  vesselName: string;
  departmentId: string;
  departmentName: string;
  requestedBy: string;
  requestedByName: string;
  requestedDate: string;
  requiredDate: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'in_procurement' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  items: RequisitionItem[];
  totalEstimatedValue: number;
  approvalHistory: ApprovalStep[];
  attachments: Attachment[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStep {
  id: string;
  stepName: string;
  approverName: string;
  approverRole: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  timestamp?: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
}

export interface CreateRequisitionData {
  title: string;
  description?: string;
  vesselId: string;
  departmentId: string;
  requiredDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  items: Omit<RequisitionItem, 'id'>[];
  notes?: string;
}

export interface RequisitionFilters {
  status?: string[];
  priority?: string[];
  vesselId?: string;
  departmentId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  searchTerm?: string;
}
import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface RequisitionItem {
  id: string;
  itemId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  urgencyLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
}

export interface Requisition {
  id: string;
  requisitionNumber: string;
  vesselId: string;
  vesselName: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ORDERED';
  totalAmount: number;
  currency: string;
  deliveryLocation: string;
  deliveryDate: string;
  justification: string;
  items: RequisitionItem[];
  createdAt: string;
  updatedAt: string;
}

interface RequisitionState {
  requisitions: Requisition[];
  draftRequisitions: Requisition[];
  offlineRequisitions: Requisition[];
  currentRequisition: Requisition | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    status: string[];
    vessel: string[];
    dateRange: {
      start: string | null;
      end: string | null;
    };
  };
}

const initialState: RequisitionState = {
  requisitions: [],
  draftRequisitions: [],
  offlineRequisitions: [],
  currentRequisition: null,
  isLoading: false,
  error: null,
  filters: {
    status: [],
    vessel: [],
    dateRange: {
      start: null,
      end: null,
    },
  },
};

const requisitionSlice = createSlice({
  name: 'requisitions',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setRequisitions: (state, action: PayloadAction<Requisition[]>) => {
      state.requisitions = action.payload;
    },
    addRequisition: (state, action: PayloadAction<Requisition>) => {
      state.requisitions.unshift(action.payload);
    },
    updateRequisition: (state, action: PayloadAction<Requisition>) => {
      const index = state.requisitions.findIndex(r => r.id === action.payload.id);
      if (index !== -1) {
        state.requisitions[index] = action.payload;
      }
    },
    deleteRequisition: (state, action: PayloadAction<string>) => {
      state.requisitions = state.requisitions.filter(r => r.id !== action.payload);
    },
    setCurrentRequisition: (state, action: PayloadAction<Requisition | null>) => {
      state.currentRequisition = action.payload;
    },
    saveDraftRequisition: (state, action: PayloadAction<Requisition>) => {
      const index = state.draftRequisitions.findIndex(r => r.id === action.payload.id);
      if (index !== -1) {
        state.draftRequisitions[index] = action.payload;
      } else {
        state.draftRequisitions.push(action.payload);
      }
    },
    deleteDraftRequisition: (state, action: PayloadAction<string>) => {
      state.draftRequisitions = state.draftRequisitions.filter(r => r.id !== action.payload);
    },
    addOfflineRequisition: (state, action: PayloadAction<Requisition>) => {
      state.offlineRequisitions.push(action.payload);
    },
    removeOfflineRequisition: (state, action: PayloadAction<string>) => {
      state.offlineRequisitions = state.offlineRequisitions.filter(r => r.id !== action.payload);
    },
    setFilters: (state, action: PayloadAction<Partial<RequisitionState['filters']>>) => {
      state.filters = {...state.filters, ...action.payload};
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
  },
});

export const {
  setLoading,
  setError,
  setRequisitions,
  addRequisition,
  updateRequisition,
  deleteRequisition,
  setCurrentRequisition,
  saveDraftRequisition,
  deleteDraftRequisition,
  addOfflineRequisition,
  removeOfflineRequisition,
  setFilters,
  clearFilters,
} = requisitionSlice.actions;

export default requisitionSlice.reducer;
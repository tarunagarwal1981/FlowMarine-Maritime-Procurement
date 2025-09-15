import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Requisition, RequisitionFilters } from '../../types/requisition';
import { mockRequisitions } from '../../data/mockRequisitions';

interface RequisitionState {
  requisitions: Requisition[];
  currentRequisition: Requisition | null;
  loading: boolean;
  error: string | null;
  filters: RequisitionFilters;
  searchTerm: string;
}

const initialState: RequisitionState = {
  requisitions: mockRequisitions,
  currentRequisition: null,
  loading: false,
  error: null,
  filters: {
    status: [],
    priority: [],
    vesselId: undefined,
    departmentId: undefined,
    dateRange: undefined,
    searchTerm: undefined,
  },
  searchTerm: '',
};

const requisitionSlice = createSlice({
  name: 'requisition',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
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
      const index = state.requisitions.findIndex(req => req.id === action.payload.id);
      if (index !== -1) {
        state.requisitions[index] = action.payload;
      }
    },
    deleteRequisition: (state, action: PayloadAction<string>) => {
      state.requisitions = state.requisitions.filter(req => req.id !== action.payload);
    },
    setCurrentRequisition: (state, action: PayloadAction<Requisition | null>) => {
      state.currentRequisition = action.payload;
    },
    updateFilters: (state, action: PayloadAction<Partial<RequisitionFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
      state.searchTerm = '';
    },
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
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
  updateFilters,
  clearFilters,
  setSearchTerm,
} = requisitionSlice.actions;

export default requisitionSlice.reducer;
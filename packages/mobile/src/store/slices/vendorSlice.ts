import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface Vendor {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  serviceAreas: string[];
  qualityRating: number;
  deliveryRating: number;
  priceRating: number;
  overallScore: number;
  isActive: boolean;
}

export interface Quote {
  id: string;
  rfqId: string;
  vendorId: string;
  vendorName: string;
  totalAmount: number;
  currency: string;
  deliveryTime: number;
  validUntil: string;
  status: 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  items: Array<{
    itemId: string;
    unitPrice: number;
    totalPrice: number;
    deliveryTime: number;
  }>;
  createdAt: string;
}

interface VendorState {
  vendors: Vendor[];
  quotes: Quote[];
  selectedVendors: string[];
  isLoading: boolean;
  error: string | null;
  filters: {
    serviceArea: string[];
    rating: number | null;
    active: boolean | null;
  };
}

const initialState: VendorState = {
  vendors: [],
  quotes: [],
  selectedVendors: [],
  isLoading: false,
  error: null,
  filters: {
    serviceArea: [],
    rating: null,
    active: null,
  },
};

const vendorSlice = createSlice({
  name: 'vendors',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setVendors: (state, action: PayloadAction<Vendor[]>) => {
      state.vendors = action.payload;
    },
    addVendor: (state, action: PayloadAction<Vendor>) => {
      state.vendors.push(action.payload);
    },
    updateVendor: (state, action: PayloadAction<Vendor>) => {
      const index = state.vendors.findIndex(v => v.id === action.payload.id);
      if (index !== -1) {
        state.vendors[index] = action.payload;
      }
    },
    setQuotes: (state, action: PayloadAction<Quote[]>) => {
      state.quotes = action.payload;
    },
    addQuote: (state, action: PayloadAction<Quote>) => {
      state.quotes.push(action.payload);
    },
    updateQuote: (state, action: PayloadAction<Quote>) => {
      const index = state.quotes.findIndex(q => q.id === action.payload.id);
      if (index !== -1) {
        state.quotes[index] = action.payload;
      }
    },
    setSelectedVendors: (state, action: PayloadAction<string[]>) => {
      state.selectedVendors = action.payload;
    },
    toggleVendorSelection: (state, action: PayloadAction<string>) => {
      const vendorId = action.payload;
      const index = state.selectedVendors.indexOf(vendorId);
      if (index !== -1) {
        state.selectedVendors.splice(index, 1);
      } else {
        state.selectedVendors.push(vendorId);
      }
    },
    setFilters: (state, action: PayloadAction<Partial<VendorState['filters']>>) => {
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
  setVendors,
  addVendor,
  updateVendor,
  setQuotes,
  addQuote,
  updateQuote,
  setSelectedVendors,
  toggleVendorSelection,
  setFilters,
  clearFilters,
} = vendorSlice.actions;

export default vendorSlice.reducer;
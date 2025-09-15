import {createSlice, PayloadAction} from '@reduxjs/toolkit';

interface NavigationState {
  currentRoute: string;
  previousRoute: string | null;
  tabIndex: number;
  drawerOpen: boolean;
  navigationHistory: string[];
  deepLinkData: any | null;
}

const initialState: NavigationState = {
  currentRoute: 'Home',
  previousRoute: null,
  tabIndex: 0,
  drawerOpen: false,
  navigationHistory: [],
  deepLinkData: null,
};

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    setCurrentRoute: (state, action: PayloadAction<string>) => {
      state.previousRoute = state.currentRoute;
      state.currentRoute = action.payload;
      
      // Add to history (keep last 10 routes)
      state.navigationHistory.push(action.payload);
      if (state.navigationHistory.length > 10) {
        state.navigationHistory.shift();
      }
    },
    setTabIndex: (state, action: PayloadAction<number>) => {
      state.tabIndex = action.payload;
    },
    toggleDrawer: (state) => {
      state.drawerOpen = !state.drawerOpen;
    },
    setDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.drawerOpen = action.payload;
    },
    setDeepLinkData: (state, action: PayloadAction<any>) => {
      state.deepLinkData = action.payload;
    },
    clearDeepLinkData: (state) => {
      state.deepLinkData = null;
    },
    clearNavigationHistory: (state) => {
      state.navigationHistory = [];
    },
  },
});

export const {
  setCurrentRoute,
  setTabIndex,
  toggleDrawer,
  setDrawerOpen,
  setDeepLinkData,
  clearDeepLinkData,
  clearNavigationHistory,
} = navigationSlice.actions;

export default navigationSlice.reducer;
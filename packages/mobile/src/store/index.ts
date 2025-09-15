import {configureStore, combineReducers} from '@reduxjs/toolkit';
import {persistStore, persistReducer} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import slices
import authSlice from './slices/authSlice';
import navigationSlice from './slices/navigationSlice';
import requisitionSlice from './slices/requisitionSlice';
import vendorSlice from './slices/vendorSlice';
import notificationSlice from './slices/notificationSlice';
import offlineSlice from './slices/offlineSlice';
import dashboardSlice from './slices/dashboardSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'offline', 'dashboard'], // Only persist these reducers
  blacklist: ['navigation'], // Don't persist navigation state
};

const rootReducer = combineReducers({
  auth: authSlice,
  navigation: navigationSlice,
  requisitions: requisitionSlice,
  vendors: vendorSlice,
  notifications: notificationSlice,
  offline: offlineSlice,
  dashboard: dashboardSlice,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
import AsyncStorage from '@react-native-async-storage/async-storage';
import {User} from '../../store/slices/authSlice';

interface StoredAuth {
  user: User;
  token: string;
  refreshToken: string;
  sessionExpiry: string;
}

const AUTH_STORAGE_KEY = '@flowmarine_auth';
const TOKEN_STORAGE_KEY = '@flowmarine_token';
const REFRESH_TOKEN_STORAGE_KEY = '@flowmarine_refresh_token';

export const checkStoredAuth = async (): Promise<StoredAuth | null> => {
  try {
    const [authData, token, refreshToken] = await Promise.all([
      AsyncStorage.getItem(AUTH_STORAGE_KEY),
      AsyncStorage.getItem(TOKEN_STORAGE_KEY),
      AsyncStorage.getItem(REFRESH_TOKEN_STORAGE_KEY),
    ]);

    if (!authData || !token) {
      return null;
    }

    const parsedAuth = JSON.parse(authData);
    
    // Check if session is expired
    if (parsedAuth.sessionExpiry && new Date(parsedAuth.sessionExpiry) < new Date()) {
      // Session expired, clear stored auth
      await clearStoredAuth();
      return null;
    }

    return {
      user: parsedAuth.user,
      token,
      refreshToken: refreshToken || '',
      sessionExpiry: parsedAuth.sessionExpiry,
    };
  } catch (error) {
    console.error('Error checking stored auth:', error);
    return null;
  }
};

export const storeAuth = async (authData: StoredAuth): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        user: authData.user,
        sessionExpiry: authData.sessionExpiry,
      })),
      AsyncStorage.setItem(TOKEN_STORAGE_KEY, authData.token),
      AsyncStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, authData.refreshToken),
    ]);
  } catch (error) {
    console.error('Error storing auth:', error);
    throw error;
  }
};

export const clearStoredAuth = async (): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_STORAGE_KEY),
      AsyncStorage.removeItem(TOKEN_STORAGE_KEY),
      AsyncStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY),
    ]);
  } catch (error) {
    console.error('Error clearing stored auth:', error);
  }
};

export const updateStoredToken = async (token: string, sessionExpiry: string): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_STORAGE_KEY, token),
      AsyncStorage.mergeItem(AUTH_STORAGE_KEY, JSON.stringify({sessionExpiry})),
    ]);
  } catch (error) {
    console.error('Error updating stored token:', error);
    throw error;
  }
};
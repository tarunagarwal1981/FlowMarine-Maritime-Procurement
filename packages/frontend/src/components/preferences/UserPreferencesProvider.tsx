import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserPreferences {
  // Display preferences
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  currency: string;
  numberFormat: string;
  
  // Dashboard preferences
  defaultDashboard: string;
  dashboardRefreshInterval: number;
  showWelcomeMessage: boolean;
  compactMode: boolean;
  
  // Notification preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
  notificationSound: boolean;
  notificationFrequency: 'immediate' | 'hourly' | 'daily';
  notificationTypes: {
    requisitionApproval: boolean;
    orderUpdates: boolean;
    budgetAlerts: boolean;
    systemMaintenance: boolean;
    securityAlerts: boolean;
  };
  
  // Table preferences
  defaultPageSize: number;
  showRowNumbers: boolean;
  enableColumnResize: boolean;
  enableColumnReorder: boolean;
  
  // Search preferences
  saveSearchHistory: boolean;
  maxSearchHistory: number;
  defaultSearchOperator: 'contains' | 'equals' | 'startsWith';
  
  // Accessibility preferences
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
    screenReaderMode: boolean;
    keyboardNavigation: boolean;
    focusIndicators: boolean;
    colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  };
  
  // Maritime-specific preferences
  maritime: {
    defaultVessel: string;
    preferredPorts: string[];
    defaultUrgencyLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
    showVesselPosition: boolean;
    enableOfflineMode: boolean;
  };
  
  // Privacy preferences
  privacy: {
    shareUsageData: boolean;
    allowCookies: boolean;
    dataRetention: '30days' | '90days' | '1year' | 'indefinite';
  };
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;
  exportPreferences: () => void;
  importPreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/dd/yyyy',
  timeFormat: '12h',
  currency: 'USD',
  numberFormat: 'en-US',
  
  defaultDashboard: 'executive',
  dashboardRefreshInterval: 30000,
  showWelcomeMessage: true,
  compactMode: false,
  
  emailNotifications: true,
  pushNotifications: true,
  notificationSound: true,
  notificationFrequency: 'immediate',
  notificationTypes: {
    requisitionApproval: true,
    orderUpdates: true,
    budgetAlerts: true,
    systemMaintenance: true,
    securityAlerts: true,
  },
  
  defaultPageSize: 25,
  showRowNumbers: false,
  enableColumnResize: true,
  enableColumnReorder: true,
  
  saveSearchHistory: true,
  maxSearchHistory: 10,
  defaultSearchOperator: 'contains',
  
  accessibility: {
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenReaderMode: false,
    keyboardNavigation: true,
    focusIndicators: true,
    colorBlindMode: 'none',
  },
  
  maritime: {
    defaultVessel: '',
    preferredPorts: [],
    defaultUrgencyLevel: 'ROUTINE',
    showVesselPosition: true,
    enableOfflineMode: true,
  },
  
  privacy: {
    shareUsageData: false,
    allowCookies: true,
    dataRetention: '1year',
  },
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferences must be used within UserPreferencesProvider');
  }
  return context;
};

interface UserPreferencesProviderProps {
  children: React.ReactNode;
}

export const UserPreferencesProvider: React.FC<UserPreferencesProviderProps> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  // Apply theme changes
  useEffect(() => {
    applyTheme(preferences.theme);
  }, [preferences.theme]);

  // Apply accessibility preferences
  useEffect(() => {
    applyAccessibilitySettings(preferences.accessibility);
  }, [preferences.accessibility]);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to load from server first
      const response = await fetch('/api/user/preferences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const serverPreferences = await response.json();
        setPreferences({ ...defaultPreferences, ...serverPreferences });
      } else {
        // Fallback to localStorage
        const localPreferences = localStorage.getItem('user-preferences');
        if (localPreferences) {
          setPreferences({ ...defaultPreferences, ...JSON.parse(localPreferences) });
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
      setError('Failed to load preferences');
      
      // Fallback to localStorage
      const localPreferences = localStorage.getItem('user-preferences');
      if (localPreferences) {
        setPreferences({ ...defaultPreferences, ...JSON.parse(localPreferences) });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    try {
      setError(null);
      const newPreferences = { ...preferences, ...updates };
      
      // Update local state immediately for better UX
      setPreferences(newPreferences);
      
      // Save to localStorage as backup
      localStorage.setItem('user-preferences', JSON.stringify(newPreferences));
      
      // Save to server
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newPreferences)
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences to server');
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
      setError('Failed to save preferences');
    }
  };

  const resetPreferences = async () => {
    try {
      setError(null);
      setPreferences(defaultPreferences);
      
      localStorage.setItem('user-preferences', JSON.stringify(defaultPreferences));
      
      const response = await fetch('/api/user/preferences/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to reset preferences on server');
      }
    } catch (error) {
      console.error('Failed to reset preferences:', error);
      setError('Failed to reset preferences');
    }
  };

  const exportPreferences = () => {
    const dataStr = JSON.stringify(preferences, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'flowmarine-preferences.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const importPreferences = async (importedPreferences: Partial<UserPreferences>) => {
    try {
      setError(null);
      const validatedPreferences = validatePreferences(importedPreferences);
      await updatePreferences(validatedPreferences);
    } catch (error) {
      console.error('Failed to import preferences:', error);
      setError('Failed to import preferences');
    }
  };

  const validatePreferences = (prefs: Partial<UserPreferences>): Partial<UserPreferences> => {
    // Basic validation to ensure imported preferences are safe
    const validated: Partial<UserPreferences> = {};
    
    // Validate theme
    if (prefs.theme && ['light', 'dark', 'system'].includes(prefs.theme)) {
      validated.theme = prefs.theme;
    }
    
    // Validate language
    if (prefs.language && typeof prefs.language === 'string') {
      validated.language = prefs.language;
    }
    
    // Validate timezone
    if (prefs.timezone && typeof prefs.timezone === 'string') {
      validated.timezone = prefs.timezone;
    }
    
    // Add more validation as needed...
    
    return validated;
  };

  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.toggle('dark', systemTheme === 'dark');
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  };

  const applyAccessibilitySettings = (accessibility: UserPreferences['accessibility']) => {
    const root = document.documentElement;
    
    root.classList.toggle('high-contrast', accessibility.highContrast);
    root.classList.toggle('large-text', accessibility.largeText);
    root.classList.toggle('reduced-motion', accessibility.reducedMotion);
    root.classList.toggle('enhanced-focus', accessibility.focusIndicators);
    
    // Remove existing color blind classes
    root.classList.remove('protanopia', 'deuteranopia', 'tritanopia');
    if (accessibility.colorBlindMode !== 'none') {
      root.classList.add(accessibility.colorBlindMode);
    }
  };

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        updatePreferences,
        resetPreferences,
        exportPreferences,
        importPreferences,
        isLoading,
        error
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
};
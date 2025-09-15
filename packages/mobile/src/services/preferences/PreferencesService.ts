import AsyncStorage from '@react-native-async-storage/async-storage';
import {Appearance, ColorSchemeName} from 'react-native';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    enabled: boolean; // notifications enabled categories structure
    categories: {
      requisition: boolean;
      approval: boolean;
      delivery: boolean;
      emergency: boolean;
      system: boolean;
    };
    quietHours: {
      enabled: boolean;
      start: string; // HH:MM format
      end: string; // HH:MM format
    };
    vibration: boolean;
    sound: boolean;
  };
  dataSync: {
    autoSync: boolean;
    syncInterval: number; // minutes - dataSync autoSync syncInterval wifiOnly
    wifiOnly: boolean;
    backgroundSync: boolean;
  };
  offline: {
    cacheSize: number; // MB - offline cacheSize retentionDays
    retentionDays: number;
    autoCleanup: boolean;
  };
  security: {
    biometricEnabled: boolean; // security biometricEnabled pinEnabled autoLockEnabled
    pinEnabled: boolean;
    autoLockEnabled: boolean;
    autoLockTimeout: number; // minutes
    sessionTimeout: number; // minutes
  };
  display: {
    fontSize: 'small' | 'medium' | 'large'; // display fontSize highContrast reducedMotion
    highContrast: boolean;
    reducedMotion: boolean;
  };
  regional: {
    currency: string; // regional currency dateFormat timeFormat timezone
    dateFormat: string;
    timeFormat: '12h' | '24h';
    timezone: string;
  };
}

class PreferencesService {
  private readonly PREFERENCES_KEY = 'user_preferences';
  private readonly DEFAULT_PREFERENCES: UserPreferences = {
    theme: 'system',
    language: 'en',
    notifications: {
      enabled: true,
      categories: {
        requisition: true,
        approval: true,
        delivery: true,
        emergency: true,
        system: true,
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '07:00',
      },
      vibration: true,
      sound: true,
    },
    dataSync: {
      autoSync: true,
      syncInterval: 15,
      wifiOnly: false,
      backgroundSync: true,
    },
    offline: {
      cacheSize: 100,
      retentionDays: 30,
      autoCleanup: true,
    },
    security: {
      biometricEnabled: false,
      pinEnabled: false,
      autoLockEnabled: true,
      autoLockTimeout: 5,
      sessionTimeout: 30,
    },
    display: {
      fontSize: 'medium',
      highContrast: false,
      reducedMotion: false,
    },
    regional: {
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
      timezone: 'UTC',
    },
  };

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences> {
    try {
      const stored = await AsyncStorage.getItem(this.PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all properties exist
        return this.mergeWithDefaults(parsed);
      }
    } catch (error) {
      console.error('Error getting preferences:', error);
    }
    
    return this.DEFAULT_PREFERENCES;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(updates: Partial<UserPreferences>): Promise<void> {
    try {
      const current = await this.getPreferences();
      const updated = this.deepMerge(current, updates);
      await AsyncStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(this.DEFAULT_PREFERENCES));
    } catch (error) {
      console.error('Error resetting preferences:', error);
      throw error;
    }
  }

  /**
   * Get current theme based on preferences
   */
  async getCurrentTheme(): Promise<ColorSchemeName> {
    const preferences = await this.getPreferences();
    
    if (preferences.theme === 'system') {
      return Appearance.getColorScheme();
    }
    
    return preferences.theme as ColorSchemeName;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): Array<{code: string; name: string; nativeName: string}> {
    return [
      {code: 'en', name: 'English', nativeName: 'English'},
      {code: 'es', name: 'Spanish', nativeName: 'Español'},
      {code: 'fr', name: 'French', nativeName: 'Français'},
      {code: 'de', name: 'German', nativeName: 'Deutsch'},
      {code: 'zh', name: 'Chinese', nativeName: '中文'},
      {code: 'ja', name: 'Japanese', nativeName: '日本語'},
      {code: 'ko', name: 'Korean', nativeName: '한국어'},
      {code: 'pt', name: 'Portuguese', nativeName: 'Português'},
      {code: 'ru', name: 'Russian', nativeName: 'Русский'},
      {code: 'ar', name: 'Arabic', nativeName: 'العربية'},
    ];
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies(): Array<{code: string; name: string; symbol: string}> {
    return [
      {code: 'USD', name: 'US Dollar', symbol: '$'},
      {code: 'EUR', name: 'Euro', symbol: '€'},
      {code: 'GBP', name: 'British Pound', symbol: '£'},
      {code: 'JPY', name: 'Japanese Yen', symbol: '¥'},
      {code: 'CNY', name: 'Chinese Yuan', symbol: '¥'},
      {code: 'KRW', name: 'South Korean Won', symbol: '₩'},
      {code: 'SGD', name: 'Singapore Dollar', symbol: 'S$'},
      {code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$'},
      {code: 'AUD', name: 'Australian Dollar', symbol: 'A$'},
      {code: 'CAD', name: 'Canadian Dollar', symbol: 'C$'},
      {code: 'CHF', name: 'Swiss Franc', symbol: 'CHF'},
      {code: 'SEK', name: 'Swedish Krona', symbol: 'kr'},
      {code: 'NOK', name: 'Norwegian Krone', symbol: 'kr'},
      {code: 'DKK', name: 'Danish Krone', symbol: 'kr'},
    ];
  }

  /**
   * Get supported timezones
   */
  getSupportedTimezones(): Array<{value: string; label: string; offset: string}> {
    return [
      {value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00'},
      {value: 'America/New_York', label: 'Eastern Time (US & Canada)', offset: '-05:00'},
      {value: 'America/Chicago', label: 'Central Time (US & Canada)', offset: '-06:00'},
      {value: 'America/Denver', label: 'Mountain Time (US & Canada)', offset: '-07:00'},
      {value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)', offset: '-08:00'},
      {value: 'Europe/London', label: 'London', offset: '+00:00'},
      {value: 'Europe/Paris', label: 'Paris, Berlin, Rome', offset: '+01:00'},
      {value: 'Europe/Athens', label: 'Athens, Helsinki', offset: '+02:00'},
      {value: 'Asia/Tokyo', label: 'Tokyo, Osaka', offset: '+09:00'},
      {value: 'Asia/Shanghai', label: 'Beijing, Shanghai', offset: '+08:00'},
      {value: 'Asia/Singapore', label: 'Singapore', offset: '+08:00'},
      {value: 'Asia/Dubai', label: 'Dubai', offset: '+04:00'},
      {value: 'Australia/Sydney', label: 'Sydney, Melbourne', offset: '+10:00'},
    ];
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = {...target};
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Merge with defaults to ensure all properties exist
   */
  private mergeWithDefaults(preferences: any): UserPreferences {
    return this.deepMerge(this.DEFAULT_PREFERENCES, preferences);
  }

  /**
   * Export preferences for backup
   */
  async exportPreferences(): Promise<string> {
    const preferences = await this.getPreferences();
    return JSON.stringify(preferences, null, 2);
  }

  /**
   * Import preferences from backup
   */
  async importPreferences(preferencesJson: string): Promise<void> {
    try {
      const preferences = JSON.parse(preferencesJson);
      const merged = this.mergeWithDefaults(preferences);
      await AsyncStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(merged));
    } catch (error) {
      console.error('Error importing preferences:', error);
      throw new Error('Invalid preferences format');
    }
  }
}

export default new PreferencesService();
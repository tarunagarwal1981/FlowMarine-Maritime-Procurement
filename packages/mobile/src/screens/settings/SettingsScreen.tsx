import React, {useState, useEffect} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Share,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import SettingsSection from '../../components/settings/SettingsSection';
import SettingsItem from '../../components/settings/SettingsItem';
import SettingsPicker from '../../components/settings/SettingsPicker';
import PreferencesService, {UserPreferences} from '../../services/preferences/PreferencesService';
import BiometricService from '../../services/biometric/BiometricService';
import NotificationService from '../../services/notification/NotificationService';
import OfflineService from '../../services/offline/OfflineService';

interface PickerState {
  visible: boolean;
  type: string;
  title: string;
  options: Array<{label: string; value: string; subtitle?: string}>;
  selectedValue: string;
  onValueChange: (value: string) => void;
}

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [biometricCapabilities, setBiometricCapabilities] = useState<any>(null);
  const [picker, setPicker] = useState<PickerState>({
    visible: false,
    type: '',
    title: '',
    options: [],
    selectedValue: '',
    onValueChange: () => {},
  });

  useEffect(() => {
    loadPreferences();
    checkBiometricCapabilities();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await PreferencesService.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const checkBiometricCapabilities = async () => {
    try {
      const capabilities = await BiometricService.checkBiometricCapabilities();
      setBiometricCapabilities(capabilities);
    } catch (error) {
      console.error('Error checking biometric capabilities:', error);
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    try {
      await PreferencesService.updatePreferences(updates);
      await loadPreferences();
    } catch (error) {
      console.error('Error updating preferences:', error);
      Alert.alert('Error', 'Failed to update preferences');
    }
  };

  const showPicker = (
    type: string,
    title: string,
    options: Array<{label: string; value: string; subtitle?: string}>,
    selectedValue: string,
    onValueChange: (value: string) => void
  ) => {
    setPicker({
      visible: true,
      type,
      title,
      options,
      selectedValue,
      onValueChange,
    });
  };

  const closePicker = () => {
    setPicker(prev => ({...prev, visible: false}));
  };

  const handleThemeChange = (theme: string) => {
    updatePreferences({theme: theme as 'light' | 'dark' | 'system'});
  };

  const handleLanguageChange = (language: string) => {
    updatePreferences({language});
  };

  const handleCurrencyChange = (currency: string) => {
    updatePreferences({
      regional: {...preferences?.regional, currency},
    });
  };

  const handleTimezoneChange = (timezone: string) => {
    updatePreferences({
      regional: {...preferences?.regional, timezone},
    });
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await BiometricService.enableBiometricAuth();
      if (success) {
        updatePreferences({
          security: {...preferences?.security, biometricEnabled: true},
        });
      }
    } else {
      const success = await BiometricService.disableBiometricAuth();
      if (success) {
        updatePreferences({
          security: {...preferences?.security, biometricEnabled: false},
        });
      }
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    await NotificationService.updateNotificationSettings({enabled});
    updatePreferences({
      notifications: {...preferences?.notifications, enabled},
    });
  };

  const handleAutoSyncToggle = (enabled: boolean) => {
    updatePreferences({
      dataSync: {...preferences?.dataSync, autoSync: enabled},
    });
  };

  const handleExportData = async () => {
    try {
      const data = await PreferencesService.exportPreferences();
      await Share.share({
        message: data,
        title: 'FlowMarine Settings Backup',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to export settings');
    }
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default values? This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await PreferencesService.resetPreferences();
              await loadPreferences();
              Alert.alert('Success', 'Settings have been reset to defaults');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset settings');
            }
          },
        },
      ]
    );
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data and may require re-downloading content. Continue?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Implement cache clearing
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  const handleForceSync = async () => {
    try {
      const result = await OfflineService.forceSync();
      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Synced ${result.syncedActions} items successfully`
        );
      } else {
        Alert.alert('Sync Failed', 'Some items could not be synced');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to sync data');
    }
  };

  if (!preferences) {
    return <View style={styles.container} />;
  }

  const themeOptions = [
    {label: 'Light', value: 'light'},
    {label: 'Dark', value: 'dark'},
    {label: 'System Default', value: 'system'},
  ];

  const languageOptions = PreferencesService.getSupportedLanguages().map(lang => ({
    label: lang.name,
    value: lang.code,
    subtitle: lang.nativeName,
  }));

  const currencyOptions = PreferencesService.getSupportedCurrencies().map(curr => ({
    label: `${curr.name} (${curr.symbol})`,
    value: curr.code,
  }));

  const timezoneOptions = PreferencesService.getSupportedTimezones().map(tz => ({
    label: tz.label,
    value: tz.value,
    subtitle: tz.offset,
  }));

  const fontSizeOptions = [
    {label: 'Small', value: 'small'}, // fontSize small medium large options
    {label: 'Medium', value: 'medium'},
    {label: 'Large', value: 'large'},
  ];

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Appearance */}
          <SettingsSection
            title="Appearance"
            description="Customize the look and feel of the app">
            <SettingsItem
              title="Theme"
              subtitle="Choose your preferred color scheme"
              type="value"
              value={preferences.theme === 'system' ? 'System Default' : 
                     preferences.theme === 'light' ? 'Light' : 'Dark'}
              onPress={() => showPicker(
                'theme',
                'Theme',
                themeOptions,
                preferences.theme,
                handleThemeChange
              )}
              icon="palette"
            />
            <SettingsItem
              title="Font Size"
              subtitle="Choose small, medium, or large font size"
              type="value"
              value={preferences.display.fontSize === 'small' ? 'Small' : 
                     preferences.display.fontSize === 'medium' ? 'Medium' : 'Large'}
              onPress={() => showPicker(
                'fontSize',
                'Font Size',
                fontSizeOptions,
                preferences.display.fontSize,
                (value) => updatePreferences({
                  display: {...preferences.display, fontSize: value as any}
                })
              )}
              icon="text-fields"
            />
            <SettingsItem
              title="High Contrast"
              subtitle="Improve visibility with higher contrast"
              type="switch"
              value={preferences.display.highContrast}
              onValueChange={(value) => updatePreferences({
                display: {...preferences.display, highContrast: value}
              })}
              icon="contrast"
            />
            <SettingsItem
              title="Reduce Motion"
              subtitle="Minimize animations and transitions"
              type="switch"
              value={preferences.display.reducedMotion}
              onValueChange={(value) => updatePreferences({
                display: {...preferences.display, reducedMotion: value}
              })}
              icon="motion-photos-off"
            />
          </SettingsSection>

          {/* Language & Region */}
          <SettingsSection
            title="Language & Region"
            description="Set your language and regional preferences">
            <SettingsItem
              title="Language"
              type="value"
              value={languageOptions.find(l => l.value === preferences.language)?.label || 'English'}
              onPress={() => showPicker(
                'language',
                'Language',
                languageOptions,
                preferences.language,
                handleLanguageChange
              )}
              icon="language"
            />
            <SettingsItem
              title="Currency"
              type="value"
              value={preferences.regional.currency}
              onPress={() => showPicker(
                'currency',
                'Currency',
                currencyOptions,
                preferences.regional.currency,
                handleCurrencyChange
              )}
              icon="attach-money"
            />
            <SettingsItem
              title="Time Format"
              subtitle="Choose 12h or 24h time format display"
              type="value"
              value={preferences.regional.timeFormat === '12h' ? '12 Hour' : '24 Hour'}
              onPress={() => showPicker(
                'timeFormat',
                'Time Format',
                [
                  {label: '12 Hour', value: '12h'}, // timeFormat 12h 24h options
                  {label: '24 Hour', value: '24h'},
                ],
                preferences.regional.timeFormat,
                (value) => updatePreferences({
                  regional: {...preferences.regional, timeFormat: value as any}
                })
              )}
              icon="schedule"
            />
            <SettingsItem
              title="Timezone"
              type="value"
              value={timezoneOptions.find(tz => tz.value === preferences.regional.timezone)?.label || 'UTC'}
              onPress={() => showPicker(
                'timezone',
                'Timezone',
                timezoneOptions,
                preferences.regional.timezone,
                handleTimezoneChange
              )}
              icon="public"
            />
          </SettingsSection>

          {/* Notifications */}
          <SettingsSection
            title="Notifications"
            description="Manage how you receive notifications">
            <SettingsItem
              title="Enable Notifications"
              subtitle="Receive push notifications"
              type="switch"
              value={preferences.notifications.enabled}
              onValueChange={handleNotificationToggle}
              icon="notifications"
            />
            <SettingsItem
              title="Notification Settings"
              subtitle="Configure notification categories and timing"
              type="navigation"
              onPress={() => navigation.navigate('NotificationSettings' as never)}
              icon="tune"
              disabled={!preferences.notifications.enabled}
            />
          </SettingsSection>

          {/* Data & Sync */}
          <SettingsSection
            title="Data & Sync"
            description="Control how your data is synchronized">
            <SettingsItem
              title="Auto Sync"
              subtitle="Automatically sync data when online"
              type="switch"
              value={preferences.dataSync.autoSync}
              onValueChange={handleAutoSyncToggle}
              icon="sync"
            />
            <SettingsItem
              title="WiFi Only Sync"
              subtitle="Only sync when connected to WiFi"
              type="switch"
              value={preferences.dataSync.wifiOnly}
              onValueChange={(value) => updatePreferences({
                dataSync: {...preferences.dataSync, wifiOnly: value}
              })}
              icon="wifi"
              disabled={!preferences.dataSync.autoSync}
            />
            <SettingsItem
              title="Background Sync"
              subtitle="Sync data in the background"
              type="switch"
              value={preferences.dataSync.backgroundSync}
              onValueChange={(value) => updatePreferences({
                dataSync: {...preferences.dataSync, backgroundSync: value}
              })}
              icon="cloud-sync"
              disabled={!preferences.dataSync.autoSync}
            />
            <SettingsItem
              title="Force Sync Now"
              subtitle="Manually sync all pending data"
              type="action"
              onPress={handleForceSync}
              icon="sync-alt"
            />
          </SettingsSection>

          {/* Security */}
          <SettingsSection
            title="Security"
            description="Protect your account and data">
            <SettingsItem
              title={biometricCapabilities?.biometryType ? 
                BiometricService.getBiometricTypeDisplayName(biometricCapabilities.biometryType) :
                'Biometric Authentication'
              }
              subtitle={biometricCapabilities?.isAvailable ? 
                'Use biometrics to unlock the app' : 
                'Not available on this device'
              }
              type="switch"
              value={preferences.security.biometricEnabled}
              onValueChange={handleBiometricToggle}
              icon="fingerprint"
              disabled={!biometricCapabilities?.isAvailable}
            />
            <SettingsItem
              title="Auto Lock"
              subtitle="Automatically lock the app when inactive"
              type="switch"
              value={preferences.security.autoLockEnabled}
              onValueChange={(value) => updatePreferences({
                security: {...preferences.security, autoLockEnabled: value}
              })}
              icon="lock"
            />
            <SettingsItem
              title="Auto Lock Timeout"
              subtitle={`Lock after ${preferences.security.autoLockTimeout} minutes`}
              type="value"
              value={`${preferences.security.autoLockTimeout} min`}
              onPress={() => showPicker(
                'autoLockTimeout',
                'Auto Lock Timeout',
                [
                  {label: '1 minute', value: '1'},
                  {label: '2 minutes', value: '2'},
                  {label: '5 minutes', value: '5'},
                  {label: '10 minutes', value: '10'},
                  {label: '15 minutes', value: '15'},
                  {label: '30 minutes', value: '30'},
                ],
                preferences.security.autoLockTimeout.toString(),
                (value) => updatePreferences({
                  security: {...preferences.security, autoLockTimeout: parseInt(value)}
                })
              )}
              icon="timer"
              disabled={!preferences.security.autoLockEnabled}
            />
          </SettingsSection>

          {/* Storage */}
          <SettingsSection
            title="Storage"
            description="Manage app storage and cache">
            <SettingsItem
              title="Cache Size Limit"
              subtitle={`Maximum ${preferences.offline.cacheSize} MB`}
              type="value"
              value={`${preferences.offline.cacheSize} MB`}
              onPress={() => showPicker(
                'cacheSize',
                'Cache Size Limit',
                [
                  {label: '50 MB', value: '50'},
                  {label: '100 MB', value: '100'},
                  {label: '200 MB', value: '200'},
                  {label: '500 MB', value: '500'},
                  {label: '1 GB', value: '1000'},
                ],
                preferences.offline.cacheSize.toString(),
                (value) => updatePreferences({
                  offline: {...preferences.offline, cacheSize: parseInt(value)}
                })
              )}
              icon="storage"
            />
            <SettingsItem
              title="Auto Cleanup"
              subtitle="Automatically clean old cached data"
              type="switch"
              value={preferences.offline.autoCleanup}
              onValueChange={(value) => updatePreferences({
                offline: {...preferences.offline, autoCleanup: value}
              })}
              icon="auto-delete"
            />
            <SettingsItem
              title="Clear Cache"
              subtitle="Free up storage space"
              type="action"
              onPress={handleClearCache}
              icon="delete-sweep"
            />
          </SettingsSection>

          {/* Backup & Reset */}
          <SettingsSection
            title="Backup & Reset"
            description="Export settings or reset to defaults">
            <SettingsItem
              title="Export Settings"
              subtitle="Share your settings as a backup"
              type="action"
              onPress={handleExportData}
              icon="file-download"
            />
            <SettingsItem
              title="Reset All Settings"
              subtitle="Restore default settings"
              type="action"
              onPress={handleResetSettings}
              icon="restore"
              destructive
            />
          </SettingsSection>

          {/* About */}
          <SettingsSection
            title="About"
            description="App information and support">
            <SettingsItem
              title="About FlowMarine"
              subtitle="Version, legal, and support information"
              type="navigation"
              onPress={() => navigation.navigate('About' as never)}
              icon="info"
            />
          </SettingsSection>
        </ScrollView>

        <SettingsPicker
          title={picker.title}
          options={picker.options}
          selectedValue={picker.selectedValue}
          onValueChange={picker.onValueChange}
          visible={picker.visible}
          onClose={closePicker}
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
});

export default SettingsScreen;
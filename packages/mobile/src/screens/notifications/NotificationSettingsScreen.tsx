import React, {useState, useEffect} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import SettingsSection from '../../components/settings/SettingsSection';
import SettingsItem from '../../components/settings/SettingsItem';
import NotificationService, {NotificationSettings} from '../../services/notification/NotificationService';
import PreferencesService from '../../services/preferences/PreferencesService';

const NotificationSettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const notificationSettings = await NotificationService.getNotificationSettings();
      setSettings(notificationSettings);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const updateSettings = async (updates: Partial<NotificationSettings>) => {
    if (!settings) return;

    try {
      const updatedSettings = {...settings, ...updates};
      await NotificationService.updateNotificationSettings(updatedSettings);
      
      // Also update preferences
      await PreferencesService.updatePreferences({
        notifications: updatedSettings,
      });
      
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating notification settings:', error);
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  const handleCategoryToggle = (category: keyof NotificationSettings['categories'], enabled: boolean) => {
    if (!settings) return;
    
    updateSettings({
      categories: {
        ...settings.categories,
        [category]: enabled,
      },
    });
  };

  const handleQuietHoursToggle = (enabled: boolean) => {
    if (!settings) return;
    
    updateSettings({
      quietHours: {
        ...settings.quietHours,
        enabled,
      },
    });
  };

  const handleTimeChange = (time: Date, isStart: boolean) => {
    if (!settings) return;
    
    const timeString = time.toTimeString().slice(0, 5); // HH:MM format
    
    updateSettings({
      quietHours: {
        ...settings.quietHours,
        [isStart ? 'start' : 'end']: timeString,
      },
    });
  };

  const parseTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const formatTime = (timeString: string): string => {
    const date = parseTime(timeString);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const testNotification = () => {
    NotificationService.showLocalNotification({
      id: 'test_notification',
      title: 'Test Notification',
      body: 'This is a test notification from FlowMarine',
      priority: 'normal',
      category: 'system',
    });
  };

  if (!settings) {
    return (
      <ErrorBoundary>
        <View style={styles.container} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* General Settings - sound and vibration controls */}
          <SettingsSection
            title="General"
            description="Overall notification preferences">
            <SettingsItem
              title="Enable Notifications"
              subtitle="Receive push notifications"
              type="switch"
              value={settings.enabled}
              onValueChange={(enabled) => updateSettings({enabled})}
              icon="notifications"
            />
            <SettingsItem
              title="Sound"
              subtitle="Play sound for notifications - sound setting"
              type="switch"
              value={settings.sound}
              onValueChange={(sound) => updateSettings({sound})}
              icon="volume-up"
              disabled={!settings.enabled}
            />
            <SettingsItem
              title="Vibration"
              subtitle="Vibrate for notifications - vibration setting"
              type="switch"
              value={settings.vibration}
              onValueChange={(vibration) => updateSettings({vibration})}
              icon="vibration"
              disabled={!settings.enabled}
            />
            <SettingsItem
              title="Test Notification"
              subtitle="Send a test notification"
              type="action"
              onPress={testNotification}
              icon="notification-add"
              disabled={!settings.enabled}
            />
          </SettingsSection>

          {/* Notification Categories - categories: requisition, approval, delivery, emergency, system */}
          <SettingsSection
            title="Categories"
            description="Choose which types of notifications to receive">
            <SettingsItem
              title="Requisitions"
              subtitle="New requisitions and updates"
              type="switch"
              value={settings.categories.requisition}
              onValueChange={(enabled) => handleCategoryToggle('requisition', enabled)}
              icon="assignment"
              disabled={!settings.enabled}
            />
            <SettingsItem
              title="Approvals"
              subtitle="Approval requests and decisions"
              type="switch"
              value={settings.categories.approval}
              onValueChange={(enabled) => handleCategoryToggle('approval', enabled)}
              icon="check-circle"
              disabled={!settings.enabled}
            />
            <SettingsItem
              title="Deliveries"
              subtitle="Delivery status and updates"
              type="switch"
              value={settings.categories.delivery}
              onValueChange={(enabled) => handleCategoryToggle('delivery', enabled)}
              icon="local-shipping"
              disabled={!settings.enabled}
            />
            <SettingsItem
              title="Emergency"
              subtitle="Critical alerts and emergency notifications"
              type="switch"
              value={settings.categories.emergency}
              onValueChange={(enabled) => handleCategoryToggle('emergency', enabled)}
              icon="warning"
              disabled={!settings.enabled}
            />
            <SettingsItem
              title="System"
              subtitle="App updates and system messages"
              type="switch"
              value={settings.categories.system}
              onValueChange={(enabled) => handleCategoryToggle('system', enabled)}
              icon="settings"
              disabled={!settings.enabled}
            />
          </SettingsSection>

          {/* Quiet Hours - quietHours enabled start end times */}
          <SettingsSection
            title="Quiet Hours"
            description="Silence notifications during specific hours">
            <SettingsItem
              title="Enable Quiet Hours"
              subtitle="Mute notifications during set hours"
              type="switch"
              value={settings.quietHours.enabled}
              onValueChange={handleQuietHoursToggle}
              icon="do-not-disturb"
              disabled={!settings.enabled}
            />
            <SettingsItem
              title="Start Time"
              subtitle={`Quiet hours begin at ${formatTime(settings.quietHours.start)}`}
              type="value"
              value={formatTime(settings.quietHours.start)}
              onPress={() => setShowStartTimePicker(true)}
              icon="bedtime"
              disabled={!settings.enabled || !settings.quietHours.enabled}
            />
            <SettingsItem
              title="End Time"
              subtitle={`Quiet hours end at ${formatTime(settings.quietHours.end)}`}
              type="value"
              value={formatTime(settings.quietHours.end)}
              onPress={() => setShowEndTimePicker(true)}
              icon="wb-sunny"
              disabled={!settings.enabled || !settings.quietHours.enabled}
            />
          </SettingsSection>

          {/* Advanced Settings */}
          <SettingsSection
            title="Advanced"
            description="Additional notification options">
            <SettingsItem
              title="Badge Count"
              subtitle="Show notification count on app icon"
              type="switch"
              value={true} // TODO: Add to settings
              onValueChange={() => {}} // TODO: Implement
              icon="notifications-active"
              disabled={!settings.enabled || Platform.OS !== 'ios'}
            />
            <SettingsItem
              title="Lock Screen"
              subtitle="Show notifications on lock screen"
              type="switch"
              value={true} // TODO: Add to settings
              onValueChange={() => {}} // TODO: Implement
              icon="lock-open"
              disabled={!settings.enabled}
            />
            <SettingsItem
              title="Notification History"
              subtitle="Keep history of received notifications"
              type="switch"
              value={true} // TODO: Add to settings
              onValueChange={() => {}} // TODO: Implement
              icon="history"
              disabled={!settings.enabled}
            />
          </SettingsSection>
        </ScrollView>

        {/* Time Pickers */}
        <DatePicker
          modal
          open={showStartTimePicker}
          date={parseTime(settings.quietHours.start)}
          mode="time"
          onConfirm={(time) => {
            setShowStartTimePicker(false);
            handleTimeChange(time, true);
          }}
          onCancel={() => setShowStartTimePicker(false)}
          title="Select Start Time"
        />

        <DatePicker
          modal
          open={showEndTimePicker}
          date={parseTime(settings.quietHours.end)}
          mode="time"
          onConfirm={(time) => {
            setShowEndTimePicker(false);
            handleTimeChange(time, false);
          }}
          onCancel={() => setShowEndTimePicker(false)}
          title="Select End Time"
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

export default NotificationSettingsScreen;
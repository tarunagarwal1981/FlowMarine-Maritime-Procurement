import messaging, {FirebaseMessagingTypes} from '@react-native-firebase/messaging';
import PushNotification, {Importance} from 'react-native-push-notification';
import {Platform, Alert, Linking} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  category: 'requisition' | 'approval' | 'delivery' | 'emergency' | 'system';
  vesselId?: string;
  userId?: string;
}

export interface NotificationSettings {
  enabled: boolean;
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
}

class NotificationService {
  private readonly SETTINGS_KEY = 'notification_settings';
  private readonly FCM_TOKEN_KEY = 'fcm_token';
  private isInitialized = false;

  /**
   * Initialize notification service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Request permissions
      await this.requestPermissions();
      
      // Configure local notifications
      this.configurePushNotification();
      
      // Initialize Firebase messaging
      await this.initializeFirebaseMessaging();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          Alert.alert(
            'Notifications Disabled',
            'Please enable notifications in Settings to receive important updates.',
            [
              {text: 'Cancel'},
              {text: 'Settings', onPress: () => Linking.openSettings()},
            ]
          );
        }

        return enabled;
      } else {
        const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
        return result === RESULTS.GRANTED;
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Configure local push notifications
   */
  private configurePushNotification(): void {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('Local notification token:', token);
      },

      onNotification: (notification) => {
        console.log('Local notification received:', notification);
        
        // Handle notification tap
        if (notification.userInteraction) {
          this.handleNotificationTap(notification);
        }
      },

      onAction: (notification) => {
        console.log('Notification action:', notification);
      },

      onRegistrationError: (err) => {
        console.error('Notification registration error:', err);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      this.createNotificationChannels();
    }
  }

  /**
   * Create notification channels for Android
   */
  private createNotificationChannels(): void {
    const channels = [
      {
        channelId: 'critical',
        channelName: 'Critical Alerts',
        channelDescription: 'Emergency and critical system alerts',
        importance: Importance.HIGH,
        vibrate: true,
        playSound: true,
      },
      {
        channelId: 'requisition',
        channelName: 'Requisitions',
        channelDescription: 'Requisition updates and approvals',
        importance: Importance.DEFAULT,
        vibrate: true,
        playSound: true,
      },
      {
        channelId: 'delivery',
        channelName: 'Deliveries',
        channelDescription: 'Delivery status updates',
        importance: Importance.DEFAULT,
        vibrate: false,
        playSound: true,
      },
      {
        channelId: 'system',
        channelName: 'System',
        channelDescription: 'System notifications and updates',
        importance: Importance.LOW,
        vibrate: false,
        playSound: false,
      },
    ];

    channels.forEach(channel => {
      PushNotification.createChannel(
        {
          channelId: channel.channelId,
          channelName: channel.channelName,
          channelDescription: channel.channelDescription,
          importance: channel.importance,
          vibrate: channel.vibrate,
          playSound: channel.playSound,
        },
        (created) => console.log(`Channel ${channel.channelId} created: ${created}`)
      );
    });
  }

  /**
   * Initialize Firebase Cloud Messaging
   */
  private async initializeFirebaseMessaging(): Promise<void> {
    try {
      // Get FCM token
      const token = await messaging().getToken();
      await AsyncStorage.setItem(this.FCM_TOKEN_KEY, token);
      console.log('FCM Token:', token);

      // Listen for token refresh
      messaging().onTokenRefresh(async (newToken) => {
        await AsyncStorage.setItem(this.FCM_TOKEN_KEY, newToken);
        // Send new token to server
        await this.sendTokenToServer(newToken);
      });

      // Handle background messages
      messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        console.log('Background message:', remoteMessage);
        await this.handleBackgroundMessage(remoteMessage);
      });

      // Handle foreground messages
      messaging().onMessage(async (remoteMessage) => {
        console.log('Foreground message:', remoteMessage);
        await this.handleForegroundMessage(remoteMessage);
      });

      // Send token to server
      await this.sendTokenToServer(token);
    } catch (error) {
      console.error('Error initializing Firebase messaging:', error);
    }
  }

  /**
   * Send FCM token to server
   */
  private async sendTokenToServer(token: string): Promise<void> {
    try {
      // TODO: Implement API call to register token with backend
      console.log('Sending token to server:', token);
    } catch (error) {
      console.error('Error sending token to server:', error);
    }
  }

  /**
   * Handle background message
   */
  private async handleBackgroundMessage(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    const settings = await this.getNotificationSettings();
    
    if (!settings.enabled) return;

    // Check if notification category is enabled
    const category = remoteMessage.data?.category as keyof NotificationSettings['categories'];
    if (category && !settings.categories[category]) return;

    // Check quiet hours
    if (this.isInQuietHours(settings.quietHours)) return;

    // Show local notification
    this.showLocalNotification({
      id: remoteMessage.messageId || Date.now().toString(),
      title: remoteMessage.notification?.title || 'FlowMarine',
      body: remoteMessage.notification?.body || 'New notification',
      data: remoteMessage.data,
      priority: (remoteMessage.data?.priority as any) || 'normal',
      category: category || 'system',
    });
  }

  /**
   * Handle foreground message
   */
  private async handleForegroundMessage(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    const settings = await this.getNotificationSettings();
    
    if (!settings.enabled) return;

    // For critical messages, always show
    if (remoteMessage.data?.priority === 'critical') {
      this.showLocalNotification({
        id: remoteMessage.messageId || Date.now().toString(),
        title: remoteMessage.notification?.title || 'Critical Alert',
        body: remoteMessage.notification?.body || 'Critical notification',
        data: remoteMessage.data,
        priority: 'critical',
        category: 'emergency',
      });
      return;
    }

    // Check category settings
    const category = remoteMessage.data?.category as keyof NotificationSettings['categories'];
    if (category && !settings.categories[category]) return;

    // Show in-app notification or banner
    this.showInAppNotification(remoteMessage);
  }

  /**
   * Show local notification
   */
  showLocalNotification(payload: NotificationPayload): void {
    const channelId = this.getChannelId(payload.category, payload.priority);
    
    PushNotification.localNotification({
      id: payload.id,
      title: payload.title,
      message: payload.body,
      channelId,
      userInfo: payload.data,
      priority: payload.priority === 'critical' ? 'high' : 'default',
      vibrate: payload.priority === 'critical',
      playSound: true,
      soundName: payload.priority === 'critical' ? 'emergency.mp3' : 'default',
      actions: this.getNotificationActions(payload.category),
    });
  }

  /**
   * Show in-app notification
   */
  private showInAppNotification(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    // TODO: Implement in-app notification banner
    console.log('Showing in-app notification:', remoteMessage);
  }

  /**
   * Get notification channel ID
   */
  private getChannelId(category: string, priority: string): string {
    if (priority === 'critical') return 'critical';
    
    switch (category) {
      case 'requisition':
      case 'approval':
        return 'requisition';
      case 'delivery':
        return 'delivery';
      case 'emergency':
        return 'critical';
      default:
        return 'system';
    }
  }

  /**
   * Get notification actions based on category
   */
  private getNotificationActions(category: string): string[] {
    switch (category) {
      case 'requisition':
        return ['View', 'Approve', 'Reject'];
      case 'approval':
        return ['View', 'Open'];
      case 'delivery':
        return ['View', 'Track'];
      case 'emergency':
        return ['View', 'Respond'];
      default:
        return ['View'];
    }
  }

  /**
   * Handle notification tap
   */
  private handleNotificationTap(notification: any): void {
    // TODO: Implement navigation to relevant screen
    console.log('Notification tapped:', notification);
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(quietHours: NotificationSettings['quietHours']): boolean {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const settings = await AsyncStorage.getItem(this.SETTINGS_KEY);
      if (settings) {
        return JSON.parse(settings);
      }
    } catch (error) {
      console.error('Error getting notification settings:', error);
    }

    // Return default settings
    return {
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
    };
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      const currentSettings = await this.getNotificationSettings();
      const updatedSettings = {...currentSettings, ...settings};
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  }

  /**
   * Get FCM token
   */
  async getFCMToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.FCM_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
  }

  /**
   * Cancel specific notification
   */
  cancelNotification(id: string): void {
    PushNotification.cancelLocalNotifications({id});
  }
}

export default new NotificationService();
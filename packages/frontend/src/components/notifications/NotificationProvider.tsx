import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUserPreferences } from '../preferences/UserPreferencesProvider';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'urgent';
  category: 'requisitionApproval' | 'orderUpdates' | 'budgetAlerts' | 'systemMaintenance' | 'securityAlerts' | 'general';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
  expiresAt?: Date;
  persistent?: boolean;
  sound?: string;
  vibration?: number[];
}

export interface NotificationAction {
  id: string;
  label: string;
  action: () => void;
  variant?: 'default' | 'destructive' | 'outline';
}

export interface NotificationRule {
  id: string;
  name: string;
  conditions: {
    category?: string[];
    priority?: string[];
    keywords?: string[];
    timeRange?: { start: string; end: string };
  };
  actions: {
    sound?: boolean;
    vibration?: boolean;
    email?: boolean;
    push?: boolean;
    desktop?: boolean;
  };
  enabled: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  clearExpired: () => void;
  getNotificationsByCategory: (category: string) => Notification[];
  getNotificationsByPriority: (priority: string) => Notification[];
  requestPermission: () => Promise<boolean>;
  isPermissionGranted: boolean;
  rules: NotificationRule[];
  addRule: (rule: Omit<NotificationRule, 'id'>) => void;
  updateRule: (id: string, updates: Partial<NotificationRule>) => void;
  removeRule: (id: string) => void;
  testRule: (rule: NotificationRule) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { preferences } = useUserPreferences();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [rules, setRules] = useState<NotificationRule[]>([]);

  // Load notifications and rules on mount
  useEffect(() => {
    loadNotifications();
    loadRules();
    checkPermission();
  }, []);

  // Auto-clear expired notifications
  useEffect(() => {
    const interval = setInterval(clearExpired, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Save notifications to localStorage when they change
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Save rules to localStorage when they change
  useEffect(() => {
    localStorage.setItem('notification-rules', JSON.stringify(rules));
  }, [rules]);

  const loadNotifications = () => {
    const saved = localStorage.getItem('notifications');
    if (saved) {
      const parsed = JSON.parse(saved);
      setNotifications(parsed.map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp),
        expiresAt: n.expiresAt ? new Date(n.expiresAt) : undefined
      })));
    }
  };

  const loadRules = () => {
    const saved = localStorage.getItem('notification-rules');
    if (saved) {
      setRules(JSON.parse(saved));
    } else {
      // Set default rules
      setRules([
        {
          id: 'critical-alerts',
          name: 'Critical Alerts',
          conditions: { priority: ['critical'] },
          actions: { sound: true, vibration: true, desktop: true, push: true },
          enabled: true
        },
        {
          id: 'security-alerts',
          name: 'Security Alerts',
          conditions: { category: ['securityAlerts'] },
          actions: { sound: true, desktop: true, email: true },
          enabled: true
        },
        {
          id: 'budget-alerts',
          name: 'Budget Alerts',
          conditions: { category: ['budgetAlerts'] },
          actions: { desktop: true, email: true },
          enabled: true
        }
      ]);
    }
  };

  const checkPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.permission;
      setIsPermissionGranted(permission === 'granted');
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setIsPermissionGranted(granted);
      return granted;
    }
    return false;
  };

  const shouldProcessNotification = (notification: Notification): boolean => {
    if (!preferences.pushNotifications && !preferences.emailNotifications) {
      return false;
    }

    // Check if notification type is enabled in preferences
    const typeEnabled = preferences.notificationTypes[notification.category as keyof typeof preferences.notificationTypes];
    if (typeEnabled === false) {
      return false;
    }

    return true;
  };

  const processNotificationRules = (notification: Notification) => {
    const applicableRules = rules.filter(rule => {
      if (!rule.enabled) return false;

      const { conditions } = rule;
      
      // Check category
      if (conditions.category && !conditions.category.includes(notification.category)) {
        return false;
      }

      // Check priority
      if (conditions.priority && !conditions.priority.includes(notification.priority)) {
        return false;
      }

      // Check keywords
      if (conditions.keywords) {
        const text = `${notification.title} ${notification.message}`.toLowerCase();
        const hasKeyword = conditions.keywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        );
        if (!hasKeyword) return false;
      }

      // Check time range
      if (conditions.timeRange) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [startHour, startMin] = conditions.timeRange.start.split(':').map(Number);
        const [endHour, endMin] = conditions.timeRange.end.split(':').map(Number);
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        if (currentTime < startTime || currentTime > endTime) {
          return false;
        }
      }

      return true;
    });

    // Execute rule actions
    applicableRules.forEach(rule => {
      if (rule.actions.sound && preferences.notificationSound) {
        playNotificationSound(notification.sound);
      }

      if (rule.actions.vibration && 'vibrate' in navigator) {
        navigator.vibrate(notification.vibration || [200, 100, 200]);
      }

      if (rule.actions.desktop && isPermissionGranted) {
        showDesktopNotification(notification);
      }

      if (rule.actions.push) {
        showPushNotification(notification);
      }

      if (rule.actions.email) {
        sendEmailNotification(notification);
      }
    });
  };

  const playNotificationSound = (soundUrl?: string) => {
    try {
      const audio = new Audio(soundUrl || '/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(console.error);
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  };

  const showDesktopNotification = (notification: Notification) => {
    if (isPermissionGranted) {
      const desktopNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/icons/notification-icon.png',
        badge: '/icons/badge-icon.png',
        tag: notification.id,
        requireInteraction: notification.priority === 'critical',
        silent: !preferences.notificationSound
      });

      desktopNotification.onclick = () => {
        window.focus();
        markAsRead(notification.id);
        desktopNotification.close();
      };

      // Auto-close after 5 seconds for non-critical notifications
      if (notification.priority !== 'critical') {
        setTimeout(() => desktopNotification.close(), 5000);
      }
    }
  };

  const showPushNotification = async (notification: Notification) => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(notification.title, {
          body: notification.message,
          icon: '/icons/notification-icon.png',
          badge: '/icons/badge-icon.png',
          tag: notification.id,
          data: notification,
          requireInteraction: notification.priority === 'critical',
          actions: notification.actions?.map(action => ({
            action: action.id,
            title: action.label
          })) || []
        });
      } catch (error) {
        console.error('Failed to show push notification:', error);
      }
    }
  };

  const sendEmailNotification = async (notification: Notification) => {
    try {
      await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          type: notification.type,
          category: notification.category,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          metadata: notification.metadata
        })
      });
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  };

  const addNotification = useCallback((notificationData: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const notification: Notification = {
      ...notificationData,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false
    };

    if (shouldProcessNotification(notification)) {
      setNotifications(prev => [notification, ...prev]);
      processNotificationRules(notification);
    }
  }, [preferences, rules, isPermissionGranted]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const clearExpired = () => {
    const now = new Date();
    setNotifications(prev => 
      prev.filter(n => !n.expiresAt || n.expiresAt > now)
    );
  };

  const getNotificationsByCategory = (category: string) => {
    return notifications.filter(n => n.category === category);
  };

  const getNotificationsByPriority = (priority: string) => {
    return notifications.filter(n => n.priority === priority);
  };

  const addRule = (ruleData: Omit<NotificationRule, 'id'>) => {
    const rule: NotificationRule = {
      ...ruleData,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    setRules(prev => [...prev, rule]);
  };

  const updateRule = (id: string, updates: Partial<NotificationRule>) => {
    setRules(prev => 
      prev.map(rule => rule.id === id ? { ...rule, ...updates } : rule)
    );
  };

  const removeRule = (id: string) => {
    setRules(prev => prev.filter(rule => rule.id !== id));
  };

  const testRule = (rule: NotificationRule) => {
    const testNotification: Notification = {
      id: 'test-notification',
      type: 'info',
      category: 'general',
      title: 'Test Notification',
      message: 'This is a test notification to verify your rule configuration.',
      timestamp: new Date(),
      read: false,
      priority: 'medium'
    };

    processNotificationRules(testNotification);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        removeNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        clearExpired,
        getNotificationsByCategory,
        getNotificationsByPriority,
        requestPermission,
        isPermissionGranted,
        rules,
        addRule,
        updateRule,
        removeRule,
        testRule
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
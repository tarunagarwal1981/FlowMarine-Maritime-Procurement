import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import NotificationService, {NotificationSettings, NotificationPayload} from './NotificationService';

interface NotificationContextType {
  settings: NotificationSettings | null;
  isInitialized: boolean;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  showNotification: (payload: NotificationPayload) => void;
  clearAllNotifications: () => void;
  cancelNotification: (id: string) => void;
  getFCMToken: () => Promise<string | null>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({children}) => {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeNotifications();
  }, []);

  const initializeNotifications = async () => {
    try {
      await NotificationService.initialize();
      const currentSettings = await NotificationService.getNotificationSettings();
      setSettings(currentSettings);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    try {
      await NotificationService.updateNotificationSettings(newSettings);
      const updatedSettings = await NotificationService.getNotificationSettings();
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  };

  const showNotification = (payload: NotificationPayload) => {
    NotificationService.showLocalNotification(payload);
  };

  const clearAllNotifications = () => {
    NotificationService.clearAllNotifications();
  };

  const cancelNotification = (id: string) => {
    NotificationService.cancelNotification(id);
  };

  const getFCMToken = async (): Promise<string | null> => {
    return NotificationService.getFCMToken();
  };

  const value: NotificationContextType = {
    settings,
    isInitialized,
    updateSettings,
    showNotification,
    clearAllNotifications,
    cancelNotification,
    getFCMToken,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
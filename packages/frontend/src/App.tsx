import { useEffect } from 'react';
import { useAppSelector } from './store/hooks';
import { selectIsAuthenticated } from './store/slices/authSlice';
import { offlineStorage } from './utils/offlineStorage';
import { offlineSyncService } from './services/offlineSyncService';
import { websocketService } from './services/websocketService';
import { AppRouter } from './router/AppRouter';

function App() {
  // Redux state
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    // Initialize offline functionality
    offlineStorage.initialize();
    offlineSyncService.initialize();

    // Initialize WebSocket service
    if (isAuthenticated) {
      websocketService.connect();
      // Request notification permission
      websocketService.requestNotificationPermission();
    }

    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
          
          // Listen for service worker messages
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'BACKGROUND_SYNC') {
              // Trigger sync when service worker requests it
              offlineSyncService.forceSync();
            }
          });
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }

    // Handle app visibility changes for sync
    const handleVisibilityChange = () => {
      if (!document.hidden && navigator.onLine) {
        // App became visible and we're online, trigger sync
        setTimeout(() => {
          offlineSyncService.forceSync();
        }, 1000);
        
        // Reconnect WebSocket if needed
        if (isAuthenticated && !websocketService.isConnected()) {
          websocketService.connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      websocketService.disconnect();
    };
  }, [isAuthenticated]);

  return <AppRouter />;
}

export default App;
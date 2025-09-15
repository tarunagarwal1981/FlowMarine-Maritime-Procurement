import React, {useEffect, useState} from 'react';
import {StatusBar, Platform} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {store, persistor} from './store/index';
import {AuthProvider} from './services/auth/AuthProvider';
import {BiometricProvider} from './services/biometric/BiometricProvider';
import {NotificationProvider} from './services/notification/NotificationProvider';
import {OfflineProvider} from './services/offline/OfflineProvider';
import {DeviceProvider} from './services/device/DeviceProvider';
import {SensorProvider} from './services/sensor/SensorProvider';
import {DeepLinkProvider} from './services/deeplink/DeepLinkProvider';
import AppNavigator from './navigation/AppNavigator';
import LoadingScreen from './screens/LoadingScreen';
import {SplashScreen} from './components/splash/SplashScreen';
import {initializeApp} from './services/app/AppInitializer';
import {splashService} from './services/splash/SplashService';
import {deepLinkService} from './services/deeplink/DeepLinkService';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeAppWithSplash = async () => {
      try {
        // Show splash screen
        splashService.show();

        // Initialize app services
        await initializeApp();
        await splashService.initializeApp();

        // Mark app as ready
        setIsReady(true);
      } catch (error) {
        console.error('App initialization failed:', error);
        setIsReady(true); // Continue even if initialization fails
      }
    };

    initializeAppWithSplash();
  }, []);

  const handleSplashComplete = async () => {
    try {
      await splashService.hide();
      setIsLoading(false);
    } catch (error) {
      console.error('Error hiding splash screen:', error);
      setIsLoading(false);
    }
  };

  // Deep link configuration
  const linking = {
    prefixes: deepLinkService.getConfig().prefixes,
    config: deepLinkService.getConfig().config,
  };

  if (isLoading) {
    return (
      <SplashScreen 
        onAnimationComplete={isReady ? handleSplashComplete : undefined}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate loading={<SplashScreen />} persistor={persistor}>
            <AuthProvider>
              <BiometricProvider>
                <NotificationProvider>
                  <OfflineProvider>
                    <DeviceProvider>
                      <SensorProvider autoStart={false}>
                        <NavigationContainer linking={linking}>
                          <DeepLinkProvider>
                            <StatusBar
                              barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
                              backgroundColor="#1e40af"
                            />
                            <AppNavigator />
                          </DeepLinkProvider>
                        </NavigationContainer>
                      </SensorProvider>
                    </DeviceProvider>
                  </OfflineProvider>
                </NotificationProvider>
              </BiometricProvider>
            </AuthProvider>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
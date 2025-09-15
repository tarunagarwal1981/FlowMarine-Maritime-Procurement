import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import {Platform, Dimensions} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import {useDispatch} from 'react-redux';
import {setOnlineStatus} from '@store/slices/offlineSlice';
import {PermissionsAndroid, Permission} from 'react-native';

interface DeviceContextType {
  deviceInfo: {
    platform: string;
    version: string;
    model: string;
    uniqueId: string;
    isTablet: boolean;
    screenDimensions: {
      width: number;
      height: number;
    };
  };
  networkInfo: {
    isConnected: boolean;
    type: string;
    isInternetReachable: boolean;
  };
  permissions: {
    camera: boolean;
    location: boolean;
    storage: boolean;
    sensors: boolean;
  };
  requestSensorPermissions: () => Promise<boolean>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

interface DeviceProviderProps {
  children: ReactNode;
}

export const DeviceProvider: React.FC<DeviceProviderProps> = ({children}) => {
  const dispatch = useDispatch();
  const [deviceInfo, setDeviceInfo] = useState({
    platform: Platform.OS,
    version: Platform.Version.toString(),
    model: '',
    uniqueId: '',
    isTablet: false,
    screenDimensions: Dimensions.get('window'),
  });

  const [networkInfo, setNetworkInfo] = useState({
    isConnected: true,
    type: 'unknown',
    isInternetReachable: true,
  });

  const [permissions, setPermissions] = useState({
    camera: false,
    location: false,
    storage: false,
    sensors: false,
  });

  useEffect(() => {
    initializeDeviceInfo();
    setupNetworkListener();
    checkPermissions();
  }, []);

  const initializeDeviceInfo = async () => {
    try {
      const [model, uniqueId, isTablet] = await Promise.all([
        DeviceInfo.getModel(),
        DeviceInfo.getUniqueId(),
        DeviceInfo.isTablet(),
      ]);

      setDeviceInfo(prev => ({
        ...prev,
        model,
        uniqueId,
        isTablet,
      }));
    } catch (error) {
      console.error('Error getting device info:', error);
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const networkState = {
        isConnected: state.isConnected ?? false,
        type: state.type,
        isInternetReachable: state.isInternetReachable ?? false,
      };

      setNetworkInfo(networkState);
      dispatch(setOnlineStatus(networkState.isConnected && networkState.isInternetReachable));
    });

    return unsubscribe;
  };

  const checkPermissions = async () => {
    try {
      let sensorPermission = true;
      
      // On Android, check for sensor permissions
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BODY_SENSORS
          );
          sensorPermission = granted;
        } catch (error) {
          console.warn('Error checking sensor permissions:', error);
          sensorPermission = false;
        }
      }

      setPermissions({
        camera: false,
        location: false,
        storage: false,
        sensors: sensorPermission,
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const requestSensorPermissions = async function(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BODY_SENSORS,
          {
            title: 'Sensor Access Permission',
            message: 'FlowMarine needs access to device sensors to monitor vessel environmental conditions and provide motion-based features.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        
        setPermissions(prev => ({
          ...prev,
          sensors: hasPermission,
        }));

        return hasPermission;
      }
      
      // iOS doesn't require explicit permission for basic sensor access
      setPermissions(prev => ({
        ...prev,
        sensors: true,
      }));
      
      return true;
    } catch (error) {
      console.error('Error requesting sensor permissions:', error);
      return false;
    }
  };

  const checkSensorAvailability = async () => {
    // Sensor availability check implementation
    try {
      return {
        accelerometer: true,
        gyroscope: true,
        magnetometer: true,
      };
    } catch (error) {
      console.error('Error checking sensor availability:', error);
      return {
        accelerometer: false,
        gyroscope: false,
        magnetometer: false,
      };
    }
  };

  const contextValue: DeviceContextType = {
    deviceInfo,
    networkInfo,
    permissions,
    requestSensorPermissions,
  };

  return (
    <DeviceContext.Provider value={contextValue}>
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = (): DeviceContextType => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
};
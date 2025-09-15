import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import SensorService, {
  EnvironmentalData,
  SensorConfig,
  MotionEvent,
  SensorDataCallback,
  MotionEventCallback,
} from './SensorService';

interface SensorContextType {
  environmentalData: EnvironmentalData;
  isActive: boolean;
  sensorAvailability: {
    accelerometer: boolean;
    gyroscope: boolean;
    magnetometer: boolean;
  };
  startSensors: () => void;
  stopSensors: () => void;
  updateConfig: (config: Partial<SensorConfig>) => void;
  subscribeToMotionEvents: (callback: MotionEventCallback) => () => void;
}

const SensorContext = createContext<SensorContextType | undefined>(undefined);

interface SensorProviderProps {
  children: ReactNode;
  config?: Partial<SensorConfig>;
  autoStart?: boolean;
}

export const SensorProvider: React.FC<SensorProviderProps> = ({
  children,
  config,
  autoStart = false,
}) => {
  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalData>({
    accelerometer: null,
    gyroscope: null,
    magnetometer: null,
    motionIntensity: 0,
    orientation: 'unknown',
    stability: 'stable',
    seaConditions: 'calm',
  });

  const [isActive, setIsActive] = useState(false);
  const [sensorAvailability, setSensorAvailability] = useState({
    accelerometer: false,
    gyroscope: false,
    magnetometer: false,
  });

  useEffect(() => {
    initializeSensors();
    
    return () => {
      SensorService.stop();
    };
  }, []);

  useEffect(() => {
    if (autoStart) {
      startSensors();
    }
  }, [autoStart]);

  const initializeSensors = async () => {
    try {
      // Initialize sensor service
      SensorService.initialize(config);

      // Check sensor availability
      const availability = await SensorService.checkSensorAvailability();
      setSensorAvailability(availability);

      // Subscribe to sensor data updates
      const unsubscribe = SensorService.subscribe(handleSensorDataUpdate);

      return unsubscribe;
    } catch (error) {
      console.error('Error initializing sensors:', error);
    }
  };

  const handleSensorDataUpdate: SensorDataCallback = (data: EnvironmentalData) => {
    setEnvironmentalData(data);
  };

  const startSensors = function() {
    try {
      SensorService.start();
      setIsActive(true);
    } catch (error) {
      console.error('Error starting sensors:', error);
    }
  };

  const stopSensors = function() {
    try {
      SensorService.stop();
      setIsActive(false);
    } catch (error) {
      console.error('Error stopping sensors:', error);
    }
  };

  const updateConfig = (newConfig: Partial<SensorConfig>) => {
    try {
      SensorService.updateConfig(newConfig);
    } catch (error) {
      console.error('Error updating sensor config:', error);
    }
  };

  const subscribeToMotionEvents = (callback: MotionEventCallback) => {
    return SensorService.subscribeToMotionEvents(callback);
  };

  const contextValue: SensorContextType = {
    environmentalData,
    isActive,
    sensorAvailability,
    startSensors,
    stopSensors,
    updateConfig,
    subscribeToMotionEvents,
  };

  return (
    <SensorContext.Provider value={contextValue}>
      {children}
    </SensorContext.Provider>
  );
};

export const useSensor = (): SensorContextType => {
  const context = useContext(SensorContext);
  if (!context) {
    throw new Error('useSensor must be used within a SensorProvider');
  }
  return context;
};

export default SensorProvider;
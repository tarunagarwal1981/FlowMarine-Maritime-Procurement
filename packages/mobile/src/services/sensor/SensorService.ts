import {
  accelerometer,
  gyroscope,
  magnetometer,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import {Subscription} from 'rxjs';
import {map, filter} from 'rxjs/operators';

interface SensorData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface GyroscopeData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface MagnetometerData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface EnvironmentalData {
  accelerometer: AccelerometerData | null;
  gyroscope: GyroscopeData | null;
  magnetometer: MagnetometerData | null;
  motionIntensity: number;
  orientation: 'portrait' | 'landscape' | 'unknown';
  stability: 'stable' | 'moderate' | 'unstable';
  seaConditions: 'calm' | 'moderate' | 'rough' | 'very_rough';
}

export interface SensorConfig {
  updateInterval: number;
  enableAccelerometer: boolean;
  enableGyroscope: boolean;
  enableMagnetometer: boolean;
  motionThreshold: number;
  stabilityThreshold: number;
}

export type SensorDataCallback = (data: EnvironmentalData) => void;
export type MotionEventCallback = (event: MotionEvent) => void;

export interface MotionEvent {
  type: 'shake' | 'tilt' | 'rotation' | 'impact';
  intensity: number;
  timestamp: number;
  data: AccelerometerData | GyroscopeData;
}

class SensorService {
  private subscriptions: Map<string, Subscription> = new Map();
  private callbacks: Set<SensorDataCallback> = new Set();
  private motionCallbacks: Set<MotionEventCallback> = new Set();
  private isActive = false;
  private config: SensorConfig = {
    updateInterval: 100, // 100ms
    enableAccelerometer: true,
    enableGyroscope: true,
    enableMagnetometer: true,
    motionThreshold: 2.0,
    stabilityThreshold: 0.5,
  };

  private currentData: EnvironmentalData = {
    accelerometer: null,
    gyroscope: null,
    magnetometer: null,
    motionIntensity: 0,
    orientation: 'unknown',
    stability: 'stable',
    seaConditions: 'calm',
  };

  private motionHistory: AccelerometerData[] = [];
  private readonly MOTION_HISTORY_SIZE = 20;

  /**
   * Initialize sensor service with configuration
   */
  initialize(config?: Partial<SensorConfig>): void {
    if (config) {
      this.config = {...this.config, ...config};
    }

    // Set update intervals for sensors
    setUpdateIntervalForType(SensorTypes.accelerometer, this.config.updateInterval);
    setUpdateIntervalForType(SensorTypes.gyroscope, this.config.updateInterval);
    setUpdateIntervalForType(SensorTypes.magnetometer, this.config.updateInterval);
  }

  /**
   * Start sensor monitoring
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;

    if (this.config.enableAccelerometer) {
      this.startAccelerometer();
    }

    if (this.config.enableGyroscope) {
      this.startGyroscope();
    }

    if (this.config.enableMagnetometer) {
      this.startMagnetometer();
    }
  }

  /**
   * Stop sensor monitoring
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions.clear();
    this.motionHistory = [];
  }

  /**
   * Subscribe to sensor data updates
   */
  subscribe(callback: SensorDataCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Subscribe to motion events
   */
  subscribeToMotionEvents(callback: MotionEventCallback): () => void {
    this.motionCallbacks.add(callback);
    return () => this.motionCallbacks.delete(callback);
  }

  /**
   * Get current environmental data
   */
  getCurrentData(): EnvironmentalData {
    return {...this.currentData};
  }

  /**
   * Update sensor configuration
   */
  updateConfig(config: Partial<SensorConfig>): void {
    const wasActive = this.isActive;
    
    if (wasActive) {
      this.stop();
    }

    this.config = {...this.config, ...config};
    
    if (wasActive) {
      this.start();
    }
  }

  /**
   * Check if sensors are available
   */
  async checkSensorAvailability(): Promise<{
    accelerometer: boolean;
    gyroscope: boolean;
    magnetometer: boolean;
  }> {
    try {
      // Test sensor availability by attempting to subscribe briefly
      const availability = {
        accelerometer: false,
        gyroscope: false,
        magnetometer: false,
      };

      // Test accelerometer
      try {
        const accelSub = accelerometer.subscribe();
        availability.accelerometer = true;
        accelSub.unsubscribe();
      } catch (error) {
        console.warn('Accelerometer not available:', error);
      }

      // Test gyroscope
      try {
        const gyroSub = gyroscope.subscribe();
        availability.gyroscope = true;
        gyroSub.unsubscribe();
      } catch (error) {
        console.warn('Gyroscope not available:', error);
      }

      // Test magnetometer
      try {
        const magSub = magnetometer.subscribe();
        availability.magnetometer = true;
        magSub.unsubscribe();
      } catch (error) {
        console.warn('Magnetometer not available:', error);
      }

      return availability;
    } catch (error) {
      console.error('Error checking sensor availability:', error);
      return {
        accelerometer: false,
        gyroscope: false,
        magnetometer: false,
      };
    }
  }

  private startAccelerometer(): void {
    const subscription = accelerometer
      .pipe(
        map((data: SensorData) => ({
          x: data.x,
          y: data.y,
          z: data.z,
          timestamp: data.timestamp,
        })),
        filter(data => data.x !== undefined && data.y !== undefined && data.z !== undefined)
      )
      .subscribe(
        (data: AccelerometerData) => {
          this.currentData.accelerometer = data;
          this.updateMotionAnalysis(data);
          this.notifyCallbacks();
        },
        error => console.error('Accelerometer error:', error)
      );

    this.subscriptions.set('accelerometer', subscription);
  }

  private startGyroscope(): void {
    const subscription = gyroscope
      .pipe(
        map((data: SensorData) => ({
          x: data.x,
          y: data.y,
          z: data.z,
          timestamp: data.timestamp,
        })),
        filter(data => data.x !== undefined && data.y !== undefined && data.z !== undefined)
      )
      .subscribe(
        (data: GyroscopeData) => {
          this.currentData.gyroscope = data;
          this.updateOrientationAnalysis(data);
          this.notifyCallbacks();
        },
        error => console.error('Gyroscope error:', error)
      );

    this.subscriptions.set('gyroscope', subscription);
  }

  private startMagnetometer(): void {
    const subscription = magnetometer
      .pipe(
        map((data: SensorData) => ({
          x: data.x,
          y: data.y,
          z: data.z,
          timestamp: data.timestamp,
        })),
        filter(data => data.x !== undefined && data.y !== undefined && data.z !== undefined)
      )
      .subscribe(
        (data: MagnetometerData) => {
          this.currentData.magnetometer = data;
          this.notifyCallbacks();
        },
        error => console.error('Magnetometer error:', error)
      );

    this.subscriptions.set('magnetometer', subscription);
  }

  private updateMotionAnalysis(data: AccelerometerData): void {
    // Add to motion history
    this.motionHistory.push(data);
    if (this.motionHistory.length > this.MOTION_HISTORY_SIZE) {
      this.motionHistory.shift();
    }

    // Calculate motion intensity
    const magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
    this.currentData.motionIntensity = magnitude;

    // Determine stability
    if (this.motionHistory.length >= 5) {
      const recentMagnitudes = this.motionHistory.slice(-5).map(d => 
        Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z)
      );
      const variance = this.calculateVariance(recentMagnitudes);
      
      if (variance < this.config.stabilityThreshold) {
        this.currentData.stability = 'stable';
      } else if (variance < this.config.stabilityThreshold * 2) {
        this.currentData.stability = 'moderate';
      } else {
        this.currentData.stability = 'unstable';
      }
    }

    // Determine sea conditions based on motion patterns
    this.updateSeaConditions(magnitude);

    // Detect motion events
    this.detectMotionEvents(data, magnitude);
  }

  private updateOrientationAnalysis(data: GyroscopeData): void {
    // Simple orientation detection based on gyroscope data
    const rotationMagnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
    
    if (rotationMagnitude > 1.0) {
      // Device is rotating
      if (Math.abs(data.z) > Math.abs(data.x) && Math.abs(data.z) > Math.abs(data.y)) {
        this.currentData.orientation = Math.abs(data.z) > 0 ? 'landscape' : 'portrait';
      }
    }
  }

  private updateSeaConditions(motionMagnitude: number): void {
    // Maritime-specific sea condition analysis
    if (motionMagnitude < 10.5) {
      this.currentData.seaConditions = 'calm';
    } else if (motionMagnitude < 12.0) {
      this.currentData.seaConditions = 'moderate';
    } else if (motionMagnitude < 15.0) {
      this.currentData.seaConditions = 'rough';
    } else {
      this.currentData.seaConditions = 'very_rough';
    }
  }

  private detectMotionEvents(data: AccelerometerData, magnitude: number): void {
    // Shake detection
    if (magnitude > this.config.motionThreshold + 8) {
      const event: MotionEvent = {
        type: 'shake',
        intensity: magnitude,
        timestamp: data.timestamp,
        data,
      };
      this.notifyMotionCallbacks(event);
    }

    // Impact detection
    if (magnitude > this.config.motionThreshold + 15) {
      const event: MotionEvent = {
        type: 'impact',
        intensity: magnitude,
        timestamp: data.timestamp,
        data,
      };
      this.notifyMotionCallbacks(event);
    }

    // Tilt detection (based on sustained acceleration in one direction)
    if (Math.abs(data.x) > 8 || Math.abs(data.y) > 8) {
      const event: MotionEvent = {
        type: 'tilt',
        intensity: Math.max(Math.abs(data.x), Math.abs(data.y)),
        timestamp: data.timestamp,
        data,
      };
      this.notifyMotionCallbacks(event);
    }
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private notifyCallbacks(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.currentData);
      } catch (error) {
        console.error('Error in sensor callback:', error);
      }
    });
  }

  private notifyMotionCallbacks(event: MotionEvent): void {
    this.motionCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in motion callback:', error);
      }
    });
  }
}

export default new SensorService();
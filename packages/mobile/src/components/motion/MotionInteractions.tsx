import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Vibration,
  Alert,
} from 'react-native';
import {useSensor} from '@services/sensor/SensorProvider';
import {MotionEvent, EnvironmentalData} from '@services/sensor/SensorService';

interface MotionInteractionsProps {
  children: React.ReactNode;
  enableShakeToRefresh?: boolean;
  enableTiltNavigation?: boolean;
  enableMotionFeedback?: boolean;
  onShakeDetected?: () => void;
  onTiltDetected?: (direction: 'left' | 'right' | 'forward' | 'backward') => void;
  onMotionIntensityChange?: (intensity: number) => void;
}

const MotionInteractions: React.FC<MotionInteractionsProps> = ({
  children,
  enableShakeToRefresh = true,
  enableTiltNavigation = false,
  enableMotionFeedback = true,
  onShakeDetected,
  onTiltDetected,
  onMotionIntensityChange,
}) => {
  const {environmentalData, subscribeToMotionEvents} = useSensor();
  const [shakeAnimation] = useState(new Animated.Value(0));
  const [tiltAnimation] = useState(new Animated.Value(0));
  const [lastShakeTime, setLastShakeTime] = useState(0);
  const [lastTiltTime, setLastTiltTime] = useState(0);

  // Debounce intervals (ms)
  const SHAKE_DEBOUNCE = 1000;
  const TILT_DEBOUNCE = 500;

  useEffect(() => {
    const unsubscribe = subscribeToMotionEvents(handleMotionEvent);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (onMotionIntensityChange) {
      onMotionIntensityChange(environmentalData.motionIntensity);
    }
  }, [environmentalData.motionIntensity, onMotionIntensityChange]);

  const handleMotionEvent = useCallback((event: MotionEvent) => {
    const currentTime = Date.now();

    switch (event.type) {
      case 'shake':
        if (enableShakeToRefresh && currentTime - lastShakeTime > SHAKE_DEBOUNCE) {
          handleShakeGesture();
          setLastShakeTime(currentTime);
        }
        break;

      case 'tilt':
        if (enableTiltNavigation && currentTime - lastTiltTime > TILT_DEBOUNCE) {
          handleTiltGesture(event);
          setLastTiltTime(currentTime);
        }
        break;

      case 'impact':
        if (enableMotionFeedback) {
          handleImpactFeedback(event.intensity);
        }
        break;
    }
  }, [
    enableShakeToRefresh,
    enableTiltNavigation,
    enableMotionFeedback,
    lastShakeTime,
    lastTiltTime,
  ]);

  const handleShakeGesture = () => {
    // Animate shake feedback
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Haptic feedback
    Vibration.vibrate(100);

    // Call callback
    if (onShakeDetected) {
      onShakeDetected();
    }
  };

  const handleTiltGesture = (event: MotionEvent) => {
    if (!('x' in event.data && 'y' in event.data)) return;

    const {x, y} = event.data;
    let direction: 'left' | 'right' | 'forward' | 'backward';

    // Determine tilt direction based on accelerometer data
    if (Math.abs(x) > Math.abs(y)) {
      direction = x > 0 ? 'right' : 'left';
    } else {
      direction = y > 0 ? 'forward' : 'backward';
    }

    // Animate tilt feedback
    const tiltValue = direction === 'left' || direction === 'backward' ? -5 : 5;
    Animated.sequence([
      Animated.timing(tiltAnimation, {
        toValue: tiltValue,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(tiltAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Call callback
    if (onTiltDetected) {
      onTiltDetected(direction);
    }
  };

  const handleImpactFeedback = (intensity: number) => {
    // Provide haptic feedback based on impact intensity
    if (intensity > 15) {
      // Strong impact
      Vibration.vibrate([0, 200, 100, 200]);
    } else if (intensity > 10) {
      // Medium impact
      Vibration.vibrate([0, 150, 50, 150]);
    } else if (intensity > 5) {
      // Light impact
      Vibration.vibrate(100);
    }

    // Show alert for very strong impacts
    if (intensity > 20) {
      Alert.alert(
        'Strong Impact Detected',
        `Impact intensity: ${intensity.toFixed(1)}. Please check vessel status and crew safety.`,
        [
          {text: 'Acknowledge', style: 'default'},
          {text: 'Report Incident', style: 'destructive'},
        ]
      );
    }
  };

  const getMotionIntensityStyle = () => {
    const intensity = environmentalData.motionIntensity;
    let backgroundColor = '#f5f5f5';
    let borderColor = '#e0e0e0';

    if (intensity > 15) {
      backgroundColor = '#ffebee';
      borderColor = '#f44336';
    } else if (intensity > 10) {
      backgroundColor = '#fff3e0';
      borderColor = '#ff9800';
    } else if (intensity > 5) {
      backgroundColor = '#f3e5f5';
      borderColor = '#9c27b0';
    }

    return {
      backgroundColor,
      borderColor,
      borderWidth: 1,
    };
  };

  const containerTransform = [
    {
      translateX: Animated.add(shakeAnimation, tiltAnimation),
    },
  ];

  return (
    <Animated.View
      style={[
        styles.container,
        getMotionIntensityStyle(),
        {transform: containerTransform},
      ]}
    >
      {children}
      
      {/* Motion Status Indicator */}
      <View style={styles.motionIndicator}>
        <View
          style={[
            styles.motionDot,
            {
              backgroundColor: getMotionIndicatorColor(environmentalData.motionIntensity),
            },
          ]}
        />
      </View>
    </Animated.View>
  );
};

const getMotionIndicatorColor = (intensity: number): string => {
  if (intensity > 15) return '#f44336'; // Red - High motion
  if (intensity > 10) return '#ff9800'; // Orange - Medium motion
  if (intensity > 5) return '#2196f3';  // Blue - Low motion
  return '#4caf50'; // Green - Stable
};

// Hook for motion-based interactions
export const useMotionInteractions = () => {
  const {environmentalData, subscribeToMotionEvents} = useSensor();
  const [motionState, setMotionState] = useState({
    isShaking: false,
    isTilted: false,
    lastMotionEvent: null as MotionEvent | null,
  });

  useEffect(() => {
    const unsubscribe = subscribeToMotionEvents((event: MotionEvent) => {
      setMotionState(prev => ({
        ...prev,
        isShaking: event.type === 'shake',
        isTilted: event.type === 'tilt',
        lastMotionEvent: event,
      }));

      // Reset flags after a delay
      setTimeout(() => {
        setMotionState(prev => ({
          ...prev,
          isShaking: false,
          isTilted: false,
        }));
      }, 1000);
    });

    return unsubscribe;
  }, []);

  return {
    motionState,
    environmentalData,
    isHighMotion: environmentalData.motionIntensity > 10,
    isStable: environmentalData.stability === 'stable',
    seaConditions: environmentalData.seaConditions,
  };
};

// Component for motion-sensitive UI elements
export const MotionSensitiveView: React.FC<{
  children: React.ReactNode;
  sensitivity?: 'low' | 'medium' | 'high';
  style?: any;
}> = ({children, sensitivity = 'medium', style}) => {
  const {environmentalData} = useSensor();
  const [opacity] = useState(new Animated.Value(1));

  const sensitivityThresholds = {
    low: 15,
    medium: 10,
    high: 5,
  };

  useEffect(() => {
    const threshold = sensitivityThresholds[sensitivity];
    const shouldFade = environmentalData.motionIntensity > threshold;

    Animated.timing(opacity, {
      toValue: shouldFade ? 0.7 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [environmentalData.motionIntensity, sensitivity]);

  return (
    <Animated.View style={[style, {opacity}]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    position: 'relative',
  },
  motionIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1000,
  },
  motionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default MotionInteractions;
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {Card, Button, ProgressBar, Chip} from 'react-native-paper';
import {useSensor} from '@services/sensor/SensorProvider';
import {useDevice} from '@services/device/DeviceProvider';
import {EnvironmentalData, MotionEvent} from '@services/sensor/SensorService';

interface EnvironmentalMonitorProps {
  vesselId?: string;
  onDataUpdate?: (data: EnvironmentalData) => void;
  showControls?: boolean;
}

const EnvironmentalMonitor: React.FC<EnvironmentalMonitorProps> = ({
  vesselId,
  onDataUpdate,
  showControls = true,
}) => {
  const {
    environmentalData,
    isActive,
    sensorAvailability,
    startSensors,
    stopSensors,
    subscribeToMotionEvents,
  } = useSensor(); // useSensor hook usage
  
  const {permissions, requestSensorPermissions} = useDevice(); // useDevice hook usage
  
  const [motionEvents, setMotionEvents] = useState<MotionEvent[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    // Subscribe to motion events
    const unsubscribe = subscribeToMotionEvents(handleMotionEvent);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (onDataUpdate) {
      onDataUpdate(environmentalData);
    }
  }, [environmentalData, onDataUpdate]);

  const handleMotionEvent = (event: MotionEvent) => {
    setMotionEvents(prev => {
      const newEvents = [event, ...prev.slice(0, 9)]; // Keep last 10 events
      return newEvents;
    });

    // Alert for significant events
    if (event.type === 'impact' && event.intensity > 20) {
      Alert.alert(
        'High Impact Detected',
        `Significant impact detected with intensity ${event.intensity.toFixed(1)}. Please check vessel status.`,
        [{text: 'OK'}]
      );
    }
  };

  const handleStartMonitoring = async () => {
    if (!permissions.sensors) {
      const granted = await requestSensorPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Sensor access is required for environmental monitoring.',
          [{text: 'OK'}]
        );
        return;
      }
    }

    startSensors();
    setIsMonitoring(true);
  };

  const handleStopMonitoring = () => {
    stopSensors();
    setIsMonitoring(false);
  };

  const getSeaConditionColor = (condition: string) => {
    switch (condition) {
      case 'calm': return '#4CAF50';
      case 'moderate': return '#FF9800';
      case 'rough': return '#FF5722';
      case 'very_rough': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStabilityColor = (stability: string) => {
    switch (stability) {
      case 'stable': return '#4CAF50';
      case 'moderate': return '#FF9800';
      case 'unstable': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const formatSensorValue = (value: number | null) => {
    return value !== null ? value.toFixed(2) : 'N/A';
  };

  return (
    <ScrollView style={styles.container}>
      {/* Control Panel */}
      {showControls && (
        <Card style={styles.controlCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>Environmental Monitoring</Text>
            <View style={styles.controlRow}>
              <Button
                mode={isActive ? 'outlined' : 'contained'}
                onPress={isActive ? handleStopMonitoring : handleStartMonitoring}
                style={styles.controlButton}
              >
                {isActive ? 'Stop Monitoring' : 'Start Monitoring'}
              </Button>
              <View style={styles.statusIndicator}>
                <View
                  style={[
                    styles.statusDot,
                    {backgroundColor: isActive ? '#4CAF50' : '#F44336'},
                  ]}
                />
                <Text style={styles.statusText}>
                  {isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Sensor Availability */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Sensor Status</Text>
          <View style={styles.sensorGrid}>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>Accelerometer</Text>
              <Chip
                icon={sensorAvailability.accelerometer ? 'check' : 'close'}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: sensorAvailability.accelerometer
                      ? '#E8F5E8'
                      : '#FFEBEE',
                  },
                ]}
              >
                {sensorAvailability.accelerometer ? 'Available' : 'Unavailable'}
              </Chip>
            </View>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>Gyroscope</Text>
              <Chip
                icon={sensorAvailability.gyroscope ? 'check' : 'close'}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: sensorAvailability.gyroscope
                      ? '#E8F5E8'
                      : '#FFEBEE',
                  },
                ]}
              >
                {sensorAvailability.gyroscope ? 'Available' : 'Unavailable'}
              </Chip>
            </View>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>Magnetometer</Text>
              <Chip
                icon={sensorAvailability.magnetometer ? 'check' : 'close'}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: sensorAvailability.magnetometer
                      ? '#E8F5E8'
                      : '#FFEBEE',
                  },
                ]}
              >
                {sensorAvailability.magnetometer ? 'Available' : 'Unavailable'}
              </Chip>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Environmental Conditions */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Environmental Conditions</Text>
          <View style={styles.conditionsGrid}>
            <View style={styles.conditionItem}>
              <Text style={styles.conditionLabel}>Sea Conditions</Text>
              <Chip
                style={[
                  styles.conditionChip,
                  {backgroundColor: getSeaConditionColor(environmentalData.seaConditions)},
                ]}
                textStyle={styles.conditionChipText}
              >
                {environmentalData.seaConditions.replace('_', ' ').toUpperCase()}
              </Chip>
            </View>
            <View style={styles.conditionItem}>
              <Text style={styles.conditionLabel}>Vessel Stability</Text>
              <Chip
                style={[
                  styles.conditionChip,
                  {backgroundColor: getStabilityColor(environmentalData.stability)},
                ]}
                textStyle={styles.conditionChipText}
              >
                {environmentalData.stability.toUpperCase()}
              </Chip>
            </View>
            <View style={styles.conditionItem}>
              <Text style={styles.conditionLabel}>Motion Intensity</Text>
              <View style={styles.intensityContainer}>
                <ProgressBar
                  progress={Math.min(environmentalData.motionIntensity / 20, 1)}
                  color="#2196F3"
                  style={styles.intensityBar}
                />
                <Text style={styles.intensityValue}>
                  {environmentalData.motionIntensity.toFixed(1)}
                </Text>
              </View>
            </View>
            <View style={styles.conditionItem}>
              <Text style={styles.conditionLabel}>Orientation</Text>
              <Text style={styles.conditionValue}>
                {environmentalData.orientation.toUpperCase()}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Sensor Data */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Sensor Readings</Text>
          
          {/* Accelerometer */}
          <View style={styles.sensorDataSection}>
            <Text style={styles.sensorDataTitle}>Accelerometer (m/s²)</Text>
            <View style={styles.sensorDataRow}>
              <View style={styles.axisData}>
                <Text style={styles.axisLabel}>X:</Text>
                <Text style={styles.axisValue}>
                  {formatSensorValue(environmentalData.accelerometer?.x)}
                </Text>
              </View>
              <View style={styles.axisData}>
                <Text style={styles.axisLabel}>Y:</Text>
                <Text style={styles.axisValue}>
                  {formatSensorValue(environmentalData.accelerometer?.y)}
                </Text>
              </View>
              <View style={styles.axisData}>
                <Text style={styles.axisLabel}>Z:</Text>
                <Text style={styles.axisValue}>
                  {formatSensorValue(environmentalData.accelerometer?.z)}
                </Text>
              </View>
            </View>
          </View>

          {/* Gyroscope */}
          <View style={styles.sensorDataSection}>
            <Text style={styles.sensorDataTitle}>Gyroscope (rad/s)</Text>
            <View style={styles.sensorDataRow}>
              <View style={styles.axisData}>
                <Text style={styles.axisLabel}>X:</Text>
                <Text style={styles.axisValue}>
                  {formatSensorValue(environmentalData.gyroscope?.x)}
                </Text>
              </View>
              <View style={styles.axisData}>
                <Text style={styles.axisLabel}>Y:</Text>
                <Text style={styles.axisValue}>
                  {formatSensorValue(environmentalData.gyroscope?.y)}
                </Text>
              </View>
              <View style={styles.axisData}>
                <Text style={styles.axisLabel}>Z:</Text>
                <Text style={styles.axisValue}>
                  {formatSensorValue(environmentalData.gyroscope?.z)}
                </Text>
              </View>
            </View>
          </View>

          {/* Magnetometer */}
          <View style={styles.sensorDataSection}>
            <Text style={styles.sensorDataTitle}>Magnetometer (μT)</Text>
            <View style={styles.sensorDataRow}>
              <View style={styles.axisData}>
                <Text style={styles.axisLabel}>X:</Text>
                <Text style={styles.axisValue}>
                  {formatSensorValue(environmentalData.magnetometer?.x)}
                </Text>
              </View>
              <View style={styles.axisData}>
                <Text style={styles.axisLabel}>Y:</Text>
                <Text style={styles.axisValue}>
                  {formatSensorValue(environmentalData.magnetometer?.y)}
                </Text>
              </View>
              <View style={styles.axisData}>
                <Text style={styles.axisLabel}>Z:</Text>
                <Text style={styles.axisValue}>
                  {formatSensorValue(environmentalData.magnetometer?.z)}
                </Text>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Recent Motion Events */}
      {motionEvents.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Recent Motion Events</Text>
            {motionEvents.slice(0, 5).map((event, index) => (
              <View key={index} style={styles.eventItem}>
                <View style={styles.eventHeader}>
                  <Chip
                    icon={
                      event.type === 'shake'
                        ? 'vibrate'
                        : event.type === 'impact'
                        ? 'alert-circle'
                        : event.type === 'tilt'
                        ? 'rotate-3d-variant'
                        : 'rotate-right'
                    }
                    style={styles.eventTypeChip}
                  >
                    {event.type.toUpperCase()}
                  </Chip>
                  <Text style={styles.eventTime}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
                <Text style={styles.eventIntensity}>
                  Intensity: {event.intensity.toFixed(2)}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  controlCard: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    flex: 1,
    marginRight: 16,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sensorGrid: {
    gap: 12,
  },
  sensorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sensorLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusChip: {
    borderRadius: 16,
  },
  conditionsGrid: {
    gap: 16,
  },
  conditionItem: {
    marginBottom: 12,
  },
  conditionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#666',
  },
  conditionChip: {
    alignSelf: 'flex-start',
    borderRadius: 16,
  },
  conditionChipText: {
    color: 'white',
    fontWeight: 'bold',
  },
  conditionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  intensityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  intensityBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  intensityValue: {
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 40,
  },
  sensorDataSection: {
    marginBottom: 16,
  },
  sensorDataTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  sensorDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  axisData: {
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  axisValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  eventItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTypeChip: {
    backgroundColor: '#e3f2fd',
  },
  eventTime: {
    fontSize: 12,
    color: '#666',
  },
  eventIntensity: {
    fontSize: 14,
    color: '#333',
  },
});

export default EnvironmentalMonitor;
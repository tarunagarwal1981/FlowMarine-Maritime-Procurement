import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {RouteProp} from '@react-navigation/native';
import {HomeStackParamList} from '../../navigation/stacks/HomeStackNavigator';
import ErrorBoundary from '../../components/common/ErrorBoundary';

type VesselDetailsScreenRouteProp = RouteProp<HomeStackParamList, 'VesselDetails'>;

interface Props {
  route: VesselDetailsScreenRouteProp;
}

const VesselDetailsScreen: React.FC<Props> = ({route}) => {
  const {vesselId, vesselName} = route.params;

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <Text style={styles.title}>Vessel Details</Text>
        <Text style={styles.subtitle}>Details for {vesselName} (ID: {vesselId})</Text>
        <Text style={styles.description}>Vessel management features will be implemented here</Text>
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#1e40af',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default VesselDetailsScreen;
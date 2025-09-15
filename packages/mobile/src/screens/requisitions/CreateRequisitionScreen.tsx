import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import ErrorBoundary from '@components/common/ErrorBoundary';

const CreateRequisitionScreen: React.FC = () => {
  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <Text style={styles.title}>Create Requisition</Text>
        <Text style={styles.subtitle}>Requisition creation form will be implemented here</Text>
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
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default CreateRequisitionScreen;
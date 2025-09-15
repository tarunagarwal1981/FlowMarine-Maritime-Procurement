import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Vessel {
  id: string;
  name: string;
  imoNumber: string;
}

interface VesselSelectorProps {
  vessels: Vessel[];
  selectedVessel: string | null;
  onVesselChange: (vesselId: string | null) => void;
}

const VesselSelector: React.FC<VesselSelectorProps> = ({
  vessels,
  selectedVessel,
  onVesselChange,
}) => {
  const selectedVesselData = vessels.find(v => v.id === selectedVessel);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Vessel:</Text>
      <TouchableOpacity style={styles.selector}>
        <Icon name="directions-boat" size={20} color="#64748b" />
        <Text style={styles.selectorText}>
          {selectedVesselData ? selectedVesselData.name : 'All Vessels'}
        </Text>
        <Icon name="expand-more" size={20} color="#64748b" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectorText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
});

export default VesselSelector;
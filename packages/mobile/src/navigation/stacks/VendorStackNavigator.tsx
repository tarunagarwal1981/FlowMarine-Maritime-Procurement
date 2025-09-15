import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import VendorListScreen from '../../screens/vendors/VendorListScreen';
import VendorDetailsScreen from '../../screens/vendors/VendorDetailsScreen';
import QuoteComparisonScreen from '../../screens/vendors/QuoteComparisonScreen';
import RFQScreen from '../../screens/vendors/RFQScreen';

export type VendorStackParamList = {
  VendorList: undefined;
  VendorDetails: {
    vendorId: string;
  };
  QuoteComparison: {
    rfqId: string;
  };
  RFQ: {
    requisitionId: string;
  };
};

const Stack = createStackNavigator<VendorStackParamList>();

const VendorStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="VendorList"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1e40af',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      <Stack.Screen
        name="VendorList"
        component={VendorListScreen}
        options={{
          title: 'Vendors',
        }}
      />
      <Stack.Screen
        name="VendorDetails"
        component={VendorDetailsScreen}
        options={{
          title: 'Vendor Details',
        }}
      />
      <Stack.Screen
        name="QuoteComparison"
        component={QuoteComparisonScreen}
        options={{
          title: 'Quote Comparison',
        }}
      />
      <Stack.Screen
        name="RFQ"
        component={RFQScreen}
        options={{
          title: 'Request for Quote',
        }}
      />
    </Stack.Navigator>
  );
};

export default VendorStackNavigator;
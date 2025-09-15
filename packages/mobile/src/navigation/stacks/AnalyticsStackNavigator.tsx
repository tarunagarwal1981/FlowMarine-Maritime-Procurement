import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import AnalyticsScreen from '../../screens/analytics/AnalyticsScreen';
import SpendAnalyticsScreen from '../../screens/analytics/SpendAnalyticsScreen';
import VendorAnalyticsScreen from '../../screens/analytics/VendorAnalyticsScreen';
import BudgetAnalyticsScreen from '../../screens/analytics/BudgetAnalyticsScreen';

export type AnalyticsStackParamList = {
  Analytics: undefined;
  SpendAnalytics: {
    timeRange?: string;
    vesselId?: string;
  };
  VendorAnalytics: {
    vendorId?: string;
  };
  BudgetAnalytics: {
    budgetPeriod?: string;
  };
};

const Stack = createStackNavigator<AnalyticsStackParamList>();

const AnalyticsStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Analytics"
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
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          title: 'Analytics',
        }}
      />
      <Stack.Screen
        name="SpendAnalytics"
        component={SpendAnalyticsScreen}
        options={{
          title: 'Spend Analytics',
        }}
      />
      <Stack.Screen
        name="VendorAnalytics"
        component={VendorAnalyticsScreen}
        options={{
          title: 'Vendor Analytics',
        }}
      />
      <Stack.Screen
        name="BudgetAnalytics"
        component={BudgetAnalyticsScreen}
        options={{
          title: 'Budget Analytics',
        }}
      />
    </Stack.Navigator>
  );
};

export default AnalyticsStackNavigator;
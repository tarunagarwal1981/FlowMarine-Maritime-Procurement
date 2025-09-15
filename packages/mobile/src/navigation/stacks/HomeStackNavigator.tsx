import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import HomeScreen from '../../screens/home/HomeScreen';
import DashboardScreen from '../../screens/dashboard/DashboardScreen';
import VesselDetailsScreen from '../../screens/vessels/VesselDetailsScreen';
import VesselAnalyticsScreen from '../../screens/analytics/VesselAnalyticsScreen';

export type HomeStackParamList = {
  Home: undefined;
  Dashboard: undefined;
  VesselDetails: {
    vesselId: string;
    vesselName: string;
  };
  VesselAnalytics: {
    vesselId?: string;
    vesselName?: string;
  };
};

const Stack = createStackNavigator<HomeStackParamList>();

const HomeStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
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
        name="Home"
        component={HomeScreen}
        options={{
          title: 'FlowMarine',
        }}
      />
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
        }}
      />
      <Stack.Screen
        name="VesselDetails"
        component={VesselDetailsScreen}
        options={({route}) => ({
          title: route.params.vesselName,
        })}
      />
      <Stack.Screen
        name="VesselAnalytics"
        component={VesselAnalyticsScreen}
        options={({route}) => ({
          title: route.params?.vesselName ? `${route.params.vesselName} Analytics` : 'Vessel Analytics',
        })}
      />
    </Stack.Navigator>
  );
};

export default HomeStackNavigator;
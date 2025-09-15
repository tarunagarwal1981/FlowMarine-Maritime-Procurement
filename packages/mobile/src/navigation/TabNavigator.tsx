import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {RootState} from '../store/index';
import HomeStackNavigator from './stacks/HomeStackNavigator';
import RequisitionStackNavigator from './stacks/RequisitionStackNavigator';
import VendorStackNavigator from './stacks/VendorStackNavigator';
import AnalyticsStackNavigator from './stacks/AnalyticsStackNavigator';
import NotificationStackNavigator from './stacks/NotificationStackNavigator';

export type TabParamList = {
  HomeStack: undefined;
  RequisitionStack: undefined;
  VendorStack: undefined;
  AnalyticsStack: undefined;
  NotificationStack: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator: React.FC = () => {
  const unreadCount = useSelector((state: RootState) => state.notifications.unreadCount);

  return (
    <Tab.Navigator
      initialRouteName="HomeStack"
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'HomeStack':
              iconName = 'dashboard';
              break;
            case 'RequisitionStack':
              iconName = 'assignment';
              break;
            case 'VendorStack':
              iconName = 'business';
              break;
            case 'AnalyticsStack':
              iconName = 'analytics';
              break;
            case 'NotificationStack':
              iconName = 'notifications';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1e40af',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}>
      <Tab.Screen
        name="HomeStack"
        component={HomeStackNavigator}
        options={{
          title: 'Home',
        }}
      />
      <Tab.Screen
        name="RequisitionStack"
        component={RequisitionStackNavigator}
        options={{
          title: 'Requisitions',
        }}
      />
      <Tab.Screen
        name="VendorStack"
        component={VendorStackNavigator}
        options={{
          title: 'Vendors',
        }}
      />
      <Tab.Screen
        name="AnalyticsStack"
        component={AnalyticsStackNavigator}
        options={{
          title: 'Analytics',
        }}
      />
      <Tab.Screen
        name="NotificationStack"
        component={NotificationStackNavigator}
        options={{
          title: 'Notifications',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 'bold',
          },
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;
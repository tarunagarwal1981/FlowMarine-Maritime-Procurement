import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import NotificationListScreen from '../../screens/notifications/NotificationListScreen';
import NotificationDetailsScreen from '../../screens/notifications/NotificationDetailsScreen';
import NotificationSettingsScreen from '../../screens/notifications/NotificationSettingsScreen';

export type NotificationStackParamList = {
  NotificationList: undefined;
  NotificationDetails: {
    notificationId: string;
  };
  NotificationSettings: undefined;
};

const Stack = createStackNavigator<NotificationStackParamList>();

const NotificationStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="NotificationList"
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
        name="NotificationList"
        component={NotificationListScreen}
        options={{
          title: 'Notifications',
        }}
      />
      <Stack.Screen
        name="NotificationDetails"
        component={NotificationDetailsScreen}
        options={{
          title: 'Notification Details',
        }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          title: 'Notification Settings',
        }}
      />
    </Stack.Navigator>
  );
};

export default NotificationStackNavigator;
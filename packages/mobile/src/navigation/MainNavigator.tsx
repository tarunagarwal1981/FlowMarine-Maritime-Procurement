import React from 'react';
import {createDrawerNavigator} from '@react-navigation/drawer';
import {useWindowDimensions} from 'react-native';
import TabNavigator from './TabNavigator';
import DrawerContent from '../components/navigation/DrawerContent';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import HelpScreen from '../screens/help/HelpScreen';
import AboutScreen from '../screens/about/AboutScreen';

export type MainDrawerParamList = {
  MainTabs: undefined;
  Profile: undefined;
  Settings: undefined;
  Help: undefined;
  About: undefined;
};

const Drawer = createDrawerNavigator<MainDrawerParamList>();

const MainNavigator: React.FC = () => {
  const dimensions = useWindowDimensions();
  const isLargeScreen = dimensions.width >= 768;

  return (
    <Drawer.Navigator
      initialRouteName="MainTabs"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: isLargeScreen ? 'permanent' : 'front',
        drawerStyle: {
          width: isLargeScreen ? 280 : 280,
        },
        overlayColor: 'rgba(0, 0, 0, 0.5)',
        drawerActiveTintColor: '#1e40af',
        drawerInactiveTintColor: '#64748b',
      }}>
      <Drawer.Screen 
        name="MainTabs" 
        component={TabNavigator}
        options={{
          title: 'Dashboard',
        }}
      />
      <Drawer.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
      <Drawer.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
      <Drawer.Screen 
        name="Help" 
        component={HelpScreen}
        options={{
          title: 'Help & Support',
        }}
      />
      <Drawer.Screen 
        name="About" 
        component={AboutScreen}
        options={{
          title: 'About',
        }}
      />
    </Drawer.Navigator>
  );
};

export default MainNavigator;
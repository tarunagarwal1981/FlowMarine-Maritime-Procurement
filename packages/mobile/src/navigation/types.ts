import {NavigatorScreenParams} from '@react-navigation/native';
import {AuthStackParamList} from './AuthNavigator';
import {MainDrawerParamList} from './MainNavigator';
import {TabParamList} from './TabNavigator';
import {HomeStackParamList} from './stacks/HomeStackNavigator';
import {RequisitionStackParamList} from './stacks/RequisitionStackNavigator';
import {VendorStackParamList} from './stacks/VendorStackNavigator';
import {AnalyticsStackParamList} from './stacks/AnalyticsStackNavigator';
import {NotificationStackParamList} from './stacks/NotificationStackNavigator';

// Root navigation types
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainDrawerParamList>;
};

// Combined navigation types for type safety
export type AllNavigationParamList = AuthStackParamList & 
  MainDrawerParamList & 
  TabParamList & 
  HomeStackParamList & 
  RequisitionStackParamList & 
  VendorStackParamList & 
  AnalyticsStackParamList & 
  NotificationStackParamList;

// Navigation prop types for screens
export type NavigationProps<T extends keyof AllNavigationParamList> = {
  navigation: any; // Will be properly typed by React Navigation
  route: {
    params: AllNavigationParamList[T];
  };
};

// Common navigation options
export const defaultScreenOptions = {
  headerStyle: {
    backgroundColor: '#1e40af',
  },
  headerTintColor: '#ffffff',
  headerTitleStyle: {
    fontWeight: 'bold' as const,
  },
};

export const defaultTabBarOptions = {
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
    fontWeight: '500' as const,
  },
};
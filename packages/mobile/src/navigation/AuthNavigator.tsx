import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import LoginScreen from '../screens/auth/LoginScreen';
import BiometricSetupScreen from '../screens/auth/BiometricSetupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

export type AuthStackParamList = {
  Login: undefined;
  BiometricSetup: {
    email: string;
    token: string;
  };
  ForgotPassword: undefined;
  ResetPassword: {
    token: string;
  };
};

const Stack = createStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: '#f8fafc'},
      }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="BiometricSetup" component={BiometricSetupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
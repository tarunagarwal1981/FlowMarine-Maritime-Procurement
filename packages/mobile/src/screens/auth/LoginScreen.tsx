import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {StackNavigationProp} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {RootState} from '../../store/index';
import {loginStart, loginSuccess, loginFailure} from '../../store/slices/authSlice';
import {AuthStackParamList} from '../../navigation/AuthNavigator';
import {useBiometric} from '../../services/biometric/BiometricProvider';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBoundary from '../../components/common/ErrorBoundary';

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const dispatch = useDispatch();
  const {isLoading, biometricEnabled} = useSelector((state: RootState) => state.auth);
  const {isBiometricAvailable, authenticateWithBiometric} = useBiometric();

  useEffect(() => {
    // Check for saved credentials
    checkSavedCredentials();
  }, []);

  const checkSavedCredentials = async () => {
    // Implementation would check AsyncStorage for saved credentials
    // For now, just check if biometric is available and enabled
    if (biometricEnabled && isBiometricAvailable) {
      showBiometricPrompt();
    }
  };

  const showBiometricPrompt = async () => {
    try {
      const result = await authenticateWithBiometric();
      if (result.success) {
        // Auto-login with biometric
        handleBiometricLogin();
      }
    } catch (error) {
      console.log('Biometric authentication cancelled');
    }
  };

  const handleBiometricLogin = async () => {
    dispatch(loginStart());
    try {
      // Implementation would call API with stored credentials
      // For now, simulate successful login
      setTimeout(() => {
        dispatch(loginSuccess({
          user: {
            id: '1',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'CAPTAIN',
            vessels: [{id: '1', name: 'MV Ocean Star', imoNumber: '1234567'}],
            permissions: ['VIEW_REQUISITIONS', 'CREATE_REQUISITIONS'],
          },
          token: 'mock-jwt-token',
          refreshToken: 'mock-refresh-token',
          sessionExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        }));
      }, 1000);
    } catch (error) {
      dispatch(loginFailure());
      Alert.alert('Login Failed', 'Biometric authentication failed');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    dispatch(loginStart());
    try {
      // Implementation would call authentication API
      // For now, simulate login process
      setTimeout(() => {
        if (email === 'demo@flowmarine.com' && password === 'demo123') {
          dispatch(loginSuccess({
            user: {
              id: '1',
              email: email,
              firstName: 'Demo',
              lastName: 'User',
              role: 'CAPTAIN',
              vessels: [{id: '1', name: 'MV Ocean Star', imoNumber: '1234567'}],
              permissions: ['VIEW_REQUISITIONS', 'CREATE_REQUISITIONS'],
            },
            token: 'mock-jwt-token',
            refreshToken: 'mock-refresh-token',
            sessionExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          }));

          // Navigate to biometric setup if available and not enabled
          if (isBiometricAvailable && !biometricEnabled) {
            navigation.navigate('BiometricSetup', {
              email: email,
              token: 'mock-jwt-token',
            });
          }
        } else {
          dispatch(loginFailure());
          Alert.alert('Login Failed', 'Invalid email or password');
        }
      }, 1500);
    } catch (error) {
      dispatch(loginFailure());
      Alert.alert('Login Failed', 'An error occurred during login');
    }
  };

  return (
    <ErrorBoundary>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>FlowMarine</Text>
            <Text style={styles.subtitle}>Maritime Procurement Platform</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Icon name="email" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Icon name="lock" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}>
                <Icon
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={20}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}>
                <Icon
                  name={rememberMe ? 'check-box' : 'check-box-outline-blank'}
                  size={20}
                  color="#1e40af"
                />
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}>
              {isLoading ? (
                <LoadingSpinner size="small" color="#ffffff" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {isBiometricAvailable && (
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={showBiometricPrompt}
                disabled={isLoading}>
                <Icon name="fingerprint" size={24} color="#1e40af" />
                <Text style={styles.biometricButtonText}>Use Biometric</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoText}>Demo Credentials:</Text>
            <Text style={styles.demoCredentials}>Email: demo@flowmarine.com</Text>
            <Text style={styles.demoCredentials}>Password: demo123</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1e293b',
  },
  eyeIcon: {
    padding: 4,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberMeText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#64748b',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#1e40af',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e40af',
    borderRadius: 8,
    height: 48,
    backgroundColor: '#f8fafc',
  },
  biometricButtonText: {
    color: '#1e40af',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  demoContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  demoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  demoCredentials: {
    fontSize: 12,
    color: '#92400e',
    fontFamily: 'monospace',
  },
});

export default LoginScreen;
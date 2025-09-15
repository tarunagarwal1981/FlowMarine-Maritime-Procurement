import React, {useState} from 'react';
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
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {AuthStackParamList} from '../../navigation/AuthNavigator';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBoundary from '../../components/common/ErrorBoundary';

type ForgotPasswordScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'ForgotPassword'
>;

interface Props {
  navigation: ForgotPasswordScreenNavigationProp;
}

const ForgotPasswordScreen: React.FC<Props> = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      // Implementation would call password reset API
      // For now, simulate the process
      setTimeout(() => {
        setIsLoading(false);
        setEmailSent(true);
      }, 2000);
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
    }
  };

  const handleBackToLogin = () => {
    navigation.goBack();
  };

  if (emailSent) {
    return (
      <ErrorBoundary>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.successContainer}>
              <Icon name="mark-email-read" size={80} color="#10b981" />
              <Text style={styles.successTitle}>Email Sent!</Text>
              <Text style={styles.successDescription}>
                We've sent a password reset link to {email}. Please check your email and follow the instructions to reset your password.
              </Text>
              
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBackToLogin}>
                <Text style={styles.backButtonText}>Back to Login</Text>
              </TouchableOpacity>

              <Text style={styles.resendText}>
                Didn't receive the email? Check your spam folder or{' '}
                <Text
                  style={styles.resendLink}
                  onPress={() => {
                    setEmailSent(false);
                    handleResetPassword();
                  }}>
                  resend
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backIconButton}
              onPress={handleBackToLogin}>
              <Icon name="arrow-back" size={24} color="#1e40af" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Icon name="lock-reset" size={80} color="#1e40af" />
            </View>

            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.description}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Icon name="email" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>

              <TouchableOpacity
                style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
                onPress={handleResetPassword}
                disabled={isLoading}>
                {isLoading ? (
                  <LoadingSpinner size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.resetButtonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backToLoginButton}
                onPress={handleBackToLogin}
                disabled={isLoading}>
                <Icon name="arrow-back" size={16} color="#64748b" />
                <Text style={styles.backToLoginText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backIconButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  formContainer: {
    width: '100%',
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
    marginBottom: 24,
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
  resetButton: {
    backgroundColor: '#1e40af',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  resetButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backToLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  backToLoginText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  successContainer: {
    alignItems: 'center',
    padding: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  successDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  backButton: {
    backgroundColor: '#1e40af',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  resendLink: {
    color: '#1e40af',
    fontWeight: '500',
  },
});

export default ForgotPasswordScreen;
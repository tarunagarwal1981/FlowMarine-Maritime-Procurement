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
import {RouteProp} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {AuthStackParamList} from '../../navigation/AuthNavigator';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBoundary from '../../components/common/ErrorBoundary';

type ResetPasswordScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'ResetPassword'
>;
type ResetPasswordScreenRouteProp = RouteProp<AuthStackParamList, 'ResetPassword'>;

interface Props {
  navigation: ResetPasswordScreenNavigationProp;
  route: ResetPasswordScreenRouteProp;
}

const ResetPasswordScreen: React.FC<Props> = ({navigation, route}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {token} = route.params;

  const validatePassword = (password: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
      isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
      errors: [
        ...(password.length < minLength ? ['At least 8 characters'] : []),
        ...(!hasUpperCase ? ['One uppercase letter'] : []),
        ...(!hasLowerCase ? ['One lowercase letter'] : []),
        ...(!hasNumbers ? ['One number'] : []),
        ...(!hasSpecialChar ? ['One special character'] : []),
      ],
    };
  };

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      Alert.alert('Invalid Password', `Password must contain:\n• ${validation.errors.join('\n• ')}`);
      return;
    }

    setIsLoading(true);
    try {
      // Implementation would call password reset API with token
      // For now, simulate the process
      setTimeout(() => {
        setIsLoading(false);
        Alert.alert(
          'Success',
          'Your password has been reset successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
      }, 2000);
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    }
  };

  const getPasswordStrength = (password: string) => {
    const validation = validatePassword(password);
    const score = 5 - validation.errors.length;
    
    if (score <= 1) return {strength: 'Weak', color: '#ef4444'};
    if (score <= 3) return {strength: 'Medium', color: '#f59e0b'};
    return {strength: 'Strong', color: '#10b981'};
  };

  const passwordStrength = password ? getPasswordStrength(password) : null;

  return (
    <ErrorBoundary>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backIconButton}
              onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" size={24} color="#1e40af" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Icon name="lock" size={80} color="#1e40af" />
            </View>

            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.description}>
              Create a new secure password for your account.
            </Text>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Icon name="lock" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="New Password"
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

              {password && passwordStrength && (
                <View style={styles.passwordStrengthContainer}>
                  <Text style={[styles.passwordStrengthText, {color: passwordStrength.color}]}>
                    Password Strength: {passwordStrength.strength}
                  </Text>
                  <View style={styles.passwordStrengthBar}>
                    <View
                      style={[
                        styles.passwordStrengthFill,
                        {
                          backgroundColor: passwordStrength.color,
                          width: passwordStrength.strength === 'Weak' ? '33%' : 
                                passwordStrength.strength === 'Medium' ? '66%' : '100%',
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Icon name="lock" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}>
                  <Icon
                    name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.requirementsContainer}>
                <Text style={styles.requirementsTitle}>Password Requirements:</Text>
                {validatePassword(password).errors.map((error, index) => (
                  <View key={index} style={styles.requirementItem}>
                    <Icon
                      name={password && !validatePassword(password).errors.includes(error) ? 'check' : 'close'}
                      size={16}
                      color={password && !validatePassword(password).errors.includes(error) ? '#10b981' : '#ef4444'}
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        {
                          color: password && !validatePassword(password).errors.includes(error) ? '#10b981' : '#64748b',
                        },
                      ]}>
                      {error}
                    </Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
                onPress={handleResetPassword}
                disabled={isLoading}>
                {isLoading ? (
                  <LoadingSpinner size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.resetButtonText}>Reset Password</Text>
                )}
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
  passwordStrengthContainer: {
    marginBottom: 16,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  passwordStrengthBar: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  requirementsContainer: {
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 12,
    marginLeft: 8,
  },
  resetButton: {
    backgroundColor: '#1e40af',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ResetPasswordScreen;
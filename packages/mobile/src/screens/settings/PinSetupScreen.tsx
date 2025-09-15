import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {sha256} from 'react-native-sha256';

interface PinSetupScreenProps {
  route?: {
    params?: {
      mode: 'setup' | 'change' | 'verify';
      onSuccess?: () => void;
    };
  };
}

const PinSetupScreen: React.FC<PinSetupScreenProps> = ({route}) => {
  const navigation = useNavigation();
  const mode = route?.params?.mode || 'setup';
  const onSuccess = route?.params?.onSuccess;

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm' | 'current'>('enter');
  const [currentPin, setCurrentPin] = useState('');
  const [attempts, setAttempts] = useState(0);

  const PIN_KEY = 'user_pin_hash';
  const MAX_ATTEMPTS = 5;

  React.useEffect(() => {
    if (mode === 'change') {
      setStep('current');
    }
  }, [mode]);

  const handleNumberPress = (number: string) => {
    const currentValue = getCurrentValue();
    
    if (currentValue.length < 6) {
      const newValue = currentValue + number;
      updateCurrentValue(newValue);
      
      if (newValue.length === 6) {
        handlePinComplete(newValue);
      }
    }
  };

  const handleBackspace = () => {
    const currentValue = getCurrentValue();
    if (currentValue.length > 0) {
      const newValue = currentValue.slice(0, -1);
      updateCurrentValue(newValue);
    }
  };

  const getCurrentValue = (): string => {
    switch (step) {
      case 'current':
        return currentPin;
      case 'enter':
        return pin;
      case 'confirm':
        return confirmPin;
      default:
        return '';
    }
  };

  const updateCurrentValue = (value: string) => {
    switch (step) {
      case 'current':
        setCurrentPin(value);
        break;
      case 'enter':
        setPin(value);
        break;
      case 'confirm':
        setConfirmPin(value);
        break;
    }
  };

  const handlePinComplete = async (completedPin: string) => {
    switch (step) {
      case 'current':
        await verifyCurrentPin(completedPin);
        break;
      case 'enter':
        setStep('confirm');
        break;
      case 'confirm':
        await confirmNewPin(completedPin);
        break;
    }
  };

  const verifyCurrentPin = async (enteredPin: string) => {
    try {
      const storedHash = await AsyncStorage.getItem(PIN_KEY);
      const enteredHash = await sha256(enteredPin);
      
      if (storedHash === enteredHash) {
        setStep('enter');
        setCurrentPin('');
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        Vibration.vibrate(500);
        setCurrentPin('');
        
        if (newAttempts >= MAX_ATTEMPTS) {
          Alert.alert(
            'Too Many Attempts',
            'You have exceeded the maximum number of attempts. Please try again later.',
            [{text: 'OK', onPress: () => navigation.goBack()}]
          );
        } else {
          Alert.alert(
            'Incorrect PIN',
            `Please try again. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`
          );
        }
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      Alert.alert('Error', 'Failed to verify PIN');
    }
  };

  const confirmNewPin = async (enteredPin: string) => {
    if (pin === enteredPin) {
      try {
        const pinHash = await sha256(enteredPin);
        await AsyncStorage.setItem(PIN_KEY, pinHash);
        
        Alert.alert(
          'PIN Set Successfully',
          'Your PIN has been set up successfully.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (onSuccess) {
                  onSuccess();
                }
                navigation.goBack();
              },
            },
          ]
        );
      } catch (error) {
        console.error('Error saving PIN:', error);
        Alert.alert('Error', 'Failed to save PIN');
      }
    } else {
      Vibration.vibrate(500);
      Alert.alert(
        'PINs Do Not Match',
        'The PINs you entered do not match. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              setPin('');
              setConfirmPin('');
              setStep('enter');
            },
          },
        ]
      );
    }
  };

  const getTitle = (): string => {
    switch (step) {
      case 'current':
        return 'Enter Current PIN';
      case 'enter':
        return mode === 'setup' ? 'Create Your PIN' : 'Enter New PIN';
      case 'confirm':
        return 'Confirm Your PIN';
      default:
        return 'Set Up PIN';
    }
  };

  const getSubtitle = (): string => {
    switch (step) {
      case 'current':
        return 'Please enter your current PIN to continue';
      case 'enter':
        return 'Choose a 6-digit PIN for secure access';
      case 'confirm':
        return 'Please enter your PIN again to confirm';
      default:
        return '';
    }
  };

  const renderPinDots = () => {
    const currentValue = getCurrentValue();
    const dots = [];
    
    for (let i = 0; i < 6; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.pinDot,
            i < currentValue.length && styles.pinDotFilled,
          ]}
        />
      );
    }
    
    return <View style={styles.pinDotsContainer}>{dots}</View>;
  };

  const renderNumberPad = () => {
    const numbers = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'backspace'],
    ];

    return (
      <View style={styles.numberPad}>
        {numbers.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.numberRow}>
            {row.map((item, itemIndex) => {
              if (item === '') {
                return <View key={itemIndex} style={styles.numberButton} />;
              }
              
              if (item === 'backspace') {
                return (
                  <TouchableOpacity
                    key={itemIndex}
                    style={styles.numberButton}
                    onPress={handleBackspace}
                    activeOpacity={0.7}>
                    <Icon name="backspace" size={24} color="#374151" />
                  </TouchableOpacity>
                );
              }
              
              return (
                <TouchableOpacity
                  key={itemIndex}
                  style={styles.numberButton}
                  onPress={() => handleNumberPress(item)}
                  activeOpacity={0.7}>
                  <Text style={styles.numberText}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>
        </View>

        {renderPinDots()}
        {renderNumberPad()}

        {step === 'current' && attempts > 0 && (
          <Text style={styles.attemptsText}>
            {MAX_ATTEMPTS - attempts} attempts remaining
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 48,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginHorizontal: 8,
  },
  pinDotFilled: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  numberPad: {
    alignItems: 'center',
  },
  numberRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  numberButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  numberText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#374151',
  },
  attemptsText: {
    textAlign: 'center',
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 24,
  },
});

export default PinSetupScreen;
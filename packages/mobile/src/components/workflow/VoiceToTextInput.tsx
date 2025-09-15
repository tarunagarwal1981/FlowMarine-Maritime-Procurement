import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

// Note: In a real implementation, you would use a library like @react-native-voice/voice
// For this implementation, we'll simulate voice recognition
interface VoiceToTextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  style?: any;
  enabled?: boolean;
}

const VoiceToTextInput: React.FC<VoiceToTextInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Tap to type or hold mic to speak...',
  multiline = false,
  numberOfLines = 1,
  style,
  enabled = true,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [micScale] = useState(new Animated.Value(1));

  useEffect(() => {
    checkMicrophonePermission();
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.MICROPHONE 
        : PERMISSIONS.ANDROID.RECORD_AUDIO;

      const result = await check(permission);
      
      if (result === RESULTS.GRANTED) {
        setHasPermission(true);
      } else if (result === RESULTS.DENIED) {
        const requestResult = await request(permission);
        setHasPermission(requestResult === RESULTS.GRANTED);
      }
    } catch (error) {
      console.error('Error checking microphone permission:', error);
    }
  };

  const startListening = async () => {
    if (!enabled || !hasPermission) {
      if (!hasPermission) {
        Alert.alert(
          'Microphone Permission Required',
          'Please grant microphone permission to use voice input.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Settings', onPress: checkMicrophonePermission},
          ]
        );
      }
      return;
    }

    setIsListening(true);
    
    // Animate microphone icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(micScale, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(micScale, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Simulate voice recognition (in real app, use @react-native-voice/voice)
    setTimeout(() => {
      stopListening();
      simulateVoiceRecognition();
    }, 3000);
  };

  const stopListening = () => {
    setIsListening(false);
    micScale.stopAnimation();
    Animated.timing(micScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const simulateVoiceRecognition = () => {
    // Simulate voice recognition results
    const voiceResults = [
      'Engine oil filter replacement needed urgently',
      'Safety equipment inspection required',
      'Fuel injector maintenance scheduled for next port',
      'Navigation equipment calibration needed',
      'Emergency repair parts for main engine',
    ];

    const randomResult = voiceResults[Math.floor(Math.random() * voiceResults.length)];
    
    Alert.alert(
      'Voice Recognition Result',
      `Recognized: "${randomResult}"`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Use Text',
          onPress: () => {
            const newText = value ? `${value} ${randomResult}` : randomResult;
            onChangeText(newText);
          },
        },
      ]
    );
  };

  const handleLongPress = () => {
    if (enabled) {
      startListening();
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={[
          styles.textInput,
          multiline && styles.multilineInput,
          isListening && styles.listeningInput,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        numberOfLines={numberOfLines}
        editable={enabled && !isListening}
      />
      
      <TouchableOpacity
        style={[
          styles.micButton,
          !enabled && styles.disabledButton,
          isListening && styles.listeningButton,
        ]}
        onLongPress={handleLongPress}
        onPress={() => {
          if (isListening) {
            stopListening();
          }
        }}
        disabled={!enabled}
        delayLongPress={500}
      >
        <Animated.View style={{transform: [{scale: micScale}]}}>
          <Icon
            name={isListening ? 'mic' : 'mic-none'}
            size={20}
            color={isListening ? '#ef4444' : enabled ? '#3b82f6' : '#9ca3af'}
          />
        </Animated.View>
      </TouchableOpacity>

      {isListening && (
        <View style={styles.listeningIndicator}>
          <Text style={styles.listeningText}>Listening...</Text>
          <View style={styles.waveform}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    animationDelay: `${i * 100}ms`,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    paddingRight: 50,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  listeningInput: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  micButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#f9fafb',
  },
  listeningButton: {
    backgroundColor: '#fef2f2',
  },
  listeningIndicator: {
    position: 'absolute',
    bottom: -40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  listeningText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  waveBar: {
    width: 2,
    height: 12,
    backgroundColor: '#ffffff',
    borderRadius: 1,
  },
});

export default VoiceToTextInput;
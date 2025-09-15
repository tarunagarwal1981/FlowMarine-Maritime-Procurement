import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface SplashScreenProps {
  onAnimationComplete?: () => void;
}

const { width, height } = Dimensions.get('window');

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onAnimationComplete,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    StatusBar.setHidden(true);
    
    // Start animations sequence
    const animationSequence = Animated.sequence([
      // Logo animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      // Text slide in
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]);

    // Wave animation (continuous)
    const waveAnimation = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    waveAnimation.start();
    
    animationSequence.start(() => {
      // Hold for a moment then complete
      setTimeout(() => {
        StatusBar.setHidden(false);
        onAnimationComplete?.();
      }, 1500);
    });

    return () => {
      StatusBar.setHidden(false);
    };
  }, [fadeAnim, scaleAnim, slideAnim, waveAnim, onAnimationComplete]);

  const waveTranslateX = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e40af', '#0ea5e9', '#06b6d4']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Animated waves background */}
        <View style={styles.wavesContainer}>
          <Animated.View
            style={[
              styles.wave,
              styles.wave1,
              { transform: [{ translateX: waveTranslateX }] },
            ]}
          />
          <Animated.View
            style={[
              styles.wave,
              styles.wave2,
              { 
                transform: [{ 
                  translateX: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-width * 1.2, width * 0.8],
                  })
                }] 
              },
            ]}
          />
          <Animated.View
            style={[
              styles.wave,
              styles.wave3,
              { 
                transform: [{ 
                  translateX: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-width * 0.8, width * 1.2],
                  })
                }] 
              },
            ]}
          />
        </View>

        {/* Main content */}
        <View style={styles.content}>
          {/* Logo container */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Ship icon */}
            <View style={styles.shipContainer}>
              <View style={styles.shipHull} />
              <View style={styles.shipMast} />
              <View style={styles.shipFlag} />
              <View style={styles.shipDetails}>
                <View style={[styles.shipWindow, { left: 10 }]} />
                <View style={[styles.shipWindow, { left: 20 }]} />
                <View style={[styles.shipWindow, { left: 30 }]} />
              </View>
            </View>
            
            {/* Anchor icon */}
            <View style={styles.anchorContainer}>
              <View style={styles.anchorRing} />
              <View style={styles.anchorShaft} />
              <View style={styles.anchorArms} />
              <View style={styles.anchorCrossbar} />
            </View>
          </Animated.View>

          {/* App name */}
          <Animated.View
            style={[
              styles.textContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.appName}>FlowMarine</Text>
            <Text style={styles.tagline}>Maritime Procurement Platform</Text>
          </Animated.View>

          {/* Loading indicator */}
          <Animated.View
            style={[
              styles.loadingContainer,
              { opacity: fadeAnim },
            ]}
          >
            <View style={styles.loadingBar}>
              <Animated.View
                style={[
                  styles.loadingProgress,
                  {
                    width: waveAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.loadingText}>Initializing...</Text>
          </Animated.View>
        </View>

        {/* Version info */}
        <Animated.View
          style={[
            styles.versionContainer,
            { opacity: fadeAnim },
          ]}
        >
          <Text style={styles.versionText}>Version 1.0.0</Text>
          <Text style={styles.copyrightText}>© 2024 FlowMarine Technologies</Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wavesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  wave: {
    position: 'absolute',
    width: width * 2,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 50,
  },
  wave1: {
    bottom: height * 0.3,
    backgroundColor: 'rgba(96, 165, 250, 0.3)',
  },
  wave2: {
    bottom: height * 0.25,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  wave3: {
    bottom: height * 0.2,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  shipContainer: {
    width: 120,
    height: 80,
    marginBottom: 20,
    position: 'relative',
  },
  shipHull: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    height: 30,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  shipMast: {
    position: 'absolute',
    left: '50%',
    marginLeft: -2,
    top: 10,
    width: 4,
    height: 50,
    backgroundColor: '#64748b',
  },
  shipFlag: {
    position: 'absolute',
    left: '50%',
    top: 10,
    width: 20,
    height: 12,
    backgroundColor: '#ef4444',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  shipDetails: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  shipWindow: {
    width: 8,
    height: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    marginHorizontal: 2,
  },
  anchorContainer: {
    width: 60,
    height: 60,
    position: 'relative',
  },
  anchorRing: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  anchorShaft: {
    position: 'absolute',
    left: '50%',
    marginLeft: -2,
    top: 12,
    width: 4,
    height: 35,
    backgroundColor: '#ffffff',
  },
  anchorArms: {
    position: 'absolute',
    bottom: 5,
    left: '50%',
    marginLeft: -15,
    width: 30,
    height: 15,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderTopWidth: 0,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  anchorCrossbar: {
    position: 'absolute',
    top: 25,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 3,
    backgroundColor: '#ffffff',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '300',
  },
  loadingContainer: {
    alignItems: 'center',
    width: '100%',
  },
  loadingBar: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loadingProgress: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '300',
  },
  versionContainer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
import React from 'react';
import {View, StyleSheet, Animated, PanResponder, Dimensions} from 'react-native';
import {GestureHandlerRootView, PanGestureHandler, State} from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface SwipeGestureHandlerProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: {
    icon: string;
    color: string;
    label: string;
  };
  rightAction?: {
    icon: string;
    color: string;
    label: string;
  };
  threshold?: number;
  enabled?: boolean;
}

const {width: screenWidth} = Dimensions.get('window');

const SwipeGestureHandler: React.FC<SwipeGestureHandlerProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  threshold = screenWidth * 0.3,
  enabled = true,
}) => {
  const translateX = new Animated.Value(0);
  const leftActionOpacity = new Animated.Value(0);
  const rightActionOpacity = new Animated.Value(0);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return enabled && Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 50;
    },
    onPanResponderGrant: () => {
      translateX.setOffset(translateX._value);
    },
    onPanResponderMove: (evt, gestureState) => {
      if (!enabled) return;

      const newTranslateX = Math.max(-threshold, Math.min(threshold, gestureState.dx));
      translateX.setValue(newTranslateX);

      // Update action opacities based on swipe distance
      if (gestureState.dx > 0 && rightAction) {
        const opacity = Math.min(1, gestureState.dx / threshold);
        rightActionOpacity.setValue(opacity);
        leftActionOpacity.setValue(0);
      } else if (gestureState.dx < 0 && leftAction) {
        const opacity = Math.min(1, Math.abs(gestureState.dx) / threshold);
        leftActionOpacity.setValue(opacity);
        rightActionOpacity.setValue(0);
      } else {
        leftActionOpacity.setValue(0);
        rightActionOpacity.setValue(0);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (!enabled) return;

      translateX.flattenOffset();

      if (gestureState.dx > threshold && onSwipeRight) {
        // Swipe right action
        Animated.timing(translateX, {
          toValue: screenWidth,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onSwipeRight();
          resetPosition();
        });
      } else if (gestureState.dx < -threshold && onSwipeLeft) {
        // Swipe left action
        Animated.timing(translateX, {
          toValue: -screenWidth,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onSwipeLeft();
          resetPosition();
        });
      } else {
        // Reset to original position
        resetPosition();
      }
    },
  });

  const resetPosition = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(leftActionOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(rightActionOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      {/* Left Action Background */}
      {leftAction && (
        <Animated.View
          style={[
            styles.actionBackground,
            styles.leftAction,
            {
              backgroundColor: leftAction.color,
              opacity: leftActionOpacity,
            },
          ]}
        >
          <Icon name={leftAction.icon} size={24} color="#ffffff" />
        </Animated.View>
      )}

      {/* Right Action Background */}
      {rightAction && (
        <Animated.View
          style={[
            styles.actionBackground,
            styles.rightAction,
            {
              backgroundColor: rightAction.color,
              opacity: rightActionOpacity,
            },
          ]}
        >
          <Icon name={rightAction.icon} size={24} color="#ffffff" />
        </Animated.View>
      )}

      {/* Main Content */}
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{translateX}],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  actionBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: screenWidth,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  leftAction: {
    left: 0,
    alignItems: 'flex-end',
    paddingRight: 30,
  },
  rightAction: {
    right: 0,
    alignItems: 'flex-start',
    paddingLeft: 30,
  },
  content: {
    zIndex: 2,
    backgroundColor: '#ffffff',
  },
});

export default SwipeGestureHandler;
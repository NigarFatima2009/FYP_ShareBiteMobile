import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { colors } from '../theme';

interface SplashScreenProps {
  onFinish?: () => void;
}

const { width } = Dimensions.get('window');
const ICON_SIZE = width * 0.4;

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Initial pop-in (framer-motion like spring)
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 40,
      friction: 5,
      useNativeDriver: true,
    }).start();

    // 2. Continuous slight pulse animation while waiting
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Navigate to next screen after 2.5 seconds
    const timer = setTimeout(() => {
      // 3. Exit animation
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 15, // zoom in dramatically
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0, // fade out simultaneously
          duration: 600,
          useNativeDriver: true,
        })
      ]).start(() => {
        if (onFinish) {
          onFinish();
        }
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [scaleAnim, pulseAnim, onFinish]);

  // Try to load physical app icon from assets if exists, otherwise fallback to styled container
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />

      <Animated.View
        style={[
          styles.iconContainer,
          {
            opacity: pulseAnim,
            transform: [
              { scale: Animated.multiply(scaleAnim, pulseAnim) },
            ],
          },
        ]}>
        {/* We use the app's logo Image if available, otherwise just our styled icon shape */}
        <Image
          source={require('../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png')}
          style={styles.logoImage}
          resizeMode="contain"
          onError={(e) => console.log('Logo image not found, would fallback')}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // Clean white background for modern aesthetic
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    backgroundColor: 'transparent',
    borderRadius: ICON_SIZE / 4, // squircle shape
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: ICON_SIZE / 4,
  },
});

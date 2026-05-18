import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet, Easing } from 'react-native';

const chatbotImage = require('../assets/chatbot-robot.png');

export const AnimatedChatbotIcon: React.FC<{ size?: number }> = ({ size = 160 }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const particle1Anim = useRef(new Animated.Value(0)).current;
  const particle2Anim = useRef(new Animated.Value(0)).current;
  const particle3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Floating animation (up and down)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -20,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Gentle rotation animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: -1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Particle 1 animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(particle1Anim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(particle1Anim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(1000),
      ])
    ).start();

    // Particle 2 animation
    Animated.loop(
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(particle2Anim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(particle2Anim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(700),
      ])
    ).start();

    // Particle 3 animation
    Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(particle3Anim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(particle3Anim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ])
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-10deg', '10deg'],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Greeting particles - small blue dots */}
      <Animated.View
        style={[
          styles.particle,
          {
            top: size * 0.1,
            right: size * 0.1,
            opacity: particle1Anim,
            transform: [{ scale: particle1Anim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.particle2,
          {
            top: size * 0.2,
            left: size * 0.1,
            opacity: particle2Anim,
            transform: [{ scale: particle2Anim }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.particle,
          {
            bottom: size * 0.2,
            right: size * 0.1,
            opacity: particle3Anim,
            transform: [{ scale: particle3Anim }],
          },
        ]}
      />

      {/* Robot Image - Scales with size prop */}
      <Animated.View
        style={{
          width: size,
          height: size,
          justifyContent: 'center',
          alignItems: 'center',
          transform: [
            {
              translateY: floatAnim.interpolate({
                inputRange: [-20, 0],
                outputRange: [-size * 0.1, 0]
              })
            },
            { rotate },
            { scale: scaleAnim },
          ],
        }}
      >
        <Image
          source={chatbotImage}
          style={{ width: size * 0.8, height: size * 0.8 }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F465E6', // Theme Primary Pink
  },
  particle2: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F8E6F5', // Theme Secondary Light Pink
  },
});

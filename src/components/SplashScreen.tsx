import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);
  const dotAnim1 = new Animated.Value(0.3);
  const dotAnim2 = new Animated.Value(0.3);
  const dotAnim3 = new Animated.Value(0.3);

  useEffect(() => {
    // Fade in and scale animation
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
    ]).start();

    // Loading dots animation
    const animateDots = () => {
      Animated.sequence([
        Animated.timing(dotAnim1, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim2, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim3, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(dotAnim1, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim2, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim3, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => animateDots());
    };

    animateDots();

    // Auto hide after 2.5 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={['#FF6B6B', '#FF8E53', '#FFA726']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#FF6B6B"
        translucent
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}>
        {/* Icon Container */}
        <View style={styles.iconContainer}>
          {/* Plate */}
          <View style={styles.plate}>
            {/* Fork */}
            <View style={styles.fork}>
              <View style={[styles.forkHandle, styles.forkCenter]} />
              <View style={[styles.forkProng, styles.forkLeft]} />
              <View style={[styles.forkProng, styles.forkRight]} />
            </View>

            {/* Spoon */}
            <View style={styles.spoon}>
              <View style={styles.spoonHead} />
              <View style={styles.spoonHandle} />
            </View>

            {/* Heart */}
            <View style={styles.heartContainer}>
              <Text style={styles.heartIcon}>❤️</Text>
            </View>
          </View>

          {/* Decorative elements */}
          <View style={[styles.fruit, styles.apple]}>
            <Text style={styles.fruitEmoji}>🍎</Text>
          </View>
          <View style={[styles.fruit, styles.orange]}>
            <Text style={styles.fruitEmoji}>🍊</Text>
          </View>
        </View>

        {/* App Name */}
        <Text style={styles.appName}>ShareBite</Text>
        <Text style={styles.tagline}>Share Food, Share Love</Text>

        {/* Loading Dots */}
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[styles.dot, { opacity: dotAnim1 }]}
          />
          <Animated.View
            style={[styles.dot, { opacity: dotAnim2 }]}
          />
          <Animated.View
            style={[styles.dot, { opacity: dotAnim3 }]}
          />
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Connecting Donors with Those in Need
        </Text>
      </Animated.View>

      {/* Background decorative circles */}
      <View style={[styles.bgCircle, styles.bgCircle1]} />
      <View style={[styles.bgCircle, styles.bgCircle2]} />
      <View style={[styles.bgCircle, styles.bgCircle3]} />
      <View style={[styles.bgCircle, styles.bgCircle4]} />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  plate: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#FFE5E5',
  },
  fork: {
    position: 'absolute',
    left: 30,
    top: 40,
  },
  forkHandle: {
    width: 8,
    height: 80,
    backgroundColor: '#FF6B6B',
    borderRadius: 4,
  },
  forkCenter: {
    marginLeft: 8,
  },
  forkProng: {
    width: 6,
    height: 35,
    backgroundColor: '#FF6B6B',
    borderRadius: 3,
    position: 'absolute',
    top: 0,
  },
  forkLeft: {
    left: 0,
  },
  forkRight: {
    right: -8,
  },
  spoon: {
    position: 'absolute',
    right: 30,
    top: 40,
  },
  spoonHead: {
    width: 20,
    height: 28,
    backgroundColor: '#FF8E53',
    borderRadius: 10,
  },
  spoonHandle: {
    width: 8,
    height: 60,
    backgroundColor: '#FF8E53',
    borderRadius: 4,
    marginLeft: 6,
    marginTop: 2,
  },
  heartContainer: {
    position: 'absolute',
  },
  heartIcon: {
    fontSize: 32,
  },
  fruit: {
    position: 'absolute',
    width: 35,
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  apple: {
    top: -10,
    left: 20,
  },
  orange: {
    top: -10,
    right: 20,
  },
  fruitEmoji: {
    fontSize: 28,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 2,
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 18,
    color: 'white',
    opacity: 0.9,
    marginBottom: 60,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 100,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'white',
    marginHorizontal: 5,
  },
  footer: {
    fontSize: 14,
    color: 'white',
    opacity: 0.7,
    position: 'absolute',
    bottom: -200,
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 1000,
    backgroundColor: 'white',
  },
  bgCircle1: {
    width: 200,
    height: 200,
    top: 100,
    left: -50,
    opacity: 0.1,
  },
  bgCircle2: {
    width: 300,
    height: 300,
    top: 200,
    right: -100,
    opacity: 0.08,
  },
  bgCircle3: {
    width: 240,
    height: 240,
    bottom: 100,
    left: -80,
    opacity: 0.1,
  },
  bgCircle4: {
    width: 160,
    height: 160,
    bottom: 150,
    right: -40,
    opacity: 0.12,
  },
});

export default SplashScreen;

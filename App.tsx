/**
 * ShareBite React Native App
 * Main App Component
 */

import React, { useState, useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import { GestureHandlerRootView, TouchableWithoutFeedback } from 'react-native-gesture-handler';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Toast from 'react-native-toast-message';
import { colors } from './src/theme';
import { storage } from './src/utils/storage';
import ErrorBoundary from './src/components/ErrorBoundary';
import { OfflineScreen } from './src/screens/OfflineScreen';
import { MaintenanceScreen } from './src/screens/MaintenanceScreen';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { checkServer } from './src/services/api';
import { useAutoLogout } from './src/hooks/useAutoLogout';
import { configureDevEnvironment } from './src/config/devConfig';

// Configure development environment
// This disables on-screen errors and shows them only in terminal
configureDevEnvironment();

// Polyfill for Socket.io bundled in Puter.js that uses Node.js timer unref() method
if (typeof (Number.prototype as any).unref === 'undefined') {
  (Number.prototype as any).unref = function() { return this; };
}

// Screens
import SplashScreen from './src/screens/SplashScreen';
import { Login } from './src/screens/Login';
import { UserRegistration } from './src/screens/UserRegistration';
import { ForgotPassword } from './src/screens/ForgotPassword';
import { AIChatbot } from './src/screens/AIChatbot';
import { MainNavigator } from './src/navigation/MainNavigator';
import { initGoogleSignin } from './src/services/auth';

const Stack = createStackNavigator();

// -------------------- TYPES --------------------
type UserType = 'donor' | 'ngo' | 'volunteer';

type Notification = {
  id: number;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
};

type AppState = {
  donations: any[];
  notifications: Notification[];
  deliveries: any[];
  pendingPickups: any[];
  userRequests: any[];
};

type AppProps = {};

const App: React.FC<AppProps> = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [appState, setAppState] = useState<AppState>({
    donations: [],
    notifications: [],
    deliveries: [],
    pendingPickups: [],
    userRequests: [],
  });

  // Only check network if backend is required
  // const { isConnected, isChecking } = useNetworkStatus();

  // -------------------- LOGOUT HANDLER --------------------
  const handleLogout = async (isAutoLogout: boolean = false) => {
    try {
      // Sign out from Firebase
      const { signOut } = require('./src/services/firebase');
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }

    setUser(null);
    await storage.removeUser();
    setAppState({
      donations: [],
      notifications: [],
      deliveries: [],
      pendingPickups: [],
      userRequests: [],
    });

    if (isAutoLogout === true) {
      Toast.show({
        type: 'info',
        text1: 'Session Expired',
        text2: 'You have been logged out due to inactivity',
      });
    }
  };

  // Auto-logout after 10 minutes of inactivity (SEC-3)
  const { resetTimer } = useAutoLogout({
    onLogout: handleLogout,
    timeoutMinutes: 10,
  });

  // -------------------- EFFECT --------------------
  useEffect(() => {
    const initApp = async () => {
      try {
        await Ionicons.loadFont();
        initGoogleSignin(); // Initialize Google Sign-In once at app startup

      } catch (error) {
        console.warn('Failed to load Ionicons font', error);
      }

      await checkUserSession();
    };

    initApp();

    // Listen to Firebase auth state changes
    const { onAuthStateChanged } = require('./src/services/firebase');
    const unsubscribe = onAuthStateChanged(async (firebaseUser: any) => {
      if (firebaseUser) {
        // User is signed in
        const { getCurrentUserProfile } = require('./src/services/auth');
        const result = await getCurrentUserProfile();
        if (result.success && result.user && result.user.userType) {
          setUser(result.user);
          await storage.saveUser(result.user);
        } else {
          // If no userType, user is not fully registered. Keep them as "null" to stay on Login/Register
          setUser(null);
        }
      } else {
        // User is signed out
        // Keep demo accounts working
        const savedUser = await storage.getUser();
        if (!savedUser || savedUser.uid) {
          // Only clear if it was a Firebase user
          setUser(null);
          await storage.removeUser();
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for Firebase notifications
  useEffect(() => {
    if (!user?.uid) return;

    const firestore = require('@react-native-firebase/firestore').default;

    // Listen for new notifications
    const unsubscribe = firestore()
      .collection('notifications')
      .where('userId', '==', user.uid)
      .where('read', '==', false)
      // .orderBy('createdAt', 'desc') // Removed to avoid missing Firestore composite index error
      .onSnapshot(
        (snapshot: any) => {
          snapshot.docChanges().forEach((change: any) => {
            if (change.type === 'added') {
              const notificationData = change.doc.data();

              // Show toast notification
              Toast.show({
                type: notificationData.type === 'verification_approved' ? 'success' :
                  notificationData.type === 'verification_rejected' ? 'error' : 'info',
                text1: notificationData.title,
                text2: notificationData.message,
                visibilityTime: 6000,
                position: 'top',
              });

              // Add to app state
              const newNotification = {
                id: change.doc.id,
                type: notificationData.type,
                title: notificationData.title,
                message: notificationData.message,
                timestamp: notificationData.createdAt,
                read: false,
                data: notificationData.data,
              };

              setAppState(prev => {
                const updated = [newNotification, ...prev.notifications];
                // Sort client-side to replace the removed orderBy query
                updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                return {
                  ...prev,
                  notifications: updated,
                };
              });
            }
          });
        },
        (error: any) => {
          console.error('Error listening to notifications:', error);
        }
      );

    return () => unsubscribe();
  }, [user?.uid]);

  // -------------------- USER SESSION --------------------
  const checkUserSession = async () => {
    try {
      // Skip server check if not using backend
      // Only check server if you're using backend API
      // const serverStatus = await checkServer();
      // if (serverStatus.isMaintenanceMode) {
      //   setIsMaintenanceMode(true);
      //   setIsLoading(false);
      //   return;
      // }

      // Check Firebase authentication state
      const { getCurrentUserProfile } = require('./src/services/auth');
      const firebaseUser = await getCurrentUserProfile();

      if (firebaseUser.success && firebaseUser.user && firebaseUser.user.userType) {
        // User is logged in with Firebase and has a complete profile
        setUser(firebaseUser.user);
        initializeUserData(firebaseUser.user);
        await storage.saveUser(firebaseUser.user);
        return;
      }

      // Fallback to local storage (for demo accounts)
      const savedUser = await storage.getUser();
      if (savedUser) {
        setUser(savedUser);
        initializeUserData(savedUser);
      }
    } catch (error) {
      console.error('Failed to check user session:', error);
    }
  };

  const handleSplashFinish = () => {
    setIsLoading(false);
  };

  const handleRetryConnection = async () => {
    setIsLoading(true);
    setIsMaintenanceMode(false);
    await checkUserSession();
    setIsLoading(false);
  };

  const handleLogin = async (userData: any) => {
    setUser(userData);
    await storage.saveUser(userData);
    initializeUserData(userData);
  };

  const handleRegister = async (userData: any) => {
    setUser(userData);
    await storage.saveUser(userData);
    initializeUserData(userData);
  };

  // -------------------- USER DATA --------------------
  const initializeUserData = (userData: any) => {
    const notifications = getInitialNotifications(userData.userType);
    setAppState(prev => ({ ...prev, notifications }));
  };

  const getInitialNotifications = (userType: UserType): Notification[] => {
    const notificationsByType: Record<UserType, Notification[]> = {
      donor: [
        {
          id: 1,
          type: 'pickup',
          title: 'Pickup Scheduled',
          message: 'Your food donation pickup is confirmed for today at 2:00 PM',
          timestamp: new Date().toISOString(),
          read: false,
        },
        {
          id: 2,
          type: 'ngo_interested',
          title: 'NGO Interested',
          message: 'Hope Community Center is interested in your pasta donation',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          read: false,
        },
      ],
      ngo: [
        {
          id: 1,
          type: 'donation',
          title: 'New Donation Available',
          message: 'Fresh vegetables available for pickup in your area',
          timestamp: new Date().toISOString(),
          read: false,
        },
        {
          id: 2,
          type: 'volunteer_needed',
          title: 'Volunteer Needed',
          message: 'Claimed donation needs volunteer for pickup',
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          read: false,
        },
      ],
      volunteer: [
        {
          id: 1,
          type: 'delivery_task',
          title: 'New Delivery Task',
          message: 'Pickup needed from Sunshine Bakery to Hope Center',
          timestamp: new Date().toISOString(),
          read: false,
        },
      ],
    };

    return notificationsByType[userType] || [];
  };

  // -------------------- STATE HELPERS --------------------
  const updateAppState = (key: keyof AppState, value: any | ((prev: any) => any)) => {
    setAppState(prev => ({
      ...prev,
      [key]: typeof value === 'function' ? value(prev[key]) : value,
    }));
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      read: false,
      ...notification,
    };
    setAppState(prev => ({
      ...prev,
      notifications: [newNotification, ...prev.notifications],
    }));
  };

  // -------------------- RENDER --------------------
  if (isLoading) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // Show maintenance screen (only if using backend)
  // if (isMaintenanceMode) {
  //   return <MaintenanceScreen onRetry={handleRetryConnection} />;
  // }

  // Show offline screen (only for critical network issues)
  // Commented out because Firebase works offline
  // if (!isChecking && !isConnected) {
  //   return <OfflineScreen onRetry={handleRetryConnection} />;
  // }

  // Wrap app in TouchableWithoutFeedback to detect user activity
  const handleUserActivity = () => {
    if (user) {
      resetTimer();
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <View style={{ flex: 1 }} onTouchStart={handleUserActivity}>
          <StatusBar backgroundColor={colors.primary} barStyle="light-content" />
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {!user ? (
                <>
                  <Stack.Screen name="Login">
                    {props => <Login {...props} onLogin={handleLogin} />}
                  </Stack.Screen>
                  <Stack.Screen name="Register">
                    {props => <UserRegistration {...props} onRegister={handleRegister} />}
                  </Stack.Screen>
                  <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
                  <Stack.Screen name="AIChatbot">
                    {props => <AIChatbot {...props} user={null} />}
                  </Stack.Screen>
                </>
              ) : (
                <Stack.Screen name="Main">
                  {props => (
                    <MainNavigator
                      {...props}
                      user={user}
                      appState={appState}
                      updateAppState={updateAppState as (key: string, value: any) => void}
                      addNotification={addNotification}
                      onLogout={handleLogout}
                    />
                  )}
                </Stack.Screen>
              )}
            </Stack.Navigator>
          </NavigationContainer>
          <Toast />
        </View>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
};

export default App;

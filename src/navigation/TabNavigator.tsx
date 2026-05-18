import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { colors, typography } from '../theme';
import { FloatingChatButton } from '../components/FloatingChatButton';

// Screens
import { Dashboard } from '../screens/Dashboard';
import { PostFoodDonation } from '../screens/PostFoodDonation';
import { RequestFood } from '../screens/RequestFood';
import { TrackDeliveries } from '../screens/TrackDeliveries';
import { Notifications } from '../screens/Notifications';
import { Feedback } from '../screens/Feedback';
import { Maps } from '../screens/Maps';
import { Scheduling } from '../screens/Scheduling';
import { ManageDonations } from '../screens/ManageDonations';
import { NGORequests } from '../screens/NGORequests';
import { MyDonations } from '../screens/MyDonations';
import { NGOVerification } from '../screens/NGOVerification';
import { VolunteerRoutes } from '../screens/VolunteerRoutes';

import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

interface TabNavigatorProps {
  user: any;
  appState: any;
  updateAppState: (key: string, value: any) => void;
  addNotification: (notification: any) => void;
  onLogout: () => void;
}

export const TabNavigator: React.FC<TabNavigatorProps> = ({
  user,
  appState,
  updateAppState,
  addNotification,
  onLogout,
}) => {
  const navigation = useNavigation();

  // Use useNavigationState to reliably track the current route
  const currentRouteName = useNavigationState(state => {
    if (!state) return undefined;
    const route = state.routes[state.index];
    // Check if we're in a tab navigator
    if (route?.state && typeof route.state.index === 'number') {
      const tabRoute = route.state.routes[route.state.index];
      return tabRoute?.name;
    }
    return route?.name;
  });

  // Show floating button ONLY on Dashboard
  const showFloatingButton = currentRouteName === 'Dashboard';

  // Debug logging
  useEffect(() => {
    console.log('Current route:', currentRouteName);
    console.log('Show floating button:', showFloatingButton);
  }, [currentRouteName, showFloatingButton]);

  // Auto-redirect verified NGOs to Requirement Creation if they haven't set any
  useEffect(() => {
    if (user?.userType === 'ngo') {
      const checkRequirements = async () => {
        try {
          const reqs = await firestore()
            .collection('ngoRequirements')
            .where('ngoId', '==', user.uid)
            .where('status', '==', 'Active')
            .limit(1)
            .get();

          if (reqs.empty) {
            // Give a short delay to ensure navigation is ready and smooth
            setTimeout(() => {
              (navigation as any).navigate('NGORequirementCreation');
            }, 500);
          }
        } catch (error) {
          console.error('Error checking NGO requirements:', error);
        }
      };

      checkRequirements();
    }
  }, [user?.userType, user?.uid, navigation]);

  const getTabsForUserType = () => {
    const commonTabs = [
      {
        name: 'Dashboard',
        component: Dashboard,
        icon: 'home',
        label: 'Home',
      },
    ];

    switch (user.userType) {
      case 'donor':
        return [
          ...commonTabs,
          {
            name: 'PostDonation',
            component: PostFoodDonation,
            icon: 'add-circle',
            label: 'Donate',
          },
          {
            name: 'MyDonations',
            component: MyDonations,
            icon: 'cube',
            label: 'My Donations',
          },
          {
            name: 'Profile',
            component: ProfileScreen,
            icon: 'person',
            label: 'Profile',
          },
        ];

      case 'ngo':
        return [
          ...commonTabs,
          {
            name: 'NGORequests',
            component: NGORequests,
            icon: 'add-circle',
            label: 'Request',
          },
          {
            name: 'TrackDeliveries',
            component: TrackDeliveries,
            icon: 'location',
            label: 'Track',
          },
          {
            name: 'Profile',
            component: ProfileScreen,
            icon: 'person',
            label: 'Profile',
          },
        ];

      case 'volunteer':
        return [
          ...commonTabs,
          {
            name: 'VolunteerRoutes',
            component: VolunteerRoutes,
            icon: 'car',
            label: 'Routes',
          },
          {
            name: 'Scheduling',
            component: Scheduling,
            icon: 'calendar',
            label: 'Schedule',
          },
          {
            name: 'Profile',
            component: ProfileScreen,
            icon: 'person',
            label: 'Profile',
          },
        ];


      default:
        return commonTabs;
    }
  };

  const tabs = getTabsForUserType();
  const [unreadCount, setUnreadCount] = useState(0);

  // Real-time notification count
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupListener = () => {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      unsubscribe = firestore()
        .collection('notifications')
        .where('userId', '==', currentUser.uid)
        .where('read', '==', false)
        .onSnapshot(
          (snapshot) => {
            setUnreadCount(snapshot.docs.length);
          },
          () => {
            setUnreadCount(0);
          }
        );
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.white,
          headerTitleStyle: {
            fontFamily: typography.fontFamily.semibold,
            fontSize: typography.fontSize.lg,
          },
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarLabelStyle: {
            fontFamily: typography.fontFamily.medium,
            fontSize: typography.fontSize.xs,
          },
        }}
      >
        {tabs.map(tab => (
          <Tab.Screen
            key={tab.name}
            name={tab.name}
            options={{
              headerShown: ['Dashboard', 'PostDonation', 'MyDonations', 'NGORequests', 'ManageDonations', 'RequestFood', 'VolunteerRoutes'].includes(tab.name) ? false : true,
              tabBarLabel: tab.label,
              tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                <View>
                  <Icon name={tab.icon} size={size} color={color} />
                  {tab.name === 'Dashboard' && unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
              ),
            }}
            listeners={({ navigation }) => ({
              tabPress: (tab as any).isCallButton ? (e: any) => {
                e.preventDefault();
                navigation.getParent()?.navigate('CallScreen');
              } : undefined,
            })}
          >
            {(props: any) => {
              const Component = tab.component;

              if (!Component) {
                return (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                );
              }

              return (
                <Component
                  {...props}
                  user={user}
                  appState={appState}
                  updateAppState={updateAppState}
                  addNotification={addNotification}
                  onLogout={onLogout}
                />
              );
            }}
          </Tab.Screen>
        ))}
      </Tab.Navigator>

      {/* Floating AI Chatbot Button - Only shown on Dashboard */}
      {showFloatingButton && (
        <FloatingChatButton
          onPress={() => navigation.navigate('AIChatbot' as never)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: colors.destructive,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
  },
});


import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator } from 'react-native';
import { TabNavigator } from './TabNavigator';
import { CallScreen } from '../screens/CallScreen';
import ChatScreen from '../screens/ChatScreen';
import { Notifications } from '../screens/Notifications';
import { Feedback } from '../screens/Feedback';
import { NGOVerification } from '../screens/NGOVerification';
import { DonorVerification } from '../screens/DonorVerification';
import { VolunteerVerification } from '../screens/VolunteerVerification';
import { VolunteerRoutes } from '../screens/VolunteerRoutes';
import { TrackDeliveries } from '../screens/TrackDeliveries';
import { DeliveryTestScreen } from '../screens/DeliveryTestScreen';
import { DonationDetail } from '../screens/DonationDetail';
import { RequestHistory } from '../screens/RequestHistory';
import { AIChatbot } from '../screens/AIChatbot';
import { AdminNGOVerifications } from '../screens/AdminNGOVerifications';
import { AdminDonorVerifications } from '../screens/AdminDonorVerifications';
import { AdminVolunteerVerifications } from '../screens/AdminVolunteerVerifications';
import { AdminUserManagement } from '../screens/AdminUserManagement';
import { NGORequirementCreation } from '../screens/NGORequirementCreation';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { colors } from '../theme';

const Stack = createStackNavigator();

interface MainNavigatorProps {
  user: any;
  appState: any;
  updateAppState: (key: string, value: any) => void;
  addNotification: (notification: any) => void;
  onLogout: () => void;
}

export const MainNavigator: React.FC<MainNavigatorProps> = ({
  user,
  appState,
  updateAppState,
  addNotification,
  onLogout,
}) => {
  // Initialize from user prop if available to avoid flicker
  const [needsVerification, setNeedsVerification] = useState(user?.verified === false);
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<string>('Tabs');

  // Check if User needs verification - listen for real-time updates
  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      setNeedsVerification(false);
      return;
    }

    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot(
        (doc) => {
          const userData = doc.data();
          if (userData) {
            const isVerified = userData?.verified === true ||
              userData?.ngoVerified === true ||
              userData?.donorVerified === true ||
              userData?.volunteerVerified === true;

            setNeedsVerification(!isVerified);

            if (!isVerified) {
              if (user?.userType === 'ngo') setInitialRoute('NGOVerification');
              else if (user?.userType === 'donor') setInitialRoute('DonorVerification');
              else if (user?.userType === 'volunteer') setInitialRoute('VolunteerVerification');
            } else {
              setInitialRoute('Tabs');
            }
            setIsLoading(false);
          } else {
            setNeedsVerification(true);
            setIsLoading(false);
          }
        },
        () => {
          setNeedsVerification(true);
          setIsLoading(false);
        }
      );

    return () => unsubscribe();
  }, [user?.userType, user?.uid]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Tabs">
        {props => (
          <TabNavigator
            {...props}
            user={user}
            appState={appState}
            updateAppState={updateAppState}
            addNotification={addNotification}
            onLogout={onLogout}
          />
        )}
      </Stack.Screen>

      {/* Verification Screens - Always in stack so they can be navigated to */}
      <Stack.Screen name="NGOVerification">
        {props => <NGOVerification {...props} user={user} addNotification={addNotification} />}
      </Stack.Screen>
      <Stack.Screen name="DonorVerification">
        {props => <DonorVerification {...props} user={user} addNotification={addNotification} />}
      </Stack.Screen>
      <Stack.Screen name="VolunteerVerification">
        {props => <VolunteerVerification {...props} user={user} addNotification={addNotification} />}
      </Stack.Screen>

      <Stack.Screen name="CallScreen">
        {props => <CallScreen {...props} user={user} />}
      </Stack.Screen>
      <Stack.Screen name="ChatScreen" component={ChatScreen} />
      <Stack.Screen name="Notifications">
        {props => <Notifications {...props} appState={appState} updateAppState={updateAppState} />}
      </Stack.Screen>
      <Stack.Screen name="Feedback">
        {props => <Feedback {...props} user={user} addNotification={addNotification} />}
      </Stack.Screen>
      <Stack.Screen name="VolunteerRoutes">
        {props => <VolunteerRoutes {...props} user={user} />}
      </Stack.Screen>
      <Stack.Screen name="TrackDeliveries" component={TrackDeliveries} />
      <Stack.Screen name="DeliveryTest" component={DeliveryTestScreen} />
      <Stack.Screen name="DonationDetail" component={DonationDetail} />
      <Stack.Screen name="RequestHistory" component={RequestHistory} />
      <Stack.Screen name="AIChatbot">
        {props => <AIChatbot {...props} user={user} />}
      </Stack.Screen>
      <Stack.Screen name="AdminNGOVerifications" component={AdminNGOVerifications} />
      <Stack.Screen name="AdminDonorVerifications" component={AdminDonorVerifications} />
      <Stack.Screen name="AdminVolunteerVerifications" component={AdminVolunteerVerifications} />
      <Stack.Screen name="AdminUserManagement" component={AdminUserManagement} />
      <Stack.Screen name="NGORequirementCreation">
        {props => <NGORequirementCreation {...props} user={user} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

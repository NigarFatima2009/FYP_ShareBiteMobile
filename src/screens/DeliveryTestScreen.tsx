/**
 * Delivery Test Screen
 * 
 * This screen allows testing the complete delivery flow:
 * 1. Initialize mock data
 * 2. Volunteer accepts pickup
 * 3. Start delivery with real-time tracking
 * 4. Complete delivery
 * 
 * Use this to test NGO-side tracking and notifications
 * 
 * TEST WITH 3 PHONES:
 * Phone 1 (Donor): donor@test.com / test123
 * Phone 2 (NGO): ngo@test.com / test123
 * Phone 3 (Volunteer): volunteer@test.com / test123
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import { Card } from '../components/common/Card';
import { colors, typography, spacing, borderRadius } from '../theme';
import {
  initializeMockData,
  simulateDonorCreatesDonation,
  simulateNGORequestsDonation,
  simulateDonorApprovesRequest,
  simulateVolunteerAcceptPickup,
  simulateStartDelivery,
  simulateVolunteerMovement,
  simulateDeliveryComplete,
  runFullDeliverySimulation,
  cleanupMockData,
  MOCK_DONATIONS,
  MOCK_VOLUNTEER,
  MOCK_NGO,
  MOCK_VOLUNTEER_PATH,
} from '../testData/mockDeliveryData';

// Test Account Credentials
const TEST_ACCOUNTS = {
  donor: { email: 'donor@test.com', password: 'test123', role: 'Donor' },
  ngo: { email: 'ngo@test.com', password: 'test123', role: 'NGO' },
  volunteer: { email: 'volunteer@test.com', password: 'test123', role: 'Volunteer' },
};

// Delivery Status Options
const DELIVERY_STATUSES = [
  { status: 'pending', label: 'Pending', color: '#F59E0B', icon: 'time' },
  { status: 'approved', label: 'Approved', color: '#3B82F6', icon: 'checkmark-circle' },
  { status: 'volunteer_assigned', label: 'Volunteer Assigned', color: '#8B5CF6', icon: 'person' },
  { status: 'picked_up', label: 'Picked Up', color: '#22C55E', icon: 'cube' },
  { status: 'in_transit', label: 'In Transit', color: '#EC4899', icon: 'car' },
  { status: 'delivered', label: 'Delivered', color: '#10B981', icon: 'checkmark-done' },
];

interface DeliveryTestScreenProps {
  navigation: any;
}

export const DeliveryTestScreen: React.FC<DeliveryTestScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [movementController, setMovementController] = useState<{ stop: () => void } | null>(null);
  const [activeDonationId, setActiveDonationId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('');

  // Listen to active donations for status changes
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('donations')
      .where('status', 'in', ['available', 'approved', 'claimed', 'in_transit'])
      .limit(1)
      .onSnapshot(snapshot => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setActiveDonationId(doc.id);
          setCurrentStatus(doc.data().status || '');
        }
      });
    
    return () => unsubscribe();
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  // Quick status change function
  const handleQuickStatusChange = async (newStatus: string) => {
    if (!activeDonationId) {
      Toast.show({
        type: 'error',
        text1: 'No Active Donation',
        text2: 'Create a donation first or run simulation',
      });
      return;
    }

    setLoading(true);
    try {
      // Update donation status
      await firestore().collection('donations').doc(activeDonationId).update({
        status: newStatus,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      // Update delivery tracking
      await firestore().collection('deliveryTracking').doc(activeDonationId).set({
        status: newStatus,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // Update food request if exists
      const requestsSnapshot = await firestore()
        .collection('foodRequests')
        .where('donationId', '==', activeDonationId)
        .get();
      
      if (!requestsSnapshot.empty) {
        await requestsSnapshot.docs[0].ref.update({
          status: newStatus,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      addLog(`✅ Status changed to: ${newStatus}`);
      setCurrentStatus(newStatus);
      
      Toast.show({
        type: 'success',
        text1: 'Status Updated',
        text2: `Changed to: ${newStatus}`,
      });
    } catch (error) {
      addLog(`❌ Failed to change status: ${error}`);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update status',
      });
    }
    setLoading(false);
  };

  // Copy credentials to clipboard
  const copyCredentials = (account: typeof TEST_ACCOUNTS.donor) => {
    const text = `Email: ${account.email}\nPassword: ${account.password}`;
    Clipboard.setString(text);
    Toast.show({
      type: 'success',
      text1: 'Copied!',
      text2: `${account.role} credentials copied`,
    });
  };

  // Create test accounts in Firebase
  const handleCreateTestAccounts = async () => {
    setLoading(true);
    addLog('Creating test accounts...');
    
    try {
      // Create test users in Firestore
      const batch = firestore().batch();
      
      // Donor account
      batch.set(firestore().collection('users').doc('test_donor'), {
        email: TEST_ACCOUNTS.donor.email,
        name: 'Test Donor',
        userType: 'donor',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      
      // NGO account
      batch.set(firestore().collection('users').doc('test_ngo'), {
        email: TEST_ACCOUNTS.ngo.email,
        name: 'Test NGO',
        organizationName: 'Test Food Bank',
        userType: 'ngo',
        verified: true,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      
      // Volunteer account
      batch.set(firestore().collection('users').doc('test_volunteer'), {
        email: TEST_ACCOUNTS.volunteer.email,
        name: 'Test Volunteer',
        userType: 'volunteer',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      
      await batch.commit();
      
      addLog('✅ Test accounts created in Firestore');
      addLog('⚠️ Note: You need to create these accounts in Firebase Auth manually');
      
      Alert.alert(
        'Test Accounts Ready',
        'Firestore profiles created!\n\nIMPORTANT: Create these accounts in Firebase Auth Console:\n\n' +
        `Donor: ${TEST_ACCOUNTS.donor.email}\n` +
        `NGO: ${TEST_ACCOUNTS.ngo.email}\n` +
        `Volunteer: ${TEST_ACCOUNTS.volunteer.email}\n\n` +
        'Password for all: test123',
        [{ text: 'OK' }]
      );
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
    setLoading(false);
  };

  const handleInitializeMockData = async () => {
    setLoading(true);
    addLog('Initializing users and base data...');
    
    const result = await initializeMockData();
    
    if (result.success) {
      addLog('✅ Users initialized (Donor, NGO, Volunteer)');
      setCurrentStep(1);
      Toast.show({
        type: 'success',
        text1: 'Users Ready',
        text2: 'Donor, NGO, and Volunteer profiles created',
      });
    } else {
      addLog('❌ Failed to initialize');
    }
    
    setLoading(false);
  };

  const handleDonorCreatesDonation = async () => {
    setLoading(true);
    addLog('👨‍🍳 Donor creating donation...');
    
    const result = await simulateDonorCreatesDonation('mock_donation_1');
    
    if (result.success) {
      addLog(`✅ Donor created: ${MOCK_DONATIONS[0].title}`);
      setCurrentStep(2);
      Toast.show({
        type: 'success',
        text1: 'Donation Created',
        text2: MOCK_DONATIONS[0].title,
      });
    } else {
      addLog('❌ Failed to create donation');
    }
    
    setLoading(false);
  };

  const handleNGORequests = async () => {
    setLoading(true);
    addLog('🏢 NGO requesting donation...');
    
    const result = await simulateNGORequestsDonation('mock_donation_1');
    
    if (result.success) {
      addLog(`✅ ${MOCK_NGO.name} requested the donation`);
      addLog('📬 Notification sent to donor');
      setCurrentStep(3);
      Toast.show({
        type: 'success',
        text1: 'Request Sent',
        text2: `${MOCK_NGO.name} requested the food`,
      });
    } else {
      addLog('❌ Failed to request donation');
    }
    
    setLoading(false);
  };

  const handleDonorApproves = async () => {
    setLoading(true);
    addLog('✅ Donor approving request...');
    
    const result = await simulateDonorApprovesRequest('mock_donation_1');
    
    if (result.success) {
      addLog('✅ Donor approved the request');
      addLog('📬 Notification sent to NGO');
      setCurrentStep(4);
      Toast.show({
        type: 'success',
        text1: 'Request Approved',
        text2: 'NGO can now track the delivery',
      });
    } else {
      addLog('❌ Failed to approve request');
    }
    
    setLoading(false);
  };

  const handleAcceptPickup = async () => {
    setLoading(true);
    addLog('🚗 Volunteer accepting pickup...');
    
    const result = await simulateVolunteerAcceptPickup('mock_donation_1');
    
    if (result.success) {
      addLog(`✅ ${MOCK_VOLUNTEER.name} accepted pickup`);
      setCurrentStep(5);
      Toast.show({
        type: 'success',
        text1: 'Pickup Accepted',
        text2: `${MOCK_VOLUNTEER.name} will pick up the donation`,
      });
    } else {
      addLog('❌ Failed to accept pickup');
    }
    
    setLoading(false);
  };

  const handleStartDelivery = async () => {
    setLoading(true);
    addLog('🚗 Starting delivery...');
    
    const result = await simulateStartDelivery('mock_donation_1');
    
    if (result.success) {
      addLog('✅ Delivery started - NGO notified');
      addLog('📍 Real-time tracking is now active');
      setCurrentStep(6);
      Toast.show({
        type: 'success',
        text1: 'Delivery Started',
        text2: 'NGO can now track the volunteer in real-time',
      });
    } else {
      addLog('❌ Failed to start delivery');
    }
    
    setLoading(false);
  };

  const handleSimulateMovement = async () => {
    setLoading(true);
    addLog('📍 Starting volunteer movement...');
    addLog(`📍 Simulating ${MOCK_VOLUNTEER_PATH.length} location updates (every 3 sec)`);
    
    const controller = await simulateVolunteerMovement('mock_donation_1', (location, index) => {
      addLog(`📍 Moving: ${index + 1}/${MOCK_VOLUNTEER_PATH.length} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`);
    });
    
    setMovementController(controller);
    setCurrentStep(7);
    setLoading(false);
    
    Toast.show({
      type: 'info',
      text1: 'Volunteer Moving',
      text2: 'Watch the map on NGO side!',
    });
  };

  const handleStopMovement = () => {
    if (movementController) {
      movementController.stop();
      setMovementController(null);
      addLog('⏹️ Movement stopped');
      Toast.show({
        type: 'info',
        text1: 'Movement Stopped',
      });
    }
  };

  const handleCompleteDelivery = async () => {
    setLoading(true);
    handleStopMovement();
    addLog('🏁 Completing delivery...');
    
    const result = await simulateDeliveryComplete('mock_donation_1');
    
    if (result.success) {
      addLog('✅ Delivery completed!');
      addLog('📬 NGO received completion notification');
      setCurrentStep(8);
      Toast.show({
        type: 'success',
        text1: 'Delivery Complete!',
        text2: 'Full flow completed successfully',
      });
    } else {
      addLog('❌ Failed to complete delivery');
    }
    
    setLoading(false);
  };

  const handleRunFullSimulation = async () => {
    setLoading(true);
    setLogs([]);
    addLog('🚀 Starting full delivery simulation...');
    
    Toast.show({
      type: 'info',
      text1: 'Full Simulation Started',
      text2: 'This will take about 1 minute',
    });
    
    await runFullDeliverySimulation('mock_donation_1');
    
    addLog('🎉 Full simulation complete!');
    setCurrentStep(5);
    setLoading(false);
    
    Toast.show({
      type: 'success',
      text1: 'Simulation Complete!',
      text2: 'Check NGO side for tracking and notifications',
    });
  };

  const handleCleanup = async () => {
    setLoading(true);
    addLog('Cleaning up mock data...');
    
    const result = await cleanupMockData();
    
    if (result.success) {
      addLog('✅ Mock data cleaned up');
      setCurrentStep(0);
      setLogs([]);
      Toast.show({
        type: 'success',
        text1: 'Cleanup Complete',
        text2: 'All mock data removed',
      });
    } else {
      addLog('❌ Failed to cleanup');
    }
    
    setLoading(false);
  };

  const steps = [
    { id: 1, title: '1. Initialize Users', icon: 'people', action: handleInitializeMockData },
    { id: 2, title: '2. Donor Creates Donation', icon: 'gift', action: handleDonorCreatesDonation },
    { id: 3, title: '3. NGO Requests Food', icon: 'document-text', action: handleNGORequests },
    { id: 4, title: '4. Donor Approves', icon: 'checkmark-circle', action: handleDonorApproves },
    { id: 5, title: '5. Volunteer Accepts', icon: 'hand-left', action: handleAcceptPickup },
    { id: 6, title: '6. Start Delivery', icon: 'car', action: handleStartDelivery },
    { id: 7, title: '7. Simulate Movement', icon: 'navigate', action: handleSimulateMovement },
    { id: 8, title: '8. Complete Delivery', icon: 'flag', action: handleCompleteDelivery },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery Test</Text>
        <TouchableOpacity onPress={handleCleanup} style={styles.cleanupBtn}>
          <Icon name="trash-outline" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Test Accounts Card */}
        <Card style={styles.testAccountsCard}>
          <View style={styles.testAccountsHeader}>
            <Icon name="phone-portrait-outline" size={24} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Test with 3 Phones</Text>
          </View>
          <Text style={styles.testAccountsSubtitle}>
            Login with these accounts on different devices:
          </Text>
          
          {Object.entries(TEST_ACCOUNTS).map(([key, account]) => (
            <TouchableOpacity
              key={key}
              style={styles.accountRow}
              onPress={() => copyCredentials(account)}
            >
              <View style={[styles.accountIcon, { 
                backgroundColor: key === 'donor' ? '#FEF3C7' : key === 'ngo' ? '#DBEAFE' : '#D1FAE5' 
              }]}>
                <Icon 
                  name={key === 'donor' ? 'heart' : key === 'ngo' ? 'business' : 'car'} 
                  size={20} 
                  color={key === 'donor' ? '#F59E0B' : key === 'ngo' ? '#3B82F6' : '#22C55E'} 
                />
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountRole}>{account.role}</Text>
                <Text style={styles.accountEmail}>{account.email}</Text>
              </View>
              <Icon name="copy-outline" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={styles.createAccountsBtn}
            onPress={handleCreateTestAccounts}
            disabled={loading}
          >
            <Icon name="person-add" size={18} color={colors.white} />
            <Text style={styles.createAccountsBtnText}>Create Test Accounts</Text>
          </TouchableOpacity>
        </Card>

        {/* Quick Status Change */}
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Icon name="flash" size={24} color="#EF4444" />
            <Text style={styles.sectionTitle}>Quick Status Change</Text>
          </View>
          <Text style={styles.statusSubtitle}>
            {activeDonationId 
              ? `Active: ${activeDonationId.slice(0, 8)}... | Current: ${currentStatus || 'none'}`
              : 'No active donation. Run simulation first.'}
          </Text>
          
          <View style={styles.statusGrid}>
            {DELIVERY_STATUSES.map((item) => (
              <TouchableOpacity
                key={item.status}
                style={[
                  styles.statusBtn,
                  { borderColor: item.color },
                  currentStatus === item.status && { backgroundColor: item.color },
                ]}
                onPress={() => handleQuickStatusChange(item.status)}
                disabled={loading}
              >
                <Icon 
                  name={item.icon} 
                  size={18} 
                  color={currentStatus === item.status ? colors.white : item.color} 
                />
                <Text style={[
                  styles.statusBtnText,
                  { color: currentStatus === item.status ? colors.white : item.color },
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.quickActionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={[styles.fullSimButton, loading && styles.buttonDisabled]}
            onPress={handleRunFullSimulation}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Icon name="play-circle" size={24} color={colors.white} />
                <Text style={styles.fullSimButtonText}>Run Full Simulation</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.helpText}>
            This runs the complete flow automatically (takes ~1 min)
          </Text>
        </Card>

        {/* Step by Step */}
        <Card style={styles.stepsCard}>
          <Text style={styles.sectionTitle}>Step by Step</Text>
          {steps.map((step, index) => (
            <TouchableOpacity
              key={step.id}
              style={[
                styles.stepButton,
                currentStep >= step.id && styles.stepCompleted,
                currentStep === step.id - 1 && styles.stepActive,
                (loading || currentStep < step.id - 1) && styles.stepDisabled,
              ]}
              onPress={step.action}
              disabled={loading || currentStep < step.id - 1}
            >
              <View style={[
                styles.stepIcon,
                currentStep >= step.id && styles.stepIconCompleted,
              ]}>
                <Icon 
                  name={currentStep >= step.id ? 'checkmark' : step.icon} 
                  size={20} 
                  color={currentStep >= step.id ? colors.white : colors.primary} 
                />
              </View>
              <Text style={[
                styles.stepText,
                currentStep >= step.id && styles.stepTextCompleted,
              ]}>
                {step.title}
              </Text>
              {currentStep === step.id - 1 && (
                <Icon name="chevron-forward" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
          
          {movementController && (
            <TouchableOpacity style={styles.stopButton} onPress={handleStopMovement}>
              <Icon name="stop-circle" size={20} color={colors.white} />
              <Text style={styles.stopButtonText}>Stop Movement</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Mock Data Info */}
        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Simulation Flow</Text>
          <View style={styles.infoRow}>
            <Icon name="gift" size={16} color="#F59E0B" />
            <Text style={styles.infoText}>Donor: {MOCK_DONATIONS[0].donorName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="business" size={16} color="#3B82F6" />
            <Text style={styles.infoText}>NGO: {MOCK_NGO.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="car" size={16} color="#22C55E" />
            <Text style={styles.infoText}>Volunteer: {MOCK_VOLUNTEER.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="fast-food" size={16} color={colors.primary} />
            <Text style={styles.infoText}>Food: {MOCK_DONATIONS[0].title}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="location" size={16} color="#EF4444" />
            <Text style={styles.infoText}>{MOCK_VOLUNTEER_PATH.length} movement points</Text>
          </View>
        </Card>

        {/* Logs */}
        <Card style={styles.logsCard}>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          {logs.length === 0 ? (
            <Text style={styles.noLogs}>No activity yet. Start a simulation!</Text>
          ) : (
            logs.map((log, index) => (
              <Text key={index} style={styles.logText}>{log}</Text>
            ))
          )}
        </Card>

        {/* Instructions */}
        <Card style={styles.instructionsCard}>
          <Text style={styles.sectionTitle}>How to Test</Text>
          <Text style={styles.instructionText}>
            Complete Flow:{'\n'}
            1. Donor creates donation{'\n'}
            2. NGO requests the food{'\n'}
            3. Donor approves request{'\n'}
            4. Volunteer accepts pickup{'\n'}
            5. Volunteer starts delivery{'\n'}
            6. Real-time tracking begins{'\n'}
            7. Volunteer reaches destination{'\n'}
            8. Delivery marked complete{'\n\n'}
            To test NGO tracking:{'\n'}
            • Open NGO account on another device{'\n'}
            • Go to "Track Deliveries" screen{'\n'}
            • Watch volunteer move on map!
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#EC4899',
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
  cleanupBtn: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  // Test Accounts Styles
  testAccountsCard: {
    gap: spacing.sm,
  },
  testAccountsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  testAccountsSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountRole: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  accountEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
  },
  createAccountsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  createAccountsBtnText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  // Status Change Styles
  statusCard: {
    gap: spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    fontFamily: 'monospace',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    gap: spacing.xs,
    minWidth: '45%',
  },
  statusBtnText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
  },
  quickActionsCard: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  fullSimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  fullSimButtonText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  helpText: {
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  stepsCard: {
    gap: spacing.sm,
  },
  stepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  stepCompleted: {
    backgroundColor: '#DCFCE7',
  },
  stepActive: {
    backgroundColor: `${colors.primary}15`,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  stepDisabled: {
    opacity: 0.5,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIconCompleted: {
    backgroundColor: '#22C55E',
  },
  stepText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
  },
  stepTextCompleted: {
    color: '#166534',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stopButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  infoCard: {
    gap: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.foreground,
  },
  logsCard: {
    maxHeight: 200,
  },
  noLogs: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  logText: {
    fontSize: typography.fontSize.xs,
    color: colors.foreground,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  instructionsCard: {},
  instructionText: {
    fontSize: typography.fontSize.sm,
    color: colors.foreground,
    lineHeight: 22,
  },
});

export default DeliveryTestScreen;

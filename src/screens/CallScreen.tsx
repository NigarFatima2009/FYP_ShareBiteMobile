import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { colors, typography, spacing } from '../theme';
import { addCallLog } from '../services/localData';

interface CallScreenProps {
  route: any;
  navigation: any;
  user: any;
}

export const CallScreen: React.FC<CallScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { contactName, contactPhone, contactId, profilePicture } = route.params;
  const [callDuration, setCallDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCallActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCall = async () => {
    try {
      // Make actual phone call
      const phoneUrl = `tel:${contactPhone}`;
      const canOpen = await Linking.canOpenURL(phoneUrl);

      if (canOpen) {
        setIsCallActive(true);
        await Linking.openURL(phoneUrl);

        // Log the call
        await addCallLog({
          callerId: user.id,
          callerName: user.name,
          receiverId: contactId,
          receiverName: contactName,
          type: 'outgoing',
          duration: 0, // Will be updated when call ends
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Cannot Make Call',
          text2: 'Phone app is not available',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Call Failed',
        text2: 'Unable to initiate call',
      });
    }
  };

  const handleEndCall = async () => {
    if (isCallActive) {
      // Update call log with duration
      await addCallLog({
        callerId: user.id,
        callerName: user.name,
        receiverId: contactId,
        receiverName: contactName,
        type: 'outgoing',
        duration: callDuration,
      });
    }

    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleEndCall} style={styles.backButton}>
          <Icon name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Contact Info */}
      <View style={styles.contactInfo}>
        {profilePicture ? (
          <Image source={{ uri: profilePicture }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Icon name="person" size={60} color={colors.white} />
          </View>
        )}

        <Text style={styles.contactName}>{contactName}</Text>
        <Text style={styles.contactPhone}>{contactPhone}</Text>

        {isCallActive ? (
          <View style={styles.callStatus}>
            <View style={styles.pulseIndicator} />
            <Text style={styles.callStatusText}>Call in progress</Text>
          </View>
        ) : (
          <Text style={styles.callStatusText}>Ready to call</Text>
        )}

        {isCallActive && (
          <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
        )}
      </View>

      {/* Call Actions */}
      <View style={styles.actions}>
        {!isCallActive ? (
          <TouchableOpacity style={styles.callButton} onPress={handleCall}>
            <Icon name="call" size={32} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="mic-off" size={28} color={colors.white} />
              <Text style={styles.actionLabel}>Mute</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Icon name="volume-high" size={28} color={colors.white} />
              <Text style={styles.actionLabel}>Speaker</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Icon name="keypad" size={28} color={colors.white} />
              <Text style={styles.actionLabel}>Keypad</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* End Call Button */}
      <View style={styles.endCallContainer}>
        <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
          <Icon name="call" size={32} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.endCallText}>
          {isCallActive ? 'End Call' : 'Cancel'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.lg,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${colors.white}30`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  contactName: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  contactPhone: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: `${colors.white}90`,
    marginBottom: spacing.lg,
  },
  callStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pulseIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  callStatusText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.white,
  },
  duration: {
    fontSize: typography.fontSize['3xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
    marginTop: spacing.base,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing['2xl'],
    marginBottom: spacing['2xl'],
  },
  callButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.white,
    marginTop: spacing.xs,
  },
  endCallContainer: {
    alignItems: 'center',
    paddingBottom: spacing['3xl'],
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.destructive,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  endCallText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.white,
    marginTop: spacing.md,
  },
});

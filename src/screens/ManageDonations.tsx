import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { colors, typography, spacing, borderRadius } from '../theme';

interface ManageDonationsProps {
  navigation: any;
  user: any;
  appState: any;
  updateAppState: (key: string, value: any) => void;
  addNotification: (notification: any) => void;
}

export const ManageDonations: React.FC<ManageDonationsProps> = ({
  navigation,
  appState,
  updateAppState,
  addNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // Get donations from appState or use mock data
  const allDonations = appState.donations || [
    {
      id: 1,
      foodType: 'Fresh Pasta and Sauce',
      description: 'Homemade pasta with marinara sauce, enough for a family dinner',
      quantity: '6 servings',
      status: 'claimed',
      postedDate: 'Nov 15, 02:55 PM',
      expiryDate: '2d left',
      pickupTime: 'Nov 15, 08:55 PM',
      location: '123 Main St',
      views: 12,
      interestedNGOs: 0,
      claimedBy: {
        name: 'Hope Community Center',
        claimedAt: 'Nov 15, 04:25 PM',
      },
      volunteer: {
        name: 'Alex Thompson',
        eta: 'Nov 15, 05:25 PM',
      },
      pickedUp: false,
    },
    {
      id: 2,
      foodType: 'Surplus Vegetables from Garden',
      description: 'Fresh tomatoes, peppers, and herbs from my home garden',
      quantity: '8 servings',
      status: 'available',
      postedDate: 'Nov 15, 03:55 PM',
      expiryDate: '3d left',
      pickupTime: 'Nov 15, 10:55 PM',
      location: '456 Oak Ave',
      views: 8,
      interestedNGOs: 0,
    },
    {
      id: 3,
      foodType: 'Fresh Pasta and Sauce',
      description: 'Homemade pasta with marinara sauce, enough for a family dinner',
      quantity: '6 servings',
      status: 'completed',
      postedDate: 'Nov 15, 02:55 PM',
      expiryDate: '2d left',
      pickupTime: 'Nov 15, 08:55 PM',
      location: '123 Main St',
      views: 12,
      interestedNGOs: 0,
      pickedUp: true,
      completedAt: 'Nov 15, 09:00 PM',
    },
  ];

  const activeDonations = allDonations.filter(d => d.status !== 'completed');
  const completedDonations = allDonations.filter(d => d.status === 'completed');

  const handleMarkAsPickedUp = (donationId: number) => {
    const updatedDonations = allDonations.map(d => {
      if (d.id === donationId) {
        return { ...d, pickedUp: true };
      }
      return d;
    });
    updateAppState('donations', updatedDonations);

    Toast.show({
      type: 'success',
      text1: 'Marked as Picked Up',
      text2: 'Donation status updated successfully',
    });

    addNotification({
      id: Date.now(),
      type: 'pickup',
      title: 'Donation Picked Up',
      message: 'Your donation has been marked as picked up',
      timestamp: new Date().toISOString(),
      read: false,
      urgent: false,
    });
  };

  const handleTrack = (donation: any) => {
    navigation.navigate('TrackDeliveries', { donationId: donation.id });
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      available: { label: 'active', variant: 'success' as const },
      claimed: { label: 'claimed', variant: 'info' as const },
      completed: { label: 'completed', variant: 'success' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.available;

    return <Badge text={config.label} variant={config.variant} size="sm" />;
  };

  const renderDonationCard = (donation: any) => {
    const isClaimed = donation.status === 'claimed';
    const isCompleted = donation.status === 'completed';
    const showPickedUpButton = isClaimed && !donation.pickedUp;
    const showTrackButton = isClaimed && donation.pickedUp;

    return (
      <Card key={donation.id} style={styles.cardCustom}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.foodTitle}>{donation.foodType}</Text>
          {getStatusBadge(donation.status)}
        </View>

        <Text style={styles.postedDate}>Posted {donation.postedDate}</Text>

        {/* Description */}
        <Text style={styles.description}>{donation.description}</Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="people-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.statText}>{donation.quantity}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="time-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.statText}>{donation.expiryDate}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="eye-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.statText}>{donation.views} views</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="calendar-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.statText}>Pickup: {donation.pickupTime}</Text>
          </View>
        </View>

        {/* Claimed Info */}
        {isClaimed && donation.claimedBy && (
          <View style={styles.claimedSection}>
            <View style={styles.claimedBox}>
              <Text style={styles.claimedLabel}>Claimed by NGO</Text>
              <View style={styles.claimedRow}>
                <Text style={styles.claimedText}>
                  {donation.claimedBy.name} • Claimed {donation.claimedBy.claimedAt}
                </Text>
                <TouchableOpacity onPress={() => handleCall('+1234567890')}>
                  <Icon name="call-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {donation.volunteer && (
              <View style={styles.volunteerBox}>
                <Text style={styles.volunteerLabel}>Volunteer assigned</Text>
                <View style={styles.claimedRow}>
                  <Text style={styles.volunteerText}>
                    {donation.volunteer.name} • ETA: {donation.volunteer.eta}
                  </Text>
                  <TouchableOpacity onPress={() => handleCall('+1234567890')}>
                    <Icon name="call-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        {showPickedUpButton && (
          <View style={styles.buttonRow}>
            <View style={{ flex: 1 }}>
              <Button
                title="Mark as Picked Up"
                onPress={() => handleMarkAsPickedUp(donation.id)}
                variant="primary"
                size="sm"
                fullWidth
                icon={<Icon name="checkmark-circle-outline" size={20} color={colors.white} />}
              />
            </View>
            <TouchableOpacity
              style={styles.trackButtonOutline}
              onPress={() => handleTrack(donation)}
            >
              <Icon name="navigate-outline" size={20} color="#EC4899" />
              <Text style={styles.trackButtonOutlineText}>Track</Text>
            </TouchableOpacity>
          </View>
        )}

        {showTrackButton && (
          <TouchableOpacity
            style={styles.trackButtonFull}
            onPress={() => handleTrack(donation)}
          >
            <Icon name="navigate-outline" size={20} color="#EC4899" />
            <Text style={styles.trackButtonFullText}>Track</Text>
          </TouchableOpacity>
        )}

        {isCompleted && (
          <View style={styles.completedInfo}>
            <Icon name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.completedText}>Completed on {donation.completedAt}</Text>
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Donations</Text>
        <TouchableOpacity
          style={styles.newDonationButton}
          onPress={() => navigation.navigate('PostDonation')}
        >
          <Icon name="add" size={20} color={colors.white} />
          <Text style={styles.newDonationText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active ({activeDonations.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed ({completedDonations.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="always"
        decelerationRate={0.997}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
      >
        {activeTab === 'active'
          ? activeDonations.map(renderDonationCard)
          : completedDonations.map(renderDonationCard)}
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#EC4899',
    borderBottomWidth: 0,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
    flex: 1,
  },
  newDonationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  newDonationText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#EC4899',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.white,
  },
  tabText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  activeTabText: {
    color: colors.white,
    fontFamily: typography.fontFamily.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  cardCustom: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  foodTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    flex: 1,
    marginRight: spacing.sm,
  },

  postedDate: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  claimedSection: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  claimedBox: {
    backgroundColor: '#DBEAFE',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  claimedLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: '#1E40AF',
    marginBottom: spacing.xs,
  },
  claimedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  claimedText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: '#1E40AF',
    flex: 1,
  },
  volunteerBox: {
    backgroundColor: '#FCE7F3',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  volunteerLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: '#9F1239',
    marginBottom: spacing.xs,
  },
  volunteerText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: '#9F1239',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  trackButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: '#EC4899',
    gap: spacing.xs,
  },
  trackButtonOutlineText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: '#EC4899',
  },
  trackButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: '#EC4899',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  trackButtonFullText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: '#EC4899',
  },
  completedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  completedText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: '#065F46',
  },
});

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { colors, typography, spacing, borderRadius } from '../theme';

interface DashboardProps {
  navigation: any;
  user: any;
  appState: any;
}

export const Dashboard: React.FC<DashboardProps> = ({ navigation, user, appState }) => {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isVerified, setIsVerified] = React.useState(user?.verified || user?.verificationStatus === 'approved');

  // Load real notification count with real-time updates
  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupNotificationListener = async () => {
      try {
        const { subscribeToNotificationCount } = require('../services/notificationService');
        unsubscribe = subscribeToNotificationCount((count: number) => {
          setUnreadCount(count);
        });
      } catch (error) {
        // Fallback to direct Firestore query
        try {
          const auth = require('@react-native-firebase/auth').default;
          const firestore = require('@react-native-firebase/firestore').default;
          const currentUser = auth().currentUser;
          if (!currentUser) return;

          unsubscribe = firestore()
            .collection('notifications')
            .where('userId', '==', currentUser.uid)
            .where('read', '==', false)
            .onSnapshot((snapshot: any) => {
              setUnreadCount(snapshot.docs.length);
            });
        } catch (e) {
          // Silent error
        }
      }
    };

    setupNotificationListener();

    // Verification listener
    const setupVerificationListener = () => {
      try {
        const auth = require('@react-native-firebase/auth').default;
        const firestore = require('@react-native-firebase/firestore').default;
        const currentUser = auth().currentUser;
        if (!currentUser) return;

        return firestore()
          .collection('users')
          .doc(currentUser.uid)
          .onSnapshot(
            (doc: any) => {
              if (doc && (typeof doc.exists === 'function' ? doc.exists() : doc.exists)) {
                const data = doc.data();
                setIsVerified(data?.verified || data?.verificationStatus === 'approved');
              }
            },
            (error: any) => {
              // Ignore errors (often happens on signout)
            }
          );
      } catch (e) {
        return undefined;
      }
    };

    const unsubVerification = setupVerificationListener();

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubVerification) unsubVerification();
    };
  }, []);

  const stats = {
    donationsPosted: 12,
    foodRequests: 8,
    deliveriesCompleted: 15,
    impactScore: 85,
  };

  // Get recent activity based on user type
  const getRecentActivity = () => {
    if (user.userType === 'donor') {
      // Show recent donations for donors
      const recentDonations = (appState.donations || [])
        .slice(0, 3)
        .map((donation: any) => ({
          id: donation.id,
          type: 'donation',
          title: `${donation.foodType} - ${donation.quantity}`,
          time: donation.postedDate || 'Recently',
          status: donation.status,
        }));

      return recentDonations.length > 0 ? recentDonations : [
        {
          id: 1,
          type: 'donation',
          title: 'Fresh vegetables donated',
          time: '2 hours ago',
          status: 'completed',
        },
      ];
    }

    // Default activity for other user types
    return [
      {
        id: 1,
        type: 'donation',
        title: 'Fresh vegetables donated',
        time: '2 hours ago',
        status: 'completed',
      },
      {
        id: 2,
        type: 'request',
        title: 'Family meal requested',
        time: '4 hours ago',
        status: 'pending',
      },
      {
        id: 3,
        type: 'delivery',
        title: 'Food delivered to shelter',
        time: '1 day ago',
        status: 'completed',
      },
    ];
  };

  const recentActivity = getRecentActivity();

  // const quickActions = [
  //   {
  //     title: 'Post Food\nDonation',
  //     icon: 'add-circle',
  //     color: colors.success,
  //     screen: 'PostDonation',
  //     userTypes: ['donor'],
  //   },
  //   {
  //     title: 'Request\nFood',
  //     icon: 'search',
  //     color: colors.info,
  //     screen: 'RequestFood',
  //     userTypes: ['receiver'],
  //   },
  //   {
  //     title: 'Track\nDeliveries',
  //     icon: 'location',
  //     color: '#F97316',
  //     screen: 'TrackDeliveries',
  //     userTypes: ['donor', 'ngo', 'volunteer', 'receiver'],
  //   },
  //   {
  //     title: 'Schedule\nPickup',
  //     icon: 'calendar',
  //     color: '#A855F7',
  //     screen: 'Scheduling',
  //     userTypes: ['donor', 'ngo', 'volunteer'],
  //   },
  // ];

  // const filteredQuickActions = quickActions.filter(action =>
  //   action.userTypes.includes(user.userType)
  // );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      bounces={true}
      overScrollMode="always"
      decelerationRate={0.997}
      scrollEventThrottle={16}
      nestedScrollEnabled={true}
    >
      {/* Header with Icon and Notification */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="home" size={28} color={colors.white} style={styles.headerIcon} />
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Icon name="notifications-outline" size={28} color={colors.white} />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Welcome Section */}
      <LinearGradient
        colors={[colors.primary, colors.gradientEnd]}
        style={styles.welcomeCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.welcomeHeader}>
          <Text style={styles.welcomeTitle}>
            Welcome back, {user?.name || 'Friend'}!
          </Text>
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Icon name="shield-checkmark" size={20} color={colors.white} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
        <Text style={styles.welcomeSubtitle}>Ready to make a difference today?</Text>
        <View style={styles.welcomeStats}>
          <View style={styles.welcomeStat}>
            <Icon name="heart" size={20} color={colors.white} />
            <Text style={styles.welcomeStatText}>Impact Score: {stats.impactScore}</Text>
          </View>
          <View style={styles.welcomeStat}>
            <Icon name="trending-up" size={20} color={colors.white} />
            <Text style={styles.welcomeStatText}>Growing!</Text>
          </View>
        </View>
      </LinearGradient>
      
      {user.userType === 'volunteer' && !isVerified && (
        <TouchableOpacity 
          style={styles.verificationBanner}
          onPress={() => navigation.navigate('VolunteerVerification')}
        >
          <View style={styles.verificationBannerContent}>
            <View style={styles.verificationIconContainer}>
              <Icon name="shield-alert" size={24} color={colors.white} />
            </View>
            <View style={styles.verificationBannerText}>
              <Text style={styles.verificationBannerTitle}>Verify Your Volunteer Profile</Text>
              <Text style={styles.verificationBannerSubtitle}>Complete registration to start picking up donations.</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.white} />
          </View>
        </TouchableOpacity>
      )}

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={[styles.statNumber, { color: colors.success }]}>
            {stats.donationsPosted}
          </Text>
          <Text style={styles.statLabel}>Donations Posted</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statNumber, { color: colors.info }]}>
            {stats.foodRequests}
          </Text>
          <Text style={styles.statLabel}>Requests Fulfilled</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#F97316' }]}>
            {stats.deliveriesCompleted}
          </Text>
          <Text style={styles.statLabel}>Deliveries Made</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#A855F7' }]}>47</Text>
          <Text style={styles.statLabel}>Lives Impacted</Text>
        </Card>
      </View>

      {/* Admin Panel (only for Admin users) */}
      {(user?.role === 'admin' || user?.uid === 'oTjSOIKPRMetFbXG1LQ4bzo1rXq1') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Control Panel</Text>
          <View style={styles.adminGrid}>
            <Card
              style={styles.adminActionCard}
              onPress={() => navigation.navigate('AdminNGOVerifications')}
            >
              <View style={[styles.adminActionIcon, { backgroundColor: colors.primary }]}>
                <Icon name="business" size={24} color={colors.white} />
              </View>
              <Text style={styles.adminActionTitle}>NGOs</Text>
            </Card>
            <Card
              style={styles.adminActionCard}
              onPress={() => navigation.navigate('AdminDonorVerifications')}
            >
              <View style={[styles.adminActionIcon, { backgroundColor: colors.success }]}>
                <Icon name="person" size={24} color={colors.white} />
              </View>
              <Text style={styles.adminActionTitle}>Donors</Text>
            </Card>
            <Card
              style={styles.adminActionCard}
              onPress={() => navigation.navigate('AdminVolunteerVerifications')}
            >
              <View style={[styles.adminActionIcon, { backgroundColor: colors.warning }]}>
                <Icon name="car" size={24} color={colors.white} />
              </View>
              <Text style={styles.adminActionTitle}>Volunteers</Text>
            </Card>
            <Card
              style={styles.adminActionCard}
              onPress={() => navigation.navigate('AdminUserManagement')}
            >
              <View style={[styles.adminActionIcon, { backgroundColor: colors.info }]}>
                <Icon name="people" size={24} color={colors.white} />
              </View>
              <Text style={styles.adminActionTitle}>Users</Text>
            </Card>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      {/* <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {filteredQuickActions.map((action, index) => (
            <Card
              key={index}
              style={styles.actionCard}
              onPress={() => navigation.navigate(action.screen)}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                <Icon name={action.icon} size={24} color={colors.white} />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
            </Card>
          ))}
        </View>
      </View> */}

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentActivity.map((activity: any) => (
          <Card key={activity.id} style={styles.activityCard}>
            <View style={styles.activityContent}>
              <View style={styles.activityLeft}>
                <Icon
                  name={
                    activity.status === 'completed'
                      ? 'checkmark-circle'
                      : 'time'
                  }
                  size={20}
                  color={
                    activity.status === 'completed'
                      ? colors.success
                      : colors.warning
                  }
                />
                <View style={styles.activityText}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>
              </View>
              <Badge
                text={activity.status}
                variant={activity.status === 'completed' ? 'success' : 'warning'}
                size="sm"
              />
            </View>
          </Card>
        ))}
      </View>

      {/* Community Impact */}
      <Card style={styles.section}>
        <View style={styles.impactHeader}>
          <Icon name="people" size={20} color={colors.foreground} />
          <Text style={styles.impactTitle}>Community Impact</Text>
        </View>
        <View style={styles.impactStats}>
          <View style={styles.impactStat}>
            <Text style={styles.impactLabel}>Meals Shared This Week</Text>
            <Text style={styles.impactValue}>234</Text>
          </View>
          <View style={styles.impactStat}>
            <Text style={styles.impactLabel}>Active Volunteers</Text>
            <Text style={styles.impactValue}>67</Text>
          </View>
          <View style={styles.impactStat}>
            <Text style={styles.impactLabel}>Food Waste Prevented</Text>
            <Text style={styles.impactValue}>1.2 tons</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl * 2,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.primary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notificationButton: {
    position: 'relative',
    padding: spacing.xs,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
  },
  welcomeCard: {
    borderRadius: borderRadius.base,
    padding: spacing.lg,
    marginBottom: spacing.base,
    marginHorizontal: spacing.base,
    marginTop: spacing.lg,
  },
  welcomeTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
    flex: 1,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  verifiedText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    marginLeft: 4,
  },
  welcomeSubtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.white,
    opacity: 0.9,
  },
  welcomeStats: {
    flexDirection: 'row',
    marginTop: spacing.base,
  },
  welcomeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.base,
  },
  welcomeStatText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.white,
    marginLeft: spacing.xs,
  },
  verificationBanner: {
    backgroundColor: '#F59E0B',
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  verificationBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  verificationBannerText: {
    flex: 1,
  },
  verificationBannerTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  verificationBannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    marginHorizontal: spacing.xs,
    marginBottom: spacing.base,
  },
  statCard: {
    width: '33%',
    margin: spacing.xs,
    alignItems: 'center',
    paddingVertical: spacing.base,
  },
  statNumber: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.base,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.base,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    marginHorizontal: -spacing.xs,
  },
  actionCard: {
    width: '34%',
    margin: spacing.xs,
    alignItems: 'center',
    paddingVertical: spacing.base,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal * typography.fontSize.sm,
  },
  activityCard: {
    marginBottom: spacing.md,
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activityText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  activityTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  activityTime: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  impactTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginLeft: spacing.sm,
  },
  impactStats: {
    gap: spacing.md,
  },
  impactStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
  },
  impactValue: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.base,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  testButtonText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  adminGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  adminActionCard: {
    width: '48%',
    marginBottom: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  adminActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  adminActionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
});

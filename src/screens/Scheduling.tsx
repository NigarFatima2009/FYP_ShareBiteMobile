import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { colors, typography, spacing, borderRadius } from '../theme';

interface SchedulingProps {
  navigation: any;
}

export const Scheduling: React.FC<SchedulingProps> = ({
  navigation,
}) => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [availablePickups, setAvailablePickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'mySchedule'>('available');

  useEffect(() => {
    let unsubscribePickups: (() => void) | undefined;
    let unsubscribeSchedules: (() => void) | undefined;

    const setupListeners = async () => {
      setLoading(true);
      const currentUser = auth().currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Real-time listener for food requests (available pickups)
      unsubscribePickups = firestore()
        .collection('foodRequests')
        .onSnapshot(
          async (snapshot) => {
            await processAvailablePickups(snapshot);
          },
          (error) => {
            console.log('Pickups listener error:', error);
          }
        );

      // Real-time listener for schedules
      unsubscribeSchedules = firestore()
        .collection('schedules')
        .where('volunteerId', '==', currentUser.uid)
        .onSnapshot(
          (snapshot) => {
            const schedulesList = snapshot.docs
              .map((doc) => {
                const data = doc.data();
                const scheduledDate = new Date(data.scheduledDate);
                return {
                  id: doc.id,
                  title: data.title || `${data.type} - ${data.foodType}`,
                  date: scheduledDate.toLocaleDateString(),
                  time: scheduledDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  location: data.location,
                  status: data.status || 'upcoming',
                  scheduledDate: data.scheduledDate,
                  volunteerId: data.volunteerId,
                  donationId: data.donationId,
                  ...data,
                };
              })
              .filter(
                (s: any) =>
                  s.status !== 'completed' &&
                  s.status !== 'delivered' &&
                  s.status !== 'cancelled'
              );

            schedulesList.sort((a: any, b: any) => {
              const dateA = new Date(a.scheduledDate || 0);
              const dateB = new Date(b.scheduledDate || 0);
              return dateB.getTime() - dateA.getTime();
            });

            setSchedules(schedulesList);
            setLoading(false);
          },
          (error) => {
            console.log('Schedules listener error:', error);
            setLoading(false);
          }
        );
    };

    setupListeners();

    return () => {
      if (unsubscribePickups) unsubscribePickups();
      if (unsubscribeSchedules) unsubscribeSchedules();
    };
  }, []);

  const processAvailablePickups = async (snapshot: any) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const validRequests = snapshot.docs.filter((doc: any) => {
        const data = doc.data();
        const status = data.status;
        return (status === 'pending' || status === 'approved') && !data.volunteerId;
      });

      const pickupsList: any[] = [];

      for (const requestDoc of validRequests) {
        const request = requestDoc.data();

        if (request.donationId) {
          try {
            const donationDoc = await firestore()
              .collection('donations')
              .doc(request.donationId)
              .get();

            const donationDocExists = (donationDoc as any).exists;
            if (donationDocExists) {
              const donation = donationDoc.data();

              if (!donation?.volunteerId) {
                let donorName = 'Donor';
                let donorPhone = '';

                if (donation?.donorId) {
                  try {
                    const donorDoc = await firestore()
                      .collection('users')
                      .doc(donation.donorId)
                      .get();
                    const donorDocExists = (donorDoc as any).exists;
                    if (donorDocExists) {
                      const donorData = donorDoc.data();
                      donorName = donorData?.name || donorData?.displayName || donorName;
                      donorPhone = donorData?.phone || donorData?.phoneNumber || donorPhone;
                    }
                  } catch (e) {
                    console.log('Error fetching donor:', e);
                  }
                }

                let ngoName = request.ngoName || 'NGO';
                if (request.ngoId) {
                  try {
                    const ngoDoc = await firestore()
                      .collection('users')
                      .doc(request.ngoId)
                      .get();
                    const ngoDocExists = (ngoDoc as any).exists;
                    if (ngoDocExists) {
                      const ngoData = ngoDoc.data();
                      ngoName = ngoData?.organizationName || ngoData?.name || ngoName;
                    }
                  } catch (e) {
                    console.log('Error fetching NGO:', e);
                  }
                }

                pickupsList.push({
                  id: requestDoc.id,
                  requestId: requestDoc.id,
                  donationId: request.donationId,
                  title: donation?.title || request.title || 'Food Pickup',
                  description: donation?.description || '',
                  quantity: donation?.quantity || request.quantity || '',
                  pickupAddress: donation?.pickupAddress || '',
                  coordinates: donation?.coordinates,
                  donorId: donation?.donorId,
                  donorName,
                  donorPhone,
                  ngoName,
                  ngoId: request.ngoId,
                  requestStatus: request.status,
                  urgency: donation?.urgency || 'medium',
                  expiryTime: donation?.expiryTime || donation?.bestBefore,
                  createdAt: request.createdAt,
                  approvedAt: request.approvedAt,
                });
              }
            }
          } catch (e) {
            console.log('Error fetching donation:', e);
          }
        }
      }

      pickupsList.sort((a, b) => {
        const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const urgencyDiff = (urgencyOrder[a.urgency] || 1) - (urgencyOrder[b.urgency] || 1);
        if (urgencyDiff !== 0) return urgencyDiff;

        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

      setAvailablePickups(pickupsList);
    } catch (error) {
      console.error('Error processing pickups:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      // Data updates via real-time listeners
    }, [])
  );

  const handleAcceptPickup = async (pickup: any) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Toast.show({
          type: 'error',
          text1: 'Not Logged In',
          text2: 'Please log in to accept pickups',
        });
        return;
      }

      if (!pickup || !pickup.donationId) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Pickup',
          text2: 'Pickup data is missing or invalid',
        });
        return;
      }

      // Check if donation still exists
      const donationDoc = await firestore()
        .collection('donations')
        .doc(pickup.donationId)
        .get();

      if (!(donationDoc as any).exists) {
        Toast.show({
          type: 'error',
          text1: 'Donation Not Found',
          text2: 'This donation may have been removed',
        });
        setAvailablePickups((prev) =>
          prev.filter((p) => p.donationId !== pickup.donationId)
        );
        return;
      }

      // Check if request still exists
      if (pickup.requestId) {
        const requestDoc = await firestore()
          .collection('foodRequests')
          .doc(pickup.requestId)
          .get();

        if (!(requestDoc as any).exists) {
          Toast.show({
            type: 'error',
            text1: 'Request Not Found',
            text2: 'This request may have been cancelled',
          });
          setAvailablePickups((prev) =>
            prev.filter((p) => p.requestId !== pickup.requestId)
          );
          return;
        }
      }

      let volunteerName =
        currentUser.displayName || currentUser.email?.split('@')[0] || 'Volunteer';
      try {
        const userDoc = await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .get();
        const userDocExists = (userDoc as any).exists;
        if (userDocExists) {
          const userData = userDoc.data();
          volunteerName = userData?.name || userData?.displayName || volunteerName;
        }
      } catch (e) {
        console.log('Error fetching user:', e);
      }

      // Update donation
      await firestore().collection('donations').doc(pickup.donationId).update({
        status: 'claimed',
        volunteerId: currentUser.uid,
        volunteerName,
        volunteerEmail: currentUser.email,
        claimedAt: firestore.FieldValue.serverTimestamp(),
      });

      // Update food request
      if (pickup.requestId) {
        try {
          await firestore().collection('foodRequests').doc(pickup.requestId).update({
            status: 'volunteer_assigned',
            volunteerId: currentUser.uid,
            volunteerName,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
        } catch (e) {
          console.log('Request update error:', e);
        }
      }

      // Create delivery tracking
      await firestore()
        .collection('deliveryTracking')
        .doc(pickup.donationId)
        .set(
          {
            donationId: pickup.donationId,
            donorId: pickup.donorId || '',
            donorName: pickup.donorName || 'Donor',
            ngoId: pickup.ngoId || '',
            ngoName: pickup.ngoName || 'NGO',
            volunteerId: currentUser.uid,
            volunteerName,
            volunteerEmail: currentUser.email,
            pickupLocation: pickup.coordinates || { latitude: 33.5651, longitude: 73.0169 },
            pickupAddress: pickup.pickupAddress || 'Pickup location',
            status: 'volunteer_assigned',
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      // Create schedule entry
      await firestore().collection('schedules').add({
        volunteerId: currentUser.uid,
        donationId: pickup.donationId,
        requestId: pickup.requestId || '',
        title: pickup.title || 'Food Pickup',
        type: 'pickup',
        foodType: pickup.title || 'Food',
        location: pickup.pickupAddress || 'Pickup location',
        donorName: pickup.donorName || 'Donor',
        ngoName: pickup.ngoName || 'NGO',
        status: 'upcoming',
        scheduledDate: new Date().toISOString(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Send notifications
      if (pickup.ngoId) {
        await firestore().collection('notifications').add({
          userId: pickup.ngoId,
          title: 'Volunteer Assigned!',
          message: `${volunteerName} has accepted the pickup for "${pickup.title}"`,
          type: 'volunteer_assigned',
          donationId: pickup.donationId,
          read: false,
          timestamp: new Date().toISOString(),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      if (pickup.donorId) {
        await firestore().collection('notifications').add({
          userId: pickup.donorId,
          title: 'Pickup Scheduled!',
          message: `A volunteer will pick up your donation "${pickup.title}" soon`,
          type: 'pickup_scheduled',
          donationId: pickup.donationId,
          read: false,
          timestamp: new Date().toISOString(),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      Toast.show({
        type: 'success',
        text1: 'Pickup Accepted!',
        text2: `You've accepted the pickup for "${pickup.title}"`,
      });

      setActiveTab('mySchedule');
    } catch (error: any) {
      console.log('Accept pickup error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to accept pickup',
      });
    }
  };

  const handleDeleteSchedule = async (schedule: any) => {
    Alert.alert('Delete Schedule', 'Are you sure you want to delete this schedule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await firestore().collection('schedules').doc(schedule.id).delete();
            Toast.show({
              type: 'success',
              text1: 'Deleted',
              text2: 'Schedule removed successfully',
            });
          } catch (error) {
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Failed to delete schedule',
            });
          }
        },
      },
    ]);
  };

  const handleStartDelivery = async (schedule: any) => {
    try {
      // Update schedule status to in_progress
      await firestore().collection('schedules').doc(schedule.id).update({
        status: 'in_progress',
        startedAt: firestore.FieldValue.serverTimestamp(),
      });

      // Navigate to volunteer routes
      navigation.navigate('VolunteerRoutes', { pickupId: schedule.donationId });
    } catch (error) {
      console.log('Error starting delivery:', error);
      // Still navigate even if update fails
      navigation.navigate('VolunteerRoutes', { pickupId: schedule.donationId });
    }
  };

  const renderSchedule = (item: any) => (
    <Card key={item.id} style={styles.scheduleCard}>
      <View style={styles.scheduleHeader}>
        <View style={styles.iconContainer}>
          <Icon name="calendar" size={24} color={colors.primary} />
        </View>
        <View style={styles.scheduleInfo}>
          <Text style={styles.scheduleTitle}>{item.title}</Text>
          <Text style={styles.scheduleLocation}>{item.location}</Text>
        </View>
        <Badge
          text={item.status}
          variant={item.status === 'completed' ? 'success' : 'warning'}
        />
      </View>

      <View style={styles.scheduleDetails}>
        <View style={styles.detailRow}>
          <Icon name="calendar-outline" size={16} color={colors.mutedForeground} />
          <Text style={styles.detailText}>{item.date}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="time-outline" size={16} color={colors.mutedForeground} />
          <Text style={styles.detailText}>{item.time}</Text>
        </View>
        {item.donorName && (
          <View style={styles.detailRow}>
            <Icon name="person-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.detailText}>Donor: {item.donorName}</Text>
          </View>
        )}
      </View>

      {item.status === 'upcoming' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.startDeliveryButton}
            onPress={() => handleStartDelivery(item)}
          >
            <Icon name="car-outline" size={18} color={colors.white} />
            <Text style={styles.startDeliveryText}>Start Delivery</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteSchedule(item)}
          >
            <Icon name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );

  const renderAvailablePickup = (pickup: any) => (
    <Card
      key={pickup.id}
      style={[styles.pickupCard, pickup.urgency === 'high' && styles.urgentCard]}
    >
      <View style={styles.pickupHeader}>
        <View style={styles.pickupInfo}>
          <Text style={styles.pickupTitle}>{pickup.title}</Text>
          <Text style={styles.pickupQuantity}>{pickup.quantity}</Text>
        </View>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  pickup.requestStatus === 'approved' ? colors.primary : '#F59E0B',
              },
            ]}
          >
            <Text style={styles.statusText}>
              {pickup.requestStatus === 'approved' ? 'APPROVED' : 'PENDING'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.pickupDetails}>
        <View style={styles.detailRow}>
          <Icon name="person-outline" size={16} color={colors.mutedForeground} />
          <Text style={styles.detailText}>Donor: {pickup.donorName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="business-outline" size={16} color={colors.mutedForeground} />
          <Text style={styles.detailText}>NGO: {pickup.ngoName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="location-outline" size={16} color={colors.mutedForeground} />
          <Text style={styles.detailText} numberOfLines={1}>
            {pickup.pickupAddress || 'Address not specified'}
          </Text>
        </View>
      </View>

      <View style={styles.pickupActions}>
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => {
            if (pickup.donorPhone) {
              Linking.openURL(`tel:${pickup.donorPhone}`);
            } else {
              Toast.show({
                type: 'info',
                text1: 'No Phone Number',
                text2: 'Donor phone not available',
              });
            }
          }}
        >
          <Icon name="call-outline" size={18} color={colors.primary} />
          <Text style={styles.callButtonText}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.acceptButton,
            pickup.requestStatus !== 'approved' && styles.acceptButtonDisabled,
          ]}
          onPress={() => {
            if (pickup.requestStatus === 'approved') {
              handleAcceptPickup(pickup);
            } else {
              Toast.show({
                type: 'info',
                text1: 'Waiting for Donor Approval',
                text2: 'This request is still pending',
              });
            }
          }}
        >
          <Icon name="checkmark-circle-outline" size={18} color={colors.white} />
          <Text style={styles.acceptButtonText}>
            {pickup.requestStatus === 'approved' ? 'Accept Pickup' : 'Pending'}
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Volunteer Schedule</Text>
          <Text style={styles.subtitle}>Accept pickups and manage deliveries</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Volunteer Schedule</Text>
        <Text style={styles.subtitle}>Accept pickups and manage deliveries</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'available' && styles.tabButtonActive]}
          onPress={() => setActiveTab('available')}
        >
          <Icon
            name="cube-outline"
            size={18}
            color={activeTab === 'available' ? colors.white : colors.primary}
          />
          <Text
            style={[styles.tabText, activeTab === 'available' && styles.tabTextActive]}
          >
            Available ({availablePickups.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'mySchedule' && styles.tabButtonActive]}
          onPress={() => setActiveTab('mySchedule')}
        >
          <Icon
            name="calendar-outline"
            size={18}
            color={activeTab === 'mySchedule' ? colors.white : colors.primary}
          />
          <Text
            style={[styles.tabText, activeTab === 'mySchedule' && styles.tabTextActive]}
          >
            My Schedule ({schedules.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'available' && (
        <>
          <Text style={styles.sectionTitle}>NGO-Approved Requests</Text>
          {availablePickups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="cube-outline" size={64} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No pickups available</Text>
            </View>
          ) : (
            availablePickups.map(renderAvailablePickup)
          )}
        </>
      )}

      {activeTab === 'mySchedule' && (
        <>
          <Text style={styles.sectionTitle}>Your Scheduled Deliveries</Text>
          {schedules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="calendar-outline" size={64} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No scheduled events</Text>
            </View>
          ) : (
            schedules.map(renderSchedule)
          )}
        </>
      )}
    </ScrollView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.base,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
  },
  tabTextActive: {
    color: colors.white,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  scheduleCard: {
    marginBottom: spacing.md,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  scheduleLocation: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  scheduleDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  startDeliveryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    gap: spacing.xs,
  },
  startDeliveryText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupCard: {
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  urgentCard: {
    borderLeftColor: '#EF4444',
  },
  pickupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  pickupInfo: {
    flex: 1,
  },
  pickupTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  pickupQuantity: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
  pickupDetails: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  pickupActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  callButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    gap: spacing.xs,
  },
  acceptButtonDisabled: {
    backgroundColor: colors.mutedForeground,
  },
  acceptButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
    marginTop: spacing['3xl'],
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginTop: spacing.base,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { colors, typography, spacing, borderRadius } from '../theme';

interface NotificationsProps {
  navigation: any;
  appState: any;
  updateAppState: (key: string, value: any) => void;
}

export const Notifications: React.FC<NotificationsProps> = ({
  navigation,
  appState,
  updateAppState,
}) => {
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const currentUser = auth().currentUser;
        if (!currentUser) {
          setLoading(false);
          return;
        }

        // Real-time listener for notifications
        unsubscribe = firestore()
          .collection('notifications')
          .where('userId', '==', currentUser.uid)
          .onSnapshot(
            (snapshot) => {
              const notificationsList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }));

              // Sort in memory by date
              notificationsList.sort((a: any, b: any) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || a.timestamp || 0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || b.timestamp || 0);
                return dateB.getTime() - dateA.getTime();
              });

              setNotifications(notificationsList);
              setLoading(false);
            },
            () => {
              setNotifications([]);
              setLoading(false);
            }
          );
      } catch (error) {
        setNotifications([]);
        setLoading(false);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Refresh notifications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Real-time listener handles updates automatically
    }, [])
  );

  const loadNotifications = async () => {
    // This is now handled by the real-time listener
    // Keeping for backward compatibility
  };

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'donation':
        return { name: 'heart', color: colors.primary };
      case 'pickup':
        return { name: 'time', color: '#F97316' };
      case 'delivery':
        return { name: 'location', color: '#3B82F6' };
      case 'request':
        return { name: 'chatbubble', color: '#A855F7' };
      case 'community':
        return { name: 'notifications', color: '#6B7280' };
      default:
        return { name: 'notifications', color: '#6B7280' };
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await firestore()
        .collection('notifications')
        .doc(id)
        .update({ read: true });
    } catch (error) {
      // Silent error
    }
  };

  const handleOpenChat = async (notification: any) => {
    const parentNav = navigation.getParent() || navigation;
    const currentUser = auth().currentUser;

    // Try to get contact info from notification - prioritize message sender info
    let contactId = notification.senderId || notification.fromUserId || notification.requesterId || notification.donorId;
    let contactName = notification.senderName || notification.fromUserName || notification.requesterName || notification.donorName;

    // For message notifications, the sender is who we want to chat with
    if (notification.type === 'message') {
      contactId = notification.senderId || notification.fromUserId;
      contactName = notification.senderName || notification.fromUserName;
    }

    // If we have donationId but no contact, fetch from donation
    if (!contactId && notification.donationId) {
      try {
        const donationDoc = await firestore()
          .collection('donations')
          .doc(notification.donationId)
          .get();

        if (donationDoc.exists()) {
          const donationData = donationDoc.data();
          contactId = donationData?.donorId;
          contactName = donationData?.donorName || donationData?.donorEmail?.split('@')[0] || 'Donor';
        }
      } catch (error) {
        // Silent error
      }
    }

    // If still no contact and we have a conversationId, extract from it
    if (!contactId && notification.conversationId && currentUser) {
      const participants = notification.conversationId.split('_');
      contactId = participants.find((id: string) => id !== currentUser.uid);

      // Fetch contact name from users collection
      if (contactId && !contactName) {
        try {
          const userDoc = await firestore().collection('users').doc(contactId).get();
          if (userDoc.exists()) {
            const userData = userDoc.data();
            contactName = userData?.name || userData?.displayName || userData?.email?.split('@')[0] || 'User';
          }
        } catch (error) {
          // Silent error
        }
      }
    }

    if (contactId) {
      // Mark notification as read before navigating
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      parentNav.navigate('ChatScreen', {
        contactId,
        contactName: contactName || 'User',
        contactImage: null,
      });
    } else {
      Toast.show({
        type: 'info',
        text1: 'Cannot open chat',
        text2: 'Contact information not available',
      });
    }
  };

  // AI-based detection if notification is a chat message
  // Uses strict pattern matching to avoid false positives
  const isMessageNotification = (notification: any): boolean => {
    // STRICT: Only these types are definitely messages
    if (notification.type === 'message' || notification.type === 'chat' || notification.type === 'direct_message') {
      return true;
    }

    // STRICT: Must have conversationId AND be explicitly a message type
    if (notification.conversationId && notification.type === 'message') {
      return true;
    }

    // EXCLUDE: These are definitely NOT messages - never open chat for these
    const definitelyNotMessageTypes = [
      'food_request', 'request_approved', 'request_rejected',
      'donation_posted', 'delivery_started', 'delivery_complete',
      'volunteer_assigned', 'pickup_scheduled', 'donation', 'pickup',
      'delivery', 'request', 'request_sent', 'community', 'system',
      'urgent', 'reminder', 'alert', 'notification'
    ];

    if (definitelyNotMessageTypes.includes(notification.type)) {
      return false;
    }

    // AI Pattern matching - ONLY if type is explicitly 'message' or undefined
    if (notification.type && notification.type !== 'message') {
      return false; // If type is set and not 'message', it's not a message
    }

    // Check content for explicit message indicators
    const content = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();

    // Must contain explicit message keywords
    const explicitMessageKeywords = [
      'sent you a message',
      'new message from',
      'direct message',
      'chat message',
      'messaged you',
    ];

    const hasExplicitMessageKeyword = explicitMessageKeywords.some(keyword =>
      content.includes(keyword)
    );

    // Must have sender info AND explicit message keyword
    const hasSenderInfo = notification.senderId || notification.fromUserId;

    return hasExplicitMessageKeyword && hasSenderInfo;
  };

  const handleNotificationPress = async (notification: any) => {
    // Mark as read first
    await markAsRead(notification.id);

    // Only open chat for actual message notifications (AI detection)
    if (isMessageNotification(notification)) {
      await handleOpenChat(notification);
      return;
    }

    // For food request notifications, navigate to appropriate screen
    if (notification.type === 'food_request' || notification.type === 'request_approved' || notification.type === 'request_rejected') {
      // Navigate to My Donations for donors to see requests
      const parentNav = navigation.getParent();
      if (parentNav) {
        parentNav.navigate('Tabs', { screen: 'MyDonations' });
      } else {
        navigation.navigate('MyDonations');
      }
      return;
    }

    // For delivery notifications, navigate to track deliveries
    if (notification.type === 'delivery_started' || notification.type === 'delivery_complete' ||
      notification.type === 'volunteer_assigned' || notification.type === 'pickup_scheduled') {
      if (notification.donationId) {
        navigation.navigate('TrackDeliveries', { donationId: notification.donationId });
      }
      return;
    }

    // For donation posted notifications, navigate to NGO requests
    if (notification.type === 'donation_posted') {
      const parentNav = navigation.getParent();
      if (parentNav) {
        parentNav.navigate('Tabs', { screen: 'NGORequests' });
      } else {
        navigation.navigate('NGORequests');
      }
      return;
    }

    // Default: just mark as read, don't navigate anywhere
  };

  const markAllAsRead = async () => {
    try {
      const batch = firestore().batch();
      notifications.forEach(notif => {
        if (!notif.read) {
          batch.update(firestore().collection('notifications').doc(notif.id), { read: true });
        }
      });
      await batch.commit();
      navigation.goBack();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await firestore()
        .collection('notifications')
        .doc(id)
        .delete();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const filteredNotifications = notifications.filter((notif: any) => {
    if (filter === 'unread') return !notif.read;
    if (filter === 'urgent') return notif.urgent;
    return true;
  });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Icon name="arrow-back" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.settingsButton}>
          <Icon name="settings-outline" size={24} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, filter === 'unread' && styles.filterButtonActive]}
            onPress={() => setFilter('unread')}
          >
            <Text style={[styles.filterButtonText, filter === 'unread' && styles.filterButtonTextActive]}>
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, filter === 'urgent' && styles.filterButtonActive]}
            onPress={() => setFilter('urgent')}
          >
            <Text style={[styles.filterButtonText, filter === 'urgent' && styles.filterButtonTextActive]}>
              Urgent
            </Text>
          </TouchableOpacity>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="always"
        decelerationRate={0.997}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Icon name="notifications-off-outline" size={80} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'unread' ? "You're all caught up!" : 'Check back later for updates.'}
            </Text>
          </View>
        ) : (
          filteredNotifications.map((notification: any) => {
            const iconData = getNotificationIcon(notification.type);
            return (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read && styles.notificationCardUnread,
                ]}
                onPress={() => handleNotificationPress(notification)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationContent}>
                  {/* Icon */}
                  <View style={[styles.iconContainer, { backgroundColor: `${iconData.color}15` }]}>
                    <Icon name={iconData.name} size={24} color={iconData.color} />
                  </View>

                  {/* Content */}
                  <View style={styles.notificationTextContainer}>
                    <View style={styles.notificationTitleRow}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      {notification.urgent && (
                        <View style={styles.urgentBadge}>
                          <Text style={styles.urgentBadgeText}>Urgent</Text>
                        </View>
                      )}
                      {!notification.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notificationMessage}>{notification.message}</Text>
                    <Text style={styles.notificationTime}>{formatTime(notification.timestamp)}</Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.notificationActions}>
                    {/* Chat button - show for message notifications and donation-related notifications */}
                    {(notification.type === 'message' || notification.type === 'donation_posted' || notification.type === 'request' || notification.donationId || notification.senderId || notification.fromUserId || notification.conversationId) && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleOpenChat(notification);
                        }}
                        style={styles.chatActionButton}
                      >
                        <Icon name="chatbubble" size={18} color={colors.white} />
                      </TouchableOpacity>
                    )}
                    {!notification.read && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        style={styles.actionButton}
                      >
                        <Icon name="checkmark-circle-outline" size={22} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      style={styles.actionButton}
                    >
                      <Icon name="close" size={22} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Notification Settings */}
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingsButton2} onPress={() => navigation.navigate('Profile')}>
            <Icon name="settings-outline" size={20} color={colors.mutedForeground} />
            <Text style={styles.settingsButtonText}>Notification Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.semibold,
    color: '#6B7280',
    marginRight: spacing.sm,
  },
  headerBadge: {
    backgroundColor: '#EC4899',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  headerBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
  },
  settingsButton: {
    padding: spacing.xs,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: '#EC4899',
    borderColor: '#EC4899',
  },
  filterButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  markAllText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'] * 2,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginTop: spacing.base,
  },
  emptyIconContainer: {
    marginBottom: spacing.base,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.semibold,
    color: '#6B7280',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  notificationCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  notificationCardUnread: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  notificationContent: {
    flexDirection: 'row',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  notificationTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: '#1F2937',
    flex: 1,
  },
  urgentBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  urgentBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginLeft: spacing.xs,
  },
  notificationMessage: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: '#6B7280',
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: '#9CA3AF',
  },
  notificationActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: spacing.sm,
  },
  actionButton: {
    padding: spacing.xs,
  },
  chatActionButton: {
    backgroundColor: colors.primary,
    padding: spacing.xs,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  settingsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginTop: spacing.base,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingsButton2: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingsButtonText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: '#6B7280',
    marginLeft: spacing.sm,
  },
});

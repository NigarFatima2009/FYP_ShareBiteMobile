import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { colors, typography, spacing, borderRadius } from '../theme';

interface RequestHistoryProps {
  navigation: any;
  route: any;
}

export const RequestHistory: React.FC<RequestHistoryProps> = ({
  navigation,
  route,
}) => {
  const { userType = 'ngo' } = route.params || {};
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const currentUser = auth().currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Get completed/delivered requests
      const requestsSnapshot = await firestore()
        .collection('foodRequests')
        .get();

      let historyList = requestsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((r: any) => {
          // Filter by user type
          if (userType === 'ngo') {
            return (r.ngoId === currentUser.uid || r.requesterId === currentUser.uid) &&
              (r.status === 'delivered' || r.status === 'cancelled' || r.status === 'rejected');
          } else if (userType === 'donor') {
            return r.donorId === currentUser.uid &&
              (r.status === 'delivered' || r.status === 'cancelled' || r.status === 'rejected');
          } else if (userType === 'volunteer') {
            return r.volunteerId === currentUser.uid &&
              (r.status === 'delivered' || r.status === 'cancelled');
          }
          return false;
        });

      // Sort by date (newest first)
      historyList.sort((a: any, b: any) => {
        const dateA = a.deliveredAt?.toDate?.() || a.updatedAt?.toDate?.() || new Date(a.deliveredAt || a.updatedAt || 0);
        const dateB = b.deliveredAt?.toDate?.() || b.updatedAt?.toDate?.() || new Date(b.deliveredAt || b.updatedAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

      // Fetch donation details for each request
      const historyWithDetails = await Promise.all(
        historyList.map(async (request: any) => {
          if (request.donationId) {
            try {
              const donationDoc = await firestore()
                .collection('donations')
                .doc(request.donationId)
                .get();
              if (donationDoc.exists()) {
                return {
                  ...request,
                  donation: { id: donationDoc.id, ...donationDoc.data() },
                };
              }
            } catch (e) { }
          }
          return request;
        })
      );

      setHistory(historyWithDetails);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.log('Load history error:', error);
      setHistory([]);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A';
    try {
      if (dateValue?.toDate) {
        return dateValue.toDate().toLocaleDateString();
      }
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return { name: 'checkmark-circle', color: colors.primary };
      case 'cancelled':
        return { name: 'close-circle', color: '#EF4444' };
      case 'rejected':
        return { name: 'remove-circle', color: '#F59E0B' };
      default:
        return { name: 'help-circle', color: colors.mutedForeground };
    }
  };

  const renderHistoryItem = ({ item }: { item: any }) => {
    const statusIcon = getStatusIcon(item.status);
    const donation = item.donation || {};

    return (
      <Card style={styles.historyCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${statusIcon.color}20` }]}>
            <Icon name={statusIcon.name} size={24} color={statusIcon.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.title}>{item.title || donation.title || 'Food Request'}</Text>
            <Text style={styles.subtitle}>
              {item.status === 'delivered' ? 'Completed' : item.status === 'cancelled' ? 'Cancelled' : 'Rejected'}
            </Text>
          </View>
          <Badge
            text={item.status}
            variant={item.status === 'delivered' ? 'success' : 'destructive'}
          />
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Icon name="cube-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.detailText}>Quantity: {item.quantity || donation.quantity || 'N/A'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Icon name="location-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.pickupAddress || donation.pickupAddress || 'N/A'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Icon name="calendar-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.detailText}>
              {item.status === 'delivered' ? 'Delivered: ' : 'Updated: '}
              {formatDate(item.deliveredAt || item.updatedAt)}
            </Text>
          </View>

          {userType === 'ngo' && donation.donorName && (
            <View style={styles.detailRow}>
              <Icon name="person-outline" size={16} color={colors.mutedForeground} />
              <Text style={styles.detailText}>Donor: {donation.donorName}</Text>
            </View>
          )}

          {userType === 'donor' && item.requesterName && (
            <View style={styles.detailRow}>
              <Icon name="business-outline" size={16} color={colors.mutedForeground} />
              <Text style={styles.detailText}>Requester: {item.requesterName}</Text>
            </View>
          )}

          {item.volunteerName && (
            <View style={styles.detailRow}>
              <Icon name="car-outline" size={16} color={colors.mutedForeground} />
              <Text style={styles.detailText}>Volunteer: {item.volunteerName}</Text>
            </View>
          )}
        </View>

        {item.status === 'delivered' && (
          <View style={styles.successBanner}>
            <Icon name="heart" size={16} color={colors.primary} />
            <Text style={styles.successText}>Thank you for helping reduce food waste!</Text>
          </View>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request History</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request History</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderHistoryItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="time-outline" size={64} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No history yet</Text>
            <Text style={styles.emptySubtext}>
              Completed requests will appear here
            </Text>
          </View>
        }
        ListHeaderComponent={
          history.length > 0 ? (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {history.filter(h => h.status === 'delivered').length}
                </Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {history.filter(h => h.status === 'cancelled' || h.status === 'rejected').length}
                </Text>
                <Text style={styles.statLabel}>Cancelled</Text>
              </View>
            </View>
          ) : null
        }
      />
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
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  historyCard: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardInfo: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  detailsContainer: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}20`,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  successText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
    flex: 1,
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
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default RequestHistory;

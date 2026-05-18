import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { colors, typography, spacing, borderRadius } from '../theme';

// Local Score Circle Component
const MatchScoreCircle = ({ score, size = 36 }: { score: number, size?: number }) => {
  const getScoreColor = () => {
    if (score >= 80) return '#10B981'; // colors.success
    if (score >= 50) return '#F59E0B'; // colors.warning
    return '#EF4444'; // colors.destructive
  };

  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2,
      borderColor: getScoreColor(),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    }}>
      <Text style={{
        fontSize: size * 0.28,
        fontWeight: 'bold',
        color: getScoreColor(),
      }}>{score}%</Text>
    </View>
  );
};

interface MyDonationsProps {
  navigation: any;
  user: any;
  appState: any;
  updateAppState: (key: string, value: any) => void;
}

export const MyDonations: React.FC<MyDonationsProps> = ({
  navigation,
  user,
  appState,
  updateAppState,
}) => {
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [donationToDelete, setDonationToDelete] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]); // Food requests for donations

  useEffect(() => {
    let unsubscribeDonations: any;
    let unsubscribeRequests: any;

    const setupListeners = async () => {
      const currentUser = auth().currentUser;
      const effectiveUserId = currentUser?.uid || user?.uid || user?.id;

      if (!effectiveUserId) {
        setLoading(false);
        return;
      }

      // Real-time listener for donations
      unsubscribeDonations = firestore()
        .collection('donations')
        .where('donorId', '==', effectiveUserId)
        .onSnapshot(
          (snapshot) => {
            let donationsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter out old completed donations (keep only most recent)
            const activeStatuses = ['available', 'pending', 'approved', 'claimed', 'in_transit', 'volunteer_assigned'];
            const completedStatuses = ['delivered', 'cancelled', 'expired'];

            const activeDonations = donationsList.filter((d: any) =>
              activeStatuses.includes(d.status) || !d.status
            );

            const completedDonations = donationsList.filter((d: any) =>
              completedStatuses.includes(d.status)
            );

            // Sort completed by date and keep only most recent
            completedDonations.sort((a: any, b: any) => {
              const dateA = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
              const dateB = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
              return dateB.getTime() - dateA.getTime();
            });

            const lastCompleted = completedDonations.length > 0 ? [completedDonations[0]] : [];
            donationsList = [...activeDonations, ...lastCompleted];

            // Sort by date (newest first)
            donationsList.sort((a: any, b: any) => {
              const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
              const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
              return dateB.getTime() - dateA.getTime();
            });

            setDonations(donationsList);
            setLoading(false);
            setRefreshing(false);
          },
          (error) => {
            console.log('Donations listener error:', error);
            setLoading(false);
            setRefreshing(false);
          }
        );

      // Real-time listener for food requests
      unsubscribeRequests = firestore()
        .collection('foodRequests')
        .onSnapshot(
          (snapshot) => {
            const requestsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRequests(requestsList);
          },
          (error) => {
            console.log('Requests listener error:', error);
          }
        );
    };

    setupListeners();

    return () => {
      if (unsubscribeDonations) unsubscribeDonations();
      if (unsubscribeRequests) unsubscribeRequests();
    };
  }, [user]);

  // Refresh donations when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Real-time listeners handle updates automatically
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    // Listeners will update automatically, just reset refreshing after a delay
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getRequestsForDonation = (donationId: string) => {
    return requests.filter((r: any) => r.donationId === donationId);
  };

  const handleChatWithRequester = (request: any) => {
    navigation.navigate('ChatScreen', {
      contactId: request.requesterId || request.ngoId,
      contactName: request.requesterName || request.ngoEmail?.split('@')[0] || 'Requester',
      contactImage: null,
    });
  };

  // Approve a food request from NGO
  const handleApproveRequest = async (request: any, donation: any) => {
    try {
      // Update food request status to approved
      await firestore()
        .collection('foodRequests')
        .doc(request.id)
        .update({
          status: 'approved',
          approvedAt: firestore.FieldValue.serverTimestamp(),
          approvedBy: auth().currentUser?.uid,
        });

      // Update donation status
      await firestore()
        .collection('donations')
        .doc(donation.id)
        .update({
          status: 'approved',
          approvedRequestId: request.id,
          approvedNgoId: request.ngoId,
        });

      // Send notification to NGO
      await firestore().collection('notifications').add({
        userId: request.ngoId,
        title: 'Request Approved!',
        message: `Your request for "${donation.title}" has been approved by the donor. A volunteer will pick it up soon.`,
        type: 'request_approved',
        donationId: donation.id,
        requestId: request.id,
        read: false,
        timestamp: new Date().toISOString(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      Toast.show({
        type: 'success',
        text1: 'Request Approved!',
        text2: 'The NGO has been notified. Waiting for volunteer pickup.',
      });

      // Real-time listeners will update automatically
    } catch (error) {
      console.error('Error approving request:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to approve request',
      });
    }
  };

  // Reject a food request from NGO
  const handleRejectRequest = async (request: any, donation: any) => {
    try {
      // Update food request status to rejected
      await firestore()
        .collection('foodRequests')
        .doc(request.id)
        .update({
          status: 'rejected',
          rejectedAt: firestore.FieldValue.serverTimestamp(),
          rejectedBy: auth().currentUser?.uid,
        });

      // Send notification to NGO
      await firestore().collection('notifications').add({
        userId: request.ngoId,
        title: '❌ Request Declined',
        message: `Your request for "${donation.title}" was not approved. You can request other available donations.`,
        type: 'request_rejected',
        donationId: donation.id,
        requestId: request.id,
        read: false,
        timestamp: new Date().toISOString(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      Toast.show({
        type: 'info',
        text1: 'Request Declined',
        text2: 'The NGO has been notified.',
      });

      // Real-time listeners will update automatically
    } catch (error) {
      console.error('Error rejecting request:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to reject request',
      });
    }
  };

  const handleDelete = (donation: any) => {
    setDonationToDelete(donation);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (donationToDelete) {
      try {
        await firestore()
          .collection('donations')
          .doc(donationToDelete.id)
          .delete();

        setDonations(donations.filter(d => d.id !== donationToDelete.id));
        Toast.show({
          type: 'success',
          text1: 'Deleted',
          text2: 'Donation has been removed',
        });
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to delete donation',
        });
      }
    }
    setShowDeleteModal(false);
    setDonationToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDonationToDelete(null);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'success';
      case 'claimed':
        return 'info';
      case 'available':
        return 'success';
      default:
        return 'default';
    }
  };

  // Helper function to format dates safely
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'N/A';
    try {
      // Handle Firestore Timestamp
      if (dateValue?.toDate) {
        return dateValue.toDate().toLocaleDateString();
      }
      // Handle ISO string or Date object
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const renderDonation = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('DonationDetail', { donationId: item.id, isOwner: true })}
      activeOpacity={0.7}
    >
      <Card style={styles.donationCard}>
        <View style={styles.donationHeader}>
          <View style={styles.iconContainer}>
            <Icon name="fast-food" size={24} color={colors.primary} />
          </View>
          <View style={styles.donationInfo}>
            <Text style={styles.foodType}>{item.title}</Text>
            <Text style={styles.quantity}>{item.quantity || item.servings} servings</Text>
          </View>
          <Badge
            text={item.status}
            variant={getStatusVariant(item.status)}
          />
        </View>

        <View style={styles.donationDetails}>
          <View style={styles.detailRow}>
            <Icon name="calendar-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.detailText}>Posted: {formatDate(item.createdAt)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="time-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.detailText}>Expires: {formatDate(item.bestBefore)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="location-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.detailText}>{item.pickupAddress}</Text>
          </View>
        </View>

        {/* Tap to view details hint */}
        <View style={styles.viewDetailsHint}>
          <Icon name="eye-outline" size={14} color={colors.primary} />
          <Text style={styles.viewDetailsText}>Tap to view/edit details</Text>
        </View>

        {/* Show requesters for this donation */}
        {getRequestsForDonation(item.id).length > 0 && (
          <View style={styles.requestersSection}>
            <Text style={styles.requestersTitle}>
              <Icon name="people" size={16} color={colors.primary} /> Requests ({getRequestsForDonation(item.id).length})
            </Text>
            {(() => {
              const requestsForThis = getRequestsForDonation(item.id);
              const maxScore = Math.max(...requestsForThis.map((r: any) => r.matchScore || 0));
              
              return requestsForThis.map((request: any) => {
                const isBestMatch = requestsForThis.length > 1 && (request.matchScore || 0) === maxScore && maxScore >= 50;
                
                return (
                  <View key={request.id} style={[styles.requesterCard, isBestMatch && styles.bestMatchCard]}>
                    <View style={styles.requesterHeader}>
                      <View style={styles.requesterInfo}>
                        <View style={[styles.requesterAvatar, { backgroundColor: request.status === 'approved' ? colors.primary : request.status === 'rejected' ? '#EF4444' : colors.primary }]}>
                          <Icon name="business" size={20} color={colors.white} />
                        </View>
                        <View style={styles.requesterDetails}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.requesterName}>
                              {request.requesterName || request.ngoEmail?.split('@')[0] || request.requesterEmail?.split('@')[0] || 'NGO'}
                            </Text>
                            {isBestMatch && (
                              <View style={styles.bestMatchBadge}>
                                <Text style={styles.bestMatchText}>Best Match</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.statusRow}>
                            <View style={[styles.statusBadge, {
                              backgroundColor: request.status === 'approved' ? `${colors.primary}20` :
                                request.status === 'rejected' ? '#FEE2E2' : '#FEF3C7'
                            }]}>
                              <Text style={[styles.statusBadgeText, {
                                color: request.status === 'approved' ? colors.primary :
                                  request.status === 'rejected' ? '#DC2626' : '#D97706'
                              }]}>
                                {request.status?.toUpperCase() || 'PENDING'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {request.matchScore !== undefined && request.matchScore > 0 && (
                          <MatchScoreCircle score={request.matchScore} />
                        )}
                        <TouchableOpacity
                          style={styles.chatWithRequesterButton}
                          onPress={() => handleChatWithRequester(request)}
                        >
                          <Icon name="chatbubble" size={16} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {request.matchReason && (
                      <View style={styles.matchReasonContainer}>
                        <Icon name="information-circle-outline" size={14} color={colors.mutedForeground} />
                        <Text style={styles.matchReasonText}>{request.matchReason}</Text>
                      </View>
                    )}

                    {request.status === 'pending' && (
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.rejectBtn]}
                          onPress={() => handleRejectRequest(request, item)}
                        >
                          <Text style={styles.rejectBtnText}>Decline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.approveBtn]}
                          onPress={() => handleApproveRequest(request, item)}
                        >
                          <Text style={styles.approveBtnText}>Accept Request</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {request.status === 'approved' && (
                      <View style={styles.approvedMessage}>
                        <Icon name="checkmark-done" size={16} color={colors.primary} />
                        <Text style={styles.approvedMessageText}>
                          Approved! Waiting for volunteer pickup.
                        </Text>
                      </View>
                    )}
                  </View>
                );
              });
            })()}
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => navigation.navigate('TrackDeliveries', { donationId: item.id })}
          >
            <Icon name="location-outline" size={18} color={colors.primary} />
            <Text style={styles.trackButtonText}>Track</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
          >
            <Icon name="trash-outline" size={18} color={colors.destructive} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </TouchableOpacity>
  );
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (donations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="fast-food-outline" size={64} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>No Donations Yet</Text>
        <Text style={styles.emptyText}>Start sharing food with your community</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        style={{ flex: 1 }}
        data={donations}
        renderItem={renderDonation}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        scrollEnabled={true}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="always"
        decelerationRate={0.997}
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Donation?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete this donation?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelDelete}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmDelete}
              >
                <Text style={styles.confirmButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing['3xl'],
    gap: spacing.md,
    flexGrow: 1,
  },
  donationCard: {
    gap: spacing.md,
  },
  donationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donationInfo: {
    flex: 1,
  },
  foodType: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  quantity: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  donationDetails: {
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
    color: colors.mutedForeground,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  trackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: `${colors.primary}15`,
    gap: spacing.xs,
  },
  trackButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  deleteButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.destructive,
  },
  viewDetailsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewDetailsText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyButtonText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.lg,
    width: '80%',
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  modalMessage: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.destructive,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  requestersSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  requestersTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  requesterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  requesterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requesterDetails: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  requesterName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
  },
  requesterType: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  chatWithRequesterButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  chatWithRequesterText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  requesterCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  requesterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requesterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
  },
  approvalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  approveButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  rejectButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: '#EF4444',
  },
  approvedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}20`,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  approvedMessageText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
    flex: 1,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    gap: 2,
  },
  matchBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
  },
  bestMatchCard: {
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: `${colors.success}05`,
  },
  bestMatchBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  bestMatchText: {
    color: colors.white,
    fontSize: 8,
    fontFamily: typography.fontFamily.bold,
    textTransform: 'uppercase',
  },
  matchReasonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    padding: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: 4,
    gap: 4,
  },
  matchReasonText: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontFamily: typography.fontFamily.regular,
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
  },
  rejectBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
  },
  approveBtn: {
    backgroundColor: colors.primary,
  },
  approveBtnText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
  },
});

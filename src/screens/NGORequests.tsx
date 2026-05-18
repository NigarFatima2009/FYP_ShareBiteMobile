import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
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
import {
  getCurrentLocation,
  requestLocationPermission,
  calculateDistance,
  formatDistance,
  Coordinates,
  geocodeAddress,
  geocodeAddressWithGoogle,
} from '../services/locationService';
import { calculateDonationScoreForNGO, NGORequirement } from '../services/recommendationEngine';

// Local Score Circle Component
const MatchScoreCircle = ({ score, size = 44 }: { score: number, size?: number }) => {
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
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    }}>
      <Text style={{
        fontSize: size * 0.25,
        fontWeight: 'bold',
        color: getScoreColor(),
      }}>{score}%</Text>
    </View>
  );
};


interface NGORequestsProps {
  navigation: any;
  user: any;
  appState: any;
  updateAppState: (key: string, value: any) => void;
  addNotification: (notification: any) => void;
}

export const NGORequests: React.FC<NGORequestsProps> = ({
  navigation,
  user,
  appState,
  updateAppState,
  addNotification,
}) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'myRequests' | 'availableDonations'>('availableDonations');
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [claimedDonations, setClaimedDonations] = useState<Set<string>>(new Set());
  const [isVerified, setIsVerified] = useState(true);
  const [showAIInfo, setShowAIInfo] = useState(false);
  const [ngoRequirement, setNgoRequirement] = useState<NGORequirement | null>(null);
  const [checkingRequirement, setCheckingRequirement] = useState(false);
  const [showLowMatchModal, setShowLowMatchModal] = useState(false);
  const [pendingDonation, setPendingDonation] = useState<any>(null);

  // Check NGO verification status
  useEffect(() => {
    const checkVerification = async () => {
      const currentUser = auth().currentUser;
      if (currentUser) {
        try {
          setCheckingRequirement(true);
          const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const verified = userData?.verified === true || userData?.ngoVerified === true || false;
            setIsVerified(verified);

            // If verified, also fetch active requirement
            if (verified) {
              const reqSnapshot = await firestore()
                .collection('ngoRequirements')
                .where('ngoId', '==', currentUser.uid)
                .where('status', '==', 'Active')
                .get();
              
              if (!reqSnapshot.empty) {
                const reqData = reqSnapshot.docs[0].data();
                setNgoRequirement({
                  id: reqSnapshot.docs[0].id,
                  ...reqData
                } as NGORequirement);
              }
            }
          }
        } catch (error) {
          console.log('Error checking verification:', error);
        } finally {
          setCheckingRequirement(false);
        }
      }
    };
    checkVerification();
  }, []);

  // Initialize location and load data on mount
  useEffect(() => {
    const initAndLoad = async () => {
      setLoading(true);

      // Get location first
      const hasPermission = await requestLocationPermission();
      let location: Coordinates | null = null;

      if (hasPermission) {
        const result = await getCurrentLocation();
        if (result.success && result.coordinates) {
          location = result.coordinates;
          setUserLocation(result.coordinates);
        }
      }

      // If no GPS, use default location (Rawalpindi)
      if (!location) {
        location = { latitude: 33.5651, longitude: 73.0169 };
        setUserLocation(location);
      }

      // Now load data with location
      await loadAllDataWithLocation(location);
    };

    initAndLoad();
  }, []);

  // Refresh on focus
  const onFocus = useCallback(() => {
    if (userLocation) {
      loadAllDataWithLocation(userLocation);
    }
  }, [userLocation]);

  useFocusEffect(onFocus);

  const loadAllData = async () => {
    if (userLocation) {
      await loadAllDataWithLocation(userLocation);
    }
  };

  // Optimized parallel data loading
  const loadAllDataWithLocation = async (location: Coordinates) => {
    try {
      setLoading(true);
      // Fetch NGO verification and requirement first to ensure scoring works
      let currentRequirement = ngoRequirement;
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      if (!currentRequirement) {
        const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const verified = userData?.verified === true || userData?.ngoVerified === true || false;
          setIsVerified(verified);

          if (verified) {
            const reqSnapshot = await firestore()
              .collection('ngoRequirements')
              .where('ngoId', '==', currentUser.uid)
              .where('status', '==', 'Active')
              .get();
            
            if (!reqSnapshot.empty) {
              const reqData = reqSnapshot.docs[0].data();
              currentRequirement = {
                id: reqSnapshot.docs[0].id,
                ...reqData
              } as NGORequirement;
              setNgoRequirement(currentRequirement);
              
              // Prioritize requirement location for distance calculation
              if (reqData.location && reqData.location.latitude) {
                location = {
                  latitude: reqData.location.latitude,
                  longitude: reqData.location.longitude
                };
              }
            }
          }
        }
      } else if (currentRequirement.location && currentRequirement.location.latitude) {
        // If requirement already loaded, use its location
        location = {
          latitude: currentRequirement.location.latitude,
          longitude: currentRequirement.location.longitude
        };
      }

      // Load requests and donations in parallel
      const [requestsSnapshot, donationsSnapshot, claimedSnapshot] = await Promise.all([
        firestore().collection('foodRequests').get(),
        firestore().collection('donations').get(),
        firestore().collection('foodRequests').get(),
      ]);

      // Process requests - include requests by this user (NGO or receiver)
      // Filter out delivered and cancelled requests (cleanup)
      let requestsList = requestsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((r: any) => r.ngoId === currentUser.uid || r.requesterId === currentUser.uid);

      // Auto-delete delivered/cancelled requests from database
      const completedRequests = requestsList.filter((r: any) =>
        r.status === 'delivered' || r.status === 'cancelled' || r.status === 'rejected'
      );

      if (completedRequests.length > 0) {
        const batch = firestore().batch();
        completedRequests.forEach((r: any) => {
          batch.delete(firestore().collection('foodRequests').doc(r.id));
        });
        try {
          await batch.commit();
        } catch (e) {
          // Silent error
        }
      }

      // Only show active requests
      requestsList = requestsList.filter((r: any) =>
        r.status === 'pending' || r.status === 'approved' || r.status === 'volunteer_assigned' || r.status === 'in_transit'
      );

      requestsList.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

      setRequests(requestsList);

      // Process claimed donations - collect ALL donation IDs that have been requested by this user
      const claimed = new Set<string>();
      claimedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if ((data.ngoId === currentUser.uid || data.requesterId === currentUser.uid) && data.donationId) {
          claimed.add(data.donationId);
        }
      });
      setClaimedDonations(claimed);

      // Process donations with duplicate removal - EXCLUDE already requested donations
      let donationsList = donationsSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data };
        })
        .filter((d: any) => d.status === 'available' && !claimed.has(d.id));

      // Remove duplicates using title similarity
      donationsList = removeDuplicateDonations(donationsList);

      // Fetch donor full names for all donations
      const donorIds = [...new Set(donationsList.map((d: any) => d.donorId).filter(Boolean))];
      const donorProfiles: Record<string, any> = {};

      // Fetch all donor profiles in parallel
      await Promise.all(
        donorIds.map(async (donorId: string) => {
          try {
            const userDoc = await firestore().collection('users').doc(donorId).get();
            if (userDoc.exists()) {
              donorProfiles[donorId] = userDoc.data();
            }
          } catch (e) {
            // Silent error
          }
        })
      );

      // Calculate distance for each donation and add full donor name
      donationsList = await Promise.all(donationsList.map(async (donation: any) => {
        let distance = '---';
        let distanceValue = Infinity;

        let donationCoords = donation.coordinates;

        if (!donationCoords || !donationCoords.latitude) {
          const addressToGeocode = donation.pickupAddress || donation.location || donation.address;
          if (addressToGeocode) {
            donationCoords = await geocodeAddressWithGoogle(addressToGeocode);
          }
        }

        if (donationCoords && donationCoords.latitude && donationCoords.longitude) {
          distanceValue = calculateDistance(location, donationCoords);
          distance = formatDistance(distanceValue);
        } else {
          // Final fallback
          distance = 'Distance N/A';
          distanceValue = 999;
        }

        // Get full donor name from profile - prioritize profile name over donation name
        const donorProfile = donation.donorId ? donorProfiles[donation.donorId] : null;
        let fullDonorName = 'Donor';

        if (donorProfile?.name && donorProfile.name.length > 0) {
          fullDonorName = donorProfile.name;
        } else if (donorProfile?.displayName && donorProfile.displayName.length > 0) {
          fullDonorName = donorProfile.displayName;
        } else if (donorProfile?.fullName && donorProfile.fullName.length > 0) {
          fullDonorName = donorProfile.fullName;
        } else if (donation.donorName && donation.donorName.length > 0 && !donation.donorName.includes('@')) {
          fullDonorName = donation.donorName;
        }

        return {
          ...donation,
          distance,
          distanceValue,
          donorFullName: fullDonorName,
          donorPhone: donorProfile?.phone || donorProfile?.phoneNumber || donation.donorPhone || '',
          coordinates: donationCoords || donation.coordinates, // Save geocoded coords back to object for UI
        };
      }));

      // Sort by distance first
      donationsList.sort((a: any, b: any) => a.distanceValue - b.distanceValue);

      // AI Scoring if NGO has requirement
      if (currentRequirement) {
        donationsList = donationsList.map(donation => {
          const { score, reason } = calculateDonationScoreForNGO(currentRequirement!, donation);
          return { ...donation, matchScore: score, matchReason: reason };
        });
        
        // Sort by match score descending
        donationsList.sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));
      }

      setDonations(donationsList);



      setLoading(false);
    } catch (error) {
      setRequests([]);
      setDonations([]);
      setLoading(false);
    }
  };

  // Remove duplicate donations using simple similarity check
  const removeDuplicateDonations = (donations: any[]): any[] => {
    const seen = new Map<string, any>();

    donations.forEach(donation => {
      const normalizedTitle = (donation.title || '').toLowerCase().trim();
      const normalizedLocation = (donation.pickupAddress || '').toLowerCase().trim();
      const key = `${normalizedTitle}-${normalizedLocation}`;

      // Check for similar existing donation
      let isDuplicate = false;
      for (const [existingKey, existing] of seen.entries()) {
        const similarity = calculateSimilarity(normalizedTitle, existing.normalizedTitle);
        if (similarity > 0.8 && normalizedLocation === existing.normalizedLocation) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        seen.set(key, { ...donation, normalizedTitle, normalizedLocation });
      }
    });

    return Array.from(seen.values()).map(({ normalizedTitle, normalizedLocation, ...rest }) => rest);
  };

  // Simple Jaccard similarity for duplicate detection
  const calculateSimilarity = (str1: string, str2: string): number => {
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  };

  // Check for duplicate donation (similar title/description)
  const checkDuplicate = (donation: any): boolean => {
    return claimedDonations.has(donation.id);
  };

  const handleCall = async (phone: string | undefined, donorId?: string) => {
    let phoneToCall = phone || '';

    // Always try to fetch from donor's profile if donorId is available
    if (donorId) {
      try {
        const donorDoc = await firestore().collection('users').doc(donorId).get();
        if (donorDoc.exists()) {
          const donorData = donorDoc.data();
          const profilePhone = donorData?.phone || donorData?.phoneNumber || '';
          if (profilePhone) {
            phoneToCall = profilePhone;
          }
        }
      } catch (e) {
        console.log('Error fetching donor phone:', e);
      }
    }

    if (phoneToCall && phoneToCall.length > 0) {
      Linking.openURL(`tel:${phoneToCall}`);
    } else {
      Toast.show({
        type: 'error',
        text1: 'No Phone Number',
        text2: 'Donor phone number not available. Try chat instead.',
      });
    }
  };

  const handleChat = (donation: any) => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      Toast.show({
        type: 'error',
        text1: 'Sign In Required',
        text2: 'Please sign in to chat with donors',
      });
      return;
    }

    if (!isVerified) {
      Toast.show({
        type: 'error',
        text1: 'Verification Required',
        text2: 'Please verify your NGO profile to chat with donors',
      });
      navigation.navigate('NGOVerification');
      return;
    }

    const donorId = donation.donorId;
    if (!donorId) {
      Toast.show({
        type: 'error',
        text1: 'Cannot Chat',
        text2: 'Donor information not available',
      });
      return;
    }
    
    navigation.navigate('ChatScreen', {
      contactId: donorId,
      contactName: donation.donorFullName || donation.donorName || 'Donor',
      contactImage: null,
    });
  };

  const handleTrackDelivery = (donation: any) => {
    navigation.navigate('TrackDeliveries', {
      donationId: donation.id,
    });
  };

  const handleClaimDonation = async (donation: any) => {
    if (checkDuplicate(donation)) {
      Toast.show({
        type: 'error',
        text1: 'Already Claimed',
        text2: 'You have already requested this donation',
      });
      return;
    }

    // AI Score Threshold Warning
    if (donation.matchScore !== undefined && donation.matchScore < 40) {
      setPendingDonation(donation);
      setShowLowMatchModal(true);
      return;
    }

    await proceedWithClaim(donation);
  };

  const proceedWithClaim = async (donation: any) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      // Get NGO name for notification
      let ngoName = currentUser.email?.split('@')[0] || 'NGO';
      try {
        const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
        if (userDoc.exists()) {
          const userData = userDoc.data();
          ngoName = userData?.organizationName || userData?.name || ngoName;
        }
      } catch (e) { }

      // Create food request with requester info
      const requestData = {
        donationId: donation.id,
        ngoId: currentUser.uid,
        requesterId: currentUser.uid,
        ngoEmail: currentUser.email,
        requesterEmail: currentUser.email,
        ngoName: ngoName,
        requesterName: ngoName,
        title: donation.title,
        quantity: donation.quantity,
        donorId: donation.donorId, // Store donor ID in request too
        status: 'pending',
        matchScore: donation.matchScore || 0,
        matchReason: donation.matchReason || '',
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('foodRequests').add(requestData);

      // Send notification to DONOR about the request
      if (donation.donorId) {
        const notificationData = {
          userId: donation.donorId,
          title: 'New Food Request!',
          message: `${ngoName} wants to request your donation "${donation.title}". Please review and approve.`,
          type: 'food_request',
          donationId: donation.id,
          requesterId: currentUser.uid,
          requesterName: ngoName,
          read: false,
          timestamp: new Date().toISOString(),
          createdAt: firestore.FieldValue.serverTimestamp(),
        };

        await firestore().collection('notifications').add(notificationData);
        console.log('✅ Notification sent to donor:', donation.donorId, notificationData);
      } else {
        console.log('⚠️ No donorId found for donation:', donation.id, donation);
        // Try to get donorId from the donation document directly
        try {
          const donationDoc = await firestore().collection('donations').doc(donation.id).get();
          if (donationDoc.exists()) {
            const donorIdFromDoc = donationDoc.data()?.donorId;
            if (donorIdFromDoc) {
              await firestore().collection('notifications').add({
                userId: donorIdFromDoc,
                title: 'New Food Request!',
                message: `${ngoName} wants to request your donation "${donation.title}". Please review and approve.`,
                type: 'food_request',
                donationId: donation.id,
                requesterId: currentUser.uid,
                requesterName: ngoName,
                read: false,
                timestamp: new Date().toISOString(),
                createdAt: firestore.FieldValue.serverTimestamp(),
              });
              console.log('✅ Notification sent to donor (from doc):', donorIdFromDoc);
            }
          }
        } catch (e) {
          console.log('Error fetching donation for donorId:', e);
        }
      }

      // Update claimed set and immediately remove from donations list
      setClaimedDonations(prev => new Set([...prev, donation.id]));
      setDonations(prev => prev.filter(d => d.id !== donation.id));

      Toast.show({
        type: 'success',
        text1: 'Request Sent',
        text2: 'Your request has been sent to the donor for approval',
      });

      addNotification({
        type: 'request_sent',
        title: 'Food Request Sent',
        message: `Request for "${donation.title}" sent. Waiting for donor approval.`,
      });
    } catch (error) {
      console.log('Error in handleClaimDonation:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send request',
      });
    }
  };

  const handleCancelRequest = (request: any) => {
    if (request.status !== 'pending') {
      Toast.show({
        type: 'error',
        text1: 'Cannot Cancel',
        text2: 'Only pending requests can be cancelled',
      });
      return;
    }
    setRequestToCancel(request);
    setShowCancelModal(true);
  };

  const confirmCancelRequest = async () => {
    if (!requestToCancel) return;

    try {
      await firestore()
        .collection('foodRequests')
        .doc(requestToCancel.id)
        .update({ status: 'cancelled' });

      Toast.show({
        type: 'success',
        text1: 'Request Cancelled',
        text2: 'Your food request has been cancelled successfully',
      });

      setShowCancelModal(false);
      setRequestToCancel(null);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to cancel request',
      });
    }
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setRequestToCancel(null);
  };

  if (loading) {
    return (
      <View style={styles.container}>
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
        <Text style={styles.headerTitle}>Requests & Donations</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('RequestHistory', { userType: 'ngo' })}
          style={styles.backButton}
        >
          <Icon name="time-outline" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'myRequests' && styles.activeTab]}
          onPress={() => setActiveTab('myRequests')}
        >
          <Text style={[styles.tabText, activeTab === 'myRequests' && styles.activeTabText]}>
            Requests ({requests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'availableDonations' && styles.activeTab]}
          onPress={() => setActiveTab('availableDonations')}
        >
          <Text style={[styles.tabText, activeTab === 'availableDonations' && styles.activeTabText]}>
            All ({donations.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Requirement Form Prompt for NGOs */}
      {isVerified && !ngoRequirement && !checkingRequirement && (
        <View style={styles.requirementBanner}>
          <View style={styles.requirementBannerContent}>
            <Icon name="sparkles" size={24} color={colors.white} />
            <View style={styles.requirementBannerText}>
              <Text style={styles.requirementBannerTitle}>Get AI Recommendations</Text>
              <Text style={styles.requirementBannerSubtitle}>
                Tell us your community's needs to see matching donations.
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.requirementBannerBtn}
            onPress={() => navigation.navigate('NGORequirementCreation')}
          >
            <Text style={styles.requirementBannerBtnText}>Setup Now</Text>
          </TouchableOpacity>
        </View>
      )}



      {activeTab === 'myRequests' && (
        <FlatList
          style={{ flex: 1 }}
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          overScrollMode="always"
          decelerationRate={0.997}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="list-outline" size={64} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No requests yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card key={item.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={styles.iconContainer}>
                  <Icon name="list-circle" size={24} color={colors.primary} />
                </View>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestType}>{item.title || 'Food Request'}</Text>
                  <Text style={styles.quantity}>{item.quantity}</Text>
                </View>
                <Badge
                  text={item.status}
                  variant={item.status === 'approved' ? 'success' : 'warning'}
                />
              </View>

              {item.status === 'pending' && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancelRequest(item)}
                >
                  <Icon name="close-circle-outline" size={18} color={colors.destructive} />
                  <Text style={styles.cancelButtonText}>Cancel Request</Text>
                </TouchableOpacity>
              )}
            </Card>
          )}
        />
      )}

      {activeTab === 'availableDonations' && (
        <FlatList
          style={{ flex: 1 }}
          data={donations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          overScrollMode="always"
          decelerationRate={0.997}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="fast-food-outline" size={64} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No donations available</Text>
            </View>
          }
          renderItem={({ item: donation }) => {
            const isDuplicate = checkDuplicate(donation);
            return (
              <Card key={donation.id} style={[styles.donationCard, isDuplicate && styles.duplicateCard]}>
                <View style={styles.donationHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodTitle}>{donation.title}</Text>
                    <View style={styles.badgeRow}>
                      {isDuplicate && <Badge text="Requested" variant="warning" />}
                      <Badge text="available" variant="success" />
                    </View>
                  </View>
                  {donation.matchScore !== undefined && (
                    <MatchScoreCircle score={donation.matchScore} />
                  )}
                </View>

                <Text style={styles.donorName}>By {donation.donorFullName || donation.donorName || 'Donor'}</Text>
                {donation.donorPhone && (
                  <TouchableOpacity onPress={() => handleCall(donation.donorPhone, donation.donorId)}>
                    <Text style={styles.donorPhone}>{donation.donorPhone}</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.description} numberOfLines={2}>{donation.description}</Text>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Icon name="cube-outline" size={16} color={colors.mutedForeground} />
                    <Text style={styles.statText}>{donation.quantity}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Icon name="location-outline" size={16} color={colors.mutedForeground} />
                    <Text style={styles.statText} numberOfLines={1}>{donation.pickupAddress}</Text>
                  </View>
                </View>

                <View style={styles.distanceRow}>
                  <Icon name="navigate-outline" size={16} color={colors.primary} />
                  <Text style={styles.distanceText}>{donation.distance} away</Text>
                </View>

                {!isVerified && (
                  <View style={styles.verificationWarning}>
                    <Icon name="warning" size={16} color="#F59E0B" />
                    <Text style={styles.verificationWarningText}>
                      Please verify your NGO to request food
                    </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('NGOVerification')}>
                      <Text style={styles.verifyLink}>Verify Now</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleCall(donation.donorPhone, donation.donorId)}
                  >
                    <Icon name="call-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleChat(donation)}
                  >
                    <Icon name="chatbubble-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleTrackDelivery(donation)}
                  >
                    <Icon name="navigate-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => {
                      Toast.show({
                        type: 'info',
                        text1: 'Donation Rejected',
                        text2: 'This donation has been hidden from your list',
                      });
                    }}
                  >
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.claimButton, (isDuplicate || !isVerified) && styles.claimButtonDisabled]}
                    onPress={() => handleClaimDonation(donation)}
                    disabled={isDuplicate || !isVerified}
                  >
                    <Text style={styles.claimButtonText}>
                      {isDuplicate ? 'Requested' : 'Request'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Cancel Request Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={closeCancelModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Request?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to cancel this request?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalKeepButton}
                onPress={closeCancelModal}
              >
                <Text style={styles.modalKeepText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={confirmCancelRequest}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Info Modal */}
      <Modal
        visible={showAIInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAIInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.aiInfoModal}>
            <View style={styles.aiInfoHeader}>
              <Icon name="sparkles" size={32} color="#8B5CF6" />
              <Text style={styles.aiInfoTitle}>AI Recommendations</Text>
            </View>

            <Text style={styles.aiInfoSubtitle}>How it works:</Text>

            <View style={styles.aiInfoItem}>
              <Icon name="location" size={20} color="#3B82F6" />
              <View style={styles.aiInfoItemText}>
                <Text style={styles.aiInfoItemTitle}>Distance (30%)</Text>
                <Text style={styles.aiInfoItemDesc}>Closer donations score higher</Text>
              </View>
            </View>

            <View style={styles.aiInfoItem}>
              <Icon name="time" size={20} color="#EF4444" />
              <View style={styles.aiInfoItemText}>
                <Text style={styles.aiInfoItemTitle}>Urgency (25%)</Text>
                <Text style={styles.aiInfoItemDesc}>Expiring soon = higher priority</Text>
              </View>
            </View>

            <View style={styles.aiInfoItem}>
              <Icon name="heart" size={20} color="#EC4899" />
              <View style={styles.aiInfoItemText}>
                <Text style={styles.aiInfoItemTitle}>Your Preferences (20%)</Text>
                <Text style={styles.aiInfoItemDesc}>Based on your past requests</Text>
              </View>
            </View>

            <View style={styles.aiInfoItem}>
              <Icon name="flash" size={20} color="#F59E0B" />
              <View style={styles.aiInfoItemText}>
                <Text style={styles.aiInfoItemTitle}>Freshness (15%)</Text>
                <Text style={styles.aiInfoItemDesc}>Recently posted donations</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.aiInfoCloseButton}
              onPress={() => setShowAIInfo(false)}
            >
              <Text style={styles.aiInfoCloseText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Low Match Score Warning Modal */}
      <Modal
        visible={showLowMatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLowMatchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.warningIconContainer}>
              <Icon name="warning" size={48} color="#F59E0B" />
            </View>
            <Text style={styles.modalTitle}>Low Match Score</Text>
            <Text style={styles.modalMessage}>
              This donation has a low AI match score ({pendingDonation?.matchScore}%). 
              It may not perfectly align with your requirements regarding distance, food type, or allergens.
            </Text>
            <Text style={styles.modalQuestion}>Do you still want to send a request?</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalKeepButton}
                onPress={() => setShowLowMatchModal(false)}
              >
                <Text style={styles.modalKeepText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: '#F59E0B' }]}
                onPress={async () => {
                  setShowLowMatchModal(false);
                  if (pendingDonation) {
                    await proceedWithClaim(pendingDonation);
                    setPendingDonation(null);
                  }
                }}
              >
                <Text style={styles.modalCancelText}>Request Anyway</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#EC4899',
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#EC4899',
    paddingHorizontal: spacing.md,
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
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  activeTabText: {
    color: colors.white,
    fontFamily: typography.fontFamily.semibold,
  },
  mapButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing['3xl'],
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  requestCard: {
    marginBottom: spacing.md,
  },
  requestHeader: {
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
  requestInfo: {
    flex: 1,
  },
  requestType: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  quantity: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#FEE2E2',
    gap: spacing.xs,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.destructive,
  },
  donationCard: {
    marginBottom: spacing.md,
  },
  donationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  foodTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    flex: 1,
  },
  donorName: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: '#EC4899',
    marginBottom: spacing.xs,
  },
  donorPhone: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
    marginBottom: spacing.sm,
    textDecorationLine: 'underline',
  },
  description: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
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
    flex: 1,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  distanceText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  claimButtonDisabled: {
    backgroundColor: colors.muted,
  },
  claimButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  duplicateCard: {
    opacity: 0.7,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
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
  modalKeepButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalKeepText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: colors.destructive,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  verificationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  verificationWarningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: '#92400E',
  },
  verifyLink: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
  },
  rejectButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.destructive,
  },
  // AI Recommendation Styles
  aiHeader: {
    backgroundColor: `${colors.primary}15`,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  aiHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  aiHeaderTitle: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  aiHeaderSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: '#6B21A8',
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  recommendedCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  aiScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
  aiScoreText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
  },
  aiReasons: {
    backgroundColor: '#F5F3FF',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    gap: 4,
  },
  aiReasonText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: '#6B21A8',
  },
  // AI Info Modal Styles
  aiInfoModal: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '85%',
    maxWidth: 340,
  },
  aiInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  aiInfoTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: '#7C3AED',
  },
  aiInfoSubtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  aiInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  aiInfoItemText: {
    flex: 1,
  },
  aiInfoItemTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  aiInfoItemDesc: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  aiInfoCloseButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  aiInfoCloseText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  requirementBanner: {
    backgroundColor: '#8B5CF6',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requirementBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requirementBannerText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  requirementBannerTitle: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bold,
  },
  requirementBannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
  },
  requirementBannerBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  requirementBannerBtnText: {
    color: '#8B5CF6',
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bold,
  },
  warningIconContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalQuestion: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    color: colors.foreground,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
});


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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { colors, typography, spacing, borderRadius } from '../theme';
import { AllergyChart } from '../components/AllergyChart';
import { 
  getCurrentLocation,
  requestLocationPermission,
  calculateDistance,
  formatDistance,
  geocodeAddress,
  Coordinates 
} from '../services/locationService';
import { calculateDonationScoreForNGO, NGORequirement } from '../services/recommendationEngine';

interface RequestFoodProps {
  navigation: any;
  user: any;
  addNotification: (notification: any) => void;
}

export const RequestFood: React.FC<RequestFoodProps> = ({
  navigation,
  user,
  addNotification,
}) => {
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [isNgoVerified, setIsNgoVerified] = useState(true); // Default true for non-NGO users
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [pendingDonation, setPendingDonation] = useState<any>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [ngoRequirement, setNgoRequirement] = useState<NGORequirement | null>(null);
  const [checkingRequirement, setCheckingRequirement] = useState(false);

  // Check NGO verification status
  useEffect(() => {
    const checkNgoVerification = async () => {
      if (user?.userType === 'ngo') {
        try {
          setCheckingRequirement(true);
          const auth = require('@react-native-firebase/auth').default;
          const currentUser = auth().currentUser;
          if (currentUser) {
            // Check verification
            const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
            if (userDoc) {
              const exists = typeof (userDoc as any).exists === 'function' ? (userDoc as any).exists() : (userDoc as any).exists;
              if (exists) {
                const userData = userDoc.data();
                const verified = userData?.verified === true || userData?.ngoVerified === true;
                setIsNgoVerified(verified);

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
              } else {
                setIsNgoVerified(false);
              }
            } else {
              setIsNgoVerified(false);
            }
          }
        } catch (error) {
          setIsNgoVerified(false);
        } finally {
          setCheckingRequirement(false);
        }
      }
    };
    checkNgoVerification();
  }, [user]);

  // Initialize location on mount and load donations
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
      
      // Now load donations with location
      await loadDonationsWithLocation(location);
    };
    
    initAndLoad();
  }, []);

  // Refresh on focus
  const onFocus = useCallback(() => {
    if (userLocation) {
      loadDonationsWithLocation(userLocation);
    }
  }, [userLocation]);

  useFocusEffect(onFocus);

  const loadDonations = async () => {
    if (userLocation) {
      await loadDonationsWithLocation(userLocation);
    }
  };

  const loadDonationsWithLocation = async (location: Coordinates) => {
    try {
      setLoading(true);
      
      const snapshot = await firestore()
        .collection('donations')
        .get();

      let donationsList = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            foodType: data.title || data.foodType,
            quantity: data.quantity || data.servings,
            location: data.pickupAddress,
            donor: data.donorName || data.donorEmail?.split('@')[0] || 'Anonymous Donor',
            donorId: data.donorId,
            donorEmail: data.donorEmail,
            donorPhone: data.donorPhone,
            coordinates: data.coordinates,
            status: data.status,
            ...data,
          };
        })
        .filter((d: any) => {
          const isAvailable = d.status === 'available';
          const expiryDate = new Date(d.bestBefore);
          const isNotExpired = !isNaN(expiryDate.getTime()) && expiryDate > new Date();
          return isAvailable && isNotExpired;
        });

      // Remove duplicates
      donationsList = removeDuplicateDonations(donationsList);

      // Calculate distance for each donation
      donationsList = donationsList.map((donation: any) => {
        let distance = '~5 km';
        let distanceValue = 5;

        // Try to get coordinates from donation - check multiple formats
        let donationCoords: Coordinates | null = null;
        
        if (donation.coordinates) {
          // Check if coordinates are in correct format
          if (donation.coordinates.latitude && donation.coordinates.longitude) {
            donationCoords = donation.coordinates;
          } else if (donation.coordinates.lat && donation.coordinates.lng) {
            donationCoords = {
              latitude: donation.coordinates.lat,
              longitude: donation.coordinates.lng,
            };
          } else if (donation.coordinates.lat && donation.coordinates.lon) {
            donationCoords = {
              latitude: donation.coordinates.lat,
              longitude: donation.coordinates.lon,
            };
          }
        }
        
        // If no coordinates stored, try to geocode the address
        if (!donationCoords && donation.location) {
          donationCoords = geocodeAddress(donation.location);
        }
        
        // Also try pickupAddress field
        if (!donationCoords && donation.pickupAddress) {
          donationCoords = geocodeAddress(donation.pickupAddress);
        }

        // Calculate distance if we have valid coordinates
        if (donationCoords && location) {
          distanceValue = calculateDistance(location, donationCoords);
          distance = formatDistance(distanceValue);
        }

        return {
          ...donation,
          distance,
          distanceValue,
          calculatedCoords: donationCoords,
        };
      });

      // Sort by distance first
      donationsList.sort((a: any, b: any) => a.distanceValue - b.distanceValue);
      
      // AI Scoring if NGO has requirement
      if (user?.userType === 'ngo' && ngoRequirement) {
        donationsList = donationsList.map(donation => {
          const { score, reason } = calculateDonationScoreForNGO(ngoRequirement, donation);
          return { ...donation, matchScore: score, matchReason: reason };
        });
        
        // Sort by match score descending
        donationsList.sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));
      }
      
      setDonations(donationsList);
      setLoading(false);
    } catch (error) {
      setDonations([]);
      setLoading(false);
    }
  };

  // Remove duplicate donations
  const removeDuplicateDonations = (donations: any[]): any[] => {
    const seen = new Map<string, any>();
    
    donations.forEach(donation => {
      const normalizedTitle = (donation.foodType || donation.title || '').toLowerCase().trim();
      const normalizedLocation = (donation.location || '').toLowerCase().trim();
      const key = `${normalizedTitle}-${normalizedLocation}`;
      
      let isDuplicate = false;
      for (const [, existing] of seen.entries()) {
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

  const calculateSimilarity = (str1: string, str2: string): number => {
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  };

  const handleCall = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Toast.show({
        type: 'error',
        text1: 'No Phone Number',
        text2: 'Donor phone number not available',
      });
    }
  };

  const handleChatWithDonor = (donation: any) => {
    setSelectedDonor(donation);
    setShowChatModal(true);
  };

  const handleStartChat = () => {
    if (selectedDonor) {
      navigation.navigate('ChatScreen', {
        contactId: selectedDonor.donorId || selectedDonor.id,
        contactName: selectedDonor.donor,
        contactImage: null,
      });
      setShowChatModal(false);
    }
  };

  const handleRequest = async (donation: any) => {
    // If donation has allergens, show warning modal first
    if (donation.allergens && donation.allergens.length > 0) {
      setPendingDonation(donation);
      setShowAllergyModal(true);
      return;
    }
    
    // Otherwise proceed with standard request
    await executeRequest(donation);
  };

  const executeRequest = async (donation: any) => {
    try {
      setIsRequesting(true);
      const auth = require('@react-native-firebase/auth').default;
      const currentUser = auth().currentUser;
      
      if (!currentUser) {
        Toast.show({
          type: 'error',
          text1: 'Not Logged In',
          text2: 'Please log in to request food',
        });
        return;
      }

      // Check NGO verification before allowing request
      if (user?.userType === 'ngo' && !isNgoVerified) {
        Toast.show({
          type: 'error',
          text1: 'Verification Required',
          text2: 'Please verify your NGO documents before requesting food',
          visibilityTime: 4000,
        });
        navigation.navigate('NGOVerification');
        return;
      }

      // Check if already requested
      const existingRequest = await firestore()
        .collection('foodRequests')
        .where('donationId', '==', donation.id)
        .where('requesterId', '==', currentUser.uid)
        .get();

      if (!existingRequest.empty) {
        Toast.show({
          type: 'error',
          text1: 'Already Requested',
          text2: 'You have already requested this donation',
        });
        return;
      }

      // Create food request in Firestore
      await firestore().collection('foodRequests').add({
        donationId: donation.id,
        donationTitle: donation.foodType || donation.title,
        requesterId: currentUser.uid,
        requesterEmail: currentUser.email,
        requesterType: user.userType || 'receiver',
        ngoId: user.userType === 'ngo' ? currentUser.uid : null,
        ngoEmail: user.userType === 'ngo' ? currentUser.email : null,
        donorId: donation.donorId,
        donorEmail: donation.donorEmail,
        title: donation.foodType || donation.title,
        quantity: donation.quantity,
        pickupAddress: donation.location,
        status: 'pending',
        matchScore: donation.matchScore || 0,
        matchReason: donation.matchReason || '',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      Toast.show({
        type: 'success',
        text1: 'Request Sent!',
        text2: `Your request for ${donation.foodType} has been sent`,
      });

      addNotification({
        type: 'request_sent',
        title: 'Food Request Sent',
        message: `Waiting for approval from ${donation.donor}`,
      });

      // Refresh donations list
      loadDonations();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send request. Please try again.',
      });
    } finally {
      setIsRequesting(false);
      setShowAllergyModal(false);
      setPendingDonation(null);
    }
  };

  const renderDonation = ({ item }: { item: any }) => (
    <Card style={styles.donationCard}>
      <View style={styles.donationHeader}>
        <View style={styles.iconContainer}>
          <Icon name="fast-food" size={24} color={colors.primary} />
        </View>
        <View style={styles.donationInfo}>
          <Text style={styles.foodType}>{item.foodType}</Text>
          <Text style={styles.donor}>{item.donor}</Text>
        </View>
        <View style={styles.badgeRow}>
          {item.matchScore !== undefined && (
            <Badge 
              text={`${item.matchScore}% Match`} 
              variant={item.matchScore >= 80 ? "success" : item.matchScore >= 50 ? "warning" : "default"} 
              style={{ marginRight: 4 }}
            />
          )}
          <Badge text={item.status} variant="success" />
        </View>
      </View>

      {/* Allergen Warning Section */}
      {item.allergens && item.allergens.length > 0 ? (
        <View style={styles.allergenSection}>
          <View style={styles.allergenHeader}>
             <Icon name="warning" size={16} color={colors.destructive} />
             <Text style={styles.allergenTitle}>Allergy Information</Text>
          </View>
          <AllergyChart selectedAllergens={item.allergens} size={20} showLabels={false} />
        </View>
      ) : (
        <View style={styles.allergenSectionSafe}>
          <Icon name="shield-checkmark" size={16} color={colors.success} />
          <Text style={styles.safeText}>No common allergens reported</Text>
        </View>
      )}

      <View style={styles.donationDetails}>
        <View style={styles.detailRow}>
          <Icon name="cube" size={16} color={colors.mutedForeground} />
          <Text style={styles.detailText}>Quantity: {item.quantity}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="location" size={16} color={colors.mutedForeground} />
          <Text style={styles.detailText} numberOfLines={1}>{item.location}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="navigate" size={16} color={colors.primary} />
          <Text style={[styles.detailText, styles.distanceText]}>{item.distance} away</Text>
        </View>
      </View>

      {/* Verification Warning for NGOs */}
      {user?.userType === 'ngo' && !isNgoVerified && (
        <View style={styles.verificationWarning}>
          <Icon name="warning" size={18} color="#F59E0B" />
          <Text style={styles.verificationWarningText}>
            Please verify your NGO to request food
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('NGOVerification')}>
            <Text style={styles.verifyLink}>Verify Now</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => handleCall(item.donorPhone)}
        >
          <Icon name="call-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => handleChatWithDonor(item)}
        >
          <Icon name="chatbubble-outline" size={18} color={colors.primary} />
          <Text style={styles.chatButtonText}>Chat</Text>
        </TouchableOpacity>
        <View style={styles.requestButton}>
          <Button
            title={user?.userType === 'ngo' && !isNgoVerified ? 'Verify to Request' : 'Request Food'}
            onPress={() => handleRequest(item)}
            fullWidth
            size="sm"
            disabled={user?.userType === 'ngo' && !isNgoVerified}
          />
        </View>
      </View>
    </Card>
  );

  const headerTitle = user.userType === 'ngo' ? 'Request Food' : 'Available Donations';
  const headerSubtitle = user.userType === 'ngo' 
    ? 'Request food for your organization' 
    : 'Find food assistance near you';

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>{headerTitle}</Text>
            <Text style={styles.subtitle}>{headerSubtitle}</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading donations...</Text>
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
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>{headerTitle}</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>
        </View>
      </View>

      {/* Requirement Form Prompt for NGOs */}
      {user?.userType === 'ngo' && isNgoVerified && !ngoRequirement && !checkingRequirement && (
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="fast-food-outline" size={64} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No donations available</Text>
            <Text style={styles.emptySubtext}>
              Check back soon for new donations
            </Text>
          </View>
        }
      />

      {/* Chat Modal */}
      <Modal
        visible={showChatModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChatModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chat with Donor</Text>
              <TouchableOpacity onPress={() => setShowChatModal(false)}>
                <Icon name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {selectedDonor && (
              <>
                <View style={styles.donorInfo}>
                  <View style={styles.donorAvatar}>
                    <Icon name="person" size={32} color={colors.white} />
                  </View>
                  <View style={styles.donorDetails}>
                    <Text style={styles.donorName}>{selectedDonor.donor}</Text>
                    <Text style={styles.donorFood}>{selectedDonor.foodType}</Text>
                  </View>
                </View>

                <View style={styles.chatInfo}>
                  <Icon name="information-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.chatInfoText}>
                    Chat with the donor to ask questions about the food before requesting
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.startChatButton}
                  onPress={handleStartChat}
                >
                  <Icon name="chatbubble" size={20} color={colors.white} />
                  <Text style={styles.startChatButtonText}>Start Chat</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      {/* Allergy Acknowledgment Modal */}
      <Modal
        visible={showAllergyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAllergyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.allergyModalContent}>
            <View style={styles.allergyIconHeader}>
              <View style={styles.allergyWarningCircle}>
                <Icon name="alert-circle" size={40} color={colors.destructive} />
              </View>
            </View>

            <Text style={styles.allergyModalTitle}>Allergy Warning</Text>
            <Text style={styles.allergyModalMsg}>
              This food contains the following potential allergens. Please verify if this is safe for your recipients.
            </Text>

            <View style={styles.allergyListContainer}>
               <AllergyChart 
                selectedAllergens={pendingDonation?.allergens || []} 
                horizontal={false} 
               />
            </View>

            <View style={styles.confirmBox}>
               <Icon name="information-circle-outline" size={18} color={colors.mutedForeground} />
               <Text style={styles.disclaimerText}>
                 By proceeding, you acknowledge that you have verified these ingredients and accept full responsibility for food safety.
               </Text>
            </View>

            <View style={styles.modalButtonsGroup}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowAllergyModal(false)}
              >
                <Text style={styles.cancelBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, isRequesting && { opacity: 0.7 }]}
                onPress={() => executeRequest(pendingDonation)}
                disabled={isRequesting}
              >
                {isRequesting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.confirmBtnText}>I Acknowledge & Request</Text>
                )}
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
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderBottomWidth: 0,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  listContent: {
    padding: spacing.base,
  },
  donationCard: {
    marginBottom: spacing.md,
  },
  donationHeader: {
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
  donationInfo: {
    flex: 1,
  },
  foodType: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  donor: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  donationDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    marginLeft: spacing.sm,
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
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  chatButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
  },
  requestButton: {
    flex: 1,
  },
  distanceText: {
    color: colors.primary,
    fontFamily: typography.fontFamily.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  donorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  donorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  donorDetails: {
    flex: 1,
  },
  donorName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  donorFood: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  chatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}10`,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  chatInfoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
  },
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
  },
  startChatButtonText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  verificationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: 8,
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
  allergenSection: {
    backgroundColor: `${colors.destructive}05`,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.destructive}10`,
  },
  allergenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  allergenTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    color: colors.destructive,
  },
  allergenSectionSafe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.success}05`,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  safeText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.success,
  },
  allergyModalContent: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: spacing.xl,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  allergyIconHeader: {
    marginBottom: spacing.md,
  },
  allergyWarningCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.destructive}10`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allergyModalTitle: {
    fontSize: 22,
    fontFamily: typography.fontFamily.bold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  allergyModalMsg: {
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  allergyListContainer: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  confirmBox: {
    flexDirection: 'row',
    backgroundColor: `${colors.muted}40`,
    padding: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  modalButtonsGroup: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
});

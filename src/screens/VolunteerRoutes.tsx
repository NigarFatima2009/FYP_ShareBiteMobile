import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Linking,
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
import {
  getCurrentLocation,
  requestLocationPermission,
  calculateDistance,
  formatDistance,
  formatDuration,
  estimateTravelTime,
  optimizeRoute,
  geocodeAddress,
  Coordinates,
  RoutePoint,
  OptimizedRoute,
} from '../services/locationService';
import { calculateUrgency, addUrgencyToDonations, sortByUrgency } from '../services/urgencyService';
import { InAppMap } from '../components/InAppMap';
import { runShareBiteAgent, volunteerAgentPersona } from '../utils/AgentHelper';

interface VolunteerRoutesProps {
  navigation: any;
  user: any;
}

export const VolunteerRoutes: React.FC<VolunteerRoutesProps> = ({
  navigation,
  user,
}) => {
  const [pickups, setPickups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedMapMarker, setSelectedMapMarker] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'urgency' | 'distance'>('urgency');

  // Default location (Rawalpindi) - used while fetching actual location
  const DEFAULT_LOCATION: Coordinates = { latitude: 33.5651, longitude: 73.0169 };

  useEffect(() => {
    // Start with default location and load pickups immediately
    setUserLocation(DEFAULT_LOCATION);
    initLocationAndLoad();
  }, []);

  const onFocus = useCallback(() => {
    if (userLocation) {
      loadPickups();
    }
  }, [userLocation]);

  useFocusEffect(onFocus);

  const initLocationAndLoad = async () => {
    // Load pickups with default location first (fast)
    await loadPickupsWithLocation(DEFAULT_LOCATION);

    // Then try to get actual location in background
    try {
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        // Add timeout to location request (5 seconds max)
        const locationPromise = getCurrentLocation();
        const timeoutPromise = new Promise<{ success: false }>((resolve) =>
          setTimeout(() => resolve({ success: false }), 5000)
        );

        const result = await Promise.race([locationPromise, timeoutPromise]) as any;

        if (result.success && result.coordinates) {
          setUserLocation(result.coordinates);
          // Reload pickups with actual location
          await loadPickupsWithLocation(result.coordinates);
        }
      }
    } catch (e) {
      // Silent error - continue with default location
      console.log('Location fetch error:', e);
    }
  };

  const loadPickupsWithLocation = async (location: Coordinates) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Get available donations for volunteers
      const snapshot = await firestore()
        .collection('donations')
        .get();

      let pickupsList = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data };
        })
        .filter((d: any) => {
          // Exclude delivered, cancelled, expired items
          const excludedStatuses = ['delivered', 'cancelled', 'expired'];
          if (excludedStatuses.includes(d.status)) return false;

          // Show available, approved (waiting for volunteer), or items assigned to this volunteer
          return (
            d.status === 'available' ||
            d.status === 'approved' ||
            d.status === 'claimed' ||
            d.status === 'in_transit' ||
            d.volunteerId === currentUser.uid
          );
        });

      // Calculate distance and urgency for each pickup
      pickupsList = pickupsList.map((pickup: any) => {
        let distance = 'N/A';
        let distanceValue = Infinity;
        let coords: Coordinates | null = null;

        if (pickup.coordinates) {
          coords = pickup.coordinates;
        } else if (pickup.pickupAddress) {
          coords = geocodeAddress(pickup.pickupAddress);
        }

        if (coords && location) {
          distanceValue = calculateDistance(location, coords);
          distance = formatDistance(distanceValue);
        }

        // Calculate urgency
        const urgency = calculateUrgency(pickup);

        return {
          ...pickup,
          distance,
          distanceValue,
          coords,
          urgency,
          estimatedTime: distanceValue !== Infinity ? formatDuration(estimateTravelTime(distanceValue)) : 'N/A',
        };
      });

      // Sort based on selected criteria
      if (sortBy === 'urgency') {
        pickupsList = sortByUrgency(pickupsList);
      } else {
        pickupsList.sort((a: any, b: any) => a.distanceValue - b.distanceValue);
      }

      setPickups(pickupsList);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.log('Load pickups error:', error);
      setPickups([]);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadPickups = async () => {
    if (userLocation) {
      await loadPickupsWithLocation(userLocation);
    }
  };


  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimizeRoute = async () => {
    if (!userLocation) {
      Toast.show({
        type: 'error',
        text1: 'Location Not Found',
        text2: 'Please enable location services',
      });
      return;
    }

    if (pickups.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'No Pickups Available',
        text2: 'Accept some pickups first from the Scheduling screen',
      });
      return;
    }

    setIsOptimizing(true);
    Toast.show({
      type: 'info',
      text1: 'AI Dispatch Agent',
      text2: 'Analyzing traffic and urgency...',
    });

    try {
      const currentUser = auth().currentUser;
      let vehicleType = 'car'; // default
      try {
        if (currentUser) {
          const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
          vehicleType = (userDoc.data() as any)?.vehicleDetails?.type || 'car';
        }
      } catch (e) { }

      const currentData = {
        volunteer: { vehicle: vehicleType, location: userLocation },
        pendingPickups: pickups.map(p => ({
          id: p.id,
          title: p.title,
          urgencyLevel: p.urgency?.level,
          distance: p.distance,
          distanceValue: p.distanceValue,
          weightEstimate: p.servings ? (p.servings * 0.5) + 'kg' : 'Unknown', // Rough estimate
        })),
        weather: "Clear" // Ideally fetched from an API
      };

      const agentDecision = await runShareBiteAgent(volunteerAgentPersona, currentData);

      if (agentDecision) {
        // Find the suggested pickup to bump to the top
        const suggestedPickupIndex = pickups.findIndex((p: any) => p.id === agentDecision.assignedDonationId);

        if (suggestedPickupIndex !== -1) {
          // Remove the item...
          const item = pickups.splice(suggestedPickupIndex, 1)[0];
          // And put it at the start of the array
          pickups.unshift(item);
          setPickups([...pickups]);
        }

        if (agentDecision.routeWarning) {
          Toast.show({
            type: 'error',
            text1: 'AI Safety Warning',
            text2: agentDecision.routeWarning,
            visibilityTime: 6000,
          });
        } else {
          Toast.show({
            type: 'success',
            text1: 'Route Optimized!',
            text2: agentDecision.instructions || `Estimated Time: ${agentDecision.estimatedTimeMins} mins`,
            visibilityTime: 5000,
          });
        }
      }
    } catch (e) {
      console.error("Agent routing failed", e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'AI Dispatch failed to optimize. Reverting to standard routing.',
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCall = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Toast.show({
        type: 'error',
        text1: 'No Phone',
        text2: 'Phone number not available',
      });
    }
  };

  const handleChat = (pickup: any) => {
    navigation.navigate('ChatScreen', {
      contactId: pickup.donorId,
      contactName: pickup.donorName || 'Donor',
      contactImage: null,
    });
  };

  const handleOpenMaps = (pickup: any) => {
    // Get valid coordinates
    let coords = pickup.coords;
    if (!isValidCoord(coords)) {
      coords = geocodeAddress(pickup.pickupAddress);
    }
    if (!isValidCoord(coords)) {
      coords = userLocation;
    }
    if (!isValidCoord(coords)) {
      coords = DEFAULT_LOCATION;
    }

    // Open in-app map with this pickup selected
    setSelectedMapMarker({
      id: pickup.id,
      coordinates: {
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
      title: pickup.title || 'Pickup',
      description: pickup.pickupAddress || '',
      type: 'pickup',
      urgency: pickup.urgency?.level,
    });
    setShowMap(true);
  };

  const handleOpenExternalMaps = (pickup: any) => {
    if (pickup.coords) {
      const url = `https://maps.google.com/?daddr=${pickup.coords.latitude},${pickup.coords.longitude}`;
      Linking.openURL(url);
    } else if (pickup.pickupAddress) {
      const url = `https://maps.google.com/?daddr=${encodeURIComponent(pickup.pickupAddress)}`;
      Linking.openURL(url);
    }
  };

  // Helper to validate coordinates
  const isValidCoord = (coord: any): boolean => {
    return (
      coord &&
      typeof coord.latitude === 'number' &&
      typeof coord.longitude === 'number' &&
      !isNaN(coord.latitude) &&
      !isNaN(coord.longitude) &&
      coord.latitude >= -90 &&
      coord.latitude <= 90 &&
      coord.longitude >= -180 &&
      coord.longitude <= 180
    );
  };

  const getMapMarkers = () => {
    return pickups
      .filter(p => p.coords && isValidCoord(p.coords))
      .map(p => ({
        id: p.id,
        coordinates: {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        },
        title: p.title || 'Pickup',
        description: p.pickupAddress || '',
        type: 'pickup' as const,
        urgency: p.urgency?.level,
      }));
  };

  const toggleSortBy = () => {
    const newSort = sortBy === 'urgency' ? 'distance' : 'urgency';
    setSortBy(newSort);

    // Re-sort pickups
    if (newSort === 'urgency') {
      setPickups(sortByUrgency([...pickups]));
    } else {
      setPickups([...pickups].sort((a, b) => a.distanceValue - b.distanceValue));
    }
  };

  const handleStartDelivery = async (pickup: any) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      // Check verification status
      const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
      const userData = userDoc.data();
      const isVerified = userData?.verified === true || userData?.verificationStatus === 'approved';

      if (!isVerified) {
        Toast.show({
          type: 'error',
          text1: 'Verification Required',
          text2: 'Please complete your volunteer verification to start deliveries.',
          onPress: () => navigation.navigate('VolunteerVerification'),
          visibilityTime: 4000,
        });
        return;
      }

      // Get volunteer name
      let volunteerName = userData?.name || userData?.displayName || currentUser.email?.split('@')[0] || 'Volunteer';

      // Update donation status
      await firestore()
        .collection('donations')
        .doc(pickup.id)
        .update({
          status: 'in_transit',
          volunteerId: currentUser.uid,
          volunteerName: volunteerName,
          volunteerEmail: currentUser.email,
          pickupStartedAt: firestore.FieldValue.serverTimestamp(),
        });

      // Update related food request status
      try {
        const requestsSnapshot = await firestore()
          .collection('foodRequests')
          .where('donationId', '==', pickup.id)
          .get();

        for (const doc of requestsSnapshot.docs) {
          await doc.ref.update({
            status: 'in_transit',
            volunteerId: currentUser.uid,
            volunteerName: volunteerName,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (e) {
        console.log('Error updating food request:', e);
      }

      // Create/update delivery tracking document with volunteer's location
      const trackingData: any = {
        donationId: pickup.id,
        volunteerId: currentUser.uid,
        volunteerName: volunteerName,
        volunteerEmail: currentUser.email,
        pickupLocation: pickup.coords || geocodeAddress(pickup.pickupAddress),
        status: 'in_transit',
        startedAt: firestore.FieldValue.serverTimestamp(),
        lastUpdated: firestore.FieldValue.serverTimestamp(),
      };

      if (userLocation) {
        trackingData.volunteerLocation = userLocation;
      }

      await firestore()
        .collection('deliveryTracking')
        .doc(pickup.id)
        .set(trackingData, { merge: true });

      // Send notification to donor
      if (pickup.donorId) {
        await firestore().collection('notifications').add({
          userId: pickup.donorId,
          title: 'Delivery Started!',
          message: `${volunteerName} has started delivering your donation "${pickup.title}"`,
          type: 'delivery_started',
          donationId: pickup.id,
          read: false,
          timestamp: new Date().toISOString(),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      // Send notification to NGO if exists
      if (pickup.ngoId) {
        await firestore().collection('notifications').add({
          userId: pickup.ngoId,
          title: 'Delivery In Progress!',
          message: `${volunteerName} is on the way with "${pickup.title}"`,
          type: 'delivery_started',
          donationId: pickup.id,
          read: false,
          timestamp: new Date().toISOString(),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      Toast.show({
        type: 'success',
        text1: 'Delivery Started',
        text2: 'Your location is now being shared with the requester',
      });

      // Start location updates
      startLocationUpdates(pickup.id);

      // Refresh the list to remove this item
      loadPickups();
    } catch (error) {
      console.log('Start delivery error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to start delivery. Please try again.',
      });
    }
  };

  // Update volunteer location periodically
  const startLocationUpdates = (donationId: string) => {
    const updateLocation = async () => {
      const result = await getCurrentLocation();
      if (result.success && result.coordinates) {
        setUserLocation(result.coordinates);

        // Update location in Firestore and add to traveled path
        await firestore()
          .collection('deliveryTracking')
          .doc(donationId)
          .update({
            volunteerLocation: result.coordinates,
            lastUpdated: firestore.FieldValue.serverTimestamp(),
            // Add to traveled path array
            traveledPath: firestore.FieldValue.arrayUnion({
              latitude: result.coordinates.latitude,
              longitude: result.coordinates.longitude,
              timestamp: new Date().toISOString(),
            }),
          });
      }
    };

    // Initial update
    updateLocation();

    // Update every 10 seconds for smoother tracking
    const intervalId = setInterval(updateLocation, 10000);

    // Store interval ID to clear later (you might want to manage this better)
    return () => clearInterval(intervalId);
  };

  // Mark delivery as complete
  const handleCompleteDelivery = async (pickup: any) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      // Get volunteer name
      let volunteerName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Volunteer';

      // Update donation status to delivered
      await firestore()
        .collection('donations')
        .doc(pickup.id)
        .update({
          status: 'delivered',
          deliveredAt: firestore.FieldValue.serverTimestamp(),
        });

      // Update food request status
      try {
        const requestsSnapshot = await firestore()
          .collection('foodRequests')
          .where('donationId', '==', pickup.id)
          .get();

        for (const doc of requestsSnapshot.docs) {
          await doc.ref.update({
            status: 'delivered',
            deliveredAt: firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (e) { }

      // Update delivery tracking
      await firestore()
        .collection('deliveryTracking')
        .doc(pickup.id)
        .update({
          status: 'delivered',
          deliveredAt: firestore.FieldValue.serverTimestamp(),
        });

      // UPDATE SCHEDULE STATUS TO COMPLETED - THIS WAS MISSING!
      try {
        const schedulesSnapshot = await firestore()
          .collection('schedules')
          .where('donationId', '==', pickup.id)
          .where('volunteerId', '==', currentUser.uid)
          .get();

        for (const doc of schedulesSnapshot.docs) {
          await doc.ref.update({
            status: 'completed',
            completedAt: firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (e) {
        console.log('Error updating schedule:', e);
      }

      // Send notification to donor
      if (pickup.donorId) {
        await firestore().collection('notifications').add({
          userId: pickup.donorId,
          title: 'Delivery Complete!',
          message: `Your donation "${pickup.title}" has been successfully delivered!`,
          type: 'delivery_complete',
          donationId: pickup.id,
          read: false,
          timestamp: new Date().toISOString(),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      // Send notification to NGO
      if (pickup.ngoId) {
        await firestore().collection('notifications').add({
          userId: pickup.ngoId,
          title: 'Food Received!',
          message: `"${pickup.title}" has been delivered by ${volunteerName}`,
          type: 'delivery_complete',
          donationId: pickup.id,
          read: false,
          timestamp: new Date().toISOString(),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      Toast.show({
        type: 'success',
        text1: 'Delivery Complete!',
        text2: 'Thank you for helping reduce food waste!',
      });

      // Refresh the list
      loadPickups();
    } catch (error) {
      console.log('Complete delivery error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to complete delivery',
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (userLocation) {
      await loadPickupsWithLocation(userLocation);
    } else {
      await loadPickupsWithLocation(DEFAULT_LOCATION);
    }
  };

  const renderPickup = ({ item }: { item: any }) => (
    <Card style={[styles.pickupCard, item.urgency?.level === 'high' && styles.urgentCard]}>
      <View style={styles.pickupHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${item.urgency?.color || colors.primary}20` }]}>
          <Icon name="cube" size={24} color={item.urgency?.color || colors.primary} />
        </View>
        <View style={styles.pickupInfo}>
          <Text style={styles.pickupTitle}>{item.title}</Text>
          <Text style={styles.donorName}>{item.donorName || item.donorEmail?.split('@')[0]}</Text>
        </View>
        <View style={styles.badgeColumn}>
          {item.urgency && (
            <View style={[styles.urgencyBadge, { backgroundColor: item.urgency.color }]}>
              <Text style={styles.urgencyBadgeText}>{item.urgency.level.toUpperCase()}</Text>
            </View>
          )}
          <Badge
            text={item.status}
            variant={item.status === 'in_transit' ? 'warning' : 'success'}
          />
        </View>
      </View>

      {item.urgency?.level === 'high' && (
        <View style={styles.urgencyAlert}>
          <Icon name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.urgencyAlertText}>{item.urgency.reasons[0]}</Text>
        </View>
      )}

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Icon name="location-outline" size={16} color={colors.mutedForeground} />
          <Text style={styles.detailText} numberOfLines={2}>{item.pickupAddress}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="navigate-outline" size={16} color={colors.primary} />
            <Text style={styles.statValue}>{item.distance}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="time-outline" size={16} color={colors.primary} />
            <Text style={styles.statValue}>{item.estimatedTime}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="speedometer-outline" size={16} color={item.urgency?.color || colors.primary} />
            <Text style={[styles.statValue, { color: item.urgency?.color }]}>
              {item.urgency?.score || 0}%
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleCall(item.donorPhone)}>
          <Icon name="call-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleChat(item)}>
          <Icon name="chatbubble-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenMaps(item)}>
          <Icon name="map-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenExternalMaps(item)}>
          <Icon name="navigate-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        {item.status === 'in_transit' ? (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => handleCompleteDelivery(item)}
          >
            <Text style={styles.completeButtonText}>Complete</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.startButton, item.urgency?.level === 'high' && styles.urgentStartButton]}
            onPress={() => handleStartDelivery(item)}
          >
            <Text style={styles.startButtonText}>
              {item.urgency?.level === 'high' ? 'URGENT' : 'Start'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Volunteer Routes</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Getting your location...</Text>
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
        <Text style={styles.headerTitle}>Volunteer Routes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowMap(true)} style={styles.headerBtn}>
            <Icon name="map-outline" size={22} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleOptimizeRoute} 
            style={[styles.headerBtn, isOptimizing && { opacity: 0.7 }]}
            disabled={isOptimizing}
          >
            {isOptimizing ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Icon name="analytics-outline" size={22} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort Toggle */}
      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity style={styles.sortToggle} onPress={toggleSortBy}>
          <Icon
            name={sortBy === 'urgency' ? 'alert-circle' : 'navigate'}
            size={16}
            color={colors.primary}
          />
          <Text style={styles.sortText}>
            {sortBy === 'urgency' ? 'Urgency' : 'Distance'}
          </Text>
          <Icon name="swap-vertical" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={styles.countText}>{pickups.length} pickups</Text>
      </View>

      {userLocation && (
        <View style={styles.locationBanner}>
          <Icon name="location" size={16} color={colors.white} />
          <Text style={styles.locationText}>
            Location: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
          </Text>
        </View>
      )}

      {/* In-App Map Modal */}
      <InAppMap
        visible={showMap}
        onClose={() => setShowMap(false)}
        userLocation={userLocation}
        markers={getMapMarkers()}
        selectedMarker={selectedMapMarker}
        onMarkerSelect={setSelectedMapMarker}
        showRoute={showRoute}
      />

      {showRoute && optimizedRoute && (
        <Card style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <Text style={styles.routeTitle}>Optimized Route</Text>
            <TouchableOpacity onPress={() => setShowRoute(false)}>
              <Icon name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={styles.routeStats}>
            <View style={styles.routeStat}>
              <Icon name="navigate" size={20} color={colors.primary} />
              <Text style={styles.routeStatValue}>{optimizedRoute.totalDistanceText}</Text>
              <Text style={styles.routeStatLabel}>Total Distance</Text>
            </View>
            <View style={styles.routeStat}>
              <Icon name="time" size={20} color={colors.primary} />
              <Text style={styles.routeStatValue}>{optimizedRoute.estimatedTimeText}</Text>
              <Text style={styles.routeStatLabel}>Est. Time</Text>
            </View>
          </View>
          <View style={styles.directions}>
            {optimizedRoute.directions.map((dir, idx) => (
              <Text key={idx} style={styles.directionText}>{dir}</Text>
            ))}
          </View>
        </Card>
      )}

      <FlatList
        style={{ flex: 1 }}
        data={pickups}
        keyExtractor={(item) => item.id}
        renderItem={renderPickup}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="always"
        decelerationRate={0.997}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="car-outline" size={64} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No pickups assigned</Text>
            <Text style={styles.emptySubtext}>Check back later for new deliveries</Text>
          </View>
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
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerBtn: {
    padding: spacing.xs,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginRight: spacing.sm,
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  sortText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
  },
  countText: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginLeft: 'auto',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  locationText: {
    fontSize: typography.fontSize.sm,
    color: colors.white,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing['3xl'],
    flexGrow: 1,
  },
  pickupCard: {
    marginBottom: spacing.md,
  },
  pickupHeader: {
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
  pickupInfo: {
    flex: 1,
  },
  pickupTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  donorName: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  detailsContainer: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  detailText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.foreground,
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
  statValue: {
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
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  urgentStartButton: {
    backgroundColor: '#EF4444',
  },
  startButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#22C55E',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  urgentCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  urgencyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  urgencyBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
  urgencyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  urgencyAlertText: {
    fontSize: typography.fontSize.xs,
    color: '#EF4444',
    fontFamily: typography.fontFamily.medium,
    flex: 1,
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
    color: colors.foreground,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  routeCard: {
    margin: spacing.md,
    marginBottom: 0,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  routeTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  routeStat: {
    alignItems: 'center',
  },
  routeStatValue: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  routeStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
  },
  directions: {
    gap: spacing.sm,
  },
  directionText: {
    fontSize: typography.fontSize.sm,
    color: colors.foreground,
    lineHeight: 20,
  },
});

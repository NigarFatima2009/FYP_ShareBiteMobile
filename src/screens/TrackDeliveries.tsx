import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Card } from '../components/common/Card';
import { colors, typography, spacing, borderRadius } from '../theme';
import {
  getCurrentLocation,
  requestLocationPermission,
  calculateDistance,
  formatDistance,
  formatDuration,
  estimateTravelTime,
  geocodeAddress,
  Coordinates,
} from '../services/locationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 280;

// Distance threshold to consider volunteer has arrived (in km)
const ARRIVAL_THRESHOLD_KM = 0.1; // 100 meters

interface TrackDeliveriesProps {
  navigation: any;
  route: any;
}

export const TrackDeliveries: React.FC<TrackDeliveriesProps> = ({
  navigation,
  route,
}) => {
  const { donationId } = route.params || {};
  const mapRef = useRef<MapView>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [delivery, setDelivery] = useState<any>(null);
  const [volunteer, setVolunteer] = useState<any>(null);
  const [volunteerLocation, setVolunteerLocation] = useState<Coordinates | null>(null);
  const [pickupLocation, setPickupLocation] = useState<Coordinates | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Coordinates | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [distance, setDistance] = useState<string>('---');
  const [eta, setEta] = useState<string>('---');
  const [donorPhone, setDonorPhone] = useState<string>('');
  // Track volunteer's traveled path
  const [traveledPath, setTraveledPath] = useState<Coordinates[]>([]);
  const [routePolyline, setRoutePolyline] = useState<Coordinates[]>([]);
  const [hasArrivedAtDestination, setHasArrivedAtDestination] = useState(false);

  useEffect(() => {
    initLocation();
    loadDeliveryData();

    // Set up real-time listeners for both delivery tracking AND donation status
    let unsubscribeTracking: (() => void) | undefined;
    let unsubscribeDonation: (() => void) | undefined;

    // Only set up listener if we have a valid donationId
    if (donationId && typeof donationId === 'string' && donationId.trim().length > 0) {
      const setupListeners = () => {
        try {
          // Listener 1: Delivery tracking (volunteer location)
          unsubscribeTracking = firestore()
            .collection('deliveryTracking')
            .doc(donationId)
            .onSnapshot(
              {
                includeMetadataChanges: false,
              },
              (snapshot) => {
                try {
                  const snapshotExists = Boolean((snapshot as any)?.exists);
                  if (snapshot && snapshotExists) {
                    const data = snapshot.data();

                    // Update volunteer location
                    if (data && data.volunteerLocation) {
                      const volLoc = data.volunteerLocation;
                      if (
                        volLoc &&
                        typeof volLoc.latitude === 'number' &&
                        typeof volLoc.longitude === 'number' &&
                        !isNaN(volLoc.latitude) &&
                        !isNaN(volLoc.longitude)
                      ) {
                        const newLocation = {
                          latitude: volLoc.latitude,
                          longitude: volLoc.longitude,
                        };

                        setVolunteerLocation(newLocation);
                        updateDistanceAndEta(volLoc);

                        // Add to traveled path (avoid duplicates)
                        setTraveledPath(prevPath => {
                          const lastPoint = prevPath[prevPath.length - 1];
                          if (!lastPoint ||
                            lastPoint.latitude !== newLocation.latitude ||
                            lastPoint.longitude !== newLocation.longitude) {
                            return [...prevPath, newLocation];
                          }
                          return prevPath;
                        });
                      }
                    }

                    // Get dropoff location from tracking data
                    if (data && data.dropoffLocation) {
                      const dropLoc = data.dropoffLocation;
                      if (dropLoc && typeof dropLoc.latitude === 'number' && typeof dropLoc.longitude === 'number') {
                        setDropoffLocation({
                          latitude: dropLoc.latitude,
                          longitude: dropLoc.longitude,
                        });
                      }
                    }

                    // Load traveled path from Firestore if available
                    if (data && data.traveledPath && Array.isArray(data.traveledPath)) {
                      const validPath = data.traveledPath
                        .filter((p: any) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number')
                        .map((p: any) => ({ latitude: p.latitude, longitude: p.longitude }));
                      if (validPath.length > 0) {
                        setTraveledPath(validPath);
                      }
                    }
                    // Update delivery status from tracking document
                    if (data && data.status) {
                      setDelivery((prev: any) => prev ? { ...prev, status: data.status } : prev);
                    }
                  }
                } catch (e) {
                  console.log('Error processing tracking snapshot:', e);
                }
              },
              (error) => {
                console.log('Delivery tracking listener error:', error);
              }
            );

          // Listener 2: Donation document (for status updates AND food info)
          unsubscribeDonation = firestore()
            .collection('donations')
            .doc(donationId)
            .onSnapshot(
              (snapshot) => {
                try {
                  const snapshotExists = Boolean((snapshot as any)?.exists);
                  if (snapshot && snapshotExists) {
                    const data = snapshot.data();
                    if (data) {
                      // ALWAYS use fresh data from Firestore, not stale cached data
                      setDelivery((prev: any) => {
                        // Preserve only non-donation fields like donorFullName
                        const preservedFields = prev ? {
                          donorFullName: prev.donorFullName,
                        } : {};
                        return {
                          id: donationId,
                          ...data,  // Fresh data from Firestore
                          ...preservedFields,  // Keep computed fields
                        };
                      });
                    }
                  }
                } catch (e) {
                  console.log('Error processing donation snapshot:', e);
                }
              },
              (error) => {
                console.log('Donation listener error:', error);
              }
            );
        } catch (error) {
          console.log('Error setting up listeners:', error);
        }
      };

      // Small delay to ensure Firestore is ready
      const timeoutId = setTimeout(setupListeners, 100);

      return () => {
        clearTimeout(timeoutId);
        if (unsubscribeTracking) {
          unsubscribeTracking();
        }
        if (unsubscribeDonation) {
          unsubscribeDonation();
        }
      };
    }

    // Return empty cleanup if no donationId
    return () => { };
  }, [donationId]);

  const initLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (hasPermission) {
      const result = await getCurrentLocation();
      if (result.success && result.coordinates) {
        setUserLocation(result.coordinates);
      }
    }
  };

  const loadDeliveryData = async () => {
    try {
      setLoading(true);

      // Load donation data - ALWAYS fetch fresh from Firestore
      let donationData: any = null;
      if (donationId) {
        const donationDoc = await firestore().collection('donations').doc(donationId).get();
        const donationDocExists = Boolean((donationDoc as any)?.exists);
        if (donationDocExists) {
          donationData = { id: donationDoc.id, ...donationDoc.data() };
        }
      }

      // If no donationId, try to find active delivery for current user
      if (!donationData) {
        const currentUser = auth().currentUser;
        if (currentUser) {
          // First check if user is a donor with active deliveries
          const donorDonationsSnapshot = await firestore()
            .collection('donations')
            .where('donorId', '==', currentUser.uid)
            .get();

          // EXCLUDE delivered and cancelled - only show active deliveries
          const donorDeliveries = donorDonationsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((d: any) => {
              const status = d.status;
              // Only include active statuses, NOT delivered or cancelled
              return status === 'approved' || status === 'claimed' ||
                status === 'volunteer_assigned' || status === 'in_transit';
            });

          if (donorDeliveries.length > 0) {
            // Sort by most recent first (by updatedAt or createdAt)
            donorDeliveries.sort((a: any, b: any) => {
              const dateA = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
              const dateB = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
              return dateB.getTime() - dateA.getTime();
            });

            donationData = donorDeliveries[0];
          }

          // If not a donor, check for deliveries where user is NGO or requester
          if (!donationData) {
            const requestsSnapshot = await firestore()
              .collection('foodRequests')
              .get();

            const userRequests = requestsSnapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .filter((r: any) =>
                (r.ngoId === currentUser.uid || r.requesterId === currentUser.uid) &&
                (r.status === 'pending' || r.status === 'approved' || r.status === 'volunteer_assigned' || r.status === 'in_transit')
              );

            if (userRequests.length > 0) {
              // Sort by most recent first
              userRequests.sort((a: any, b: any) => {
                const dateA = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
              });

              const request = userRequests[0] as any;
              if (request.donationId) {
                const donationDoc = await firestore().collection('donations').doc(request.donationId).get();
                const donationDocExists = Boolean((donationDoc as any)?.exists);
                if (donationDocExists) {
                  const donationDocData = donationDoc.data();
                  // Use the most up-to-date status from either donation or request
                  const effectiveStatus = donationDocData?.status || request.status;
                  donationData = {
                    id: donationDoc.id,
                    ...donationDocData,
                    status: effectiveStatus,
                    request
                  };
                }
              }
            }
          }
        }
      }

      if (donationData) {
        // Fetch donor full profile for name and phone
        let donorFullName = 'Donor';
        let donorPhoneNumber = donationData.donorPhone || '';

        if (donationData.donorId) {
          try {
            const donorDoc = await firestore().collection('users').doc(donationData.donorId).get();
            const donorDocExists = Boolean((donorDoc as any)?.exists);
            if (donorDocExists) {
              const donorData = donorDoc.data();
              // Get full name from profile - prioritize profile name
              if (donorData?.name && donorData.name.length > 0) {
                donorFullName = donorData.name;
              } else if (donorData?.displayName && donorData.displayName.length > 0) {
                donorFullName = donorData.displayName;
              } else if (donorData?.fullName && donorData.fullName.length > 0) {
                donorFullName = donorData.fullName;
              } else if (donationData.donorName && !donationData.donorName.includes('@')) {
                donorFullName = donationData.donorName;
              }
              donorPhoneNumber = donorData?.phone || donorData?.phoneNumber || donationData.donorPhone || '';
            }
          } catch (e) {
            // Silent error - use fallback
            if (donationData.donorName && !donationData.donorName.includes('@')) {
              donorFullName = donationData.donorName;
            }
          }
        } else if (donationData.donorName && !donationData.donorName.includes('@')) {
          donorFullName = donationData.donorName;
        }

        // Update donation data with full donor name
        donationData.donorFullName = donorFullName;
        setDonorPhone(donorPhoneNumber);
        setDelivery(donationData);

        // Get pickup location - use Google API for better accuracy
        let pickupCoords = donationData.coordinates;
        if (!pickupCoords || !pickupCoords.latitude) {
          const addr = donationData.pickupAddress || donationData.location || donationData.address;
          if (addr) {
            pickupCoords = await geocodeAddressWithGoogle(addr);
          }
        }
        
        if (pickupCoords) {
          setPickupLocation(pickupCoords);
        }

        // Load volunteer data if assigned
        if (donationData.volunteerId) {
          const volunteerDoc = await firestore().collection('users').doc(donationData.volunteerId).get();
          const volunteerDocExists = Boolean((volunteerDoc as any)?.exists);
          if (volunteerDocExists) {
            setVolunteer({ id: volunteerDoc.id, ...volunteerDoc.data() });
          }

          // Get volunteer's current location from tracking collection
          const trackingDoc = await firestore().collection('deliveryTracking').doc(donationData.id).get();
          const trackingDocExists = Boolean((trackingDoc as any)?.exists);
          if (trackingDocExists) {
            const trackingData = trackingDoc.data();
            if (trackingData?.volunteerLocation) {
              setVolunteerLocation(trackingData.volunteerLocation);
              updateDistanceAndEta(trackingData.volunteerLocation);
            }
          }
        }
      }

      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch route polyline whenever locations change
  useEffect(() => {
    const fetchRoute = async () => {
      if (isValidCoordinate(volunteerLocation) && isValidCoordinate(dropoffLocation || pickupLocation)) {
        const result = await getGoogleDirections(
          volunteerLocation,
          (dropoffLocation || pickupLocation)!
        );
        if (result && result.polyline) {
          setRoutePolyline(result.polyline);
        }
      }
    };
    fetchRoute();
  }, [volunteerLocation, pickupLocation, dropoffLocation]);

  const updateDistanceAndEta = async (volLocation: Coordinates) => {
    // Calculate distance to dropoff (destination) if available, otherwise to pickup
    const destination = dropoffLocation || pickupLocation;

    if (destination && volLocation) {
      const result = await getRealDistanceAndDuration(volLocation, destination);
      setDistance(result.distanceText);
      setEta(result.durationText);

      // Simple Euclidean distance for arrival check (more efficient for threshold)
      const distKm = calculateDistance(volLocation, destination);
      
      // Check if volunteer has arrived at destination (within threshold)
      if (distKm <= ARRIVAL_THRESHOLD_KM && !hasArrivedAtDestination && delivery?.status === 'in_transit') {
        setHasArrivedAtDestination(true);
        handleVolunteerArrived();
      }
    }
  };

  // Handle when volunteer arrives at destination
  const handleVolunteerArrived = async () => {
    try {
      // Show arrival notification
      Toast.show({
        type: 'success',
        text1: 'Volunteer Arrived!',
        text2: 'The volunteer has reached the destination',
        visibilityTime: 5000,
      });

      // Auto-update status to delivered after a short delay
      setTimeout(async () => {
        if (donationId) {
          // Update donation status
          await firestore().collection('donations').doc(donationId).update({
            status: 'delivered',
            deliveredAt: firestore.FieldValue.serverTimestamp(),
          });

          // Update delivery tracking
          await firestore().collection('deliveryTracking').doc(donationId).update({
            status: 'delivered',
            deliveredAt: firestore.FieldValue.serverTimestamp(),
          });

          // Update food request if exists
          try {
            const requestsSnapshot = await firestore()
              .collection('foodRequests')
              .where('donationId', '==', donationId)
              .get();

            for (const doc of requestsSnapshot.docs) {
              await doc.ref.update({
                status: 'delivered',
                deliveredAt: firestore.FieldValue.serverTimestamp(),
              });
            }
          } catch (e) {
            console.log('Error updating food request:', e);
          }

          // Send completion notification
          if (delivery?.donorId) {
            await firestore().collection('notifications').add({
              userId: delivery.donorId,
              title: 'Delivery Complete!',
              message: `Your donation "${delivery.title}" has been delivered successfully!`,
              type: 'delivery_complete',
              donationId,
              read: false,
              timestamp: new Date().toISOString(),
              createdAt: firestore.FieldValue.serverTimestamp(),
            });
          }

          Toast.show({
            type: 'success',
            text1: 'Delivery Complete!',
            text2: 'The food has been delivered successfully',
            visibilityTime: 4000,
          });
        }
      }, 3000); // 3 second delay before marking as delivered
    } catch (error) {
      console.log('Error handling volunteer arrival:', error);
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

  const handleChat = (contactId: string, contactName: string) => {
    if (!contactId) {
      Toast.show({
        type: 'error',
        text1: 'Cannot Chat',
        text2: 'Contact information not available',
      });
      return;
    }
    console.log('Opening chat with contactId:', contactId);
    navigation.navigate('ChatScreen', {
      contactId,
      contactName: contactName || 'User',
      contactImage: null,
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDeliveryData();
  };

  const getStatusSteps = () => {
    const status = delivery?.status || 'pending';
    return [
      {
        id: 1,
        status: 'pending',
        title: 'Request Pending',
        description: 'Waiting for donor approval',
        completed: ['approved', 'volunteer_assigned', 'claimed', 'in_transit', 'delivered'].includes(status),
        active: status === 'pending',
      },
      {
        id: 2,
        status: 'approved',
        title: 'Request Approved',
        description: 'Donor has approved the request',
        completed: ['volunteer_assigned', 'claimed', 'in_transit', 'delivered'].includes(status),
        active: status === 'approved' || status === 'volunteer_assigned',
      },
      {
        id: 3,
        status: 'in_transit',
        title: 'In Transit',
        description: volunteer ? `${volunteer.name || 'Volunteer'} is on the way` : 'Volunteer picking up',
        completed: status === 'delivered',
        active: status === 'in_transit' || status === 'claimed',
      },
      {
        id: 4,
        status: 'delivered',
        title: 'Delivered',
        description: 'Food has been delivered',
        completed: status === 'delivered',
        active: false,
      },
    ];
  };

  // Helper to validate coordinates
  const isValidCoordinate = (coord: Coordinates | null): coord is Coordinates => {
    return (
      coord !== null &&
      coord !== undefined &&
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

  // Fit map to show all markers
  const fitMapToMarkers = () => {
    const allCoords = [volunteerLocation, pickupLocation, dropoffLocation, userLocation].filter(isValidCoordinate);
    
    // Add start and end of route to ensure it's fully visible
    if (routePolyline.length > 0) {
      allCoords.push(routePolyline[0]);
      allCoords.push(routePolyline[routePolyline.length - 1]);
    }

    if (allCoords.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(allCoords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  };

  // Real map using react-native-maps
  const renderMap = () => {
    // Default to Rawalpindi
    const DEFAULT_LAT = 33.5651;
    const DEFAULT_LNG = 73.0169;

    // Get valid coordinates for initial region
    let initialLat = DEFAULT_LAT;
    let initialLng = DEFAULT_LNG;

    if (isValidCoordinate(pickupLocation)) {
      initialLat = pickupLocation.latitude;
      initialLng = pickupLocation.longitude;
    } else if (isValidCoordinate(userLocation)) {
      initialLat = userLocation.latitude;
      initialLng = userLocation.longitude;
    }

    const defaultRegion = {
      latitude: initialLat,
      longitude: initialLng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };

    const hasValidLocations = isValidCoordinate(volunteerLocation) ||
      isValidCoordinate(pickupLocation) ||
      isValidCoordinate(dropoffLocation) ||
      isValidCoordinate(userLocation);

    // Filter traveled path to only valid coordinates
    const validTraveledPath = traveledPath.filter(isValidCoordinate);

    return (
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={defaultRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
          onMapReady={() => {
            console.log('Map is ready');
            fitMapToMarkers();
          }}
          mapType="standard"
          loadingEnabled={true}
          loadingIndicatorColor={colors.primary}
          loadingBackgroundColor={colors.background}
        >
          {/* Traveled path polyline - shows where volunteer has been */}
          {validTraveledPath.length > 1 && (
            <Polyline
              coordinates={validTraveledPath}
              strokeColor={colors.primary}
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Main Route Path (Thick Line) */}
          {routePolyline.length > 0 && (
            <Polyline
              coordinates={routePolyline}
              strokeColor={colors.primary}
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Remaining route line (dashed fallback) - only if routePolyline is empty */}
          {routePolyline.length === 0 && isValidCoordinate(volunteerLocation) && isValidCoordinate(dropoffLocation || pickupLocation) && (
            <Polyline
              coordinates={[
                { latitude: volunteerLocation.latitude, longitude: volunteerLocation.longitude },
                { latitude: (dropoffLocation || pickupLocation)!.latitude, longitude: (dropoffLocation || pickupLocation)!.longitude },
              ]}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[10, 5]}
            />
          )}

          {/* Volunteer marker (moving) - only render if valid */}
          {isValidCoordinate(volunteerLocation) && (
            <Marker
              coordinate={{
                latitude: volunteerLocation.latitude,
                longitude: volunteerLocation.longitude,
              }}
              title="Volunteer"
              description="Delivery volunteer location"
            >
              <View style={styles.volunteerMarkerPin}>
                <Icon name="car" size={20} color={colors.white} />
              </View>
            </Marker>
          )}

          {/* Pickup location marker - only render if valid */}
          {isValidCoordinate(pickupLocation) && (
            <Marker
              coordinate={{
                latitude: pickupLocation.latitude,
                longitude: pickupLocation.longitude,
              }}
              title="Pickup Location"
              description={delivery?.pickupAddress || 'Donor location'}
            >
              <View style={styles.pickupMarkerPin}>
                <Icon name="cube" size={18} color={colors.white} />
              </View>
            </Marker>
          )}

          {/* Dropoff/Destination marker - only render if valid and different from pickup */}
          {isValidCoordinate(dropoffLocation) && (
            <Marker
              coordinate={{
                latitude: dropoffLocation.latitude,
                longitude: dropoffLocation.longitude,
              }}
              title="Destination"
              description="Delivery destination"
            >
              <View style={styles.dropoffMarkerPin}>
                <Icon name="flag" size={18} color={colors.white} />
              </View>
            </Marker>
          )}

          {/* User location marker - only render if valid */}
          {isValidCoordinate(userLocation) && (
            <Marker
              coordinate={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }}
              title="Your Location"
              description="You are here"
            >
              <View style={styles.userMarkerPin}>
                <Icon name="person" size={16} color={colors.white} />
              </View>
            </Marker>
          )}
        </MapView>

        {/* Legend overlay */}
        <View style={styles.mapLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Traveled</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Pickup</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.legendText}>Destination</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>You</Text>
          </View>
        </View>

        {/* Path info overlay */}
        {traveledPath.length > 1 && (
          <View style={styles.pathInfoOverlay}>
            <Icon name="analytics" size={14} color={colors.primary} />
            <Text style={styles.pathInfoText}>{traveledPath.length} points tracked</Text>
          </View>
        )}

        {/* Recenter button */}
        <TouchableOpacity style={styles.recenterBtn} onPress={fitMapToMarkers}>
          <Icon name="locate" size={20} color={colors.primary} />
        </TouchableOpacity>

        {!hasValidLocations && (
          <View style={styles.mapOverlay}>
            <Icon name="map-outline" size={32} color={colors.mutedForeground} />
            <Text style={styles.mapOverlayText}>Waiting for location data...</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading tracking data...</Text>
        </View>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Icon name="cube-outline" size={64} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No active deliveries</Text>
          <Text style={styles.emptySubtext}>Your delivery tracking will appear here</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="always"
        decelerationRate={0.997}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
      >
        {/* Live Map */}
        <Card style={styles.mapCard}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>Live Tracking</Text>
            {volunteerLocation && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
          {renderMap()}
        </Card>

        {/* ETA Card */}
        {(delivery.status === 'in_transit' || delivery.status === 'claimed') && volunteerLocation && (
          <View style={styles.etaCard}>
            <View style={styles.etaItem}>
              <Icon name="navigate" size={24} color={colors.white} />
              <Text style={styles.etaValue}>{distance}</Text>
              <Text style={styles.etaLabel}>Distance</Text>
            </View>
            <View style={styles.etaDivider} />
            <View style={styles.etaItem}>
              <Icon name="time" size={24} color={colors.white} />
              <Text style={styles.etaValue}>{eta}</Text>
              <Text style={styles.etaLabel}>ETA</Text>
            </View>
          </View>
        )}

        {/* Donation Info */}
        <Card>
          <View style={styles.cardHeader}>
            <Icon name="fast-food" size={24} color={colors.primary} />
            <Text style={styles.cardTitle}>{delivery.title}</Text>
          </View>
          <Text style={styles.donationId}>ID: {delivery.id?.slice(0, 8)}...</Text>
          <View style={styles.infoRow}>
            <Icon name="location-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.infoText}>
              {delivery.pickupAddress || delivery.location || delivery.address || 'Address not available'}
            </Text>
          </View>
          {distance && distance !== '---' ? (
            <View style={[styles.infoRow, { marginTop: spacing.xs }]}>
              <Icon name="navigate-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.primary, fontFamily: typography.fontFamily.semibold }]}>
                {distance} away
              </Text>
            </View>
          ) : (
            <View style={[styles.infoRow, { marginTop: spacing.xs }]}>
              <Icon name="time-outline" size={16} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                {delivery.status === 'pending' ? 'Awaiting approval' : 
                 delivery.status === 'approved' ? 'Searching for volunteer...' : 
                 'Locating volunteer...'}
              </Text>
            </View>
          )}
        </Card>

        {/* Volunteer Info */}
        {volunteer && (
          <Card>
            <Text style={styles.sectionTitle}>Volunteer</Text>
            <View style={styles.contactRow}>
              <View style={styles.contactAvatar}>
                <Icon name="person" size={24} color={colors.white} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{volunteer.name || volunteer.email?.split('@')[0]}</Text>
                <Text style={styles.contactRole}>Delivery Volunteer</Text>
              </View>
              <TouchableOpacity style={styles.contactBtn} onPress={() => handleCall(volunteer.phone)}>
                <Icon name="call" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactBtn} onPress={() => handleChat(volunteer.id, volunteer.name || 'Volunteer')}>
                <Icon name="chatbubble" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Donor Info */}
        <Card>
          <Text style={styles.sectionTitle}>Donor</Text>
          <View style={styles.contactRow}>
            <View style={[styles.contactAvatar, { backgroundColor: '#F59E0B' }]}>
              <Icon name="heart" size={24} color={colors.white} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{delivery.donorFullName || delivery.donorName || 'Donor'}</Text>
              <Text style={styles.contactRole}>Food Donor</Text>
              {(donorPhone || delivery.donorPhone) && (
                <Text style={styles.contactPhone}>{donorPhone || delivery.donorPhone}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.contactBtn, !(donorPhone || delivery.donorPhone) && styles.contactBtnDisabled]}
              onPress={() => handleCall(donorPhone || delivery.donorPhone)}
            >
              <Icon name="call" size={20} color={(donorPhone || delivery.donorPhone) ? colors.primary : colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactBtn} onPress={() => handleChat(delivery.donorId, delivery.donorFullName || delivery.donorName || 'Donor')}>
              <Icon name="chatbubble" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Timeline */}
        <Card>
          <Text style={styles.sectionTitle}>Delivery Status</Text>
          <View style={styles.timeline}>
            {getStatusSteps().map((step, index) => (
              <View key={step.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.timelineDot,
                    step.completed && styles.timelineDotCompleted,
                    step.active && styles.timelineDotActive,
                  ]}>
                    {step.completed && <Icon name="checkmark" size={14} color={colors.white} />}
                    {step.active && <View style={styles.activePulse} />}
                  </View>
                  {index < 3 && (
                    <View style={[styles.timelineLine, step.completed && styles.timelineLineCompleted]} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineTitle, step.active && styles.timelineTitleActive]}>
                    {step.title}
                  </Text>
                  <Text style={styles.timelineDesc}>{step.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
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
    color: colors.mutedForeground,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing['3xl'],
    gap: spacing.md,
  },
  mapCard: {
    padding: 0,
    overflow: 'hidden',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: '#EF4444',
  },
  mapContainer: {
    height: MAP_HEIGHT,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  volunteerMarkerPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pickupMarkerPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dropoffMarkerPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  userMarkerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  mapLegend: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 10,
    color: colors.mutedForeground,
    fontFamily: typography.fontFamily.medium,
  },
  recenterBtn: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pathInfoOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  pathInfoText: {
    fontSize: 10,
    color: '#22C55E',
    fontFamily: typography.fontFamily.semibold,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapOverlayText: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  mapErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: spacing.lg,
  },
  mapErrorText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: '#92400E',
    marginTop: spacing.sm,
  },
  mapErrorSubtext: {
    fontSize: typography.fontSize.sm,
    color: '#B45309',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  mapRetryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  mapRetryText: {
    color: colors.white,
    fontFamily: typography.fontFamily.semibold,
  },
  etaCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  etaItem: {
    flex: 1,
    alignItems: 'center',
  },
  etaValue: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
    marginTop: spacing.xs,
  },
  etaLabel: {
    fontSize: typography.fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
  },
  etaDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    flex: 1,
  },
  donationId: {
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.foreground,
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  contactRole: {
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
  },
  contactPhone: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    marginTop: 2,
  },
  contactBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactBtnDisabled: {
    backgroundColor: colors.muted,
    opacity: 0.5,
  },
  timeline: {
    marginTop: spacing.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  timelineDotCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timelineDotActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  activePulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  timelineLineCompleted: {
    backgroundColor: colors.primary,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  timelineTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  timelineTitleActive: {
    color: '#22C55E',
  },
  timelineDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});

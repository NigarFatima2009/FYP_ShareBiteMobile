import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import { colors, typography, spacing } from '../theme';

interface MapsProps {
  navigation: any;
  user: any;
}

interface MapItem {
  id: string;
  title: string;
  type: 'donation' | 'requirement';
  location: { lat: number; lng: number };
  address: string;
  urgency?: string;
  servings?: number;
}

interface RouteInfo {
  distance: number;
  duration: number;
  optimized: boolean;
}

export const Maps: React.FC<MapsProps> = ({ navigation, user }) => {
  const [region, setRegion] = useState({
    latitude: 33.6844,
    longitude: 73.0479,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });
  const [items, setItems] = useState<MapItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
  const [route, setRoute] = useState<any[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    loadDonations();
  }, []);

  const loadDonations = async () => {
    try {
      setLoading(true);
      const firestore = require('@react-native-firebase/firestore').default;

      const donationsSnapshot = await firestore()
        .collection('donations')
        .where('status', '==', 'available')
        .get();

      const requirementsSnapshot = await firestore()
        .collection('ngoRequirements')
        .where('status', '==', 'Active')
        .get();

      const itemsList: MapItem[] = [];

      donationsSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        const bestBefore = new Date(data.bestBefore);
        const now = new Date();
        const hoursLeft = (bestBefore.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        let urgency = 'normal';
        if (hoursLeft < 24) urgency = 'critical';
        else if (hoursLeft < 48) urgency = 'high';

        itemsList.push({
          id: doc.id,
          title: data.title || 'Donation',
          type: 'donation',
          location: data.coordinates || { lat: 33.6844, lng: 73.0479 },
          address: data.pickupAddress || 'Unknown Location',
          urgency,
          servings: parseInt(data.quantity) || 0,
        });
      });

      requirementsSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        let urgency = 'normal';
        if (data.urgencyLevel === 'Critical') urgency = 'critical';
        else if (data.urgencyLevel === 'High') urgency = 'high';

        let loc = { lat: 33.6844, lng: 73.0479 };
        if (data.location && data.location.latitude) {
          loc = { lat: data.location.latitude, lng: data.location.longitude };
        } else if (data.location && data.location._latitude) {
          loc = { lat: data.location._latitude, lng: data.location._longitude };
        }

        itemsList.push({
          id: doc.id,
          title: `Needs: ${data.foodTypeNeeded?.join(', ') || 'Food'}`,
          type: 'requirement',
          location: loc,
          address: 'NGO Location',
          urgency,
          servings: data.quantityNeeded || 0,
        });
      });

      setItems(itemsList);
    } catch (error) {
      console.error('Error loading map data:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load map data',
      });
    } finally {
      setLoading(false);
    }
  };

  const optimizeRoute = async () => {
    // Only optimize route for donations
    const donationItems = items.filter(i => i.type === 'donation');
    if (donationItems.length < 2) {
      Toast.show({
        type: 'info',
        text1: 'Not Enough Locations',
        text2: 'Need at least 2 donations to optimize route',
      });
      return;
    }

    setOptimizing(true);
    try {
      // AI-based route optimization
      const optimizedOrder = await calculateOptimalRoute(donationItems);
      
      // Create route polyline
      const routeCoordinates = optimizedOrder.map(d => ({
        latitude: d.location.lat,
        longitude: d.location.lng,
      }));
      
      setRoute(routeCoordinates);
      
      // Calculate total distance and time
      const totalDistance = calculateTotalDistance(optimizedOrder);
      const totalDuration = Math.round(totalDistance * 3); // Assume 3 min per km
      
      setRouteInfo({
        distance: totalDistance,
        duration: totalDuration,
        optimized: true,
      });

      Toast.show({
        type: 'success',
        text1: 'Route Optimized!',
        text2: `${totalDistance.toFixed(1)}km in ${totalDuration} mins`,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Optimization Failed',
        text2: 'Could not optimize route',
      });
    } finally {
      setOptimizing(false);
    }
  };

  // AI Route Optimization Algorithm (Nearest Neighbor with Priority)
  const calculateOptimalRoute = async (locations: MapItem[]): Promise<MapItem[]> => {
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Sort by urgency first
    const prioritized = [...locations].sort((a, b) => {
      const urgencyScore: Record<string, number> = { critical: 3, high: 2, normal: 1 };
      return (urgencyScore[b.urgency || 'normal'] || 1) - (urgencyScore[a.urgency || 'normal'] || 1);
    });

    // Apply nearest neighbor algorithm
    const optimized: MapItem[] = [];
    const remaining = [...prioritized];
    
    // Start with highest priority
    let current = remaining.shift()!;
    optimized.push(current);

    while (remaining.length > 0) {
      let nearest = remaining[0];
      let minDistance = calculateDistance(
        current.location.lat,
        current.location.lng,
        nearest.location.lat,
        nearest.location.lng
      );

      for (let i = 1; i < remaining.length; i++) {
        const distance = calculateDistance(
          current.location.lat,
          current.location.lng,
          remaining[i].location.lat,
          remaining[i].location.lng
        );
        
        // Prioritize critical items even if slightly farther
        const urgencyBonus = remaining[i].urgency === 'critical' ? 0.7 : 1;
        const adjustedDistance = distance * urgencyBonus;
        
        if (adjustedDistance < minDistance) {
          minDistance = adjustedDistance;
          nearest = remaining[i];
        }
      }

      optimized.push(nearest);
      remaining.splice(remaining.indexOf(nearest), 1);
      current = nearest;
    }

    return optimized;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateTotalDistance = (locations: MapItem[]): number => {
    let total = 0;
    for (let i = 0; i < locations.length - 1; i++) {
      total += calculateDistance(
        locations[i].location.lat,
        locations[i].location.lng,
        locations[i + 1].location.lat,
        locations[i + 1].location.lng
      );
    }
    return total;
  };

  const getMarkerColor = (urgency?: string) => {
    switch (urgency) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      default: return colors.primary;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton
        scrollEnabled={true}
      >
        {items.map((item) => (
          <Marker
            key={item.id}
            coordinate={{
              latitude: item.location.lat,
              longitude: item.location.lng,
            }}
            pinColor={getMarkerColor(item.urgency)}
            onPress={() => setSelectedItem(item)}
          >
            <View style={[styles.customMarker, { backgroundColor: getMarkerColor(item.urgency), borderRadius: item.type === 'requirement' ? 8 : 20 }]}>
              <Icon name={item.type === 'donation' ? 'fast-food' : 'business'} size={20} color={colors.white} />
            </View>
          </Marker>
        ))}

        {route.length > 0 && (
          <Polyline
            coordinates={route}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Optimize Route Button */}
      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.optimizeButton}
          onPress={optimizeRoute}
          disabled={optimizing}
        >
          {optimizing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Icon name="navigate" size={20} color={colors.white} />
              <Text style={styles.optimizeButtonText}>Optimize Route</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Route Info Card */}
      {routeInfo && (
        <View style={styles.routeInfoCard}>
          <View style={styles.routeInfoRow}>
            <Icon name="location" size={20} color={colors.primary} />
            <Text style={styles.routeInfoText}>
              {routeInfo.distance.toFixed(1)} km
            </Text>
          </View>
          <View style={styles.routeInfoRow}>
            <Icon name="time" size={20} color={colors.primary} />
            <Text style={styles.routeInfoText}>
              ~{routeInfo.duration} mins
            </Text>
          </View>
          <View style={styles.routeInfoRow}>
            <Icon name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.routeInfoText}>AI Optimized</Text>
          </View>
        </View>
      )}

      {/* Selected Item Card */}
      {selectedItem && (
        <View style={styles.donationCard}>
          <View style={styles.donationHeader}>
            <Text style={styles.donationTitle}>
              {selectedItem.type === 'requirement' ? 'NGO Requirement' : 'Donation'}: {selectedItem.title}
            </Text>
            <TouchableOpacity onPress={() => setSelectedItem(null)}>
              <Icon name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={styles.donationInfo}>
            <Icon name="location-outline" size={16} color={colors.mutedForeground} />
            <Text style={styles.donationAddress}>{selectedItem.address}</Text>
          </View>
          {selectedItem.urgency && (
            <View style={[styles.urgencyBadge, { backgroundColor: getMarkerColor(selectedItem.urgency) + '20' }]}>
              <Text style={[styles.urgencyText, { color: getMarkerColor(selectedItem.urgency) }]}>
                {selectedItem.urgency.toUpperCase()}
              </Text>
            </View>
          )}
          {selectedItem.type === 'donation' && (
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigation.navigate('DonationDetails', { id: selectedItem.id })}
            >
              <Text style={styles.viewButtonText}>View Details</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={{fontSize: 12, fontWeight: 'bold', marginBottom: 4}}>Map Legend</Text>
        <View style={styles.legendItem}>
          <Icon name="fast-food" size={16} color={colors.primary} />
          <Text style={styles.legendText}>Donation (Circle)</Text>
        </View>
        <View style={styles.legendItem}>
          <Icon name="business" size={16} color={colors.primary} />
          <Text style={styles.legendText}>NGO (Square)</Text>
        </View>
        <View style={[styles.legendItem, {marginTop: 4}]}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Critical Urgency</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>High Urgency</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.mutedForeground,
  },
  topControls: {
    position: 'absolute',
    top: spacing.base,
    left: spacing.base,
    right: spacing.base,
  },
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    gap: spacing.xs,
  },
  optimizeButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
  },
  routeInfoCard: {
    position: 'absolute',
    top: 80,
    left: spacing.base,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    gap: spacing.sm,
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  routeInfoText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
  },
  customMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  donationCard: {
    position: 'absolute',
    bottom: spacing.base,
    left: spacing.base,
    right: spacing.base,
    backgroundColor: colors.white,
    padding: spacing.base,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  donationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  donationTitle: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    flex: 1,
  },
  donationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  donationAddress: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    flex: 1,
  },
  urgencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  urgencyText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
  },
  viewButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
  },
  legend: {
    position: 'absolute',
    bottom: 200,
    right: spacing.base,
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    gap: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.foreground,
  },
});

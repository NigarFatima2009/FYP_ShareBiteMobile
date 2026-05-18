import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '../theme';
import {
  Coordinates,
  calculateDistance,
  formatDistance,
  formatDuration,
  estimateTravelTime,
} from '../services/locationService';

// Helper to validate coordinates
const isValidCoordinate = (coord: Coordinates | null | undefined): coord is Coordinates => {
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

interface MapMarker {
  id: string;
  coordinates: Coordinates;
  title: string;
  description?: string;
  type: 'pickup' | 'dropoff' | 'current' | 'donation';
  urgency?: 'high' | 'medium' | 'low';
}

interface InAppMapProps {
  visible: boolean;
  onClose: () => void;
  userLocation: Coordinates | null;
  markers: MapMarker[];
  selectedMarker?: MapMarker | null;
  onMarkerSelect?: (marker: MapMarker) => void;
  showRoute?: boolean;
  routePoints?: Coordinates[];
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const InAppMap: React.FC<InAppMapProps> = ({
  visible,
  onClose,
  userLocation,
  markers,
  selectedMarker,
  onMarkerSelect,
  showRoute = false,
  routePoints,
}) => {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState({
    latitude: 33.6844,
    longitude: 73.0479,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  // Filter markers to only include those with valid coordinates
  const validMarkers = markers.filter(m => isValidCoordinate(m.coordinates));
  const validUserLocation = isValidCoordinate(userLocation) ? userLocation : null;

  useEffect(() => {
    if (validMarkers.length > 0 || validUserLocation) {
      const allCoords = [
        ...validMarkers.map(m => m.coordinates),
        ...(validUserLocation ? [validUserLocation] : []),
      ];

      if (allCoords.length > 0) {
        const lats = allCoords.map(c => c.latitude);
        const lngs = allCoords.map(c => c.longitude);

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        const latDelta = Math.max(0.02, (maxLat - minLat) * 1.5);
        const lngDelta = Math.max(0.02, (maxLng - minLng) * 1.5);

        setRegion({
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        });
      }
    }
  }, [validMarkers.length, validUserLocation]);

  // Fit map to show all markers
  useEffect(() => {
    if (mapRef.current && (validMarkers.length > 0 || validUserLocation)) {
      const allCoords = [
        ...validMarkers.map(m => m.coordinates),
        ...(validUserLocation ? [validUserLocation] : []),
      ];

      if (allCoords.length > 0) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(allCoords, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          });
        }, 500);
      }
    }
  }, [validMarkers.length, validUserLocation, visible]);

  const getMarkerColor = (marker: MapMarker) => {
    if (marker.type === 'current') return colors.primary;
    // Show urgency colors if available, otherwise default to green (normal)
    if (marker.urgency === 'high') return '#EF4444';
    if (marker.urgency === 'medium') return '#F59E0B';
    if (marker.urgency === 'low') return colors.primary; // Switched from green
    // Default color for markers without urgency - still show them!
    return '#3B82F6'; // Blue for unclassified
  };

  const getMarkerIcon = (marker: MapMarker) => {
    if (marker.type === 'current') return 'person';
    if (marker.type === 'pickup') return 'cube';
    if (marker.type === 'donation') return 'fast-food';
    return 'location';
  };

  // Generate route coordinates for polyline - only valid coordinates
  const getRouteCoordinates = (): Coordinates[] => {
    if (routePoints && routePoints.length > 0) {
      return routePoints.filter(isValidCoordinate);
    }
    if (showRoute && validMarkers.length > 1) {
      return validMarkers.map(m => m.coordinates);
    }
    return [];
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Map View</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Maps Container */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            region={region}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsCompass={true}
            showsTraffic={false}
            mapType="standard"
          >
            {/* User Location Marker - only if valid */}
            {validUserLocation && (
              <Marker
                coordinate={{
                  latitude: validUserLocation.latitude,
                  longitude: validUserLocation.longitude,
                }}
                title="Your Location"
                description="You are here"
                pinColor={colors.primary}
              >
                <View style={styles.userMarkerContainer}>
                  <View style={styles.userMarkerPulse} />
                  <View style={styles.userMarker}>
                    <Icon name="person" size={16} color={colors.white} />
                  </View>
                </View>
              </Marker>
            )}

            {/* Donation/Pickup Markers - only valid ones */}
            {validMarkers.map((marker) => (
              <Marker
                key={marker.id}
                coordinate={{
                  latitude: marker.coordinates.latitude,
                  longitude: marker.coordinates.longitude,
                }}
                title={marker.title}
                description={marker.description}
                onPress={() => onMarkerSelect?.(marker)}
              >
                <View style={[
                  styles.customMarker,
                  { backgroundColor: getMarkerColor(marker) },
                  selectedMarker?.id === marker.id && styles.selectedMarker,
                ]}>
                  <Icon name={getMarkerIcon(marker)} size={16} color={colors.white} />
                  {marker.urgency === 'high' && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.urgentText}>!</Text>
                    </View>
                  )}
                </View>
              </Marker>
            ))}

            {/* Route Polyline - only if valid coordinates */}
            {showRoute && getRouteCoordinates().length > 1 && (
              <Polyline
                coordinates={getRouteCoordinates()}
                strokeColor={colors.primary}
                strokeWidth={4}
                lineDashPattern={[1]}
              />
            )}
          </MapView>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Urgent</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Medium</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Normal</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>You</Text>
          </View>
        </View>

        {/* Selected Marker Details */}
        {selectedMarker && isValidCoordinate(selectedMarker.coordinates) && (
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <Icon name={getMarkerIcon(selectedMarker)} size={24} color={getMarkerColor(selectedMarker)} />
              <View style={styles.detailsInfo}>
                <Text style={styles.detailsTitle}>{selectedMarker.title}</Text>
                {selectedMarker.description && (
                  <Text style={styles.detailsDescription}>{selectedMarker.description}</Text>
                )}
              </View>
              {selectedMarker.urgency && (
                <View style={[styles.urgencyBadge, { backgroundColor: getMarkerColor(selectedMarker) }]}>
                  <Text style={styles.urgencyText}>{selectedMarker.urgency.toUpperCase()}</Text>
                </View>
              )}
            </View>
            {validUserLocation && (
              <View style={styles.distanceInfo}>
                <Icon name="navigate-outline" size={16} color={colors.primary} />
                <Text style={styles.distanceText}>
                  {formatDistance(calculateDistance(validUserLocation, selectedMarker.coordinates))} away
                </Text>
                <Icon name="time-outline" size={16} color={colors.primary} style={{ marginLeft: spacing.md }} />
                <Text style={styles.distanceText}>
                  {formatDuration(estimateTravelTime(calculateDistance(validUserLocation, selectedMarker.coordinates)))}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Markers List - only valid markers */}
        <ScrollView style={styles.markersList}>
          {validMarkers.map((marker) => {
            const distance = validUserLocation
              ? formatDistance(calculateDistance(validUserLocation, marker.coordinates))
              : 'N/A';

            return (
              <TouchableOpacity
                key={marker.id}
                style={[
                  styles.markerListItem,
                  selectedMarker?.id === marker.id && styles.selectedListItem,
                ]}
                onPress={() => onMarkerSelect?.(marker)}
              >
                <View style={[styles.markerListIcon, { backgroundColor: getMarkerColor(marker) }]}>
                  <Icon name={getMarkerIcon(marker)} size={16} color={colors.white} />
                </View>
                <View style={styles.markerListInfo}>
                  <Text style={styles.markerListTitle}>{marker.title}</Text>
                  <Text style={styles.markerListDistance}>{distance}</Text>
                </View>
                {marker.urgency && (
                  <View style={[styles.listUrgencyBadge, { backgroundColor: `${getMarkerColor(marker)}20` }]}>
                    <Text style={[styles.listUrgencyText, { color: getMarkerColor(marker) }]}>
                      {marker.urgency}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
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
    backgroundColor: colors.primary,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
  closeButton: {
    padding: spacing.xs,
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.45,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  userMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: `${colors.primary}30`,
  },
  userMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  customMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  selectedMarker: {
    transform: [{ scale: 1.3 }],
    borderWidth: 3,
    borderColor: colors.white,
  },
  urgentBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  urgentText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
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
    color: colors.mutedForeground,
  },
  detailsCard: {
    backgroundColor: colors.card,
    margin: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailsInfo: {
    flex: 1,
  },
  detailsTitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  detailsDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  urgencyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  urgencyText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  distanceText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontFamily: typography.fontFamily.semibold,
  },
  markersList: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  markerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  selectedListItem: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  markerListIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerListInfo: {
    flex: 1,
  },
  markerListTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  markerListDistance: {
    fontSize: typography.fontSize.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  listUrgencyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  listUrgencyText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.semibold,
    textTransform: 'capitalize',
  },
});

export default InAppMap;

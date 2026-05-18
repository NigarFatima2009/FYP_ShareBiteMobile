/**
 * Location Service
 * Handles GPS location, distance calculation, and route optimization
 */

import { PermissionsAndroid, Platform } from 'react-native';

// Try to import Geolocation, fallback to null if not available
let Geolocation: any = null;
try {
  Geolocation = require('@react-native-community/geolocation').default;
} catch (e) {
  // Geolocation not available, will use fallback
}

// Types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  success: boolean;
  coordinates?: Coordinates;
  error?: string;
}

export interface DistanceResult {
  distance: number; // in kilometers
  distanceText: string;
  duration?: number; // in minutes
  durationText?: string;
}

export interface RoutePoint {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  type: 'pickup' | 'dropoff' | 'current';
}

export interface OptimizedRoute {
  points: RoutePoint[];
  totalDistance: number;
  totalDistanceText: string;
  estimatedTime: number;
  estimatedTimeText: string;
  directions: string[];
}

// ==================== PERMISSION HANDLING ====================

/**
 * Request location permission
 */
export const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    return true; // iOS handles permissions automatically
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'ShareBite needs access to your location to show nearby donations and calculate distances.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    return false;
  }
};

// ==================== GET CURRENT LOCATION ====================

/**
 * Get current user location
 */
export const getCurrentLocation = (): Promise<LocationResult> => {
  return new Promise((resolve) => {
    // If Geolocation is not available, return default location (Rawalpindi)
    if (!Geolocation) {
      resolve({
        success: true,
        coordinates: {
          latitude: 33.5651,
          longitude: 73.0169,
        },
      });
      return;
    }

    Geolocation.getCurrentPosition(
      (position: any) => {
        resolve({
          success: true,
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      },
      (error: any) => {
        // Fallback to default location on error
        resolve({
          success: true,
          coordinates: {
            latitude: 33.5651,
            longitude: 73.0169,
          },
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  });
};

// ==================== DISTANCE CALCULATION ====================

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export const calculateDistance = (
  point1: Coordinates,
  point2: Coordinates
): number => {
  const R = 6371; // Earth's radius in kilometers
  
  const lat1 = point1.latitude * (Math.PI / 180);
  const lat2 = point2.latitude * (Math.PI / 180);
  const deltaLat = (point2.latitude - point1.latitude) * (Math.PI / 180);
  const deltaLon = (point2.longitude - point1.longitude) * (Math.PI / 180);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal
};

/**
 * Format distance for display
 */
export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

/**
 * Estimate travel time based on distance
 * Assumes average speed of 30 km/h in city traffic
 */
export const estimateTravelTime = (distanceKm: number): number => {
  const avgSpeedKmH = 30; // Average city speed
  return Math.ceil((distanceKm / avgSpeedKmH) * 60); // Minutes
};

/**
 * Format duration for display
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

/**
 * Get distance and duration between two points
 */
export const getDistanceAndDuration = (
  from: Coordinates,
  to: Coordinates
): DistanceResult => {
  const distance = calculateDistance(from, to);
  const duration = estimateTravelTime(distance);
  
  return {
    distance,
    distanceText: formatDistance(distance),
    duration,
    durationText: formatDuration(duration),
  };
};

/**
 * Get real road distance and duration between two points using Google Distance Matrix API
 */
export const getRealDistanceAndDuration = async (
  origin: Coordinates,
  destination: Coordinates
): Promise<DistanceResult> => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.latitude},${origin.longitude}&destinations=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const element = data.rows[0].elements[0];
      return {
        distance: element.distance.value / 1000,
        distanceText: element.distance.text,
        duration: Math.ceil(element.duration.value / 60),
        durationText: element.duration.text,
      };
    }
  } catch (error) {
    console.error('Distance Matrix error:', error);
  }
  
  return getDistanceAndDuration(origin, destination);
};

// ==================== ROUTE OPTIMIZATION ====================

/**
 * Optimize route using Nearest Neighbor algorithm
 * Simple but effective for small number of points
 */
export const optimizeRoute = (
  startPoint: RoutePoint,
  destinations: RoutePoint[]
): OptimizedRoute => {
  if (destinations.length === 0) {
    return {
      points: [startPoint],
      totalDistance: 0,
      totalDistanceText: '0 km',
      estimatedTime: 0,
      estimatedTimeText: '0 min',
      directions: [],
    };
  }

  const optimizedPoints: RoutePoint[] = [startPoint];
  const remaining = [...destinations];
  let currentPoint = startPoint;
  let totalDistance = 0;

  // Nearest Neighbor Algorithm
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    // Find nearest unvisited point
    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateDistance(
        currentPoint.coordinates,
        remaining[i].coordinates
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    // Add nearest point to route
    const nextPoint = remaining.splice(nearestIndex, 1)[0];
    optimizedPoints.push(nextPoint);
    totalDistance += nearestDistance;
    currentPoint = nextPoint;
  }

  const estimatedTime = estimateTravelTime(totalDistance);

  // Generate directions
  const directions = generateDirections(optimizedPoints);

  return {
    points: optimizedPoints,
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalDistanceText: formatDistance(totalDistance),
    estimatedTime,
    estimatedTimeText: formatDuration(estimatedTime),
    directions,
  };
};

/**
 * Generate turn-by-turn directions (simplified)
 */
const generateDirections = (points: RoutePoint[]): string[] => {
  const directions: string[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const distance = calculateDistance(from.coordinates, to.coordinates);
    const bearing = calculateBearing(from.coordinates, to.coordinates);
    const direction = bearingToDirection(bearing);
    
    directions.push(
      `${i + 1}. Head ${direction} to ${to.name} (${formatDistance(distance)})`
    );
  }
  
  if (points.length > 1) {
    directions.push(`${points.length}. Arrive at final destination`);
  }
  
  return directions;
};

/**
 * Calculate bearing between two points
 */
const calculateBearing = (from: Coordinates, to: Coordinates): number => {
  const lat1 = from.latitude * (Math.PI / 180);
  const lat2 = to.latitude * (Math.PI / 180);
  const deltaLon = (to.longitude - from.longitude) * (Math.PI / 180);

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  bearing = (bearing + 360) % 360;
  
  return bearing;
};

/**
 * Convert bearing to cardinal direction
 */
const bearingToDirection = (bearing: number): string => {
  const directions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
};

// ==================== DONATION DISTANCE HELPERS ====================

/**
 * Add distance to donations list
 */
export const addDistanceToDonations = async (
  donations: any[],
  userLocation?: Coordinates
): Promise<any[]> => {
  let currentLocation = userLocation;
  
  // Get current location if not provided
  if (!currentLocation) {
    const hasPermission = await requestLocationPermission();
    if (hasPermission) {
      const locationResult = await getCurrentLocation();
      if (locationResult.success && locationResult.coordinates) {
        currentLocation = locationResult.coordinates;
      }
    }
  }
  
  // If still no location, return donations with "N/A" distance
  if (!currentLocation) {
    return donations.map(d => ({
      ...d,
      distance: 'N/A',
      distanceValue: Infinity,
    }));
  }
  
  // Calculate distance for each donation
  return donations.map(donation => {
    const donationCoords = donation.coordinates || {
      latitude: donation.lat || 0,
      longitude: donation.lng || donation.lon || 0,
    };
    
    // Check if donation has valid coordinates
    if (!donationCoords.latitude || !donationCoords.longitude) {
      return {
        ...donation,
        distance: 'N/A',
        distanceValue: Infinity,
      };
    }
    
    const result = getDistanceAndDuration(currentLocation, donationCoords);
    
    return {
      ...donation,
      distance: result.distanceText,
      distanceValue: result.distance,
      estimatedTime: result.durationText,
    };
  });
};

/**
 * Sort donations by distance
 */
export const sortByDistance = (donations: any[]): any[] => {
  return [...donations].sort((a, b) => {
    const distA = a.distanceValue ?? Infinity;
    const distB = b.distanceValue ?? Infinity;
    return distA - distB;
  });
};

// ==================== GEOCODING (Address to Coordinates) ====================

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyCF6-tsFF1z8mDPtsLiozUID9HUNuNxYnQ';

/**
 * Geocode address using Google Maps Geocoding API
 * Falls back to local database if API fails
 */
export const geocodeAddressWithGoogle = async (address: string): Promise<Coordinates | null> => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    }
  } catch {
    // Fall back to local geocoding
  }
  
  return geocodeAddress(address);
};

/**
 * Simple geocoding using address keywords (fallback)
 */
export const geocodeAddress = (address: string): Coordinates | null => {
  // Known locations in Pakistan (comprehensive list)
  const knownLocations: { [key: string]: Coordinates } = {
    'rawalpindi': { latitude: 33.5651, longitude: 73.0169 },
    'islamabad': { latitude: 33.6844, longitude: 73.0479 },
    'lahore': { latitude: 31.5204, longitude: 74.3587 },
    'karachi': { latitude: 24.8607, longitude: 67.0011 },
  };
  
  const lowerAddress = address.toLowerCase();
  for (const [key, coords] of Object.entries(knownLocations)) {
    if (lowerAddress.includes(key)) {
      return coords;
    }
  }
  
  if (address.trim().length > 0) {
    return { latitude: 33.5651, longitude: 73.0169 };
  }
  
  return null;
};

/**
 * Get place suggestions using Google Places Autocomplete API
 */
export const getPlaceSuggestions = async (input: string): Promise<any[]> => {
  if (!input || input.length < 3) return [];
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_API_KEY}&components=country:pk`
    );
    const data = await response.json();
    
    if (data.status === 'OK') {
      return data.predictions.map((p: any) => ({
        description: p.description,
        placeId: p.place_id,
        mainText: p.structured_formatting.main_text,
        secondaryText: p.structured_formatting.secondary_text,
      }));
    }
  } catch (error) {
    console.error('Autocomplete error:', error);
  }
  return [];
};

/**
 * Get coordinates for a place ID using Google Place Details API
 */
export const getPlaceDetails = async (placeId: string): Promise<Coordinates | null> => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status === 'OK' && data.result.geometry) {
      const location = data.result.geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    }
  } catch (error) {
    console.error('Place details error:', error);
  }
  return null;
};

/**
 * Get directions between two points using Google Maps Directions API
 */
export const getGoogleDirections = async (
  origin: Coordinates,
  destination: Coordinates
): Promise<{ distance: number; duration: number; polyline: Coordinates[] } | null> => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status === 'OK' && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      
      // Decode polyline
      const polyline = decodePolyline(route.overview_polyline.points);
      
      return {
        distance: leg.distance.value / 1000, // Convert to km
        duration: leg.duration.value / 60, // Convert to minutes
        polyline,
      };
    }
  } catch {
    // Return null on error
  }
  
  return null;
};

/**
 * Decode Google Maps polyline
 */
const decodePolyline = (encoded: string): Coordinates[] => {
  const points: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
};

export default {
  requestLocationPermission,
  getCurrentLocation,
  calculateDistance,
  formatDistance,
  estimateTravelTime,
  formatDuration,
  getDistanceAndDuration,
  optimizeRoute,
  addDistanceToDonations,
  sortByDistance,
  geocodeAddress,
  geocodeAddressWithGoogle,
  getGoogleDirections,
  getPlaceSuggestions,
  getPlaceDetails,
  getRealDistanceAndDuration,
};

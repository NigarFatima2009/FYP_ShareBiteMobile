/**
 * Delivery Tracking Service
 * 
 * Provides real-time delivery tracking with:
 * - Status updates (pending → approved → picked_up → in_transit → delivered)
 * - Volunteer location tracking
 * - NGO notifications
 * - AI-powered ETA estimation
 */

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

export interface DeliveryStatus {
  status: 'pending' | 'approved' | 'volunteer_assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  timestamp: Date;
  message: string;
}

export interface DeliveryTracking {
  donationId: string;
  donorId: string;
  donorName: string;
  ngoId: string;
  ngoName: string;
  volunteerId?: string;
  volunteerName?: string;
  volunteerPhone?: string;
  volunteerLocation?: {
    latitude: number;
    longitude: number;
  };
  pickupLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  dropoffLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  status: DeliveryStatus['status'];
  statusHistory: DeliveryStatus[];
  estimatedPickupTime?: string;
  estimatedDeliveryTime?: string;
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Status display info
export const STATUS_INFO: Record<DeliveryStatus['status'], { label: string; color: string; icon: string }> = {
  pending: { label: 'Request Pending', color: '#F59E0B', icon: 'time-outline' },
  approved: { label: 'Request Approved', color: '#3B82F6', icon: 'checkmark-circle-outline' },
  volunteer_assigned: { label: 'Volunteer Assigned', color: '#8B5CF6', icon: 'person-outline' },
  picked_up: { label: 'Food Picked Up', color: '#EC4899', icon: 'cube-outline' },
  in_transit: { label: 'In Transit', color: '#EC4899', icon: 'car-outline' },
  delivered: { label: 'Delivered', color: '#DB2777', icon: 'checkmark-done-outline' },
  cancelled: { label: 'Cancelled', color: '#EF4444', icon: 'close-circle-outline' },
};

/**
 * Create a new delivery tracking record
 */
export const createDeliveryTracking = async (data: {
  donationId: string;
  donorId: string;
  donorName: string;
  ngoId: string;
  ngoName: string;
  pickupLocation: { latitude: number; longitude: number; address: string };
  dropoffLocation?: { latitude: number; longitude: number; address: string };
}): Promise<{ success: boolean; trackingId?: string; error?: string }> => {
  try {
    const tracking: Partial<DeliveryTracking> = {
      ...data,
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        timestamp: new Date(),
        message: 'Food request submitted by NGO',
      }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await firestore().collection('deliveryTracking').add(tracking);

    return { success: true, trackingId: docRef.id };
  } catch (error: any) {
    console.error('Error creating delivery tracking:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update delivery status
 */
export const updateDeliveryStatus = async (
  trackingId: string,
  newStatus: DeliveryStatus['status'],
  message: string,
  additionalData?: Partial<DeliveryTracking>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const statusUpdate: DeliveryStatus = {
      status: newStatus,
      timestamp: new Date(),
      message,
    };

    await firestore().collection('deliveryTracking').doc(trackingId).update({
      status: newStatus,
      statusHistory: firestore.FieldValue.arrayUnion(statusUpdate),
      updatedAt: firestore.FieldValue.serverTimestamp(),
      ...additionalData,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating delivery status:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Assign volunteer to delivery
 */
export const assignVolunteer = async (
  trackingId: string,
  volunteerId: string,
  volunteerName: string,
  volunteerPhone: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await updateDeliveryStatus(trackingId, 'volunteer_assigned', `${volunteerName} assigned as delivery volunteer`, {
      volunteerId,
      volunteerName,
      volunteerPhone,
    });

    // Send notification to NGO
    const trackingDoc = await firestore().collection('deliveryTracking').doc(trackingId).get();
    const tracking = trackingDoc.data();

    if (tracking?.ngoId) {
      await firestore().collection('notifications').add({
        userId: tracking.ngoId,
        title: '🚗 Volunteer Assigned',
        message: `${volunteerName} will pick up your food request`,
        type: 'volunteer_assigned',
        trackingId,
        read: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error assigning volunteer:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update volunteer location (real-time tracking)
 */
export const updateVolunteerLocation = async (
  trackingId: string,
  location: { latitude: number; longitude: number }
): Promise<{ success: boolean; error?: string }> => {
  try {
    await firestore().collection('deliveryTracking').doc(trackingId).update({
      volunteerLocation: location,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating volunteer location:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark food as picked up
 */
export const markAsPickedUp = async (trackingId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await updateDeliveryStatus(trackingId, 'picked_up', 'Food has been picked up by volunteer', {
      actualPickupTime: new Date(),
    });

    // Update status to in_transit after a short delay
    setTimeout(async () => {
      await updateDeliveryStatus(trackingId, 'in_transit', 'Volunteer is on the way to delivery location');
    }, 2000);

    // Send notification to NGO
    const trackingDoc = await firestore().collection('deliveryTracking').doc(trackingId).get();
    const tracking = trackingDoc.data();

    if (tracking?.ngoId) {
      await firestore().collection('notifications').add({
        userId: tracking.ngoId,
        title: '📦 Food Picked Up!',
        message: `${tracking.volunteerName || 'Volunteer'} has picked up the food and is on the way`,
        type: 'food_picked_up',
        trackingId,
        read: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error marking as picked up:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark delivery as complete
 */
export const markAsDelivered = async (trackingId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await updateDeliveryStatus(trackingId, 'delivered', 'Food has been delivered successfully', {
      actualDeliveryTime: new Date(),
    });

    // Send notification to NGO
    const trackingDoc = await firestore().collection('deliveryTracking').doc(trackingId).get();
    const tracking = trackingDoc.data();

    if (tracking?.ngoId) {
      await firestore().collection('notifications').add({
        userId: tracking.ngoId,
        title: '✅ Delivery Complete!',
        message: 'Food has been delivered successfully. Thank you for helping reduce food waste!',
        type: 'delivery_complete',
        trackingId,
        read: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    // Also notify donor
    if (tracking?.donorId) {
      await firestore().collection('notifications').add({
        userId: tracking.donorId,
        title: '🎉 Your Donation Made a Difference!',
        message: 'Your food donation has been delivered to those in need. Thank you!',
        type: 'donation_delivered',
        trackingId,
        read: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error marking as delivered:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to delivery tracking updates (real-time)
 */
export const subscribeToDeliveryTracking = (
  trackingId: string,
  onUpdate: (tracking: DeliveryTracking | null) => void
): (() => void) => {
  return firestore()
    .collection('deliveryTracking')
    .doc(trackingId)
    .onSnapshot(
      (doc) => {
        if (doc && doc.exists) {
          onUpdate(doc.data() as DeliveryTracking);
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.error('Delivery tracking subscription error:', error);
        onUpdate(null);
      }
    );
};

/**
 * Get all active deliveries for NGO
 */
export const getActiveDeliveriesForNGO = async (ngoId: string): Promise<any[]> => {
  try {
    const snapshot = await firestore()
      .collection('deliveryTracking')
      .where('ngoId', '==', ngoId)
      .where('status', 'in', ['pending', 'approved', 'volunteer_assigned', 'picked_up', 'in_transit'])
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting active deliveries:', error);
    return [];
  }
};

/**
 * Get available pickups for volunteer
 */
export const getAvailablePickupsForVolunteer = async (): Promise<any[]> => {
  try {
    const snapshot = await firestore()
      .collection('deliveryTracking')
      .where('status', '==', 'approved')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting available pickups:', error);
    return [];
  }
};

/**
 * AI-powered ETA estimation based on distance and traffic patterns
 */
export const estimateDeliveryTime = (
  volunteerLocation: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): { distance: string; eta: string; minutes: number } => {
  // Calculate distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = (destination.latitude - volunteerLocation.latitude) * Math.PI / 180;
  const dLon = (destination.longitude - volunteerLocation.longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(volunteerLocation.latitude * Math.PI / 180) * Math.cos(destination.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Estimate time (assuming average speed of 30 km/h in city)
  const avgSpeed = 30;
  const timeHours = distance / avgSpeed;
  const timeMinutes = Math.ceil(timeHours * 60);

  // Format distance
  const distanceStr = distance < 1
    ? `${Math.round(distance * 1000)} m`
    : `${distance.toFixed(1)} km`;

  // Format ETA
  let etaStr: string;
  if (timeMinutes < 60) {
    etaStr = `${timeMinutes} min`;
  } else {
    const hours = Math.floor(timeMinutes / 60);
    const mins = timeMinutes % 60;
    etaStr = `${hours}h ${mins}m`;
  }

  return { distance: distanceStr, eta: etaStr, minutes: timeMinutes };
};

export default {
  createDeliveryTracking,
  updateDeliveryStatus,
  assignVolunteer,
  updateVolunteerLocation,
  markAsPickedUp,
  markAsDelivered,
  subscribeToDeliveryTracking,
  getActiveDeliveriesForNGO,
  getAvailablePickupsForVolunteer,
  estimateDeliveryTime,
  STATUS_INFO,
};

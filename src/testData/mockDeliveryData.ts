/**
 * Mock Data for Complete Delivery Flow Testing
 * 
 * Complete Flow:
 * 1. Donor creates donation
 * 2. NGO requests the food
 * 3. Donor approves request
 * 4. Volunteer gets notified and accepts pickup
 * 5. Volunteer picks up food (status: picked_up)
 * 6. Volunteer in transit with real-time location (status: in_transit)
 * 7. Volunteer delivers to NGO (status: delivered)
 */

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// Valid coordinates for Rawalpindi/Islamabad area
export const MOCK_LOCATIONS = {
  volunteerStart: { latitude: 33.5651, longitude: 73.0169 },
  pickups: [
    { latitude: 33.5731, longitude: 73.0297 },
    { latitude: 33.5891, longitude: 73.0489 },
  ],
  dropoff: { latitude: 33.5981, longitude: 73.0389 },
};

// Volunteer movement path (13 points)
export const MOCK_VOLUNTEER_PATH = [
  { latitude: 33.5651, longitude: 73.0169 },
  { latitude: 33.5681, longitude: 73.0199 },
  { latitude: 33.5701, longitude: 73.0239 },
  { latitude: 33.5721, longitude: 73.0269 },
  { latitude: 33.5731, longitude: 73.0297 }, // Pickup point
  { latitude: 33.5761, longitude: 73.0329 },
  { latitude: 33.5801, longitude: 73.0349 },
  { latitude: 33.5841, longitude: 73.0369 },
  { latitude: 33.5881, longitude: 73.0379 },
  { latitude: 33.5921, longitude: 73.0385 },
  { latitude: 33.5951, longitude: 73.0387 },
  { latitude: 33.5981, longitude: 73.0389 }, // Dropoff point
];

// Mock Donor
export const MOCK_DONOR = {
  id: 'mock_donor_1',
  name: 'Ahmed Khan',
  email: 'ahmed.donor@example.com',
  phone: '+92 300 1234567',
  userType: 'donor',
};

// Mock NGO
export const MOCK_NGO = {
  id: 'mock_ngo_1',
  name: 'Helping Hands Foundation',
  email: 'help@hhf.org',
  phone: '+92 311 2223344',
  userType: 'ngo',
  address: 'Office 12, G-9 Markaz, Islamabad',
  coordinates: MOCK_LOCATIONS.dropoff,
  verified: true,
  ngoVerified: true,
};

// Mock Volunteer
export const MOCK_VOLUNTEER = {
  id: 'mock_volunteer_1',
  name: 'Ali Raza',
  email: 'ali.volunteer@example.com',
  phone: '+92 345 6789012',
  userType: 'volunteer',
  rating: 4.8,
};

// Mock Donation
export const MOCK_DONATIONS = [
  {
    id: 'mock_donation_1',
    title: 'Fresh Biryani - 20 Servings',
    description: 'Freshly cooked chicken biryani',
    quantity: '20 servings',
    status: 'available',
    donorId: MOCK_DONOR.id,
    donorName: MOCK_DONOR.name,
    donorEmail: MOCK_DONOR.email,
    donorPhone: MOCK_DONOR.phone,
    pickupAddress: 'House 45, F-7/2, Islamabad',
    coordinates: MOCK_LOCATIONS.pickups[0],
    expiryTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  },
];

// Mock Food Request
export const MOCK_FOOD_REQUESTS = [
  {
    id: 'mock_request_1',
    donationId: 'mock_donation_1',
    ngoId: MOCK_NGO.id,
    ngoName: MOCK_NGO.name,
    ngoEmail: MOCK_NGO.email,
    title: 'Fresh Biryani - 20 Servings',
    quantity: '20 servings',
    status: 'pending',
  },
];

/**
 * Initialize base mock data (users only)
 */
export const initializeMockData = async () => {
  try {
    // Add mock users
    await firestore().collection('users').doc(MOCK_DONOR.id).set(MOCK_DONOR, { merge: true });
    await firestore().collection('users').doc(MOCK_NGO.id).set(MOCK_NGO, { merge: true });
    await firestore().collection('users').doc(MOCK_VOLUNTEER.id).set(MOCK_VOLUNTEER, { merge: true });
    
    console.log('✅ Users initialized');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Init error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Step 1: Donor creates donation
 */
export const simulateDonorCreatesDonation = async (donationId: string = 'mock_donation_1') => {
  try {
    const donation = MOCK_DONATIONS[0];
    
    await firestore().collection('donations').doc(donation.id).set({
      ...donation,
      status: 'available',
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✅ Donation created');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Step 2: NGO requests the donation
 */
export const simulateNGORequestsDonation = async (donationId: string = 'mock_donation_1') => {
  try {
    const request = MOCK_FOOD_REQUESTS[0];
    
    // Create food request
    await firestore().collection('foodRequests').doc(request.id).set({
      ...request,
      status: 'pending',
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    // Notify donor
    await firestore().collection('notifications').add({
      userId: MOCK_DONOR.id,
      title: '📬 New Food Request!',
      message: `${MOCK_NGO.name} wants your donation`,
      type: 'food_request',
      donationId,
      read: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✅ NGO requested donation');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Step 3: Donor approves request
 */
export const simulateDonorApprovesRequest = async (donationId: string = 'mock_donation_1') => {
  try {
    const request = MOCK_FOOD_REQUESTS[0];
    
    // Update request
    await firestore().collection('foodRequests').doc(request.id).update({
      status: 'approved',
    });
    
    // Update donation
    await firestore().collection('donations').doc(donationId).update({
      status: 'approved',
    });
    
    // Create delivery tracking
    await firestore().collection('deliveryTracking').doc(donationId).set({
      donationId,
      donorId: MOCK_DONOR.id,
      donorName: MOCK_DONOR.name,
      ngoId: MOCK_NGO.id,
      ngoName: MOCK_NGO.name,
      pickupLocation: MOCK_LOCATIONS.pickups[0],
      dropoffLocation: MOCK_LOCATIONS.dropoff,
      status: 'approved',
      traveledPath: [],
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    // Notify NGO
    await firestore().collection('notifications').add({
      userId: MOCK_NGO.id,
      title: '✅ Request Approved!',
      message: 'Your food request has been approved',
      type: 'request_approved',
      donationId,
      read: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    // Notify volunteers
    await firestore().collection('notifications').add({
      userId: MOCK_VOLUNTEER.id,
      title: '🚗 New Pickup Available!',
      message: 'A new food pickup is available near you',
      type: 'pickup_available',
      donationId,
      read: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✅ Request approved');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Step 4: Volunteer accepts pickup
 */
export const simulateVolunteerAcceptPickup = async (donationId: string = 'mock_donation_1') => {
  try {
    // Update donation
    await firestore().collection('donations').doc(donationId).update({
      status: 'claimed',
      volunteerId: MOCK_VOLUNTEER.id,
      volunteerName: MOCK_VOLUNTEER.name,
    });
    
    // Update tracking
    await firestore().collection('deliveryTracking').doc(donationId).update({
      volunteerId: MOCK_VOLUNTEER.id,
      volunteerName: MOCK_VOLUNTEER.name,
      volunteerPhone: MOCK_VOLUNTEER.phone,
      volunteerLocation: MOCK_LOCATIONS.volunteerStart,
      status: 'volunteer_assigned',
    });
    
    // Notify NGO
    await firestore().collection('notifications').add({
      userId: MOCK_NGO.id,
      title: '🚗 Volunteer Assigned!',
      message: `${MOCK_VOLUNTEER.name} will pick up your food`,
      type: 'volunteer_assigned',
      donationId,
      read: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✅ Volunteer accepted');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Step 5: Start delivery (volunteer picks up food)
 */
export const simulateStartDelivery = async (donationId: string = 'mock_donation_1') => {
  try {
    // Update donation
    await firestore().collection('donations').doc(donationId).update({
      status: 'in_transit',
    });
    
    // Update tracking
    await firestore().collection('deliveryTracking').doc(donationId).update({
      status: 'in_transit',
      volunteerLocation: MOCK_LOCATIONS.volunteerStart,
    });
    
    // Notify NGO
    await firestore().collection('notifications').add({
      userId: MOCK_NGO.id,
      title: '📦 Food Picked Up!',
      message: `${MOCK_VOLUNTEER.name} is on the way`,
      type: 'delivery_started',
      donationId,
      read: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✅ Delivery started');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Step 6: Simulate volunteer movement (real-time location updates)
 */
export const simulateVolunteerMovement = async (
  donationId: string = 'mock_donation_1',
  onLocationUpdate?: (location: { latitude: number; longitude: number }, index: number) => void
) => {
  let currentIndex = 0;
  let stopped = false;
  const traveledPath: { latitude: number; longitude: number; timestamp: string }[] = [];
  
  const updateLocation = async () => {
    if (stopped || currentIndex >= MOCK_VOLUNTEER_PATH.length) {
      // When movement is complete, check if we reached destination
      if (currentIndex >= MOCK_VOLUNTEER_PATH.length && !stopped) {
        // Auto-complete delivery when volunteer reaches destination
        setTimeout(() => {
          simulateDeliveryComplete(donationId);
        }, 2000);
      }
      return;
    }
    
    const newLocation = MOCK_VOLUNTEER_PATH[currentIndex];
    
    // Add to traveled path
    traveledPath.push({
      latitude: newLocation.latitude,
      longitude: newLocation.longitude,
      timestamp: new Date().toISOString(),
    });
    
    try {
      await firestore().collection('deliveryTracking').doc(donationId).update({
        volunteerLocation: {
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
        },
        traveledPath: traveledPath,
      });
      
      onLocationUpdate?.(newLocation, currentIndex);
    } catch (e) {
      console.log('Location update error:', e);
    }
    
    currentIndex++;
    
    if (!stopped && currentIndex < MOCK_VOLUNTEER_PATH.length) {
      setTimeout(updateLocation, 2000); // Update every 2 seconds
    } else if (!stopped && currentIndex >= MOCK_VOLUNTEER_PATH.length) {
      // Reached destination
      setTimeout(() => {
        simulateDeliveryComplete(donationId);
      }, 2000);
    }
  };
  
  updateLocation();
  
  return {
    stop: () => {
      stopped = true;
    },
  };
};

/**
 * Step 7: Complete delivery
 */
export const simulateDeliveryComplete = async (donationId: string = 'mock_donation_1') => {
  try {
    // Update donation
    await firestore().collection('donations').doc(donationId).update({
      status: 'delivered',
    });
    
    // Update request
    await firestore().collection('foodRequests').doc('mock_request_1').update({
      status: 'delivered',
    });
    
    // Update tracking
    await firestore().collection('deliveryTracking').doc(donationId).update({
      status: 'delivered',
      volunteerLocation: MOCK_LOCATIONS.dropoff,
    });
    
    // Notify NGO
    await firestore().collection('notifications').add({
      userId: MOCK_NGO.id,
      title: '✅ Delivery Complete!',
      message: 'Food has been delivered successfully',
      type: 'delivery_complete',
      donationId,
      read: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    // Notify Donor
    await firestore().collection('notifications').add({
      userId: MOCK_DONOR.id,
      title: '🎉 Your Donation Helped!',
      message: 'Your food donation has been delivered',
      type: 'donation_delivered',
      donationId,
      read: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✅ Delivery complete');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Run full simulation
 */
export const runFullDeliverySimulation = async (
  donationId: string = 'mock_donation_1',
  onStepComplete?: (step: string, message: string) => void
) => {
  const notify = (step: string, msg: string) => {
    console.log(`${step}: ${msg}`);
    onStepComplete?.(step, msg);
  };
  
  notify('1/8', 'Initializing users...');
  await initializeMockData();
  await delay(500);
  
  notify('2/8', 'Donor creating donation...');
  await simulateDonorCreatesDonation(donationId);
  await delay(1000);
  
  notify('3/8', 'NGO requesting food...');
  await simulateNGORequestsDonation(donationId);
  await delay(1000);
  
  notify('4/8', 'Donor approving request...');
  await simulateDonorApprovesRequest(donationId);
  await delay(1000);
  
  notify('5/8', 'Volunteer accepting pickup...');
  await simulateVolunteerAcceptPickup(donationId);
  await delay(1000);
  
  notify('6/8', 'Starting delivery...');
  await simulateStartDelivery(donationId);
  await delay(1000);
  
  notify('7/8', 'Volunteer moving...');
  await simulateVolunteerMovement(donationId, (loc, idx) => {
    notify('Moving', `Point ${idx + 1}/${MOCK_VOLUNTEER_PATH.length}`);
  });
  await delay(MOCK_VOLUNTEER_PATH.length * 2000 + 1000);
  
  notify('8/8', 'Completing delivery...');
  await simulateDeliveryComplete(donationId);
  
  notify('Done', '🎉 Simulation complete!');
  return { success: true };
};

/**
 * Cleanup mock data
 */
export const cleanupMockData = async () => {
  try {
    await firestore().collection('donations').doc('mock_donation_1').delete();
    await firestore().collection('foodRequests').doc('mock_request_1').delete();
    await firestore().collection('deliveryTracking').doc('mock_donation_1').delete();
    console.log('✅ Cleaned up');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default {
  MOCK_LOCATIONS,
  MOCK_VOLUNTEER_PATH,
  MOCK_DONATIONS,
  MOCK_FOOD_REQUESTS,
  MOCK_DONOR,
  MOCK_NGO,
  MOCK_VOLUNTEER,
  initializeMockData,
  simulateDonorCreatesDonation,
  simulateNGORequestsDonation,
  simulateDonorApprovesRequest,
  simulateVolunteerAcceptPickup,
  simulateStartDelivery,
  simulateVolunteerMovement,
  simulateDeliveryComplete,
  runFullDeliverySimulation,
  cleanupMockData,
};

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateUser } = require('../middleware/auth');
const { db } = require('../config/firebase');
const { autoAssignVolunteer, scoreVolunteers } = require('../services/aiService');

// ==================== CREATE DELIVERY (with AI volunteer assignment) ====================
router.post('/', [
  authenticateUser,
  body('donationId').notEmpty(),
  body('pickupLocation').isObject(),
  body('pickupLocation.lat').isFloat({ min: -90, max: 90 }),
  body('pickupLocation.lng').isFloat({ min: -180, max: 180 }),
  body('dropoffLocation').isObject(),
  body('dropoffLocation.lat').isFloat({ min: -90, max: 90 }),
  body('dropoffLocation.lng').isFloat({ min: -180, max: 180 }),
  body('pickupTime').isISO8601(),
  body('urgency').optional().isIn(['normal', 'high', 'critical'])
], async (req, res) => {
  try {
    // Only NGOs can create deliveries
    if (req.user.userType !== 'ngo') {
      return res.status(403).json({
        success: false,
        message: 'Only NGOs can create deliveries'
      });
    }
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const {
      donationId,
      pickupLocation,
      dropoffLocation,
      pickupTime,
      urgency = 'normal'
    } = req.body;
    
    // Get donation details
    const donationDoc = await db.collection('donations').doc(donationId).get();
    if (!donationDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }
    
    const donation = donationDoc.data();
    
    // Get available volunteers
    const volunteersSnapshot = await db.collection('users')
      .where('userType', '==', 'volunteer')
      .where('available', '==', true)
      .get();
    
    const volunteers = [];
    volunteersSnapshot.forEach(doc => {
      volunteers.push({
        uid: doc.id,
        ...doc.data()
      });
    });
    
    // AI Feature 5: Auto-assign best volunteer
    const assignmentResult = autoAssignVolunteer(volunteers, {
      pickupLocation,
      pickupTime,
      urgency
    });
    
    if (!assignmentResult.success) {
      return res.status(400).json({
        success: false,
        message: assignmentResult.message
      });
    }
    
    const delivery = {
      donationId,
      ngoId: req.user.uid,
      volunteerId: assignmentResult.volunteer.uid,
      volunteerName: assignmentResult.volunteer.name,
      donorId: donation.donorId,
      donorName: donation.donorName,
      pickupLocation,
      dropoffLocation,
      pickupTime,
      urgency,
      status: 'assigned',
      assignmentScore: assignmentResult.volunteer.assignmentScore,
      assignmentReasons: assignmentResult.volunteer.assignmentReasons,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await db.collection('deliveries').add(delivery);
    
    // Update volunteer status
    await db.collection('users').doc(assignmentResult.volunteer.uid).update({
      status: 'assigned',
      currentDeliveryId: docRef.id,
      updatedAt: new Date().toISOString()
    });
    
    // Notify volunteer
    await db.collection('notifications').add({
      userId: assignmentResult.volunteer.uid,
      type: 'delivery_task',
      title: '🚚 New Delivery Task',
      message: `Pickup ${donation.title} from ${donation.location}`,
      metadata: {
        deliveryId: docRef.id,
        donationId,
        urgency
      },
      priority: urgency === 'critical' ? 'critical' : 'high',
      color: urgency === 'critical' ? 'red' : 'orange',
      sound: true,
      read: false,
      createdAt: new Date().toISOString()
    });
    
    // Notify donor
    await db.collection('notifications').add({
      userId: donation.donorId,
      type: 'volunteer_assigned',
      title: '👤 Volunteer Assigned',
      message: `${assignmentResult.volunteer.name} will pick up your donation`,
      metadata: {
        deliveryId: docRef.id,
        volunteerId: assignmentResult.volunteer.uid
      },
      priority: 'high',
      color: 'orange',
      sound: false,
      read: false,
      createdAt: new Date().toISOString()
    });
    
    console.log(`\n🤖 ========================================`);
    console.log(`AI VOLUNTEER ASSIGNMENT`);
    console.log(`========================================`);
    console.log(`📦 Donation: ${donation.title}`);
    console.log(`👤 Assigned: ${assignmentResult.volunteer.name}`);
    console.log(`⭐ Score: ${assignmentResult.volunteer.assignmentScore}/100`);
    console.log(`📍 Distance: ${assignmentResult.volunteer.distanceToPickup}km`);
    console.log(`💡 Reasons: ${assignmentResult.volunteer.assignmentReasons.join(', ')}`);
    console.log(`========================================\n`);
    
    res.status(201).json({
      success: true,
      message: 'Delivery created and volunteer assigned',
      delivery: {
        id: docRef.id,
        ...delivery
      },
      aiAssignment: {
        volunteer: {
          uid: assignmentResult.volunteer.uid,
          name: assignmentResult.volunteer.name,
          score: assignmentResult.volunteer.assignmentScore,
          reasons: assignmentResult.volunteer.assignmentReasons
        },
        alternatives: assignmentResult.alternatives
      }
    });
  } catch (error) {
    console.error('Create delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create delivery',
      error: error.message
    });
  }
});

// ==================== GET ALL DELIVERIES ====================
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let query = db.collection('deliveries');
    
    // Filter based on user type
    if (req.user.userType === 'volunteer') {
      query = query.where('volunteerId', '==', req.user.uid);
    } else if (req.user.userType === 'ngo') {
      query = query.where('ngoId', '==', req.user.uid);
    } else if (req.user.userType === 'donor') {
      query = query.where('donorId', '==', req.user.uid);
    }
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    query = query.orderBy('createdAt', 'desc').limit(parseInt(limit));
    
    const snapshot = await query.get();
    
    const deliveries = [];
    snapshot.forEach(doc => {
      deliveries.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json({
      success: true,
      count: deliveries.length,
      deliveries
    });
  } catch (error) {
    console.error('Get deliveries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get deliveries',
      error: error.message
    });
  }
});

// ==================== GET DELIVERY BY ID ====================
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const doc = await db.collection('deliveries').doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }
    
    const delivery = doc.data();
    
    // Check authorization
    const authorized = 
      delivery.volunteerId === req.user.uid ||
      delivery.ngoId === req.user.uid ||
      delivery.donorId === req.user.uid;
    
    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this delivery'
      });
    }
    
    res.json({
      success: true,
      delivery: {
        id: doc.id,
        ...delivery
      }
    });
  } catch (error) {
    console.error('Get delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get delivery',
      error: error.message
    });
  }
});

// ==================== UPDATE DELIVERY STATUS ====================
router.put('/:id/status', [
  authenticateUser,
  body('status').isIn(['assigned', 'in_transit', 'picked_up', 'delivered', 'cancelled']),
  body('currentLocation').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const deliveryRef = db.collection('deliveries').doc(req.params.id);
    const doc = await deliveryRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }
    
    const delivery = doc.data();
    
    // Only volunteer can update status
    if (delivery.volunteerId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Only assigned volunteer can update delivery status'
      });
    }
    
    const { status, currentLocation } = req.body;
    
    const updates = {
      status,
      updatedAt: new Date().toISOString()
    };
    
    if (currentLocation) {
      updates.currentLocation = currentLocation;
    }
    
    if (status === 'delivered') {
      updates.deliveredAt = new Date().toISOString();
      
      // Update volunteer status
      await db.collection('users').doc(req.user.uid).update({
        status: 'available',
        currentDeliveryId: null,
        completedDeliveries: (delivery.completedDeliveries || 0) + 1,
        updatedAt: new Date().toISOString()
      });
      
      // Update donation status
      await db.collection('donations').doc(delivery.donationId).update({
        status: 'delivered',
        deliveredAt: new Date().toISOString()
      });
      
      // Notify donor and NGO
      await db.collection('notifications').add({
        userId: delivery.donorId,
        type: 'delivery_completed',
        title: '✅ Delivery Completed',
        message: `Your donation has been successfully delivered`,
        metadata: { deliveryId: req.params.id },
        priority: 'medium',
        color: 'blue',
        sound: false,
        read: false,
        createdAt: new Date().toISOString()
      });
      
      await db.collection('notifications').add({
        userId: delivery.ngoId,
        type: 'delivery_completed',
        title: '✅ Delivery Completed',
        message: `Donation received successfully`,
        metadata: { deliveryId: req.params.id },
        priority: 'medium',
        color: 'blue',
        sound: false,
        read: false,
        createdAt: new Date().toISOString()
      });
    }
    
    await deliveryRef.update(updates);
    
    console.log(`📦 [DELIVERY] Status updated to: ${status} - Delivery ID: ${req.params.id}`);
    
    res.json({
      success: true,
      message: `Delivery status updated to ${status}`
    });
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery status',
      error: error.message
    });
  }
});

// ==================== UPDATE LOCATION (Real-time tracking) ====================
router.put('/:id/location', [
  authenticateUser,
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lng').isFloat({ min: -180, max: 180 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const deliveryRef = db.collection('deliveries').doc(req.params.id);
    const doc = await deliveryRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }
    
    const delivery = doc.data();
    
    // Only volunteer can update location
    if (delivery.volunteerId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Only assigned volunteer can update location'
      });
    }
    
    const { lat, lng } = req.body;
    
    await deliveryRef.update({
      currentLocation: { lat, lng },
      lastLocationUpdate: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Location updated'
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location',
      error: error.message
    });
  }
});

module.exports = router;

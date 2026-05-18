const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateUser } = require('../middleware/auth');
const { db } = require('../config/firebase');

// ==================== GET USER PROFILE ====================
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }
    
    const userData = userDoc.data();
    
    res.json({
      success: true,
      user: {
        uid: userId,
        ...userData,
        // Don't send sensitive data
        password: undefined
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// ==================== UPDATE USER PROFILE ====================
router.put('/profile', [
  authenticateUser,
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('location').optional().isObject(),
  body('location.lat').optional().isFloat({ min: -90, max: 90 }),
  body('location.lng').optional().isFloat({ min: -180, max: 180 }),
  body('preferredCategories').optional().isArray(),
  body('maxDistance').optional().isInt({ min: 1, max: 100 }),
  body('minServings').optional().isInt({ min: 0 })
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
    
    const userId = req.user.uid;
    const updates = {};
    
    // Only update provided fields
    const allowedFields = [
      'name', 'phone', 'address', 'location', 
      'preferredCategories', 'maxDistance', 'minServings',
      'bio', 'organizationName', 'website'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    updates.updatedAt = new Date().toISOString();
    
    await db.collection('users').doc(userId).update(updates);
    
    // Get updated profile
    const updatedDoc = await db.collection('users').doc(userId).get();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        uid: userId,
        ...updatedDoc.data()
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// ==================== GET USER BY ID ====================
router.get('/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const userData = userDoc.data();
    
    // Return public profile only
    res.json({
      success: true,
      user: {
        uid: userId,
        name: userData.name,
        userType: userData.userType,
        organizationName: userData.organizationName,
        bio: userData.bio,
        rating: userData.rating,
        completedDeliveries: userData.completedDeliveries,
        totalDonations: userData.totalDonations,
        // Don't expose sensitive data
        email: undefined,
        phone: undefined,
        address: undefined
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

// ==================== GET VOLUNTEERS (for assignment) ====================
router.get('/volunteers/available', authenticateUser, async (req, res) => {
  try {
    // Only NGOs can access this
    if (req.user.userType !== 'ngo') {
      return res.status(403).json({
        success: false,
        message: 'Only NGOs can access volunteer list'
      });
    }
    
    const volunteersSnapshot = await db.collection('users')
      .where('userType', '==', 'volunteer')
      .where('available', '==', true)
      .get();
    
    const volunteers = [];
    volunteersSnapshot.forEach(doc => {
      volunteers.push({
        uid: doc.id,
        ...doc.data(),
        email: undefined, // Don't expose email
        password: undefined
      });
    });
    
    res.json({
      success: true,
      count: volunteers.length,
      volunteers
    });
  } catch (error) {
    console.error('Get volunteers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch volunteers'
    });
  }
});

// ==================== UPDATE VOLUNTEER AVAILABILITY ====================
router.put('/volunteer/availability', [
  authenticateUser,
  body('available').isBoolean(),
  body('currentLocation').optional().isObject(),
  body('currentLocation.lat').optional().isFloat({ min: -90, max: 90 }),
  body('currentLocation.lng').optional().isFloat({ min: -180, max: 180 })
], async (req, res) => {
  try {
    // Only volunteers can update availability
    if (req.user.userType !== 'volunteer') {
      return res.status(403).json({
        success: false,
        message: 'Only volunteers can update availability'
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
    
    const userId = req.user.uid;
    const { available, currentLocation } = req.body;
    
    const updates = {
      available,
      status: available ? 'available' : 'offline',
      updatedAt: new Date().toISOString()
    };
    
    if (currentLocation) {
      updates.currentLocation = currentLocation;
    }
    
    await db.collection('users').doc(userId).update(updates);
    
    res.json({
      success: true,
      message: `Availability updated to ${available ? 'available' : 'offline'}`
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update availability'
    });
  }
});

module.exports = router;

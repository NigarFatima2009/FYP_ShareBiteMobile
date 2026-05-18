const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateUser } = require('../middleware/auth');
const { db } = require('../config/firebase');
const dbService = require('../services/dbService'); // Local JSON database
const { 
  categorizeDonation, 
  validateExpiry, 
  recommendDonations 
} = require('../services/aiService');
const { detectDuplicateDonation, findSimilarDonations } = require('../services/mlService');
const { notifyAllNGOs } = require('./notifications');

// ==================== AI: CATEGORIZE DONATION ====================
router.post('/ai/categorize', authenticateUser, [
  body('title').trim().notEmpty(),
  body('description').optional().trim()
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
    
    const { title, description = '' } = req.body;
    
    const result = categorizeDonation(title, description);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Categorize error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to categorize donation'
    });
  }
});

// ==================== AI: VALIDATE EXPIRY ====================
router.post('/ai/validate-expiry', authenticateUser, [
  body('expiryDate').notEmpty().isISO8601(),
  body('pickupTime').optional().isISO8601()
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
    
    const { expiryDate, pickupTime } = req.body;
    
    const result = validateExpiry(expiryDate, pickupTime);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Validate expiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate expiry'
    });
  }
});

// ==================== ML: CHECK DUPLICATE DONATION ====================
router.post('/ml/check-duplicate', authenticateUser, [
  body('title').trim().notEmpty(),
  body('description').optional().trim()
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
    
    const { title, description = '' } = req.body;
    
    // Get donor's existing donations
    const donorDonationsSnapshot = await db.collection('donations')
      .where('donorId', '==', req.user.uid)
      .where('status', '==', 'available')
      .get();
    
    const existingDonations = [];
    donorDonationsSnapshot.forEach(doc => {
      existingDonations.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Check for duplicates using ML
    const result = detectDuplicateDonation(
      { title, description },
      existingDonations,
      0.75 // 75% similarity threshold
    );
    
    console.log(`🤖 [ML DUPLICATE CHECK] ${result.message}`);
    if (result.isDuplicate) {
      console.log(`   Similarity: ${result.highestSimilarity * 100}%`);
      console.log(`   Similar to: "${result.duplicates[0].title}"`);
    }
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Duplicate check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check for duplicates'
    });
  }
});

// ==================== ML: FIND SIMILAR DONATIONS ====================
router.post('/ml/find-similar', authenticateUser, [
  body('title').trim().notEmpty(),
  body('description').optional().trim()
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
    
    const { title, description = '' } = req.body;
    
    // Get all available donations
    const allDonationsSnapshot = await db.collection('donations')
      .where('status', '==', 'available')
      .limit(100)
      .get();
    
    const allDonations = [];
    allDonationsSnapshot.forEach(doc => {
      allDonations.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Find similar donations using ML
    const result = findSimilarDonations(
      { title, description },
      allDonations,
      0.60 // 60% similarity threshold
    );
    
    console.log(`🤖 [ML SIMILARITY SEARCH] Found ${result.count} similar donations`);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Find similar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find similar donations'
    });
  }
});

// ==================== CREATE DONATION (with AI + ML) ====================
router.post('/', [
  authenticateUser,
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('foodType').optional().trim(),
  body('servings').isInt({ min: 1 }).withMessage('Servings must be at least 1'),
  body('bestBefore').isISO8601().withMessage('Valid expiry date required'),
  body('pickupTime').isISO8601().withMessage('Valid pickup time required'),
  body('location').notEmpty().withMessage('Pickup location is required'),
  body('coordinates').optional().isObject(),
  body('coordinates.lat').optional().isFloat({ min: -90, max: 90 }),
  body('coordinates.lng').optional().isFloat({ min: -180, max: 180 }),
  body('specialInstructions').optional().trim(),
  body('images').optional().isArray(),
  body('isVegetarian').optional().isBoolean(),
  body('isVegan').optional().isBoolean(),
  body('isHalal').optional().isBoolean(),
  body('allergens').optional().isArray()
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
    
    // Check if user exists and get user data
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    
    // For testing: Allow if user doesn't exist or create default user data
    let userData;
    if (!userDoc.exists) {
      console.log('⚠️  User not found in database, creating default donor profile');
      userData = {
        name: req.user.name || req.user.email?.split('@')[0] || 'Anonymous Donor',
        email: req.user.email,
        phone: req.user.phone || 'N/A',
        userType: 'donor'
      };
      // Save to Firebase for future use
      try {
        await db.collection('users').doc(req.user.uid).set(userData);
      } catch (err) {
        console.log('⚠️  Could not save user to Firebase:', err.message);
      }
    } else {
      userData = userDoc.data();
      // If userType not set, default to donor
      if (!userData.userType) {
        userData.userType = 'donor';
        try {
          await db.collection('users').doc(req.user.uid).update({ userType: 'donor' });
        } catch (err) {
          console.log('⚠️  Could not update user type:', err.message);
        }
      }
      // Check if user is a donor
      if (userData.userType !== 'donor') {
        return res.status(403).json({
          success: false,
          message: 'Only donors can create donations. Your account type is: ' + userData.userType
        });
      }
    }
    
    const {
      title,
      description = '',
      foodType,
      servings,
      bestBefore,
      pickupTime,
      location,
      coordinates,
      specialInstructions = '',
      images = [],
      isVegetarian = false,
      isVegan = false,
      isHalal = false,
      allergens = []
    } = req.body;
    
    // ML Feature: Check for duplicate donations (from local database)
    const allDonations = await dbService.getAllDonations();
    const existingDonations = allDonations.filter(
      d => d.donorId === req.user.uid && d.status === 'available'
    );
    
    const duplicateCheck = detectDuplicateDonation(
      { title, description },
      existingDonations,
      0.75 // 75% similarity threshold
    );
    
    // AI Feature 1: Auto-categorize if not provided
    let category = foodType;
    let aiCategorization = null;
    if (!category) {
      aiCategorization = categorizeDonation(title, description);
      category = aiCategorization.suggested;
    }
    
    // AI Feature 2: Validate expiry
    const expiryValidation = validateExpiry(bestBefore, pickupTime);
    if (!expiryValidation.valid) {
      console.log(`❌ [AI VALIDATION FAILED] ${expiryValidation.errors.join(', ')}`);
      return res.status(400).json({
        success: false,
        message: expiryValidation.errors[0] || 'Expiry validation failed',
        aiInsights: {
          expiryValidation: {
            valid: false,
            errors: expiryValidation.errors,
            warnings: expiryValidation.warnings,
            status: expiryValidation.status
          }
        }
      });
    }
    
    // userData is already defined above, no need to redeclare
    
    const donation = {
      donorId: req.user.uid,
      donorName: userData.name,
      donorEmail: req.user.email,
      donorPhone: userData.phone,
      title,
      description,
      foodType: category,
      servings: parseInt(servings),
      bestBefore,
      pickupTime,
      location,
      coordinates: coordinates || null,
      specialInstructions,
      images,
      isVegetarian,
      isVegan,
      isHalal,
      allergens,
      status: 'available',
      urgency: expiryValidation.urgency,
      hoursUntilExpiry: expiryValidation.hoursUntilExpiry,
      aiCategorized: !!aiCategorization,
      category: category,
      mlDuplicateCheck: duplicateCheck.isDuplicate,
      mlSimilarityScore: duplicateCheck.highestSimilarity,
      views: 0,
      interestedNGOs: 0
    };
    
    // Save to local JSON database
    const savedDonation = await dbService.addDonation(donation);
    
    // Also save to Firebase (optional - for backup)
    try {
      await db.collection('donations').doc(savedDonation.id).set(savedDonation);
    } catch (firebaseError) {
      console.log('⚠️  Firebase save failed (using local DB only):', firebaseError.message);
    }
    
    // Notify all NGOs about new donation
    try {
      await notifyAllNGOs(
        '🎁 New Donation Available',
        `${title} - ${servings} servings available for pickup`,
        {
          donationId: savedDonation.id,
          category,
          urgency: expiryValidation.urgency,
          hoursUntilExpiry: expiryValidation.hoursUntilExpiry
        }
      );
    } catch (notifyError) {
      console.log('⚠️  Notification failed:', notifyError.message);
    }
    
    console.log(`\n🎉 ========================================`);
    console.log(`📦 NEW DONATION POSTED!`);
    console.log(`========================================`);
    console.log(`👤 Donor: ${userData.name}`);
    console.log(`🍽️  Food: ${title}`);
    console.log(`📊 Servings: ${servings}`);
    console.log(`🏷️  Category: ${category}${aiCategorization ? ' (AI-suggested)' : ''}`);
    console.log(`⏰ Urgency: ${expiryValidation.urgency.toUpperCase()}`);
    console.log(`📍 Location: ${location}`);
    console.log(`⚠️  Warnings: ${expiryValidation.warnings.join(', ') || 'None'}`);
    console.log(`🤖 ML Duplicate Check: ${duplicateCheck.message}`);
    if (duplicateCheck.isDuplicate) {
      console.log(`   ⚠️  Similarity: ${Math.round(duplicateCheck.highestSimilarity * 100)}% to "${duplicateCheck.duplicates[0].title}"`);
    }
    console.log(`📢 Notified: All NGOs`);
    console.log(`========================================\n`);
    
    res.status(201).json({
      success: true,
      message: 'Donation created successfully',
      donation: savedDonation,
      aiInsights: {
        categorization: aiCategorization,
        expiryValidation: {
          valid: true,
          urgency: expiryValidation.urgency,
          warnings: expiryValidation.warnings,
          hoursUntilExpiry: expiryValidation.hoursUntilExpiry,
          status: expiryValidation.status
        }
      },
      mlInsights: {
        duplicateCheck: {
          isDuplicate: duplicateCheck.isDuplicate,
          similarity: duplicateCheck.highestSimilarity,
          message: duplicateCheck.message,
          duplicates: duplicateCheck.duplicates,
          model: 'TF-IDF + Cosine Similarity'
        }
      }
    });
  } catch (error) {
    console.error('Create donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create donation',
      error: error.message
    });
  }
});

// ==================== GET ALL DONATIONS (with AI recommendations for NGOs) ====================
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { status = 'available', limit = 50, recommended } = req.query;
    
    // Get from local database
    let donations = await dbService.getAllDonations();
    
    // Filter by status
    if (status) {
      donations = donations.filter(d => d.status === status);
    }
    
    // Sort by createdAt desc
    donations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Limit results
    donations = donations.slice(0, parseInt(limit));
    
    // AI Feature 3: Smart recommendations for NGOs
    if (req.user.userType === 'ngo' && recommended === 'true') {
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      const ngoProfile = userDoc.data();
      
      donations = recommendDonations(donations, {
        location: ngoProfile.location,
        preferredCategories: ngoProfile.preferredCategories || [],
        maxDistance: ngoProfile.maxDistance || 50,
        minServings: ngoProfile.minServings || 0
      });
      
      console.log(`🤖 [AI RECOMMENDATION] Generated smart recommendations for NGO: ${ngoProfile.name}`);
    }
    
    res.json({
      success: true,
      count: donations.length,
      donations,
      aiRecommended: req.user.userType === 'ngo' && recommended === 'true'
    });
  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get donations',
      error: error.message
    });
  }
});

// ==================== GET DONATION BY ID ====================
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const donation = await dbService.getDonationById(req.params.id);
    
    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }
    
    // Increment view count
    await dbService.updateDonation(req.params.id, {
      views: (donation.views || 0) + 1
    });
    
    res.json({
      success: true,
      donation
    });
  } catch (error) {
    console.error('Get donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get donation',
      error: error.message
    });
  }
});

// ==================== CLAIM DONATION (NGO) ====================
router.post('/:id/claim', authenticateUser, async (req, res) => {
  try {
    // Only NGOs can claim
    if (req.user.userType !== 'ngo') {
      return res.status(403).json({
        success: false,
        message: 'Only NGOs can claim donations'
      });
    }
    
    const donation = await dbService.getDonationById(req.params.id);
    
    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }
    
    if (donation.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Donation is no longer available'
      });
    }
    
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const ngoData = userDoc.data();
    
    await dbService.updateDonation(req.params.id, {
      status: 'claimed',
      claimedBy: req.user.uid,
      claimedByName: ngoData.name || ngoData.organizationName,
      claimedAt: new Date().toISOString()
    });
    
    // Notify donor
    await db.collection('notifications').add({
      userId: donation.donorId,
      type: 'donation_claimed',
      title: '✅ Donation Claimed',
      message: `${ngoData.name || ngoData.organizationName} has claimed your ${donation.title}`,
      metadata: {
        donationId: req.params.id,
        ngoId: req.user.uid,
        ngoName: ngoData.name
      },
      priority: 'high',
      color: 'orange',
      sound: false,
      read: false,
      createdAt: new Date().toISOString()
    });
    
    console.log(`✅ [CLAIMED] ${ngoData.name} claimed donation: ${donation.title}`);
    
    res.json({
      success: true,
      message: 'Donation claimed successfully'
    });
  } catch (error) {
    console.error('Claim donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to claim donation',
      error: error.message
    });
  }
});

// ==================== UPDATE DONATION ====================
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const donation = await dbService.getDonationById(req.params.id);
    
    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }
    
    // Check if user owns this donation
    if (donation.donorId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own donations'
      });
    }
    
    await dbService.updateDonation(req.params.id, req.body);
    
    res.json({
      success: true,
      message: 'Donation updated successfully'
    });
  } catch (error) {
    console.error('Update donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update donation',
      error: error.message
    });
  }
});

// ==================== DELETE DONATION ====================
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const donation = await dbService.getDonationById(req.params.id);
    
    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }
    
    // Check if user owns this donation
    if (donation.donorId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own donations'
      });
    }
    
    await dbService.deleteDonation(req.params.id);
    
    res.json({
      success: true,
      message: 'Donation deleted successfully'
    });
  } catch (error) {
    console.error('Delete donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete donation',
      error: error.message
    });
  }
});

// ==================== GET MY DONATIONS (Donor) ====================
router.get('/my/donations', authenticateUser, async (req, res) => {
  try {
    if (req.user.userType !== 'donor') {
      return res.status(403).json({
        success: false,
        message: 'Only donors can access this endpoint'
      });
    }
    
    let donations = await dbService.getDonationsByUserId(req.user.uid);
    
    // Sort by createdAt desc
    donations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({
      success: true,
      count: donations.length,
      donations
    });
  } catch (error) {
    console.error('Get my donations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get donations',
      error: error.message
    });
  }
});

// ==================== GET CLAIMED DONATIONS (NGO) ====================
router.get('/claimed/list', authenticateUser, async (req, res) => {
  try {
    if (req.user.userType !== 'ngo') {
      return res.status(403).json({
        success: false,
        message: 'Only NGOs can access this endpoint'
      });
    }
    
    let donations = await dbService.getAllDonations();
    donations = donations.filter(d => d.claimedBy === req.user.uid);
    
    // Sort by claimedAt desc
    donations.sort((a, b) => {
      const dateA = new Date(a.claimedAt || 0).getTime();
      const dateB = new Date(b.claimedAt || 0).getTime();
      return dateB - dateA;
    });
    
    res.json({
      success: true,
      count: donations.length,
      donations
    });
  } catch (error) {
    console.error('Get claimed donations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get claimed donations',
      error: error.message
    });
  }
});

module.exports = router;

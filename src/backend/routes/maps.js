const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateUser } = require('../middleware/auth');
const { calculateDistance } = require('../services/aiService');

// ==================== OPTIMIZE ROUTE (AI-based) ====================
router.post('/optimize-route', [
  authenticateUser,
  body('locations').isArray({ min: 2 }),
  body('locations.*.lat').isFloat({ min: -90, max: 90 }),
  body('locations.*.lng').isFloat({ min: -180, max: 180 }),
  body('locations.*.urgency').optional().isIn(['normal', 'high', 'critical'])
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

    const { locations } = req.body;

    // AI Route Optimization Algorithm
    const optimizedRoute = optimizeRouteWithAI(locations);
    
    // Calculate total distance and duration
    let totalDistance = 0;
    for (let i = 0; i < optimizedRoute.length - 1; i++) {
      const dist = calculateDistance(
        optimizedRoute[i].lat,
        optimizedRoute[i].lng,
        optimizedRoute[i + 1].lat,
        optimizedRoute[i + 1].lng
      );
      totalDistance += dist;
    }

    const estimatedDuration = Math.round(totalDistance * 3); // 3 min per km average

    console.log(`\n🗺️  ========================================`);
    console.log(`AI ROUTE OPTIMIZATION`);
    console.log(`========================================`);
    console.log(`📍 Locations: ${locations.length}`);
    console.log(`🚗 Total Distance: ${totalDistance.toFixed(2)} km`);
    console.log(`⏱️  Estimated Time: ${estimatedDuration} minutes`);
    console.log(`🎯 Optimization: ${((1 - totalDistance / calculateNaiveDistance(locations)) * 100).toFixed(1)}% better`);
    console.log(`========================================\n`);

    res.json({
      success: true,
      optimizedRoute,
      metrics: {
        totalDistance: Math.round(totalDistance * 10) / 10,
        estimatedDuration,
        locationsCount: optimizedRoute.length,
        optimizationScore: Math.round((1 - totalDistance / calculateNaiveDistance(locations)) * 100)
      }
    });
  } catch (error) {
    console.error('Route optimization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to optimize route',
      error: error.message
    });
  }
});

// ==================== GET NEARBY DONATIONS ====================
router.post('/nearby', [
  authenticateUser,
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lng').isFloat({ min: -180, max: 180 }),
  body('radius').optional().isFloat({ min: 0.1, max: 100 })
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

    const { lat, lng, radius = 10 } = req.body;

    // In production, query database with geospatial index
    // For now, return mock data
    const nearbyDonations = [
      {
        id: '1',
        title: 'Fresh Biryani',
        location: { lat: lat + 0.01, lng: lng + 0.01 },
        address: 'F-7 Markaz',
        urgency: 'high',
        servings: 20,
        distance: 1.2
      },
      {
        id: '2',
        title: 'Bakery Items',
        location: { lat: lat + 0.02, lng: lng - 0.01 },
        address: 'Blue Area',
        urgency: 'normal',
        servings: 15,
        distance: 2.5
      }
    ];

    res.json({
      success: true,
      count: nearbyDonations.length,
      donations: nearbyDonations,
      searchRadius: radius
    });
  } catch (error) {
    console.error('Nearby donations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get nearby donations',
      error: error.message
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * AI-based route optimization using Nearest Neighbor with Priority
 */
function optimizeRouteWithAI(locations) {
  // Sort by urgency first (critical > high > normal)
  const urgencyScore = { critical: 3, high: 2, normal: 1 };
  const prioritized = [...locations].sort((a, b) => {
    return (urgencyScore[b.urgency || 'normal'] || 1) - (urgencyScore[a.urgency || 'normal'] || 1);
  });

  const optimized = [];
  const remaining = [...prioritized];
  
  // Start with highest priority location
  let current = remaining.shift();
  optimized.push(current);

  // Nearest neighbor algorithm with urgency weighting
  while (remaining.length > 0) {
    let nearest = remaining[0];
    let minScore = Infinity;

    for (const location of remaining) {
      const distance = calculateDistance(
        current.lat,
        current.lng,
        location.lat,
        location.lng
      );
      
      // Apply urgency bonus (critical items get priority even if farther)
      const urgencyMultiplier = location.urgency === 'critical' ? 0.5 : 
                                location.urgency === 'high' ? 0.8 : 1.0;
      const score = distance * urgencyMultiplier;
      
      if (score < minScore) {
        minScore = score;
        nearest = location;
      }
    }

    optimized.push(nearest);
    remaining.splice(remaining.indexOf(nearest), 1);
    current = nearest;
  }

  return optimized;
}

/**
 * Calculate naive (unoptimized) route distance for comparison
 */
function calculateNaiveDistance(locations) {
  let total = 0;
  for (let i = 0; i < locations.length - 1; i++) {
    total += calculateDistance(
      locations[i].lat,
      locations[i].lng,
      locations[i + 1].lat,
      locations[i + 1].lng
    );
  }
  return total;
}

module.exports = router;

/**
 * AI Service - Rule-based AI for ShareBite
 * Implements smart categorization, expiry validation, recommendations, etc.
 */

// ==================== 1. SMART DONATION CATEGORIZATION ====================
const CATEGORY_KEYWORDS = {
  bakery: ['bread', 'bun', 'cake', 'pastry', 'cookie', 'muffin', 'croissant', 'bagel', 'donut'],
  meal: ['rice', 'curry', 'pasta', 'noodles', 'biryani', 'pizza', 'burger', 'sandwich', 'wrap'],
  fruits: ['apple', 'banana', 'orange', 'mango', 'grape', 'berry', 'melon', 'pear', 'peach'],
  vegetables: ['tomato', 'potato', 'onion', 'carrot', 'cabbage', 'spinach', 'lettuce', 'pepper'],
  dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'paneer', 'curd'],
  beverages: ['juice', 'water', 'soda', 'tea', 'coffee', 'drink', 'smoothie'],
  snacks: ['chips', 'crackers', 'nuts', 'popcorn', 'biscuit', 'namkeen'],
  groceries: ['flour', 'sugar', 'salt', 'oil', 'spices', 'lentils', 'beans', 'canned'],
  'baked-goods': ['pie', 'tart', 'brownie', 'cupcake', 'scone'],
  'main-course': ['chicken', 'fish', 'meat', 'dal', 'sabzi', 'stew', 'soup'],
  'side-dish': ['salad', 'fries', 'coleslaw', 'raita', 'chutney'],
  dessert: ['ice cream', 'pudding', 'sweet', 'mithai', 'gulab jamun', 'kheer']
};

/**
 * Categorize donation based on title and description
 */
function categorizeDonation(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const scores = {};
  
  // Calculate score for each category
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += 1;
      }
    }
    if (score > 0) {
      scores[category] = score;
    }
  }
  
  // Get top 3 suggestions
  const suggestions = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, score]) => ({
      category,
      confidence: Math.min(score * 20, 100) // Convert to percentage
    }));
  
  return {
    suggested: suggestions.length > 0 ? suggestions[0].category : 'groceries',
    allSuggestions: suggestions,
    confidence: suggestions.length > 0 ? suggestions[0].confidence : 0
  };
}

// ==================== 2. SMART EXPIRY/CONDITION CHECK ====================

/**
 * Validate expiry date and provide warnings
 */
function validateExpiry(expiryDate, pickupTime = null) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const pickup = pickupTime ? new Date(pickupTime) : null;
  
  const errors = [];
  const warnings = [];
  let status = 'valid';
  let urgency = 'normal';
  
  // Check if date is valid
  if (isNaN(expiry.getTime())) {
    errors.push('Invalid expiry date format');
    return { valid: false, status: 'invalid', errors, warnings, urgency };
  }
  
  // Check if already expired
  if (expiry < now) {
    errors.push('Food has already expired - cannot donate expired items');
    return { valid: false, status: 'expired', errors, warnings, urgency };
  }
  
  // Calculate hours until expiry
  const hoursUntilExpiry = (expiry - now) / (1000 * 60 * 60);
  const daysUntilExpiry = hoursUntilExpiry / 24;
  
  // Check if expires too soon (less than 2 hours)
  if (hoursUntilExpiry < 2) {
    errors.push('Food expires in less than 2 hours - too soon to donate safely');
    return { valid: false, status: 'too_soon', errors, warnings, urgency: 'critical' };
  }
  
  // Warnings based on time until expiry
  if (hoursUntilExpiry < 6) {
    warnings.push('⚠️ Food expires in less than 6 hours - URGENT pickup needed');
    urgency = 'critical';
    status = 'urgent';
  } else if (hoursUntilExpiry < 24) {
    warnings.push('⚠️ Food expires today - please arrange quick pickup');
    urgency = 'high';
    status = 'expires_soon';
  } else if (daysUntilExpiry < 3) {
    warnings.push('Food expires in less than 3 days');
    urgency = 'medium';
  }
  
  // Check if pickup time is after expiry
  if (pickup && pickup > expiry) {
    errors.push('Pickup time is after expiry date - please adjust');
    return { valid: false, status: 'invalid_pickup', errors, warnings, urgency };
  }
  
  // Check if pickup is too close to expiry
  if (pickup) {
    const hoursBeforeExpiry = (expiry - pickup) / (1000 * 60 * 60);
    if (hoursBeforeExpiry < 1) {
      warnings.push('⚠️ Very little time between pickup and expiry');
      urgency = 'high';
    }
  }
  
  return {
    valid: true,
    status,
    errors,
    warnings,
    urgency,
    hoursUntilExpiry: Math.round(hoursUntilExpiry),
    daysUntilExpiry: Math.round(daysUntilExpiry * 10) / 10
  };
}

// ==================== 3. RECOMMENDATION AI FOR NGO ====================

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Score and rank donations for NGO
 */
function recommendDonations(donations, ngoProfile) {
  const {
    location, // { lat, lng }
    preferredCategories = [], // ['meal', 'bakery']
    maxDistance = 50, // km
    minServings = 0
  } = ngoProfile;
  
  const scoredDonations = donations.map(donation => {
    let score = 0;
    const reasons = [];
    
    // 1. Distance scoring (50 points max)
    if (location && donation.location) {
      const distance = calculateDistance(
        location.lat,
        location.lng,
        donation.location.lat,
        donation.location.lng
      );
      
      if (distance <= 5) {
        score += 50;
        reasons.push('Very close (< 5km)');
      } else if (distance <= 10) {
        score += 40;
        reasons.push('Nearby (< 10km)');
      } else if (distance <= 20) {
        score += 30;
        reasons.push('Within 20km');
      } else if (distance <= maxDistance) {
        score += 20;
        reasons.push(`Within ${maxDistance}km`);
      } else {
        score += 0;
        reasons.push('Far from your location');
      }
      
      donation.distance = Math.round(distance * 10) / 10;
    }
    
    // 2. Category matching (30 points max)
    if (preferredCategories.length > 0 && donation.category) {
      if (preferredCategories.includes(donation.category)) {
        score += 30;
        reasons.push('Matches your preferred category');
      }
    }
    
    // 3. Quantity/Servings (20 points max)
    const servings = parseInt(donation.servings) || 0;
    if (servings >= minServings) {
      if (servings >= 20) {
        score += 20;
        reasons.push('Large quantity');
      } else if (servings >= 10) {
        score += 15;
        reasons.push('Good quantity');
      } else {
        score += 10;
        reasons.push('Adequate quantity');
      }
    }
    
    // 4. Urgency bonus (15 points max)
    if (donation.urgency === 'critical') {
      score += 15;
      reasons.push('⚠️ URGENT - Expires very soon');
    } else if (donation.urgency === 'high') {
      score += 10;
      reasons.push('Expires soon');
    }
    
    // 5. Dietary preferences (10 points)
    if (donation.isVegetarian) {
      score += 5;
      reasons.push('Vegetarian');
    }
    if (donation.isHalal) {
      score += 5;
      reasons.push('Halal');
    }
    
    return {
      ...donation,
      recommendationScore: score,
      recommendationReasons: reasons,
      recommendationLevel: score >= 80 ? 'highly_recommended' : 
                          score >= 60 ? 'recommended' : 
                          score >= 40 ? 'suitable' : 'available'
    };
  });
  
  // Sort by score (highest first)
  return scoredDonations.sort((a, b) => b.recommendationScore - a.recommendationScore);
}

// ==================== 4. NOTIFICATION PRIORITIZATION ====================

/**
 * Determine notification priority and urgency
 */
function prioritizeNotification(notificationType, metadata = {}) {
  const priorities = {
    // CRITICAL - Red, immediate action needed
    pickup_expires_1hr: { level: 'critical', color: 'red', sound: true },
    food_expires_today: { level: 'critical', color: 'red', sound: true },
    volunteer_late: { level: 'critical', color: 'red', sound: true },
    
    // HIGH - Orange, action needed soon
    pickup_expires_3hr: { level: 'high', color: 'orange', sound: true },
    food_expires_tomorrow: { level: 'high', color: 'orange', sound: false },
    donation_claimed: { level: 'high', color: 'orange', sound: false },
    volunteer_assigned: { level: 'high', color: 'orange', sound: false },
    
    // MEDIUM - Blue, informational
    new_donation: { level: 'medium', color: 'blue', sound: false },
    pickup_scheduled: { level: 'medium', color: 'blue', sound: false },
    delivery_started: { level: 'medium', color: 'blue', sound: false },
    
    // LOW - Gray, can wait
    profile_updated: { level: 'low', color: 'gray', sound: false },
    donation_viewed: { level: 'low', color: 'gray', sound: false },
    feedback_received: { level: 'low', color: 'gray', sound: false }
  };
  
  // Get base priority
  let priority = priorities[notificationType] || { level: 'medium', color: 'blue', sound: false };
  
  // Dynamic priority adjustment based on metadata
  if (metadata.hoursUntilExpiry) {
    if (metadata.hoursUntilExpiry < 1) {
      priority = { level: 'critical', color: 'red', sound: true };
    } else if (metadata.hoursUntilExpiry < 3) {
      priority = { level: 'high', color: 'orange', sound: true };
    }
  }
  
  return {
    ...priority,
    sortOrder: priority.level === 'critical' ? 1 : 
               priority.level === 'high' ? 2 : 
               priority.level === 'medium' ? 3 : 4
  };
}

// ==================== 5. VOLUNTEER ASSIGNMENT SCORING ====================

/**
 * Score and rank volunteers for a delivery task
 */
function scoreVolunteers(volunteers, deliveryTask) {
  const {
    pickupLocation, // { lat, lng }
    pickupTime,
    urgency = 'normal'
  } = deliveryTask;
  
  const scoredVolunteers = volunteers
    .filter(v => v.available) // Only available volunteers
    .map(volunteer => {
      let score = 0;
      const reasons = [];
      
      // 1. Distance scoring (50 points max)
      if (pickupLocation && volunteer.currentLocation) {
        const distance = calculateDistance(
          pickupLocation.lat,
          pickupLocation.lng,
          volunteer.currentLocation.lat,
          volunteer.currentLocation.lng
        );
        
        if (distance <= 2) {
          score += 50;
          reasons.push('Very close (< 2km)');
        } else if (distance <= 5) {
          score += 40;
          reasons.push('Nearby (< 5km)');
        } else if (distance <= 10) {
          score += 30;
          reasons.push('Within 10km');
        } else if (distance <= 20) {
          score += 20;
          reasons.push('Within 20km');
        } else {
          score += 10;
          reasons.push('Available but far');
        }
        
        volunteer.distanceToPickup = Math.round(distance * 10) / 10;
      }
      
      // 2. Availability status (30 points max)
      if (volunteer.status === 'idle') {
        score += 30;
        reasons.push('Currently idle');
      } else if (volunteer.status === 'available') {
        score += 20;
        reasons.push('Available');
      }
      
      // 3. Rating/Experience (15 points max)
      const rating = volunteer.rating || 0;
      score += Math.min(rating * 3, 15);
      if (rating >= 4.5) {
        reasons.push('Highly rated');
      }
      
      // 4. Completed deliveries (5 points max)
      const completedCount = volunteer.completedDeliveries || 0;
      score += Math.min(completedCount / 10, 5);
      if (completedCount >= 50) {
        reasons.push('Experienced volunteer');
      }
      
      // 5. Urgency bonus
      if (urgency === 'critical' && volunteer.status === 'idle') {
        score += 10;
        reasons.push('Available for urgent pickup');
      }
      
      return {
        ...volunteer,
        assignmentScore: score,
        assignmentReasons: reasons,
        recommended: score >= 70
      };
    });
  
  // Sort by score (highest first)
  return scoredVolunteers.sort((a, b) => b.assignmentScore - a.assignmentScore);
}

/**
 * Auto-assign best volunteer
 */
function autoAssignVolunteer(volunteers, deliveryTask) {
  const scored = scoreVolunteers(volunteers, deliveryTask);
  
  if (scored.length === 0) {
    return {
      success: false,
      message: 'No available volunteers found',
      volunteer: null
    };
  }
  
  const bestVolunteer = scored[0];
  
  return {
    success: true,
    message: `Assigned to ${bestVolunteer.name} (score: ${bestVolunteer.assignmentScore})`,
    volunteer: bestVolunteer,
    alternatives: scored.slice(1, 3) // Top 2 alternatives
  };
}

module.exports = {
  categorizeDonation,
  validateExpiry,
  recommendDonations,
  prioritizeNotification,
  scoreVolunteers,
  autoAssignVolunteer,
  calculateDistance
};

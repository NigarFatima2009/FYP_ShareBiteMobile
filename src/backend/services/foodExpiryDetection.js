/**
 * AI Food Expiry Detection Service
 * Analyzes food images and metadata to detect expired food
 * Prevents posting of expired items
 */

// ==================== EXPIRY DETECTION RULES ====================

/**
 * Common food expiry indicators
 */
const EXPIRY_INDICATORS = {
  visual: {
    mold: ['mold', 'moldy', 'green', 'white spots', 'fuzzy'],
    discoloration: ['brown', 'dark spots', 'discolored', 'faded', 'oxidized'],
    texture: ['mushy', 'soggy', 'dried out', 'shriveled', 'wrinkled'],
    liquid: ['leaking', 'oozing', 'wet', 'liquid', 'seeping'],
    smell: ['rotten', 'sour', 'fermented', 'off smell', 'bad odor'],
  },
  packaging: {
    damaged: ['torn', 'punctured', 'damaged', 'broken', 'leaking'],
    swollen: ['swollen', 'bloated', 'puffed', 'expanded'],
    rusty: ['rust', 'corrosion', 'oxidation'],
  },
};

/**
 * Food type specific expiry rules
 */
const FOOD_EXPIRY_RULES = {
  dairy: {
    maxDays: 7,
    keywords: ['milk', 'yogurt', 'cheese', 'butter', 'cream', 'dairy'],
    indicators: ['sour', 'curdled', 'separated', 'lumpy'],
  },
  meat: {
    maxDays: 3,
    keywords: ['meat', 'chicken', 'beef', 'pork', 'fish', 'seafood', 'poultry'],
    indicators: ['gray', 'brown', 'slimy', 'sticky', 'rotten smell'],
  },
  produce: {
    maxDays: 14,
    keywords: ['fruit', 'vegetable', 'apple', 'banana', 'carrot', 'lettuce', 'tomato'],
    indicators: ['brown', 'soft', 'mushy', 'moldy', 'wrinkled'],
  },
  bakery: {
    maxDays: 3,
    keywords: ['bread', 'cake', 'pastry', 'donut', 'muffin', 'cookie'],
    indicators: ['hard', 'stale', 'moldy', 'dry'],
  },
  prepared: {
    maxDays: 2,
    keywords: ['cooked', 'prepared', 'leftover', 'meal', 'dish', 'curry', 'rice'],
    indicators: ['sour', 'off smell', 'discolored', 'moldy'],
  },
  canned: {
    maxDays: 365,
    keywords: ['canned', 'tin', 'jar', 'preserved'],
    indicators: ['swollen', 'rust', 'leaking', 'dented'],
  },
  frozen: {
    maxDays: 180,
    keywords: ['frozen', 'ice cream', 'frozen food'],
    indicators: ['freezer burn', 'ice crystals', 'thawed'],
  },
};

// ==================== TEXT ANALYSIS ====================

/**
 * Tokenize text for analysis
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

/**
 * Check if text contains expiry indicators
 */
function findExpiryIndicators(text) {
  const tokens = tokenize(text);
  const foundIndicators = {
    visual: [],
    packaging: [],
    severity: 'none', // none, low, medium, high, critical
  };

  tokens.forEach(token => {
    // Check visual indicators
    Object.entries(EXPIRY_INDICATORS.visual).forEach(([category, indicators]) => {
      if (indicators.some(ind => ind.includes(token) || token.includes(ind))) {
        foundIndicators.visual.push(token);
      }
    });

    // Check packaging indicators
    Object.entries(EXPIRY_INDICATORS.packaging).forEach(([category, indicators]) => {
      if (indicators.some(ind => ind.includes(token) || token.includes(ind))) {
        foundIndicators.packaging.push(token);
      }
    });
  });

  // Determine severity
  const totalIndicators = foundIndicators.visual.length + foundIndicators.packaging.length;
  if (totalIndicators >= 3) {
    foundIndicators.severity = 'critical';
  } else if (totalIndicators === 2) {
    foundIndicators.severity = 'high';
  } else if (totalIndicators === 1) {
    foundIndicators.severity = 'medium';
  }

  return foundIndicators;
}

/**
 * Identify food type from text
 */
function identifyFoodType(text) {
  const tokens = tokenize(text);
  const matches = {};

  Object.entries(FOOD_EXPIRY_RULES).forEach(([foodType, rules]) => {
    const matchCount = rules.keywords.filter(keyword =>
      tokens.some(token => token.includes(keyword) || keyword.includes(token))
    ).length;

    if (matchCount > 0) {
      matches[foodType] = matchCount;
    }
  });

  // Return food type with highest match count
  if (Object.keys(matches).length === 0) {
    return { type: 'unknown', confidence: 0 };
  }

  const topMatch = Object.entries(matches).sort((a, b) => b[1] - a[1])[0];
  return {
    type: topMatch[0],
    confidence: Math.min(topMatch[1] / 3, 1), // Normalize to 0-1
  };
}

/**
 * Calculate days since creation
 */
function calculateDaysSinceCreation(createdAt) {
  if (!createdAt) return null;

  const created = new Date(createdAt);
  const now = new Date();
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

// ==================== EXPIRY DETECTION ====================

/**
 * Main expiry detection function
 * Analyzes donation metadata to detect if food is likely expired
 */
function detectFoodExpiry(donation) {
  const result = {
    isExpired: false,
    riskLevel: 'safe', // safe, warning, expired
    reasons: [],
    indicators: [],
    foodType: null,
    daysOld: null,
    maxDaysAllowed: null,
    confidence: 0,
    recommendations: [],
  };

  if (!donation) {
    return result;
  }

  // Combine all text for analysis
  const fullText = `${donation.title || ''} ${donation.description || ''} ${donation.foodType || ''}`;

  // 1. Check for explicit expiry indicators in text
  const expiryIndicators = findExpiryIndicators(fullText);
  if (expiryIndicators.severity !== 'none') {
    result.indicators.push(...expiryIndicators.visual);
    result.indicators.push(...expiryIndicators.packaging);
    result.riskLevel = expiryIndicators.severity;
    result.reasons.push(`Found expiry indicators: ${expiryIndicators.severity}`);
  }

  // 2. Identify food type
  const foodType = identifyFoodType(fullText);
  result.foodType = foodType.type;

  // 3. Check best-before date
  if (donation.bestBefore) {
    const bestBeforeDate = new Date(donation.bestBefore);
    const now = new Date();

    if (bestBeforeDate < now) {
      result.isExpired = true;
      result.riskLevel = 'expired';
      result.reasons.push('Best-before date has passed');
    } else {
      const daysUntilExpiry = Math.ceil((bestBeforeDate - now) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 1) {
        result.riskLevel = 'warning';
        result.reasons.push(`Expires in ${daysUntilExpiry} day(s)`);
      }
    }
  }

  // 4. Check days since creation
  if (donation.createdAt) {
    const daysOld = calculateDaysSinceCreation(donation.createdAt);
    result.daysOld = daysOld;

    if (foodType.type !== 'unknown' && FOOD_EXPIRY_RULES[foodType.type]) {
      const maxDays = FOOD_EXPIRY_RULES[foodType.type].maxDays;
      result.maxDaysAllowed = maxDays;

      if (daysOld > maxDays) {
        result.isExpired = true;
        result.riskLevel = 'expired';
        result.reasons.push(`${foodType.type} food is ${daysOld} days old (max: ${maxDays} days)`);
      } else if (daysOld > maxDays * 0.75) {
        result.riskLevel = 'warning';
        result.reasons.push(`${foodType.type} food is ${daysOld} days old (approaching limit)`);
      }
    }
  }

  // 5. Check pickup time
  if (donation.pickupTime) {
    const pickupDate = new Date(donation.pickupTime);
    const now = new Date();

    if (pickupDate < now) {
      result.riskLevel = 'expired';
      result.reasons.push('Pickup time has already passed');
    }
  }

  // 6. Calculate confidence score
  result.confidence = Math.min(
    (result.reasons.length * 0.3 + result.indicators.length * 0.2) / 1,
    1
  );

  // 7. Generate recommendations
  if (result.isExpired) {
    result.recommendations.push('❌ This food appears to be expired and should NOT be posted');
    result.recommendations.push('Please verify the expiry date before posting');
  } else if (result.riskLevel === 'warning') {
    result.recommendations.push('⚠️ This food is approaching expiry');
    result.recommendations.push('Consider setting an earlier pickup time');
    result.recommendations.push('Ensure recipients consume immediately');
  } else {
    result.recommendations.push('✅ Food appears fresh and safe to post');
  }

  return result;
}

/**
 * Validate donation before posting
 * Returns true if safe to post, false if expired
 */
function validateDonationBeforePosting(donation) {
  const expiryCheck = detectFoodExpiry(donation);

  return {
    canPost: !expiryCheck.isExpired && expiryCheck.riskLevel !== 'expired',
    expiryCheck,
    message: expiryCheck.isExpired
      ? `Cannot post: ${expiryCheck.reasons.join(', ')}`
      : expiryCheck.riskLevel === 'warning'
      ? `Warning: ${expiryCheck.reasons.join(', ')}`
      : 'Ready to post',
  };
}

/**
 * Filter expired donations from list
 */
function filterExpiredDonations(donations) {
  return {
    active: donations.filter(d => {
      const check = detectFoodExpiry(d);
      return !check.isExpired;
    }),
    expired: donations.filter(d => {
      const check = detectFoodExpiry(d);
      return check.isExpired;
    }),
  };
}

// ==================== EXPORT ====================

module.exports = {
  detectFoodExpiry,
  validateDonationBeforePosting,
  filterExpiredDonations,
  identifyFoodType,
  findExpiryIndicators,
  calculateDaysSinceCreation,
  FOOD_EXPIRY_RULES,
  EXPIRY_INDICATORS,
};

/**
 * Urgency Service
 * Calculates urgency level for donations based on multiple factors
 */

export type UrgencyLevel = 'high' | 'medium' | 'low';

export interface UrgencyResult {
  level: UrgencyLevel;
  score: number; // 0-100
  reasons: string[];
  color: string;
  priority: number; // 1 = highest
}

/**
 * Calculate urgency based on best-before date
 */
const calculateExpiryUrgency = (bestBefore: string | Date | any): { score: number; reason: string } => {
  try {
    let expiryDate: Date;

    if (bestBefore?.toDate) {
      expiryDate = bestBefore.toDate();
    } else if (typeof bestBefore === 'string') {
      expiryDate = new Date(bestBefore);
    } else if (bestBefore instanceof Date) {
      expiryDate = bestBefore;
    } else {
      return { score: 50, reason: 'Unknown expiry date' };
    }

    const now = new Date();
    const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilExpiry <= 0) {
      return { score: 0, reason: 'Already expired' };
    } else if (hoursUntilExpiry <= 6) {
      return { score: 100, reason: 'Expires within 6 hours' };
    } else if (hoursUntilExpiry <= 12) {
      return { score: 85, reason: 'Expires within 12 hours' };
    } else if (hoursUntilExpiry <= 24) {
      return { score: 70, reason: 'Expires within 24 hours' };
    } else if (hoursUntilExpiry <= 48) {
      return { score: 50, reason: 'Expires within 2 days' };
    } else if (hoursUntilExpiry <= 72) {
      return { score: 30, reason: 'Expires within 3 days' };
    } else {
      return { score: 10, reason: 'More than 3 days until expiry' };
    }
  } catch (e) {
    return { score: 50, reason: 'Could not parse expiry date' };
  }
};

/**
 * Calculate urgency based on food type (perishability)
 */
const calculateFoodTypeUrgency = (foodType: string): { score: number; reason: string } => {
  const highPerishable = ['dairy', 'meat', 'seafood', 'fish', 'cooked', 'prepared', 'salad', 'sandwich'];
  const mediumPerishable = ['bread', 'baked', 'fruit', 'vegetable', 'juice'];
  const lowPerishable = ['canned', 'dry', 'packaged', 'snacks', 'beverages', 'groceries'];

  const lowerType = (foodType || '').toLowerCase();

  if (highPerishable.some(t => lowerType.includes(t))) {
    return { score: 80, reason: 'Highly perishable food type' };
  } else if (mediumPerishable.some(t => lowerType.includes(t))) {
    return { score: 50, reason: 'Moderately perishable food' };
  } else if (lowPerishable.some(t => lowerType.includes(t))) {
    return { score: 20, reason: 'Low perishability' };
  }

  return { score: 50, reason: 'Standard food type' };
};

/**
 * Calculate urgency based on quantity (larger = more urgent to distribute)
 */
const calculateQuantityUrgency = (quantity: string | number): { score: number; reason: string } => {
  const numQuantity = typeof quantity === 'string' ? parseInt(quantity) || 0 : quantity;

  if (numQuantity >= 50) {
    return { score: 80, reason: 'Large quantity needs quick distribution' };
  } else if (numQuantity >= 20) {
    return { score: 60, reason: 'Medium-large quantity' };
  } else if (numQuantity >= 10) {
    return { score: 40, reason: 'Medium quantity' };
  } else {
    return { score: 20, reason: 'Small quantity' };
  }
};

/**
 * Calculate urgency based on time since posting
 */
const calculateAgeUrgency = (createdAt: string | Date | any): { score: number; reason: string } => {
  try {
    let postDate: Date;

    if (createdAt?.toDate) {
      postDate = createdAt.toDate();
    } else if (typeof createdAt === 'string') {
      postDate = new Date(createdAt);
    } else if (createdAt instanceof Date) {
      postDate = createdAt;
    } else {
      return { score: 30, reason: 'Unknown posting time' };
    }

    const now = new Date();
    const hoursOld = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);

    if (hoursOld >= 24) {
      return { score: 70, reason: 'Posted over 24 hours ago' };
    } else if (hoursOld >= 12) {
      return { score: 50, reason: 'Posted over 12 hours ago' };
    } else if (hoursOld >= 6) {
      return { score: 30, reason: 'Posted over 6 hours ago' };
    } else {
      return { score: 10, reason: 'Recently posted' };
    }
  } catch (e) {
    return { score: 30, reason: 'Could not determine age' };
  }
};

/**
 * Main urgency calculation function
 */
export const calculateUrgency = (donation: any): UrgencyResult => {
  const reasons: string[] = [];

  // Calculate individual urgency scores
  const expiryUrgency = calculateExpiryUrgency(donation.bestBefore);
  const foodTypeUrgency = calculateFoodTypeUrgency(donation.foodType || donation.title);
  const quantityUrgency = calculateQuantityUrgency(donation.quantity || donation.servings);
  const ageUrgency = calculateAgeUrgency(donation.createdAt);

  // Weighted average (expiry is most important)
  const weights = {
    expiry: 0.45,
    foodType: 0.25,
    quantity: 0.15,
    age: 0.15,
  };

  const totalScore =
    expiryUrgency.score * weights.expiry +
    foodTypeUrgency.score * weights.foodType +
    quantityUrgency.score * weights.quantity +
    ageUrgency.score * weights.age;

  // Add relevant reasons
  if (expiryUrgency.score >= 70) reasons.push(expiryUrgency.reason);
  if (foodTypeUrgency.score >= 70) reasons.push(foodTypeUrgency.reason);
  if (quantityUrgency.score >= 60) reasons.push(quantityUrgency.reason);
  if (ageUrgency.score >= 50) reasons.push(ageUrgency.reason);

  // Determine level
  let level: UrgencyLevel;
  let color: string;
  let priority: number;

  if (totalScore >= 70) {
    level = 'high';
    color = '#EF4444';
    priority = 1;
    if (reasons.length === 0) reasons.push('High urgency - needs immediate attention');
  } else if (totalScore >= 40) {
    level = 'medium';
    color = '#F59E0B';
    priority = 2;
    if (reasons.length === 0) reasons.push('Medium urgency');
  } else {
    level = 'low';
    color = '#EC4899';
    priority = 3;
    if (reasons.length === 0) reasons.push('Normal priority');
  }

  return {
    level,
    score: Math.round(totalScore),
    reasons,
    color,
    priority,
  };
};

/**
 * Sort donations by urgency (highest first)
 */
export const sortByUrgency = (donations: any[]): any[] => {
  return [...donations].sort((a, b) => {
    const urgencyA = a.urgency?.priority ?? calculateUrgency(a).priority;
    const urgencyB = b.urgency?.priority ?? calculateUrgency(b).priority;
    return urgencyA - urgencyB;
  });
};

/**
 * Add urgency info to donations
 */
export const addUrgencyToDonations = (donations: any[]): any[] => {
  return donations.map(donation => ({
    ...donation,
    urgency: calculateUrgency(donation),
  }));
};

export default {
  calculateUrgency,
  sortByUrgency,
  addUrgencyToDonations,
};

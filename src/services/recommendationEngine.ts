import firestore from '@react-native-firebase/firestore';
import { calculateDistance, Coordinates } from './locationService';

export interface NGORequirement {
  id: string;
  ngoId: string;
  ngoName?: string;
  foodTypeNeeded: string[];
  quantityNeeded: number;
  urgencyLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  acceptsNearExpiry: boolean;
  location: Coordinates;
  commonAllergies?: string[];
  foodShortageLevel?: number;
  numberOfPeople?: number;
  status: string;
}

export interface RecommendationResult {
  ngoId: string;
  ngoName: string;
  requirementId: string;
  score: number;
  distanceKm: number;
  reason: string;
}

/**
 * Intelligent Rule-Based AI Recommendation Engine
 * Calculates a suitability score out of 100 to match a donation to the best NGO requirements.
 */

export const calculateScore = (
  req: NGORequirement,
  donationType: string,
  donationQuantity: number,
  donationLocation: Coordinates,
  donationAllergens: string[] = []
): { score: number; reasons: string[]; distanceKm: number; rejectionReason?: string | null } => {
  let score = 0;
  let reasons: string[] = [];

  // --- Distance (Max 40 points) ---
  const distanceKm = calculateDistance(donationLocation, req.location);
  if (distanceKm <= 2) {
    score += 40;
    reasons.push('nearby');
  } else if (distanceKm <= 5) {
    score += 30;
    reasons.push('within 5km');
  } else if (distanceKm <= 10) {
    score += 15;
  }

  // --- Food Type Compatibility (Max 45 points) ---
  const normalizedDonationType = donationType.toLowerCase();
  const isExactMatch = req.foodTypeNeeded.some(t => t.toLowerCase() === normalizedDonationType);

  if (isExactMatch) {
    score += 45;
    reasons.push(`needs ${donationType}`);
  } else if (req.foodTypeNeeded.length === 0) {
    // If they didn't specify, they might accept anything, give low partial score
    score += 10;
  } else {
    // Mismatch in food type! Penalty
    score -= 20;
  }

  // --- Urgency (Max 15 points) ---
  if (req.urgencyLevel === 'Critical') {
    score += 15;
    reasons.push('critical urgency');
  } else if (req.urgencyLevel === 'High') {
    score += 10;
    reasons.push('high urgency');
  }

  // --- Capacity & Timing (Max 10 points) ---
  if (req.quantityNeeded >= donationQuantity) {
    score += 10;
    reasons.push('can accept all portions');
  } else if (req.quantityNeeded > 0) {
    score += 5; // Partial capacity
  }

  // --- Allergen Safety (HEAVY PENALTY) ---
  const conflictingAllergens = donationAllergens.filter(a =>
    req.commonAllergies?.some(ca => ca.toLowerCase() === a.toLowerCase())
  );

  if (conflictingAllergens.length > 0) {
    // Massive penalty to prevent matching if allergies conflict
    score -= 80;
    reasons.push(`CRITICAL ALLERGY CONFLICT: ${conflictingAllergens.join(', ')}`);
  }

  // --- Food Shortage & Scale Bonus (Max 15 bonus points) ---
  if (req.foodShortageLevel && req.foodShortageLevel >= 4) {
    score += 10;
    reasons.push('high area shortage');
  }

  if (req.numberOfPeople && req.numberOfPeople > 100) {
    score += 5;
    reasons.push('high impact');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    reasons,
    rejectionReason: conflictingAllergens.length > 0 ? `Allergy conflict: ${conflictingAllergens.join(', ')}` : (distanceKm > 20 ? 'Too far away' : null),
    distanceKm: parseFloat(distanceKm.toFixed(1))
  };
};

export const generateRecommendationsForDonation = async (
  donationType: string,
  donationQuantity: number,
  donationLocation: Coordinates,
  isUrgentDonation: boolean,
  donationAllergens: string[] = []
): Promise<RecommendationResult[]> => {
  try {
    // 1. Fetch all active NGO requirements
    const snapshot = await firestore()
      .collection('ngoRequirements')
      .where('status', '==', 'Active')
      .get();

    const requirements: NGORequirement[] = [];

    // Process snapshot
    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Need NGO name, fetch from users collection
      const userDoc = await firestore().collection('users').doc(data.ngoId).get();
      const ngoName = (userDoc.exists as any) === true || (typeof userDoc.exists === 'function' && (userDoc as any).exists()) ? userDoc.data()?.name || 'Unknown NGO' : 'Unknown NGO';

      let reqLocation: Coordinates | null = null;
      if (data.location && typeof data.location.latitude === 'number' && typeof data.location.longitude === 'number') {
        reqLocation = {
          latitude: data.location.latitude,
          longitude: data.location.longitude
        };
      } else if (data.location && typeof data.location._latitude === 'number' && typeof data.location._longitude === 'number') {
        // Handle Firestore GeoPoint directly if not parsed
        reqLocation = {
          latitude: data.location._latitude,
          longitude: data.location._longitude
        };
      }

      if (reqLocation) {
        requirements.push({
          id: doc.id,
          ngoId: data.ngoId,
          ngoName,
          foodTypeNeeded: data.foodTypeNeeded || [],
          quantityNeeded: data.quantityNeeded || 0,
          urgencyLevel: data.urgencyLevel || 'Medium',
          acceptsNearExpiry: data.acceptsNearExpiry || false,
          location: reqLocation,
          commonAllergies: data.commonAllergies || [],
          foodShortageLevel: data.foodShortageLevel || 1,
          numberOfPeople: data.numberOfPeople || 0,
          status: data.status,
        });
      }
    }

    const scoredResults: RecommendationResult[] = [];

    // 2. Score each requirement
    for (const req of requirements) {
      const { score, reasons, distanceKm } = calculateScore(
        req,
        donationType,
        donationQuantity,
        donationLocation,
        donationAllergens
      );

      // Filter out low scores (Threshold increased to 50 for higher accuracy)
      if (score >= 50) {
        // Generate human-readable reason
        const reasonText = `Highly recommended because this NGO is ${reasons.join(', ')}.`;

        scoredResults.push({
          ngoId: req.ngoId,
          ngoName: req.ngoName || 'NGO',
          requirementId: req.id,
          score,
          distanceKm,
          reason: reasonText
        });
      }
    }

    // 3. Sort by score descending and return Top 3
    const topMatches = scoredResults.sort((a, b) => b.score - a.score).slice(0, 3);

    // 4. Log recommendations asynchronously
    topMatches.forEach(match => {
      firestore().collection('recommendationLogs').add({
        targetId: match.ngoId,
        matchScore: match.score,
        distanceKm: match.distanceKm,
        recommendationReason: match.reason,
        createdAt: firestore.FieldValue.serverTimestamp()
      }).catch(e => console.error("Error logging recommendation:", e));
    });

    return topMatches;

  } catch (error) {
    console.error('Error in Recommendation Engine:', error);
    return [];
  }
};

/**
 * Calculates a match score for a specific NGO against a donation.
 * Used on the NGO side to see how well a donation matches their requirements.
 */
export const calculateDonationScoreForNGO = (
  ngoReq: NGORequirement,
  donation: any
): { score: number; reason: string } => {
  const donationType = donation.foodType || donation.title || '';
  const donationQuantity = parseInt(donation.quantity) || 0;
  const donationLocation = donation.coordinates || donation.calculatedCoords || { latitude: 0, longitude: 0 };
  const donationAllergens = donation.allergens || [];

  const { score, reasons, rejectionReason } = calculateScore(
    ngoReq,
    donationType,
    donationQuantity,
    donationLocation,
    donationAllergens
  );

  let reasonText = '';
  if (rejectionReason) {
    reasonText = `Low match: ${rejectionReason}.`;
  } else if (reasons.length > 0) {
    reasonText = `This donation matches because it is ${reasons.join(', ')}.`;
  } else {
    reasonText = "This donation is a general match for your area.";
  }

  return { score, reason: reasonText };
};


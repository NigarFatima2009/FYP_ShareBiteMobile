/**
 * Donation Service - Backend API Integration
 * Handles all donation-related API calls with ML duplicate detection
 */

import { APP_CONFIG } from '../config/app';
import auth from '@react-native-firebase/auth';
import logger from '../utils/logger';

const API_URL = `${APP_CONFIG.BACKEND_URL}/api`;

/**
 * Test backend connection
 */
export const testBackendConnection = async () => {
  try {
    logger.info('🔗 Testing backend connection:', `${APP_CONFIG.BACKEND_URL}/health`);
    
    const response = await fetch(`${APP_CONFIG.BACKEND_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    logger.success('Backend response:', result);

    return {
      success: true,
      message: result.message,
      connected: true,
    };
  } catch (error: any) {
    logger.error('Backend connection failed', error);
    return {
      success: false,
      message: error.message,
      connected: false,
    };
  }
};

/**
 * Get Firebase ID token for authentication
 */
const getAuthToken = async () => {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  return await currentUser.getIdToken();
};

/**
 * Create donation with ML duplicate detection
 */
export const createDonation = async (donationData: {
  title: string;
  description?: string;
  servings: number;
  bestBefore: string;
  pickupTime: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  specialInstructions?: string;
  images?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isHalal?: boolean;
  allergens?: string[];
}) => {
  try {
    logger.info('🔗 Connecting to backend:', API_URL);
    const token = await getAuthToken();
    logger.success('Got auth token');

    logger.info('📤 Sending donation data...');
    const response = await fetch(`${API_URL}/donations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(donationData),
    });

    logger.info('📥 Response status:', response.status);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to create donation');
    }

    logger.success('Donation created successfully');
    return {
      success: true,
      donation: result.donation,
      aiInsights: result.aiInsights,
      mlInsights: result.mlInsights, // ML duplicate detection results
    };
  } catch (error: any) {
    logger.error('Create donation error', error);
    return {
      success: false,
      message: error.message || 'Failed to create donation',
    };
  }
};

/**
 * Check for duplicate donations (ML)
 */
export const checkDuplicate = async (title: string, description?: string) => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/donations/ml/check-duplicate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, description: description || '' }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to check duplicates');
    }

    return {
      success: true,
      isDuplicate: result.isDuplicate,
      similarity: result.highestSimilarity,
      message: result.message,
      duplicates: result.duplicates,
    };
  } catch (error: any) {
    logger.error('Check duplicate error', error);
    return {
      success: false,
      message: error.message || 'Failed to check duplicates',
    };
  }
};

/**
 * Get my donations
 */
export const getMyDonations = async () => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/donations/my/donations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to get donations');
    }

    return {
      success: true,
      donations: result.donations,
    };
  } catch (error: any) {
    logger.error('Get donations error', error);
    return {
      success: false,
      message: error.message || 'Failed to get donations',
      donations: [],
    };
  }
};

/**
 * Delete donation
 */
export const deleteDonation = async (donationId: string) => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/donations/${donationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to delete donation');
    }

    return {
      success: true,
      message: result.message,
    };
  } catch (error: any) {
    logger.error('Delete donation error', error);
    return {
      success: false,
      message: error.message || 'Failed to delete donation',
    };
  }
};

/**
 * Get all available donations (for NGO)
 */
export const getAvailableDonations = async (recommended: boolean = false) => {
  try {
    const token = await getAuthToken();

    const url = recommended 
      ? `${API_URL}/donations?recommended=true`
      : `${API_URL}/donations?status=available`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to get donations');
    }

    return {
      success: true,
      donations: result.donations,
      aiRecommended: result.aiRecommended,
    };
  } catch (error: any) {
    logger.error('Get available donations error', error);
    return {
      success: false,
      message: error.message || 'Failed to get donations',
      donations: [],
    };
  }
};

/**
 * Claim donation (NGO)
 */
export const claimDonation = async (donationId: string) => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/donations/${donationId}/claim`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to claim donation');
    }

    return {
      success: true,
      message: result.message,
    };
  } catch (error: any) {
    logger.error('Claim donation error', error);
    return {
      success: false,
      message: error.message || 'Failed to claim donation',
    };
  }
};

export default {
  createDonation,
  checkDuplicate,
  getMyDonations,
  deleteDonation,
  getAvailableDonations,
  claimDonation,
};

import { firebaseAuth } from './firebase';
import { checkInternetConnection, checkServerStatus } from '../utils/networkUtils';
import { APP_CONFIG, getAPIUrl } from '../config/app';

const API_URL = getAPIUrl();
const BASE_URL = API_URL ? API_URL.replace('/api', '') : null;

// Check if backend is configured
if (!API_URL && APP_CONFIG.USE_BACKEND_API) {
  console.warn('Backend API is enabled but URL is not configured');
}

/**
 * Get Firebase ID token for authenticated requests
 */
const getAuthToken = async () => {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return await user.getIdToken();
};

/**
 * Make authenticated API request with error handling
 */
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  try {
    // Check if backend is enabled
    if (!APP_CONFIG.USE_BACKEND_API || !API_URL) {
      throw new Error('Backend API is not enabled. Use Firebase services instead.');
    }

    // Check internet connection first
    const isConnected = await checkInternetConnection();
    if (!isConnected) {
      throw new Error('NO_INTERNET');
    }

    const token = await getAuthToken();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    // Handle maintenance mode
    if (response.status === 503) {
      throw new Error('MAINTENANCE_MODE');
    }

    // Handle unauthorized
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error: any) {
    console.error('API request error:', error);
    
    // Handle specific errors
    if (error.name === 'AbortError') {
      throw new Error('REQUEST_TIMEOUT');
    }
    
    if (error.message === 'Network request failed') {
      throw new Error('SERVER_UNREACHABLE');
    }

    throw error;
  }
};

/**
 * Authentication API
 */
export const authAPI = {
  // Register user (creates user in backend database)
  register: async (userData: {
    email: string;
    password: string;
    name: string;
    userType: string;
    phone?: string;
    address?: string;
  }) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    return data;
  },

  // Get current user profile
  getProfile: async () => {
    return await apiRequest('/auth/me');
  },

  // Logout
  logout: async () => {
    return await apiRequest('/auth/logout', {
      method: 'POST',
    });
  },
};

/**
 * Donations API
 */
export const donationsAPI = {
  // Create donation
  create: async (donationData: {
    foodType: string;
    quantity: number;
    expiryDate: string;
    pickupAddress: string;
    description?: string;
  }) => {
    return await apiRequest('/donations', {
      method: 'POST',
      body: JSON.stringify(donationData),
    });
  },

  // Get all donations
  getAll: async (params?: { status?: string; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const query = queryParams.toString();
    return await apiRequest(`/donations${query ? `?${query}` : ''}`);
  },

  // Get donation by ID
  getById: async (id: string) => {
    return await apiRequest(`/donations/${id}`);
  },

  // Update donation
  update: async (id: string, updates: any) => {
    return await apiRequest(`/donations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Delete donation
  delete: async (id: string) => {
    return await apiRequest(`/donations/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Health check
 */
export const healthCheck = async () => {
  if (!APP_CONFIG.USE_BACKEND_API || !BASE_URL) {
    return { success: false, message: 'Backend not configured' };
  }
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    return { success: false, message: 'Backend not reachable' };
  }
};

/**
 * Check server status (maintenance, reachability)
 */
export const checkServer = async () => {
  if (!APP_CONFIG.USE_BACKEND_API || !BASE_URL) {
    return {
      isReachable: false,
      isMaintenanceMode: false,
      message: 'Backend not configured',
    };
  }
  
  return await checkServerStatus(`${BASE_URL}/health`);
};

/**
 * Error handler helper
 */
export const handleAPIError = (error: any): string => {
  if (error.message === 'NO_INTERNET') {
    return 'No internet connection. Please check your network.';
  }
  
  if (error.message === 'SERVER_UNREACHABLE') {
    return 'The server is being maintained. Please try again later.';
  }
  
  if (error.message === 'MAINTENANCE_MODE') {
    return 'The server is being maintained. Please try again later.';
  }
  
  if (error.message === 'UNAUTHORIZED') {
    return 'Session expired. Please login again.';
  }
  
  if (error.message === 'REQUEST_TIMEOUT') {
    return 'The server is being maintained. Please try again later.';
  }
  
  return error.message || 'An unexpected error occurred';
};

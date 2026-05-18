/**
 * App Configuration
 * Control which features are enabled
 */

export const APP_CONFIG = {
  // Backend API Configuration
  // NOTE: Python ML algorithms run locally - no backend server needed
  // The mlService.js handles all ML operations in-app
  USE_BACKEND_API: false, // Set to true only if you have a Node.js backend running
  BACKEND_URL: __DEV__
    ? 'http://localhost:5000'
    : 'https://us-central1-sharebite-42667.cloudfunctions.net',

  // Network Checks
  CHECK_SERVER_STATUS: false, // Only enable if using backend
  SHOW_OFFLINE_SCREEN: false, // Firebase works offline, so usually not needed

  // Firebase Configuration
  USE_FIREBASE_AUTH: true,
  USE_FIRESTORE: true,

  // Features
  ENABLE_NOTIFICATIONS: true,
  ENABLE_ANALYTICS: false,

  // Development
  DEBUG_MODE: __DEV__,
  LOG_API_CALLS: __DEV__,

  // Google Maps Configuration
  // API key is stored securely in AndroidManifest.xml (com.google.android.geo.API_KEY meta-data)
  // Do NOT store API keys in JS source code
  GOOGLE_MAPS_API_KEY: '', // Key is injected natively via AndroidManifest, not needed here
};

/**
 * Get API URL based on configuration
 */
export const getAPIUrl = () => {
  if (!APP_CONFIG.USE_BACKEND_API) {
    return null;
  }
  return `${APP_CONFIG.BACKEND_URL}/api`;
};

/**
 * Check if backend is required
 */
export const isBackendRequired = () => {
  return APP_CONFIG.USE_BACKEND_API;
};

/**
 * Check if offline mode is supported
 */
export const supportsOfflineMode = () => {
  return APP_CONFIG.USE_FIRESTORE; // Firestore has offline support
};

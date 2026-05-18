import NetInfo from '@react-native-community/netinfo';

/**
 * Check if device is connected to internet
 */
export const checkInternetConnection = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  } catch (error) {
    console.error('Error checking internet connection:', error);
    return false;
  }
};

/**
 * Subscribe to network state changes
 */
export const subscribeToNetworkChanges = (
  callback: (isConnected: boolean) => void
) => {
  return NetInfo.addEventListener(state => {
    const isConnected = state.isConnected === true && state.isInternetReachable === true;
    callback(isConnected);
  });
};

/**
 * Check if server is reachable
 */
export const checkServerStatus = async (url: string): Promise<{
  isReachable: boolean;
  isMaintenanceMode: boolean;
  message?: string;
}> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Check for maintenance mode (503 status)
    if (response.status === 503) {
      const data = await response.json().catch(() => ({}));
      return {
        isReachable: true,
        isMaintenanceMode: true,
        message: data.message || 'The server is being maintained',
      };
    }

    return {
      isReachable: response.ok,
      isMaintenanceMode: false,
    };
  } catch (error: any) {
    console.error('Server status check error:', error);
    
    // Check if it's a timeout
    if (error.name === 'AbortError') {
      return {
        isReachable: false,
        isMaintenanceMode: false,
        message: 'The server is being maintained',
      };
    }

    return {
      isReachable: false,
      isMaintenanceMode: false,
      message: 'The server is being maintained',
    };
  }
};

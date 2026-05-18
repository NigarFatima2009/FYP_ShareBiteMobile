import { useState, useEffect } from 'react';
import { subscribeToNetworkChanges } from '../utils/networkUtils';

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    setIsChecking(false);
    
    const unsubscribe = subscribeToNetworkChanges((connected) => {
      setIsConnected(connected);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isConnected, isChecking };
};

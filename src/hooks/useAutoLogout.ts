import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface UseAutoLogoutProps {
  onLogout: (isAutoLogout?: boolean) => void;
  timeoutMinutes?: number;
}

export const useAutoLogout = ({ onLogout, timeoutMinutes = 10 }: UseAutoLogoutProps) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      console.log('Auto-logout: Session expired after', timeoutMinutes, 'minutes of inactivity');
      onLogout(true);
    }, timeoutMinutes * 60 * 1000);
  };

  useEffect(() => {
    // Start the timer
    resetTimer();

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground, reset timer
        resetTimer();
      }

      appStateRef.current = nextAppState;
    });

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      subscription.remove();
    };
  }, [onLogout, timeoutMinutes]);

  return { resetTimer };
};

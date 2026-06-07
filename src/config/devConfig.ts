/**
 * Development Configuration
 * Controls console output and error display behavior
 */

import { LogBox } from 'react-native';

/**
 * Configure development environment
 * - Disables red error screens on device
 * - All errors still show in Metro terminal
 * - Cleaner development experience
 */
export const configureDevEnvironment = () => {
  // Disable ALL on-screen yellow/red boxes
  // Errors will ONLY show in terminal
  LogBox.ignoreAllLogs(true);

  // Suppress specific warnings in terminal (optional)
  LogBox.ignoreLogs([
    // Firebase warnings
    'This method is deprecated',
    'React Native Firebase',
    'migrating-to-v22',
    'Please use `getApp()` instead',
    'Please use `onAuthStateChanged()` instead',
    'Please use `collection()` instead',
    'Please use `doc()` instead',
    'Uncaught (in promise)',
    
    // React Native warnings
    'VirtualizedLists should never be nested',
    'Require cycle:',
    'Animated: `useNativeDriver`',
    
    // Navigation warnings
    'Non-serializable values were found',
  ]);

  if (__DEV__) {
    // Keep console methods working for terminal output
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalLog = console.log;

    // Override console.error to only log to terminal
    console.error = (...args) => {
      // Filter out noise
      const message = args.join(' ');
      
      // Skip these specific errors
      if (
        message.includes('Warning: Failed prop type') ||
        message.includes('Warning: React does not recognize') ||
        message.includes('Warning: Each child in a list')
      ) {
        return;
      }

      // Log to Metro terminal
      originalError(...args);
    };

    // Override console.warn to only log to terminal
    console.warn = (...args) => {
      const message = args.join(' ');
      
      // Skip noisy warnings
      if (
        message.includes('Require cycle') ||
        message.includes('VirtualizedLists')
      ) {
        return;
      }

      originalWarn(...args);
    };

    // Keep console.log as is
    console.log = originalLog;

    console.log('✅ Dev environment configured - errors will show in terminal only');
  }
};

/**
 * Enable on-screen errors (for debugging specific issues)
 * Call this if you need to see errors on device temporarily
 */
export const enableOnScreenErrors = () => {
  LogBox.ignoreAllLogs(false);
  console.log('⚠️ On-screen errors enabled');
};

/**
 * Disable on-screen errors (default)
 */
export const disableOnScreenErrors = () => {
  LogBox.ignoreAllLogs(true);
  console.log('✅ On-screen errors disabled - check terminal');
};

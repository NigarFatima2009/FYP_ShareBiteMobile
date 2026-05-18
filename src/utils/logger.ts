/**
 * Logger Utility
 * Logs to terminal only (not shown in app console errors)
 */

/**
 * Log info message (terminal only in dev mode)
 */
export const logInfo = (message: string, ...args: any[]) => {
  if (__DEV__) {
    console.log(message, ...args);
  }
};

/**
 * Log error message (terminal only in dev mode, not shown in app)
 */
export const logError = (message: string, error?: any) => {
  if (__DEV__) {
    console.log(`❌ ${message}`, error?.message || error || '');
  }
};

/**
 * Log success message (terminal only in dev mode)
 */
export const logSuccess = (message: string, ...args: any[]) => {
  if (__DEV__) {
    console.log(`✅ ${message}`, ...args);
  }
};

/**
 * Log warning message (terminal only in dev mode)
 */
export const logWarning = (message: string, ...args: any[]) => {
  if (__DEV__) {
    console.log(`⚠️  ${message}`, ...args);
  }
};

export default {
  info: logInfo,
  error: logError,
  success: logSuccess,
  warning: logWarning,
};

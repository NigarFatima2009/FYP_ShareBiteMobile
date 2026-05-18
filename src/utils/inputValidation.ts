/**
 * Comprehensive Input Validation Utilities
 * Validates all types of inputs with proper error messages
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate email address
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || !email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
};

/**
 * Validate name (2-50 characters, letters and spaces only)
 */
export const validateName = (name: string): ValidationResult => {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Name is required' };
  }

  if (name.trim().length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters' };
  }

  if (name.trim().length > 50) {
    return { isValid: false, error: 'Name must not exceed 50 characters' };
  }

  const nameRegex = /^[a-zA-Z\s]+$/;
  if (!nameRegex.test(name)) {
    return { isValid: false, error: 'Name can only contain letters and spaces' };
  }

  return { isValid: true };
};

/**
 * Validate quantity (positive number with optional unit)
 */
export const validateQuantity = (quantity: string): ValidationResult => {
  if (!quantity || !quantity.trim()) {
    return { isValid: false, error: 'Quantity is required' };
  }

  // Allow formats like: "5", "5 kg", "20 servings", "10.5 liters"
  const quantityRegex = /^\d+(\.\d+)?\s*[a-zA-Z]*$/;
  if (!quantityRegex.test(quantity.trim())) {
    return { isValid: false, error: 'Please enter a valid quantity (e.g., "5 kg", "20 servings")' };
  }

  // Extract number part
  const numberPart = parseFloat(quantity.trim());
  if (numberPart <= 0) {
    return { isValid: false, error: 'Quantity must be greater than 0' };
  }

  if (numberPart > 10000) {
    return { isValid: false, error: 'Quantity seems too large. Please verify' };
  }

  return { isValid: true };
};

/**
 * Validate positive integer (for counts, ages, etc.)
 */
export const validatePositiveInteger = (value: string, fieldName: string = 'Value'): ValidationResult => {
  if (!value || !value.trim()) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const number = parseInt(value, 10);
  if (isNaN(number)) {
    return { isValid: false, error: `${fieldName} must be a number` };
  }

  if (number <= 0) {
    return { isValid: false, error: `${fieldName} must be greater than 0` };
  }

  if (number > 1000) {
    return { isValid: false, error: `${fieldName} seems too large` };
  }

  return { isValid: true };
};

/**
 * Validate date (DD/MM/YYYY format)
 */
export const validateDate = (date: string, allowPast: boolean = true): ValidationResult => {
  if (!date || !date.trim()) {
    return { isValid: false, error: 'Date is required' };
  }

  // Check format DD/MM/YYYY
  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = date.match(dateRegex);

  if (!match) {
    return { isValid: false, error: 'Date must be in DD/MM/YYYY format' };
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  // Validate ranges
  if (month < 1 || month > 12) {
    return { isValid: false, error: 'Month must be between 01 and 12' };
  }

  if (day < 1 || day > 31) {
    return { isValid: false, error: 'Day must be between 01 and 31' };
  }

  // Check if date is valid
  const dateObj = new Date(year, month - 1, day);
  if (
    dateObj.getDate() !== day ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getFullYear() !== year
  ) {
    return { isValid: false, error: 'Invalid date' };
  }

  // Check if date is in the past (for expiry dates)
  if (!allowPast) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      return { isValid: false, error: 'Date cannot be in the past' };
    }
  }

  return { isValid: true };
};

/**
 * Validate address (minimum length)
 */
export const validateAddress = (address: string): ValidationResult => {
  if (!address || !address.trim()) {
    return { isValid: false, error: 'Address is required' };
  }

  if (address.trim().length < 10) {
    return { isValid: false, error: 'Please enter a complete address (at least 10 characters)' };
  }

  if (address.trim().length > 200) {
    return { isValid: false, error: 'Address is too long (maximum 200 characters)' };
  }

  return { isValid: true };
};

/**
 * Validate description (optional but with max length)
 */
export const validateDescription = (description: string, maxLength: number = 500): ValidationResult => {
  if (description && description.length > maxLength) {
    return { isValid: false, error: `Description must not exceed ${maxLength} characters` };
  }

  return { isValid: true };
};

/**
 * Validate verification code (6 digits)
 */
export const validateVerificationCode = (code: string): ValidationResult => {
  if (!code || !code.trim()) {
    return { isValid: false, error: 'Verification code is required' };
  }

  if (!/^\d{6}$/.test(code)) {
    return { isValid: false, error: 'Verification code must be 6 digits' };
  }

  return { isValid: true };
};

/**
 * Validate organization name (for NGOs)
 */
export const validateOrganizationName = (name: string): ValidationResult => {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Organization name is required' };
  }

  if (name.trim().length < 3) {
    return { isValid: false, error: 'Organization name must be at least 3 characters' };
  }

  if (name.trim().length > 100) {
    return { isValid: false, error: 'Organization name must not exceed 100 characters' };
  }

  return { isValid: true };
};

/**
 * Sanitize numeric input (remove non-numeric characters except decimal point)
 */
export const sanitizeNumericInput = (value: string, allowDecimal: boolean = false): string => {
  if (allowDecimal) {
    return value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  }
  return value.replace(/[^0-9]/g, '');
};

/**
 * Format quantity input (allow numbers and common units)
 */
export const formatQuantityInput = (value: string): string => {
  // Allow numbers, decimal point, spaces, and letters (for units)
  return value.replace(/[^0-9.\sa-zA-Z]/g, '');
};

/**
 * Validate URL (optional)
 */
export const validateURL = (url: string): ValidationResult => {
  if (!url || !url.trim()) {
    return { isValid: true }; // URL is optional
  }

  try {
    new URL(url);
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Please enter a valid URL' };
  }
};

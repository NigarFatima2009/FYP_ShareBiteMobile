/**
 * Phone number validation by country
 */

export interface CountryPhoneRule {
  code: string;
  name: string;
  dialCode: string;
  minLength: number;
  maxLength: number;
  format?: string;
  example?: string;
}

export const COUNTRY_PHONE_RULES: CountryPhoneRule[] = [
  // North America
  { code: 'US', name: 'United States', dialCode: '+1', minLength: 10, maxLength: 10, format: '(XXX) XXX-XXXX', example: '(555) 123-4567' },
  { code: 'CA', name: 'Canada', dialCode: '+1', minLength: 10, maxLength: 10, format: '(XXX) XXX-XXXX', example: '(416) 555-0123' },
  
  // Europe
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', minLength: 10, maxLength: 10, format: 'XXXX XXX XXX', example: '7911 123456' },
  { code: 'DE', name: 'Germany', dialCode: '+49', minLength: 10, maxLength: 11, format: 'XXX XXXXXXXX', example: '151 12345678' },
  { code: 'FR', name: 'France', dialCode: '+33', minLength: 9, maxLength: 9, format: 'X XX XX XX XX', example: '6 12 34 56 78' },
  { code: 'IT', name: 'Italy', dialCode: '+39', minLength: 9, maxLength: 10, format: 'XXX XXX XXXX', example: '312 345 6789' },
  { code: 'ES', name: 'Spain', dialCode: '+34', minLength: 9, maxLength: 9, format: 'XXX XX XX XX', example: '612 34 56 78' },
  
  // Asia
  { code: 'PK', name: 'Pakistan', dialCode: '+92', minLength: 10, maxLength: 10, format: 'XXX XXXXXXX', example: '300 1234567' },
  { code: 'IN', name: 'India', dialCode: '+91', minLength: 10, maxLength: 10, format: 'XXXXX XXXXX', example: '98765 43210' },
  { code: 'CN', name: 'China', dialCode: '+86', minLength: 11, maxLength: 11, format: 'XXX XXXX XXXX', example: '138 0013 8000' },
  { code: 'JP', name: 'Japan', dialCode: '+81', minLength: 10, maxLength: 10, format: 'XX XXXX XXXX', example: '90 1234 5678' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', minLength: 10, maxLength: 10, format: 'XXXX XXXXXX', example: '1812 345678' },
  
  // Middle East
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', minLength: 9, maxLength: 9, format: 'XX XXX XXXX', example: '50 123 4567' },
  { code: 'AE', name: 'UAE', dialCode: '+971', minLength: 9, maxLength: 9, format: 'XX XXX XXXX', example: '50 123 4567' },
  { code: 'TR', name: 'Turkey', dialCode: '+90', minLength: 10, maxLength: 10, format: 'XXX XXX XXXX', example: '532 123 4567' },
  
  // Australia & Oceania
  { code: 'AU', name: 'Australia', dialCode: '+61', minLength: 9, maxLength: 9, format: 'XXX XXX XXX', example: '412 345 678' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', minLength: 9, maxLength: 10, format: 'XX XXX XXXX', example: '21 123 4567' },
];

/**
 * Get country rule by dial code
 */
export const getCountryByDialCode = (dialCode: string): CountryPhoneRule | undefined => {
  return COUNTRY_PHONE_RULES.find(country => dialCode.startsWith(country.dialCode));
};

/**
 * Extract dial code and number from phone string
 */
export const parsePhoneNumber = (phone: string): { dialCode: string; number: string } => {
  const cleaned = phone.replace(/\D/g, ''); // Remove non-digits
  
  // Try to match dial codes (sorted by length, longest first)
  const sortedRules = [...COUNTRY_PHONE_RULES].sort((a, b) => 
    b.dialCode.length - a.dialCode.length
  );
  
  for (const rule of sortedRules) {
    const dialCodeDigits = rule.dialCode.replace(/\D/g, '');
    if (cleaned.startsWith(dialCodeDigits)) {
      return {
        dialCode: rule.dialCode,
        number: cleaned.substring(dialCodeDigits.length),
      };
    }
  }
  
  // Default: assume first 1-3 digits are dial code
  if (cleaned.startsWith('1')) {
    return { dialCode: '+1', number: cleaned.substring(1) };
  }
  
  return { dialCode: '', number: cleaned };
};

/**
 * Validate phone number
 */
export const validatePhoneNumber = (phone: string): {
  isValid: boolean;
  error?: string;
  formatted?: string;
  country?: CountryPhoneRule;
} => {
  if (!phone || phone.trim() === '') {
    return { isValid: false, error: 'Phone number is required' };
  }

  const { dialCode, number } = parsePhoneNumber(phone);
  
  if (!dialCode) {
    return { isValid: false, error: 'Invalid country code' };
  }

  const country = getCountryByDialCode(dialCode);
  
  if (!country) {
    return { isValid: false, error: 'Unsupported country code' };
  }

  // Check length
  if (number.length < country.minLength) {
    return {
      isValid: false,
      error: `Phone number too short. ${country.name} requires ${country.minLength} digits`,
      country,
    };
  }

  if (number.length > country.maxLength) {
    return {
      isValid: false,
      error: `Phone number too long. ${country.name} allows maximum ${country.maxLength} digits`,
      country,
    };
  }

  // Format the number
  const formatted = `${dialCode} ${number}`;

  return {
    isValid: true,
    formatted,
    country,
  };
};

/**
 * Format phone number as user types
 */
export const formatPhoneInput = (input: string, previousValue: string = ''): string => {
  // Remove all non-digit characters except +
  let cleaned = input.replace(/[^\d+]/g, '');
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  // Prevent multiple + signs
  const plusCount = (cleaned.match(/\+/g) || []).length;
  if (plusCount > 1) {
    cleaned = '+' + cleaned.replace(/\+/g, '');
  }

  let { dialCode, number } = parsePhoneNumber(cleaned);
  const country = getCountryByDialCode(dialCode);

  if (!country) {
    // No country matched yet, just return cleaned input
    return cleaned;
  }

  // Remove leading 0 which is often mistakenly typed after country code
  // Except for Italy (+39) which sometimes keeps it, but for most mobile formats it's dropped.
  // Actually, to be safe, let's just strip it if the user types it for Pakistan and similar countries.
  if (number.startsWith('0') && dialCode !== '+39') {
    number = number.substring(1);
  }

  // Limit number length
  const limitedNumber = number.substring(0, country.maxLength);
  
  // Return formatted
  return dialCode + (limitedNumber ? ' ' + limitedNumber : '');
};

/**
 * Check if phone number length is valid while typing
 */
export const isPhoneLengthValid = (phone: string): boolean => {
  const { dialCode, number } = parsePhoneNumber(phone);
  const country = getCountryByDialCode(dialCode);
  
  if (!country) return true; // Allow typing if country not determined yet
  
  return number.length <= country.maxLength;
};

/**
 * Get phone number placeholder by country
 */
export const getPhonePlaceholder = (dialCode: string): string => {
  const country = getCountryByDialCode(dialCode);
  if (country && country.example) {
    return `${country.dialCode} ${country.example}`;
  }
  return '+1 (555) 123-4567';
};

/**
 * Sanitize phone number for storage
 */
export const sanitizePhoneNumber = (phone: string): string => {
  const { dialCode, number } = parsePhoneNumber(phone);
  return `${dialCode}${number}`;
};

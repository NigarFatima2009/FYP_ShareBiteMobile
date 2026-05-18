import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInputProps,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../theme';
import {
  COUNTRY_PHONE_RULES,
  validatePhoneNumber,
  formatPhoneInput,
  isPhoneLengthValid,
  CountryPhoneRule,
  parsePhoneNumber,
  getCountryByDialCode,
} from '../../utils/phoneValidation';

interface PhoneInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  label?: string;
  defaultCountry?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChangeText,
  error,
  label = 'Phone Number',
  defaultCountry = 'US',
  ...props
}) => {
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryPhoneRule>(
    COUNTRY_PHONE_RULES.find(c => c.code === defaultCountry) || COUNTRY_PHONE_RULES[0]
  );

  const handleTextChange = (text: string) => {
    // Combine the active country dial code with the typed local number
    let fullNumber = text;
    if (!text.startsWith('+')) {
      fullNumber = activeCountry.dialCode + ' ' + text;
    }
    const formatted = formatPhoneInput(fullNumber);
    onChangeText(formatted);
  };

  const handleCountrySelect = (country: CountryPhoneRule) => {
    setSelectedCountry(country);
    // Update value with new dial code
    const currentNumber = value.replace(/[^\d]/g, '').substring(selectedCountry.dialCode.replace(/\D/g, '').length);
    onChangeText(country.dialCode + (currentNumber ? ' ' + currentNumber : ''));
    setShowCountryPicker(false);
  };

  const validation = validatePhoneNumber(value);
  
  const parsed = parsePhoneNumber(value);
  const activeCountry = getCountryByDialCode(parsed.dialCode) || selectedCountry;
  
  const displayValue = parsed.number || '';

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[styles.inputContainer, error && styles.inputError]}>
        {/* Country Selector */}
        <TouchableOpacity
          style={styles.countrySelector}
          onPress={() => setShowCountryPicker(true)}
        >
          <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
          <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Phone Input */}
        <TextInput
          style={styles.input}
          value={displayValue}
          onChangeText={handleTextChange}
          placeholder={activeCountry.example || '123 456 7890'}
          placeholderTextColor={colors.mutedForeground}
          keyboardType="phone-pad"
          maxLength={activeCountry.maxLength + (displayValue.startsWith('0') ? 1 : 0)}
          {...props}
        />

        {/* Validation Icon */}
        {value && validation.isValid && (
          <Icon name="checkmark-circle" size={20} color={colors.success} />
        )}
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={16} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Helper Text */}
      {!error && activeCountry && (
        <Text style={styles.helperText}>
          {activeCountry.name} • {activeCountry.minLength}-{activeCountry.maxLength} digits
        </Text>
      )}

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Icon name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={COUNTRY_PHONE_RULES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    selectedCountry.code === item.code && styles.countryItemSelected,
                  ]}
                  onPress={() => handleCountrySelect(item)}
                >
                  <View style={styles.countryInfo}>
                    <Text style={styles.countryName}>{item.name}</Text>
                    <Text style={styles.countryDetails}>
                      {item.dialCode} • {item.minLength}-{item.maxLength} digits
                    </Text>
                  </View>
                  {selectedCountry.code === item.code && (
                    <Icon name="checkmark" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    height: 56,
  },
  inputError: {
    borderColor: colors.destructive,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    marginRight: 12,
    gap: 4,
  },
  dialCode: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.foreground,
    paddingVertical: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    color: colors.destructive,
  },
  helperText: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countryItemSelected: {
    backgroundColor: '#F0F9FF',
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  countryDetails: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
});

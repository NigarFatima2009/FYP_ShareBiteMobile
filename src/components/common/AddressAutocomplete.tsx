import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { getPlaceSuggestions, getPlaceDetails, getCurrentLocation } from '../../services/locationService';

interface AddressAutocompleteProps {
  value: string;
  onAddressSelect: (address: string, coordinates?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  style?: any;
  error?: boolean;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onAddressSelect,
  placeholder = "Enter address",
  style,
  error,
}) => {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setInput(value);
  }, [value]);

  const handleInputChange = async (text: string) => {
    setInput(text);
    // Also notify parent of text change immediately (fixes validation issues)
    onAddressSelect(text);
    
    if (text.length >= 3) {
      setLoading(true);
      const results = await getPlaceSuggestions(text);
      setSuggestions(results);
      setLoading(false);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: any) => {
    const address = suggestion.description;
    setInput(address);
    setSuggestions([]);
    setShowSuggestions(false);
    
    setLoading(true);
    // Get coordinates for the selected place
    const coords = await getPlaceDetails(suggestion.placeId);
    setLoading(false);
    onAddressSelect(address, coords || undefined);
  };

  const handleDetectLocation = async () => {
    setDetecting(true);
    const result = await getCurrentLocation();
    setDetecting(false);
    
    if (result.success && result.coordinates) {
      // Reverse geocoding would be ideal, but for now we'll just indicate current location
      const currentAddr = "My Current Location";
      setInput(currentAddr);
      onAddressSelect(currentAddr, result.coordinates);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[
        styles.inputWrapper, 
        error && styles.inputError,
        showSuggestions && suggestions.length > 0 && styles.inputWithSuggestions
      ]}>
        <Icon name="location-outline" size={20} color={colors.mutedForeground} style={styles.icon} />
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          onFocus={() => {
            if (input.length >= 3 && suggestions.length > 0) setShowSuggestions(true);
          }}
          onBlur={() => {
            // Delay closing to allow for selection
            setTimeout(() => setShowSuggestions(false), 200);
          }}
        />
        {(loading || detecting) ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        ) : (
          <TouchableOpacity onPress={handleDetectLocation} style={styles.detectBtn}>
            <Icon name="locate" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {input.length > 0 && input.length < 3 && !showSuggestions && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Keep typing for suggestions...</Text>
        </View>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.placeId}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSelectSuggestion(item)}
              >
                <Icon name="pin-outline" size={16} color={colors.mutedForeground} />
                <View style={styles.suggestionTextWrapper}>
                  <Text style={styles.mainText} numberOfLines={1}>{item.mainText}</Text>
                  <Text style={styles.secondaryText} numberOfLines={1}>{item.secondaryText}</Text>
                </View>
              </TouchableOpacity>
            )}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false} // Small list usually
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 2000,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputError: {
    borderColor: colors.destructive,
  },
  inputWithSuggestions: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  icon: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    height: 48,
    color: colors.foreground,
    fontFamily: typography.fontFamily.medium,
  },
  loader: {
    padding: spacing.xs,
  },
  detectBtn: {
    padding: spacing.xs,
  },
  hintContainer: {
    marginTop: 4,
    paddingHorizontal: spacing.sm,
  },
  hintText: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderTopWidth: 0,
    zIndex: 3000,
  },
  list: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionTextWrapper: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  mainText: {
    fontSize: 14,
    color: colors.foreground,
    fontFamily: typography.fontFamily.semibold,
  },
  secondaryText: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontFamily: typography.fontFamily.regular,
  },
});

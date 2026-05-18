import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { colors, typography, spacing, borderRadius } from '../theme';
import { Button } from '../components/common/Button';
import { getCurrentLocation } from '../services/locationService';
import { AddressAutocomplete } from '../components/common/AddressAutocomplete';

interface Props {
  navigation: any;
  user: any;
}

export const NGORequirementCreation: React.FC<Props> = ({ navigation, user }) => {
  const [foodType, setFoodType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [numberOfPeople, setNumberOfPeople] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [acceptsNearExpiry, setAcceptsNearExpiry] = useState(false);
  const [specialNotes, setSpecialNotes] = useState('');
  const [commonAllergies, setCommonAllergies] = useState<string[]>([]);
  const [foodShortageLevel, setFoodShortageLevel] = useState(3); // 1-5
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number, longitude: number } | null>(null);

  const urgencyOptions = ['Low', 'Medium', 'High', 'Critical'];
  const allergenOptions = ['Milk', 'Eggs', 'Peanuts', 'Tree Nuts', 'Gluten', 'Fish', 'Shellfish', 'Soya', 'Sesame', 'Mustard'];

  const handleSubmit = async () => {
    if (!foodType.trim() || !quantity.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'Please fill in Food Type and Quantity',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const currentUser = auth().currentUser;
      if (!currentUser) throw new Error('Not authenticated');

      // Get location - prioritize manually entered address coordinates
      let locationObj = null;
      
      if (coordinates) {
        locationObj = new firestore.GeoPoint(coordinates.latitude, coordinates.longitude);
      } else {
        const locationResult = await getCurrentLocation();
        if (locationResult.success && locationResult.coordinates) {
          locationObj = new firestore.GeoPoint(
            locationResult.coordinates.latitude,
            locationResult.coordinates.longitude
          );
        } else {
          // Fallback default (Rawalpindi)
          locationObj = new firestore.GeoPoint(33.5651, 73.0169);
        }
      }

      const requirementData = {
        ngoId: currentUser.uid,
        foodTypeNeeded: [foodType.trim()],
        quantityNeeded: parseInt(quantity) || 0,
        numberOfPeople: parseInt(numberOfPeople) || 0,
        urgencyLevel,
        acceptsNearExpiry,
        commonAllergies,
        foodShortageLevel,
        specialNotes: specialNotes.trim(),
        location: locationObj,
        address: address.trim() || 'Current Location',
        status: 'Active',
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('ngoRequirements').add(requirementData);

      Toast.show({
        type: 'success',
        text1: 'Requirement Posted!',
        text2: 'AI will now match incoming donations with your request.',
      });

      navigation.goBack();
    } catch (error) {
      console.error('Error creating requirement:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not post requirement. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Requirement</Text>
      </View>

      <ScrollView style={styles.formContainer} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.sectionDescription}>
          Specify what food your NGO currently needs. Our AI Matching Engine will notify you when a donor posts a matching donation.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Food Type Needed <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Cooked Meals, Bakery items"
            placeholderTextColor={colors.mutedForeground}
            value={foodType}
            onChangeText={setFoodType}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.sm }]}>
            <Text style={styles.label}>Quantity Needed <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50"
              keyboardType="numeric"
              placeholderTextColor={colors.mutedForeground}
              value={quantity}
              onChangeText={setQuantity}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.sm }]}>
            <Text style={styles.label}>No. of People</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50"
              keyboardType="numeric"
              placeholderTextColor={colors.mutedForeground}
              value={numberOfPeople}
              onChangeText={setNumberOfPeople}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Urgency Level</Text>
          <View style={styles.urgencyContainer}>
            {urgencyOptions.map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.urgencyBtn,
                  urgencyLevel === level && styles.urgencyBtnActive,
                  level === 'Critical' && urgencyLevel === level && { backgroundColor: colors.destructive }
                ]}
                onPress={() => setUrgencyLevel(level as any)}
              >
                <Text style={[
                  styles.urgencyBtnText,
                  urgencyLevel === level && styles.urgencyBtnTextActive
                ]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Common Allergies in our Community</Text>
          <Text style={styles.subtext}>Select allergens that affect many of your recipients. AI will avoid matching donations containing these.</Text>
          <View style={styles.allergenContainer}>
            {allergenOptions.map((allergen) => (
              <TouchableOpacity
                key={allergen}
                style={[
                  styles.allergenBadge,
                  commonAllergies.includes(allergen) && styles.allergenBadgeActive
                ]}
                onPress={() => {
                  if (commonAllergies.includes(allergen)) {
                    setCommonAllergies(commonAllergies.filter(a => a !== allergen));
                  } else {
                    setCommonAllergies([...commonAllergies, allergen]);
                  }
                }}
              >
                <Text style={[
                  styles.allergenBadgeText,
                  commonAllergies.includes(allergen) && styles.allergenBadgeTextActive
                ]}>
                  {allergen}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Food Shortage Level (1-5)</Text>
          <Text style={styles.subtext}>How badly do you need food right now? (5 = Critical Shortage)</Text>
          <View style={styles.shortageContainer}>
            {[1, 2, 3, 4, 5].map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.shortageBtn,
                  foodShortageLevel === level && styles.shortageBtnActive
                ]}
                onPress={() => setFoodShortageLevel(level)}
              >
                <Text style={[
                  styles.shortageBtnText,
                  foodShortageLevel === level && styles.shortageBtnTextActive
                ]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.switchGroup}>
          <View style={styles.switchLabelContainer}>
            <Text style={styles.label}>Accepts Near Expiry</Text>
            <Text style={styles.subtext}>Are you willing to accept food expiring within 2 hours?</Text>
          </View>
          <Switch
            value={acceptsNearExpiry}
            onValueChange={setAcceptsNearExpiry}
            trackColor={{ false: '#d1d5db', true: `${colors.primary}80` }}
            thumbColor={acceptsNearExpiry ? colors.primary : '#f4f3f4'}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Special Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any specific instructions or preferences..."
            placeholderTextColor={colors.mutedForeground}
            value={specialNotes}
            onChangeText={setSpecialNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={[styles.inputGroup, { zIndex: 1000, marginBottom: spacing.xl }]}>
          <Text style={styles.label}>NGO Location (Optional)</Text>
          <Text style={styles.subtext}>Providing an address helps in more accurate AI matching. If left blank, your current GPS location will be used.</Text>
          <AddressAutocomplete
            value={address}
            onAddressSelect={(selectedAddress, selectedCoords) => {
              setAddress(selectedAddress);
              if (selectedCoords) setCoordinates(selectedCoords);
            }}
            placeholder="Search for your NGO location"
          />
        </View>

        <Button
          title={isSubmitting ? "Posting..." : "Post Requirement"}
          onPress={handleSubmit}
          disabled={isSubmitting}
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.white,
  },
  formContainer: {
    padding: spacing.md,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.destructive,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    backgroundColor: colors.white,
  },
  textArea: {
    height: 100,
  },
  urgencyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  urgencyBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  urgencyBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  urgencyBtnText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
  },
  urgencyBtnTextActive: {
    color: colors.white,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchLabelContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  subtext: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  allergenContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  allergenBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  allergenBadgeActive: {
    backgroundColor: colors.destructive,
    borderColor: colors.destructive,
  },
  allergenBadgeText: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontFamily: typography.fontFamily.medium,
  },
  allergenBadgeTextActive: {
    color: colors.white,
    fontFamily: typography.fontFamily.semibold,
  },
  shortageContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  shortageBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  shortageBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  shortageBtnText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  shortageBtnTextActive: {
    color: colors.white,
  },
});

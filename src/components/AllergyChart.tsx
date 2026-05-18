import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '../theme';

export const ALLERGENS = [
  { id: 'Milk', icon: 'beaker-outline', label: 'Milk' },
  { id: 'Eggs', icon: 'egg-outline', label: 'Eggs' },
  { id: 'Peanuts', icon: 'nutrition-outline', label: 'Peanuts' },
  { id: 'Tree Nuts', icon: 'leaf-outline', label: 'Tree Nuts' },
  { id: 'Gluten', icon: 'basket-outline', label: 'Gluten' },
  { id: 'Soya', icon: 'flower-outline', label: 'Soya' },
  { id: 'Fish', icon: 'fish-outline', label: 'Fish' },
  { id: 'Shellfish', icon: 'water-outline', label: 'Shellfish' },
  { id: 'Sesame', icon: 'ellipsis-horizontal-circle-outline', label: 'Sesame' },
  { id: 'Mustard', icon: 'color-fill-outline', label: 'Mustard' },
  { id: 'Celery', icon: 'list-outline', label: 'Celery' },
  { id: 'Lupin', icon: 'sunny-outline', label: 'Lupin' },
  { id: 'Molluscs', icon: 'infinite-outline', label: 'Molluscs' },
  { id: 'Sulphites', icon: 'flask-outline', label: 'Sulphites' },
];

interface AllergyChartProps {
  selectedAllergens: string[];
  horizontal?: boolean;
  showLabels?: boolean;
  size?: number;
}

export const AllergyChart: React.FC<AllergyChartProps> = ({
  selectedAllergens = [],
  horizontal = true,
  showLabels = true,
  size = 24,
}) => {
  if (selectedAllergens.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="shield-checkmark-outline" size={size} color={colors.success} />
        <Text style={styles.safeText}>No Common Allergens Detected</Text>
      </View>
    );
  }

  const renderItem = (item: typeof ALLERGENS[0]) => {
    const isSelected = selectedAllergens.includes(item.id);
    if (!isSelected) return null;

    return (
      <View key={item.id} style={styles.allergenItem}>
        <View style={styles.iconCircle}>
          <Icon name={item.icon} size={size * 0.8} color={colors.destructive} />
        </View>
        {showLabels && <Text style={styles.allergenLabel}>{item.label}</Text>}
      </View>
    );
  };

  if (horizontal) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
        {ALLERGENS.map(renderItem)}
      </ScrollView>
    );
  }

  return (
    <View style={styles.grid}>
      {ALLERGENS.map(renderItem)}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: `${colors.success}10`,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  safeText: {
    color: colors.success,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
  },
  horizontalScroll: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  allergenItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.destructive}10`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.destructive}30`,
  },
  allergenLabel: {
    fontSize: 10,
    color: colors.destructive,
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
  },
});

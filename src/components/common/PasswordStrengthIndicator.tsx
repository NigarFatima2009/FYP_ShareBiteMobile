import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, typography, spacing } from '../../theme';
import { PasswordValidationResult } from '../../utils/passwordValidation';

interface PasswordStrengthIndicatorProps {
  validation: PasswordValidationResult;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  validation,
}) => {
  const getStrengthColor = () => {
    switch (validation.strength) {
      case 'strong':
        return colors.success;
      case 'medium':
        return colors.warning;
      default:
        return colors.destructive;
    }
  };

  const getStrengthLabel = () => {
    switch (validation.strength) {
      case 'strong':
        return 'Strong Password';
      case 'medium':
        return 'Medium Strength';
      default:
        return 'Weak Password';
    }
  };

  return (
    <View style={styles.container}>
      {/* Strength Bar */}
      <View style={styles.strengthBarContainer}>
        <View
          style={[
            styles.strengthBar,
            {
              width: `${(validation.requirements.filter(r => r.met).length / validation.requirements.length) * 100}%`,
              backgroundColor: getStrengthColor(),
            },
          ]}
        />
      </View>
      
      <Text style={[styles.strengthLabel, { color: getStrengthColor() }]}>
        {getStrengthLabel()}
      </Text>

      {/* Requirements List */}
      <View style={styles.requirementsList}>
        {validation.requirements.map(requirement => (
          <View key={requirement.id} style={styles.requirementItem}>
            <Icon
              name={requirement.met ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={requirement.met ? colors.success : colors.mutedForeground}
            />
            <Text
              style={[
                styles.requirementText,
                requirement.met && styles.requirementTextMet,
              ]}
            >
              {requirement.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    marginBottom: spacing.base,
  },
  strengthBarContainer: {
    height: 4,
    backgroundColor: colors.muted,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  strengthBar: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    marginBottom: spacing.sm,
  },
  requirementsList: {
    gap: spacing.xs,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  requirementText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginLeft: spacing.xs,
  },
  requirementTextMet: {
    color: colors.success,
    fontFamily: typography.fontFamily.medium,
  },
});

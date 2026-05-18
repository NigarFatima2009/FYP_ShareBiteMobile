import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, borderRadius, spacing } from '../../theme';

interface BadgeProps {
  text: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  size?: 'sm' | 'md';
  style?: any;
}

export const Badge: React.FC<BadgeProps> = ({ text, variant = 'default', size = 'md', style }) => {
  const getBadgeStyle = () => {
    return [
      styles.badge,
      size === 'sm' ? styles.badgesm : styles.badgemd,
      variant === 'success' && styles.badgeSuccess,
      variant === 'warning' && styles.badgeWarning,
      variant === 'destructive' && styles.badgeDestructive,
      variant === 'info' && styles.badgeInfo,
      variant === 'default' && styles.badgeDefault,
    ];
  };

  const getTextStyle = () => {
    return [
      styles.text,
      size === 'sm' ? styles.textsm : styles.textmd,
      variant === 'success' && styles.textSuccess,
      variant === 'warning' && styles.textWarning,
      variant === 'destructive' && styles.textDestructive,
      variant === 'info' && styles.textInfo,
      variant === 'default' && styles.textDefault,
    ];
  };

  return (
    <View style={[getBadgeStyle(), style]}>
      <Text style={getTextStyle()}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  badgemd: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgesm: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  badgeDefault: {
    backgroundColor: colors.primary,
  },
  badgeSuccess: {
    backgroundColor: colors.success,
  },
  badgeWarning: {
    backgroundColor: colors.warning,
  },
  badgeDestructive: {
    backgroundColor: colors.destructive,
  },
  badgeInfo: {
    backgroundColor: colors.info,
  },
  text: {
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
  },
  textmd: {
    fontSize: typography.fontSize.sm,
  },
  textsm: {
    fontSize: typography.fontSize.xs,
  },
  textDefault: {
    color: colors.primaryForeground,
  },
  textSuccess: {
    color: colors.successForeground,
  },
  textWarning: {
    color: colors.warningForeground,
  },
  textDestructive: {
    color: colors.destructiveForeground,
  },
  textInfo: {
    color: colors.infoForeground,
  },
});

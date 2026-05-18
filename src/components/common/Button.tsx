import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, borderRadius, spacing } from '../../theme';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: any;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  title,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  size = 'md',
  style,
}) => {
  const getButtonStyle = (): StyleProp<ViewStyle> => {
    const baseStyle: StyleProp<ViewStyle>[] = [styles.button, styles[`button${size}` as keyof typeof styles] as ViewStyle];

    if (fullWidth) baseStyle.push(styles.fullWidth);
    if (disabled || loading) baseStyle.push(styles.disabled);

    switch (variant) {
      case 'primary':
        baseStyle.push(styles.buttonPrimary);
        break;
      case 'secondary':
        baseStyle.push(styles.buttonSecondary);
        break;
      case 'outline':
        baseStyle.push(styles.buttonOutline);
        break;
      case 'destructive':
        baseStyle.push(styles.buttonDestructive);
        break;
    }

    return baseStyle;
  };

  const getTextStyle = (): StyleProp<TextStyle> => {
    const baseStyle: StyleProp<TextStyle>[] = [styles.text, styles[`text${size}` as keyof typeof styles] as TextStyle];

    switch (variant) {
      case 'primary':
        baseStyle.push(styles.textPrimary);
        break;
      case 'secondary':
        baseStyle.push(styles.textSecondary);
        break;
      case 'outline':
        baseStyle.push(styles.textOutline);
        break;
      case 'destructive':
        baseStyle.push(styles.textDestructive);
        break;
    }

    return baseStyle;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[getButtonStyle(), style]}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : colors.white} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={getTextStyle()}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.base,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonmd: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonsm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  buttonlg: {
    paddingVertical: spacing.base,
    paddingHorizontal: spacing['2xl'],
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.secondary,
  },
  buttonOutline: {
    backgroundColor: colors.transparent,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  buttonDestructive: {
    backgroundColor: colors.destructive,
  },
  disabled: {
    opacity: 0.5,
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
  text: {
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
  },
  textmd: {
    fontSize: typography.fontSize.base,
  },
  textsm: {
    fontSize: typography.fontSize.sm,
  },
  textlg: {
    fontSize: typography.fontSize.lg,
  },
  textPrimary: {
    color: colors.primaryForeground,
  },
  textSecondary: {
    color: colors.secondaryForeground,
  },
  textOutline: {
    color: colors.primary,
  },
  textDestructive: {
    color: colors.destructiveForeground,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { colors, typography, spacing } from '../theme';
import { sendPasswordResetCode } from '../services/passwordReset';

interface ForgotPasswordProps {
  navigation: any;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await sendPasswordResetCode(email);

      if (!result.success) {
        throw new Error(result.error || 'Failed to send reset link');
      }

      setCodeSent(true);

      Toast.show({
        type: 'success',
        text1: 'Reset Link Sent Successfully!',
        text2: 'Please check your email for the secure link to reset your password.',
        visibilityTime: 10000,
        position: 'top',
      });

    } catch (error: any) {
      console.error('Send reset link error:', error);
      setError(error.message || 'Failed to send reset link');

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to send reset link',
        visibilityTime: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Icon name="lock-closed" size={60} color={colors.primary} />
          </View>

          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            {codeSent
              ? "We've sent a secure reset link to your email"
              : 'Enter your email to receive a password reset link'}
          </Text>
        </View>

        <Card style={styles.card}>
          {!codeSent ? (
            <>
              <Input
                label="Email Address"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError('');
                }}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                error={error}
                editable={!isLoading}
              />

              <Button
                title={isLoading ? 'Sending...' : 'Send Reset Link'}
                onPress={handleSendCode}
                disabled={isLoading}
                loading={isLoading}
                fullWidth
              />
            </>
          ) : (
            <View style={styles.successContainer}>
              <Icon name="checkmark-circle" size={48} color={colors.primary} />
              <Text style={styles.successTitle}>Check Your Email</Text>
              <Text style={styles.successText}>
                We've sent a secure password reset link to <Text style={styles.emailText}>{email}</Text>.
              </Text>
              <Text style={styles.successNote}>
                Please click the link in the email to set your new password, then return here to sign in.
              </Text>

              <View style={styles.backToLoginButton}>
                <Button
                  title="Back to Login"
                  onPress={() => navigation.navigate('Login')}
                  fullWidth
                />
              </View>

              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                <Text style={styles.resendText}>Didn't receive email? Resend</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginLinkText}>
            Remember your password? <Text style={styles.loginLinkBold}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.base,
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: spacing.sm,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.base,
    marginTop: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.base,
  },
  card: {
    marginBottom: spacing.base,
  },
  resendButton: {
    marginTop: spacing.base,
    alignItems: 'center',
  },
  resendText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  successTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginTop: spacing.sm,
    marginBottom: spacing.base,
  },
  successText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  emailText: {
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
  },
  successNote: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.xl,
  },
  backToLoginButton: {
    marginTop: spacing.base,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  loginLinkText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  loginLinkBold: {
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary,
  },
});

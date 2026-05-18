import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import auth from '@react-native-firebase/auth';
import { colors, typography, spacing, borderRadius } from '../theme';
import { loginUser, logoutUser, signInWithGoogle, sendVerificationEmail } from '../services/auth';

interface LoginProps {
  navigation: any;
  onLogin: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ navigation, onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  // All accounts go through Firebase Auth — no demo bypasses in production

  const validateForm = () => {
    const newErrors: any = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev: any) => ({ ...prev, [field]: '' }));
    }
    if (field === 'email') {
      setUnverifiedEmail(null);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fix the errors below',
      });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // Firebase authentication — only valid registered users can log in
      const result = await loginUser(formData.email, formData.password);

      if (result.success && result.user) {
        // Check if email is verified
        const currentUser = auth().currentUser;
        const user = result.user as any;
        if (currentUser && !currentUser.emailVerified) {
          setUnverifiedEmail(formData.email);
          await logoutUser();
          setIsLoading(false);
          Toast.show({
            type: 'error',
            text1: 'Email Not Verified',
            text2: 'Please verify your email before signing in.',
          });
          return;
        }

        // Check if NGO needs verification
        if (user.userType === 'ngo' && !user.verified) {
          Toast.show({
            type: 'info',
            text1: 'Verification Required',
            text2: 'Please complete NGO verification to access all features',
          });
          onLogin({ ...user, needsVerification: true });
        } else {
          Toast.show({
            type: 'success',
            text1: 'Welcome Back!',
            text2: `Welcome back, ${user.name || user.email}!`,
          });
          onLogin(user);
        }
        return;
      }

      // Firebase login failed — show specific error
      let errorMessage = 'Invalid email or password';
      if (result && result.error) {
        if (result.error.includes('user-not-found')) {
          errorMessage = 'No account found with this email address. Please register first.';
        } else if (result.error.includes('wrong-password') || result.error.includes('invalid-credential')) {
          errorMessage = 'Incorrect password. Please check and try again.';
        } else if (result.error.includes('invalid-email')) {
          errorMessage = 'Invalid email address format.';
        } else if (result.error.includes('too-many-requests')) {
          errorMessage = 'Too many login attempts. Please try again later.';
        } else if (result.error.includes('user profile not found')) {
          errorMessage = 'Account exists but profile not found. Please contact support.';
        } else {
          errorMessage = result.error;
        }
      }

      setErrors({ general: errorMessage });
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: errorMessage,
      });
    } catch (error: any) {
      const errorMsg = error.message || 'Something went wrong. Please try again.';
      setErrors({ general: errorMsg });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      const currentUser = auth().currentUser;

      if (result.success && result.user) {
        if (result.isNewUser) {
          // USER REQUIREMENT: If email not registered, do not direct to dashboard
          // instead give toast message "this email is not registered" and go to create account
          await logoutUser();
          Toast.show({
            type: 'error',
            text1: 'Email Not Registered',
            text2: 'This email is not registered. Please create an account first.',
            visibilityTime: 4000,
          });
          navigation.navigate('Register');
        } else {
          // Check if email is verified even for Google login
          if (currentUser && !currentUser.emailVerified) {
            await logoutUser();
            Toast.show({
              type: 'error',
              text1: 'Email Not Verified',
              text2: 'Please verify your email before signing in.',
            });
            return;
          }

          Toast.show({
            type: 'success',
            text1: 'Welcome Back!',
            text2: `Signed in as ${result.user.name || result.user.email}`,
          });
          onLogin(result.user);
        }
      } else if (result.error && !result.error.includes('cancelled')) {
        Toast.show({
          type: 'error',
          text1: 'Google Sign-In Failed',
          text2: result.error,
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to sign in with Google',
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
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>
            <Text style={styles.appNamePrimary}>Share</Text>
            <Text style={styles.appNameSecondary}>Bite</Text>
          </Text>
          <Text style={styles.subtitle}>
            Welcome back! Sign in to continue sharing food.
          </Text>
        </View>

        {/* Login Form */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardDescription}>
              Enter your credentials to access your account
            </Text>
          </View>

          {/* General Error */}
          {errors.general && (
            <View style={styles.errorAlert}>
              <Icon name="alert-circle" size={20} color={colors.destructive} />
              <Text style={styles.errorAlertText}>{errors.general}</Text>
            </View>
          )}

          {unverifiedEmail && (
            <View style={[styles.errorAlert, { backgroundColor: `${colors.warning}15`, borderColor: colors.warning }]}>
              <Icon name="mail-outline" size={20} color={colors.warning} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[styles.errorAlertText, { color: colors.warning, marginBottom: spacing.xs }]}>
                  Your email is not verified.
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      setIsLoading(true);
                      // We need a session to resend, so we quickly sign in again
                      const res = await loginUser(formData.email, formData.password);
                      if (res.success) {
                        await sendVerificationEmail();
                        await logoutUser();
                        Toast.show({ type: 'success', text1: 'Email Resent', text2: 'Please check your inbox.' });
                      } else {
                        Toast.show({ type: 'error', text1: 'Error', text2: 'Could not resend. Please check your credentials.' });
                      }
                    } catch (err) {
                      console.log('Resend error:', err);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  <Text style={[styles.registerLink, { fontSize: typography.fontSize.xs }]}>Resend Verification Link</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Email Field */}
          <Input
            label="Email Address"
            value={formData.email}
            onChangeText={(text) => handleInputChange('email', text)}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
            editable={!isLoading}
          />

          {/* Password Field */}
          <Input
            label="Password"
            value={formData.password}
            onChangeText={(text) => handleInputChange('password', text)}
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            error={errors.password}
            editable={!isLoading}
            rightIcon={
              <Icon
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={colors.mutedForeground}
              />
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={isLoading}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <Button
            title={isLoading ? 'Signing In...' : 'Sign In'}
            onPress={handleSubmit}
            disabled={isLoading}
            loading={isLoading}
            fullWidth
          />

          <View style={styles.socialContainer}>
            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>OR</Text>
              <View style={styles.separatorLine} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              <GoogleIcon size={20} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>


          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              disabled={isLoading}
            >
              <Text style={styles.registerLink}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView >
  );
};

const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <Icon name="logo-google" size={size} color="#4285F4" />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing['2xl'],
  },
  appName: {
    fontSize: typography.fontSize['3xl'],
    marginBottom: spacing.sm,
  },
  appNamePrimary: {
    color: colors.primary,
    fontFamily: typography.fontFamily.semibold,
  },
  appNameSecondary: {
    color: colors.foreground,
    fontFamily: typography.fontFamily.semibold,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  card: {
    marginBottom: spacing.base,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  cardDescription: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.destructive}15`,
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  errorAlertText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.destructive,
    marginLeft: spacing.sm,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.base,
  },
  forgotPasswordText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.primary,
  },
  socialContainer: {
    marginTop: spacing.lg,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separatorText: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginHorizontal: spacing.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  googleButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: '#555555',
    marginLeft: spacing.sm,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  registerText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  registerLink: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
});

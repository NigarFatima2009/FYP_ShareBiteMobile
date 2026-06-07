import React, { useState, useMemo } from 'react';
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
import { PhoneInput } from '../components/common/PhoneInput';
import { Card } from '../components/common/Card';
import { PasswordStrengthIndicator } from '../components/common/PasswordStrengthIndicator';
import { colors, typography, spacing, borderRadius } from '../theme';
import { validatePhoneNumber } from '../utils/phoneValidation';
import { validatePassword } from '../utils/passwordValidation';
import { AddressAutocomplete } from '../components/common/AddressAutocomplete';
import { registerUser, sendVerificationEmail, logoutUser, verifyPhoneNumber, confirmOTP, signInWithGoogle, completeGoogleRegistration } from '../services/auth';

interface UserRegistrationProps {
  navigation: any;
  route?: any;
  onRegister: (user: any) => void;
}

export const UserRegistration: React.FC<UserRegistrationProps> = ({
  navigation,
  route,
  onRegister,
}) => {
  // State for Google user data if signing in via Google on this screen
  const [googleUser, setGoogleUser] = useState<any>(route?.params?.googleUser || null);

  const [currentStep, setCurrentStep] = useState(1);
  console.log('Registration State:', { currentStep, isGoogleUser: !!googleUser });
  const [userType, setUserType] = useState('donor');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const [formData, setFormData] = useState({
    name: googleUser?.name || '',
    email: googleUser?.email || '',
    phone: googleUser?.phoneNumber || '', // Let PhoneInput handle country code
    password: '',
    confirmPassword: '',
    address: '',
    organizationName: '',
    coordinates: null as { latitude: number, longitude: number } | null,
  });

  // If user is from Google, we might want to skip phone verification for testing/ease
  // but the user wanted a "way for free", and Google is that way.
  // We'll still keep the 3-step flow but skip real SMS if it's a Google user if preferred,
  // however, let's keep it consistent for now.

  const userTypes = [
    {
      value: 'donor',
      label: 'Food Donor',
      description: 'I want to share surplus food',
      icon: 'person',
      color: colors.success,
    },
    {
      value: 'ngo',
      label: 'NGO/Organization',
      description: 'I represent an organization',
      icon: 'business',
      color: colors.primary,
    },
    {
      value: 'volunteer',
      label: 'Volunteer',
      description: 'I want to help deliver food',
      icon: 'car',
      color: colors.warning,
    },
  ];

  const validateStep1 = () => {
    const newErrors: any = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    const phoneValidation = validatePhoneNumber(formData.phone);
    if (!phoneValidation.isValid) {
      newErrors.phone = phoneValidation.error || 'Invalid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const passwordValidation = useMemo(
    () => validatePassword(formData.password),
    [formData.password]
  );

  const validateStep3 = () => {
    const newErrors: any = {};

    // Only validate passwords if NOT using Google Sign-In
    if (!googleUser) {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (!passwordValidation.isValid) {
        newErrors.password = 'Please meet all password requirements';
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (userType === 'ngo' && !formData.organizationName.trim()) {
      newErrors.organizationName = 'Organization name is required for NGOs';
    }

    if (!agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // On-the-spot validation for Name and Email
    if (field === 'name') {
      const { validateName } = require('../utils/inputValidation');
      const result = validateName(value);
      setErrors((prev: any) => ({ ...prev, name: result.isValid ? '' : result.error }));
    } else if (field === 'email') {
      const { validateEmail } = require('../utils/inputValidation');
      const result = validateEmail(value);
      setErrors((prev: any) => ({ ...prev, email: result.isValid ? '' : result.error }));
    } else if (errors[field]) {
      setErrors((prev: any) => ({ ...prev, [field]: '' }));
    }
  };

  const handleNext = () => {
    if (validateStep1()) {
      setCurrentStep(2); // Go directly to Step 2 (Security/Final Details)
    } else {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fix the errors below',
      });
    }
  };


  const handleSubmit = async () => {
    if (!validateStep3()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fix the errors below',
      });
      return;
    }

    setIsLoading(true);
    try {
      if (googleUser) {
        // Complete profile for existing Google account
        const result = await completeGoogleRegistration(googleUser.uid, {
          email: formData.email,
          name: formData.name,
          userType: userType as 'donor' | 'ngo' | 'volunteer',
          phone: formData.phone,
          address: formData.address,
          organizationName: formData.organizationName,
        });

        if (result.success) {
          // Send verification email even for Google users to satisfy user requirement
          await sendVerificationEmail();

          // Sign out so they can see the verification screen/check email
          await logoutUser();

          setIsVerificationSent(true);

          Toast.show({
            type: 'success',
            text1: 'Profile Created!',
            text2: 'Please check your email for the verification link.',
          });
        } else {
          throw new Error(result.error);
        }
      } else {
        // Regular Email/Password registration
        const result = await registerUser({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          userType: userType as 'donor' | 'ngo' | 'volunteer',
          phone: formData.phone,
          address: formData.address,
          organizationName: formData.organizationName,
        });

        if (!result.success || !result.user) {
          throw new Error((result as any).error || 'Registration failed');
        }

        // Send verification email
        await sendVerificationEmail();

        // Sign out immediately so they can only log in after verifying
        await logoutUser();

        setIsVerificationSent(true);

        Toast.show({
          type: 'success',
          text1: 'Success!',
          text2: 'Account created. Please check your email for the link.',
        });
      }
    } catch (error: any) {
      let errorMessage = error.message || 'Registration failed';
      if (errorMessage.includes('email-already-in-use')) {
        errorMessage = 'This email is already registered';
      }

      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();

      if (result.success && result.user) {
        if (result.isNewUser) {
          // Pre-fill all available data from Google
          const googleData = result.user as any;
          setFormData(prev => ({
            ...prev,
            name: googleData.name || '',
            email: googleData.email || '',
            phone: googleData.phoneNumber || prev.phone,
          }));

          setGoogleUser(googleData);

          Toast.show({
            type: 'info',
            text1: 'Google Account Linked',
            text2: 'Select your role and complete remaining details.',
          });
          // App.tsx logic ensures we stay here because result.user.userType is missing
        } else {
          // Even if they exist, if they are on the Register page, 
          // we treat it as an intent to see/verify their details first or pre-fill
          const existingData = result.user as any;
          setFormData(prev => ({
            ...prev,
            name: existingData.name || prev.name,
            email: existingData.email || prev.email,
            phone: existingData.phone || existingData.phoneNumber || prev.phone,
            address: existingData.address || prev.address,
            organizationName: existingData.organizationName || prev.organizationName,
          }));

          if (existingData.userType) {
            setUserType(existingData.userType);
          }

          setGoogleUser(existingData);

          Toast.show({
            type: 'info',
            text1: 'Account Pre-filled',
            text2: 'We found your existing Google account details.',
          });
        }
      } else if (result.error && !result.error.includes('cancelled')) {
        Toast.show({
          type: 'error',
          text1: 'Google Error',
          text2: result.error,
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Google link failed',
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
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>
            Join <Text style={styles.appNamePrimary}>ShareBite</Text>
          </Text>
          <Text style={styles.subtitle}>
            Start making a difference in your community
          </Text>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressStep, currentStep >= 1 && styles.progressStepActive]}>
            <Text style={[styles.progressStepText, currentStep >= 1 && styles.progressStepTextActive]}>1</Text>
          </View>
          <View style={[styles.progressLine, currentStep >= 2 && styles.progressLineActive]} />
          <View style={[styles.progressStep, currentStep >= 2 && styles.progressStepActive]}>
            <Text style={[styles.progressStepText, currentStep >= 2 && styles.progressStepTextActive]}>2</Text>
          </View>
        </View>

        <Card style={styles.card}>
          {isVerificationSent ? (
            <View style={styles.verificationContainer}>
              <View style={styles.verificationIconContainer}>
                <Icon name="mail-unread-outline" size={64} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Verify Your Email</Text>
              <Text style={styles.cardDescription}>
                We've sent a verification link to:{'\n'}
                <Text style={styles.emailHighlight}>{formData.email}</Text>
              </Text>
              <Text style={styles.verificationInstructions}>
                Please click the link in the email to verify your account. Once verified, you can sign in to ShareBite.
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
                onPress={async () => {
                  setIsLoading(true);
                  const result = await sendVerificationEmail();
                  setIsLoading(false);
                  if (result.success) {
                    Toast.show({ type: 'success', text1: 'Email Resent', text2: 'Please check your inbox.' });
                  } else {
                    Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'Failed to resend' });
                  }
                }}
              >
                <Text style={styles.resendText}>Didn't receive email? Resend</Text>
              </TouchableOpacity>
            </View>
          ) : currentStep === 1 ? (
            <>
              {/* Step 1: User Type & Basic Info */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{googleUser ? 'Complete Your Profile' : 'Create Account'}</Text>
                <Text style={styles.cardDescription}>
                  {googleUser ? 'Please select your role and details' : 'Tell us about yourself'}
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>I am a:</Text>
                {userTypes.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.userTypeOption,
                      userType === type.value && styles.userTypeOptionActive,
                    ]}
                    onPress={() => setUserType(type.value)}
                  >
                    <View style={styles.radioOuter}>
                      {userType === type.value && <View style={styles.radioInner} />}
                    </View>
                    <Icon name={type.icon} size={20} color={type.color} />
                    <View style={styles.userTypeText}>
                      <Text style={styles.userTypeLabel}>{type.label}</Text>
                      <Text style={styles.userTypeDescription}>
                        {type.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="Full Name"
                value={formData.name}
                onChangeText={text => handleInputChange('name', text)}
                placeholder="Enter your full name"
                error={errors.name}
                editable={!isLoading && !googleUser}
              />

              <Input
                label="Email Address"
                value={formData.email}
                onChangeText={text => handleInputChange('email', text)}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email}
                editable={!isLoading && !googleUser}
              />

              <PhoneInput
                label="Phone Number"
                value={formData.phone}
                onChangeText={text => handleInputChange('phone', text)}
                error={errors.phone}
                defaultCountry="PK"
                editable={!isLoading}
              />

              <Button
                title={isLoading ? 'Sending...' : 'Continue'}
                onPress={handleNext}
                disabled={isLoading}
                loading={isLoading}
                fullWidth
              />

              {!googleUser && (
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
              )}
            </>
          ) : (
            <>
              {/* Step 3: Security & Additional Info */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Final Steps</Text>
                <Text style={styles.cardDescription}>
                  {googleUser ? 'Complete your additional details' : 'Set up your account security'}
                </Text>
              </View>

              {!googleUser && (
                <>
                  <Input
                    label="Password"
                    value={formData.password}
                    onChangeText={text => handleInputChange('password', text)}
                    placeholder="Create a password"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    error={errors.password}
                    editable={!isLoading}
                    rightIcon={
                      <Icon
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color={colors.mutedForeground}
                        key={showPassword ? 'eye-off' : 'eye'}
                      />
                    }
                    onRightIconPress={() => setShowPassword(prev => !prev)}
                  />

                  {formData.password.length > 0 && (
                    <PasswordStrengthIndicator validation={passwordValidation} />
                  )}

                  <Input
                    label="Confirm Password"
                    value={formData.confirmPassword}
                    onChangeText={text => handleInputChange('confirmPassword', text)}
                    placeholder="Confirm your password"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    error={errors.confirmPassword}
                    editable={!isLoading}
                    rightIcon={
                      <Icon
                        name={showConfirmPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color={colors.mutedForeground}
                        key={showConfirmPassword ? 'eye-off' : 'eye'}
                      />
                    }
                    onRightIconPress={() => setShowConfirmPassword(prev => !prev)}
                  />
                </>
              )}

              <View style={[styles.inputGroup, { zIndex: 1000, marginBottom: spacing.md }]}>
                <Text style={styles.label}>Address *</Text>
                <AddressAutocomplete
                  value={formData.address}
                  onAddressSelect={(address, coords) => {
                    handleInputChange('address', address);
                    if (coords) {
                      setFormData(prev => ({
                        ...prev,
                        coordinates: coords
                      }));
                    }
                  }}
                  placeholder="Enter your address"
                  error={!!errors.address}
                />
                {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
              </View>

              {userType === 'ngo' && (
                <Input
                  label="Organization Name"
                  value={formData.organizationName}
                  onChangeText={text =>
                    handleInputChange('organizationName', text)
                  }
                  placeholder="Enter organization name"
                  error={errors.organizationName}
                  editable={!isLoading}
                />
              )}

              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setAgreeToTerms(!agreeToTerms)}
              >
                <View style={styles.checkbox}>
                  {agreeToTerms && (
                    <Icon name="checkmark" size={16} color={colors.primary} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  I agree to the <Text style={styles.checkboxLink}>Terms & Conditions</Text>
                </Text>
              </TouchableOpacity>
              {errors.agreeToTerms && (
                <Text style={styles.errorText}>{errors.agreeToTerms}</Text>
              )}

              <View style={styles.buttonRow}>
                <Button
                  title="Back"
                  onPress={() => setCurrentStep(1)}
                  variant="outline"
                  disabled={isLoading}
                  size="md"
                />
                <View style={{ width: spacing.md }} />
                <Button
                  title={isLoading ? 'Creating...' : 'Register'}
                  onPress={handleSubmit}
                  disabled={isLoading}
                  loading={isLoading}
                  size="md"
                />
              </View>
            </>
          )}

          {/* Login Link */}
          {!isVerificationSent && (
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                disabled={isLoading}
              >
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginTop: spacing.xl,
  },
  appName: {
    fontSize: typography.fontSize['3xl'],
    fontFamily: typography.fontFamily.semibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  appNamePrimary: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepActive: {
    backgroundColor: colors.primary,
  },
  progressStepText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.mutedForeground,
  },
  progressStepTextActive: {
    color: colors.white,
  },
  progressLine: {
    width: 48,
    height: 4,
    backgroundColor: colors.muted,
    marginHorizontal: spacing.xs,
  },
  progressLineActive: {
    backgroundColor: colors.primary,
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
  section: {
    marginBottom: spacing.base,
  },
  sectionLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  userTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  userTypeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  userTypeText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  userTypeLabel: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
  },
  userTypeDescription: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  checkboxLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.foreground,
    flex: 1,
  },
  checkboxLink: {
    color: colors.primary,
    fontFamily: typography.fontFamily.medium,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.destructive,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.base,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xl,
  },
  loginText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
  },
  loginLink: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
  verificationContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  verificationIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emailHighlight: {
    fontFamily: typography.fontFamily.bold,
    color: colors.foreground,
  },
  verificationInstructions: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  backToLoginButton: {
    marginTop: spacing.base,
  },
  resendButton: {
    marginTop: spacing.lg,
  },
  resendText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
  otpInputContainer: {
    width: '100%',
    marginVertical: spacing.lg,
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
});

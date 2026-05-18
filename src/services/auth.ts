import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const initGoogleSignin = () => {
  GoogleSignin.configure({
    webClientId: '688973782964-4k5jb6unp9dvu10rht1pegcq25ghauhn.apps.googleusercontent.com',
  });
};

/**
 * SECURE Registration with Firebase Auth
 * Passwords are NEVER stored in Firestore
 */
export const registerUser = async (userData: {
  email: string;
  password: string;
  name: string;
  userType: 'donor' | 'ngo' | 'volunteer';
  phone?: string;
  address?: string;
  organizationName?: string;
}) => {
  // Step 1: Create Firebase Auth user
  let userCredential;
  try {
    userCredential = await auth().createUserWithEmailAndPassword(
      userData.email,
      userData.password
    );
  } catch (authError: any) {
    // If user already exists in Auth, check if they have a Firestore profile
    if (authError.code === 'auth/email-already-in-use') {
      // We can't easily check Firestore for another user's UID without being logged in,
      // but since we are in the Register flow, we can try to see if they can log in 
      // with the provided credentials. If they can, and have no profile, we fix it.
      try {
        const loginResult = await auth().signInWithEmailAndPassword(userData.email, userData.password);
        const userDoc = await firestore().collection('users').doc(loginResult.user.uid).get();

        if (!userDoc.exists) {
          // "Orphaned" account (in Auth but no Firestore doc)
          // Allow fulfilling the profile now
          userCredential = loginResult;
          console.log('Fixing orphaned account for:', userData.email);
        } else {
          return {
            success: false,
            error: 'This email is already registered. Please login instead.',
          };
        }
      } catch (loginErr) {
        // If password wrong or other login error, original "email already in use" is better
        return {
          success: false,
          error: 'This email is already registered. Please login instead.',
        };
      }
    } else {
      throw authError;
    }
  }

  if (!userCredential || !userCredential.user) {
    return {
      success: false,
      error: 'Failed to create user account',
    };
  }

  // Step 2: Save ONLY non-sensitive data to Firestore
  const profileData: any = {
    email: userData.email,
    name: userData.name,
    userType: userData.userType,
    phone: userData.phone || '',
    address: userData.address || '',
    verified: false,
    verificationStatus: 'not_started',
    createdAt: new Date().toISOString(),
  };

  if (userData.userType === 'ngo' && userData.organizationName) {
    profileData.organizationName = userData.organizationName;
  }

  await firestore()
    .collection('users')
    .doc(userCredential.user.uid)
    .set(profileData, { merge: true });

  return {
    success: true,
    user: {
      uid: userCredential.user.uid,
      email: userData.email,
      name: userData.name,
      userType: userData.userType,
      verified: profileData.verified,
    },
  };
};

/**
 * SECURE Login using Firebase Auth
 */
export const loginUser = async (email: string, password: string) => {
  try {
    // Use Firebase Auth for secure authentication
    const userCredential = await auth().signInWithEmailAndPassword(email, password);

    if (!userCredential.user) {
      return {
        success: false,
        error: 'Login failed',
      };
    }

    // Get user profile from Firestore
    const userDoc = await firestore()
      .collection('users')
      .doc(userCredential.user.uid)
      .get();

    if (!userDoc.exists) {
      return {
        success: false,
        error: 'User profile not found',
      };
    }

    const userData = userDoc.data();

    return {
      success: true,
      user: {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        ...userData,
      },
    };
  } catch (error: any) {
    // Handle specific Firebase errors
    if (error.code === 'auth/user-not-found') {
      return {
        success: false,
        error: 'No account found with this email address.',
      };
    } else if (error.code === 'auth/wrong-password') {
      return {
        success: false,
        error: 'Incorrect password. Please try again.',
      };
    } else if (error.code === 'auth/invalid-email') {
      return {
        success: false,
        error: 'Invalid email address format.',
      };
    } else if (error.code === 'auth/too-many-requests') {
      return {
        success: false,
        error: 'Too many failed attempts. Please try again later.',
      };
    }

    return {
      success: false,
      error: error.message || 'Login failed',
    };
  }
};

/**
 * SECURE Logout
 */
export const logoutUser = async () => {
  try {
    await auth().signOut();
    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get current user with profile
 */
export const getCurrentUserProfile = async () => {
  try {
    const currentUser = auth().currentUser;

    if (!currentUser) {
      return {
        success: false,
        error: 'No user logged in',
      };
    }

    const userDoc = await firestore()
      .collection('users')
      .doc(currentUser.uid)
      .get();

    if (!userDoc.exists) {
      return {
        success: false,
        error: 'User profile not found',
      };
    }

    return {
      success: true,
      user: {
        uid: currentUser.uid,
        email: currentUser.email,
        ...userDoc.data(),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Update user profile (non-sensitive data only)
 */
export const updateUserProfile = async (uid: string, data: any) => {
  try {
    // Remove any sensitive fields that shouldn't be updated
    const { password, ...safeData } = data;

    await firestore()
      .collection('users')
      .doc(uid)
      .update({
        ...safeData,
        updatedAt: new Date().toISOString(),
      });

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * SECURE Password Reset
 */
export const resetPassword = async (email: string) => {
  try {
    await auth().sendPasswordResetEmail(email);
    return {
      success: true,
      message: 'Password reset email sent. Please check your inbox.',
    };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return {
        success: false,
        error: 'No account found with this email address.',
      };
    } else if (error.code === 'auth/invalid-email') {
      return {
        success: false,
        error: 'Invalid email address format.',
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to send reset email',
    };
  }
};

/**
 * Send Email Verification
 */
export const sendVerificationEmail = async () => {
  try {
    const user = auth().currentUser;
    if (user) {
      await user.sendEmailVerification();
      return { success: true };
    }
    return { success: false, error: 'No user logged in' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Resend Verification Email for a specific email/password
 */
export const resendVerificationEmail = async (email: string) => {
  try {
    // Note: User must be signed in to send verification email in Firebase
    // But since we want to allow resending without full login session, 
    // we assume the user just tried to log in and is the current user.
    const user = auth().currentUser;
    if (user && user.email === email) {
      await user.sendEmailVerification();
      return { success: true };
    }
    return { success: false, error: 'Could not send verification email. Please try logging in again.' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Verify Phone Number (Send OTP)
 */
export const verifyPhoneNumber = async (phoneNumber: string) => {
  try {
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    return { success: true, confirmation };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Confirm OTP
 */
export const confirmOTP = async (confirmation: any, code: string) => {
  try {
    const result = await confirmation.confirm(code);
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: 'Invalid verification code. Please try again.' };
  }
};

/**
 * Change Password (requires current password)
 */
export const changePassword = async (currentPassword: string, newPassword: string) => {
  try {
    const user = auth().currentUser;

    if (!user || !user.email) {
      return {
        success: false,
        error: 'No user logged in',
      };
    }

    // Re-authenticate user before changing password
    const credential = auth.EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    await user.reauthenticateWithCredential(credential);

    // Update password
    await user.updatePassword(newPassword);

    return {
      success: true,
      message: 'Password changed successfully',
    };
  } catch (error: any) {
    if (error.code === 'auth/wrong-password') {
      return {
        success: false,
        error: 'Current password is incorrect',
      };
    } else if (error.code === 'auth/weak-password') {
      return {
        success: false,
        error: 'New password is too weak. Use at least 6 characters.',
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to change password',
    };
  }
};

/**
 * SECURE Google Sign-In
 */
export const signInWithGoogle = async () => {
  try {
    // Re-ensure configuration (Android context can be flaky between bundle reloads)
    initGoogleSignin();

    // Check if your device supports Google Play
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Force sign out first to clear any stuck internal state (helps with activity issues)
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      // Ignore if not signed in
    }

    // Small delay to ensure the native bridge and activity are ready
    await new Promise(resolve => setTimeout(resolve, 150));

    // Get the users ID token
    const signInResponse = await GoogleSignin.signIn();
    const idToken = signInResponse.data?.idToken;

    if (!idToken) {
      throw new Error('Could not get ID token from Google');
    }

    // Create a Google credential with the token
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);

    // Sign-in the user with the credential
    const userCredential = await auth().signInWithCredential(googleCredential);

    if (!userCredential.user) {
      throw new Error('Google Sign-In failed');
    }

    const { uid, email, displayName } = userCredential.user;

    // Check if user profile exists in Firestore
    const userDoc = await firestore()
      .collection('users')
      .doc(uid)
      .get();

    if (userDoc.exists()) {
      const userData = userDoc.data() || {};

      // Treat as new user if userType is missing (incomplete profile)
      if (!userData.userType) {
        return {
          success: true,
          user: {
            uid,
            email,
            name: displayName || userData.name || '',
            phoneNumber: userCredential.user.phoneNumber || userData.phone || '',
          },
          isNewUser: true,
        };
      }

      return {
        success: true,
        user: {
          uid,
          email,
          name: userData.name || displayName || '',
          ...userData,
        },
        isNewUser: false,
      };
    } else {
      // For new Google users, we need them to complete their profile (userType, etc.)
      return {
        success: true,
        user: {
          uid,
          email,
          name: displayName || '',
          phoneNumber: userCredential.user.phoneNumber || '',
        },
        isNewUser: true,
      };
    }
  } catch (error: any) {
    if (error.code === 'SIGN_IN_CANCELLED') {
      return { success: false, error: 'User cancelled the login.' };
    } else if (error.code === 'IN_PROGRESS') {
      return { success: false, error: 'Sign in is already in progress.' };
    } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
      return { success: false, error: 'Google Play Services not available.' };
    }

    return {
      success: false,
      error: error.message || 'Google Sign-In failed',
    };
  }
};

/**
 * Complete profile for Google user
 */
export const completeGoogleRegistration = async (uid: string, profileData: {
  name: string;
  email?: string;
  userType: 'donor' | 'ngo' | 'volunteer';
  phone?: string;
  address: string;
  organizationName?: string;
}) => {
  try {
    const profile: any = {
      ...profileData,
      phone: profileData.phone || '',
      verified: false, // Google users must now verify email as per new requirement
      updatedAt: new Date().toISOString(),
    };

    if (!profile.createdAt) {
      profile.createdAt = new Date().toISOString();
    }

    await firestore()
      .collection('users')
      .doc(uid)
      .set(profile, { merge: true });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to complete profile',
    };
  }
};

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

/**
 * Send password reset email using Firebase Auth (SECURE)
 * Firebase sends a secure reset link - no plaintext code stored in DB
 */
export const sendPasswordResetCode = async (email: string) => {
  try {
    // SECURE: call Firebase Auth directly. 
    // We removed the Firestore 'users' collection check because it requires authentication,
    // which unauthenticated users (who forgot their password) don't have.
    // Firebase Auth's sendPasswordResetEmail handles the email delivery securely.
    await auth().sendPasswordResetEmail(email);

    return {
      success: true,
      message: 'Password reset email sent. Please check your inbox and follow the link.',
    };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      // For security, it's often better to show success anyway, but we'll return a generic error if the user might expect it
      return {
        success: false,
        error: 'No account found with this email address',
      };
    } else if (error.code === 'auth/invalid-email') {
      return {
        success: false,
        error: 'Invalid email address format',
      };
    } else if (error.code === 'auth/too-many-requests') {
      return {
        success: false,
        error: 'Too many requests. Please wait before trying again.',
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to send password reset email',
    };
  }
};

/**
 * Verify a 6-digit OTP code stored in Firestore
 */
export const verifyCode = async (email: string, code: string) => {
  try {
    const userQuery = await firestore()
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return { success: false, error: 'No account found with this email' };
    }

    const userId = userQuery.docs[0].id;
    const codeDoc = await firestore()
      .collection('passwordResetCodes')
      .doc(userId)
      .get();

    if (!codeDoc.exists) {
      return {
        success: false,
        error: 'No verification code found. Please request a new one.',
      };
    }

    const codeData = codeDoc.data();

    if (codeData?.code !== code) {
      return { success: false, error: 'Invalid verification code' };
    }

    const expiresAt = new Date(codeData.expiresAt);
    if (new Date() > expiresAt) {
      return {
        success: false,
        error: 'Verification code has expired. Please request a new one.',
      };
    }

    if (codeData.used) {
      return {
        success: false,
        error: 'This verification code has already been used',
      };
    }

    return { success: true, userId };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to verify code' };
  }
};

/**
 * SECURE Password Reset
 * - NEVER stores passwords in Firestore
 * - Uses Firebase Auth to update password only
 * - Falls back to sending a secure reset email if user not currently signed in
 */
export const verifyCodeAndResetPassword = async (
  email: string,
  code: string,
  newPassword: string
) => {
  try {
    // Step 1: Verify the OTP code
    const verifyResult = await verifyCode(email, code);
    if (!verifyResult.success || !verifyResult.userId) {
      return verifyResult;
    }

    const userId = verifyResult.userId;

    // Step 2: SECURE — Update ONLY in Firebase Auth, NEVER in Firestore
    const currentUser = auth().currentUser;
    if (currentUser && currentUser.email === email) {
      // User is logged in — update their Auth password directly
      await currentUser.updatePassword(newPassword);
    } else {
      // User is not signed in — send Firebase secure reset email (most secure path)
      await auth().sendPasswordResetEmail(email);

      // Mark code as used
      await firestore()
        .collection('passwordResetCodes')
        .doc(userId)
        .update({ used: true });

      return {
        success: true,
        message:
          'A secure password reset link has been sent to your email. Please use it to set your new password.',
      };
    }

    // Step 3: Mark code as used
    await firestore()
      .collection('passwordResetCodes')
      .doc(userId)
      .update({ used: true });

    // Step 4: Only update audit timestamp — NO password field in Firestore
    await firestore()
      .collection('users')
      .doc(userId)
      .update({
        lastPasswordResetAt: firestore.FieldValue.serverTimestamp(),
      });

    return {
      success: true,
      message: 'Password updated successfully. Please login with your new password.',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to reset password',
    };
  }
};

/**
 * Clean up expired codes (call this periodically)
 */
export const cleanupExpiredCodes = async () => {
  try {
    const now = new Date().toISOString();
    const expiredCodes = await firestore()
      .collection('passwordResetCodes')
      .where('expiresAt', '<', now)
      .get();

    const batch = firestore().batch();
    expiredCodes.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  } catch (error) {
    // Silent fail
  }
};
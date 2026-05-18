const express = require('express');
const router = express.Router();
const { admin } = require('../config/firebase');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { email, password, name, userType, phone, address } = req.body;

    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // Store additional user data in Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      name,
      userType,
      phone: phone || '',
      address: address || '',
      verified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name,
        userType,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user (client handles Firebase auth, this validates)
 * @access  Public
 */
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email } = req.body;

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Get user data from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User data not found',
      });
    }

    const userData = userDoc.data();

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userData.name,
        userType: userData.userType,
        verified: userData.verified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userData = userDoc.data();

    res.json({
      success: true,
      user: {
        uid: userData.uid,
        email: userData.email,
        name: userData.name,
        userType: userData.userType,
        phone: userData.phone,
        address: userData.address,
        verified: userData.verified,
        createdAt: userData.createdAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (revoke refresh tokens)
 * @access  Private
 */
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // Revoke all refresh tokens for the user
    await admin.auth().revokeRefreshTokens(req.user.uid);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset code to email
 * @access  Public
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Check if user exists
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).json({
          success: false,
          message: 'No user found with this email',
        });
      }
      throw error;
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset code in Firestore
    await admin.firestore().collection('passwordResetCodes').add({
      email,
      code: resetCode,
      used: false,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send email with reset code
    const nodemailer = require('nodemailer');
    
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('📧 Email not configured. Reset code:', resetCode);
      return res.json({
        success: true,
        message: 'Password reset code generated (email not configured)',
        resetCode, // Only for development
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"ShareBite" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Code - ShareBite',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password for ShareBite.</p>
        <p>Your password reset code is:</p>
        <h1 style="color: #FF5990; font-size: 32px; letter-spacing: 5px;">${resetCode}</h1>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <br>
        <p>Best regards,<br>ShareBite Team</p>
      `,
    });

    console.log(`📧 Password reset code sent to ${email}: ${resetCode}`);

    res.json({
      success: true,
      message: 'Password reset code sent to your email',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reset code',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/verify-reset-code
 * @desc    Verify password reset code
 * @access  Public
 */
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and code are required',
      });
    }

    // Find reset code
    const codesSnapshot = await admin.firestore()
      .collection('passwordResetCodes')
      .where('email', '==', email)
      .where('code', '==', code)
      .where('used', '==', false)
      .get();

    if (codesSnapshot.empty) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code',
      });
    }

    const codeDoc = codesSnapshot.docs[0];
    const codeData = codeDoc.data();

    // Check if expired
    if (codeData.expiresAt.toDate() < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Reset code has expired',
      });
    }

    res.json({
      success: true,
      message: 'Reset code verified',
      codeId: codeDoc.id,
    });
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify reset code',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with verified code
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, code, and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Find and verify reset code
    const codesSnapshot = await admin.firestore()
      .collection('passwordResetCodes')
      .where('email', '==', email)
      .where('code', '==', code)
      .where('used', '==', false)
      .get();

    if (codesSnapshot.empty) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code',
      });
    }

    const codeDoc = codesSnapshot.docs[0];
    const codeData = codeDoc.data();

    // Check if expired
    if (codeData.expiresAt.toDate() < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Reset code has expired',
      });
    }

    // Get user
    const userRecord = await admin.auth().getUserByEmail(email);

    // Update password
    await admin.auth().updateUser(userRecord.uid, {
      password: newPassword,
    });

    // Mark code as used
    await admin.firestore()
      .collection('passwordResetCodes')
      .doc(codeDoc.id)
      .update({ used: true });

    console.log(`🔐 Password reset successful for ${email}`);

    res.json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message,
    });
  }
});

module.exports = router;

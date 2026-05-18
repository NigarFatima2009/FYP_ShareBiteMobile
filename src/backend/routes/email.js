const express = require('express');
const router = express.Router();

/**
 * Email Service Configuration
 * Choose your email provider: SendGrid, AWS SES, or Nodemailer
 */

// Example using Nodemailer (works with Gmail, Outlook, etc.)
const nodemailer = require('nodemailer');

// Create transporter (configure with your email service)
const transporter = nodemailer.createTransport({
  service: 'gmail', // or 'outlook', 'yahoo', etc.
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASSWORD, // Your email password or app password
  },
});

/**
 * Send email endpoint
 * POST /api/email/send
 */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, body, html } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to, subject, body',
      });
    }

    // Send email
    const info = await transporter.sendMail({
      from: `"ShareBite" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: body,
      html: html || body,
    });

    console.log('Email sent:', info.messageId);

    res.json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message,
    });
  }
});

/**
 * Test email endpoint
 * GET /api/email/test
 */
router.get('/test', async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: `"ShareBite" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: 'ShareBite Email Test',
      text: 'This is a test email from ShareBite API',
      html: '<h1>Test Email</h1><p>If you receive this, email service is working!</p>',
    });

    res.json({
      success: true,
      message: 'Test email sent successfully',
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({
      success: false,
      message: 'Email test failed',
      error: error.message,
    });
  }
});

module.exports = router;

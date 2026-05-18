import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';

/**
 * Firebase Cloud Function to send emails via Gmail
 * Sends emails FROM your Gmail account TO any recipient
 */

// Configure Gmail transporter
// This sends FROM your Gmail account (nigarfatima2009@gmail.com)
// TO any recipient email address provided
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail: nigarfatima2009@gmail.com
    pass: process.env.GMAIL_APP_PASSWORD, // Your App Password
  },
});

// Test transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error('Gmail transporter error:', error);
  } else {
    console.log('Gmail transporter ready to send emails');
  }
});

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

/**
 * HTTP Cloud Function to send emails
 * TODO: Email service disabled for now
 * Uncomment when ready to use
 */
// export const sendEmail = functions.https.onRequest(async (req, res) => {
//   // Enable CORS
//   res.set('Access-Control-Allow-Origin', '*');
//   res.set('Access-Control-Allow-Methods', 'GET, POST');
//   res.set('Access-Control-Allow-Headers', 'Content-Type');
//
//   if (req.method === 'OPTIONS') {
//     res.status(204).send('');
//     return;
//   }
//
//   if (req.method !== 'POST') {
//     res.status(405).json({ error: 'Method not allowed' });
//     return;
//   }
//
//   try {
//     const { to, subject, body, html } = req.body as EmailRequest;
//
//     // Validate input
//     if (!to || !subject || !body) {
//       console.error('Missing required fields:', { to, subject, body });
//       res.status(400).json({ error: 'Missing required fields: to, subject, body' });
//       return;
//     }
//
//     // Validate email format
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(to)) {
//       console.error('Invalid email format:', to);
//       res.status(400).json({ error: 'Invalid email address format' });
//       return;
//     }
//
//     // Validate Gmail credentials are configured
//     if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
//       console.error('Gmail credentials not configured');
//       res.status(500).json({
//         success: false,
//         error: 'Email service not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD.',
//       });
//       return;
//     }
//
//     // Send email FROM your Gmail TO the recipient
//     const mailOptions = {
//       from: `ShareBite <${process.env.GMAIL_USER}>`, // Sends FROM your Gmail
//       to: to, // Sends TO the user's email
//       subject: subject,
//       text: body,
//       html: html || body,
//       replyTo: process.env.GMAIL_USER, // Replies go to your Gmail
//     };
//
//     console.log(`Attempting to send email to ${to} from ${process.env.GMAIL_USER}`);
//     
//     const info = await transporter.sendMail(mailOptions);
//
//     console.log(`✓ Email sent successfully to ${to}`);
//     console.log(`Message ID: ${info.messageId}`);
//     
//     res.status(200).json({
//       success: true,
//       message: 'Email sent successfully',
//       messageId: info.messageId,
//       recipient: to,
//     });
//   } catch (error: any) {
//     console.error('❌ Error sending email:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message || 'Failed to send email',
//       details: error.toString(),
//     });
//   }
// });

// Placeholder function to prevent export errors
export const sendEmail = () => {
  console.log('Email service disabled');
};

/**
 * Firestore trigger to send password reset emails
 * TODO: Email service disabled for now
 * Uncomment when ready to use
 */
// export const onPasswordResetCodeCreated = functions.firestore
//   .document('passwordResetCodes/{codeId}')
//   .onCreate(async (snap, context) => {
//     const data = snap.data();
//     const email = data?.email;
//     
//     try {
//       const { code } = data;
//
//       if (!email || !code) {
//         console.error('Missing email or code in passwordResetCodes document');
//         return;
//       }
//
//       console.log(`📧 Sending password reset code to ${email}`);
//
//       const subject = 'ShareBite - Password Reset Code';
//       const body = `
// Hello,
//
// You requested to reset your password for your ShareBite account.
//
// Your verification code is: ${code}
//
// This code will expire in 15 minutes.
//
// If you didn't request this, please ignore this email.
//
// Best regards,
// ShareBite Team
//       `.trim();
//
//       const html = `
// <!DOCTYPE html>
// <html>
// <head>
//   <style>
//     body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
//     .container { max-width: 600px; margin: 0 auto; padding: 20px; }
//     .header { background: linear-gradient(135deg, #F465E6 0%, #FF6B9D 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
//     .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
//     .code-box { background: white; border: 2px dashed #F465E6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
//     .code { font-size: 32px; font-weight: bold; color: #F465E6; letter-spacing: 5px; }
//     .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
//   </style>
// </head>
// <body>
//   <div class="container">
//     <div class="header">
//       <h1>🔐 Password Reset</h1>
//     </div>
//     <div class="content">
//       <p>Hello,</p>
//       <p>You requested to reset your password for your <strong>ShareBite</strong> account.</p>
//       
//       <div class="code-box">
//         <p style="margin: 0; color: #666;">Your verification code is:</p>
//         <div class="code">${code}</div>
//       </div>
//       
//       <p><strong>⏰ This code will expire in 15 minutes.</strong></p>
//       
//       <p>Enter this code in the app to reset your password.</p>
//       
//       <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
//       
//       <p style="color: #666; font-size: 14px;">
//         If you didn't request this password reset, please ignore this email. 
//         Your password will remain unchanged.
//       </p>
//     </div>
//     <div class="footer">
//       <p>© 2024 ShareBite. All rights reserved.</p>
//     </div>
//   </div>
// </body>
// </html>
//       `.trim();
//
//       // Send FROM your Gmail TO the user's email
//       const mailOptions = {
//         from: `ShareBite <${process.env.GMAIL_USER}>`,
//         to: email, // Send TO the user's email address
//         subject,
//         text: body,
//         html,
//         replyTo: process.env.GMAIL_USER,
//       };
//
//       const info = await transporter.sendMail(mailOptions);
//       console.log(`✓ Password reset email sent to ${email} (Message ID: ${info.messageId})`);
//     } catch (error: any) {
//       console.error(`❌ Error sending password reset email to ${email}:`, error);
//     }
//   });

// Placeholder function to prevent export errors
export const onPasswordResetCodeCreated = () => {
  console.log('Password reset email trigger disabled');
};

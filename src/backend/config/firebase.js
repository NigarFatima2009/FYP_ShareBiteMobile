const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  try {
    // Option 1: Using environment variables
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      console.log('✅ Firebase Admin initialized with environment variables');
      return;
    } 
    
    // Option 2: Using service account key file
    const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized with service account key');
      return;
    }
    
    // No credentials found
    console.error('\n❌ Firebase credentials not found!');
    console.error('\nPlease choose one of these options:\n');
    console.error('Option 1: Create .env file with Firebase credentials');
    console.error('  - Copy .env.example to .env');
    console.error('  - Fill in FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL\n');
    console.error('Option 2: Download serviceAccountKey.json');
    console.error('  - Go to Firebase Console > Project Settings > Service Accounts');
    console.error('  - Click "Generate New Private Key"');
    console.error('  - Save as serviceAccountKey.json in backend/ folder\n');
    process.exit(1);
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    process.exit(1);
  }
};

// Get Firestore database instance (lazy initialization)
let db = null;
const getDb = () => {
  if (!db) {
    db = admin.firestore();
  }
  return db;
};

module.exports = { 
  admin, 
  initializeFirebase,
  get db() {
    return getDb();
  }
};

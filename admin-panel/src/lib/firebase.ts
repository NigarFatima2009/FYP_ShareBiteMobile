import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// Helper to create a dummy proxy that throws a helpful error when any property is accessed.
const createDummyProxy = (name: string) => {
  if (typeof window !== 'undefined') {
    console.error(
      `🔥 ShareBite Admin: Firebase ${name} is not initialized because NEXT_PUBLIC_FIREBASE_API_KEY is missing. ` +
      `Please ensure your .env file in the 'admin-panel' directory contains the environment variables ` +
      `and restart your development server.`
    );
  }
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'then' || prop === 'constructor' || prop === 'toJSON') {
        return undefined;
      }
      throw new Error(
        `Firebase ${name} is not initialized. This typically happens because the ` +
        `environment variables (like NEXT_PUBLIC_FIREBASE_API_KEY) are missing or undefined. ` +
        `If you recently added a .env file, please restart your Next.js development server (npm run dev) ` +
        `or rebuild the application (npm run build).`
      );
    }
  }) as any;
};

// Only initialize Firebase if we have valid config (not during build)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (typeof window !== 'undefined' && firebaseConfig.apiKey) {
  // Client-side initialization
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} else {
  // Build-time or unconfigured fallback: create descriptive dummy proxy exports
  app = createDummyProxy('App');
  auth = createDummyProxy('Auth');
  db = createDummyProxy('Firestore');
  storage = createDummyProxy('Storage');
}

export { app, auth, db, storage };


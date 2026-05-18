const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with your service account
// You can download this from Firebase Console -> Project Settings -> Service accounts
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function createAdmin(email, password, name) {
  try {
    console.log(`Creating/Updating admin user: ${email}...`);

    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log('User already exists in Auth. Updating role...');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        user = await auth.createUser({
          email,
          password,
          displayName: name,
        });
        console.log('New user created in Auth.');
      } else {
        throw error;
      }
    }

    // Set role to admin in Firestore
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      email: email,
      name: name,
      role: 'admin',
      userType: 'admin',
      verified: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log('Successfully granted admin privileges in Firestore!');
    console.log('---------------------------------------------');
    console.log('Login Email:', email);
    console.log('Role:', 'admin');
    console.log('---------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
}

// Usage: node create-admin.js <email> <password> <name>
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node create-admin.js <email> <password> <name>');
  process.exit(1);
}

createAdmin(args[0], args[1], args[2]);

import * as admin from 'firebase-admin';

function getAdminApp(): admin.app.App {
    if (admin.apps.length > 0) {
        return admin.apps[0]!;
    }

    const raw = process.env.NEXT_PUBLIC_FIREBASE_SERVICE_ACCOUNT;

    if (!raw) {
        throw new Error(
            'NEXT_PUBLIC_FIREBASE_SERVICE_ACCOUNT is not set. ' +
            'Add it to your Vercel Environment Variables (without surrounding quotes).'
        );
    }

    // Strip surrounding single or double quotes that may have been added in .env files
    const cleaned = raw.trim().replace(/^['"]|['"]$/g, '');

    let serviceAccount: admin.ServiceAccount;
    try {
        serviceAccount = JSON.parse(cleaned);
    } catch (e) {
        throw new Error(
            'Failed to parse NEXT_PUBLIC_FIREBASE_SERVICE_ACCOUNT as JSON. ' +
            'Make sure the value in Vercel Environment Variables is a raw JSON string ' +
            'WITHOUT any surrounding quotes.'
        );
    }

    return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: (serviceAccount as any).project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
}

export const adminAuth = () => getAdminApp().auth();
export const adminDb = () => getAdminApp().firestore();

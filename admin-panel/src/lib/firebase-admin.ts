import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function getAdminApp(): admin.app.App {
    if (admin.apps.length > 0) {
        return admin.apps[0]!;
    }

    let serviceAccount: admin.ServiceAccount;

    // Strategy 1: Load from a local JSON file (best for local development)
    const jsonFilePath = path.resolve(process.cwd(), 'service-account.json');
    if (fs.existsSync(jsonFilePath)) {
        try {
            const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
            serviceAccount = JSON.parse(fileContent);
        } catch (e) {
            throw new Error(
                `Failed to parse service-account.json: ${(e as Error).message}`
            );
        }
    } else {
        // Strategy 2: Parse from environment variable (for Vercel / production)
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.NEXT_PUBLIC_FIREBASE_SERVICE_ACCOUNT;

        if (!raw) {
            throw new Error(
                'Firebase service account not found. Either:\n' +
                '1. Place a service-account.json file in the project root, OR\n' +
                '2. Set FIREBASE_SERVICE_ACCOUNT in your environment variables.'
            );
        }

        // Strip surrounding single or double quotes that may have been added
        const cleaned = raw.trim().replace(/^['"]|['"]$/g, '');

        try {
            serviceAccount = JSON.parse(cleaned);
        } catch (e) {
            throw new Error(
                'Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON. ' +
                'Make sure the value is a raw JSON string WITHOUT any surrounding quotes.'
            );
        }
    }

    // Fix double-escaped newlines in private_key (common when pasting into env vars)
    if ((serviceAccount as any).private_key) {
        (serviceAccount as any).private_key = (serviceAccount as any).private_key.replace(/\\n/g, '\n');
    }

    return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: (serviceAccount as any).project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
}

export const adminAuth = () => getAdminApp().auth();
export const adminDb = () => getAdminApp().firestore();


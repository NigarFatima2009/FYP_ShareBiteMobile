import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function DELETE(
    request: Request,
    { params }: { params: { uid: string } }
) {
    const uid = params.uid;

    if (!uid) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        console.log(`Starting deletion for user: ${uid}...`);

        // 1. Delete from Firebase Authentication
        try {
            await adminAuth().deleteUser(uid);
            console.log('User deleted from Firebase Auth');
        } catch (error: any) {
            // If user not found in Auth, we should still proceed to delete from Firestore
            if (error.code !== 'auth/user-not-found') {
                console.error('Error deleting from Auth:', error);
                return NextResponse.json({ error: `Auth Deletion Error: ${error.message}` }, { status: 500 });
            }
            console.log('User not found in Auth, proceeding to Firestore deletion');
        }

        // 2. Delete from Firestore (users collection)
        await adminDb().collection('users').doc(uid).delete();
        console.log('User deleted from Firestore');

        // 3. Optional: Delete related documents (donations, etc.)
        // For now we keep it simple as requested to "properly remove from firebase authentication"

        return NextResponse.json({ success: true, message: 'User deleted successfully from Auth and Firestore' });
    } catch (error: any) {
        console.error('General deletion error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500 });
    }
}

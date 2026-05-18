import firestore from '@react-native-firebase/firestore';
import { firebaseAuth } from './firebase';

/**
 * User Profile Operations
 */
export const userProfile = {
  // Create user profile
  create: async (uid: string, data: any) => {
    try {
      await firestore()
        .collection('users')
        .doc(uid)
        .set({
          ...data,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Get user profile
  get: async (uid: string) => {
    try {
      const doc = await firestore()
        .collection('users')
        .doc(uid)
        .get();
      if (doc.exists()) {
        return { success: true, data: doc.data() };
      }
      return { success: false, error: 'User not found' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Update user profile
  update: async (uid: string, data: any) => {
    try {
      await firestore()
        .collection('users')
        .doc(uid)
        .update({
          ...data,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Listen to profile changes
  listen: (uid: string, callback: (data: any) => void) => {
    return firestore()
      .collection('users')
      .doc(uid)
      .onSnapshot((doc) => {
        if (doc.exists()) {
          callback(doc.data());
        }
      },
      (error) => {
        console.error('Profile listener error:', error);
      }
    );
  },
};

/**
 * Donations Operations
 */
export const donations = {
  // Create donation
  create: async (data: any) => {
    try {
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const docRef = await firestore()
        .collection('donations')
        .add({
          ...data,
          donorId: user.uid,
          donorEmail: user.email,
          status: 'available',
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      return { success: true, id: docRef.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Get all donations
  getAll: async (filters?: { status?: string; limit?: number }) => {
    try {
      let query = firestore()
        .collection('donations')
        .orderBy('createdAt', 'desc');

      if (filters?.status) {
        query = query.where('status', '==', filters.status) as any;
      }

      if (filters?.limit) {
        query = query.limit(filters.limit) as any;
      }

      const snapshot = await query.get();
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Get user's donations
  getByUser: async (uid: string) => {
    try {
      const snapshot = await firestore()
        .collection('donations')
        .where('donorId', '==', uid)
        .orderBy('createdAt', 'desc')
        .get();

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Update donation
  update: async (id: string, data: any) => {
    try {
      await firestore()
        .collection('donations')
        .doc(id)
        .update({
          ...data,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Delete donation
  delete: async (id: string) => {
    try {
      await firestore()
        .collection('donations')
        .doc(id)
        .delete();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Listen to donations
  listen: (callback: (data: any[]) => void, filters?: { status?: string }) => {
    let query = firestore()
      .collection('donations')
      .orderBy('createdAt', 'desc');

    if (filters?.status) {
      query = query.where('status', '==', filters.status) as any;
    }

    return query.onSnapshot(
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        callback(data);
      },
      (error) => {
        console.error('Donations listener error:', error);
      }
    );
  },
};

/**
 * Notifications Operations
 */
export const notifications = {
  // Create notification
  create: async (userId: string, data: any) => {
    try {
      await firestore()
        .collection('notifications')
        .add({
          ...data,
          userId,
          read: false,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Get user notifications
  getByUser: async (userId: string) => {
    try {
      const snapshot = await firestore()
        .collection('notifications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Mark as read
  markAsRead: async (id: string) => {
    try {
      await firestore()
        .collection('notifications')
        .doc(id)
        .update({ read: true });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Listen to notifications
  listen: (userId: string, callback: (data: any[]) => void) => {
    return firestore()
      .collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          callback(data);
        },
        (error) => {
          console.error('Notifications listener error:', error);
        }
      );
  },
};

/**
 * Feedback Operations
 */
export const feedback = {
  // Create feedback
  create: async (data: any) => {
    try {
      const user = firebaseAuth.currentUser;
      const docRef = await firestore()
        .collection('feedback')
        .add({
          ...data,
          userId: user?.uid || 'anonymous',
          userEmail: user?.email || data.email,
          status: 'pending',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      return { success: true, id: docRef.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Get all feedback (for analytics)
  getAll: async () => {
    try {
      const snapshot = await firestore()
        .collection('feedback')
        .orderBy('createdAt', 'desc')
        .get();

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Get user's feedback
  getByUser: async (userId: string) => {
    try {
      const snapshot = await firestore()
        .collection('feedback')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Update feedback status
  updateStatus: async (id: string, status: string) => {
    try {
      await firestore()
        .collection('feedback')
        .doc(id)
        .update({
          status,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Call Logs Operations (Firebase backup)
 */
export const callLogs = {
  // Create call log
  create: async (data: any) => {
    try {
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error('User not authenticated');

      await firestore()
        .collection('call_logs')
        .add({
          ...data,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

export default {
  userProfile,
  donations,
  notifications,
  feedback,
  callLogs,
};

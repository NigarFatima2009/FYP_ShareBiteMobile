/**
 * Notification Service
 * Handles real-time notifications for ShareBite
 */

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'donation' | 'request' | 'delivery' | 'pickup' | 'community' | 'donation_posted';
  donationId?: string;
  read: boolean;
  urgent?: boolean;
  createdAt: string;
  timestamp?: string;
}

/**
 * Get unread notification count for current user
 */
export const getUnreadCount = async (): Promise<number> => {
  try {
    const currentUser = auth().currentUser;
    if (!currentUser) return 0;

    const snapshot = await firestore()
      .collection('notifications')
      .where('userId', '==', currentUser.uid)
      .where('read', '==', false)
      .get();

    return snapshot.docs.length;
  } catch (error) {
    return 0;
  }
};

/**
 * Subscribe to real-time notification count updates
 */
export const subscribeToNotificationCount = (
  callback: (count: number) => void
): (() => void) => {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    callback(0);
    return () => {};
  }

  const unsubscribe = firestore()
    .collection('notifications')
    .where('userId', '==', currentUser.uid)
    .where('read', '==', false)
    .onSnapshot(
      (snapshot) => {
        callback(snapshot.docs.length);
      },
      () => {
        callback(0);
      }
    );

  return unsubscribe;
};

/**
 * Subscribe to real-time notifications
 */
export const subscribeToNotifications = (
  callback: (notifications: Notification[]) => void
): (() => void) => {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    callback([]);
    return () => {};
  }

  const unsubscribe = firestore()
    .collection('notifications')
    .where('userId', '==', currentUser.uid)
    .onSnapshot(
      (snapshot) => {
        const notifications = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as Notification))
          .sort((a, b) => {
            const dateA = new Date(a.createdAt || a.timestamp || 0);
            const dateB = new Date(b.createdAt || b.timestamp || 0);
            return dateB.getTime() - dateA.getTime();
          });
        callback(notifications);
      },
      () => {
        callback([]);
      }
    );

  return unsubscribe;
};

/**
 * Send notification to a specific user
 */
export const sendNotification = async (
  userId: string,
  notification: Omit<Notification, 'id' | 'userId' | 'read' | 'createdAt'>
): Promise<boolean> => {
  try {
    await firestore().collection('notifications').add({
      userId,
      ...notification,
      read: false,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Send notification to all users of a specific type
 */
export const sendNotificationToUserType = async (
  userType: 'donor' | 'ngo' | 'volunteer' | 'receiver',
  notification: Omit<Notification, 'id' | 'userId' | 'read' | 'createdAt'>
): Promise<number> => {
  try {
    const usersSnapshot = await firestore()
      .collection('users')
      .where('userType', '==', userType)
      .get();

    const batch = firestore().batch();
    let count = 0;

    usersSnapshot.docs.forEach(userDoc => {
      const notificationRef = firestore().collection('notifications').doc();
      batch.set(notificationRef, {
        userId: userDoc.id,
        ...notification,
        read: false,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });
      count++;
    });

    if (count > 0) {
      await batch.commit();
    }

    return count;
  } catch (error) {
    return 0;
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    await firestore()
      .collection('notifications')
      .doc(notificationId)
      .update({ read: true });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Mark all notifications as read for current user
 */
export const markAllAsRead = async (): Promise<boolean> => {
  try {
    const currentUser = auth().currentUser;
    if (!currentUser) return false;

    const snapshot = await firestore()
      .collection('notifications')
      .where('userId', '==', currentUser.uid)
      .where('read', '==', false)
      .get();

    const batch = firestore().batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId: string): Promise<boolean> => {
  try {
    await firestore()
      .collection('notifications')
      .doc(notificationId)
      .delete();
    return true;
  } catch (error) {
    return false;
  }
};

export default {
  getUnreadCount,
  subscribeToNotificationCount,
  subscribeToNotifications,
  sendNotification,
  sendNotificationToUserType,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateUser } = require('../middleware/auth');
const { db } = require('../config/firebase');
const { prioritizeNotification } = require('../services/aiService');

// ==================== GET ALL NOTIFICATIONS ====================
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { unreadOnly, limit = 50, type } = req.query;
    
    let query = db.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc');
    
    if (unreadOnly === 'true') {
      query = query.where('read', '==', false);
    }
    
    if (type) {
      query = query.where('type', '==', type);
    }
    
    query = query.limit(parseInt(limit));
    
    const snapshot = await query.get();
    
    const notifications = [];
    snapshot.forEach(doc => {
      notifications.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort by priority (critical first)
    notifications.sort((a, b) => {
      const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
      return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    });
    
    res.json({
      success: true,
      count: notifications.length,
      unreadCount: notifications.filter(n => !n.read).length,
      notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// ==================== CREATE NOTIFICATION ====================
router.post('/', [
  authenticateUser,
  body('userId').notEmpty(),
  body('type').notEmpty(),
  body('title').trim().notEmpty(),
  body('message').trim().notEmpty(),
  body('metadata').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { userId, type, title, message, metadata = {} } = req.body;
    
    // Use AI to determine priority
    const priorityInfo = prioritizeNotification(type, metadata);
    
    const notification = {
      userId,
      type,
      title,
      message,
      metadata,
      priority: priorityInfo.level,
      color: priorityInfo.color,
      sound: priorityInfo.sound,
      read: false,
      createdAt: new Date().toISOString(),
      createdBy: req.user.uid
    };
    
    const docRef = await db.collection('notifications').add(notification);
    
    console.log(`📬 [NOTIFICATION] ${priorityInfo.level.toUpperCase()} - ${title} → User: ${userId}`);
    
    res.status(201).json({
      success: true,
      message: 'Notification created',
      notification: {
        id: docRef.id,
        ...notification
      }
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification'
    });
  }
});

// ==================== MARK AS READ ====================
router.put('/:id/read', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    
    const notifDoc = await db.collection('notifications').doc(id).get();
    
    if (!notifDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    const notifData = notifDoc.data();
    
    // Check ownership
    if (notifData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this notification'
      });
    }
    
    await db.collection('notifications').doc(id).update({
      read: true,
      readAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification'
    });
  }
});

// ==================== MARK ALL AS READ ====================
router.put('/read-all', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();
    
    const batch = db.batch();
    const now = new Date().toISOString();
    
    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        read: true,
        readAt: now
      });
    });
    
    await batch.commit();
    
    res.json({
      success: true,
      message: `Marked ${snapshot.size} notifications as read`
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notifications'
    });
  }
});

// ==================== DELETE NOTIFICATION ====================
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    
    const notifDoc = await db.collection('notifications').doc(id).get();
    
    if (!notifDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    const notifData = notifDoc.data();
    
    // Check ownership
    if (notifData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this notification'
      });
    }
    
    await db.collection('notifications').doc(id).delete();
    
    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

// ==================== SEND NOTIFICATION TO ALL NGOs ====================
async function notifyAllNGOs(title, message, metadata = {}) {
  try {
    const ngosSnapshot = await db.collection('users')
      .where('userType', '==', 'ngo')
      .get();
    
    const batch = db.batch();
    const priorityInfo = prioritizeNotification('new_donation', metadata);
    
    ngosSnapshot.forEach(doc => {
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        userId: doc.id,
        type: 'new_donation',
        title,
        message,
        metadata,
        priority: priorityInfo.level,
        color: priorityInfo.color,
        sound: priorityInfo.sound,
        read: false,
        createdAt: new Date().toISOString()
      });
    });
    
    await batch.commit();
    
    console.log(`📢 [BROADCAST] Notified ${ngosSnapshot.size} NGOs: ${title}`);
    
    return { success: true, count: ngosSnapshot.size };
  } catch (error) {
    console.error('Notify NGOs error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = router;
module.exports.notifyAllNGOs = notifyAllNGOs;

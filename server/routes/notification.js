import express from 'express';
import Notification from '../models/Notification.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get admin notifications
router.get('/admin', authenticateAdmin, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.admin._id,
      recipientModel: 'Admin'
    }).sort({ createdAt: -1 }).limit(50);

    res.json(notifications);
  } catch (error) {
    console.error('Get admin notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get teacher notifications
router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    const notifications = await Notification.find({
      recipient: teacherId,
      recipientModel: 'Teacher'
    }).sort({ createdAt: -1 }).limit(50);

    res.json(notifications);
  } catch (error) {
    console.error('Get teacher notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
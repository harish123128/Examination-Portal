import express from 'express';
import crypto from 'crypto';
import Teacher from '../models/Teacher.js';
import Submission from '../models/Submission.js';
import Notification from '../models/Notification.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = express.Router();

// Add teacher
router.post('/add-teacher', authenticateAdmin, async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Check if teacher already exists
    const existingTeacher = await Teacher.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ message: 'Teacher with this email already exists' });
    }

    // Generate unique token
    const submissionToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const teacher = new Teacher({
      name,
      email,
      phone,
      submissionToken,
      tokenExpiry,
      addedBy: req.admin._id
    });

    await teacher.save();

    // Create notification for admin
    const notification = new Notification({
      recipient: req.admin._id,
      recipientModel: 'Admin',
      title: 'Teacher Added',
      message: `Teacher ${name} has been added successfully`,
      type: 'success',
      relatedId: teacher._id,
      relatedType: 'teacher'
    });
    await notification.save();

    // Emit real-time notification
    const io = req.app.get('io');
    io.to('admin').emit('notification', notification);

    res.status(201).json({
      teacher,
      submissionLink: `${process.env.CLIENT_URL}/submit/${submissionToken}`
    });
  } catch (error) {
    console.error('Add teacher error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all teachers
router.get('/teachers', authenticateAdmin, async (req, res) => {
  try {
    const teachers = await Teacher.find().populate('addedBy', 'name email').sort({ createdAt: -1 });
    res.json(teachers);
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all submissions
router.get('/submissions', authenticateAdmin, async (req, res) => {
  try {
    const submissions = await Submission.find()
      .populate('teacher', 'name email phone')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(submissions);
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Review submission
router.put('/submissions/:id/review', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes, paymentAmount } = req.body;

    const submission = await Submission.findById(id).populate('teacher');
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    submission.status = status;
    submission.reviewNotes = reviewNotes || '';
    submission.reviewedBy = req.admin._id;
    submission.reviewedAt = new Date();
    
    if (status === 'accepted' && paymentAmount) {
      submission.paymentAmount = paymentAmount;
      submission.paymentStatus = 'processing';
    }

    await submission.save();

    // Create notification for teacher
    const notification = new Notification({
      recipient: submission.teacher._id,
      recipientModel: 'Teacher',
      title: `Submission ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: status === 'accepted' 
        ? `Your submission has been accepted! Payment of ₹${paymentAmount} is being processed.`
        : `Your submission has been ${status}. ${reviewNotes}`,
      type: status === 'accepted' ? 'success' : status === 'declined' ? 'error' : 'info',
      relatedId: submission._id,
      relatedType: 'submission'
    });
    await notification.save();

    // Emit real-time notification
    const io = req.app.get('io');
    io.to(`teacher-${submission.teacher._id}`).emit('notification', notification);

    res.json(submission);
  } catch (error) {
    console.error('Review submission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Process payment
router.put('/submissions/:id/payment', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const submission = await Submission.findById(id).populate('teacher');
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    submission.paymentStatus = status;
    await submission.save();

    // Create notification for teacher
    const notification = new Notification({
      recipient: submission.teacher._id,
      recipientModel: 'Teacher',
      title: 'Payment Update',
      message: status === 'completed' 
        ? `Payment of ₹${submission.paymentAmount} has been completed!`
        : `Payment status updated to ${status}`,
      type: status === 'completed' ? 'success' : 'info',
      relatedId: submission._id,
      relatedType: 'payment'
    });
    await notification.save();

    // Emit real-time notification
    const io = req.app.get('io');
    io.to(`teacher-${submission.teacher._id}`).emit('notification', notification);

    res.json(submission);
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard stats
router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalTeachers = await Teacher.countDocuments();
    const totalSubmissions = await Submission.countDocuments();
    const pendingReviews = await Submission.countDocuments({ status: 'pending' });
    const completedPayments = await Submission.countDocuments({ paymentStatus: 'completed' });

    res.json({
      totalTeachers,
      totalSubmissions,
      pendingReviews,
      completedPayments
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
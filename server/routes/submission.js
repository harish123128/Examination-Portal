import express from 'express';
import Teacher from '../models/Teacher.js';
import Submission from '../models/Submission.js';
import Notification from '../models/Notification.js';
import upload from '../config/multer.js';
import { validateSubmissionToken } from '../middleware/auth.js';

const router = express.Router();

// Submit form
router.post('/submit/:token', validateSubmissionToken, upload.single('questionPaper'), async (req, res) => {
  try {
    const { token } = req.params;
    const {
      accountNumber,
      ifscCode,
      accountHolderName,
      subject,
      class: className,
      board,
      examType
    } = req.body;

    const teacher = await Teacher.findOne({ submissionToken: token });
    
    if (!teacher) {
      return res.status(404).json({ message: 'Invalid submission link' });
    }

    if (teacher.tokenExpiry < new Date()) {
      return res.status(400).json({ message: 'Submission link has expired' });
    }

    if (teacher.hasSubmitted) {
      return res.status(400).json({ message: 'Submission already completed' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Question paper file is required' });
    }

    // Create submission
    const submission = new Submission({
      teacher: teacher._id,
      bankDetails: {
        accountNumber,
        ifscCode,
        accountHolderName
      },
      subjectDetails: {
        subject,
        class: className,
        board,
        examType
      },
      questionPaper: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size
      }
    });

    await submission.save();

    // Mark teacher as submitted
    teacher.hasSubmitted = true;
    await teacher.save();

    // Create notifications
    const adminNotification = new Notification({
      recipient: teacher.addedBy,
      recipientModel: 'Admin',
      title: 'New Submission Received',
      message: `${teacher.name} has submitted their examination paper`,
      type: 'info',
      relatedId: submission._id,
      relatedType: 'submission'
    });
    await adminNotification.save();

    const teacherNotification = new Notification({
      recipient: teacher._id,
      recipientModel: 'Teacher',
      title: 'Submission Successful',
      message: 'Your examination paper has been submitted successfully and is under review',
      type: 'success',
      relatedId: submission._id,
      relatedType: 'submission'
    });
    await teacherNotification.save();

    // Emit real-time notifications
    const io = req.app.get('io');
    io.to('admin').emit('notification', adminNotification);
    io.to(`teacher-${teacher._id}`).emit('notification', teacherNotification);

    res.status(201).json({ message: 'Submission completed successfully' });
  } catch (error) {
    console.error('Submit form error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
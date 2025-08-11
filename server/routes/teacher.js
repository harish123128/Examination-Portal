import express from 'express';
import Teacher from '../models/Teacher.js';
import { validateSubmissionToken } from '../middleware/auth.js';

const router = express.Router();

// Validate submission token
router.get('/validate/:token', validateSubmissionToken, async (req, res) => {
  try {
    const { token } = req.params;

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

    res.json({
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone
      }
    });
  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
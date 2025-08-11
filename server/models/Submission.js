import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  bankDetails: {
    accountNumber: {
      type: String,
      required: true
    },
    ifscCode: {
      type: String,
      required: true
    },
    accountHolderName: {
      type: String,
      required: true
    }
  },
  subjectDetails: {
    subject: {
      type: String,
      required: true
    },
    class: {
      type: String,
      required: true
    },
    board: {
      type: String,
      required: true
    },
    examType: {
      type: String,
      required: true
    }
  },
  questionPaper: {
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'accepted', 'declined'],
    default: 'pending'
  },
  reviewNotes: {
    type: String,
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed'],
    default: 'pending'
  },
  paymentAmount: {
    type: Number,
    default: 0
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

export default mongoose.model('Submission', submissionSchema);
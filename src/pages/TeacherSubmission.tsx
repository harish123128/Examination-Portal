import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle, X, AlertCircle, Loader, Shield, Clock } from 'lucide-react';
import { URLValidationService, useURLValidation } from '../lib/urlValidation';
import { TeacherAuthService } from '../lib/teacherAuth';
import SubmissionWizard from '../components/teacher/SubmissionWizard';
import toast from 'react-hot-toast';

const TeacherSubmission = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Use URL validation hook
  const { result, loading, status, validate, isValid } = useURLValidation(
    token || null,
    'submission',
    {
      trackIP: true,
      trackUserAgent: true,
      maxAttempts: 5,
      windowDuration: 15
    }
  );

  // Load teacher data when validation is successful
  useEffect(() => {
    if (isValid && result?.user_id && !teacher) {
      loadTeacherData(result.user_id);
    }
  }, [isValid, result, teacher]);

  const loadTeacherData = async (userId: string) => {
    try {
      const teacherData = await TeacherAuthService.getTeacherByProfileId(userId);
      setTeacher(teacherData);
    } catch (error: any) {
      console.error('Error loading teacher data:', error);
      toast.error('Failed to load teacher information');
    }
  };

  const handleSubmissionComplete = () => {
    setSubmitted(true);
    toast.success('Submission completed successfully!');
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    validate();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader className="h-8 w-8 text-blue-400 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Validating submission link...</h2>
          <p className="text-white/70">Please wait while we verify your access.</p>
        </motion.div>
      </div>
    );
  }

  // Error states
  if (!isValid || !status) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center py-12 px-4">
        <motion.div
          className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center border border-white/20"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            status?.status === 'expired' ? 'bg-orange-500/20' :
            status?.status === 'error' && status?.canRetry ? 'bg-yellow-500/20' :
            'bg-red-500/20'
          }`}>
            {status?.status === 'expired' ? (
              <Clock className="h-8 w-8 text-orange-400" />
            ) : status?.status === 'error' && status?.canRetry ? (
              <AlertCircle className="h-8 w-8 text-yellow-400" />
            ) : (
              <X className="h-8 w-8 text-red-400" />
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-4">
            {status?.status === 'expired' ? 'Link Expired' :
             status?.status === 'error' ? 'Validation Error' :
             'Access Denied'}
          </h2>
          
          <p className="text-white/70 mb-6">
            {status?.message || result?.error || 'Unable to validate submission link'}
          </p>

          {status?.canRetry && retryCount < 3 && (
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all transform hover:scale-105"
              >
                Try Again ({3 - retryCount} attempts left)
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-white/50 mb-4">
              Need help? Contact your administrator for a new submission link.
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              ← Back to home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Success state - submission completed
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center py-12 px-4">
        <motion.div
          className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center border border-white/20"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Submission Complete!</h2>
          <p className="text-white/70 mb-6">
            Your examination paper has been submitted successfully and is now under review.
          </p>
          
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center mb-2">
              <Shield className="h-5 w-5 text-blue-400 mr-2" />
              <span className="text-sm font-medium text-white">Secure Submission</span>
            </div>
            <p className="text-xs text-white/60">
              Your submission is encrypted and securely stored. You will receive notifications about the review status.
            </p>
          </div>

          <p className="text-sm text-white/50">
            You will be notified about the review status and payment information via email and real-time notifications.
          </p>
        </motion.div>
      </div>
    );
  }

  // Main submission interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-400" />
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-white">Secure Examination Portal</h1>
                <p className="text-sm text-white/70">Paper Submission System</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 bg-green-500/20 rounded-full px-3 py-1 border border-green-500/30">
              <Shield className="h-4 w-4 text-green-400" />
              <span className="text-green-400 text-xs font-medium">Secure Connection</span>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Info */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-blue-400 mr-3" />
            <div>
              <p className="text-sm font-medium text-white">Link Validated Successfully</p>
              <p className="text-xs text-white/70">
                Validation #{result?.validation_count} • Secure token verified
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Welcome Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8 border border-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl font-bold text-white mb-2">
            Welcome{teacher?.profile?.full_name ? `, ${teacher.profile.full_name}` : ''}!
          </h2>
          <p className="text-white/70">
            Please complete the following steps to submit your examination paper securely.
          </p>
          
          {teacher?.profile && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-white/60">Email</p>
                <p className="text-white font-medium">{teacher.profile.email}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-white/60">Phone</p>
                <p className="text-white font-medium">{teacher.profile.phone || 'Not provided'}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-white/60">Status</p>
                <p className="text-green-400 font-medium">Verified Teacher</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Submission Wizard */}
        {teacher && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <SubmissionWizard 
              teacher={teacher} 
              token={token!} 
              onComplete={handleSubmissionComplete}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TeacherSubmission;
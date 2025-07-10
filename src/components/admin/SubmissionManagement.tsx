import React, { useState, useEffect } from 'react';
import { FileText, Eye, Check, X, DollarSign, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Submission {
  id: string;
  teacher_id: string;
  bank_details: {
    account_number: string;
    ifsc_code: string;
    account_holder_name: string;
  };
  subject_details: {
    subject: string;
    class: string;
    board: string;
    exam_type: string;
  };
  question_paper_url: string;
  question_paper_name: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  review_notes: string;
  payment_status: 'pending' | 'processing' | 'completed' | 'failed';
  payment_amount: number;
  created_at: string;
  teacher?: {
    profile?: {
      full_name: string;
      email: string;
      phone: string;
    };
  };
}

interface SubmissionManagementProps {
  onUpdate: () => void;
}

const SubmissionManagement: React.FC<SubmissionManagementProps> = ({ onUpdate }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          teacher:teachers(
            profile:profiles!teachers_profile_id_fkey(full_name, email, phone)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to fetch submissions');
    }
  };

  const handleReview = async (submissionId: string, status: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updateData: any = {
        status,
        review_notes: reviewNotes,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (status === 'approved' && paymentAmount > 0) {
        updateData.payment_amount = paymentAmount;
        updateData.payment_status = 'processing';
      }

      const { error } = await supabase
        .from('submissions')
        .update(updateData)
        .eq('id', submissionId);

      if (error) throw error;

      // Create notification for teacher
      const submission = submissions.find(s => s.id === submissionId);
      if (submission?.teacher_id) {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('profile_id')
          .eq('id', submission.teacher_id)
          .single();

        if (teacher?.profile_id) {
          await supabase.rpc('create_notification', {
            p_recipient_id: teacher.profile_id,
            p_title: `Submission ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            p_message: status === 'approved' 
              ? `Your submission has been approved! Payment of ₹${paymentAmount} is being processed.`
              : `Your submission has been ${status}. ${reviewNotes}`,
            p_type: status === 'approved' ? 'success' : 'error',
            p_related_id: submissionId,
            p_related_type: 'submission'
          });
        }
      }
      
      toast.success(`Submission ${status} successfully`);
      setSelectedSubmission(null);
      setReviewNotes('');
      setPaymentAmount(0);
      fetchSubmissions();
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to review submission');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (submissionId: string, status: 'completed') => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ 
          payment_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (error) throw error;

      // Create notification for teacher
      const submission = submissions.find(s => s.id === submissionId);
      if (submission?.teacher_id) {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('profile_id')
          .eq('id', submission.teacher_id)
          .single();

        if (teacher?.profile_id) {
          await supabase.rpc('create_notification', {
            p_recipient_id: teacher.profile_id,
            p_title: 'Payment Completed',
            p_message: `Payment of ₹${submission.payment_amount} has been completed successfully!`,
            p_type: 'success',
            p_related_id: submissionId,
            p_related_type: 'payment'
          });
        }
      }
      
      toast.success('Payment status updated successfully');
      fetchSubmissions();
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update payment');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'under_review': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Submission Management
        </h3>
      </div>

      <div className="p-6">
        {submissions.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No submissions yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {submissions.map((submission) => (
              <div key={submission.id} className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {submission.teacher?.profile?.full_name || 'Unknown Teacher'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {submission.teacher?.profile?.email || 'No email'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Submitted on {format(new Date(submission.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                      {submission.status.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(submission.payment_status)}`}>
                      Payment: {submission.payment_status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Subject Details</h5>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Subject:</span> {submission.subject_details.subject}</p>
                      <p><span className="font-medium">Class:</span> {submission.subject_details.class}</p>
                      <p><span className="font-medium">Board:</span> {submission.subject_details.board}</p>
                      <p><span className="font-medium">Exam Type:</span> {submission.subject_details.exam_type}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Bank Details</h5>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Account:</span> {submission.bank_details.account_number}</p>
                      <p><span className="font-medium">IFSC:</span> {submission.bank_details.ifsc_code}</p>
                      <p><span className="font-medium">Name:</span> {submission.bank_details.account_holder_name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center space-x-4">
                    <a
                      href={submission.question_paper_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      <Download className="h-4 w-4" />
                      <span>{submission.question_paper_name}</span>
                    </a>
                    {submission.payment_amount > 0 && (
                      <span className="text-sm text-gray-600">
                        Amount: ₹{submission.payment_amount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {submission.status === 'pending' && (
                      <button
                        onClick={() => setSelectedSubmission(submission)}
                        className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Review</span>
                      </button>
                    )}
                    
                    {submission.status === 'approved' && submission.payment_status === 'processing' && (
                      <button
                        onClick={() => handlePayment(submission.id, 'completed')}
                        disabled={loading}
                        className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                      >
                        <DollarSign className="h-4 w-4" />
                        <span>Complete Payment</span>
                      </button>
                    )}
                  </div>
                </div>

                {submission.review_notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Review Notes:</span> {submission.review_notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Review Submission - {selectedSubmission.teacher?.profile?.full_name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Notes
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Add your review notes..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount (for approval)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter amount in ₹"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReview(selectedSubmission.id, 'rejected')}
                disabled={loading}
                className="flex items-center space-x-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                <span>Reject</span>
              </button>
              <button
                onClick={() => handleReview(selectedSubmission.id, 'approved')}
                disabled={loading || paymentAmount <= 0}
                className="flex items-center space-x-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>Approve</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionManagement;
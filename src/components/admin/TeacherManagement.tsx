import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Users, Mail, Phone, Copy, ExternalLink, UserPlus, Shield, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { RealtimeService } from '../../lib/realtime';
import { useRealtime } from '../../contexts/RealtimeContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Teacher {
  id: string;
  profile_id: string | null;
  submission_token: string;
  token_expires_at: string;
  has_submitted: boolean;
  created_at: string;
  profile?: {
    full_name: string;
    email: string;
    phone: string;
  };
}

interface TeacherForm {
  email: string;
  full_name: string;
  phone: string;
}

interface TeacherManagementProps {
  onUpdate: () => void;
}

const TeacherManagement: React.FC<TeacherManagementProps> = ({ onUpdate }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<TeacherForm>();
  const { createNotification, onlineUsers } = useRealtime();

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          *,
          profile:profiles(full_name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast.error('Failed to fetch teachers');
    }
  };

  const onSubmit = async (data: TeacherForm) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create teacher record with auto-generated token
      const { data: teacher, error } = await supabase
        .from('teachers')
        .insert({
          added_by: user.id,
          has_submitted: false
        })
        .select()
        .single();

      if (error) throw error;

      // Generate secure submission token
      const token = await RealtimeService.createSubmissionToken(teacher.id);
      
      // Create invitation link
      const invitationLink = `${window.location.origin}/teacher/signup/${token}`;
      const submissionLink = `${window.location.origin}/submit/${token}`;
      
      toast.success(
        <div>
          <p className="font-medium">Teacher invitation created!</p>
          <div className="mt-2 space-y-1 text-sm">
            <p>Signup: <span className="font-mono text-xs">{invitationLink}</span></p>
            <p>Submit: <span className="font-mono text-xs">{submissionLink}</span></p>
          </div>
        </div>,
        { duration: 10000 }
      );

      // Copy invitation link to clipboard
      navigator.clipboard.writeText(invitationLink);
      
      // Create notification for admin
      await createNotification(
        user.id,
        'Teacher Invitation Created',
        `New teacher invitation created with secure token. Links copied to clipboard.`,
        'success',
        teacher.id,
        'teacher'
      );

      reset();
      setShowForm(false);
      fetchTeachers();
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create teacher invitation');
    } finally {
      setLoading(false);
    }
  };

  const regenerateToken = async (teacherId: string) => {
    setGeneratingToken(teacherId);
    try {
      const newToken = await RealtimeService.createSubmissionToken(teacherId);
      
      const invitationLink = `${window.location.origin}/teacher/signup/${newToken}`;
      const submissionLink = `${window.location.origin}/submit/${newToken}`;
      
      toast.success(
        <div>
          <p className="font-medium">New token generated!</p>
          <div className="mt-2 space-y-1 text-sm">
            <p>Signup: <span className="font-mono text-xs">{invitationLink}</span></p>
            <p>Submit: <span className="font-mono text-xs">{submissionLink}</span></p>
          </div>
        </div>,
        { duration: 10000 }
      );
      
      navigator.clipboard.writeText(invitationLink);
      fetchTeachers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate token');
    } finally {
      setGeneratingToken(null);
    }
  };

  const copyInvitationLink = (token: string) => {
    const link = `${window.location.origin}/teacher/signup/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invitation link copied to clipboard!');
  };

  const copySubmissionLink = (token: string) => {
    const link = `${window.location.origin}/submit/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Submission link copied to clipboard!');
  };

  const getTeacherStatus = (teacher: Teacher) => {
    const isOnline = teacher.profile_id ? onlineUsers.has(teacher.profile_id) : false;
    const isExpired = new Date(teacher.token_expires_at) < new Date();
    
    if (teacher.profile) {
      if (teacher.has_submitted) {
        return { status: 'submitted', color: 'green', label: 'Submitted', icon: CheckCircle };
      } else if (isOnline) {
        return { status: 'online', color: 'blue', label: 'Online', icon: Shield };
      } else {
        return { status: 'active', color: 'blue', label: 'Active', icon: Shield };
      }
    } else if (isExpired) {
      return { status: 'expired', color: 'red', label: 'Invitation Expired', icon: Clock };
    } else {
      return { status: 'pending', color: 'yellow', label: 'Invitation Sent', icon: Clock };
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
      <div className="p-6 border-b border-white/20">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Teacher Management
            <span className="ml-2 bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full">
              {teachers.length} Total
            </span>
          </h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105"
          >
            <Plus className="h-4 w-4" />
            <span>Invite Teacher</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-6 border-b border-white/20 bg-white/5">
          <h4 className="text-md font-medium text-white mb-4 flex items-center">
            <UserPlus className="h-5 w-5 mr-2" />
            Create Teacher Invitation
          </h4>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Teacher Name
                </label>
                <input
                  {...register('full_name', { required: 'Name is required' })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-white/50 py-2 px-3"
                  placeholder="Teacher name (for reference)"
                />
                {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Expected Email
                </label>
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  type="email"
                  className="w-full bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-white/50 py-2 px-3"
                  placeholder="teacher@example.com"
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Phone Number
                </label>
                <input
                  {...register('phone', { required: 'Phone is required' })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-white/50 py-2 px-3"
                  placeholder="Phone number"
                />
                {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>}
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Invitation'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-all border border-white/20"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="p-6">
        {teachers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-white/40 mx-auto mb-4" />
            <p className="text-white/70">No teacher invitations created yet</p>
            <p className="text-white/50 text-sm mt-2">Create your first teacher invitation to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {teachers.map((teacher) => {
              const status = getTeacherStatus(teacher);
              const StatusIcon = status.icon;
              
              return (
                <div key={teacher.id} className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {teacher.profile ? (
                        <>
                          <div className="flex items-center space-x-3">
                            <h4 className="font-medium text-white">{teacher.profile.full_name}</h4>
                            {onlineUsers.has(teacher.profile_id!) && (
                              <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-xs text-green-400">Online</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-white/70">
                            <span className="flex items-center">
                              <Mail className="h-4 w-4 mr-1" />
                              {teacher.profile.email}
                            </span>
                            <span className="flex items-center">
                              <Phone className="h-4 w-4 mr-1" />
                              {teacher.profile.phone}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <h4 className="font-medium text-white">Invitation Pending</h4>
                          <p className="text-sm text-white/70">
                            Created on {format(new Date(teacher.created_at), 'MMM dd, yyyy')}
                          </p>
                          <p className="text-xs text-white/50">
                            Expires on {format(new Date(teacher.token_expires_at), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </>
                      )}
                      
                      <div className="mt-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${status.color}-500/20 text-${status.color}-400 border border-${status.color}-500/30`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {!teacher.profile && new Date(teacher.token_expires_at) > new Date() && (
                        <>
                          <button
                            onClick={() => copyInvitationLink(teacher.submission_token)}
                            className="p-2 text-white/60 hover:text-blue-400 transition-colors"
                            title="Copy invitation link"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => regenerateToken(teacher.id)}
                            disabled={generatingToken === teacher.id}
                            className="p-2 text-white/60 hover:text-yellow-400 transition-colors disabled:opacity-50"
                            title="Regenerate token"
                          >
                            {generatingToken === teacher.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </button>
                        </>
                      )}
                      
                      {teacher.profile && !teacher.has_submitted && (
                        <button
                          onClick={() => copySubmissionLink(teacher.submission_token)}
                          className="p-2 text-white/60 hover:text-blue-400 transition-colors"
                          title="Copy submission link"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                      
                      {teacher.profile && (
                        <a
                          href={`/submit/${teacher.submission_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-white/60 hover:text-blue-400 transition-colors"
                          title="Open submission link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherManagement;
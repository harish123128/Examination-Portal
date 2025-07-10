import { supabase } from './supabase';

export interface TeacherSignUpData {
  token: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface TeacherValidationResult {
  valid: boolean;
  teacher?: {
    id: string;
    added_by: string;
    token_expires_at: string;
  };
  error?: string;
}

export class TeacherAuthService {
  // Validate teacher token without creating profile
  static async validateToken(token: string): Promise<TeacherValidationResult> {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, added_by, token_expires_at')
        .eq('submission_token', token)
        .gt('token_expires_at', new Date().toISOString())
        .is('profile_id', null)
        .single();

      if (error || !data) {
        return {
          valid: false,
          error: 'Invalid or expired invitation link'
        };
      }

      return {
        valid: true,
        teacher: data
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Failed to validate token'
      };
    }
  }

  // Create teacher profile using token
  static async createTeacherProfile(signUpData: TeacherSignUpData) {
    try {
      // First validate the token
      const validation = await this.validateToken(signUpData.token);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Create auth user with auto-confirmed email
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signUpData.email,
        password: signUpData.password,
        options: {
          data: {
            full_name: signUpData.fullName,
            role: 'teacher',
            phone: signUpData.phone
          },
          emailRedirectTo: undefined // Disable email confirmation
        }
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Update teacher record with the new profile_id
      const { error: updateError } = await supabase
        .from('teachers')
        .update({ 
          profile_id: authData.user.id,
          updated_at: new Date().toISOString()
        })
        .eq('submission_token', signUpData.token);

      if (updateError) throw updateError;

      // Create welcome notification
      await supabase.rpc('create_notification', {
        p_recipient_id: authData.user.id,
        p_title: 'Welcome to the Examination Portal',
        p_message: 'Your account has been created successfully. You can now submit examination papers and track their status.',
        p_type: 'success'
      });

      return authData;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create teacher profile');
    }
  }

  // Get teacher data by profile ID
  static async getTeacherByProfileId(profileId: string) {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          *,
          added_by_profile:profiles!teachers_added_by_fkey(full_name, email)
        `)
        .eq('profile_id', profileId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error('Failed to fetch teacher data');
    }
  }

  // Submit examination paper
  static async submitExaminationPaper(submissionData: {
    teacherId: string;
    bankDetails: {
      account_number: string;
      ifsc_code: string;
      account_holder_name: string;
    };
    subjectDetails: {
      subject: string;
      class: string;
      board: string;
      exam_type: string;
    };
    questionPaperFile: File;
  }) {
    try {
      // Upload file to Supabase Storage
      const fileExt = submissionData.questionPaperFile.name.split('.').pop();
      const fileName = `${submissionData.teacherId}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('question-papers')
        .upload(fileName, submissionData.questionPaperFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('question-papers')
        .getPublicUrl(fileName);

      // Create submission record
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          teacher_id: submissionData.teacherId,
          bank_details: submissionData.bankDetails,
          subject_details: submissionData.subjectDetails,
          question_paper_url: urlData.publicUrl,
          question_paper_name: submissionData.questionPaperFile.name,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Mark teacher as submitted
      await supabase
        .from('teachers')
        .update({ 
          has_submitted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionData.teacherId);

      // Get teacher and admin info for notifications
      const { data: teacher } = await supabase
        .from('teachers')
        .select(`
          *,
          profile:profiles(full_name),
          added_by_profile:profiles!teachers_added_by_fkey(id, full_name)
        `)
        .eq('id', submissionData.teacherId)
        .single();

      if (teacher) {
        // Create notification for teacher
        await supabase.rpc('create_notification', {
          p_recipient_id: teacher.profile_id,
          p_title: 'Submission Successful',
          p_message: `Your ${submissionData.subjectDetails.subject} examination paper has been submitted successfully and is under review.`,
          p_type: 'success',
          p_related_id: submission.id,
          p_related_type: 'submission'
        });

        // Create notification for admin
        await supabase.rpc('create_notification', {
          p_recipient_id: teacher.added_by,
          p_title: 'New Submission Received',
          p_message: `${teacher.profile?.full_name} has submitted a ${submissionData.subjectDetails.subject} examination paper for review.`,
          p_type: 'info',
          p_related_id: submission.id,
          p_related_type: 'submission'
        });
      }

      return submission;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to submit examination paper');
    }
  }
}
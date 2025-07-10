import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase Config:', {
  url: supabaseUrl ? 'Set' : 'Missing',
  key: supabaseAnonKey ? 'Set' : 'Missing'
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Test connection
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Supabase connection error:', error);
  } else {
    console.log('Supabase connected successfully');
  }
});

// Database types
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'teacher';
  avatar_url?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Teacher {
  id: string;
  profile_id: string | null;
  submission_token: string;
  token_expires_at: string;
  has_submitted: boolean;
  added_by: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Submission {
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
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  teacher?: Teacher;
}

export interface Notification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  related_id?: string;
  related_type?: string;
  created_at: string;
}
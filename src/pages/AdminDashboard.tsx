import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../contexts/RealtimeContext';
import DashboardHeader from '../components/admin/DashboardHeader';
import StatsCards from '../components/admin/StatsCards';
import TeacherManagement from '../components/admin/TeacherManagement';
import SubmissionManagement from '../components/admin/SubmissionManagement';
import NotificationPanel from '../components/admin/NotificationPanel';
import { supabase } from '../lib/supabase';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalSubmissions: 0,
    pendingReviews: 0,
    completedPayments: 0
  });
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchStats();
    }
  }, [profile]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch all stats in parallel for better performance
      const [teachersResult, submissionsResult] = await Promise.all([
        supabase.from('teachers').select('id, has_submitted', { count: 'exact' }),
        supabase.from('submissions').select('id, status, payment_status', { count: 'exact' })
      ]);

      const totalTeachers = teachersResult.count || 0;
      const totalSubmissions = submissionsResult.count || 0;
      
      const submissions = submissionsResult.data || [];
      const pendingReviews = submissions.filter(s => 
        s.status === 'pending' || s.status === 'under_review'
      ).length;
      const completedPayments = submissions.filter(s => 
        s.payment_status === 'completed'
      ).length;

      setStats({
        totalTeachers,
        totalSubmissions,
        pendingReviews,
        completedPayments
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <StatsCards stats={stats} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TeacherManagement onUpdate={fetchStats} />
              <NotificationPanel />
            </div>
          </div>
        );
      case 'teachers':
        return <TeacherManagement onUpdate={fetchStats} />;
      case 'submissions':
        return <SubmissionManagement onUpdate={fetchStats} />;
      case 'notifications':
        return <NotificationPanel />;
      default:
        return null;
    }
  };

  // Show loading screen while profile is being loaded
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <div className="text-white">
            <p className="text-lg font-medium">Loading Paperly Dashboard...</p>
            <p className="text-sm text-white/70 mt-2">Preparing your admin workspace</p>
          </div>
        </div>
      </div>
    );
  }

  // Redirect if not admin
  if (profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-white/70">You don't have permission to access the Paperly admin dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      <DashboardHeader 
        admin={profile} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default AdminDashboard;
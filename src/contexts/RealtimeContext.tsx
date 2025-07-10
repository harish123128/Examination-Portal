import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { RealtimeService, RealtimeEvent } from '../lib/realtime';
import { useAuth } from './AuthContext';
import type { Notification, Submission } from '../lib/supabase';
import toast from 'react-hot-toast';

interface RealtimeContextType {
  notifications: Notification[];
  unreadCount: number;
  submissions: Submission[];
  onlineUsers: Set<string>;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshSubmissions: () => Promise<void>;
  createNotification: (
    recipientId: string,
    title: string,
    message: string,
    type?: 'info' | 'success' | 'warning' | 'error',
    relatedId?: string,
    relatedType?: string
  ) => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [channels, setChannels] = useState<RealtimeChannel[]>([]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Handle real-time events
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    console.log('Real-time event received:', event);

    switch (event.event_type) {
      case 'notification_created':
        const newNotification = event.data as Notification;
        setNotifications(prev => [newNotification, ...prev]);
        
        // Show toast notification
        toast.success(newNotification.title, {
          description: newNotification.message,
          duration: 5000
        });
        break;

      case 'submission_updated':
        const submissionData = event.data;
        setSubmissions(prev => 
          prev.map(sub => 
            sub.id === submissionData.submission_id 
              ? { ...sub, ...submissionData }
              : sub
          )
        );
        
        // Show status update toast
        if (submissionData.status === 'approved') {
          toast.success('Submission Approved!', {
            description: `Payment of ₹${submissionData.payment_amount} is being processed.`
          });
        } else if (submissionData.status === 'rejected') {
          toast.error('Submission Rejected', {
            description: 'Please check the review notes for details.'
          });
        }
        break;

      case 'token_created':
        toast.info('New Submission Link Created', {
          description: 'A new submission token has been generated.'
        });
        break;

      case 'user_online':
        setOnlineUsers(prev => new Set([...prev, event.user_id]));
        break;

      case 'user_offline':
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(event.user_id);
          return newSet;
        });
        break;
    }
  }, []);

  // Load initial data
  useEffect(() => {
    if (!user || !profile) return;

    loadNotifications();
    if (profile.role === 'admin') {
      loadSubmissions();
    }
  }, [user, profile]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user || !profile) return;

    const newChannels: RealtimeChannel[] = [];
    setConnectionStatus('connecting');

    // User-specific channel
    const userChannel = supabase.channel(`user_${user.id}`);
    
    // Subscribe to notifications
    userChannel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${user.id}`
      },
      (payload) => {
        const newNotification = payload.new as Notification;
        setNotifications(prev => [newNotification, ...prev]);
        
        toast.success(newNotification.title, {
          description: newNotification.message
        });
      }
    );

    // Subscribe to real-time events
    userChannel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'realtime_events',
        filter: `user_id=eq.${user.id}`
      },
      (payload) => {
        handleRealtimeEvent(payload.new as RealtimeEvent);
      }
    );

    newChannels.push(userChannel);

    // Admin-specific subscriptions
    if (profile.role === 'admin') {
      const adminChannel = supabase.channel('admin_events');
      
      adminChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            loadSubmissions();
            toast.info('New Submission Received');
          } else if (payload.eventType === 'UPDATE') {
            const updatedSubmission = payload.new as Submission;
            setSubmissions(prev =>
              prev.map(sub =>
                sub.id === updatedSubmission.id ? updatedSubmission : sub
              )
            );
          }
        }
      );

      adminChannel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'teachers'
        },
        () => {
          toast.info('New Teacher Added');
        }
      );

      newChannels.push(adminChannel);
    }

    // Presence tracking
    const presenceChannel = supabase.channel('online_users');
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const users = new Set(Object.keys(state));
      setOnlineUsers(users);
    });

    presenceChannel.on('presence', { event: 'join' }, ({ key }) => {
      setOnlineUsers(prev => new Set([...prev, key]));
    });

    presenceChannel.on('presence', { event: 'leave' }, ({ key }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    });

    // Track user presence
    presenceChannel.track({
      user_id: user.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      online_at: new Date().toISOString()
    });

    newChannels.push(presenceChannel);

    // Subscribe to all channels
    Promise.all(newChannels.map(channel => channel.subscribe()))
      .then(() => {
        setConnectionStatus('connected');
        console.log('All real-time channels connected');
      })
      .catch((error) => {
        setConnectionStatus('disconnected');
        console.error('Failed to connect to real-time channels:', error);
        toast.error('Real-time connection failed');
      });

    setChannels(newChannels);

    return () => {
      newChannels.forEach(channel => {
        supabase.removeChannel(channel);
      });
      setChannels([]);
      setConnectionStatus('disconnected');
    };
  }, [user, profile, handleRealtimeEvent]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const loadSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          teacher:teachers(
            *,
            profile:profiles!teachers_profile_id_fkey(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error loading submissions:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const refreshSubmissions = async () => {
    await loadSubmissions();
  };

  const createNotification = async (
    recipientId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    relatedId?: string,
    relatedType?: string
  ) => {
    try {
      await RealtimeService.createNotification(
        recipientId,
        title,
        message,
        type,
        relatedId,
        relatedType
      );
    } catch (error) {
      console.error('Error creating notification:', error);
      toast.error('Failed to send notification');
    }
  };

  return (
    <RealtimeContext.Provider value={{
      notifications,
      unreadCount,
      submissions,
      onlineUsers,
      connectionStatus,
      markAsRead,
      markAllAsRead,
      refreshSubmissions,
      createNotification
    }}>
      {children}
    </RealtimeContext.Provider>
  );
};
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import type { Notification, Submission } from './supabase';

export interface RealtimeEvent {
  event_id: string;
  event_type: string;
  user_id: string;
  data: any;
  channel?: string;
}

export interface URLValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
  user_id?: string;
  token_type?: string;
  validation_count?: number;
}

export class RealtimeService {
  private static channels: Map<string, RealtimeChannel> = new Map();
  private static eventHandlers: Map<string, Set<(event: RealtimeEvent) => void>> = new Map();

  // Subscribe to real-time channel
  static subscribe(channelName: string, callback: (event: RealtimeEvent) => void): () => void {
    let channel = this.channels.get(channelName);
    
    if (!channel) {
      channel = supabase.channel(channelName);
      this.channels.set(channelName, channel);
      
      // Listen for PostgreSQL notifications
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'realtime_events'
      }, (payload) => {
        const event = payload.new as RealtimeEvent;
        this.handleEvent(event);
      });
      
      channel.subscribe();
    }
    
    // Add callback to handlers
    if (!this.eventHandlers.has(channelName)) {
      this.eventHandlers.set(channelName, new Set());
    }
    this.eventHandlers.get(channelName)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(channelName);
      if (handlers) {
        handlers.delete(callback);
        if (handlers.size === 0) {
          this.eventHandlers.delete(channelName);
          channel?.unsubscribe();
          this.channels.delete(channelName);
        }
      }
    };
  }

  // Handle incoming events
  private static handleEvent(event: RealtimeEvent) {
    const channelHandlers = this.eventHandlers.get(event.channel || 'default');
    if (channelHandlers) {
      channelHandlers.forEach(handler => handler(event));
    }
  }

  // Validate URL token with real-time tracking
  static async validateURLToken(
    token: string,
    tokenType: 'submission' | 'invitation' | 'reset' | 'verification',
    ipAddress?: string,
    userAgent?: string
  ): Promise<URLValidationResult> {
    try {
      const { data, error } = await supabase.rpc('validate_url_token', {
        p_token: token,
        p_token_type: tokenType,
        p_ip_address: ipAddress,
        p_user_agent: userAgent
      });

      if (error) {
        console.error('URL validation error:', error);
        return {
          valid: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR'
        };
      }

      return data as URLValidationResult;
    } catch (error: any) {
      console.error('URL validation exception:', error);
      
      // Handle rate limiting
      if (error.message?.includes('Rate limit exceeded')) {
        return {
          valid: false,
          error: 'Too many validation attempts. Please try again later.',
          code: 'RATE_LIMITED'
        };
      }
      
      return {
        valid: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  // Create submission token with validation tracking
  static async createSubmissionToken(teacherId: string): Promise<string> {
    const { data, error } = await supabase.rpc('create_submission_token', {
      p_teacher_id: teacherId
    });

    if (error) {
      throw new Error(`Failed to create submission token: ${error.message}`);
    }

    return data;
  }

  // Create notification with real-time delivery
  static async createNotification(
    recipientId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    relatedId?: string,
    relatedType?: string
  ): Promise<string> {
    const { data, error } = await supabase.rpc('create_notification_realtime', {
      p_recipient_id: recipientId,
      p_title: title,
      p_message: message,
      p_type: type,
      p_related_id: relatedId,
      p_related_type: relatedType
    });

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return data;
  }

  // Subscribe to user-specific events
  static subscribeToUserEvents(userId: string, callback: (event: RealtimeEvent) => void): () => void {
    return this.subscribe(`user_${userId}`, callback);
  }

  // Subscribe to admin events
  static subscribeToAdminEvents(callback: (event: RealtimeEvent) => void): () => void {
    return this.subscribe('admin_events', callback);
  }

  // Subscribe to teacher events
  static subscribeToTeacherEvents(callback: (event: RealtimeEvent) => void): () => void {
    return this.subscribe('teacher_events', callback);
  }

  // Get client IP address
  static async getClientIP(): Promise<string | null> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return null;
    }
  }

  // Get user agent
  static getUserAgent(): string {
    return navigator.userAgent;
  }

  // Clean up all subscriptions
  static cleanup() {
    this.channels.forEach(channel => channel.unsubscribe());
    this.channels.clear();
    this.eventHandlers.clear();
  }
}

// Real-time hooks for React components
export const useRealtime = (channelName: string, callback: (event: RealtimeEvent) => void) => {
  React.useEffect(() => {
    const unsubscribe = RealtimeService.subscribe(channelName, callback);
    return unsubscribe;
  }, [channelName, callback]);
};

export const useUserRealtime = (userId: string, callback: (event: RealtimeEvent) => void) => {
  React.useEffect(() => {
    if (!userId) return;
    const unsubscribe = RealtimeService.subscribeToUserEvents(userId, callback);
    return unsubscribe;
  }, [userId, callback]);
};

export const useAdminRealtime = (callback: (event: RealtimeEvent) => void) => {
  React.useEffect(() => {
    const unsubscribe = RealtimeService.subscribeToAdminEvents(callback);
    return unsubscribe;
  }, [callback]);
};

// Export for global cleanup
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    RealtimeService.cleanup();
  });
}
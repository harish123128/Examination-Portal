import { RealtimeService } from './realtime';
import type { URLValidationResult } from './realtime';

export interface ValidationOptions {
  trackIP?: boolean;
  trackUserAgent?: boolean;
  maxAttempts?: number;
  windowDuration?: number; // in minutes
}

export class URLValidationService {
  private static cache = new Map<string, URLValidationResult>();
  private static cacheExpiry = new Map<string, number>();

  // Validate submission token
  static async validateSubmissionToken(
    token: string,
    options: ValidationOptions = {}
  ): Promise<URLValidationResult> {
    return this.validateToken(token, 'submission', options);
  }

  // Validate invitation token
  static async validateInvitationToken(
    token: string,
    options: ValidationOptions = {}
  ): Promise<URLValidationResult> {
    return this.validateToken(token, 'invitation', options);
  }

  // Validate password reset token
  static async validateResetToken(
    token: string,
    options: ValidationOptions = {}
  ): Promise<URLValidationResult> {
    return this.validateToken(token, 'reset', options);
  }

  // Validate email verification token
  static async validateVerificationToken(
    token: string,
    options: ValidationOptions = {}
  ): Promise<URLValidationResult> {
    return this.validateToken(token, 'verification', options);
  }

  // Generic token validation
  private static async validateToken(
    token: string,
    tokenType: 'submission' | 'invitation' | 'reset' | 'verification',
    options: ValidationOptions = {}
  ): Promise<URLValidationResult> {
    const cacheKey = `${tokenType}:${token}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey);
      if (expiry && Date.now() < expiry) {
        return this.cache.get(cacheKey)!;
      } else {
        this.cache.delete(cacheKey);
        this.cacheExpiry.delete(cacheKey);
      }
    }

    try {
      let ipAddress: string | undefined;
      let userAgent: string | undefined;

      // Get client information if tracking is enabled
      if (options.trackIP !== false) {
        ipAddress = await RealtimeService.getClientIP();
      }
      
      if (options.trackUserAgent !== false) {
        userAgent = RealtimeService.getUserAgent();
      }

      // Validate token
      const result = await RealtimeService.validateURLToken(
        token,
        tokenType,
        ipAddress,
        userAgent
      );

      // Cache successful validations for 5 minutes
      if (result.valid) {
        this.cache.set(cacheKey, result);
        this.cacheExpiry.set(cacheKey, Date.now() + 5 * 60 * 1000);
      }

      return result;
    } catch (error: any) {
      console.error(`Token validation error for ${tokenType}:`, error);
      
      return {
        valid: false,
        error: error.message || 'Validation failed',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  // Clear validation cache
  static clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  // Get validation status for UI
  static getValidationStatus(result: URLValidationResult): {
    status: 'valid' | 'invalid' | 'expired' | 'error';
    message: string;
    canRetry: boolean;
  } {
    if (result.valid) {
      return {
        status: 'valid',
        message: 'Token is valid and ready to use',
        canRetry: false
      };
    }

    switch (result.code) {
      case 'TOKEN_EXPIRED':
        return {
          status: 'expired',
          message: 'This link has expired. Please request a new one.',
          canRetry: false
        };
      
      case 'TOKEN_INVALID':
        return {
          status: 'invalid',
          message: 'This link has already been used or is no longer valid.',
          canRetry: false
        };
      
      case 'INVALID_TOKEN':
        return {
          status: 'invalid',
          message: 'Invalid link. Please check the URL and try again.',
          canRetry: false
        };
      
      case 'RATE_LIMITED':
        return {
          status: 'error',
          message: 'Too many attempts. Please wait before trying again.',
          canRetry: true
        };
      
      default:
        return {
          status: 'error',
          message: result.error || 'Validation failed. Please try again.',
          canRetry: true
        };
    }
  }

  // Generate secure token (for client-side reference)
  static generateSecureToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Check if token format is valid (basic client-side check)
  static isValidTokenFormat(token: string): boolean {
    // Check if token is 64 characters hex string
    return /^[a-f0-9]{64}$/i.test(token);
  }

  // Extract token from URL
  static extractTokenFromURL(url: string, paramName: string = 'token'): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get(paramName);
    } catch {
      return null;
    }
  }

  // Build validation URL
  static buildValidationURL(
    baseURL: string,
    token: string,
    tokenType: string,
    additionalParams?: Record<string, string>
  ): string {
    const url = new URL(baseURL);
    url.searchParams.set('token', token);
    url.searchParams.set('type', tokenType);
    
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    return url.toString();
  }
}

// React hook for URL validation
export const useURLValidation = (
  token: string | null,
  tokenType: 'submission' | 'invitation' | 'reset' | 'verification',
  options: ValidationOptions = {}
) => {
  const [result, setResult] = React.useState<URLValidationResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<{
    status: 'valid' | 'invalid' | 'expired' | 'error';
    message: string;
    canRetry: boolean;
  } | null>(null);

  const validate = React.useCallback(async () => {
    if (!token) {
      setResult({ valid: false, error: 'No token provided', code: 'NO_TOKEN' });
      return;
    }

    if (!URLValidationService.isValidTokenFormat(token)) {
      setResult({ valid: false, error: 'Invalid token format', code: 'INVALID_FORMAT' });
      return;
    }

    setLoading(true);
    try {
      let validationResult: URLValidationResult;
      
      switch (tokenType) {
        case 'submission':
          validationResult = await URLValidationService.validateSubmissionToken(token, options);
          break;
        case 'invitation':
          validationResult = await URLValidationService.validateInvitationToken(token, options);
          break;
        case 'reset':
          validationResult = await URLValidationService.validateResetToken(token, options);
          break;
        case 'verification':
          validationResult = await URLValidationService.validateVerificationToken(token, options);
          break;
        default:
          throw new Error('Invalid token type');
      }
      
      setResult(validationResult);
      setStatus(URLValidationService.getValidationStatus(validationResult));
    } catch (error: any) {
      const errorResult: URLValidationResult = {
        valid: false,
        error: error.message || 'Validation failed',
        code: 'VALIDATION_ERROR'
      };
      setResult(errorResult);
      setStatus(URLValidationService.getValidationStatus(errorResult));
    } finally {
      setLoading(false);
    }
  }, [token, tokenType, options]);

  React.useEffect(() => {
    validate();
  }, [validate]);

  return {
    result,
    loading,
    status,
    validate,
    isValid: result?.valid || false
  };
};
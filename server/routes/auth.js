import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import { authenticateToken, validateRefreshToken, rateLimiter } from '../middleware/auth.js';

const router = express.Router();

// Helper function to get client info
const getClientInfo = (req) => ({
  ip: req.ip || req.connection.remoteAddress,
  userAgent: req.get('User-Agent') || 'Unknown'
});

// Register new user
router.post('/register', rateLimiter(3, 15 * 60 * 1000), async (req, res) => {
  try {
    const { fullName, email, password, role, phone } = req.body;
    const clientInfo = getClientInfo(req);

    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Create new user
    const user = new User({
      fullName,
      email,
      password,
      role: role || 'teacher',
      phone
    });

    await user.save();

    // Log security event
    await user.addSecurityEvent('ACCOUNT_CREATED', clientInfo.ip, clientInfo.userAgent);

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Save refresh token
    await user.addRefreshToken(refreshToken, clientInfo);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// Login user
router.post('/login', rateLimiter(5, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const clientInfo = getClientInfo(req);

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      await user.addSecurityEvent('LOGIN_ATTEMPT_LOCKED', clientInfo.ip, clientInfo.userAgent);
      return res.status(401).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed attempts'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      await user.addSecurityEvent('LOGIN_ATTEMPT_INACTIVE', clientInfo.ip, clientInfo.userAgent);
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      await user.addSecurityEvent('LOGIN_FAILED', clientInfo.ip, clientInfo.userAgent, {
        reason: 'Invalid password'
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Log successful login
    await user.addSecurityEvent('LOGIN_SUCCESS', clientInfo.ip, clientInfo.userAgent);

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Save refresh token
    await user.addRefreshToken(refreshToken, clientInfo);

    // Clean expired tokens
    await user.cleanExpiredTokens();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Refresh access token
router.post('/refresh', validateRefreshToken, async (req, res) => {
  try {
    const { user, refreshToken } = req;
    const clientInfo = getClientInfo(req);

    // Generate new access token
    const newAccessToken = user.generateAccessToken();

    // Log token refresh
    await user.addSecurityEvent('TOKEN_REFRESHED', clientInfo.ip, clientInfo.userAgent);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed'
    });
  }
});

// Logout user
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const clientInfo = getClientInfo(req);

    if (refreshToken) {
      await req.user.removeRefreshToken(refreshToken);
    }

    // Log logout
    await req.user.addSecurityEvent('LOGOUT', clientInfo.ip, clientInfo.userAgent);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, phone } = req.body;
    const clientInfo = getClientInfo(req);

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    // Log profile update
    await user.addSecurityEvent('PROFILE_UPDATED', clientInfo.ip, clientInfo.userAgent, updateData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const clientInfo = getClientInfo(req);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      await user.addSecurityEvent('PASSWORD_CHANGE_FAILED', clientInfo.ip, clientInfo.userAgent, {
        reason: 'Invalid current password'
      });
      
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Remove all refresh tokens (force re-login on all devices)
    user.refreshTokens = [];
    await user.save();

    // Log password change
    await user.addSecurityEvent('PASSWORD_CHANGED', clientInfo.ip, clientInfo.userAgent);

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// Get user security events
router.get('/security-events', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('securityEvents');
    
    res.json({
      success: true,
      data: {
        events: user.securityEvents.slice(-20).reverse() // Last 20 events, newest first
      }
    });
  } catch (error) {
    console.error('Get security events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get security events'
    });
  }
});

export default router;
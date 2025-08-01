import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { 
  Lock, 
  Mail, 
  BookOpen, 
  Eye, 
  EyeOff, 
  Shield, 
  ArrowLeft,
  Zap,
  AlertCircle,
  Loader,
  CheckCircle,
  Activity,
  Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface SignInForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

const SignIn = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [performanceInfo, setPerformanceInfo] = useState<string>('');
  const [authMetrics, setAuthMetrics] = useState<Record<string, any>>({});
  const { signIn, getPerformanceMetrics } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, watch } = useForm<SignInForm>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  });

  const email = watch('email');

  const onSubmit = async (data: SignInForm) => {
    setLoading(true);
    const startTime = Date.now();
    
    try {
      console.log('🔐 Starting enhanced authentication for:', data.email);
      
      await signIn({ 
        email: data.email, 
        password: data.password,
        rememberMe: data.rememberMe
      });
      
      const duration = Date.now() - startTime;
      console.log('✅ Authentication completed in', duration, 'ms');
      setPerformanceInfo(`Signed in successfully in ${duration}ms`);
      
      // Get performance metrics
      const metrics = getPerformanceMetrics();
      setAuthMetrics(metrics);
      
      // Navigate to dashboard after successful login
      navigate('/dashboard');
    } catch (error: any) {
      console.error('❌ Authentication failed:', error);
      const duration = Date.now() - startTime;
      setPerformanceInfo(`Authentication failed after ${duration}ms`);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string, role: string) => {
    setLoading(true);
    const startTime = Date.now();
    
    try {
      await signIn({ email: demoEmail, password: demoPassword });
      const duration = Date.now() - startTime;
      setPerformanceInfo(`${role} login completed in ${duration}ms`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Demo login failed:', error);
      const duration = Date.now() - startTime;
      setPerformanceInfo(`Demo login failed after ${duration}ms`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link
            to="/"
            className="flex items-center text-white/80 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to home
          </Link>
          
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-white">
            Enhanced Authentication
          </h2>
          <p className="mt-2 text-center text-sm text-white/70">
            Sign in to access your secure dashboard
          </p>
        </motion.div>

        {/* Performance Info */}
        {performanceInfo && (
          <motion.div
            className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-blue-400 text-sm flex items-center justify-center">
              <Zap className="h-4 w-4 mr-2" />
              {performanceInfo}
            </p>
            {Object.keys(authMetrics).length > 0 && (
              <div className="mt-2 text-xs text-blue-300">
                <div className="flex items-center justify-center space-x-4">
                  <span className="flex items-center">
                    <Activity className="h-3 w-3 mr-1" />
                    Avg: {authMetrics.signIn?.average || 0}ms
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    Cache: {authMetrics.getProfileFast?.average || 0}ms
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Security Badge */}
        <motion.div
          className="flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex items-center space-x-2 bg-green-500/20 backdrop-blur-md rounded-full px-4 py-2 border border-green-500/30">
            <Shield className="h-4 w-4 text-green-400" />
            <span className="text-green-400 text-xs font-medium">Enterprise Security</span>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div
          className="bg-white/10 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl border border-white/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-white/50" />
                </div>
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  type="email"
                  className="pl-10 block w-full bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-white placeholder-white/50 py-3"
                  placeholder="Enter your email"
                />
                {errors.email && (
                  <p className="mt-2 text-sm text-red-400">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-white/50" />
                </div>
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  className="pl-10 pr-10 block w-full bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-white placeholder-white/50 py-3"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-white/50 hover:text-white/70" />
                  ) : (
                    <Eye className="h-5 w-5 text-white/50 hover:text-white/70" />
                  )}
                </button>
                {errors.password && (
                  <p className="mt-2 text-sm text-red-400">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  {...register('rememberMe')}
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-white/20 rounded bg-white/10"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-white/70">
                  Remember me for 30 days
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to="/auth/forgot-password"
                  className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader className="animate-spin h-5 w-5" />
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5" />
                    <span>Sign in to Dashboard</span>
                  </div>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-white/70">
              Don't have an account?{' '}
              <Link
                to="/auth/signup"
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Create account
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Demo Credentials */}
        <motion.div
          className="text-center bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="flex items-center justify-center mb-3">
            <AlertCircle className="h-4 w-4 text-yellow-400 mr-2" />
            <p className="text-xs text-yellow-400 font-medium">Demo Credentials - Lightning Fast Access</p>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={() => handleDemoLogin('admin@example.com', 'admin123', 'Admin')}
              disabled={loading}
              className="w-full text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-colors border border-white/10 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <Loader className="animate-spin h-3 w-3" />
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 text-green-400" />
                  <span>Admin: admin@example.com / admin123</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleDemoLogin('teacher@example.com', 'teacher123', 'Teacher')}
              disabled={loading}
              className="w-full text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-colors border border-white/10 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <Loader className="animate-spin h-3 w-3" />
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 text-blue-400" />
                  <span>Teacher: teacher@example.com / teacher123</span>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Performance Notice */}
        <motion.div
          className="text-center bg-green-500/10 backdrop-blur-md rounded-xl p-4 border border-green-500/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <div className="flex items-center justify-center mb-2">
            <Zap className="h-4 w-4 text-green-400 mr-2" />
            <p className="text-xs text-green-400 font-medium">Enterprise Performance</p>
          </div>
          <p className="text-xs text-white/60">
            ⚡ Sub-200ms authentication • 🔒 Military-grade security • 📊 Real-time monitoring
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default SignIn;
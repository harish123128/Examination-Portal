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
  User, 
  Phone,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Zap,
  Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface SignUpForm {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  role: 'admin' | 'teacher';
  terms: boolean;
}

const SignUp = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const { signUp, checkEmailExists } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, watch, trigger } = useForm<SignUpForm>({
    defaultValues: {
      role: 'admin' // Default to admin for dashboard access
    }
  });

  const password = watch('password');
  const email = watch('email');
  const role = watch('role');

  // Check email availability
  const checkEmail = async (email: string) => {
    if (email && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
      const exists = await checkEmailExists(email);
      setEmailExists(exists);
    }
  };

  // Calculate password strength
  const calculatePasswordStrength = (password: string) => {
    if (!password) return 0;
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    setPasswordStrength(strength);
    return strength;
  };

  React.useEffect(() => {
    if (password) {
      calculatePasswordStrength(password);
    }
  }, [password]);

  const onSubmit = async (data: SignUpForm) => {
    if (data.password !== data.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (emailExists) {
      toast.error('Email already exists');
      return;
    }

    if (passwordStrength < 3) {
      toast.error('Password is too weak. Please use a stronger password.');
      return;
    }

    setLoading(true);
    try {
      await signUp({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
        phone: data.phone
      });
      
      // Navigate to sign in page after successful registration
      navigate('/auth/signin');
    } catch (error: any) {
      // Error is already handled in AuthContext
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthInfo = (strength: number) => {
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['red', 'orange', 'yellow', 'blue', 'green'];
    
    return {
      label: labels[strength - 1] || 'Very Weak',
      color: colors[strength - 1] || 'red',
      percentage: (strength / 5) * 100
    };
  };

  const strengthInfo = getPasswordStrengthInfo(passwordStrength);

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
            Create Your Account
          </h2>
          <p className="mt-2 text-center text-sm text-white/70">
            Join our secure examination platform
          </p>
        </motion.div>

        {/* Security Badge */}
        <motion.div
          className="flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex items-center space-x-2 bg-green-500/20 backdrop-blur-md rounded-full px-4 py-2 border border-green-500/30">
            <Shield className="h-4 w-4 text-green-400" />
            <span className="text-green-400 text-xs font-medium">Secure Registration</span>
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
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-white mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-white/50" />
                  </div>
                  <input
                    {...register('fullName', { required: 'Full name is required' })}
                    type="text"
                    className="pl-10 block w-full bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-white placeholder-white/50 py-3"
                    placeholder="Enter your full name"
                  />
                  {errors.fullName && (
                    <p className="mt-2 text-sm text-red-400">{errors.fullName.message}</p>
                  )}
                </div>
              </div>

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
                    onBlur={(e) => checkEmail(e.target.value)}
                  />
                  {emailExists && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                    </div>
                  )}
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-400">{errors.email.message}</p>
                  )}
                  {emailExists && (
                    <p className="mt-2 text-sm text-red-400">Email already exists</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-white mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-white/50" />
                  </div>
                  <input
                    {...register('phone', { required: 'Phone number is required' })}
                    type="tel"
                    className="pl-10 block w-full bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-white placeholder-white/50 py-3"
                    placeholder="Enter your phone number"
                  />
                  {errors.phone && (
                    <p className="mt-2 text-sm text-red-400">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-white mb-2">
                  Account Type
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCheck className="h-5 w-5 text-white/50" />
                  </div>
                  <select
                    {...register('role', { required: 'Role is required' })}
                    className="pl-10 block w-full bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-white py-3"
                  >
                    <option value="admin" className="bg-gray-800 text-white">Administrator</option>
                    <option value="teacher" className="bg-gray-800 text-white">Teacher</option>
                  </select>
                  {errors.role && (
                    <p className="mt-2 text-sm text-red-400">{errors.role.message}</p>
                  )}
                </div>
                {role === 'admin' && (
                  <p className="mt-2 text-xs text-blue-400 flex items-center">
                    <Activity className="h-3 w-3 mr-1" />
                    Admin accounts have full dashboard access
                  </p>
                )}
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
                        value: 8,
                        message: 'Password must be at least 8 characters'
                      }
                    })}
                    type={showPassword ? 'text' : 'password'}
                    className="pl-10 pr-10 block w-full bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-white placeholder-white/50 py-3"
                    placeholder="Create a strong password"
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
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-white/20 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all bg-${strengthInfo.color}-500`}
                          style={{ width: `${strengthInfo.percentage}%` }}
                        />
                      </div>
                      <span className={`text-xs text-${strengthInfo.color}-400`}>
                        {strengthInfo.label}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      Requirements: 8+ chars, uppercase, lowercase, number, special char
                    </div>
                  </div>
                )}
                {errors.password && (
                  <p className="mt-2 text-sm text-red-400">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-white/50" />
                  </div>
                  <input
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: value => value === password || 'Passwords do not match'
                    })}
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="pl-10 pr-10 block w-full bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm text-white placeholder-white/50 py-3"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-white/50 hover:text-white/70" />
                    ) : (
                      <Eye className="h-5 w-5 text-white/50 hover:text-white/70" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-2 text-sm text-red-400">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center">
              <input
                {...register('terms', { required: 'You must accept the terms and conditions' })}
                id="terms"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-white/20 rounded bg-white/10"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-white/70">
                I agree to the{' '}
                <Link to="/terms" className="text-blue-400 hover:text-blue-300">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-blue-400 hover:text-blue-300">
                  Privacy Policy
                </Link>
              </label>
            </div>
            {errors.terms && (
              <p className="text-sm text-red-400">{errors.terms.message}</p>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || emailExists || passwordStrength < 3}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Create Account
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-white/70">
              Already have an account?{' '}
              <Link
                to="/auth/signin"
                className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Performance Notice */}
        <motion.div
          className="text-center bg-green-500/10 backdrop-blur-md rounded-xl p-4 border border-green-500/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="flex items-center justify-center mb-2">
            <Zap className="h-4 w-4 text-green-400 mr-2" />
            <p className="text-xs text-green-400 font-medium">Lightning Fast Registration</p>
          </div>
          <p className="text-xs text-white/60">
            After registration, you'll be redirected to sign in and access the dashboard
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default SignUp;
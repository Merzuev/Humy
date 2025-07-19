import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Sparkles, Phone } from 'lucide-react';
import apiClient from '../../api/instance';
import { Button, Input, Select } from '../ui';
import { useUser } from '../../contexts/UserContext';

// Validation schema
const createSchema = (inputType: 'email' | 'phone') => yup.object({
  identifier: inputType === 'email' 
    ? yup.string().email('Please enter a valid email').required('Please enter email')
    : yup.string().matches(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number').required('Please enter phone number'),
  password: yup.string().min(8, 'Minimum 8 characters').required('Please enter password'),
}).required();

type FormData = {
  identifier: string;
  password: string;
};

const LANGUAGE_OPTIONS = [
  { value: 'en', label: '🇺🇸 EN' },
  { value: 'ru', label: '🇷🇺 RU' },
  { value: 'es', label: '🇪🇸 ES' },
  { value: 'fr', label: '🇫🇷 FR' },
  { value: 'de', label: '🇩🇪 DE' },
  { value: 'it', label: '🇮🇹 IT' },
  { value: 'pt', label: '🇵🇹 PT' },
  { value: 'ja', label: '🇯🇵 JA' },
  { value: 'ko', label: '🇰🇷 KO' },
  { value: 'zh', label: '🇨🇳 ZH' },
  { value: 'ar', label: '🇸🇦 AR' },
  { value: 'hi', label: '🇮🇳 HI' },
  { value: 'id', label: '🇮🇩 ID' },
  { value: 'tr', label: '🇹🇷 TR' },
  { value: 'vi', label: '🇻🇳 VI' },
];

export function LoginForm() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setToken } = useUser();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputType, setInputType] = useState<'email' | 'phone'>('email');
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: yupResolver(createSchema(inputType)),
  });

  const handleInputTypeChange = (type: 'email' | 'phone') => {
    setInputType(type);
    reset();
  };

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      setIsLoading(true);
      
      const response = await apiClient.post('/auth/login/', {
        [inputType]: data.identifier,
        password: data.password,
      });
      
      const { access_token } = response.data;
      setToken(access_token);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError(t('auth.invalidCredentials'));
      } else {
        setError(t('auth.loginFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-2 sm:p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
      <div className="max-w-md w-full relative">
        {/* Language selector */}
        <div className="absolute -top-12 sm:-top-16 right-0 z-10">
          <Select
            value={i18n.language}
            onChange={(lng) => i18n.changeLanguage(lng)}
            options={LANGUAGE_OPTIONS}
            className="text-xs"
          />
        </div>

        {/* Main form container */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-8 relative">
          {/* Decorative elements */}
          <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-xl opacity-60"></div>
          <div className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-full blur-xl opacity-40"></div>
          
          {/* Logo/Icon */}
          <div className="flex justify-center mb-4 sm:mb-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              {t('auth.welcome')}
            </h1>
            <p className="text-gray-300 text-sm">
              {t('auth.subtitle')}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            {/* Input Type Toggle */}
            <div className="space-y-3">
              <div className="flex bg-gray-800/50 rounded-lg p-1 border border-gray-600">
                <button
                  type="button"
                  onClick={() => handleInputTypeChange('email')}
                  className={`flex-1 flex items-center justify-center py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 ${
                    inputType === 'email'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  {t('auth.email')}
                </button>
                <button
                  type="button"
                  onClick={() => handleInputTypeChange('phone')}
                  className={`flex-1 flex items-center justify-center py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 ${
                    inputType === 'phone'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  {t('auth.phone')}
                </button>
              </div>
              
              <Input
                {...register('identifier')}
                type={inputType === 'email' ? 'email' : 'tel'}
                placeholder={inputType === 'email' ? t('auth.emailPlaceholder') : t('auth.phonePlaceholder')}
                leftIcon={inputType === 'email' ? <Mail className="w-4 h-4 sm:w-5 sm:h-5" /> : <Phone className="w-4 h-4 sm:w-5 sm:h-5" />}
                error={errors.identifier?.message}
              />
            </div>
            
            <Input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder={t('auth.password')}
              leftIcon={<Lock className="w-4 h-4 sm:w-5 sm:h-5" />}
              rightIcon={
                <button 
                  onClick={() => setShowPassword(!showPassword)} 
                  type="button"
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  {showPassword ? 
                    <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" /> : 
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                  }
                </button>
              }
            />
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}
            label={t('auth.password')}

            <Button 
              type="submit" 
              className="w-full text-sm sm:text-base py-2.5 sm:py-3"
              loading={isLoading}
            >
              {t('auth.login')}
            </Button>
          </form>

          {/* Forgot password */}
          <div className="text-center mt-3 sm:mt-4">
            <a 
              href="/forgot-password" 
              className="text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
            >
              {t('auth.forgotPassword')}
            </a>
          </div>

          {/* Social login */}
          <div className="mt-6 sm:mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white/10 backdrop-blur-sm px-3 sm:px-4 py-1 rounded-full text-gray-300 text-xs sm:text-sm">
                  {t('auth.orContinue')}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-4 sm:mt-6">
              <Button variant="outline" className="bg-white/5 border-white/20 hover:bg-white/10 text-xs sm:text-sm py-2 sm:py-2.5">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t('common.google')}
              </Button>
              
              <Button variant="outline" className="bg-white/5 border-white/20 hover:bg-white/10 text-xs sm:text-sm py-2 sm:py-2.5">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                {t('common.apple')}
              </Button>
            </div>
          </div>

          {/* Sign up link */}
          <p className="mt-6 sm:mt-8 text-center text-gray-300 text-sm">
            {t('auth.noAccount')}{' '}
            <button 
              onClick={() => navigate('/register')}
              className="text-indigo-300 hover:text-indigo-200 font-medium transition-colors"
            >
              {t('auth.signUp')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Sparkles, Check, Phone } from 'lucide-react';
import apiClient from '../../api/instance';
import { Button, Input, Select } from '../ui';
import { useUser } from '../../contexts/UserContext';

// Validation schema
const createSchema = (inputType: 'email' | 'phone') => yup.object({
  identifier: inputType === 'email' 
    ? yup.string().email('Please enter a valid email').required('Please enter email')
    : yup.string().matches(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number').required('Please enter phone number'),
  password: yup.string().min(8, 'Minimum 8 characters').required('Please enter password'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm password'),
  interface_language: yup.string().required('Please select language'),

  agreeToTerms: yup.boolean().oneOf([true], 'You must agree to the terms'),
}).required();

type FormData = {
  identifier: string;
  password: string;
  password2: string; // ✅ Добавляем
  confirmPassword: string;
  interface_language: string;
  agreeToTerms: boolean;
};



const LANGUAGE_OPTIONS = [
  { value: 'en', label: '🇺🇸 English' },
  { value: 'ru', label: '🇷🇺 Русский' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'pt', label: '🇵🇹 Português' },
  { value: 'ja', label: '🇯🇵 日本語' },
  { value: 'ko', label: '🇰🇷 한국어' },
  { value: 'zh', label: '🇨🇳 中文' },
  { value: 'ar', label: '🇸🇦 العربية' },
  { value: 'hi', label: '🇮🇳 हिन्दी' },
  { value: 'id', label: '🇮🇩 Bahasa Indonesia' },
  { value: 'tr', label: '🇹🇷 Türkçe' },
  { value: 'vi', label: '🇻🇳 Tiếng Việt' },
];

export function RegisterForm() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setToken, setUser } = useUser();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputType, setInputType] = useState<'email' | 'phone'>('email');
  const [selectedLanguageOption, setSelectedLanguageOption] = useState(
  LANGUAGE_OPTIONS.find(opt => opt.value === i18n.language) || LANGUAGE_OPTIONS[0]
);
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormData>({
    resolver: yupResolver(createSchema(inputType)),
    defaultValues: {
      interface_language: i18n.language,
      agreeToTerms: false,
    }
  });

  const watchedLanguage = watch('interface_language');
  const watchedAgreeToTerms = watch('agreeToTerms');

  useEffect(() => {
    if (watchedLanguage && i18n.language !== watchedLanguage) {
      i18n.changeLanguage(watchedLanguage);
      localStorage.setItem('i18nextLng', watchedLanguage);
    }
  }, [watchedLanguage, i18n]);


  const handleInputTypeChange = (type: 'email' | 'phone') => {
    setInputType(type);
    setValue('identifier', '');
  };

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      setIsLoading(true);
      data.password2 = data.confirmPassword;

      try {
        const response = await apiClient.post('/register/', {
          [inputType]: data.identifier,
          password: data.password,
          password2: data.password2,
          interface_language: data.interface_language
        });

        const { access_token, refresh_token } = response.data;

        setToken(access_token);
        localStorage.setItem('refresh', refresh_token);

        const profileRes = await apiClient.get('/profile/', {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        });

        setUser(profileRes.data);

        navigate('/setup-profile');
      } catch (error: any) {
        console.error('API POST /register/', error.response?.data || error.message);

        if (error.response?.status === 400) {
          const data = error.response.data;
          if (data.email?.[0] === 'user with this email already exists.') {
            setError(t('auth.userAlreadyExists'));
          } else if (data.password2) {
            setError(t('auth.passwordMismatch'));
          } else {
            setError(t('auth.registrationFailed'));
          }
        } else {
          setError(t('auth.registrationFailed'));
        }
      } finally {
        setIsLoading(false);
      }

    } catch (err: any) {
      setError(t('auth.registrationFailed'));
      setIsLoading(false);
    }
  };

  const handleLanguageChange = (selectedOption: { value: string; label: string }) => {
    setSelectedLanguageOption(selectedOption); // обновляем выбранный язык
    setValue('interface_language', selectedOption.value); // обновляем поле формы
    i18n.changeLanguage(selectedOption.value); // переключаем язык в i18n
    localStorage.setItem('i18nextLng', selectedOption.value); // сохраняем в браузер
};


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-2 sm:p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
      
      <div className="max-w-md w-full relative">
        {/* Language selector */}
        <div className="absolute -top-12 sm:-top-16 right-0 z-10">
          <Select
            value={watchedLanguage}
            onChange={handleLanguageChange}
            options={LANGUAGE_OPTIONS.map(lang => ({ value: lang.value, label: lang.value.toUpperCase() }))}
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
              {t('auth.createAccount')}
            </h1>
            <p className="text-gray-300 text-sm">
              {t('auth.registerSubtitle')}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
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
              error={errors.password?.message}
            />

            <Input
              {...register('confirmPassword')}
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder={t('auth.confirmPassword')}
              leftIcon={<Lock className="w-4 h-4 sm:w-5 sm:h-5" />}
              rightIcon={
                <button 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                  type="button"
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  {showConfirmPassword ? 
                    <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" /> : 
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                  }
                </button>
              }
              error={errors.confirmPassword?.message}
            />
            {/* Language Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                {t('auth.interfaceLanguage')}
              </label>
             <Select
                {...register('interface_language')}
                value={LANGUAGE_OPTIONS.find(opt => opt.value === watchedLanguage)}
                onChange={(selectedOption: any) => {
                  const selectedLang = selectedOption.value;
                  setValue('interface_language', selectedLang); // обновляем форму
                  i18n.changeLanguage(selectedLang); // меняем язык
                  localStorage.setItem('i18nextLng', selectedLang); // сохраняем
                }}
                options={LANGUAGE_OPTIONS}
                className="w-full"
/>
              {errors.language && (
                <p className="text-sm text-red-400">{errors.language.message}</p>
              )}
            </div>

            {/* Terms Agreement */}
            <div className="space-y-3">
              <label className="flex items-start space-x-3 cursor-pointer group">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    {...register('agreeToTerms')}
                    type="checkbox"
                    className="sr-only"
                  />
                  <div className={`
                    w-4 h-4 sm:w-5 sm:h-5 rounded border-2 transition-all duration-200 flex items-center justify-center
                    ${watchedAgreeToTerms 
                      ? 'bg-indigo-500 border-indigo-500' 
                      : 'border-gray-400 group-hover:border-indigo-400'
                    }
                  `}>
                    {watchedAgreeToTerms && (
                      <Check className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
                    )}
                  </div>
                </div>
                <span className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                  {t('auth.agreeToTerms')}{' '}
                  <a 
                    href="/terms" 
                    className="text-indigo-300 hover:text-indigo-200 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('auth.termsOfService')}
                  </a>
                  {' '}{t('auth.and')}{' '}
                  <a 
                    href="/privacy" 
                    className="text-indigo-300 hover:text-indigo-200 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('auth.privacyPolicy')}
                  </a>
                </span>
              </label>
              {errors.agreeToTerms && (
                <p className="text-sm text-red-400 ml-6 sm:ml-8">{errors.agreeToTerms.message}</p>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full text-sm sm:text-base py-2.5 sm:py-3"
              loading={isLoading}
            >
              {t('auth.createAccount')}
            </Button>
          </form>

          {/* Social registration */}
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

          {/* Sign in link */}
          <p className="mt-6 sm:mt-8 text-center text-gray-300 text-sm">
            {t('auth.haveAccount')}{' '}
            <button 
              onClick={() => navigate('/login')}
              className="text-indigo-300 hover:text-indigo-200 font-medium transition-colors"
            >
              {t('auth.signIn')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
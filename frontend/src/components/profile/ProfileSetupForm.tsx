import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useContext, useEffect } from 'react';
import { UserContext, } from '../../context/UserContext';
import { 
  User, 
  Calendar, 
  MapPin, 
  Globe, 
  Heart, 
  Camera, 
  Plus,
  X,
  Sparkles 
} from 'lucide-react';
import { Button, Input, Select, SearchableSelect } from '../ui';
import { 
  getCountryOptions, 
  getCitiesForCountry, 
  searchCountries, 
  searchCities,
  getTranslatedInterests,
  getTranslatedInterest
} from '../../data/locations';
import apiClient from '../../api/instance';
import { useUser } from '../../contexts/UserContext';

const schema = yup.object({
  nickname: yup.string().min(2).max(20).required(),
  birthDate: yup.string().matches(/^\d{2}\.\d{2}\.\d{4}$/).required(),
  country: yup.string().required(),
  city: yup.string().required(),
  languages: yup.array().of(yup.string()).min(1).required(),
  interests: yup.array().of(yup.string()).min(1).required(),
}).required();

type FormData = {
  nickname: string;
  birthDate: string;
  country: string;
  city: string;
  languages: string[];
  interests: string[];
};

const LANGUAGES = [...new Set([
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '中文' },
  { value: 'ar', label: 'العربية' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'vi', label: 'Tiếng Việt' },
])];

const LANGUAGE_OPTIONS = [...LANGUAGES.map(l => ({ value: l.value, label: l.label }))];

export function ProfileSetupForm() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const registrationData = location.state || {};
  const { setUser, setToken } = useUser();
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      languages: [],
      interests: [],
      country: '',
      city: '',
    }
  });

  const translatedInterests = getTranslatedInterests(i18n.language);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const formatBirthDate = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
  };

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = formatBirthDate(e.target.value);
  };

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    setSelectedCity('');
    setValue('country', country);
    setValue('city', '');
  };

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    setValue('city', city);
  };

  const toggleLanguage = (language: string) => {
    const newLanguages = selectedLanguages.includes(language)
      ? selectedLanguages.filter(l => l !== language)
      : [...selectedLanguages, language];
    setSelectedLanguages(newLanguages);
    setValue('languages', newLanguages);
  };

  const toggleInterest = (interestKey: string) => {
    const newInterests = selectedInterests.includes(interestKey)
      ? selectedInterests.filter(i => i !== interestKey)
      : [...selectedInterests, interestKey];
    setSelectedInterests(newInterests);
    setValue('interests', newInterests);
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !selectedInterests.includes(customInterest.trim())) {
      const newInterests = [...selectedInterests, customInterest.trim()];
      setSelectedInterests(newInterests);
      setValue('interests', newInterests);
      setCustomInterest('');
    }
  };

  const removeInterest = (interestKey: string) => {
    const newInterests = selectedInterests.filter(i => i !== interestKey);
    setSelectedInterests(newInterests);
    setValue('interests', newInterests);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      setIsLoading(true);

      const [day, month, year] = data.birthDate.split('.');
      const birthDateISO = `${year}-${month}-${day}`;

      const formData = new FormData();
      formData.append('birth_date', birthDateISO);
      formData.append('nickname', data.nickname);
      formData.append('country', data.country);
      formData.append('city', data.city);
      formData.set('languages', JSON.stringify(data.languages));
      formData.set('interests', JSON.stringify(data.interests));
      formData.append('interface_language', registrationData.interface_language || i18n.language);
      formData.append('theme', 'Светлая');

      if (data.avatar && data.avatar[0]) {
        formData.append('avatar', data.avatar[0]);
      }

      const identifierField = registrationData.inputType === 'phone' ? 'phone' : 'email';
      formData.append(identifierField, registrationData.identifier);
      formData.append('password', registrationData.password);
      formData.append('password2', registrationData.password);

      // 1. Регистрируем пользователя
      await apiClient.post('/api/register/', formData);

      // 2. Получаем токены через /auth/jwt/create/
      const loginResponse = await apiClient.post('/auth/jwt/create/', {
        [identifierField]: registrationData.identifier,
        password: registrationData.password,
      });

      const { access, refresh } = loginResponse.data;
      localStorage.setItem('access', access);
      localStorage.setItem('refresh_token', refresh);
      setToken(access);

      // 3. Получаем профиль
      const profileRes = await apiClient.get('/api/profile/', {
        headers: { Authorization: `Bearer ${access}` }
      });

      setUser(profileRes.data);

      // 4. Переход на дашборд
      navigate('/dashboard');
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      setError('Произошла ошибка. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-2 sm:p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
      
      <div className="max-w-2xl w-full relative">
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
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-8 relative max-h-[90vh] overflow-y-auto">
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
              {t('profile.setupProfile', 'Set up your profile')}
            </h1>
            <p className="text-gray-300 text-sm">
              {t('profile.setupSubtitle', 'Tell us about yourself to get started')}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            {/* Profile Image */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center overflow-hidden">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 bg-indigo-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition-colors">
                  <Camera className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs sm:text-sm text-gray-400">{t('profile.uploadPhoto', 'Upload photo')}</p>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <Input
                {...register('nickname')}
                placeholder={t('profile.nickname', 'Nickname')}
                leftIcon={<User className="w-4 h-4 sm:w-5 sm:h-5" />}
                error={errors.nickname?.message}
              />
              
              <Input
                {...register('birthDate')}
                placeholder={t('profile.birthDate', 'Birth date')}
                leftIcon={<Calendar className="w-4 h-4 sm:w-5 sm:h-5" />}
                error={errors.birthDate?.message}
                onChange={handleBirthDateChange}
                maxLength={10}
              />
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  {t('profile.country', 'Country')}
                </label>
                <SearchableSelect
                  value={selectedCountry}
                  onChange={handleCountryChange}
                  options={getCountryOptions(i18n.language)}
                  placeholder={t('profile.country', 'Country')}
                  leftIcon={<Globe className="w-4 h-4 sm:w-5 sm:h-5" />}
                  error={errors.country?.message}
                  onSearch={(query) => searchCountries(query, i18n.language)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  {t('profile.city', 'City')}
                </label>
                <SearchableSelect
                  value={selectedCity}
                  onChange={handleCityChange}
                  options={getCitiesForCountry(selectedCountry, i18n.language)}
                  placeholder={t('profile.city', 'City')}
                  leftIcon={<MapPin className="w-4 h-4 sm:w-5 sm:h-5" />}
                  error={errors.city?.message}
                  onSearch={(query) => searchCities(selectedCountry, query, i18n.language)}
                  disabled={!selectedCountry}
                />
              </div>
            </div>

            {/* Languages */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">
                {t('profile.languages', 'Languages')} ({selectedLanguages.length} {t('profile.selected', 'selected')})
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {LANGUAGES.map((language) => (
                  <button
                    key={language.value}
                    type="button"
                    onClick={() => toggleLanguage(language.value)}
                    className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                      selectedLanguages.includes(language.value)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-600'
                    }`}
                  >
                    {language.label}
                  </button>
                ))}
              </div>
              {errors.languages && (
                <p className="text-sm text-red-400">{errors.languages.message}</p>
              )}
            </div>

            {/* Interests */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">
                {t('profile.interests', 'Interests')} ({selectedInterests.length} {t('profile.selected', 'selected')})
              </label>
              
              {/* Selected interests */}
              {selectedInterests.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedInterests.map((interestKey) => (
                    <span
                      key={interestKey}
                      className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm bg-indigo-600 text-white"
                    >
                      {getTranslatedInterest(interestKey, i18n.language)}
                      <button
                        type="button"
                        onClick={() => removeInterest(interestKey)}
                        className="ml-1 sm:ml-2 hover:bg-indigo-700 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add custom interest */}
              <div className="flex gap-2">
                <Input
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  placeholder={t('profile.addInterest', 'Add interest')}
                  leftIcon={<Heart className="w-4 h-4 sm:w-5 sm:h-5" />}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomInterest())}
                />
                <Button
                  type="button"
                  onClick={addCustomInterest}
                  variant="outline"
                  className="px-2 sm:px-3 flex-shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Suggested interests */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {translatedInterests.filter(interest => !selectedInterests.includes(interest.value)).slice(0, 12).map((interest) => (
                  <button
                    key={interest.value}
                    type="button"
                    onClick={() => toggleInterest(interest.value)}
                    className="p-2 rounded-lg text-xs sm:text-sm font-medium bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-600 transition-all duration-200"
                  >
                    {interest.label}
                  </button>
                ))}
              </div>
              
              {errors.interests && (
                <p className="text-sm text-red-400">{errors.interests.message}</p>
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
              {t('profile.completeSetup', 'Complete setup')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
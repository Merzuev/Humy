import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  User, 
  Calendar, 
  MapPin, 
  Globe, 
  Heart, 
  Camera, 
  Edit3,
  Save,
  X,
  Languages,
  Mail,
  Phone,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { Button, Input, Select, SearchableSelect } from '../ui';
import { 
  getCountryOptions, 
  getCitiesForCountry, 
  getTranslatedInterests,
  getTranslatedInterest
} from '../../data/locations';
import apiClient from '../../api/instance';
import { useUser } from '../../contexts/UserContext';

interface UserProfileData {
  nickname: string;
  birthDate: string;
  country: string;
  city: string;
  languages: string[];
  interests: string[];
  profileImage?: string;
  email?: string;
  phone?: string;
}

interface UserProfileProps {
  onBack?: () => void;
}

const LANGUAGES = [
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
];

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

export function UserProfile({ onBack }: UserProfileProps) {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<UserProfileData>({
    nickname: '',
    birthDate: '',
    country: '',
    city: '',
    languages: [],
    interests: [],
    email: '',
    phone: ''
  });

  const [editData, setEditData] = useState<UserProfileData>(profileData);

  // Load user profile on component mount
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.get('/api/profile/');
      const userData = response.data;
      
      // Convert birth_date from YYYY-MM-DD to DD.MM.YYYY for display
      const birthDate = userData.birth_date 
        ? new Date(userData.birth_date).toLocaleDateString('en-GB')
        : '';
      
      const profileData: UserProfileData = {
        nickname: userData.nickname || '',
        birthDate,
        country: userData.country || '',
        city: userData.city || '',
        languages: userData.languages || [],
        interests: userData.interests || [],
        profileImage: userData.avatar,
        email: userData.email || '',
        phone: userData.phone || ''
      };
      
      setProfileData(profileData);
      setEditData(profileData);
      setProfileImage(userData.profile_image || null);
      
      // Update user context
      setUser(userData);
    } catch (err: any) {
      setError(t('profile.loadFailed', 'Failed to load profile'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setProfileImage(imageUrl);
        setEditData(prev => ({ ...prev, profileImage: imageUrl }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      // Convert birth date from DD.MM.YYYY to YYYY-MM-DD for API
      const [day, month, year] = editData.birthDate.split('.');
      const birthDateISO = `${year}-${month}-${day}`;
      
      const updateData = {
        nickname: editData.nickname,
        birth_date: birthDateISO,
        country: editData.country,
        city: editData.city,
        languages: editData.languages,
        interests: editData.interests,
        profile_image: profileImage,
      };
      
      const response = await apiClient.put('/profile/', updateData);
      
      setProfileData(editData);
      setIsEditing(false);
      
      // Update user context
      setUser(response.data);
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError(t('profile.saveFailed', 'Failed to save profile'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData(profileData);
    setProfileImage(profileData.profileImage || null);
    setIsEditing(false);
    setError(null);
  };

  const formatBirthDate = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) {
      return digits;
    } else if (digits.length <= 4) {
      return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    } else {
      return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
    }
  };

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatBirthDate(e.target.value);
    setEditData(prev => ({ ...prev, birthDate: formatted }));
  };

  const handleCountryChange = (country: string) => {
    setEditData(prev => ({ ...prev, country, city: '' }));
  };

  const handleCityChange = (city: string) => {
    setEditData(prev => ({ ...prev, city }));
  };

  const toggleLanguage = (language: string) => {
    const newLanguages = editData.languages.includes(language)
      ? editData.languages.filter(l => l !== language)
      : [...editData.languages, language];
    
    setEditData(prev => ({ ...prev, languages: newLanguages }));
  };

  const removeInterest = (interestKey: string) => {
    const newInterests = editData.interests.filter(i => i !== interestKey);
    setEditData(prev => ({ ...prev, interests: newInterests }));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getLanguageLabel = (langCode: string) => {
    return LANGUAGES.find(lang => lang.value === langCode)?.label || langCode;
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '';
    const [day, month, year] = birthDate.split('.').map(Number);
    const birth = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
      
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="flex items-center justify-between p-3 sm:p-6 bg-white/10 backdrop-blur-xl border-b border-white/20 flex-shrink-0">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
            )}
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
              {t('dashboard.profile', 'Profile')}
            </h1>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="bg-white/5 border-white/20 hover:bg-white/10 text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2"
              >
                <Edit3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{t('profile.edit', 'Edit')}</span>
              </Button>
            ) : (
              <div className="flex space-x-1 sm:space-x-2">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="bg-white/5 border-white/20 hover:bg-white/10 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">{t('profile.cancel', 'Cancel')}</span>
                </Button>
                <Button 
                  onClick={handleSave} 
                  className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
                  loading={isSaving}
                >
                  <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">{t('profile.save', 'Save')}</span>
                </Button>
              </div>
            )}
            <Select
              value={i18n.language}
              onChange={(lng) => i18n.changeLanguage(lng)}
              options={LANGUAGE_OPTIONS}
              className="text-xs"
            />
          </div>
        </header>

        {/* Profile Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            {/* Main Profile Container */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-8 relative">
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-xl opacity-60"></div>
              <div className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-full blur-xl opacity-40"></div>
              
              {/* Profile Image Section */}
              <div className="flex flex-col items-center space-y-4 sm:space-y-6 mb-6 sm:mb-8">
                <div className="relative">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden border-2 sm:border-4 border-white/30 shadow-2xl">
                    {profileImage || profileData.profileImage ? (
                      <img 
                        src={profileImage || profileData.profileImage} 
                        alt="Profile" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <span className="text-2xl sm:text-3xl font-bold text-white">
                        {getInitials(profileData.nickname || 'U')}
                      </span>
                    )}
                  </div>
                  {isEditing && (
                    <label className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 border-2 border-white/30 shadow-lg">
                      <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <div className="text-center">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                    {isEditing ? editData.nickname : profileData.nickname}
                  </h2>
                  {profileData.birthDate && (
                    <p className="text-gray-300 text-base sm:text-lg">
                      {calculateAge(profileData.birthDate)} {t('profile.yearsOld', 'years old')}
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              {/* Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                {/* Basic Information */}
                <div className="bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-4 sm:p-6 hover:bg-white/10 transition-all duration-300">
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                      <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    {t('profile.basicInfo', 'Basic Information')}
                  </h3>
                  
                  <div className="space-y-3 sm:space-y-4">
                    {/* Nickname */}
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                        {t('profile.nickname', 'Nickname')}
                      </label>
                      {isEditing ? (
                        <Input
                          value={editData.nickname}
                          onChange={(e) => setEditData(prev => ({ ...prev, nickname: e.target.value }))}
                          placeholder={t('profile.nickname', 'Nickname')}
                        />
                      ) : (
                        <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl text-white border border-white/20 text-sm sm:text-base">
                          {profileData.nickname}
                        </div>
                      )}
                    </div>

                    {/* Birth Date */}
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                        {t('profile.birthDate', 'Birth Date')}
                      </label>
                      {isEditing ? (
                        <Input
                          value={editData.birthDate}
                          onChange={handleBirthDateChange}
                          placeholder="DD.MM.YYYY"
                          maxLength={10}
                          leftIcon={<Calendar className="w-4 h-4 sm:w-5 sm:h-5" />}
                        />
                      ) : (
                        <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl text-white flex items-center border border-white/20 text-sm sm:text-base">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3 text-indigo-400" />
                          {profileData.birthDate}
                        </div>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                        {t('auth.email', 'Email')}
                      </label>
                      <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl text-white flex items-center border border-white/20 text-sm sm:text-base">
                        <Mail className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3 text-green-400" />
                        <span className="truncate">{profileData.email}</span>
                      </div>
                    </div>

                    {/* Phone */}
                    {profileData.phone && (
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                          {t('auth.phone', 'Phone')}
                        </label>
                        <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl text-white flex items-center border border-white/20 text-sm sm:text-base">
                          <Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3 text-blue-400" />
                          {profileData.phone}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-4 sm:p-6 hover:bg-white/10 transition-all duration-300">
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-green-500 to-teal-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    {t('profile.location', 'Location')}
                  </h3>
                  
                  <div className="space-y-3 sm:space-y-4">
                    {/* Country */}
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                        {t('profile.country', 'Country')}
                      </label>
                      {isEditing ? (
                        <SearchableSelect
                          value={editData.country}
                          onChange={handleCountryChange}
                          options={getCountryOptions(i18n.language)}
                          placeholder={t('profile.country', 'Country')}
                          leftIcon={<Globe className="w-4 h-4 sm:w-5 sm:h-5" />}
                        />
                      ) : (
                        <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl text-white flex items-center border border-white/20 text-sm sm:text-base">
                          <Globe className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3 text-green-400" />
                          <span className="truncate">{profileData.country}</span>
                        </div>
                      )}
                    </div>

                    {/* City */}
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                        {t('profile.city', 'City')}
                      </label>
                      {isEditing ? (
                        <SearchableSelect
                          value={editData.city}
                          onChange={handleCityChange}
                          options={getCitiesForCountry(editData.country, i18n.language)}
                          placeholder={t('profile.city', 'City')}
                          leftIcon={<MapPin className="w-4 h-4 sm:w-5 sm:h-5" />}
                          disabled={!editData.country}
                        />
                      ) : (
                        <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl text-white flex items-center border border-white/20 text-sm sm:text-base">
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3 text-teal-400" />
                          <span className="truncate">{profileData.city}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Languages Section */}
              <div className="mt-6 sm:mt-8 bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-4 sm:p-6 hover:bg-white/10 transition-all duration-300">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                    <Languages className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                  {t('profile.languages', 'Languages')} 
                  <span className="ml-2 px-2 sm:px-3 py-1 bg-purple-600/30 text-purple-300 rounded-full text-xs sm:text-sm">
                    {(isEditing ? editData.languages : profileData.languages).length}
                  </span>
                </h3>
                
                {isEditing ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                    {LANGUAGES.map((language) => (
                      <button
                        key={language.value}
                        type="button"
                        onClick={() => toggleLanguage(language.value)}
                        className={`p-2 sm:p-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 border ${
                          editData.languages.includes(language.value)
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-500/50 shadow-lg'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20 hover:border-white/30'
                        }`}
                      >
                        {language.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {profileData.languages.map((langCode) => (
                      <span
                        key={langCode}
                        className="px-3 sm:px-4 py-1 sm:py-2 bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-purple-300 rounded-full text-xs sm:text-sm font-medium border border-purple-500/30"
                      >
                        {getLanguageLabel(langCode)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Interests Section */}
              <div className="mt-6 sm:mt-8 bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-4 sm:p-6 hover:bg-white/10 transition-all duration-300">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-pink-500 to-rose-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                    <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                  {t('profile.interests', 'Interests')} 
                  <span className="ml-2 px-2 sm:px-3 py-1 bg-pink-600/30 text-pink-300 rounded-full text-xs sm:text-sm">
                    {(isEditing ? editData.interests : profileData.interests).length}
                  </span>
                </h3>
                
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {(isEditing ? editData.interests : profileData.interests).map((interestKey) => (
                    <span
                      key={interestKey}
                      className="inline-flex items-center px-3 sm:px-4 py-1 sm:py-2 bg-gradient-to-r from-pink-600/30 to-rose-600/30 text-pink-300 rounded-full text-xs sm:text-sm font-medium border border-pink-500/30"
                    >
                      {getTranslatedInterest(interestKey, i18n.language)}
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => removeInterest(interestKey)}
                          className="ml-1 sm:ml-2 hover:bg-pink-700/50 rounded-full p-0.5 transition-colors"
                        >
                          <X className="w-2 h-2 sm:w-3 sm:h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* Statistics Section */}
              <div className="mt-6 sm:mt-8 bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-4 sm:p-6 hover:bg-white/10 transition-all duration-300">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                    <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                  {t('profile.statistics', 'Statistics')}
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  <div className="text-center p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200">
                    <div className="text-2xl sm:text-3xl font-bold text-indigo-400 mb-1 sm:mb-2">127</div>
                    <div className="text-xs sm:text-sm text-gray-300 font-medium">{t('profile.friends', 'Friends')}</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200">
                    <div className="text-2xl sm:text-3xl font-bold text-purple-400 mb-1 sm:mb-2">23</div>
                    <div className="text-xs sm:text-sm text-gray-300 font-medium">{t('profile.chats', 'Chats')}</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200">
                    <div className="text-2xl sm:text-3xl font-bold text-green-400 mb-1 sm:mb-2">1.2K</div>
                    <div className="text-xs sm:text-sm text-gray-300 font-medium">{t('profile.messages', 'Messages')}</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200">
                    <div className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-1 sm:mb-2">89</div>
                    <div className="text-xs sm:text-sm text-gray-300 font-medium">{t('profile.days', 'Days')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}
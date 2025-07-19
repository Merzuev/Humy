import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  ChevronRight, 
  Users, 
  MapPin,
  Globe,
  Heart,
  Folder,
  Loader2
} from 'lucide-react';
import apiClient from '../../api/instance';

interface HierarchyItem {
  id: string;
  name: string;
  type: 'country' | 'region' | 'city' | 'chat';
  participant_count?: number;
  parent_id?: string;
  children?: HierarchyItem[];
}

interface ChatHierarchyProps {
  onSelectChat: (roomInfo: {
    id: string;
    country: string;
    region?: string;
    city: string;
    interest: string;
    participantCount: number;
  }) => void;
  onBack: () => void;
  selectedCountry?: string;
}

export function ChatHierarchy({ onSelectChat, onBack, selectedCountry }: ChatHierarchyProps) {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState<HierarchyItem[]>([]);
  const [currentLevel, setCurrentLevel] = useState<HierarchyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load hierarchy data from API
  const loadHierarchyLevel = async (parentId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const url = parentId ? `/chats/hierarchy/?parent=${parentId}` : '/chats/hierarchy/';
      const response = await apiClient.get(url);
      
      const hierarchyData = response.data.results || response.data || [];
      
      // Transform API data to match our interface
      const transformedData: HierarchyItem[] = hierarchyData.map((item: any) => ({
        id: item.id || item.uuid || Math.random().toString(),
        name: item.name || item.title || 'Unknown',
        type: item.type || (item.chat_type ? 'chat' : 'country'),
        participant_count: item.participant_count || item.participants || 0,
        parent_id: item.parent_id || item.parent,
        children: item.children || []
      }));
      
      setCurrentLevel(transformedData);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError(t('chat.notFound', 'Content not found'));
      } else if (err.response?.status === 500) {
        setError(t('chat.serverError', 'Server error occurred'));
      } else {
        setError(t('chat.loadFailed', 'Failed to load chats'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize hierarchy
  useEffect(() => {
    if (selectedCountry) {
      // If specific country is selected, find it and load its children
      loadCountryChildren(selectedCountry);
    } else {
      // Load root level (countries)
      loadHierarchyLevel();
    }
  }, [selectedCountry]);

  const loadCountryChildren = async (countryName: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // First load all countries to find the selected one
      const countriesResponse = await apiClient.get('/chats/hierarchy/');
      const countries = countriesResponse.data.results || countriesResponse.data || [];
      
      const country = countries.find((c: HierarchyItem) => c.name === countryName);
      if (country) {
        setCurrentPath([country]);
        // Load children of the selected country
        const childrenResponse = await apiClient.get(`/chats/hierarchy/?parent=${country.id}`);
        setCurrentLevel(childrenResponse.data.results || childrenResponse.data || []);
      } else {
        // Fallback to root level if country not found
        setCurrentLevel(countries);
      }
    } catch (err: any) {
      setError(t('chat.loadFailed', 'Failed to load chats'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemClick = async (item: HierarchyItem) => {
    if (item.type === 'chat') {
      // This is a chat room, open it
      const country = currentPath.find(p => p.type === 'country')?.name || '';
      const region = currentPath.find(p => p.type === 'region')?.name;
      const city = currentPath.find(p => p.type === 'city')?.name || '';
      
      onSelectChat({
        id: item.id,
        country,
        region,
        city,
        interest: item.name,
        participantCount: item.participant_count || 0
      });
    } else {
      // Navigate deeper into hierarchy
      const newPath = [...currentPath, item];
      setCurrentPath(newPath);
      
      // Load children of this item
      await loadHierarchyLevel(item.id);
    }
  };

  const handleBackClick = async () => {
    if (currentPath.length === 0) {
      onBack();
    } else if (currentPath.length === 1 && selectedCountry) {
      // If we're in a country and it was selected initially, go back to dashboard
      onBack();
    } else {
      const newPath = currentPath.slice(0, -1);
      setCurrentPath(newPath);
      
      if (newPath.length === 0) {
        // Back to root level
        await loadHierarchyLevel();
      } else {
        // Back to parent level
        const parent = newPath[newPath.length - 1];
        await loadHierarchyLevel(parent.id);
      }
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'country': return <Globe className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 'region': return <Folder className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 'city': return <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 'chat': return <Heart className="w-4 h-4 sm:w-5 sm:h-5" />;
      default: return <Globe className="w-4 h-4 sm:w-5 sm:h-5" />;
    }
  };

  const getTitle = () => {
    if (currentPath.length === 0) {
      return t('chat.countries', 'Countries');
    }
    
    const lastItem = currentPath[currentPath.length - 1];
    switch (lastItem.type) {
      case 'country':
        return t('chat.regionsAndCities', 'Regions and Cities');
      case 'region':
        return t('chat.cities', 'Cities');
      case 'city':
        return t('chat.chats', 'Chats');
      default:
        return '';
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'country': return t('chat.country', 'Country');
      case 'region': return t('chat.region', 'Region');
      case 'city': return t('chat.city', 'City');
      case 'chat': return t('chat.chat', 'Chat');
      default: return '';
    }
  };

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 sm:p-4 bg-white/10 backdrop-blur-xl border-b border-white/20">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <button
              onClick={handleBackClick}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
            <h2 className="text-base sm:text-lg font-semibold text-white truncate">
              {t('common.error', 'Error')}
            </h2>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => loadHierarchyLevel(currentPath[currentPath.length - 1]?.id)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {t('common.retry', 'Retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <button
            onClick={handleBackClick}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold text-white truncate">{getTitle()}</h2>
        </div>
      </div>

      {/* Breadcrumb */}
      {currentPath.length > 0 && (
        <div className="p-3 sm:p-4 border-b border-white/10">
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-300 overflow-x-auto">
            {currentPath.map((item, index) => (
              <React.Fragment key={item.id}>
                <span className="whitespace-nowrap">{item.name}</span>
                {index < currentPath.length - 1 && (
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="ml-2 text-gray-300">{t('common.loading', 'Loading...')}</span>
          </div>
        ) : currentLevel.length > 0 ? (
          <div className="space-y-3">
            {currentLevel.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="w-full p-3 sm:p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200 text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className={`${item.type === 'chat' ? 'text-green-400' : 'text-indigo-400'} flex-shrink-0`}>
                      {getIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-white text-sm truncate">
                        {item.name}
                      </h3>
                      {item.participant_count && (
                        <p className="text-gray-400 text-xs mt-1">
                          <Users className="w-3 h-3 inline mr-1" />
                          {item.participant_count} {t('dashboard.participants', 'participants')}
                        </p>
                      )}
                      {item.type !== 'chat' && (
                        <p className="text-gray-500 text-xs mt-1">
                          {getItemTypeLabel(item.type)}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-white transition-colors flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-gray-400 mb-2">{t('chat.noItems', 'No items found')}</p>
              <button
                onClick={() => loadHierarchyLevel(currentPath[currentPath.length - 1]?.id)}
                className="text-indigo-400 hover:text-indigo-300 text-sm"
              >
                {t('common.refresh', 'Refresh')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Heart,
  Folder as FolderIcon,
  Loader2,
  ChevronRight
} from 'lucide-react';
import apiClient from '../../api/instance';

interface Chat {
  id: string;
  name: string;
  is_protected?: boolean;
  created_at?: string;
}

interface Folder {
  id: string;
  name: string;
  parent: string | null;
  created_at?: string;
  children?: Folder[];
  chats?: Chat[];
}

interface ChatHierarchyProps {
  onSelectChat: (chat: { id: string; name: string }) => void;
  onBack: () => void;
}

export function ChatHierarchy({ onSelectChat, onBack }: ChatHierarchyProps) {
  const { t } = useTranslation();
  const [foldersTree, setFoldersTree] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<Folder[]>([]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    apiClient.get('/api/folders/')
      .then(res => {
        const allFolders = Array.isArray(res.data) ? res.data : [];
        const rootFolders = allFolders.filter((folder: Folder) => folder.parent === null);
        setFoldersTree(rootFolders);
      })
      .catch(() => setError('Ошибка загрузки папок и чатов'))
      .finally(() => setIsLoading(false));
  }, []);

  // Получить содержимое текущей папки (или корня)
  const getCurrentFolderContent = (): Folder[] => {
    if (currentPath.length === 0) {
      return foldersTree;
    }
    return currentPath[currentPath.length - 1].children || [];
  };

  const getCurrentChats = (): Chat[] => {
    if (currentPath.length === 0) {
      return [];
    }
    return currentPath[currentPath.length - 1].chats || [];
  };

  const handleFolderClick = (folder: Folder) => {
    setCurrentPath([...currentPath, folder]);
  };

  const handleBackClick = () => {
    if (currentPath.length === 0) {
      onBack();
    } else {
      setCurrentPath(currentPath.slice(0, -1));
    }
  };

  const getBreadcrumbs = () => {
    if (currentPath.length === 0) return null;
    return (
      <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-300 overflow-x-auto p-2">
        {currentPath.map((folder, idx) => (
          <React.Fragment key={folder.id}>
            <span className="whitespace-nowrap">{folder.name}</span>
            {idx < currentPath.length - 1 && (
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    );
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
              onClick={() => window.location.reload()}
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
          <h2 className="text-base sm:text-lg font-semibold text-white truncate">
            {t('chat.foldersAndChats', 'Folders and Chats')}
          </h2>
        </div>
      </div>

      {/* Breadcrumbs */}
      {getBreadcrumbs()}

      {/* Список папок и чатов */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="ml-2 text-gray-300">{t('common.loading', 'Loading...')}</span>
          </div>
        ) : (
          <div>
            {/* Папки */}
            {getCurrentFolderContent().length > 0 ? (
              <ul className="mb-3">
                {getCurrentFolderContent().map(folder => (
                  <li key={folder.id}>
                    <button
                      className="flex items-center space-x-2 py-1 px-2 hover:bg-white/10 rounded transition-colors w-full text-left"
                      onClick={() => handleFolderClick(folder)}
                    >
                      <FolderIcon className="w-4 h-4 text-indigo-400" />
                      <span className="font-semibold text-white">{folder.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {/* Чаты */}
            {getCurrentChats().length > 0 && (
              <ul className="mt-2">
                {getCurrentChats().map(chat => (
                  <li key={chat.id}>
                    <button
                      onClick={() => onSelectChat({ id: chat.id, name: chat.name })}
                      className="flex items-center space-x-2 text-green-400 hover:underline py-1 px-2"
                    >
                      <Heart className="w-3 h-3" />
                      <span>{chat.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {getCurrentFolderContent().length === 0 && getCurrentChats().length === 0 && (
              <div className="text-center text-gray-400 mt-10">
                {t('chat.noItems', 'No folders or chats found')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

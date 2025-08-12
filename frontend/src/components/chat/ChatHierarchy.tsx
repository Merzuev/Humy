import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ChevronRight,
  Users,
  MapPin,
  Globe,
  Folder,
  Loader2,
} from 'lucide-react';
import apiClient from '../../api/instance';

type ItemType = 'country' | 'region' | 'city' | 'chat';

interface HierarchyItem {
  id: string;
  name: string;
  type: ItemType;
  participant_count?: number;
  parent_id?: string | null;
  interests?: string[]; // теги чата (если backend отдаёт)
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
  selectedCountry?: string; // можно имя; в идеале — ID
}

/** Утилиты */
const toStr = (v: any) => (v === null || v === undefined ? '' : String(v));
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

/** Главный компонент */
export function ChatHierarchy({ onSelectChat, onBack, selectedCountry }: ChatHierarchyProps) {
  const { t } = useTranslation();

  const [currentPath, setCurrentPath] = useState<HierarchyItem[]>([]);
  const [currentLevel, setCurrentLevel] = useState<HierarchyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // кеш уровней
  const cacheRef = useRef<Record<string, HierarchyItem[]>>({});
  const cacheKey = (parentId?: string | null) => (parentId ? `p:${parentId}` : 'root');

  const deriveFolderType = (depth: number): ItemType =>
    depth <= 0 ? 'country' : depth === 1 ? 'region' : 'city';

  /** Запрос папок: теперь просим у бэкенда явный корень (?parent=null), дети — через ?parent=<id>.
   *  Если сервер не поддерживает — мягкие фолбэки: ?root=true, затем без параметров + клиентский фильтр.
   */
  const fetchFolders = async (parentId: string | null, depth: number): Promise<HierarchyItem[]> => {
    // 1) основной путь: ?parent=<id> или ?parent=null
    try {
      const url =
        parentId !== null
          ? `/api/folders/?parent=${encodeURIComponent(parentId)}`
          : `/api/folders/?parent=null`;
      const resp = await apiClient.get(url);
      const raw = resp.data?.results ?? resp.data ?? [];
      const list = Array.isArray(raw) ? raw : [raw];

      return list.map((f: any) => ({
        id: String(f.id ?? f.uuid),
        name: f.name || 'Unknown',
        type: deriveFolderType(depth),
        parent_id: f.parent ?? null,
      }));
    } catch {
      // 2) запасной вариант корня: ?root=true
      if (parentId === null) {
        try {
          const resp = await apiClient.get('/api/folders/?root=true');
          const raw = resp.data?.results ?? resp.data ?? [];
          const list = Array.isArray(raw) ? raw : [raw];
          return list.map((f: any) => ({
            id: String(f.id ?? f.uuid),
            name: f.name || 'Unknown',
            type: deriveFolderType(depth),
            parent_id: f.parent ?? null,
          }));
        } catch {
          // 3) самый последний фолбэк: без параметров и фильтрация на клиенте
          try {
            const resp = await apiClient.get('/api/folders/');
            const raw = resp.data?.results ?? resp.data ?? [];
            const list = Array.isArray(raw) ? raw : [raw];
            const root = list.filter((x: any) => x.parent === null || x.parent === undefined);
            const folders = root.length ? root : list;
            return folders.map((f: any) => ({
              id: String(f.id ?? f.uuid),
              name: f.name || 'Unknown',
              type: deriveFolderType(depth),
              parent_id: f.parent ?? null,
            }));
          } catch {/* ignore */}
        }
      }
    }

    // 4) detail-вариант: /api/folders/<id>/ c children (если сервер так устроен)
    if (parentId) {
      try {
        const detail = await apiClient.get(`/api/folders/${encodeURIComponent(parentId)}/`);
        const d = detail.data || {};
        const children = Array.isArray(d.children) ? d.children : [];
        return children.map((c: any) => ({
          id: String(c.id ?? c.uuid),
          name: c.name || 'Unknown',
          type: deriveFolderType(depth),
          parent_id: parentId,
        }));
      } catch {
        /* ignore */
      }
    }
    return [];
  };

  /** Запрос чатов для папки-города */
  const fetchChatsForFolder = async (folderId: string): Promise<HierarchyItem[]> => {
    // 1) из detail, если там есть chats
    try {
      const detail = await apiClient.get(`/api/folders/${encodeURIComponent(folderId)}/`);
      const d = detail.data || {};
      const chats = Array.isArray(d.chats) ? d.chats : [];
      if (chats.length) {
        return chats.map((c: any) => ({
          id: String(c.id ?? c.uuid),
          name: c.name || c.title || 'Chat',
          type: 'chat' as ItemType,
          participant_count: c.participant_count ?? c.participants ?? 0,
          parent_id: folderId,
          interests:
            (Array.isArray(c.labels) && c.labels.map((l: any) => l.name)) ||
            c.interests ||
            ['General'],
        }));
      }
    } catch {
      /* ignore */
    }

    // 2) отдельные списки: ?folder= или ?folders=
    const tryUrls = [
      `/api/chats/?folder=${encodeURIComponent(folderId)}`,
      `/api/chats/?folders=${encodeURIComponent(folderId)}`,
    ];
    for (const u of tryUrls) {
      try {
        const r = await apiClient.get(u);
        const arr = r.data?.results ?? r.data ?? [];
        if (arr?.length) {
          return arr.map((c: any) => ({
            id: String(c.id ?? c.uuid),
            name: c.name || c.title || 'Chat',
            type: 'chat' as ItemType,
            participant_count: c.participant_count ?? c.participants ?? 0,
            parent_id: folderId,
            interests:
              (Array.isArray(c.labels) && c.labels.map((l: any) => l.name)) ||
              c.interests ||
              ['General'],
          }));
        }
      } catch {
        /* ignore */
      }
    }
    return [];
  };

  /** Универсальная загрузка уровня */
  const loadLevel = async (parentId: string | null, depth: number, useCache = true) => {
    const key = cacheKey(parentId);
    if (useCache && cacheRef.current[key]) {
      setCurrentLevel(cacheRef.current[key]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 1) загружаем папки
      const folders = await fetchFolders(parentId, depth);

      // 2) если это ГОРОД — подмешиваем чаты
      let items: HierarchyItem[] = folders;
      const isCityLevel = depth >= 3 || currentPath[currentPath.length - 1]?.type === 'city';
      if (isCityLevel && parentId) {
        const chats = await fetchChatsForFolder(parentId);
        items = [...folders, ...chats];
      }

      cacheRef.current[key] = items;
      setCurrentLevel(items);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) setError(t('chat.notFound', 'Контент не найден'));
      else if (status === 500) setError(t('chat.serverError', 'Ошибка сервера'));
      else setError(t('chat.loadFailed', 'Не удалось загрузить список'));
    } finally {
      setIsLoading(false);
    }
  };

  // стартовая загрузка
  useEffect(() => {
    (async () => {
      if (selectedCountry) {
        await loadLevel(null, 0, false);
        const countries = cacheRef.current['root'] || [];
        const found = countries.find((c) => c.name === selectedCountry);
        if (found) {
          setCurrentPath([found]);
          await loadLevel(found.id, 1, false);
        } else {
          await loadLevel(null, 0, true);
        }
      } else {
        await loadLevel(null, 0, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry]);

  const handleItemClick = async (item: HierarchyItem) => {
    if (item.type === 'chat') {
      const country = currentPath.find((p) => p.type === 'country')?.name || '';
      const region = currentPath.find((p) => p.type === 'region')?.name;
      const city = currentPath.find((p) => p.type === 'city')?.name || '';
      onSelectChat({
        id: item.id,
        country,
        region,
        city,
        interest: item.name,
        participantCount: item.participant_count || 0,
      });
      return;
    }
    const newPath = [...currentPath, item];
    setCurrentPath(newPath);
    await loadLevel(item.id, newPath.length, true);
  };

  const handleBackClick = async () => {
    if (currentPath.length === 0) return onBack();
    if (currentPath.length === 1 && selectedCountry) return onBack();

    const newPath = currentPath.slice(0, -1);
    setCurrentPath(newPath);
    if (newPath.length === 0) await loadLevel(null, 0, true);
    else await loadLevel(newPath[newPath.length - 1].id, newPath.length, true);
  };

  const handleCrumbClick = async (index: number) => {
    if (index === currentPath.length - 1) return;
    const newPath = currentPath.slice(0, index + 1);
    setCurrentPath(newPath);
    const parent = newPath[newPath.length - 1];
    await loadLevel(parent?.id ?? null, newPath.length, true);
  };

  const getIcon = (type: ItemType) => {
    switch (type) {
      case 'country':
        return <Globe className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 'region':
        return <Folder className="w-4 h-4 sm:w-5 sm:h-5" />;
      case 'city':
        return <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    if (currentPath.length === 0) return t('chat.countries', 'Страны');
    const last = currentPath[currentPath.length - 1];
    switch (last.type) {
      case 'country':
        return t('chat.regionsAndCities', 'Регионы и города');
      case 'region':
        return t('chat.cities', 'Города');
      case 'city':
        return t('chat.chats', 'Чаты');
      default:
        return '';
    }
  };

  const getItemTypeLabel = (type: ItemType) => {
    switch (type) {
      case 'country':
        return t('chat.country', 'Страна');
      case 'region':
        return t('chat.region', 'Регион');
      case 'city':
        return t('chat.city', 'Город');
      default:
        return '';
    }
  };

  /** Карточка папки (страна/регион/город) */
  const FolderCard: React.FC<{ item: HierarchyItem; onClick: () => void }> = ({ item, onClick }) => (
    <button
      onClick={onClick}
      className="w-full p-3 sm:p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200 text-left group"
      title={item.name}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="text-indigo-400 flex-shrink-0">{getIcon(item.type)}</div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-white text-sm truncate">{item.name}</h3>
            <p className="text-gray-500 text-xs mt-1">{getItemTypeLabel(item.type)}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-white transition-colors flex-shrink-0" />
      </div>
    </button>
  );

  /** Карточка чата — как в референсе (инициалы, тег, участники) */
  const ChatCard: React.FC<{ item: HierarchyItem; onClick: () => void }> = ({ item, onClick }) => (
    <button
      onClick={onClick}
      className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-200 text-left group"
      title={item.name}
    >
      <div className="flex items-center">
        {/* аватар с инициалами */}
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mr-3">
          <span className="text-sm font-bold text-white/90">{initials(item.name)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm truncate">{item.name}</h3>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors flex-shrink-0 ml-2" />
          </div>

        <div className="mt-1 flex items-center text-xs text-gray-400">
            <span className="truncate">{item.name}</span>
            <span className="mx-2">•</span>
            <Users className="w-3 h-3 mr-1" />
            <span>{item.participant_count ?? 0} {t('dashboard.participants', 'участников')}</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {(item.interests?.length ? item.interests : ['General']).slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md text-[11px] bg-indigo-500/20 text-indigo-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <button
            onClick={handleBackClick}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            aria-label={t('common.back', 'Назад')}
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold text-white truncate">{getTitle()}</h2>
        </div>
      </div>

      {/* Хлебные крошки */}
      {currentPath.length > 0 && (
        <div className="p-3 sm:p-4 border-b border-white/10">
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-300 overflow-x-auto">
            {currentPath.map((item, index) => (
              <React.Fragment key={item.id}>
                <button
                  className={`whitespace-nowrap hover:text-white transition-colors ${
                    index === currentPath.length - 1 ? 'cursor-default text-white' : 'underline'
                  }`}
                  title={item.name}
                  onClick={() => handleCrumbClick(index)}
                >
                  {item.name}
                </button>
                {index < currentPath.length - 1 && (
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Контент уровня */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {error ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => loadLevel(currentPath[currentPath.length - 1]?.id ?? null, currentPath.length, false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {t('common.retry', 'Повторить')}
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="ml-2 text-gray-300">{t('common.loading', 'Загрузка…')}</span>
          </div>
        ) : currentLevel.length > 0 ? (
          <div className="space-y-3">
            {currentLevel.map((item) =>
              item.type === 'chat' ? (
                <ChatCard key={item.id} item={item} onClick={() => handleItemClick(item)} />
              ) : (
                <FolderCard key={item.id} item={item} onClick={() => handleItemClick(item)} />
              )
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-gray-400 mb-2">{t('chat.noItems', 'Ничего не найдено')}</p>
              <button
                onClick={() => loadLevel(currentPath[currentPath.length - 1]?.id ?? null, currentPath.length, false)}
                className="text-indigo-400 hover:text-indigo-300 text-sm"
              >
                {t('common.refresh', 'Обновить')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

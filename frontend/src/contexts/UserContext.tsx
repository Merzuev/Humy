import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  avatar: any;
  id: string;
  email?: string;
  phone?: string;
  nickname: string;
  birthDate: string;
  country: string;
  city: string;
  languages: string[];
  interests: string[];
  profileImage?: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  token: string | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
  deleteAccount: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('access'));

  // ✅ isAuthenticated зависит напрямую от токена
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!token);

  // ✅ Обновляем токен и localStorage
  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    setIsAuthenticated(!!newToken); // ✅ ключевая строка
    if (newToken) {
      localStorage.setItem('access', newToken);
    } else {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh_token');
    }
  };


  // ✅ Выход из аккаунта
  const logout = () => {
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  };

  // ✅ Удаление аккаунта
  const deleteAccount = async () => {
    try {
      await fetch('/api/users/me/', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Failed to delete account:', error);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.clear();
      window.location.href = '/register';
    }
  };

  const contextValue: UserContextType = {
    user,
    setUser,
    token,
    setToken,
    isAuthenticated,
    logout,
    deleteAccount,
  };

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

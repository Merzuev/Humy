import React, { createContext, useContext, useState, ReactNode } from 'react';

interface User {
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
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('access'));

  const handleSetToken = (newToken: string | null) => {
    setToken(newToken);
    setIsAuthenticated(!!newToken);
    if (newToken) {
      localStorage.setItem('access', newToken);
    } else {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
    }
  };

  const logout = () => {
    setUser(null);
    handleSetToken(null);
    window.location.href = '/login';
  };

  const deleteAccount = async () => {
    try {
      await fetch('/api/users/me/', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Failed to delete account:', error);
    } finally {
      setUser(null);
      handleSetToken(null);
      localStorage.clear();
      window.location.href = '/register';
    }
  };

  const contextValue: UserContextType = {
    user,
    setUser,
    token,
    setToken: handleSetToken,
    isAuthenticated,
    logout,
    deleteAccount,
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

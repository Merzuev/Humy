import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

export { UserContext };

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Load token from localStorage on app start
    const savedToken = localStorage.getItem('accessToken');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  const handleSetToken = (newToken: string | null) => {
    setToken(newToken);
    if (newToken) {
      localStorage.setItem('access', newToken);
    } else {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    // Redirect to login
    window.location.href = '/login';
  };

  const deleteAccount = async () => {
    try {
      // Call API to delete account
      await fetch('/api/users/me/', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Failed to delete account:', error);
      // Continue with logout even if API call fails
    } finally {
      // Clear all data and redirect
      setUser(null);
      setToken(null);
      localStorage.clear();
      window.location.href = '/register';
    }
  };

  const isAuthenticated = !!token;

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        token,
        setToken: handleSetToken,
        isAuthenticated,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";

export interface User {
  userId: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userId: string, password: string) => Promise<void>;
  register: (userId: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user session from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);

  // Auth functions accessing local API
  const register = async (userId: string, password: string) => {
    setError(null);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const login = async (userId: string, password: string) => {
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const newUser = { userId: data.userId };
      setUser(newUser);
      localStorage.setItem("user", JSON.stringify(newUser));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    error
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole, MedicalStaffDetails, InsuranceDetails } from '../types';
import { authAPI } from '../services/api';

export interface ActiveDependentInfo {
  id: string;
  name: string;
  relationship: string;
  accessLevel: 'read_only' | 'full';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  activeDependent: ActiveDependentInfo | null;
  setActiveDependent: (dependent: ActiveDependentInfo | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    phone?: string;
    medicalStaffDetails?: MedicalStaffDetails;
    insuranceDetails?: InsuranceDetails;
  }) => Promise<void>;
  logout: () => void;
  updateUserContext: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('medivault_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('medivault_token');
  });
  const [loading, setLoading] = useState<boolean>(true);

  const [activeDependent, setActiveDependentState] = useState<ActiveDependentInfo | null>(() => {
    const saved = localStorage.getItem('medivault_active_dependent');
    return saved ? JSON.parse(saved) : null;
  });

  const setActiveDependent = (dependent: ActiveDependentInfo | null) => {
    setActiveDependentState(dependent);
    if (dependent) {
      localStorage.setItem('medivault_active_dependent', JSON.stringify(dependent));
    } else {
      localStorage.removeItem('medivault_active_dependent');
    }
  };

  useEffect(() => {
    const verifyAuth = async () => {
      const storedToken = localStorage.getItem('medivault_token');
      if (storedToken) {
        try {
          const data = await authAPI.getMe();
          if (data.success && data.user) {
            setUser(data.user);
            localStorage.setItem('medivault_user', JSON.stringify(data.user));
          }
        } catch {
          console.warn('[AuthContext] Session invalid or expired.');
          localStorage.removeItem('medivault_token');
          localStorage.removeItem('medivault_user');
          localStorage.removeItem('medivault_active_dependent');
          setUser(null);
          setToken(null);
          setActiveDependentState(null);
        }
      }
      setLoading(false);
    };

    verifyAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authAPI.login({ email, password });
    if (data.token && data.user) {
      localStorage.setItem('medivault_token', data.token);
      localStorage.setItem('medivault_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    }
  };

  const register = async (registerData: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    phone?: string;
    medicalStaffDetails?: MedicalStaffDetails;
    insuranceDetails?: InsuranceDetails;
  }) => {
    const data = await authAPI.register(registerData);
    if (data.token && data.user) {
      localStorage.setItem('medivault_token', data.token);
      localStorage.setItem('medivault_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    }
  };

  const logout = () => {
    localStorage.removeItem('medivault_token');
    localStorage.removeItem('medivault_user');
    localStorage.removeItem('medivault_active_dependent');
    setToken(null);
    setUser(null);
    setActiveDependentState(null);
  };

  const updateUserContext = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('medivault_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        activeDependent,
        setActiveDependent,
        login,
        register,
        logout,
        updateUserContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

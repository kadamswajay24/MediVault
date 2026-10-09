import React, { useState, useEffect } from 'react';
import type { User, UserRole, MedicalStaffDetails, InsuranceDetails } from '../types';
import { authAPI } from '../services/api';
import { AuthContext } from './authContextValue';
import type { ActiveDependentInfo } from './authContextValue';

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

  const login = async (email: string, password: string, allowedRoles?: UserRole[]) => {
    const data = await authAPI.login({ email, password });
    if (data.token && data.user) {
      if (allowedRoles && !allowedRoles.includes(data.user.role)) {
        throw new Error('This account belongs to a different MediVault portal. Choose the portal for your account and sign in there.');
      }
      localStorage.setItem('medivault_token', data.token);
      localStorage.setItem('medivault_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    }
    throw new Error('The sign-in service returned an incomplete response. Please try again.');
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
    return data;
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

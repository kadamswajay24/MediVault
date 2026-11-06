import React, { useState, useEffect } from 'react';
import type { User, UserRole, MedicalStaffDetails, InsuranceDetails } from '../types';
import { authAPI } from '../services/api';
import { AuthContext } from './authContextValue';
import type { ActiveDependentInfo } from './authContextValue';
import {
  AUTH_SESSION_KEYS,
  clearLegacySharedAuth,
  clearTabAuthSession,
  portalForRole,
  roleForPortal,
  type AuthPortal,
} from '../utils/authSession';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    clearLegacySharedAuth();
    try {
      const saved = sessionStorage.getItem(AUTH_SESSION_KEYS.user);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    try { return sessionStorage.getItem(AUTH_SESSION_KEYS.token); }
    catch { return null; }
  });
  const [loading, setLoading] = useState<boolean>(true);

  const [activeDependent, setActiveDependentState] = useState<ActiveDependentInfo | null>(() => {
    try {
      const saved = sessionStorage.getItem(AUTH_SESSION_KEYS.activeDependent);
      if (!saved) return null;
      const dependent = JSON.parse(saved) as ActiveDependentInfo;
      return /^MV-[A-F0-9]{16}$/i.test(dependent.mediVaultId) ? dependent : null;
    } catch {
      return null;
    }
  });

  const setActiveDependent = (dependent: ActiveDependentInfo | null) => {
    setActiveDependentState(dependent);
    if (dependent) {
      sessionStorage.setItem(AUTH_SESSION_KEYS.activeDependent, JSON.stringify(dependent));
    } else {
      sessionStorage.removeItem(AUTH_SESSION_KEYS.activeDependent);
    }
  };

  useEffect(() => {
    const verifyAuth = async () => {
      const storedToken = sessionStorage.getItem(AUTH_SESSION_KEYS.token);
      if (storedToken) {
        try {
          const data = await authAPI.getMe();
          if (data.success && data.user) {
            const portal = sessionStorage.getItem(AUTH_SESSION_KEYS.portal);
            if (portal && data.user.role !== roleForPortal(portal as AuthPortal)) {
              throw new Error('Portal session role mismatch.');
            }
            setUser(data.user);
            sessionStorage.setItem(AUTH_SESSION_KEYS.user, JSON.stringify(data.user));
          }
        } catch {
          clearTabAuthSession();
          setUser(null);
          setToken(null);
          setActiveDependentState(null);
        }
      }
      setLoading(false);
    };

    verifyAuth();
  }, []);

  const login = async (email: string, password: string, portal: AuthPortal) => {
    const data = await authAPI.login({ email, password }, portal);
    if (data.token && data.user) {
      if (data.user.role !== roleForPortal(portal)) {
        throw new Error('Unable to sign in. Check your details and try again.');
      }
      try {
        clearTabAuthSession();
        sessionStorage.setItem(AUTH_SESSION_KEYS.portal, portal);
        sessionStorage.setItem(AUTH_SESSION_KEYS.token, data.token);
        sessionStorage.setItem(AUTH_SESSION_KEYS.user, JSON.stringify(data.user));
      } catch {
        clearTabAuthSession();
        throw new Error('Sign-in storage is unavailable in this browser tab. Enable site storage and try again.');
      }
      setToken(data.token);
      setUser(data.user);
      setActiveDependentState(null);
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
      const portal = portalForRole(data.user.role);
      sessionStorage.setItem(AUTH_SESSION_KEYS.portal, portal);
      sessionStorage.setItem(AUTH_SESSION_KEYS.token, data.token);
      sessionStorage.setItem(AUTH_SESSION_KEYS.user, JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setActiveDependentState(null);
    }
    return data;
  };

  const logout = () => {
    clearTabAuthSession();
    setToken(null);
    setUser(null);
    setActiveDependentState(null);
  };

  const updateUserContext = (updatedUser: User) => {
    setUser(updatedUser);
    sessionStorage.setItem(AUTH_SESSION_KEYS.user, JSON.stringify(updatedUser));
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

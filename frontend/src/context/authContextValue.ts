import { createContext } from 'react';
import type { User, UserRole, MedicalStaffDetails, InsuranceDetails, AuthResponse } from '../types';

export interface ActiveDependentInfo {
  id: string;
  name: string;
  relationship: string;
  accessLevel: 'read_only' | 'full';
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  activeDependent: ActiveDependentInfo | null;
  setActiveDependent: (dependent: ActiveDependentInfo | null) => void;
  login: (email: string, password: string, allowedRoles?: UserRole[]) => Promise<User>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    phone?: string;
    medicalStaffDetails?: MedicalStaffDetails;
    insuranceDetails?: InsuranceDetails;
  }) => Promise<AuthResponse>;
  logout: () => void;
  updateUserContext: (user: User) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

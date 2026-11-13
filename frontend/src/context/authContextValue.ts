import { createContext } from 'react';
import type { User, UserRole, MedicalStaffDetails, InsuranceDetails, AuthResponse } from '../types';
import type { AuthPortal } from '../utils/authSession';

export interface ActiveDependentInfo {
  mediVaultId: string;
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
  login: (email: string, password: string, portal: AuthPortal) => Promise<User>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    phone?: string;
    medicalStaffDetails?: MedicalStaffDetails;
    insuranceDetails?: InsuranceDetails;
    credentialDocument?: File;
    credentialExpiresAt?: string;
    patientAddress?: { address: string; city: string; district: string; state: string; postalCode: string; postOffice: string };
    pharmacyOrganizationDetails?: {
      name: string;
      organizationType: 'hospital' | 'independent_pharmacy' | 'franchise';
      hospitalId?: string;
      registrationNumber: string;
      address: string;
      city: string;
      district?: string;
      state: string;
      postalCode: string;
      postOffice?: string;
      openingHours: string;
    };
    labOrganizationDetails?: {
      name: string;
      organizationType: 'independent_lab' | 'hospital_lab' | 'franchise';
      hospitalId?: string;
      hospitalName?: string;
      registrationNumber: string;
      address: string;
      city: string;
      district?: string;
      state: string;
      postalCode: string;
      postOffice?: string;
    };
  }) => Promise<AuthResponse>;
  logout: () => void;
  updateUserContext: (user: User) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

import type { User, UserRole } from '../types';

export type AuthPortal = 'patient' | 'clinical' | 'insurance' | 'insurance_admin' | 'pharmacy' | 'lab' | 'hospital' | 'admin';

export const AUTH_SESSION_KEYS = {
  token: 'medivault_session_token',
  user: 'medivault_session_user',
  activeDependent: 'medivault_session_active_dependent',
  portal: 'medivault_session_portal',
} as const;

const legacyKeys = [
  'medivault_token',
  'medivault_user',
  'medivault_active_dependent',
];

export const clearLegacySharedAuth = () => {
  if (typeof window === 'undefined') return;
  try {
    legacyKeys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage can be unavailable in strict privacy modes; the app will report
    // a sign-in error if the tab-scoped session cannot be persisted.
  }
};

export const clearTabAuthSession = () => {
  if (typeof window === 'undefined') return;
  try {
    Object.values(AUTH_SESSION_KEYS).forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Session state is unavailable in this browser context.
  }
};

export const portalForRole = (role: UserRole): AuthPortal => {
  switch (role) {
    case 'medical_staff': return 'clinical';
    case 'insurance_agent': return 'insurance';
    case 'insurer_admin': return 'insurance_admin';
    case 'pharmacy_manager': case 'pharmacy_chain_admin': return 'pharmacy';
    case 'lab_manager': case 'lab_chain_admin': return 'lab';
    case 'admin': return 'admin';
    case 'hospital_admin': return 'hospital';
    default: return 'patient';
  }
};

export const userMatchesPortal = (user: Pick<User, 'role' | 'medicalStaffDetails'>, portal: AuthPortal): boolean => {
  if (portal === 'lab') {
    return user.role === 'lab_manager' || user.role === 'lab_chain_admin' ||
      (user.role === 'medical_staff' && user.medicalStaffDetails?.professionalType === 'lab_technologist');
  }
  if (portal === 'pharmacy') return user.role === 'pharmacy_manager' || user.role === 'pharmacy_chain_admin';
  if (portal === 'hospital') return user.role === 'hospital_admin';
  if (portal === 'insurance') return user.role === 'insurance_agent';
  if (portal === 'insurance_admin') return user.role === 'insurer_admin';
  return user.role === roleForPortal(portal);
};

export const roleForPortal = (portal: AuthPortal): UserRole => {
  switch (portal) {
    case 'clinical': return 'medical_staff';
    case 'insurance': return 'insurance_agent';
    case 'insurance_admin': return 'insurer_admin';
    case 'pharmacy': return 'pharmacy_manager';
    case 'admin': return 'admin';
    case 'hospital': return 'hospital_admin';
    default: return 'patient';
  }
};

export const loginPathForPortal = (portal: string | null): string => {
  switch (portal) {
    case 'clinical': return '/clinical/login';
    case 'insurance': return '/insurance/login';
    case 'insurance_admin': return '/insurance/admin/login';
    case 'pharmacy': return '/pharmacy/login';
    case 'lab': return '/lab/login';
    case 'admin': return '/admin/login';
    case 'hospital': return '/hospital/login';
    default: return '/patient/login';
  }
};

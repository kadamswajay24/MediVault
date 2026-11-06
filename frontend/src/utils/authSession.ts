import type { UserRole } from '../types';

export type AuthPortal = 'patient' | 'clinical' | 'insurance' | 'admin';

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
    case 'admin': return 'admin';
    default: return 'patient';
  }
};

export const roleForPortal = (portal: AuthPortal): UserRole => {
  switch (portal) {
    case 'clinical': return 'medical_staff';
    case 'insurance': return 'insurance_agent';
    case 'admin': return 'admin';
    default: return 'patient';
  }
};

export const loginPathForPortal = (portal: string | null): string => {
  switch (portal) {
    case 'clinical': return '/clinical/login';
    case 'insurance': return '/insurance/login';
    case 'admin': return '/admin/login';
    default: return '/patient/login';
  }
};

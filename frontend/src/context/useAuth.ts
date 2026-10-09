import { useContext } from 'react';
import { AuthContext } from './authContextValue';
import type { AuthContextType } from './authContextValue';

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

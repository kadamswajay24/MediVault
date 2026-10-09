import { useContext } from 'react';
import { ThemeContext } from './themeContextValue';
import type { ThemeContextType } from './themeContextValue';

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

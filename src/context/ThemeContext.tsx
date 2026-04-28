'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Theme } from '@/types';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('viewtopia_theme') as Theme | null;
    if (stored) {
      setTheme(stored);
    }
    // Default stays 'dark' — no light detection
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme === 'dark' ? 'dark-mode' : 'light-mode';
    localStorage.setItem('viewtopia_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

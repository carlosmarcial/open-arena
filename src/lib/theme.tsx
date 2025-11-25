/**
 * Theme Provider for Light/Dark Mode
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark' | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark' | null>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Load theme from localStorage
    const stored = localStorage.getItem('aster-arena-theme') as Theme;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setTheme(stored);
    } else {
      // If no stored theme, default to dark mode
      setTheme('dark');
      setResolvedTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Save theme to localStorage
    localStorage.setItem('aster-arena-theme', theme);

    // Determine resolved theme
    const root = window.document.documentElement;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    const resolved = theme === 'system' ? systemTheme : theme;
    setResolvedTheme(resolved);

    // Apply theme to DOM
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
  }, [theme, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

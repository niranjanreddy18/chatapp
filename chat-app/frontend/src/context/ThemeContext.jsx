import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // themeMode can be 'light', 'dark', or 'system'
  const [themeMode, setThemeModeState] = useState(() => {
    return localStorage.getItem('nexus_theme_mode') || localStorage.getItem('nexus_theme') || 'dark';
  });

  // Calculate actual active theme ('light' or 'dark')
  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  };

  const [activeTheme, setActiveTheme] = useState(() => {
    if (themeMode === 'system') return getSystemTheme();
    return themeMode === 'light' ? 'light' : 'dark';
  });

  // Listen for system theme changes if themeMode === 'system'
  useEffect(() => {
    if (themeMode !== 'system') {
      setActiveTheme(themeMode === 'light' ? 'light' : 'dark');
      return;
    }

    setActiveTheme(getSystemTheme());

    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setActiveTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  // Apply class to <html> and sync localStorage
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(activeTheme);
    localStorage.setItem('nexus_theme', activeTheme);
    localStorage.setItem('nexus_theme_mode', themeMode);
  }, [activeTheme, themeMode]);

  const setThemeMode = useCallback((mode) => {
    if (mode === 'light' || mode === 'dark' || mode === 'system') {
      setThemeModeState(mode);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeModeState((prev) => {
      if (prev === 'dark') return 'light';
      return 'dark';
    });
  }, []);

  const value = useMemo(() => ({
    theme: activeTheme,
    themeMode,
    setThemeMode,
    toggleTheme,
  }), [activeTheme, themeMode, setThemeMode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}


import { useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'theme' as const;

type Theme = 'dark' | 'light' | '';

const getThemeFromStorage = (): Theme => {
  return (localStorage.getItem(THEME_KEY) || '') as Theme;
};

const setThemeInStorage = (theme: Theme): void => {
  localStorage.setItem(THEME_KEY, theme);
  document.body.classList.remove('dark', 'light');
  if (theme === 'dark') {
    document.body.classList.add('dark');
  } else if (theme === 'light') {
    document.body.classList.add('light');
  }
};

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => getThemeFromStorage());

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeInStorage(newTheme);
    setThemeState(newTheme);
  }, []);

  useEffect(() => {
    const currentTheme = getThemeFromStorage();
    setThemeInStorage(currentTheme);
    setThemeState(currentTheme);
  }, []);

  return {
    theme,
    setTheme,
  };
};


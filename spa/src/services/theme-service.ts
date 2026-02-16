export const themeService = {
    THEME_KEY: 'theme' as const,

    init: () => {
        const theme = themeService.getTheme();
        themeService.setTheme(theme);
    },

    getTheme: () => {
        return localStorage.getItem(themeService.THEME_KEY) as 'dark' | 'light' | '';
    },
    
    setTheme: (theme: 'dark' | 'light' | '') => {
        localStorage.setItem(themeService.THEME_KEY, theme);
        document.body.classList.remove('dark', 'light');
        if (theme === 'dark') {
            document.body.classList.add('dark');
        } else if (theme === 'light') {
            document.body.classList.add('light');
        } 
    }
};
// Theme handling module for managing dark mode
export class ThemeHandler {
    constructor() {
        this.darkModeToggle = document.getElementById('toggle-dark-mode');
        this.root = document.documentElement;
        this.setupThemeHandling();
    }

    setupThemeHandling() {
        if (this.darkModeToggle) {
            // Add click event listener
            this.darkModeToggle.addEventListener('click', () => this.toggleDarkMode());
            
            // Add keyboard accessibility
            this.darkModeToggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleDarkMode();
                }
            });

            // Load saved preference
            this.loadSavedPreference();
            
            // Listen for system theme changes
            this.setupSystemThemeListener();
        }
    }

    toggleDarkMode() {
        try {
            const isDarkMode = this.root.getAttribute('data-theme') === 'dark';
            const newTheme = isDarkMode ? 'light' : 'dark';
            this.applyTheme(newTheme);
            this.savePreference(newTheme);
            this.updateButtonText(!isDarkMode);
            this.announceChange(!isDarkMode);
        } catch (error) {
            console.error('Error toggling dark mode:', error);
        }
    }

    applyTheme(theme) {
        this.root.setAttribute('data-theme', theme);
        if (theme === 'dark') {
            this.root.style.setProperty('--primary-color', '#4dabf7');
            this.root.style.setProperty('--secondary-color', '#adb5bd');
            this.root.style.setProperty('--success-color', '#40c057');
            this.root.style.setProperty('--error-color', '#fa5252');
            this.root.style.setProperty('--background-color', '#212529');
            this.root.style.setProperty('--text-color', '#f8f9fa');
            this.root.style.setProperty('--border-color', '#495057');
            this.root.style.setProperty('--message-bg-user', '#343a40');
            this.root.style.setProperty('--message-bg-bot', '#2b3035');
        } else {
            this.root.style.setProperty('--primary-color', '#007bff');
            this.root.style.setProperty('--secondary-color', '#6c757d');
            this.root.style.setProperty('--success-color', '#28a745');
            this.root.style.setProperty('--error-color', '#dc3545');
            this.root.style.setProperty('--background-color', '#ffffff');
            this.root.style.setProperty('--text-color', '#212529');
            this.root.style.setProperty('--border-color', '#dee2e6');
            this.root.style.setProperty('--message-bg-user', '#e9ecef');
            this.root.style.setProperty('--message-bg-bot', '#f8f9fa');
        }
    }

    updateButtonText(isDarkMode) {
        const buttonText = this.darkModeToggle.querySelector('span');
        if (buttonText) {
            const newText = isDarkMode ? 'Light Mode' : 'Dark Mode';
            buttonText.textContent = newText;
            this.darkModeToggle.setAttribute('aria-label', `Switch to ${newText}`);
        }
    }

    announceChange(isDarkMode) {
        // Announce mode change to screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = `Switched to ${isDarkMode ? 'dark' : 'light'} mode`;
        document.body.appendChild(announcement);
        setTimeout(() => announcement.remove(), 1000);
    }

    savePreference(theme) {
        try {
            localStorage.setItem('theme', theme);
        } catch (error) {
            console.error('Error saving theme preference:', error);
        }
    }

    loadSavedPreference() {
        try {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                this.applyTheme(savedTheme);
                this.updateButtonText(savedTheme === 'dark');
            } else {
                // Check system preference
                this.checkSystemTheme();
            }
        } catch (error) {
            console.error('Error loading theme preference:', error);
        }
    }

    setupSystemThemeListener() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                const theme = e.matches ? 'dark' : 'light';
                this.applyTheme(theme);
                this.updateButtonText(e.matches);
            }
        });
    }

    checkSystemTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = prefersDark ? 'dark' : 'light';
        this.applyTheme(theme);
        this.updateButtonText(prefersDark);
    }
}

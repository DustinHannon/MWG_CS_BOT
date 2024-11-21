// Theme handling module for managing dark mode
export class ThemeHandler {
    constructor() {
        this.darkModeToggle = document.getElementById('toggle-dark-mode');
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
        }
    }

    toggleDarkMode() {
        try {
            const isDarkMode = document.body.classList.toggle('dark-mode');
            this.savePreference(isDarkMode);
            this.updateButtonText(isDarkMode);
            this.announceChange(isDarkMode);
        } catch (error) {
            console.error('Error toggling dark mode:', error);
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

    savePreference(isDarkMode) {
        try {
            localStorage.setItem('darkMode', isDarkMode.toString());
        } catch (error) {
            console.error('Error saving dark mode preference:', error);
        }
    }

    loadSavedPreference() {
        try {
            const savedDarkMode = localStorage.getItem('darkMode');
            if (savedDarkMode === 'true') {
                document.body.classList.add('dark-mode');
                this.updateButtonText(true);
            }
        } catch (error) {
            console.error('Error loading dark mode preference:', error);
        }
    }
}

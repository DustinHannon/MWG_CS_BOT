export class ThemeHandler {
    constructor() {
        this.darkModeToggle = document.getElementById('toggle-dark-mode');
        this.setupThemeHandling();
    }

    setupThemeHandling() {
        if (this.darkModeToggle) {
            // Check for saved dark mode preference
            if (localStorage.getItem('darkMode') === 'enabled') {
                document.body.classList.add('dark-mode');
                this.updateButtonText(true);
            }
            
            // Add click event listener
            this.darkModeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                const isDarkMode = document.body.classList.contains('dark-mode');
                localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
                this.updateButtonText(isDarkMode);
            });
        }
    }

    updateButtonText(isDarkMode) {
        const buttonText = this.darkModeToggle.querySelector('span');
        if (buttonText) {
            buttonText.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
        }
    }
}

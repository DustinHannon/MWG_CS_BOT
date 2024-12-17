/**
 * Theme Handler Module (themeHandler.js)
 * 
 * This module manages the application's theme system, providing:
 * - Dark/light mode switching
 * - System preference detection
 * - Smooth theme transitions
 * - Local storage persistence
 * - Accessibility features
 * 
 * The theme system follows this priority order:
 * 1. User's saved preference (localStorage)
 * 2. System color scheme preference
 * 3. Default light theme
 * 
 * Features:
 * - Smooth transitions between themes
 * - System preference synchronization
 * - Keyboard accessibility
 * - Mobile browser meta theme color
 * - Error handling
 * 
 * Related files:
 * - ../../styles.css: Theme-specific styles
 * - ../index.js: Theme initialization
 */

export class ThemeHandler {
    /**
     * Initialize the theme handler
     * Sets up DOM references and initial state
     */
    constructor() {
        // Core elements
        this.darkModeToggle = document.getElementById('toggle-dark-mode');
        this.body = document.body;
        
        // Configuration
        this.themeTransitionDuration = 300; // milliseconds
        
        // State tracking
        this.currentTheme = null;
        this.isTransitioning = false;

        // Initialize the theme system
        this.init();
    }

    /**
     * Initialize theme handling system
     * Sets up preferences, listeners, and transitions
     */
    init() {
        // Set up theme based on priority:
        // 1. User's saved preference
        // 2. System preference
        // 3. Default to light theme
        this.setupThemePreference();
        this.setupEventListeners();
        this.setupSystemPreferenceListener();
        this.addThemeTransitionHandling();
    }

    /**
     * Set up initial theme preference
     * Checks localStorage and system preferences
     */
    setupThemePreference() {
        const savedTheme = localStorage.getItem('darkMode');
        
        if (savedTheme) {
            // Use saved preference
            this.setTheme(savedTheme === 'enabled');
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark);
        }
    }

    /**
     * Set up event listeners for theme toggling
     * Handles both click and keyboard interactions
     */
    setupEventListeners() {
        if (this.darkModeToggle) {
            // Handle click events
            this.darkModeToggle.addEventListener('click', () => {
                if (!this.isTransitioning) {
                    const isDarkMode = !this.body.classList.contains('dark-mode');
                    this.toggleTheme(isDarkMode);
                }
            });

            // Handle keyboard navigation
            this.darkModeToggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!this.isTransitioning) {
                        const isDarkMode = !this.body.classList.contains('dark-mode');
                        this.toggleTheme(isDarkMode);
                    }
                }
            });
        }
    }

    /**
     * Set up system theme preference listener
     * Syncs with system dark mode changes
     */
    setupSystemPreferenceListener() {
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Use newer addEventListener if available, fallback to older change event
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', (e) => {
                // Only apply system preference if user hasn't set a preference
                if (!localStorage.getItem('darkMode')) {
                    this.setTheme(e.matches);
                }
            });
        } else {
            // Fallback for older browsers
            mediaQuery.addListener((e) => {
                if (!localStorage.getItem('darkMode')) {
                    this.setTheme(e.matches);
                }
            });
        }
    }

    /**
     * Add smooth transition handling for theme changes
     * Injects necessary CSS for transitions
     */
    addThemeTransitionHandling() {
        // Add transition class for smooth theme changes
        const transitionStyles = document.createElement('style');
        transitionStyles.textContent = `
            body.theme-transition,
            body.theme-transition *,
            body.theme-transition *:before,
            body.theme-transition *:after {
                transition: all ${this.themeTransitionDuration}ms !important;
                transition-delay: 0 !important;
            }
        `;
        document.head.appendChild(transitionStyles);
    }

    /**
     * Toggle between light and dark themes
     * @param {boolean} isDarkMode - Whether to enable dark mode
     */
    async toggleTheme(isDarkMode) {
        if (this.isTransitioning) return;

        try {
            await this.setTheme(isDarkMode);
            localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
            
            // Dispatch custom event for other components
            window.dispatchEvent(new CustomEvent('themechange', {
                detail: { isDarkMode }
            }));
        } catch (error) {
            console.error('Error toggling theme:', error);
            this.showThemeError();
        }
    }

    /**
     * Set theme with transition
     * @param {boolean} isDarkMode - Whether to enable dark mode
     * @returns {Promise<void>} Resolves when transition is complete
     */
    async setTheme(isDarkMode) {
        this.isTransitioning = true;

        return new Promise((resolve) => {
            // Add transition class
            this.body.classList.add('theme-transition');

            // Update theme after a small delay to ensure transition class is applied
            requestAnimationFrame(() => {
                // Update theme
                this.body.classList.toggle('dark-mode', isDarkMode);
                this.updateButtonText(isDarkMode);
                this.updateMetaThemeColor(isDarkMode);

                // Remove transition class after duration
                setTimeout(() => {
                    this.body.classList.remove('theme-transition');
                    this.isTransitioning = false;
                    resolve();
                }, this.themeTransitionDuration);
            });
        });
    }

    /**
     * Update theme toggle button text and ARIA attributes
     * @param {boolean} isDarkMode - Current theme state
     */
    updateButtonText(isDarkMode) {
        if (this.darkModeToggle) {
            const buttonText = this.darkModeToggle.querySelector('span');
            if (buttonText) {
                const newText = isDarkMode ? 'Light Mode' : 'Dark Mode';
                buttonText.textContent = newText;
                
                // Update accessibility attributes
                this.darkModeToggle.setAttribute('aria-label', `Switch to ${newText}`);
                this.darkModeToggle.setAttribute('aria-pressed', isDarkMode.toString());
            }
        }
    }

    /**
     * Update mobile browser theme color
     * @param {boolean} isDarkMode - Current theme state
     */
    updateMetaThemeColor(isDarkMode) {
        // Update theme-color meta tag for mobile browsers
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }

        metaThemeColor.content = isDarkMode ? '#202123' : '#ffffff';
    }

    /**
     * Show error message when theme change fails
     */
    showThemeError() {
        // Create error message element
        const errorMessage = document.createElement('div');
        errorMessage.className = 'theme-error-message';
        errorMessage.setAttribute('role', 'alert');
        errorMessage.textContent = 'Failed to switch theme. Please try again.';

        // Add error message to DOM
        document.body.appendChild(errorMessage);

        // Remove error message after 3 seconds
        setTimeout(() => {
            errorMessage.remove();
        }, 3000);
    }

    /**
     * Get current theme
     * @returns {string} Current theme ('light' or 'dark')
     */
    getCurrentTheme() {
        return this.body.classList.contains('dark-mode') ? 'dark' : 'light';
    }

    /**
     * Check if system prefers dark mode
     * @returns {boolean} Whether system prefers dark mode
     */
    static systemPrefersDarkMode() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    /**
     * Force light theme
     * Overrides system preference
     */
    async forceLightTheme() {
        await this.setTheme(false);
        localStorage.setItem('darkMode', 'disabled');
    }

    /**
     * Force dark theme
     * Overrides system preference
     */
    async forceDarkTheme() {
        await this.setTheme(true);
        localStorage.setItem('darkMode', 'enabled');
    }

    /**
     * Reset to system preference
     * Removes saved preference
     */
    async resetToSystemPreference() {
        localStorage.removeItem('darkMode');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        await this.setTheme(prefersDark);
    }
}

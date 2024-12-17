import { ChatUI } from './modules/chatUI.js';
import { FormHandler } from './modules/formHandler.js';
import { ThemeHandler } from './modules/themeHandler.js';

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize modules
        const chatUI = new ChatUI();
        const formHandler = new FormHandler(chatUI);
        const themeHandler = new ThemeHandler();

        // Log initialization
        console.log('Chat application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
        displayErrorMessage('Failed to initialize chat application. Please refresh the page.');
    }
});

// Display error message helper
function displayErrorMessage(message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-container';
    errorContainer.setAttribute('role', 'alert');
    errorContainer.textContent = message;
    document.body.appendChild(errorContainer);
    
    // Remove error message after 5 seconds
    setTimeout(() => {
        errorContainer.remove();
    }, 5000);
}

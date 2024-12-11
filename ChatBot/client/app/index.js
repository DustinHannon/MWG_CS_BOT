import { ChatUI } from './modules/chatUI.js';
import { FormHandler } from './modules/formHandler.js';
import { ThemeHandler } from './modules/themeHandler.js';

// Application initialization
class App {
    constructor() {
        this.initialize();
    }

    initialize() {
        try {
            // Initialize modules
            const chatUI = new ChatUI();
            const formHandler = new FormHandler(chatUI);
            const themeHandler = new ThemeHandler();

            // Add error boundary
            this.setupErrorBoundary();

            // Log initialization
            console.log('Chat application initialized successfully');
        } catch (error) {
            console.error('Error initializing application:', error);
            this.handleInitializationError(error);
        }
    }

    setupErrorBoundary() {
        // Global error handler
        window.onerror = (message, source, lineno, colno, error) => {
            console.error('Global error:', {
                message,
                source,
                lineno,
                colno,
                error
            });
            this.displayErrorMessage('An unexpected error occurred. Please refresh the page.');
            return true;
        };

        // Unhandled promise rejection handler
        window.onunhandledrejection = (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.displayErrorMessage('An unexpected error occurred. Please refresh the page.');
            event.preventDefault();
        };
    }

    handleInitializationError(error) {
        // Display user-friendly error message
        this.displayErrorMessage('Failed to initialize chat application. Please refresh the page.');
        
        // Log detailed error for debugging
        console.error('Initialization error details:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }

    displayErrorMessage(message) {
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
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});

// Add service worker for offline support and caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(error => {
                console.error('ServiceWorker registration failed:', error);
            });
    });
}

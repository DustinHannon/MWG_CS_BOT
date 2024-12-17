/**
 * Client Application Entry Point (index.js)
 * 
 * This is the main entry point for the client-side application. It initializes and
 * coordinates all the core functionality of the chat interface, including:
 * - Module initialization
 * - Service worker registration
 * - Error handling
 * - Performance monitoring
 * - Offline detection
 * - Session management
 * 
 * The application follows a modular architecture where different aspects of
 * functionality are encapsulated in separate modules (ChatUI, FormHandler, ThemeHandler).
 * 
 * Related files:
 * - modules/chatUI.js: Handles chat interface rendering
 * - modules/formHandler.js: Manages form input and submission
 * - modules/themeHandler.js: Handles theme switching
 * - ../service-worker.js: Service worker for offline functionality
 */

// Import core modules
import { ChatUI } from './modules/chatUI.js';
import { FormHandler } from './modules/formHandler.js';
import { ThemeHandler } from './modules/themeHandler.js';

/**
 * Main application class that coordinates all functionality
 * This class initializes and manages the entire chat application
 */
class ChatApplication {
    /**
     * Initialize the application state
     * Sets up module references and initialization flag
     */
    constructor() {
        this.initialized = false;
        this.modules = {
            chatUI: null,          // Handles chat interface
            formHandler: null,     // Manages form interactions
            themeHandler: null     // Handles theme switching
        };
    }

    /**
     * Initialize the application
     * This method coordinates the startup sequence of the application
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Register service worker for offline functionality
            await this.registerServiceWorker();

            // Initialize core modules
            this.modules.chatUI = new ChatUI();
            this.modules.formHandler = new FormHandler(this.modules.chatUI);
            this.modules.themeHandler = new ThemeHandler();

            // Set up various system handlers
            this.setupErrorHandling();
            this.setupPerformanceMonitoring();
            this.setupOfflineDetection();

            // Initialize user session
            await this.initializeSession();

            this.initialized = true;
            console.log('Chat application initialized successfully');

        } catch (error) {
            console.error('Error initializing application:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Register the service worker for offline functionality
     * This enables PWA features and offline capabilities
     * @returns {Promise<void>}
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered:', registration);

                // Handle service worker updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });

            } catch (error) {
                console.error('Service Worker registration failed:', error);
                // Continue initialization even if SW registration fails
            }
        }
    }

    /**
     * Set up global error handling
     * Catches and handles uncaught errors and promise rejections
     */
    setupErrorHandling() {
        // Handle synchronous errors
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleRuntimeError(event.error);
        });

        // Handle asynchronous errors
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleRuntimeError(event.reason);
        });
    }

    /**
     * Set up performance monitoring
     * Tracks long tasks and layout shifts for performance optimization
     */
    setupPerformanceMonitoring() {
        if ('PerformanceObserver' in window) {
            // Monitor long tasks (tasks that block the main thread)
            const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.duration > 50) { // Tasks longer than 50ms
                        console.warn('Long task detected:', entry);
                    }
                });
            });

            longTaskObserver.observe({ entryTypes: ['longtask'] });

            // Monitor layout shifts (visual stability)
            const layoutShiftObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.value > 0.1) { // Significant layout shifts
                        console.warn('Significant layout shift detected:', entry);
                    }
                });
            });

            layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        }
    }

    /**
     * Set up offline detection
     * Monitors network status and shows appropriate notifications
     */
    setupOfflineDetection() {
        // Handle online status
        window.addEventListener('online', () => {
            this.handleOnlineStatus(true);
        });

        // Handle offline status
        window.addEventListener('offline', () => {
            this.handleOnlineStatus(false);
        });

        // Initial network status check
        this.handleOnlineStatus(navigator.onLine);
    }

    /**
     * Initialize user session
     * Creates a new session or restores existing session
     * @returns {Promise<void>}
     */
    async initializeSession() {
        try {
            const response = await fetch('/api/session', {
                method: 'POST',
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error('Failed to initialize session');
            }

            const data = await response.json();
            console.log('Session initialized:', data.sessionId);

        } catch (error) {
            console.error('Session initialization failed:', error);
            throw error;
        }
    }

    /**
     * Handle initialization errors
     * Shows error message and retry button to users
     * @param {Error} error - The error that occurred during initialization
     */
    handleInitializationError(error) {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-container';
        errorContainer.setAttribute('role', 'alert');
        
        const errorMessage = document.createElement('p');
        errorMessage.textContent = 'Failed to initialize chat application.';
        
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Retry';
        retryButton.onclick = () => {
            errorContainer.remove();
            this.init();
        };
        
        errorContainer.appendChild(errorMessage);
        errorContainer.appendChild(retryButton);
        document.body.appendChild(errorContainer);
    }

    /**
     * Handle runtime errors
     * Shows error messages in the chat interface
     * @param {Error} error - The runtime error that occurred
     */
    handleRuntimeError(error) {
        if (!this.modules.chatUI) return;

        const errorMessage = error.message || 'An unexpected error occurred';
        this.modules.chatUI.addErrorMessage(
            `Application error: ${errorMessage}. Please refresh the page if the issue persists.`
        );
    }

    /**
     * Handle online/offline status changes
     * Shows appropriate notifications to users
     * @param {boolean} isOnline - Current network status
     */
    handleOnlineStatus(isOnline) {
        const statusElement = document.createElement('div');
        statusElement.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
        statusElement.setAttribute('role', 'status');
        statusElement.textContent = isOnline 
            ? 'Back online'
            : 'You are offline. Some features may be unavailable.';

        document.body.appendChild(statusElement);

        // Remove notification after 3 seconds
        setTimeout(() => {
            statusElement.remove();
        }, 3000);
    }

    /**
     * Show update notification
     * Notifies users when a new version is available
     */
    showUpdateNotification() {
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.setAttribute('role', 'alert');
        
        const message = document.createElement('p');
        message.textContent = 'A new version is available.';
        
        const updateButton = document.createElement('button');
        updateButton.textContent = 'Update Now';
        updateButton.onclick = () => {
            window.location.reload();
        };
        
        notification.appendChild(message);
        notification.appendChild(updateButton);
        document.body.appendChild(notification);
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new ChatApplication();
    app.init().catch(error => {
        console.error('Failed to initialize application:', error);
    });
});

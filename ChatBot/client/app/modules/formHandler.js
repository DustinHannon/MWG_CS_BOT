/**
 * Form Handler Module (formHandler.js)
 * 
 * This module manages all form-related functionality for the chat interface, including:
 * - Input handling and validation
 * - Form submission
 * - Error handling and retries
 * - Input sanitization
 * - Accessibility features
 * - Auto-resizing textarea
 * 
 * The module implements several advanced features:
 * - Debounced input handling
 * - Exponential backoff for retries
 * - Input validation with security checks
 * - Keyboard shortcuts
 * - Paste event handling
 * 
 * Related files:
 * - chatUI.js: Handles message display
 * - themeHandler.js: Manages theme switching
 * - ../../styles.css: Form styling
 */

export class FormHandler {
    /**
     * Initialize the form handler
     * @param {ChatUI} chatUI - Instance of the ChatUI class for message display
     */
    constructor(chatUI) {
        // Core dependencies
        this.chatUI = chatUI;
        
        // Processing state
        this.isProcessing = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000;      // Start with 1 second
        this.maxRetryDelay = 5000;   // Max 5 seconds
        
        // Input handling
        this.debounceTimeout = null;
        this.debounceDelay = 300;    // 300ms debounce delay

        // DOM elements
        this.form = document.getElementById('prompt-form');
        this.input = document.getElementById('prompt-input');
        this.submitButton = this.form.querySelector('button[type="submit"]');
        this.inputContainer = this.form.querySelector('.input-container');
        this.errorMessage = this.form.querySelector('.error-message');

        // Initialize event handlers
        this.setupEventListeners();
        this.setupInputValidation();
    }

    /**
     * Set up all event listeners for form interaction
     * Handles form submission, input changes, keyboard shortcuts, and paste events
     */
    setupEventListeners() {
        // Form submission handler
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.isProcessing) {
                const sanitizedInput = this.sanitizeInput(this.input.value);
                if (this.validateInput(sanitizedInput)) {
                    await this.handleSubmit(sanitizedInput);
                }
            }
        });

        // Debounced input handler
        this.input.addEventListener('input', () => {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = setTimeout(() => {
                this.handleInputChange();
            }, this.debounceDelay);
        });

        // Keyboard shortcuts handler
        this.input.addEventListener('keydown', async (e) => {
            // Submit on Enter (without Shift)
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const sanitizedInput = this.sanitizeInput(this.input.value);
                if (sanitizedInput && !this.isProcessing && this.validateInput(sanitizedInput)) {
                    await this.handleSubmit(sanitizedInput);
                }
            }
            // New line on Shift+Enter
            else if (e.key === 'Enter' && e.shiftKey) {
                this.adjustTextareaHeight();
            }
            // Clear input on Escape
            else if (e.key === 'Escape') {
                this.clearInput();
            }
        });

        // Paste event handler with sanitization
        this.input.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text');
            const sanitizedText = this.sanitizeInput(text);
            document.execCommand('insertText', false, sanitizedText);
        });

        // Focus/blur handlers for visual feedback
        this.input.addEventListener('focus', () => {
            this.inputContainer.classList.add('focused');
        });

        this.input.addEventListener('blur', () => {
            this.inputContainer.classList.remove('focused');
        });
    }

    /**
     * Set up real-time input validation
     */
    setupInputValidation() {
        this.input.addEventListener('input', () => {
            const value = this.input.value.trim();
            this.updateValidationUI(value);
        });
    }

    /**
     * Update UI based on input validation state
     * @param {string} value - Current input value
     */
    updateValidationUI(value) {
        const isValid = this.validateInput(value, false);
        this.submitButton.disabled = !isValid || !value;
        this.inputContainer.classList.toggle('invalid', !isValid && value.length > 0);
    }

    /**
     * Handle form submission
     * Manages the entire submission flow including error handling and retries
     * @param {string} question - Validated and sanitized input
     */
    async handleSubmit(question) {
        if (!question.trim() || this.isProcessing) return;

        try {
            this.setProcessingState(true);
            this.chatUI.addUserMessage(question);
            this.chatUI.showTypingIndicator();

            const response = await this.makeRequest(question);
            
            if (!response.ok) {
                throw new Error(response.statusText);
            }

            const { data } = await response.json();
            if (!data || typeof data !== 'string') {
                throw new Error('Invalid response format');
            }
            
            this.chatUI.removeTypingIndicator();
            this.chatUI.addBotResponse(data);
            
            // Reset retry count on successful request
            this.retryCount = 0;
            this.retryDelay = 1000;
            
        } catch (error) {
            await this.handleError(error, question);
        } finally {
            this.setProcessingState(false);
        }
    }

    /**
     * Make API request with timeout handling
     * @param {string} question - User's question
     * @param {boolean} isRetry - Whether this is a retry attempt
     * @returns {Promise<Response>} Fetch response
     */
    async makeRequest(question, isRetry = false) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            const response = await fetch('/api/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question }),
                credentials: 'same-origin',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            throw error;
        }
    }

    /**
     * Handle errors during submission
     * Implements exponential backoff for retries
     * @param {Error} error - The error that occurred
     * @param {string} question - Original question for retry
     */
    async handleError(error, question) {
        console.error('Form Error:', error);
        this.chatUI.removeTypingIndicator();

        try {
            // Parse error response if it's a server error
            const errorData = error.response ? await error.response.json() : null;
            
            // Handle rate limiting
            if (error.status === 429 || errorData?.code === 'RATE_LIMIT_EXCEEDED') {
                const retryAfter = error.headers?.get('Retry-After') || errorData?.retryAfter || 60;
                this.chatUI.addErrorMessage({
                    error: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter
                });
                return;
            }

            // Attempt retry with exponential backoff for certain errors
            if (this.shouldRetry(error) && this.retryCount < this.maxRetries) {
                this.retryCount++;
                this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetryDelay);
                
                this.chatUI.addErrorMessage({
                    error: `Request failed. Retrying in ${this.retryDelay/1000} seconds... (Attempt ${this.retryCount}/${this.maxRetries})`,
                    code: errorData?.code || 'NETWORK_ERROR',
                    requestId: errorData?.requestId,
                    timestamp: errorData?.timestamp
                });
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.handleSubmit(question);
            }

            // Show appropriate error message
            const errorResponse = {
                error: errorData?.error || this.getErrorMessage(error),
                code: errorData?.code || error.code || 'INTERNAL_ERROR',
                requestId: errorData?.requestId,
                timestamp: errorData?.timestamp || new Date().toISOString()
            };

            // Display error in chat and form
            this.chatUI.addErrorMessage(errorResponse);
            this.form.classList.add('error');
            this.errorMessage.textContent = errorResponse.error;

            // Log detailed error for debugging
            console.error('Request Failed:', {
                error: errorResponse,
                originalError: error,
                requestDetails: {
                    question,
                    retryCount: this.retryCount,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (parseError) {
            // Handle error parsing failure
            console.error('Error parsing error response:', parseError);
            this.chatUI.addErrorMessage({
                error: 'An unexpected error occurred. Please try again.',
                code: 'INTERNAL_ERROR',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Determine if an error should trigger a retry
     * @param {Error} error - The error to check
     * @returns {boolean} Whether to retry
     */
    shouldRetry(error) {
        // Retry on network errors or 5xx server errors
        return !error.response || (error.response && error.response.status >= 500);
    }

    /**
     * Get user-friendly error message
     * @param {Error} error - The error to get message for
     * @returns {string} User-friendly error message
     */
    getErrorMessage(error) {
        // Handle timeout errors
        if (error.name === 'AbortError') {
            return 'Request timed out. Please try again.';
        }

        // If we have an error code from the server, use it to get the message
        if (error.response?.data?.code) {
            switch (error.response.data.code) {
                // Server errors
                case 'INTERNAL_ERROR':
                    return 'An unexpected error occurred. Please try again later.';
                case 'DATABASE_ERROR':
                    return 'A database error occurred. Please try again later.';
                case 'API_ERROR':
                    return 'An API error occurred. Please try again later.';
                case 'SERVICE_UNAVAILABLE':
                    return 'The service is temporarily unavailable.';
                case 'CONFIG_ERROR':
                    return 'Configuration error. Please contact support.';
                
                // Client errors
                case 'BAD_REQUEST':
                    return 'The request could not be processed.';
                case 'UNAUTHORIZED':
                    return 'Please log in to continue.';
                case 'FORBIDDEN':
                    return 'You do not have permission to perform this action.';
                case 'NOT_FOUND':
                    return 'The requested resource was not found.';
                case 'VALIDATION_ERROR':
                    return 'The provided data is invalid.';
                case 'RATE_LIMIT_EXCEEDED':
                    return 'Too many requests. Please try again later.';
                
                // Network/Communication errors
                case 'NETWORK_ERROR':
                    return 'A network error occurred. Please check your connection.';
                case 'TIMEOUT':
                    return 'The request timed out. Please try again.';
                
                // Authentication/Authorization errors
                case 'AUTH_ERROR':
                    return 'Authentication failed.';
                case 'TOKEN_EXPIRED':
                    return 'Your session has expired. Please log in again.';
                case 'INVALID_TOKEN':
                    return 'Invalid authentication token.';
                
                // Input/Validation errors
                case 'INVALID_INPUT':
                    return 'The provided input is invalid.';
                case 'MISSING_FIELD':
                    return 'Required field is missing.';
                case 'INVALID_FORMAT':
                    return 'Invalid data format.';
                
                // OpenAI specific errors
                case 'OPENAI_API_ERROR':
                    return 'Error communicating with AI service.';
                case 'OPENAI_RATE_LIMIT':
                    return 'AI service rate limit exceeded.';
                case 'OPENAI_CONTEXT_LENGTH':
                    return 'Input exceeds maximum length.';
                
                // Session/State errors
                case 'SESSION_ERROR':
                    return 'Session error. Please try logging in again.';
                case 'SESSION_EXPIRED':
                    return 'Your session has expired. Please refresh.';
                case 'SESSION_INVALID':
                    return 'Invalid session. Please refresh.';
                case 'SESSION_REQUIRED':
                    return 'Session required. Please refresh.';
                
                default:
                    return 'An unexpected error occurred. Please try again.';
            }
        }

        // Fallback to HTTP status codes if no error code is provided
        switch (error.status) {
            case 400:
                return 'Invalid request. Please check your input.';
            case 401:
                return 'Session expired. Please refresh the page.';
            case 403:
                return 'Access denied. Please check your permissions.';
            case 404:
                return 'Service not found. Please try again later.';
            case 429:
                return 'Too many requests. Please wait a moment.';
            case 500:
                return 'Server error. Please try again later.';
            default:
                return 'An unexpected error occurred. Please try again.';
        }
    }

    /**
     * Set form processing state
     * Updates UI elements to reflect processing state
     * @param {boolean} processing - Whether form is processing
     */
    setProcessingState(processing) {
        this.isProcessing = processing;
        this.inputContainer.classList.toggle('loading', processing);
        this.input.disabled = processing;
        this.submitButton.disabled = processing;
        
        if (!processing) {
            this.clearInput();
            this.input.focus();
        }
    }

    /**
     * Validate input for security and constraints
     * @param {string} input - Input to validate
     * @param {boolean} showError - Whether to show error messages
     * @returns {boolean} Whether input is valid
     */
    validateInput(input, showError = true) {
        if (!input || typeof input !== 'string') {
            if (showError) this.showError('Please enter a valid message.');
            return false;
        }

        if (input.length === 0) {
            if (showError) this.showError('Message cannot be empty.');
            return false;
        }

        if (input.length > 500) {
            if (showError) this.showError('Message is too long (maximum 500 characters).');
            return false;
        }

        // Security checks for potentially harmful content
        const suspiciousPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /data:/gi,
            /on\w+=/gi
        ];

        if (suspiciousPatterns.some(pattern => pattern.test(input))) {
            if (showError) this.showError('Invalid input detected.');
            return false;
        }

        this.hideError();
        return true;
    }

    /**
     * Sanitize input text
     * @param {string} input - Text to sanitize
     * @returns {string} Sanitized text
     */
    sanitizeInput(input) {
        return input
            .trim()
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
            .replace(/\s+/g, ' '); // Normalize whitespace
    }

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.form.classList.add('error');
        this.errorMessage.textContent = message;
        this.errorMessage.setAttribute('aria-hidden', 'false');
    }

    /**
     * Hide error message
     */
    hideError() {
        this.form.classList.remove('error');
        this.errorMessage.textContent = '';
        this.errorMessage.setAttribute('aria-hidden', 'true');
    }

    /**
     * Clear input and reset form state
     */
    clearInput() {
        this.input.value = '';
        this.adjustTextareaHeight();
        this.hideError();
        this.updateValidationUI('');
    }

    /**
     * Handle input changes
     * Updates textarea height and validation state
     */
    handleInputChange() {
        this.adjustTextareaHeight();
        if (!this.isProcessing) {
            const value = this.input.value.trim();
            this.updateValidationUI(value);
            this.form.classList.remove('error');
        }
    }

    /**
     * Adjust textarea height based on content
     * Ensures textarea grows with content up to max height
     */
    adjustTextareaHeight() {
        if (!this.input) return;
        
        const maxHeight = 200;
        const computedStyle = window.getComputedStyle(this.input);
        const lineHeight = parseInt(computedStyle.lineHeight);
        
        this.input.style.height = 'auto';
        const newHeight = Math.min(this.input.scrollHeight, maxHeight);
        this.input.style.height = newHeight + 'px';
        
        // Ensure minimum height of one line
        if (newHeight < lineHeight) {
            this.input.style.height = lineHeight + 'px';
        }

        // Update scroll status
        this.input.classList.toggle('scrollable', this.input.scrollHeight > maxHeight);
    }
}

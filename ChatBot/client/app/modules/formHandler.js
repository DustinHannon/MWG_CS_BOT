// Form handling module for managing user input and form submission
export class FormHandler {
    constructor(chatUI) {
        this.chatUI = chatUI;
        this.isProcessing = false;
        this.form = document.getElementById('prompt-form');
        this.input = document.getElementById('prompt-input');
        this.submitButton = this.form.querySelector('button[type="submit"]');
        this.inputContainer = this.form.querySelector('.input-container');
        this.errorMessage = this.form.querySelector('.error-message');
        this.rateLimitInfo = document.createElement('div');
        this.rateLimitInfo.className = 'rate-limit-info';
        this.inputContainer.appendChild(this.rateLimitInfo);
        
        this.offlineQueue = [];
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.setupEventListeners();
        this.setupOfflineSupport();
    }

    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.isProcessing) {
                const sanitizedInput = this.input.value.trim();
                if (this.validateInput(sanitizedInput)) {
                    await this.handleSubmit(sanitizedInput);
                } else {
                    this.chatUI.addErrorMessage('Invalid input detected. Please try again.');
                }
            }
        });

        // Input changes
        this.input.addEventListener('input', () => {
            this.adjustTextareaHeight();
            if (!this.isProcessing) {
                this.submitButton.disabled = !this.input.value.trim();
                this.form.classList.remove('error');
            }
            this.updateCharacterCount();
        });

        // Keyboard shortcuts
        this.input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const sanitizedInput = this.input.value.trim();
                if (sanitizedInput && !this.isProcessing && this.validateInput(sanitizedInput)) {
                    await this.handleSubmit(sanitizedInput);
                }
            }
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !this.input.matches(':focus')) {
                e.preventDefault();
                this.input.focus();
            }
        });
    }

    setupOfflineSupport() {
        window.addEventListener('online', () => {
            this.processOfflineQueue();
        });

        window.addEventListener('offline', () => {
            this.chatUI.addErrorMessage('You are currently offline. Messages will be sent when connection is restored.');
        });
    }

    async processOfflineQueue() {
        if (this.offlineQueue.length > 0) {
            this.chatUI.addBotResponse('Connection restored. Processing queued messages...');
            
            while (this.offlineQueue.length > 0) {
                const question = this.offlineQueue.shift();
                await this.handleSubmit(question, true);
            }
        }
    }

    updateCharacterCount() {
        const charCount = this.input.value.length;
        const maxChars = 2000;
        const charCountElement = document.querySelector('.char-count');
        
        if (!charCountElement) {
            const counter = document.createElement('div');
            counter.className = 'char-count';
            this.inputContainer.appendChild(counter);
        }
        
        const counter = document.querySelector('.char-count');
        counter.textContent = `${charCount}/${maxChars}`;
        counter.style.color = charCount > maxChars ? 'red' : 'inherit';
    }

    async handleSubmit(question, isRetry = false) {
        if (!question.trim() || this.isProcessing) {
            return;
        }

        if (!navigator.onLine) {
            this.offlineQueue.push(question);
            this.chatUI.addUserMessage(question);
            this.chatUI.addErrorMessage('Message queued for sending when online');
            this.setProcessingState(false);
            return;
        }

        try {
            this.setProcessingState(true);
            this.chatUI.addUserMessage(question);
            this.chatUI.showTypingIndicator();

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // Handle rate limiting
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After') || 60;
                    this.updateRateLimitInfo(retryAfter);
                    throw new Error('Rate limit reached. Please wait before sending another message.');
                }
                
                throw new Error(
                    errorData.error || 
                    'An error occurred while processing your request.'
                );
            }

            const { data } = await response.json();
            if (!data || typeof data !== 'string') {
                throw new Error('Invalid response format');
            }
            
            this.chatUI.removeTypingIndicator();
            this.chatUI.addBotResponse(data);
            this.retryAttempts = 0; // Reset retry attempts on success
            
        } catch (error) {
            console.error('Error:', error);
            this.chatUI.removeTypingIndicator();
            
            if (error.name === 'AbortError') {
                this.chatUI.addErrorMessage('Request timed out. Please try again.');
            } else if (!isRetry && this.retryAttempts < this.maxRetries) {
                this.retryAttempts++;
                this.chatUI.addErrorMessage(`Retrying... Attempt ${this.retryAttempts} of ${this.maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * this.retryAttempts));
                await this.handleSubmit(question, true);
                return;
            } else {
                this.chatUI.addErrorMessage(error.message);
                this.form.classList.add('error');
                this.errorMessage.textContent = error.message;
            }
        } finally {
            if (!isRetry) {
                this.setProcessingState(false);
            }
        }
    }

    updateRateLimitInfo(retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        let remainingTime = seconds;
        
        const updateTimer = () => {
            if (remainingTime <= 0) {
                this.rateLimitInfo.textContent = '';
                return;
            }
            
            this.rateLimitInfo.textContent = `Rate limit reached. Please wait ${remainingTime} seconds.`;
            remainingTime--;
            setTimeout(updateTimer, 1000);
        };
        
        updateTimer();
    }

    setProcessingState(processing) {
        this.isProcessing = processing;
        this.inputContainer.classList.toggle('loading', processing);
        this.input.disabled = processing;
        this.submitButton.disabled = processing;
        
        if (!processing) {
            this.input.value = '';
            this.adjustTextareaHeight();
            this.input.focus();
            this.submitButton.disabled = !this.input.value.trim();
            this.updateCharacterCount();
        }
    }

    validateInput(input) {
        if (!input || typeof input !== 'string') {
            return false;
        }
        if (input.length > 2000) {
            return false;
        }
        const suspiciousPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /data:/gi,
            /vbscript:/gi,
            /on\w+=/gi,
            /style\s*=\s*"[^"]*expression\s*\(/gi
        ];
        return !suspiciousPatterns.some(pattern => pattern.test(input));
    }

    adjustTextareaHeight() {
        if (!this.input) return;
        
        const maxHeight = 200;
        const computedStyle = window.getComputedStyle(this.input);
        const lineHeight = parseInt(computedStyle.lineHeight);
        
        this.input.style.height = 'auto';
        const newHeight = Math.min(this.input.scrollHeight, maxHeight);
        this.input.style.height = newHeight + 'px';
        
        // Ensure minimum height of 3 lines
        const minHeight = lineHeight * 3;
        if (newHeight < minHeight) {
            this.input.style.height = minHeight + 'px';
        }
    }
}

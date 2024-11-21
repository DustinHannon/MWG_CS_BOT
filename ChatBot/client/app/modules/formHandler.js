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
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!this.isProcessing) {
                const sanitizedInput = this.input.value.trim();
                if (this.validateInput(sanitizedInput)) {
                    this.handleSubmit(sanitizedInput);
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
        });

        // Keyboard shortcuts
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const sanitizedInput = this.input.value.trim();
                if (sanitizedInput && !this.isProcessing && this.validateInput(sanitizedInput)) {
                    this.handleSubmit(sanitizedInput);
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

    async handleSubmit(question) {
        if (!question.trim() || this.isProcessing) {
            return;
        }

        try {
            this.setProcessingState(true);
            this.chatUI.addUserMessage(question);

            const response = await fetch('/api/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question }),
                credentials: 'same-origin'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.error || 
                    (response.status === 429 
                        ? 'Please wait a moment before sending another message.' 
                        : 'An error occurred while processing your request.')
                );
            }

            const { data } = await response.json();
            if (!data || typeof data !== 'string') {
                throw new Error('Invalid response format');
            }
            
            this.chatUI.addBotResponse(data);
        } catch (error) {
            console.error('Error:', error);
            this.chatUI.addErrorMessage(error.message);
            this.form.classList.add('error');
            this.errorMessage.textContent = error.message;
        } finally {
            this.setProcessingState(false);
        }
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

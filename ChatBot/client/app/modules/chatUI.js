/**
 * Chat UI Module (chatUI.js)
 * 
 * This module handles all UI-related functionality for the chat interface, including:
 * - Message rendering and formatting
 * - Message animations and transitions
 * - Message queuing and processing
 * - Typing indicators
 * - Scroll management
 * - Copy functionality
 * - Accessibility features
 * 
 * The module uses a queue-based system to ensure messages are displayed in order
 * and with smooth animations. It also includes extensive accessibility support
 * through ARIA attributes and semantic HTML.
 * 
 * Related files:
 * - ../index.js: Main application entry point
 * - formHandler.js: Handles user input
 * - ../../styles.css: Styling for chat components
 */

export class ChatUI {
    /**
     * Initialize the chat UI
     * Sets up DOM references and initializes the message queue system
     * @throws {Error} If required DOM elements are not found
     */
    constructor() {
        // Core DOM elements with validation
        this.dialogue = document.getElementById('dialogue');
        this.chatContainer = document.getElementById('chat-container');

        // Validate required DOM elements
        if (!this.dialogue || !this.chatContainer) {
            throw new Error('Required chat UI elements not found. Please check the HTML structure.');
        }
        
        // Message handling state
        this.messageQueue = [];      // Queue for pending messages
        this.isProcessing = false;   // Flag for message processing
        this.typingTimeout = null;   // Timeout for typing indicator
        this.scrollTimeout = null;   // Timeout for scroll management
    }

    /**
     * Add a user message to the chat
     * @param {string} question - The user's message text
     */
    async addUserMessage(question) {
        try {
            if (!this.dialogue) {
                throw new Error('Chat dialogue container not found');
            }
            const messageElement = this.createMessageElement('user-message', question);
            await this.addMessageToDialogue(messageElement);
        } catch (error) {
            console.error('Failed to add user message:', error);
            this.handleUIError(error);
        }
    }

    /**
     * Add a bot response to the chat
     * @param {string} response - The bot's response text
     */
    async addBotResponse(response) {
        try {
            if (!this.dialogue) {
                throw new Error('Chat dialogue container not found');
            }
            const messageElement = this.createMessageElement('bot-message', response);
            await this.addMessageToDialogue(messageElement);
        } catch (error) {
            console.error('Failed to add bot response:', error);
            this.handleUIError(error);
        }
    }

    /**
     * Add an error message to the chat
     * @param {string} errorMessage - The error message to display
     */
    async addErrorMessage(errorMessage) {
        try {
            if (!this.dialogue) {
                throw new Error('Chat dialogue container not found');
            }
            const messageElement = this.createMessageElement('bot-message error', errorMessage);
            messageElement.setAttribute('role', 'alert');
            await this.addMessageToDialogue(messageElement);
        } catch (error) {
            console.error('Failed to add error message:', error);
            // Fallback error display if chat UI fails
            this.handleUIError(error);
        }
    }

    /**
     * Handle UI-related errors
     * @param {Error} error - The error to handle
     */
    handleUIError(error) {
        // Create a fallback error display
        const errorContainer = document.createElement('div');
        errorContainer.className = 'chat-error-fallback';
        errorContainer.setAttribute('role', 'alert');
        errorContainer.textContent = 'Chat interface error. Please refresh the page.';
        
        // Try to add to chat container, fallback to body
        const container = this.chatContainer || document.body;
        container.appendChild(errorContainer);

        // Remove after 5 seconds
        setTimeout(() => {
            errorContainer.remove();
        }, 5000);
    }

    /**
     * Create a new message element with proper formatting and accessibility
     * @param {string} className - CSS class for the message
     * @param {string} content - Message content
     * @returns {HTMLElement} The created message element
     */
    createMessageElement(className, content) {
        const messageItem = document.createElement('li');
        messageItem.className = className;
        messageItem.setAttribute('role', 'listitem');
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        try {
            // Format message content with links and markdown
            const formattedContent = this.formatMessageContent(content);
            messageContent.innerHTML = formattedContent;

            // Add timestamp to message
            const timestamp = document.createElement('div');
            timestamp.className = 'message-timestamp';
            timestamp.textContent = this.formatTimestamp(new Date());
            
            messageItem.appendChild(messageContent);
            messageItem.appendChild(timestamp);

            // Add copy button for bot messages
            if (className.includes('bot-message')) {
                const copyButton = this.createCopyButton(formattedContent);
                messageItem.appendChild(copyButton);
            }
        } catch (error) {
            console.error('Failed to create message element:', error);
            messageContent.textContent = content; // Fallback to plain text
            messageItem.appendChild(messageContent);
        }

        return messageItem;
    }

    /**
     * Format message content with links and markdown-style formatting
     * @param {string} content - Raw message content
     * @returns {string} Formatted HTML content
     */
    formatMessageContent(content) {
        if (!content || typeof content !== 'string') {
            return 'Invalid message content';
        }

        return content
            .split('\n')
            .map(line => {
                try {
                    // Convert URLs to clickable links
                    line = line.replace(
                        /(https?:\/\/[^\s]+)/g,
                        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
                    );

                    // Format code blocks
                    line = line.replace(
                        /`([^`]+)`/g,
                        '<code>$1</code>'
                    );

                    // Format bold text
                    line = line.replace(
                        /\*\*([^*]+)\*\*/g,
                        '<strong>$1</strong>'
                    );

                    // Format italic text
                    line = line.replace(
                        /\*([^*]+)\*/g,
                        '<em>$1</em>'
                    );

                    return line;
                } catch (error) {
                    console.error('Failed to format line:', error);
                    return line; // Return unformatted line on error
                }
            })
            .join('<br>');
    }

    /**
     * Create a copy button for message content
     * @param {string} content - Content to copy
     * @returns {HTMLButtonElement} Copy button element
     */
    createCopyButton(content) {
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.setAttribute('aria-label', 'Copy message');
        button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';

        button.addEventListener('click', async () => {
            try {
                // Strip HTML tags for clipboard
                const textContent = content.replace(/<[^>]+>/g, '');
                await navigator.clipboard.writeText(textContent);
                
                // Show success feedback
                button.classList.add('copied');
                button.setAttribute('aria-label', 'Copied!');
                
                setTimeout(() => {
                    button.classList.remove('copied');
                    button.setAttribute('aria-label', 'Copy message');
                }, 2000);
            } catch (error) {
                console.error('Failed to copy message:', error);
                button.classList.add('error');
                button.setAttribute('aria-label', 'Failed to copy');
                
                setTimeout(() => {
                    button.classList.remove('error');
                    button.setAttribute('aria-label', 'Copy message');
                }, 2000);
            }
        });

        return button;
    }

    /**
     * Format timestamp for messages
     * @param {Date} date - Date to format
     * @returns {string} Formatted timestamp
     */
    formatTimestamp(date) {
        try {
            // Use 24-hour format for more compact display
            return new Intl.DateTimeFormat('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(date);
        } catch (error) {
            console.error('Failed to format timestamp:', error);
            return ''; // Return empty string on error
        }
    }

    /**
     * Add a message to the dialogue queue
     * @param {HTMLElement} messageElement - Message element to add
     */
    async addMessageToDialogue(messageElement) {
        if (!this.dialogue) {
            throw new Error('Chat dialogue container not found');
        }

        // Add message to queue
        this.messageQueue.push(messageElement);
        
        // Process queue if not already processing
        if (!this.isProcessing) {
            await this.processMessageQueue();
        }
    }

    /**
     * Process messages in the queue
     * Ensures messages are added sequentially without animations
     */
    async processMessageQueue() {
        if (!this.dialogue) {
            throw new Error('Chat dialogue container not found');
        }

        if (this.messageQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const messageElement = this.messageQueue.shift();

        try {
            // Add message to dialogue immediately without animation
            this.dialogue.appendChild(messageElement);

            // Scroll into view
            this.scrollToBottom();

            // Process next message
            await this.processMessageQueue();
        } catch (error) {
            console.error('Failed to process message:', error);
            this.isProcessing = false;
            this.handleUIError(error);
        }
    }

    /**
     * No animation for immediate visibility
     * @param {HTMLElement} element - Element to add
     * @returns {Promise<void>}
     */
    async animateMessage(element) {
        return Promise.resolve();
    }

    /**
     * Show typing indicator while bot is "typing"
     */
    showTypingIndicator() {
        if (!this.dialogue) return;

        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        try {
            const typingIndicator = document.createElement('li');
            typingIndicator.className = 'bot-message typing-indicator';
            typingIndicator.id = 'typing-indicator';
            typingIndicator.setAttribute('aria-label', 'Bot is typing');
            
            const dots = document.createElement('div');
            dots.className = 'typing-dots';
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('span');
                dot.setAttribute('aria-hidden', 'true');
                dots.appendChild(dot);
            }
            
            typingIndicator.appendChild(dots);
            this.dialogue.appendChild(typingIndicator);
            this.scrollToBottom();

            // Remove typing indicator after 30 seconds (failsafe)
            this.typingTimeout = setTimeout(() => {
                this.removeTypingIndicator();
            }, 30000);
        } catch (error) {
            console.error('Failed to show typing indicator:', error);
        }
    }

    /**
     * Remove typing indicator
     */
    removeTypingIndicator() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }

        try {
            const typingIndicator = document.getElementById('typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
        } catch (error) {
            console.error('Failed to remove typing indicator:', error);
        }
    }

    /**
     * Scroll chat to bottom smoothly
     */
    scrollToBottom() {
        if (!this.chatContainer) return;

        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        this.scrollTimeout = setTimeout(() => {
            try {
                const scrollOptions = {
                    top: this.chatContainer.scrollHeight,
                    behavior: 'smooth'
                };

                // Check if browser supports smooth scrolling
                try {
                    this.chatContainer.scrollTo(scrollOptions);
                } catch (error) {
                    // Fallback for browsers that don't support smooth scrolling
                    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
                }
            } catch (error) {
                console.error('Failed to scroll:', error);
            }
        }, 100); // Small delay to ensure content is rendered
    }

    /**
     * Clear all messages from the chat
     */
    clearMessages() {
        if (!this.dialogue) return;

        try {
            while (this.dialogue.firstChild) {
                this.dialogue.removeChild(this.dialogue.firstChild);
            }
            this.messageQueue = [];
            this.isProcessing = false;
        } catch (error) {
            console.error('Failed to clear messages:', error);
        }
    }

    /**
     * Get all messages for export or storage
     * @returns {Array<Object>} Array of message objects
     */
    getMessages() {
        if (!this.dialogue) return [];

        const messages = [];
        try {
            this.dialogue.querySelectorAll('li').forEach(li => {
                const contentElement = li.querySelector('.message-content');
                const timestampElement = li.querySelector('.message-timestamp');
                
                if (contentElement) {
                    messages.push({
                        type: li.classList.contains('user-message') ? 'user' : 'bot',
                        content: contentElement.textContent || '',
                        timestamp: timestampElement ? timestampElement.textContent : ''
                    });
                }
            });
        } catch (error) {
            console.error('Failed to get messages:', error);
        }
        return messages;
    }
}

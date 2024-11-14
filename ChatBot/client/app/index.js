// State management
let isProcessing = false;

// Sanitize text to prevent XSS
function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Enhanced URL validation and formatting
function formatUrl(url, punctuation = '') {
    try {
        const urlObj = new URL(url);
        // Allow all valid URLs but add security attributes
        return `<a href="${url}" 
            target="_blank" 
            rel="noopener noreferrer nofollow"
            class="external-link"
            aria-label="Opens in new tab: ${urlObj.hostname}">${url}</a>${punctuation}`;
    } catch {
        return url + punctuation;
    }
}

// Convert markdown-like syntax to HTML with enhanced formatting
function formatResponse(text) {
    // First escape any HTML tags in the original text
    let sanitizedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Convert URLs to clickable links with improved regex
    const urlRegex = /(?:https?:\/\/(?:www\.)?)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    sanitizedText = sanitizedText.replace(urlRegex, (url) => {
        const match = url.match(/(.*?)([.,!?])?$/);
        if (!match) return url;
        return formatUrl(match[1], match[2] || '');
    });
    
    // Format headings with proper hierarchy
    sanitizedText = sanitizedText.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    sanitizedText = sanitizedText.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    sanitizedText = sanitizedText.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    
    // Format nested lists
    const listRegex = /^( *)([-*+]|\d+\.) (.*?)$/gm;
    const lines = sanitizedText.split('\n');
    let inList = false;
    let currentLevel = 0;
    let listType = '';
    
    sanitizedText = lines.map((line, index) => {
        const listMatch = line.match(listRegex);
        if (listMatch) {
            const [, indent, marker, content] = listMatch;
            const level = indent.length;
            const isOrdered = /^\d+\./.test(marker);
            const listClass = isOrdered ? 'numbered-item' : 'bullet-point';
            
            if (!inList) {
                inList = true;
                currentLevel = level;
                listType = isOrdered ? 'ol' : 'ul';
                return `<${listType} class="formatted-list level-${level}"><li class="${listClass}">${content}</li>`;
            }
            
            if (level > currentLevel) {
                currentLevel = level;
                listType = isOrdered ? 'ol' : 'ul';
                return `<${listType} class="formatted-list level-${level}"><li class="${listClass}">${content}</li>`;
            }
            
            if (level < currentLevel) {
                const closeTags = '</li></' + listType + '>'.repeat((currentLevel - level) / 2);
                currentLevel = level;
                return `${closeTags}<li class="${listClass}">${content}`;
            }
            
            return `</li><li class="${listClass}">${content}`;
        }
        
        if (inList) {
            inList = false;
            return `</li></${listType}>${line}`;
        }
        
        return line;
    }).join('\n');
    
    // Format tables
    const tableRegex = /^\|(.+)\|$/gm;
    const headerSeparatorRegex = /^\|(?:[-:]+\|)+$/gm;
    let inTable = false;
    
    lines.forEach((line, index) => {
        if (tableRegex.test(line)) {
            if (index + 1 < lines.length && headerSeparatorRegex.test(lines[index + 1])) {
                // Table header
                const cells = line.split('|').slice(1, -1);
                sanitizedText = sanitizedText.replace(line, 
                    `<table class="formatted-table"><thead><tr>${
                        cells.map(cell => `<th>${cell.trim()}</th>`).join('')
                    }</tr></thead><tbody>`);
                inTable = true;
            } else if (inTable) {
                // Table row
                const cells = line.split('|').slice(1, -1);
                sanitizedText = sanitizedText.replace(line,
                    `<tr>${
                        cells.map(cell => `<td>${cell.trim()}</td>`).join('')
                    }</tr>`);
            }
        } else if (inTable) {
            sanitizedText = sanitizedText.replace(line, '</tbody></table>' + line);
            inTable = false;
        }
    });
    
    // Format code blocks with syntax highlighting placeholder
    sanitizedText = sanitizedText.replace(/\`\`\`(\w+)?\n(.*?)\`\`\`/gs, (match, lang, code) => {
        return `<pre><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>`;
    });
    
    // Format inline code
    sanitizedText = sanitizedText.replace(/\`(.*?)\`/g, '<code class="inline-code">$1</code>');
    
    // Format bold text
    sanitizedText = sanitizedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Format italic text
    sanitizedText = sanitizedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Format paragraphs with proper spacing
    sanitizedText = sanitizedText.replace(/\n\n(.*?)(?=\n\n|$)/g, '<p>$1</p>');
    
    // Handle single newlines within paragraphs
    sanitizedText = sanitizedText.replace(/([^\n])\n([^\n])/g, '$1<br>$2');
    
    return sanitizedText;
}

// Validate input with enhanced security
function validateInput(input) {
    if (!input || typeof input !== 'string') {
        return false;
    }
    if (input.length > 2000) { // Increased limit for longer messages
        return false;
    }
    // Check for suspicious patterns
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

// Handle form submission
async function handleSubmitQuestion(question) {
    if (!question.trim() || isProcessing) {
        return;
    }

    // Validate input before processing
    if (!validateInput(question)) {
        addErrorMessageToDialogueBox('Invalid input detected. Please try again.');
        return;
    }

    const form = document.getElementById('prompt-form');
    const input = document.getElementById('prompt-input');
    const submitButton = form.querySelector('button[type="submit"]');
    const inputContainer = form.querySelector('.input-container');
    const errorMessage = form.querySelector('.error-message');

    try {
        // Set processing state
        isProcessing = true;
        inputContainer.classList.add('loading');
        input.disabled = true;
        submitButton.disabled = true;
        errorMessage.style.display = 'none';

        addUserQuestionToDialogueBox(question);

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
        addBotResponseToDialogueBox(data);
    } catch (error) {
        console.error('Error:', error);
        addErrorMessageToDialogueBox(error.message);
        form.classList.add('error');
        errorMessage.textContent = sanitizeText(error.message);
    } finally {
        // Reset processing state
        isProcessing = false;
        inputContainer.classList.remove('loading');
        input.disabled = false;
        input.focus();
        submitButton.disabled = !input.value.trim();
    }
}

// Add user message to chat with enhanced accessibility
function addUserQuestionToDialogueBox(question) {
    const userQuestion = document.createElement('li');
    userQuestion.className = 'user-message';
    userQuestion.setAttribute('role', 'article');
    userQuestion.setAttribute('aria-label', 'User message');
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = question;
    
    userQuestion.appendChild(messageContent);
    document.getElementById('dialogue').appendChild(userQuestion);
    
    const input = document.getElementById('prompt-input');
    input.value = '';
    adjustTextareaHeight(input);
    
    scrollToBottom();
}

// Add bot response to chat with enhanced formatting and accessibility
function addBotResponseToDialogueBox(response) {
    const botResponse = document.createElement('li');
    botResponse.className = 'bot-message';
    botResponse.setAttribute('role', 'article');
    botResponse.setAttribute('aria-label', 'Assistant response');
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content formatted-content';
    
    const formattedContent = formatResponse(response);
    messageContent.innerHTML = formattedContent;
    
    // Add semantic structure for screen readers
    const sections = messageContent.querySelectorAll('h1, h2, h3');
    sections.forEach(section => {
        section.setAttribute('role', 'heading');
        section.setAttribute('aria-level', section.tagName[1]);
    });
    
    // Make lists more accessible
    const lists = messageContent.querySelectorAll('ul, ol');
    lists.forEach(list => {
        list.setAttribute('role', 'list');
    });
    
    botResponse.appendChild(messageContent);
    document.getElementById('dialogue').appendChild(botResponse);
    
    // Initialize syntax highlighting if available
    if (window.Prism) {
        messageContent.querySelectorAll('pre code').forEach((block) => {
            Prism.highlightElement(block);
        });
    }
    
    scrollToBottom();
}

// Add error message to chat with enhanced accessibility
function addErrorMessageToDialogueBox(errorMessage = 'An error occurred. Please try again.') {
    const errorElement = document.createElement('li');
    errorElement.className = 'bot-message error';
    errorElement.setAttribute('role', 'alert');
    errorElement.setAttribute('aria-live', 'assertive');
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = errorMessage;
    
    errorElement.appendChild(messageContent);
    document.getElementById('dialogue').appendChild(errorElement);
    scrollToBottom();
}

// Auto-adjust textarea height with improved handling
function adjustTextareaHeight(textarea) {
    if (!textarea) return;
    
    const maxHeight = 200;
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseInt(computedStyle.lineHeight);
    
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';
    
    // Ensure minimum height of 3 lines
    const minHeight = lineHeight * 3;
    if (newHeight < minHeight) {
        textarea.style.height = minHeight + 'px';
    }
}

// Smooth scroll chat to bottom
function scrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    }
}

// Update dark mode button text with accessibility
function updateDarkModeButtonText(isDarkMode) {
    const button = document.getElementById('toggle-dark-mode');
    if (button) {
        const buttonText = button.querySelector('span');
        if (buttonText) {
            const newText = isDarkMode ? 'Light Mode' : 'Dark Mode';
            buttonText.textContent = newText;
            button.setAttribute('aria-label', `Switch to ${newText}`);
        }
    }
}

// Toggle dark mode with enhanced accessibility
function toggleDarkMode() {
    try {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDarkMode.toString());
        updateDarkModeButtonText(isDarkMode);
        
        // Announce mode change to screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = `Switched to ${isDarkMode ? 'dark' : 'light'} mode`;
        document.body.appendChild(announcement);
        setTimeout(() => announcement.remove(), 1000);
    } catch (error) {
        console.error('Error toggling dark mode:', error);
    }
}

// Initialize with enhanced features
window.onload = () => {
    try {
        const form = document.getElementById('prompt-form');
        const input = document.getElementById('prompt-input');
        const submitButton = form.querySelector('button[type="submit"]');

        if (form && input && submitButton) {
            // Set up form submission
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!isProcessing) {
                    const sanitizedInput = input.value.trim();
                    if (validateInput(sanitizedInput)) {
                        handleSubmitQuestion(sanitizedInput);
                    } else {
                        addErrorMessageToDialogueBox('Invalid input detected. Please try again.');
                    }
                }
            });

            // Handle input changes
            input.addEventListener('input', () => {
                adjustTextareaHeight(input);
                if (!isProcessing) {
                    submitButton.disabled = !input.value.trim();
                    form.classList.remove('error');
                }
            });

            // Handle keyboard shortcuts
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const sanitizedInput = input.value.trim();
                    if (sanitizedInput && !isProcessing && validateInput(sanitizedInput)) {
                        handleSubmitQuestion(sanitizedInput);
                    }
                }
            });

            // Set up dark mode
            const darkModeToggle = document.getElementById('toggle-dark-mode');
            if (darkModeToggle) {
                darkModeToggle.addEventListener('click', toggleDarkMode);
                darkModeToggle.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleDarkMode();
                    }
                });
            }

            // Load saved dark mode preference
            try {
                const savedDarkMode = localStorage.getItem('darkMode');
                if (savedDarkMode === 'true') {
                    document.body.classList.add('dark-mode');
                    updateDarkModeButtonText(true);
                }
            } catch (error) {
                console.error('Error loading dark mode preference:', error);
            }

            // Initial setup
            adjustTextareaHeight(input);
            submitButton.disabled = true;
            
            // Add keyboard navigation support
            document.addEventListener('keydown', (e) => {
                if (e.key === '/' && !input.matches(':focus')) {
                    e.preventDefault();
                    input.focus();
                }
            });
        }
    } catch (error) {
        console.error('Error during initialization:', error);
    }
};

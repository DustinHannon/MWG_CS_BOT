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
    if (!text || typeof text !== 'string') {
        return 'An error occurred while formatting the response.';
    }

    // Instead of escaping all HTML, we'll only escape specific characters
    // that could be dangerous while preserving valid HTML tags
    let sanitizedText = text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    
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
    
    // Format lists safely
    const lines = sanitizedText.split('\n').map(line => line || ' ');
    let inList = false;
    let listType = '';
    let formattedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const bulletMatch = line.match(/^[-*] (.+)/);
        const numberMatch = line.match(/^\d+\. (.+)/);
        
        if (bulletMatch || numberMatch) {
            const content = (bulletMatch || numberMatch)[1];
            const isOrdered = !!numberMatch;
            
            if (!inList) {
                inList = true;
                listType = isOrdered ? 'ol' : 'ul';
                formattedLines.push(`<${listType} class="formatted-list">`);
            }
            
            formattedLines.push(`<li class="${isOrdered ? 'numbered-item' : 'bullet-point'}">${content}</li>`);
        } else {
            if (inList) {
                formattedLines.push(`</${listType}>`);
                inList = false;
            }
            formattedLines.push(line);
        }
    }
    
    if (inList) {
        formattedLines.push(`</${listType}>`);
    }
    
    sanitizedText = formattedLines.join('\n');
    
    // Format code blocks safely
    sanitizedText = sanitizedText.replace(/```([\s\S]*?)```/g, (match, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });
    
    // Format inline code safely
    sanitizedText = sanitizedText.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Format bold text safely
    sanitizedText = sanitizedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Format italic text safely
    sanitizedText = sanitizedText.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Format paragraphs safely
    sanitizedText = sanitizedText.split('\n\n').map(para => {
        para = para.trim();
        return para ? `<p>${para}</p>` : '';
    }).join('\n');
    
    // Handle single newlines within paragraphs
    sanitizedText = sanitizedText.replace(/([^\n])\n([^\n])/g, '$1<br>$2');
    
    return sanitizedText;
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

// Validate input with enhanced security
function validateInput(input) {
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

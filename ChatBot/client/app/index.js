// State management
let isProcessing = false;

// Sanitize text to prevent XSS
function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Convert markdown-like syntax to HTML with security measures
function formatResponse(text) {
    // First escape any HTML tags in the original text
    let sanitizedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Convert URLs to clickable links with security measures
    // Do this before other formatting to ensure links work
    const urlRegex = /(https?:\/\/[^\s]+[^\s.,!?])/g;
    sanitizedText = sanitizedText.replace(urlRegex, (url) => {
        const match = url.match(/(https?:\/\/[^\s]+)([.,!?])?/);
        if (!match) return url;
        
        const cleanUrl = match[1];
        const punctuation = match[2] || '';
        
        // Validate URL
        try {
            const urlObj = new URL(cleanUrl);
            // Only allow specific domains
            if (!['mwgdirect.com', 'mestmaker.com', 'morganwhiteintl.com', 'morganwhite.com'].includes(urlObj.hostname)) {
                return url;
            }
            return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer nofollow">${cleanUrl}</a>${punctuation}`;
        } catch {
            return url;
        }
    });
    
    // Format headings (## Heading)
    sanitizedText = sanitizedText.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    sanitizedText = sanitizedText.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    
    // Format bullet points
    sanitizedText = sanitizedText.replace(/^- (.*?)$/gm, '<li class="bullet-point">$1</li>');
    sanitizedText = sanitizedText.replace(/(<li class="bullet-point">.*?<\/li>(\n|$))+/g, '<ul class="formatted-list">$&</ul>');
    
    // Format numbered lists
    sanitizedText = sanitizedText.replace(/^\d+\. (.*?)$/gm, '<li class="numbered-item">$1</li>');
    sanitizedText = sanitizedText.replace(/(<li class="numbered-item">.*?<\/li>(\n|$))+/g, '<ol class="formatted-list">$&</ol>');
    
    // Format paragraphs (double newline)
    sanitizedText = sanitizedText.replace(/\n\n(.*?)(?=\n\n|$)/g, '<p>$1</p>');
    
    // Format bold text
    sanitizedText = sanitizedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Format italic text
    sanitizedText = sanitizedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Format code blocks
    sanitizedText = sanitizedText.replace(/\`\`\`(.*?)\`\`\`/gs, '<pre><code>$1</code></pre>');
    
    // Format inline code
    sanitizedText = sanitizedText.replace(/\`(.*?)\`/g, '<code class="inline-code">$1</code>');

    return sanitizedText;
}

// Validate input
function validateInput(input) {
    if (!input || typeof input !== 'string') {
        return false;
    }
    if (input.length > 500) {
        return false;
    }
    // Check for any suspicious patterns
    const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+=/gi
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
            credentials: 'same-origin' // Ensure cookies are sent with request
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

// Add user message to chat
function addUserQuestionToDialogueBox(question) {
    const userQuestion = document.createElement('li');
    userQuestion.className = 'user-message';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = question; // Using textContent for automatic escaping
    
    userQuestion.appendChild(messageContent);
    document.getElementById('dialogue').appendChild(userQuestion);
    
    // Reset input and adjust its height
    const input = document.getElementById('prompt-input');
    input.value = '';
    adjustTextareaHeight(input);
    
    scrollToBottom();
}

// Add bot response to chat with enhanced security and formatting
function addBotResponseToDialogueBox(response) {
    const botResponse = document.createElement('li');
    botResponse.className = 'bot-message';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content formatted-content';
    
    // Format the response with markdown-like syntax
    const formattedContent = formatResponse(response);
    messageContent.innerHTML = formattedContent;
    
    botResponse.appendChild(messageContent);
    document.getElementById('dialogue').appendChild(botResponse);
    scrollToBottom();
}

// Add error message to chat
function addErrorMessageToDialogueBox(errorMessage = 'An error occurred. Please try again.') {
    const errorElement = document.createElement('li');
    errorElement.className = 'bot-message error';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = errorMessage; // Using textContent for automatic escaping
    
    errorElement.appendChild(messageContent);
    document.getElementById('dialogue').appendChild(errorElement);
    scrollToBottom();
}

// Auto-adjust textarea height with max height limit
function adjustTextareaHeight(textarea) {
    if (!textarea) return;
    
    const maxHeight = 200;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
}

// Scroll chat to bottom safely
function scrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// Update dark mode button text safely
function updateDarkModeButtonText(isDarkMode) {
    const buttonText = document.querySelector('#toggle-dark-mode span');
    if (buttonText) {
        buttonText.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
    }
}

// Toggle dark mode with safe storage
function toggleDarkMode() {
    try {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode.toString());
        updateDarkModeButtonText(isDarkMode);
    } catch (error) {
        console.error('Error toggling dark mode:', error);
    }
}

// Initialize with enhanced security
window.onload = () => {
    try {
        // Set up form submission
        const form = document.getElementById('prompt-form');
        const input = document.getElementById('prompt-input');
        const submitButton = form.querySelector('button[type="submit"]');

        if (form && input && submitButton) {
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
            }

            // Load saved dark mode preference safely
            try {
                const savedDarkMode = localStorage.getItem('darkMode');
                if (savedDarkMode === 'true') {
                    document.body.classList.add('dark-mode');
                }
                updateDarkModeButtonText(savedDarkMode === 'true');
            } catch (error) {
                console.error('Error loading dark mode preference:', error);
            }

            // Initial textarea height
            adjustTextareaHeight(input);
            submitButton.disabled = true;
        }
    } catch (error) {
        console.error('Error during initialization:', error);
    }
};

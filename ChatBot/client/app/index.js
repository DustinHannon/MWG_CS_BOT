// State management
let isProcessing = false;

// Handle form submission
async function handleSubmitQuestion(question) {
    if (!question.trim() || isProcessing) {
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
        });

        if (!response.ok) {
            throw new Error(
                response.status === 429 
                    ? 'Please wait a moment before sending another message.' 
                    : 'Network response was not ok'
            );
        }

        const { data } = await response.json();
        addBotResponseToDialogueBox(data);
    } catch (error) {
        console.error('Error:', error);
        addErrorMessageToDialogueBox(error.message);
        form.classList.add('error');
        errorMessage.textContent = error.message;
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
    messageContent.textContent = question;
    
    userQuestion.appendChild(messageContent);
    document.getElementById('dialogue').appendChild(userQuestion);
    
    // Reset input and adjust its height
    const input = document.getElementById('prompt-input');
    input.value = '';
    adjustTextareaHeight(input);
    
    scrollToBottom();
}

// Add bot response to chat
function addBotResponseToDialogueBox(response) {
    const botResponse = document.createElement('li');
    botResponse.className = 'bot-message';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Convert URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s]+[^\s.,!?])/g;
    const formattedResponse = response.replace(urlRegex, (url) => {
        const match = url.match(/(https?:\/\/[^\s]+)([.,!?])?/);
        const cleanUrl = match[1];
        const punctuation = match[2] || '';
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${punctuation}`;
    });
    
    messageContent.innerHTML = formattedResponse.trim();
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
    messageContent.innerHTML = errorMessage;
    
    errorElement.appendChild(messageContent);
    document.getElementById('dialogue').appendChild(errorElement);
    scrollToBottom();
}

// Auto-adjust textarea height
function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// Scroll chat to bottom
function scrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Update dark mode button text
function updateDarkModeButtonText(isDarkMode) {
    const buttonText = document.querySelector('#toggle-dark-mode span');
    buttonText.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    
    // Save preference and update button text
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateDarkModeButtonText(isDarkMode);
}

// Initialize
window.onload = () => {
    // Set up form submission
    const form = document.getElementById('prompt-form');
    const input = document.getElementById('prompt-input');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!isProcessing) {
            handleSubmitQuestion(input.value);
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
            if (input.value.trim() && !isProcessing) {
                handleSubmitQuestion(input.value);
            }
        }
    });

    // Set up dark mode
    document.getElementById('toggle-dark-mode').addEventListener('click', toggleDarkMode);
    
    // Load saved dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
        document.body.classList.add('dark-mode');
    }
    // Set initial button text based on current mode
    updateDarkModeButtonText(savedDarkMode === 'true');

    // Initial textarea height
    adjustTextareaHeight(input);
    submitButton.disabled = true;
};

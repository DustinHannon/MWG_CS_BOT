// Handle form submission
async function handleSubmitQuestion(question) {
    if (!question.trim()) {
        return;
    }

    addUserQuestionToDialogueBox(question);

    try {
        const response = await fetch('/api/openai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const { data } = await response.json();
        addBotResponseToDialogueBox(data);
    } catch (error) {
        console.error('Error:', error);
        addErrorMessageToDialogueBox();
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
function addErrorMessageToDialogueBox() {
    const errorMessage = document.createElement('li');
    errorMessage.className = 'bot-message error';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = 'I apologize, but I encountered an error processing your request. Please try again.';
    
    errorMessage.appendChild(messageContent);
    document.getElementById('dialogue').appendChild(errorMessage);
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

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    
    // Save preference
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
}

// Initialize
window.onload = () => {
    // Set up form submission
    const form = document.getElementById('prompt-form');
    const input = document.getElementById('prompt-input');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSubmitQuestion(input.value);
    });

    // Handle input changes
    input.addEventListener('input', () => {
        adjustTextareaHeight(input);
        submitButton.disabled = !input.value.trim();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.value.trim()) {
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

    // Initial textarea height
    adjustTextareaHeight(input);
    submitButton.disabled = true;
};

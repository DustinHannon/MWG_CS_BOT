// Chat UI module for handling message display and UI updates
export class ChatUI {
    constructor() {
        this.dialogue = document.getElementById('dialogue');
        this.chatContainer = document.getElementById('chat-container');
    }

    addUserMessage(question) {
        const userQuestion = document.createElement('li');
        userQuestion.className = 'user-message';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = question;
        
        userQuestion.appendChild(messageContent);
        this.dialogue.appendChild(userQuestion);
        this.scrollToBottom();
    }

    addBotResponse(response) {
        const botResponse = document.createElement('li');
        botResponse.className = 'bot-message';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Handle line breaks and URLs
        const formattedResponse = response
            .split('\n')
            .map(line => {
                // Convert URLs to links
                return line.replace(
                    /(https?:\/\/[^\s]+)/g,
                    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
                );
            })
            .join('<br>');
        
        messageContent.innerHTML = formattedResponse;
        
        botResponse.appendChild(messageContent);
        this.dialogue.appendChild(botResponse);
        this.scrollToBottom();
    }

    addErrorMessage(errorMessage) {
        const errorElement = document.createElement('li');
        errorElement.className = 'bot-message error';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = errorMessage;
        
        errorElement.appendChild(messageContent);
        this.dialogue.appendChild(errorElement);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const typingIndicator = document.createElement('li');
        typingIndicator.className = 'bot-message typing-indicator';
        typingIndicator.id = 'typing-indicator';
        
        const dots = document.createElement('div');
        dots.className = 'typing-dots';
        for (let i = 0; i < 3; i++) {
            dots.appendChild(document.createElement('span'));
        }
        
        typingIndicator.appendChild(dots);
        this.dialogue.appendChild(typingIndicator);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    scrollToBottom() {
        if (this.chatContainer) {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }
    }
}

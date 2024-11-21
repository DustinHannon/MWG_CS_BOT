// Chat UI module for handling message display and UI updates
export class ChatUI {
    constructor() {
        this.dialogue = document.getElementById('dialogue');
        this.chatContainer = document.getElementById('chat-container');
    }

    addUserMessage(question) {
        const userQuestion = document.createElement('li');
        userQuestion.className = 'user-message';
        userQuestion.setAttribute('role', 'article');
        userQuestion.setAttribute('aria-label', 'User message');
        
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
        botResponse.setAttribute('role', 'article');
        botResponse.setAttribute('aria-label', 'Assistant response');
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content formatted-content';
        messageContent.innerHTML = response;
        
        // Add semantic structure for screen readers
        this.enhanceAccessibility(messageContent);
        
        botResponse.appendChild(messageContent);
        this.dialogue.appendChild(botResponse);
        
        this.scrollToBottom();
    }

    addErrorMessage(errorMessage = 'An error occurred. Please try again.') {
        const errorElement = document.createElement('li');
        errorElement.className = 'bot-message error';
        errorElement.setAttribute('role', 'alert');
        errorElement.setAttribute('aria-live', 'assertive');
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = errorMessage;
        
        errorElement.appendChild(messageContent);
        this.dialogue.appendChild(errorElement);
        this.scrollToBottom();
    }

    enhanceAccessibility(messageContent) {
        // Make headings accessible
        const sections = messageContent.querySelectorAll('h1, h2, h3');
        sections.forEach(section => {
            section.setAttribute('role', 'heading');
            section.setAttribute('aria-level', section.tagName[1]);
        });
        
        // Make lists accessible
        const lists = messageContent.querySelectorAll('ul, ol');
        lists.forEach(list => {
            list.setAttribute('role', 'list');
        });
    }

    scrollToBottom() {
        if (this.chatContainer) {
            this.chatContainer.scrollTo({
                top: this.chatContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
    }
}

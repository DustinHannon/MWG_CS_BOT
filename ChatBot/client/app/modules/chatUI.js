// Chat UI module for handling message display and UI updates
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

export class ChatUI {
    constructor() {
        this.dialogue = document.getElementById('dialogue');
        this.chatContainer = document.getElementById('chat-container');
        this.setupMarkdown();
        this.setupHighlightJS();
    }

    setupMarkdown() {
        marked.setOptions({
            highlight: (code, lang) => {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true,
            gfm: true
        });
    }

    setupHighlightJS() {
        document.head.appendChild(this.createStyleLink('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css'));
    }

    createStyleLink(href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        return link;
    }

    addUserMessage(question) {
        const userQuestion = document.createElement('li');
        userQuestion.className = 'user-message';
        userQuestion.setAttribute('role', 'article');
        userQuestion.setAttribute('aria-label', 'User message');
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Add timestamp
        const timestamp = document.createElement('span');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        // Add copy button
        const copyButton = this.createCopyButton(question);
        
        // Add character counter
        const charCounter = document.createElement('span');
        charCounter.className = 'char-counter';
        charCounter.textContent = `${question.length} characters`;
        
        messageContent.textContent = question;
        
        const messageFooter = document.createElement('div');
        messageFooter.className = 'message-footer';
        messageFooter.appendChild(timestamp);
        messageFooter.appendChild(charCounter);
        messageFooter.appendChild(copyButton);
        
        userQuestion.appendChild(messageContent);
        userQuestion.appendChild(messageFooter);
        this.dialogue.appendChild(userQuestion);
        
        // Announce to screen readers
        this.announceToScreenReader('Message sent');
        
        this.scrollToBottom();
    }

    addBotResponse(response) {
        const botResponse = document.createElement('li');
        botResponse.className = 'bot-message';
        botResponse.setAttribute('role', 'article');
        botResponse.setAttribute('aria-label', 'Assistant response');
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content formatted-content';
        
        // Convert markdown and sanitize HTML
        const sanitizedHtml = DOMPurify.sanitize(marked(response));
        messageContent.innerHTML = sanitizedHtml;
        
        // Add timestamp
        const timestamp = document.createElement('span');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        // Add copy button
        const copyButton = this.createCopyButton(response);
        
        const messageFooter = document.createElement('div');
        messageFooter.className = 'message-footer';
        messageFooter.appendChild(timestamp);
        messageFooter.appendChild(copyButton);
        
        // Add semantic structure for screen readers
        this.enhanceAccessibility(messageContent);
        
        botResponse.appendChild(messageContent);
        botResponse.appendChild(messageFooter);
        this.dialogue.appendChild(botResponse);
        
        // Announce to screen readers
        this.announceToScreenReader('New response received');
        
        // Apply syntax highlighting
        messageContent.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightBlock(block);
        });
        
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
        
        // Add timestamp
        const timestamp = document.createElement('span');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        const messageFooter = document.createElement('div');
        messageFooter.className = 'message-footer';
        messageFooter.appendChild(timestamp);
        
        errorElement.appendChild(messageContent);
        errorElement.appendChild(messageFooter);
        this.dialogue.appendChild(errorElement);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const typingIndicator = document.createElement('li');
        typingIndicator.className = 'bot-message typing-indicator';
        typingIndicator.id = 'typing-indicator';
        typingIndicator.setAttribute('role', 'status');
        typingIndicator.setAttribute('aria-label', 'Assistant is typing');
        
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

    createCopyButton(text) {
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.setAttribute('aria-label', 'Copy message');
        button.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
        
        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(text);
                this.showCopyFeedback(button, 'Copied!');
            } catch (err) {
                this.showCopyFeedback(button, 'Failed to copy');
            }
        });
        
        return button;
    }

    showCopyFeedback(button, message) {
        const feedback = document.createElement('span');
        feedback.className = 'copy-feedback';
        feedback.textContent = message;
        button.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 2000);
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
            const items = list.querySelectorAll('li');
            items.forEach(item => {
                item.setAttribute('role', 'listitem');
            });
        });
        
        // Make links accessible
        const links = messageContent.querySelectorAll('a');
        links.forEach(link => {
            if (!link.getAttribute('aria-label')) {
                link.setAttribute('aria-label', `Link to ${link.textContent}`);
            }
        });
        
        // Make code blocks accessible
        const codeBlocks = messageContent.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            block.setAttribute('role', 'code');
            block.setAttribute('aria-label', 'Code block');
        });
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            announcement.remove();
        }, 1000);
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

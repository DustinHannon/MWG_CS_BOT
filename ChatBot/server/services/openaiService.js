import fetch from 'node-fetch';
import config from '../config/config.js';
import { createHash } from 'crypto';

class OpenAIService {
    constructor() {
        this.apiKey = config.openaiApiKey;
        this.model = config.openai.model;
        this.maxTokens = config.openai.maxTokens;
        this.sessions = new Map();
        this.rateLimits = new Map();
    }

    generateSessionId(userIdentifier) {
        return createHash('sha256')
            .update(`${userIdentifier}-${Date.now()}`)
            .digest('hex');
    }

    getRateLimit(sessionId) {
        const now = Date.now();
        const userRateLimit = this.rateLimits.get(sessionId) || {
            requests: 0,
            resetTime: now + 3600000, // 1 hour window
        };

        // Clean up expired rate limits
        if (now > userRateLimit.resetTime) {
            userRateLimit.requests = 0;
            userRateLimit.resetTime = now + 3600000;
        }

        return userRateLimit;
    }

    updateRateLimit(sessionId) {
        const rateLimit = this.getRateLimit(sessionId);
        rateLimit.requests += 1;
        this.rateLimits.set(sessionId, rateLimit);
        return rateLimit;
    }

    checkRateLimit(sessionId) {
        const rateLimit = this.getRateLimit(sessionId);
        const maxRequests = 50; // Requests per hour
        
        if (rateLimit.requests >= maxRequests) {
            const resetTime = new Date(rateLimit.resetTime);
            throw new Error(`Rate limit exceeded. Reset at ${resetTime.toISOString()}`);
        }
    }

    getConversationContext(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, []);
        }
        return this.sessions.get(sessionId);
    }

    updateConversationContext(sessionId, userMessage, assistantMessage) {
        const context = this.getConversationContext(sessionId);
        context.push(
            { role: 'user', content: userMessage },
            { role: 'assistant', content: assistantMessage }
        );

        // Keep only last 10 messages for context
        if (context.length > 20) {
            context.splice(0, 2);
        }

        this.sessions.set(sessionId, context);
    }

    async generateResponse(prompt, sessionId) {
        try {
            // Check rate limit
            this.checkRateLimit(sessionId);
            this.updateRateLimit(sessionId);

            // Get conversation context
            const conversationContext = this.getConversationContext(sessionId);

            const messages = [
                { 
                    role: 'system', 
                    content: `You are a helpful assistant that responds in properly formatted HTML. 
                    Always wrap your entire response in a <div> tag.
                    Use appropriate HTML tags such as:
                    - <p> for paragraphs
                    - <ol> and <li> for numbered lists
                    - <ul> and <li> for bullet points
                    - <strong> for emphasis
                    - <br> for line breaks
                    - <pre><code class="language-*"> for code blocks
                    
                    Example response format:
                    <div>
                        <p>Here are our services:</p>
                        <ol>
                            <li>First service description</li>
                            <li>Second service description</li>
                        </ol>
                        <p>For assistance, contact us at <strong>(555) 555-5555</strong></p>
                    </div>
                    
                    Always maintain proper HTML structure and nesting.
                    Do not include any markdown formatting.
                    Do not include script tags or event handlers.
                    Use syntax highlighting classes for code blocks.` 
                },
                ...conversationContext,
                { role: 'user', content: prompt }
            ];

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages,
                    max_tokens: this.maxTokens,
                    temperature: 0.7,
                    stream: true
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'OpenAI API request failed');
            }

            const reader = response.body.getReader();
            let accumulatedResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }

                // Convert the chunk to text
                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const jsonData = JSON.parse(line.slice(6));
                            const content = jsonData.choices[0]?.delta?.content || '';
                            accumulatedResponse += content;
                        } catch (e) {
                            console.error('Error parsing streaming response:', e);
                        }
                    }
                }
            }

            if (!accumulatedResponse) {
                throw new Error('Invalid response format from OpenAI API');
            }

            // Update conversation context
            this.updateConversationContext(sessionId, prompt, accumulatedResponse);

            return accumulatedResponse;

        } catch (error) {
            console.error('OpenAI Service Error:', error);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timed out');
            }
            
            if (error.response?.status === 429) {
                const retryAfter = error.response.headers.get('retry-after') || 60;
                throw new Error(`Rate limit exceeded. Please try again in ${retryAfter} seconds`);
            }
            
            throw new Error(error.message || 'Failed to generate response');
        }
    }

    clearSession(sessionId) {
        this.sessions.delete(sessionId);
        this.rateLimits.delete(sessionId);
    }
}

export default new OpenAIService();

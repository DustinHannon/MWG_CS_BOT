// Support both ESM and CommonJS
const fetchModule = import('node-fetch').then(m => m.default);
const configModule = import('../config/config.js').then(m => m.default);
const { createHash } = await import('crypto');

class OpenAIService {
    constructor() {
        this.init();
        this.sessions = new Map();
        this.rateLimits = new Map();
    }

    async init() {
        const [fetch, config] = await Promise.all([fetchModule, configModule]);
        this.fetch = fetch;
        this.apiKey = config.openaiApiKey;
        this.model = config.openai?.model;
        this.maxTokens = config.openai?.maxTokens;
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
            resetTime: now + 3600000,
        };

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
        const maxRequests = 50;
        
        if (rateLimit.requests >= maxRequests) {
            const resetTime = new Date(rateLimit.resetTime);
            throw new Error(`Rate limit exceeded. Reset at ${resetTime.toISOString()}`);
        }
    }

    async generateResponse(prompt, sessionId) {
        try {
            await this.init(); // Ensure initialization
            this.checkRateLimit(sessionId);
            this.updateRateLimit(sessionId);

            const response = await this.fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: this.maxTokens,
                }),
            });

            if (!response.ok) {
                throw new Error('OpenAI API request failed');
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || '';
        } catch (error) {
            console.error('OpenAI Service Error:', error);
            throw error;
        }
    }
}

const service = new OpenAIService();

// Support both ESM and CommonJS
export default service;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
}

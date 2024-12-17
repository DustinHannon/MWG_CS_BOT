/**
 * OpenAI Service (openaiService.js)
 * 
 * This service handles all interactions with the OpenAI API, providing chat functionality
 * with advanced features like rate limiting, response caching, and error handling.
 * 
 * Key features:
 * - Session management
 * - Rate limiting (requests and tokens)
 * - Response caching
 * - Request throttling
 * - Error handling
 * - Context enrichment
 * 
 * The service ensures efficient and reliable communication with OpenAI's API while
 * protecting against abuse and optimizing performance through caching.
 * 
 * Related files:
 * - ../config/config.js: Configuration settings
 * - ../utils.js: Utility functions for prompt enrichment
 * - ../middleware/errorHandler.js: Error handling
 */

import { APIError } from '../middleware/errorHandler.js';
import { createHash } from 'crypto';

/**
 * OpenAI Service Class
 * Manages all interactions with the OpenAI API and handles associated functionality
 * like caching, rate limiting, and session management.
 */
class OpenAIService {
    /**
     * Initialize the OpenAI service with necessary data structures
     * for tracking sessions, rate limits, and caching responses.
     */
    constructor() {
        this.sessions = new Map();        // Store session data
        this.rateLimits = new Map();      // Track rate limits per session
        this.responseCache = new Map();    // Cache responses
        this.lastRequestTime = new Map();  // Track request timing
        this.initialized = false;          // Track initialization state
        this.initPromise = null;          // Store initialization promise
    }

    /**
     * Initialize service configuration by loading necessary modules
     * and setting up default values from configuration.
     */
    async init() {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                // Dynamic imports
                const [
                    { default: fetch },
                    { default: config },
                    { enrichUserPromptWithContext }
                ] = await Promise.all([
                    import('node-fetch'),
                    import('../config/config.js'),
                    import('../utils.js')
                ]);

                this.fetch = fetch;
                this.apiKey = config.openaiApiKey;
                this.model = config.openai?.model || 'gpt-3.5-turbo';
                this.maxTokens = config.openai?.maxTokens || 600;
                this.temperature = config.openai?.temperature || 0.7;
                this.cacheDuration = config.openai?.cacheDuration || 3600000; // 1 hour
                this.requestDelay = config.openai?.requestDelay || 1000; // 1 second between requests
                this.enrichUserPromptWithContext = enrichUserPromptWithContext;

                this.initialized = true;
            } catch (error) {
                console.error('Failed to initialize OpenAI service:', error);
                throw error;
            }
        })();

        return this.initPromise;
    }

    /**
     * Generate a unique session ID using cryptographic hashing
     * 
     * @param {string} userIdentifier - Unique identifier for the user
     * @returns {string} Hashed session ID
     */
    generateSessionId(userIdentifier) {
        return createHash('sha256')
            .update(`${userIdentifier}-${Date.now()}-${Math.random()}`)
            .digest('hex');
    }

    /**
     * Get rate limit information for a session
     * 
     * @param {string} sessionId - Session identifier
     * @returns {Object} Rate limit information
     */
    getRateLimit(sessionId) {
        const now = Date.now();
        const userRateLimit = this.rateLimits.get(sessionId) || {
            requests: 0,
            resetTime: now + 3600000, // 1 hour window
            totalTokens: 0
        };

        // Reset limits if time window has passed
        if (now > userRateLimit.resetTime) {
            userRateLimit.requests = 0;
            userRateLimit.totalTokens = 0;
            userRateLimit.resetTime = now + 3600000;
        }

        return userRateLimit;
    }

    /**
     * Update rate limit counters for a session
     * 
     * @param {string} sessionId - Session identifier
     * @param {number} tokensUsed - Number of tokens used in request
     * @returns {Object} Updated rate limit information
     */
    updateRateLimit(sessionId, tokensUsed = 0) {
        const rateLimit = this.getRateLimit(sessionId);
        rateLimit.requests += 1;
        rateLimit.totalTokens += tokensUsed;
        this.rateLimits.set(sessionId, rateLimit);
        return rateLimit;
    }

    /**
     * Check if session has exceeded rate limits
     * 
     * @param {string} sessionId - Session identifier
     * @throws {APIError} If rate limit is exceeded
     */
    checkRateLimit(sessionId) {
        const rateLimit = this.getRateLimit(sessionId);
        const maxRequests = 50; // Requests per hour
        const maxTokens = 100000; // Tokens per hour
        
        if (rateLimit.requests >= maxRequests) {
            const resetTime = new Date(rateLimit.resetTime);
            throw new APIError(
                `Rate limit exceeded. Reset at ${resetTime.toISOString()}`,
                429,
                'RATE_LIMIT_EXCEEDED',
                { resetTime: resetTime.toISOString() }
            );
        }

        if (rateLimit.totalTokens >= maxTokens) {
            throw new APIError(
                'Token limit exceeded for this session',
                429,
                'TOKEN_LIMIT_EXCEEDED',
                { maxTokens, currentTokens: rateLimit.totalTokens }
            );
        }
    }

    /**
     * Enforce delay between requests to prevent API abuse
     * 
     * @param {string} sessionId - Session identifier
     * @returns {Promise<void>}
     */
    async enforceRequestDelay(sessionId) {
        const now = Date.now();
        const lastRequest = this.lastRequestTime.get(sessionId) || 0;
        const timeSinceLastRequest = now - lastRequest;

        if (timeSinceLastRequest < this.requestDelay) {
            await new Promise(resolve => 
                setTimeout(resolve, this.requestDelay - timeSinceLastRequest)
            );
        }

        this.lastRequestTime.set(sessionId, Date.now());
    }

    /**
     * Generate cache key for a prompt and session
     * 
     * @param {string} prompt - User prompt
     * @param {string} sessionId - Session identifier
     * @returns {string} Cache key
     */
    getCacheKey(prompt, sessionId) {
        return createHash('sha256')
            .update(`${sessionId}-${prompt}`)
            .digest('hex');
    }

    /**
     * Retrieve cached response if available
     * 
     * @param {string} prompt - User prompt
     * @param {string} sessionId - Session identifier
     * @returns {string|null} Cached response or null
     */
    getCachedResponse(prompt, sessionId) {
        const cacheKey = this.getCacheKey(prompt, sessionId);
        const cached = this.responseCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.response;
        }

        return null;
    }

    /**
     * Cache a response for future use
     * 
     * @param {string} prompt - User prompt
     * @param {string} sessionId - Session identifier
     * @param {string} response - Response to cache
     */
    setCachedResponse(prompt, sessionId, response) {
        const cacheKey = this.getCacheKey(prompt, sessionId);
        this.responseCache.set(cacheKey, {
            response,
            timestamp: Date.now()
        });

        // Clean up old cache entries
        this.cleanCache();
    }

    /**
     * Remove expired entries from cache
     */
    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.responseCache.entries()) {
            if (now - value.timestamp > this.cacheDuration) {
                this.responseCache.delete(key);
            }
        }
    }

    /**
     * Generate a response using OpenAI's API
     * 
     * @param {string} prompt - User prompt
     * @param {string} sessionId - Session identifier
     * @returns {Promise<string>} Generated response
     * @throws {APIError} If request fails
     */
    async generateResponse(prompt, sessionId) {
        try {
            await this.init(); // Ensure initialization

            // Check rate limits
            this.checkRateLimit(sessionId);

            // Check cache
            const cachedResponse = this.getCachedResponse(prompt, sessionId);
            if (cachedResponse) {
                return cachedResponse;
            }

            // Enforce request delay
            await this.enforceRequestDelay(sessionId);

            // Enrich the prompt with context
            const enrichedPrompt = this.enrichUserPromptWithContext(prompt);

            // Make API request
            const response = await this.fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'user', content: enrichedPrompt }],
                    max_tokens: this.maxTokens,
                    temperature: this.temperature,
                    presence_penalty: 0.6,
                    frequency_penalty: 0.5
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new APIError(
                    errorData.error?.message || 'OpenAI API request failed',
                    response.status,
                    'OPENAI_API_ERROR',
                    errorData
                );
            }

            const data = await response.json();
            
            // Update rate limit with tokens used
            const tokensUsed = data.usage?.total_tokens || 0;
            this.updateRateLimit(sessionId, tokensUsed);

            const generatedResponse = data.choices[0]?.message?.content || '';

            // Cache the response
            this.setCachedResponse(prompt, sessionId, generatedResponse);

            return generatedResponse;

        } catch (error) {
            console.error('OpenAI Service Error:', error);

            if (error instanceof APIError) {
                throw error;
            }

            throw new APIError(
                'Failed to generate response',
                500,
                'OPENAI_SERVICE_ERROR',
                { originalError: error.message }
            );
        }
    }

    /**
     * Clear all data associated with a session
     * 
     * @param {string} sessionId - Session identifier
     */
    clearSession(sessionId) {
        // Clear session data
        this.sessions.delete(sessionId);
        this.rateLimits.delete(sessionId);
        this.lastRequestTime.delete(sessionId);

        // Clear cached responses for this session
        const sessionCachePrefix = sessionId + '-';
        for (const [key] of this.responseCache.entries()) {
            if (key.startsWith(sessionCachePrefix)) {
                this.responseCache.delete(key);
            }
        }
    }

    /**
     * Get current service statistics
     * 
     * @returns {Object} Service statistics
     */
    getServiceStats() {
        return {
            activeSessions: this.sessions.size,
            cacheSize: this.responseCache.size,
            rateLimits: Array.from(this.rateLimits.entries()).map(([id, limit]) => ({
                sessionId: id,
                requests: limit.requests,
                totalTokens: limit.totalTokens,
                resetTime: new Date(limit.resetTime).toISOString()
            }))
        };
    }
}

// Create singleton instance
const service = new OpenAIService();

// Support both ESM and CommonJS
export default service;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
}

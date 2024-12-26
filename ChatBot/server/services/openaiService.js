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

import { APIError, ErrorCodes } from '../middleware/errorHandler.js';
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
        this.ipLimits = new Map();        // Track rate limits per IP
        this.responseCache = new Map();    // Cache responses
        this.lastRequestTime = new Map();  // Track request timing
        this.initialized = false;          // Track initialization state
        this.initPromise = null;          // Store initialization promise
        this.lastCleanup = null;          // Track last cleanup time
        
        // Constants for rate limiting
        this.LIMITS = {
            SESSION: {
                REQUESTS_PER_HOUR: 50,
                TOKENS_PER_HOUR: 100000
            },
            IP: {
                REQUESTS_PER_HOUR: 100,    // Higher limit since it's shared across sessions
                TOKENS_PER_HOUR: 200000    // Higher token limit for IP-based tracking
            },
            CLEANUP_INTERVAL: 3600000,     // 1 hour
            SESSION_EXPIRY: 7200000        // 2 hours
        };
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
                this.maxTokens = config.openai?.maxTokens || 1000;
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
     * Retrieves and manages rate limit information for a specific session
     * 
     * This function implements a sophisticated session-based rate limiting system that:
     * 1. Tracks both request counts and token usage independently
     * 2. Uses a rolling time window that automatically resets
     * 3. Maintains persistent state for each session
     * 4. Handles cleanup of expired sessions
     * 
     * The rate limiting data structure uses a Map for O(1) lookups and updates.
     * Each session's rate limit object contains:
     * - requests: Number of API calls made
     * - totalTokens: Cumulative token usage
     * - resetTime: Timestamp for limit reset
     * - lastActivity: Last request timestamp (for cleanup)
     * 
     * @param {string} sessionId - Unique identifier for the user session
     * @returns {Object} Rate limit information containing:
     *                   - requests: Current request count in window
     *                   - totalTokens: Current token usage in window
     *                   - resetTime: When limits will reset
     *                   - lastActivity: Last request timestamp
     */
    getRateLimit(sessionId) {
        const now = Date.now();
        
        // Clean up expired sessions every hour
        if (!this.lastCleanup || now - this.lastCleanup > 3600000) {
            this.cleanupExpiredSessions();
            this.lastCleanup = now;
        }

        // Get or initialize rate limit object
        const userRateLimit = this.rateLimits.get(sessionId) || {
            requests: 0,
            totalTokens: 0,
            resetTime: now + 3600000, // 1 hour window
            lastActivity: now
        };

        // Reset counters if time window has expired
        if (now > userRateLimit.resetTime) {
            userRateLimit.requests = 0;
            userRateLimit.totalTokens = 0;
            userRateLimit.resetTime = now + 3600000;
        }

        // Update last activity
        userRateLimit.lastActivity = now;
        this.rateLimits.set(sessionId, userRateLimit);

        return userRateLimit;
    }

    /**
     * Validates and enforces rate limits for a session
     * 
     * This function implements a dual-limit strategy:
     * 1. Request-based limiting: Prevents rapid-fire API calls
     *    - 50 requests per hour per session
     *    - Helps prevent abuse and ensures fair resource distribution
     * 
     * 2. Token-based limiting: Controls resource consumption
     *    - 100,000 tokens per hour per session
     *    - Prevents excessive API usage and cost overruns
     * 
     * The function also includes:
     * - Detailed error reporting with reset timing
     * - Automatic cleanup of expired sessions
     * - Activity tracking for session management
     * 
     * @param {string} sessionId - Unique identifier for the user session
     * @throws {APIError} If either request or token limit is exceeded
     *                    Includes detailed reset timing and limit information
     */
    checkRateLimit(sessionId) {
        const rateLimit = this.getRateLimit(sessionId);
        const maxRequests = 50; // Requests per hour
        const maxTokens = 100000; // Tokens per hour
        const now = Date.now();
        
        // Check request limit
        if (rateLimit.requests >= maxRequests) {
            const resetTime = new Date(rateLimit.resetTime);
            const waitTime = Math.ceil((rateLimit.resetTime - now) / 1000);
            
            console.warn(`Rate limit exceeded for session ${sessionId}. ` +
                        `Requests: ${rateLimit.requests}/${maxRequests}`);
                        
                throw new APIError(
                    `Rate limit exceeded. Please wait ${waitTime} seconds. ` +
                    `Reset at ${resetTime.toISOString()}`,
                    429,
                    ErrorCodes.RATE_LIMIT_EXCEEDED,
                {
                    resetTime: resetTime.toISOString(),
                    waitTime,
                    currentRequests: rateLimit.requests,
                    maxRequests
                }
            );
        }

        // Check token limit
        if (rateLimit.totalTokens >= maxTokens) {
            const resetTime = new Date(rateLimit.resetTime);
            const waitTime = Math.ceil((rateLimit.resetTime - now) / 1000);
            
            console.warn(`Token limit exceeded for session ${sessionId}. ` +
                        `Tokens: ${rateLimit.totalTokens}/${maxTokens}`);
                        
                throw new APIError(
                    `Token limit exceeded. Please wait ${waitTime} seconds.`,
                    429,
                    ErrorCodes.OPENAI_RATE_LIMIT,
                {
                    resetTime: resetTime.toISOString(),
                    waitTime,
                    currentTokens: rateLimit.totalTokens,
                    maxTokens
                }
            );
        }
    }


    /**
     * Update rate limit counters for a session
     * 
     * This function updates both request count and token usage for a session.
     * It's called after successful API requests to maintain accurate usage tracking.
     * The updated values are used by checkRateLimit() to enforce limits.
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
     * Cleans up expired session and IP data to prevent memory leaks
     * This helps maintain server performance and resource utilization
     * by removing inactive sessions and their associated data
     * 
     * @private
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        let cleanedSessions = 0;
        let cleanedIPs = 0;
        
        // Cleanup session rate limits
        for (const [sessionId, rateLimit] of this.rateLimits.entries()) {
            if (now - rateLimit.lastActivity > this.LIMITS.SESSION_EXPIRY) {
                this.rateLimits.delete(sessionId);
                cleanedSessions++;
            }
        }

        // Cleanup IP rate limits
        for (const [ip, ipLimit] of this.ipLimits.entries()) {
            // Remove expired sessions from IP tracking
            for (const sessionId of ipLimit.sessions) {
                if (!this.rateLimits.has(sessionId)) {
                    ipLimit.sessions.delete(sessionId);
                }
            }

            // Remove IP entry if no active sessions and expired
            if (ipLimit.sessions.size === 0 && 
                now - ipLimit.lastActivity > this.LIMITS.CLEANUP_INTERVAL) {
                this.ipLimits.delete(ip);
                cleanedIPs++;
            }
        }

        // Cleanup session data
        for (const [sessionId, session] of this.sessions.entries()) {
            if (!this.rateLimits.has(sessionId)) {
                this.sessions.delete(sessionId);
            }
        }

        // Cleanup request timing data
        for (const [sessionId] of this.lastRequestTime.entries()) {
            if (!this.rateLimits.has(sessionId)) {
                this.lastRequestTime.delete(sessionId);
            }
        }

        if (cleanedSessions > 0 || cleanedIPs > 0) {
            console.log(`Cleaned up ${cleanedSessions} expired sessions and ${cleanedIPs} IP entries`);
        }
    }

    /**
     * Generate a unique session ID using cryptographic hashing
     * This creates a secure, unique identifier for each user session
     * The session ID combines:
     * - User identifier (e.g., IP address or user ID)
     * - Current timestamp
     * - Random value for additional entropy
     * 
     * @param {string} userIdentifier - Unique identifier for the user
     * @returns {string} Hashed session ID (64 character hex string)
     */
    generateSessionId(userIdentifier) {
        const timestamp = Date.now();
        const random = Math.random().toString();
        
        return createHash('sha256')
            .update(`${userIdentifier}-${timestamp}-${random}`)
            .digest('hex');
    }

    /**
     * Generate a cache key for storing and retrieving responses
     * This creates a unique hash combining the session ID and prompt
     * to ensure proper isolation between sessions and accurate prompt matching
     * 
     * @param {string} prompt - User prompt to generate key for
     * @param {string} sessionId - Session identifier
     * @returns {string} SHA-256 hash used as cache key
     */
    getCacheKey(prompt, sessionId) {
        return createHash('sha256')
            .update(`${sessionId}-${prompt}`)
            .digest('hex');
    }

    /**
     * Retrieve a cached response if available and not expired
     * This helps reduce API calls for repeated questions within
     * the cache duration window (default 1 hour)
     * 
     * @param {string} prompt - User prompt to look up
     * @param {string} sessionId - Session identifier
     * @returns {string|null} Cached response if available and valid, null otherwise
     */
    getCachedResponse(prompt, sessionId) {
        const cacheKey = this.getCacheKey(prompt, sessionId);
        const cached = this.responseCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            console.log(`Cache hit for session ${sessionId}`);
            return cached.response;
        }

        console.log(`Cache miss for session ${sessionId}`);
        return null;
    }

    /**
     * Store a response in the cache for future use
     * Associates the response with a unique key combining
     * the session ID and prompt, and includes a timestamp
     * for expiration checking
     * 
     * @param {string} prompt - User prompt to cache response for
     * @param {string} sessionId - Session identifier
     * @param {string} response - Response content to cache
     */
    setCachedResponse(prompt, sessionId, response) {
        const cacheKey = this.getCacheKey(prompt, sessionId);
        this.responseCache.set(cacheKey, {
            response,
            timestamp: Date.now()
        });

        // Clean up old cache entries
        this.cleanCache();
        console.log(`Cached response for session ${sessionId}`);
    }

    /**
     * Remove expired entries from the response cache
     * This prevents memory leaks and ensures cached responses
     * don't persist beyond their intended lifetime
     */
    cleanCache() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, value] of this.responseCache.entries()) {
            if (now - value.timestamp > this.cacheDuration) {
                this.responseCache.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`Cleaned ${cleanedCount} expired cache entries`);
        }
    }

    /**
     * Get rate limit information for an IP address
     * 
     * @param {string} ip - Client IP address
     * @returns {Object} Rate limit information for the IP
     */
    getIPRateLimit(ip) {
        const now = Date.now();
        const ipLimit = this.ipLimits.get(ip) || {
            requests: 0,
            totalTokens: 0,
            resetTime: now + this.LIMITS.CLEANUP_INTERVAL,
            lastActivity: now,
            sessions: new Set() // Track sessions associated with this IP
        };

        if (now > ipLimit.resetTime) {
            ipLimit.requests = 0;
            ipLimit.totalTokens = 0;
            ipLimit.resetTime = now + this.LIMITS.CLEANUP_INTERVAL;
        }

        ipLimit.lastActivity = now;
        this.ipLimits.set(ip, ipLimit);
        return ipLimit;
    }

    /**
     * Check IP-based rate limits
     * 
     * @param {string} ip - Client IP address
     * @throws {APIError} If IP has exceeded its limits
     */
    checkIPRateLimit(ip) {
        const ipLimit = this.getIPRateLimit(ip);
        const now = Date.now();

        if (ipLimit.requests >= this.LIMITS.IP.REQUESTS_PER_HOUR) {
            const resetTime = new Date(ipLimit.resetTime);
            const waitTime = Math.ceil((ipLimit.resetTime - now) / 1000);
            
            console.warn(`IP rate limit exceeded: ${ip}. ` +
                        `Requests: ${ipLimit.requests}/${this.LIMITS.IP.REQUESTS_PER_HOUR}`);
            
            throw new APIError(
                `IP rate limit exceeded. Please wait ${waitTime} seconds.`,
                429,
                ErrorCodes.RATE_LIMIT_EXCEEDED,
                {
                    resetTime: resetTime.toISOString(),
                    waitTime,
                    currentRequests: ipLimit.requests,
                    maxRequests: this.LIMITS.IP.REQUESTS_PER_HOUR
                }
            );
        }

        if (ipLimit.totalTokens >= this.LIMITS.IP.TOKENS_PER_HOUR) {
            const resetTime = new Date(ipLimit.resetTime);
            const waitTime = Math.ceil((ipLimit.resetTime - now) / 1000);
            
            console.warn(`IP token limit exceeded: ${ip}. ` +
                        `Tokens: ${ipLimit.totalTokens}/${this.LIMITS.IP.TOKENS_PER_HOUR}`);
            
            throw new APIError(
                `IP token limit exceeded. Please wait ${waitTime} seconds.`,
                429,
                ErrorCodes.OPENAI_RATE_LIMIT,
                {
                    resetTime: resetTime.toISOString(),
                    waitTime,
                    currentTokens: ipLimit.totalTokens,
                    maxTokens: this.LIMITS.IP.TOKENS_PER_HOUR
                }
            );
        }
    }

    /**
     * Update IP rate limit counters
     * 
     * @param {string} ip - Client IP address
     * @param {string} sessionId - Associated session ID
     * @param {number} tokensUsed - Number of tokens used
     */
    updateIPRateLimit(ip, sessionId, tokensUsed = 0) {
        const ipLimit = this.getIPRateLimit(ip);
        ipLimit.requests += 1;
        ipLimit.totalTokens += tokensUsed;
        ipLimit.sessions.add(sessionId);
        this.ipLimits.set(ip, ipLimit);
    }

    /**
     * Generate a response using OpenAI's API
     * 
     * @param {string} prompt - User prompt
     * @param {string} sessionId - Session identifier
     * @param {Object} metadata - Additional request metadata
     * @param {string} metadata.ip - Client IP address
     * @param {string} metadata.userAgent - Client user agent
     * @param {number} metadata.sessionCreated - Session creation timestamp
     * @returns {Promise<string>} Generated response
     * @throws {APIError} If request fails or limits are exceeded
     */
    async generateResponse(prompt, sessionId, metadata = {}) {
        try {
            await this.init(); // Ensure initialization

            const { ip, userAgent } = metadata;
            
            // Check both session and IP rate limits
            this.checkRateLimit(sessionId);
            if (ip) {
                this.checkIPRateLimit(ip);
            }

            // Store user message in history
            this.storeMessage(sessionId, prompt, 'user');

            // Check cache
            const cachedResponse = this.getCachedResponse(prompt, sessionId);
            if (cachedResponse) {
                // Still count the request for IP tracking
                if (ip) {
                    this.updateIPRateLimit(ip, sessionId, 0);
                }
                // Store bot response in history
                this.storeMessage(sessionId, cachedResponse, 'bot');
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
                    ErrorCodes.OPENAI_API_ERROR,
                    errorData
                );
            }

            const data = await response.json();
            
            // Update both session and IP rate limits
            const tokensUsed = data.usage?.total_tokens || 0;
            this.updateRateLimit(sessionId, tokensUsed);
            if (ip) {
                this.updateIPRateLimit(ip, sessionId, tokensUsed);
            }

            const generatedResponse = data.choices[0]?.message?.content || '';

            // Cache the response
            this.setCachedResponse(prompt, sessionId, generatedResponse);

            // Store bot response in history
            this.storeMessage(sessionId, generatedResponse, 'bot');

            return generatedResponse;

        } catch (error) {
            console.error('OpenAI Service Error:', error);

            if (error instanceof APIError) {
                throw error;
            }

            throw new APIError(
                'Failed to generate response',
                500,
                ErrorCodes.OPENAI_API_ERROR,
                { originalError: error.message }
            );
        }
    }

    /**
     * Clear all data associated with a session
     * Removes session data and updates IP tracking accordingly
     * 
     * @param {string} sessionId - Session identifier
     */
    clearSession(sessionId) {
        // Clear session data
        this.sessions.delete(sessionId);
        this.rateLimits.delete(sessionId);
        this.lastRequestTime.delete(sessionId);

        // Remove session from IP tracking
        for (const [ip, ipLimit] of this.ipLimits.entries()) {
            if (ipLimit.sessions.has(sessionId)) {
                ipLimit.sessions.delete(sessionId);
                // Clean up IP entry if no more active sessions
                if (ipLimit.sessions.size === 0) {
                    this.ipLimits.delete(ip);
                }
            }
        }

        // Clear cached responses for this session
        const sessionCachePrefix = sessionId + '-';
        for (const [key] of this.responseCache.entries()) {
            if (key.startsWith(sessionCachePrefix)) {
                this.responseCache.delete(key);
            }
        }

        console.log(`Cleared all data for session: ${sessionId}`);
    }

    /**
     * Get current service statistics
     * Provides comprehensive stats about service usage
     * 
     * @returns {Object} Service statistics including:
     *                   - Active sessions count
     *                   - Cache size
     *                   - Session rate limits
     *                   - IP rate limits
     *                   - Memory usage
     */
    getServiceStats() {
        const now = Date.now();
        return {
            activeSessions: this.sessions.size,
            cacheSize: this.responseCache.size,
            activeIPs: this.ipLimits.size,
            
            // Session rate limits
            sessionLimits: Array.from(this.rateLimits.entries()).map(([id, limit]) => ({
                sessionId: id,
                requests: limit.requests,
                totalTokens: limit.totalTokens,
                resetTime: new Date(limit.resetTime).toISOString(),
                timeUntilReset: Math.max(0, limit.resetTime - now) / 1000
            })),
            
            // IP rate limits
            ipLimits: Array.from(this.ipLimits.entries()).map(([ip, limit]) => ({
                ip: ip,
                requests: limit.requests,
                totalTokens: limit.totalTokens,
                activeSessions: Array.from(limit.sessions),
                resetTime: new Date(limit.resetTime).toISOString(),
                timeUntilReset: Math.max(0, limit.resetTime - now) / 1000
            })),
            
            // Limits configuration
            limits: this.LIMITS,
            
            // Memory usage
            memoryUsage: {
                sessions: this.sessions.size,
                rateLimits: this.rateLimits.size,
                ipLimits: this.ipLimits.size,
                cache: this.responseCache.size,
                timing: this.lastRequestTime.size
            }
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

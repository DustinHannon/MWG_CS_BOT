/**
 * Application Configuration (config.js)
 * 
 * This file manages all configuration settings for the Morgan White Group ChatBot application.
 * It loads environment variables, sets default values, and validates required settings.
 * 
 * Configuration categories:
 * - Server settings (port, environment)
 * - API keys (Azure AI Foundry)
 * - Security settings (CORS, CSP)
 * - Rate limiting
 * - Azure AI model settings
 *
 * Environment Variables Required:
 * - AZURE_AI_KEY: API key for Azure AI Foundry
 * 
 * Optional Environment Variables:
 * - PORT: Server port (default: 8080)
 * - NODE_ENV: Environment mode (default: 'production')
 * 
 * Usage:
 * import config from './config/config.js';
 * const port = config.port;
 * 
 * Related files:
 * - .env: Environment variables file (not in repository)
 * - ../services/openaiService.js: Uses OpenAI configuration
 * - ../middleware/security.js: Uses security settings
 */

// Import required dependencies
import * as dotenv from 'dotenv';
import { APIError, ErrorCodes } from '../middleware/errorHandler.js';

// Load environment variables from .env file
// This allows for different configurations in different environments
dotenv.config();

/**
 * Main configuration object
 * Contains all settings for the application with sensible defaults
 */
const config = {
    // Server configuration
    // These settings control the basic server setup
    port: process.env.PORT || 8080,                    // Server port number
    nodeEnv: process.env.NODE_ENV || 'production',     // Environment mode
    
    // API Keys
    // Sensitive credentials loaded from environment variables
    azureAiKey: process.env.AZURE_AI_KEY,             // Azure AI Foundry API key
    
    // Security settings
    // CORS (Cross-Origin Resource Sharing) configuration
    // This configuration protects against unauthorized cross-origin requests
    // by explicitly defining which domains can interact with our API
    cors: {
        // Origin configuration - SECURITY CRITICAL
        // Instead of allowing all origins ('*'), we explicitly list trusted domains
        // This prevents malicious websites from making unauthorized requests to our API
        origin: [
            'https://morganwhite.com',        // Main Morgan White Group domain
            'https://*.morganwhite.com',      // All Morgan White Group subdomains
            'https://*.vercel.app'            // Vercel deployment domains
        ],

        // HTTP Methods - Principle of Least Privilege
        // Only allow the specific HTTP methods needed for the application
        // This prevents potential abuse through unauthorized HTTP methods
        methods: ['GET', 'POST'],

        // Allowed Headers - Minimal Surface Area
        // Restrict which headers can be used in requests
        // Only allow essential headers to minimize attack surface
        allowedHeaders: ['Content-Type'],

        // Credentials - Secure Cookie Handling
        // Enable secure handling of cookies and authorization headers
        // Required for maintaining authenticated sessions and secure data transfer
        credentials: true
    },
    
    // Rate limiting configuration
    // This configuration protects the API from abuse by implementing request frequency limits
    // It uses a sliding window approach where each IP address is tracked independently
    // When the limit is reached, subsequent requests will receive a 429 (Too Many Requests) response
    rateLimit: {
        windowMs: 15 * 60 * 1000,      // Time window in milliseconds (15 minutes)
                                       // The window "slides" forward with time, creating a rolling time period
                                       // Example: If it's 2:00 PM, it counts requests from 1:45 PM to 2:00 PM
        
        max: 100                        // Maximum number of requests allowed per IP within the time window
                                       // Once an IP reaches this limit, they must wait until their oldest
                                       // request "ages out" of the current time window before making new requests
                                       // This prevents any single IP from overwhelming the server with requests
    },
    
    // Content Security Policy (CSP) configuration
    // Defines allowed sources for various resource types
    csp: {
        directives: {
            // Default source for all resources
            defaultSrc: ["'self'"],
            
            // JavaScript sources
            scriptSrc: ["'self'", "'unsafe-inline'"],
            
            // CSS sources
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            
            // Image sources
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://morganwhite.com",
                "https://*.morganwhite.com",
                "https://*.vercel.app"
            ],
            
            // Connection sources for fetch, WebSocket, etc.
            connectSrc: [
                "'self'",
                "https://az-util-ai.openai.azure.com",
                "https://morganwhite.com",
                "https://*.morganwhite.com",
                "https://insuranceforeveryone.com",
                "https://www.linkedin.com",
                "https://*.vercel.app"
            ],
            
            // Font sources
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            
            // Object sources (plugins)
            objectSrc: ["'none'"],
            
            // Media sources (audio/video)
            mediaSrc: ["'self'"],
            
            // Frame sources
            frameSrc: ["'none'"],
            
            // Form submission targets
            formAction: ["'self'"],
            
            // Base URI restrictions
            baseUri: ["'self'"],
            
            // HTTPS upgrade
            upgradeInsecureRequests: []
        }
    },
    
    // Azure AI Foundry configuration
    // Settings for the chat model integration
    ai: {
        deployment: process.env.AZURE_AI_DEPLOYMENT || 'gpt-5.4',
        maxTokens: 1000
    }
};

/**
 * Validates the configuration object
 * Ensures all required settings are present and valid
 * 
 * @throws {APIError} If any configuration validation fails
 * @returns {Object} Validated configuration object
 */
const validateConfig = () => {
    // List of required environment variables
    const requiredVars = ['azureAiKey'];
    
    // Check for missing required variables
    const missingVars = requiredVars.filter(varName => !config[varName]);
    
    // Throw error if any required variables are missing
    if (missingVars.length > 0) {
        throw new APIError(
            `Missing required environment variables: ${missingVars.join(', ')}`,
            500,
            ErrorCodes.CONFIG_ERROR,
            { missingVariables: missingVars }
        );
    }

    // Validate port number
    if (isNaN(config.port) || config.port < 0 || config.port > 65535) {
        throw new APIError(
            'Invalid port number specified',
            500,
            ErrorCodes.CONFIG_ERROR,
            { port: config.port }
        );
    }

    // Validate environment
    if (!['development', 'production', 'test'].includes(config.nodeEnv)) {
        throw new APIError(
            'Invalid environment specified',
            500,
            ErrorCodes.CONFIG_ERROR,
            { environment: config.nodeEnv }
        );
    }

    // Validate rate limit settings
    if (config.rateLimit.windowMs < 0 || config.rateLimit.max < 0) {
        throw new APIError(
            'Invalid rate limit configuration',
            500,
            ErrorCodes.CONFIG_ERROR,
            { rateLimit: config.rateLimit }
        );
    }

    // Validate AI settings
    if (!config.ai.deployment || !config.ai.maxTokens || config.ai.maxTokens < 0) {
        throw new APIError(
            'Invalid AI configuration',
            500,
            ErrorCodes.CONFIG_ERROR,
            { ai: config.ai }
        );
    }
    
    return config;
};

// Export validated configuration
// This ensures the application won't start with missing required settings
export default validateConfig();

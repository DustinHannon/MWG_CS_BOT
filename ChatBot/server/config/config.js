/**
 * Application Configuration (config.js)
 * 
 * This file manages all configuration settings for the Morgan White Group ChatBot application.
 * It loads environment variables, sets default values, and validates required settings.
 * 
 * Configuration categories:
 * - Server settings (port, environment)
 * - API keys (OpenAI)
 * - Security settings (CORS, CSP)
 * - Rate limiting
 * - OpenAI specific settings
 * 
 * Environment Variables Required:
 * - OPENAI_API_KEY: API key for OpenAI services
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

// Import dotenv for environment variable management
import * as dotenv from 'dotenv';

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
    openaiApiKey: process.env.OPENAI_API_KEY,         // OpenAI API key
    
    // Security settings
    // CORS (Cross-Origin Resource Sharing) configuration
    cors: {
        origin: '*',                    // Allow all origins (customize in production)
        methods: ['GET', 'POST'],       // Allowed HTTP methods
        allowedHeaders: ['Content-Type'] // Allowed request headers
    },
    
    // Rate limiting configuration
    // Prevents abuse by limiting request frequency
    rateLimit: {
        windowMs: 15 * 60 * 1000,      // 15 minute window
        max: 100                        // 100 requests per window per IP
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
            styleSrc: ["'self'", "'unsafe-inline'"],
            
            // Image sources
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://morganwhite.com",
                "https://*.morganwhite.com"
            ],
            
            // Connection sources for fetch, WebSocket, etc.
            connectSrc: [
                "'self'",
                "https://api.openai.com",
                "https://morganwhite.com",
                "https://*.morganwhite.com",
                "https://insuranceforeveryone.com",
                "https://www.linkedin.com"
            ],
            
            // Font sources
            fontSrc: ["'self'", "data:"],
            
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
    
    // OpenAI API configuration
    // Settings for the ChatGPT integration
    openai: {
        model: 'gpt-3.5-turbo', // GPT model to use
        maxTokens: 1000         // Maximum tokens per response
    }
};

/**
 * Validates the configuration object
 * Ensures all required settings are present
 * 
 * @throws {Error} If any required configuration is missing
 * @returns {Object} Validated configuration object
 */
const validateConfig = () => {
    // List of required environment variables
    const requiredVars = ['openaiApiKey'];
    
    // Check for missing required variables
    const missingVars = requiredVars.filter(varName => !config[varName]);
    
    // Throw error if any required variables are missing
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    return config;
};

// Export validated configuration
// This ensures the application won't start with missing required settings
export default validateConfig();

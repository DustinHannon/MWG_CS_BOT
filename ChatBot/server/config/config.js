import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Validate and export environment variables
const config = {
    // Server configuration
    port: process.env.PORT || 8080,
    nodeEnv: process.env.NODE_ENV || 'production',
    
    // API Keys
    openaiApiKey: process.env.OPENAI_API_KEY,
    
    // Security settings
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type']
    },
    
    // Rate limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    },
    
    // Content Security Policy
    csp: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https://morganwhite.com", "https://*.morganwhite.com"],
            connectSrc: ["'self'", "https://api.openai.com", "https://morganwhite.com", "https://*.morganwhite.com", "https://insuranceforeveryone.com", "https://www.linkedin.com"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            formAction: ["'self'"],
            baseUri: ["'self'"],
            upgradeInsecureRequests: []
        }
    },
    
    // OpenAI configuration
    openai: {
        model: 'gpt-3.5-turbo',
        maxTokens: 600
    }
};

// Validate required configuration
const validateConfig = () => {
    const requiredVars = ['openaiApiKey'];
    const missingVars = requiredVars.filter(varName => !config[varName]);
    
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    return config;
};

export default validateConfig();

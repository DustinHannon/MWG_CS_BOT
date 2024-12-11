import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Validate and export environment variables
const config = {
    // Server configuration
    port: process.env.PORT || 8080, // Default to 8080 for Azure compatibility
    nodeEnv: process.env.NODE_ENV || 'production',
    
    // API Keys
    openaiApiKey: process.env.OPENAI_API_KEY,
    
    // Security settings
    cors: {
        origin: '*', // Allow all origins since we're using Azure Web Apps
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
            imgSrc: ["'self'", "https://morganwhite.com", "https://*.morganwhite.com", "data:", "blob:"],
            connectSrc: ["'self'", "https://api.openai.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
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

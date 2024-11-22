import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Validate and export environment variables
const config = {
    // Server configuration
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // API Keys
    openaiApiKey: process.env.OPENAI_API_KEY,
    
    // Security settings
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? '*' // Allow all origins in production since we're using Azure Web Apps
            : 'http://localhost:3000',
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
    },
    
    // Logging configuration
    logging: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: process.env.NODE_ENV === 'production' ? 'json' : 'dev'
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

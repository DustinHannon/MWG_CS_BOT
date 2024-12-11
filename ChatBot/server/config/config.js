import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Helper function to parse Redis connection string
const parseRedisConfig = () => {
    const connectionString = process.env.REDIS_URL || process.env.AZURE_REDIS_CONNECTION_STRING;
    if (!connectionString) return null;

    // If it's already a proper Redis URL, return it
    if (connectionString.startsWith('redis://') || connectionString.startsWith('rediss://')) {
        return connectionString;
    }

    // For Azure Redis connection strings, they typically look like:
    // hostname:port,password=password,ssl=True,abortConnect=False
    try {
        const parts = connectionString.split(',');
        const hostPort = parts[0];
        const password = parts.find(p => p.startsWith('password='))?.split('=')[1];
        const ssl = parts.find(p => p.startsWith('ssl='))?.split('=')[1] === 'True';

        if (password) {
            return `redis${ssl ? 's' : ''}://:${password}@${hostPort}`;
        }
        return `redis${ssl ? 's' : ''}://${hostPort}`;
    } catch (err) {
        console.error('Error parsing Redis connection string:', err);
        return null;
    }
};

// Validate and export environment variables
const config = {
    // Server configuration
    port: process.env.PORT || 8080, // Default to 8080 for Azure compatibility
    nodeEnv: process.env.NODE_ENV || 'production',
    
    // API Keys
    openaiApiKey: process.env.OPENAI_API_KEY,
    
    // Redis configuration
    redis: {
        url: parseRedisConfig(),
        tls: process.env.NODE_ENV === 'production'
    },
    
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

import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Helper function to parse Azure Redis connection string
const parseAzureRedisConfig = () => {
    const connectionString = process.env.AZURE_REDIS_CONNECTION_STRING;
    if (!connectionString) return null;

    try {
        // Azure Redis connection string format:
        // hostname:port,password=password,ssl=True,abortConnect=False
        const [hostPort, ...settings] = connectionString.split(',');
        const password = settings
            .find(s => s.startsWith('password='))
            ?.replace('password=', '');

        if (!password) {
            throw new Error('Password not found in Redis connection string');
        }

        // Construct Redis URL with SSL
        return `rediss://:${password}@${hostPort}`;
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
        url: parseAzureRedisConfig(),
        tls: true // Always true for Azure Redis
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

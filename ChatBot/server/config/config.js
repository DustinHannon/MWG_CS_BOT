import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Helper function to parse Redis connection string
const parseRedisConfig = () => {
    const connectionString = process.env.AZURE_REDIS_CONNECTION_STRING;
    if (!connectionString) {
        console.error('AZURE_REDIS_CONNECTION_STRING environment variable is not set');
        return null;
    }

    try {
        // Check if the connection string is already in URL format
        if (connectionString.startsWith('rediss://')) {
            console.log('Using Redis URL format connection string');
            return connectionString;
        }

        // Log the format of the connection string (without exposing sensitive data)
        const maskedConnectionString = connectionString.replace(/password=([^,]+)/, 'password=***');
        console.log('Parsing Azure Redis connection string format:', maskedConnectionString);

        // Azure Redis connection string format:
        // hostname:port,password=password,ssl=True,abortConnect=False
        const [hostPort, ...settings] = connectionString.split(',');
        
        // Validate host:port format
        if (!hostPort || !hostPort.includes(':')) {
            throw new Error('Invalid host:port format in Redis connection string');
        }

        // Extract host and port
        const [host, port] = hostPort.split(':');
        if (!host || !port) {
            throw new Error('Missing host or port in Redis connection string');
        }

        // Convert settings to a map
        const settingsMap = settings.reduce((acc, setting) => {
            const [key, value] = setting.split('=').map(s => s.trim().toLowerCase());
            acc[key] = value;
            return acc;
        }, {});

        // Extract password
        const password = settingsMap.password;
        if (!password) {
            throw new Error('Missing password in Redis connection string');
        }

        // Construct Redis URL (always use SSL for Azure Redis)
        const redisUrl = `rediss://:${encodeURIComponent(password)}@${host}:${port}`;
        
        console.log('Successfully parsed Redis connection string');
        console.log('Host:', host);
        console.log('Port:', port);
        console.log('SSL Enabled: true');
        
        return redisUrl;
    } catch (err) {
        console.error('Error parsing Redis connection string:', err.message);
        return null;
    }
};

// Validate and export environment variables
const config = {
    // Server configuration
    port: process.env.PORT || 8080,
    nodeEnv: process.env.NODE_ENV || 'production',
    
    // API Keys
    openaiApiKey: process.env.OPENAI_API_KEY,
    
    // Redis configuration
    redis: {
        url: parseRedisConfig(),
        tls: true, // Always true for Azure Redis
        socket: {
            connectTimeout: 60000, // 60 seconds
            keepAlive: 5000, // 5 seconds
            family: 4, // Force IPv4
            reconnectStrategy: (retries) => {
                if (retries > 50) return new Error('Max reconnection attempts reached');
                return Math.min(Math.pow(2, retries) * 100, 10000);
            }
        }
    },
    
    // Security settings
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type']
    },
    
    // Rate limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 100
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

    // Validate Redis configuration if URL is present
    if (config.redis.url) {
        try {
            const url = new URL(config.redis.url);
            console.log('Redis configuration validated:');
            console.log('Protocol:', url.protocol);
            console.log('Host:', url.hostname);
            console.log('Port:', url.port);
            console.log('SSL Enabled:', url.protocol === 'rediss:');
        } catch (err) {
            throw new Error(`Invalid Redis URL format: ${err.message}`);
        }
    } else {
        console.warn('No Redis URL configured - falling back to in-memory session store');
    }
    
    return config;
};

export default validateConfig();

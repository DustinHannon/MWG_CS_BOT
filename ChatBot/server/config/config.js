import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Helper function to parse Azure Redis connection string
const parseAzureRedisConfig = () => {
    const connectionString = process.env.AZURE_REDIS_CONNECTION_STRING;
    if (!connectionString) {
        console.error('AZURE_REDIS_CONNECTION_STRING environment variable is not set');
        return null;
    }

    try {
        // Log the format of the connection string (without exposing sensitive data)
        const maskedConnectionString = connectionString.replace(/password=([^,]+)/, 'password=***');
        console.log('Parsing Redis connection string format:', maskedConnectionString);

        // Azure Redis connection string format:
        // hostname:port,password=password,ssl=True,abortConnect=False
        const [hostPort, ...settings] = connectionString.split(',');
        
        // Validate host:port format
        if (!hostPort || !hostPort.includes(':')) {
            throw new Error('Invalid host:port format in Redis connection string');
        }

        // Validate host:port parts
        const [host, port] = hostPort.split(':');
        if (!host || !port) {
            throw new Error('Missing host or port in Redis connection string');
        }
        if (isNaN(port) || port < 1 || port > 65535) {
            throw new Error('Invalid port number in Redis connection string');
        }

        // Convert settings to a map for easier validation
        const settingsMap = settings.reduce((acc, setting) => {
            const [key, value] = setting.split('=').map(s => s.trim().toLowerCase());
            acc[key] = value;
            return acc;
        }, {});

        // Validate required settings
        const requiredSettings = ['password', 'ssl'];
        const missingSettings = requiredSettings.filter(setting => !settingsMap[setting]);
        if (missingSettings.length > 0) {
            throw new Error(`Missing required settings: ${missingSettings.join(', ')}`);
        }

        // Extract and validate password
        const password = settingsMap.password;
        if (!password) {
            throw new Error('Empty password in Redis connection string');
        }

        // Validate SSL setting
        if (settingsMap.ssl !== 'true') {
            throw new Error('SSL must be enabled for Azure Redis (ssl=True)');
        }

        // Construct Redis URL with SSL
        // Note: Azure Redis requires SSL, so we use rediss:// protocol
        const redisUrl = `rediss://:${encodeURIComponent(password)}@${host}:${port}`;
        
        // Validate final URL format
        try {
            const url = new URL(redisUrl);
            // Additional URL validation
            if (!url.password) {
                throw new Error('Password not properly encoded in Redis URL');
            }
            if (!url.hostname || !url.port) {
                throw new Error('Missing hostname or port in Redis URL');
            }
        } catch (err) {
            throw new Error(`Invalid Redis URL format: ${err.message}`);
        }

        console.log('Successfully parsed Redis connection string');
        console.log('Host:', host);
        console.log('Port:', port);
        console.log('SSL Enabled:', settingsMap.ssl === 'true');
        
        return redisUrl;
    } catch (err) {
        console.error('Error parsing Redis connection string:', err.message);
        console.error('Connection string must follow format:');
        console.error('hostname:port,password=password,ssl=True,abortConnect=False');
        console.error('Example: myredis.redis.cache.windows.net:6380,password=mypassword,ssl=True,abortConnect=False');
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

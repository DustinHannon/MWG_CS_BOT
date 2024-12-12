import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';
import cors from 'cors';
import openaiService from './services/openaiService.js';
import { errorHandler } from './middleware/errorHandler.js';
import { securityMiddleware, validateInput } from './middleware/security.js';
import config from './config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize Redis client
let redisClient;
try {
    if (config.redis.url) {
        redisClient = createClient({
            url: config.redis.url,
            socket: {
                ...config.redis.socket,
                tls: config.redis.tls,
                rejectUnauthorized: false // Required for Azure Redis SSL
            }
        });

        // Enhanced Redis event handling
        redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err);
            // Log redacted connection string for debugging
            const redactedUrl = config.redis.url.replace(/\/\/(.*?)@/, '//***:***@');
            console.error('Redis Connection String Format:', redactedUrl);
            console.error('Error Stack:', err.stack);
        });

        redisClient.on('connect', () => {
            console.log('Connected to Redis successfully');
        });

        redisClient.on('reconnecting', (params) => {
            console.log('Reconnecting to Redis...', {
                attempt: params?.attempt,
                totalRetryTime: params?.totalRetryTime
            });
        });

        redisClient.on('ready', () => {
            console.log('Redis client is ready for operations');
        });

        await redisClient.connect();
        
        // Verify connection with a ping
        const pingResult = await redisClient.ping();
        console.log('Redis connection verified with PING:', pingResult);
    }
} catch (err) {
    console.error('Failed to create Redis client:', err);
    console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
    });
    redisClient = null;
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
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
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors(config.cors));

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
};

// Add Redis store if Redis client is connected
if (redisClient?.isReady) {
    const redisStore = new RedisStore({ 
        client: redisClient,
        prefix: 'mwgcsbot:',
        ttl: 86400 // 1 day in seconds
    });
    sessionConfig.store = redisStore;
    console.log('Using Redis session store');
} else {
    console.log('Using default MemoryStore for sessions');
}

app.use(session(sessionConfig));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);
app.use(securityMiddleware);

// Serve static files with correct MIME types
app.use(express.static(path.join(__dirname, '../client'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        port: config.port,
        env: config.nodeEnv,
        redisConnected: !!redisClient?.isReady,
        sessionStore: redisClient?.isReady ? 'redis' : 'memory'
    });
});

// Session management endpoints
app.post('/api/session', (req, res) => {
    if (!req.session.id) {
        req.session.regenerate((err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to create session' });
            }
            res.json({ sessionId: req.session.id });
        });
    } else {
        res.json({ sessionId: req.session.id });
    }
});

app.delete('/api/session', (req, res) => {
    if (req.session) {
        openaiService.clearSession(req.session.id);
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to destroy session' });
            }
            res.status(204).end();
        });
    } else {
        res.status(404).json({ error: 'No session found' });
    }
});

// OpenAI endpoint with input validation
app.post('/api/openai', validateInput, async (req, res) => {
    if (!req.session.id) {
        return res.status(401).json({ error: 'No session found' });
    }

    try {
        const response = await openaiService.generateResponse(req.body.question, req.session.id);
        res.json({ data: response });
    } catch (error) {
        console.error('Error processing request:', error);

        if (error.message.includes('Rate limit exceeded')) {
            return res.status(429).json({ 
                error: error.message,
                retryAfter: error.retryAfter || 60
            });
        }

        res.status(500).json({ error: error.message });
    }
});

// Offline support - Service Worker
app.get('/service-worker.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/service-worker.js'));
});

// Fallback route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use(errorHandler);

// Cleanup function for Redis connection
const cleanup = async () => {
    if (redisClient?.isReady) {
        await redisClient.quit();
        console.log('Redis connection closed');
    }
    process.exit(0);
};

// Start server
app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
}).on('error', (error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
});

// Handle cleanup
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    cleanup().then(() => process.exit(1));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    cleanup().then(() => process.exit(1));
});

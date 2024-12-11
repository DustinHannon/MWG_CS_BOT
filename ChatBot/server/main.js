import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import openaiService from './services/openaiService.js';
import { errorHandler } from './middleware/errorHandler.js';
import { securityMiddleware } from './middleware/security.js';
import config from './config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'", "https://api.openai.com"],
            fontSrc: ["'self'", 'cdnjs.cloudflare.com'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

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
app.use(limiter);
app.use(securityMiddleware);

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        port: config.port,
        env: config.nodeEnv
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

// OpenAI endpoint
app.post('/api/openai', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'Question is required' });
    }

    if (!req.session.id) {
        return res.status(401).json({ error: 'No session found' });
    }

    try {
        const response = await openaiService.generateResponse(question, req.session.id);
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

// Start server
app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
}).on('error', (error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

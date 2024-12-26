/**
 * Main Server Entry Point (main.js)
 * 
 * This is the core server file that sets up and runs the Express.js server for the Morgan White Group ChatBot.
 * It handles all the server configuration, middleware setup, and route definitions.
 * 
 * Key responsibilities:
 * - Server initialization and configuration
 * - Security middleware setup (helmet, CORS, rate limiting)
 * - Session management
 * - API endpoint definitions
 * - Static file serving
 * - Error handling
 * 
 * The server provides several key endpoints:
 * - /health: Health check endpoint for monitoring server status
 * - /api/session: Session management (creation and deletion)
 * - /api/openai: ChatGPT integration for handling chat requests
 * - Static file serving for the client application
 * 
 * Related files:
 * - /server/services/openaiService.js: Handles OpenAI API integration
 * - /server/middleware/security.js: Security middleware
 * - /server/middleware/errorHandler.js: Error handling
 * - /server/config/config.js: Configuration settings
 */

// Essential dependencies for server functionality
// Express is our web framework for creating and managing the HTTP server
import express from 'express';
// Path helps with file system operations and directory paths
import path from 'path';
// fileURLToPath converts file URLs to file paths (needed for ES modules)
import { fileURLToPath } from 'url';
// Rate limiting prevents API abuse by limiting requests per IP
import rateLimit from 'express-rate-limit';
// Helmet adds security headers to protect against common vulnerabilities
import helmet from 'helmet';
// Compression reduces response size for better performance
import compression from 'compression';
// Session handling for maintaining user state
import session from 'express-session';
// CORS enables cross-origin requests with security controls
import cors from 'cors';
// Crypto for generating secure random values
import crypto, { createHash } from 'crypto';

// Custom services and middleware imports
import openaiService from './services/openaiService.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { securityMiddleware, validateInput } from './middleware/security.js';
import config from './config/config.js';

// ES modules compatibility: Convert import.meta.url to __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express application
const app = express();

// Security middleware configuration
// Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet({
    // Content Security Policy
    contentSecurityPolicy: {
        directives: {
            ...config.csp.directives
        }
    },
    // Cross-Origin settings
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Force HTTPS
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    // Prevent MIME type sniffing
    noSniff: true,
    // XSS Protection
    xssFilter: true,
    // Disable download prompts in old IE
    ieNoOpen: true,
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Disable Adobe Flash and PDFs cross-domain
    permittedCrossDomainPolicies: { permittedPolicies: 'none' }
}));

// CORS configuration for handling cross-origin requests
app.use(cors({
    ...config.cors,
    credentials: true,
    exposedHeaders: ['Content-Length', 'X-Request-Id']
}));

// Session secret generation
// In production, use a cryptographically secure random value
const sessionSecret = process.env.NODE_ENV === 'production' 
    ? crypto.randomBytes(32).toString('hex')
    : 'dev-secret-key';

// Session configuration for user state management
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false, // Changed to false for better security
    name: 'mwg_session', // Custom session name
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'strict',
        path: '/'
    }
}));

// Rate limiting configuration
// This implementation uses the built-in memory store to track IP-based rate limits
// The store maintains a hash table of IP addresses and their request counts
// Even if a bot creates multiple sessions, they'll still be limited by their IP
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        error: 'Too many requests from this IP',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,

    // Enhanced IP detection
    // This looks for IP address in various headers and falls back to req.ip
    // Useful when the app is behind a proxy/load balancer
    keyGenerator: (req) => {
        // Try to get real IP if behind a proxy
        const realIP = req.headers['x-real-ip'];
        const forwardedFor = req.headers['x-forwarded-for'];
        
        // Get raw IP and remove port number if present
        const rawIP = (forwardedFor ? forwardedFor.split(',')[0] : realIP) || req.ip;
        return rawIP.split(':')[0]; // Remove port number if present
    },

    // Handler for when rate limit is exceeded
    // This helps with monitoring potential abuse
    handler: (req, res) => {
        console.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many requests from this IP',
            retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
            code: 'RATE_LIMIT_EXCEEDED'
        });
    }
});

// Essential middleware setup
app.use(compression({ level: 6 })); // Compress responses
app.use(express.json({ limit: '10kb' })); // Parse JSON with size limit
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use('/api/', limiter); // Apply rate limiting to API routes
app.use(securityMiddleware);

// Static file serving configuration
app.use(express.static(path.join(__dirname, '../client'), {
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        // Set correct MIME types and caching headers
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        // Cache static assets for 1 day
        res.setHeader('Cache-Control', 'public, max-age=86400');
    }
}));

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        port: config.port,
        env: config.nodeEnv,
        sessionStore: 'memory',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    };
    res.status(200).json(healthData);
});

// Session management endpoints
// Create or retrieve session with IP tracking
app.post('/api/session', (req, res) => {
    // Get client IP using the same logic as rate limiter
    // Extract IP without port number
    const rawIP = (req.headers['x-forwarded-for'] 
        ? req.headers['x-forwarded-for'].split(',')[0] 
        : req.headers['x-real-ip']) || req.ip;
    const clientIP = rawIP.split(':')[0]; // Remove port number if present

    if (!req.session.id) {
        req.session.regenerate((err) => {
            if (err) {
                console.error('Session creation failed:', err);
                return res.status(500).json({ 
                    error: 'Failed to create session',
                    code: 'SESSION_CREATE_ERROR'
                });
            }

            // Store session metadata and save
            req.session.created = Date.now();
            req.session.ip = clientIP;
            req.session.userAgent = req.headers['user-agent'];
            req.session.lastActivity = Date.now();

            // Create session fingerprint for additional security
            const fingerprint = createHash('sha256')
                .update(`${clientIP}-${req.headers['user-agent']}-${req.session.id}`)
                .digest('hex');
            req.session.fingerprint = fingerprint;

            // Save session data
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('Session save failed:', saveErr);
                    return res.status(500).json({ 
                        error: 'Failed to save session',
                        code: 'SESSION_SAVE_ERROR'
                    });
                }

                console.log(`New session created: ${req.session.id} from IP: ${clientIP}`);
                
                res.json({ 
                    sessionId: req.session.id,
                    created: req.session.created,
                    fingerprint: fingerprint // Client should store and send this back
                });
            });
        });
    } else {
        // Verify session integrity
        const currentFingerprint = createHash('sha256')
            .update(`${clientIP}-${req.headers['user-agent']}-${req.session.id}`)
            .digest('hex');

        // Check if session has been hijacked
        if (req.session.fingerprint !== currentFingerprint) {
            console.warn(`Potential session hijacking attempt: ${req.session.id}`);
            console.warn(`Original IP: ${req.session.ip}, Current IP: ${clientIP}`);
            
            // Destroy suspicious session
            req.session.destroy(() => {
                res.status(401).json({
                    error: 'Session validation failed',
                    code: 'SESSION_INVALID'
                });
            });
            return;
        }

        // Update last activity and save
        req.session.lastActivity = Date.now();
        
        // Save session data
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error('Session save failed:', saveErr);
                return res.status(500).json({ 
                    error: 'Failed to save session',
                    code: 'SESSION_SAVE_ERROR'
                });
            }
            
            res.json({ 
                sessionId: req.session.id,
                created: req.session.created,
                fingerprint: req.session.fingerprint
            });
        });
    }
});

// Delete session endpoint
app.delete('/api/session', (req, res) => {
    if (req.session) {
        const sessionId = req.session.id;
        openaiService.clearSession(sessionId);
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ 
                    error: 'Failed to destroy session',
                    code: 'SESSION_DESTROY_ERROR'
                });
            }
            res.clearCookie('mwg_session');
            res.status(204).end();
        });
    } else {
        res.status(404).json({ 
            error: 'No session found',
            code: 'SESSION_NOT_FOUND'
        });
    }
});

// OpenAI chat endpoint with enhanced session validation
app.post('/api/openai', validateInput, async (req, res) => {
    // Session existence check
    if (!req.session.id) {
        return res.status(401).json({ 
            error: 'No session found',
            code: 'SESSION_REQUIRED'
        });
    }

    // Get current client IP without port number
    const rawIP = (req.headers['x-forwarded-for'] 
        ? req.headers['x-forwarded-for'].split(',')[0] 
        : req.headers['x-real-ip']) || req.ip;
    const clientIP = rawIP.split(':')[0]; // Remove port number if present

    // Verify session integrity
    const currentFingerprint = createHash('sha256')
        .update(`${clientIP}-${req.headers['user-agent']}-${req.session.id}`)
        .digest('hex');

    if (req.session.fingerprint !== currentFingerprint) {
        console.warn(`Potential session hijacking attempt in chat: ${req.session.id}`);
        console.warn(`Original IP: ${req.session.ip}, Current IP: ${clientIP}`);
        
        // Destroy suspicious session
        req.session.destroy(() => {
            res.status(401).json({
                error: 'Session validation failed',
                code: 'SESSION_INVALID'
            });
        });
        return;
    }

    // Update session activity timestamp and save
    req.session.lastActivity = Date.now();
    
    // Save session data
    await new Promise((resolve, reject) => {
        req.session.save((err) => {
            if (err) {
                console.error('Session save failed:', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });

    try {
        // Pass both session ID and IP for comprehensive tracking
        const response = await openaiService.generateResponse(
            req.body.question, 
            req.session.id,
            {
                ip: clientIP,
                userAgent: req.headers['user-agent'],
                sessionCreated: req.session.created
            }
        );

        res.json({ 
            data: response,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error processing request:', error);

        if (error.message.includes('Rate limit exceeded')) {
            return res.status(429).json({ 
                error: error.message,
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: error.retryAfter || 60
            });
        }

        // Enhanced error response with request tracking
        res.status(error.statusCode || 500).json({ 
            error: error.message,
            code: error.code || 'INTERNAL_ERROR',
            requestId: req.id,
            timestamp: new Date().toISOString()
        });
    }
});

// Service worker route for PWA support
app.get('/service-worker.js', (req, res) => {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, '../client/service-worker.js'));
});

// SPA fallback route for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Server initialization
const server = app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log('Using in-memory session store');
}).on('error', (error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Performing graceful shutdown...');
    server.close(() => {
        console.log('Server closed. Exiting process.');
        process.exit(0);
    });
});

// Global error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Attempt graceful shutdown
    server.close(() => {
        process.exit(1);
    });
    // Force shutdown after 30 seconds
    setTimeout(() => {
        process.exit(1);
    }, 30000);
});

// Unhandled promise rejection handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Log but don't exit for unhandled rejections
});

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import config from '../config/config.js';

// Enhanced security middleware setup
export const configureSecurityMiddleware = (app) => {
    // Basic security headers with Helmet
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: config.csp.directives
            },
            crossOriginEmbedderPolicy: false,
            crossOriginResourcePolicy: { policy: "cross-origin" }
        })
    );

    // Additional security headers
    app.use((req, res, next) => {
        // Strict Transport Security
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        
        // Prevent clickjacking
        res.setHeader('X-Frame-Options', 'DENY');
        
        // XSS protection
        res.setHeader('X-XSS-Protection', '1; mode=block');
        
        // Prevent MIME type sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // Referrer policy
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        
        // Feature policy
        res.setHeader('Permissions-Policy', 
            'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), accelerometer=()');

        next();
    });

    // CORS configuration
    app.use(cors(config.cors));

    // Rate limiting
    const limiter = rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.max,
        message: {
            error: 'Too many requests from this IP, please try again later.',
            code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                error: 'Too many requests from this IP, please try again later.',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
            });
        }
    });

    // Apply rate limiting to all routes
    app.use('/api/', limiter);

    // Validate content type middleware
    app.use('/api/', (req, res, next) => {
        if (req.method === 'POST' && !req.is('application/json')) {
            return res.status(415).json({
                error: 'Unsupported Media Type - API only accepts application/json',
                code: 'INVALID_CONTENT_TYPE'
            });
        }
        next();
    });

    // Request size limits
    app.use('/api/', (req, res, next) => {
        if (req.method === 'POST' && req.headers['content-length'] > 10 * 1024) { // 10KB limit
            return res.status(413).json({
                error: 'Request entity too large',
                code: 'REQUEST_TOO_LARGE'
            });
        }
        next();
    });
};

// Input validation middleware
export const validateInput = (req, res, next) => {
    const { question } = req.body;
    
    if (!question || typeof question !== 'string') {
        return res.status(400).json({ 
            error: 'Invalid input: question must be a non-empty string',
            code: 'INVALID_INPUT'
        });
    }
    
    if (question.length > 500) {
        return res.status(400).json({ 
            error: 'Invalid input: question exceeds maximum length of 500 characters',
            code: 'INPUT_TOO_LONG'
        });
    }
    
    // Check for potentially malicious content
    const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /data:/gi,
        /vbscript:/gi,
        /on\w+=/gi,
        /style\s*=\s*"[^"]*expression\s*\(/gi
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(question))) {
        return res.status(400).json({
            error: 'Invalid input: potentially malicious content detected',
            code: 'MALICIOUS_CONTENT'
        });
    }
    
    // Sanitize input
    req.body.question = question.trim();
    next();
};

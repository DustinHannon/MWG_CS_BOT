/**
 * Security Middleware (security.js)
 * 
 * This file contains critical security middleware functions that protect the application
 * from various types of attacks and validate user input. It's a crucial part of the
 * application's security infrastructure.
 * 
 * Key components:
 * 1. securityMiddleware: Adds security headers and request tracking
 * 2. validateInput: Validates and sanitizes user input to prevent attacks
 * 
 * Security measures implemented:
 * - HTTP Security Headers
 * - Request ID Generation
 * - Input Validation
 * - XSS Protection
 * - SQL Injection Prevention
 * - Command Injection Prevention
 * - Content Security Policy
 * - Permissions Policy
 * 
 * Note: Core security features like helmet, CORS, and rate limiting are configured
 * in the main server file (main.js) for better centralization of server-level security.
 * 
 * Related files:
 * - ../config/config.js: Security configuration settings
 * - ../middleware/errorHandler.js: Error handling for security violations
 */

// Import required security-related modules
import { createHash } from 'crypto';         // Cryptographic functions
import { ErrorCodes } from './errorHandler.js';  // Standardized error codes

/**
 * Enhanced security middleware that adds various security headers and protections.
 * This middleware runs on every request to ensure consistent security measures.
 * 
 * Note: Core security features (helmet, CORS, rate limiting) are configured in main.js.
 * This middleware adds additional security headers and request tracking.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const securityMiddleware = (req, res, next) => {
    // Generate unique request ID for tracking and debugging
    // Combines IP, timestamp, and random value for uniqueness
    req.id = createHash('sha256')
        .update(`${req.ip}-${Date.now()}-${Math.random()}`)
        .digest('hex')
        .substring(0, 32);
    res.setHeader('X-Request-Id', req.id);
    
    // Security Headers
    // Each header serves a specific security purpose:
    
    // HSTS: Force HTTPS connections
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Prevent clickjacking attacks
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Enable browser's XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Control DNS prefetching
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    
    // Prevent automatic file downloads
    res.setHeader('X-Download-Options', 'noopen');
    
    // Restrict Adobe Flash and PDF behavior
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Comprehensive Permissions Policy
    // Restricts access to browser features
    res.setHeader('Permissions-Policy', 
        'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), ' +
        'display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), ' +
        'execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), ' +
        'keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), ' +
        'payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), ' +
        'sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()');

    // Remove potentially revealing headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
};

/**
 * Enhanced input validation middleware that checks and sanitizes user input.
 * Protects against various injection attacks and malicious content.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const validateInput = (req, res, next) => {
    const { question } = req.body;
    
    // Basic type and existence validation
    if (!question || typeof question !== 'string') {
        return res.status(400).json({ 
            error: 'Invalid input: question must be a non-empty string',
            code: ErrorCodes.INVALID_INPUT
        });
    }
    
    // Length validation to prevent overflow attacks
    if (question.length > 500) {
        return res.status(400).json({ 
            error: 'Invalid input: question exceeds maximum length of 500 characters',
            code: ErrorCodes.INVALID_FORMAT
        });
    }

    // Empty input validation
    if (question.trim().length === 0) {
        return res.status(400).json({
            error: 'Invalid input: question cannot be empty',
            code: ErrorCodes.MISSING_FIELD
        });
    }
    
    // Malicious Content Detection
    // Each pattern checks for specific types of attacks
    const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,  // Script tags
        /javascript:/gi,                                         // JavaScript protocol
        /data:/gi,                                              // Data protocol
        /vbscript:/gi,                                          // VBScript protocol
        /on\w+=/gi,                                             // Event handlers
        /style\s*=\s*"[^"]*expression\s*\(/gi,                 // CSS expressions
        /@import/gi,                                            // CSS imports
        /<!entity/gi,                                           // XML entities
        /\[constructor\]/gi,                                    // Prototype pollution
        /(__proto__|prototype|constructor)\s*[=]/gi,            // Object prototype manipulation
        /<!\[cdata\[/gi,                                        // CDATA sections
        /\/\/\s*source\s*mapping/gi,                           // Source mapping
        /base64/gi,                                            // Base64 content
        /eval\s*\(/gi,                                         // Eval functions
        /function\s*\(/gi,                                     // Function constructors
        /setInterval|setTimeout/gi,                            // Timing functions
        /new\s+Function/gi,                                    // Function constructor
        /document\./gi,                                        // Document manipulation
        /window\./gi,                                          // Window manipulation
        /\[\s*symbol\s*\]/gi,                                 // Symbol access
        /\{\s*\[Symbol\./gi                                   // Symbol properties
    ];

    // Check for malicious patterns
    if (suspiciousPatterns.some(pattern => pattern.test(question))) {
        return res.status(400).json({
            error: 'Invalid input: potentially malicious content detected',
            code: ErrorCodes.INVALID_INPUT
        });
    }

    // SQL Injection Prevention
    // Checks for common SQL commands and patterns
    const sqlInjectionPatterns = [
        /(\b(select|insert|update|delete|drop|union|exec|declare|cast)\b)|(-{2})|(\b(or|and)\b\s+\w+\s*=\s*\w+)/gi
    ];

    if (sqlInjectionPatterns.some(pattern => pattern.test(question))) {
        return res.status(400).json({
            error: 'Invalid input: potential SQL injection detected',
            code: ErrorCodes.INVALID_INPUT
        });
    }

    // Command Injection Prevention
    // Checks for shell command patterns
    const commandInjectionPatterns = [
        /(\||;|`|&|\$\(|\${)/g
    ];

    if (commandInjectionPatterns.some(pattern => pattern.test(question))) {
        return res.status(400).json({
            error: 'Invalid input: potential command injection detected',
            code: ErrorCodes.INVALID_INPUT
        });
    }
    
    // Input Sanitization
    // Clean and normalize the input
    req.body.question = question
        .trim()                                    // Remove leading/trailing whitespace
        .normalize('NFKC')                         // Normalize Unicode characters
        .replace(/[\u200B-\u200D\uFEFF]/g, '');   // Remove zero-width characters
    
    next();
};

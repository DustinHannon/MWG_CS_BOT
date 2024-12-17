/**
 * Error Handler Middleware (errorHandler.js)
 * 
 * This file provides centralized error handling for the entire application. It includes
 * middleware for handling various types of errors, logging them appropriately, and
 * sending safe error responses back to clients.
 * 
 * Key components:
 * 1. errorHandler: Main error handling middleware
 * 2. notFoundHandler: Handles 404 (Not Found) errors
 * 3. APIError: Custom error class for application errors
 * 4. Helper functions for error message handling and sanitization
 * 
 * Features:
 * - Centralized error handling
 * - Environment-aware error responses (development vs production)
 * - Secure error logging with sensitive data redaction
 * - Standardized error format
 * - Request tracking with unique IDs
 * - Detailed logging in development
 * 
 * Related files:
 * - security.js: Security middleware that may throw errors
 * - config.js: Configuration settings
 */

/**
 * Main error handling middleware that processes all errors in the application.
 * Provides different levels of detail based on the environment and ensures
 * sensitive information is not leaked in error responses.
 * 
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const errorHandler = (err, req, res, next) => {
    // Normalize error properties for consistent handling
    const error = {
        message: err.message || 'An unexpected error occurred',
        code: err.code || 'INTERNAL_ERROR',
        statusCode: err.statusCode || 500,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        requestId: req.id,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        query: req.query,
        body: sanitizeErrorBody(req.body)
    };

    // Enhanced error logging with context
    // In development, includes stack trace and additional details
    console.error('Error:', {
        ...error,
        // Only include stack trace in development
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        // Additional context for debugging
        headers: sanitizeHeaders(req.headers),
        session: req.session ? {
            id: req.session.id,
            created: req.session.created
        } : null
    });

    // Prepare client-safe error response
    // Ensures sensitive information is not sent to the client
    const errorResponse = {
        error: process.env.NODE_ENV === 'development' 
            ? error.message 
            : getClientSafeMessage(error),
        code: error.code,
        requestId: error.requestId,
        timestamp: error.timestamp
    };

    // Add additional debug information in development
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = error.stack;
        errorResponse.context = {
            path: error.path,
            method: error.method
        };
    }

    // Send error response to client
    res.status(error.statusCode).json(errorResponse);
};

/**
 * Handles 404 (Not Found) errors with detailed logging.
 * Provides consistent error responses for missing resources.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const notFoundHandler = (req, res) => {
    const error = {
        message: 'Resource not found',
        code: 'NOT_FOUND',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        requestId: req.id,
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    // Log 404 errors with request details
    console.warn('404 Not Found:', {
        ...error,
        headers: sanitizeHeaders(req.headers),
        query: req.query
    });

    // Send standardized 404 response
    res.status(404).json({
        error: error.message,
        code: error.code,
        requestId: error.requestId,
        timestamp: error.timestamp
    });
};

/**
 * Custom error class for API-specific errors.
 * Provides a standardized way to create and handle application errors.
 * 
 * @class APIError
 * @extends Error
 */
export class APIError extends Error {
    /**
     * Creates a new APIError instance.
     * 
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     * @param {string} code - Error code for client handling
     * @param {Object} details - Additional error details
     */
    constructor(message, statusCode, code, details = {}) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Converts error to JSON format for response serialization.
     * 
     * @returns {Object} JSON representation of the error
     */
    toJSON() {
        return {
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}

/**
 * Maps internal error codes to client-safe error messages.
 * Ensures consistent and user-friendly error messages.
 * 
 * @param {Object} error - The error object
 * @returns {string} Client-safe error message
 */
function getClientSafeMessage(error) {
    // Map internal error codes to user-friendly messages
    const errorMessages = {
        'INTERNAL_ERROR': 'An unexpected error occurred. Please try again later.',
        'VALIDATION_ERROR': 'The provided data is invalid.',
        'AUTH_ERROR': 'Authentication failed.',
        'FORBIDDEN': 'You do not have permission to perform this action.',
        'NOT_FOUND': 'The requested resource was not found.',
        'RATE_LIMIT_EXCEEDED': 'Too many requests. Please try again later.',
        'BAD_REQUEST': 'The request could not be processed.',
        'SERVICE_UNAVAILABLE': 'The service is temporarily unavailable.',
        'NETWORK_ERROR': 'A network error occurred. Please check your connection.',
        'DATABASE_ERROR': 'A database error occurred. Please try again later.',
        'API_ERROR': 'An API error occurred. Please try again later.',
        'TIMEOUT': 'The request timed out. Please try again.',
        'INVALID_INPUT': 'The provided input is invalid.',
        'SESSION_ERROR': 'Session error. Please try logging in again.',
        'CONFIG_ERROR': 'Configuration error. Please contact support.'
    };

    return errorMessages[error.code] || errorMessages['INTERNAL_ERROR'];
}

/**
 * Sanitizes request headers for logging by removing sensitive information.
 * 
 * @param {Object} headers - Request headers
 * @returns {Object} Sanitized headers object
 */
function sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    // List of headers containing sensitive information
    const sensitiveHeaders = [
        'authorization',
        'cookie',
        'set-cookie',
        'x-auth-token',
        'api-key',
        'proxy-authorization'
    ];

    // Redact sensitive header values
    sensitiveHeaders.forEach(header => {
        if (sanitized[header]) {
            sanitized[header] = '[REDACTED]';
        }
    });

    return sanitized;
}

/**
 * Sanitizes request body for logging by removing sensitive information.
 * Recursively processes nested objects.
 * 
 * @param {Object} body - Request body
 * @returns {Object|undefined} Sanitized body object or undefined if body is empty
 */
function sanitizeErrorBody(body) {
    if (!body) return undefined;

    const sanitized = { ...body };
    // List of sensitive field names to redact
    const sensitiveFields = [
        'password',
        'token',
        'apiKey',
        'secret',
        'credentials',
        'credit_card',
        'ssn',
        'email',
        'phone'
    ];

    /**
     * Recursively sanitizes an object by redacting sensitive fields
     * 
     * @param {Object} obj - Object to sanitize
     * @returns {Object} Sanitized object
     */
    const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;

        Object.keys(obj).forEach(key => {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object') {
                obj[key] = sanitizeObject(obj[key]);
            }
        });

        return obj;
    };

    return sanitizeObject(sanitized);
}

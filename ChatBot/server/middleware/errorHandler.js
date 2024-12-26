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

// Define standard error codes for consistent error handling across the application
export const ErrorCodes = {
    // Server errors (500 range)
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    API_ERROR: 'API_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    CONFIG_ERROR: 'CONFIG_ERROR',
    
    // Client errors (400 range)
    BAD_REQUEST: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    SESSION_ERROR: 'SESSION_ERROR',
    
    // Network/Communication errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    
    // Authentication/Authorization errors
    AUTH_ERROR: 'AUTH_ERROR',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    
    // Input/Validation errors
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_FIELD: 'MISSING_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',
    
    // OpenAI specific errors
    OPENAI_API_ERROR: 'OPENAI_API_ERROR',
    OPENAI_RATE_LIMIT: 'OPENAI_RATE_LIMIT',
    OPENAI_CONTEXT_LENGTH: 'OPENAI_CONTEXT_LENGTH',
    
    // Session/State errors
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    SESSION_INVALID: 'SESSION_INVALID',
    SESSION_REQUIRED: 'SESSION_REQUIRED',
    SESSION_CREATE_ERROR: 'SESSION_CREATE_ERROR',
    SESSION_SAVE_ERROR: 'SESSION_SAVE_ERROR',
    SESSION_DESTROY_ERROR: 'SESSION_DESTROY_ERROR',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    
    // History/Data errors
    HISTORY_FETCH_ERROR: 'HISTORY_FETCH_ERROR',
    DATA_SYNC_ERROR: 'DATA_SYNC_ERROR',
    CACHE_ERROR: 'CACHE_ERROR',
    
    // Server State errors
    SERVER_START_ERROR: 'SERVER_START_ERROR',
    SERVER_SHUTDOWN_ERROR: 'SERVER_SHUTDOWN_ERROR',
    PROCESS_ERROR: 'PROCESS_ERROR',
    
    // Resource errors
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    RESOURCE_UNAVAILABLE: 'RESOURCE_UNAVAILABLE',
    RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
    
    // Security errors
    SECURITY_ERROR: 'SECURITY_ERROR',
    IP_VALIDATION_ERROR: 'IP_VALIDATION_ERROR',
    FINGERPRINT_MISMATCH: 'FINGERPRINT_MISMATCH',
    
    // Request errors
    REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
    REQUEST_INVALID: 'REQUEST_INVALID',
    REQUEST_TOO_LARGE: 'REQUEST_TOO_LARGE'
};

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
        code: err.code || ErrorCodes.INTERNAL_ERROR,
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

    // Enhanced error logging with full context for production
    console.log('\n=== Server Error Details ===');
    console.log('Time:', error.timestamp);
    console.log('Request ID:', error.requestId);
    console.log('Error Code:', error.code);
    console.log('Status Code:', error.statusCode);
    console.log('Message:', error.message);
    console.log('Stack Trace:', error.stack);
    console.log('Endpoint:', `${error.method} ${error.path}`);
    console.log('Session ID:', req.session?.id);
    console.log('User Agent:', error.userAgent);
    console.log('IP Address:', error.ip);
    console.log('Headers:', sanitizeHeaders(req.headers));
    console.log('Request Body:', sanitizeErrorBody(req.body));
    console.log('Query Params:', error.query);
    console.log('Route Params:', req.params);
    if (error.details) {
        console.log('Additional Details:', error.details);
    }
    console.log('========================\n');

    // Prepare client-safe error response
    // Ensures sensitive information is not sent to the client
    const errorResponse = {
        error: getClientSafeMessage(error),
        code: error.code,
        requestId: error.requestId,
        timestamp: error.timestamp
    };

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
        code: ErrorCodes.NOT_FOUND,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        requestId: req.id,
        ip: req.ip,
        userAgent: req.get('user-agent')
    };

    // Enhanced 404 error logging for production
    console.log('\n=== 404 Not Found ===');
    console.log('Time:', error.timestamp);
    console.log('Request ID:', error.requestId);
    console.log('Path:', error.path);
    console.log('Method:', error.method);
    console.log('IP Address:', error.ip);
    console.log('User Agent:', error.userAgent);
    console.log('Headers:', sanitizeHeaders(req.headers));
    console.log('Query Params:', req.query);
    console.log('Session ID:', req.session?.id);
    console.log('========================\n');

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
     * @param {string} code - Error code from ErrorCodes enum
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
        // Server errors
        [ErrorCodes.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again later.',
        [ErrorCodes.DATABASE_ERROR]: 'A database error occurred. Please try again later.',
        [ErrorCodes.API_ERROR]: 'An API error occurred. Please try again later.',
        [ErrorCodes.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable.',
        [ErrorCodes.CONFIG_ERROR]: 'Configuration error. Please contact support.',
        
        // Client errors
        [ErrorCodes.BAD_REQUEST]: 'The request could not be processed.',
        [ErrorCodes.UNAUTHORIZED]: 'Please log in to continue.',
        [ErrorCodes.FORBIDDEN]: 'You do not have permission to perform this action.',
        [ErrorCodes.NOT_FOUND]: 'The requested resource was not found.',
        [ErrorCodes.VALIDATION_ERROR]: 'The provided data is invalid.',
        [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later.',
        
        // Network/Communication errors
        [ErrorCodes.NETWORK_ERROR]: 'A network error occurred. Please check your connection.',
        [ErrorCodes.TIMEOUT]: 'The request timed out. Please try again.',
        
        // Authentication/Authorization errors
        [ErrorCodes.AUTH_ERROR]: 'Authentication failed.',
        [ErrorCodes.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
        [ErrorCodes.INVALID_TOKEN]: 'Invalid authentication token.',
        
        // Input/Validation errors
        [ErrorCodes.INVALID_INPUT]: 'The provided input is invalid.',
        [ErrorCodes.MISSING_FIELD]: 'Required field is missing.',
        [ErrorCodes.INVALID_FORMAT]: 'Invalid data format.',
        
        // OpenAI specific errors
        [ErrorCodes.OPENAI_API_ERROR]: 'Error communicating with AI service.',
        [ErrorCodes.OPENAI_RATE_LIMIT]: 'AI service rate limit exceeded.',
        [ErrorCodes.OPENAI_CONTEXT_LENGTH]: 'Input exceeds maximum length.',
        
        // Session/State errors
        [ErrorCodes.SESSION_ERROR]: 'Session error. Please try logging in again.',
        [ErrorCodes.SESSION_EXPIRED]: 'Your session has expired. Please refresh.',
        [ErrorCodes.SESSION_INVALID]: 'Invalid session. Please refresh.',
        [ErrorCodes.SESSION_REQUIRED]: 'Session required. Please refresh.',
        [ErrorCodes.SESSION_CREATE_ERROR]: 'Unable to create session. Please try again.',
        [ErrorCodes.SESSION_SAVE_ERROR]: 'Unable to save session. Please try again.',
        [ErrorCodes.SESSION_DESTROY_ERROR]: 'Unable to end session. Please try again.',
        [ErrorCodes.SESSION_NOT_FOUND]: 'Session not found. Please refresh.',

        // History/Data errors
        [ErrorCodes.HISTORY_FETCH_ERROR]: 'Unable to load message history.',
        [ErrorCodes.DATA_SYNC_ERROR]: 'Unable to sync data. Please try again.',
        [ErrorCodes.CACHE_ERROR]: 'Cache error. Please refresh.',

        // Server State errors
        [ErrorCodes.SERVER_START_ERROR]: 'Server startup error. Please try again later.',
        [ErrorCodes.SERVER_SHUTDOWN_ERROR]: 'Server is shutting down. Please try again later.',
        [ErrorCodes.PROCESS_ERROR]: 'Process error. Please try again.',

        // Resource errors
        [ErrorCodes.RESOURCE_NOT_FOUND]: 'Resource not found.',
        [ErrorCodes.RESOURCE_UNAVAILABLE]: 'Resource temporarily unavailable.',
        [ErrorCodes.RESOURCE_CONFLICT]: 'Resource conflict. Please try again.',

        // Security errors
        [ErrorCodes.SECURITY_ERROR]: 'Security error. Please try again.',
        [ErrorCodes.IP_VALIDATION_ERROR]: 'IP validation failed. Please try again.',
        [ErrorCodes.FINGERPRINT_MISMATCH]: 'Session validation failed. Please refresh.',

        // Request errors
        [ErrorCodes.REQUEST_TIMEOUT]: 'Request timed out. Please try again.',
        [ErrorCodes.REQUEST_INVALID]: 'Invalid request. Please try again.',
        [ErrorCodes.REQUEST_TOO_LARGE]: 'Request too large. Please reduce size.'
    };

    return errorMessages[error.code] || errorMessages[ErrorCodes.INTERNAL_ERROR];
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

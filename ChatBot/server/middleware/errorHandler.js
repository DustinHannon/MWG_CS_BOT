// Central error handling middleware
export const errorHandler = (err, req, res, next) => {
    // Log error details (in production, you'd want to use a proper logging service)
    console.error('Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        timestamp: new Date().toISOString(),
        requestId: req.id,
        path: req.path,
        method: req.method,
        ip: req.ip
    });

    // Determine status code
    const statusCode = err.statusCode || 500;

    // Prepare error response
    const errorResponse = {
        error: process.env.NODE_ENV === 'development' 
            ? err.message 
            : 'An unexpected error occurred',
        code: err.code || 'INTERNAL_ERROR',
        requestId: req.id
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
};

// 404 handler
export const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        code: 'NOT_FOUND',
        path: req.path
    });
};

// Custom error class for API errors
export class APIError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}

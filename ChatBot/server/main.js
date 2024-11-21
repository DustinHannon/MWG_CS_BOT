import express from 'express';
import * as path from 'path';
import bodyParser from 'body-parser';
import config from './config/config.js';
import { configureSecurityMiddleware } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import chatRoutes from './routes/chatRoutes.js';

// Initialize express app
export const app = express();

// Configure security middleware
configureSecurityMiddleware(app);

// Parse application/json request bodies with size limit
app.use(bodyParser.json({ limit: '10kb' }));

// Serve static files from client folder with proper headers
app.use(express.static(path.join(process.cwd(), 'client'), {
    setHeaders: (res, path) => {
        // Cache static assets
        if (path.endsWith('.js') || path.endsWith('.css')) {
            res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
        } else if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.ico')) {
            res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
        }
        
        // Security headers for static files
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Frame-Options', 'DENY');
        res.set('X-XSS-Protection', '1; mode=block');
    },
    // Enable Brotli/Gzip compression
    maxAge: '1y',
    etag: true,
    lastModified: true
}));

// Add request ID middleware
app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    next();
});

// Add basic logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log({
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            requestId: req.id,
            userAgent: req.get('user-agent'),
            ip: req.ip
        });
    });
    next();
});

// Register routes
app.use('/api', chatRoutes);

// Error handling
app.use(errorHandler);

// Handle 404 errors
app.use(notFoundHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`CORS origin: ${config.cors.origin}`);
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

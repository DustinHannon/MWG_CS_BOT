import express from 'express';
import { validateInput } from '../middleware/security.js';
import openaiService from '../services/openaiService.js';
import xss from 'xss';
import { APIError } from '../middleware/errorHandler.js';
import { enrichUserPromptWithContext } from '../utils.js';

const router = express.Router();

// Whitelist of allowed HTML tags for sanitization
const xssOptions = {
    whiteList: {
        div: [],
        p: [],
        ol: [],
        ul: [],
        li: [],
        strong: [],
        em: [],
        br: [],
        h1: [],
        h2: [],
        h3: []
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
};

// Chat endpoint with enhanced error handling and response caching
router.post('/openai', validateInput, async (req, res, next) => {
    const { question } = req.body;
    const cacheKey = `chat:${question}`;

    try {
        // Check cache (implementation would be added here)
        
        // Generate response
        const enrichedPrompt = enrichUserPromptWithContext(question);
        const response = await openaiService.generateResponse(enrichedPrompt);
        
        // Sanitize the HTML response
        const sanitizedHtml = xss(response, xssOptions);
        
        // Cache the response (implementation would be added here)
        
        // Set cache control headers
        res.set('Cache-Control', 'private, max-age=300'); // Cache for 5 minutes
        
        res.json({ 
            data: sanitizedHtml,
            requestId: req.id
        });
    } catch (error) {
        // Convert to APIError for consistent error handling
        next(new APIError(
            'Failed to process chat request',
            500,
            'CHAT_PROCESSING_ERROR'
        ));
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

export default router;

import express from 'express'
import * as path from 'path'
import bodyParser from 'body-parser'
import fetch from 'node-fetch'
import * as dotenv from 'dotenv'
import {enrichUserPromptWithContext} from "./utils.js";
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import cors from 'cors'
import xss from 'xss'

// load environment variables from .env file
dotenv.config();

// Validate required environment variables
if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required but not set in environment variables');
    process.exit(1);
}

// initialize express app
export const app = express()

// Security middleware with focused CSP
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                imgSrc: ["'self'", "https://morganwhite.com", "https://*.morganwhite.com", "data:", "blob:"],
                connectSrc: ["'self'", "https://api.openai.com"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
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
    })
);

// Configure CORS
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.PRODUCTION_DOMAIN
        : 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// parse application/json request bodies with size limit
app.use(bodyParser.json({ limit: '10kb' }));

// serve static files from client folder with proper headers
app.use(express.static(path.join(process.cwd(), 'client'), {
    setHeaders: (res, path) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Frame-Options', 'DENY');
        res.set('X-XSS-Protection', '1; mode=block');
    }
}));

// Clean bot response of any HTML formatting attempts
function cleanBotResponse(text) {
    // Remove any HTML link attributes the bot might try to add
    return text.replace(/target="[^"]*"/g, '')
              .replace(/rel="[^"]*"/g, '')
              .replace(/class="[^"]*"/g, '')
              .replace(/aria-label="[^"]*"/g, '')
              // Clean up any leftover HTML formatting attempts
              .replace(/<a[^>]*>(.*?)<\/a>/g, '$1')
              // Remove any empty HTML attributes
              .replace(/\s+[a-zA-Z-]+=""/g, '')
              // Clean up extra spaces
              .replace(/\s+/g, ' ');
}

// Input validation middleware
const validateInput = (req, res, next) => {
    const { question } = req.body;
    
    if (!question || typeof question !== 'string') {
        return res.status(400).json({ 
            error: 'Invalid input: question must be a non-empty string' 
        });
    }
    
    if (question.length > 500) {
        return res.status(400).json({ 
            error: 'Invalid input: question exceeds maximum length of 500 characters' 
        });
    }
    
    // Sanitize only the user input
    req.body.sanitizedQuestion = xss(question.trim());
    next();
};

// create http post endpoint that accepts user input and sends it to OpenAI API
app.post('/api/openai', validateInput, async (req, res) => {
    const { sanitizedQuestion } = req.body;

    try {
        // send a request to the OpenAI API with the user's prompt
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: enrichUserPromptWithContext(sanitizedQuestion) }
                ],
                max_tokens: 600,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || 'OpenAI API request failed');
        }

        const data = await response.json();
        
        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format from OpenAI API');
        }

        // Clean the bot's response before sending it to the client
        const cleanedResponse = cleanBotResponse(data.choices[0].message.content);
        res.json({ data: cleanedResponse });
    } catch (error) {
        console.error('Error:', error);
        
        // Don't expose internal error messages to client
        const clientError = {
            error: 'An error occurred while processing your request',
            code: error.name === 'FetchError' ? 'API_ERROR' : 'INTERNAL_ERROR'
        };
        
        res.status(500).json(clientError);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
    });
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        code: 'NOT_FOUND'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

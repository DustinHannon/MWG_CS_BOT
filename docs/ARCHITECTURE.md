# Architecture Documentation

## System Overview
MWG CS BOT is a client-server application that provides AI-powered customer service chat functionality. The system uses OpenAI's language models to generate contextually relevant responses to customer inquiries, implementing security measures, caching mechanisms, and error handling.

The application is deployed on Vercel with the Express API running as a serverless function and static files served via Vercel's CDN.

## Architecture Diagram
```
┌─────────────────┐     ┌────────────────────┐     ┌─────────────┐
│   Web Client    │────▶│  Vercel Serverless  │────▶│  OpenAI API │
│  (JavaScript)   │◀────│  Function (Express) │◀────│             │
└─────────────────┘     └────────────────────┘     └─────────────┘
        │                        │
        │                        │
┌───────────────┐    ┌─────────────────┐    ┌────────────────┐
│Service Worker │    │ Memory Storage  │    │  Vercel CDN    │
│(Static Cache) │    │ - Sessions      │    │ (Static Files) │
└───────────────┘    │ - Rate Limits   │    └────────────────┘
                     │ - Response Cache│
                     └─────────────────┘
```

## Deployment Architecture

### Vercel Configuration
- **Entry point:** `api/index.js` re-exports the Express app from `ChatBot/server/main.js`
- **Static files:** `ChatBot/client/` is copied to `public/` at build time via `vercel.json` buildCommand
- **Routing:** `vercel.json` rewrites `/api/*` and `/health` to the serverless function
- **All other routes** are served as static files from the CDN

### Key Vercel Adaptations
- `express.static()` is disabled on Vercel (wrapped in `if (!process.env.VERCEL)`)
- `app.listen()` is disabled on Vercel (Express app is exported for serverless runtime)
- Service worker route and SPA fallback are local-dev only
- Session secret uses `SESSION_SECRET` env var for consistency across serverless instances

## Components

### 1. Client-Side Components

#### Main Application (client/app/index.js)
- Initializes client-side modules
- Handles module dependencies
- Service worker registration
- Global error handling
- Online/offline status detection
- Manages session initialization
- Provides update notifications

#### Chat UI Module (client/app/modules/chatUI.js)
- Manages message display and queue-based processing
- Implements message history lazy loading with pagination
- Provides copy functionality for bot messages
- ARIA attributes for accessibility
- Manages scroll behavior
- Handles error display with retry buttons
- Markdown and link formatting

#### Form Handler Module (client/app/modules/formHandler.js)
- Manages form submissions and validation
- Client-side input sanitization (XSS patterns, zero-width chars)
- Retry logic with exponential backoff (max 3 retries)
- Keyboard shortcuts (Enter to send, Shift+Enter for newline, Escape to clear)
- Paste event sanitization
- Textarea auto-resizing

#### Theme Handler Module (client/app/modules/themeHandler.js)
- Light/dark theme switching with smooth transitions
- Persists theme preference in localStorage
- Syncs with system color scheme preference
- Updates mobile browser theme color meta tag
- Keyboard accessible toggle

### 2. Server-Side Components

#### Main Server (server/main.js)
- Express.js server configuration
- Exports app for Vercel serverless deployment
- Security middleware setup (helmet, CORS)
- Session management with env-based secret
- Rate limiting (100 req/15min per IP on all /api/ routes)
- Static file serving (local dev only)
- API endpoint definitions
- Health check endpoint
- Graceful shutdown handling (local dev only)

#### OpenAI Service (server/services/openaiService.js)
- Manages OpenAI API communication via node-fetch
- In-memory response caching (SHA-256 key: session + prompt, 1-hour TTL)
- Dual-layer rate limiting:
  - Session: 50 req/hr, 100K tokens/hr
  - IP: 100 req/hr, 200K tokens/hr
- Request throttling (1s delay between requests per session)
- Session data and message history storage
- Automatic cleanup of expired sessions (2-hour expiry)
- Token usage tracking

#### Security Middleware (server/middleware/security.js)
- Security headers (HSTS, X-Frame-Options, X-XSS-Protection, etc.)
- Permissions Policy (restricts browser features)
- Request ID generation (SHA-256 hash)
- Input validation: XSS, SQL injection, command injection pattern detection
- Unicode normalization and zero-width character removal

#### Error Handler (server/middleware/errorHandler.js)
- Centralized error handling middleware
- APIError custom class with status codes and error codes
- Client-safe error message mapping
- Sensitive data redaction in logs (headers, body fields)
- 404 handler with logging

#### Configuration (server/config/config.js)
- Environment variable loading via dotenv
- CORS: morganwhite.com + vercel.app domains
- CSP: self, Google Fonts, OpenAI API, MWG domains, Vercel domains
- Rate limit settings
- OpenAI model and token configuration
- Config validation on startup

#### Context Enrichment (server/utils.js)
- Wraps user prompts with comprehensive MWG company context
- Includes: company info, divisions, products, portals, contact details
- Enforces response guidelines: no casual chat, no medical/legal advice, MWG-scope only
- Prompt validation (type, length)

## Data Flow

### Message Submission Flow
```
1. User Input
   └─▶ Client-side validation & sanitization (formHandler.js)
       └─▶ POST /api/openai
           └─▶ Security middleware (headers, request ID)
               └─▶ Input validation middleware (XSS, SQL, command injection)
                   └─▶ Session validation
                       └─▶ Rate limit checks (session + IP)
                           └─▶ Cache check (SHA-256 key)
                               └─▶ Request delay enforcement
                                   └─▶ Context enrichment (utils.js)
                                       └─▶ OpenAI API request
                                           └─▶ Response caching
                                               └─▶ Rate limit counter update
                                                   └─▶ Client display
```

### Session Management Flow
```
1. Page Load
   └─▶ POST /api/session
       └─▶ Session creation or retrieval
           └─▶ Fingerprint generation (IP + UA + session ID)
               └─▶ IP tracking
                   └─▶ Cookie set (HTTP-only, secure, strict SameSite)
```

## Security Implementation

### Session Security
- Session creation with SHA-256 fingerprinting (IP + User-Agent + session ID)
- IP tracking and change detection
- HTTP-only, secure, strict SameSite cookies
- 24-hour cookie max age
- `SESSION_SECRET` environment variable for consistent signing across instances

### Rate Limiting
- Express-level: 100 requests per 15-minute window per IP
- Service-level dual-layer:
  - Session: 50 requests/hour, 100K tokens/hour
  - IP: 100 requests/hour, 200K tokens/hour
- Automatic cleanup of expired rate limit entries

### Request Security
- Helmet security headers
- CORS restricted to known domains (morganwhite.com, vercel.app)
- CSP with specific source allowlists
- Input validation against XSS, SQL injection, command injection patterns
- Unicode normalization and zero-width character stripping

## Serverless Considerations

### Ephemeral State
In-memory stores (sessions, rate limits, response cache) do not persist across serverless function cold starts. This means:
- Sessions may be lost on cold starts (user gets a new session)
- Rate limits reset per instance (less strict in practice)
- Response cache is per-instance (more API calls but still functional)

### Mitigations
- Vercel Fluid Compute keeps functions warm, reducing cold starts
- `SESSION_SECRET` env var ensures cookies remain valid across instances
- The application degrades gracefully - users simply get a new session

## Performance Optimizations

### Client-Side
- Message queue for sequential processing
- Lazy loading message history with scroll-based pagination
- PerformanceObserver monitoring (long tasks, layout shifts)
- Service worker with multi-strategy caching (network-first, cache-first, stale-while-revalidate)
- Debounced input handling (300ms)

### Server-Side
- In-memory response cache with 1-hour TTL and automatic cleanup
- Request throttling (1s between requests per session)
- Compression middleware (level 6)
- JSON body size limit (10kb)

### Vercel-Specific
- Static files served via Vercel CDN (not through Express)
- Single serverless function for all API routes
- Fluid Compute for optimal scaling and warm starts

# Architecture Documentation

## System Overview
MWG CS BOT is a client-server application that provides AI-powered customer service chat functionality. The system uses Azure AI Foundry's GPT-5.4 model to generate contextually relevant responses to customer inquiries, implementing security measures, caching mechanisms, and error handling.

The application is deployed on Vercel with the Express API running as a serverless function and static files served via Vercel's CDN.

## Architecture Diagram
```
┌─────────────────┐     ┌────────────────────┐     ┌──────────────────┐
│   Web Client    │────▶│  Vercel Serverless  │────▶│  Azure AI        │
│  (JavaScript)   │◀────│  Function (Express) │◀────│  Foundry (GPT-5.4│)
└─────────────────┘     └────────────────────┘     └──────────────────┘
        │                        │                          │
        │                        │                          │
┌───────────────┐    ┌─────────────────┐    ┌────────────────┐    ┌──────────────┐
│Service Worker │    │ Memory Storage  │    │  Vercel CDN    │    │ Better Stack │
│(Static Cache) │    │ - Sessions      │    │ (Static Files) │    │ (Log Drain)  │
└───────────────┘    │ - Rate Limits   │    └────────────────┘    └──────────────┘
                     │ - Response Cache│
                     └─────────────────┘
```

## Deployment Architecture

### Vercel Configuration
- **Entry point:** `api/index.js` re-exports the Express app from `ChatBot/server/main.js`
- **Static files:** `ChatBot/client/` is copied to `public/` at build time via `vercel.json` buildCommand
- **Routing:** `vercel.json` rewrites `/api/*` and `/health` to the serverless function
- **All other routes** are served as static files from the CDN
- **Install command:** `npm install && cd ChatBot && npm install` (root deps needed for serverless module resolution)

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
- Chat bubble layout: bot messages left-aligned with logo avatar, user messages right-aligned with accent-colored bubble
- Copy button on all messages with icon swap animation (copy → checkmark) and tooltip
- Typing indicator with bot avatar and pulsing dots
- Message slide-in animations (translateY + opacity)
- Manages message display and queue-based processing
- Implements message history lazy loading with pagination
- ARIA attributes for accessibility
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
- Sun/moon SVG icon toggle button
- Persists theme preference in localStorage
- Syncs with system color scheme preference
- Updates mobile browser theme color meta tag
- Keyboard accessible toggle

#### Frontend Design
- **Aesthetic:** Glassmorphism — frosted glass panels (backdrop-filter blur) over MWG background image
- **Typography:** DM Sans (body) + Outfit (headings) from Google Fonts
- **Colors:** MWG blue (#1B4B8F) accent, light mode with visible bg image, dark mode with deep slate tones (#0f172a, #1e293b)
- **Layout:** Chat bubbles with avatars, floating glass input bar, glass pill link buttons, glass header/footer
- **Animations:** Message slide-in (translateY), typing pulse, hover states, focus glow on input

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

#### AI Service (server/services/openaiService.js)
- Manages Azure AI Foundry API communication via node-fetch
- Endpoint: `https://AZ-UTIL-AI.openai.azure.com/openai/v1/chat/completions`
- Model: GPT-5.4 (configurable via `AZURE_AI_DEPLOYMENT` env var)
- Uses `max_completion_tokens` parameter (required by GPT-5.4)
- Authentication via Bearer token (`AZURE_AI_KEY`)
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
- CSP: self, Google Fonts, Azure AI endpoint, MWG domains, Vercel domains
- Rate limit settings
- AI model deployment and token configuration
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
                                       └─▶ Azure AI Foundry API request
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

## Monitoring & Logging
- Runtime logs streamed to Better Stack via Vercel log drain
- Full untruncated error logs with stack traces available in Better Stack UI
- Health check endpoint at `/health` for uptime monitoring

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

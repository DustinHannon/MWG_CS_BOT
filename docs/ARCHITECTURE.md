# Architecture Documentation

## System Overview
MWG CS BOT is a client-server application that provides AI-powered customer service chat functionality. The system uses OpenAI's language models to generate contextually relevant responses to customer inquiries, implementing security measures, caching mechanisms, and error handling.

## Architecture Diagram
```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   Web Client    │────▶│  Web Server  │────▶│  OpenAI API │
│  (JavaScript)   │◀────│   (Node.js)  │◀────│             │
└─────────────────┘     └──────────────┘     └─────────────┘
        │                      │
        │                      │
┌───────────────┐    ┌─────────────────┐
│Service Worker │    │ Memory Storage  │
│(Static Cache) │    │ - Sessions     │
└───────────────┘    │ - Rate Limits  │
                     │ - Response Cache│
                     └─────────────────┘
```

## Components

### 1. Client-Side Components

#### Main Application (index.js)
- Initializes client-side modules
- Handles module dependencies
- Basic service worker registration
- Basic global error handling
- Basic online/offline status detection
- Manages session initialization
- Provides update notifications

#### Chat UI Module (chatUI.js)
- Manages message display and animations
- Handles sequential message processing
- Implements message history loading
- Provides copy functionality
- Basic ARIA attributes for error messages
- Manages scroll behavior
- Handles error display
- Basic markdown and link formatting

#### Form Handler Module (formHandler.js)
- Manages form submissions and validation
- Basic client-side error handling
- Basic retry logic with backoff
- Performs input validation and sanitization
- Handles keyboard shortcuts and paste events
- Manages textarea auto-resizing

#### Theme Handler Module (themeHandler.js)
- Manages light/dark theme switching
- Persists theme preference in localStorage
- Syncs with system color scheme
- Updates mobile browser theme color
- Basic keyboard support for toggle
- Basic error handling

### 2. Server-Side Components

#### Main Server (main.js)
- Express.js server configuration
- Security middleware setup (helmet, CORS)
- Session management
- Rate limiting implementation
- Static file serving
- API endpoint definitions
- Basic error handling
- Basic health check endpoint

#### OpenAI Service (openaiService.js)
- Manages OpenAI API communication
- Implements in-memory response caching
- Handles dual-layer rate limiting (session & IP-based)
- Manages session data and history
- Basic error handling with retries
- Implements request throttling
- Tracks token usage
- Performs automatic cache cleanup

#### Security Middleware (security.js)
- Implements security headers
- Manages CORS policies
- Basic input validation
- Basic request sanitization
- Implements session fingerprinting

#### Error Handler (errorHandler.js)
- Centralizes error handling
- Standardizes error responses
- Provides error codes and messages
- Basic console error logging

## Data Flow

### 1. Message Submission Flow
```
1. User Input
   └─▶ Client-side validation (formHandler.js)
       └─▶ Security middleware validation
           └─▶ Session validation
               └─▶ Rate limit checks (IP & Session)
                   └─▶ Cache check
                       └─▶ OpenAI API request
                           └─▶ Response processing
                               └─▶ Cache update
                                   └─▶ Client display
```

### 2. Session Management Flow
```
1. New Connection
   └─▶ Session creation
       └─▶ Session fingerprint generation
           └─▶ IP address tracking
               └─▶ Rate limit initialization
                   └─▶ Last activity timestamp
                       └─▶ Cleanup on timeout
```

## Security Implementation

### 1. Session Security
- Session creation with fingerprinting
- Basic IP tracking and validation
- Session timeout handling
- Last activity timestamp tracking
- Automatic session cleanup

### 2. Rate Limiting
- Dual-layer rate limiting:
  * Session-based limits (requests & tokens)
  * IP-based limits (shared across sessions)
- Automatic cleanup of expired limits
- Token usage tracking
- Request throttling

### 3. Request Security
- Helmet security headers
- CORS configuration
- Basic input validation
- Basic request sanitization
- Basic error sanitization

## Performance Optimizations

### 1. Client-Side
- Sequential message processing
- Message history loading
- Basic performance monitoring
  * Long task detection
  * Layout shift monitoring
- Basic service worker registration
- Basic static file caching

### 2. Server-Side
- Response caching with time-based expiration
- Request throttling through rate limits
- Automatic session data cleanup
- Basic static file serving with cache headers

### 3. Caching Strategy
- In-memory response cache with automatic cleanup
- Time-based cache invalidation
- Session-specific response caching
- Cache key generation with cryptographic hashing

## Error Handling

### 1. Client-Side
- Basic global error catching
- Basic unhandled rejection handling
- Error message display in UI
- Basic retry logic
- Online/offline status handling

### 2. Server-Side
- Error response standardization
- Basic error classification
- Basic request tracking
- Console-based error logging
- Rate limit error handling

## Development Guidelines

### 1. Code Organization
- Modular architecture
- Clear separation of concerns
- Consistent error handling
- Code documentation with JSDoc comments

### 2. Security Practices
- Input validation
- Session security
- Rate limiting
- Error sanitization

### 3. Performance
- Response caching with expiration
- Session data cleanup
- Rate limit management
- Basic static file caching

### 4. Development Tools
- Console-based error logging
- Basic performance monitoring (long tasks, layout shifts)
- Development-mode debugging

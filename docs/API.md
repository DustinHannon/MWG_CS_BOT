# API Documentation

## Overview
The MWG CS BOT API provides endpoints for chat functionality using OpenAI's language models. This document details all available endpoints, their request/response formats, and error handling.

## Base URL
```
Production: https://<your-vercel-project>.vercel.app/api
Local: http://localhost:8080/api
```

## Authentication
All API requests require session-based authentication. Sessions are managed through secure HTTP cookies.

## Endpoints

### POST /api/session
Create or retrieve a session. Sets a secure HTTP-only cookie for subsequent requests.

#### Response
```json
{
  "sessionId": string,
  "created": number,
  "fingerprint": string
}
```

### DELETE /api/session
Destroy the current session and clear associated data.

#### Response
Status 204 (No Content) on success.

### POST /api/openai
Send a chat message and receive an AI-generated response.

#### Request
```json
{
  "question": string  // User's message (required, max 500 characters)
}
```

#### Response
```json
{
  "data": string,       // AI-generated response
  "timestamp": string   // ISO 8601 timestamp
}
```

#### Error Response
```json
{
  "error": string,     // Human-readable error message
  "code": string,      // Error code
  "requestId": string, // Request identifier
  "timestamp": string  // ISO 8601 timestamp
}
```

### GET /api/messages
Retrieve chat history with pagination.

#### Query Parameters
- page: number (default: 1) - Page number
- limit: number (default: 20, max: 50) - Messages per page

#### Response
```json
{
  "messages": [
    {
      "type": string,     // "user" or "bot"
      "content": string,  // Message content
      "timestamp": string // ISO 8601 timestamp
    }
  ],
  "hasMore": boolean,    // Whether more messages exist
  "currentPage": number, // Current page number
  "totalMessages": number // Total message count
}
```

### GET /health
Health check endpoint for monitoring.

#### Response
```json
{
  "status": "healthy",
  "timestamp": string,
  "port": number,
  "env": string,
  "sessionStore": "memory",
  "uptime": number,
  "memory": object
}
```

## Rate Limits

### Session-based Limits
- 50 requests per hour per session
- 100,000 tokens per hour per session

### IP-based Limits
- 100 requests per hour per IP
- 200,000 tokens per hour per IP

### Express Rate Limiter
- 100 requests per 15-minute window per IP (applies to all /api/ routes)

Rate limit responses include:
- Status code: 429
- Error code: RATE_LIMIT_EXCEEDED
- retryAfter: Seconds until limit resets

## Error Codes

### Server Errors (500 range)
- INTERNAL_ERROR: Unexpected server error
- API_ERROR: Generic API error
- SERVICE_UNAVAILABLE: Service temporarily down
- CONFIG_ERROR: Server configuration error

### Client Errors (400 range)
- BAD_REQUEST: Invalid request format
- UNAUTHORIZED: Authentication required
- FORBIDDEN: Permission denied
- NOT_FOUND: Resource not found
- VALIDATION_ERROR: Invalid input data
- RATE_LIMIT_EXCEEDED: Rate limit reached

### Input/Validation Errors
- INVALID_INPUT: Invalid input format
- MISSING_FIELD: Required field missing
- INVALID_FORMAT: Wrong data format

### OpenAI Specific Errors
- OPENAI_API_ERROR: OpenAI API error
- OPENAI_RATE_LIMIT: OpenAI rate limit hit
- OPENAI_CONTEXT_LENGTH: Input too long

### Session Errors
- SESSION_ERROR: Generic session error
- SESSION_EXPIRED: Session timeout
- SESSION_INVALID: Invalid session
- SESSION_REQUIRED: No session found
- SESSION_CREATE_ERROR: Failed to create session
- SESSION_SAVE_ERROR: Failed to save session
- SESSION_DESTROY_ERROR: Failed to destroy session

## Response Headers
All responses include:
- X-Request-ID: Unique request identifier
- Security headers via Helmet (HSTS, X-Frame-Options, X-Content-Type-Options, etc.)

## Deployment Notes
- The API runs as a Vercel serverless function via `api/index.js`
- In-memory session and rate limit stores are ephemeral across serverless instances
- `SESSION_SECRET` environment variable is required for consistent session cookies

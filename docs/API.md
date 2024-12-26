# API Documentation

## Overview
The MWG CS BOT API provides endpoints for chat functionality using OpenAI's language models. This document details all available endpoints, their request/response formats, and error handling.

## Base URL
```
Production: https://mwgcsbot-apdcavd6ameddtdb.southcentralus-01.azurewebsites.net/api
Local: http://localhost:3000/api
```

## Authentication
All API requests require session-based authentication. Sessions are managed through secure HTTP cookies.

## Endpoints

### POST /openai
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
  "data": string,    // AI-generated response
  "requestId": string,  // Unique request identifier
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

### GET /messages
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

## Rate Limits

### Session-based Limits
- 50 requests per hour per session
- 100,000 tokens per hour per session

### IP-based Limits
- 100 requests per hour per IP
- 200,000 tokens per hour per IP

Rate limit responses include:
- Status code: 429
- Retry-After header: Seconds until limit resets
- Error code: RATE_LIMIT_EXCEEDED

## Error Codes

### Server Errors (500 range)
- INTERNAL_ERROR: Unexpected server error
- DATABASE_ERROR: Database operation failed
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

### Network/Communication Errors
- NETWORK_ERROR: Connection failed
- TIMEOUT: Request timeout

### Authentication Errors
- AUTH_ERROR: Authentication failed
- TOKEN_EXPIRED: Session expired
- INVALID_TOKEN: Invalid auth token

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

## Response Headers
All responses include:
- X-Request-ID: Unique request identifier
- X-RateLimit-Limit: Request limit per hour
- X-RateLimit-Remaining: Remaining requests
- X-RateLimit-Reset: Timestamp when limit resets

# MWG CS BOT

Morgan White Group - Customer Service Chat Bot using OpenAI models

## Description

MWG CS BOT is a customer service chatbot solution developed for Morgan White Group. It leverages OpenAI's language models to provide automated responses to customer inquiries through a web-based chat interface. The system uses a client-server architecture with a responsive web frontend and Node.js backend to deliver real-time chat capabilities.

## Core Features

- Real-time chat interface with message history and theme support
- AI-powered responses using OpenAI models for natural conversation
- Session-based authentication with secure cookie management
- Comprehensive security measures including:
  - IP and session-based rate limiting
  - Request validation and sanitization
  - Security headers and CORS protection
- Performance optimizations through response caching and request throttling

## Project Structure

```
.
├── ChatBot/
│   ├── client/
│   │   ├── app/
│   │   │   ├── modules/
│   │   │   │   ├── chatUI.js
│   │   │   │   ├── formHandler.js
│   │   │   │   └── themeHandler.js
│   │   │   └── index.js
│   │   ├── images/
│   │   │   ├── favicon.ico
│   │   │   └── logo.png
│   │   ├── index.html
│   │   ├── service-worker.js
│   │   └── styles.css
│   ├── server/
│   │   ├── config/
│   │   │   └── config.js
│   │   ├── middleware/
│   │   │   ├── errorHandler.js
│   │   │   └── security.js
│   │   ├── services/
│   │   │   └── openaiService.js
│   │   ├── main.js
│   │   └── utils.js
│   ├── cleanup.sh
│   ├── package.json
│   └── web.config
└── docs/
    ├── API.md
    └── ARCHITECTURE.md
```

## Deployment

The application is deployed as an Azure Web App using GitHub Actions for continuous deployment. When changes are pushed to the main branch, the application is automatically built, tested, and deployed to Azure.

## Documentation

- [API Documentation](docs/API.md) - Comprehensive guide to API endpoints, authentication, rate limits, and error handling
- [Architecture Documentation](docs/ARCHITECTURE.md) - Detailed system design, component structure, data flow, and security implementation

## License

This project is licensed under the terms included in the LICENSE file.

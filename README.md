# MWG CS BOT

Morgan White Group - Customer Service Chat Bot using Azure AI Foundry

## Description

MWG CS BOT is a customer service chatbot solution developed for Morgan White Group. It leverages Azure AI Foundry's GPT-5.4 model to provide automated responses to customer inquiries through a web-based chat interface. The system uses a client-server architecture with a responsive web frontend and a Node.js/Express backend deployed as a Vercel serverless function.

## Core Features

- Modern glassmorphism chat interface with frosted glass panels and smooth animations
- Chat bubbles with avatars — bot messages left-aligned, user messages right-aligned
- AI-powered responses using Azure AI Foundry (GPT-5.4) for natural conversation
- Light/dark theme with sun/moon toggle, DM Sans + Outfit typography
- Copy-to-clipboard on all messages with icon animation and tooltip
- Session-based authentication with secure cookie management
- Comprehensive security measures including:
  - IP and session-based rate limiting
  - Request validation and sanitization
  - Security headers and CORS protection
- Performance optimizations through response caching and request throttling
- Full runtime logging via Better Stack

## Project Structure

```
.
├── api/
│   └── index.js              # Vercel serverless entry point
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
│   └── package.json
├── docs/
│   ├── API.md
│   └── ARCHITECTURE.md
├── vercel.json
└── package.json
```

## Local Development

```bash
cd ChatBot
npm install
# Create .env with AZURE_AI_KEY=your_key
npm run dev
```

## Deployment

The application is deployed on Vercel. Static files are served via Vercel's CDN and the Express API runs as a serverless function.

```bash
npx vercel --prod
```

Required environment variables (set in Vercel dashboard):
- `AZURE_AI_KEY` - Azure AI Foundry API key
- `SESSION_SECRET` - Session cookie signing secret

## Documentation

- [API Documentation](docs/API.md) - API endpoints, authentication, rate limits, and error handling
- [Architecture Documentation](docs/ARCHITECTURE.md) - System design, component structure, data flow, and security

## License

This project is licensed under the terms included in the LICENSE file.

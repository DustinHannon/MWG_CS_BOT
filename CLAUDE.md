# MWG CS BOT - Claude Code Project Guide

## Project Overview
Morgan White Group Customer Service ChatBot - an AI-powered chat interface using OpenAI GPT-3.5-turbo, deployed on Vercel.

**Repo:** https://github.com/DustinHannon/MWG_CS_BOT

## Migration Status (March 2026)
**Migrated from Azure Web Apps to Vercel.** The following work has been completed:
- Removed Azure GitHub Actions workflow (`.github/workflows/main_mwgcsbot.yml`)
- Removed Azure IIS config (`ChatBot/web.config`) and deployment cleanup script (`ChatBot/cleanup.sh`)
- Created Vercel serverless entry point (`api/index.js`)
- Created Vercel config (`vercel.json`) with build command to copy static files
- Created root `package.json` for ES module support
- Modified `ChatBot/server/main.js`: exports app, conditional `app.listen()`, conditional `express.static()`, env-based session secret
- Updated CORS and CSP in `config.js` to allow `*.vercel.app` domains and Google Fonts
- **NOT YET DEPLOYED** - user needs to run `vercel login` and `vercel --prod` (see steps below)

### Remaining Steps to Complete Deployment
1. Run `npx vercel login` from project root
2. Run `npx vercel` to create project and do preview deploy
3. Add env vars: `npx vercel env add OPENAI_API_KEY` and `npx vercel env add SESSION_SECRET`
4. Run `npx vercel --prod` for production deployment
5. Test: page loads, chat works, `/health` returns JSON

## Quick Start (Local Development)
```bash
cd ChatBot
npm install
# Create .env with OPENAI_API_KEY=your_key
npm run dev    # Development (nodemon)
npm start      # Production
```
Server runs on port 8080 by default.

## Deploy to Vercel
```bash
npx vercel          # Preview deployment
npx vercel --prod   # Production deployment
```
Required environment variables in Vercel dashboard:
- `OPENAI_API_KEY` - OpenAI API key
- `SESSION_SECRET` - Stable secret for session cookies (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

## Tech Stack
- **Runtime:** Node.js >= 20.15.1, npm >= 11.0.0
- **Backend:** Express.js 4.18.2 (ES modules, runs as Vercel serverless function)
- **Frontend:** Vanilla JS (ES modules), CSS custom properties
- **AI:** OpenAI GPT-3.5-turbo via node-fetch
- **Security:** helmet, express-rate-limit, express-session, CORS
- **Deploy:** Vercel (serverless functions + CDN static serving)

## Project Structure
```
MWG_CS_BOT/
├── api/
│   └── index.js                # Vercel serverless entry point (re-exports Express app)
├── ChatBot/                    # Main application
│   ├── package.json            # Dependencies & scripts
│   ├── client/                 # Frontend (copied to public/ at build time by Vercel)
│   │   ├── index.html          # SPA entry point
│   │   ├── styles.css          # All styles (light/dark themes)
│   │   ├── service-worker.js   # PWA caching strategies
│   │   ├── images/             # logo.png, favicon.ico
│   │   └── app/
│   │       ├── index.js        # ChatApplication class (entry)
│   │       └── modules/
│   │           ├── chatUI.js       # Message rendering, queue, history
│   │           ├── formHandler.js  # Input, validation, API calls, retries
│   │           └── themeHandler.js # Dark/light mode, localStorage
│   └── server/                 # Backend
│       ├── main.js             # Express server, routes, middleware (exports app)
│       ├── utils.js            # MWG context prompt enrichment
│       ├── config/
│       │   └── config.js       # Env vars, CORS, CSP, rate limits
│       ├── services/
│       │   └── openaiService.js # OpenAI API, caching, rate limiting
│       └── middleware/
│           ├── security.js     # Security headers, input validation
│           └── errorHandler.js # Error codes, APIError class
├── docs/
│   ├── API.md                  # API endpoint documentation
│   └── ARCHITECTURE.md         # System architecture docs
├── vercel.json                 # Vercel deployment configuration
├── package.json                # Root package.json (ES modules)
└── .gitignore
```

## Vercel Architecture
- **Static files:** `ChatBot/client/` is copied to `public/` at build time via `vercel.json` buildCommand, served by Vercel CDN
- **API routes:** `api/index.js` re-exports the Express app as a Vercel serverless function
- **Routing:** `vercel.json` rewrites `/api/*` and `/health` to the serverless function; all other routes served from static files
- **`express.static()` is disabled on Vercel** (wrapped in `if (!process.env.VERCEL)`, handled by CDN instead)
- **`app.listen()` is disabled on Vercel** (wrapped in `if (!process.env.VERCEL)`, handled by serverless runtime)

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (uptime, memory, env) |
| POST | `/api/session` | Create/retrieve session with fingerprinting |
| DELETE | `/api/session` | Destroy session |
| POST | `/api/openai` | Send chat message (requires session) |
| GET | `/api/messages` | Message history (paginated) |

## Key Architecture Decisions

### Security (Multi-Layer)
- **Helmet:** CSP, HSTS, X-Frame-Options, noSniff, XSS filter
- **CORS:** Restricted to morganwhite.com + vercel.app domains
- **CSP:** Allows Google Fonts (googleapis.com, gstatic.com), vercel.app domains
- **Rate Limiting:** Dual-layer (IP-based via express-rate-limit + session/IP in OpenAI service)
- **Session:** Env-based secret (`SESSION_SECRET`), HTTP-only cookies, fingerprinting
- **Input Validation:** XSS, SQL injection, command injection pattern detection

### Serverless Considerations
- In-memory stores (sessions, rate limits, cache) are ephemeral per serverless instance
- Vercel Fluid Compute helps keep functions warm for better session persistence
- `SESSION_SECRET` env var ensures consistent cookie signing across instances
- Service worker and SPA fallback routes only active in local dev (Vercel CDN handles these)

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `SESSION_SECRET` | Yes (Vercel) | Stable session cookie secret |
| `PORT` | No | Server port for local dev (default: 8080) |
| `NODE_ENV` | No | Environment (default: production) |
| `VERCEL` | Auto | Set by Vercel runtime (used to toggle local-only features) |

## Development Notes
- ES modules throughout (`"type": "module"` in both package.json files)
- No test framework currently configured
- No build step (vanilla JS, no bundler)
- `nodemon` for dev auto-restart
- All error codes defined in `errorHandler.js` ErrorCodes object
- Changes to `ChatBot/client/` are what users see - `public/` is generated at deploy time

## Change Log
- **March 2026:** Migrated from Azure Web Apps to Vercel. Removed Azure workflow, web.config, cleanup.sh. Added api/index.js, vercel.json, root package.json. Updated main.js for serverless export, config.js for Vercel CORS/CSP.

/**
 * Vercel Serverless Function Entry Point
 *
 * This file re-exports the Express app for Vercel's serverless runtime.
 * Vercel detects this file at api/index.js and routes requests to it.
 * Static files are served from the public/ directory by Vercel's CDN.
 */

import app from '../ChatBot/server/main.js';

export default app;

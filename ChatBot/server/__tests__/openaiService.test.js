import { jest } from '@jest/globals';

// Mock modules before importing the service
jest.unstable_mockModule('../config/config.js', () => ({
    default: {
        openaiApiKey: 'test-key',
        openai: {
            model: 'test-model',
            maxTokens: 100
        }
    }
}));

jest.unstable_mockModule('node-fetch', () => ({
    default: jest.fn()
}));

jest.unstable_mockModule('dotenv', () => ({
    config: jest.fn()
}));

// Import the service after setting up mocks
const openaiService = await import('../services/openaiService.js').then(m => m.default);

describe('OpenAI Service', () => {
    beforeEach(() => {
        // Clear all rate limits and mocks before each test
        openaiService.rateLimits.clear();
        jest.clearAllMocks();
    });

    test('service should be defined', () => {
        expect(openaiService).toBeDefined();
    });

    test('service should have required methods', () => {
        const methods = [
            'generateResponse',
            'generateSessionId',
            'getRateLimit',
            'checkRateLimit',
            'updateRateLimit'
        ];

        methods.forEach(method => {
            expect(typeof openaiService[method]).toBe('function');
        });
    });

    test('should handle rate limits', () => {
        const sessionId = 'test-session';
        
        // Initial state
        const initialLimit = openaiService.getRateLimit(sessionId);
        expect(initialLimit.requests).toBe(0);
        expect(initialLimit.resetTime).toBeDefined();
        
        // After update
        openaiService.updateRateLimit(sessionId);
        const updatedLimit = openaiService.getRateLimit(sessionId);
        expect(updatedLimit.requests).toBe(1);
        
        // Rate limit check
        expect(() => {
            for (let i = 0; i < 51; i++) {
                openaiService.updateRateLimit(sessionId);
            }
            openaiService.checkRateLimit(sessionId);
        }).toThrow('Rate limit exceeded');
    });

    test('should reset rate limits after expiry', () => {
        const sessionId = 'test-session';
        const now = Date.now();
        
        // Mock Date.now() to control time
        const realDateNow = Date.now.bind(global.Date);
        global.Date.now = jest.fn(() => now);
        
        // Set initial rate limit
        openaiService.updateRateLimit(sessionId);
        expect(openaiService.getRateLimit(sessionId).requests).toBe(1);
        
        // Move time forward past reset time
        global.Date.now = jest.fn(() => now + 3600001); // 1 hour + 1ms
        
        // Rate limit should be reset
        expect(openaiService.getRateLimit(sessionId).requests).toBe(0);
        
        // Restore original Date.now
        global.Date.now = realDateNow;
    });

    afterAll(() => {
        // Clean up any remaining mocks
        jest.restoreAllMocks();
    });
});

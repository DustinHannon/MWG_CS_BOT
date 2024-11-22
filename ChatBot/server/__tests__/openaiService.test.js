import { jest } from '@jest/globals';
import openaiService from '../services/openaiService.js';

describe('OpenAI Service', () => {
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

    test('should generate unique session IDs', () => {
        const id1 = openaiService.generateSessionId('user1');
        const id2 = openaiService.generateSessionId('user1');
        
        expect(id1).toBeTruthy();
        expect(id2).toBeTruthy();
        expect(id1).not.toBe(id2);
        expect(typeof id1).toBe('string');
        expect(id1.length).toBeGreaterThan(0);
    });

    test('should handle rate limits', () => {
        const sessionId = openaiService.generateSessionId('testUser');
        
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
});

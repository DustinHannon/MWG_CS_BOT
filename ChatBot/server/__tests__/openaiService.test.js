describe('OpenAI Service', () => {
    let openaiService;

    beforeAll(async () => {
        openaiService = await import('../services/openaiService.js').then(m => m.default);
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
            expect(openaiService[method]).toBeDefined();
            expect(typeof openaiService[method]).toBe('function');
        });
    });

    test('should generate unique session IDs', () => {
        const id1 = openaiService.generateSessionId('user1');
        const id2 = openaiService.generateSessionId('user1');
        expect(id1).not.toBe(id2);
        expect(typeof id1).toBe('string');
        expect(id1.length).toBeGreaterThan(0);
    });

    test('should handle rate limits correctly', () => {
        const sessionId = openaiService.generateSessionId('testUser');
        const initialLimit = openaiService.getRateLimit(sessionId);
        
        expect(initialLimit.requests).toBe(0);
        expect(initialLimit.resetTime).toBeDefined();
        
        openaiService.updateRateLimit(sessionId);
        const updatedLimit = openaiService.getRateLimit(sessionId);
        expect(updatedLimit.requests).toBe(1);
    });
});

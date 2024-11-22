module.exports = api => {
    const isTest = api.env('test');
    
    return {
        presets: [
            [
                '@babel/preset-env',
                {
                    targets: {
                        node: 'current'
                    },
                    modules: isTest ? 'commonjs' : false
                }
            ]
        ],
        env: {
            test: {
                plugins: [
                    // Add any test-specific plugins here if needed
                ]
            }
        }
    };
};

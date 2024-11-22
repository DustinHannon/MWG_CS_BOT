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
                    // For Jest tests, transform modules to CommonJS
                    modules: isTest ? 'auto' : false
                }
            ]
        ],
        // Ensure proper source maps for debugging
        sourceMaps: isTest ? 'both' : false,
        // Ignore node_modules except for specific packages that need transformation
        ignore: [
            './node_modules/(?!(node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill)/)'
        ]
    };
};

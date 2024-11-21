import fetch from 'node-fetch';
import config from '../config/config.js';

class OpenAIService {
    constructor() {
        this.apiKey = config.openaiApiKey;
        this.model = config.openai.model;
        this.maxTokens = config.openai.maxTokens;
    }

    async generateResponse(prompt) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { 
                            role: 'system', 
                            content: `You are a helpful assistant that responds in properly formatted HTML. 
                            Always wrap your entire response in a <div> tag.
                            Use appropriate HTML tags such as:
                            - <p> for paragraphs
                            - <ol> and <li> for numbered lists
                            - <ul> and <li> for bullet points
                            - <strong> for emphasis
                            - <br> for line breaks
                            
                            Example response format:
                            <div>
                                <p>Here are our services:</p>
                                <ol>
                                    <li>First service description</li>
                                    <li>Second service description</li>
                                </ol>
                                <p>For assistance, contact us at <strong>(555) 555-5555</strong></p>
                            </div>
                            
                            Always maintain proper HTML structure and nesting.
                            Do not include any markdown formatting.
                            Do not include script tags or event handlers.` 
                        },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: this.maxTokens,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'OpenAI API request failed');
            }

            const data = await response.json();
            
            if (!data.choices?.[0]?.message?.content) {
                throw new Error('Invalid response format from OpenAI API');
            }

            return data.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI Service Error:', error);
            throw new Error('Failed to generate response');
        }
    }
}

export default new OpenAIService();

import express from 'express'
import * as path from 'path'
import bodyParser from 'body-parser'
import fetch from 'node-fetch'
import * as dotenv from 'dotenv'
import {enrichUserPromptWithContext} from "./utils.js";

// load environment variables from .env file
dotenv.config();

// initialize express app
export const app = express()

// parse application/json request bodies
app.use(bodyParser.json())

// serve static files from client folder (js, css, images, etc.)
app.use(express.static(path.join(process.cwd(), 'client')))

// create http post endpoint that accepts user input and sends it to OpenAI API
// then returns the response to the client
app.post('/api/openai', async (req, res) => {
    const { question } = req.body;

    try {
        // send a request to the OpenAI API with the user's prompt
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            // construct the request payload
            // to be sent to the OpenAI API,
            // passing in an 'enriched' version
            // of the user's prompt
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: enrichUserPromptWithContext(question) }
                ],
                max_tokens: 600, // Increase this value to allow for longer replies
            }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        // parse the response from OpenAI as json
        const data = await response.json();
        res.json({ data: data.choices[0].message.content });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// set the port to listen on, which is either the port specified in the .env or 3000 if no port is specified
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

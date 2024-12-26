# MWG CS BOT
Morgan White Group - Customer Service Chat Bot using OpenAI models

## Description
MWG CS BOT is a sophisticated customer service chatbot solution developed for Morgan White Group. It leverages OpenAI's advanced language models to provide intelligent, context-aware responses to customer inquiries. The system is designed to enhance customer support efficiency by automating responses to common questions while maintaining a natural, conversational experience.

## Features
- Real-time chat interface
- AI-powered responses using OpenAI models
- Web-based client application
- Scalable server architecture
- Responsive design for multiple devices

## Project Structure
```
ChatBot/
├── client/                      # Frontend application
│   ├── app/                    # Application logic
│   │   ├── index.js           # Main client entry point
│   │   └── modules/           # UI modules
│   │       ├── chatUI.js      # Chat interface management
│   │       ├── formHandler.js # Form processing
│   │       └── themeHandler.js# Theme management
│   ├── images/                # Static assets
│   │   ├── favicon.ico       # Site favicon
│   │   └── logo.png         # Site logo
│   ├── index.html            # Main HTML file
│   ├── service-worker.js     # Service worker for PWA
│   └── styles.css           # Application styles
├── server/                    # Backend server
│   ├── config/              # Configuration
│   │   └── config.js       # Server configuration
│   ├── middleware/         # Server middleware
│   │   ├── errorHandler.js # Error handling
│   │   └── security.js    # Security middleware
│   ├── services/          # Server services
│   │   └── openaiService.js# OpenAI integration
│   ├── main.js           # Server entry point
│   └── utils.js         # Utility functions
├── cleanup.sh           # Cleanup script
├── package.json        # Project dependencies
└── web.config         # Azure web app configuration
```

## Technologies Used
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js
- **AI Integration**: OpenAI API
- **Development**: Modern JavaScript (ES6+)

## Documentation
- [API Documentation](docs/API.md) - Comprehensive API reference
- [Architecture Documentation](docs/ARCHITECTURE.md) - System design and implementation details

## Getting Started
1. Clone the repository
2. Install dependencies:
   ```bash
   cd ChatBot
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
## Temp Azure Web App
https://mwgcsbot-apdcavd6ameddtdb.southcentralus-01.azurewebsites.net

## License
This project is licensed under the terms included in the LICENSE file.

## Example Image:
![image](https://github.com/user-attachments/assets/5ec2286b-4c10-423f-8596-8cc735bceb3e)

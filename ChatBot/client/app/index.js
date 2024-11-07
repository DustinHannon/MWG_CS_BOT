// handle when the user submits a question through the form
async function handleSubmitQuestion(question) {
    if (!question) {
        return alert('Please enter your support question in the box below.');
    }

    addUserQuestionToDialogueBox(question);

    try {
        const response = await fetch('/api/openai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const { data } = await response.json();
        addBotResponseToDialogueBox(data);
    } catch (error) {
        console.error('Error:', error);
        alert('There was an error processing your request. Please try again later.');
    }
}

// add the user's question to the dialogue box
function addUserQuestionToDialogueBox(question) {
    const userQuestion = document.createElement('li');
    userQuestion.classList.add('bg-indigo-500', 'text-white', 'rounded', 'p-2', 'w-fit', 'self-end', 'break-words');
    userQuestion.innerText = question;
    document.getElementById('dialogue').appendChild(userQuestion);
    document.getElementById('prompt-input').value = '';
    scrollToBottom();
}

// add the chatbot's response to the dialogue box
function addBotResponseToDialogueBox(response) {
    const botResponse = document.createElement('li');
    botResponse.classList.add('bg-gray-500', 'text-white', 'rounded', 'p-2', 'w-fit', 'self-start');

    // Convert URLs in the response to clickable links
    const urlRegex = /(https?:\/\/[^\s]+[^\s.,!?])/g;
    const formattedResponse = response.replace(urlRegex, (url) => {
        // Check if the URL ends with punctuation and remove it
        const match = url.match(/(https?:\/\/[^\s]+)([.,!?])?/);
        const cleanUrl = match[1];
        const punctuation = match[2] || '';
        return `<a href="${cleanUrl}" target="_blank" class="text-indigo-500 underline">${cleanUrl}</a>${punctuation}`;
    });

    botResponse.innerHTML = formattedResponse.trim();
    document.getElementById('dialogue').appendChild(botResponse);
    scrollToBottom();
}

// scroll to the bottom of the chat container
function scrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    document.getElementById('chat-container').classList.toggle('dark-mode');
}

window.onload = () => {
    document.getElementById('prompt-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const question = document.getElementById('prompt-input').value;
        handleSubmitQuestion(question);
    });

    document.getElementById('prompt-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const question = document.getElementById('prompt-input').value;
            handleSubmitQuestion(question);
        }
    });

    document.getElementById('toggle-dark-mode').addEventListener('click', toggleDarkMode);
};
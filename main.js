let conversationId = null;

async function startConversation() {
    try {
        const res = await fetch('/api/start', {
            method: 'POST'
        });
        const data = await res.json();
        conversationId = data.conversation_id;
    } catch (err) {
        console.error('Failed to start a new conversation:', err);
        alert('Failed to start a new conversation.');
    }
}

// Start a new conversation on page load
startConversation();

const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');

function appendMessage(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    messageDiv.appendChild(bubble);
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message || !conversationId) return;
    appendMessage('user', message);
    userInput.value = '';
    appendMessage('bot', '...'); // Loading indicator
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, conversation_id: conversationId })
        });
        const data = await res.json();
        // Remove loading indicator
        chatWindow.removeChild(chatWindow.lastChild);
        appendMessage('bot', data.reply);
    } catch (err) {
        console.error('Chat error:', err);
        chatWindow.removeChild(chatWindow.lastChild);
        appendMessage('bot', 'Sorry, there was an error.');
    }
}); 
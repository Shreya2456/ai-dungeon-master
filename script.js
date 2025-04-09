// ======== CONFIGURATION ======== //
const HF_API_TOKEN = import.meta.env.VITE_HF_API_TOKEN
const AI_MODEL = "mistralai/Mistral-7B-Instruct-v0.1";
const SAVE_KEY = "ai_dm_chat_history";

// Fallback responses when API fails
const FALLBACK_RESPONSES = [
    "The story continues... What would you like to do next?",
    "Something interesting happens... What's your next move?",
    "The situation develops... How do you respond?",
    "Time passes... What action do you take?",
    "Events unfold... What do you do?"
];

// Game state
let gameActive = false;
let usingFallbackMode = false;
let currentPlayerId = 0;
let players = [];
let conversationHistory = [];
let isLoading = false;
let currentChatId = null;
let chatHistory = [];
let pendingAction = null;

// DOM elements
const chatBox = document.getElementById('chat-box');
const playerInput = document.getElementById('player-input');
const sendButton = document.getElementById('send-button');
const apiStatus = document.getElementById('game-status');
const setupPanel = document.querySelector('.setup-panel');
const startGameBtn = document.getElementById('start-game');
const addPlayerBtn = document.getElementById('add-player');
const playerList = document.getElementById('player-list');
const playerCountInput = document.getElementById('player-count');
const currentPlayersSpan = document.getElementById('current-players');
const maxPlayersSpan = document.getElementById('max-players');
const gameStatus = document.getElementById('game-status');
const historyContainer = document.getElementById('history-container');
const historyList = document.getElementById('history-list');
const closeHistoryBtn = document.querySelector('.close-history');
const newChatBtn = document.getElementById('new-chat-button');
const saveChatBtn = document.getElementById('save-chat-button');
const clearHistoryBtn = document.getElementById('clear-history-button');
const mobileSetupBtn = document.getElementById('mobile-setup-button');
const desktopHistoryBtn = document.getElementById('desktop-history-button');
const confirmationDialog = document.getElementById('confirmation-dialog');
const confirmationMessage = document.getElementById('confirmation-message');
const confirmCancelBtn = document.getElementById('confirm-cancel');
const confirmOkBtn = document.getElementById('confirm-ok');

// Initialize
window.onload = () => {
    updatePlayerCount();
    addMessage('system', 'Welcome to AI Dungeon Master! Set up your game to begin.');
    loadChatHistory();
    
    // Check screen size and show/hide setup button accordingly
    handleResize();
    window.addEventListener('resize', handleResize);
};

// Handle window resize
function handleResize() {
    if (window.innerWidth <= 768) {
        setupPanel.classList.remove('visible');
        historyContainer.classList.remove('visible');
    }
}

// Add message to chat
function addMessage(role, content, playerId = 0) {
    const messageDiv = document.createElement('div');
    
    if (role === 'user') {
        const player = players[playerId];
        messageDiv.className = `message player-message player-color-${playerId}`;
        messageDiv.innerHTML = `
            <div class="message-sender">${player.name}</div>
            ${content}
        `;
    } else if (role === 'assistant') {
        messageDiv.className = 'message dm-message';
        messageDiv.innerHTML = `
            <div class="message-sender">DM</div>
            ${content}
        `;
    } else if (role === 'loading') {
        messageDiv.className = 'message loading-message';
        messageDiv.innerHTML = `
            <div class="message-sender">DM</div>
            <div class="loading-spinner"></div> Preparing the next part of your adventure...
        `;
    } else {
        messageDiv.className = 'message system-message';
        messageDiv.textContent = content;
    }
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Send message to AI
async function sendMessage() {
    const message = playerInput.value.trim();
    if (!message || isLoading) return;
    
    playerInput.value = '';
    addMessage('user', message, currentPlayerId);
    conversationHistory.push({ 
        role: "user", 
        content: `${players[currentPlayerId].name}: ${message}` 
    });
    
    // Rotate player for next message
    currentPlayerId = (currentPlayerId + 1) % players.length;
    
    // Show loading indicator
    addMessage('loading', '');
    isLoading = true;
    sendButton.disabled = true;
    playerInput.disabled = true;
    apiStatus.textContent = "Generating response...";

    try {
        const prompt = buildPrompt(conversationHistory);
        const response = await callHuggingFaceAPI(prompt);
        
        // Clean up the response
        let cleanResponse = cleanAIResponse(response);
        
        removeLoadingMessage();
        addMessage('assistant', cleanResponse);
        conversationHistory.push({ role: "assistant", content: cleanResponse });
        apiStatus.textContent = `Using ${AI_MODEL}`;
        
        // Auto-save the chat if we have an ID
        if (currentChatId) {
            saveChatToHistory(currentChatId);
        }
    } catch (error) {
        console.error("API Error:", error);
        removeLoadingMessage();
        startFallbackMode();
        // Retry with fallback
        setTimeout(() => {
            const response = getFallbackResponse(message);
            addMessage('assistant', response);
            conversationHistory.push({ role: "assistant", content: response });
        }, 800);
    } finally {
        isLoading = false;
        sendButton.disabled = false;
        playerInput.disabled = false;
        playerInput.focus();
    }
}

// Build the prompt for the AI
function buildPrompt(history) {
    let prompt = `<s>[INST] <<SYS>>
    You are an expert fantasy RPG Dungeon Master. Follow these rules:
    - Always respond with vivid 3-5 sentence descriptions
    - Include sensory details (sights, sounds, smells)
    - Advance the story based on player actions
    - Maintain consistent world-building
    - Address players by name when appropriate
    - Create meaningful choices and consequences
    - Develop interesting NPCs with personalities
    <</SYS>>\n\n`;
    
    // Add campaign context
    const campaignName = document.getElementById('campaign-name').value.trim() || "Unnamed Adventure";
    const storyline = document.getElementById('storyline').value.trim() || "A fantasy adventure begins...";
    prompt += `# Campaign: ${campaignName}\n`;
    prompt += `# Starting Scenario: ${storyline}\n\n`;
    
    // Add player characters
    prompt += "# Player Characters:\n";
    players.forEach(player => {
        prompt += `- ${player.name}, ${player.charClass}`;
        if (player.backstory) {
            prompt += ` (${player.backstory})`;
        }
        prompt += `\n`;
    });
    
    // Add conversation history
    prompt += "\n# Story So Far:\n";
    history.forEach(msg => {
        if (msg.role === "user") {
            prompt += `Player: ${msg.content}\n`;
        } else if (msg.role === "assistant") {
            prompt += `DM: ${msg.content}\n`;
        }
    });
    
    prompt += "\nWhat happens next? Describe in vivid detail, advancing the story. [/INST] DM: ";
    return prompt;
}

// Clean up the AI response
function cleanAIResponse(response) {
    if (!response) return "The story takes an unexpected turn...";
    
    // Remove any duplicate prompts or artifacts
    let cleanText = response.replace(/\[INST\].*\[\/INST\]/g, '');
    cleanText = cleanText.replace(/<s>|<\/s>/g, '');
    cleanText = cleanText.replace(/DM:\s*/g, '');
    cleanText = cleanText.replace(/<<SYS>>.*<<\/SYS>>/g, '');
    
    // Remove trailing incomplete sentences
    const lastPunctuation = Math.max(
        cleanText.lastIndexOf('.'),
        cleanText.lastIndexOf('!'),
        cleanText.lastIndexOf('?')
    );
    
    if (lastPunctuation > 0) {
        cleanText = cleanText.substring(0, lastPunctuation + 1);
    }
    
    // If we have nothing left, use a fallback
    if (!cleanText.trim()) {
        return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
    }
    
    return cleanText.trim();
}

// Call Hugging Face API
async function callHuggingFaceAPI(prompt) {
    try {
        const response = await fetch(
            `https://api-inference.huggingface.co/models/${AI_MODEL}`,
            {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${HF_API_TOKEN}`,
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({ 
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 400,
                        temperature: 0.7,
                        top_p: 0.9,
                        repetition_penalty: 1.15,
                        do_sample: true,
                        return_full_text: false
                    }
                })
            }
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "API request failed");
        }
        
        const data = await response.json();
        return data[0]?.generated_text || "I couldn't generate a response.";
    } catch (error) {
        console.error("API Call Failed:", error);
        throw error;
    }
}

// Remove loading message
function removeLoadingMessage() {
    const messages = chatBox.querySelectorAll('.message');
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.classList.contains('loading-message')) {
        chatBox.removeChild(lastMessage);
    }
}

// Start fallback mode
function startFallbackMode() {
    usingFallbackMode = true;
    apiStatus.textContent = "Using fallback responses";
    apiStatus.classList.add('error');
    addMessage('system', 'API unavailable - using fallback mode');
}

// Get context-aware fallback response
function getFallbackResponse(message) {
    return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

// Add a new player character
function addPlayerCharacter() {
    const name = document.getElementById('char-name').value.trim();
    const charClass = document.getElementById('char-class').value.trim();
    const backstory = document.getElementById('char-backstory').value.trim();
    
    if (!name || !charClass) {
        alert("Please enter both a name and class for your character");
        return;
    }
    
    if (players.length >= parseInt(playerCountInput.value)) {
        alert("You've reached the maximum number of players for this game");
        return;
    }
    
    const playerId = players.length;
    const player = {
        id: playerId,
        name: name,
        charClass: charClass,
        backstory: backstory
    };
    
    players.push(player);
    renderPlayerList();
    updatePlayerCount();
    
    // Clear inputs
    document.getElementById('char-name').value = '';
    document.getElementById('char-class').value = '';
    document.getElementById('char-backstory').value = '';
}

// Render the player list
function renderPlayerList() {
    playerList.innerHTML = '';
    
    players.forEach((player, index) => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <div class="player-color player-color-${index}"></div>
            <div class="player-details">
                <div class="player-name">${player.name}</div>
                <div class="player-class">${player.charClass}</div>
            </div>
            <button class="remove-player" data-id="${index}">×</button>
        `;
        playerList.appendChild(playerItem);
    });
    
    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-player').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            players.splice(id, 1);
            // Reindex players
            players.forEach((player, index) => {
                player.id = index;
            });
            renderPlayerList();
            updatePlayerCount();
        });
    });
}

// Update player count display
function updatePlayerCount() {
    currentPlayersSpan.textContent = players.length;
    maxPlayersSpan.textContent = playerCountInput.value;
    
    if (players.length === parseInt(playerCountInput.value)) {
        startGameBtn.disabled = false;
        gameStatus.textContent = "Ready to Start";
    } else {
        startGameBtn.disabled = true;
        gameStatus.textContent = `Need ${playerCountInput.value - players.length} more characters`;
    }
}

// Start the game
function startGame() {
    const campaignName = document.getElementById('campaign-name').value.trim() || "Unnamed Adventure";
    const storyline = document.getElementById('storyline').value.trim() || "An adventure begins...";
    
    // Initialize game state
    conversationHistory = [];
    gameActive = true;
    currentPlayerId = 0;
    
    // Enable chat
    playerInput.disabled = false;
    sendButton.disabled = false;
    
    // Hide setup panel on mobile
    if (window.innerWidth <= 768) {
        setupPanel.classList.remove('visible');
    }
    
    // Update UI
    gameStatus.textContent = "Game Active";
    document.querySelector('h1').textContent = campaignName;
    
    // Clear chat and start fresh
    chatBox.innerHTML = '';
    addMessage('system', `The adventure "${campaignName}" begins!`);
    
    // Generate initial scene
    generateInitialScene(campaignName, storyline);
    
    // Create a new chat entry
    createNewChat(campaignName);
}

// Generate initial scene
async function generateInitialScene(campaignName, storyline) {
    addMessage('loading', '');
    isLoading = true;
    sendButton.disabled = true;
    playerInput.disabled = true;
    apiStatus.textContent = "Generating initial scene...";

    try {
        const initialPrompt = `<s>[INST] <<SYS>>
        You are an expert fantasy RPG Dungeon Master starting a new campaign called "${campaignName}".
        Create a vivid opening scene with sensory details that introduces:
        - The setting
        - At least 3 interesting NPCs
        - Potential plot hooks
        - The player characters: ${players.map(p => p.name).join(', ')}
        
        Starting scenario: ${storyline}
        <</SYS>>
        
        Describe the opening scene in 3-5 detailed sentences. [/INST] DM: `;
        
        const response = await callHuggingFaceAPI(initialPrompt);
        const cleanResponse = cleanAIResponse(response);
        
        removeLoadingMessage();
        addMessage('assistant', cleanResponse);
        conversationHistory.push({ 
            role: "system", 
            content: `Campaign: ${campaignName}\nScenario: ${storyline}\nPlayers: ${players.map(p => `${p.name} (${p.charClass})`).join(', ')}`
        });
        conversationHistory.push({ role: "assistant", content: cleanResponse });
        apiStatus.textContent = `Using ${AI_MODEL}`;
        
        // Save the initial state to history
        if (currentChatId) {
            saveChatToHistory(currentChatId);
        }
    } catch (error) {
        console.error("API Error:", error);
        removeLoadingMessage();
        startFallbackMode();
        const response = getFallbackResponse("start");
        addMessage('assistant', response);
        conversationHistory.push({ role: "assistant", content: response });
    } finally {
        isLoading = false;
        sendButton.disabled = false;
        playerInput.disabled = false;
        playerInput.focus();
    }
}

// ======== CHAT HISTORY FUNCTIONS ======== //

// Load chat history from localStorage
function loadChatHistory() {
    const savedHistory = localStorage.getItem(SAVE_KEY);
    if (savedHistory) {
        try {
            chatHistory = JSON.parse(savedHistory);
            renderHistoryList();
        } catch (e) {
            console.error("Error loading chat history:", e);
            chatHistory = [];
        }
    } else {
        chatHistory = [];
    }
}

// Save chat history to localStorage
function saveChatHistory() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(chatHistory));
}

// Create a new chat session
function createNewChat(title = "New Adventure") {
    const newChat = {
        id: Date.now().toString(),
        title: title,
        timestamp: new Date().toISOString(),
        players: [...players],
        campaignName: document.getElementById('campaign-name').value.trim() || "Unnamed Adventure",
        conversation: [...conversationHistory]
    };
    
    currentChatId = newChat.id;
    chatHistory.unshift(newChat);
    saveChatHistory();
    renderHistoryList();
    
    return newChat;
}

// Save current chat to history
function saveChatToHistory(chatId) {
    const chatIndex = chatHistory.findIndex(chat => chat.id === chatId);
    if (chatIndex !== -1) {
        chatHistory[chatIndex] = {
            ...chatHistory[chatIndex],
            conversation: [...conversationHistory],
            timestamp: new Date().toISOString()
        };
        saveChatHistory();
        renderHistoryList();
    }
}

// Save current chat as a new entry
function saveCurrentChat() {
    if (!gameActive) return;
    
    const campaignName = document.getElementById('campaign-name').value.trim() || "Unnamed Adventure";
    const title = prompt("Enter a name for this saved game:", campaignName);
    
    if (title) {
        const newChat = createNewChat(title);
        addMessage('system', `Game saved as "${title}"`);
    }
}

// Load a chat from history
function loadChat(chatId) {
    const chat = chatHistory.find(chat => chat.id === chatId);
    if (!chat) return;
    
    // Reset current state
    chatBox.innerHTML = '';
    conversationHistory = [];
    players = [...chat.players];
    
    // Update UI
    document.getElementById('campaign-name').value = chat.campaignName;
    document.getElementById('player-count').value = chat.players.length;
    updatePlayerCount();
    renderPlayerList();
    
    // Set as current chat
    currentChatId = chat.id;
    
    // Replay the conversation
    chat.conversation.forEach((msg, index) => {
        if (index === 0 && msg.role === "system") {
            // Skip the initial system message
            return;
        }
        
        if (msg.role === "user") {
            // Extract player name and message
            const colonIndex = msg.content.indexOf(':');
            const playerName = msg.content.substring(0, colonIndex);
            const content = msg.content.substring(colonIndex + 2);
            
            // Find player ID
            const player = players.find(p => p.name === playerName);
            if (player) {
                addMessage('user', content, player.id);
            }
        } else if (msg.role === "assistant") {
            addMessage('assistant', msg.content);
        }
        
        conversationHistory.push(msg);
    });
    
    // Update game state
    gameActive = true;
    playerInput.disabled = false;
    sendButton.disabled = false;
    gameStatus.textContent = "Game Active";
    document.querySelector('h1').textContent = chat.campaignName;
    
    // Highlight in history list
    renderHistoryList();
    
    addMessage('system', `Loaded saved game: "${chat.title}"`);
}

// Delete a chat from history
function deleteChat(chatId) {
    showConfirmation(
        "Are you sure you want to delete this saved game?",
        () => {
            const chatIndex = chatHistory.findIndex(chat => chat.id === chatId);
            if (chatIndex !== -1) {
                // If we're deleting the current chat, reset the game
                if (currentChatId === chatId) {
                    startNewChat();
                }
                
                chatHistory.splice(chatIndex, 1);
                saveChatHistory();
                renderHistoryList();
                
                addMessage('system', 'Saved game deleted');
            }
        }
    );
}

// Clear all chat history
function clearAllChatHistory() {
    showConfirmation(
        "Are you sure you want to delete ALL saved games? This cannot be undone.",
        () => {
            chatHistory = [];
            saveChatHistory();
            renderHistoryList();
            
            // If we had a current chat, reset the game
            if (currentChatId) {
                startNewChat();
            }
            
            addMessage('system', 'All saved games deleted');
        }
    );
}

// Render the history list
function renderHistoryList() {
    historyList.innerHTML = '';
    
    if (chatHistory.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'history-item';
        emptyItem.textContent = "No saved games yet";
        emptyItem.style.padding = "15px";
        emptyItem.style.color = "var(--text-dim)";
        emptyItem.style.textAlign = "center";
        historyList.appendChild(emptyItem);
        return;
    }
    
    chatHistory.forEach(chat => {
        const lastMessage = chat.conversation[chat.conversation.length - 1]?.content || "New game";
        const preview = lastMessage.length > 50 ? lastMessage.substring(0, 50) + "..." : lastMessage;
        const date = new Date(chat.timestamp).toLocaleString();
        
        const historyItem = document.createElement('li');
        historyItem.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
        historyItem.dataset.id = chat.id;
        historyItem.innerHTML = `
            <div class="history-item-header">
                <div class="history-item-title">${chat.title}</div>
                <button class="delete-history-item" data-id="${chat.id}">×</button>
            </div>
            <div class="history-item-date">${date}</div>
            <div class="history-item-preview">${preview}</div>
        `;
        
        historyList.appendChild(historyItem);
    });
    
    // Add click handlers for loading chats
    document.querySelectorAll('.history-item').forEach(item => {
        if (item.textContent !== "No saved games yet") {
            item.addEventListener('click', (e) => {
                // Don't load if clicking the delete button
                if (!e.target.classList.contains('delete-history-item')) {
                    loadChat(item.dataset.id);
                    if (window.innerWidth <= 768) {
                        historyContainer.classList.remove('visible');
                    }
                }
            });
        }
    });
    
    // Add click handlers for delete buttons
    document.querySelectorAll('.delete-history-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(btn.dataset.id);
        });
    });
}

// Start a brand new chat
function startNewChat() {
    if (gameActive && conversationHistory.length > 3) {
        showConfirmation(
            "Are you sure you want to start a new game? Your current progress will be lost.",
            () => {
                resetGameState();
            }
        );
    } else {
        resetGameState();
    }
}

// Reset all game state
function resetGameState() {
    // Reset everything
    chatBox.innerHTML = '';
    conversationHistory = [];
    players = [];
    currentChatId = null;
    gameActive = false;
    
    // Reset UI
    playerInput.disabled = true;
    sendButton.disabled = true;
    document.getElementById('campaign-name').value = '';
    document.getElementById('storyline').value = '';
    document.getElementById('player-count').value = 1;
    document.getElementById('char-name').value = '';
    document.getElementById('char-class').value = '';
    document.getElementById('char-backstory').value = '';
    playerList.innerHTML = '';
    gameStatus.textContent = "Setup Incomplete";
    document.querySelector('h1').textContent = "AI Dungeon Master";
    
    // Show welcome message
    addMessage('system', 'Welcome to AI Dungeon Master! Set up your game to begin.');
    
    // Update player count
    updatePlayerCount();
    
    // Close panels
    setupPanel.classList.remove('visible');
    historyContainer.classList.remove('visible');
}

// ======== CONFIRMATION DIALOG ======== //

function showConfirmation(message, callback) {
    confirmationMessage.textContent = message;
    pendingAction = callback;
    confirmationDialog.classList.add('active');
}

function hideConfirmation() {
    confirmationDialog.classList.remove('active');
    pendingAction = null;
}

// Toggle history panel
function toggleHistoryPanel() {
    historyContainer.classList.toggle('visible');
    if (window.innerWidth <= 768) {
        setupPanel.classList.remove('visible');
    }
}

// Toggle setup panel
function toggleSetupPanel() {
    setupPanel.classList.toggle('visible');
    if (window.innerWidth <= 768) {
        historyContainer.classList.remove('visible');
    }
}

// Event listeners
sendButton.addEventListener('click', sendMessage);
playerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

addPlayerBtn.addEventListener('click', addPlayerCharacter);
startGameBtn.addEventListener('click', startGame);
playerCountInput.addEventListener('change', updatePlayerCount);

desktopHistoryBtn.addEventListener('click', toggleHistoryPanel);
closeHistoryBtn.addEventListener('click', () => {
    historyContainer.classList.remove('visible');
});

newChatBtn.addEventListener('click', startNewChat);
saveChatBtn.addEventListener('click', saveCurrentChat);
clearHistoryBtn.addEventListener('click', clearAllChatHistory);

mobileSetupBtn.addEventListener('click', toggleSetupPanel);

confirmCancelBtn.addEventListener('click', hideConfirmation);
confirmOkBtn.addEventListener('click', () => {
    if (pendingAction) {
        pendingAction();
    }
    hideConfirmation();
});
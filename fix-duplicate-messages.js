/**
 * Fix for duplicate messages in the UI
 * This prevents the same message from being displayed multiple times
 */

console.log('🔧 Loading duplicate messages fix...');

// Track displayed messages to prevent duplicates
const displayedMessages = new Set();
const MESSAGE_TIMEOUT = 5000; // 5 seconds

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        fixDuplicateMessages();
    }, 1000);
});

function fixDuplicateMessages() {
    console.log('🔧 Applying duplicate messages fix...');
    
    // Fix StreamingManager displayUserMessage
    fixStreamingManagerMessages();
    
    // Fix conversation display
    fixConversationDisplay();
    
    console.log('✅ Duplicate messages fix applied');
}

function fixStreamingManagerMessages() {
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (!streamingManager) {
        return;
    }
    
    // Override displayUserMessage to prevent duplicates
    if (streamingManager.displayUserMessage && !streamingManager.displayUserMessage._duplicateFixed) {
        const originalDisplayUserMessage = streamingManager.displayUserMessage;
        
        streamingManager.displayUserMessage = function(transcript) {
            const messageKey = `user:${transcript}:${Date.now()}`;
            
            // Check if this message was recently displayed
            if (displayedMessages.has(transcript)) {
                console.log('🚫 Preventing duplicate user message:', transcript.substring(0, 50));
                return;
            }
            
            // Mark message as displayed
            displayedMessages.add(transcript);
            
            // Remove from set after timeout
            setTimeout(() => {
                displayedMessages.delete(transcript);
            }, MESSAGE_TIMEOUT);
            
            console.log('✅ Displaying user message:', transcript.substring(0, 50));
            return originalDisplayUserMessage.call(this, transcript);
        };
        
        streamingManager.displayUserMessage._duplicateFixed = true;
        console.log('✅ StreamingManager displayUserMessage fixed');
    }
    
    // Override displayBotMessage to prevent duplicates
    if (streamingManager.displayBotMessage && !streamingManager.displayBotMessage._duplicateFixed) {
        const originalDisplayBotMessage = streamingManager.displayBotMessage;
        
        streamingManager.displayBotMessage = function(message, agentName) {
            const messageKey = `bot:${message}:${agentName}`;
            
            // Check if this message was recently displayed
            if (displayedMessages.has(messageKey)) {
                console.log('🚫 Preventing duplicate bot message:', message.substring(0, 50));
                return;
            }
            
            // Mark message as displayed
            displayedMessages.add(messageKey);
            
            // Remove from set after timeout
            setTimeout(() => {
                displayedMessages.delete(messageKey);
            }, MESSAGE_TIMEOUT);
            
            console.log('✅ Displaying bot message:', message.substring(0, 50));
            return originalDisplayBotMessage.call(this, message, agentName);
        };
        
        streamingManager.displayBotMessage._duplicateFixed = true;
        console.log('✅ StreamingManager displayBotMessage fixed');
    }
}

function fixConversationDisplay() {
    // Monitor the conversation container for duplicate additions
    const conversationContainer = document.getElementById('conversation');
    
    if (!conversationContainer) {
        return;
    }
    
    // Track recent message additions
    const recentMessages = new Map();
    
    // Override appendChild to prevent duplicates
    const originalAppendChild = conversationContainer.appendChild;
    
    conversationContainer.appendChild = function(newChild) {
        if (newChild.nodeType === Node.ELEMENT_NODE && 
            (newChild.classList.contains('user-message') || newChild.classList.contains('bot-message'))) {
            
            const messageText = newChild.textContent || newChild.innerText;
            const messageType = newChild.classList.contains('user-message') ? 'user' : 'bot';
            const messageKey = `${messageType}:${messageText}`;
            
            // Check if this exact message was recently added
            const now = Date.now();
            if (recentMessages.has(messageKey)) {
                const lastTime = recentMessages.get(messageKey);
                if (now - lastTime < 2000) { // 2 seconds
                    console.log('🚫 Preventing duplicate message in conversation:', messageText.substring(0, 50));
                    return newChild; // Return the element but don't add it
                }
            }
            
            // Track this message
            recentMessages.set(messageKey, now);
            
            // Clean up old entries
            for (const [key, time] of recentMessages.entries()) {
                if (now - time > MESSAGE_TIMEOUT) {
                    recentMessages.delete(key);
                }
            }
            
            console.log('✅ Adding message to conversation:', messageText.substring(0, 50));
        }
        
        return originalAppendChild.call(this, newChild);
    };
    
    console.log('✅ Conversation display duplicate prevention applied');
}

// Make functions available globally
window.fixDuplicateMessages = fixDuplicateMessages;
window.displayedMessages = displayedMessages;

console.log('🔧 Duplicate messages fix loaded');
/**
 * Force System Prompt Update
 * 
 * This script ensures the system prompt debug output gets updated
 * regardless of which conversation path is taken.
 */

console.log('🔧 Loading force system prompt update...');

// Function to force update system prompt in debug panel
function forceUpdateSystemPrompt(prompt, metadata = {}) {
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (speechApp && speechApp.debugOutputManager) {
        speechApp.debugOutputManager.updateSystemPrompt(prompt, {
            agentName: metadata.agentName || 'Unknown',
            personaName: metadata.personaName || 'Unknown',
            promptLength: prompt.length,
            tokensEstimate: Math.ceil(prompt.length / 4),
            ...metadata
        });
        console.log('🔧 System prompt forcibly updated in debug panel');
    }
}

// Function to intercept API calls and extract system prompts
function interceptApiCallsForSystemPrompt() {
    console.log('🔧 Setting up API call interception for system prompt extraction...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.apiClient) {
        console.log('❌ API client not available');
        return;
    }
    
    // Intercept generateChatCompletion to extract system prompts
    const originalGenerateChat = speechApp.apiClient.generateChatCompletion.bind(speechApp.apiClient);
    speechApp.apiClient.generateChatCompletion = async function(messages, options) {
        // Extract system prompt from messages
        const systemMessage = messages.find(msg => msg.role === 'system');
        if (systemMessage) {
            console.log('🔧 System prompt extracted from API call');
            
            // Try to determine which agent this is for
            let agentName = 'Unknown';
            if (systemMessage.content.includes('BankingInfoAgent')) {
                agentName = 'BankingInfoAgent';
            } else if (systemMessage.content.includes('PaymentsAgent')) {
                agentName = 'PaymentsAgent';
            } else if (systemMessage.content.includes('FraudAgent')) {
                agentName = 'FraudAgent';
            } else if (systemMessage.content.includes('IDVAgent')) {
                agentName = 'IDVAgent';
            } else if (systemMessage.content.includes('FallbackHandler')) {
                agentName = 'FallbackHandler';
            }
            
            // Extract persona name from system prompt
            let personaName = 'Unknown';
            const nameMatch = systemMessage.content.match(/Name: ([^\n]+)/);
            if (nameMatch) {
                personaName = nameMatch[1];
            }
            
            // Force update the debug panel
            forceUpdateSystemPrompt(systemMessage.content, {
                agentName,
                personaName,
                source: 'API_INTERCEPT'
            });
        }
        
        // Call original method
        return await originalGenerateChat(messages, options);
    };
    
    console.log('✅ API call interception enabled');
}

// Function to monitor streaming API calls too
function interceptStreamingApiCalls() {
    console.log('🔧 Setting up streaming API call interception...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.streamingManager) {
        console.log('❌ Streaming manager not available');
        return;
    }
    
    // Try to intercept streaming WebSocket messages
    const sm = speechApp.streamingManager;
    
    // Look for WebSocket send method
    if (sm.websocket && sm.websocket.send) {
        const originalSend = sm.websocket.send.bind(sm.websocket);
        sm.websocket.send = function(data) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'session.update' && parsed.session && parsed.session.instructions) {
                    console.log('🔧 System prompt extracted from streaming session update');
                    forceUpdateSystemPrompt(parsed.session.instructions, {
                        agentName: 'StreamingAgent',
                        personaName: 'Unknown',
                        source: 'STREAMING_INTERCEPT'
                    });
                }
            } catch (e) {
                // Ignore parsing errors
            }
            return originalSend(data);
        };
        console.log('✅ Streaming WebSocket interception enabled');
    }
}

// Function to set up all interceptions
function setupSystemPromptInterception() {
    console.log('🔧 Setting up comprehensive system prompt interception...');
    
    interceptApiCallsForSystemPrompt();
    interceptStreamingApiCalls();
    
    console.log('✅ System prompt interception active');
    console.log('💡 System prompt debug panel will now update regardless of conversation path');
}

// Auto-setup
if (typeof window !== 'undefined') {
    setTimeout(() => {
        setupSystemPromptInterception();
        
        console.log('🔧 Force system prompt update ready');
        console.log('Available functions:');
        console.log('- forceUpdateSystemPrompt(prompt, metadata) - Manually update system prompt');
        console.log('- setupSystemPromptInterception() - Re-enable interception');
    }, 2000);
}

// Export functions globally
if (typeof window !== 'undefined') {
    window.forceUpdateSystemPrompt = forceUpdateSystemPrompt;
    window.setupSystemPromptInterception = setupSystemPromptInterception;
    window.interceptApiCallsForSystemPrompt = interceptApiCallsForSystemPrompt;
}

console.log('✅ Force system prompt update loaded');
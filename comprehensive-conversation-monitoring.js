/**
 * Comprehensive Conversation Monitoring
 * 
 * This script monitors all possible conversation paths to identify
 * why the system prompt is not being updated during real conversations.
 */

console.log('🔍 Loading comprehensive conversation monitoring...');

// Function to monitor all conversation entry points
function monitorAllConversationPaths() {
    console.log('🔍 Setting up comprehensive conversation monitoring...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp) {
        console.error('❌ Speech app not available');
        return;
    }
    
    // 1. Monitor the main audio processing method
    if (speechApp.processAudio) {
        const originalProcessAudio = speechApp.processAudio.bind(speechApp);
        speechApp.processAudio = async function(audioBlob) {
            console.log('🎤 processAudio called');
            const result = await originalProcessAudio(audioBlob);
            console.log('🎤 processAudio completed');
            return result;
        };
        console.log('✅ processAudio monitoring enabled');
    }
    
    // 2. Monitor speech to text
    if (speechApp.speechToText) {
        const originalSpeechToText = speechApp.speechToText.bind(speechApp);
        speechApp.speechToText = async function(audioBlob) {
            console.log('🗣️ speechToText called');
            const result = await originalSpeechToText(audioBlob);
            console.log('🗣️ speechToText result:', result?.substring(0, 50) + '...');
            return result;
        };
        console.log('✅ speechToText monitoring enabled');
    }
    
    // 3. Monitor the main routing method
    if (speechApp.routeRequestThroughAgentsWithMetadata) {
        const originalRoute = speechApp.routeRequestThroughAgentsWithMetadata.bind(speechApp);
        speechApp.routeRequestThroughAgentsWithMetadata = async function(userMessage) {
            console.log('🚦 routeRequestThroughAgentsWithMetadata called:', userMessage?.substring(0, 50));
            const result = await originalRoute(userMessage);
            console.log('🚦 routeRequestThroughAgentsWithMetadata result:', {
                agentName: result.agentName,
                responseLength: result.response?.length
            });
            return result;
        };
        console.log('✅ routeRequestThroughAgentsWithMetadata monitoring enabled');
    }
    
    // 4. Monitor the simple routing method
    if (speechApp.routeRequestThroughAgents) {
        const originalSimpleRoute = speechApp.routeRequestThroughAgents.bind(speechApp);
        speechApp.routeRequestThroughAgents = async function(userMessage) {
            console.log('🚦 routeRequestThroughAgents called:', userMessage?.substring(0, 50));
            const result = await originalSimpleRoute(userMessage);
            console.log('🚦 routeRequestThroughAgents result:', result?.substring(0, 50));
            return result;
        };
        console.log('✅ routeRequestThroughAgents monitoring enabled');
    }
    
    // 5. Monitor fallback generateResponse
    if (speechApp.generateResponse) {
        const originalGenerateResponse = speechApp.generateResponse.bind(speechApp);
        speechApp.generateResponse = async function(userMessage) {
            console.log('🔄 generateResponse (fallback) called:', userMessage?.substring(0, 50));
            const result = await originalGenerateResponse(userMessage);
            console.log('🔄 generateResponse (fallback) result:', result?.substring(0, 50));
            return result;
        };
        console.log('✅ generateResponse monitoring enabled');
    }
    
    // 6. Monitor streaming manager if available
    if (speechApp.streamingManager && speechApp.streamingManager.handleUserMessage) {
        const originalHandleUserMessage = speechApp.streamingManager.handleUserMessage.bind(speechApp.streamingManager);
        speechApp.streamingManager.handleUserMessage = async function(message) {
            console.log('📡 streamingManager.handleUserMessage called:', message?.substring(0, 50));
            const result = await originalHandleUserMessage(message);
            console.log('📡 streamingManager.handleUserMessage completed');
            return result;
        };
        console.log('✅ streamingManager.handleUserMessage monitoring enabled');
    }
    
    // 7. Monitor any direct API calls
    if (speechApp.apiClient && speechApp.apiClient.generateChatCompletion) {
        const originalGenerateChat = speechApp.apiClient.generateChatCompletion.bind(speechApp.apiClient);
        speechApp.apiClient.generateChatCompletion = async function(messages, options) {
            console.log('🤖 API generateChatCompletion called:', {
                messageCount: messages?.length,
                hasSystemMessage: messages?.[0]?.role === 'system',
                systemPromptLength: messages?.[0]?.role === 'system' ? messages[0].content?.length : 0,
                model: options?.model
            });
            
            // Log the actual system prompt being sent
            if (messages?.[0]?.role === 'system') {
                console.log('📝 ACTUAL SYSTEM PROMPT SENT TO API:', messages[0].content.substring(0, 200) + '...');
            }
            
            const result = await originalGenerateChat(messages, options);
            console.log('🤖 API generateChatCompletion result:', {
                success: result?.success,
                responseLength: result?.text?.length || result?.choices?.[0]?.message?.content?.length
            });
            return result;
        };
        console.log('✅ API generateChatCompletion monitoring enabled');
    }
    
    console.log('🎯 Comprehensive conversation monitoring active');
    console.log('💡 Now try asking a question and watch the console for the conversation flow');
}

// Function to monitor streaming mode specifically
function monitorStreamingMode() {
    console.log('📡 Setting up streaming mode monitoring...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.streamingManager) {
        console.log('❌ Streaming manager not available');
        return;
    }
    
    // Check if streaming mode is active
    console.log('📡 Streaming mode status:', {
        isStreamingMode: speechApp.isStreamingMode,
        isConnected: speechApp.isConnected,
        streamingManagerExists: !!speechApp.streamingManager
    });
    
    // Monitor streaming manager methods
    const sm = speechApp.streamingManager;
    
    if (sm.processStreamingResponse) {
        const originalProcess = sm.processStreamingResponse.bind(sm);
        sm.processStreamingResponse = function(response) {
            console.log('📡 processStreamingResponse called:', response?.type);
            return originalProcess(response);
        };
    }
    
    if (sm.handleConversationResponse) {
        const originalHandle = sm.handleConversationResponse.bind(sm);
        sm.handleConversationResponse = function(response) {
            console.log('📡 handleConversationResponse called');
            return originalHandle(response);
        };
    }
    
    console.log('✅ Streaming mode monitoring enabled');
}

// Function to check which mode is currently active
function checkCurrentMode() {
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp) {
        console.log('❌ Speech app not available');
        return;
    }
    
    const modeInfo = {
        isStreamingMode: speechApp.isStreamingMode,
        isConnected: speechApp.isConnected,
        hasAgentRouter: !!speechApp.agentRouter,
        hasStreamingManager: !!speechApp.streamingManager,
        currentState: speechApp.currentState
    };
    
    console.log('🔍 Current mode status:', modeInfo);
    
    if (modeInfo.isStreamingMode) {
        console.log('📡 App is in STREAMING MODE - conversations may bypass agent routing');
        monitorStreamingMode();
    } else {
        console.log('🎤 App is in BATCH MODE - conversations should go through agent routing');
    }
    
    return modeInfo;
}

// Function to trace a complete conversation flow
function traceConversationFlow() {
    console.log('🔍 Setting up conversation flow tracing...');
    
    // Enable all monitoring
    monitorAllConversationPaths();
    
    // Check current mode
    const mode = checkCurrentMode();
    
    console.log('🎯 Conversation flow tracing active');
    console.log('💡 Ask a question now and watch the complete flow in the console');
    
    return mode;
}

// Auto-setup
if (typeof window !== 'undefined') {
    setTimeout(() => {
        console.log('🔧 Comprehensive conversation monitoring ready');
        console.log('Available functions:');
        console.log('- monitorAllConversationPaths() - Monitor all conversation entry points');
        console.log('- monitorStreamingMode() - Monitor streaming-specific paths');
        console.log('- checkCurrentMode() - Check if app is in streaming or batch mode');
        console.log('- traceConversationFlow() - Enable complete conversation tracing');
    }, 1000);
}

// Export functions globally
if (typeof window !== 'undefined') {
    window.monitorAllConversationPaths = monitorAllConversationPaths;
    window.monitorStreamingMode = monitorStreamingMode;
    window.checkCurrentMode = checkCurrentMode;
    window.traceConversationFlow = traceConversationFlow;
}

console.log('✅ Comprehensive conversation monitoring loaded');
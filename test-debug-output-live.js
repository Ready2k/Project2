/**
 * Live Debug Output Test
 * 
 * This script provides functions to test the debug output in real-time
 * and diagnose why the system prompt is not updating during conversations.
 */

// Test function to manually trigger debug output updates
function testDebugOutputLive() {
    console.log('🧪 Testing live debug output...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp) {
        console.error('❌ Speech app not available');
        return;
    }
    
    if (!speechApp.debugOutputManager) {
        console.error('❌ Debug output manager not available');
        return;
    }
    
    // Test system prompt update
    const testPrompt = `Test System Prompt - ${new Date().toLocaleTimeString()}

You are a helpful AI assistant for testing purposes.

Customer Information:
- Name: Test User
- Account Type: Test Account
- Current Balance: £1,000.00

This is a test prompt to verify debug output is working.`;

    speechApp.debugOutputManager.updateSystemPrompt(testPrompt, {
        agentName: 'TestAgent',
        personaName: 'Test User',
        promptLength: testPrompt.length,
        tokensEstimate: Math.ceil(testPrompt.length / 4)
    });
    
    console.log('✅ Test system prompt updated');
    
    // Test other outputs
    speechApp.debugOutputManager.updateSpeechToText('Test transcription', {
        language: 'en',
        confidence: 0.95
    });
    
    speechApp.debugOutputManager.updateGPTResponse('Test AI response', {
        agentName: 'TestAgent',
        processingTime: 1000,
        tokensUsed: 25,
        model: 'gpt-3.5-turbo'
    });
    
    console.log('✅ All debug outputs updated');
}

// Function to monitor agent routing
function monitorAgentRouting() {
    console.log('🔍 Monitoring agent routing...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.agentRouter) {
        console.error('❌ Agent router not available');
        return;
    }
    
    // Override the route method to add logging
    const originalRoute = speechApp.agentRouter.route.bind(speechApp.agentRouter);
    speechApp.agentRouter.route = async function(inputText, context) {
        console.log('🤖 Agent routing called:', {
            input: inputText.substring(0, 50),
            hasContext: !!context,
            hasAgentConfigManager: !!context?.agentConfigManager
        });
        
        const result = await originalRoute(inputText, context);
        
        console.log('🤖 Agent routing result:', {
            success: result.success,
            agentName: result.agentName,
            hasResponse: !!result.response
        });
        
        return result;
    };
    
    console.log('✅ Agent routing monitoring enabled');
}

// Function to check if system prompt generation is being called
function monitorSystemPromptGeneration() {
    console.log('🔍 Monitoring system prompt generation...');
    
    // Monitor BaseAgent generateSystemPrompt calls
    if (window.BaseAgent && window.BaseAgent.prototype.generateSystemPrompt) {
        const originalGenerate = window.BaseAgent.prototype.generateSystemPrompt;
        window.BaseAgent.prototype.generateSystemPrompt = async function(context, userInput, personaDataOverride) {
            console.log('📝 BaseAgent.generateSystemPrompt called:', {
                agentName: this.name,
                userInputLength: userInput?.length || 0,
                hasContext: !!context,
                hasAgentConfigManager: !!context?.agentConfigManager
            });
            
            const result = await originalGenerate.call(this, context, userInput, personaDataOverride);
            
            console.log('📝 BaseAgent.generateSystemPrompt result:', {
                agentName: this.name,
                promptLength: result?.length || 0
            });
            
            return result;
        };
        
        console.log('✅ BaseAgent system prompt monitoring enabled');
    }
    
    // Monitor fallback generateSystemPrompt calls
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (speechApp && speechApp.generateSystemPrompt) {
        const originalFallback = speechApp.generateSystemPrompt.bind(speechApp);
        speechApp.generateSystemPrompt = function(persona, userMessage) {
            console.log('📝 Fallback generateSystemPrompt called:', {
                persona,
                userMessageLength: userMessage?.length || 0
            });
            
            const result = originalFallback(persona, userMessage);
            
            console.log('📝 Fallback generateSystemPrompt result:', {
                promptLength: result?.length || 0
            });
            
            return result;
        };
        
        console.log('✅ Fallback system prompt monitoring enabled');
    }
}

// Function to check debug output manager status
function checkDebugOutputStatus() {
    console.log('🔍 Checking debug output status...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp) {
        console.error('❌ Speech app not available');
        return;
    }
    
    console.log('Debug Output Manager Status:', {
        hasDebugOutputManager: !!speechApp.debugOutputManager,
        debugOutputManagerType: speechApp.debugOutputManager?.constructor?.name,
        hasUpdateSystemPrompt: !!speechApp.debugOutputManager?.updateSystemPrompt,
        hasUpdateDebugOutput: !!speechApp.updateDebugOutput
    });
    
    // Check if debug elements exist
    const debugElements = ['sttOutput', 'systemPrompt', 'gptResponse', 'ttsOutput'];
    const elementStatus = {};
    
    debugElements.forEach(id => {
        const element = document.getElementById(id);
        elementStatus[id] = {
            exists: !!element,
            hasContent: element ? element.textContent.length > 0 : false,
            content: element ? element.textContent.substring(0, 50) + '...' : null
        };
    });
    
    console.log('Debug Elements Status:', elementStatus);
    
    return {
        speechApp: !!speechApp,
        debugOutputManager: !!speechApp.debugOutputManager,
        elements: elementStatus
    };
}

// Function to simulate a conversation and monitor debug updates
async function simulateConversationWithDebugMonitoring() {
    console.log('🎭 Simulating conversation with debug monitoring...');
    
    // Enable monitoring
    monitorAgentRouting();
    monitorSystemPromptGeneration();
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp) {
        console.error('❌ Speech app not available');
        return;
    }
    
    // Simulate a banking question
    const testMessage = "What is my account balance?";
    console.log('🗣️ Simulating user message:', testMessage);
    
    try {
        const result = await speechApp.routeRequestThroughAgentsWithMetadata(testMessage);
        console.log('✅ Conversation simulation completed:', {
            response: result.response.substring(0, 100) + '...',
            agentName: result.agentName
        });
    } catch (error) {
        console.error('❌ Conversation simulation failed:', error);
    }
}

// Function to show only important debug logs
function showOnlyImportantLogs() {
    console.log('🎯 Filtering console to show only important debug logs...');
    
    // Store original console methods
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalDebug = console.debug;
    
    // Important log patterns to keep
    const importantPatterns = [
        /🤖.*Agent routing/,
        /📝.*generateSystemPrompt/,
        /✅.*Agent routing/,
        /❌.*Agent routing/,
        /🧪.*Test/,
        /🔍.*Monitoring/,
        /Debug Output/,
        /System prompt/,
        /BankingInfoAgent/,
        /PaymentsAgent/,
        /FraudAgent/,
        /IDVAgent/,
        /FallbackHandler/,
        /generateResponse/,
        /routeRequestThroughAgents/
    ];
    
    function shouldShowLog(message) {
        if (typeof message !== 'string') return true;
        
        // Always show important patterns
        if (importantPatterns.some(pattern => pattern.test(message))) {
            return true;
        }
        
        // Show non-streaming manager messages
        if (!message.includes('StreamingManager')) {
            return true;
        }
        
        return false;
    }
    
    // Override console methods
    console.log = function(...args) {
        if (args.some(arg => shouldShowLog(String(arg)))) {
            originalLog.apply(console, args);
        }
    };
    
    console.info = function(...args) {
        if (args.some(arg => shouldShowLog(String(arg)))) {
            originalInfo.apply(console, args);
        }
    };
    
    console.debug = function(...args) {
        if (args.some(arg => shouldShowLog(String(arg)))) {
            originalDebug.apply(console, args);
        }
    };
    
    originalLog('🎯 Console filtered to show only important debug logs');
    originalLog('💡 Use console.clear() to clear, then test your conversation');
    
    // Provide a way to restore
    window.restoreAllLogs = function() {
        console.log = originalLog;
        console.info = originalInfo;
        console.debug = originalDebug;
        originalLog('🔊 All console logs restored');
    };
}

// Auto-setup when script loads
if (typeof window !== 'undefined') {
    // Wait for app to be ready
    setTimeout(() => {
        console.log('🔧 Debug output live test ready');
        console.log('Available functions:');
        console.log('- testDebugOutputLive() - Test debug output manually');
        console.log('- monitorAgentRouting() - Monitor agent routing calls');
        console.log('- monitorSystemPromptGeneration() - Monitor system prompt generation');
        console.log('- checkDebugOutputStatus() - Check debug output status');
        console.log('- simulateConversationWithDebugMonitoring() - Full simulation with monitoring');
        console.log('- showOnlyImportantLogs() - Filter console to show only debug logs');
        
        // Auto-check status
        checkDebugOutputStatus();
    }, 2000);
}

// Export functions globally
if (typeof window !== 'undefined') {
    window.testDebugOutputLive = testDebugOutputLive;
    window.monitorAgentRouting = monitorAgentRouting;
    window.monitorSystemPromptGeneration = monitorSystemPromptGeneration;
    window.checkDebugOutputStatus = checkDebugOutputStatus;
    window.simulateConversationWithDebugMonitoring = simulateConversationWithDebugMonitoring;
    window.showOnlyImportantLogs = showOnlyImportantLogs;
}
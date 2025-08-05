/**
 * Debug script to check ConversationContextManager availability
 * Run this in browser console to debug the issue
 */

function debugConversationContext() {
    console.log('🔍 Debugging ConversationContextManager availability...\n');
    
    const checks = [
        {
            name: 'ConversationContextManager class',
            value: typeof ConversationContextManager,
            expected: 'function'
        },
        {
            name: 'window.conversationContextManager',
            value: !!window.conversationContextManager,
            expected: true
        },
        {
            name: 'window.speechApp',
            value: !!window.speechApp,
            expected: true
        },
        {
            name: 'window.speechApp.conversationContextManager',
            value: !!(window.speechApp && window.speechApp.conversationContextManager),
            expected: true
        },
        {
            name: 'window.agentRouter',
            value: !!window.agentRouter,
            expected: true
        },
        {
            name: 'window.agentRouter.contextManager',
            value: !!(window.agentRouter && window.agentRouter.contextManager),
            expected: true
        },
        {
            name: 'window.componentInitializer',
            value: !!window.componentInitializer,
            expected: true
        },
        {
            name: 'window.streamingAgentRoutingInitializer',
            value: !!window.streamingAgentRoutingInitializer,
            expected: true
        }
    ];
    
    let allGood = true;
    
    checks.forEach(check => {
        const status = check.value === check.expected ? '✅' : '❌';
        console.log(`${status} ${check.name}: ${check.value} (expected: ${check.expected})`);
        if (check.value !== check.expected) {
            allGood = false;
        }
    });
    
    console.log('\n🔧 Additional Information:');
    
    if (window.speechApp) {
        console.log('- speechApp.agentRouter:', !!window.speechApp.agentRouter);
        console.log('- speechApp.streamingManager:', !!window.speechApp.streamingManager);
        
        if (window.speechApp.agentRouter) {
            console.log('- speechApp.agentRouter.contextManager:', !!window.speechApp.agentRouter.contextManager);
        }
    }
    
    if (window.componentInitializer) {
        try {
            const contextManager = window.componentInitializer.getConversationContextManager();
            console.log('- componentInitializer.getConversationContextManager():', !!contextManager);
        } catch (error) {
            console.log('- componentInitializer.getConversationContextManager() ERROR:', error.message);
        }
    }
    
    console.log('\n📊 Summary:', allGood ? '✅ All checks passed' : '❌ Some checks failed');
    
    if (!allGood) {
        console.log('\n🔧 Suggested fixes:');
        
        if (typeof ConversationContextManager === 'undefined') {
            console.log('- ConversationContextManager class not loaded. Check if agents/conversation-context-manager.js is loaded.');
        }
        
        if (!window.conversationContextManager) {
            console.log('- Try running: window.conversationContextManager = new ConversationContextManager()');
        }
        
        if (!window.speechApp) {
            console.log('- SpeechApp not initialized yet. Wait for script.js to complete.');
        }
        
        if (window.speechApp && !window.speechApp.conversationContextManager) {
            console.log('- Try running: window.speechApp.conversationContextManager = window.conversationContextManager');
        }
    }
    
    return allGood;
}

// Test ConversationContextManager functionality if available
function testConversationContextFunctionality() {
    console.log('\n🧪 Testing ConversationContextManager functionality...');
    
    const contextManager = window.conversationContextManager || 
                          (window.speechApp && window.speechApp.conversationContextManager);
    
    if (!contextManager) {
        console.log('❌ No ConversationContextManager available for testing');
        return false;
    }
    
    try {
        // Test basic functionality
        const testMessage = 'Test message for debugging';
        contextManager.addMessage('user', testMessage, null, { debug: true });
        
        const history = contextManager.getHistory(1);
        if (history.length > 0 && history[0].content === testMessage) {
            console.log('✅ Basic message tracking works');
            return true;
        } else {
            console.log('❌ Message tracking failed');
            return false;
        }
    } catch (error) {
        console.log('❌ Error testing functionality:', error.message);
        return false;
    }
}

// Auto-run debug when script loads
if (typeof window !== 'undefined') {
    window.debugConversationContext = debugConversationContext;
    window.testConversationContextFunctionality = testConversationContextFunctionality;
    
    // Auto-run after a delay
    setTimeout(() => {
        console.log('🚀 Auto-running conversation context debug...');
        const success = debugConversationContext();
        if (success) {
            testConversationContextFunctionality();
        }
    }, 3000);
}
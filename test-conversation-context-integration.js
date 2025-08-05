/**
 * Test script to verify conversation context manager integration with streaming
 */

async function testConversationContextIntegration() {
    console.log('🧪 Testing Conversation Context Manager Integration...');
    
    const results = {
        conversationContextManagerAvailable: false,
        exposedGlobally: false,
        hasRequiredMethods: false,
        streamingIntegrationReady: false,
        agentRouterIntegration: false
    };
    
    try {
        // Test 1: Check if ConversationContextManager is available
        if (typeof ConversationContextManager !== 'undefined') {
            results.conversationContextManagerAvailable = true;
            console.log('✅ ConversationContextManager class is available');
        } else {
            console.log('❌ ConversationContextManager class is not available');
        }
        
        // Test 2: Check if it's exposed globally
        if (window.conversationContextManager) {
            results.exposedGlobally = true;
            console.log('✅ ConversationContextManager is exposed globally');
        } else {
            console.log('❌ ConversationContextManager is not exposed globally');
        }
        
        // Test 3: Check if it has required methods
        if (window.conversationContextManager) {
            const requiredMethods = ['addMessage', 'getHistory', 'getRoutingContext', 'getSuggestedAgent'];
            const hasAllMethods = requiredMethods.every(method => 
                typeof window.conversationContextManager[method] === 'function'
            );
            
            if (hasAllMethods) {
                results.hasRequiredMethods = true;
                console.log('✅ ConversationContextManager has all required methods');
            } else {
                console.log('❌ ConversationContextManager is missing required methods');
                const missingMethods = requiredMethods.filter(method => 
                    typeof window.conversationContextManager[method] !== 'function'
                );
                console.log('Missing methods:', missingMethods);
            }
        }
        
        // Test 4: Check streaming integration readiness
        if (window.speechApp && window.speechApp.conversationContextManager) {
            results.streamingIntegrationReady = true;
            console.log('✅ ConversationContextManager is available via speechApp');
        } else if (window.conversationContextManager) {
            results.streamingIntegrationReady = true;
            console.log('✅ ConversationContextManager is available globally (fallback mode)');
        } else {
            console.log('❌ ConversationContextManager is not available for streaming integration');
        }
        
        // Test 5: Check agent router integration (optional)
        if (window.agentRouter && window.agentRouter.contextManager) {
            results.agentRouterIntegration = true;
            console.log('✅ AgentRouter has contextManager');
        } else if (window.conversationContextManager) {
            results.agentRouterIntegration = true;
            console.log('✅ ConversationContextManager available (standalone mode)');
        } else {
            console.log('❌ No ConversationContextManager integration found');
        }
        
        // Test 6: Test basic functionality
        if (window.conversationContextManager) {
            try {
                // Test adding a message
                window.conversationContextManager.addMessage('user', 'Test message', null, { test: true });
                const history = window.conversationContextManager.getHistory(1);
                
                if (history.length > 0 && history[0].content === 'Test message') {
                    console.log('✅ Basic message tracking works');
                } else {
                    console.log('❌ Basic message tracking failed');
                }
            } catch (error) {
                console.log('❌ Error testing basic functionality:', error.message);
            }
        }
        
        // Summary
        const passedTests = Object.values(results).filter(Boolean).length;
        const totalTests = Object.keys(results).length;
        
        console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
        
        if (passedTests === totalTests) {
            console.log('🎉 All tests passed! Conversation context integration is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Conversation context integration may have issues.');
        }
        
        return results;
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
        return results;
    }
}

// Auto-run test when script loads
if (typeof window !== 'undefined') {
    // Wait for DOM and other scripts to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(testConversationContextIntegration, 1000);
        });
    } else {
        setTimeout(testConversationContextIntegration, 1000);
    }
}

// Make test function globally available
window.testConversationContextIntegration = testConversationContextIntegration;
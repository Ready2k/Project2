/**
 * Simple verification script to check if conversation context manager is properly integrated
 * Run this in the browser console on the main application page
 */

function verifyConversationContextFix() {
    console.log('🔍 Verifying Conversation Context Manager Integration...\n');
    
    const checks = [
        {
            name: 'ConversationContextManager Class Available',
            test: () => typeof ConversationContextManager !== 'undefined',
            fix: 'Ensure agents/conversation-context-manager.js is loaded'
        },
        {
            name: 'Global ConversationContextManager Instance',
            test: () => window.conversationContextManager !== undefined,
            fix: 'Check script.js AgentRouter initialization or fallback creation'
        },
        {
            name: 'ConversationContextManager Has Required Methods',
            test: () => {
                if (!window.conversationContextManager) return false;
                const methods = ['addMessage', 'getHistory', 'getRoutingContext', 'getSuggestedAgent'];
                return methods.every(method => typeof window.conversationContextManager[method] === 'function');
            },
            fix: 'Verify ConversationContextManager class is properly loaded'
        },
        {
            name: 'SpeechApp Integration',
            test: () => window.speechApp && window.speechApp.conversationContextManager,
            fix: 'Check if speechApp properly exposes conversationContextManager'
        },
        {
            name: 'AgentRouter Integration',
            test: () => window.agentRouter && window.agentRouter.contextManager,
            fix: 'Verify AgentRouter initialization and contextManager creation'
        },
        {
            name: 'StreamingManager Integration Ready',
            test: () => {
                // Check if streaming manager can access conversation context manager
                return window.conversationContextManager !== undefined;
            },
            fix: 'Ensure global exposure is working'
        }
    ];
    
    let passedCount = 0;
    let failedChecks = [];
    
    checks.forEach((check, index) => {
        try {
            const result = check.test();
            const status = result ? '✅ PASS' : '❌ FAIL';
            console.log(`${index + 1}. ${check.name}: ${status}`);
            
            if (result) {
                passedCount++;
            } else {
                failedChecks.push({
                    name: check.name,
                    fix: check.fix
                });
            }
        } catch (error) {
            console.log(`${index + 1}. ${check.name}: ❌ ERROR - ${error.message}`);
            failedChecks.push({
                name: check.name,
                fix: check.fix,
                error: error.message
            });
        }
    });
    
    console.log(`\n📊 Results: ${passedCount}/${checks.length} checks passed`);
    
    if (passedCount === checks.length) {
        console.log('🎉 All checks passed! Conversation context integration is working correctly.');
        
        // Test basic functionality
        console.log('\n🧪 Testing basic functionality...');
        try {
            window.conversationContextManager.addMessage('user', 'Test message for verification', null, { test: true });
            const history = window.conversationContextManager.getHistory(1);
            
            if (history.length > 0 && history[0].content === 'Test message for verification') {
                console.log('✅ Basic message tracking works correctly');
            } else {
                console.log('❌ Basic message tracking failed');
            }
        } catch (error) {
            console.log('❌ Error testing basic functionality:', error.message);
        }
        
    } else {
        console.log('⚠️  Some checks failed. Here are the issues and suggested fixes:\n');
        
        failedChecks.forEach((check, index) => {
            console.log(`${index + 1}. ${check.name}`);
            console.log(`   Fix: ${check.fix}`);
            if (check.error) {
                console.log(`   Error: ${check.error}`);
            }
            console.log('');
        });
    }
    
    // Additional diagnostic info
    console.log('\n🔧 Diagnostic Information:');
    console.log('- window.conversationContextManager:', !!window.conversationContextManager);
    console.log('- window.speechApp:', !!window.speechApp);
    console.log('- window.agentRouter:', !!window.agentRouter);
    console.log('- ConversationContextManager class:', typeof ConversationContextManager);
    
    if (window.speechApp) {
        console.log('- speechApp.conversationContextManager:', !!window.speechApp.conversationContextManager);
        console.log('- speechApp.agentRouter:', !!window.speechApp.agentRouter);
    }
    
    if (window.agentRouter) {
        console.log('- agentRouter.contextManager:', !!window.agentRouter.contextManager);
    }
    
    return {
        passed: passedCount,
        total: checks.length,
        success: passedCount === checks.length,
        failedChecks: failedChecks
    };
}

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
    // Make function globally available
    window.verifyConversationContextFix = verifyConversationContextFix;
    
    // Auto-run after a delay to allow other scripts to load
    setTimeout(() => {
        console.log('🚀 Auto-running conversation context verification...');
        verifyConversationContextFix();
    }, 2000);
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = verifyConversationContextFix;
}
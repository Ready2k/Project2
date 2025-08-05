/**
 * Fix for agent routing not working in streaming mode
 * This script ensures agent routing is properly initialized and enabled
 */

// Wait for everything to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Agent routing fix loading...');
    
    // Wait a bit for all components to initialize
    setTimeout(async () => {
        await fixAgentRouting();
    }, 2000);
});

async function fixAgentRouting() {
    console.log('🔧 Attempting to fix agent routing...');
    
    try {
        // Step 1: Check current status
        console.log('📊 Current status:');
        console.log('- StreamingManager exists:', !!window.streamingManager);
        console.log('- AgentRouter exists:', !!window.agentRouter);
        console.log('- StreamingAgentRouter class exists:', typeof window.StreamingAgentRouter);
        
        if (window.streamingManager) {
            console.log('- Agent routing enabled:', window.streamingManager.agentRoutingEnabled);
            console.log('- StreamingAgentRouter instance:', !!window.streamingManager.streamingAgentRouter);
        }
        
        // Step 2: Force initialization if needed
        if (window.streamingManager && !window.streamingManager.streamingAgentRouter) {
            console.log('🔧 StreamingAgentRouter not initialized, attempting manual initialization...');
            
            if (typeof window.streamingManager.initializeAgentRouting === 'function') {
                await window.streamingManager.initializeAgentRouting();
                console.log('✅ Manual initialization completed');
            }
        }
        
        // Step 3: Enable agent routing
        if (window.streamingManager && typeof window.streamingManager.setAgentRoutingEnabled === 'function') {
            window.streamingManager.setAgentRoutingEnabled(true);
            console.log('✅ Agent routing enabled');
        }
        
        // Step 4: Try the routing initializer if still not working
        if (window.streamingManager && !window.streamingManager.agentRoutingEnabled && window.streamingAgentRoutingInitializer) {
            console.log('🔧 Trying routing initializer...');
            
            const config = {
                agentRoutingEnabled: true,
                routingLatencyThreshold: 100,
                maxRoutingTimeout: 200
            };
            
            const dependencies = {
                streamingManager: window.streamingManager,
                agentRouter: window.agentRouter
            };
            
            const result = await window.streamingAgentRoutingInitializer.initialize(config, dependencies);
            console.log('Initializer result:', result);
        }
        
        // Step 5: Final status check
        console.log('🎯 Final status:');
        if (window.streamingManager) {
            console.log('- Agent routing enabled:', window.streamingManager.agentRoutingEnabled);
            console.log('- StreamingAgentRouter instance:', !!window.streamingManager.streamingAgentRouter);
            
            if (typeof window.streamingManager.getAgentRoutingStatus === 'function') {
                console.log('- Full routing status:', window.streamingManager.getAgentRoutingStatus());
            }
        }
        
        // Step 6: Test routing if available
        if (window.streamingManager && window.streamingManager.streamingAgentRouter) {
            console.log('🧪 Testing routing...');
            await testRouting();
        }
        
    } catch (error) {
        console.error('❌ Error fixing agent routing:', error);
    }
}

async function testRouting() {
    try {
        const testMessages = [
            "What's my balance?",
            "I think there's fraud on my account",
            "I need to make a payment",
            "Help me verify my identity"
        ];
        
        for (const message of testMessages) {
            console.log(`Testing: "${message}"`);
            
            const result = await window.streamingManager.streamingAgentRouter.routeStreamingMessage(
                message,
                { sessionId: 'test-session' }
            );
            
            console.log(`→ Routed to: ${result.selectedAgent?.name || 'Unknown'}`);
        }
        
    } catch (error) {
        console.error('❌ Routing test failed:', error);
    }
}

// Make functions available globally for manual testing
window.fixAgentRouting = fixAgentRouting;
window.testRouting = testRouting;

console.log('🔧 Agent routing fix loaded. Functions available:');
console.log('- fixAgentRouting() - Attempt to fix routing');
console.log('- testRouting() - Test routing with sample messages');
/**
 * Debug script to check agent routing status in streaming mode
 */
function debugAgentRouting() {
    console.log('=== Agent Routing Debug ===');
    
    // Check if components exist
    console.log('Component availability:');
    console.log('- StreamingAgentRouter:', typeof window.StreamingAgentRouter);
    console.log('- StreamingResponseHandler:', typeof window.StreamingResponseHandler);
    console.log('- agentRouter:', !!window.agentRouter);
    console.log('- streamingManager:', !!window.streamingManager);
    
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (streamingManager) {
        console.log('\nStreaming Manager Status:');
        console.log('- Found at:', window.streamingManager ? 'window.streamingManager' : 'window.speechApp.streamingManager');
        console.log('- agentRoutingEnabled:', streamingManager.agentRoutingEnabled);
        console.log('- streamingAgentRouter:', !!streamingManager.streamingAgentRouter);
        console.log('- streamingResponseHandler:', !!streamingManager.streamingResponseHandler);
        console.log('- currentStreamingAgent:', streamingManager.currentStreamingAgent);
        
        // Get full routing status
        if (typeof streamingManager.getAgentRoutingStatus === 'function') {
            console.log('\nFull routing status:', streamingManager.getAgentRoutingStatus());
        }
    }
    
    const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
    
    if (agentRouter) {
        console.log('\nAgent Router Status:');
        console.log('- Found at:', window.agentRouter ? 'window.agentRouter' : 'window.speechApp.agentRouter');
        console.log('- Available agents:', agentRouter.getRegisteredAgents().map(a => a.name));
    }
    
    // Check if streaming agent routing initializer ran
    if (window.streamingAgentRoutingInitializer) {
        console.log('\nInitializer available:', !!window.streamingAgentRoutingInitializer);
    }
    
    // Test a sample routing
    let testStreamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (testStreamingManager && testStreamingManager.streamingAgentRouter) {
        console.log('\n=== Testing Sample Routing ===');
        testSampleRouting();
    } else {
        console.log('\n❌ Cannot test routing - components not available');
        
        // Try to manually initialize
        console.log('\n🔧 Attempting manual initialization...');
        attemptManualInitialization();
    }
}

async function testSampleRouting() {
    try {
        const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
        const testTranscript = "I think there's fraud on my account";
        console.log('Testing routing for:', testTranscript);
        
        const result = await streamingManager.streamingAgentRouter.routeStreamingMessage(
            testTranscript,
            { sessionId: 'test-session' }
        );
        
        console.log('Routing result:', result);
    } catch (error) {
        console.error('Routing test failed:', error);
    }
}

async function attemptManualInitialization() {
    try {
        const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
        
        // Check if we can manually initialize
        if (streamingManager && typeof streamingManager.initializeAgentRouting === 'function') {
            console.log('Calling initializeAgentRouting...');
            await streamingManager.initializeAgentRouting();
            
            console.log('After manual initialization:');
            console.log('- agentRoutingEnabled:', streamingManager.agentRoutingEnabled);
            console.log('- streamingAgentRouter:', !!streamingManager.streamingAgentRouter);
        }
        
        // Try the routing initializer
        if (window.streamingAgentRoutingInitializer) {
            console.log('Trying streamingAgentRoutingInitializer...');
            
            const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
            const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
            
            const config = {
                agentRoutingEnabled: true,
                routingLatencyThreshold: 100,
                maxRoutingTimeout: 200
            };
            
            const dependencies = {
                streamingManager: streamingManager,
                agentRouter: agentRouter
            };
            
            const result = await window.streamingAgentRoutingInitializer.initialize(config, dependencies);
            console.log('Initializer result:', result);
        }
        
    } catch (error) {
        console.error('Manual initialization failed:', error);
    }
}

// Enable agent routing if possible
function enableAgentRouting() {
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (streamingManager && typeof streamingManager.setAgentRoutingEnabled === 'function') {
        console.log('Enabling agent routing...');
        streamingManager.setAgentRoutingEnabled(true);
        console.log('Agent routing enabled:', streamingManager.agentRoutingEnabled);
    } else {
        console.log('Cannot enable agent routing - method not available');
    }
}

// Run the debug
debugAgentRouting();

// Export functions for manual testing
window.debugAgentRouting = debugAgentRouting;
window.enableAgentRouting = enableAgentRouting;
window.testSampleRouting = testSampleRouting;

console.log('\n🔧 Debug functions available:');
console.log('- debugAgentRouting() - Run full debug');
console.log('- enableAgentRouting() - Try to enable routing');
console.log('- testSampleRouting() - Test routing with sample text');
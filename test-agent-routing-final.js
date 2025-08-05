/**
 * Final comprehensive test for agent routing
 * This tests the complete agent routing pipeline with proper dependencies
 */

console.log('🧪 Loading final agent routing test...');

// Wait for everything to be ready
window.addEventListener('load', function() {
    setTimeout(async () => {
        await runFinalAgentRoutingTest();
    }, 5000); // Wait 5 seconds for all fixes to be applied
});

async function runFinalAgentRoutingTest() {
    console.log('🧪 Running final agent routing test...');
    
    try {
        // Step 1: Verify all dependencies are available
        await verifyDependencies();
        
        // Step 2: Test direct agent routing
        await testDirectAgentRouting();
        
        // Step 3: Test streaming agent routing
        await testStreamingAgentRouting();
        
        console.log('✅ Final agent routing test completed!');
        
    } catch (error) {
        console.error('❌ Final agent routing test failed:', error);
    }
}

async function verifyDependencies() {
    console.log('🔍 Verifying dependencies...');
    
    const dependencies = {
        PersonaManager: typeof PersonaManager !== 'undefined',
        personaManager: !!window.personaManager,
        agentRouter: !!(window.agentRouter || (window.speechApp && window.speechApp.agentRouter)),
        streamingManager: !!(window.streamingManager || (window.speechApp && window.speechApp.streamingManager)),
        conversationContextManager: !!window.conversationContextManager,
        apiClient: !!(window.apiClient || (window.speechApp && window.speechApp.apiClient))
    };
    
    console.log('📊 Dependencies status:', dependencies);
    
    // Check PersonaManager functionality
    if (window.personaManager) {
        try {
            const currentPersona = window.personaManager.getCurrentPersona();
            const personaData = window.personaManager.getCurrentPersonaData();
            console.log('✅ PersonaManager working:', { currentPersona, personaData: !!personaData });
        } catch (error) {
            console.error('❌ PersonaManager error:', error);
        }
    }
    
    return dependencies;
}

async function testDirectAgentRouting() {
    console.log('🧪 Testing direct agent routing...');
    
    const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
    
    if (!agentRouter) {
        console.error('❌ AgentRouter not available');
        return;
    }
    
    const testCases = [
        { input: "What's my balance?", expectedAgent: "BankingInfoAgent" },
        { input: "I think there's fraud on my account", expectedAgent: "FraudAgent" },
        { input: "I need to make a payment", expectedAgent: "PaymentsAgent" },
        { input: "Help me verify my identity", expectedAgent: "IDVAgent" }
    ];
    
    console.log('🧪 Testing direct agent routing with enhanced context...');
    
    for (const testCase of testCases) {
        try {
            console.log(`\n🧪 Testing: "${testCase.input}"`);
            
            // Create comprehensive context
            const context = {
                personaManager: window.personaManager,
                apiClient: window.apiClient || (window.speechApp && window.speechApp.apiClient),
                conversationContextManager: window.conversationContextManager,
                debugManager: window.debugManager,
                systemLogger: window.systemLogger,
                streamingMode: false
            };
            
            console.log('📋 Context provided:', {
                personaManager: !!context.personaManager,
                apiClient: !!context.apiClient,
                conversationContextManager: !!context.conversationContextManager
            });
            
            const result = await agentRouter.route(testCase.input, context);
            
            const success = result.success && result.agentName === testCase.expectedAgent;
            console.log(`→ Expected: ${testCase.expectedAgent}, Got: ${result.agentName || 'None'} ${success ? '✅' : '❌'}`);
            
            if (!success) {
                console.log('  Error:', result.error);
                console.log('  Full result:', result);
            } else {
                console.log('  Response:', result.response?.substring(0, 100) + '...');
            }
            
        } catch (error) {
            console.error(`❌ Direct routing test failed for "${testCase.input}":`, error);
        }
    }
}

async function testStreamingAgentRouting() {
    console.log('🧪 Testing streaming agent routing...');
    
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (!streamingManager || !streamingManager.streamingAgentRouter) {
        console.error('❌ StreamingAgentRouter not available');
        return;
    }
    
    const testCases = [
        { input: "What's my balance?", expectedAgent: "BankingInfoAgent" },
        { input: "I think there's fraud on my account", expectedAgent: "FraudAgent" },
        { input: "That wasn't me. I think that was fraud.", expectedAgent: "FraudAgent" },
        { input: "I need to make a payment", expectedAgent: "PaymentsAgent" }
    ];
    
    console.log('🧪 Testing streaming agent routing with enhanced context...');
    
    for (const testCase of testCases) {
        try {
            console.log(`\n🧪 Testing: "${testCase.input}"`);
            
            // Create comprehensive session context
            const sessionContext = {
                sessionId: 'test-session-' + Date.now(),
                personaManager: window.personaManager,
                apiClient: window.apiClient || (window.speechApp && window.speechApp.apiClient),
                conversationContextManager: window.conversationContextManager,
                debugManager: window.debugManager,
                systemLogger: window.systemLogger,
                streamingMode: true
            };
            
            console.log('📋 Session context provided:', {
                personaManager: !!sessionContext.personaManager,
                apiClient: !!sessionContext.apiClient,
                conversationContextManager: !!sessionContext.conversationContextManager
            });
            
            const result = await streamingManager.streamingAgentRouter.routeStreamingMessage(
                testCase.input,
                sessionContext
            );
            
            const selectedAgent = result.selectedAgent?.name || result.agentName || 'None';
            const success = result.success && selectedAgent === testCase.expectedAgent;
            
            console.log(`→ Expected: ${testCase.expectedAgent}, Got: ${selectedAgent} ${success ? '✅' : '❌'}`);
            
            if (!success) {
                console.log('  Error:', result.error);
                console.log('  Full result:', result);
            } else {
                console.log('  Agent response:', result.agentResponse?.response?.substring(0, 100) + '...');
            }
            
        } catch (error) {
            console.error(`❌ Streaming routing test failed for "${testCase.input}":`, error);
        }
    }
}

// Make functions available globally
window.runFinalAgentRoutingTest = runFinalAgentRoutingTest;
window.testDirectAgentRouting = testDirectAgentRouting;
window.testStreamingAgentRouting = testStreamingAgentRouting;

console.log('🧪 Final agent routing test loaded');
console.log('Available functions:');
console.log('- runFinalAgentRoutingTest() - Run complete test suite');
console.log('- testDirectAgentRouting() - Test direct agent routing');
console.log('- testStreamingAgentRouting() - Test streaming agent routing');
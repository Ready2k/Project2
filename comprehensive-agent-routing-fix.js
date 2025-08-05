/**
 * Comprehensive fix for agent routing in streaming mode
 * This addresses multiple potential issues with agent routing
 */

console.log('🔧 Loading comprehensive agent routing fix...');

// Wait for DOM and components to load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async () => {
        await comprehensiveAgentRoutingFix();
    }, 3000); // Wait 3 seconds for all components to initialize
});

async function comprehensiveAgentRoutingFix() {
    console.log('🔧 Starting comprehensive agent routing fix...');
    
    try {
        // Step 1: Verify all components exist
        console.log('📊 Component verification:');
        const components = {
            streamingManager: !!window.streamingManager,
            agentRouter: !!window.agentRouter,
            StreamingAgentRouter: typeof window.StreamingAgentRouter === 'function',
            StreamingResponseHandler: typeof window.StreamingResponseHandler === 'function',
            streamingAgentRoutingInitializer: !!window.streamingAgentRoutingInitializer
        };
        
        console.log('Components:', components);
        
        // Step 2: Check agent registration
        if (window.agentRouter) {
            const registeredAgents = window.agentRouter.getRegisteredAgents();
            console.log('📋 Registered agents:', registeredAgents.map(a => ({ name: a.name, enabled: a.enabled })));
            
            // Ensure all agents are enabled
            registeredAgents.forEach(agent => {
                if (agent.enabled === false) {
                    console.log(`🔧 Enabling agent: ${agent.name}`);
                    agent.enabled = true;
                }
            });
        }
        
        // Step 3: Force streaming manager initialization
        const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
        
        if (streamingManager && !streamingManager.streamingAgentRouter) {
            console.log('🔧 Forcing streaming manager agent routing initialization...');
            console.log('Found StreamingManager at:', window.streamingManager ? 'window.streamingManager' : 'window.speechApp.streamingManager');
            
            if (typeof streamingManager.initializeAgentRouting === 'function') {
                await streamingManager.initializeAgentRouting();
                console.log('✅ Streaming manager agent routing initialized');
            }
        }
        
        // Step 4: Enable agent routing
        if (streamingManager && typeof streamingManager.setAgentRoutingEnabled === 'function') {
            streamingManager.setAgentRoutingEnabled(true);
            console.log('✅ Agent routing enabled in streaming manager');
        }
        
        // Step 5: Use the routing initializer if needed
        if (!streamingManager?.agentRoutingEnabled && window.streamingAgentRoutingInitializer) {
            console.log('🔧 Using routing initializer...');
            
            const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
            
            const config = {
                agentRoutingEnabled: true,
                routingLatencyThreshold: 100,
                maxRoutingTimeout: 200,
                circuitBreakerThreshold: 5,
                sessionUpdateRetries: 3,
                performanceOptimizationEnabled: true
            };
            
            const dependencies = {
                streamingManager: streamingManager,
                agentRouter: agentRouter,
                debugManager: window.debugManager
            };
            
            const result = await window.streamingAgentRoutingInitializer.initialize(config, dependencies);
            console.log('Routing initializer result:', result);
        }
        
        // Step 6: Test the routing
        await testAgentRouting();
        
        // Step 7: Set up monitoring
        setupRoutingMonitoring();
        
        console.log('✅ Comprehensive agent routing fix completed');
        
    } catch (error) {
        console.error('❌ Error in comprehensive agent routing fix:', error);
    }
}

async function testAgentRouting() {
    console.log('🧪 Testing agent routing...');
    
    if (!window.streamingManager?.streamingAgentRouter) {
        console.log('❌ StreamingAgentRouter not available for testing');
        return;
    }
    
    const testCases = [
        { input: "What's my balance?", expectedAgent: "BankingInfoAgent" },
        { input: "I think there's fraud on my account", expectedAgent: "FraudAgent" },
        { input: "I need to make a payment", expectedAgent: "PaymentsAgent" },
        { input: "Help me verify my identity", expectedAgent: "IDVAgent" }
    ];
    
    for (const testCase of testCases) {
        try {
            console.log(`Testing: "${testCase.input}"`);
            
            const result = await window.streamingManager.streamingAgentRouter.routeStreamingMessage(
                testCase.input,
                { sessionId: 'test-session' }
            );
            
            const selectedAgent = result.selectedAgent?.name || 'Unknown';
            const success = selectedAgent === testCase.expectedAgent;
            
            console.log(`→ Expected: ${testCase.expectedAgent}, Got: ${selectedAgent} ${success ? '✅' : '❌'}`);
            
            if (!success) {
                console.log('  Full result:', result);
            }
            
        } catch (error) {
            console.error(`❌ Test failed for "${testCase.input}":`, error);
        }
    }
}

function setupRoutingMonitoring() {
    console.log('📊 Setting up routing monitoring...');
    
    // Monitor streaming manager routing
    if (window.streamingManager && window.streamingManager.routeThroughAgentsWithErrorHandling) {
        const originalMethod = window.streamingManager.routeThroughAgentsWithErrorHandling;
        
        window.streamingManager.routeThroughAgentsWithErrorHandling = async function(transcript) {
            console.log('🔄 ROUTING ATTEMPT:', transcript);
            console.log('  - Agent routing enabled:', this.agentRoutingEnabled);
            console.log('  - StreamingAgentRouter available:', !!this.streamingAgentRouter);
            
            try {
                const result = await originalMethod.call(this, transcript);
                console.log('✅ ROUTING SUCCESS:', {
                    transcript: transcript.substring(0, 50),
                    currentAgent: this.currentStreamingAgent
                });
                return result;
            } catch (error) {
                console.error('❌ ROUTING ERROR:', error);
                throw error;
            }
        };
    }
    
    // Monitor agent router routing
    if (window.agentRouter && window.agentRouter.route) {
        const originalRoute = window.agentRouter.route;
        
        window.agentRouter.route = async function(inputText, context) {
            console.log('🎯 AGENT ROUTER:', inputText.substring(0, 50));
            
            try {
                const result = await originalRoute.call(this, inputText, context);
                console.log('✅ AGENT SELECTED:', result.agentName || 'None');
                return result;
            } catch (error) {
                console.error('❌ AGENT ROUTING ERROR:', error);
                throw error;
            }
        };
    }
    
    console.log('✅ Routing monitoring set up');
}

// Make functions available globally
window.comprehensiveAgentRoutingFix = comprehensiveAgentRoutingFix;
window.testAgentRouting = testAgentRouting;

console.log('🔧 Comprehensive agent routing fix loaded');
console.log('Available functions:');
console.log('- comprehensiveAgentRoutingFix() - Run the full fix');
console.log('- testAgentRouting() - Test routing with sample messages');
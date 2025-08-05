/**
 * Final fix for streaming agent routing
 * This ensures that agent routing works properly in streaming mode
 */

console.log('🚀 Loading final streaming routing fix...');

// Wait for everything to be ready
window.addEventListener('load', function() {
    setTimeout(async () => {
        await finalStreamingRoutingFix();
    }, 4000); // Wait 4 seconds for everything to initialize
});

async function finalStreamingRoutingFix() {
    console.log('🚀 Starting final streaming routing fix...');
    
    try {
        // Step 1: Verify and fix agent registration
        await verifyAndFixAgentRegistration();
        
        // Step 2: Force streaming manager initialization
        await forceStreamingManagerInitialization();
        
        // Step 3: Override the routing logic to ensure it works
        overrideStreamingRoutingLogic();
        
        // Step 4: Test the fix
        await testStreamingRoutingFix();
        
        console.log('✅ Final streaming routing fix completed successfully!');
        
    } catch (error) {
        console.error('❌ Final streaming routing fix failed:', error);
    }
}

async function verifyAndFixAgentRegistration() {
    console.log('🔍 Verifying agent registration...');
    
    if (!window.agentRouter) {
        console.error('❌ AgentRouter not available');
        return;
    }
    
    const agents = window.agentRouter.getRegisteredAgents();
    console.log('📋 Registered agents:', agents.map(a => ({ name: a.name, enabled: a.enabled })));
    
    // Test each agent's canHandle method
    const testInput = "I think there's fraud on my account";
    console.log(`🧪 Testing agents with: "${testInput}"`);
    
    for (const agent of agents) {
        try {
            const canHandle = agent.canHandle(testInput);
            console.log(`  - ${agent.name}: ${canHandle ? '✅ CAN HANDLE' : '❌ Cannot handle'}`);
            
            // Ensure agent is enabled
            if (agent.enabled === false) {
                agent.enabled = true;
                console.log(`  - ${agent.name}: ✅ Enabled`);
            }
        } catch (error) {
            console.error(`  - ${agent.name}: ❌ Error testing canHandle:`, error);
        }
    }
}

async function forceStreamingManagerInitialization() {
    console.log('🔧 Forcing streaming manager initialization...');
    
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (!streamingManager) {
        console.error('❌ StreamingManager not available');
        return;
    }
    
    console.log('✅ Found StreamingManager at:', window.streamingManager ? 'window.streamingManager' : 'window.speechApp.streamingManager');
    
    // Force initialization of agent routing
    if (typeof streamingManager.initializeAgentRouting === 'function') {
        await streamingManager.initializeAgentRouting();
        console.log('✅ Agent routing initialized');
    }
    
    // Enable agent routing
    if (typeof streamingManager.setAgentRoutingEnabled === 'function') {
        streamingManager.setAgentRoutingEnabled(true);
        console.log('✅ Agent routing enabled');
    }
    
    // Check final status
    console.log('📊 Streaming manager status:');
    console.log('  - agentRoutingEnabled:', streamingManager.agentRoutingEnabled);
    console.log('  - streamingAgentRouter:', !!streamingManager.streamingAgentRouter);
}

function overrideStreamingRoutingLogic() {
    console.log('🔧 Overriding streaming routing logic...');
    
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (!streamingManager) {
        console.error('❌ StreamingManager not available for override');
        return;
    }
    
    console.log('✅ Found StreamingManager for override at:', window.streamingManager ? 'window.streamingManager' : 'window.speechApp.streamingManager');
    
    // Override the handleMessage method to ensure routing works
    if (streamingManager.handleMessage) {
        const originalHandleMessage = streamingManager.handleMessage;
        
        streamingManager.handleMessage = async function(event) {
            const message = JSON.parse(event.data);
            
            // Intercept transcription completed messages
            if (message.type === 'conversation.item.input_audio_transcription.completed') {
                const transcript = message.transcript;
                
                if (transcript && transcript.trim()) {
                    console.log('🎯 INTERCEPTED TRANSCRIPT:', transcript);
                    
                    // Force agent routing
                    if (this.agentRoutingEnabled && this.streamingAgentRouter) {
                        console.log('🔄 Forcing agent routing...');
                        
                        try {
                            const routingResult = await this.streamingAgentRouter.routeStreamingMessage(
                                transcript,
                                this.getSessionContext()
                            );
                            
                            if (routingResult.success) {
                                console.log('✅ AGENT ROUTING SUCCESS:', routingResult.selectedAgent?.name);
                                
                                // Update current agent
                                this.currentStreamingAgent = routingResult.selectedAgent?.name || 'DefaultAgent';
                                
                                // Update session with agent response
                                await this.updateSessionWithAgentResponse(routingResult);
                                
                                // Skip default OpenAI response
                                return;
                            } else {
                                console.log('❌ Agent routing failed:', routingResult.error);
                            }
                        } catch (error) {
                            console.error('❌ Agent routing error:', error);
                        }
                    } else {
                        console.log('❌ Agent routing not available:', {
                            enabled: this.agentRoutingEnabled,
                            router: !!this.streamingAgentRouter
                        });
                    }
                }
            }
            
            // Call original method
            return originalHandleMessage.call(this, event);
        };
        
        console.log('✅ Streaming routing logic overridden');
    }
}

async function testStreamingRoutingFix() {
    console.log('🧪 Testing streaming routing fix...');
    
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (!streamingManager?.streamingAgentRouter) {
        console.error('❌ Cannot test - StreamingAgentRouter not available');
        return;
    }
    
    const testCases = [
        "What's my balance?",
        "I think there's fraud on my account",
        "That wasn't me. I think that was fraud.",
        "I need to make a payment",
        "Help me verify my identity"
    ];
    
    for (const testInput of testCases) {
        try {
            console.log(`🧪 Testing: "${testInput}"`);
            
            const result = await streamingManager.streamingAgentRouter.routeStreamingMessage(
                testInput,
                { sessionId: 'test-session' }
            );
            
            const selectedAgent = result.selectedAgent?.name || 'None';
            console.log(`  → Routed to: ${selectedAgent} ${result.success ? '✅' : '❌'}`);
            
        } catch (error) {
            console.error(`  ❌ Test failed:`, error);
        }
    }
}

// Make functions available globally
window.finalStreamingRoutingFix = finalStreamingRoutingFix;
window.testStreamingRoutingFix = testStreamingRoutingFix;

console.log('🚀 Final streaming routing fix loaded');
console.log('Available functions:');
console.log('- finalStreamingRoutingFix() - Run the complete fix');
console.log('- testStreamingRoutingFix() - Test routing with sample messages');
/**
 * Fix for missing agent dependencies
 * This ensures agents have the required dependencies to function properly
 */

console.log('🔧 Loading agent dependencies fix...');

// Wait for everything to load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(async () => {
        await fixAgentDependencies();
    }, 2000);
});

async function fixAgentDependencies() {
    console.log('🔧 Starting agent dependencies fix...');
    
    try {
        // Step 1: Ensure PersonaManager is available
        await ensurePersonaManager();
        
        // Step 2: Fix agent context dependencies
        await fixAgentContexts();
        
        // Step 3: Test agent functionality
        await testAgentFunctionality();
        
        console.log('✅ Agent dependencies fix completed successfully!');
        
    } catch (error) {
        console.error('❌ Agent dependencies fix failed:', error);
    }
}

async function ensurePersonaManager() {
    console.log('🔍 Ensuring PersonaManager is available...');
    
    // Check if PersonaManager exists
    if (!window.PersonaManager) {
        console.error('❌ PersonaManager class not available');
        return;
    }
    
    // Check if there's already a global instance
    if (window.personaManager) {
        console.log('✅ PersonaManager instance already available');
        return;
    }
    
    // Check if speechApp has personaManager
    if (window.speechApp && window.speechApp.personaManager) {
        console.log('✅ PersonaManager available via speechApp');
        window.personaManager = window.speechApp.personaManager;
        return;
    }
    
    // Create a new PersonaManager instance if needed
    try {
        console.log('🔧 Creating new PersonaManager instance...');
        window.personaManager = new window.PersonaManager();
        console.log('✅ PersonaManager instance created');
    } catch (error) {
        console.error('❌ Failed to create PersonaManager:', error);
    }
}

async function fixAgentContexts() {
    console.log('🔧 Fixing agent contexts...');
    
    const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
    
    if (!agentRouter) {
        console.error('❌ AgentRouter not available');
        return;
    }
    
    const agents = agentRouter.getRegisteredAgents();
    console.log('📋 Found agents:', agents.map(a => a.name));
    
    // Create a proper context object with all required dependencies
    const context = {
        personaManager: window.personaManager || (window.speechApp && window.speechApp.personaManager),
        apiClient: window.apiClient || (window.speechApp && window.speechApp.apiClient),
        conversationContextManager: window.conversationContextManager || (window.speechApp && window.speechApp.conversationContextManager),
        debugManager: window.debugManager,
        systemLogger: window.systemLogger
    };
    
    console.log('🔧 Context dependencies:', {
        personaManager: !!context.personaManager,
        apiClient: !!context.apiClient,
        conversationContextManager: !!context.conversationContextManager,
        debugManager: !!context.debugManager,
        systemLogger: !!context.systemLogger
    });
    
    // Store the context globally for agents to use
    window.agentContext = context;
    
    console.log('✅ Agent context fixed and stored globally');
}

async function testAgentFunctionality() {
    console.log('🧪 Testing agent functionality...');
    
    const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
    
    if (!agentRouter) {
        console.error('❌ AgentRouter not available for testing');
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
            console.log(`🧪 Testing: "${testCase.input}"`);
            
            // Use the fixed context
            const context = window.agentContext || {
                personaManager: window.personaManager || (window.speechApp && window.speechApp.personaManager),
                apiClient: window.apiClient || (window.speechApp && window.speechApp.apiClient),
                conversationContextManager: window.conversationContextManager
            };
            
            const result = await agentRouter.route(testCase.input, context);
            
            const success = result.success && result.agentName === testCase.expectedAgent;
            console.log(`→ Expected: ${testCase.expectedAgent}, Got: ${result.agentName || 'None'} ${success ? '✅' : '❌'}`);
            
            if (!success) {
                console.log('  Error:', result.error);
            }
            
        } catch (error) {
            console.error(`❌ Test failed for "${testCase.input}":`, error);
        }
    }
}

// Override the StreamingAgentRouter to use the fixed context
function fixStreamingAgentRouter() {
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (!streamingManager || !streamingManager.streamingAgentRouter) {
        return;
    }
    
    const originalRouteMethod = streamingManager.streamingAgentRouter.routeStreamingMessage;
    
    streamingManager.streamingAgentRouter.routeStreamingMessage = async function(transcript, sessionContext) {
        // Ensure the context has all required dependencies
        const enhancedContext = {
            ...sessionContext,
            personaManager: window.personaManager || (window.speechApp && window.speechApp.personaManager),
            apiClient: window.apiClient || (window.speechApp && window.speechApp.apiClient),
            conversationContextManager: window.conversationContextManager,
            debugManager: window.debugManager,
            systemLogger: window.systemLogger
        };
        
        console.log('🔧 Enhanced context for streaming routing:', {
            personaManager: !!enhancedContext.personaManager,
            apiClient: !!enhancedContext.apiClient,
            conversationContextManager: !!enhancedContext.conversationContextManager
        });
        
        return originalRouteMethod.call(this, transcript, enhancedContext);
    };
    
    console.log('✅ StreamingAgentRouter context fixed');
}

// Apply the streaming router fix after a delay
setTimeout(() => {
    fixStreamingAgentRouter();
}, 3000);

// Make functions available globally
window.fixAgentDependencies = fixAgentDependencies;
window.testAgentFunctionality = testAgentFunctionality;
window.fixStreamingAgentRouter = fixStreamingAgentRouter;

console.log('🔧 Agent dependencies fix loaded');
console.log('Available functions:');
console.log('- fixAgentDependencies() - Fix all agent dependencies');
console.log('- testAgentFunctionality() - Test agent routing with proper context');
console.log('- fixStreamingAgentRouter() - Fix streaming agent router context');
/**
 * Direct fix for agent context dependencies
 * This patches the AgentRouter.route method to ensure all agents get required dependencies
 */

console.log('🔧 Loading direct agent context fix...');

// Apply the fix immediately when the script loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        applyDirectAgentContextFix();
    }, 1000);
});

function applyDirectAgentContextFix() {
    console.log('🔧 Applying direct agent context fix...');
    
    // Fix the main AgentRouter
    fixAgentRouter();
    
    // Fix the StreamingAgentRouter context passing
    fixStreamingAgentRouterContext();
    
    console.log('✅ Direct agent context fix applied');
}

function fixAgentRouter() {
    const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
    
    if (!agentRouter) {
        console.log('❌ AgentRouter not found');
        return;
    }
    
    // Patch the route method if not already patched
    if (agentRouter.route && !agentRouter.route._contextFixed) {
        const originalRoute = agentRouter.route;
        
        agentRouter.route = async function(inputText, context = {}) {
            // Ensure all required dependencies are in the context
            const enhancedContext = {
                ...context,
                personaManager: context.personaManager || window.personaManager || (window.speechApp && window.speechApp.personaManager),
                apiClient: context.apiClient || window.apiClient || (window.speechApp && window.speechApp.apiClient),
                conversationContextManager: context.conversationContextManager || window.conversationContextManager || (window.speechApp && window.speechApp.conversationContextManager),
                systemPromptsManager: context.systemPromptsManager || window.systemPromptsManager || (window.speechApp && window.speechApp.systemPromptsManager),
                debugManager: context.debugManager || window.debugManager,
                systemLogger: context.systemLogger || window.systemLogger
            };
            
            console.log('🔧 Enhanced agent context:', {
                personaManager: !!enhancedContext.personaManager,
                apiClient: !!enhancedContext.apiClient,
                conversationContextManager: !!enhancedContext.conversationContextManager,
                debugManager: !!enhancedContext.debugManager,
                systemLogger: !!enhancedContext.systemLogger
            });
            
            return originalRoute.call(this, inputText, enhancedContext);
        };
        
        agentRouter.route._contextFixed = true;
        console.log('✅ AgentRouter.route method patched');
    }
}

function fixStreamingAgentRouterContext() {
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (!streamingManager || !streamingManager.streamingAgentRouter) {
        console.log('❌ StreamingAgentRouter not found');
        return;
    }
    
    const streamingAgentRouter = streamingManager.streamingAgentRouter;
    
    // Patch the routeStreamingMessage method if not already patched
    if (streamingAgentRouter.routeStreamingMessage && !streamingAgentRouter.routeStreamingMessage._contextFixed) {
        const originalRouteStreamingMessage = streamingAgentRouter.routeStreamingMessage;
        
        streamingAgentRouter.routeStreamingMessage = async function(transcript, sessionContext = {}) {
            // Ensure all required dependencies are in the session context
            const enhancedSessionContext = {
                ...sessionContext,
                personaManager: sessionContext.personaManager || window.personaManager || (window.speechApp && window.speechApp.personaManager),
                apiClient: sessionContext.apiClient || window.apiClient || (window.speechApp && window.speechApp.apiClient),
                conversationContextManager: sessionContext.conversationContextManager || window.conversationContextManager || (window.speechApp && window.speechApp.conversationContextManager),
                systemPromptsManager: sessionContext.systemPromptsManager || window.systemPromptsManager || (window.speechApp && window.speechApp.systemPromptsManager),
                debugManager: sessionContext.debugManager || window.debugManager,
                systemLogger: sessionContext.systemLogger || window.systemLogger
            };
            
            console.log('🔧 Enhanced streaming context:', {
                transcript: transcript.substring(0, 50),
                personaManager: !!enhancedSessionContext.personaManager,
                apiClient: !!enhancedSessionContext.apiClient,
                conversationContextManager: !!enhancedSessionContext.conversationContextManager
            });
            
            return originalRouteStreamingMessage.call(this, transcript, enhancedSessionContext);
        };
        
        streamingAgentRouter.routeStreamingMessage._contextFixed = true;
        console.log('✅ StreamingAgentRouter.routeStreamingMessage method patched');
    }
}

// Also patch individual agent handle methods as a backup
function patchAgentHandleMethods() {
    const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
    
    if (!agentRouter) {
        return;
    }
    
    const agents = agentRouter.getRegisteredAgents();
    
    agents.forEach(agent => {
        if (agent.handle && !agent.handle._contextFixed) {
            const originalHandle = agent.handle;
            
            agent.handle = async function(inputText, context = {}) {
                // Ensure required dependencies
                const enhancedContext = {
                    ...context,
                    personaManager: context.personaManager || window.personaManager || (window.speechApp && window.speechApp.personaManager),
                    apiClient: context.apiClient || window.apiClient || (window.speechApp && window.speechApp.apiClient),
                    conversationContextManager: context.conversationContextManager || window.conversationContextManager,
                    systemPromptsManager: context.systemPromptsManager || window.systemPromptsManager || (window.speechApp && window.speechApp.systemPromptsManager),
                    debugManager: context.debugManager || window.debugManager,
                    systemLogger: context.systemLogger || window.systemLogger
                };
                
                return originalHandle.call(this, inputText, enhancedContext);
            };
            
            agent.handle._contextFixed = true;
        }
    });
    
    console.log(`✅ Patched ${agents.length} agent handle methods`);
}

// Apply agent patches after a delay to ensure agents are loaded
setTimeout(() => {
    patchAgentHandleMethods();
}, 2000);

// Make functions available globally
window.applyDirectAgentContextFix = applyDirectAgentContextFix;
window.fixAgentRouter = fixAgentRouter;
window.fixStreamingAgentRouterContext = fixStreamingAgentRouterContext;

console.log('🔧 Direct agent context fix loaded');
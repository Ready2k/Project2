/**
 * Fix Agent Routing Status
 * 
 * This script provides functions to check and fix agent routing status
 * to ensure conversations go through the proper agent routing system.
 */

console.log('🔧 Loading agent routing status fix...');

// Function to check agent routing status
function checkAgentRoutingStatus() {
    console.log('🔍 Checking agent routing status...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp) {
        console.error('❌ Speech app not available');
        return { available: false };
    }
    
    const status = {
        // Main app agent router
        hasAgentRouter: !!speechApp.agentRouter,
        agentRouterEnabled: speechApp.agentRouter ? true : false,
        
        // Streaming manager
        hasStreamingManager: !!speechApp.streamingManager,
        streamingAgentRoutingEnabled: speechApp.streamingManager ? speechApp.streamingManager.agentRoutingEnabled : false,
        hasStreamingAgentRouter: speechApp.streamingManager ? !!speechApp.streamingManager.streamingAgentRouter : false,
        
        // Current mode
        isStreamingMode: speechApp.isStreamingMode,
        isConnected: speechApp.isConnected,
        
        // Overall status
        agentRoutingWorking: false
    };
    
    // Determine if agent routing is working
    if (status.isStreamingMode) {
        status.agentRoutingWorking = status.streamingAgentRoutingEnabled && status.hasStreamingAgentRouter;
    } else {
        status.agentRoutingWorking = status.hasAgentRouter;
    }
    
    console.log('🔍 Agent routing status:', status);
    
    return status;
}

// Function to fix agent routing status
function fixAgentRoutingStatus() {
    console.log('🔧 Attempting to fix agent routing status...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp) {
        console.error('❌ Speech app not available');
        return false;
    }
    
    let fixed = false;
    
    // Fix streaming agent routing if needed
    if (speechApp.streamingManager && !speechApp.streamingManager.agentRoutingEnabled) {
        console.log('🔧 Enabling streaming agent routing...');
        
        // Enable agent routing
        speechApp.streamingManager.agentRoutingEnabled = true;
        
        // Set up streaming agent router if not already set
        if (!speechApp.streamingManager.streamingAgentRouter && speechApp.agentRouter) {
            if (typeof StreamingAgentRouter !== 'undefined') {
                speechApp.streamingManager.streamingAgentRouter = new StreamingAgentRouter(
                    speechApp.agentRouter,
                    speechApp.streamingManager
                );
                console.log('✅ StreamingAgentRouter created');
            }
        }
        
        // Set up streaming response handler if available
        if (!speechApp.streamingManager.streamingResponseHandler) {
            if (typeof StreamingResponseHandler !== 'undefined') {
                speechApp.streamingManager.streamingResponseHandler = new StreamingResponseHandler(
                    speechApp.streamingManager
                );
                console.log('✅ StreamingResponseHandler created');
            }
        }
        
        fixed = true;
    }
    
    // Call the app's enable method if available
    if (speechApp.enableStreamingAgentRouting) {
        speechApp.enableStreamingAgentRouting();
        console.log('✅ Called app enableStreamingAgentRouting method');
        fixed = true;
    }
    
    if (fixed) {
        console.log('✅ Agent routing status fixed');
        
        // Verify the fix
        const newStatus = checkAgentRoutingStatus();
        if (newStatus.agentRoutingWorking) {
            console.log('🎉 Agent routing is now working!');
        } else {
            console.warn('⚠️ Agent routing may still have issues');
        }
    } else {
        console.log('ℹ️ No fixes were needed or possible');
    }
    
    return fixed;
}

// Function to force enable agent routing
function forceEnableAgentRouting() {
    console.log('🔧 Force enabling agent routing...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp) {
        console.error('❌ Speech app not available');
        return false;
    }
    
    // Force enable streaming agent routing
    if (speechApp.streamingManager) {
        speechApp.streamingManager.agentRoutingEnabled = true;
        console.log('✅ Forced streaming agent routing enabled');
    }
    
    // Create missing components if needed
    if (speechApp.streamingManager && speechApp.agentRouter) {
        if (!speechApp.streamingManager.streamingAgentRouter && typeof StreamingAgentRouter !== 'undefined') {
            try {
                speechApp.streamingManager.streamingAgentRouter = new StreamingAgentRouter(
                    speechApp.agentRouter,
                    speechApp.streamingManager
                );
                console.log('✅ StreamingAgentRouter force created');
            } catch (error) {
                console.error('❌ Failed to create StreamingAgentRouter:', error);
            }
        }
        
        if (!speechApp.streamingManager.streamingResponseHandler && typeof StreamingResponseHandler !== 'undefined') {
            try {
                speechApp.streamingManager.streamingResponseHandler = new StreamingResponseHandler(
                    speechApp.streamingManager
                );
                console.log('✅ StreamingResponseHandler force created');
            } catch (error) {
                console.error('❌ Failed to create StreamingResponseHandler:', error);
            }
        }
    }
    
    console.log('🔧 Force enable completed');
    return checkAgentRoutingStatus();
}

// Auto-check and fix on load
if (typeof window !== 'undefined') {
    setTimeout(() => {
        console.log('🔧 Agent routing status fix ready');
        console.log('Available functions:');
        console.log('- checkAgentRoutingStatus() - Check current status');
        console.log('- fixAgentRoutingStatus() - Attempt to fix issues');
        console.log('- forceEnableAgentRouting() - Force enable agent routing');
        
        // Auto-check status
        const status = checkAgentRoutingStatus();
        
        if (!status.agentRoutingWorking) {
            console.warn('⚠️ Agent routing is not working properly');
            console.log('🔧 Auto-applying fix...');
            
            // Auto-apply the fix
            setTimeout(() => {
                const fixed = fixAgentRoutingStatus();
                if (fixed) {
                    console.log('✅ Agent routing auto-fix applied successfully');
                } else {
                    console.log('💡 Manual fix may be needed - run fixAgentRoutingStatus()');
                }
            }, 500);
        }
    }, 3000);
}

// Export functions globally
if (typeof window !== 'undefined') {
    window.checkAgentRoutingStatus = checkAgentRoutingStatus;
    window.fixAgentRoutingStatus = fixAgentRoutingStatus;
    window.forceEnableAgentRouting = forceEnableAgentRouting;
}

console.log('✅ Agent routing status fix loaded');
/**
 * Fix Streaming Agent Timeouts
 * 
 * This script fixes the overly aggressive timeout settings in StreamingAgentRouter
 * that are causing routing failures and circuit breaker activation.
 */

console.log('🔧 Loading streaming agent timeout fix...');

// Function to fix streaming agent router timeouts
function fixStreamingAgentTimeouts() {
    console.log('🔧 Applying streaming agent timeout fix...');

    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.streamingManager) {
        console.error('❌ StreamingManager not available');
        return false;
    }

    const streamingManager = speechApp.streamingManager;
    const streamingAgentRouter = streamingManager.streamingAgentRouter;

    if (!streamingAgentRouter) {
        console.error('❌ StreamingAgentRouter not available');
        return false;
    }

    // Store original values for reference
    const originalValues = {
        routingLatencyThreshold: streamingAgentRouter.routingLatencyThreshold,
        maxRoutingTimeout: streamingAgentRouter.maxRoutingTimeout,
        maxConsecutiveErrors: streamingAgentRouter.maxConsecutiveErrors
    };

    console.log('🔍 Original timeout values:', originalValues);

    // Update to more reasonable timeout values
    streamingAgentRouter.routingLatencyThreshold = 500; // Increased from 100ms to 500ms
    streamingAgentRouter.maxRoutingTimeout = 2000; // Increased from 200ms to 2000ms (2 seconds)
    streamingAgentRouter.maxConsecutiveErrors = 5; // Increased from 3 to 5

    // Reset circuit breaker if it's currently open
    if (streamingAgentRouter.circuitBreakerOpen) {
        streamingAgentRouter.circuitBreakerOpen = false;
        streamingAgentRouter.circuitBreakerResetTime = null;
        streamingAgentRouter.consecutiveErrors = 0;
        console.log('🔄 Circuit breaker reset');
    }

    const newValues = {
        routingLatencyThreshold: streamingAgentRouter.routingLatencyThreshold,
        maxRoutingTimeout: streamingAgentRouter.maxRoutingTimeout,
        maxConsecutiveErrors: streamingAgentRouter.maxConsecutiveErrors
    };

    console.log('✅ Updated timeout values:', newValues);
    console.log('✅ Streaming agent timeout fix applied');

    return true;
}

// Function to check current timeout settings
function checkStreamingAgentTimeouts() {
    console.log('🔍 Checking streaming agent timeout settings...');

    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.streamingManager) {
        console.log('❌ StreamingManager not available');
        return { available: false };
    }

    const streamingManager = speechApp.streamingManager;
    const streamingAgentRouter = streamingManager.streamingAgentRouter;

    if (!streamingAgentRouter) {
        console.log('❌ StreamingAgentRouter not available');
        return { available: false, hasRouter: false };
    }

    const status = {
        available: true,
        hasRouter: true,
        routingLatencyThreshold: streamingAgentRouter.routingLatencyThreshold,
        maxRoutingTimeout: streamingAgentRouter.maxRoutingTimeout,
        maxConsecutiveErrors: streamingAgentRouter.maxConsecutiveErrors,
        consecutiveErrors: streamingAgentRouter.consecutiveErrors,
        circuitBreakerOpen: streamingAgentRouter.circuitBreakerOpen,
        circuitBreakerResetTime: streamingAgentRouter.circuitBreakerResetTime
    };

    console.log('🔍 Current timeout settings:', status);

    // Check if timeouts are too aggressive
    const needsFix = status.routingLatencyThreshold < 300 || status.maxRoutingTimeout < 1000;
    if (needsFix) {
        console.warn('⚠️ Timeout settings are too aggressive and may cause routing failures');
        console.log('💡 Run fixStreamingAgentTimeouts() to apply more reasonable timeouts');
    }

    return status;
}

// Function to reset circuit breaker
function resetStreamingAgentCircuitBreaker() {
    console.log('🔄 Resetting streaming agent circuit breaker...');

    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.streamingManager || !speechApp.streamingManager.streamingAgentRouter) {
        console.error('❌ StreamingAgentRouter not available');
        return false;
    }

    const router = speechApp.streamingManager.streamingAgentRouter;

    router.circuitBreakerOpen = false;
    router.circuitBreakerResetTime = null;
    router.consecutiveErrors = 0;

    console.log('✅ Circuit breaker reset successfully');
    return true;
}

// Function to monitor routing performance
function monitorStreamingAgentRouting() {
    console.log('📊 Setting up streaming agent routing monitoring...');

    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.streamingManager || !speechApp.streamingManager.streamingAgentRouter) {
        console.error('❌ StreamingAgentRouter not available');
        return false;
    }

    const router = speechApp.streamingManager.streamingAgentRouter;

    // Store original route method
    if (!router._originalRouteTranscript) {
        router._originalRouteTranscript = router.routeTranscript.bind(router);

        // Override with monitoring
        router.routeTranscript = async function (transcript, context) {
            const startTime = Date.now();
            console.log('📊 Routing started:', transcript.substring(0, 50));

            try {
                const result = await this._originalRouteTranscript(transcript, context);
                const duration = Date.now() - startTime;

                console.log('📊 Routing completed:', {
                    success: result.success,
                    agentName: result.agentName,
                    duration: `${duration}ms`,
                    withinThreshold: duration <= this.routingLatencyThreshold
                });

                return result;

            } catch (error) {
                const duration = Date.now() - startTime;
                console.log('📊 Routing failed:', {
                    error: error.message,
                    duration: `${duration}ms`,
                    consecutiveErrors: this.consecutiveErrors
                });
                throw error;
            }
        };

        console.log('✅ Streaming agent routing monitoring enabled');
    }

    return true;
}

// Auto-setup when script loads
if (typeof window !== 'undefined') {
    setTimeout(() => {
        console.log('🔧 Streaming agent timeout fix ready');
        console.log('Available functions:');
        console.log('- fixStreamingAgentTimeouts() - Fix aggressive timeout settings');
        console.log('- checkStreamingAgentTimeouts() - Check current timeout settings');
        console.log('- resetStreamingAgentCircuitBreaker() - Reset circuit breaker');
        console.log('- monitorStreamingAgentRouting() - Monitor routing performance');

        // Auto-check status (but don't auto-fix since main app handles it)
        const status = checkStreamingAgentTimeouts();
        if (status.available && status.hasRouter) {
            const needsFix = status.routingLatencyThreshold < 300 || status.maxRoutingTimeout < 1000;
            if (needsFix || status.circuitBreakerOpen) {
                console.log('ℹ️ Timeout issues detected - main app should auto-fix these');
                console.log('💡 If issues persist, run fixStreamingAgentTimeouts() manually');
            } else {
                console.log('✅ Streaming agent timeouts are properly configured');
            }
        }
    }, 3000);
}

// Export functions globally
if (typeof window !== 'undefined') {
    window.fixStreamingAgentTimeouts = fixStreamingAgentTimeouts;
    window.checkStreamingAgentTimeouts = checkStreamingAgentTimeouts;
    window.resetStreamingAgentCircuitBreaker = resetStreamingAgentCircuitBreaker;
    window.monitorStreamingAgentRouting = monitorStreamingAgentRouting;
}

console.log('✅ Streaming agent timeout fix loaded');
/**
 * Test script to verify the StreamingAgentMiddleware fix
 */

console.log('🔧 Testing StreamingAgentMiddleware fix...');

// Test the middleware initialization
async function testMiddlewareFix() {
    try {
        if (!window.streamingAgentRoutingInitializer) {
            console.error('❌ StreamingAgentRoutingInitializer not available');
            return false;
        }

        // Create mock dependencies with handleMessage method
        const mockAgentRouter = {
            route: function(input, context) {
                return Promise.resolve({
                    success: true,
                    agent: 'TestAgent',
                    response: 'Test response'
                });
            },
            getStats: function() {
                return {
                    totalAgents: 1,
                    enabledAgents: 1,
                    disabledAgents: 0
                };
            }
        };

        const mockStreamingManager = {
            connect: function() {
                return Promise.resolve({ success: true });
            },
            sendMessage: function(message) {
                console.log('Mock sendMessage called:', message);
            },
            setAgentRoutingEnabled: function(enabled) {
                console.log('Mock setAgentRoutingEnabled called:', enabled);
            },
            setStreamingAgentRouter: function(router) {
                console.log('Mock setStreamingAgentRouter called');
            },
            handleMessage: function(event) {
                console.log('Mock handleMessage called with event:', event);
                return Promise.resolve();
            }
        };

        const dependencies = {
            streamingManager: mockStreamingManager,
            agentRouter: mockAgentRouter,
            debugManager: window.debugManager,
            systemLogger: window.systemLogger
        };

        const config = {
            agentRoutingEnabled: true,
            routingLatencyThreshold: 100,
            maxRoutingTimeout: 200,
            circuitBreakerThreshold: 5,
            sessionUpdateRetries: 3,
            performanceOptimizationEnabled: true,
            healthCheckInterval: 15000
        };

        console.log('🔍 Testing middleware initialization...');
        
        // First, ensure we start with a clean state
        await window.streamingAgentRoutingInitializer.cleanup();
        
        const initResult = await window.streamingAgentRoutingInitializer.initialize(config, dependencies);
        
        if (initResult.success) {
            console.log('✅ Initialization successful!');
            console.log(`   Initialization time: ${initResult.initializationTime}ms`);
            console.log('   Components initialized:', initResult.componentsInitialized);
            
            // Check if StreamingAgentMiddleware was initialized
            const middlewareInitialized = initResult.componentsInitialized.includes('StreamingAgentMiddleware');
            
            if (middlewareInitialized) {
                console.log('✅ StreamingAgentMiddleware initialized successfully!');
            } else {
                console.log('⚠️ StreamingAgentMiddleware was not initialized');
            }
            
            // Test cleanup
            console.log('🔍 Testing cleanup...');
            const cleanupResult = await window.streamingAgentRoutingInitializer.cleanup();
            
            if (cleanupResult.success) {
                console.log('✅ Cleanup successful!');
                
                if (middlewareInitialized) {
                    console.log('🎉 StreamingAgentMiddleware fix is working!');
                    return true;
                } else {
                    console.error('❌ StreamingAgentMiddleware was not initialized');
                    return false;
                }
            } else {
                console.error('❌ Cleanup failed:', cleanupResult.error);
                return false;
            }
        } else {
            console.error('❌ Initialization failed:', initResult.error);
            
            // Check if the error is related to handleMessage
            if (initResult.error && initResult.error.includes('handleMessage')) {
                console.error('   This suggests the handleMessage method is still missing or incorrect');
            }
            
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('   Stack trace:', error.stack);
        return false;
    }
}

// Run the test when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(testMiddlewareFix, 3000);
    });
} else {
    setTimeout(testMiddlewareFix, 3000);
}

// Make test function available globally
window.testMiddlewareFix = testMiddlewareFix;
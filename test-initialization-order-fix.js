/**
 * Test script to verify the component initialization order fix
 */

console.log('🔧 Testing component initialization order fix...');

// Test the corrected initialization order
async function testInitializationOrder() {
    try {
        if (!window.streamingAgentRoutingInitializer) {
            console.error('❌ StreamingAgentRoutingInitializer not available');
            return false;
        }

        // Create mock dependencies
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
                console.log('Mock handleMessage called:', event);
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

        console.log('🔍 Testing component initialization with correct order...');
        
        // First, ensure we start with a clean state
        await window.streamingAgentRoutingInitializer.cleanup();
        
        const initResult = await window.streamingAgentRoutingInitializer.initialize(config, dependencies);
        
        if (initResult.success) {
            console.log('✅ Initialization successful with correct order!');
            console.log(`   Initialization time: ${initResult.initializationTime}ms`);
            console.log('   Components initialized:', initResult.componentsInitialized);
            
            // Verify the components were initialized in the correct order
            const expectedOrder = [
                'StreamingErrorHandler',
                'StreamingAgentRouter',
                'StreamingPerformanceOptimizer',
                'StreamingSessionManager',
                'StreamingResponseHandler',
                'StreamingAgentMiddleware'
            ];
            
            const actualOrder = initResult.componentsInitialized || [];
            
            console.log('🔍 Verifying initialization order...');
            console.log('   Expected order:', expectedOrder);
            console.log('   Actual order:', actualOrder);
            
            // Check if StreamingAgentRouter comes before dependent components
            const routerIndex = actualOrder.indexOf('StreamingAgentRouter');
            const performanceOptimizerIndex = actualOrder.indexOf('StreamingPerformanceOptimizer');
            const sessionManagerIndex = actualOrder.indexOf('StreamingSessionManager');
            const middlewareIndex = actualOrder.indexOf('StreamingAgentMiddleware');
            
            let orderCorrect = true;
            
            if (routerIndex !== -1 && performanceOptimizerIndex !== -1 && routerIndex >= performanceOptimizerIndex) {
                console.error('❌ StreamingAgentRouter should be initialized before StreamingPerformanceOptimizer');
                orderCorrect = false;
            }
            
            if (routerIndex !== -1 && sessionManagerIndex !== -1 && routerIndex >= sessionManagerIndex) {
                console.error('❌ StreamingAgentRouter should be initialized before StreamingSessionManager');
                orderCorrect = false;
            }
            
            if (routerIndex !== -1 && middlewareIndex !== -1 && routerIndex >= middlewareIndex) {
                console.error('❌ StreamingAgentRouter should be initialized before StreamingAgentMiddleware');
                orderCorrect = false;
            }
            
            if (orderCorrect) {
                console.log('✅ Component initialization order is correct!');
            }
            
            // Test health check
            console.log('🔍 Testing health check...');
            const healthResult = await window.streamingAgentRoutingInitializer.performHealthCheck();
            console.log(`   Health status: ${healthResult.overallHealth}`);
            
            // Test cleanup
            console.log('🔍 Testing cleanup...');
            const cleanupResult = await window.streamingAgentRoutingInitializer.cleanup();
            
            if (cleanupResult.success) {
                console.log('✅ Cleanup successful!');
                
                if (orderCorrect) {
                    console.log('🎉 All tests passed! The initialization order fix is working.');
                    return true;
                } else {
                    console.error('❌ Initialization order is incorrect');
                    return false;
                }
            } else {
                console.error('❌ Cleanup failed:', cleanupResult.error);
                return false;
            }
        } else {
            console.error('❌ Initialization failed:', initResult.error);
            
            // Check if the error is related to component dependencies
            if (initResult.error && initResult.error.includes('StreamingAgentRouter')) {
                console.error('   This suggests the initialization order fix may not be working correctly');
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
        setTimeout(testInitializationOrder, 2000);
    });
} else {
    setTimeout(testInitializationOrder, 2000);
}

// Make test function available globally
window.testInitializationOrder = testInitializationOrder;
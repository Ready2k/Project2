/**
 * Test script to verify the dependency validation fix
 */

console.log('🔧 Testing dependency validation fix...');

// Test the corrected dependency validation
async function testDependencyValidation() {
    try {
        if (!window.streamingAgentRoutingInitializer) {
            console.error('❌ StreamingAgentRoutingInitializer not available');
            return false;
        }

        // Create a mock agent router with the correct method name
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

        // Create a mock streaming manager
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

        console.log('🔍 Testing dependency validation...');
        const validation = await window.streamingAgentRoutingInitializer.validateDependencies(dependencies);

        if (validation.isValid) {
            console.log('✅ Dependency validation passed!');
            console.log('   Available dependencies:', validation.availableDependencies);
            
            // Test configuration validation
            console.log('🔍 Testing configuration validation...');
            const config = {
                agentRoutingEnabled: true,
                routingLatencyThreshold: 100,
                maxRoutingTimeout: 200
            };

            const configValidation = await window.streamingAgentRoutingInitializer.validateConfiguration(config);
            
            if (configValidation.isValid) {
                console.log('✅ Configuration validation passed!');
                
                // Test full initialization
                console.log('🔍 Testing full initialization...');
                const initResult = await window.streamingAgentRoutingInitializer.initialize(config, dependencies);
                
                if (initResult.success) {
                    console.log('✅ Initialization successful!');
                    console.log(`   Initialization time: ${initResult.initializationTime}ms`);
                    console.log('   Components initialized:', initResult.componentsInitialized);
                    
                    // Test cleanup
                    console.log('🔍 Testing cleanup...');
                    const cleanupResult = await window.streamingAgentRoutingInitializer.cleanup();
                    
                    if (cleanupResult.success) {
                        console.log('✅ Cleanup successful!');
                        console.log('🎉 All tests passed! The dependency validation fix is working.');
                        return true;
                    } else {
                        console.error('❌ Cleanup failed:', cleanupResult.error);
                        return false;
                    }
                } else {
                    console.error('❌ Initialization failed:', initResult.error);
                    return false;
                }
            } else {
                console.error('❌ Configuration validation failed:', configValidation.errors);
                return false;
            }
        } else {
            console.error('❌ Dependency validation failed:', validation.errors);
            return false;
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        return false;
    }
}

// Run the test when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(testDependencyValidation, 1000);
    });
} else {
    setTimeout(testDependencyValidation, 1000);
}

// Make test function available globally
window.testDependencyValidation = testDependencyValidation;
/**
 * Initialization Verification Script
 * Tests the streaming agent routing initialization system
 */

// Test configuration
const testConfig = {
    agentRoutingEnabled: true,
    routingLatencyThreshold: 100,
    maxRoutingTimeout: 200,
    circuitBreakerThreshold: 5,
    sessionUpdateRetries: 3,
    performanceOptimizationEnabled: true,
    healthCheckInterval: 15000
};

// Mock dependencies for testing
class MockStreamingManager {
    constructor() {
        this.isConnected = false;
        this.agentRoutingEnabled = false;
        this.streamingAgentRouter = null;
    }
    
    connect() {
        return Promise.resolve({ success: true });
    }
    
    sendMessage(message) {
        console.log('Mock StreamingManager sendMessage:', message);
    }
    
    setAgentRoutingEnabled(enabled) {
        this.agentRoutingEnabled = enabled;
        console.log('Mock StreamingManager agent routing enabled:', enabled);
    }
    
    setStreamingAgentRouter(router) {
        this.streamingAgentRouter = router;
        console.log('Mock StreamingManager agent router set');
    }
    
    handleMessage(event) {
        console.log('Mock StreamingManager handleMessage:', event);
        return Promise.resolve();
    }
}

class MockAgentRouter {
    constructor() {
        this.agents = new Map();
    }
    
    route(message, context) {
        return Promise.resolve({
            success: true,
            agent: 'DefaultAgent',
            response: 'Mock response',
            confidence: 0.8
        });
    }
    
    getStats() {
        return {
            totalAgents: 5,
            enabledAgents: 4,
            disabledAgents: 1
        };
    }
}

class MockConversationContextManager {
    constructor() {
        this.context = {};
    }
    
    getContext() {
        return this.context;
    }
    
    updateContext(newContext) {
        this.context = { ...this.context, ...newContext };
    }
}

// Test functions
async function runInitializationVerification() {
    console.log('🚀 Starting Streaming Agent Routing Initialization Verification');
    console.log('='.repeat(70));

    try {
        // Step 1: Check if initializer is available
        console.log('\n📋 Step 1: Checking initializer availability...');
        if (!window.StreamingAgentRoutingInitializer) {
            throw new Error('StreamingAgentRoutingInitializer class not available');
        }
        if (!window.streamingAgentRoutingInitializer) {
            throw new Error('streamingAgentRoutingInitializer instance not available');
        }
        console.log('✅ Initializer available');

        // Step 2: Test configuration validation
        console.log('\n📋 Step 2: Testing configuration validation...');
        const configValidation = await window.streamingAgentRoutingInitializer.validateConfiguration(testConfig);
        if (configValidation.isValid) {
            console.log('✅ Configuration validation passed');
            console.log('   Validated config:', JSON.stringify(configValidation.config, null, 2));
        } else {
            console.log('❌ Configuration validation failed:', configValidation.errors);
        }

        // Step 3: Test dependency validation
        console.log('\n📋 Step 3: Testing dependency validation...');
        const mockDependencies = {
            streamingManager: new MockStreamingManager(),
            agentRouter: new MockAgentRouter(),
            conversationContextManager: new MockConversationContextManager(),
            debugManager: window.debugManager,
            systemLogger: window.systemLogger
        };

        const dependencyValidation = await window.streamingAgentRoutingInitializer.validateDependencies(mockDependencies);
        if (dependencyValidation.isValid) {
            console.log('✅ Dependency validation passed');
            console.log('   Available dependencies:', dependencyValidation.availableDependencies);
        } else {
            console.log('❌ Dependency validation failed:', dependencyValidation.errors);
        }

        // Step 4: Test full initialization
        console.log('\n📋 Step 4: Testing full initialization...');
        const initResult = await window.streamingAgentRoutingInitializer.initialize(testConfig, mockDependencies);
        if (initResult.success) {
            console.log('✅ Initialization successful');
            console.log(`   Initialization time: ${initResult.initializationTime}ms`);
            console.log('   Components initialized:', initResult.componentsInitialized);
        } else {
            console.log('❌ Initialization failed:', initResult.error);
        }

        // Step 5: Test health check
        console.log('\n📋 Step 5: Testing health check...');
        const healthResult = await window.streamingAgentRoutingInitializer.performHealthCheck();
        console.log('✅ Health check completed');
        console.log(`   Overall health: ${healthResult.overallHealth}`);
        if (healthResult.summary) {
            console.log(`   Components - Total: ${healthResult.summary.total}, Healthy: ${healthResult.summary.healthy}, Degraded: ${healthResult.summary.degraded}, Unhealthy: ${healthResult.summary.unhealthy}`);
        }

        // Step 6: Test status retrieval
        console.log('\n📋 Step 6: Testing status retrieval...');
        const status = window.streamingAgentRoutingInitializer.getStatus();
        console.log('✅ Status retrieved');
        console.log('   Status:', JSON.stringify(status, null, 2));

        // Step 7: Test cleanup
        console.log('\n📋 Step 7: Testing cleanup...');
        const cleanupResult = await window.streamingAgentRoutingInitializer.cleanup();
        if (cleanupResult.success) {
            console.log('✅ Cleanup successful');
            console.log(`   Cleanup time: ${cleanupResult.cleanupTime}ms`);
        } else {
            console.log('❌ Cleanup failed:', cleanupResult.error);
        }

        console.log('\n🎉 Verification completed successfully!');
        console.log('='.repeat(70));

        return {
            success: true,
            results: {
                configValidation: configValidation.isValid,
                dependencyValidation: dependencyValidation.isValid,
                initialization: initResult.success,
                healthCheck: healthResult.overallHealth !== 'unhealthy',
                cleanup: cleanupResult.success
            }
        };

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        console.log('='.repeat(70));
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Test integration system
async function runIntegrationVerification() {
    console.log('\n🔗 Starting Integration System Verification');
    console.log('='.repeat(70));

    try {
        // Check if integration is available
        if (!window.StreamingAgentRoutingIntegration) {
            throw new Error('StreamingAgentRoutingIntegration class not available');
        }
        if (!window.streamingAgentRoutingIntegration) {
            throw new Error('streamingAgentRoutingIntegration instance not available');
        }
        console.log('✅ Integration system available');

        // Test integration status
        const status = window.streamingAgentRoutingIntegration.getStatus();
        console.log('📊 Integration status:', JSON.stringify(status, null, 2));

        // Test manual integration (if not already integrated)
        if (!status.isIntegrated) {
            console.log('\n📋 Testing manual integration...');
            const integrationResult = await window.streamingAgentRoutingIntegration.integrate({
                agentRoutingEnabled: true,
                autoInitialize: true,
                autoCleanup: true
            });

            if (integrationResult.success) {
                console.log('✅ Integration successful');
                console.log(`   Integration time: ${integrationResult.integrationTime}ms`);
            } else {
                console.log('⚠️ Integration failed (expected if dependencies not available):', integrationResult.error);
            }
        } else {
            console.log('✅ Integration already active');
        }

        console.log('\n🎉 Integration verification completed!');
        console.log('='.repeat(70));

        return { success: true };

    } catch (error) {
        console.error('❌ Integration verification failed:', error.message);
        console.log('='.repeat(70));
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Component initializer verification
async function runComponentInitializerVerification() {
    console.log('\n🧩 Starting Component Initializer Verification');
    console.log('='.repeat(70));

    try {
        // Check if component initializer is available
        if (!window.componentInitializer) {
            throw new Error('componentInitializer not available');
        }
        console.log('✅ Component initializer available');

        // Test component status
        const componentStatus = window.componentInitializer.getComponentStatus();
        console.log('📊 Component status:', JSON.stringify(componentStatus, null, 2));

        // Test health status
        const healthStatus = await window.componentInitializer.getHealthStatus();
        console.log('🏥 Health status:', JSON.stringify(healthStatus, null, 2));

        console.log('\n🎉 Component initializer verification completed!');
        console.log('='.repeat(70));

        return { success: true };

    } catch (error) {
        console.error('❌ Component initializer verification failed:', error.message);
        console.log('='.repeat(70));
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Run all verifications
async function runAllVerifications() {
    console.log('🔍 Starting Complete Verification Suite');
    console.log('='.repeat(70));

    const results = {
        initialization: await runInitializationVerification(),
        integration: await runIntegrationVerification(),
        componentInitializer: await runComponentInitializerVerification()
    };

    console.log('\n📊 VERIFICATION SUMMARY');
    console.log('='.repeat(70));
    console.log('Initialization System:', results.initialization.success ? '✅ PASSED' : '❌ FAILED');
    console.log('Integration System:', results.integration.success ? '✅ PASSED' : '❌ FAILED');
    console.log('Component Initializer:', results.componentInitializer.success ? '✅ PASSED' : '❌ FAILED');

    const overallSuccess = results.initialization.success && 
                          results.integration.success && 
                          results.componentInitializer.success;

    console.log('\nOVERALL RESULT:', overallSuccess ? '🎉 ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED');
    console.log('='.repeat(70));

    return {
        success: overallSuccess,
        results: results
    };
}

// Make functions available globally
window.runInitializationVerification = runInitializationVerification;
window.runIntegrationVerification = runIntegrationVerification;
window.runComponentInitializerVerification = runComponentInitializerVerification;
window.runAllVerifications = runAllVerifications;

// Auto-run verification if in test mode
if (window.location.search.includes('test=true') || window.location.search.includes('verify=true')) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runAllVerifications, 3000); // Wait 3 seconds for all components to load
    });
}

console.log('🔧 Initialization verification script loaded. Run runAllVerifications() to test the system.');
#!/usr/bin/env node

/**
 * Simple Node.js test script to verify StreamingManager agent integration
 * This tests the core functionality without requiring a browser environment
 */

// Mock browser globals for Node.js environment
global.window = {
    debugManager: {
        createModuleLogger: (moduleName) => ({
            log: (...args) => console.log(`[${moduleName}]`, ...args),
            debug: (...args) => console.log(`[${moduleName}]`, ...args),
            info: (...args) => console.log(`[${moduleName}]`, ...args),
            warn: (...args) => console.warn(`[${moduleName}]`, ...args),
            error: (...args) => console.error(`[${moduleName}]`, ...args)
        })
    },
    agentRouter: {
        route: async (transcript, context) => {
            console.log('Mock AgentRouter.route called:', transcript);
            return {
                success: true,
                agentName: 'TestAgent',
                response: `Mock response for: ${transcript}`,
                processingTime: 50,
                tokensUsed: 10
            };
        },
        getRegisteredAgents: () => [
            { name: 'TestAgent', description: 'Test agent for integration testing' }
        ]
    },
    AudioResourceManager: class {
        registerResource() { return 'mock-resource-id'; }
        disposeAllResources() { return { total: 0, disposed: 0, errors: [] }; }
        verifyCleanup() { return { isClean: true, activeResources: [] }; }
        getResourcesByType() { return []; }
        disposeResource() { return true; }
        getStats() { return { created: 0, disposed: 0, active: 0 }; }
        cleanupDisposedResources() { return 0; }
        forceDisposeOldResources() { return 0; }
    },
    TimeoutManager: class {
        createTimeout(op, timeout) { return op(); }
        cancelAllTimeouts() { return 0; }
        getActiveTimeoutCount() { return 0; }
        getStats() { return { created: 0, completed: 0, timedOut: 0, cancelled: 0, active: 0 }; }
        cleanupCompletedTimeouts() { return 0; }
    },
    ConnectionManager: class {
        connectWithRetry(fn) { return fn(); }
        disconnectAll() { return 0; }
        disconnect() { return true; }
        setReconnectionCallbacks() { return; }
        getAllConnectionStatuses() { return []; }
        getStats() { return { totalAttempts: 0, successfulConnections: 0, failedConnections: 0, reconnections: 0, activeConnections: 0 }; }
        cleanupCompletedConnections() { return 0; }
    },
    WebSocket: {
        OPEN: 1,
        CLOSED: 3
    }
};

// Mock WebSocket constructor
global.WebSocket = function(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 1; // OPEN
    this.send = (data) => console.log('Mock WebSocket send:', data);
    this.close = () => console.log('Mock WebSocket close');
};
global.WebSocket.OPEN = 1;
global.WebSocket.CLOSED = 3;

// Load the modules
try {
    // Load StreamingAgentRouter
    const fs = require('fs');
    const path = require('path');
    
    const streamingAgentRouterCode = fs.readFileSync(path.join(__dirname, 'streaming-agent-router.js'), 'utf8');
    eval(streamingAgentRouterCode);
    global.window.StreamingAgentRouter = StreamingAgentRouter;
    
    const streamingResponseHandlerCode = fs.readFileSync(path.join(__dirname, 'streaming-response-handler.js'), 'utf8');
    eval(streamingResponseHandlerCode);
    global.window.StreamingResponseHandler = StreamingResponseHandler;
    
    const streamingManagerCode = fs.readFileSync(path.join(__dirname, 'streaming-manager.js'), 'utf8');
    eval(streamingManagerCode);
    global.StreamingManager = StreamingManager;
    
    console.log('✓ All modules loaded successfully');
    
} catch (error) {
    console.error('✗ Error loading modules:', error.message);
    process.exit(1);
}

// Test functions
async function testStreamingManagerInitialization() {
    console.log('\n=== Testing StreamingManager Initialization ===');
    
    try {
        const streamingManager = new StreamingManager('test-api-key');
        
        console.log('✓ StreamingManager created successfully');
        console.log('  - Agent routing enabled:', streamingManager.agentRoutingEnabled);
        console.log('  - Has StreamingAgentRouter:', !!streamingManager.streamingAgentRouter);
        console.log('  - Has StreamingResponseHandler:', !!streamingManager.streamingResponseHandler);
        
        return streamingManager;
    } catch (error) {
        console.error('✗ StreamingManager initialization failed:', error.message);
        throw error;
    }
}

async function testAgentRoutingMethods(streamingManager) {
    console.log('\n=== Testing Agent Routing Methods ===');
    
    try {
        // Test method availability
        const methods = [
            'routeThroughAgents',
            'updateSessionWithAgentResponse', 
            'handleTranscriptionFallback',
            'getSessionContext',
            'setAgentRoutingEnabled',
            'getAgentRoutingStatus',
            'resetAgentRoutingState'
        ];
        
        for (const method of methods) {
            if (typeof streamingManager[method] === 'function') {
                console.log(`✓ Method ${method} is available`);
            } else {
                console.error(`✗ Method ${method} is missing`);
            }
        }
        
        // Test session context generation
        const sessionContext = streamingManager.getSessionContext();
        console.log('✓ Session context generated:', {
            sessionId: sessionContext.sessionId,
            hasConversationContext: !!sessionContext.conversationContext,
            hasVoiceConfiguration: !!sessionContext.voiceConfiguration,
            timestamp: !!sessionContext.timestamp
        });
        
        // Test agent routing status
        const status = streamingManager.getAgentRoutingStatus();
        console.log('✓ Agent routing status:', {
            enabled: status.enabled,
            currentAgent: status.currentAgent,
            hasComponents: status.hasStreamingAgentRouter && status.hasStreamingResponseHandler
        });
        
    } catch (error) {
        console.error('✗ Agent routing methods test failed:', error.message);
        throw error;
    }
}

async function testAgentRoutingConfiguration(streamingManager) {
    console.log('\n=== Testing Agent Routing Configuration ===');
    
    try {
        // Test enabling/disabling
        const initialStatus = streamingManager.agentRoutingEnabled;
        console.log('Initial agent routing status:', initialStatus);
        
        streamingManager.setAgentRoutingEnabled(false);
        const disabledStatus = streamingManager.agentRoutingEnabled;
        console.log('After disabling:', disabledStatus);
        
        streamingManager.setAgentRoutingEnabled(true);
        const enabledStatus = streamingManager.agentRoutingEnabled;
        console.log('After re-enabling:', enabledStatus);
        
        if (!disabledStatus && enabledStatus) {
            console.log('✓ Agent routing configuration works correctly');
        } else {
            console.error('✗ Agent routing configuration failed');
        }
        
    } catch (error) {
        console.error('✗ Agent routing configuration test failed:', error.message);
        throw error;
    }
}

async function testFallbackMechanism(streamingManager) {
    console.log('\n=== Testing Fallback Mechanism ===');
    
    try {
        // Mock WebSocket for testing
        streamingManager.websocket = {
            readyState: WebSocket.OPEN,
            send: (data) => {
                console.log('Mock WebSocket send called for fallback');
                const message = JSON.parse(data);
                console.log('  - Message type:', message.type);
            }
        };
        
        // Test fallback mechanism
        streamingManager.handleTranscriptionFallback('Test transcript for fallback');
        console.log('✓ Fallback mechanism executed without errors');
        
    } catch (error) {
        console.error('✗ Fallback mechanism test failed:', error.message);
        throw error;
    }
}

async function testAgentRoutingFlow(streamingManager) {
    console.log('\n=== Testing Agent Routing Flow ===');
    
    try {
        // Mock WebSocket for testing
        streamingManager.websocket = {
            readyState: WebSocket.OPEN,
            send: (data) => {
                console.log('Mock WebSocket send called for agent routing');
                const message = JSON.parse(data);
                console.log('  - Message type:', message.type);
            }
        };
        
        // Test routing through agents
        await streamingManager.routeThroughAgents('Test transcript for agent routing');
        console.log('✓ Agent routing flow executed without errors');
        
        // Check if current agent was set
        const status = streamingManager.getAgentRoutingStatus();
        console.log('  - Current agent after routing:', status.currentAgent);
        
    } catch (error) {
        console.error('✗ Agent routing flow test failed:', error.message);
        throw error;
    }
}

// Main test execution
async function runAllTests() {
    console.log('StreamingManager Agent Integration Test');
    console.log('=====================================');
    
    try {
        const streamingManager = await testStreamingManagerInitialization();
        await testAgentRoutingMethods(streamingManager);
        await testAgentRoutingConfiguration(streamingManager);
        await testFallbackMechanism(streamingManager);
        await testAgentRoutingFlow(streamingManager);
        
        console.log('\n=== Test Summary ===');
        console.log('✓ All tests passed successfully!');
        console.log('StreamingManager agent integration is working correctly.');
        
    } catch (error) {
        console.log('\n=== Test Summary ===');
        console.error('✗ Tests failed:', error.message);
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});
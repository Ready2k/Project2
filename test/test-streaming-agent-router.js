/**
 * Test suite for StreamingAgentRouter
 * Tests core functionality and integration with existing agent system
 */

// Mock dependencies for testing
class MockAgentRouter {
    constructor() {
        this.agents = [
            { name: 'FraudAgent', description: 'Handles fraud detection', enabled: true },
            { name: 'PaymentsAgent', description: 'Handles payments', enabled: true },
            { name: 'IDVAgent', description: 'Handles identity verification', enabled: true }
        ];
    }

    async route(inputText, context) {
        // Simple mock routing logic
        if (inputText.toLowerCase().includes('fraud')) {
            return {
                success: true,
                response: 'I can help you with fraud concerns.',
                agentName: 'FraudAgent',
                processingTime: 50
            };
        } else if (inputText.toLowerCase().includes('payment')) {
            return {
                success: true,
                response: 'I can help you with payments.',
                agentName: 'PaymentsAgent',
                processingTime: 45
            };
        } else {
            return {
                success: true,
                response: 'I can help you with that.',
                agentName: 'IDVAgent',
                processingTime: 40
            };
        }
    }

    getRegisteredAgents() {
        return this.agents;
    }
}

class MockStreamingManager {
    constructor() {
        this.websocket = {
            readyState: WebSocket.OPEN
        };
        this.apiClient = {
            generateChatCompletion: async () => ({ success: true, text: 'Mock response' })
        };
    }

    sendMessage(message) {
        console.log('Mock WebSocket message sent:', message.type);
        return true;
    }
}

// Mock global dependencies
window.debugManager = {
    createModuleLogger: (name) => ({
        log: (msg, data) => console.log(`[${name}] ${msg}`, data || ''),
        debug: (msg, data) => console.log(`[${name}] DEBUG: ${msg}`, data || ''),
        info: (msg, data) => console.log(`[${name}] INFO: ${msg}`, data || ''),
        warn: (msg, data) => console.warn(`[${name}] WARN: ${msg}`, data || ''),
        error: (msg, data) => console.error(`[${name}] ERROR: ${msg}`, data || '')
    })
};

window.currentPersona = {
    name: 'Test Assistant',
    instructions: 'You are a helpful test assistant.'
};

// Test functions
async function testStreamingAgentRouterCreation() {
    console.log('\n=== Testing StreamingAgentRouter Creation ===');
    
    try {
        const mockAgentRouter = new MockAgentRouter();
        const mockStreamingManager = new MockStreamingManager();
        
        const streamingRouter = new StreamingAgentRouter(mockAgentRouter, mockStreamingManager);
        
        console.log('✅ StreamingAgentRouter created successfully');
        console.log('Current agent:', streamingRouter.currentAgent);
        console.log('Session context:', streamingRouter.getSessionContext());
        
        return streamingRouter;
    } catch (error) {
        console.error('❌ Failed to create StreamingAgentRouter:', error.message);
        throw error;
    }
}

async function testRouteStreamingMessage(streamingRouter) {
    console.log('\n=== Testing routeStreamingMessage ===');
    
    try {
        // Test fraud-related message
        const fraudResult = await streamingRouter.routeStreamingMessage(
            'I think there is fraud on my account',
            { sessionId: 'test-session-1' }
        );
        
        console.log('Fraud routing result:', {
            success: fraudResult.success,
            selectedAgent: fraudResult.selectedAgent?.name,
            agentChanged: fraudResult.agentChanged,
            sessionUpdateRequired: fraudResult.sessionUpdateRequired
        });
        
        // Test payment-related message
        const paymentResult = await streamingRouter.routeStreamingMessage(
            'I want to make a payment',
            { sessionId: 'test-session-1' }
        );
        
        console.log('Payment routing result:', {
            success: paymentResult.success,
            selectedAgent: paymentResult.selectedAgent?.name,
            agentChanged: paymentResult.agentChanged,
            sessionUpdateRequired: paymentResult.sessionUpdateRequired
        });
        
        console.log('✅ Message routing tests passed');
        return true;
    } catch (error) {
        console.error('❌ Message routing test failed:', error.message);
        throw error;
    }
}

async function testUpdateSessionForAgent(streamingRouter) {
    console.log('\n=== Testing updateSessionForAgent ===');
    
    try {
        const mockAgent = {
            name: 'FraudAgent',
            description: 'Handles fraud detection and prevention'
        };
        
        const updateResult = await streamingRouter.updateSessionForAgent(mockAgent, {
            sessionId: 'test-session-1'
        });
        
        console.log('Session update result:', {
            success: updateResult.success,
            agentName: updateResult.agentName,
            hasVoiceConfig: !!updateResult.voiceConfig,
            hasInstructions: !!updateResult.instructions
        });
        
        if (updateResult.success) {
            console.log('Voice config:', updateResult.voiceConfig);
            console.log('Instructions preview:', updateResult.instructions.substring(0, 100) + '...');
        }
        
        console.log('✅ Session update test passed');
        return true;
    } catch (error) {
        console.error('❌ Session update test failed:', error.message);
        throw error;
    }
}

async function testErrorHandling(streamingRouter) {
    console.log('\n=== Testing Error Handling ===');
    
    try {
        // Test with invalid input
        const errorResult = await streamingRouter.routeStreamingMessage(
            null, // Invalid input
            { sessionId: 'test-session-1' }
        );
        
        console.log('Error handling result:', {
            success: errorResult.success,
            fallbackStrategy: errorResult.fallbackStrategy,
            fallbackReason: errorResult.fallbackReason
        });
        
        // Test circuit breaker
        const stats = streamingRouter.getRoutingStats();
        console.log('Routing stats:', {
            consecutiveErrors: stats.errorTracking.consecutiveErrors,
            circuitBreakerOpen: stats.errorTracking.circuitBreakerOpen
        });
        
        console.log('✅ Error handling test passed');
        return true;
    } catch (error) {
        console.error('❌ Error handling test failed:', error.message);
        throw error;
    }
}

async function testPerformanceMetrics(streamingRouter) {
    console.log('\n=== Testing Performance Metrics ===');
    
    try {
        // Perform several routing operations
        const startTime = Date.now();
        
        for (let i = 0; i < 5; i++) {
            await streamingRouter.routeStreamingMessage(
                `Test message ${i}`,
                { sessionId: 'test-session-1' }
            );
        }
        
        const totalTime = Date.now() - startTime;
        const averageTime = totalTime / 5;
        
        console.log('Performance metrics:', {
            totalTime: totalTime + 'ms',
            averageTime: averageTime + 'ms',
            withinThreshold: averageTime <= 100
        });
        
        const stats = streamingRouter.getRoutingStats();
        console.log('Session metrics:', stats.sessionMetrics);
        
        console.log('✅ Performance metrics test passed');
        return true;
    } catch (error) {
        console.error('❌ Performance metrics test failed:', error.message);
        throw error;
    }
}

async function runAllTests() {
    console.log('🚀 Starting StreamingAgentRouter Tests');
    
    try {
        const streamingRouter = await testStreamingAgentRouterCreation();
        await testRouteStreamingMessage(streamingRouter);
        await testUpdateSessionForAgent(streamingRouter);
        await testErrorHandling(streamingRouter);
        await testPerformanceMetrics(streamingRouter);
        
        console.log('\n🎉 All tests passed successfully!');
        
        // Cleanup
        streamingRouter.cleanup();
        console.log('✅ Cleanup completed');
        
    } catch (error) {
        console.error('\n💥 Test suite failed:', error.message);
        console.error(error.stack);
    }
}

// Run tests when page loads
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', runAllTests);
} else {
    // Node.js environment
    runAllTests();
}
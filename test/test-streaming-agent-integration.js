/**
 * Integration Tests for Streaming Agent Routing
 * Tests end-to-end streaming agent routing flow
 */

class StreamingAgentIntegrationTests {
    constructor() {
        this.testResults = [];
        this.mockComponents = {};
        this.testSessionId = 'integration-test-session';
        
        this.setupMockComponents();
    }

    setupMockComponents() {
        // Mock WebSocket for testing
        this.mockWebSocket = {
            readyState: WebSocket.OPEN,
            send: (data) => {
                const message = JSON.parse(data);
                console.log('WebSocket Send:', message.type, message);
                
                // Simulate WebSocket responses
                setTimeout(() => {
                    this.simulateWebSocketResponse(message);
                }, 10);
            },
            close: () => {
                this.mockWebSocket.readyState = WebSocket.CLOSED;
            }
        };

        // Mock StreamingManager
        this.mockComponents.streamingManager = {
            websocket: this.mockWebSocket,
            apiClient: window.apiClient || { makeRequest: async () => ({ success: true }) },
            isConnected: true,
            connectionId: 'test-connection-123',
            
            getSessionContext: () => ({
                sessionId: this.testSessionId,
                conversationContext: {},
                voiceConfiguration: { currentVoice: 'shimmer' }
            }),
            
            handleMessage: async (event) => {
                // Original message handler simulation
                const message = JSON.parse(event.data);
                console.log('StreamingManager handling:', message.type);
                return { handled: true, success: true };
            },
            
            updateSession: async (sessionUpdate) => {
                console.log('Session update:', sessionUpdate);
                return { success: true };
            },
            
            sendMessage: async (message) => {
                // Mock sendMessage method that StreamingAgentRouter expects
                console.log('Mock StreamingManager sendMessage:', message);
                return { success: true };
            }
        };

        // Mock AgentRouter with realistic agents
        this.mockComponents.agentRouter = {
            route: async (message, context) => {
                await new Promise(resolve => setTimeout(resolve, 30)); // Simulate processing time
                
                // Realistic routing logic
                const lowerMessage = message.toLowerCase();
                
                if (lowerMessage.includes('fraud') || lowerMessage.includes('suspicious') || lowerMessage.includes('block')) {
                    return {
                        success: true,
                        agentName: 'FraudAgent',
                        response: `I understand your concern about potential fraud. Let me help you secure your account and investigate this matter.`,
                        processingTime: 45,
                        tokensUsed: 32,
                        confidence: 0.95
                    };
                } else if (lowerMessage.includes('payment') || lowerMessage.includes('transfer') || lowerMessage.includes('send money')) {
                    return {
                        success: true,
                        agentName: 'PaymentsAgent',
                        response: `I can help you with your payment. Let me guide you through the process securely.`,
                        processingTime: 38,
                        tokensUsed: 28,
                        confidence: 0.92
                    };
                } else if (lowerMessage.includes('verify') || lowerMessage.includes('identity') || lowerMessage.includes('password')) {
                    return {
                        success: true,
                        agentName: 'IDVAgent',
                        response: `I'll help you with identity verification. Let's ensure your account is secure.`,
                        processingTime: 42,
                        tokensUsed: 30,
                        confidence: 0.88
                    };
                } else if (lowerMessage.includes('balance') || lowerMessage.includes('statement') || lowerMessage.includes('account')) {
                    return {
                        success: true,
                        agentName: 'BankingInfoAgent',
                        response: `I can provide you with your account information. Let me retrieve that for you.`,
                        processingTime: 35,
                        tokensUsed: 25,
                        confidence: 0.85
                    };
                } else if (lowerMessage.includes('timeout') || lowerMessage.includes('slow')) {
                    // Simulate timeout scenario
                    await new Promise(resolve => setTimeout(resolve, 250));
                    return {
                        success: false,
                        error: 'Routing timeout',
                        processingTime: 250
                    };
                } else {
                    return {
                        success: true,
                        agentName: 'BankingInfoAgent',
                        response: `I'm here to help with your banking needs. How can I assist you today?`,
                        processingTime: 40,
                        tokensUsed: 22,
                        confidence: 0.75
                    };
                }
            },
            
            getRegisteredAgents: () => [
                { 
                    name: 'FraudAgent', 
                    description: 'Fraud prevention specialist',
                    processMessage: async () => ({ success: true })
                },
                { 
                    name: 'PaymentsAgent', 
                    description: 'Payment processing specialist',
                    processMessage: async () => ({ success: true })
                },
                { 
                    name: 'IDVAgent', 
                    description: 'Identity verification specialist',
                    processMessage: async () => ({ success: true })
                },
                { 
                    name: 'BankingInfoAgent', 
                    description: 'Banking information specialist',
                    processMessage: async () => ({ success: true })
                }
            ]
        };

        // Mock debug manager
        window.debugManager = {
            createModuleLogger: (moduleName) => ({
                log: (...args) => console.log(`[${moduleName}]`, ...args),
                debug: (...args) => console.debug(`[${moduleName}]`, ...args),
                info: (...args) => console.info(`[${moduleName}]`, ...args),
                warn: (...args) => console.warn(`[${moduleName}]`, ...args),
                error: (...args) => console.error(`[${moduleName}]`, ...args)
            })
        };

        // Mock persona
        window.currentPersona = {
            name: 'Banking Assistant',
            instructions: 'You are a helpful banking assistant providing professional financial services.'
        };

        // Ensure WebSocket constants are available
        if (typeof WebSocket === 'undefined') {
            window.WebSocket = {
                OPEN: 1,
                CLOSED: 3
            };
        }
    }

    simulateWebSocketResponse(sentMessage) {
        // Simulate appropriate WebSocket responses based on sent message type
        switch (sentMessage.type) {
            case 'session.update':
                this.simulateSessionUpdateResponse(sentMessage);
                break;
            case 'response.create':
                this.simulateResponseCreateResponse(sentMessage);
                break;
            default:
                console.log('No simulation for message type:', sentMessage.type);
        }
    }

    simulateSessionUpdateResponse(sentMessage) {
        const response = {
            type: 'session.updated',
            session: {
                id: this.testSessionId,
                ...sentMessage.session
            },
            timestamp: Date.now()
        };
        
        // Simulate WebSocket message event
        const event = {
            data: JSON.stringify(response)
        };
        
        console.log('Simulated session.updated response');
    }

    simulateResponseCreateResponse(sentMessage) {
        const response = {
            type: 'response.created',
            response: {
                id: 'resp_' + Date.now(),
                status: 'in_progress'
            },
            timestamp: Date.now()
        };
        
        console.log('Simulated response.created response');
    }

    async runAllTests() {
        console.log('Starting Streaming Agent Integration Tests...');
        
        await this.testEndToEndRouting();
        await this.testAgentSwitchingFlow();
        await this.testContextPreservationFlow();
        await this.testErrorRecoveryFlow();
        await this.testPerformanceUnderLoad();
        await this.testWebSocketIntegration();
        await this.testVoiceTransitionFlow();
        await this.testFallbackMechanisms();
        
        this.printResults();
        return this.testResults;
    }

    async testEndToEndRouting() {
        console.log('Testing end-to-end routing flow...');
        
        try {
            // Initialize components
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockComponents.agentRouter,
                this.mockComponents.streamingManager
            );
            
            const streamingResponseHandler = new StreamingResponseHandler(
                this.mockComponents.streamingManager
            );
            
            const streamingAgentMiddleware = new StreamingAgentMiddleware(
                this.mockComponents.streamingManager,
                streamingAgentRouter
            );
            
            // Test complete flow: transcription -> routing -> response processing
            const transcript = "I think there's fraud on my account, please help me block my card";
            const sessionContext = {
                sessionId: this.testSessionId,
                conversationContext: {},
                voiceConfiguration: { currentVoice: 'shimmer' }
            };
            
            // Step 1: Route the message
            const routingResult = await streamingAgentRouter.routeStreamingMessage(transcript, sessionContext);
            
            this.assertTrue(routingResult.success, 'Routing should succeed');
            this.assertEqual(routingResult.selectedAgent?.name, 'FraudAgent', 'Should route to FraudAgent');
            this.assertNotNull(routingResult.agentResponse, 'Should have agent response');
            
            // Step 2: Process the response for streaming
            const processedResponse = await streamingResponseHandler.processAgentResponse(
                routingResult.agentResponse,
                sessionContext
            );
            
            this.assertTrue(processedResponse.success, 'Response processing should succeed');
            this.assertTrue(processedResponse.chunks.length > 0, 'Should have response chunks');
            this.assertNotNull(processedResponse.voiceConfig, 'Should have voice configuration');
            
            // Step 3: Format for WebSocket
            const webSocketMessage = streamingResponseHandler.formatForWebSocket(
                processedResponse,
                'session.update'
            );
            
            this.assertEqual(webSocketMessage.type, 'session.update', 'Should format as session update');
            this.assertNotNull(webSocketMessage.session, 'Should have session data');
            this.assertNotNull(webSocketMessage.session.instructions, 'Should have session instructions');
            
            this.addResult('end_to_end_routing', true, 'Complete end-to-end routing flow successful');
            
        } catch (error) {
            this.addResult('end_to_end_routing', false, `End-to-end routing failed: ${error.message}`);
        }
    }

    async testAgentSwitchingFlow() {
        console.log('Testing agent switching flow...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockComponents.agentRouter,
                this.mockComponents.streamingManager
            );
            
            // Start with fraud inquiry
            const fraudResult = await streamingAgentRouter.routeStreamingMessage(
                "I think there's fraud on my account",
                { sessionId: this.testSessionId }
            );
            
            this.assertEqual(fraudResult.selectedAgent?.name, 'FraudAgent', 'Should start with FraudAgent');
            
            // Switch to payments inquiry in same conversation
            const paymentResult = await streamingAgentRouter.routeStreamingMessage(
                "Actually, I also need to make a payment to someone",
                { sessionId: this.testSessionId }
            );
            
            this.assertEqual(paymentResult.selectedAgent?.name, 'PaymentsAgent', 'Should switch to PaymentsAgent');
            this.assertTrue(paymentResult.agentChanged, 'Should detect agent change');
            this.assertTrue(paymentResult.sessionUpdateRequired, 'Should require session update');
            
            // Verify agent history is maintained
            const agentHistory = streamingAgentRouter.sessionContext.agentHistory;
            this.assertTrue(agentHistory.length > 0, 'Should maintain agent history');
            
            // Verify metrics are updated
            const metrics = streamingAgentRouter.sessionContext.routingMetrics;
            this.assertTrue(metrics.agentSwitches > 0, 'Should track agent switches');
            
            this.addResult('agent_switching_flow', true, 'Agent switching flow successful');
            
        } catch (error) {
            this.addResult('agent_switching_flow', false, `Agent switching flow failed: ${error.message}`);
        }
    }

    async testContextPreservationFlow() {
        console.log('Testing context preservation flow...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockComponents.agentRouter,
                this.mockComponents.streamingManager
            );
            
            // Build up conversation context
            const initialContext = {
                sessionId: this.testSessionId,
                conversationHistory: ['Hello', 'I need help with my account'],
                userPreferences: { language: 'en', notifications: true },
                sessionData: { userId: 'user123', accountType: 'premium' }
            };
            
            // Route to first agent
            await streamingAgentRouter.routeStreamingMessage(
                "What's my account balance?",
                initialContext
            );
            
            const bankingAgent = streamingAgentRouter.currentAgent;
            this.assertEqual(bankingAgent?.name, 'BankingInfoAgent', 'Should route to BankingInfoAgent');
            
            // Switch to different agent and verify context preservation
            const paymentsAgent = this.mockComponents.agentRouter.getRegisteredAgents()
                .find(a => a.name === 'PaymentsAgent');
            
            const switchResult = await streamingAgentRouter.switchAgent(
                paymentsAgent,
                initialContext,
                'user_request'
            );
            
            this.assertTrue(switchResult.success, 'Agent switch should succeed');
            this.assertNotNull(switchResult.preservedContext, 'Should preserve context');
            
            const preserved = switchResult.preservedContext;
            this.assertEqual(preserved.preservedFrom, 'BankingInfoAgent', 'Should record source agent');
            this.assertTrue(Array.isArray(preserved.conversationHistory), 'Should preserve conversation history');
            this.assertNotNull(preserved.userPreferences, 'Should preserve user preferences');
            this.assertNotNull(preserved.sessionData, 'Should preserve session data');
            
            // Verify context is available in session instructions
            const sessionInstructions = await streamingAgentRouter.generateSessionInstructions(
                paymentsAgent,
                'I can help with payments',
                {
                    ...initialContext,
                    preservedContext: preserved,
                    switchReason: 'user_request'
                }
            );
            
            this.assertTrue(sessionInstructions.includes('Context Preserved'), 'Instructions should mention preserved context');
            this.assertTrue(sessionInstructions.includes('BankingInfoAgent'), 'Instructions should mention previous agent');
            
            this.addResult('context_preservation_flow', true, 'Context preservation flow successful');
            
        } catch (error) {
            this.addResult('context_preservation_flow', false, `Context preservation flow failed: ${error.message}`);
        }
    }

    async testErrorRecoveryFlow() {
        console.log('Testing error recovery flow...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockComponents.agentRouter,
                this.mockComponents.streamingManager
            );
            
            // Test routing timeout recovery
            const timeoutResult = await streamingAgentRouter.routeStreamingMessage(
                "This message should timeout",
                { sessionId: this.testSessionId }
            );
            
            // Should handle timeout gracefully
            this.assertFalse(timeoutResult.success, 'Timeout should result in failure');
            this.assertNotNull(timeoutResult.fallbackReason, 'Should have fallback reason');
            
            // Verify system can recover and continue working
            const recoveryResult = await streamingAgentRouter.routeStreamingMessage(
                "What's my balance?",
                { sessionId: this.testSessionId }
            );
            
            this.assertTrue(recoveryResult.success, 'Should recover after timeout');
            this.assertEqual(recoveryResult.selectedAgent?.name, 'BankingInfoAgent', 'Should route normally after recovery');
            
            this.addResult('error_recovery_flow', true, 'Error recovery flow successful');
            
        } catch (error) {
            this.addResult('error_recovery_flow', false, `Error recovery flow failed: ${error.message}`);
        }
    }

    async testPerformanceUnderLoad() {
        console.log('Testing performance under load...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockComponents.agentRouter,
                this.mockComponents.streamingManager
            );
            
            const testMessages = [
                "Check my balance",
                "I need to make a payment",
                "There's suspicious activity",
                "Help me verify my identity",
                "What's my account number?",
                "Transfer money to my friend",
                "Block my card please",
                "Reset my password"
            ];
            
            const startTime = Date.now();
            const promises = testMessages.map(async (message, index) => {
                const result = await streamingAgentRouter.routeStreamingMessage(
                    message,
                    { sessionId: `${this.testSessionId}_${index}` }
                );
                return {
                    message,
                    success: result.success,
                    latency: result.processingTime || 0,
                    agent: result.selectedAgent?.name
                };
            });
            
            const results = await Promise.all(promises);
            const totalTime = Date.now() - startTime;
            
            // Analyze results
            const successCount = results.filter(r => r.success).length;
            const averageLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
            const maxLatency = Math.max(...results.map(r => r.latency));
            
            this.assertTrue(successCount >= testMessages.length * 0.9, 'Should have >90% success rate under load');
            this.assertTrue(averageLatency < 100, `Average latency should be <100ms, was ${averageLatency}ms`);
            this.assertTrue(maxLatency < 200, `Max latency should be <200ms, was ${maxLatency}ms`);
            this.assertTrue(totalTime < 1000, `Total time should be <1s for concurrent requests, was ${totalTime}ms`);
            
            console.log(`Load test results: ${successCount}/${testMessages.length} success, avg latency: ${averageLatency.toFixed(1)}ms`);
            
            this.addResult('performance_under_load', true, `Performance under load acceptable: ${successCount}/${testMessages.length} success, ${averageLatency.toFixed(1)}ms avg latency`);
            
        } catch (error) {
            this.addResult('performance_under_load', false, `Performance under load failed: ${error.message}`);
        }
    }

    async testWebSocketIntegration() {
        console.log('Testing WebSocket integration...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockComponents.agentRouter,
                this.mockComponents.streamingManager
            );
            
            const streamingResponseHandler = new StreamingResponseHandler(
                this.mockComponents.streamingManager
            );
            
            // Test session update via WebSocket
            const routingResult = await streamingAgentRouter.routeStreamingMessage(
                "Help me with fraud protection",
                { sessionId: this.testSessionId }
            );
            
            this.assertTrue(routingResult.success, 'Routing should succeed');
            
            // Process response and format for WebSocket
            const processedResponse = await streamingResponseHandler.processAgentResponse(
                routingResult.agentResponse,
                { sessionId: this.testSessionId }
            );
            
            const sessionUpdateMessage = streamingResponseHandler.formatForWebSocket(
                processedResponse,
                'session.update'
            );
            
            // Simulate sending via WebSocket
            let webSocketSendCalled = false;
            const originalSend = this.mockWebSocket.send;
            this.mockWebSocket.send = (data) => {
                webSocketSendCalled = true;
                const message = JSON.parse(data);
                
                this.assertEqual(message.type, 'session.update', 'Should send session update');
                this.assertNotNull(message.session, 'Should have session data');
                this.assertNotNull(message.session.instructions, 'Should have instructions');
                this.assertEqual(message.session.voice, 'alloy', 'Should use FraudAgent voice');
                
                return originalSend.call(this.mockWebSocket, data);
            };
            
            // Simulate WebSocket send
            this.mockWebSocket.send(JSON.stringify(sessionUpdateMessage));
            
            this.assertTrue(webSocketSendCalled, 'WebSocket send should be called');
            
            // Restore original send
            this.mockWebSocket.send = originalSend;
            
            this.addResult('websocket_integration', true, 'WebSocket integration successful');
            
        } catch (error) {
            this.addResult('websocket_integration', false, `WebSocket integration failed: ${error.message}`);
        }
    }

    async testVoiceTransitionFlow() {
        console.log('Testing voice transition flow...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockComponents.agentRouter,
                this.mockComponents.streamingManager
            );
            
            const streamingResponseHandler = new StreamingResponseHandler(
                this.mockComponents.streamingManager
            );
            
            // Start with default voice
            const initialResult = await streamingAgentRouter.routeStreamingMessage(
                "What's my balance?",
                { 
                    sessionId: this.testSessionId,
                    voiceConfiguration: { currentVoice: 'shimmer' }
                }
            );
            
            this.assertEqual(initialResult.selectedAgent?.name, 'BankingInfoAgent', 'Should route to BankingInfoAgent');
            
            // Switch to fraud agent (different voice)
            const fraudResult = await streamingAgentRouter.routeStreamingMessage(
                "Actually, I think there's fraud on my account",
                { 
                    sessionId: this.testSessionId,
                    voiceConfiguration: { currentVoice: 'shimmer' }
                }
            );
            
            this.assertEqual(fraudResult.selectedAgent?.name, 'FraudAgent', 'Should switch to FraudAgent');
            
            // Process response and check voice configuration
            const processedResponse = await streamingResponseHandler.processAgentResponse(
                fraudResult.agentResponse,
                { 
                    sessionId: this.testSessionId,
                    voiceConfiguration: { currentVoice: 'shimmer' }
                }
            );
            
            this.assertEqual(processedResponse.voiceConfig.voice, 'alloy', 'Should use FraudAgent voice');
            this.assertTrue(processedResponse.voiceConfig.voiceChangeRequired, 'Should require voice change');
            this.assertEqual(processedResponse.voiceConfig.previousVoice, 'shimmer', 'Should track previous voice');
            
            // Test voice change message formatting
            const voiceChangeMessage = streamingResponseHandler.formatForWebSocket(
                processedResponse,
                'voice_change'
            );
            
            this.assertEqual(voiceChangeMessage.type, 'voice_change', 'Should format as voice change');
            this.assertEqual(voiceChangeMessage.voiceConfig.newVoice, 'alloy', 'Should specify new voice');
            this.assertEqual(voiceChangeMessage.voiceConfig.previousVoice, 'shimmer', 'Should specify previous voice');
            
            this.addResult('voice_transition_flow', true, 'Voice transition flow successful');
            
        } catch (error) {
            this.addResult('voice_transition_flow', false, `Voice transition flow failed: ${error.message}`);
        }
    }

    async testFallbackMechanisms() {
        console.log('Testing fallback mechanisms...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockComponents.agentRouter,
                this.mockComponents.streamingManager
            );
            
            // Test WebSocket connection failure fallback
            this.mockWebSocket.readyState = WebSocket.CLOSED;
            
            const paymentsAgent = this.mockComponents.agentRouter.getRegisteredAgents()
                .find(a => a.name === 'PaymentsAgent');
            
            const switchResult = await streamingAgentRouter.switchAgent(
                paymentsAgent,
                { sessionId: this.testSessionId },
                'fallback_test'
            );
            
            this.assertFalse(switchResult.success, 'Should fail when WebSocket is closed');
            this.assertNotNull(switchResult.error, 'Should have error message');
            
            // Restore WebSocket connection
            this.mockWebSocket.readyState = WebSocket.OPEN;
            
            // Test routing failure fallback
            const originalRoute = this.mockComponents.agentRouter.route;
            this.mockComponents.agentRouter.route = async () => {
                throw new Error('Simulated routing failure');
            };
            
            const fallbackResult = await streamingAgentRouter.routeStreamingMessage(
                "This should cause a routing failure",
                { sessionId: this.testSessionId }
            );
            
            this.assertFalse(fallbackResult.success, 'Should handle routing failure');
            this.assertNotNull(fallbackResult.fallbackReason || fallbackResult.error, 'Should have fallback reason or error');
            
            // Restore original routing
            this.mockComponents.agentRouter.route = originalRoute;
            
            // Verify system can recover
            const recoveryResult = await streamingAgentRouter.routeStreamingMessage(
                "Can you help me now?",
                { sessionId: this.testSessionId }
            );
            
            this.assertTrue(recoveryResult.success, 'Should recover after fallback');
            
            this.addResult('fallback_mechanisms', true, 'Fallback mechanisms working correctly');
            
        } catch (error) {
            this.addResult('fallback_mechanisms', false, `Fallback mechanisms failed: ${error.message}`);
        }
    }

    // Helper methods for assertions
    assertTrue(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    assertFalse(condition, message) {
        if (condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Actual: ${actual}`);
        }
    }

    assertNotNull(value, message) {
        if (value === null || value === undefined) {
            throw new Error(`Assertion failed: ${message}. Value was null or undefined`);
        }
    }

    addResult(testName, passed, message) {
        this.testResults.push({
            test: testName,
            passed: passed,
            message: message,
            timestamp: new Date().toISOString()
        });
    }

    printResults() {
        console.log('\n=== Streaming Agent Integration Test Results ===');
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${total - passed}`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        
        console.log('\nDetailed Results:');
        this.testResults.forEach(result => {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${result.test}: ${result.message}`);
        });
        
        if (total - passed > 0) {
            console.log('\n❌ Some tests failed. Check the detailed results above.');
        } else {
            console.log('\n✅ All tests passed!');
        }
    }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingAgentIntegrationTests;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.StreamingAgentIntegrationTests = StreamingAgentIntegrationTests;
}
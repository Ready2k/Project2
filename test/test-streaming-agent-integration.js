/**
 * Streaming Agent Integration Test Module
 * Tests the compatibility between streaming mode and agent routing system
 */

class StreamingAgentIntegrationTest {
    constructor() {
        this.debug = window.debugManager?.createModuleLogger('StreamingAgentTest') || console;
        this.testResults = [];
        this.mockStreamingManager = null;
        this.agentRouter = null;
    }

    /**
     * Initialize test environment with mock streaming manager
     */
    async initializeTestEnvironment() {
        try {
            // Create mock streaming manager that simulates real-time audio processing
            this.mockStreamingManager = {
                isConnected: false,
                isProcessing: false,
                audioBuffer: [],
                
                // Simulate streaming connection
                connect: async () => {
                    this.mockStreamingManager.isConnected = true;
                    this.debug.info('Mock streaming connection established');
                    return true;
                },
                
                // Simulate streaming disconnection
                disconnect: () => {
                    this.mockStreamingManager.isConnected = false;
                    this.mockStreamingManager.isProcessing = false;
                    this.debug.info('Mock streaming connection closed');
                },
                
                // Simulate processing streaming audio chunks
                processAudioChunk: async (audioChunk) => {
                    if (!this.mockStreamingManager.isConnected) {
                        throw new Error('Streaming not connected');
                    }
                    
                    this.mockStreamingManager.audioBuffer.push(audioChunk);
                    this.mockStreamingManager.isProcessing = true;
                    
                    // Simulate processing delay
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    // Return partial transcription
                    return {
                        partial: true,
                        text: audioChunk.text || '',
                        confidence: 0.8
                    };
                },
                
                // Simulate final transcription
                getFinalTranscription: async () => {
                    const fullText = this.mockStreamingManager.audioBuffer
                        .map(chunk => chunk.text || '')
                        .join(' ');
                    
                    this.mockStreamingManager.isProcessing = false;
                    this.mockStreamingManager.audioBuffer = [];
                    
                    return {
                        partial: false,
                        text: fullText,
                        confidence: 0.95
                    };
                }
            };

            // Initialize agent router
            if (typeof AgentRouter !== 'undefined') {
                const agents = [
                    new PaymentsAgent(),
                    new FraudAgent(),
                    new IDVAgent(),
                    new BankingInfoAgent()
                ];
                this.agentRouter = new AgentRouter(agents);
            }

            this.debug.info('Streaming agent integration test environment initialized');
            return true;

        } catch (error) {
            this.debug.error('Failed to initialize streaming test environment:', error);
            return false;
        }
    }

    /**
     * Test streaming mode compatibility with agent routing
     */
    async testStreamingAgentRouting() {
        const testName = 'Streaming Agent Routing Compatibility';
        this.debug.info(`Starting test: ${testName}`);

        try {
            if (!this.agentRouter) {
                throw new Error('Agent router not initialized');
            }

            // Connect to streaming
            await this.mockStreamingManager.connect();

            // Simulate streaming audio chunks for different agent types
            const streamingTests = [
                {
                    name: 'Banking Info Query',
                    chunks: [
                        { text: 'What is' },
                        { text: ' my account' },
                        { text: ' balance?' }
                    ],
                    expectedAgent: 'BankingInfoAgent'
                },
                {
                    name: 'Payment Request',
                    chunks: [
                        { text: 'Send' },
                        { text: ' fifty pounds' },
                        { text: ' to Alice' }
                    ],
                    expectedAgent: 'PaymentsAgent'
                },
                {
                    name: 'Fraud Alert',
                    chunks: [
                        { text: 'Block' },
                        { text: ' my card' },
                        { text: ' immediately' }
                    ],
                    expectedAgent: 'FraudAgent'
                },
                {
                    name: 'Identity Verification',
                    chunks: [
                        { text: 'I forgot' },
                        { text: ' my password' },
                        { text: ' please help' }
                    ],
                    expectedAgent: 'IDVAgent'
                }
            ];

            const results = [];

            for (const test of streamingTests) {
                this.debug.info(`Testing streaming scenario: ${test.name}`);

                // Process audio chunks in streaming fashion
                let partialTranscriptions = [];
                for (const chunk of test.chunks) {
                    const partial = await this.mockStreamingManager.processAudioChunk(chunk);
                    partialTranscriptions.push(partial);
                    
                    // Test that partial transcriptions don't break agent routing
                    const currentText = partialTranscriptions.map(p => p.text).join('');
                    try {
                        const agent = this.agentRouter.findBestAgent(currentText);
                        this.debug.info(`Partial text: "${currentText}" -> Agent: ${agent?.name || 'None'}`);
                    } catch (error) {
                        throw new Error(`Partial transcription broke agent routing: ${error.message}`);
                    }
                }

                // Get final transcription and test routing
                const finalTranscription = await this.mockStreamingManager.getFinalTranscription();
                const selectedAgent = this.agentRouter.findBestAgent(finalTranscription.text);

                const testResult = {
                    name: test.name,
                    input: finalTranscription.text,
                    expectedAgent: test.expectedAgent,
                    actualAgent: selectedAgent?.name || 'None',
                    success: selectedAgent?.name === test.expectedAgent,
                    confidence: finalTranscription.confidence
                };

                results.push(testResult);
                this.debug.info(`Test result: ${testResult.success ? 'PASS' : 'FAIL'} - ${test.name}`);
            }

            // Disconnect streaming
            this.mockStreamingManager.disconnect();

            const passedTests = results.filter(r => r.success).length;
            const totalTests = results.length;

            this.testResults.push({
                testName,
                passed: passedTests,
                total: totalTests,
                success: passedTests === totalTests,
                results,
                timestamp: new Date().toISOString()
            });

            this.debug.info(`${testName} completed: ${passedTests}/${totalTests} passed`);
            return results;

        } catch (error) {
            this.debug.error(`${testName} failed:`, error);
            this.testResults.push({
                testName,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Test streaming error handling with agent system
     */
    async testStreamingErrorHandling() {
        const testName = 'Streaming Error Handling';
        this.debug.info(`Starting test: ${testName}`);

        try {
            const errorScenarios = [
                {
                    name: 'Connection Loss During Processing',
                    scenario: async () => {
                        await this.mockStreamingManager.connect();
                        await this.mockStreamingManager.processAudioChunk({ text: 'What is my' });
                        this.mockStreamingManager.disconnect(); // Simulate connection loss
                        
                        // Should handle gracefully
                        try {
                            await this.mockStreamingManager.processAudioChunk({ text: ' balance?' });
                            return { success: false, error: 'Should have thrown connection error' };
                        } catch (error) {
                            return { success: true, error: error.message };
                        }
                    }
                },
                {
                    name: 'Empty Audio Chunks',
                    scenario: async () => {
                        await this.mockStreamingManager.connect();
                        
                        // Process empty chunks
                        await this.mockStreamingManager.processAudioChunk({ text: '' });
                        await this.mockStreamingManager.processAudioChunk({ text: '   ' });
                        
                        const result = await this.mockStreamingManager.getFinalTranscription();
                        
                        // Should route to fallback handler
                        const agent = this.agentRouter.findBestAgent(result.text.trim());
                        
                        this.mockStreamingManager.disconnect();
                        
                        return {
                            success: agent === null, // No agent should handle empty input
                            error: null
                        };
                    }
                },
                {
                    name: 'Malformed Audio Data',
                    scenario: async () => {
                        await this.mockStreamingManager.connect();
                        
                        // Process malformed chunks
                        await this.mockStreamingManager.processAudioChunk({ text: null });
                        await this.mockStreamingManager.processAudioChunk({ text: undefined });
                        await this.mockStreamingManager.processAudioChunk({}); // Missing text
                        
                        const result = await this.mockStreamingManager.getFinalTranscription();
                        
                        // Should handle gracefully
                        const agent = this.agentRouter.findBestAgent(result.text || '');
                        
                        this.mockStreamingManager.disconnect();
                        
                        return {
                            success: true, // Should not throw
                            error: null
                        };
                    }
                }
            ];

            const results = [];

            for (const scenario of errorScenarios) {
                this.debug.info(`Testing error scenario: ${scenario.name}`);
                
                try {
                    const result = await scenario.scenario();
                    results.push({
                        name: scenario.name,
                        success: result.success,
                        error: result.error
                    });
                    
                    this.debug.info(`Error scenario result: ${result.success ? 'PASS' : 'FAIL'} - ${scenario.name}`);
                } catch (error) {
                    results.push({
                        name: scenario.name,
                        success: false,
                        error: error.message
                    });
                    
                    this.debug.error(`Error scenario failed: ${scenario.name}`, error);
                }
            }

            const passedTests = results.filter(r => r.success).length;
            const totalTests = results.length;

            this.testResults.push({
                testName,
                passed: passedTests,
                total: totalTests,
                success: passedTests === totalTests,
                results,
                timestamp: new Date().toISOString()
            });

            this.debug.info(`${testName} completed: ${passedTests}/${totalTests} passed`);
            return results;

        } catch (error) {
            this.debug.error(`${testName} failed:`, error);
            this.testResults.push({
                testName,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Test streaming performance with agent routing
     */
    async testStreamingPerformance() {
        const testName = 'Streaming Performance with Agent Routing';
        this.debug.info(`Starting test: ${testName}`);

        try {
            await this.mockStreamingManager.connect();

            const performanceTests = [];
            const testInput = 'What is my account balance and recent transactions?';
            const chunks = testInput.split(' ').map(word => ({ text: word + ' ' }));

            // Test multiple streaming sessions
            for (let session = 0; session < 5; session++) {
                const sessionStart = Date.now();
                
                // Process chunks
                const chunkTimes = [];
                for (const chunk of chunks) {
                    const chunkStart = Date.now();
                    await this.mockStreamingManager.processAudioChunk(chunk);
                    chunkTimes.push(Date.now() - chunkStart);
                }

                // Get final result and route to agent
                const routingStart = Date.now();
                const finalTranscription = await this.mockStreamingManager.getFinalTranscription();
                const agent = this.agentRouter.findBestAgent(finalTranscription.text);
                const routingTime = Date.now() - routingStart;

                const sessionTime = Date.now() - sessionStart;

                performanceTests.push({
                    session: session + 1,
                    totalTime: sessionTime,
                    averageChunkTime: chunkTimes.reduce((a, b) => a + b, 0) / chunkTimes.length,
                    routingTime,
                    selectedAgent: agent?.name || 'None',
                    chunksProcessed: chunks.length
                });
            }

            this.mockStreamingManager.disconnect();

            // Analyze performance
            const avgTotalTime = performanceTests.reduce((sum, test) => sum + test.totalTime, 0) / performanceTests.length;
            const avgChunkTime = performanceTests.reduce((sum, test) => sum + test.averageChunkTime, 0) / performanceTests.length;
            const avgRoutingTime = performanceTests.reduce((sum, test) => sum + test.routingTime, 0) / performanceTests.length;

            const performanceSummary = {
                averageTotalTime: avgTotalTime,
                averageChunkProcessingTime: avgChunkTime,
                averageRoutingTime: avgRoutingTime,
                totalSessions: performanceTests.length,
                performanceAcceptable: avgTotalTime < 1000 && avgRoutingTime < 100 // Less than 1s total, 100ms routing
            };

            this.testResults.push({
                testName,
                success: performanceSummary.performanceAcceptable,
                performanceSummary,
                detailedResults: performanceTests,
                timestamp: new Date().toISOString()
            });

            this.debug.info(`${testName} completed - Performance acceptable: ${performanceSummary.performanceAcceptable}`);
            return performanceSummary;

        } catch (error) {
            this.debug.error(`${testName} failed:`, error);
            this.testResults.push({
                testName,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Run all streaming integration tests
     */
    async runAllTests() {
        this.debug.info('Starting comprehensive streaming agent integration tests');
        
        if (!await this.initializeTestEnvironment()) {
            throw new Error('Failed to initialize test environment');
        }

        const testResults = [];

        try {
            // Run all test suites
            testResults.push(await this.testStreamingAgentRouting());
            testResults.push(await this.testStreamingErrorHandling());
            testResults.push(await this.testStreamingPerformance());

            const summary = {
                totalTestSuites: this.testResults.length,
                passedTestSuites: this.testResults.filter(r => r.success).length,
                overallSuccess: this.testResults.every(r => r.success),
                timestamp: new Date().toISOString()
            };

            this.debug.info('Streaming integration tests completed:', summary);
            return { summary, results: this.testResults };

        } catch (error) {
            this.debug.error('Streaming integration tests failed:', error);
            throw error;
        }
    }

    /**
     * Get test results
     */
    getTestResults() {
        return this.testResults;
    }

    /**
     * Clear test results
     */
    clearResults() {
        this.testResults = [];
        this.debug.info('Test results cleared');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingAgentIntegrationTest;
} else {
    window.StreamingAgentIntegrationTest = StreamingAgentIntegrationTest;
}
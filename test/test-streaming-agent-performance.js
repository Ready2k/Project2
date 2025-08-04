/**
 * Performance Tests for Streaming Agent Routing
 * Tests routing latency, throughput, and performance optimization
 */

class StreamingAgentPerformanceTests {
    constructor() {
        this.testResults = [];
        this.performanceMetrics = {
            routingLatencies: [],
            throughputResults: [],
            memoryUsage: [],
            concurrencyResults: []
        };
        
        this.setupMockComponents();
    }

    setupMockComponents() {
        // High-performance mock AgentRouter
        this.mockAgentRouter = {
            route: async (message, context) => {
                const startTime = Date.now();
                
                // Simulate realistic processing time with some variance
                const baseLatency = 30 + Math.random() * 20; // 30-50ms
                await new Promise(resolve => setTimeout(resolve, baseLatency));
                
                const processingTime = Date.now() - startTime;
                
                // Route based on message content
                let agentName = 'BankingInfoAgent';
                let response = 'I can help with your banking inquiry.';
                
                if (message.includes('fraud')) {
                    agentName = 'FraudAgent';
                    response = 'I can help with fraud prevention.';
                } else if (message.includes('payment')) {
                    agentName = 'PaymentsAgent';
                    response = 'I can assist with payments.';
                } else if (message.includes('verify')) {
                    agentName = 'IDVAgent';
                    response = 'I can help with identity verification.';
                }
                
                return {
                    success: true,
                    agentName,
                    response,
                    processingTime,
                    tokensUsed: Math.floor(15 + Math.random() * 20)
                };
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

        // Mock StreamingManager with performance tracking
        this.mockStreamingManager = {
            websocket: {
                readyState: WebSocket.OPEN,
                send: (data) => {
                    // Track WebSocket send performance
                    const sendStart = performance.now();
                    setTimeout(() => {
                        const sendTime = performance.now() - sendStart;
                        this.performanceMetrics.webSocketSendTimes = 
                            this.performanceMetrics.webSocketSendTimes || [];
                        this.performanceMetrics.webSocketSendTimes.push(sendTime);
                    }, 1);
                }
            },
            apiClient: { makeRequest: async () => ({ success: true }) },
            getSessionContext: () => ({
                sessionId: 'perf-test-session',
                conversationContext: {},
                voiceConfiguration: { currentVoice: 'shimmer' }
            }),
            sendMessage: async (message) => {
                // Mock sendMessage method with performance tracking
                const sendStart = performance.now();
                await new Promise(resolve => setTimeout(resolve, 1)); // Simulate network delay
                const sendTime = performance.now() - sendStart;
                
                this.performanceMetrics.sendMessageTimes = 
                    this.performanceMetrics.sendMessageTimes || [];
                this.performanceMetrics.sendMessageTimes.push(sendTime);
                
                return { success: true };
            },
            updateSession: async (sessionUpdate) => {
                // Mock updateSession with performance tracking
                const updateStart = performance.now();
                await new Promise(resolve => setTimeout(resolve, 2)); // Simulate processing
                const updateTime = performance.now() - updateStart;
                
                this.performanceMetrics.sessionUpdateTimes = 
                    this.performanceMetrics.sessionUpdateTimes || [];
                this.performanceMetrics.sessionUpdateTimes.push(updateTime);
                
                return { success: true };
            }
        };

        // Mock debug manager
        window.debugManager = {
            createModuleLogger: () => ({
                log: () => {},
                debug: () => {},
                info: () => {},
                warn: () => {},
                error: () => {}
            })
        };

        window.currentPersona = {
            name: 'Performance Test Assistant',
            instructions: 'You are a test assistant for performance testing.'
        };
    }

    async runAllTests() {
        console.log('Starting Streaming Agent Performance Tests...');
        
        await this.testRoutingLatency();
        await this.testThroughputCapacity();
        await this.testConcurrentRouting();
        await this.testMemoryUsage();
        await this.testAgentSwitchingPerformance();
        await this.testResponseProcessingPerformance();
        await this.testWebSocketPerformance();
        await this.testPerformanceUnderStress();
        
        this.analyzePerformanceMetrics();
        this.printResults();
        return this.testResults;
    }

    async testRoutingLatency() {
        console.log('Testing routing latency...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockAgentRouter,
                this.mockStreamingManager
            );
            
            const testMessages = [
                'What is my account balance?',
                'I need to make a payment',
                'There is fraud on my account',
                'Help me verify my identity',
                'Show me my transaction history'
            ];
            
            const latencies = [];
            
            for (const message of testMessages) {
                const startTime = performance.now();
                
                const result = await streamingAgentRouter.routeStreamingMessage(
                    message,
                    { sessionId: 'latency-test' }
                );
                
                const latency = performance.now() - startTime;
                latencies.push(latency);
                
                this.assertTrue(result.success, `Routing should succeed for: ${message}`);
                this.assertTrue(latency < 200, `Latency should be <200ms, was ${latency.toFixed(2)}ms for: ${message}`);
            }
            
            const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
            const maxLatency = Math.max(...latencies);
            const minLatency = Math.min(...latencies);
            
            this.performanceMetrics.routingLatencies = latencies;
            
            this.assertTrue(avgLatency < 100, `Average latency should be <100ms, was ${avgLatency.toFixed(2)}ms`);
            this.assertTrue(maxLatency < 200, `Max latency should be <200ms, was ${maxLatency.toFixed(2)}ms`);
            
            console.log(`Latency results: avg=${avgLatency.toFixed(2)}ms, min=${minLatency.toFixed(2)}ms, max=${maxLatency.toFixed(2)}ms`);
            
            this.addResult('routing_latency', true, `Routing latency acceptable: avg=${avgLatency.toFixed(2)}ms, max=${maxLatency.toFixed(2)}ms`);
            
        } catch (error) {
            this.addResult('routing_latency', false, `Routing latency test failed: ${error.message}`);
        }
    }

    async testThroughputCapacity() {
        console.log('Testing throughput capacity...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockAgentRouter,
                this.mockStreamingManager
            );
            
            const messageCount = 100;
            const testDuration = 10000; // 10 seconds
            const messages = Array.from({ length: messageCount }, (_, i) => 
                `Test message ${i}: ${['balance', 'payment', 'fraud', 'verify'][i % 4]} inquiry`
            );
            
            const startTime = Date.now();
            let completedRequests = 0;
            let successfulRequests = 0;
            
            // Process messages sequentially to measure throughput
            for (const message of messages) {
                if (Date.now() - startTime > testDuration) break;
                
                try {
                    const result = await streamingAgentRouter.routeStreamingMessage(
                        message,
                        { sessionId: `throughput-test-${completedRequests}` }
                    );
                    
                    if (result.success) {
                        successfulRequests++;
                    }
                } catch (error) {
                    console.warn(`Request failed: ${error.message}`);
                }
                
                completedRequests++;
            }
            
            const actualDuration = Date.now() - startTime;
            const throughput = (completedRequests / actualDuration) * 1000; // requests per second
            const successRate = (successfulRequests / completedRequests) * 100;
            
            this.performanceMetrics.throughputResults.push({
                requestsPerSecond: throughput,
                successRate: successRate,
                totalRequests: completedRequests,
                duration: actualDuration
            });
            
            this.assertTrue(throughput >= 10, `Throughput should be >=10 req/s, was ${throughput.toFixed(2)} req/s`);
            this.assertTrue(successRate >= 95, `Success rate should be >=95%, was ${successRate.toFixed(1)}%`);
            
            console.log(`Throughput: ${throughput.toFixed(2)} req/s, Success rate: ${successRate.toFixed(1)}%`);
            
            this.addResult('throughput_capacity', true, `Throughput capacity acceptable: ${throughput.toFixed(2)} req/s with ${successRate.toFixed(1)}% success rate`);
            
        } catch (error) {
            this.addResult('throughput_capacity', false, `Throughput capacity test failed: ${error.message}`);
        }
    }

    async testConcurrentRouting() {
        console.log('Testing concurrent routing...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockAgentRouter,
                this.mockStreamingManager
            );
            
            const concurrentRequests = 20;
            const messages = Array.from({ length: concurrentRequests }, (_, i) => 
                `Concurrent request ${i}: ${['balance', 'payment', 'fraud', 'verify'][i % 4]} inquiry`
            );
            
            const startTime = performance.now();
            
            // Execute all requests concurrently
            const promises = messages.map(async (message, index) => {
                const requestStart = performance.now();
                
                try {
                    const result = await streamingAgentRouter.routeStreamingMessage(
                        message,
                        { sessionId: `concurrent-test-${index}` }
                    );
                    
                    const requestTime = performance.now() - requestStart;
                    
                    return {
                        success: result.success,
                        latency: requestTime,
                        agent: result.selectedAgent?.name,
                        index
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        latency: performance.now() - requestStart,
                        index
                    };
                }
            });
            
            const results = await Promise.all(promises);
            const totalTime = performance.now() - startTime;
            
            const successfulResults = results.filter(r => r.success);
            const successRate = (successfulResults.length / results.length) * 100;
            const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
            const maxLatency = Math.max(...results.map(r => r.latency));
            
            this.performanceMetrics.concurrencyResults.push({
                concurrentRequests,
                successRate,
                avgLatency,
                maxLatency,
                totalTime
            });
            
            this.assertTrue(successRate >= 90, `Concurrent success rate should be >=90%, was ${successRate.toFixed(1)}%`);
            this.assertTrue(avgLatency < 150, `Concurrent avg latency should be <150ms, was ${avgLatency.toFixed(2)}ms`);
            this.assertTrue(maxLatency < 300, `Concurrent max latency should be <300ms, was ${maxLatency.toFixed(2)}ms`);
            this.assertTrue(totalTime < 1000, `Total concurrent time should be <1s, was ${totalTime.toFixed(2)}ms`);
            
            console.log(`Concurrent results: ${successfulResults.length}/${concurrentRequests} success, avg=${avgLatency.toFixed(2)}ms, max=${maxLatency.toFixed(2)}ms`);
            
            this.addResult('concurrent_routing', true, `Concurrent routing acceptable: ${successRate.toFixed(1)}% success, ${avgLatency.toFixed(2)}ms avg latency`);
            
        } catch (error) {
            this.addResult('concurrent_routing', false, `Concurrent routing test failed: ${error.message}`);
        }
    }

    async testMemoryUsage() {
        console.log('Testing memory usage...');
        
        try {
            // Check if performance.memory is available
            if (!performance.memory) {
                this.addResult('memory_usage', true, 'Memory usage test skipped (performance.memory not available)');
                return;
            }
            
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockAgentRouter,
                this.mockStreamingManager
            );
            
            const initialMemory = performance.memory.usedJSHeapSize;
            
            // Perform many routing operations to test memory usage
            const operationCount = 50;
            for (let i = 0; i < operationCount; i++) {
                await streamingAgentRouter.routeStreamingMessage(
                    `Memory test message ${i}`,
                    { sessionId: `memory-test-${i}` }
                );
                
                // Perform agent switches to test context preservation memory
                if (i % 10 === 0) {
                    const agents = this.mockAgentRouter.getRegisteredAgents();
                    const randomAgent = agents[Math.floor(Math.random() * agents.length)];
                    
                    try {
                        await streamingAgentRouter.switchAgent(
                            randomAgent,
                            { sessionId: `memory-test-${i}` },
                            'memory_test'
                        );
                    } catch (error) {
                        // Ignore switch errors for memory test
                    }
                }
            }
            
            const finalMemory = performance.memory.usedJSHeapSize;
            const memoryIncrease = finalMemory - initialMemory;
            const memoryIncreasePerOperation = memoryIncrease / operationCount;
            
            this.performanceMetrics.memoryUsage.push({
                initialMemory,
                finalMemory,
                memoryIncrease,
                memoryIncreasePerOperation,
                operationCount
            });
            
            // Memory increase should be reasonable (less than 1MB per operation)
            const maxMemoryPerOperation = 1024 * 1024; // 1MB
            this.assertTrue(memoryIncreasePerOperation < maxMemoryPerOperation, 
                `Memory increase per operation should be <1MB, was ${(memoryIncreasePerOperation / 1024).toFixed(2)}KB`);
            
            console.log(`Memory usage: ${(memoryIncrease / 1024).toFixed(2)}KB total increase, ${(memoryIncreasePerOperation / 1024).toFixed(2)}KB per operation`);
            
            this.addResult('memory_usage', true, `Memory usage acceptable: ${(memoryIncreasePerOperation / 1024).toFixed(2)}KB per operation`);
            
        } catch (error) {
            this.addResult('memory_usage', false, `Memory usage test failed: ${error.message}`);
        }
    }

    async testAgentSwitchingPerformance() {
        console.log('Testing agent switching performance...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockAgentRouter,
                this.mockStreamingManager
            );
            
            // Initialize with first agent
            await streamingAgentRouter.routeStreamingMessage(
                'Initial message',
                { sessionId: 'switch-perf-test' }
            );
            
            const agents = this.mockAgentRouter.getRegisteredAgents();
            const switchLatencies = [];
            
            // Perform multiple agent switches and measure latency
            for (let i = 0; i < 10; i++) {
                const targetAgent = agents[i % agents.length];
                const startTime = performance.now();
                
                try {
                    const switchResult = await streamingAgentRouter.switchAgent(
                        targetAgent,
                        { sessionId: 'switch-perf-test' },
                        `performance_test_${i}`
                    );
                    
                    const switchLatency = performance.now() - startTime;
                    switchLatencies.push(switchLatency);
                    
                    if (switchResult.success) {
                        this.assertTrue(switchLatency < 100, `Switch latency should be <100ms, was ${switchLatency.toFixed(2)}ms`);
                    }
                } catch (error) {
                    console.warn(`Agent switch ${i} failed: ${error.message}`);
                }
            }
            
            if (switchLatencies.length > 0) {
                const avgSwitchLatency = switchLatencies.reduce((sum, lat) => sum + lat, 0) / switchLatencies.length;
                const maxSwitchLatency = Math.max(...switchLatencies);
                
                this.assertTrue(avgSwitchLatency < 75, `Average switch latency should be <75ms, was ${avgSwitchLatency.toFixed(2)}ms`);
                this.assertTrue(maxSwitchLatency < 150, `Max switch latency should be <150ms, was ${maxSwitchLatency.toFixed(2)}ms`);
                
                console.log(`Agent switching: avg=${avgSwitchLatency.toFixed(2)}ms, max=${maxSwitchLatency.toFixed(2)}ms`);
                
                this.addResult('agent_switching_performance', true, `Agent switching performance acceptable: avg=${avgSwitchLatency.toFixed(2)}ms`);
            } else {
                this.addResult('agent_switching_performance', false, 'No successful agent switches recorded');
            }
            
        } catch (error) {
            this.addResult('agent_switching_performance', false, `Agent switching performance test failed: ${error.message}`);
        }
    }

    async testResponseProcessingPerformance() {
        console.log('Testing response processing performance...');
        
        try {
            const streamingResponseHandler = new StreamingResponseHandler(
                this.mockStreamingManager
            );
            
            const testResponses = [
                {
                    agentName: 'FraudAgent',
                    response: 'I understand your concern about potential fraud. Let me help you secure your account and investigate this matter thoroughly. We take fraud very seriously and have multiple layers of protection in place.',
                    metadata: { chunkingStrategy: 'sentence_based' }
                },
                {
                    agentName: 'PaymentsAgent',
                    response: 'I can help you with your payment. To ensure security, I\'ll need to verify some details first. Then we can proceed with the transfer to your specified recipient.',
                    metadata: { chunkingStrategy: 'word_based' }
                },
                {
                    agentName: 'BankingInfoAgent',
                    response: 'Your current account balance is $2,450.75. Recent transactions include a deposit of $500 on Monday and a withdrawal of $100 yesterday.',
                    metadata: { chunkingStrategy: 'character_based' }
                }
            ];
            
            const processingLatencies = [];
            
            for (const testResponse of testResponses) {
                const startTime = performance.now();
                
                const processedResponse = await streamingResponseHandler.processAgentResponse(
                    testResponse,
                    { sessionId: 'response-perf-test' }
                );
                
                const processingLatency = performance.now() - startTime;
                processingLatencies.push(processingLatency);
                
                this.assertTrue(processedResponse.success, `Response processing should succeed for ${testResponse.agentName}`);
                this.assertTrue(processingLatency < 75, `Processing latency should be <75ms, was ${processingLatency.toFixed(2)}ms`);
                this.assertTrue(processedResponse.chunks.length > 0, `Should have response chunks for ${testResponse.agentName}`);
            }
            
            const avgProcessingLatency = processingLatencies.reduce((sum, lat) => sum + lat, 0) / processingLatencies.length;
            const maxProcessingLatency = Math.max(...processingLatencies);
            
            this.assertTrue(avgProcessingLatency < 50, `Average processing latency should be <50ms, was ${avgProcessingLatency.toFixed(2)}ms`);
            this.assertTrue(maxProcessingLatency < 75, `Max processing latency should be <75ms, was ${maxProcessingLatency.toFixed(2)}ms`);
            
            console.log(`Response processing: avg=${avgProcessingLatency.toFixed(2)}ms, max=${maxProcessingLatency.toFixed(2)}ms`);
            
            this.addResult('response_processing_performance', true, `Response processing performance acceptable: avg=${avgProcessingLatency.toFixed(2)}ms`);
            
        } catch (error) {
            this.addResult('response_processing_performance', false, `Response processing performance test failed: ${error.message}`);
        }
    }

    async testWebSocketPerformance() {
        console.log('Testing WebSocket performance...');
        
        try {
            const streamingResponseHandler = new StreamingResponseHandler(
                this.mockStreamingManager
            );
            
            const testMessage = {
                agentName: 'TestAgent',
                response: 'This is a test response for WebSocket performance testing.',
                chunks: [
                    { text: 'This is a test', index: 0, isLast: false },
                    { text: 'response for WebSocket', index: 1, isLast: false },
                    { text: 'performance testing.', index: 2, isLast: true }
                ],
                voiceConfig: { voice: 'shimmer', speed: 1.0 },
                streamingMetadata: { processingTime: 25 }
            };
            
            const messageTypes = ['session.update', 'agent_response', 'voice_change', 'response_chunk'];
            const formattingLatencies = [];
            
            for (const messageType of messageTypes) {
                const startTime = performance.now();
                
                const formattedMessage = streamingResponseHandler.formatForWebSocket(
                    testMessage,
                    messageType
                );
                
                const formattingLatency = performance.now() - startTime;
                formattingLatencies.push(formattingLatency);
                
                this.assertNotNull(formattedMessage, `Should format message for ${messageType}`);
                this.assertEqual(formattedMessage.type, messageType, `Should have correct type for ${messageType}`);
                this.assertTrue(formattingLatency < 25, `Formatting latency should be <25ms, was ${formattingLatency.toFixed(2)}ms for ${messageType}`);
            }
            
            const avgFormattingLatency = formattingLatencies.reduce((sum, lat) => sum + lat, 0) / formattingLatencies.length;
            const maxFormattingLatency = Math.max(...formattingLatencies);
            
            this.assertTrue(avgFormattingLatency < 15, `Average formatting latency should be <15ms, was ${avgFormattingLatency.toFixed(2)}ms`);
            this.assertTrue(maxFormattingLatency < 25, `Max formatting latency should be <25ms, was ${maxFormattingLatency.toFixed(2)}ms`);
            
            console.log(`WebSocket formatting: avg=${avgFormattingLatency.toFixed(2)}ms, max=${maxFormattingLatency.toFixed(2)}ms`);
            
            this.addResult('websocket_performance', true, `WebSocket performance acceptable: avg=${avgFormattingLatency.toFixed(2)}ms formatting latency`);
            
        } catch (error) {
            this.addResult('websocket_performance', false, `WebSocket performance test failed: ${error.message}`);
        }
    }

    async testPerformanceUnderStress() {
        console.log('Testing performance under stress...');
        
        try {
            const streamingAgentRouter = new StreamingAgentRouter(
                this.mockAgentRouter,
                this.mockStreamingManager
            );
            
            // Stress test parameters
            const stressTestDuration = 5000; // 5 seconds
            const maxConcurrentRequests = 50;
            const requestInterval = 50; // 50ms between request batches
            
            let totalRequests = 0;
            let successfulRequests = 0;
            let failedRequests = 0;
            const latencies = [];
            
            const startTime = Date.now();
            const activeRequests = new Set();
            
            const stressTestInterval = setInterval(async () => {
                if (Date.now() - startTime > stressTestDuration) {
                    clearInterval(stressTestInterval);
                    return;
                }
                
                // Launch batch of concurrent requests
                const batchSize = Math.min(5, maxConcurrentRequests - activeRequests.size);
                
                for (let i = 0; i < batchSize; i++) {
                    const requestId = `stress-${totalRequests++}`;
                    const requestStart = performance.now();
                    
                    const requestPromise = streamingAgentRouter.routeStreamingMessage(
                        `Stress test message ${totalRequests}`,
                        { sessionId: requestId }
                    ).then(result => {
                        const requestLatency = performance.now() - requestStart;
                        latencies.push(requestLatency);
                        
                        if (result.success) {
                            successfulRequests++;
                        } else {
                            failedRequests++;
                        }
                        
                        activeRequests.delete(requestId);
                    }).catch(error => {
                        failedRequests++;
                        activeRequests.delete(requestId);
                    });
                    
                    activeRequests.add(requestId);
                }
            }, requestInterval);
            
            // Wait for stress test to complete
            await new Promise(resolve => {
                const checkCompletion = () => {
                    if (Date.now() - startTime > stressTestDuration + 1000 && activeRequests.size === 0) {
                        resolve();
                    } else {
                        setTimeout(checkCompletion, 100);
                    }
                };
                checkCompletion();
            });
            
            const actualDuration = Date.now() - startTime;
            const successRate = (successfulRequests / totalRequests) * 100;
            const avgLatency = latencies.length > 0 ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length : 0;
            const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
            const throughput = (totalRequests / actualDuration) * 1000;
            
            // Stress test acceptance criteria
            this.assertTrue(successRate >= 80, `Stress test success rate should be >=80%, was ${successRate.toFixed(1)}%`);
            this.assertTrue(avgLatency < 200, `Stress test avg latency should be <200ms, was ${avgLatency.toFixed(2)}ms`);
            this.assertTrue(maxLatency < 500, `Stress test max latency should be <500ms, was ${maxLatency.toFixed(2)}ms`);
            this.assertTrue(throughput >= 5, `Stress test throughput should be >=5 req/s, was ${throughput.toFixed(2)} req/s`);
            
            console.log(`Stress test results: ${successfulRequests}/${totalRequests} success (${successRate.toFixed(1)}%), avg=${avgLatency.toFixed(2)}ms, throughput=${throughput.toFixed(2)} req/s`);
            
            this.addResult('performance_under_stress', true, `Performance under stress acceptable: ${successRate.toFixed(1)}% success, ${avgLatency.toFixed(2)}ms avg latency, ${throughput.toFixed(2)} req/s`);
            
        } catch (error) {
            this.addResult('performance_under_stress', false, `Performance under stress test failed: ${error.message}`);
        }
    }

    analyzePerformanceMetrics() {
        console.log('\n=== Performance Metrics Analysis ===');
        
        // Routing latency analysis
        if (this.performanceMetrics.routingLatencies.length > 0) {
            const latencies = this.performanceMetrics.routingLatencies;
            const avg = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
            const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
            
            console.log(`Routing Latency: avg=${avg.toFixed(2)}ms, p95=${p95.toFixed(2)}ms`);
        }
        
        // Throughput analysis
        if (this.performanceMetrics.throughputResults.length > 0) {
            const throughput = this.performanceMetrics.throughputResults[0];
            console.log(`Throughput: ${throughput.requestsPerSecond.toFixed(2)} req/s with ${throughput.successRate.toFixed(1)}% success rate`);
        }
        
        // Concurrency analysis
        if (this.performanceMetrics.concurrencyResults.length > 0) {
            const concurrency = this.performanceMetrics.concurrencyResults[0];
            console.log(`Concurrency: ${concurrency.successRate.toFixed(1)}% success rate, ${concurrency.avgLatency.toFixed(2)}ms avg latency`);
        }
        
        // Memory usage analysis
        if (this.performanceMetrics.memoryUsage.length > 0) {
            const memory = this.performanceMetrics.memoryUsage[0];
            console.log(`Memory Usage: ${(memory.memoryIncreasePerOperation / 1024).toFixed(2)}KB per operation`);
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
        console.log('\n=== Streaming Agent Performance Test Results ===');
        
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
    module.exports = StreamingAgentPerformanceTests;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.StreamingAgentPerformanceTests = StreamingAgentPerformanceTests;
}
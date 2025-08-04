/**
 * Simple test script for StreamingPerformanceOptimizer
 * Can be run in Node.js or browser console
 */

// Mock dependencies for testing
function createMockDependencies() {
    // Mock debug manager
    if (typeof window !== 'undefined') {
        window.debugManager = {
            createModuleLogger: (name) => ({
                log: (msg, data) => console.log(`[${name}] ${msg}`, data || ''),
                debug: (msg, data) => console.debug(`[${name}] ${msg}`, data || ''),
                info: (msg, data) => console.info(`[${name}] ${msg}`, data || ''),
                warn: (msg, data) => console.warn(`[${name}] ${msg}`, data || ''),
                error: (msg, data) => console.error(`[${name}] ${msg}`, data || '')
            })
        };
    }

    // Mock AgentRouter
    const mockAgentRouter = {
        route: async (transcript, context) => {
            // Simulate routing delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            
            return {
                success: true,
                agentName: predictAgent(transcript),
                response: `Mock response for: ${transcript.substring(0, 30)}...`,
                processingTime: Math.random() * 50,
                tokensUsed: Math.floor(Math.random() * 100)
            };
        },
        getRegisteredAgents: () => [
            { name: 'FraudAgent', description: 'Fraud prevention specialist' },
            { name: 'PaymentsAgent', description: 'Payments specialist' },
            { name: 'IDVAgent', description: 'Identity verification specialist' },
            { name: 'BankingInfoAgent', description: 'Banking information specialist' }
        ]
    };

    // Mock StreamingManager
    const mockStreamingManager = {
        websocket: { readyState: 1 }, // WebSocket.OPEN
        apiClient: {},
        debug: console
    };

    // Mock StreamingAgentRouter
    const mockStreamingAgentRouter = {
        routeStreamingMessage: async (transcript, context) => {
            return await mockAgentRouter.route(transcript, context);
        },
        agentRouter: mockAgentRouter,
        generateSessionInstructions: async (agent, response, context) => {
            return `Instructions for ${agent.name}: ${response}`;
        },
        getAgentVoiceConfig: (agent) => ({
            voice: 'alloy',
            speed: 1.0,
            pitch: 1.0,
            temperature: 0.8
        })
    };

    return {
        mockAgentRouter,
        mockStreamingManager,
        mockStreamingAgentRouter
    };
}

function predictAgent(transcript) {
    const lower = transcript.toLowerCase();
    if (lower.includes('fraud') || lower.includes('suspicious')) return 'FraudAgent';
    if (lower.includes('transfer') || lower.includes('payment')) return 'PaymentsAgent';
    if (lower.includes('verify') || lower.includes('identity')) return 'IDVAgent';
    return 'BankingInfoAgent';
}

async function testPerformanceOptimizer() {
    console.log('🚀 Starting StreamingPerformanceOptimizer test...');
    
    try {
        // Create mock dependencies
        const { mockStreamingAgentRouter, mockStreamingManager } = createMockDependencies();
        
        // Load the StreamingPerformanceOptimizer class
        let StreamingPerformanceOptimizer;
        
        if (typeof window !== 'undefined' && window.StreamingPerformanceOptimizer) {
            StreamingPerformanceOptimizer = window.StreamingPerformanceOptimizer;
        } else if (typeof require !== 'undefined') {
            // Node.js environment - would need to load the file
            console.log('Node.js environment detected - would need to load the file');
            return;
        } else {
            console.error('StreamingPerformanceOptimizer not available');
            return;
        }

        // Initialize the optimizer
        console.log('📊 Initializing performance optimizer...');
        const optimizer = new StreamingPerformanceOptimizer(
            mockStreamingAgentRouter,
            mockStreamingManager
        );

        console.log('✅ Performance optimizer initialized successfully');

        // Test 1: Basic routing optimization
        console.log('\n🧪 Test 1: Basic routing optimization');
        const testTranscript = 'I think there is fraud on my account';
        const result1 = await optimizer.optimizeRoutingMessage(testTranscript, {
            sessionId: 'test-session-1',
            currentAgent: null
        });

        console.log('Result 1:', {
            success: result1.success,
            cacheHit: result1.cacheHit,
            latency: result1.latency,
            optimized: result1.optimized
        });

        // Test 2: Cache hit test (same transcript)
        console.log('\n🧪 Test 2: Cache hit test');
        const result2 = await optimizer.optimizeRoutingMessage(testTranscript, {
            sessionId: 'test-session-1',
            currentAgent: null
        });

        console.log('Result 2:', {
            success: result2.success,
            cacheHit: result2.cacheHit,
            latency: result2.latency,
            optimized: result2.optimized
        });

        // Test 3: Different transcript (cache miss)
        console.log('\n🧪 Test 3: Different transcript (cache miss)');
        const result3 = await optimizer.optimizeRoutingMessage('I want to transfer money', {
            sessionId: 'test-session-1',
            currentAgent: null
        });

        console.log('Result 3:', {
            success: result3.success,
            cacheHit: result3.cacheHit,
            latency: result3.latency,
            optimized: result3.optimized
        });

        // Test 4: Performance metrics
        console.log('\n📈 Test 4: Performance metrics');
        const metrics = optimizer.getPerformanceMetrics();
        console.log('Performance Metrics:', {
            totalRequests: metrics.totalOptimizedRequests,
            cacheHits: metrics.cacheHits,
            cacheMisses: metrics.cacheMisses,
            cacheHitRate: metrics.cache.hitRate,
            averageLatency: metrics.latency.average,
            parallelOperations: metrics.parallelOperations,
            preloadedContextsUsed: metrics.preloadedContextsUsed,
            fallbacksTriggered: metrics.fallbacksTriggered,
            memoryCleanups: metrics.memoryCleanups
        });

        // Test 5: Memory optimization
        console.log('\n🧹 Test 5: Memory optimization');
        optimizer.optimizeMemoryUsage();
        const metricsAfterCleanup = optimizer.getPerformanceMetrics();
        console.log('Metrics after cleanup:', {
            cacheSize: metricsAfterCleanup.cache.size,
            memoryCleanups: metricsAfterCleanup.memory.cleanups
        });

        // Test 6: Parallel processing simulation
        console.log('\n⚡ Test 6: Parallel processing simulation');
        const parallelTranscripts = [
            'Check for fraud on my account',
            'Transfer $100 to John',
            'Verify my identity',
            'Show my balance'
        ];

        const startTime = Date.now();
        const parallelResults = await Promise.all(
            parallelTranscripts.map(transcript => 
                optimizer.optimizeRoutingMessage(transcript, {
                    sessionId: 'parallel-test-session',
                    currentAgent: null
                })
            )
        );
        const totalTime = Date.now() - startTime;

        console.log('Parallel processing results:', {
            totalRequests: parallelResults.length,
            totalTime: totalTime + 'ms',
            averageTime: (totalTime / parallelResults.length).toFixed(1) + 'ms',
            successfulRequests: parallelResults.filter(r => r.success).length
        });

        // Final metrics
        console.log('\n📊 Final Performance Metrics:');
        const finalMetrics = optimizer.getPerformanceMetrics();
        console.table({
            'Total Requests': finalMetrics.totalOptimizedRequests,
            'Cache Hits': finalMetrics.cacheHits,
            'Cache Misses': finalMetrics.cacheMisses,
            'Cache Hit Rate': finalMetrics.cache.hitRate.toFixed(1) + '%',
            'Average Latency': finalMetrics.latency.average + 'ms',
            'Cache Size': finalMetrics.cache.size,
            'Preloaded Contexts': finalMetrics.preloading.preloadedContexts,
            'Fallbacks Triggered': finalMetrics.fallbacksTriggered,
            'Memory Cleanups': finalMetrics.memory.cleanups
        });

        console.log('🎉 All tests completed successfully!');
        
        // Cleanup
        optimizer.dispose();
        console.log('🧹 Optimizer disposed');

        return {
            success: true,
            finalMetrics
        };

    } catch (error) {
        console.error('❌ Test failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
    window.testPerformanceOptimizer = testPerformanceOptimizer;
    
    // Run test when page loads
    window.addEventListener('load', () => {
        console.log('Page loaded, running performance optimizer test...');
        testPerformanceOptimizer();
    });
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testPerformanceOptimizer };
}
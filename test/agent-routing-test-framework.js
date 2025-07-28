/**
 * Agent Routing Testing Framework
 * Comprehensive testing utilities for agent routing decisions
 */

class AgentRoutingTestFramework {
    constructor() {
        this.testResults = [];
        this.mockAgents = this.createMockAgents();
        this.testScenarios = this.createTestScenarios();
        this.performanceMetrics = [];
    }

    /**
     * Create mock agents for testing
     */
    createMockAgents() {
        return {
            'banking-info': {
                name: 'banking-info',
                keywords: ['balance', 'account', 'statement', 'transaction'],
                description: 'Handles banking information queries',
                priority: 1
            },
            'payments': {
                name: 'payments',
                keywords: ['pay', 'transfer', 'send', 'payment'],
                description: 'Handles payment operations',
                priority: 1
            },
            'fraud': {
                name: 'fraud',
                keywords: ['fraud', 'suspicious', 'security', 'unauthorized'],
                description: 'Handles fraud detection and security',
                priority: 2
            },
            'idv': {
                name: 'idv',
                keywords: ['verify', 'identity', 'document', 'id'],
                description: 'Handles identity verification',
                priority: 1
            },
            'general': {
                name: 'general',
                keywords: ['help', 'support', 'general'],
                description: 'Handles general queries',
                priority: 0
            }
        };
    }

    /**
     * Create test scenarios for routing
     */
    createTestScenarios() {
        return {
            clear: [
                { input: 'What is my account balance?', expected: 'banking-info', confidence: 'high' },
                { input: 'I want to transfer money to my friend', expected: 'payments', confidence: 'high' },
                { input: 'I think there is fraud on my account', expected: 'fraud', confidence: 'high' },
                { input: 'I need to verify my identity', expected: 'idv', confidence: 'high' }
            ],
            ambiguous: [
                { input: 'I need help with my account', expected: ['banking-info', 'general'], confidence: 'medium' },
                { input: 'Something is wrong with my payment', expected: ['payments', 'fraud'], confidence: 'medium' },
                { input: 'Can you help me?', expected: ['general'], confidence: 'low' },
                { input: 'My money is missing', expected: ['banking-info', 'fraud'], confidence: 'medium' }
            ],
            edge_cases: [
                { input: '', expected: 'general', confidence: 'low' },
                { input: '   ', expected: 'general', confidence: 'low' },
                { input: 'asdfghjkl', expected: 'general', confidence: 'low' },
                { input: '12345', expected: 'general', confidence: 'low' },
                { input: 'BALANCE BALANCE BALANCE', expected: 'banking-info', confidence: 'high' }
            ],
            context_dependent: [
                { 
                    input: 'Yes, proceed', 
                    context: { lastAgent: 'payments', lastIntent: 'transfer_confirmation' },
                    expected: 'payments', 
                    confidence: 'high' 
                },
                { 
                    input: 'No, cancel that', 
                    context: { lastAgent: 'fraud', lastIntent: 'block_card' },
                    expected: 'fraud', 
                    confidence: 'high' 
                }
            ],
            performance: [
                { input: 'What is my balance and can I transfer money?', expected: ['banking-info', 'payments'] },
                { input: 'I want to check my account balance, transfer funds, and verify my identity', expected: ['banking-info', 'payments', 'idv'] }
            ]
        };
    }

    /**
     * Run all routing tests
     */
    async runAllTests() {
        console.log('Starting Agent Routing Test Framework...');
        
        await this.testClearInputs();
        await this.testAmbiguousInputs();
        await this.testEdgeCases();
        await this.testContextDependentRouting();
        await this.testRoutingConsistency();
        await this.testPerformanceOptimization();
        await this.testCachingMechanisms();
        await this.testFallbackChains();
        
        return this.generateTestReport();
    }

    /**
     * Test clear, unambiguous inputs
     */
    async testClearInputs() {
        console.log('Testing clear input routing...');
        
        for (const scenario of this.testScenarios.clear) {
            try {
                const result = await this.routeInput(scenario.input);
                const passed = result.agent === scenario.expected;
                
                this.recordTest('Clear Inputs', `Route: "${scenario.input}"`, passed, {
                    input: scenario.input,
                    expected: scenario.expected,
                    actual: result.agent,
                    confidence: result.confidence,
                    processingTime: result.processingTime
                });
                
            } catch (error) {
                this.recordTest('Clear Inputs', `Route: "${scenario.input}"`, false, {
                    error: error.message
                });
            }
        }
    }

    /**
     * Test ambiguous inputs that could match multiple agents
     */
    async testAmbiguousInputs() {
        console.log('Testing ambiguous input routing...');
        
        for (const scenario of this.testScenarios.ambiguous) {
            try {
                const result = await this.routeInput(scenario.input);
                const expectedAgents = Array.isArray(scenario.expected) ? scenario.expected : [scenario.expected];
                const passed = expectedAgents.includes(result.agent);
                
                this.recordTest('Ambiguous Inputs', `Route: "${scenario.input}"`, passed, {
                    input: scenario.input,
                    expected: expectedAgents,
                    actual: result.agent,
                    confidence: result.confidence,
                    alternatives: result.alternatives
                });
                
            } catch (error) {
                this.recordTest('Ambiguous Inputs', `Route: "${scenario.input}"`, false, {
                    error: error.message
                });
            }
        }
    }

    /**
     * Test edge cases
     */
    async testEdgeCases() {
        console.log('Testing edge case routing...');
        
        for (const scenario of this.testScenarios.edge_cases) {
            try {
                const result = await this.routeInput(scenario.input);
                const passed = result.agent === scenario.expected;
                
                this.recordTest('Edge Cases', `Route: "${scenario.input || '[empty]'}"`, passed, {
                    input: scenario.input,
                    expected: scenario.expected,
                    actual: result.agent,
                    confidence: result.confidence
                });
                
            } catch (error) {
                this.recordTest('Edge Cases', `Route: "${scenario.input || '[empty]'}"`, false, {
                    error: error.message
                });
            }
        }
    }

    /**
     * Test context-dependent routing
     */
    async testContextDependentRouting() {
        console.log('Testing context-dependent routing...');
        
        for (const scenario of this.testScenarios.context_dependent) {
            try {
                const result = await this.routeInput(scenario.input, scenario.context);
                const passed = result.agent === scenario.expected;
                
                this.recordTest('Context Dependent', `Route: "${scenario.input}" with context`, passed, {
                    input: scenario.input,
                    context: scenario.context,
                    expected: scenario.expected,
                    actual: result.agent,
                    confidence: result.confidence
                });
                
            } catch (error) {
                this.recordTest('Context Dependent', `Route: "${scenario.input}" with context`, false, {
                    error: error.message
                });
            }
        }
    }

    /**
     * Test routing consistency
     */
    async testRoutingConsistency() {
        console.log('Testing routing consistency...');
        
        const testInput = 'What is my account balance?';
        const iterations = 10;
        const results = [];
        
        for (let i = 0; i < iterations; i++) {
            try {
                const result = await this.routeInput(testInput);
                results.push(result.agent);
            } catch (error) {
                results.push(null);
            }
        }
        
        // Check if all results are the same
        const uniqueResults = [...new Set(results)];
        const consistent = uniqueResults.length === 1 && uniqueResults[0] !== null;
        
        this.recordTest('Consistency', 'Same input produces same result', consistent, {
            input: testInput,
            results: results,
            uniqueResults: uniqueResults
        });
        
        // Test consistency with slight variations
        const variations = [
            'What is my account balance?',
            'What is my account balance ?',
            'what is my account balance?',
            'WHAT IS MY ACCOUNT BALANCE?'
        ];
        
        const variationResults = [];
        for (const variation of variations) {
            try {
                const result = await this.routeInput(variation);
                variationResults.push(result.agent);
            } catch (error) {
                variationResults.push(null);
            }
        }
        
        const variationConsistent = [...new Set(variationResults)].length === 1;
        
        this.recordTest('Consistency', 'Input variations produce same result', variationConsistent, {
            variations: variations,
            results: variationResults
        });
    }

    /**
     * Test performance optimization
     */
    async testPerformanceOptimization() {
        console.log('Testing performance optimization...');
        
        const testInputs = [
            'What is my balance?',
            'Transfer money',
            'Check for fraud',
            'Verify identity',
            'General help'
        ];
        
        // Test without caching
        const startTimeNoCache = Date.now();
        for (let i = 0; i < 100; i++) {
            for (const input of testInputs) {
                await this.routeInput(input, null, { useCache: false });
            }
        }
        const noCacheTime = Date.now() - startTimeNoCache;
        
        // Test with caching
        const startTimeWithCache = Date.now();
        for (let i = 0; i < 100; i++) {
            for (const input of testInputs) {
                await this.routeInput(input, null, { useCache: true });
            }
        }
        const withCacheTime = Date.now() - startTimeWithCache;
        
        const performanceImprovement = ((noCacheTime - withCacheTime) / noCacheTime) * 100;
        const passed = performanceImprovement > 10; // Should be at least 10% faster with cache
        
        this.recordTest('Performance', 'Caching improves performance', passed, {
            noCacheTime: noCacheTime,
            withCacheTime: withCacheTime,
            improvement: `${performanceImprovement.toFixed(2)}%`
        });
        
        // Test response time requirements
        const responseTimeTests = [];
        for (const input of testInputs) {
            const startTime = Date.now();
            await this.routeInput(input);
            const responseTime = Date.now() - startTime;
            responseTimeTests.push(responseTime);
        }
        
        const avgResponseTime = responseTimeTests.reduce((a, b) => a + b, 0) / responseTimeTests.length;
        const responseTimePassed = avgResponseTime < 100; // Should be under 100ms
        
        this.recordTest('Performance', 'Response time under 100ms', responseTimePassed, {
            averageResponseTime: `${avgResponseTime.toFixed(2)}ms`,
            individualTimes: responseTimeTests
        });
    }

    /**
     * Test caching mechanisms
     */
    async testCachingMechanisms() {
        console.log('Testing caching mechanisms...');
        
        const testInput = 'What is my balance?';
        
        // Clear cache
        this.clearRoutingCache();
        
        // First call - should not be cached
        const firstResult = await this.routeInput(testInput, null, { useCache: true });
        const firstCached = this.isResultCached(testInput);
        
        // Second call - should be cached
        const secondResult = await this.routeInput(testInput, null, { useCache: true });
        const secondCached = this.isResultCached(testInput);
        
        const cachingWorks = !firstCached && secondCached && firstResult.agent === secondResult.agent;
        
        this.recordTest('Caching', 'Results are properly cached', cachingWorks, {
            firstCached: firstCached,
            secondCached: secondCached,
            resultsMatch: firstResult.agent === secondResult.agent
        });
        
        // Test cache invalidation
        this.invalidateCache();
        const afterInvalidation = this.isResultCached(testInput);
        
        this.recordTest('Caching', 'Cache invalidation works', !afterInvalidation, {
            cachedAfterInvalidation: afterInvalidation
        });
    }

    /**
     * Test fallback chains
     */
    async testFallbackChains() {
        console.log('Testing fallback chains...');
        
        // Test AI routing failure fallback
        try {
            const result = await this.routeInput('What is my balance?', null, { 
                simulateAiFailure: true 
            });
            
            const fallbackWorked = result.agent !== null && result.fallbackUsed;
            
            this.recordTest('Fallback Chains', 'AI failure triggers fallback', fallbackWorked, {
                agent: result.agent,
                fallbackUsed: result.fallbackUsed,
                fallbackMethod: result.fallbackMethod
            });
            
        } catch (error) {
            this.recordTest('Fallback Chains', 'AI failure triggers fallback', false, {
                error: error.message
            });
        }
        
        // Test keyword matching fallback
        try {
            const result = await this.routeInput('balance account statement', null, {
                simulateAiFailure: true,
                simulateKeywordFailure: false
            });
            
            const keywordFallbackWorked = result.agent === 'banking-info';
            
            this.recordTest('Fallback Chains', 'Keyword fallback works', keywordFallbackWorked, {
                agent: result.agent,
                fallbackMethod: result.fallbackMethod
            });
            
        } catch (error) {
            this.recordTest('Fallback Chains', 'Keyword fallback works', false, {
                error: error.message
            });
        }
        
        // Test final fallback to general agent
        try {
            const result = await this.routeInput('xyzabc123', null, {
                simulateAiFailure: true,
                simulateKeywordFailure: true
            });
            
            const generalFallbackWorked = result.agent === 'general';
            
            this.recordTest('Fallback Chains', 'Final fallback to general agent', generalFallbackWorked, {
                agent: result.agent,
                fallbackMethod: result.fallbackMethod
            });
            
        } catch (error) {
            this.recordTest('Fallback Chains', 'Final fallback to general agent', false, {
                error: error.message
            });
        }
    }

    /**
     * Mock routing implementation for testing
     */
    async routeInput(input, context = null, options = {}) {
        const startTime = Date.now();
        
        try {
            // Check cache first if enabled
            if (options.useCache && this.isResultCached(input)) {
                return {
                    ...this.getCachedResult(input),
                    processingTime: Date.now() - startTime,
                    fromCache: true
                };
            }
            
            let agent = null;
            let confidence = 'low';
            let fallbackUsed = false;
            let fallbackMethod = null;
            let alternatives = [];
            
            // Try AI routing first (unless simulating failure)
            if (!options.simulateAiFailure) {
                const aiResult = await this.mockAiRouting(input, context);
                if (aiResult) {
                    agent = aiResult.agent;
                    confidence = aiResult.confidence;
                    alternatives = aiResult.alternatives || [];
                }
            }
            
            // Fallback to keyword matching
            if (!agent && !options.simulateKeywordFailure) {
                const keywordResult = this.mockKeywordRouting(input);
                if (keywordResult) {
                    agent = keywordResult.agent;
                    confidence = 'medium';
                    fallbackUsed = true;
                    fallbackMethod = 'keyword';
                }
            }
            
            // Fallback to context-based routing
            if (!agent && context) {
                const contextResult = this.mockContextRouting(input, context);
                if (contextResult) {
                    agent = contextResult.agent;
                    confidence = 'medium';
                    fallbackUsed = true;
                    fallbackMethod = 'context';
                }
            }
            
            // Final fallback to general agent
            if (!agent) {
                agent = 'general';
                confidence = 'low';
                fallbackUsed = true;
                fallbackMethod = 'general';
            }
            
            const result = {
                agent,
                confidence,
                fallbackUsed,
                fallbackMethod,
                alternatives,
                processingTime: Date.now() - startTime,
                fromCache: false
            };
            
            // Cache result if caching is enabled
            if (options.useCache) {
                this.cacheResult(input, result);
            }
            
            return result;
            
        } catch (error) {
            return {
                agent: 'general',
                confidence: 'low',
                fallbackUsed: true,
                fallbackMethod: 'error',
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Mock AI routing
     */
    async mockAiRouting(input, context) {
        // Simulate AI processing delay
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const lowerInput = input.toLowerCase();
        
        // Simple keyword matching for mock AI
        if (lowerInput.includes('balance') || lowerInput.includes('account') || lowerInput.includes('statement')) {
            return { agent: 'banking-info', confidence: 'high', alternatives: ['general'] };
        }
        
        if (lowerInput.includes('pay') || lowerInput.includes('transfer') || lowerInput.includes('send')) {
            return { agent: 'payments', confidence: 'high', alternatives: ['banking-info'] };
        }
        
        if (lowerInput.includes('fraud') || lowerInput.includes('suspicious') || lowerInput.includes('unauthorized')) {
            return { agent: 'fraud', confidence: 'high', alternatives: ['general'] };
        }
        
        if (lowerInput.includes('verify') || lowerInput.includes('identity') || lowerInput.includes('document')) {
            return { agent: 'idv', confidence: 'high', alternatives: ['general'] };
        }
        
        return null;
    }

    /**
     * Mock keyword routing
     */
    mockKeywordRouting(input) {
        const lowerInput = input.toLowerCase();
        
        for (const [agentName, agent] of Object.entries(this.mockAgents)) {
            for (const keyword of agent.keywords) {
                if (lowerInput.includes(keyword)) {
                    return { agent: agentName, confidence: 'medium' };
                }
            }
        }
        
        return null;
    }

    /**
     * Mock context routing
     */
    mockContextRouting(input, context) {
        if (context && context.lastAgent) {
            const confirmationWords = ['yes', 'ok', 'proceed', 'continue'];
            const cancellationWords = ['no', 'cancel', 'stop', 'abort'];
            
            const lowerInput = input.toLowerCase();
            
            if (confirmationWords.some(word => lowerInput.includes(word))) {
                return { agent: context.lastAgent, confidence: 'high' };
            }
            
            if (cancellationWords.some(word => lowerInput.includes(word))) {
                return { agent: context.lastAgent, confidence: 'high' };
            }
        }
        
        return null;
    }

    /**
     * Cache management methods
     */
    clearRoutingCache() {
        this.routingCache = new Map();
    }

    isResultCached(input) {
        return this.routingCache && this.routingCache.has(input);
    }

    getCachedResult(input) {
        return this.routingCache ? this.routingCache.get(input) : null;
    }

    cacheResult(input, result) {
        if (!this.routingCache) {
            this.routingCache = new Map();
        }
        this.routingCache.set(input, result);
    }

    invalidateCache() {
        this.routingCache = new Map();
    }

    /**
     * Record test result
     */
    recordTest(category, description, passed, details = {}) {
        this.testResults.push({
            category,
            description,
            passed,
            details,
            timestamp: new Date().toISOString()
        });
        
        const status = passed ? '✓' : '✗';
        console.log(`${status} ${category}: ${description}`);
        
        if (!passed && details.error) {
            console.error(`  Error: ${details.error}`);
        }
    }

    /**
     * Generate test report
     */
    generateTestReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(test => test.passed).length;
        const failedTests = totalTests - passedTests;
        const passRate = ((passedTests / totalTests) * 100).toFixed(2);
        
        const report = {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                passRate: `${passRate}%`
            },
            categories: {},
            details: this.testResults
        };
        
        // Group by category
        for (const test of this.testResults) {
            if (!report.categories[test.category]) {
                report.categories[test.category] = { passed: 0, failed: 0, tests: [] };
            }
            
            if (test.passed) {
                report.categories[test.category].passed++;
            } else {
                report.categories[test.category].failed++;
            }
            
            report.categories[test.category].tests.push(test);
        }
        
        console.log('\n=== Agent Routing Test Report ===');
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${failedTests}`);
        console.log(`Pass Rate: ${passRate}%`);
        
        console.log('\nBy Category:');
        for (const [category, stats] of Object.entries(report.categories)) {
            const categoryPassRate = ((stats.passed / (stats.passed + stats.failed)) * 100).toFixed(2);
            console.log(`  ${category}: ${stats.passed}/${stats.passed + stats.failed} (${categoryPassRate}%)`);
        }
        
        return report;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentRoutingTestFramework;
} else {
    window.AgentRoutingTestFramework = AgentRoutingTestFramework;
}
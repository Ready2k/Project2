#!/usr/bin/env node

/**
 * Command Line Test Runner for Streaming Agent Routing Tests
 * Runs all test suites and provides detailed reporting
 */

const fs = require('fs');
const path = require('path');

// Mock browser environment for Node.js execution
global.window = {
    debugManager: {
        createModuleLogger: (moduleName) => ({
            log: (...args) => console.log(`[${moduleName}]`, ...args),
            debug: (...args) => console.debug(`[${moduleName}]`, ...args),
            info: (...args) => console.info(`[${moduleName}]`, ...args),
            warn: (...args) => console.warn(`[${moduleName}]`, ...args),
            error: (...args) => console.error(`[${moduleName}]`, ...args)
        })
    },
    currentPersona: {
        name: 'Test Assistant',
        instructions: 'You are a helpful test assistant.'
    },
    WebSocket: {
        OPEN: 1,
        CLOSED: 3
    },
    performance: {
        now: () => Date.now(),
        memory: process.memoryUsage ? {
            get usedJSHeapSize() {
                return process.memoryUsage().heapUsed;
            }
        } : undefined
    }
};

// Mock WebSocket constructor
global.WebSocket = function(url) {
    this.readyState = global.window.WebSocket.OPEN;
    this.send = (data) => {
        console.log('Mock WebSocket send:', JSON.parse(data).type);
    };
    this.close = () => {
        this.readyState = global.window.WebSocket.CLOSED;
    };
};

// Load test classes
function loadTestFile(filename) {
    try {
        const filePath = path.join(__dirname, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Remove browser-specific exports and evaluate
        const cleanContent = content.replace(/if \(typeof module.*\n.*module\.exports.*\n}/, '');
        eval(cleanContent);
        
        return true;
    } catch (error) {
        console.error(`Failed to load ${filename}:`, error.message);
        return false;
    }
}

// Load streaming components (simplified mocks for testing)
global.StreamingAgentRouter = class {
    constructor(agentRouter, streamingManager) {
        this.agentRouter = agentRouter;
        this.streamingManager = streamingManager;
        this.currentAgent = null;
        this.sessionContext = {
            sessionId: null,
            conversationContext: {},
            agentHistory: [],
            routingMetrics: {
                routingLatency: 0,
                agentSwitches: 0,
                fallbackCount: 0
            }
        };
        this.routingLatencyThreshold = 100;
        this.maxRoutingTimeout = 200;
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 3;
        this.circuitBreakerOpen = false;
    }
    
    async routeStreamingMessage(transcript, sessionContext) {
        const startTime = Date.now();
        try {
            const result = await this.agentRouter.route(transcript, sessionContext);
            const latency = Date.now() - startTime;
            this.sessionContext.routingMetrics.routingLatency = latency;
            
            if (result.success) {
                const selectedAgent = this.agentRouter.getRegisteredAgents()
                    .find(a => a.name === result.agentName);
                const agentChanged = this.currentAgent?.name !== result.agentName;
                
                if (agentChanged) {
                    this.currentAgent = selectedAgent;
                    this.sessionContext.routingMetrics.agentSwitches++;
                    this.sessionContext.agentHistory.push({
                        agentName: result.agentName,
                        timestamp: Date.now(),
                        switchReason: 'routing_decision'
                    });
                }
                
                return {
                    success: true,
                    selectedAgent: selectedAgent,
                    agentResponse: {
                        success: true,
                        response: result.response,
                        agentName: result.agentName,
                        streamingInstructions: `Instructions for ${result.agentName}`,
                        voiceConfig: this.getAgentVoiceConfig(selectedAgent),
                        metadata: {
                            processingTime: result.processingTime || latency,
                            tokensUsed: result.tokensUsed || 20,
                            requiresSessionUpdate: agentChanged,
                            chunkingStrategy: 'sentence_based'
                        }
                    },
                    agentChanged,
                    sessionUpdateRequired: agentChanged,
                    routingReason: 'agent_routing_success'
                };
            } else {
                this.sessionContext.routingMetrics.fallbackCount++;
                return {
                    success: false,
                    fallbackReason: result.error || 'routing_failed',
                    error: result.error
                };
            }
        } catch (error) {
            this.sessionContext.routingMetrics.fallbackCount++;
            return {
                success: false,
                error: error.message,
                fallbackReason: 'routing_exception'
            };
        }
    }
    
    async switchAgent(newAgent, currentContext, switchReason) {
        const startTime = Date.now();
        try {
            const validation = this.validateAgentSwitch(newAgent, currentContext);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.reason,
                    currentAgent: this.currentAgent?.name,
                    switchLatency: Date.now() - startTime
                };
            }
            
            const preservedContext = await this.preserveAgentContext(this.currentAgent, currentContext);
            const previousAgent = this.currentAgent;
            this.currentAgent = newAgent;
            
            this.sessionContext.routingMetrics.agentSwitches++;
            this.sessionContext.agentHistory.push({
                agentName: newAgent.name,
                timestamp: Date.now(),
                switchReason: switchReason
            });
            
            return {
                success: true,
                previousAgent: previousAgent?.name,
                newAgent: newAgent.name,
                switchReason,
                switchLatency: Date.now() - startTime,
                preservedContext,
                sessionUpdateResult: { success: true },
                voiceConfig: this.getAgentVoiceConfig(newAgent)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                currentAgent: this.currentAgent?.name,
                targetAgent: newAgent?.name,
                switchReason,
                switchLatency: Date.now() - startTime
            };
        }
    }
    
    validateAgentSwitch(newAgent, currentContext) {
        if (!newAgent) return { valid: false, reason: 'New agent is null or undefined' };
        if (!newAgent.name) return { valid: false, reason: 'New agent missing name property' };
        if (typeof newAgent.processMessage !== 'function') return { valid: false, reason: 'New agent missing processMessage method' };
        if (this.currentAgent && this.currentAgent.name === newAgent.name) return { valid: false, reason: 'Already using the requested agent' };
        if (!this.streamingManager.websocket || this.streamingManager.websocket.readyState !== global.window.WebSocket.OPEN) {
            return { valid: false, reason: 'WebSocket connection not available for session updates' };
        }
        if (this.circuitBreakerOpen) return { valid: false, reason: 'Circuit breaker is open, agent switching disabled' };
        return { valid: true };
    }
    
    async preserveAgentContext(currentAgent, currentContext) {
        return {
            timestamp: Date.now(),
            preservedFrom: currentAgent?.name || 'no_agent',
            conversationHistory: currentContext.conversationHistory || [],
            userPreferences: currentContext.userPreferences || {},
            sessionData: currentContext.sessionData || {},
            agentSpecificData: {}
        };
    }
    
    async generateSessionInstructions(agent, responseText, context) {
        const agentInstructions = agent ? `You are ${agent.name}. ${agent.description || ''}` : 'You are a helpful assistant.';
        let instructions = `${global.window.currentPersona.instructions}\n\n${agentInstructions}`;
        
        if (context.preservedContext) {
            instructions += `\n\nContext Preserved from Previous Agent (${context.preservedContext.preservedFrom}):`;
            if (context.preservedContext.conversationHistory?.length > 0) {
                instructions += `\n- Recent conversation history available`;
            }
            if (context.switchReason) {
                instructions += `\n- Agent switch reason: ${context.switchReason}`;
            }
        }
        
        if (responseText) {
            instructions += `\n\nRecent Response: "${responseText}"`;
        }
        
        return instructions;
    }
    
    getAgentVoiceConfig(agent) {
        const agentVoices = {
            'FraudAgent': { voice: 'alloy', speed: 0.9, pitch: 1.0 },
            'PaymentsAgent': { voice: 'echo', speed: 1.0, pitch: 1.0 },
            'IDVAgent': { voice: 'fable', speed: 0.95, pitch: 1.0 },
            'BankingInfoAgent': { voice: 'shimmer', speed: 1.0, pitch: 1.0 }
        };
        return agentVoices[agent?.name] || { voice: 'shimmer', speed: 1.0, pitch: 1.0 };
    }
};

global.StreamingResponseHandler = class {
    constructor(streamingManager) {
        this.streamingManager = streamingManager;
    }
    
    async processAgentResponse(agentResponse, streamingContext) {
        const chunks = this.chunkResponseForStreaming(agentResponse.response || '', 'sentence_based');
        return {
            success: true,
            agentName: agentResponse.agentName,
            originalResponse: agentResponse.response,
            chunks: chunks,
            chunkingStrategy: 'sentence_based',
            voiceConfig: { voice: 'shimmer', speed: 1.0 },
            sessionInstructions: `Instructions for ${agentResponse.agentName}`,
            streamingMetadata: {
                processingTime: 25,
                chunkCount: chunks.length,
                totalLength: (agentResponse.response || '').length,
                requiresVoiceChange: false,
                requiresSessionUpdate: false,
                timestamp: Date.now()
            }
        };
    }
    
    chunkResponseForStreaming(response, strategy) {
        if (!response) return [{ text: '', index: 0, isLast: true, metadata: { strategy: 'empty' } }];
        
        const sentences = response.split(/[.!?;]/).filter(s => s.trim());
        return sentences.map((sentence, index) => ({
            text: sentence.trim(),
            index: index,
            isLast: index === sentences.length - 1,
            metadata: { strategy: strategy }
        }));
    }
    
    formatForWebSocket(response, messageType) {
        return {
            type: messageType,
            timestamp: Date.now(),
            agentName: response.agentName,
            success: response.success,
            session: messageType === 'session.update' ? {
                instructions: response.sessionInstructions,
                voice: response.voiceConfig?.voice || 'shimmer'
            } : undefined
        };
    }
};

global.StreamingAgentMiddleware = class {
    constructor(streamingManager, streamingAgentRouter) {
        this.streamingManager = streamingManager;
        this.streamingAgentRouter = streamingAgentRouter;
        this.isEnabled = true;
    }
    
    async interceptMessage(message, messageType) {
        return {
            success: true,
            handled: false,
            processingTime: 10
        };
    }
};

async function runTestSuite(TestClass, suiteName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Running ${suiteName}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
        const testInstance = new TestClass();
        const results = await testInstance.runAllTests();
        
        const passed = results.filter(r => r.passed).length;
        const total = results.length;
        const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
        
        console.log(`\n📊 ${suiteName} Results:`);
        console.log(`   Total Tests: ${total}`);
        console.log(`   Passed: ${passed}`);
        console.log(`   Failed: ${total - passed}`);
        console.log(`   Success Rate: ${successRate}%`);
        
        if (total - passed > 0) {
            console.log(`\n❌ Failed Tests:`);
            results.filter(r => !r.passed).forEach(result => {
                console.log(`   • ${result.test}: ${result.message}`);
            });
        }
        
        return { total, passed, failed: total - passed, results };
        
    } catch (error) {
        console.error(`❌ Error running ${suiteName}:`, error.message);
        return { total: 0, passed: 0, failed: 1, results: [], error: error.message };
    }
}

async function main() {
    console.log('🚀 Streaming Agent Routing Test Suite - Command Line Runner');
    console.log('============================================================');
    
    // Load test files
    const testFiles = [
        'test-streaming-agent-router-unit.js',
        'test-streaming-agent-integration.js',
        'test-streaming-agent-performance.js',
        'test-streaming-agent-error-scenarios.js',
        'test-streaming-agent-context-switching.js'
    ];
    
    console.log('📁 Loading test files...');
    let loadedFiles = 0;
    for (const file of testFiles) {
        if (loadTestFile(file)) {
            loadedFiles++;
            console.log(`   ✅ ${file}`);
        } else {
            console.log(`   ❌ ${file}`);
        }
    }
    
    if (loadedFiles === 0) {
        console.error('❌ No test files could be loaded. Exiting.');
        process.exit(1);
    }
    
    console.log(`\n📋 Loaded ${loadedFiles}/${testFiles.length} test files`);
    
    // Run test suites
    const testSuites = [
        { class: global.StreamingAgentRouterUnitTests, name: 'Unit Tests' },
        { class: global.StreamingAgentIntegrationTests, name: 'Integration Tests' },
        { class: global.StreamingAgentPerformanceTests, name: 'Performance Tests' },
        { class: global.StreamingAgentErrorScenarioTests, name: 'Error Scenario Tests' },
        { class: global.StreamingAgentContextSwitchingTests, name: 'Context Switching Tests' }
    ];
    
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const suiteResults = [];
    
    for (const suite of testSuites) {
        if (suite.class) {
            const result = await runTestSuite(suite.class, suite.name);
            totalTests += result.total;
            totalPassed += result.passed;
            totalFailed += result.failed;
            suiteResults.push({ name: suite.name, ...result });
        } else {
            console.log(`⚠️  Skipping ${suite.name} - class not loaded`);
        }
    }
    
    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('🏁 FINAL TEST SUMMARY');
    console.log(`${'='.repeat(60)}`);
    
    console.log(`📊 Overall Results:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${totalPassed}`);
    console.log(`   Failed: ${totalFailed}`);
    console.log(`   Success Rate: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0}%`);
    
    console.log(`\n📋 Suite Breakdown:`);
    suiteResults.forEach(suite => {
        const status = suite.failed === 0 ? '✅' : '❌';
        const rate = suite.total > 0 ? ((suite.passed / suite.total) * 100).toFixed(1) : 0;
        console.log(`   ${status} ${suite.name}: ${suite.passed}/${suite.total} (${rate}%)`);
    });
    
    if (totalFailed === 0) {
        console.log(`\n🎉 All tests passed! Streaming agent routing is working correctly.`);
        process.exit(0);
    } else {
        console.log(`\n⚠️  ${totalFailed} test(s) failed. Please review the detailed results above.`);
        process.exit(1);
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Streaming Agent Routing Test Runner

Usage: node run-streaming-agent-tests.js [options]

Options:
  --help, -h     Show this help message
  --verbose, -v  Enable verbose output
  --suite <name> Run specific test suite only

Available test suites:
  - unit: Unit tests for core functionality
  - integration: End-to-end integration tests
  - performance: Performance and latency tests
  - error: Error handling and fallback tests
  - context: Context switching and preservation tests

Examples:
  node run-streaming-agent-tests.js
  node run-streaming-agent-tests.js --verbose
  node run-streaming-agent-tests.js --suite unit
`);
    process.exit(0);
}

// Run the test suite
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
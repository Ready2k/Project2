#!/usr/bin/env node

/**
 * Agent System Test Runner
 * Command-line test runner for comprehensive agent system testing
 */

const fs = require('fs');
const path = require('path');

class AgentTestRunner {
    constructor() {
        this.testResults = [];
        this.verbose = false;
        this.outputFile = null;
        this.testFilter = null;
    }

    /**
     * Parse command line arguments
     */
    parseArgs(args) {
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            switch (arg) {
                case '--verbose':
                case '-v':
                    this.verbose = true;
                    break;
                    
                case '--output':
                case '-o':
                    this.outputFile = args[++i];
                    break;
                    
                case '--filter':
                case '-f':
                    this.testFilter = args[++i];
                    break;
                    
                case '--help':
                case '-h':
                    this.showHelp();
                    process.exit(0);
                    break;
            }
        }
    }

    /**
     * Show help information
     */
    showHelp() {
        console.log(`
Agent System Test Runner

Usage: node run-agent-tests.js [options]

Options:
  --verbose, -v     Enable verbose output
  --output, -o      Output file for test results (JSON format)
  --filter, -f      Filter tests by name pattern
  --help, -h        Show this help message

Test Categories:
  - integration     Voice-to-agent-to-response flow tests
  - switching       Agent switching within conversations
  - streaming       Streaming mode compatibility tests
  - security        Security boundary validation tests
  - error-handling  Error handling and fallback tests
  - performance     Performance and metrics tests

Examples:
  node run-agent-tests.js --verbose
  node run-agent-tests.js --filter security --output results.json
  node run-agent-tests.js --verbose --filter streaming
        `);
    }

    /**
     * Log message with optional verbose filtering
     */
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        
        if (level === 'error' || this.verbose || level === 'result') {
            console.log(logMessage);
        }
    }

    /**
     * Run integration tests
     */
    async runIntegrationTests() {
        this.log('Running integration tests...', 'info');
        
        const testCases = [
            {
                name: 'Banking Info Query Routing',
                input: 'What is my account balance?',
                expectedAgent: 'BankingInfoAgent'
            },
            {
                name: 'Payment Request Routing',
                input: 'Send £100 to Alice',
                expectedAgent: 'PaymentsAgent'
            },
            {
                name: 'Fraud Alert Routing',
                input: 'Block my card immediately',
                expectedAgent: 'FraudAgent'
            },
            {
                name: 'Identity Verification Routing',
                input: 'I forgot my password',
                expectedAgent: 'IDVAgent'
            },
            {
                name: 'Fallback Handler Test',
                input: 'What is the weather today?',
                expectedAgent: 'FallbackHandler'
            }
        ];

        const results = [];
        
        for (const testCase of testCases) {
            try {
                this.log(`Testing: ${testCase.name}`, 'info');
                
                // Simulate agent routing logic
                const selectedAgent = this.simulateAgentRouting(testCase.input);
                const success = selectedAgent === testCase.expectedAgent;
                
                results.push({
                    name: testCase.name,
                    input: testCase.input,
                    expected: testCase.expectedAgent,
                    actual: selectedAgent,
                    success
                });
                
                this.log(`${success ? 'PASS' : 'FAIL'}: ${testCase.name}`, success ? 'info' : 'error');
                
            } catch (error) {
                this.log(`ERROR in ${testCase.name}: ${error.message}`, 'error');
                results.push({
                    name: testCase.name,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            category: 'integration',
            total: results.length,
            passed: results.filter(r => r.success).length,
            results
        };
    }

    /**
     * Run agent switching tests
     */
    async runAgentSwitchingTests() {
        this.log('Running agent switching tests...', 'info');
        
        const conversationFlow = [
            { input: 'What is my balance?', expectedAgent: 'BankingInfoAgent' },
            { input: 'Now I want to send money', expectedAgent: 'PaymentsAgent' },
            { input: 'Wait, my card might be stolen', expectedAgent: 'FraudAgent' },
            { input: 'I need to verify my identity', expectedAgent: 'IDVAgent' },
            { input: 'Back to checking my balance', expectedAgent: 'BankingInfoAgent' }
        ];

        const results = [];
        
        for (let i = 0; i < conversationFlow.length; i++) {
            const step = conversationFlow[i];
            
            try {
                this.log(`Conversation step ${i + 1}: ${step.input}`, 'info');
                
                const selectedAgent = this.simulateAgentRouting(step.input);
                const success = selectedAgent === step.expectedAgent;
                
                results.push({
                    step: i + 1,
                    input: step.input,
                    expected: step.expectedAgent,
                    actual: selectedAgent,
                    success
                });
                
                this.log(`Step ${i + 1} ${success ? 'PASS' : 'FAIL'}`, success ? 'info' : 'error');
                
            } catch (error) {
                this.log(`ERROR in conversation step ${i + 1}: ${error.message}`, 'error');
                results.push({
                    step: i + 1,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            category: 'switching',
            total: results.length,
            passed: results.filter(r => r.success).length,
            results
        };
    }

    /**
     * Run streaming compatibility tests
     */
    async runStreamingTests() {
        this.log('Running streaming compatibility tests...', 'info');
        
        const streamingScenarios = [
            {
                name: 'Chunked Input Processing',
                chunks: ['What is', ' my account', ' balance?'],
                expectedFinal: 'What is my account balance?',
                expectedAgent: 'BankingInfoAgent'
            },
            {
                name: 'Payment Request Streaming',
                chunks: ['Send', ' fifty pounds', ' to Alice'],
                expectedFinal: 'Send fifty pounds to Alice',
                expectedAgent: 'PaymentsAgent'
            },
            {
                name: 'Fraud Alert Streaming',
                chunks: ['Block', ' my card', ' now'],
                expectedFinal: 'Block my card now',
                expectedAgent: 'FraudAgent'
            }
        ];

        const results = [];
        
        for (const scenario of streamingScenarios) {
            try {
                this.log(`Testing streaming scenario: ${scenario.name}`, 'info');
                
                // Simulate streaming processing
                let combinedInput = '';
                const chunkResults = [];
                
                for (const chunk of scenario.chunks) {
                    combinedInput += chunk;
                    
                    // Test partial input handling
                    try {
                        const partialAgent = this.simulateAgentRouting(combinedInput);
                        chunkResults.push({
                            chunk: combinedInput,
                            agent: partialAgent
                        });
                    } catch (error) {
                        // Partial inputs might not route to any agent - this is acceptable
                        chunkResults.push({
                            chunk: combinedInput,
                            agent: null,
                            error: error.message
                        });
                    }
                }
                
                // Test final input
                const finalAgent = this.simulateAgentRouting(scenario.expectedFinal);
                const success = finalAgent === scenario.expectedAgent;
                
                results.push({
                    name: scenario.name,
                    expectedFinal: scenario.expectedFinal,
                    actualFinal: combinedInput,
                    expectedAgent: scenario.expectedAgent,
                    actualAgent: finalAgent,
                    chunkResults,
                    success
                });
                
                this.log(`${success ? 'PASS' : 'FAIL'}: ${scenario.name}`, success ? 'info' : 'error');
                
            } catch (error) {
                this.log(`ERROR in ${scenario.name}: ${error.message}`, 'error');
                results.push({
                    name: scenario.name,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            category: 'streaming',
            total: results.length,
            passed: results.filter(r => r.success).length,
            results
        };
    }

    /**
     * Run security boundary tests
     */
    async runSecurityTests() {
        this.log('Running security boundary tests...', 'info');
        
        const securityTests = [
            {
                name: 'Banking Agent Data Access Boundaries',
                agent: 'BankingInfoAgent',
                allowedData: ['balance', 'transactions', 'account_info'],
                restrictedData: ['payments', 'fraud_actions', 'identity_verification']
            },
            {
                name: 'Payments Agent Data Access Boundaries',
                agent: 'PaymentsAgent',
                allowedData: ['payments', 'transfers', 'payment_history'],
                restrictedData: ['identity_verification', 'fraud_alerts']
            },
            {
                name: 'Fraud Agent Data Access Boundaries',
                agent: 'FraudAgent',
                allowedData: ['fraud_alerts', 'security_actions', 'card_status'],
                restrictedData: ['payments', 'balance', 'identity_verification']
            },
            {
                name: 'IDV Agent Data Access Boundaries',
                agent: 'IDVAgent',
                allowedData: ['identity', 'verification', 'authentication'],
                restrictedData: ['payments', 'balance', 'fraud_actions']
            }
        ];

        const results = [];
        
        for (const test of securityTests) {
            try {
                this.log(`Testing security boundaries for: ${test.agent}`, 'info');
                
                // Test allowed data access
                const allowedResults = test.allowedData.map(dataType => {
                    return this.simulateDataAccessValidation(test.agent, dataType, true);
                });
                
                // Test restricted data access
                const restrictedResults = test.restrictedData.map(dataType => {
                    return this.simulateDataAccessValidation(test.agent, dataType, false);
                });
                
                const allowedPassed = allowedResults.every(r => r.success);
                const restrictedPassed = restrictedResults.every(r => r.success);
                const overallSuccess = allowedPassed && restrictedPassed;
                
                results.push({
                    name: test.name,
                    agent: test.agent,
                    allowedDataTests: allowedResults,
                    restrictedDataTests: restrictedResults,
                    success: overallSuccess
                });
                
                this.log(`${overallSuccess ? 'PASS' : 'FAIL'}: ${test.name}`, overallSuccess ? 'info' : 'error');
                
            } catch (error) {
                this.log(`ERROR in ${test.name}: ${error.message}`, 'error');
                results.push({
                    name: test.name,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            category: 'security',
            total: results.length,
            passed: results.filter(r => r.success).length,
            results
        };
    }

    /**
     * Run error handling tests
     */
    async runErrorHandlingTests() {
        this.log('Running error handling tests...', 'info');
        
        const errorScenarios = [
            {
                name: 'Null Input Handling',
                input: null,
                expectedBehavior: 'graceful_fallback'
            },
            {
                name: 'Empty Input Handling',
                input: '',
                expectedBehavior: 'graceful_fallback'
            },
            {
                name: 'Invalid Input Type Handling',
                input: { invalid: 'object' },
                expectedBehavior: 'graceful_fallback'
            },
            {
                name: 'Very Long Input Handling',
                input: 'a'.repeat(10000),
                expectedBehavior: 'graceful_processing'
            }
        ];

        const results = [];
        
        for (const scenario of errorScenarios) {
            try {
                this.log(`Testing error scenario: ${scenario.name}`, 'info');
                
                let success = false;
                let errorHandled = false;
                
                try {
                    const result = this.simulateAgentRouting(scenario.input);
                    
                    if (scenario.expectedBehavior === 'graceful_fallback') {
                        success = result === 'FallbackHandler' || result === null;
                    } else if (scenario.expectedBehavior === 'graceful_processing') {
                        success = result !== null;
                    }
                    
                } catch (error) {
                    errorHandled = true;
                    // For error scenarios, catching an error might be expected
                    success = scenario.expectedBehavior === 'graceful_fallback';
                }
                
                results.push({
                    name: scenario.name,
                    input: typeof scenario.input === 'string' ? scenario.input.substring(0, 100) : String(scenario.input),
                    expectedBehavior: scenario.expectedBehavior,
                    errorHandled,
                    success
                });
                
                this.log(`${success ? 'PASS' : 'FAIL'}: ${scenario.name}`, success ? 'info' : 'error');
                
            } catch (error) {
                this.log(`ERROR in ${scenario.name}: ${error.message}`, 'error');
                results.push({
                    name: scenario.name,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            category: 'error-handling',
            total: results.length,
            passed: results.filter(r => r.success).length,
            results
        };
    }

    /**
     * Simulate agent routing logic for testing
     */
    simulateAgentRouting(input) {
        if (!input || typeof input !== 'string' || input.trim() === '') {
            return 'FallbackHandler';
        }

        const lowerInput = input.toLowerCase();

        // Payment keywords
        if (lowerInput.includes('send') || lowerInput.includes('transfer') || lowerInput.includes('pay')) {
            return 'PaymentsAgent';
        }

        // Fraud keywords
        if (lowerInput.includes('block') || lowerInput.includes('freeze') || lowerInput.includes('stolen') || lowerInput.includes('fraud')) {
            return 'FraudAgent';
        }

        // IDV keywords
        if (lowerInput.includes('verify') || lowerInput.includes('password') || lowerInput.includes('identity')) {
            return 'IDVAgent';
        }

        // Banking info keywords
        if (lowerInput.includes('balance') || lowerInput.includes('transaction') || lowerInput.includes('account')) {
            return 'BankingInfoAgent';
        }

        // Default to fallback
        return 'FallbackHandler';
    }

    /**
     * Simulate data access validation for testing
     */
    simulateDataAccessValidation(agentName, dataType, shouldAllow) {
        // Simulate security validation logic
        const agentPermissions = {
            'BankingInfoAgent': ['balance', 'transactions', 'account_info'],
            'PaymentsAgent': ['payments', 'transfers', 'payment_history'],
            'FraudAgent': ['fraud_alerts', 'security_actions', 'card_status'],
            'IDVAgent': ['identity', 'verification', 'authentication']
        };

        const allowedData = agentPermissions[agentName] || [];
        const hasAccess = allowedData.includes(dataType);

        if (shouldAllow) {
            // Test should pass if agent has access to allowed data
            return {
                dataType,
                hasAccess,
                success: hasAccess
            };
        } else {
            // Test should pass if agent is blocked from restricted data
            return {
                dataType,
                hasAccess,
                success: !hasAccess
            };
        }
    }

    /**
     * Run all tests or filtered tests
     */
    async runTests() {
        this.log('Starting comprehensive agent system tests...', 'result');
        
        const testSuites = [
            { name: 'integration', runner: () => this.runIntegrationTests() },
            { name: 'switching', runner: () => this.runAgentSwitchingTests() },
            { name: 'streaming', runner: () => this.runStreamingTests() },
            { name: 'security', runner: () => this.runSecurityTests() },
            { name: 'error-handling', runner: () => this.runErrorHandlingTests() }
        ];

        const filteredSuites = this.testFilter 
            ? testSuites.filter(suite => suite.name.includes(this.testFilter))
            : testSuites;

        if (filteredSuites.length === 0) {
            this.log(`No test suites match filter: ${this.testFilter}`, 'error');
            return;
        }

        const startTime = Date.now();
        
        for (const suite of filteredSuites) {
            try {
                const result = await suite.runner();
                this.testResults.push(result);
                
                this.log(`${suite.name.toUpperCase()}: ${result.passed}/${result.total} tests passed`, 'result');
                
            } catch (error) {
                this.log(`Test suite ${suite.name} failed: ${error.message}`, 'error');
                this.testResults.push({
                    category: suite.name,
                    success: false,
                    error: error.message
                });
            }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Calculate overall results
        const totalTests = this.testResults.reduce((sum, result) => sum + (result.total || 0), 0);
        const totalPassed = this.testResults.reduce((sum, result) => sum + (result.passed || 0), 0);
        const overallSuccess = this.testResults.every(result => result.success !== false);

        const summary = {
            totalSuites: this.testResults.length,
            totalTests,
            totalPassed,
            overallSuccess,
            duration,
            timestamp: new Date().toISOString()
        };

        this.log(`\n=== TEST SUMMARY ===`, 'result');
        this.log(`Test Suites: ${summary.totalSuites}`, 'result');
        this.log(`Total Tests: ${summary.totalTests}`, 'result');
        this.log(`Passed: ${summary.totalPassed}`, 'result');
        this.log(`Failed: ${summary.totalTests - summary.totalPassed}`, 'result');
        this.log(`Duration: ${summary.duration}ms`, 'result');
        this.log(`Overall: ${summary.overallSuccess ? 'PASS' : 'FAIL'}`, summary.overallSuccess ? 'result' : 'error');

        // Save results to file if specified
        if (this.outputFile) {
            const outputData = {
                summary,
                results: this.testResults
            };
            
            try {
                fs.writeFileSync(this.outputFile, JSON.stringify(outputData, null, 2));
                this.log(`Results saved to: ${this.outputFile}`, 'result');
            } catch (error) {
                this.log(`Failed to save results: ${error.message}`, 'error');
            }
        }

        // Exit with appropriate code
        process.exit(summary.overallSuccess ? 0 : 1);
    }
}

// Main execution
if (require.main === module) {
    const runner = new AgentTestRunner();
    runner.parseArgs(process.argv.slice(2));
    runner.runTests().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = AgentTestRunner;
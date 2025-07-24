/**
 * Guardrails Integration Test
 * Tests the complete guardrails system integration with agents and router
 */

// Mock debug manager for testing
if (!window.debugManager) {
    window.debugManager = {
        createModuleLogger: (module) => ({
            log: (...args) => console.log(`[${module}]`, ...args),
            info: (...args) => console.info(`[${module}]`, ...args),
            warn: (...args) => console.warn(`[${module}]`, ...args),
            error: (...args) => console.error(`[${module}]`, ...args)
        })
    };
}

// Mock security manager for testing
class MockSecurityManager {
    validateDataAccess(agentName, dataTypes) {
        return { success: true, allowedDataTypes: dataTypes };
    }
    
    validateApiAccess(agentName, apiCalls) {
        return { success: true, allowedApiCalls: apiCalls };
    }
}

// Mock sandboxed API client for testing
class MockSandboxedApiClient {
    async generateChatCompletion(messages, options) {
        return {
            success: true,
            content: "Mock response from LLM",
            tokensUsed: 50
        };
    }
    
    async accessData(dataTypes) {
        return { success: true, data: `Mock data for ${dataTypes.join(', ')}` };
    }
    
    async callDomainApi(apiCall, parameters) {
        return { success: true, result: `Mock API call result for ${apiCall}` };
    }
}

// Mock persona manager for testing
class MockPersonaManager {
    getCurrentPersonaData() {
        return {
            name: "Test User",
            accountType: "Current Account",
            balance: 2500.00,
            cardLast4: "1234",
            currency: "GBP",
            recentTransactions: [
                { date: "2024-01-15", amount: -50.00, description: "Grocery Store" },
                { date: "2024-01-14", amount: -25.00, description: "Coffee Shop" },
                { date: "2024-01-13", amount: 1500.00, description: "Salary Deposit" }
            ]
        };
    }
    
    formatCurrency(amount) {
        return `£${amount.toFixed(2)}`;
    }
}

// Test runner
class GuardrailsIntegrationTest {
    constructor() {
        this.testResults = [];
        this.guardrailsManager = null;
        this.agents = {};
        this.router = null;
    }
    
    async runAllTests() {
        console.log('🚀 Starting Guardrails Integration Tests...\n');
        
        try {
            await this.setupTestEnvironment();
            await this.testGuardrailsEnforcement();
            await this.testAgentRestrictions();
            await this.testViolationLogging();
            await this.testTransactionLimits();
            
            this.printTestSummary();
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }
    
    async setupTestEnvironment() {
        console.log('📋 Setting up test environment...');
        
        try {
            // Initialize guardrails manager
            this.guardrailsManager = new GuardrailsManager();
            
            // Enable test mode to disable time restrictions
            this.guardrailsManager.enableTestMode();
            
            // Create test agents
            this.agents.idv = new IDVAgent();
            this.agents.banking = new BankingInfoAgent();
            this.agents.fraud = new FraudAgent();
            this.agents.payments = new PaymentsAgent();
            
            // Set up mock dependencies for each agent
            Object.values(this.agents).forEach(agent => {
                agent.setSecurityManager(new MockSecurityManager());
                agent.setGuardrailsManager(this.guardrailsManager);
                agent.sandboxedApiClient = new MockSandboxedApiClient();
            });
            
            this.addTestResult('Environment setup', true, 'All components initialized successfully');
        } catch (error) {
            this.addTestResult('Environment setup', false, error.message);
            throw error;
        }
    }
    
    async testGuardrailsEnforcement() {
        console.log('🛡️  Testing guardrails enforcement...');
        
        // Test 1: IDVAgent should be blocked from transaction actions
        try {
            this.agents.idv.validateGuardrails('initiateTransfer', { amount: 100 });
            this.addTestResult('IDVAgent transaction blocking', false, 'Should have been blocked');
        } catch (error) {
            this.addTestResult('IDVAgent transaction blocking', true, 'Correctly blocked transaction');
        }
        
        // Test 1a: Test secondary auth requirement without auth completed
        try {
            this.agents.fraud.validateGuardrails('blockCard', {});
            this.addTestResult('FraudAgent secondary auth requirement', false, 'Should require secondary auth');
        } catch (error) {
            this.addTestResult('FraudAgent secondary auth requirement', true, 'Correctly requires secondary auth');
        }
        
        // Test 1b: Test secondary auth requirement with auth completed
        try {
            this.agents.fraud.validateGuardrails('blockCard', { secondaryAuthCompleted: true });
            this.addTestResult('FraudAgent with secondary auth', true, 'Correctly allowed with secondary auth');
        } catch (error) {
            this.addTestResult('FraudAgent with secondary auth', false, `Should be allowed with secondary auth: ${error.message}`);
        }
        
        // Test 2: BankingInfoAgent should be blocked from transaction actions
        try {
            this.agents.banking.validateGuardrails('initiateTransfer', { amount: 100 });
            this.addTestResult('BankingInfoAgent transaction blocking', false, 'Should have been blocked');
        } catch (error) {
            this.addTestResult('BankingInfoAgent transaction blocking', true, 'Correctly blocked transaction');
        }
        
        // Test 3: PaymentsAgent should allow transactions within limits (with secondary auth)
        try {
            this.agents.payments.validateGuardrails('initiateTransfer', { 
                amount: 500, 
                secondaryAuthCompleted: true 
            });
            this.addTestResult('PaymentsAgent transaction allowing', true, 'Correctly allowed transaction within limits');
        } catch (error) {
            this.addTestResult('PaymentsAgent transaction allowing', false, `Incorrectly blocked: ${error.message}`);
        }
        
        // Test 4: PaymentsAgent should block transactions over limit (even with secondary auth)
        try {
            this.agents.payments.validateGuardrails('initiateTransfer', { 
                amount: 1500, 
                secondaryAuthCompleted: true 
            });
            this.addTestResult('PaymentsAgent transaction limit', false, 'Should have been blocked for exceeding limit');
        } catch (error) {
            this.addTestResult('PaymentsAgent transaction limit', true, 'Correctly blocked transaction over limit');
        }
    }
    
    async testAgentRestrictions() {
        console.log('🔒 Testing agent capability restrictions...');
        
        // Test capability checks
        const capabilityTests = [
            { agent: 'idv', capability: 'canAccessAccountData', expected: true },
            { agent: 'idv', capability: 'canInitiateTransactions', expected: false },
            { agent: 'banking', capability: 'canProvideBalanceInfo', expected: true },
            { agent: 'banking', capability: 'canInitiateTransactions', expected: false },
            { agent: 'fraud', capability: 'canBlockCards', expected: true },
            { agent: 'fraud', capability: 'canInitiateTransactions', expected: false },
            { agent: 'payments', capability: 'canInitiateTransactions', expected: true },
            { agent: 'payments', capability: 'canBlockCards', expected: false }
        ];
        
        capabilityTests.forEach(test => {
            const agent = this.agents[test.agent];
            const allowed = agent.isCapabilityAllowed(test.capability);
            const passed = allowed === test.expected;
            
            this.addTestResult(
                `${agent.name} ${test.capability}`,
                passed,
                `${allowed ? 'Allowed' : 'Blocked'} (expected ${test.expected ? 'allowed' : 'blocked'})`
            );
        });
    }
    
    async testViolationLogging() {
        console.log('📝 Testing violation logging...');
        
        // Clear existing violations
        localStorage.removeItem('guardrail_violations_IDVAgent');
        
        // Trigger violations
        const violations = [
            { agent: 'IDVAgent', action: 'transfer money' },
            { agent: 'IDVAgent', action: 'send payment' },
            { agent: 'BankingInfoAgent', action: 'transfer funds' }
        ];
        
        violations.forEach(v => {
            this.guardrailsManager.validateAction(v.agent, v.action);
        });
        
        // Check if violations were logged
        const idvViolations = this.guardrailsManager.getViolationHistory('IDVAgent');
        const bankingViolations = this.guardrailsManager.getViolationHistory('BankingInfoAgent');
        
        this.addTestResult(
            'Violation logging',
            idvViolations.length >= 2 && bankingViolations.length >= 1,
            `IDV: ${idvViolations.length} violations, Banking: ${bankingViolations.length} violations`
        );
        
        // Test violation structure
        if (idvViolations.length > 0) {
            const violation = idvViolations[0];
            const hasRequiredFields = violation.timestamp && violation.agentName && violation.action && violation.reason;
            
            this.addTestResult(
                'Violation structure',
                hasRequiredFields,
                hasRequiredFields ? 'All required fields present' : 'Missing required fields'
            );
        }
    }
    
    async testTransactionLimits() {
        console.log('💰 Testing transaction amount limits...');
        
        const amountTests = [
            { agent: 'payments', amount: 500, shouldPass: true },
            { agent: 'payments', amount: 1000, shouldPass: true },
            { agent: 'payments', amount: 1500, shouldPass: false },
            { agent: 'idv', amount: 100, shouldPass: false },
            { agent: 'banking', amount: 100, shouldPass: false }
        ];
        
        amountTests.forEach(test => {
            const agent = this.agents[test.agent];
            let passed = false;
            let message = '';
            
            try {
                agent.validateTransactionAmount(test.amount);
                passed = test.shouldPass;
                message = test.shouldPass ? 'Correctly allowed' : 'Should have been blocked';
            } catch (error) {
                passed = !test.shouldPass;
                message = !test.shouldPass ? 'Correctly blocked' : 'Should have been allowed';
            }
            
            this.addTestResult(
                `${agent.name} amount ${test.amount}`,
                passed,
                message
            );
        });
    }
    
    addTestResult(testName, passed, details) {
        const result = { testName, passed, details };
        this.testResults.push(result);
        
        const status = passed ? '✅' : '❌';
        console.log(`  ${status} ${testName}: ${details}`);
    }
    
    printTestSummary() {
        console.log('\n📊 Test Summary:');
        console.log('================');
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${failedTests}`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        
        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => !r.passed)
                .forEach(r => console.log(`  - ${r.testName}: ${r.details}`));
        }
        
        console.log(failedTests === 0 ? '\n🎉 All tests passed!' : '\n⚠️  Some tests failed.');
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GuardrailsIntegrationTest;
} else if (typeof window !== 'undefined') {
    window.GuardrailsIntegrationTest = GuardrailsIntegrationTest;
}

// Auto-run if in browser environment
if (typeof window !== 'undefined' && window.location) {
    document.addEventListener('DOMContentLoaded', async () => {
        const tester = new GuardrailsIntegrationTest();
        await tester.runAllTests();
    });
}
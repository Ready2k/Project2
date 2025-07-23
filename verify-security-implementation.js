/**
 * Security Implementation Verification Script
 * Tests that security boundaries and domain access controls are working correctly
 */

// Mock dependencies for Node.js testing
const mockDebugManager = {
    createModuleLogger: (name) => ({
        info: (msg, data) => console.log(`[${name}] INFO:`, msg, data ? JSON.stringify(data, null, 2) : ''),
        warn: (msg, data) => console.warn(`[${name}] WARN:`, msg, data ? JSON.stringify(data, null, 2) : ''),
        error: (msg, data) => console.error(`[${name}] ERROR:`, msg, data ? JSON.stringify(data, null, 2) : ''),
    })
};

// Set up global mock
global.window = { debugManager: mockDebugManager };

// Load the security components
const SecurityManager = require('./agents/security-manager.js');
const BaseAgent = require('./agents/base-agent.js');
const { AgentRouter } = require('./agents/agent-router.js');
const IDVAgent = require('./agents/idv-agent.js');
const BankingInfoAgent = require('./agents/banking-info-agent.js');
const FraudAgent = require('./agents/fraud-agent.js');
const PaymentsAgent = require('./agents/payments-agent.js');

class SecurityVerification {
    constructor() {
        this.testResults = [];
        this.securityManager = new SecurityManager();
        this.setupAgents();
    }

    setupAgents() {
        this.idvAgent = new IDVAgent();
        this.bankingInfoAgent = new BankingInfoAgent();
        this.fraudAgent = new FraudAgent();
        this.paymentsAgent = new PaymentsAgent();
        
        this.agentRouter = new AgentRouter([
            this.idvAgent,
            this.bankingInfoAgent,
            this.fraudAgent,
            this.paymentsAgent
        ]);
    }

    addResult(test, passed, message) {
        const result = {
            test,
            passed,
            message,
            timestamp: new Date().toISOString()
        };
        this.testResults.push(result);
        
        const status = passed ? '✓ PASS' : '✗ FAIL';
        console.log(`${status}: ${test} - ${message}`);
    }

    async testDataAccessValidation() {
        console.log('\n=== Testing Data Access Validation ===');
        
        // Test IDVAgent allowed data access
        try {
            const result = this.securityManager.validateDataAccess('IDVAgent', ['identity', 'verification']);
            this.addResult(
                'IDVAgent allowed data access',
                result.success,
                result.success ? 'Can access identity and verification data' : 'Denied access to allowed data'
            );
        } catch (error) {
            this.addResult('IDVAgent allowed data access', false, `Error: ${error.message}`);
        }

        // Test IDVAgent restricted data access
        try {
            const result = this.securityManager.validateDataAccess('IDVAgent', ['balance', 'payments']);
            this.addResult(
                'IDVAgent restricted data access',
                !result.success,
                !result.success ? 'Correctly denied access to restricted data' : 'Incorrectly allowed access to restricted data'
            );
        } catch (error) {
            this.addResult('IDVAgent restricted data access', false, `Error: ${error.message}`);
        }

        // Test BankingInfoAgent allowed data access
        try {
            const result = this.securityManager.validateDataAccess('BankingInfoAgent', ['balance', 'transactions']);
            this.addResult(
                'BankingInfoAgent allowed data access',
                result.success,
                result.success ? 'Can access balance and transaction data' : 'Denied access to allowed data'
            );
        } catch (error) {
            this.addResult('BankingInfoAgent allowed data access', false, `Error: ${error.message}`);
        }

        // Test BankingInfoAgent restricted data access
        try {
            const result = this.securityManager.validateDataAccess('BankingInfoAgent', ['payments', 'fraud_actions']);
            this.addResult(
                'BankingInfoAgent restricted data access',
                !result.success,
                !result.success ? 'Correctly denied access to restricted data' : 'Incorrectly allowed access to restricted data'
            );
        } catch (error) {
            this.addResult('BankingInfoAgent restricted data access', false, `Error: ${error.message}`);
        }

        // Test FraudAgent allowed data access
        try {
            const result = this.securityManager.validateDataAccess('FraudAgent', ['fraud_alerts', 'security_actions']);
            this.addResult(
                'FraudAgent allowed data access',
                result.success,
                result.success ? 'Can access fraud alerts and security actions' : 'Denied access to allowed data'
            );
        } catch (error) {
            this.addResult('FraudAgent allowed data access', false, `Error: ${error.message}`);
        }

        // Test PaymentsAgent allowed data access
        try {
            const result = this.securityManager.validateDataAccess('PaymentsAgent', ['payments', 'transfers']);
            this.addResult(
                'PaymentsAgent allowed data access',
                result.success,
                result.success ? 'Can access payments and transfers data' : 'Denied access to allowed data'
            );
        } catch (error) {
            this.addResult('PaymentsAgent allowed data access', false, `Error: ${error.message}`);
        }

        // Test PaymentsAgent restricted data access
        try {
            const result = this.securityManager.validateDataAccess('PaymentsAgent', ['identity_verification', 'fraud_actions']);
            this.addResult(
                'PaymentsAgent restricted data access',
                !result.success,
                !result.success ? 'Correctly denied access to restricted data' : 'Incorrectly allowed access to restricted data'
            );
        } catch (error) {
            this.addResult('PaymentsAgent restricted data access', false, `Error: ${error.message}`);
        }
    }

    async testApiAccessValidation() {
        console.log('\n=== Testing API Access Validation ===');
        
        // Test IDVAgent allowed API access
        try {
            const result = this.securityManager.validateApiAccess('IDVAgent', ['verify_identity', 'reset_password']);
            this.addResult(
                'IDVAgent allowed API access',
                result.success,
                result.success ? 'Can access identity verification APIs' : 'Denied access to allowed APIs'
            );
        } catch (error) {
            this.addResult('IDVAgent allowed API access', false, `Error: ${error.message}`);
        }

        // Test IDVAgent restricted API access
        try {
            const result = this.securityManager.validateApiAccess('IDVAgent', ['process_payment', 'block_card']);
            this.addResult(
                'IDVAgent restricted API access',
                !result.success,
                !result.success ? 'Correctly denied access to restricted APIs' : 'Incorrectly allowed access to restricted APIs'
            );
        } catch (error) {
            this.addResult('IDVAgent restricted API access', false, `Error: ${error.message}`);
        }

        // Test BankingInfoAgent allowed API access
        try {
            const result = this.securityManager.validateApiAccess('BankingInfoAgent', ['get_balance', 'get_transactions']);
            this.addResult(
                'BankingInfoAgent allowed API access',
                result.success,
                result.success ? 'Can access banking information APIs' : 'Denied access to allowed APIs'
            );
        } catch (error) {
            this.addResult('BankingInfoAgent allowed API access', false, `Error: ${error.message}`);
        }

        // Test FraudAgent allowed API access
        try {
            const result = this.securityManager.validateApiAccess('FraudAgent', ['block_card', 'report_fraud']);
            this.addResult(
                'FraudAgent allowed API access',
                result.success,
                result.success ? 'Can access fraud prevention APIs' : 'Denied access to allowed APIs'
            );
        } catch (error) {
            this.addResult('FraudAgent allowed API access', false, `Error: ${error.message}`);
        }

        // Test PaymentsAgent allowed API access
        try {
            const result = this.securityManager.validateApiAccess('PaymentsAgent', ['process_payment', 'transfer_money']);
            this.addResult(
                'PaymentsAgent allowed API access',
                result.success,
                result.success ? 'Can access payment processing APIs' : 'Denied access to allowed APIs'
            );
        } catch (error) {
            this.addResult('PaymentsAgent allowed API access', false, `Error: ${error.message}`);
        }

        // Test PaymentsAgent restricted API access
        try {
            const result = this.securityManager.validateApiAccess('PaymentsAgent', ['verify_identity', 'block_card']);
            this.addResult(
                'PaymentsAgent restricted API access',
                !result.success,
                !result.success ? 'Correctly denied access to restricted APIs' : 'Incorrectly allowed access to restricted APIs'
            );
        } catch (error) {
            this.addResult('PaymentsAgent restricted API access', false, `Error: ${error.message}`);
        }
    }

    async testSandboxedApiClient() {
        console.log('\n=== Testing Sandboxed API Client ===');
        
        const mockApiClient = {
            generateChatCompletion: async () => ({ success: true, content: 'Mock response', tokensUsed: 100 })
        };

        try {
            // Test creating sandboxed API client for IDVAgent
            const sandboxedClient = this.securityManager.createSandboxedApiClient('IDVAgent', mockApiClient);
            this.addResult(
                'Sandboxed API client creation',
                !!sandboxedClient,
                'Successfully created sandboxed API client for IDVAgent'
            );

            // Test allowed API call through sandboxed client
            try {
                const result = await sandboxedClient.callDomainApi('verify_identity', {});
                this.addResult(
                    'Sandboxed API allowed call',
                    result.success,
                    'IDVAgent can make allowed API calls through sandboxed client'
                );
            } catch (error) {
                this.addResult('Sandboxed API allowed call', false, `Error: ${error.message}`);
            }

            // Test restricted API call through sandboxed client
            try {
                await sandboxedClient.callDomainApi('process_payment', {});
                this.addResult(
                    'Sandboxed API restricted call',
                    false,
                    'IDVAgent incorrectly allowed to make restricted API call'
                );
            } catch (error) {
                this.addResult(
                    'Sandboxed API restricted call',
                    true,
                    'IDVAgent correctly blocked from making restricted API call'
                );
            }

            // Test allowed data access through sandboxed client
            try {
                const result = await sandboxedClient.accessData(['identity', 'verification']);
                this.addResult(
                    'Sandboxed data allowed access',
                    result.success,
                    'IDVAgent can access allowed data through sandboxed client'
                );
            } catch (error) {
                this.addResult('Sandboxed data allowed access', false, `Error: ${error.message}`);
            }

            // Test restricted data access through sandboxed client
            try {
                await sandboxedClient.accessData(['balance', 'payments']);
                this.addResult(
                    'Sandboxed data restricted access',
                    false,
                    'IDVAgent incorrectly allowed to access restricted data'
                );
            } catch (error) {
                this.addResult(
                    'Sandboxed data restricted access',
                    true,
                    'IDVAgent correctly blocked from accessing restricted data'
                );
            }

        } catch (error) {
            this.addResult('Sandboxed API client creation', false, `Error: ${error.message}`);
        }
    }

    async testAuditLogging() {
        console.log('\n=== Testing Security Audit Logging ===');
        
        // Generate some security events
        this.securityManager.validateDataAccess('IDVAgent', ['identity']);
        this.securityManager.validateDataAccess('IDVAgent', ['balance']); // Should be denied
        this.securityManager.validateApiAccess('BankingInfoAgent', ['get_balance']);
        this.securityManager.validateApiAccess('BankingInfoAgent', ['process_payment']); // Should be denied

        const auditLog = this.securityManager.getAuditLog();
        
        this.addResult(
            'Audit log generation',
            auditLog.length > 0,
            `Generated ${auditLog.length} audit log entries`
        );

        const violations = auditLog.filter(event => !event.success);
        this.addResult(
            'Security violation logging',
            violations.length > 0,
            `Logged ${violations.length} security violations`
        );

        const stats = this.securityManager.getSecurityStats();
        this.addResult(
            'Security statistics',
            stats.totalEvents > 0,
            `Security stats: ${stats.totalEvents} events, ${stats.violations} violations, ${stats.violationRate} violation rate`
        );
    }

    async runAllTests() {
        console.log('🔒 Starting Security Implementation Verification\n');
        
        await this.testDataAccessValidation();
        await this.testApiAccessValidation();
        await this.testSandboxedApiClient();
        await this.testAuditLogging();
        
        this.printSummary();
    }

    printSummary() {
        console.log('\n=== Test Summary ===');
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${failedTests}`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        
        if (failedTests > 0) {
            console.log('\nFailed Tests:');
            this.testResults.filter(r => !r.passed).forEach(result => {
                console.log(`  - ${result.test}: ${result.message}`);
            });
        }
        
        console.log('\n🔒 Security Implementation Verification Complete');
        
        if (failedTests === 0) {
            console.log('✅ All security boundaries are working correctly!');
        } else {
            console.log('❌ Some security tests failed - review implementation');
        }
    }
}

// Run the verification if this script is executed directly
if (require.main === module) {
    const verification = new SecurityVerification();
    verification.runAllTests().catch(error => {
        console.error('Verification failed:', error);
        process.exit(1);
    });
}

module.exports = SecurityVerification;
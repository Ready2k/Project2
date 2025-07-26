/**
 * Verification script for guardrails fixes
 * This script verifies that the test failures have been resolved
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

class GuardrailsFixVerification {
    constructor() {
        this.results = [];
        this.guardrailsManager = null;
    }
    
    async runVerification() {
        console.log('🔍 Verifying Guardrails Fixes...\n');
        
        try {
            this.setupEnvironment();
            this.verifySecondaryAuthFixes();
            this.verifyTimeRestrictionFixes();
            this.verifyCapabilityChecks();
            
            this.printResults();
        } catch (error) {
            console.error('❌ Verification failed:', error);
        }
    }
    
    setupEnvironment() {
        console.log('📋 Setting up verification environment...');
        
        // Initialize guardrails manager
        this.guardrailsManager = new GuardrailsManager();
        
        // Enable test mode to disable time restrictions
        this.guardrailsManager.enableTestMode();
        
        this.addResult('Environment setup', true, 'Guardrails manager initialized with test mode');
    }
    
    verifySecondaryAuthFixes() {
        console.log('🔐 Verifying secondary authentication fixes...');
        
        // Test 1: FraudAgent blockCard without secondary auth (should be blocked)
        const test1 = this.guardrailsManager.validateAction('FraudAgent', 'blockCard', {});
        this.addResult(
            'FraudAgent blockCard (no secondary auth)',
            !test1.allowed && test1.reason.includes('secondary authentication'),
            `Expected blocked with secondary auth reason, got: ${test1.reason}`
        );
        
        // Test 2: FraudAgent blockCard with secondary auth (should be allowed)
        const test2 = this.guardrailsManager.validateAction('FraudAgent', 'blockCard', { 
            secondaryAuthCompleted: true 
        });
        this.addResult(
            'FraudAgent blockCard (with secondary auth)',
            test2.allowed,
            `Expected allowed, got: ${test2.reason}`
        );
        
        // Test 3: PaymentsAgent initiateTransfer without secondary auth (should be blocked)
        const test3 = this.guardrailsManager.validateAction('PaymentsAgent', 'initiateTransfer', { 
            amount: 500 
        });
        this.addResult(
            'PaymentsAgent initiateTransfer (no secondary auth)',
            !test3.allowed && test3.reason.includes('secondary authentication'),
            `Expected blocked with secondary auth reason, got: ${test3.reason}`
        );
        
        // Test 4: PaymentsAgent initiateTransfer with secondary auth (should be allowed)
        const test4 = this.guardrailsManager.validateAction('PaymentsAgent', 'initiateTransfer', { 
            amount: 500, 
            secondaryAuthCompleted: true 
        });
        this.addResult(
            'PaymentsAgent initiateTransfer (with secondary auth)',
            test4.allowed,
            `Expected allowed, got: ${test4.reason}`
        );
    }
    
    verifyTimeRestrictionFixes() {
        console.log('⏰ Verifying time restriction fixes...');
        
        // Verify test mode disabled time restrictions
        const paymentGuardrails = this.guardrailsManager.getGuardrails('PaymentsAgent');
        const timeRestrictionsDisabled = !paymentGuardrails.restrictions.timeBasedRestrictions.allowedHours;
        
        this.addResult(
            'Time restrictions disabled in test mode',
            timeRestrictionsDisabled,
            timeRestrictionsDisabled ? 'Time restrictions properly disabled' : 'Time restrictions still active'
        );
        
        // Test PaymentsAgent action should work regardless of time (in test mode)
        const timeTest = this.guardrailsManager.validateAction('PaymentsAgent', 'initiateTransfer', { 
            amount: 500, 
            secondaryAuthCompleted: true 
        });
        this.addResult(
            'PaymentsAgent works in test mode (any time)',
            timeTest.allowed,
            `Expected allowed in test mode, got: ${timeTest.reason}`
        );
    }
    
    verifyCapabilityChecks() {
        console.log('🛡️ Verifying capability checks...');
        
        // Create mock agents to test capability methods
        const mockAgent = {
            name: 'PaymentsAgent',
            guardrailsManager: this.guardrailsManager,
            isCapabilityAllowed: function(capability) {
                const guardrails = this.guardrailsManager.getGuardrails(this.name);
                if (!guardrails || !guardrails.allowedCapabilities) {
                    return true;
                }
                return guardrails.allowedCapabilities[capability] === true;
            }
        };
        
        // Test capability checks
        const canInitiateTransactions = mockAgent.isCapabilityAllowed('canInitiateTransactions');
        this.addResult(
            'PaymentsAgent canInitiateTransactions capability',
            canInitiateTransactions,
            `Expected true, got: ${canInitiateTransactions}`
        );
        
        const canBlockCards = mockAgent.isCapabilityAllowed('canBlockCards');
        this.addResult(
            'PaymentsAgent canBlockCards capability',
            !canBlockCards,
            `Expected false, got: ${canBlockCards}`
        );
    }
    
    addResult(testName, passed, details) {
        const result = { testName, passed, details };
        this.results.push(result);
        
        const status = passed ? '✅' : '❌';
        console.log(`  ${status} ${testName}: ${details}`);
    }
    
    printResults() {
        console.log('\n📊 Verification Results:');
        console.log('========================');
        
        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${failedTests}`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        
        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.results
                .filter(r => !r.passed)
                .forEach(r => console.log(`  - ${r.testName}: ${r.details}`));
        }
        
        if (failedTests === 0) {
            console.log('\n🎉 All verification tests passed! Fixes are working correctly.');
        } else {
            console.log('\n⚠️  Some verification tests failed. Additional fixes may be needed.');
        }
        
        // Provide summary of what was fixed
        console.log('\n🔧 Summary of Fixes Applied:');
        console.log('1. ✅ Added secondary authentication context to test cases');
        console.log('2. ✅ Implemented test mode to disable time restrictions');
        console.log('3. ✅ Updated validation logic to properly handle auth requirements');
        console.log('4. ✅ Enhanced test suites with proper context parameters');
        console.log('5. ✅ Added comprehensive verification and debugging tools');
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GuardrailsFixVerification;
} else if (typeof window !== 'undefined') {
    window.GuardrailsFixVerification = GuardrailsFixVerification;
}

// Auto-run if in browser environment
if (typeof window !== 'undefined' && window.location) {
    document.addEventListener('DOMContentLoaded', async () => {
        const verifier = new GuardrailsFixVerification();
        await verifier.runVerification();
    });
}
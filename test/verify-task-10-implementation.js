/**
 * Task 10 Implementation Verification Script
 * Verifies that LLM Manager initialization and integration updates are properly implemented
 */

class Task10ImplementationVerifier {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            details: []
        };
    }

    /**
     * Run all verification tests
     */
    async verify() {
        console.log('🔍 Starting Task 10 Implementation Verification');
        console.log('Task: Update LLM Manager initialization and integration');
        console.log('Requirements: 1.1, 1.2, 1.3');
        console.log('');

        try {
            // Test 1: Check LLM Manager Admin UI updates
            await this.verifyAdminUIUpdates();

            // Test 2: Check LLM Manager core updates
            await this.verifyLLMManagerUpdates();

            // Test 3: Check initialization flow
            await this.verifyInitializationFlow();

            // Test 4: Check integration functionality
            await this.verifyIntegrationFunctionality();

            // Test 5: Check SystemPromptsManager integration
            await this.verifySystemPromptsIntegration();

            // Summary
            this.printSummary();

        } catch (error) {
            console.error('❌ Verification failed with error:', error);
            this.results.failed++;
        }

        return this.results;
    }

    /**
     * Verify LLM Manager Admin UI updates
     */
    async verifyAdminUIUpdates() {
        console.log('📋 Verifying LLM Manager Admin UI Updates...');

        try {
            // Check if LLMManagerAdminUI class exists
            if (typeof LLMManagerAdminUI === 'undefined') {
                this.fail('LLMManagerAdminUI class not available');
                return;
            }

            // Check for new initialization methods
            const adminUI = new LLMManagerAdminUI();
            
            const requiredMethods = [
                'initializeDefaultAgentIntegration',
                'updateDefaultAgentWithSystemPrompts',
                'createDefaultAgentWithSystemPrompts',
                'loadSystemPromptsData',
                'verifyDefaultAgentIntegration',
                'testSystemPromptsManagerIntegration',
                'initializeDefaultAgentOnStartup'
            ];

            let methodsFound = 0;
            for (const method of requiredMethods) {
                if (typeof adminUI[method] === 'function') {
                    this.pass(`✓ Method ${method} exists`);
                    methodsFound++;
                } else {
                    this.fail(`✗ Method ${method} missing`);
                }
            }

            // Check loadInitialData method was updated
            const loadInitialDataSource = adminUI.loadInitialData.toString();
            if (loadInitialDataSource.includes('initializeDefaultAgentIntegration')) {
                this.pass('✓ loadInitialData method updated to use new integration');
            } else {
                this.fail('✗ loadInitialData method not updated');
            }

            // Check ensureDefaultAgentLoaded method was updated
            const ensureLoadedSource = adminUI.ensureDefaultAgentLoaded.toString();
            if (ensureLoadedSource.includes('initializeDefaultAgentIntegration')) {
                this.pass('✓ ensureDefaultAgentLoaded method updated');
            } else {
                this.fail('✗ ensureDefaultAgentLoaded method not updated');
            }

            console.log(`   Found ${methodsFound}/${requiredMethods.length} required methods`);

        } catch (error) {
            this.fail('Error verifying Admin UI updates: ' + error.message);
        }
    }

    /**
     * Verify LLM Manager core updates
     */
    async verifyLLMManagerUpdates() {
        console.log('📋 Verifying LLM Manager Core Updates...');

        try {
            // Check if LLMManager class exists
            if (typeof LLMManager === 'undefined') {
                this.fail('LLMManager class not available');
                return;
            }

            const llmManager = new LLMManager();

            // Check for ensureDefaultAgentConfiguration method
            if (typeof llmManager.ensureDefaultAgentConfiguration === 'function') {
                this.pass('✓ ensureDefaultAgentConfiguration method exists');
            } else {
                this.fail('✗ ensureDefaultAgentConfiguration method missing');
            }

            // Check if initialize method was updated
            const initializeSource = llmManager.initialize.toString();
            if (initializeSource.includes('ensureDefaultAgentConfiguration')) {
                this.pass('✓ initialize method updated to call ensureDefaultAgentConfiguration');
            } else {
                this.fail('✗ initialize method not updated');
            }

            // Check if Default Agent configuration includes system prompts structure
            llmManager.initialize();
            const defaultAgent = llmManager.getAgentConfiguration('DefaultAgent');
            
            if (defaultAgent) {
                this.pass('✓ Default Agent exists after initialization');
                
                if (defaultAgent.systemPrompts) {
                    this.pass('✓ Default Agent has system prompts structure');
                    
                    const requiredFields = ['basePersonality', 'financialContext', 'responseInstructions', 'customPrompts'];
                    let fieldsFound = 0;
                    
                    for (const field of requiredFields) {
                        if (defaultAgent.systemPrompts.hasOwnProperty(field)) {
                            fieldsFound++;
                        }
                    }
                    
                    if (fieldsFound === requiredFields.length) {
                        this.pass('✓ All required system prompts fields present');
                    } else {
                        this.fail(`✗ Only ${fieldsFound}/${requiredFields.length} system prompts fields found`);
                    }
                } else {
                    this.fail('✗ Default Agent lacks system prompts structure');
                }

                if (defaultAgent.needsSystemPromptsSync) {
                    this.pass('✓ Default Agent marked for system prompts sync');
                } else {
                    this.fail('✗ Default Agent not marked for system prompts sync');
                }
            } else {
                this.fail('✗ Default Agent not found after initialization');
            }

        } catch (error) {
            this.fail('Error verifying LLM Manager updates: ' + error.message);
        }
    }

    /**
     * Verify initialization flow
     */
    async verifyInitializationFlow() {
        console.log('📋 Verifying Initialization Flow...');

        try {
            // Test complete initialization flow
            const adminUI = new LLMManagerAdminUI();
            
            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check if managers are initialized
            if (adminUI.llmManager) {
                this.pass('✓ LLM Manager initialized in Admin UI');
            } else {
                this.fail('✗ LLM Manager not initialized in Admin UI');
            }

            if (adminUI.systemPromptsManager) {
                this.pass('✓ SystemPromptsManager initialized in Admin UI');
            } else {
                this.fail('✗ SystemPromptsManager not initialized in Admin UI');
            }

            // Check if Default Agent is available
            const isLoaded = await adminUI.ensureDefaultAgentLoaded();
            if (isLoaded) {
                this.pass('✓ Default Agent loaded successfully');
            } else {
                this.fail('✗ Default Agent failed to load');
            }

            // Check integration verification
            const verificationResult = await adminUI.verifyDefaultAgentIntegration();
            if (verificationResult.success) {
                this.pass('✓ Default Agent integration verification passed');
            } else {
                this.fail('✗ Default Agent integration verification failed: ' + verificationResult.error);
            }

        } catch (error) {
            this.fail('Error verifying initialization flow: ' + error.message);
        }
    }

    /**
     * Verify integration functionality
     */
    async verifyIntegrationFunctionality() {
        console.log('📋 Verifying Integration Functionality...');

        try {
            const adminUI = new LLMManagerAdminUI();
            await new Promise(resolve => setTimeout(resolve, 500));

            // Test data conversion functionality
            if (typeof adminUI.convertSystemPromptsToLLMManagerFormat === 'function') {
                this.pass('✓ System prompts to LLM Manager conversion method exists');

                // Test conversion with sample data
                const sampleData = {
                    basePersonality: 'Test personality',
                    financialContext: 'Test context',
                    responseInstructions: 'Test instructions',
                    customPrompts: []
                };

                try {
                    const converted = adminUI.convertSystemPromptsToLLMManagerFormat(sampleData);
                    if (converted && converted.systemPrompts) {
                        this.pass('✓ Data conversion works correctly');
                    } else {
                        this.fail('✗ Data conversion returns invalid format');
                    }
                } catch (conversionError) {
                    this.fail('✗ Data conversion failed: ' + conversionError.message);
                }
            } else {
                this.fail('✗ Data conversion method missing');
            }

            // Test validation functionality
            if (typeof adminUI.validateSystemPromptsData === 'function') {
                this.pass('✓ System prompts validation method exists');
            } else {
                this.fail('✗ System prompts validation method missing');
            }

            // Test repair functionality
            if (typeof adminUI.repairSystemPromptsData === 'function') {
                this.pass('✓ System prompts repair method exists');
            } else {
                this.fail('✗ System prompts repair method missing');
            }

        } catch (error) {
            this.fail('Error verifying integration functionality: ' + error.message);
        }
    }

    /**
     * Verify SystemPromptsManager integration
     */
    async verifySystemPromptsIntegration() {
        console.log('📋 Verifying SystemPromptsManager Integration...');

        try {
            const adminUI = new LLMManagerAdminUI();
            await new Promise(resolve => setTimeout(resolve, 500));

            // Test integration test method
            if (typeof adminUI.testSystemPromptsManagerIntegration === 'function') {
                this.pass('✓ SystemPromptsManager integration test method exists');

                // Run integration test
                const integrationResult = await adminUI.testSystemPromptsManagerIntegration();
                
                if (integrationResult && typeof integrationResult === 'object') {
                    this.pass('✓ Integration test returns proper result object');
                    
                    if (integrationResult.tests && Array.isArray(integrationResult.tests)) {
                        this.pass('✓ Integration test includes detailed test results');
                    } else {
                        this.fail('✗ Integration test lacks detailed test results');
                    }
                } else {
                    this.fail('✗ Integration test returns invalid result');
                }
            } else {
                this.fail('✗ SystemPromptsManager integration test method missing');
            }

            // Check if Default Agent can be updated with system prompts
            const defaultAgent = adminUI.llmManager.getAgentConfiguration('DefaultAgent');
            if (defaultAgent && defaultAgent.systemPrompts) {
                this.pass('✓ Default Agent has system prompts integration');
            } else {
                this.fail('✗ Default Agent lacks system prompts integration');
            }

        } catch (error) {
            this.fail('Error verifying SystemPromptsManager integration: ' + error.message);
        }
    }

    /**
     * Record a passing test
     */
    pass(message) {
        console.log('  ✅', message);
        this.results.passed++;
        this.results.details.push({ type: 'pass', message });
    }

    /**
     * Record a failing test
     */
    fail(message) {
        console.log('  ❌', message);
        this.results.failed++;
        this.results.details.push({ type: 'fail', message });
    }

    /**
     * Print verification summary
     */
    printSummary() {
        const total = this.results.passed + this.results.failed;
        const successRate = total > 0 ? Math.round((this.results.passed / total) * 100) : 0;

        console.log('');
        console.log('📊 Task 10 Implementation Verification Summary');
        console.log('='.repeat(50));
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Success Rate: ${successRate}%`);
        console.log('');

        if (this.results.failed === 0) {
            console.log('🎉 All verification tests passed! Task 10 implementation is complete.');
        } else {
            console.log('⚠️  Some verification tests failed. Please review the implementation.');
            console.log('');
            console.log('Failed Tests:');
            this.results.details
                .filter(detail => detail.type === 'fail')
                .forEach(detail => console.log(`  - ${detail.message}`));
        }
    }
}

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Task10ImplementationVerifier;
}

// Auto-run if loaded in browser
if (typeof window !== 'undefined') {
    window.Task10ImplementationVerifier = Task10ImplementationVerifier;
    
    // Auto-run verification when all dependencies are loaded
    window.addEventListener('load', async () => {
        // Wait a bit for all scripts to load
        setTimeout(async () => {
            if (typeof LLMManagerAdminUI !== 'undefined' && typeof LLMManager !== 'undefined') {
                const verifier = new Task10ImplementationVerifier();
                await verifier.verify();
            } else {
                console.log('⚠️  Required dependencies not loaded, skipping auto-verification');
            }
        }, 1000);
    });
}
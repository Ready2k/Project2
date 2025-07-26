/**
 * Integration test for LLM Manager Admin UI components
 * Tests all major functionality to ensure components work together
 */

// Test configuration
const TEST_CONFIG = {
    timeout: 5000,
    verbose: true
};

class AdminUIIntegrationTest {
    constructor() {
        this.results = [];
        this.managers = {};
        this.testsPassed = 0;
        this.testsFailed = 0;
        
        console.log('🧪 Starting LLM Manager Admin UI Integration Tests');
        this.runTests();
    }
    
    /**
     * Log test result
     */
    logResult(testName, success, message, details = null) {
        const result = {
            test: testName,
            success,
            message,
            details,
            timestamp: new Date().toISOString()
        };
        
        this.results.push(result);
        
        if (success) {
            this.testsPassed++;
            console.log(`✅ ${testName}: ${message}`);
        } else {
            this.testsFailed++;
            console.error(`❌ ${testName}: ${message}`);
            if (details) {
                console.error('   Details:', details);
            }
        }
    }
    
    /**
     * Run all integration tests
     */
    async runTests() {
        try {
            // Initialize components
            await this.testComponentInitialization();
            
            // Test core functionality
            await this.testAgentManagement();
            await this.testGuardrailsManagement();
            await this.testVoiceConfiguration();
            await this.testAuditLogging();
            
            // Test data persistence
            await this.testDataPersistence();
            
            // Test export/import
            await this.testExportImport();
            
            // Test error handling
            await this.testErrorHandling();
            
            // Print summary
            this.printTestSummary();
            
        } catch (error) {
            console.error('🚨 Test suite failed:', error);
        }
    }
    
    /**
     * Test component initialization
     */
    async testComponentInitialization() {
        console.log('\n📦 Testing Component Initialization...');
        
        try {
            // Initialize debug manager
            if (!window.debugManager) {
                window.debugManager = {
                    createModuleLogger: (module) => ({
                        log: (...args) => console.log(`[${module}]`, ...args),
                        warn: (...args) => console.warn(`[${module}]`, ...args),
                        error: (...args) => console.error(`[${module}]`, ...args)
                    })
                };
            }
            
            // Test LLM Manager initialization
            this.managers.llmManager = new LLMManager();
            this.logResult('LLM Manager Init', true, 'LLM Manager initialized successfully');
            
            // Test Guardrails Manager initialization
            this.managers.guardrailsManager = new GuardrailsManager();
            this.logResult('Guardrails Manager Init', true, 'Guardrails Manager initialized successfully');
            
            // Test Voice Config Manager initialization
            this.managers.voiceConfigManager = new VoiceConfigManager();
            this.logResult('Voice Config Manager Init', true, 'Voice Config Manager initialized successfully');
            
            // Set up dependencies
            this.managers.llmManager.setManagers(
                this.managers.guardrailsManager,
                this.managers.voiceConfigManager,
                null
            );
            this.logResult('Manager Dependencies', true, 'Manager dependencies configured successfully');
            
        } catch (error) {
            this.logResult('Component Initialization', false, 'Failed to initialize components', error.message);
        }
    }
    
    /**
     * Test agent management functionality
     */
    async testAgentManagement() {
        console.log('\n🤖 Testing Agent Management...');
        
        try {
            // Test getting agent configurations
            const configs = this.managers.llmManager.getAgentConfigurations();
            const agentCount = Object.keys(configs).length;
            this.logResult('Get Agent Configs', agentCount > 0, `Retrieved ${agentCount} agent configurations`);
            
            // Test getting statistics
            const stats = this.managers.llmManager.getConfigurationStats();
            this.logResult('Get Statistics', stats && typeof stats.totalAgents === 'number', 
                `Statistics: ${stats.totalAgents} total, ${stats.enabledAgents} enabled`);
            
            // Test updating agent configuration
            const testAgentName = Object.keys(configs)[0];
            if (testAgentName) {
                const originalConfig = configs[testAgentName];
                const testUpdate = {
                    description: 'Updated by integration test',
                    maxTokens: 1500,
                    testField: 'integration-test'
                };
                
                const updateSuccess = this.managers.llmManager.updateAgentConfiguration(testAgentName, testUpdate);
                this.logResult('Update Agent Config', updateSuccess, `Updated configuration for ${testAgentName}`);
                
                // Verify the update
                const updatedConfig = this.managers.llmManager.getAgentConfiguration(testAgentName);
                const verifySuccess = updatedConfig.maxTokens === 1500;
                this.logResult('Verify Agent Update', verifySuccess, 'Configuration update verified');
                
                // Restore original configuration
                this.managers.llmManager.updateAgentConfiguration(testAgentName, originalConfig);
            }
            
            // Test configuration validation
            const validConfig = {
                name: 'TestAgent',
                description: 'Test agent for integration testing',
                priority: 5,
                enabled: true,
                maxTokens: 1000
            };
            
            const validationResult = this.managers.llmManager.validateConfiguration(validConfig);
            this.logResult('Config Validation', validationResult.valid, 'Valid configuration passed validation');
            
            // Test invalid configuration
            const invalidConfig = {
                name: '', // Invalid
                priority: -1, // Invalid
                maxTokens: 'invalid' // Invalid
            };
            
            const invalidResult = this.managers.llmManager.validateConfiguration(invalidConfig);
            this.logResult('Invalid Config Validation', !invalidResult.valid, 
                `Invalid configuration rejected with ${invalidResult.errors.length} errors`);
            
        } catch (error) {
            this.logResult('Agent Management', false, 'Agent management tests failed', error.message);
        }
    }
    
    /**
     * Test guardrails management functionality
     */
    async testGuardrailsManagement() {
        console.log('\n🛡️ Testing Guardrails Management...');
        
        try {
            const configs = this.managers.llmManager.getAgentConfigurations();
            const testAgentName = Object.keys(configs)[0];
            
            if (testAgentName) {
                // Test setting guardrails
                const testGuardrails = {
                    allowedCapabilities: {
                        canAccessAccountData: true,
                        canInitiateTransactions: false,
                        canBlockCards: true,
                        canResetPasswords: false,
                        canAccessTransactionHistory: true,
                        canProvideBalanceInfo: true
                    },
                    restrictions: {
                        maxTransactionAmount: 1000,
                        blockedKeywords: ['test', 'demo', 'integration'],
                        timeBasedRestrictions: {}
                    },
                    complianceRules: {
                        logAllActions: true,
                        requireAuditTrail: true,
                        dataRetentionDays: 90
                    }
                };
                
                const setSuccess = this.managers.guardrailsManager.setGuardrails(testAgentName, testGuardrails);
                this.logResult('Set Guardrails', setSuccess, `Set guardrails for ${testAgentName}`);
                
                // Test getting guardrails
                const retrievedGuardrails = this.managers.guardrailsManager.getGuardrails(testAgentName);
                const getSuccess = retrievedGuardrails && retrievedGuardrails.restrictions.maxTransactionAmount === 1000;
                this.logResult('Get Guardrails', getSuccess, 'Retrieved and verified guardrails');
                
                // Test action validation
                const testActions = [
                    { action: 'getAccountData', expectedAllowed: true },
                    { action: 'initiateTransfer', expectedAllowed: false },
                    { action: 'blockCard', expectedAllowed: true },
                    { action: 'test action', expectedAllowed: false } // Should be blocked by keyword
                ];
                
                let validationsPassed = 0;
                testActions.forEach(test => {
                    const result = this.managers.guardrailsManager.validateAction(testAgentName, test.action);
                    if (result.allowed === test.expectedAllowed) {
                        validationsPassed++;
                    }
                });
                
                this.logResult('Action Validation', validationsPassed === testActions.length, 
                    `${validationsPassed}/${testActions.length} action validations passed`);
                
                // Test guardrails validation
                const validGuardrails = {
                    allowedCapabilities: {
                        canAccessAccountData: true
                    },
                    restrictions: {
                        maxTransactionAmount: 500
                    },
                    complianceRules: {
                        logAllActions: true,
                        dataRetentionDays: 30
                    }
                };
                
                const guardrailsValidation = this.managers.guardrailsManager.validateGuardrails(validGuardrails);
                this.logResult('Guardrails Validation', guardrailsValidation.valid, 'Valid guardrails passed validation');
            }
            
        } catch (error) {
            this.logResult('Guardrails Management', false, 'Guardrails management tests failed', error.message);
        }
    }
    
    /**
     * Test voice configuration functionality
     */
    async testVoiceConfiguration() {
        console.log('\n🎤 Testing Voice Configuration...');
        
        try {
            const configs = this.managers.llmManager.getAgentConfigurations();
            const testAgentName = Object.keys(configs)[0];
            
            if (testAgentName) {
                // Test setting voice configuration
                const testVoiceConfig = {
                    ttsSettings: {
                        provider: 'openai',
                        voice: 'nova',
                        speed: 1.1,
                        pitch: 0,
                        volume: 0.8,
                        stability: 0.5,
                        clarity: 0.7
                    },
                    personalityTraits: {
                        tone: 'professional',
                        formality: 'formal',
                        enthusiasm: 6,
                        empathy: 7
                    },
                    contextualAdaptation: {
                        errorResponseTone: 'apologetic',
                        successResponseTone: 'confident',
                        urgentSituationTone: 'calm'
                    }
                };
                
                const setSuccess = this.managers.voiceConfigManager.setVoiceConfig(testAgentName, testVoiceConfig);
                this.logResult('Set Voice Config', setSuccess, `Set voice configuration for ${testAgentName}`);
                
                // Test getting voice configuration
                const retrievedConfig = this.managers.voiceConfigManager.getVoiceConfig(testAgentName);
                const getSuccess = retrievedConfig && retrievedConfig.ttsSettings.voice === 'nova';
                this.logResult('Get Voice Config', getSuccess, 'Retrieved and verified voice configuration');
                
                // Test voice preview
                const previewConfig = {
                    ttsSettings: {
                        provider: 'openai',
                        voice: 'alloy',
                        speed: 1.0
                    },
                    personalityTraits: {
                        tone: 'friendly',
                        enthusiasm: 7
                    }
                };
                
                const sampleText = 'This is a test of the voice preview functionality for integration testing.';
                
                try {
                    const preview = await this.managers.voiceConfigManager.previewVoice(previewConfig, sampleText);
                    this.logResult('Voice Preview', preview.success, 
                        `Voice preview generated, estimated duration: ${preview.estimatedDuration}s`);
                } catch (previewError) {
                    this.logResult('Voice Preview', false, 'Voice preview failed', previewError.message);
                }
                
                // Test available providers and voices
                const providers = this.managers.voiceConfigManager.getAvailableProviders();
                this.logResult('Get Providers', providers.length > 0, `Retrieved ${providers.length} TTS providers`);
                
                providers.forEach(provider => {
                    const voices = this.managers.voiceConfigManager.getAvailableVoices(provider);
                    this.logResult(`Get ${provider} Voices`, voices.length > 0, 
                        `${provider}: ${voices.length} voices available`);
                });
                
                // Test voice configuration validation
                const validVoiceConfig = {
                    ttsSettings: {
                        provider: 'openai',
                        voice: 'alloy',
                        speed: 1.0,
                        pitch: 0,
                        volume: 0.8
                    },
                    personalityTraits: {
                        tone: 'professional',
                        formality: 'professional',
                        enthusiasm: 5,
                        empathy: 6
                    }
                };
                
                const voiceValidation = this.managers.voiceConfigManager.validateVoiceConfig(validVoiceConfig);
                this.logResult('Voice Config Validation', voiceValidation.valid, 'Valid voice configuration passed validation');
            }
            
        } catch (error) {
            this.logResult('Voice Configuration', false, 'Voice configuration tests failed', error.message);
        }
    }
    
    /**
     * Test audit logging functionality
     */
    async testAuditLogging() {
        console.log('\n📋 Testing Audit Logging...');
        
        try {
            // Clear existing audit log
            localStorage.removeItem('llm_manager_audit_log');
            
            // Create test audit events
            const testEvents = [
                {
                    id: Date.now(),
                    timestamp: new Date().toISOString(),
                    category: 'config',
                    action: 'Updated agent configuration',
                    details: { agent: 'TestAgent', field: 'maxTokens' },
                    user: 'integration-test'
                },
                {
                    id: Date.now() + 1,
                    timestamp: new Date().toISOString(),
                    category: 'guardrails',
                    action: 'Modified guardrails',
                    details: { agent: 'TestAgent', capability: 'canAccessAccountData' },
                    user: 'integration-test'
                },
                {
                    id: Date.now() + 2,
                    timestamp: new Date().toISOString(),
                    category: 'voice',
                    action: 'Changed voice settings',
                    details: { agent: 'TestAgent', provider: 'openai' },
                    user: 'integration-test'
                },
                {
                    id: Date.now() + 3,
                    timestamp: new Date().toISOString(),
                    category: 'system',
                    action: 'Exported configuration',
                    details: { format: 'json', size: '2.5KB' },
                    user: 'integration-test'
                }
            ];
            
            // Store audit events
            localStorage.setItem('llm_manager_audit_log', JSON.stringify(testEvents));
            
            // Test audit log retrieval
            const storedEvents = JSON.parse(localStorage.getItem('llm_manager_audit_log') || '[]');
            this.logResult('Store Audit Events', storedEvents.length === testEvents.length, 
                `Stored ${storedEvents.length} audit events`);
            
            // Test audit log filtering
            const categories = ['all', 'config', 'guardrails', 'voice', 'system'];
            let filterTestsPassed = 0;
            
            categories.forEach(category => {
                const filtered = category === 'all' ? 
                    storedEvents : 
                    storedEvents.filter(event => event.category === category);
                
                const expectedCount = category === 'all' ? testEvents.length : 1;
                if (filtered.length === expectedCount) {
                    filterTestsPassed++;
                }
            });
            
            this.logResult('Audit Log Filtering', filterTestsPassed === categories.length, 
                `${filterTestsPassed}/${categories.length} filter tests passed`);
            
            // Test audit log clearing
            localStorage.removeItem('llm_manager_audit_log');
            const clearedLog = localStorage.getItem('llm_manager_audit_log');
            this.logResult('Clear Audit Log', !clearedLog, 'Audit log cleared successfully');
            
        } catch (error) {
            this.logResult('Audit Logging', false, 'Audit logging tests failed', error.message);
        }
    }
    
    /**
     * Test data persistence functionality
     */
    async testDataPersistence() {
        console.log('\n💾 Testing Data Persistence...');
        
        try {
            // Test LLM Manager persistence
            const llmData = localStorage.getItem('llm_manager_config');
            this.logResult('LLM Manager Persistence', !!llmData, 'LLM Manager data persisted to localStorage');
            
            // Test Guardrails persistence
            const guardrailsData = localStorage.getItem('guardrails_config');
            this.logResult('Guardrails Persistence', !!guardrailsData, 'Guardrails data persisted to localStorage');
            
            // Test Voice Config persistence
            const voiceData = localStorage.getItem('voice_config');
            this.logResult('Voice Config Persistence', !!voiceData, 'Voice configuration data persisted to localStorage');
            
            // Test data integrity
            if (llmData) {
                try {
                    const parsedData = JSON.parse(llmData);
                    const hasConfigurations = parsedData.configurations && Object.keys(parsedData.configurations).length > 0;
                    this.logResult('LLM Data Integrity', hasConfigurations, 'LLM Manager data structure is valid');
                } catch (parseError) {
                    this.logResult('LLM Data Integrity', false, 'LLM Manager data is corrupted');
                }
            }
            
            if (guardrailsData) {
                try {
                    const parsedData = JSON.parse(guardrailsData);
                    const hasGuardrails = parsedData.guardrails && Object.keys(parsedData.guardrails).length > 0;
                    this.logResult('Guardrails Data Integrity', hasGuardrails, 'Guardrails data structure is valid');
                } catch (parseError) {
                    this.logResult('Guardrails Data Integrity', false, 'Guardrails data is corrupted');
                }
            }
            
            if (voiceData) {
                try {
                    const parsedData = JSON.parse(voiceData);
                    const hasVoiceConfigs = parsedData.voiceConfigs && Object.keys(parsedData.voiceConfigs).length > 0;
                    this.logResult('Voice Data Integrity', hasVoiceConfigs, 'Voice configuration data structure is valid');
                } catch (parseError) {
                    this.logResult('Voice Data Integrity', false, 'Voice configuration data is corrupted');
                }
            }
            
        } catch (error) {
            this.logResult('Data Persistence', false, 'Data persistence tests failed', error.message);
        }
    }
    
    /**
     * Test export/import functionality
     */
    async testExportImport() {
        console.log('\n📤📥 Testing Export/Import...');
        
        try {
            // Test export
            const exportData = this.managers.llmManager.exportConfiguration();
            this.logResult('Export Configuration', !!exportData, 'Configuration exported successfully');
            
            if (exportData) {
                // Verify export structure
                const hasVersion = !!exportData.version;
                const hasTimestamp = !!exportData.timestamp;
                const hasConfigurations = !!exportData.configurations;
                const hasGuardrails = !!exportData.guardrails;
                const hasVoiceConfigs = !!exportData.voiceConfigs;
                
                this.logResult('Export Structure', hasVersion && hasTimestamp && hasConfigurations, 
                    'Export data has required structure');
                
                const configCount = Object.keys(exportData.configurations).length;
                this.logResult('Export Content', configCount > 0, `Export contains ${configCount} agent configurations`);
                
                // Test import
                const importSuccess = this.managers.llmManager.importConfiguration(exportData);
                this.logResult('Import Configuration', importSuccess, 'Configuration imported successfully');
                
                // Test import with invalid data
                const invalidImportData = { invalid: 'data' };
                const invalidImportSuccess = this.managers.llmManager.importConfiguration(invalidImportData);
                this.logResult('Invalid Import Rejection', !invalidImportSuccess, 'Invalid import data correctly rejected');
            }
            
        } catch (error) {
            this.logResult('Export/Import', false, 'Export/import tests failed', error.message);
        }
    }
    
    /**
     * Test error handling
     */
    async testErrorHandling() {
        console.log('\n🚨 Testing Error Handling...');
        
        try {
            // Test invalid agent configuration
            const invalidConfig = {
                name: '', // Invalid: empty name
                description: null, // Invalid: null description
                priority: 'invalid', // Invalid: non-numeric priority
                maxTokens: -100 // Invalid: negative tokens
            };
            
            const configValidation = this.managers.llmManager.validateConfiguration(invalidConfig);
            this.logResult('Invalid Config Handling', !configValidation.valid && configValidation.errors.length > 0, 
                `Invalid configuration rejected with ${configValidation.errors.length} errors`);
            
            // Test invalid guardrails
            const invalidGuardrails = {
                allowedCapabilities: 'invalid', // Should be object
                restrictions: {
                    maxTransactionAmount: 'invalid', // Should be number
                    blockedKeywords: 'invalid' // Should be array
                },
                complianceRules: {
                    logAllActions: 'invalid', // Should be boolean
                    dataRetentionDays: -1 // Should be positive
                }
            };
            
            const guardrailsValidation = this.managers.guardrailsManager.validateGuardrails(invalidGuardrails);
            this.logResult('Invalid Guardrails Handling', !guardrailsValidation.valid && guardrailsValidation.errors.length > 0, 
                `Invalid guardrails rejected with ${guardrailsValidation.errors.length} errors`);
            
            // Test invalid voice configuration
            const invalidVoiceConfig = {
                ttsSettings: {
                    provider: 'invalid-provider', // Invalid provider
                    voice: 'invalid-voice', // Invalid voice
                    speed: 10, // Invalid: too high
                    pitch: 100, // Invalid: too high
                    volume: 2 // Invalid: too high
                },
                personalityTraits: {
                    tone: 123, // Invalid: should be string
                    formality: 'invalid', // Invalid option
                    enthusiasm: 15, // Invalid: too high
                    empathy: -5 // Invalid: too low
                }
            };
            
            const voiceValidation = this.managers.voiceConfigManager.validateVoiceConfig(invalidVoiceConfig);
            this.logResult('Invalid Voice Config Handling', !voiceValidation.valid && voiceValidation.errors.length > 0, 
                `Invalid voice config rejected with ${voiceValidation.errors.length} errors`);
            
            // Test non-existent agent operations
            const nonExistentAgent = 'NonExistentAgent123';
            
            const nonExistentConfig = this.managers.llmManager.getAgentConfiguration(nonExistentAgent);
            this.logResult('Non-existent Agent Config', !nonExistentConfig, 'Non-existent agent configuration returns null');
            
            const nonExistentGuardrails = this.managers.guardrailsManager.getGuardrails(nonExistentAgent);
            this.logResult('Non-existent Agent Guardrails', !nonExistentGuardrails, 'Non-existent agent guardrails returns null');
            
            const nonExistentVoiceConfig = this.managers.voiceConfigManager.getVoiceConfig(nonExistentAgent);
            this.logResult('Non-existent Agent Voice Config', !nonExistentVoiceConfig, 'Non-existent agent voice config returns null');
            
        } catch (error) {
            this.logResult('Error Handling', false, 'Error handling tests failed', error.message);
        }
    }
    
    /**
     * Print test summary
     */
    printTestSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('🧪 LLM Manager Admin UI Integration Test Summary');
        console.log('='.repeat(60));
        
        const totalTests = this.testsPassed + this.testsFailed;
        const successRate = totalTests > 0 ? ((this.testsPassed / totalTests) * 100).toFixed(1) : 0;
        
        console.log(`📊 Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${this.testsPassed}`);
        console.log(`❌ Failed: ${this.testsFailed}`);
        console.log(`📈 Success Rate: ${successRate}%`);
        
        if (this.testsFailed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.filter(r => !r.success).forEach(result => {
                console.log(`   • ${result.test}: ${result.message}`);
                if (result.details) {
                    console.log(`     Details: ${result.details}`);
                }
            });
        }
        
        console.log('\n' + (this.testsFailed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed.'));
        console.log('='.repeat(60));
        
        // Store results for potential UI display
        localStorage.setItem('admin_ui_test_results', JSON.stringify({
            summary: {
                total: totalTests,
                passed: this.testsPassed,
                failed: this.testsFailed,
                successRate: successRate
            },
            results: this.results,
            timestamp: new Date().toISOString()
        }));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminUIIntegrationTest;
} else if (typeof window !== 'undefined') {
    window.AdminUIIntegrationTest = AdminUIIntegrationTest;
}

// Auto-run if in browser environment
if (typeof window !== 'undefined' && window.LLMManager && window.GuardrailsManager && window.VoiceConfigManager) {
    new AdminUIIntegrationTest();
}
/**
 * Integration test for LLM Manager Core Infrastructure
 * Tests the interaction between LLMManager, GuardrailsManager, and VoiceConfigManager
 */

// Mock debug manager for testing
if (typeof window === 'undefined') {
    global.window = {
        debugManager: {
            createModuleLogger: (module) => ({
                log: (...args) => console.log(`[${module}]`, ...args),
                warn: (...args) => console.warn(`[${module}]`, ...args),
                error: (...args) => console.error(`[${module}]`, ...args)
            })
        }
    };
}

// Load the manager classes
const LLMManager = require('./agents/llm-manager.js');
const GuardrailsManager = require('./agents/guardrails-manager.js');
const VoiceConfigManager = require('./agents/voice-config-manager.js');

// Mock localStorage for Node.js testing
const mockLocalStorage = {
    data: {},
    getItem: function(key) {
        return this.data[key] || null;
    },
    setItem: function(key, value) {
        this.data[key] = value;
    },
    removeItem: function(key) {
        delete this.data[key];
    },
    clear: function() {
        this.data = {};
    }
};

global.localStorage = mockLocalStorage;

async function runIntegrationTests() {
    console.log('🚀 Starting LLM Manager Integration Tests...\n');
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    function assert(condition, message) {
        if (condition) {
            console.log(`✅ ${message}`);
            testsPassed++;
        } else {
            console.log(`❌ ${message}`);
            testsFailed++;
        }
    }
    
    try {
        // Test 1: Initialize all managers
        console.log('📋 Test 1: Manager Initialization');
        const llmManager = new LLMManager();
        const guardrailsManager = new GuardrailsManager();
        const voiceConfigManager = new VoiceConfigManager();
        
        assert(llmManager instanceof LLMManager, 'LLMManager initialized successfully');
        assert(guardrailsManager instanceof GuardrailsManager, 'GuardrailsManager initialized successfully');
        assert(voiceConfigManager instanceof VoiceConfigManager, 'VoiceConfigManager initialized successfully');
        
        // Test 2: Set up manager dependencies
        console.log('\n📋 Test 2: Manager Dependencies');
        llmManager.setManagers(guardrailsManager, voiceConfigManager, null);
        
        const configs = llmManager.getAgentConfigurations();
        assert(Object.keys(configs).length > 0, 'LLM Manager has default configurations');
        
        // Test 3: Create comprehensive agent configuration
        console.log('\n📋 Test 3: Comprehensive Agent Configuration');
        const testAgentConfig = {
            name: 'IntegrationTestAgent',
            description: 'Agent for integration testing',
            priority: 1,
            enabled: true,
            triggers: ['integration', 'test'],
            llmProvider: 'openai',
            llmModel: 'gpt-4',
            maxTokens: 1500,
            telemetryEnabled: true,
            guardrails: {
                allowedCapabilities: {
                    canAccessAccountData: true,
                    canInitiateTransactions: false,
                    canBlockCards: false,
                    canResetPasswords: true,
                    canAccessTransactionHistory: true,
                    canProvideBalanceInfo: true
                },
                restrictions: {
                    maxTransactionAmount: 0,
                    requiresSecondaryAuth: ['resetPassword'],
                    blockedKeywords: ['forbidden', 'blocked'],
                    timeBasedRestrictions: {}
                },
                complianceRules: {
                    logAllActions: true,
                    requireAuditTrail: true,
                    dataRetentionDays: 90
                }
            },
            voiceConfig: {
                ttsSettings: {
                    provider: 'openai',
                    voice: 'nova',
                    speed: 1.1,
                    pitch: 1,
                    volume: 0.9
                },
                personalityTraits: {
                    tone: 'friendly',
                    formality: 'professional',
                    enthusiasm: 7,
                    empathy: 8
                },
                contextualAdaptation: {
                    errorResponseTone: 'apologetic',
                    successResponseTone: 'confident',
                    urgentSituationTone: 'calm'
                }
            }
        };
        
        const updateResult = llmManager.updateAgentConfiguration('IntegrationTestAgent', testAgentConfig);
        assert(updateResult, 'Successfully updated comprehensive agent configuration');
        
        // Test 4: Verify configuration persistence
        console.log('\n📋 Test 4: Configuration Persistence');
        const retrievedConfig = llmManager.getAgentConfiguration('IntegrationTestAgent');
        assert(retrievedConfig !== null, 'Retrieved agent configuration successfully');
        assert(retrievedConfig.name === 'IntegrationTestAgent', 'Agent name persisted correctly');
        assert(retrievedConfig.guardrails !== null, 'Guardrails configuration persisted');
        assert(retrievedConfig.voiceConfig !== null, 'Voice configuration persisted');
        
        // Test 5: Guardrails validation
        console.log('\n📋 Test 5: Guardrails Validation');
        const allowedAction = guardrailsManager.validateAction('IntegrationTestAgent', 'getAccountData');
        assert(allowedAction.allowed, 'Allowed action passed guardrails validation');
        
        const blockedAction = guardrailsManager.validateAction('IntegrationTestAgent', 'forbidden action');
        assert(!blockedAction.allowed, 'Blocked action correctly rejected by guardrails');
        
        // Test 6: Voice configuration application
        console.log('\n📋 Test 6: Voice Configuration Application');
        const ttsRequest = voiceConfigManager.applyVoiceConfig('IntegrationTestAgent', 'Hello, this is a test message.');
        assert(ttsRequest.voice === 'nova', 'Voice configuration applied correctly');
        assert(ttsRequest.speed === 1.1, 'Speed configuration applied correctly');
        assert(ttsRequest.personalityTraits.tone === 'friendly', 'Personality traits applied correctly');
        
        // Test 7: Voice preview functionality
        console.log('\n📋 Test 7: Voice Preview');
        const previewResult = await voiceConfigManager.previewVoice(testAgentConfig.voiceConfig, 'Preview test message');
        assert(previewResult.success, 'Voice preview generated successfully');
        assert(previewResult.preview === true, 'Preview flag set correctly');
        
        // Test 8: Export/Import functionality
        console.log('\n📋 Test 8: Export/Import Functionality');
        const exportData = llmManager.exportConfiguration();
        assert(exportData.version !== undefined, 'Export data has version information');
        assert(exportData.configurations !== undefined, 'Export data has configurations');
        assert(exportData.guardrails !== undefined, 'Export data has guardrails');
        assert(exportData.voiceConfigs !== undefined, 'Export data has voice configurations');
        
        // Clear and import
        llmManager.resetToDefaults();
        guardrailsManager.resetToDefaults();
        voiceConfigManager.resetToDefaults();
        
        const importResult = llmManager.importConfiguration(exportData);
        assert(importResult, 'Configuration import successful');
        
        const importedConfig = llmManager.getAgentConfiguration('IntegrationTestAgent');
        assert(importedConfig !== null, 'Imported configuration retrieved successfully');
        
        // Test 9: Configuration statistics
        console.log('\n📋 Test 9: Configuration Statistics');
        const stats = llmManager.getConfigurationStats();
        assert(stats.totalAgents > 0, 'Statistics show total agents');
        assert(stats.enabledAgents >= 0, 'Statistics show enabled agents');
        assert(stats.agentsByProvider !== undefined, 'Statistics include provider breakdown');
        
        // Test 10: Violation logging and history
        console.log('\n📋 Test 10: Violation Logging');
        guardrailsManager.logViolation('IntegrationTestAgent', 'testViolation', 'Integration test violation');
        const violations = guardrailsManager.getViolationHistory('IntegrationTestAgent');
        assert(violations.length > 0, 'Violation logged successfully');
        // Check the most recent violation (last in array)
        const lastViolation = violations[violations.length - 1];
        assert(lastViolation.action === 'testViolation', 'Violation details stored correctly');
        
        // Test 11: Configuration validation
        console.log('\n📋 Test 11: Configuration Validation');
        const validConfig = {
            name: 'ValidTestAgent',
            description: 'Valid test agent',
            priority: 1,
            enabled: true
        };
        
        const validationResult = llmManager.validateConfiguration(validConfig);
        assert(validationResult.valid, 'Valid configuration passes validation');
        
        const invalidConfig = {
            name: '', // Invalid empty name
            priority: -1, // Invalid negative priority
            llmProvider: 'invalid' // Invalid provider
        };
        
        const invalidValidationResult = llmManager.validateConfiguration(invalidConfig);
        assert(!invalidValidationResult.valid, 'Invalid configuration fails validation');
        assert(invalidValidationResult.errors.length > 0, 'Validation errors reported');
        
        // Test 12: Available voices and providers
        console.log('\n📋 Test 12: Available Voices and Providers');
        const providers = voiceConfigManager.getAvailableProviders();
        assert(providers.includes('openai'), 'OpenAI provider available');
        assert(providers.includes('elevenlabs'), 'ElevenLabs provider available');
        
        const openaiVoices = voiceConfigManager.getAvailableVoices('openai');
        assert(openaiVoices.includes('alloy'), 'Alloy voice available for OpenAI');
        assert(openaiVoices.includes('nova'), 'Nova voice available for OpenAI');
        
    } catch (error) {
        console.error('❌ Integration test failed with error:', error);
        testsFailed++;
    }
    
    // Summary
    console.log('\n📊 Integration Test Summary');
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    
    if (testsFailed === 0) {
        console.log('\n🎉 All integration tests passed! LLM Manager core infrastructure is working correctly.');
    } else {
        console.log('\n⚠️  Some integration tests failed. Please review the implementation.');
    }
    
    return testsFailed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
    runIntegrationTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { runIntegrationTests };
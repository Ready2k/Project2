/**
 * Integration test for Streaming Agent Configuration System
 * Tests the integration between StreamingAgentConfig and StreamingManager
 */

class StreamingConfigIntegrationTest {
    constructor() {
        this.testResults = [];
        this.mockStreamingManager = null;
        this.config = null;
    }

    /**
     * Create a mock StreamingManager for testing
     */
    createMockStreamingManager() {
        return {
            agentRoutingEnabled: false,
            voiceConfiguration: {
                agentVoices: new Map(),
                fallbackVoice: 'shimmer',
                enableVoiceSwitching: true,
                smoothTransitions: true,
                transitionDelay: 200
            },
            streamingAgentRouter: {
                updateConfiguration: (config) => {
                    this.lastRouterConfig = config;
                }
            },
            debug: {
                log: (...args) => console.log('[MockStreamingManager]', ...args),
                error: (...args) => console.error('[MockStreamingManager]', ...args)
            },
            updateAgentRoutingConfig: function(config) {
                this.agentRoutingEnabled = config.enabled && !!this.streamingAgentRouter;
                
                if (config.agentVoices) {
                    Object.entries(config.agentVoices).forEach(([agentName, voiceConfig]) => {
                        this.voiceConfiguration.agentVoices.set(agentName, voiceConfig);
                    });
                }
                
                if (config.voiceSettings) {
                    this.voiceConfiguration.fallbackVoice = config.voiceSettings.fallbackVoice || 'shimmer';
                    this.voiceConfiguration.enableVoiceSwitching = config.voiceSettings.enableVoiceSwitching !== false;
                    this.voiceConfiguration.smoothTransitions = config.voiceSettings.smoothTransitions !== false;
                    this.voiceConfiguration.transitionDelay = config.voiceSettings.transitionDelay || 200;
                }
                
                if (this.streamingAgentRouter && typeof this.streamingAgentRouter.updateConfiguration === 'function') {
                    this.streamingAgentRouter.updateConfiguration(config);
                }
            }
        };
    }

    /**
     * Run a single test
     */
    async runTest(testName, testFunction) {
        const startTime = performance.now();
        try {
            await testFunction.call(this);
            const duration = performance.now() - startTime;
            this.addResult(testName, true, `Test passed in ${duration.toFixed(2)}ms`);
            return true;
        } catch (error) {
            const duration = performance.now() - startTime;
            this.addResult(testName, false, `Test failed: ${error.message} (${duration.toFixed(2)}ms)`);
            return false;
        }
    }

    /**
     * Add test result
     */
    addResult(testName, passed, message) {
        this.testResults.push({
            name: testName,
            passed: passed,
            message: message,
            timestamp: new Date().toISOString()
        });
        console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}: ${message}`);
    }

    /**
     * Test configuration initialization
     */
    async testConfigurationInitialization() {
        // Create mock StreamingManager
        this.mockStreamingManager = this.createMockStreamingManager();
        window.streamingManager = this.mockStreamingManager;

        // Create configuration instance
        this.config = new StreamingAgentConfig();

        // Verify configuration object exists
        if (!this.config.config) {
            throw new Error('Configuration object not initialized');
        }

        // Verify required properties
        const requiredProps = ['enabled', 'agentPriority', 'agentVoices', 'routingSettings', 'voiceSettings'];
        for (const prop of requiredProps) {
            if (!(prop in this.config.config)) {
                throw new Error(`Required property '${prop}' missing from configuration`);
            }
        }
    }

    /**
     * Test configuration integration with StreamingManager
     */
    async testStreamingManagerIntegration() {
        if (!this.config || !this.mockStreamingManager) {
            throw new Error('Configuration or StreamingManager not initialized');
        }

        // Enable agent routing in configuration
        this.config.config.enabled = true;
        
        // Update StreamingManager with configuration
        this.mockStreamingManager.updateAgentRoutingConfig(this.config.config);

        // Verify StreamingManager was updated
        if (!this.mockStreamingManager.agentRoutingEnabled) {
            throw new Error('StreamingManager agent routing not enabled after configuration update');
        }

        // Verify voice configuration was transferred
        if (this.mockStreamingManager.voiceConfiguration.agentVoices.size === 0) {
            throw new Error('Agent voices not transferred to StreamingManager');
        }

        // Test specific agent voice configuration
        const fraudAgentVoice = this.mockStreamingManager.voiceConfiguration.agentVoices.get('FraudAgent');
        if (!fraudAgentVoice || fraudAgentVoice.voice !== 'alloy') {
            throw new Error('FraudAgent voice configuration not correctly transferred');
        }
    }

    /**
     * Test configuration persistence and loading
     */
    async testConfigurationPersistence() {
        if (!this.config) {
            throw new Error('Configuration not initialized');
        }

        // Modify configuration
        const originalTimeout = this.config.config.routingSettings.routingTimeout;
        this.config.config.routingSettings.routingTimeout = 150;
        this.config.config.enabled = true;

        // Save configuration
        const saveResult = this.config.saveConfiguration();
        if (!saveResult) {
            throw new Error('Failed to save configuration');
        }

        // Create new instance to test loading
        const newConfig = new StreamingAgentConfig();
        
        // Verify configuration was loaded
        if (newConfig.config.routingSettings.routingTimeout !== 150) {
            throw new Error('Configuration not persisted correctly');
        }

        if (!newConfig.config.enabled) {
            throw new Error('Enabled state not persisted correctly');
        }

        // Restore original configuration
        this.config.config.routingSettings.routingTimeout = originalTimeout;
        this.config.config.enabled = false;
        this.config.saveConfiguration();
    }

    /**
     * Test agent priority configuration
     */
    async testAgentPriorityConfiguration() {
        if (!this.config) {
            throw new Error('Configuration not initialized');
        }

        // Test getting agent priorities
        const priorities = this.config.getAgentPriorities();
        
        // Verify all required agents have priorities
        const requiredAgents = ['FraudAgent', 'PaymentsAgent', 'IDVAgent', 'BankingInfoAgent', 'DefaultAgent'];
        for (const agent of requiredAgents) {
            if (!(agent in priorities)) {
                throw new Error(`Agent '${agent}' missing from priority configuration`);
            }
            
            if (priorities[agent] < 1 || priorities[agent] > 10) {
                throw new Error(`Invalid priority for agent '${agent}': ${priorities[agent]}`);
            }
        }

        // Test priority modification
        const originalPriority = priorities.FraudAgent;
        this.config.config.agentPriority.FraudAgent = 5;
        
        const updatedPriorities = this.config.getAgentPriorities();
        if (updatedPriorities.FraudAgent !== 5) {
            throw new Error('Priority modification not reflected in getter');
        }

        // Restore original priority
        this.config.config.agentPriority.FraudAgent = originalPriority;
    }

    /**
     * Test voice configuration
     */
    async testVoiceConfiguration() {
        if (!this.config) {
            throw new Error('Configuration not initialized');
        }

        // Test getting agent voices
        const voices = this.config.getAgentVoices();
        
        // Verify all required agents have voice configurations
        const requiredAgents = ['FraudAgent', 'PaymentsAgent', 'IDVAgent', 'BankingInfoAgent', 'DefaultAgent'];
        for (const agent of requiredAgents) {
            if (!(agent in voices)) {
                throw new Error(`Agent '${agent}' missing from voice configuration`);
            }

            const voiceConfig = voices[agent];
            if (!voiceConfig.voice || typeof voiceConfig.speed !== 'number' || typeof voiceConfig.temperature !== 'number') {
                throw new Error(`Incomplete voice configuration for agent '${agent}'`);
            }

            // Validate voice settings
            const validVoices = ['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer'];
            if (!validVoices.includes(voiceConfig.voice)) {
                throw new Error(`Invalid voice for agent '${agent}': ${voiceConfig.voice}`);
            }

            if (voiceConfig.speed < 0.25 || voiceConfig.speed > 4.0) {
                throw new Error(`Invalid speed for agent '${agent}': ${voiceConfig.speed}`);
            }

            if (voiceConfig.temperature < 0.1 || voiceConfig.temperature > 1.0) {
                throw new Error(`Invalid temperature for agent '${agent}': ${voiceConfig.temperature}`);
            }
        }
    }

    /**
     * Test configuration validation
     */
    async testConfigurationValidation() {
        if (!this.config) {
            throw new Error('Configuration not initialized');
        }

        // Test valid configuration
        const validationResult = this.config.validateConfiguration();
        if (!validationResult.isValid) {
            throw new Error(`Valid configuration failed validation: ${validationResult.errors.join(', ')}`);
        }

        // Test invalid configuration - invalid priority
        const originalPriority = this.config.config.agentPriority.FraudAgent;
        this.config.config.agentPriority.FraudAgent = 999;

        const invalidValidation = this.config.validateConfiguration();
        if (invalidValidation.isValid) {
            throw new Error('Invalid priority configuration passed validation');
        }

        // Restore original priority
        this.config.config.agentPriority.FraudAgent = originalPriority;

        // Test invalid voice
        const originalVoice = this.config.config.agentVoices.FraudAgent.voice;
        this.config.config.agentVoices.FraudAgent.voice = 'invalid_voice';

        const invalidVoiceValidation = this.config.validateConfiguration();
        if (invalidVoiceValidation.isValid) {
            throw new Error('Invalid voice configuration passed validation');
        }

        // Restore original voice
        this.config.config.agentVoices.FraudAgent.voice = originalVoice;
    }

    /**
     * Test configuration change notifications
     */
    async testConfigurationChangeNotifications() {
        if (!this.config || !this.mockStreamingManager) {
            throw new Error('Configuration or StreamingManager not initialized');
        }

        // Set up event listener
        let eventReceived = false;
        const eventHandler = (event) => {
            eventReceived = true;
            if (!event.detail || !event.detail.config) {
                throw new Error('Configuration change event missing config data');
            }
        };

        window.addEventListener('streamingAgentConfigChanged', eventHandler);

        try {
            // Trigger configuration change
            this.config.config.enabled = !this.config.config.enabled;
            this.config.saveConfiguration();

            // Wait a bit for event to fire
            await new Promise(resolve => setTimeout(resolve, 100));

            if (!eventReceived) {
                throw new Error('Configuration change event not fired');
            }
        } finally {
            window.removeEventListener('streamingAgentConfigChanged', eventHandler);
        }
    }

    /**
     * Run all integration tests
     */
    async runAllTests() {
        console.log('Starting Streaming Agent Configuration Integration Tests...');
        
        const tests = [
            'testConfigurationInitialization',
            'testStreamingManagerIntegration',
            'testConfigurationPersistence',
            'testAgentPriorityConfiguration',
            'testVoiceConfiguration',
            'testConfigurationValidation',
            'testConfigurationChangeNotifications'
        ];

        let passed = 0;
        let failed = 0;

        for (const testName of tests) {
            const result = await this.runTest(testName, this[testName]);
            if (result) {
                passed++;
            } else {
                failed++;
            }
        }

        console.log(`\nIntegration Tests Complete: ${passed} passed, ${failed} failed`);
        
        return {
            total: tests.length,
            passed: passed,
            failed: failed,
            results: this.testResults
        };
    }

    /**
     * Get test results
     */
    getResults() {
        return {
            total: this.testResults.length,
            passed: this.testResults.filter(r => r.passed).length,
            failed: this.testResults.filter(r => r.passed === false).length,
            results: this.testResults
        };
    }

    /**
     * Clear test results
     */
    clearResults() {
        this.testResults = [];
    }
}

// Export for use in other modules or tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingConfigIntegrationTest;
}

// Make available globally for browser testing
if (typeof window !== 'undefined') {
    window.StreamingConfigIntegrationTest = StreamingConfigIntegrationTest;
}

// Auto-run tests if this script is loaded directly
if (typeof window !== 'undefined' && window.location && window.location.pathname.includes('test-streaming-config-integration')) {
    document.addEventListener('DOMContentLoaded', async () => {
        const tester = new StreamingConfigIntegrationTest();
        await tester.runAllTests();
    });
}
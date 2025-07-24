/**
 * Test script to verify voice configuration integration with main script.js
 * This test simulates the voice configuration system working with agent routing
 */

// Mock dependencies for testing
class MockDebugManager {
    createModuleLogger(name) {
        return {
            log: (...args) => console.log(`[${name}]`, ...args),
            info: (...args) => console.info(`[${name}]`, ...args),
            warn: (...args) => console.warn(`[${name}]`, ...args),
            error: (...args) => console.error(`[${name}]`, ...args)
        };
    }
    
    isEnabled() {
        return true;
    }
}

class MockPersonaManager {
    getCurrentPersona() {
        return 'default';
    }
    
    getCurrentPersonaData() {
        return {
            name: 'Test User',
            accountType: 'Premium',
            balance: 2500.75,
            cardLast4: '1234'
        };
    }
}

class MockSystemPromptsManager {
    getSystemPrompt() {
        return 'You are a helpful banking assistant.';
    }
}

class MockTokenTracker {
    trackTtsUsage() {}
    getUsage() {
        return { tts: { characters: 0 } };
    }
}

class MockOpenAIClient {
    constructor(apiKey, tokenTracker) {
        this.apiKey = apiKey;
        this.tokenTracker = tokenTracker;
    }
    
    async textToSpeech(text, options) {
        console.log('Mock TTS called with:', { text: text.substring(0, 50) + '...', options });
        return {
            success: true,
            audioBlob: new Blob(['mock audio data'], { type: 'audio/wav' })
        };
    }
}

class MockAgentRouter {
    constructor() {
        this.agents = [];
    }
    
    async route(inputText, context) {
        // Simulate agent routing based on input
        let agentName = 'BankingInfoAgent'; // default
        
        if (inputText.toLowerCase().includes('balance') || inputText.toLowerCase().includes('account')) {
            agentName = 'BankingInfoAgent';
        } else if (inputText.toLowerCase().includes('transfer') || inputText.toLowerCase().includes('payment')) {
            agentName = 'PaymentsAgent';
        } else if (inputText.toLowerCase().includes('fraud') || inputText.toLowerCase().includes('block')) {
            agentName = 'FraudAgent';
        } else if (inputText.toLowerCase().includes('verify') || inputText.toLowerCase().includes('password')) {
            agentName = 'IDVAgent';
        }
        
        return {
            success: true,
            response: `Mock response from ${agentName} for: ${inputText}`,
            agentName: agentName,
            processingTime: 150
        };
    }
}

// Test class that simulates the relevant parts of SpeechToSpeechApp
class VoiceConfigTestApp {
    constructor() {
        // Initialize mock dependencies
        window.debugManager = new MockDebugManager();
        this.debug = window.debugManager.createModuleLogger('VoiceConfigTestApp');
        
        this.personaManager = new MockPersonaManager();
        this.systemPromptsManager = new MockSystemPromptsManager();
        this.voiceConfigManager = new VoiceConfigManager();
        this.tokenTracker = new MockTokenTracker();
        this.apiClient = new MockOpenAIClient('mock-key', this.tokenTracker);
        this.agentRouter = new MockAgentRouter();
        
        // TTS settings (fallback)
        this.ttsSettings = {
            model: 'tts-1',
            voice: 'nova',
            speed: 1.0
        };
        
        this.ttsMode = 'openai';
        this.conversationHistory = [];
        this.lastAgentUsed = null;
    }
    
    // Voice configuration helper method
    getAgentVoiceConfig(agentName) {
        if (!agentName || !this.voiceConfigManager) {
            return null;
        }
        
        return this.voiceConfigManager.getVoiceConfig(agentName);
    }
    
    // Simulated TTS methods
    async textToSpeech(text, agentName = null) {
        // Apply agent-specific voice configuration if available
        const voiceConfig = this.getAgentVoiceConfig(agentName);
        
        if (this.ttsMode === 'browser') {
            return this.textToSpeechBrowser(text, voiceConfig);
        } else {
            return this.textToSpeechOpenAI(text, voiceConfig);
        }
    }
    
    async textToSpeechOpenAI(text, voiceConfig = null) {
        try {
            console.log('Converting text to speech with OpenAI:', text.substring(0, 50) + '...');
            
            // Use voice configuration if provided, otherwise fall back to default settings
            let ttsOptions;
            if (voiceConfig && voiceConfig.ttsSettings) {
                const ttsSettings = voiceConfig.ttsSettings;
                ttsOptions = {
                    model: ttsSettings.model || this.ttsSettings.model,
                    voice: ttsSettings.voice || this.ttsSettings.voice,
                    speed: ttsSettings.speed || this.ttsSettings.speed
                };
                console.log(`Using agent voice config - Model: ${ttsOptions.model}, Voice: ${ttsOptions.voice}, Speed: ${ttsOptions.speed}`);
            } else {
                ttsOptions = {
                    model: this.ttsSettings.model,
                    voice: this.ttsSettings.voice,
                    speed: this.ttsSettings.speed
                };
                console.log(`Using default TTS settings - ${this.ttsSettings.model} (${this.ttsSettings.voice})`);
            }

            const result = await this.apiClient.textToSpeech(text, ttsOptions);
            return result;
            
        } catch (error) {
            console.error('OpenAI TTS error:', error);
            throw error;
        }
    }
    
    async textToSpeechBrowser(text, voiceConfig = null) {
        return new Promise((resolve) => {
            console.log('Converting text to speech with Browser TTS:', text.substring(0, 50) + '...');
            
            if (voiceConfig && voiceConfig.ttsSettings) {
                const ttsSettings = voiceConfig.ttsSettings;
                console.log(`Using agent voice config - Voice: ${ttsSettings.voice}, Speed: ${ttsSettings.speed}, Pitch: ${ttsSettings.pitch}`);
            } else {
                console.log('Using default browser TTS settings');
            }
            
            // Simulate browser TTS completion
            setTimeout(() => {
                resolve({ success: true });
            }, 100);
        });
    }
    
    // Simulated routing methods
    async routeRequestThroughAgentsWithMetadata(userMessage) {
        try {
            if (this.agentRouter) {
                console.log('Routing request through AgentRouter:', userMessage.substring(0, 50) + '...');

                const agentContext = {
                    personaManager: this.personaManager,
                    systemPromptsManager: this.systemPromptsManager,
                    apiClient: this.apiClient,
                    tokenTracker: this.tokenTracker,
                    currentPersona: this.personaManager.getCurrentPersona(),
                    sessionData: {},
                    debugMode: true,
                    conversationHistory: this.conversationHistory,
                    lastAgentUsed: this.lastAgentUsed
                };

                const agentResult = await this.agentRouter.route(userMessage, agentContext);

                if (agentResult.success) {
                    console.log('Agent routing successful:', agentResult.agentName);
                    
                    return {
                        response: agentResult.response,
                        agentName: agentResult.agentName
                    };
                }
            }

            // Fallback
            return {
                response: `Fallback response for: ${userMessage}`,
                agentName: null
            };

        } catch (error) {
            console.error('Error in agent routing:', error);
            return {
                response: `Error response for: ${userMessage}`,
                agentName: null
            };
        }
    }
    
    // Simulate the main processing flow
    async processUserInput(userMessage) {
        console.log('\n=== Processing User Input ===');
        console.log('User message:', userMessage);
        
        // Route through agents
        const routingResult = await this.routeRequestThroughAgentsWithMetadata(userMessage);
        console.log('Routing result:', routingResult);
        
        // Convert response to speech with agent-specific voice
        console.log('\n=== Converting to Speech ===');
        await this.textToSpeech(routingResult.response, routingResult.agentName);
        
        console.log('=== Processing Complete ===\n');
        return routingResult;
    }
}

// Test functions
async function testVoiceConfigIntegration() {
    console.log('🧪 Starting Voice Configuration Integration Tests\n');
    
    const app = new VoiceConfigTestApp();
    const testCases = [
        {
            input: 'What is my account balance?',
            expectedAgent: 'BankingInfoAgent',
            description: 'Banking info request should use BankingInfoAgent voice'
        },
        {
            input: 'I want to transfer £100 to Alice',
            expectedAgent: 'PaymentsAgent',
            description: 'Payment request should use PaymentsAgent voice'
        },
        {
            input: 'I think there is fraud on my account',
            expectedAgent: 'FraudAgent',
            description: 'Fraud report should use FraudAgent voice'
        },
        {
            input: 'I need to verify my identity',
            expectedAgent: 'IDVAgent',
            description: 'Identity verification should use IDVAgent voice'
        },
        {
            input: 'What is the weather today?',
            expectedAgent: null,
            description: 'Non-banking request should use fallback voice'
        }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (const testCase of testCases) {
        console.log(`\n📋 Test: ${testCase.description}`);
        console.log(`Input: "${testCase.input}"`);
        
        try {
            const result = await app.processUserInput(testCase.input);
            
            // Check if correct agent was used
            const agentMatch = result.agentName === testCase.expectedAgent;
            
            if (agentMatch) {
                console.log(`✅ PASS: Correct agent (${result.agentName || 'fallback'}) was used`);
                passedTests++;
            } else {
                console.log(`❌ FAIL: Expected ${testCase.expectedAgent || 'fallback'}, got ${result.agentName || 'fallback'}`);
            }
            
            // Check if voice configuration was applied
            const voiceConfig = app.getAgentVoiceConfig(result.agentName);
            if (result.agentName && voiceConfig) {
                console.log(`🎵 Voice config applied: ${voiceConfig.ttsSettings.voice} (${voiceConfig.ttsSettings.provider})`);
            } else if (!result.agentName) {
                console.log(`🎵 Using fallback voice configuration`);
            }
            
        } catch (error) {
            console.log(`❌ FAIL: Error during test - ${error.message}`);
        }
    }
    
    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All voice configuration integration tests passed!');
    } else {
        console.log('⚠️  Some tests failed. Check the implementation.');
    }
}

async function testVoiceConfigManager() {
    console.log('\n🧪 Testing Voice Configuration Manager\n');
    
    const manager = new VoiceConfigManager();
    let passedTests = 0;
    let totalTests = 0;
    
    // Test 1: Get default configurations
    totalTests++;
    console.log('📋 Test 1: Default configurations loaded');
    const allConfigs = manager.getAllVoiceConfigs();
    const hasDefaults = Object.keys(allConfigs).length > 0;
    
    if (hasDefaults) {
        console.log(`✅ PASS: Loaded ${Object.keys(allConfigs).length} default configurations`);
        passedTests++;
        
        // Show default configurations
        Object.keys(allConfigs).forEach(agentName => {
            const config = allConfigs[agentName];
            console.log(`  - ${agentName}: ${config.ttsSettings.voice} (${config.ttsSettings.provider})`);
        });
    } else {
        console.log('❌ FAIL: No default configurations found');
    }
    
    // Test 2: Voice configuration validation
    totalTests++;
    console.log('\n📋 Test 2: Configuration validation');
    const validConfig = {
        ttsSettings: {
            provider: 'openai',
            voice: 'alloy',
            speed: 1.0,
            pitch: 0,
            volume: 0.8
        }
    };
    
    const validation = manager.validateVoiceConfig(validConfig);
    if (validation.valid) {
        console.log('✅ PASS: Valid configuration accepted');
        passedTests++;
    } else {
        console.log(`❌ FAIL: Valid configuration rejected: ${validation.errors.join(', ')}`);
    }
    
    // Test 3: Invalid configuration rejection
    totalTests++;
    console.log('\n📋 Test 3: Invalid configuration rejection');
    const invalidConfig = {
        ttsSettings: {
            provider: 'invalid_provider',
            speed: 10.0
        }
    };
    
    const invalidValidation = manager.validateVoiceConfig(invalidConfig);
    if (!invalidValidation.valid) {
        console.log('✅ PASS: Invalid configuration properly rejected');
        console.log(`  Errors: ${invalidValidation.errors.join(', ')}`);
        passedTests++;
    } else {
        console.log('❌ FAIL: Invalid configuration was accepted');
    }
    
    // Test 4: Voice preview
    totalTests++;
    console.log('\n📋 Test 4: Voice preview generation');
    try {
        const previewResult = await manager.previewVoice(validConfig, 'Test preview message');
        if (previewResult.success) {
            console.log(`✅ PASS: Voice preview generated (${previewResult.estimatedDuration}s duration)`);
            passedTests++;
        } else {
            console.log(`❌ FAIL: Voice preview failed: ${previewResult.error}`);
        }
    } catch (error) {
        console.log(`❌ FAIL: Voice preview error: ${error.message}`);
    }
    
    console.log(`\n📊 Voice Config Manager Results: ${passedTests}/${totalTests} tests passed`);
    
    return passedTests === totalTests;
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting Voice Configuration System Tests\n');
    console.log('=' .repeat(60));
    
    try {
        // Test 1: Voice Configuration Manager
        const managerTestsPassed = await testVoiceConfigManager();
        
        console.log('\n' + '=' .repeat(60));
        
        // Test 2: Integration with main app
        await testVoiceConfigIntegration();
        
        console.log('\n' + '=' .repeat(60));
        console.log('🏁 All tests completed!');
        
        if (managerTestsPassed) {
            console.log('✅ Voice Configuration System is working correctly');
        } else {
            console.log('⚠️  Some issues found in Voice Configuration System');
        }
        
    } catch (error) {
        console.error('❌ Test runner error:', error);
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllTests,
        testVoiceConfigIntegration,
        testVoiceConfigManager,
        VoiceConfigTestApp
    };
} else if (typeof window !== 'undefined') {
    window.voiceConfigTests = {
        runAllTests,
        testVoiceConfigIntegration,
        testVoiceConfigManager,
        VoiceConfigTestApp
    };
}

// Auto-run tests if this script is loaded directly
if (typeof window !== 'undefined' && window.VoiceConfigManager) {
    // Run tests when page loads
    window.addEventListener('load', () => {
        setTimeout(runAllTests, 1000); // Give time for other scripts to load
    });
} else if (typeof require !== 'undefined') {
    // Node.js environment - run tests if VoiceConfigManager is available
    try {
        const VoiceConfigManager = require('./agents/voice-config-manager.js');
        if (VoiceConfigManager) {
            runAllTests();
        }
    } catch (error) {
        console.log('VoiceConfigManager not available for testing');
    }
}
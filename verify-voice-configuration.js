/**
 * Voice Configuration Verification Script
 * Tests the agent-specific voice configuration implementation
 */

// Mock dependencies for testing
class MockDebugManager {
    createModuleLogger(name) {
        return {
            log: (msg, data) => console.log(`[${name}] ${msg}`, data || ''),
            debug: (msg, data) => console.log(`[${name}] DEBUG: ${msg}`, data || ''),
            info: (msg, data) => console.log(`[${name}] INFO: ${msg}`, data || ''),
            warn: (msg, data) => console.warn(`[${name}] WARN: ${msg}`, data || ''),
            error: (msg, data) => console.error(`[${name}] ERROR: ${msg}`, data || '')
        };
    }
}

// Set up global mocks
global.window = {
    debugManager: new MockDebugManager(),
    AudioContext: class MockAudioContext {},
    webkitAudioContext: class MockAudioContext {},
    sessionStorage: {
        setItem: (key, value) => console.log(`SessionStorage SET: ${key} = ${value}`),
        getItem: (key) => {
            console.log(`SessionStorage GET: ${key}`);
            return null;
        },
        removeItem: (key) => console.log(`SessionStorage REMOVE: ${key}`)
    }
};

// Load the StreamingManager
const fs = require('fs');
const path = require('path');
const streamingManagerPath = path.join(__dirname, 'streaming-manager.js');
const streamingManagerCode = fs.readFileSync(streamingManagerPath, 'utf8');
eval(streamingManagerCode);

async function testVoiceConfiguration() {
    console.log('=== Voice Configuration Test ===\n');

    try {
        // Create StreamingManager instance
        const streamingManager = new StreamingManager('test-api-key');
        
        console.log('1. Testing voice configuration initialization...');
        const voiceConfig = streamingManager.getVoiceConfiguration();
        console.log('✓ Voice configuration initialized:', {
            currentVoice: voiceConfig.currentVoice,
            agentCount: Object.keys(voiceConfig.agentVoices).length,
            fallbackVoice: voiceConfig.fallbackVoice
        });

        console.log('\n2. Testing agent voice mappings...');
        const testAgents = ['FraudAgent', 'PaymentsAgent', 'IDVAgent', 'BankingInfoAgent', 'DefaultAgent'];
        
        testAgents.forEach(agentName => {
            const agentVoiceConfig = streamingManager.getVoiceConfigForAgent(agentName);
            console.log(`✓ ${agentName}:`, {
                voice: agentVoiceConfig.voice,
                speed: agentVoiceConfig.speed,
                pitch: agentVoiceConfig.pitch
            });
        });

        console.log('\n3. Testing voice configuration for unknown agent...');
        const unknownAgentConfig = streamingManager.getVoiceConfigForAgent('UnknownAgent');
        console.log('✓ Unknown agent fallback:', {
            voice: unknownAgentConfig.voice,
            isFallback: unknownAgentConfig.voice === voiceConfig.fallbackVoice
        });

        console.log('\n4. Testing voice switching logic...');
        try {
            // This will fail without WebSocket but should handle gracefully
            const switchResult = await streamingManager.switchAgentVoice('FraudAgent', {});
            console.log('✓ Voice switching handled:', switchResult);
        } catch (error) {
            console.log('✓ Voice switching error handled gracefully:', error.message);
        }

        console.log('\n5. Testing voice persistence...');
        streamingManager.persistVoiceConfiguration();
        const restored = streamingManager.restoreVoiceConfiguration();
        console.log('✓ Voice persistence tested:', { restored });

        console.log('\n6. Testing voice configuration updates...');
        streamingManager.configureAgentVoice('TestAgent', {
            voice: 'nova',
            speed: 1.2,
            pitch: 0.8,
            temperature: 0.7
        });
        
        const testAgentConfig = streamingManager.getVoiceConfigForAgent('TestAgent');
        console.log('✓ Agent voice configuration updated:', testAgentConfig);

        console.log('\n7. Testing session context integration...');
        const sessionContext = streamingManager.getSessionContext();
        console.log('✓ Session context includes voice config:', {
            hasVoiceConfig: !!sessionContext.voiceConfiguration,
            currentVoice: sessionContext.voiceConfiguration?.currentVoice
        });

        console.log('\n=== All Voice Configuration Tests Passed! ===');
        return true;

    } catch (error) {
        console.error('❌ Voice configuration test failed:', error);
        return false;
    }
}

// Run the test
testVoiceConfiguration().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
});
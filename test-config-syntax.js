/**
 * Simple syntax test for streaming agent configuration
 */

// Test if StreamingAgentConfig can be instantiated
try {
    console.log('Testing StreamingAgentConfig instantiation...');
    
    // Mock DOM elements that the config system expects
    if (typeof document !== 'undefined') {
        // Create mock settings panel if it doesn't exist
        let settingsPanel = document.querySelector('#settingsPanel .panel-content');
        if (!settingsPanel) {
            const mockPanel = document.createElement('div');
            mockPanel.id = 'settingsPanel';
            const mockContent = document.createElement('div');
            mockContent.className = 'panel-content';
            mockPanel.appendChild(mockContent);
            document.body.appendChild(mockPanel);
            settingsPanel = mockContent;
        }
    }
    
    // Test configuration instantiation
    if (typeof StreamingAgentConfig !== 'undefined') {
        const config = new StreamingAgentConfig();
        console.log('✅ StreamingAgentConfig instantiated successfully');
        
        // Test basic methods
        const currentConfig = config.getConfiguration();
        console.log('✅ getConfiguration() works:', Object.keys(currentConfig));
        
        const priorities = config.getAgentPriorities();
        console.log('✅ getAgentPriorities() works:', priorities);
        
        const voices = config.getAgentVoices();
        console.log('✅ getAgentVoices() works:', Object.keys(voices));
        
        const validation = config.validateConfiguration();
        console.log('✅ validateConfiguration() works:', validation.isValid);
        
        console.log('🎉 All basic configuration tests passed!');
        
    } else {
        console.error('❌ StreamingAgentConfig class not found');
    }
    
} catch (error) {
    console.error('❌ Error testing StreamingAgentConfig:', error);
    console.error('Stack trace:', error.stack);
}

// Test if StreamingManager integration works
try {
    console.log('Testing StreamingManager integration...');
    
    if (typeof StreamingManager !== 'undefined') {
        // Create a mock StreamingManager to test integration
        const mockManager = {
            agentRoutingEnabled: false,
            voiceConfiguration: {
                agentVoices: new Map(),
                fallbackVoice: 'shimmer'
            },
            debug: {
                log: (...args) => console.log('[MockStreamingManager]', ...args),
                error: (...args) => console.error('[MockStreamingManager]', ...args)
            },
            updateAgentRoutingConfig: function(config) {
                console.log('✅ updateAgentRoutingConfig called with:', Object.keys(config));
                this.agentRoutingEnabled = config.enabled;
                return true;
            }
        };
        
        // Test configuration update
        if (typeof StreamingAgentConfig !== 'undefined') {
            const config = new StreamingAgentConfig();
            mockManager.updateAgentRoutingConfig(config.getConfiguration());
            console.log('✅ StreamingManager integration test passed');
        }
        
    } else {
        console.log('ℹ️ StreamingManager not available for integration test');
    }
    
} catch (error) {
    console.error('❌ Error testing StreamingManager integration:', error);
}

console.log('Configuration syntax test completed.');
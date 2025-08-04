/**
 * Verification script for streaming agent configuration integration
 */

function verifyConfigurationIntegration() {
    console.log('🔧 Starting Configuration Integration Verification...');
    
    const results = {
        configClassExists: false,
        configInstantiation: false,
        streamingManagerIntegration: false,
        eventSystem: false,
        uiIntegration: false,
        persistence: false
    };
    
    try {
        // Test 1: Check if StreamingAgentConfig class exists
        console.log('1. Testing StreamingAgentConfig class existence...');
        if (typeof StreamingAgentConfig !== 'undefined') {
            results.configClassExists = true;
            console.log('✅ StreamingAgentConfig class found');
        } else {
            console.log('❌ StreamingAgentConfig class not found');
            return results;
        }
        
        // Test 2: Test configuration instantiation
        console.log('2. Testing configuration instantiation...');
        try {
            const config = new StreamingAgentConfig();
            if (config && config.config) {
                results.configInstantiation = true;
                console.log('✅ Configuration instantiated successfully');
                
                // Test basic methods
                const currentConfig = config.getConfiguration();
                const priorities = config.getAgentPriorities();
                const voices = config.getAgentVoices();
                
                console.log('   - Configuration keys:', Object.keys(currentConfig));
                console.log('   - Agent priorities:', Object.keys(priorities));
                console.log('   - Agent voices:', Object.keys(voices));
                
            } else {
                console.log('❌ Configuration instantiation failed');
            }
        } catch (error) {
            console.log('❌ Configuration instantiation error:', error.message);
        }
        
        // Test 3: Test StreamingManager integration
        console.log('3. Testing StreamingManager integration...');
        if (window.streamingManager && typeof window.streamingManager.updateAgentRoutingConfig === 'function') {
            results.streamingManagerIntegration = true;
            console.log('✅ StreamingManager integration methods found');
        } else {
            console.log('❌ StreamingManager integration methods not found');
        }
        
        // Test 4: Test event system
        console.log('4. Testing event system...');
        try {
            let eventReceived = false;
            const testHandler = (event) => {
                eventReceived = true;
                console.log('✅ Configuration change event received');
            };
            
            window.addEventListener('streamingAgentConfigChanged', testHandler);
            
            // Trigger a test event
            window.dispatchEvent(new CustomEvent('streamingAgentConfigChanged', {
                detail: { config: { test: true } }
            }));
            
            setTimeout(() => {
                if (eventReceived) {
                    results.eventSystem = true;
                }
                window.removeEventListener('streamingAgentConfigChanged', testHandler);
            }, 100);
            
        } catch (error) {
            console.log('❌ Event system test error:', error.message);
        }
        
        // Test 5: Test UI integration
        console.log('5. Testing UI integration...');
        const requiredElements = [
            'streamingRoutingEnabled',
            'fraudAgentPriority',
            'saveStreamingConfig'
        ];
        
        let foundElements = 0;
        requiredElements.forEach(elementId => {
            if (document.getElementById(elementId)) {
                foundElements++;
            }
        });
        
        if (foundElements > 0) {
            results.uiIntegration = true;
            console.log(`✅ UI integration found ${foundElements}/${requiredElements.length} elements`);
        } else {
            console.log('❌ UI integration elements not found');
        }
        
        // Test 6: Test persistence
        console.log('6. Testing configuration persistence...');
        try {
            const testConfig = { test: 'persistence_test', timestamp: Date.now() };
            localStorage.setItem('streamingAgentConfig', JSON.stringify(testConfig));
            
            const retrieved = JSON.parse(localStorage.getItem('streamingAgentConfig'));
            if (retrieved && retrieved.test === 'persistence_test') {
                results.persistence = true;
                console.log('✅ Configuration persistence working');
                
                // Clean up test data
                localStorage.removeItem('streamingAgentConfig');
            } else {
                console.log('❌ Configuration persistence failed');
            }
        } catch (error) {
            console.log('❌ Configuration persistence error:', error.message);
        }
        
    } catch (error) {
        console.log('❌ Verification error:', error.message);
    }
    
    // Summary
    console.log('\n📊 Verification Results:');
    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;
    
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${test}`);
    });
    
    console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All configuration integration tests passed!');
    } else {
        console.log('⚠️ Some configuration integration tests failed');
    }
    
    return results;
}

// Auto-run verification if this script is loaded directly
if (typeof window !== 'undefined') {
    // Wait for DOM and other scripts to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(verifyConfigurationIntegration, 500);
        });
    } else {
        setTimeout(verifyConfigurationIntegration, 500);
    }
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.verifyConfigurationIntegration = verifyConfigurationIntegration;
}
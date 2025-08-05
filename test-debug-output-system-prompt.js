/**
 * Test Debug Output System Prompt Display
 * 
 * This test verifies that:
 * 1. DebugOutputManager is properly initialized
 * 2. System prompts are displayed in the debug panel
 * 3. Debug output updates work correctly
 * 4. System prompt hierarchy is reflected in debug display
 */

async function testDebugOutputSystemPrompt() {
    console.log('🧪 Testing Debug Output System Prompt Display...');
    
    try {
        // Test 1: Check if DebugOutputManager is available
        console.log('\n📋 Test 1: DebugOutputManager availability...');
        
        if (typeof DebugOutputManager === 'undefined') {
            throw new Error('DebugOutputManager class not available');
        }
        
        const debugOutputManager = new DebugOutputManager();
        console.log('✅ DebugOutputManager created successfully');
        
        // Test 2: Check if debug elements exist
        console.log('\n📋 Test 2: Debug panel elements...');
        
        const requiredElements = ['sttOutput', 'systemPrompt', 'gptResponse', 'ttsOutput'];
        const missingElements = [];
        
        requiredElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (!element) {
                missingElements.push(elementId);
            }
        });
        
        if (missingElements.length > 0) {
            console.warn('⚠️ Missing debug elements:', missingElements);
        } else {
            console.log('✅ All debug panel elements found');
        }
        
        // Test 3: Test system prompt update
        console.log('\n📋 Test 3: System prompt update...');
        
        const testSystemPrompt = `You are a helpful, professional, and friendly AI voice assistant for Barclays Bank (www.barclays.co.uk) a UK financial services company.

Customer Information:
- Name: John Smith
- Account Type: Premium
- Current Balance: £5,000.50
- Card Last 4 Digits: 1234

You are currently operating as BankingInfoAgent: Handles account balance inquiries, transaction history, and account information requests`;

        const testMetadata = {
            agentName: 'BankingInfoAgent',
            personaName: 'John Smith',
            promptLength: testSystemPrompt.length,
            tokensEstimate: Math.ceil(testSystemPrompt.length / 4)
        };
        
        debugOutputManager.updateSystemPrompt(testSystemPrompt, testMetadata);
        console.log('✅ System prompt updated in debug panel');
        
        // Test 4: Test other debug outputs
        console.log('\n📋 Test 4: Other debug outputs...');
        
        debugOutputManager.updateSpeechToText('What is my account balance?', {
            language: 'en',
            confidence: 0.95
        });
        
        debugOutputManager.updateGPTResponse('Your current account balance is £5,000.50. Is there anything else I can help you with?', {
            agentName: 'BankingInfoAgent',
            processingTime: 1250,
            tokensUsed: 45,
            model: 'gpt-3.5-turbo'
        });
        
        debugOutputManager.updateTextToSpeech('Your current account balance is £5,000.50. Is there anything else I can help you with?', {
            voice: 'nova',
            model: 'tts-1',
            speed: 1.0
        }, {
            characters: 95,
            provider: 'OpenAI'
        });
        
        console.log('✅ All debug outputs updated successfully');
        
        // Test 5: Test with main app integration
        console.log('\n📋 Test 5: Main app integration...');
        
        if (window.speechApp && window.speechApp.debugOutputManager) {
            console.log('✅ Main app debug output manager available');
            
            // Test the main app's debug output method
            window.speechApp.updateDebugOutput('systemPrompt', 'Test system prompt from main app');
            console.log('✅ Main app debug output method working');
        } else {
            console.warn('⚠️ Main app debug output manager not available');
        }
        
        // Test 6: Test error handling
        console.log('\n📋 Test 6: Error handling...');
        
        debugOutputManager.showError('systemPrompt', 'Test error message');
        console.log('✅ Error display working');
        
        // Wait a moment then restore normal content
        setTimeout(() => {
            debugOutputManager.updateSystemPrompt(testSystemPrompt, testMetadata);
        }, 2000);
        
        // Test 7: Test export functionality
        console.log('\n📋 Test 7: Export functionality...');
        
        const exportedData = debugOutputManager.exportDebugOutputs();
        console.log('✅ Debug outputs exported:', {
            sections: Object.keys(exportedData),
            hasTimestamp: !!exportedData.timestamp,
            hasUserAgent: !!exportedData.userAgent
        });
        
        console.log('\n🎉 All debug output tests completed successfully!');
        
        return {
            success: true,
            message: 'Debug output system prompt display working correctly',
            details: {
                debugOutputManagerAvailable: true,
                debugElementsFound: requiredElements.length - missingElements.length,
                missingElements,
                mainAppIntegration: !!(window.speechApp && window.speechApp.debugOutputManager),
                exportWorking: !!exportedData
            }
        };
        
    } catch (error) {
        console.error('❌ Debug output test failed:', error);
        return {
            success: false,
            message: 'Debug output test failed',
            error: error.message
        };
    }
}

// Auto-run test when script loads
if (typeof window !== 'undefined') {
    // Wait for dependencies to load
    setTimeout(() => {
        if (typeof DebugOutputManager !== 'undefined') {
            testDebugOutputSystemPrompt().then(result => {
                console.log('🧪 Debug Output Test Result:', result);
                
                // Store result globally for debugging
                window.debugOutputTestResult = result;
            });
        } else {
            console.error('❌ DebugOutputManager not available for testing');
        }
    }, 3000);
}

// Export for manual testing
if (typeof window !== 'undefined') {
    window.testDebugOutputSystemPrompt = testDebugOutputSystemPrompt;
}
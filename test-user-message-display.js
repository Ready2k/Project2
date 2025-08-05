/**
 * Simple test to verify user messages are displaying in streaming mode
 * Run this in browser console: testUserMessageDisplay()
 */

function testUserMessageDisplay() {
    console.log('🧪 Testing User Message Display...\n');
    
    // Check if SpeechApp is available
    if (!window.speechApp) {
        console.log('❌ window.speechApp not available');
        return false;
    }
    
    // Check if StreamingManager is available
    if (!window.speechApp.streamingManager) {
        console.log('❌ window.speechApp.streamingManager not available');
        return false;
    }
    
    const streamingManager = window.speechApp.streamingManager;
    
    // Check if displayUserMessage method exists
    if (typeof streamingManager.displayUserMessage !== 'function') {
        console.log('❌ displayUserMessage method not available');
        return false;
    }
    
    console.log('✅ All components available, testing message display...');
    
    // Test message
    const testMessage = "What's my balance?";
    
    try {
        // Call displayUserMessage
        streamingManager.displayUserMessage(testMessage);
        
        // Check if message appeared in conversation
        const conversation = document.getElementById('conversation');
        if (!conversation) {
            console.log('❌ Conversation element not found');
            return false;
        }
        
        // Look for user messages
        const userMessages = conversation.querySelectorAll('.user-message');
        if (userMessages.length === 0) {
            console.log('❌ No user messages found in conversation');
            return false;
        }
        
        // Check if our test message is there
        const lastMessage = userMessages[userMessages.length - 1];
        const messageContent = lastMessage.querySelector('.message-content');
        
        if (messageContent && messageContent.textContent.includes(testMessage)) {
            console.log('✅ User message displayed successfully!');
            console.log('Message content:', messageContent.textContent);
            
            // Also check if conversation context was updated
            if (window.conversationContextManager) {
                const history = window.conversationContextManager.getHistory(1);
                if (history.length > 0 && history[0].content === testMessage) {
                    console.log('✅ Message also added to conversation context');
                } else {
                    console.log('⚠️ Message not found in conversation context');
                }
            } else {
                console.log('⚠️ ConversationContextManager not available');
            }
            
            return true;
        } else {
            console.log('❌ Test message not found in displayed content');
            console.log('Expected:', testMessage);
            console.log('Found:', messageContent?.textContent);
            return false;
        }
        
    } catch (error) {
        console.log('❌ Error testing user message display:', error.message);
        return false;
    }
}

// Test streaming mode activation
function testStreamingModeActivation() {
    console.log('🧪 Testing Streaming Mode Activation...\n');
    
    if (!window.speechApp) {
        console.log('❌ SpeechApp not available');
        return false;
    }
    
    // Check current streaming mode
    const isStreamingMode = window.speechApp.isStreamingMode;
    console.log('Current streaming mode:', isStreamingMode);
    
    // Check if streaming manager is connected
    if (window.speechApp.streamingManager) {
        const isConnected = window.speechApp.streamingManager.isConnected;
        console.log('StreamingManager connected:', isConnected);
        
        if (!isConnected) {
            console.log('💡 Try enabling streaming mode and connecting first');
            return false;
        }
    }
    
    return true;
}

// Comprehensive test
async function runUserMessageTests() {
    console.log('🚀 Running User Message Display Tests...\n');
    
    const results = {
        streamingModeActivation: testStreamingModeActivation(),
        userMessageDisplay: testUserMessageDisplay()
    };
    
    console.log('\n📊 Test Results:');
    console.table(results);
    
    if (results.userMessageDisplay) {
        console.log('🎉 User message display is working correctly!');
    } else {
        console.log('❌ User message display has issues. Check the logs above.');
        
        console.log('\n🔧 Troubleshooting steps:');
        console.log('1. Make sure streaming mode is enabled');
        console.log('2. Check if StreamingManager is connected');
        console.log('3. Verify conversation element exists in DOM');
        console.log('4. Check browser console for errors');
    }
    
    return results;
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.testUserMessageDisplay = testUserMessageDisplay;
    window.testStreamingModeActivation = testStreamingModeActivation;
    window.runUserMessageTests = runUserMessageTests;
    
    console.log('🔧 User message display tests loaded. Run: runUserMessageTests()');
}
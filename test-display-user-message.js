/**
 * Simple test to manually test displayUserMessage function
 * Run in browser console: testDisplayUserMessage()
 */

function testDisplayUserMessage() {
    console.log('🧪 Testing displayUserMessage function...');
    
    // Check if speechApp and streamingManager are available
    if (!window.speechApp) {
        console.error('❌ window.speechApp not available');
        return false;
    }
    
    if (!window.speechApp.streamingManager) {
        console.error('❌ window.speechApp.streamingManager not available');
        return false;
    }
    
    const streamingManager = window.speechApp.streamingManager;
    
    // Check if displayUserMessage function exists
    if (typeof streamingManager.displayUserMessage !== 'function') {
        console.error('❌ displayUserMessage function not available');
        return false;
    }
    
    console.log('✅ All components available');
    
    // Test with a simple message
    const testMessage = "This is a test user message";
    
    console.log('🔍 Before test - conversation element:', document.getElementById('conversation'));
    console.log('🔍 Before test - user messages count:', document.querySelectorAll('.user-message').length);
    
    try {
        // Call the function
        streamingManager.displayUserMessage(testMessage);
        
        // Check results
        setTimeout(() => {
            const conversation = document.getElementById('conversation');
            const userMessages = conversation ? conversation.querySelectorAll('.user-message') : [];
            
            console.log('🔍 After test - user messages count:', userMessages.length);
            
            if (userMessages.length > 0) {
                const lastMessage = userMessages[userMessages.length - 1];
                const messageContent = lastMessage.querySelector('.message-content');
                console.log('🔍 Last user message content:', messageContent?.textContent);
                
                if (messageContent && messageContent.textContent === testMessage) {
                    console.log('✅ Test PASSED - User message displayed correctly!');
                    return true;
                } else {
                    console.log('❌ Test FAILED - Message content mismatch');
                    return false;
                }
            } else {
                console.log('❌ Test FAILED - No user messages found');
                return false;
            }
        }, 100);
        
    } catch (error) {
        console.error('❌ Error during test:', error);
        return false;
    }
}

function inspectConversationElement() {
    console.log('🔍 Inspecting conversation element...');
    
    const conversation = document.getElementById('conversation');
    console.log('Conversation element:', conversation);
    
    if (conversation) {
        console.log('Conversation innerHTML length:', conversation.innerHTML.length);
        console.log('Conversation children count:', conversation.children.length);
        console.log('User messages count:', conversation.querySelectorAll('.user-message').length);
        console.log('Bot messages count:', conversation.querySelectorAll('.bot-message').length);
        
        // Show structure
        Array.from(conversation.children).forEach((child, index) => {
            console.log(`Child ${index}:`, child.className, child.textContent?.substring(0, 50));
        });
    } else {
        console.error('❌ Conversation element not found!');
    }
}

function simulateTranscriptionEvent() {
    console.log('🧪 Simulating transcription event...');
    
    if (!window.speechApp?.streamingManager) {
        console.error('❌ StreamingManager not available');
        return;
    }
    
    const streamingManager = window.speechApp.streamingManager;
    
    // Create a mock transcription event
    const mockMessage = {
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: 'This is a simulated transcription test'
    };
    
    const mockEvent = {
        data: JSON.stringify(mockMessage)
    };
    
    console.log('🔍 Simulating handleMessage with:', mockMessage);
    
    try {
        streamingManager.handleMessage(mockEvent);
        console.log('✅ Transcription event simulated');
    } catch (error) {
        console.error('❌ Error simulating transcription event:', error);
    }
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.testDisplayUserMessage = testDisplayUserMessage;
    window.inspectConversationElement = inspectConversationElement;
    window.simulateTranscriptionEvent = simulateTranscriptionEvent;
    
    console.log('🔧 Display user message tests loaded');
    console.log('Available functions:');
    console.log('- testDisplayUserMessage() - Test the display function directly');
    console.log('- inspectConversationElement() - Inspect the conversation DOM');
    console.log('- simulateTranscriptionEvent() - Simulate a transcription event');
}
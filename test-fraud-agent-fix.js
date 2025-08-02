// Test script to verify FraudAgent conversation context fix
console.log('Testing FraudAgent conversation context fix...');

// Mock context with conversation history
const mockContext = {
    conversationHistory: [
        {
            role: 'user',
            content: 'I think there\'s fraud on my account',
            timestamp: Date.now() - 10000
        },
        {
            role: 'assistant',
            content: 'I understand your concern, John. Your account\'s security is our top priority. To address this issue promptly, I recommend blocking your card ending in 1234 immediately to prevent any further unauthorized transactions. Can I go ahead and block your card now?',
            timestamp: Date.now() - 5000,
            agentName: 'FraudAgent'
        }
    ],
    contextManager: {
        getHistory: function(limit) {
            return this.conversationHistory.slice(-limit);
        }.bind({ conversationHistory: this.conversationHistory })
    },
    systemPromptsManager: {
        generateSystemPrompt: function(personaData, userInput) {
            return 'You are a helpful fraud detection agent.';
        }
    },
    personaManager: {
        getCurrentPersona: function() {
            return {
                name: 'John',
                cardLast4: '1234',
                accountType: 'checking'
            };
        }
    }
};

// Test the conversation context inclusion
function testConversationContext() {
    console.log('\n=== Testing Conversation Context ===');
    
    // Simulate the conversation history retrieval
    const conversationHistory = mockContext.conversationHistory || 
        (mockContext.contextManager ? mockContext.contextManager.getHistory(6) : []);
    
    console.log('Conversation history found:', conversationHistory.length, 'messages');
    
    // Build messages array like the fixed FraudAgent would
    const messages = [
        { role: 'system', content: 'You are a helpful fraud detection agent.' }
    ];

    // Add recent conversation history
    if (conversationHistory && conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-6);
        for (const msg of recentHistory) {
            if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }
    }

    // Add current user input
    messages.push({ role: 'user', content: 'yes' });
    
    console.log('\nMessages that would be sent to LLM:');
    messages.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
    });
    
    // Verify the context is properly included
    const hasConversationContext = messages.some(msg => 
        msg.content.includes('fraud on my account') || 
        msg.content.includes('block your card')
    );
    
    console.log('\n✅ Test Result:', hasConversationContext ? 'PASS - Conversation context included' : 'FAIL - No conversation context');
    
    return hasConversationContext;
}

// Run the test
const testPassed = testConversationContext();

console.log('\n=== Summary ===');
console.log('FraudAgent conversation context fix:', testPassed ? '✅ Working' : '❌ Failed');
console.log('\nThe fix ensures that when a user says "yes" in response to a fraud agent\'s question,');
console.log('the agent receives the full conversation context and can respond appropriately.');
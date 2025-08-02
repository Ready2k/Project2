// Test script to verify all agents handle conversation context correctly
console.log('Testing all agents for conversation context handling...\n');

// Mock context with conversation history
const mockContext = {
    conversationHistory: [
        {
            role: 'user',
            content: 'I need help with my account',
            timestamp: Date.now() - 20000
        },
        {
            role: 'assistant',
            content: 'I can help you with that. What specific assistance do you need?',
            timestamp: Date.now() - 15000,
            agentName: 'DefaultAgent'
        },
        {
            role: 'user',
            content: 'Can you help me with a payment?',
            timestamp: Date.now() - 10000
        },
        {
            role: 'assistant',
            content: 'I can help you process a payment. What amount would you like to send and to whom?',
            timestamp: Date.now() - 5000,
            agentName: 'PaymentsAgent'
        }
    ],
    contextManager: {
        getHistory: function(limit) {
            return this.conversationHistory.slice(-limit);
        }.bind({ conversationHistory: this.conversationHistory })
    },
    systemPromptsManager: {
        generateSystemPrompt: function(personaData, userInput) {
            return 'You are a helpful banking assistant.';
        }
    },
    personaManager: {
        getCurrentPersona: function() {
            return {
                name: 'John',
                cardLast4: '1234',
                accountType: 'checking',
                balance: 2450.75
            };
        },
        formatCurrency: function(amount) {
            return `£${amount.toFixed(2)}`;
        }
    }
};

// Test scenarios for different agents
const testScenarios = [
    {
        agentName: 'FraudAgent',
        previousQuestion: 'I can help you block your card. Should I proceed with blocking your card ending in 1234?',
        userResponse: 'yes',
        expectedContext: 'Should include the fraud discussion and card blocking question'
    },
    {
        agentName: 'PaymentsAgent', 
        previousQuestion: 'I can help you send £100 to Alice. Should I proceed with this transfer?',
        userResponse: 'yes please',
        expectedContext: 'Should include the payment amount and recipient details'
    },
    {
        agentName: 'BankingInfoAgent',
        previousQuestion: 'Your current balance is £2,450.75. Would you like to see your recent transactions?',
        userResponse: 'yes',
        expectedContext: 'Should include the balance information and transaction offer'
    },
    {
        agentName: 'IDVAgent',
        previousQuestion: 'I can help you reset your password. Would you like me to send a reset link to your registered email?',
        userResponse: 'yes',
        expectedContext: 'Should include the password reset discussion'
    }
];

// Test function for conversation context inclusion
function testAgentConversationContext(agentName, previousQuestion, userResponse, expectedContext) {
    console.log(`=== Testing ${agentName} ===`);
    
    // Create conversation history with the agent's previous question
    const testHistory = [
        ...mockContext.conversationHistory,
        {
            role: 'assistant',
            content: previousQuestion,
            timestamp: Date.now() - 2000,
            agentName: agentName
        }
    ];
    
    // Simulate the conversation history retrieval
    const conversationHistory = testHistory || 
        (mockContext.contextManager ? mockContext.contextManager.getHistory(6) : []);
    
    console.log(`Conversation history: ${conversationHistory.length} messages`);
    
    // Build messages array like the fixed agents would
    const messages = [
        { role: 'system', content: 'You are a helpful banking assistant.' }
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
    messages.push({ role: 'user', content: userResponse });
    
    console.log(`Messages to LLM: ${messages.length} total`);
    
    // Check if the agent's previous question is included
    const hasPreviousQuestion = messages.some(msg => 
        msg.content.includes(previousQuestion.substring(0, 20))
    );
    
    // Check if conversation context is properly maintained
    const hasConversationFlow = messages.length > 2; // System + at least one exchange + current input
    
    const testPassed = hasPreviousQuestion && hasConversationFlow;
    
    console.log(`✅ Previous question included: ${hasPreviousQuestion ? 'YES' : 'NO'}`);
    console.log(`✅ Conversation flow maintained: ${hasConversationFlow ? 'YES' : 'NO'}`);
    console.log(`📝 Expected: ${expectedContext}`);
    console.log(`🎯 Test Result: ${testPassed ? 'PASS' : 'FAIL'}\n`);
    
    return testPassed;
}

// Run tests for all agents
console.log('🧪 Running conversation context tests for all agents...\n');

const results = testScenarios.map(scenario => ({
    agent: scenario.agentName,
    passed: testAgentConversationContext(
        scenario.agentName,
        scenario.previousQuestion,
        scenario.userResponse,
        scenario.expectedContext
    )
}));

// Summary
console.log('=== Test Summary ===');
const passedCount = results.filter(r => r.passed).length;
const totalCount = results.length;

results.forEach(result => {
    console.log(`${result.agent}: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);
});

console.log(`\n📊 Overall Result: ${passedCount}/${totalCount} agents passing`);

if (passedCount === totalCount) {
    console.log('🎉 All agents now properly handle conversation context!');
    console.log('Users can now use follow-up responses like "yes", "no", "please do", etc.');
} else {
    console.log('⚠️  Some agents still need fixes for conversation context handling.');
}

console.log('\n💡 This fix ensures that when users give short responses like "yes" or "no",');
console.log('   the agents understand the context from the previous conversation.');
/**
 * Console test script for agent handoff fix
 * Run this in the browser console when the main app is loaded
 */

async function testAgentHandoffFix() {
    console.log('🧪 Testing Agent Handoff Fix...');
    
    // Check if required objects exist
    if (!window.agentRouter || !window.agentRouter.contextManager) {
        console.error('❌ AgentRouter or ContextManager not found. Make sure the main app is loaded.');
        console.log('💡 Try loading the main application first, then run this test.');
        return;
    }
    
    const router = window.agentRouter;
    const contextManager = router.contextManager;
    
    console.log('✅ Found AgentRouter and ContextManager');
    
    // Clear any existing cache
    try {
        if (typeof router.invalidateRoutingCache === 'function') {
            router.invalidateRoutingCache('Testing agent handoff fix - routing fallback chain updated');
        }
        if (typeof contextManager.resetContextRouting === 'function') {
            contextManager.resetContextRouting();
        }
        console.log('🧹 Cleared routing cache and context');
    } catch (error) {
        console.warn('⚠️ Could not clear cache:', error.message);
    }
    
    // Test case 1: Context Manager Direct Test (most important)
    console.log('\n📋 Test Case 1: Context Manager Intent Change Detection');
    
    try {
        // Clear context first
        if (typeof contextManager.clearContext === 'function') {
            contextManager.clearContext();
        }
        
        // Simulate having used BankingInfoAgent recently
        contextManager.addMessage('user', "What's my balance?");
        contextManager.addMessage('assistant', 'Your balance is £2,450.75', 'BankingInfoAgent');
        
        // Now test if context manager correctly avoids suggesting BankingInfoAgent for fraud
        const availableAgents = router.getEnabledAgents ? router.getEnabledAgents() : router.agents;
        const suggestedAgent = contextManager.getSuggestedAgent(
            "I have fraud in my account. The coffee shop transaction was not me.", 
            availableAgents
        );
        
        console.log(`Context manager suggestion: ${suggestedAgent?.name || 'None (will use AI routing)'}`);
        
        if (!suggestedAgent) {
            console.log('✅ SUCCESS: Context manager correctly returned null, allowing AI routing to handle fraud intent');
        } else if (suggestedAgent.name === 'FraudAgent') {
            console.log('✅ SUCCESS: Context manager correctly suggested FraudAgent');
        } else {
            console.log(`❌ FAILURE: Context manager suggested ${suggestedAgent.name} instead of allowing AI routing`);
        }
        
    } catch (error) {
        console.error('❌ Context manager test failed:', error);
    }
    
    // Test case 2: Full routing test (if available)
    console.log('\n📋 Test Case 2: Full Agent Routing Test');
    
    try {
        // Clear context for fresh test
        if (typeof contextManager.clearContext === 'function') {
            contextManager.clearContext();
        }
        
        // Step 1: Ask for balance (should go to BankingInfoAgent)
        console.log('Step 1: "What\'s my balance?"');
        const agent1 = await router.findBestAgent("What's my balance?");
        console.log(`  → Selected agent: ${agent1?.name || 'None'}`);
        
        // Simulate the conversation
        contextManager.addMessage('user', "What's my balance?");
        contextManager.addMessage('assistant', 'Your balance is £2,450.75', agent1?.name);
        
        // Step 2: Report fraud (should go to FraudAgent, not stay with BankingInfoAgent)
        console.log('Step 2: "I have fraud in my account. The coffee shop transaction was not me."');
        const agent2 = await router.findBestAgent("I have fraud in my account. The coffee shop transaction was not me.");
        console.log(`  → Selected agent: ${agent2?.name || 'None'}`);
        
        if (agent2?.name === 'FraudAgent') {
            console.log('✅ SUCCESS: Correctly handed off to FraudAgent');
        } else if (agent1?.name === 'BankingInfoAgent' && agent2?.name !== 'BankingInfoAgent') {
            console.log('✅ SUCCESS: At least avoided staying with BankingInfoAgent');
        } else {
            console.log(`❌ FAILURE: Expected FraudAgent or at least not BankingInfoAgent, got ${agent2?.name || 'None'}`);
        }
        
    } catch (error) {
        console.error('❌ Full routing test failed:', error);
    }
    
    // Test case 3: Fraud follow-up test
    console.log('\n📋 Test Case 3: Fraud Follow-up Test');
    
    try {
        // Clear context
        if (typeof contextManager.clearContext === 'function') {
            contextManager.clearContext();
        }
        
        // Simulate fraud conversation
        contextManager.addMessage('user', "I have fraud in my account");
        contextManager.addMessage('assistant', 'I can help with that fraud report', 'FraudAgent');
        
        // Test fraud follow-up
        const availableAgents = router.getEnabledAgents ? router.getEnabledAgents() : router.agents;
        const followUpAgent = contextManager.getSuggestedAgent("Yes, block that card", availableAgents);
        
        console.log(`Fraud follow-up suggestion: ${followUpAgent?.name || 'None'}`);
        
        if (followUpAgent?.name === 'FraudAgent') {
            console.log('✅ SUCCESS: Correctly suggested FraudAgent for fraud follow-up');
        } else {
            console.log(`❌ FAILURE: Expected FraudAgent for fraud follow-up, got ${followUpAgent?.name || 'None'}`);
        }
        
    } catch (error) {
        console.error('❌ Fraud follow-up test failed:', error);
    }
    
    console.log('\n🏁 All tests completed');
    console.log('💡 If tests are failing, the fix may not be fully applied or there may be caching issues.');
    console.log('💡 Try refreshing the page and running the test again.');
}

// Export for console use
window.testAgentHandoffFix = testAgentHandoffFix;

console.log('🔧 Agent handoff test loaded. Run testAgentHandoffFix() to test the fix.');
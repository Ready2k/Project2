/**
 * Test script for FraudAgent guardrails fix
 * Run this in the browser console to test the FraudAgent fix
 */

async function testFraudAgentFix() {
    console.log('🧪 Testing FraudAgent Guardrails Fix...');
    
    // Check if required objects exist
    if (!window.agentRouter) {
        console.error('❌ AgentRouter not found. Make sure the main app is loaded.');
        return;
    }
    
    const router = window.agentRouter;
    
    console.log('✅ Found AgentRouter');
    
    // Clear cache first
    try {
        if (typeof router.invalidateRoutingCache === 'function') {
            router.invalidateRoutingCache('Testing FraudAgent fix');
        }
        console.log('🧹 Cleared routing cache');
    } catch (error) {
        console.warn('⚠️ Could not clear cache:', error.message);
    }
    
    // Test case 1: Fraud reporting (should NOT trigger blockCard validation)
    console.log('\n📋 Test Case 1: Fraud Reporting (No Card Blocking)');
    
    try {
        console.log('Testing: "That transaction is fraud. I want my money back."');
        const agent1 = await router.findBestAgent("That transaction is fraud. I want my money back.");
        console.log(`  → Selected agent: ${agent1?.name || 'None'}`);
        
        if (agent1?.name === 'FraudAgent') {
            console.log('✅ SUCCESS: Correctly routed to FraudAgent');
            
            // Now test if the agent can handle the request without guardrails violation
            try {
                const mockContext = {
                    apiClient: router.apiClient,
                    personaManager: window.personaManager,
                    systemPromptsManager: window.systemPromptsManager
                };
                
                console.log('  → Testing FraudAgent processing...');
                const response = await agent1.handle("That transaction is fraud. I want my money back.", mockContext);
                
                if (response && response.success !== false) {
                    console.log('✅ SUCCESS: FraudAgent processed fraud report without guardrails violation');
                } else {
                    console.log('❌ FAILURE: FraudAgent failed to process fraud report');
                    console.log('  Error:', response?.error || 'Unknown error');
                }
                
            } catch (error) {
                if (error.message.includes('blockCard requires secondary authentication')) {
                    console.log('❌ FAILURE: FraudAgent still trying to validate blockCard for fraud reporting');
                } else {
                    console.log('⚠️ Other error:', error.message);
                }
            }
            
        } else {
            console.log(`❌ FAILURE: Expected FraudAgent, got ${agent1?.name || 'None'}`);
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
    
    // Test case 2: Explicit card blocking (should trigger blockCard validation)
    console.log('\n📋 Test Case 2: Explicit Card Blocking Request');
    
    try {
        console.log('Testing: "Block my card immediately"');
        const agent2 = await router.findBestAgent("Block my card immediately");
        console.log(`  → Selected agent: ${agent2?.name || 'None'}`);
        
        if (agent2?.name === 'FraudAgent') {
            console.log('✅ SUCCESS: Correctly routed to FraudAgent');
            
            try {
                const mockContext = {
                    apiClient: router.apiClient,
                    personaManager: window.personaManager,
                    systemPromptsManager: window.systemPromptsManager
                };
                
                console.log('  → Testing FraudAgent processing...');
                const response = await agent2.handle("Block my card immediately", mockContext);
                
                console.log('  → This should trigger guardrails validation (expected)');
                
            } catch (error) {
                if (error.message.includes('blockCard requires secondary authentication')) {
                    console.log('✅ SUCCESS: FraudAgent correctly triggered guardrails for explicit card blocking');
                } else {
                    console.log('⚠️ Unexpected error:', error.message);
                }
            }
            
        } else {
            console.log(`❌ FAILURE: Expected FraudAgent, got ${agent2?.name || 'None'}`);
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
    
    console.log('\n🏁 FraudAgent fix test completed');
    console.log('💡 The fix should allow fraud reporting without guardrails violations');
    console.log('💡 But still enforce guardrails for explicit card blocking requests');
}

// Export for console use
window.testFraudAgentFix = testFraudAgentFix;

console.log('🔧 FraudAgent fix test loaded. Run testFraudAgentFix() to test the fix.');
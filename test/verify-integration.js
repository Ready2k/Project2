/**
 * Simple verification script to test agent integration
 * Run with: node verify-integration.js
 */

// Mock the window object and required dependencies for Node.js testing
global.window = {
    debugManager: {
        createModuleLogger: (name) => ({
            info: (...args) => console.log(`[${name}] INFO:`, ...args),
            warn: (...args) => console.log(`[${name}] WARN:`, ...args),
            error: (...args) => console.log(`[${name}] ERROR:`, ...args),
            log: (...args) => console.log(`[${name}] LOG:`, ...args)
        }),
        isEnabled: () => true
    }
};

// Load agent classes
const BaseAgent = require('./agents/base-agent.js');
const IDVAgent = require('./agents/idv-agent.js');
const BankingInfoAgent = require('./agents/banking-info-agent.js');
const FraudAgent = require('./agents/fraud-agent.js');
const PaymentsAgent = require('./agents/payments-agent.js');
const { AgentRouter } = require('./agents/agent-router.js');

console.log('🧪 Testing Agent Integration...\n');

// Test 1: Agent instantiation
console.log('Test 1: Agent Instantiation');
try {
    const idvAgent = new IDVAgent();
    const bankingInfoAgent = new BankingInfoAgent();
    const fraudAgent = new FraudAgent();
    const paymentsAgent = new PaymentsAgent();
    
    console.log('✅ All agents instantiated successfully');
    console.log(`- IDVAgent: ${idvAgent.name}`);
    console.log(`- BankingInfoAgent: ${bankingInfoAgent.name}`);
    console.log(`- FraudAgent: ${fraudAgent.name}`);
    console.log(`- PaymentsAgent: ${paymentsAgent.name}`);
} catch (error) {
    console.log('❌ Agent instantiation failed:', error.message);
    process.exit(1);
}

// Test 2: AgentRouter initialization
console.log('\nTest 2: AgentRouter Initialization');
try {
    const agents = [
        new PaymentsAgent(),
        new FraudAgent(),
        new IDVAgent(),
        new BankingInfoAgent()
    ];
    
    const agentRouter = new AgentRouter(agents);
    console.log('✅ AgentRouter initialized successfully');
    console.log(`- Registered agents: ${agentRouter.getRegisteredAgents().length}`);
} catch (error) {
    console.log('❌ AgentRouter initialization failed:', error.message);
    process.exit(1);
}

// Test 3: Agent routing logic
console.log('\nTest 3: Agent Routing Logic');
try {
    const agents = [
        new PaymentsAgent(),
        new FraudAgent(),
        new IDVAgent(),
        new BankingInfoAgent()
    ];
    
    const agentRouter = new AgentRouter(agents);
    
    const testCases = [
        { input: "What's my account balance?", expected: "BankingInfoAgent" },
        { input: "I want to send £100 to John", expected: "PaymentsAgent" },
        { input: "My card was stolen, please block it", expected: "FraudAgent" },
        { input: "I forgot my password", expected: "IDVAgent" },
        { input: "Hello, how are you?", expected: null } // Should return null (fallback)
    ];
    
    let passed = 0;
    let total = testCases.length;
    
    for (const testCase of testCases) {
        const selectedAgent = agentRouter.findBestAgent(testCase.input);
        const agentName = selectedAgent ? selectedAgent.name : null;
        
        if (agentName === testCase.expected) {
            console.log(`✅ "${testCase.input}" -> ${agentName || 'Fallback'}`);
            passed++;
        } else {
            console.log(`❌ "${testCase.input}" -> ${agentName || 'Fallback'} (expected: ${testCase.expected || 'Fallback'})`);
        }
    }
    
    console.log(`\nRouting test results: ${passed}/${total} passed`);
    
    if (passed === total) {
        console.log('✅ All routing tests passed!');
    } else {
        console.log('❌ Some routing tests failed');
    }
    
} catch (error) {
    console.log('❌ Agent routing test failed:', error.message);
    process.exit(1);
}

console.log('\n🎉 Agent integration verification completed!');
console.log('\nNext steps:');
console.log('1. Open index.html in a browser');
console.log('2. Test the voice interface with different types of requests');
console.log('3. Check the debug output to see which agents are being used');
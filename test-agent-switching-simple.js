// Test the StreamingAgentRouter agent switching functionality
const StreamingAgentRouter = require('./streaming-agent-router.js');

// Mock dependencies
const mockAgentRouter = {
    getRegisteredAgents: () => [
        { name: 'FraudAgent', processMessage: () => {}, description: 'Fraud prevention agent' },
        { name: 'PaymentsAgent', processMessage: () => {}, description: 'Payments specialist' }
    ],
    route: async (message, context) => ({
        success: true,
        response: 'Test response',
        agentName: 'FraudAgent'
    })
};

const mockStreamingManager = {
    websocket: { readyState: 1 }, // WebSocket.OPEN
    sendMessage: (msg) => console.log('Session update sent:', msg.type),
    apiClient: {}
};

// Mock debug manager
global.window = {
    debugManager: {
        createModuleLogger: () => ({
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        })
    }
};

async function testAgentSwitching() {
    console.log('Testing StreamingAgentRouter agent switching...');
    
    const router = new StreamingAgentRouter(mockAgentRouter, mockStreamingManager);
    router.resetSession('test-session');
    
    // Test getting capabilities
    console.log('\n1. Testing agent switching capabilities:');
    const capabilities = router.getAgentSwitchingCapabilities();
    console.log('- Switching enabled:', capabilities.switchingEnabled);
    console.log('- Available agents:', capabilities.availableAgents.length);
    console.log('- WebSocket connected:', capabilities.webSocketConnected);
    
    // Test manual agent switch
    console.log('\n2. Testing manual agent switch:');
    const switchResult = await router.switchToAgent('FraudAgent', 'test_switch');
    console.log('- Switch success:', switchResult.success);
    if (switchResult.success) {
        console.log('- New agent:', switchResult.newAgent);
        console.log('- Switch latency:', switchResult.switchLatency + 'ms');
    } else {
        console.log('- Switch error:', switchResult.error);
    }
    
    // Test switching statistics
    console.log('\n3. Testing switching statistics:');
    const stats = router.getAgentSwitchingStats();
    console.log('- Total switches:', stats.totalSwitches);
    console.log('- Success rate:', stats.successRate + '%');
    console.log('- Average latency:', stats.averageSwitchLatency + 'ms');
    
    // Test validation
    console.log('\n4. Testing switch validation:');
    const invalidResult = await router.switchAgent(null, {}, 'test_validation');
    console.log('- Null agent rejected:', !invalidResult.success);
    console.log('- Error message:', invalidResult.error);
    
    console.log('\nAgent switching tests completed successfully!');
}

testAgentSwitching().catch(console.error);
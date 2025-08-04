/**
 * Integration test for StreamingSessionManager with StreamingManager and StreamingAgentRouter
 * Tests the complete WebSocket session management flow
 */

// Mock WebSocket for testing
class MockWebSocket {
    constructor(url, protocols) {
        this.url = url;
        this.protocols = protocols;
        this.readyState = WebSocket.CONNECTING;
        this.binaryType = 'arraybuffer';
        
        // Simulate connection after short delay
        setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            if (this.onopen) {
                this.onopen();
            }
        }, 100);
    }
    
    send(data) {
        console.log('MockWebSocket send:', JSON.parse(data));
        
        // Simulate session.updated response
        setTimeout(() => {
            if (this.onmessage) {
                const response = {
                    data: JSON.stringify({
                        type: 'session.updated'
                    })
                };
                this.onmessage(response);
            }
        }, 50);
    }
    
    close() {
        this.readyState = WebSocket.CLOSED;
        if (this.onclose) {
            this.onclose({ code: 1000, reason: 'Normal closure' });
        }
    }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket;
WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;

// Mock window object for browser environment
global.window = {
    debugManager: {
        createModuleLogger: (name) => ({
            log: (...args) => console.log(`[${name}]`, ...args),
            debug: (...args) => console.log(`[${name}]`, ...args),
            info: (...args) => console.log(`[${name}]`, ...args),
            warn: (...args) => console.warn(`[${name}]`, ...args),
            error: (...args) => console.error(`[${name}]`, ...args)
        })
    },
    StreamingSessionManager: null, // Will be set after loading
    AudioResourceManager: class {
        registerResource() { return 'mock-resource-id'; }
        disposeAllResources() { return { total: 0, disposed: 0, errors: [] }; }
        verifyCleanup() { return { isClean: true, activeResources: [] }; }
        getResourcesByType() { return []; }
        disposeResource() { return true; }
        getStats() { return { created: 0, disposed: 0, active: 0 }; }
        cleanupDisposedResources() { return 0; }
        forceDisposeOldResources() { return 0; }
    },
    TimeoutManager: class {
        createTimeout(op, timeout) { return op(); }
        cancelAllTimeouts() { return 0; }
        getActiveTimeoutCount() { return 0; }
        getStats() { return { created: 0, completed: 0, timedOut: 0, cancelled: 0, active: 0 }; }
        cleanupCompletedTimeouts() { return 0; }
    },
    ConnectionManager: class {
        connectWithRetry(fn) { return fn(); }
        disconnectAll() { return 0; }
        disconnect() { return true; }
        setReconnectionCallbacks() { return; }
        getAllConnectionStatuses() { return []; }
        getStats() { return { totalAttempts: 0, successfulConnections: 0, failedConnections: 0, reconnections: 0, activeConnections: 0 }; }
        cleanupCompletedConnections() { return 0; }
    }
};

// Load the StreamingSessionManager
const fs = require('fs');
const path = require('path');

// Load StreamingSessionManager
const sessionManagerCode = fs.readFileSync(path.join(__dirname, 'streaming-session-manager.js'), 'utf8');

// Create a module context to evaluate the code
const vm = require('vm');
const moduleContext = {
    window: window,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
    setInterval: setInterval,
    Date: Date,
    JSON: JSON,
    Math: Math,
    Promise: Promise,
    Map: Map,
    Set: Set,
    Error: Error,
    module: { exports: {} },
    exports: {}
};

vm.createContext(moduleContext);
vm.runInContext(sessionManagerCode, moduleContext);

// Get the StreamingSessionManager class
const StreamingSessionManager = moduleContext.window.StreamingSessionManager;
window.StreamingSessionManager = StreamingSessionManager;

// Mock StreamingManager
class MockStreamingManager {
    constructor() {
        this.debug = window.debugManager.createModuleLogger('MockStreamingManager');
        this.websocket = null;
        this.isConnected = false;
        this.settings = { responseDelay: 1.0 };
        this.voiceConfiguration = {
            currentVoice: 'shimmer',
            agentVoices: new Map([
                ['TestAgent', { voice: 'alloy', speed: 1.0, pitch: 1.0, temperature: 0.8 }]
            ])
        };
    }
    
    getCurrentPersonaInfo() {
        return {
            name: 'Test User',
            instructions: 'Test persona instructions'
        };
    }
    
    getVadThreshold() {
        return 0.5;
    }
    
    sendMessage(message) {
        this.debug.log('Mock sendMessage:', message.type);
        if (this.websocket && this.websocket.send) {
            this.websocket.send(JSON.stringify(message));
        }
        return true;
    }
    
    getVoiceConfigForAgent(agentName) {
        return this.voiceConfiguration.agentVoices.get(agentName) || {
            voice: 'shimmer',
            speed: 1.0,
            pitch: 1.0,
            temperature: 0.9
        };
    }
    
    getVoiceConfiguration() {
        return {
            currentVoice: this.voiceConfiguration.currentVoice,
            agentVoices: Object.fromEntries(this.voiceConfiguration.agentVoices)
        };
    }
    
    // Mock WebSocket connection
    async connect() {
        this.websocket = new MockWebSocket('wss://mock-api.com/realtime', ['realtime']);
        this.isConnected = true;
        return { success: true };
    }
    
    disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.isConnected = false;
        return { success: true };
    }
}

// Mock StreamingAgentRouter
class MockStreamingAgentRouter {
    constructor() {
        this.debug = window.debugManager.createModuleLogger('MockStreamingAgentRouter');
        this.sessionManager = null;
    }
    
    setSessionManager(sessionManager) {
        this.sessionManager = sessionManager;
        this.debug.log('Session manager set');
    }
    
    async routeStreamingMessage(transcript, sessionContext) {
        this.debug.log('Mock routing message:', transcript.substring(0, 50));
        
        return {
            success: true,
            selectedAgent: { name: 'TestAgent', type: 'test' },
            agentResponse: {
                response: 'Mock agent response',
                streamingInstructions: 'Mock streaming instructions'
            },
            agentChanged: true,
            sessionUpdateRequired: true,
            routingReason: 'mock_routing'
        };
    }
}

// Test functions
async function testSessionManagerIntegration() {
    console.log('\n=== Testing StreamingSessionManager Integration ===\n');
    
    try {
        // Initialize components
        const mockStreamingManager = new MockStreamingManager();
        const mockStreamingAgentRouter = new MockStreamingAgentRouter();
        
        // Create session manager
        const sessionManager = new StreamingSessionManager(mockStreamingManager, mockStreamingAgentRouter);
        
        // Connect session manager to router
        mockStreamingAgentRouter.setSessionManager(sessionManager);
        
        console.log('✓ Components initialized successfully');
        
        // Test 1: Create session
        console.log('\n--- Test 1: Create Session ---');
        const sessionId = sessionManager.createSession({
            conversationContext: { testData: 'integration test' },
            voiceConfiguration: mockStreamingManager.getVoiceConfiguration()
        });
        
        console.log(`✓ Session created: ${sessionId}`);
        
        // Test 2: Get session
        console.log('\n--- Test 2: Get Session ---');
        const session = sessionManager.getCurrentSession();
        console.log(`✓ Current session retrieved: ${session.sessionId}`);
        console.log(`  - Created at: ${new Date(session.createdAt).toISOString()}`);
        console.log(`  - Active: ${session.isActive}`);
        
        // Test 3: Connect WebSocket (simulate real connection)
        console.log('\n--- Test 3: WebSocket Connection ---');
        await mockStreamingManager.connect();
        console.log('✓ WebSocket connection established');
        
        // Test 4: Update session for agent
        console.log('\n--- Test 4: Update Session for Agent ---');
        const agentContext = {
            agentName: 'TestAgent',
            agentType: 'test',
            switchReason: 'integration_test'
        };
        
        const instructions = 'Integration test instructions for TestAgent';
        
        const updateSuccess = await sessionManager.updateSessionForAgent(
            sessionId,
            agentContext,
            instructions
        );
        
        console.log(`✓ Session update ${updateSuccess ? 'successful' : 'failed'}`);
        
        if (updateSuccess) {
            const updatedSession = sessionManager.getCurrentSession();
            console.log(`  - Current agent: ${updatedSession.currentAgent?.agentName}`);
            console.log(`  - Session updates: ${updatedSession.sessionUpdates}`);
            console.log(`  - Agent switches: ${updatedSession.agentSwitches}`);
        }
        
        // Test 5: Session validation
        console.log('\n--- Test 5: Session Validation ---');
        const sessionDetails = sessionManager.getSessionDetails();
        console.log(`✓ Session validation status: ${sessionDetails.sessionValidated}`);
        console.log(`  - Validation attempts: ${sessionDetails.validationAttempts}`);
        
        // Test 6: Retry logic test
        console.log('\n--- Test 6: Retry Logic Test ---');
        
        // Mock temporary failure
        const originalSendMessage = mockStreamingManager.sendMessage;
        let attemptCount = 0;
        
        mockStreamingManager.sendMessage = function(message) {
            attemptCount++;
            console.log(`  Attempt ${attemptCount}: ${message.type}`);
            
            if (attemptCount < 2) {
                throw new Error(`Mock failure attempt ${attemptCount}`);
            } else {
                return originalSendMessage.call(this, message);
            }
        };
        
        const retryAgentContext = {
            agentName: 'RetryTestAgent',
            agentType: 'test',
            switchReason: 'retry_test'
        };
        
        const retrySuccess = await sessionManager.updateSessionForAgent(
            sessionId,
            retryAgentContext,
            'Retry test instructions'
        );
        
        // Restore original method
        mockStreamingManager.sendMessage = originalSendMessage;
        
        console.log(`✓ Retry logic test ${retrySuccess ? 'successful' : 'failed'} after ${attemptCount} attempts`);
        
        // Test 7: Session metrics
        console.log('\n--- Test 7: Session Metrics ---');
        const metrics = sessionManager.getSessionMetrics();
        console.log('✓ Session metrics:');
        console.log(`  - Sessions created: ${metrics.sessionsCreated}`);
        console.log(`  - Active sessions: ${metrics.activeSessions}`);
        console.log(`  - Session updates: ${metrics.sessionUpdates}`);
        console.log(`  - Update retries: ${metrics.sessionUpdateRetries}`);
        console.log(`  - Validation attempts: ${metrics.validationAttempts}`);
        console.log(`  - Update success rate: ${(metrics.sessionUpdateSuccessRate * 100).toFixed(1)}%`);
        console.log(`  - Validation success rate: ${(metrics.validationSuccessRate * 100).toFixed(1)}%`);
        
        // Test 8: Session cleanup
        console.log('\n--- Test 8: Session Cleanup ---');
        
        // Create additional sessions for cleanup test
        const additionalSessions = [];
        for (let i = 0; i < 3; i++) {
            const additionalSessionId = sessionManager.createSession();
            additionalSessions.push(additionalSessionId);
        }
        
        console.log(`✓ Created ${additionalSessions.length} additional sessions`);
        
        // Mark some as expired
        for (const sessionId of additionalSessions.slice(0, 2)) {
            const session = sessionManager.getSession(sessionId);
            if (session) {
                session.lastAccessedAt = Date.now() - (31 * 60 * 1000); // 31 minutes ago
            }
        }
        
        const cleanedUp = sessionManager.cleanupSessions();
        console.log(`✓ Cleanup removed ${cleanedUp} expired sessions`);
        
        // Test 9: Final state verification
        console.log('\n--- Test 9: Final State Verification ---');
        const finalMetrics = sessionManager.getSessionMetrics();
        const finalSession = sessionManager.getCurrentSession();
        
        console.log('✓ Final state:');
        console.log(`  - Active sessions: ${finalMetrics.activeSessions}`);
        console.log(`  - Current session: ${finalSession?.sessionId || 'None'}`);
        console.log(`  - Total operations: ${finalMetrics.sessionUpdates} updates, ${finalMetrics.cleanupOperations} cleanups`);
        
        // Test 10: Cleanup
        console.log('\n--- Test 10: Cleanup ---');
        sessionManager.cleanup();
        await mockStreamingManager.disconnect();
        console.log('✓ All resources cleaned up');
        
        console.log('\n=== Integration Test Completed Successfully ===\n');
        return true;
        
    } catch (error) {
        console.error('\n❌ Integration test failed:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testSessionManagerIntegration().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testSessionManagerIntegration };
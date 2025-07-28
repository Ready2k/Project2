# Voice Banking Agent Architecture - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation & Setup](#installation--setup)
4. [Usage Guide](#usage-guide)
5. [API Reference](#api-reference)
6. [Security Features](#security-features)
7. [Performance Optimization](#performance-optimization)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)
10. [Examples](#examples)

## Overview

The Voice Banking Agent Architecture is a modular, domain-specific routing system designed for voice banking applications. It provides intelligent routing of user requests to specialized agents while maintaining strict security boundaries and seamless integration with existing voice functionality.

### Key Features
- **Domain-Specific Routing**: Automatically routes requests to appropriate specialized agents
- **Security Boundaries**: Enforces data access restrictions per agent domain
- **Streaming Compatibility**: Works with both batch and streaming voice processing modes
- **Token Tracking**: Comprehensive cost tracking across all API calls
- **Extensible Design**: Easy to add new agents and integrate with different LLM providers
- **Telemetry Support**: Built-in performance monitoring and debugging capabilities

### Supported Domains
- **Banking Information**: Account balances, transaction history, account details
- **Payments**: Money transfers, payment processing, transaction initiation
- **Fraud Detection**: Card blocking, fraud reporting, security alerts
- **Identity Verification**: Password resets, account verification, authentication

## Architecture

### High-Level Flow
```
User Voice Input → Whisper STT → AgentRouter → Domain Agent → LLM Processing → TTS → User
```

### Core Components

#### AgentRouter
Central routing component that evaluates user input and directs it to the most appropriate agent.

```javascript
class AgentRouter {
    constructor(agents = [])
    async route(inputText, context)
    findBestAgent(inputText)
    registerAgent(agent, config)
    getStats()
}
```

#### BaseAgent
Abstract base class that all domain agents extend, providing common functionality.

```javascript
class BaseAgent {
    constructor(name, description)
    canHandle(inputText)           // Abstract - must implement
    async handle(inputText, context) // Abstract - must implement
    onActivate()                   // Optional telemetry hook
    onComplete(result)             // Optional telemetry hook
}
```

#### Domain Agents

**BankingInfoAgent**
- Handles: Balance inquiries, transaction history, account information
- Triggers: "balance", "transactions", "account", "statement"
- Security: Read-only access to account data

**PaymentsAgent**
- Handles: Money transfers, payment processing, transaction initiation
- Triggers: "send", "transfer", "pay", "£[amount]"
- Security: Highest security level with transaction validation

**FraudAgent**
- Handles: Card blocking, fraud reporting, security alerts
- Triggers: "block", "freeze", "fraud", "suspicious", "stolen"
- Security: Security-focused actions only

**IDVAgent**
- Handles: Identity verification, password resets, authentication
- Triggers: "verify", "password", "identity", "reset"
- Security: Identity verification functions only

## Installation & Setup

### Prerequisites
- Modern web browser with ES6+ support
- OpenAI API key for LLM functionality
- Microphone access for voice input

### Basic Setup

1. **Include Required Files**
```html
<!-- Core dependencies -->
<script src="debug-manager.js"></script>
<script src="token-tracker.js"></script>
<script src="api-client.js"></script>

<!-- Agent system -->
<script src="agents/base-agent.js"></script>
<script src="agents/security-manager.js"></script>
<script src="agents/agent-config-manager.js"></script>
<script src="agents/agent-router.js"></script>

<!-- Domain agents -->
<script src="agents/banking-info-agent.js"></script>
<script src="agents/payments-agent.js"></script>
<script src="agents/fraud-agent.js"></script>
<script src="agents/idv-agent.js"></script>
```

2. **Initialize Agent System**
```javascript
// Initialize core components
const tokenTracker = new TokenTracker();
const apiClient = new OpenAIClient(apiKey, tokenTracker);

// Create domain agents
const agents = [
    new PaymentsAgent(),      // Highest priority
    new FraudAgent(),
    new IDVAgent(),
    new BankingInfoAgent()
];

// Initialize router
const agentRouter = new AgentRouter(agents);
```

3. **Integration with Voice App**
```javascript
class VoiceApp {
    constructor() {
        this.agentRouter = new AgentRouter([
            new PaymentsAgent(),
            new FraudAgent(),
            new IDVAgent(),
            new BankingInfoAgent()
        ]);
    }
    
    async processVoiceInput(transcribedText) {
        const context = {
            personaManager: this.personaManager,
            apiClient: this.apiClient,
            tokenTracker: this.tokenTracker
        };
        
        const result = await this.agentRouter.route(transcribedText, context);
        return result.response;
    }
}
```

## Usage Guide

### Basic Usage

#### Routing User Input
```javascript
const userInput = "What is my account balance?";
const context = {
    personaManager: personaManager,
    apiClient: apiClient,
    tokenTracker: tokenTracker
};

const result = await agentRouter.route(userInput, context);

if (result.success) {
    console.log(`Agent: ${result.agentName}`);
    console.log(`Response: ${result.response}`);
    console.log(`Processing time: ${result.processingTime}ms`);
} else {
    console.error(`Error: ${result.error}`);
}
```

#### Agent Management
```javascript
// Get routing statistics
const stats = agentRouter.getStats();
console.log(`Total agents: ${stats.totalAgents}`);
console.log(`Enabled agents: ${stats.enabledAgents}`);

// Enable/disable agents
agentRouter.enableAgent('PaymentsAgent');
agentRouter.disableAgent('FraudAgent');

// Set agent priorities (lower number = higher priority)
agentRouter.setAgentPriority('PaymentsAgent', 10);
agentRouter.setAgentPriority('BankingInfoAgent', 50);
```

### Advanced Configuration

#### Custom Agent Configuration
```javascript
const customConfig = {
    name: 'PaymentsAgent',
    enabled: true,
    priority: 10,
    llmProvider: 'openai',
    llmModel: 'gpt-4',
    systemPromptOverride: 'You are a specialized payment processing assistant.',
    telemetryEnabled: true,
    maxRetries: 3,
    timeout: 30000
};

agentRouter.registerAgent(new PaymentsAgent(), customConfig);
```

#### Streaming Mode Integration
```javascript
class StreamingVoiceApp {
    async handleStreamingInput(partialText, isFinal) {
        if (isFinal) {
            // Process complete input
            const result = await this.agentRouter.route(partialText, this.context);
            return result;
        } else {
            // Handle partial input (optional)
            const agent = this.agentRouter.findBestAgent(partialText);
            return { 
                agent: agent?.name || 'None', 
                partial: true,
                confidence: this.calculateConfidence(partialText)
            };
        }
    }
}
```

## API Reference

### AgentRouter

#### Constructor
```javascript
new AgentRouter(agents = [])
```
- `agents`: Array of BaseAgent instances to register

#### Methods

**route(inputText, context)**
```javascript
async route(inputText, context)
```
Routes user input to the most appropriate agent.
- `inputText`: String - User's input text
- `context`: Object - Application context containing dependencies
- Returns: Promise<AgentResponse>

**findBestAgent(inputText)**
```javascript
findBestAgent(inputText)
```
Finds the best agent for given input without processing.
- `inputText`: String - User's input text
- Returns: BaseAgent | null

**registerAgent(agent, config)**
```javascript
registerAgent(agent, config = null)
```
Registers a new agent with optional configuration.
- `agent`: BaseAgent - Agent instance to register
- `config`: Object - Optional configuration object

**getStats()**
```javascript
getStats()
```
Returns routing statistics and agent information.
- Returns: Object with agent statistics

### BaseAgent

#### Constructor
```javascript
new BaseAgent(name, description)
```
- `name`: String - Agent name
- `description`: String - Agent description

#### Abstract Methods (Must Implement)

**canHandle(inputText)**
```javascript
canHandle(inputText)
```
Determines if agent can handle the given input.
- `inputText`: String - User's input text
- Returns: Boolean

**handle(inputText, context)**
```javascript
async handle(inputText, context)
```
Processes the user input and returns response.
- `inputText`: String - User's input text
- `context`: Object - Application context
- Returns: Promise<AgentResponse>

#### Optional Methods

**onActivate(inputText, context)**
```javascript
onActivate(inputText, context)
```
Called when agent is activated for processing.

**onComplete(result, inputText, startTime)**
```javascript
onComplete(result, inputText, startTime)
```
Called when agent completes processing.

### AgentResponse Object
```javascript
{
    success: Boolean,
    response: String,
    agentName: String,
    processingTime: Number,
    tokensUsed: Number,
    error: String | null,
    metadata: Object
}
```

### Context Object
```javascript
{
    personaManager: PersonaManager,
    systemPromptsManager: SystemPromptsManager,
    apiClient: OpenAIClient,
    tokenTracker: TokenTracker,
    currentPersona: String,
    sessionData: Object,
    debugMode: Boolean
}
```

## Security Features

### Data Access Boundaries

Each agent is restricted to accessing only data within its designated domain:

```javascript
// Agent domain restrictions
const domainRestrictions = {
    'BankingInfoAgent': ['balance', 'transactions', 'account_info'],
    'PaymentsAgent': ['payments', 'transfers', 'payment_history'],
    'FraudAgent': ['fraud_alerts', 'security_actions', 'card_status'],
    'IDVAgent': ['identity', 'verification', 'authentication']
};
```

### API Sandboxing

Agents receive sandboxed API clients that prevent unauthorized access:

```javascript
// Automatic sandboxing setup
const securityManager = new SecurityManager();
const sandboxedClient = securityManager.createSandboxedApiClient(
    agentName, 
    originalApiClient
);
agent.setSandboxedApiClient(sandboxedClient);
```

### Security Audit Logging

All security events are logged for monitoring:

```javascript
// Get security audit log
const auditLog = agentRouter.getSecurityAuditLog();

// Filter by agent or event type
const filteredLog = agentRouter.getSecurityAuditLog({
    agentName: 'PaymentsAgent',
    eventType: 'DATA_ACCESS_VIOLATION'
});
```

### Validation Methods

```javascript
// Validate data access for an agent
agent.validateDataAccess(['balance', 'transactions']); // Should succeed
agent.validateDataAccess(['payments']); // Should throw SecurityError

// Check security constraints
const securityManager = agentRouter.getSecurityManager();
const violations = securityManager.checkSecurityViolations();
```

## Performance Optimization

### Token Usage Optimization

```javascript
// Agent-specific token tracking
const tokenUsage = tokenTracker.getUsageByAgent();
console.log('PaymentsAgent tokens:', tokenUsage.PaymentsAgent);

// Optimize system prompts per agent
const optimizedPrompt = agent.generateOptimizedSystemPrompt(context, userInput);
```

### Memory Management

```javascript
// Agents are reused across requests
const agent = agentRouter.findBestAgent(input);
// Same agent instance is reused for similar requests

// Context objects are passed by reference
const sharedContext = { /* shared data */ };
await agentRouter.route(input1, sharedContext);
await agentRouter.route(input2, sharedContext); // Same context object
```

### Caching Strategies

```javascript
// Agent routing cache
const routingCache = new Map();
const cachedAgent = routingCache.get(inputHash);

// Response caching for similar queries
const responseCache = new Map();
const cachedResponse = responseCache.get(queryHash);
```

## Test Mode System

The agent architecture includes a comprehensive testing framework that supports both **Mock** and **Real** API testing modes, allowing developers to test without costs during development and validate with real APIs when needed.

### Test Mode Configuration

#### Mock Mode (Default)
- **Free testing** with simulated API responses
- **Realistic delays** and response patterns
- **Token usage simulation** for cost estimation
- **No API key required**
- **Perfect for development and CI/CD**

#### Real Mode
- **Actual OpenAI API calls** for production validation
- **Real token usage and costs**
- **Live API response validation**
- **Requires valid OpenAI API key**
- **Use for final validation before deployment**

### Using Test Modes

#### Programmatic Control
```javascript
// Check current test mode
const currentMode = window.debugManager.getTestMode(); // 'mock' or 'real'

// Switch test modes
window.debugManager.setTestMode('mock');  // Switch to mock mode
window.debugManager.setTestMode('real');  // Switch to real mode
window.debugManager.toggleTestMode();     // Toggle between modes

// Create API client respecting current mode
const apiClient = TestAPIFactory.createAPIClient();

// Create complete test context
const testContext = TestAPIFactory.createTestContext();
```

#### Visual Test Mode Selector
```html
<!-- Add test mode selector to any test page -->
<div id="test-mode-selector"></div>

<script src="test/test-mode-selector.js"></script>
<script>
    // Selector automatically initializes and provides UI
    // Callbacks can be added for mode change events
    if (window.testModeSelector) {
        window.testModeSelector.onModeChange((newMode) => {
            console.log(`Switched to ${newMode} mode`);
            // Reinitialize test environment if needed
        });
    }
</script>
```

### Test API Factory

The `TestAPIFactory` provides a unified interface for creating API clients that respect the current test mode:

```javascript
class TestAPIFactory {
    // Create API client based on current test mode
    static createAPIClient(testMode = null)
    
    // Create real OpenAI API client
    static createRealAPIClient()
    
    // Create mock API client with simulated responses
    static createMockAPIClient()
    
    // Create complete test context with persona data
    static createTestContext(testMode = null)
}
```

### Mock API Behavior

The mock API client provides realistic responses for different banking scenarios:

```javascript
// Mock responses are contextually appropriate
const mockClient = TestAPIFactory.createMockAPIClient();

// Balance inquiry
await mockClient.generateChatCompletion([
    { role: 'user', content: 'What is my balance?' }
]);
// Returns: "Your current account balance is £2,500.75..."

// Payment request
await mockClient.generateChatCompletion([
    { role: 'user', content: 'Send £100 to Alice' }
]);
// Returns: "I can help you with that transfer. For security..."

// Fraud alert
await mockClient.generateChatCompletion([
    { role: 'user', content: 'Block my card' }
]);
// Returns: "I understand your concern about potential fraud..."
```

### Test Mode Integration Examples

#### Basic Test Setup
```javascript
// Initialize test environment with current mode
function initializeTestEnvironment() {
    const testContext = TestAPIFactory.createTestContext();
    const agentRouter = new AgentRouter([
        new PaymentsAgent(),
        new FraudAgent(),
        new IDVAgent(),
        new BankingInfoAgent()
    ]);
    
    return { testContext, agentRouter };
}

// Test with automatic mode detection
async function testAgentRouting() {
    const { testContext, agentRouter } = initializeTestEnvironment();
    
    const result = await agentRouter.route('What is my balance?', testContext);
    console.log(`Mode: ${window.debugManager.getTestMode()}`);
    console.log(`Agent: ${result.agentName}`);
    console.log(`Response: ${result.response}`);
}
```

#### Mode-Specific Testing
```javascript
// Test in both modes for validation
async function testBothModes() {
    const testInput = 'Send £50 to Bob';
    
    // Test in mock mode
    window.debugManager.setTestMode('mock');
    const mockResult = await testAgentRouting(testInput);
    console.log('Mock result:', mockResult);
    
    // Test in real mode (if API key available)
    if (localStorage.getItem('openai_api_key')) {
        window.debugManager.setTestMode('real');
        const realResult = await testAgentRouting(testInput);
        console.log('Real result:', realResult);
    }
}
```

## Testing

### Unit Testing

```javascript
// Test agent routing
describe('AgentRouter', () => {
    test('routes balance query to BankingInfoAgent', () => {
        const agent = agentRouter.findBestAgent('What is my balance?');
        expect(agent.name).toBe('BankingInfoAgent');
    });
    
    test('routes payment request to PaymentsAgent', () => {
        const agent = agentRouter.findBestAgent('Send £100 to Alice');
        expect(agent.name).toBe('PaymentsAgent');
    });
});

// Test agent functionality
describe('BankingInfoAgent', () => {
    test('can handle balance queries', () => {
        const agent = new BankingInfoAgent();
        expect(agent.canHandle('What is my balance?')).toBe(true);
        expect(agent.canHandle('Send money')).toBe(false);
    });
});
```

### Integration Testing

```javascript
// Test complete flow
describe('Voice Banking Integration', () => {
    test('complete voice-to-agent-to-response flow', async () => {
        const input = 'What is my account balance?';
        const result = await agentRouter.route(input, testContext);
        
        expect(result.success).toBe(true);
        expect(result.agentName).toBe('BankingInfoAgent');
        expect(result.response).toContain('balance');
    });
});
```

### Security Testing

```javascript
// Test security boundaries
describe('Security Boundaries', () => {
    test('BankingInfoAgent cannot access payment functions', () => {
        const agent = new BankingInfoAgent();
        expect(() => {
            agent.validateDataAccess(['payments']);
        }).toThrow('Security violation');
    });
});
```

### Performance Testing

```javascript
// Test performance metrics
describe('Performance', () => {
    test('agent routing completes within time limit', async () => {
        const startTime = Date.now();
        await agentRouter.route('Test input', context);
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(1000); // Less than 1 second
    });
});
```

## Troubleshooting

### Common Issues

#### 1. Agent Not Found
**Problem**: Input not routing to any agent
```javascript
const agent = agentRouter.findBestAgent('Hello world');
console.log(agent); // null
```

**Solution**: Check agent registration and triggers
```javascript
// Verify agents are registered
const stats = agentRouter.getStats();
console.log('Registered agents:', stats.agentNames);

// Check if agents are enabled
console.log('Enabled agents:', stats.enabledAgents);

// Test agent triggers manually
const bankingAgent = new BankingInfoAgent();
console.log('Can handle balance query:', bankingAgent.canHandle('balance'));
```

#### 2. Security Errors
**Problem**: Agent cannot access required data
```javascript
// SecurityError: Agent cannot access payment data
```

**Solution**: Verify agent permissions
```javascript
// Check agent domain permissions
const securityManager = agentRouter.getSecurityManager();
const permissions = securityManager.getAgentPermissions('BankingInfoAgent');
console.log('Allowed data types:', permissions);

// Review security audit log
const auditLog = securityManager.getAuditLog();
console.log('Recent security events:', auditLog.slice(-10));
```

#### 3. Performance Issues
**Problem**: Slow agent routing or processing
```javascript
// Processing takes too long
```

**Solution**: Analyze performance metrics
```javascript
// Check agent priorities
const stats = agentRouter.getStats();
console.log('Agent priorities:', stats.priorityOrder);

// Monitor token usage
const tokenUsage = tokenTracker.getUsage();
console.log('Token usage:', tokenUsage);

// Enable debug logging
window.debugManager.setLevel('debug');
```

#### 4. Token Tracking Issues
**Problem**: Token usage not being tracked
```javascript
// Token count not increasing
```

**Solution**: Verify token tracker integration
```javascript
// Check token tracker is properly linked
console.log('API client has tracker:', !!apiClient.tokenTracker);
console.log('Current usage:', tokenTracker.getUsage());

// Test token tracking manually
await apiClient.generateChatCompletion([{role: 'user', content: 'test'}]);
console.log('Usage after test:', tokenTracker.getUsage());
```

### Debug Information

```javascript
// Enable comprehensive debugging
window.debugManager.setLevel('debug');
window.debugManager.enableModule('AgentRouter');
window.debugManager.enableModule('SecurityManager');

// Get detailed routing information
const routingInfo = agentRouter.getDetailedRoutingInfo(inputText);
console.log('Routing analysis:', routingInfo);

// Monitor agent performance
const performanceMetrics = agentRouter.getPerformanceMetrics();
console.log('Performance metrics:', performanceMetrics);
```

## Examples

### Example 1: Basic Voice Banking App

```javascript
class BasicVoiceBankingApp {
    constructor() {
        // Initialize core components
        this.tokenTracker = new TokenTracker();
        this.apiClient = new OpenAIClient(apiKey, this.tokenTracker);
        
        // Initialize persona manager
        this.personaManager = new PersonaManager();
        
        // Create agent router
        this.agentRouter = new AgentRouter([
            new PaymentsAgent(),
            new FraudAgent(),
            new IDVAgent(),
            new BankingInfoAgent()
        ]);
    }
    
    async processVoiceCommand(audioBlob) {
        try {
            // Speech to text
            const sttResult = await this.apiClient.speechToText(audioBlob);
            if (!sttResult.success) {
                throw new Error('Speech recognition failed');
            }
            
            // Route through agents
            const context = {
                personaManager: this.personaManager,
                apiClient: this.apiClient,
                tokenTracker: this.tokenTracker
            };
            
            const agentResult = await this.agentRouter.route(sttResult.text, context);
            if (!agentResult.success) {
                throw new Error('Agent processing failed');
            }
            
            // Text to speech
            const ttsResult = await this.apiClient.textToSpeech(agentResult.response);
            if (!ttsResult.success) {
                throw new Error('Text to speech failed');
            }
            
            return {
                transcription: sttResult.text,
                agent: agentResult.agentName,
                response: agentResult.response,
                audio: ttsResult.audioUrl
            };
            
        } catch (error) {
            console.error('Voice processing error:', error);
            return {
                error: error.message,
                fallbackResponse: 'I apologize, but I encountered an error processing your request.'
            };
        }
    }
}
```

### Example 2: Streaming Voice App

```javascript
class StreamingVoiceBankingApp {
    constructor() {
        this.agentRouter = new AgentRouter([
            new PaymentsAgent(),
            new FraudAgent(),
            new IDVAgent(),
            new BankingInfoAgent()
        ]);
        
        this.streamingBuffer = '';
        this.currentAgent = null;
    }
    
    async handleStreamingChunk(audioChunk, isFinal) {
        try {
            // Process audio chunk
            const partialResult = await this.processAudioChunk(audioChunk);
            this.streamingBuffer += partialResult.text;
            
            if (!isFinal) {
                // Predict agent for partial input
                const predictedAgent = this.agentRouter.findBestAgent(this.streamingBuffer);
                return {
                    partial: true,
                    text: this.streamingBuffer,
                    predictedAgent: predictedAgent?.name || 'None',
                    confidence: this.calculateConfidence(this.streamingBuffer)
                };
            } else {
                // Process final input
                const result = await this.agentRouter.route(this.streamingBuffer, this.context);
                this.streamingBuffer = ''; // Reset buffer
                
                return {
                    final: true,
                    agent: result.agentName,
                    response: result.response,
                    success: result.success
                };
            }
        } catch (error) {
            console.error('Streaming error:', error);
            this.streamingBuffer = ''; // Reset on error
            throw error;
        }
    }
    
    calculateConfidence(partialText) {
        // Simple confidence calculation based on text length and keywords
        const minLength = 10;
        const lengthScore = Math.min(partialText.length / minLength, 1);
        
        const keywords = ['balance', 'send', 'transfer', 'block', 'verify'];
        const keywordScore = keywords.some(kw => partialText.toLowerCase().includes(kw)) ? 0.3 : 0;
        
        return Math.min(lengthScore + keywordScore, 1);
    }
}
```

### Example 3: Custom Agent Implementation

```javascript
class CustomLoanAgent extends BaseAgent {
    constructor() {
        super('LoanAgent', 'Handles loan applications and inquiries');
        this.triggers = ['loan', 'mortgage', 'credit', 'borrow', 'application'];
    }
    
    canHandle(inputText) {
        const lowerInput = inputText.toLowerCase();
        return this.triggers.some(trigger => lowerInput.includes(trigger));
    }
    
    async handle(inputText, context) {
        const startTime = Date.now();
        
        try {
            // Generate loan-specific system prompt
            const systemPrompt = this.generateLoanSystemPrompt(context, inputText);
            
            // Process with LLM
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: inputText }
            ];
            
            const response = await context.apiClient.generateChatCompletion(messages, {
                model: 'gpt-3.5-turbo',
                maxTokens: 300,
                temperature: 0.7
            });
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            return {
                success: true,
                response: response.text,
                agentName: this.name,
                processingTime: Date.now() - startTime,
                tokensUsed: response.tokensUsed || 0,
                error: null,
                metadata: {
                    loanSpecific: true,
                    timestamp: new Date().toISOString()
                }
            };
            
        } catch (error) {
            return {
                success: false,
                response: 'I apologize, but I encountered an error processing your loan inquiry.',
                agentName: this.name,
                processingTime: Date.now() - startTime,
                tokensUsed: 0,
                error: error.message,
                metadata: {
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
    
    generateLoanSystemPrompt(context, userInput) {
        const persona = context.personaManager.getCurrentPersonaData();
        return `You are a specialized loan advisor assistant. 
                Customer: ${persona.name}
                Account Type: ${persona.accountType}
                You help with loan applications, mortgage inquiries, and credit information.
                Always provide accurate financial guidance and direct users to appropriate resources.`;
    }
    
    // Optional telemetry hooks
    onActivate(inputText, context) {
        console.log(`LoanAgent activated for: ${inputText.substring(0, 50)}...`);
        if (window.agentTelemetry) {
            window.agentTelemetry.trackAgentActivation(this.name, inputText);
        }
    }
    
    onComplete(result, inputText, startTime) {
        const duration = Date.now() - startTime;
        console.log(`LoanAgent completed in ${duration}ms`);
        if (window.agentTelemetry) {
            window.agentTelemetry.trackAgentCompletion(this.name, result, duration);
        }
    }
}

// Register custom agent
const loanAgent = new CustomLoanAgent();
agentRouter.registerAgent(loanAgent, {
    priority: 20,
    enabled: true,
    llmModel: 'gpt-4'
});
```

### Example 4: Multi-Agent Conversation

```javascript
class ConversationManager {
    constructor() {
        this.agentRouter = new AgentRouter([
            new PaymentsAgent(),
            new FraudAgent(),
            new IDVAgent(),
            new BankingInfoAgent()
        ]);
        
        this.conversationHistory = [];
        this.currentContext = null;
    }
    
    async processConversationTurn(userInput) {
        try {
            // Add user input to history
            this.conversationHistory.push({
                role: 'user',
                content: userInput,
                timestamp: new Date().toISOString()
            });
            
            // Route to appropriate agent
            const result = await this.agentRouter.route(userInput, this.currentContext);
            
            // Add agent response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: result.response,
                agent: result.agentName,
                timestamp: new Date().toISOString(),
                metadata: result.metadata
            });
            
            // Analyze conversation flow
            const conversationAnalysis = this.analyzeConversationFlow();
            
            return {
                response: result.response,
                agent: result.agentName,
                conversationAnalysis,
                success: result.success
            };
            
        } catch (error) {
            console.error('Conversation processing error:', error);
            return {
                response: 'I apologize, but I encountered an error. Please try again.',
                agent: 'ErrorHandler',
                success: false,
                error: error.message
            };
        }
    }
    
    analyzeConversationFlow() {
        const recentTurns = this.conversationHistory.slice(-6); // Last 3 exchanges
        const agentSwitches = this.detectAgentSwitches(recentTurns);
        const topicProgression = this.analyzeTopicProgression(recentTurns);
        
        return {
            agentSwitches,
            topicProgression,
            conversationLength: this.conversationHistory.length,
            dominantAgent: this.getDominantAgent()
        };
    }
    
    detectAgentSwitches(turns) {
        const switches = [];
        let previousAgent = null;
        
        for (const turn of turns) {
            if (turn.role === 'assistant' && turn.agent !== previousAgent) {
                switches.push({
                    from: previousAgent,
                    to: turn.agent,
                    timestamp: turn.timestamp
                });
                previousAgent = turn.agent;
            }
        }
        
        return switches;
    }
    
    getDominantAgent() {
        const agentCounts = {};
        
        for (const turn of this.conversationHistory) {
            if (turn.role === 'assistant' && turn.agent) {
                agentCounts[turn.agent] = (agentCounts[turn.agent] || 0) + 1;
            }
        }
        
        return Object.keys(agentCounts).reduce((a, b) => 
            agentCounts[a] > agentCounts[b] ? a : b
        );
    }
}
```

This comprehensive documentation provides everything needed to understand, implement, and maintain the Voice Banking Agent Architecture system. The examples demonstrate real-world usage patterns and the troubleshooting section helps resolve common issues.
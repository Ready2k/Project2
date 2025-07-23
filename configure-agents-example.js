/**
 * Example: How to configure agents programmatically
 * This shows various ways to modify agent behavior and capabilities
 */

// Access the agent router and configuration manager
const agentRouter = window.agentRouter; // Available globally after initialization
const configManager = agentRouter.getConfigManager();

// Example 1: Enable/Disable an agent
function toggleFraudAgent(enabled) {
    if (enabled) {
        configManager.enableAgent('FraudAgent');
        console.log('FraudAgent enabled');
    } else {
        configManager.disableAgent('FraudAgent');
        console.log('FraudAgent disabled');
    }
}

// Example 2: Change agent priority (lower = higher priority)
function setPriorities() {
    configManager.setAgentPriority('PaymentsAgent', 5);    // Highest priority
    configManager.setAgentPriority('FraudAgent', 10);      // High priority
    configManager.setAgentPriority('IDVAgent', 20);        // Medium priority
    configManager.setAgentPriority('BankingInfoAgent', 30); // Lower priority
    
    console.log('Agent priorities updated');
}

// Example 3: Update agent configuration
function configureFraudAgent() {
    const fraudConfig = {
        name: 'FraudAgent',
        enabled: true,
        priority: 5, // Make it highest priority
        llmModel: 'gpt-4', // Use more capable model
        llmConfig: {
            maxTokens: 2000,
            temperature: 0.2, // More deterministic for security
            topP: 0.8
        },
        triggers: [
            'fraud', 'stolen', 'block', 'freeze', 'suspicious', 
            'unauthorized', 'scam', 'phishing', 'hack',
            // Add new triggers
            'stop it', 'cancel it', 'block it', 'freeze it'
        ],
        customSettings: {
            requiresHighSecurity: true,
            autoBlockThreshold: 3, // Auto-block after 3 suspicious activities
            alertLevel: 'high'
        }
    };
    
    configManager.setAgentConfig('FraudAgent', fraudConfig);
    console.log('FraudAgent configuration updated');
}

// Example 4: Add new capabilities to an agent
function enhancePaymentsAgent() {
    const paymentsConfig = configManager.getAgentConfig('PaymentsAgent');
    
    // Add new triggers
    paymentsConfig.triggers.push('wire transfer', 'international payment', 'recurring payment');
    
    // Add custom settings
    paymentsConfig.customSettings = {
        ...paymentsConfig.customSettings,
        maxDailyTransfers: 5,
        requiresApprovalOver: 5000,
        supportedCurrencies: ['GBP', 'USD', 'EUR'],
        internationalTransfersEnabled: true
    };
    
    // Use more capable model for complex payments
    paymentsConfig.llmModel = 'gpt-4';
    paymentsConfig.llmConfig.maxTokens = 2000;
    
    configManager.setAgentConfig('PaymentsAgent', paymentsConfig);
    console.log('PaymentsAgent capabilities enhanced');
}

// Example 5: Create a custom agent configuration
function createCustomBankingAgent() {
    const customConfig = {
        name: 'CustomBankingAgent',
        description: 'Handles advanced banking queries and analysis',
        enabled: true,
        priority: 25,
        llmProvider: 'openai',
        llmModel: 'gpt-4',
        llmConfig: {
            maxTokens: 3000,
            temperature: 0.4,
            topP: 0.9
        },
        triggers: [
            'analyze', 'report', 'summary', 'trends', 'insights',
            'financial advice', 'investment', 'savings'
        ],
        systemPromptOverride: `You are an advanced banking analyst. Provide detailed financial insights and analysis. 
                              Focus on helping customers understand their financial patterns and make informed decisions.`,
        customSettings: {
            analysisDepth: 'detailed',
            includeRecommendations: true,
            historicalDataMonths: 12
        }
    };
    
    configManager.setAgentConfig('CustomBankingAgent', customConfig);
    console.log('Custom banking agent configuration created');
}

// Example 6: Bulk configuration update
function updateAllAgentSettings() {
    const allConfigs = configManager.getAllConfigs();
    
    // Apply common settings to all agents
    Object.keys(allConfigs).forEach(agentName => {
        const config = allConfigs[agentName];
        
        // Enable telemetry for all agents
        config.telemetryEnabled = true;
        
        // Set common timeout
        config.timeout = 45000; // 45 seconds
        
        // Enable streaming for faster responses
        config.streaming = true;
        
        // Update configuration
        configManager.setAgentConfig(agentName, config);
    });
    
    console.log('All agent configurations updated with common settings');
}

// Example 7: Security configuration
function configureSecuritySettings() {
    // High security for payments
    const paymentsConfig = configManager.getAgentConfig('PaymentsAgent');
    paymentsConfig.customSettings.requiresHighSecurity = true;
    paymentsConfig.customSettings.multiFactorAuth = true;
    paymentsConfig.customSettings.transactionLogging = 'detailed';
    configManager.setAgentConfig('PaymentsAgent', paymentsConfig);
    
    // Enhanced fraud detection
    const fraudConfig = configManager.getAgentConfig('FraudAgent');
    fraudConfig.customSettings.realTimeMonitoring = true;
    fraudConfig.customSettings.alertThreshold = 'low';
    fraudConfig.customSettings.autoResponseEnabled = true;
    configManager.setAgentConfig('FraudAgent', fraudConfig);
    
    console.log('Security settings configured');
}

// Example 8: Performance optimization
function optimizePerformance() {
    const configs = configManager.getAllConfigs();
    
    Object.keys(configs).forEach(agentName => {
        const config = configs[agentName];
        
        // Optimize based on agent type
        if (agentName === 'BankingInfoAgent') {
            // Fast responses for simple queries
            config.llmModel = 'gpt-3.5-turbo';
            config.llmConfig.maxTokens = 500;
            config.llmConfig.temperature = 0.3;
        } else if (agentName === 'PaymentsAgent') {
            // More thorough for payments
            config.llmModel = 'gpt-4';
            config.llmConfig.maxTokens = 1500;
            config.llmConfig.temperature = 0.2;
        }
        
        configManager.setAgentConfig(agentName, config);
    });
    
    console.log('Performance optimizations applied');
}

// Usage examples:
// toggleFraudAgent(true);
// setPriorities();
// configureFraudAgent();
// enhancePaymentsAgent();
// updateAllAgentSettings();
// configureSecuritySettings();
// optimizePerformance();
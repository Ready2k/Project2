/**
 * AgentConfigManager - Manages agent configuration, enabling/disabling, and priorities
 * Provides runtime configuration management for the agent system
 */
class AgentConfigManager {
    constructor() {
        this.debug = window.debugManager.createModuleLogger('AgentConfigManager');
        
        // Default configuration for all agents
        this.defaultConfig = {
            enabled: true,
            priority: 100,
            llmProvider: 'openai',
            llmModel: 'gpt-3.5-turbo',
            llmConfig: {
                maxTokens: 1000,
                temperature: 0.7,
                topP: 1,
                frequencyPenalty: 0,
                presencePenalty: 0
            },
            systemPromptOverride: null,
            telemetryEnabled: true,
            maxRetries: 3,
            timeout: 30000,
            streaming: false,
            customSettings: {}
        };
        
        // Load configuration from localStorage or use defaults
        this.loadConfiguration();
        
        this.debug.info('AgentConfigManager initialized', {
            configuredAgents: Object.keys(this.agentConfigs).length
        });
    }
    
    /**
     * Load agent configurations from localStorage
     */
    loadConfiguration() {
        try {
            const savedConfig = localStorage.getItem('agent_configurations');
            if (savedConfig) {
                this.agentConfigs = JSON.parse(savedConfig);
                this.debug.info('Agent configurations loaded from storage');
            } else {
                this.agentConfigs = this.getDefaultConfigurations();
                this.saveConfiguration();
                this.debug.info('Default agent configurations created');
            }
        } catch (error) {
            this.debug.error('Failed to load agent configurations', { error: error.message });
            this.agentConfigs = this.getDefaultConfigurations();
        }
    }
    
    /**
     * Save agent configurations to localStorage
     */
    saveConfiguration() {
        try {
            localStorage.setItem('agent_configurations', JSON.stringify(this.agentConfigs));
            this.debug.info('Agent configurations saved to storage');
        } catch (error) {
            this.debug.error('Failed to save agent configurations', { error: error.message });
        }
    }
    
    /**
     * Get default configurations for all known agents
     * @returns {Object} - Default agent configurations
     */
    getDefaultConfigurations() {
        return {
            'PaymentsAgent': {
                ...this.defaultConfig,
                name: 'PaymentsAgent',
                description: 'Handles payment and money transfer requests',
                priority: 10, // Highest priority for security
                enabled: true,
                triggers: ['send money', 'transfer', 'pay', '£', '$', 'payment', 'wire'],
                llmModel: 'gpt-4', // Use more capable model for payments
                llmConfig: {
                    maxTokens: 1500,
                    temperature: 0.3, // Lower temperature for more consistent responses
                    topP: 0.9
                },
                streaming: false, // Disable streaming for security-sensitive operations
                customSettings: {
                    requiresHighSecurity: true,
                    maxTransactionAmount: 10000
                }
            },
            'FraudAgent': {
                ...this.defaultConfig,
                name: 'FraudAgent',
                description: 'Handles fraud detection and security requests',
                priority: 20,
                enabled: true,
                triggers: ['fraud', 'freeze', 'block', 'suspicious', 'unauthorized'],
                customSettings: {
                    alertThreshold: 'medium',
                    autoBlockEnabled: false
                }
            },
            'IDVAgent': {
                ...this.defaultConfig,
                name: 'IDVAgent',
                description: 'Handles identity verification requests',
                priority: 30,
                enabled: true,
                triggers: ['verify', 'identity', 'password', 'pin', 'security question'],
                customSettings: {
                    verificationSteps: 3,
                    allowPasswordReset: true
                }
            },
            'BankingInfoAgent': {
                ...this.defaultConfig,
                name: 'BankingInfoAgent',
                description: 'Handles banking information and account queries',
                priority: 40,
                enabled: true,
                triggers: ['balance', 'transaction', 'account', 'statement', 'history'],
                customSettings: {
                    showFullTransactionHistory: false,
                    balanceDisplayFormat: 'currency'
                }
            }
        };
    }
    
    /**
     * Get configuration for a specific agent
     * @param {string} agentName - Name of the agent
     * @returns {Object|null} - Agent configuration or null if not found
     */
    getAgentConfig(agentName) {
        return this.agentConfigs[agentName] || null;
    }
    
    /**
     * Set configuration for a specific agent
     * @param {string} agentName - Name of the agent
     * @param {Object} config - Configuration object
     */
    setAgentConfig(agentName, config) {
        if (!config.name) {
            config.name = agentName;
        }
        
        this.agentConfigs[agentName] = {
            ...this.defaultConfig,
            ...config
        };
        
        this.saveConfiguration();
        this.debug.info('Agent configuration updated', { agentName, config });
    }
    
    /**
     * Update specific configuration properties for an agent
     * @param {string} agentName - Name of the agent
     * @param {Object} updates - Properties to update
     */
    updateAgentConfig(agentName, updates) {
        if (!this.agentConfigs[agentName]) {
            this.debug.warn('Agent not found for configuration update', { agentName });
            return false;
        }
        
        this.agentConfigs[agentName] = {
            ...this.agentConfigs[agentName],
            ...updates
        };
        
        this.saveConfiguration();
        this.debug.info('Agent configuration updated', { agentName, updates });
        return true;
    }
    
    /**
     * Enable an agent
     * @param {string} agentName - Name of the agent to enable
     * @returns {boolean} - True if successful
     */
    enableAgent(agentName) {
        return this.updateAgentConfig(agentName, { enabled: true });
    }
    
    /**
     * Disable an agent
     * @param {string} agentName - Name of the agent to disable
     * @returns {boolean} - True if successful
     */
    disableAgent(agentName) {
        return this.updateAgentConfig(agentName, { enabled: false });
    }
    
    /**
     * Set agent priority
     * @param {string} agentName - Name of the agent
     * @param {number} priority - Priority value (lower = higher priority)
     * @returns {boolean} - True if successful
     */
    setAgentPriority(agentName, priority) {
        if (typeof priority !== 'number' || priority < 0) {
            this.debug.error('Invalid priority value', { agentName, priority });
            return false;
        }
        
        return this.updateAgentConfig(agentName, { priority });
    }
    
    /**
     * Get all agent configurations
     * @returns {Object} - All agent configurations
     */
    getAllConfigs() {
        return { ...this.agentConfigs };
    }
    
    /**
     * Get enabled agents sorted by priority
     * @returns {Array<Object>} - Enabled agent configurations sorted by priority
     */
    getEnabledAgentsSortedByPriority() {
        return Object.values(this.agentConfigs)
            .filter(config => config.enabled)
            .sort((a, b) => a.priority - b.priority);
    }
    
    /**
     * Check if an agent is enabled
     * @param {string} agentName - Name of the agent
     * @returns {boolean} - True if agent is enabled
     */
    isAgentEnabled(agentName) {
        const config = this.getAgentConfig(agentName);
        return config ? config.enabled : false;
    }
    
    /**
     * Get agent status summary
     * @returns {Object} - Status summary of all agents
     */
    getAgentStatusSummary() {
        const configs = Object.values(this.agentConfigs);
        const enabled = configs.filter(c => c.enabled);
        const disabled = configs.filter(c => !c.enabled);
        
        return {
            total: configs.length,
            enabled: enabled.length,
            disabled: disabled.length,
            enabledAgents: enabled.map(c => ({ name: c.name, priority: c.priority })),
            disabledAgents: disabled.map(c => c.name),
            priorityOrder: enabled.sort((a, b) => a.priority - b.priority).map(c => c.name)
        };
    }
    
    /**
     * Reset all configurations to defaults
     */
    resetToDefaults() {
        this.agentConfigs = this.getDefaultConfigurations();
        this.saveConfiguration();
        this.debug.info('Agent configurations reset to defaults');
    }
    
    /**
     * Export configurations for backup
     * @returns {string} - JSON string of all configurations
     */
    exportConfigurations() {
        return JSON.stringify(this.agentConfigs, null, 2);
    }
    
    /**
     * Import configurations from JSON string
     * @param {string} configJson - JSON string of configurations
     * @returns {boolean} - True if successful
     */
    importConfigurations(configJson) {
        try {
            const configs = JSON.parse(configJson);
            
            // Validate the imported configurations
            if (!this.validateConfigurations(configs)) {
                throw new Error('Invalid configuration format');
            }
            
            this.agentConfigs = configs;
            this.saveConfiguration();
            this.debug.info('Agent configurations imported successfully');
            return true;
        } catch (error) {
            this.debug.error('Failed to import configurations', { error: error.message });
            return false;
        }
    }
    
    /**
     * Validate configuration object structure
     * @param {Object} configs - Configurations to validate
     * @returns {boolean} - True if valid
     */
    validateConfigurations(configs) {
        if (!configs || typeof configs !== 'object') {
            return false;
        }
        
        for (const [agentName, config] of Object.entries(configs)) {
            if (!config.name || !config.description || typeof config.enabled !== 'boolean') {
                this.debug.error('Invalid agent configuration', { agentName, config });
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get configuration schema for UI generation
     * @returns {Object} - Configuration schema
     */
    getConfigurationSchema() {
        return {
            enabled: {
                type: 'boolean',
                label: 'Enabled',
                description: 'Whether this agent is active'
            },
            priority: {
                type: 'number',
                label: 'Priority',
                description: 'Agent priority (lower number = higher priority)',
                min: 1,
                max: 100
            },
            llmProvider: {
                type: 'select',
                label: 'LLM Provider',
                description: 'Language model provider to use',
                options: ['openai', 'claude', 'bedrock']
            },
            llmModel: {
                type: 'select',
                label: 'LLM Model',
                description: 'Specific model to use',
                options: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
            },
            systemPromptOverride: {
                type: 'textarea',
                label: 'System Prompt Override',
                description: 'Custom system prompt (optional)'
            },
            telemetryEnabled: {
                type: 'boolean',
                label: 'Telemetry Enabled',
                description: 'Enable performance tracking for this agent'
            },
            maxRetries: {
                type: 'number',
                label: 'Max Retries',
                description: 'Maximum retry attempts on failure',
                min: 0,
                max: 10
            },
            timeout: {
                type: 'number',
                label: 'Timeout (ms)',
                description: 'Request timeout in milliseconds',
                min: 1000,
                max: 60000
            },
            streaming: {
                type: 'boolean',
                label: 'Enable Streaming',
                description: 'Enable streaming responses for this agent'
            },
            llmConfig: {
                type: 'object',
                label: 'LLM Configuration',
                description: 'LLM-specific configuration parameters',
                properties: {
                    maxTokens: {
                        type: 'number',
                        label: 'Max Tokens',
                        min: 1,
                        max: 4000
                    },
                    temperature: {
                        type: 'number',
                        label: 'Temperature',
                        min: 0,
                        max: 2,
                        step: 0.1
                    },
                    topP: {
                        type: 'number',
                        label: 'Top P',
                        min: 0,
                        max: 1,
                        step: 0.1
                    }
                }
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentConfigManager;
} else {
    window.AgentConfigManager = AgentConfigManager;
}
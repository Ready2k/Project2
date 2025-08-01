/**
 * AgentConfigManager - Manages agent configuration, enabling/disabling, and priorities
 * Provides runtime configuration management for the agent system
 * Now loads from individual JSON files for each agent
 */
class AgentConfigManager {
    constructor() {
        this.debug = window.debugManager.createModuleLogger('AgentConfigManager');
        
        // Agent configuration files mapping
        this.agentConfigFiles = {
            'DefaultAgent': 'config/agents/default-agent-config.json',
            'PaymentsAgent': 'config/agents/payments-agent-config.json',
            'FraudAgent': 'config/agents/fraud-agent-config.json',
            'IDVAgent': 'config/agents/idv-agent-config.json',
            'BankingInfoAgent': 'config/agents/banking-info-agent-config.json'
        };
        
        // Default configuration template for new agents
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
        
        // Initialize configurations
        this.agentConfigs = {};
        this.loadAllConfigurations();
        
        this.debug.info('AgentConfigManager initialized', {
            configuredAgents: Object.keys(this.agentConfigs).length
        });
    }
    
    /**
     * Load all agent configurations from JSON files
     */
    async loadAllConfigurations() {
        this.debug.info('Loading agent configurations from JSON files');
        
        for (const [agentName, filePath] of Object.entries(this.agentConfigFiles)) {
            try {
                await this.loadAgentConfiguration(agentName, filePath);
            } catch (error) {
                this.debug.error(`Failed to load configuration for ${agentName}`, { 
                    error: error.message, 
                    filePath 
                });
                // Use default configuration as fallback
                this.agentConfigs[agentName] = {
                    ...this.defaultConfig,
                    name: agentName,
                    description: `${agentName} - Configuration failed to load`
                };
            }
        }
        
        this.debug.info('Agent configurations loaded', {
            loadedAgents: Object.keys(this.agentConfigs)
        });
    }
    
    /**
     * Load configuration for a specific agent from its JSON file
     * @param {string} agentName - Name of the agent
     * @param {string} filePath - Path to the agent's config file
     */
    async loadAgentConfiguration(agentName, filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const config = await response.json();
            
            // Validate the configuration
            if (!this.validateSingleConfiguration(config)) {
                throw new Error('Invalid configuration format');
            }
            
            this.agentConfigs[agentName] = config;
            this.debug.info(`Configuration loaded for ${agentName}`, { filePath });
            
        } catch (error) {
            this.debug.error(`Failed to load ${agentName} configuration`, { 
                error: error.message, 
                filePath 
            });
            throw error;
        }
    }
    
    /**
     * Save agent configuration to its JSON file
     * @param {string} agentName - Name of the agent
     */
    async saveAgentConfiguration(agentName) {
        const filePath = this.agentConfigFiles[agentName];
        if (!filePath) {
            this.debug.error('No file path configured for agent', { agentName });
            return false;
        }
        
        try {
            const config = this.agentConfigs[agentName];
            if (!config) {
                throw new Error('Agent configuration not found');
            }
            
            // Note: In a browser environment, we can't directly write files
            // This would need to be handled by a server endpoint or download mechanism
            this.debug.warn('File saving not implemented in browser environment', { 
                agentName, 
                filePath,
                suggestion: 'Use exportConfiguration() to download updated config'
            });
            
            // For now, also save to localStorage as backup
            this.saveToLocalStorage();
            
            return true;
        } catch (error) {
            this.debug.error('Failed to save agent configuration', { 
                error: error.message, 
                agentName, 
                filePath 
            });
            return false;
        }
    }
    
    /**
     * Save all configurations to localStorage as backup
     */
    saveToLocalStorage() {
        try {
            localStorage.setItem('agent_configurations_backup', JSON.stringify(this.agentConfigs));
            this.debug.info('Agent configurations backed up to localStorage');
        } catch (error) {
            this.debug.error('Failed to backup agent configurations', { error: error.message });
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
    async setAgentConfig(agentName, config) {
        if (!config.name) {
            config.name = agentName;
        }
        
        this.agentConfigs[agentName] = {
            ...this.defaultConfig,
            ...config
        };
        
        await this.saveAgentConfiguration(agentName);
        this.debug.info('Agent configuration updated', { agentName, config });
    }
    
    /**
     * Update specific configuration properties for an agent
     * @param {string} agentName - Name of the agent
     * @param {Object} updates - Properties to update
     */
    async updateAgentConfig(agentName, updates) {
        if (!this.agentConfigs[agentName]) {
            this.debug.warn('Agent not found for configuration update', { agentName });
            return false;
        }
        
        this.agentConfigs[agentName] = {
            ...this.agentConfigs[agentName],
            ...updates
        };
        
        await this.saveAgentConfiguration(agentName);
        this.debug.info('Agent configuration updated', { agentName, updates });
        return true;
    }
    
    /**
     * Enable an agent
     * @param {string} agentName - Name of the agent to enable
     * @returns {Promise<boolean>} - True if successful
     */
    async enableAgent(agentName) {
        return await this.updateAgentConfig(agentName, { enabled: true });
    }
    
    /**
     * Disable an agent
     * @param {string} agentName - Name of the agent to disable
     * @returns {Promise<boolean>} - True if successful
     */
    async disableAgent(agentName) {
        return await this.updateAgentConfig(agentName, { enabled: false });
    }
    
    /**
     * Set agent priority
     * @param {string} agentName - Name of the agent
     * @param {number} priority - Priority value (lower = higher priority)
     * @returns {Promise<boolean>} - True if successful
     */
    async setAgentPriority(agentName, priority) {
        if (typeof priority !== 'number' || priority < 0) {
            this.debug.error('Invalid priority value', { agentName, priority });
            return false;
        }
        
        return await this.updateAgentConfig(agentName, { priority });
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
     * Reset all configurations to defaults (reload from files)
     */
    async resetToDefaults() {
        this.agentConfigs = {};
        await this.loadAllConfigurations();
        this.debug.info('Agent configurations reset to file defaults');
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
            if (!this.validateSingleConfiguration(config)) {
                this.debug.error('Invalid agent configuration', { agentName, config });
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Validate a single agent configuration
     * @param {Object} config - Configuration to validate
     * @returns {boolean} - True if valid
     */
    validateSingleConfiguration(config) {
        if (!config || typeof config !== 'object') {
            return false;
        }
        
        // Required fields
        const requiredFields = ['name', 'description', 'enabled'];
        for (const field of requiredFields) {
            if (!(field in config)) {
                this.debug.error('Missing required field in configuration', { field, config });
                return false;
            }
        }
        
        // Type validation
        if (typeof config.enabled !== 'boolean') {
            return false;
        }
        
        if (config.priority !== undefined && typeof config.priority !== 'number') {
            return false;
        }
        
        return true;
    }
    
    /**
     * Add a new agent configuration file
     * @param {string} agentName - Name of the new agent
     * @param {string} filePath - Path to the config file
     * @param {Object} config - Initial configuration
     */
    addAgentConfigFile(agentName, filePath, config = null) {
        this.agentConfigFiles[agentName] = filePath;
        
        if (config) {
            this.agentConfigs[agentName] = {
                ...this.defaultConfig,
                ...config,
                name: agentName
            };
        }
        
        this.debug.info('Agent config file added', { agentName, filePath });
    }
    
    /**
     * Remove an agent configuration
     * @param {string} agentName - Name of the agent to remove
     */
    removeAgentConfig(agentName) {
        delete this.agentConfigFiles[agentName];
        delete this.agentConfigs[agentName];
        this.debug.info('Agent configuration removed', { agentName });
    }
    
    /**
     * Get the file path for an agent's configuration
     * @param {string} agentName - Name of the agent
     * @returns {string|null} - File path or null if not found
     */
    getAgentConfigFilePath(agentName) {
        return this.agentConfigFiles[agentName] || null;
    }
    
    /**
     * List all configured agent files
     * @returns {Object} - Mapping of agent names to file paths
     */
    listAgentConfigFiles() {
        return { ...this.agentConfigFiles };
    }
    
    /**
     * Export a single agent configuration for download
     * @param {string} agentName - Name of the agent
     * @returns {string|null} - JSON string or null if agent not found
     */
    exportAgentConfiguration(agentName) {
        const config = this.agentConfigs[agentName];
        if (!config) {
            this.debug.warn('Agent not found for export', { agentName });
            return null;
        }
        
        return JSON.stringify(config, null, 2);
    }
    
    /**
     * Create a download link for an agent configuration
     * @param {string} agentName - Name of the agent
     * @returns {string|null} - Data URL for download or null if agent not found
     */
    createConfigDownloadLink(agentName) {
        const configJson = this.exportAgentConfiguration(agentName);
        if (!configJson) {
            return null;
        }
        
        const blob = new Blob([configJson], { type: 'application/json' });
        return URL.createObjectURL(blob);
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
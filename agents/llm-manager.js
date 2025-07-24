/**
 * LLM Manager - Central management interface for all agent configurations
 * Handles configuration management, persistence, and validation for the agent system
 */

class LLMManager {
    constructor() {
        this.guardrailsManager = null; // Will be injected
        this.voiceConfigManager = null; // Will be injected
        this.agentConfigManager = null; // Will be injected
        this.configUpdateManager = null; // Will be injected
        this.debug = window.debugManager?.createModuleLogger('LLMManager') || console;
        
        // Configuration storage
        this.configurations = new Map();
        this.configVersion = '1.0.0';
        this.storageKey = 'llm_manager_config';
        
        // Real-time update support
        this.updateSubscriptions = new Map();
        this.pendingUpdates = new Map();
        
        this.initialize();
    }
    
    /**
     * Initialize the LLM Manager with default configurations
     */
    initialize() {
        this.debug.log('Initializing LLM Manager');
        
        // Load existing configurations from storage
        this.loadConfigurations();
        
        // Set up default configurations if none exist
        if (this.configurations.size === 0) {
            this.initializeDefaultConfigurations();
        }
        
        this.debug.log('LLM Manager initialized with', this.configurations.size, 'configurations');
    }
    
    /**
     * Set manager dependencies (dependency injection)
     */
    setManagers(guardrailsManager, voiceConfigManager, agentConfigManager, configUpdateManager = null) {
        this.guardrailsManager = guardrailsManager;
        this.voiceConfigManager = voiceConfigManager;
        this.agentConfigManager = agentConfigManager;
        this.configUpdateManager = configUpdateManager;
        
        // Subscribe to real-time configuration updates if manager is available
        if (this.configUpdateManager) {
            this.setupRealTimeUpdates();
        }
        
        this.debug.log('Manager dependencies injected');
    }
    
    /**
     * Get all agent configurations
     * @returns {Object} All agent configurations
     */
    getAgentConfigurations() {
        const configs = {};
        
        for (const [agentName, config] of this.configurations) {
            configs[agentName] = {
                ...config,
                guardrails: this.guardrailsManager?.getGuardrails(agentName) || {},
                voiceConfig: this.voiceConfigManager?.getVoiceConfig(agentName) || {}
            };
        }
        
        return configs;
    }
    
    /**
     * Get configuration for a specific agent
     * @param {string} agentName - Name of the agent
     * @returns {Object|null} Agent configuration or null if not found
     */
    getAgentConfiguration(agentName) {
        const baseConfig = this.configurations.get(agentName);
        if (!baseConfig) {
            return null;
        }
        
        return {
            ...baseConfig,
            guardrails: this.guardrailsManager?.getGuardrails(agentName) || {},
            voiceConfig: this.voiceConfigManager?.getVoiceConfig(agentName) || {}
        };
    }
    
    /**
     * Update configuration for a specific agent
     * @param {string} agentName - Name of the agent
     * @param {Object} config - New configuration
     * @param {Object} options - Update options
     * @returns {Promise<Object>} Update result
     */
    async updateAgentConfiguration(agentName, config, options = {}) {
        try {
            // Check if this is a partial update (doesn't have name/description)
            const isPartialUpdate = !config.name && !config.description;
            
            // Validate the configuration
            const validationResult = this.validateConfiguration(config, isPartialUpdate);
            if (!validationResult.valid) {
                this.debug.error('Configuration validation failed:', validationResult.errors);
                return {
                    success: false,
                    error: 'Configuration validation failed',
                    details: validationResult.errors
                };
            }
            
            // If real-time updates are enabled, use the update manager
            if (this.configUpdateManager && !options.skipRealTimeUpdate) {
                const updateResult = await this.configUpdateManager.broadcastUpdate(agentName, {
                    type: 'agentConfig',
                    data: config,
                    reason: options.reason || 'Agent configuration update'
                }, options);
                
                if (!updateResult.success) {
                    return updateResult;
                }
            }
            
            // Apply the configuration update
            const result = await this.applyConfigurationUpdate(agentName, config);
            
            return result;
            
        } catch (error) {
            this.debug.error('Error updating agent configuration:', error);
            return {
                success: false,
                error: 'Failed to update agent configuration',
                details: error.message
            };
        }
    }
    
    /**
     * Apply configuration update (internal method)
     * @param {string} agentName - Name of the agent
     * @param {Object} config - New configuration
     * @returns {Promise<Object>} Update result
     */
    async applyConfigurationUpdate(agentName, config) {
        try {
            // Update base configuration
            const existingConfig = this.configurations.get(agentName) || {};
            const updatedConfig = {
                ...existingConfig,
                ...config,
                lastUpdated: new Date().toISOString()
            };
            
            this.configurations.set(agentName, updatedConfig);
            
            // Update guardrails if provided
            if (config.guardrails && this.guardrailsManager) {
                const guardrailsResult = await this.guardrailsManager.setGuardrailsRealTime(agentName, config.guardrails);
                if (!guardrailsResult) {
                    throw new Error('Failed to update guardrails');
                }
            }
            
            // Update voice configuration if provided
            if (config.voiceConfig && this.voiceConfigManager) {
                const voiceResult = await this.voiceConfigManager.setVoiceConfigRealTime(agentName, config.voiceConfig);
                if (!voiceResult) {
                    throw new Error('Failed to update voice configuration');
                }
            }
            
            // Persist changes
            this.saveConfigurations();
            
            this.debug.log('Applied configuration update for agent:', agentName);
            
            return {
                success: true,
                agentName,
                updatedConfig,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            this.debug.error('Error applying configuration update:', error);
            return {
                success: false,
                error: 'Failed to apply configuration update',
                details: error.message
            };
        }
    }
    
    /**
     * Validate agent configuration
     * @param {Object} config - Configuration to validate
     * @param {boolean} isPartialUpdate - Whether this is a partial update (default: false)
     * @returns {Object} Validation result with valid flag and errors array
     */
    validateConfiguration(config, isPartialUpdate = false) {
        const errors = [];
        
        // Required fields validation (only for complete configurations)
        if (!isPartialUpdate) {
            if (!config.name || typeof config.name !== 'string') {
                errors.push('Agent name is required and must be a string');
            }
            
            if (!config.description || typeof config.description !== 'string') {
                errors.push('Agent description is required and must be a string');
            }
        } else {
            // For partial updates, only validate fields that are present
            if (config.name !== undefined && (typeof config.name !== 'string' || !config.name)) {
                errors.push('Agent name must be a non-empty string');
            }
            
            if (config.description !== undefined && (typeof config.description !== 'string' || !config.description)) {
                errors.push('Agent description must be a non-empty string');
            }
        }
        
        // Optional fields validation
        if (config.priority !== undefined && (typeof config.priority !== 'number' || config.priority < 0)) {
            errors.push('Priority must be a non-negative number');
        }
        
        if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
            errors.push('Enabled flag must be a boolean');
        }
        
        if (config.triggers && !Array.isArray(config.triggers)) {
            errors.push('Triggers must be an array');
        }
        
        if (config.llmProvider && !['openai', 'claude', 'bedrock'].includes(config.llmProvider)) {
            errors.push('LLM provider must be one of: openai, claude, bedrock');
        }
        
        if (config.maxTokens !== undefined && (typeof config.maxTokens !== 'number' || config.maxTokens <= 0)) {
            errors.push('Max tokens must be a positive number');
        }
        
        // Validate guardrails if present
        if (config.guardrails && this.guardrailsManager) {
            const guardrailsValidation = this.guardrailsManager.validateGuardrails(config.guardrails);
            if (!guardrailsValidation.valid) {
                errors.push(...guardrailsValidation.errors.map(e => `Guardrails: ${e}`));
            }
        }
        
        // Validate voice config if present
        if (config.voiceConfig && this.voiceConfigManager) {
            const voiceValidation = this.voiceConfigManager.validateVoiceConfig(config.voiceConfig);
            if (!voiceValidation.valid) {
                errors.push(...voiceValidation.errors.map(e => `Voice Config: ${e}`));
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Export all configurations
     * @returns {Object} Exported configuration data
     */
    exportConfiguration() {
        return {
            version: this.configVersion,
            timestamp: new Date().toISOString(),
            configurations: Object.fromEntries(this.configurations),
            guardrails: this.guardrailsManager?.exportGuardrails() || {},
            voiceConfigs: this.voiceConfigManager?.exportVoiceConfigs() || {}
        };
    }
    
    /**
     * Import configurations
     * @param {Object} configData - Configuration data to import
     * @returns {boolean} Success status
     */
    importConfiguration(configData) {
        try {
            // Validate import data structure
            if (!configData.version || !configData.configurations) {
                throw new Error('Invalid configuration data structure');
            }
            
            // Clear existing configurations
            this.configurations.clear();
            
            // Import base configurations
            for (const [agentName, config] of Object.entries(configData.configurations)) {
                const validationResult = this.validateConfiguration(config);
                if (validationResult.valid) {
                    this.configurations.set(agentName, config);
                } else {
                    this.debug.warn(`Skipping invalid configuration for ${agentName}:`, validationResult.errors);
                }
            }
            
            // Import guardrails
            if (configData.guardrails && this.guardrailsManager) {
                this.guardrailsManager.importGuardrails(configData.guardrails);
            }
            
            // Import voice configurations
            if (configData.voiceConfigs && this.voiceConfigManager) {
                this.voiceConfigManager.importVoiceConfigs(configData.voiceConfigs);
            }
            
            // Persist imported configurations
            this.saveConfigurations();
            
            this.debug.log('Successfully imported configurations');
            return true;
            
        } catch (error) {
            this.debug.error('Error importing configurations:', error);
            return false;
        }
    }
    
    /**
     * Reset all configurations to defaults
     */
    resetToDefaults() {
        this.configurations.clear();
        this.initializeDefaultConfigurations();
        this.saveConfigurations();
        
        if (this.guardrailsManager) {
            this.guardrailsManager.resetToDefaults();
        }
        
        if (this.voiceConfigManager) {
            this.voiceConfigManager.resetToDefaults();
        }
        
        this.debug.log('Reset all configurations to defaults');
    }
    
    /**
     * Get configuration statistics
     * @returns {Object} Configuration statistics
     */
    getConfigurationStats() {
        const stats = {
            totalAgents: this.configurations.size,
            enabledAgents: 0,
            disabledAgents: 0,
            agentsByProvider: {},
            lastUpdated: null
        };
        
        let mostRecentUpdate = null;
        
        for (const [agentName, config] of this.configurations) {
            if (config.enabled !== false) {
                stats.enabledAgents++;
            } else {
                stats.disabledAgents++;
            }
            
            const provider = config.llmProvider || 'openai';
            stats.agentsByProvider[provider] = (stats.agentsByProvider[provider] || 0) + 1;
            
            if (config.lastUpdated) {
                const updateTime = new Date(config.lastUpdated);
                if (!mostRecentUpdate || updateTime > mostRecentUpdate) {
                    mostRecentUpdate = updateTime;
                }
            }
        }
        
        stats.lastUpdated = mostRecentUpdate?.toISOString() || null;
        
        return stats;
    }
    
    /**
     * Initialize default configurations for known agents
     */
    initializeDefaultConfigurations() {
        const defaultAgents = [
            {
                name: 'IDVAgent',
                description: 'Identity and Verification Agent',
                priority: 1,
                enabled: true,
                triggers: ['verify', 'password', 'identity', 'authentication'],
                llmProvider: 'openai',
                llmModel: 'gpt-4',
                maxTokens: 1000,
                telemetryEnabled: true
            },
            {
                name: 'BankingInfoAgent',
                description: 'Banking Information Agent',
                priority: 2,
                enabled: true,
                triggers: ['balance', 'transaction', 'account', 'statement'],
                llmProvider: 'openai',
                llmModel: 'gpt-4',
                maxTokens: 1500,
                telemetryEnabled: true
            },
            {
                name: 'FraudAgent',
                description: 'Fraud Detection and Security Agent',
                priority: 3,
                enabled: true,
                triggers: ['fraud', 'freeze', 'block', 'suspicious', 'unauthorised'],
                llmProvider: 'openai',
                llmModel: 'gpt-4',
                maxTokens: 1200,
                telemetryEnabled: true
            },
            {
                name: 'PaymentsAgent',
                description: 'Payment Processing Agent',
                priority: 4,
                enabled: true,
                triggers: ['send', 'transfer', 'pay', 'payment', '£'],
                llmProvider: 'openai',
                llmModel: 'gpt-4',
                maxTokens: 1800,
                telemetryEnabled: true
            }
        ];
        
        defaultAgents.forEach(config => {
            config.createdAt = new Date().toISOString();
            config.lastUpdated = new Date().toISOString();
            this.configurations.set(config.name, config);
        });
        
        this.debug.log('Initialized default configurations for', defaultAgents.length, 'agents');
    }
    
    /**
     * Load configurations from storage
     */
    loadConfigurations() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.configurations) {
                    this.configurations = new Map(Object.entries(data.configurations));
                    this.debug.log('Loaded configurations from storage');
                }
            }
        } catch (error) {
            this.debug.error('Error loading configurations from storage:', error);
        }
    }
    
    /**
     * Save configurations to storage
     */
    saveConfigurations() {
        try {
            const data = {
                version: this.configVersion,
                timestamp: new Date().toISOString(),
                configurations: Object.fromEntries(this.configurations)
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            this.debug.log('Saved configurations to storage');
        } catch (error) {
            this.debug.error('Error saving configurations to storage:', error);
        }
    }
    
    /**
     * Set up real-time configuration updates
     */
    setupRealTimeUpdates() {
        if (!this.configUpdateManager) {
            this.debug.warn('ConfigUpdateManager not available - real-time updates disabled');
            return;
        }
        
        // Subscribe to configuration updates for all agents
        const unsubscribe = this.configUpdateManager.subscribe('all', async (updateData) => {
            return await this.handleRealTimeUpdate(updateData);
        });
        
        // Store unsubscribe function for cleanup
        this.updateSubscriptions.set('all', unsubscribe);
        
        this.debug.log('Real-time configuration updates enabled');
    }
    
    /**
     * Handle real-time configuration update
     * @param {Object} updateData - Update data from ConfigUpdateManager
     * @returns {Promise<Object>} Update result
     */
    async handleRealTimeUpdate(updateData) {
        try {
            const { agentName, configUpdate, options } = updateData;
            
            this.debug.log(`Handling real-time update for ${agentName}`, configUpdate.type);
            
            // Skip if this is a rollback or from storage to prevent loops
            if (options.isRollback || options.fromStorage) {
                return { success: true, skipped: true, reason: 'Rollback or storage update' };
            }
            
            // Apply the configuration update based on type
            let result;
            switch (configUpdate.type) {
                case 'agentConfig':
                    result = await this.applyConfigurationUpdate(agentName, configUpdate.data);
                    break;
                    
                case 'guardrails':
                    if (this.guardrailsManager) {
                        result = await this.guardrailsManager.handleRealTimeUpdate(updateData);
                    }
                    break;
                    
                case 'voiceConfig':
                    if (this.voiceConfigManager) {
                        result = await this.voiceConfigManager.handleRealTimeUpdate(updateData);
                    }
                    break;
                    
                default:
                    result = { success: false, error: `Unknown update type: ${configUpdate.type}` };
            }
            
            // Notify any registered update listeners
            this.notifyUpdateListeners(agentName, configUpdate, result);
            
            return result || { success: true };
            
        } catch (error) {
            this.debug.error('Error handling real-time update:', error);
            return {
                success: false,
                error: 'Failed to handle real-time update',
                details: error.message
            };
        }
    }
    
    /**
     * Notify registered update listeners
     * @param {string} agentName - Name of the agent
     * @param {Object} configUpdate - Configuration update
     * @param {Object} result - Update result
     */
    notifyUpdateListeners(agentName, configUpdate, result) {
        // This could be extended to notify UI components, active agents, etc.
        this.debug.log(`Configuration update completed for ${agentName}`, {
            type: configUpdate.type,
            success: result.success
        });
        
        // Emit custom event for UI components
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            const event = new CustomEvent('llmManagerConfigUpdate', {
                detail: {
                    agentName,
                    configUpdate,
                    result,
                    timestamp: new Date().toISOString()
                }
            });
            window.dispatchEvent(event);
        }
    }
    
    /**
     * Update configuration with rollback support
     * @param {string} agentName - Name of the agent
     * @param {Object} config - New configuration
     * @param {Object} options - Update options
     * @returns {Promise<Object>} Update result with rollback capability
     */
    async updateConfigurationWithRollback(agentName, config, options = {}) {
        const updateOptions = {
            ...options,
            enableRollback: options.enableRollback !== false, // Default to true
            reason: options.reason || 'Configuration update with rollback support'
        };
        
        return await this.updateAgentConfiguration(agentName, config, updateOptions);
    }
    
    /**
     * Rollback configuration to previous state
     * @param {string} agentName - Name of the agent
     * @param {string} updateId - ID of the update to rollback (optional)
     * @returns {Promise<Object>} Rollback result
     */
    async rollbackConfiguration(agentName, updateId = null) {
        if (!this.configUpdateManager) {
            return {
                success: false,
                error: 'ConfigUpdateManager not available - cannot rollback'
            };
        }
        
        return await this.configUpdateManager.rollbackConfiguration(agentName, updateId);
    }
    
    /**
     * Get configuration update history
     * @param {string} agentName - Name of the agent
     * @param {number} limit - Maximum number of history entries
     * @returns {Array} Configuration history
     */
    getConfigurationHistory(agentName, limit = 10) {
        if (!this.configUpdateManager) {
            return [];
        }
        
        return this.configUpdateManager.getConfigurationHistory(agentName, limit);
    }
    
    /**
     * Get available configuration templates
     * @returns {Object} Available templates
     */
    getConfigurationTemplates() {
        return {
            'basic-banking': {
                name: 'Basic Banking Agent',
                description: 'Standard configuration for general banking operations',
                config: {
                    priority: 5,
                    enabled: true,
                    llmProvider: 'openai',
                    llmModel: 'gpt-4',
                    maxTokens: 1500,
                    temperature: 0.7,
                    telemetryEnabled: true,
                    triggers: ['balance', 'account', 'transaction'],
                    guardrails: {
                        allowedCapabilities: {
                            canAccessAccountData: true,
                            canProvideBalanceInfo: true,
                            canAccessTransactionHistory: true,
                            canInitiateTransactions: false,
                            canBlockCards: false,
                            canResetPasswords: false
                        },
                        restrictions: {
                            maxTransactionAmount: 0,
                            blockedKeywords: ['password', 'pin', 'security'],
                            timeBasedRestrictions: {}
                        },
                        complianceRules: {
                            logAllActions: true,
                            requireAuditTrail: true,
                            dataRetentionDays: 90
                        }
                    },
                    voiceConfig: {
                        voice: 'alloy',
                        speed: 1.0,
                        pitch: 0,
                        tone: 'professional'
                    }
                }
            },
            'security-focused': {
                name: 'Security-Focused Agent',
                description: 'High-security configuration for fraud and security operations',
                config: {
                    priority: 1,
                    enabled: true,
                    llmProvider: 'openai',
                    llmModel: 'gpt-4',
                    maxTokens: 1200,
                    temperature: 0.3,
                    telemetryEnabled: true,
                    triggers: ['fraud', 'security', 'block', 'freeze', 'suspicious'],
                    guardrails: {
                        allowedCapabilities: {
                            canAccessAccountData: true,
                            canProvideBalanceInfo: false,
                            canAccessTransactionHistory: true,
                            canInitiateTransactions: false,
                            canBlockCards: true,
                            canResetPasswords: false
                        },
                        restrictions: {
                            maxTransactionAmount: 0,
                            blockedKeywords: [],
                            timeBasedRestrictions: {}
                        },
                        complianceRules: {
                            logAllActions: true,
                            requireAuditTrail: true,
                            dataRetentionDays: 365
                        }
                    },
                    voiceConfig: {
                        voice: 'onyx',
                        speed: 0.9,
                        pitch: -2,
                        tone: 'authoritative'
                    }
                }
            },
            'payments-specialist': {
                name: 'Payments Specialist',
                description: 'Optimized for payment processing and money transfers',
                config: {
                    priority: 2,
                    enabled: true,
                    llmProvider: 'openai',
                    llmModel: 'gpt-4',
                    maxTokens: 2000,
                    temperature: 0.5,
                    telemetryEnabled: true,
                    triggers: ['send', 'transfer', 'pay', 'payment', '£', '$', '€'],
                    guardrails: {
                        allowedCapabilities: {
                            canAccessAccountData: true,
                            canProvideBalanceInfo: true,
                            canAccessTransactionHistory: true,
                            canInitiateTransactions: true,
                            canBlockCards: false,
                            canResetPasswords: false
                        },
                        restrictions: {
                            maxTransactionAmount: 10000,
                            blockedKeywords: ['password', 'pin'],
                            timeBasedRestrictions: {}
                        },
                        complianceRules: {
                            logAllActions: true,
                            requireAuditTrail: true,
                            dataRetentionDays: 180
                        }
                    },
                    voiceConfig: {
                        voice: 'nova',
                        speed: 1.1,
                        pitch: 1,
                        tone: 'friendly'
                    }
                }
            },
            'customer-service': {
                name: 'Customer Service Agent',
                description: 'General customer service with balanced capabilities',
                config: {
                    priority: 10,
                    enabled: true,
                    llmProvider: 'openai',
                    llmModel: 'gpt-3.5-turbo',
                    maxTokens: 1000,
                    temperature: 0.8,
                    telemetryEnabled: true,
                    triggers: ['help', 'support', 'question', 'how', 'what', 'when'],
                    guardrails: {
                        allowedCapabilities: {
                            canAccessAccountData: false,
                            canProvideBalanceInfo: false,
                            canAccessTransactionHistory: false,
                            canInitiateTransactions: false,
                            canBlockCards: false,
                            canResetPasswords: false
                        },
                        restrictions: {
                            maxTransactionAmount: 0,
                            blockedKeywords: ['password', 'pin', 'security', 'transfer'],
                            timeBasedRestrictions: {}
                        },
                        complianceRules: {
                            logAllActions: true,
                            requireAuditTrail: false,
                            dataRetentionDays: 30
                        }
                    },
                    voiceConfig: {
                        voice: 'shimmer',
                        speed: 1.0,
                        pitch: 2,
                        tone: 'friendly'
                    }
                }
            }
        };
    }
    
    /**
     * Apply configuration template to an agent
     * @param {string} agentName - Name of the agent
     * @param {string} templateName - Name of the template to apply
     * @param {Object} overrides - Optional configuration overrides
     * @returns {Promise<Object>} Application result
     */
    async applyConfigurationTemplate(agentName, templateName, overrides = {}) {
        try {
            const templates = this.getConfigurationTemplates();
            const template = templates[templateName];
            
            if (!template) {
                return {
                    success: false,
                    error: `Template '${templateName}' not found`
                };
            }
            
            // Merge template config with overrides
            const config = {
                name: agentName,
                description: overrides.description || template.description,
                ...template.config,
                ...overrides
            };
            
            // Apply the configuration
            const result = await this.updateAgentConfiguration(agentName, config, {
                reason: `Applied template: ${template.name}`
            });
            
            if (result.success) {
                this.debug.log(`Applied template '${templateName}' to agent '${agentName}'`);
            }
            
            return result;
            
        } catch (error) {
            this.debug.error('Error applying configuration template:', error);
            return {
                success: false,
                error: 'Failed to apply configuration template',
                details: error.message
            };
        }
    }
    
    /**
     * Get agent performance metrics
     * @param {string} agentName - Name of the agent (optional, gets all if not specified)
     * @param {Object} timeRange - Time range for metrics
     * @returns {Object} Performance metrics
     */
    getAgentPerformanceMetrics(agentName = null, timeRange = {}) {
        const now = new Date();
        const defaultRange = {
            start: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
            end: now
        };
        
        const range = { ...defaultRange, ...timeRange };
        
        // Mock performance data - in real implementation, this would come from telemetry
        const mockMetrics = {
            totalRequests: Math.floor(Math.random() * 1000) + 100,
            successfulRequests: Math.floor(Math.random() * 900) + 90,
            failedRequests: Math.floor(Math.random() * 50) + 5,
            averageResponseTime: Math.floor(Math.random() * 2000) + 500, // ms
            averageTokensUsed: Math.floor(Math.random() * 500) + 200,
            totalTokensUsed: Math.floor(Math.random() * 50000) + 10000,
            activationCount: Math.floor(Math.random() * 200) + 50,
            errorRate: Math.random() * 0.1, // 0-10%
            lastActivated: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000),
            topTriggers: [
                { trigger: 'balance', count: Math.floor(Math.random() * 100) + 20 },
                { trigger: 'transfer', count: Math.floor(Math.random() * 80) + 15 },
                { trigger: 'account', count: Math.floor(Math.random() * 60) + 10 }
            ],
            hourlyActivity: Array.from({ length: 24 }, (_, i) => ({
                hour: i,
                requests: Math.floor(Math.random() * 50)
            }))
        };
        
        if (agentName) {
            return {
                [agentName]: {
                    ...mockMetrics,
                    agentName,
                    timeRange: range
                }
            };
        }
        
        // Return metrics for all agents
        const allMetrics = {};
        for (const [name] of this.configurations) {
            allMetrics[name] = {
                ...mockMetrics,
                agentName: name,
                timeRange: range,
                // Vary metrics slightly for each agent
                totalRequests: mockMetrics.totalRequests + Math.floor(Math.random() * 200) - 100,
                successfulRequests: mockMetrics.successfulRequests + Math.floor(Math.random() * 100) - 50,
                averageResponseTime: mockMetrics.averageResponseTime + Math.floor(Math.random() * 500) - 250
            };
        }
        
        return allMetrics;
    }
    
    /**
     * Compare two agent configurations
     * @param {string} agentName1 - First agent name
     * @param {string} agentName2 - Second agent name
     * @returns {Object} Configuration comparison
     */
    compareConfigurations(agentName1, agentName2) {
        const config1 = this.getAgentConfiguration(agentName1);
        const config2 = this.getAgentConfiguration(agentName2);
        
        if (!config1 || !config2) {
            return {
                success: false,
                error: 'One or both agents not found'
            };
        }
        
        const differences = [];
        const similarities = [];
        
        // Compare basic properties
        const compareProps = ['priority', 'enabled', 'llmProvider', 'llmModel', 'maxTokens', 'temperature', 'telemetryEnabled'];
        
        compareProps.forEach(prop => {
            if (config1[prop] !== config2[prop]) {
                differences.push({
                    property: prop,
                    agent1: config1[prop],
                    agent2: config2[prop]
                });
            } else {
                similarities.push({
                    property: prop,
                    value: config1[prop]
                });
            }
        });
        
        // Compare triggers
        const triggers1 = new Set(config1.triggers || []);
        const triggers2 = new Set(config2.triggers || []);
        
        const uniqueTriggers1 = [...triggers1].filter(t => !triggers2.has(t));
        const uniqueTriggers2 = [...triggers2].filter(t => !triggers1.has(t));
        const commonTriggers = [...triggers1].filter(t => triggers2.has(t));
        
        if (uniqueTriggers1.length > 0 || uniqueTriggers2.length > 0) {
            differences.push({
                property: 'triggers',
                agent1: uniqueTriggers1,
                agent2: uniqueTriggers2,
                common: commonTriggers
            });
        } else {
            similarities.push({
                property: 'triggers',
                value: commonTriggers
            });
        }
        
        return {
            success: true,
            agent1: agentName1,
            agent2: agentName2,
            differences,
            similarities,
            compatibilityScore: similarities.length / (similarities.length + differences.length)
        };
    }
    
    /**
     * Create configuration diff between two versions
     * @param {Object} oldConfig - Old configuration
     * @param {Object} newConfig - New configuration
     * @returns {Object} Configuration diff
     */
    createConfigurationDiff(oldConfig, newConfig) {
        const diff = {
            added: {},
            removed: {},
            modified: {},
            unchanged: {}
        };
        
        // Get all unique keys
        const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);
        
        allKeys.forEach(key => {
            const oldValue = oldConfig[key];
            const newValue = newConfig[key];
            
            if (oldValue === undefined && newValue !== undefined) {
                diff.added[key] = newValue;
            } else if (oldValue !== undefined && newValue === undefined) {
                diff.removed[key] = oldValue;
            } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                diff.modified[key] = { old: oldValue, new: newValue };
            } else {
                diff.unchanged[key] = oldValue;
            }
        });
        
        return diff;
    }
    
    /**
     * Schedule configuration change
     * @param {string} agentName - Name of the agent
     * @param {Object} config - Configuration to apply
     * @param {Date} scheduledTime - When to apply the change
     * @param {Object} options - Scheduling options
     * @returns {Object} Scheduling result
     */
    scheduleConfigurationChange(agentName, config, scheduledTime, options = {}) {
        try {
            const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const scheduledChange = {
                id: scheduleId,
                agentName,
                config,
                scheduledTime: scheduledTime.toISOString(),
                createdAt: new Date().toISOString(),
                status: 'scheduled',
                options: {
                    reason: options.reason || 'Scheduled configuration change',
                    enableRollback: options.enableRollback !== false,
                    notifyOnCompletion: options.notifyOnCompletion !== false,
                    ...options
                }
            };
            
            // Store scheduled change
            const scheduledChanges = this.getScheduledChanges();
            scheduledChanges.push(scheduledChange);
            this.saveScheduledChanges(scheduledChanges);
            
            // Set up timer for execution
            const delay = scheduledTime.getTime() - Date.now();
            if (delay > 0) {
                setTimeout(async () => {
                    await this.executeScheduledChange(scheduleId);
                }, delay);
            }
            
            this.debug.log(`Scheduled configuration change for ${agentName} at ${scheduledTime.toISOString()}`);
            
            return {
                success: true,
                scheduleId,
                scheduledTime: scheduledTime.toISOString(),
                delay: Math.max(0, delay)
            };
            
        } catch (error) {
            this.debug.error('Error scheduling configuration change:', error);
            return {
                success: false,
                error: 'Failed to schedule configuration change',
                details: error.message
            };
        }
    }
    
    /**
     * Execute scheduled configuration change
     * @param {string} scheduleId - ID of the scheduled change
     * @returns {Promise<Object>} Execution result
     */
    async executeScheduledChange(scheduleId) {
        try {
            const scheduledChanges = this.getScheduledChanges();
            const changeIndex = scheduledChanges.findIndex(c => c.id === scheduleId);
            
            if (changeIndex === -1) {
                return {
                    success: false,
                    error: 'Scheduled change not found'
                };
            }
            
            const scheduledChange = scheduledChanges[changeIndex];
            
            // Update status to executing
            scheduledChange.status = 'executing';
            scheduledChange.executedAt = new Date().toISOString();
            this.saveScheduledChanges(scheduledChanges);
            
            // Execute the configuration change
            const result = await this.updateAgentConfiguration(
                scheduledChange.agentName,
                scheduledChange.config,
                scheduledChange.options
            );
            
            // Update status based on result
            scheduledChange.status = result.success ? 'completed' : 'failed';
            scheduledChange.result = result;
            this.saveScheduledChanges(scheduledChanges);
            
            // Notify if requested
            if (scheduledChange.options.notifyOnCompletion) {
                this.notifyScheduledChangeCompletion(scheduledChange, result);
            }
            
            this.debug.log(`Executed scheduled change ${scheduleId}:`, result.success ? 'success' : 'failed');
            
            return result;
            
        } catch (error) {
            this.debug.error('Error executing scheduled change:', error);
            return {
                success: false,
                error: 'Failed to execute scheduled change',
                details: error.message
            };
        }
    }
    
    /**
     * Get scheduled configuration changes
     * @returns {Array} List of scheduled changes
     */
    getScheduledChanges() {
        try {
            const stored = localStorage.getItem('llm_manager_scheduled_changes');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            this.debug.error('Error loading scheduled changes:', error);
            return [];
        }
    }
    
    /**
     * Save scheduled configuration changes
     * @param {Array} scheduledChanges - List of scheduled changes
     */
    saveScheduledChanges(scheduledChanges) {
        try {
            localStorage.setItem('llm_manager_scheduled_changes', JSON.stringify(scheduledChanges));
        } catch (error) {
            this.debug.error('Error saving scheduled changes:', error);
        }
    }
    
    /**
     * Cancel scheduled configuration change
     * @param {string} scheduleId - ID of the scheduled change
     * @returns {Object} Cancellation result
     */
    cancelScheduledChange(scheduleId) {
        try {
            const scheduledChanges = this.getScheduledChanges();
            const changeIndex = scheduledChanges.findIndex(c => c.id === scheduleId);
            
            if (changeIndex === -1) {
                return {
                    success: false,
                    error: 'Scheduled change not found'
                };
            }
            
            const scheduledChange = scheduledChanges[changeIndex];
            
            if (scheduledChange.status !== 'scheduled') {
                return {
                    success: false,
                    error: `Cannot cancel change with status: ${scheduledChange.status}`
                };
            }
            
            // Update status to cancelled
            scheduledChange.status = 'cancelled';
            scheduledChange.cancelledAt = new Date().toISOString();
            this.saveScheduledChanges(scheduledChanges);
            
            this.debug.log(`Cancelled scheduled change ${scheduleId}`);
            
            return {
                success: true,
                scheduleId,
                cancelledAt: scheduledChange.cancelledAt
            };
            
        } catch (error) {
            this.debug.error('Error cancelling scheduled change:', error);
            return {
                success: false,
                error: 'Failed to cancel scheduled change',
                details: error.message
            };
        }
    }
    
    /**
     * Notify about scheduled change completion
     * @param {Object} scheduledChange - The scheduled change
     * @param {Object} result - Execution result
     */
    notifyScheduledChangeCompletion(scheduledChange, result) {
        // Emit custom event for UI components
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            const event = new CustomEvent('scheduledChangeCompleted', {
                detail: {
                    scheduleId: scheduledChange.id,
                    agentName: scheduledChange.agentName,
                    result,
                    scheduledTime: scheduledChange.scheduledTime,
                    executedAt: scheduledChange.executedAt
                }
            });
            window.dispatchEvent(event);
        }
        
        this.debug.log(`Scheduled change notification sent for ${scheduledChange.agentName}`);
    }
    
    /**
     * Get multi-environment configuration management
     * @returns {Object} Environment configurations
     */
    getEnvironmentConfigurations() {
        try {
            const stored = localStorage.getItem('llm_manager_environments');
            return stored ? JSON.parse(stored) : {
                development: {},
                staging: {},
                production: {}
            };
        } catch (error) {
            this.debug.error('Error loading environment configurations:', error);
            return {
                development: {},
                staging: {},
                production: {}
            };
        }
    }
    
    /**
     * Save configuration to specific environment
     * @param {string} environment - Environment name
     * @param {string} agentName - Agent name
     * @param {Object} config - Configuration to save
     * @returns {Object} Save result
     */
    saveConfigurationToEnvironment(environment, agentName, config) {
        try {
            const environments = this.getEnvironmentConfigurations();
            
            if (!environments[environment]) {
                environments[environment] = {};
            }
            
            environments[environment][agentName] = {
                ...config,
                savedAt: new Date().toISOString(),
                environment
            };
            
            localStorage.setItem('llm_manager_environments', JSON.stringify(environments));
            
            this.debug.log(`Saved configuration for ${agentName} to ${environment} environment`);
            
            return {
                success: true,
                environment,
                agentName,
                savedAt: environments[environment][agentName].savedAt
            };
            
        } catch (error) {
            this.debug.error('Error saving configuration to environment:', error);
            return {
                success: false,
                error: 'Failed to save configuration to environment',
                details: error.message
            };
        }
    }
    
    /**
     * Load configuration from specific environment
     * @param {string} environment - Environment name
     * @param {string} agentName - Agent name
     * @returns {Object} Configuration or null
     */
    loadConfigurationFromEnvironment(environment, agentName) {
        try {
            const environments = this.getEnvironmentConfigurations();
            
            if (!environments[environment] || !environments[environment][agentName]) {
                return null;
            }
            
            return environments[environment][agentName];
            
        } catch (error) {
            this.debug.error('Error loading configuration from environment:', error);
            return null;
        }
    }
    
    /**
     * Promote configuration between environments
     * @param {string} fromEnvironment - Source environment
     * @param {string} toEnvironment - Target environment
     * @param {string} agentName - Agent name
     * @returns {Promise<Object>} Promotion result
     */
    async promoteConfiguration(fromEnvironment, toEnvironment, agentName) {
        try {
            const sourceConfig = this.loadConfigurationFromEnvironment(fromEnvironment, agentName);
            
            if (!sourceConfig) {
                return {
                    success: false,
                    error: `Configuration not found in ${fromEnvironment} environment`
                };
            }
            
            // Save to target environment
            const saveResult = this.saveConfigurationToEnvironment(toEnvironment, agentName, sourceConfig);
            
            if (!saveResult.success) {
                return saveResult;
            }
            
            // If promoting to current environment, apply the configuration
            if (toEnvironment === 'production') { // Assuming production is the active environment
                const applyResult = await this.updateAgentConfiguration(agentName, sourceConfig, {
                    reason: `Promoted from ${fromEnvironment} to ${toEnvironment}`
                });
                
                if (!applyResult.success) {
                    return {
                        success: false,
                        error: 'Configuration saved to environment but failed to apply',
                        details: applyResult
                    };
                }
            }
            
            this.debug.log(`Promoted configuration for ${agentName} from ${fromEnvironment} to ${toEnvironment}`);
            
            return {
                success: true,
                fromEnvironment,
                toEnvironment,
                agentName,
                promotedAt: new Date().toISOString()
            };
            
        } catch (error) {
            this.debug.error('Error promoting configuration:', error);
            return {
                success: false,
                error: 'Failed to promote configuration',
                details: error.message
            };
        }
    }
    
    /**
     * Cleanup real-time update subscriptions
     */
    cleanup() {
        // Unsubscribe from all update subscriptions
        for (const [agentName, unsubscribe] of this.updateSubscriptions) {
            try {
                unsubscribe();
            } catch (error) {
                this.debug.error(`Error unsubscribing from updates for ${agentName}:`, error);
            }
        }
        
        this.updateSubscriptions.clear();
        this.debug.log('LLMManager cleanup completed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LLMManager;
} else if (typeof window !== 'undefined') {
    window.LLMManager = LLMManager;
}
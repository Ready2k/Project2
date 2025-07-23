/**
 * LLM Provider Manager - Manages multiple LLM providers and routing
 * Handles provider registration, configuration, and request routing
 */
class LLMProviderManager {
    constructor() {
        this.debug = window.debugManager?.createModuleLogger('LLMProviderManager') || console;
        this.providers = new Map();
        this.defaultProvider = null;
        this.agentProviderMappings = new Map();
        
        // Load configuration from localStorage
        this.loadConfiguration();
        
        // Initialize built-in providers
        this.initializeBuiltInProviders();
        
        this.debug.info('LLM Provider Manager initialized', {
            providersCount: this.providers.size,
            defaultProvider: this.defaultProvider
        });
    }
    
    /**
     * Load provider configurations from localStorage
     */
    loadConfiguration() {
        try {
            const savedConfig = localStorage.getItem('llm_provider_configurations');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                this.defaultProvider = config.defaultProvider || 'openai';
                this.agentProviderMappings = new Map(config.agentProviderMappings || []);
                this.debug.info('LLM provider configurations loaded from storage');
            } else {
                this.defaultProvider = 'openai';
                this.agentProviderMappings = new Map();
            }
        } catch (error) {
            this.debug.error('Failed to load LLM provider configurations', { error: error.message });
            this.defaultProvider = 'openai';
            this.agentProviderMappings = new Map();
        }
    }
    
    /**
     * Save provider configurations to localStorage
     */
    saveConfiguration() {
        try {
            const config = {
                defaultProvider: this.defaultProvider,
                agentProviderMappings: Array.from(this.agentProviderMappings.entries())
            };
            localStorage.setItem('llm_provider_configurations', JSON.stringify(config));
            this.debug.info('LLM provider configurations saved to storage');
        } catch (error) {
            this.debug.error('Failed to save LLM provider configurations', { error: error.message });
        }
    }
    
    /**
     * Initialize built-in providers with default configurations
     */
    async initializeBuiltInProviders() {
        try {
            // Initialize OpenAI provider
            const openaiConfig = this.getProviderConfig('openai');
            const openaiProvider = new OpenAIProvider(openaiConfig);
            await this.registerProvider(openaiProvider);
            
            // Initialize Claude provider if configured
            const claudeConfig = this.getProviderConfig('claude');
            if (claudeConfig.apiKey) {
                const claudeProvider = new ClaudeProvider(claudeConfig);
                await this.registerProvider(claudeProvider);
            }
            
            // Initialize Bedrock provider if configured
            const bedrockConfig = this.getProviderConfig('bedrock');
            if (bedrockConfig.accessKeyId && bedrockConfig.secretAccessKey) {
                const bedrockProvider = new BedrockProvider(bedrockConfig);
                await this.registerProvider(bedrockProvider);
            }
            
            this.debug.info('Built-in providers initialized', {
                availableProviders: Array.from(this.providers.keys())
            });
        } catch (error) {
            this.debug.error('Failed to initialize built-in providers', { error: error.message });
        }
    }
    
    /**
     * Get provider configuration from localStorage
     * @param {string} providerName - Name of the provider
     * @returns {Object} - Provider configuration
     */
    getProviderConfig(providerName) {
        try {
            const savedConfigs = localStorage.getItem('llm_provider_configs');
            if (savedConfigs) {
                const configs = JSON.parse(savedConfigs);
                return configs[providerName] || {};
            }
        } catch (error) {
            this.debug.error('Failed to load provider config', { providerName, error: error.message });
        }
        return {};
    }
    
    /**
     * Save provider configuration to localStorage
     * @param {string} providerName - Name of the provider
     * @param {Object} config - Provider configuration
     */
    saveProviderConfig(providerName, config) {
        try {
            let savedConfigs = {};
            const existing = localStorage.getItem('llm_provider_configs');
            if (existing) {
                savedConfigs = JSON.parse(existing);
            }
            
            savedConfigs[providerName] = config;
            localStorage.setItem('llm_provider_configs', JSON.stringify(savedConfigs));
            this.debug.info('Provider configuration saved', { providerName });
        } catch (error) {
            this.debug.error('Failed to save provider config', { providerName, error: error.message });
        }
    }
    
    /**
     * Register a new LLM provider
     * @param {LLMProvider} provider - Provider instance to register
     * @param {Object} config - Optional configuration for the provider
     * @returns {Promise<boolean>} - True if registration successful
     */
    async registerProvider(provider, config = null) {
        try {
            if (!provider || typeof provider.generateChatCompletion !== 'function') {
                throw new Error('Invalid provider: must implement generateChatCompletion() method');
            }
            
            // Initialize provider if not already initialized
            if (!provider.isAvailable()) {
                const initConfig = config || this.getProviderConfig(provider.name);
                const initialized = await provider.initialize(initConfig);
                if (!initialized) {
                    throw new Error(`Failed to initialize provider ${provider.name}`);
                }
            }
            
            this.providers.set(provider.name, provider);
            
            // Set as default if it's the first provider or if it's OpenAI
            if (!this.defaultProvider || provider.name === 'openai') {
                this.defaultProvider = provider.name;
            }
            
            this.saveConfiguration();
            
            this.debug.info('LLM provider registered successfully', {
                name: provider.name,
                isDefault: this.defaultProvider === provider.name,
                capabilities: provider.getCapabilities()
            });
            
            return true;
        } catch (error) {
            this.debug.error('Failed to register LLM provider', {
                name: provider.name,
                error: error.message
            });
            return false;
        }
    }
    
    /**
     * Unregister an LLM provider
     * @param {string} providerName - Name of provider to unregister
     * @returns {boolean} - True if unregistration successful
     */
    unregisterProvider(providerName) {
        if (!this.providers.has(providerName)) {
            this.debug.warn('Provider not found for unregistration', { providerName });
            return false;
        }
        
        this.providers.delete(providerName);
        
        // Remove agent mappings for this provider
        for (const [agentName, mappedProvider] of this.agentProviderMappings.entries()) {
            if (mappedProvider === providerName) {
                this.agentProviderMappings.delete(agentName);
            }
        }
        
        // Update default provider if necessary
        if (this.defaultProvider === providerName) {
            const remainingProviders = Array.from(this.providers.keys());
            this.defaultProvider = remainingProviders.length > 0 ? remainingProviders[0] : null;
        }
        
        this.saveConfiguration();
        
        this.debug.info('LLM provider unregistered', {
            name: providerName,
            newDefault: this.defaultProvider
        });
        
        return true;
    }
    
    /**
     * Get a specific provider by name
     * @param {string} providerName - Name of the provider
     * @returns {LLMProvider|null} - Provider instance or null if not found
     */
    getProvider(providerName) {
        return this.providers.get(providerName) || null;
    }
    
    /**
     * Get all registered providers
     * @returns {Array<LLMProvider>} - Array of provider instances
     */
    getAllProviders() {
        return Array.from(this.providers.values());
    }
    
    /**
     * Get available provider names
     * @returns {Array<string>} - Array of provider names
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys()).filter(name => {
            const provider = this.providers.get(name);
            return provider && provider.isAvailable();
        });
    }
    
    /**
     * Set the default provider
     * @param {string} providerName - Name of the provider to set as default
     * @returns {boolean} - True if successful
     */
    setDefaultProvider(providerName) {
        if (!this.providers.has(providerName)) {
            this.debug.error('Cannot set default provider - provider not found', { providerName });
            return false;
        }
        
        this.defaultProvider = providerName;
        this.saveConfiguration();
        
        this.debug.info('Default provider updated', { defaultProvider: providerName });
        return true;
    }
    
    /**
     * Map an agent to a specific provider
     * @param {string} agentName - Name of the agent
     * @param {string} providerName - Name of the provider
     * @returns {boolean} - True if successful
     */
    setAgentProvider(agentName, providerName) {
        if (!this.providers.has(providerName)) {
            this.debug.error('Cannot map agent to provider - provider not found', {
                agentName,
                providerName
            });
            return false;
        }
        
        this.agentProviderMappings.set(agentName, providerName);
        this.saveConfiguration();
        
        this.debug.info('Agent provider mapping updated', { agentName, providerName });
        return true;
    }
    
    /**
     * Remove agent provider mapping (will use default provider)
     * @param {string} agentName - Name of the agent
     * @returns {boolean} - True if mapping existed and was removed
     */
    removeAgentProvider(agentName) {
        const existed = this.agentProviderMappings.has(agentName);
        this.agentProviderMappings.delete(agentName);
        
        if (existed) {
            this.saveConfiguration();
            this.debug.info('Agent provider mapping removed', { agentName });
        }
        
        return existed;
    }
    
    /**
     * Get the provider for a specific agent
     * @param {string} agentName - Name of the agent
     * @returns {LLMProvider|null} - Provider instance or null if not found
     */
    getProviderForAgent(agentName) {
        const providerName = this.agentProviderMappings.get(agentName) || this.defaultProvider;
        return this.getProvider(providerName);
    }
    
    /**
     * Generate chat completion using the appropriate provider for an agent
     * @param {string} agentName - Name of the agent making the request
     * @param {Array<Object>} messages - Array of message objects
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} - Response object
     */
    async generateChatCompletion(agentName, messages, options = {}) {
        const provider = this.getProviderForAgent(agentName);
        
        if (!provider) {
            throw new Error(`No provider available for agent ${agentName}`);
        }
        
        if (!provider.isAvailable()) {
            throw new Error(`Provider ${provider.name} is not available for agent ${agentName}`);
        }
        
        this.debug.info('Generating chat completion', {
            agentName,
            provider: provider.name,
            messageCount: messages.length
        });
        
        return await provider.generateChatCompletion(messages, options);
    }
    
    /**
     * Generate streaming chat completion using the appropriate provider for an agent
     * @param {string} agentName - Name of the agent making the request
     * @param {Array<Object>} messages - Array of message objects
     * @param {Object} options - Generation options
     * @param {Function} onChunk - Callback for each chunk
     * @returns {Promise<Object>} - Response object
     */
    async generateStreamingCompletion(agentName, messages, options = {}, onChunk = null) {
        const provider = this.getProviderForAgent(agentName);
        
        if (!provider) {
            throw new Error(`No provider available for agent ${agentName}`);
        }
        
        if (!provider.isAvailable()) {
            throw new Error(`Provider ${provider.name} is not available for agent ${agentName}`);
        }
        
        const capabilities = provider.getCapabilities();
        if (!capabilities.streaming) {
            this.debug.warn('Provider does not support streaming, falling back to regular completion', {
                agentName,
                provider: provider.name
            });
            return await provider.generateChatCompletion(messages, options);
        }
        
        this.debug.info('Generating streaming completion', {
            agentName,
            provider: provider.name,
            messageCount: messages.length
        });
        
        return await provider.generateStreamingCompletion(messages, options, onChunk);
    }
    
    /**
     * Get provider statistics and status
     * @returns {Object} - Provider statistics
     */
    getProviderStats() {
        const stats = {
            totalProviders: this.providers.size,
            availableProviders: this.getAvailableProviders().length,
            defaultProvider: this.defaultProvider,
            agentMappings: Object.fromEntries(this.agentProviderMappings),
            providers: {}
        };
        
        for (const [name, provider] of this.providers.entries()) {
            stats.providers[name] = {
                name: provider.name,
                available: provider.isAvailable(),
                capabilities: provider.getCapabilities()
            };
        }
        
        return stats;
    }
    
    /**
     * Test all providers to check their availability
     * @returns {Promise<Object>} - Test results for all providers
     */
    async testAllProviders() {
        const results = {};
        
        for (const [name, provider] of this.providers.entries()) {
            try {
                // Simple test message
                const testMessages = [
                    { role: 'user', content: 'Hello, this is a test message.' }
                ];
                
                const startTime = Date.now();
                const response = await provider.generateChatCompletion(testMessages, {
                    maxTokens: 10,
                    temperature: 0
                });
                const testTime = Date.now() - startTime;
                
                results[name] = {
                    success: response.success,
                    available: provider.isAvailable(),
                    testTime,
                    error: response.error || null,
                    capabilities: provider.getCapabilities()
                };
            } catch (error) {
                results[name] = {
                    success: false,
                    available: false,
                    testTime: 0,
                    error: error.message,
                    capabilities: provider.getCapabilities()
                };
            }
        }
        
        this.debug.info('Provider test completed', { results });
        return results;
    }
    
    /**
     * Get configuration schema for all providers
     * @returns {Object} - Configuration schemas for UI generation
     */
    getProviderConfigSchemas() {
        const schemas = {};
        
        for (const [name, provider] of this.providers.entries()) {
            schemas[name] = provider.getConfigSchema();
        }
        
        return schemas;
    }
    
    /**
     * Update provider configuration
     * @param {string} providerName - Name of the provider
     * @param {Object} config - New configuration
     * @returns {Promise<boolean>} - True if successful
     */
    async updateProviderConfig(providerName, config) {
        const provider = this.getProvider(providerName);
        if (!provider) {
            this.debug.error('Provider not found for configuration update', { providerName });
            return false;
        }
        
        try {
            // Validate configuration
            const validation = provider.validateConfig(config);
            if (!validation.valid) {
                throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
            }
            
            // Save configuration
            this.saveProviderConfig(providerName, config);
            
            // Reinitialize provider with new configuration
            const initialized = await provider.initialize(config);
            if (!initialized) {
                throw new Error('Failed to reinitialize provider with new configuration');
            }
            
            this.debug.info('Provider configuration updated successfully', { providerName });
            return true;
        } catch (error) {
            this.debug.error('Failed to update provider configuration', {
                providerName,
                error: error.message
            });
            return false;
        }
    }
    
    /**
     * Export provider configurations for backup
     * @returns {Object} - All provider configurations
     */
    exportConfigurations() {
        return {
            defaultProvider: this.defaultProvider,
            agentProviderMappings: Object.fromEntries(this.agentProviderMappings),
            providerConfigs: JSON.parse(localStorage.getItem('llm_provider_configs') || '{}')
        };
    }
    
    /**
     * Import provider configurations from backup
     * @param {Object} configurations - Configuration data to import
     * @returns {Promise<boolean>} - True if successful
     */
    async importConfigurations(configurations) {
        try {
            if (configurations.defaultProvider) {
                this.defaultProvider = configurations.defaultProvider;
            }
            
            if (configurations.agentProviderMappings) {
                this.agentProviderMappings = new Map(Object.entries(configurations.agentProviderMappings));
            }
            
            if (configurations.providerConfigs) {
                localStorage.setItem('llm_provider_configs', JSON.stringify(configurations.providerConfigs));
            }
            
            this.saveConfiguration();
            
            // Reinitialize providers with new configurations
            await this.initializeBuiltInProviders();
            
            this.debug.info('Provider configurations imported successfully');
            return true;
        } catch (error) {
            this.debug.error('Failed to import provider configurations', { error: error.message });
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LLMProviderManager;
} else {
    window.LLMProviderManager = LLMProviderManager;
}
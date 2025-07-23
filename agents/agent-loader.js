/**
 * Agent Loader - Dynamic agent loading and registration system
 * Supports loading agents from modules, configuration, and runtime registration
 */
class AgentLoader {
    constructor(agentRouter) {
        this.agentRouter = agentRouter;
        this.debug = window.debugManager?.createModuleLogger('AgentLoader') || console;
        this.loadedAgents = new Map();
        this.agentFactories = new Map();
        this.loadingQueue = [];
        this.isLoading = false;
        
        // Register built-in agent factories
        this.registerBuiltInFactories();
        
        this.debug.info('Agent Loader initialized');
    }
    
    /**
     * Register built-in agent factories
     */
    registerBuiltInFactories() {
        // Register factories for built-in agents
        this.agentFactories.set('PaymentsAgent', {
            name: 'PaymentsAgent',
            description: 'Handles payment and money transfer requests',
            factory: () => new PaymentsAgent(),
            dependencies: ['SecurityManager'],
            category: 'financial'
        });
        
        this.agentFactories.set('FraudAgent', {
            name: 'FraudAgent',
            description: 'Handles fraud detection and security requests',
            factory: () => new FraudAgent(),
            dependencies: ['SecurityManager'],
            category: 'security'
        });
        
        this.agentFactories.set('IDVAgent', {
            name: 'IDVAgent',
            description: 'Handles identity verification requests',
            factory: () => new IDVAgent(),
            dependencies: [],
            category: 'identity'
        });
        
        this.agentFactories.set('BankingInfoAgent', {
            name: 'BankingInfoAgent',
            description: 'Handles banking information and account queries',
            factory: () => new BankingInfoAgent(),
            dependencies: [],
            category: 'information'
        });
        
        this.debug.info('Built-in agent factories registered', {
            count: this.agentFactories.size,
            agents: Array.from(this.agentFactories.keys())
        });
    }
    
    /**
     * Register a custom agent factory
     * @param {string} name - Agent name
     * @param {Object} factoryConfig - Factory configuration
     * @returns {boolean} - True if registration successful
     */
    registerAgentFactory(name, factoryConfig) {
        try {
            if (!factoryConfig.factory || typeof factoryConfig.factory !== 'function') {
                throw new Error('Factory must be a function');
            }
            
            const config = {
                name,
                description: factoryConfig.description || `Custom agent: ${name}`,
                factory: factoryConfig.factory,
                dependencies: factoryConfig.dependencies || [],
                category: factoryConfig.category || 'custom',
                version: factoryConfig.version || '1.0.0',
                author: factoryConfig.author || 'Unknown',
                config: factoryConfig.config || {}
            };
            
            this.agentFactories.set(name, config);
            
            this.debug.info('Custom agent factory registered', { name, config });
            return true;
        } catch (error) {
            this.debug.error('Failed to register agent factory', { name, error: error.message });
            return false;
        }
    }
    
    /**
     * Unregister an agent factory
     * @param {string} name - Agent name to unregister
     * @returns {boolean} - True if unregistration successful
     */
    unregisterAgentFactory(name) {
        if (!this.agentFactories.has(name)) {
            this.debug.warn('Agent factory not found for unregistration', { name });
            return false;
        }
        
        this.agentFactories.delete(name);
        
        // Also unload the agent if it's currently loaded
        if (this.loadedAgents.has(name)) {
            this.unloadAgent(name);
        }
        
        this.debug.info('Agent factory unregistered', { name });
        return true;
    }
    
    /**
     * Load an agent by name
     * @param {string} agentName - Name of the agent to load
     * @param {Object} config - Optional configuration for the agent
     * @returns {Promise<boolean>} - True if loading successful
     */
    async loadAgent(agentName, config = {}) {
        try {
            if (this.loadedAgents.has(agentName)) {
                this.debug.warn('Agent already loaded', { agentName });
                return true;
            }
            
            const factory = this.agentFactories.get(agentName);
            if (!factory) {
                throw new Error(`Agent factory not found: ${agentName}`);
            }
            
            // Check dependencies
            const dependenciesAvailable = await this.checkDependencies(factory.dependencies);
            if (!dependenciesAvailable) {
                throw new Error(`Dependencies not available for agent: ${agentName}`);
            }
            
            // Create agent instance
            const agent = factory.factory();
            if (!agent) {
                throw new Error(`Factory returned null for agent: ${agentName}`);
            }
            
            // Validate agent interface
            if (!this.validateAgentInterface(agent)) {
                throw new Error(`Agent does not implement required interface: ${agentName}`);
            }
            
            // Register agent with router
            const registrationConfig = {
                ...factory.config,
                ...config,
                category: factory.category,
                version: factory.version,
                author: factory.author
            };
            
            this.agentRouter.registerAgent(agent, registrationConfig);
            
            // Track loaded agent
            this.loadedAgents.set(agentName, {
                agent,
                factory,
                config: registrationConfig,
                loadedAt: new Date().toISOString()
            });
            
            this.debug.info('Agent loaded successfully', {
                agentName,
                category: factory.category,
                version: factory.version
            });
            
            return true;
        } catch (error) {
            this.debug.error('Failed to load agent', { agentName, error: error.message });
            return false;
        }
    }
    
    /**
     * Unload an agent by name
     * @param {string} agentName - Name of the agent to unload
     * @returns {boolean} - True if unloading successful
     */
    unloadAgent(agentName) {
        try {
            if (!this.loadedAgents.has(agentName)) {
                this.debug.warn('Agent not loaded for unloading', { agentName });
                return false;
            }
            
            // Unregister from router
            this.agentRouter.unregisterAgent(agentName);
            
            // Remove from loaded agents
            this.loadedAgents.delete(agentName);
            
            this.debug.info('Agent unloaded successfully', { agentName });
            return true;
        } catch (error) {
            this.debug.error('Failed to unload agent', { agentName, error: error.message });
            return false;
        }
    }
    
    /**
     * Load multiple agents
     * @param {Array<string>} agentNames - Array of agent names to load
     * @param {Object} globalConfig - Global configuration for all agents
     * @returns {Promise<Object>} - Loading results
     */
    async loadAgents(agentNames, globalConfig = {}) {
        const results = {
            successful: [],
            failed: [],
            total: agentNames.length
        };
        
        this.debug.info('Loading multiple agents', { agentNames, count: agentNames.length });
        
        for (const agentName of agentNames) {
            const success = await this.loadAgent(agentName, globalConfig);
            if (success) {
                results.successful.push(agentName);
            } else {
                results.failed.push(agentName);
            }
        }
        
        this.debug.info('Batch agent loading completed', results);
        return results;
    }
    
    /**
     * Load agents from configuration
     * @param {Object} config - Configuration object with agent definitions
     * @returns {Promise<Object>} - Loading results
     */
    async loadAgentsFromConfig(config) {
        try {
            if (!config.agents || !Array.isArray(config.agents)) {
                throw new Error('Invalid configuration: agents array required');
            }
            
            const results = {
                successful: [],
                failed: [],
                total: config.agents.length
            };
            
            for (const agentConfig of config.agents) {
                if (!agentConfig.name) {
                    this.debug.error('Agent configuration missing name', { agentConfig });
                    results.failed.push('unnamed-agent');
                    continue;
                }
                
                const success = await this.loadAgent(agentConfig.name, agentConfig);
                if (success) {
                    results.successful.push(agentConfig.name);
                } else {
                    results.failed.push(agentConfig.name);
                }
            }
            
            this.debug.info('Configuration-based agent loading completed', results);
            return results;
        } catch (error) {
            this.debug.error('Failed to load agents from configuration', { error: error.message });
            return {
                successful: [],
                failed: ['configuration-error'],
                total: 0,
                error: error.message
            };
        }
    }
    
    /**
     * Load agents from URL (for external agent modules)
     * @param {string} url - URL to load agent module from
     * @returns {Promise<boolean>} - True if loading successful
     */
    async loadAgentFromURL(url) {
        try {
            this.debug.info('Loading agent from URL', { url });
            
            // Dynamically import the module
            const module = await import(url);
            
            if (!module.default && !module.AgentFactory) {
                throw new Error('Module must export default or AgentFactory');
            }
            
            const factory = module.default || module.AgentFactory;
            
            if (typeof factory !== 'function' && typeof factory.create !== 'function') {
                throw new Error('Module must export a factory function or object with create method');
            }
            
            // Extract agent metadata
            const metadata = module.metadata || {};
            const agentName = metadata.name || 'ExternalAgent';
            
            // Register factory
            const factoryConfig = {
                description: metadata.description || 'External agent',
                factory: typeof factory === 'function' ? factory : factory.create,
                dependencies: metadata.dependencies || [],
                category: metadata.category || 'external',
                version: metadata.version || '1.0.0',
                author: metadata.author || 'External',
                config: metadata.config || {}
            };
            
            this.registerAgentFactory(agentName, factoryConfig);
            
            // Load the agent
            const success = await this.loadAgent(agentName);
            
            this.debug.info('External agent loaded from URL', { url, agentName, success });
            return success;
        } catch (error) {
            this.debug.error('Failed to load agent from URL', { url, error: error.message });
            return false;
        }
    }
    
    /**
     * Check if dependencies are available
     * @param {Array<string>} dependencies - Array of dependency names
     * @returns {Promise<boolean>} - True if all dependencies are available
     */
    async checkDependencies(dependencies) {
        if (!dependencies || dependencies.length === 0) {
            return true;
        }
        
        for (const dependency of dependencies) {
            switch (dependency) {
                case 'SecurityManager':
                    if (!window.SecurityManager) {
                        this.debug.error('SecurityManager dependency not available');
                        return false;
                    }
                    break;
                case 'PersonaManager':
                    if (!window.PersonaManager) {
                        this.debug.error('PersonaManager dependency not available');
                        return false;
                    }
                    break;
                case 'SystemPromptsManager':
                    if (!window.SystemPromptsManager) {
                        this.debug.error('SystemPromptsManager dependency not available');
                        return false;
                    }
                    break;
                default:
                    this.debug.warn('Unknown dependency', { dependency });
            }
        }
        
        return true;
    }
    
    /**
     * Validate that an agent implements the required interface
     * @param {Object} agent - Agent instance to validate
     * @returns {boolean} - True if agent is valid
     */
    validateAgentInterface(agent) {
        const requiredMethods = ['canHandle', 'handle'];
        const requiredProperties = ['name', 'description'];
        
        for (const method of requiredMethods) {
            if (typeof agent[method] !== 'function') {
                this.debug.error('Agent missing required method', { method });
                return false;
            }
        }
        
        for (const property of requiredProperties) {
            if (!agent[property]) {
                this.debug.error('Agent missing required property', { property });
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get list of available agent factories
     * @returns {Array<Object>} - Array of factory information
     */
    getAvailableFactories() {
        return Array.from(this.agentFactories.values()).map(factory => ({
            name: factory.name,
            description: factory.description,
            category: factory.category,
            version: factory.version,
            author: factory.author,
            dependencies: factory.dependencies,
            loaded: this.loadedAgents.has(factory.name)
        }));
    }
    
    /**
     * Get list of loaded agents
     * @returns {Array<Object>} - Array of loaded agent information
     */
    getLoadedAgents() {
        return Array.from(this.loadedAgents.values()).map(loaded => ({
            name: loaded.agent.name,
            description: loaded.agent.description,
            category: loaded.factory.category,
            version: loaded.factory.version,
            author: loaded.factory.author,
            loadedAt: loaded.loadedAt,
            config: loaded.config
        }));
    }
    
    /**
     * Reload an agent (unload and load again)
     * @param {string} agentName - Name of the agent to reload
     * @param {Object} config - Optional new configuration
     * @returns {Promise<boolean>} - True if reload successful
     */
    async reloadAgent(agentName, config = {}) {
        this.debug.info('Reloading agent', { agentName });
        
        const wasLoaded = this.loadedAgents.has(agentName);
        if (wasLoaded) {
            this.unloadAgent(agentName);
        }
        
        return await this.loadAgent(agentName, config);
    }
    
    /**
     * Get agent loading statistics
     * @returns {Object} - Loading statistics
     */
    getStats() {
        const loadedAgents = this.getLoadedAgents();
        const availableFactories = this.getAvailableFactories();
        
        const categoryCounts = {};
        loadedAgents.forEach(agent => {
            categoryCounts[agent.category] = (categoryCounts[agent.category] || 0) + 1;
        });
        
        return {
            totalFactories: this.agentFactories.size,
            loadedAgents: this.loadedAgents.size,
            availableFactories: availableFactories.length,
            categoryCounts,
            loadingQueue: this.loadingQueue.length,
            isLoading: this.isLoading
        };
    }
    
    /**
     * Export agent configuration for backup
     * @returns {Object} - Agent configuration export
     */
    exportConfiguration() {
        const loadedAgents = this.getLoadedAgents();
        const config = {
            agents: loadedAgents.map(agent => ({
                name: agent.name,
                enabled: true,
                config: agent.config
            })),
            metadata: {
                exportedAt: new Date().toISOString(),
                version: '1.0.0'
            }
        };
        
        return config;
    }
    
    /**
     * Import agent configuration from backup
     * @param {Object} config - Configuration to import
     * @returns {Promise<Object>} - Import results
     */
    async importConfiguration(config) {
        try {
            if (!config.agents) {
                throw new Error('Invalid configuration: agents array required');
            }
            
            // Unload all current agents
            const currentAgents = Array.from(this.loadedAgents.keys());
            for (const agentName of currentAgents) {
                this.unloadAgent(agentName);
            }
            
            // Load agents from configuration
            const results = await this.loadAgentsFromConfig(config);
            
            this.debug.info('Agent configuration imported', results);
            return results;
        } catch (error) {
            this.debug.error('Failed to import agent configuration', { error: error.message });
            return {
                successful: [],
                failed: ['import-error'],
                total: 0,
                error: error.message
            };
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentLoader;
} else {
    window.AgentLoader = AgentLoader;
}
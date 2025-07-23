/**
 * AgentRouter - Routes user input to appropriate domain-specific agents
 * Implements priority-based agent selection with fallback handling
 */
class AgentRouter {
    constructor(agents = []) {
        this.agents = agents;
        this.debug = window.debugManager.createModuleLogger('AgentRouter');
        this.fallbackHandler = new FallbackHandler();
        
        // Initialize configuration manager
        this.configManager = new AgentConfigManager();
        
        // Initialize security manager
        this.securityManager = new SecurityManager();
        
        // Set up security for existing agents
        this.initializeAgentSecurity();
        
        // Apply configurations to existing agents
        this.applyConfigurationsToAgents();
        
        this.debug.info('AgentRouter initialized with security and configuration', { 
            agentCount: agents.length,
            agentNames: agents.map(a => a.name),
            configuredAgents: Object.keys(this.configManager.getAllConfigs()).length
        });
    }
    
    /**
     * Initialize security for all agents
     */
    initializeAgentSecurity() {
        for (const agent of this.agents) {
            this.setupAgentSecurity(agent);
        }
    }
    
    /**
     * Apply configurations to all registered agents
     */
    applyConfigurationsToAgents() {
        for (const agent of this.agents) {
            this.applyConfigurationToAgent(agent);
        }
    }
    
    /**
     * Apply configuration to a specific agent
     * @param {BaseAgent} agent - Agent to configure
     */
    applyConfigurationToAgent(agent) {
        const config = this.configManager.getAgentConfig(agent.name);
        if (config) {
            // Apply configuration properties to agent
            agent.config = config;
            agent.enabled = config.enabled;
            agent.priority = config.priority;
            
            this.debug.info('Configuration applied to agent', { 
                name: agent.name, 
                enabled: config.enabled,
                priority: config.priority
            });
        }
    }
    
    /**
     * Set up security manager and sandboxed API client for an agent
     * @param {BaseAgent} agent - Agent to set up security for
     */
    setupAgentSecurity(agent) {
        // Set security manager
        agent.setSecurityManager(this.securityManager);
        
        this.debug.info('Security initialized for agent', { name: agent.name });
    }
    
    /**
     * Register a new agent with the router
     * @param {BaseAgent} agent - Agent instance to register
     * @param {Object} config - Optional configuration for the agent
     */
    registerAgent(agent, config = null) {
        if (!agent || typeof agent.canHandle !== 'function' || typeof agent.handle !== 'function') {
            throw new Error('Invalid agent: must implement canHandle() and handle() methods');
        }
        
        // Create default configuration if none exists
        if (!this.configManager.getAgentConfig(agent.name)) {
            const defaultConfig = {
                name: agent.name,
                description: agent.description || `Agent for ${agent.name}`,
                enabled: true,
                priority: 100,
                llmProvider: 'openai',
                llmModel: 'gpt-3.5-turbo',
                systemPromptOverride: null,
                telemetryEnabled: true,
                maxRetries: 3,
                timeout: 30000,
                triggers: [],
                customSettings: {}
            };
            
            // Merge with provided config
            const finalConfig = config ? { ...defaultConfig, ...config } : defaultConfig;
            this.configManager.setAgentConfig(agent.name, finalConfig);
        } else if (config) {
            // Update existing configuration with provided config
            this.configManager.setAgentConfig(agent.name, config);
        }
        
        this.agents.push(agent);
        
        // Set up security for the new agent
        this.setupAgentSecurity(agent);
        
        // Apply configuration to the new agent
        this.applyConfigurationToAgent(agent);
        
        // Sort agents by priority after registration
        this.sortAgentsByPriority();
        
        this.debug.info('Agent registered with security and configuration', { 
            name: agent.name,
            enabled: agent.enabled,
            priority: agent.priority
        });
    }
    
    /**
     * Remove an agent from the router
     * @param {string} agentName - Name of agent to remove
     * @returns {boolean} - True if agent was found and removed
     */
    unregisterAgent(agentName) {
        const initialLength = this.agents.length;
        this.agents = this.agents.filter(agent => agent.name !== agentName);
        const removed = this.agents.length < initialLength;
        
        if (removed) {
            this.debug.info('Agent unregistered', { name: agentName });
        } else {
            this.debug.warn('Agent not found for removal', { name: agentName });
        }
        
        return removed;
    }
    
    /**
     * Sort agents by priority (lower priority number = higher priority)
     */
    sortAgentsByPriority() {
        this.agents.sort((a, b) => {
            const priorityA = a.priority || 100;
            const priorityB = b.priority || 100;
            return priorityA - priorityB;
        });
        
        this.debug.info('Agents sorted by priority', {
            order: this.agents.map(a => ({ name: a.name, priority: a.priority || 100 }))
        });
    }
    
    /**
     * Get list of all registered agents
     * @returns {Array<BaseAgent>} - Array of registered agents
     */
    getRegisteredAgents() {
        return [...this.agents];
    }
    
    /**
     * Get list of enabled agents only
     * @returns {Array<BaseAgent>} - Array of enabled agents
     */
    getEnabledAgents() {
        return this.agents.filter(agent => agent.enabled !== false);
    }
    
    /**
     * Get agent configuration manager
     * @returns {AgentConfigManager} - Configuration manager instance
     */
    getConfigManager() {
        return this.configManager;
    }
    
    /**
     * Enable an agent by name
     * @param {string} agentName - Name of agent to enable
     * @returns {boolean} - True if successful
     */
    enableAgent(agentName) {
        const success = this.configManager.enableAgent(agentName);
        if (success) {
            // Update the agent instance
            const agent = this.agents.find(a => a.name === agentName);
            if (agent) {
                agent.enabled = true;
                this.debug.info('Agent enabled', { name: agentName });
            }
        }
        return success;
    }
    
    /**
     * Disable an agent by name
     * @param {string} agentName - Name of agent to disable
     * @returns {boolean} - True if successful
     */
    disableAgent(agentName) {
        const success = this.configManager.disableAgent(agentName);
        if (success) {
            // Update the agent instance
            const agent = this.agents.find(a => a.name === agentName);
            if (agent) {
                agent.enabled = false;
                this.debug.info('Agent disabled', { name: agentName });
            }
        }
        return success;
    }
    
    /**
     * Set agent priority
     * @param {string} agentName - Name of agent
     * @param {number} priority - Priority value (lower = higher priority)
     * @returns {boolean} - True if successful
     */
    setAgentPriority(agentName, priority) {
        const success = this.configManager.setAgentPriority(agentName, priority);
        if (success) {
            // Update the agent instance
            const agent = this.agents.find(a => a.name === agentName);
            if (agent) {
                agent.priority = priority;
                // Re-sort agents by new priority
                this.sortAgentsByPriority();
                this.debug.info('Agent priority updated', { name: agentName, priority });
            }
        }
        return success;
    }
    
    /**
     * Route user input to the most appropriate agent
     * @param {string} inputText - The user's input text
     * @param {Object} context - Context object containing app state and dependencies
     * @returns {Promise<Object>} - Agent response object
     */
    async route(inputText, context) {
        const startTime = Date.now();
        
        try {
            this.debug.info('Routing request', { inputText: inputText.substring(0, 100) });
            
            // Find the best agent for this input
            const agent = this.findBestAgent(inputText);
            
            // Log agent routing decision for debugging
            if (window.debugManager) {
                window.debugManager.logAgentRouting(inputText, agent, this.agents);
            }
            
            if (agent) {
                this.debug.info('Agent selected', { agentName: agent.name });
                
                // Create sandboxed API client for this agent if not already set
                if (!agent.sandboxedApiClient && context.apiClient) {
                    const sandboxedClient = this.securityManager.createSandboxedApiClient(agent.name, context.apiClient);
                    agent.setSandboxedApiClient(sandboxedClient);
                }
                
                // Activate agent and process request
                agent.onActivate(inputText, context);
                const result = await agent.handle(inputText, context);
                agent.onComplete(result, inputText, startTime);
                
                const processingTime = Date.now() - startTime;
                this.debug.info('Agent routing completed', { 
                    agentName: agent.name,
                    success: result.success,
                    processingTime 
                });
                
                return result;
            }
            
            // No agent could handle the request, use fallback
            this.debug.info('No agent found, using fallback handler');
            const result = await this.fallbackHandler.handle(inputText, context);
            
            const processingTime = Date.now() - startTime;
            this.debug.info('Fallback routing completed', { 
                success: result.success,
                processingTime 
            });
            
            return result;
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.debug.error('Routing failed', { error: error.message, processingTime });
            
            // Return error response
            return {
                success: false,
                response: 'I apologize, but I encountered an error processing your request. Please try again.',
                agentName: 'AgentRouter',
                processingTime,
                tokensUsed: 0,
                error: error.message,
                metadata: {
                    timestamp: new Date().toISOString(),
                    routingError: true
                }
            };
        }
    }
    
    /**
     * Find the best agent to handle the given input
     * Uses priority-based selection - first matching enabled agent wins
     * @param {string} inputText - The user's input text
     * @returns {BaseAgent|null} - Best matching agent or null if none found
     */
    findBestAgent(inputText) {
        if (!inputText || typeof inputText !== 'string') {
            this.debug.warn('Invalid input text for agent selection');
            return null;
        }
        
        // Get only enabled agents, already sorted by priority
        const enabledAgents = this.getEnabledAgents();
        
        // Iterate through enabled agents in priority order
        for (const agent of enabledAgents) {
            try {
                if (agent.canHandle(inputText)) {
                    this.debug.info('Agent match found', { 
                        agentName: agent.name,
                        priority: agent.priority || 100,
                        inputPreview: inputText.substring(0, 50)
                    });
                    return agent;
                }
            } catch (error) {
                this.debug.error('Error in agent canHandle() method', { 
                    agentName: agent.name,
                    error: error.message 
                });
                // Continue to next agent if this one fails
            }
        }
        
        this.debug.info('No matching enabled agent found', { 
            inputPreview: inputText.substring(0, 50),
            enabledAgents: enabledAgents.map(a => a.name),
            totalAgents: this.agents.length
        });
        
        return null;
    }
    
    /**
     * Get routing statistics
     * @returns {Object} - Statistics about registered agents and routing
     */
    getStats() {
        const enabledAgents = this.getEnabledAgents();
        const disabledAgents = this.agents.filter(agent => agent.enabled === false);
        
        return {
            totalAgents: this.agents.length,
            enabledAgents: enabledAgents.length,
            disabledAgents: disabledAgents.length,
            agentNames: this.agents.map(a => a.name),
            agentDescriptions: this.agents.map(a => ({ 
                name: a.name, 
                description: a.description,
                enabled: a.enabled !== false,
                priority: a.priority || 100
            })),
            priorityOrder: enabledAgents.map(a => ({ name: a.name, priority: a.priority || 100 })),
            configurationStatus: this.configManager.getAgentStatusSummary(),
            securityStats: this.securityManager.getSecurityStats()
        };
    }
    
    /**
     * Get security audit log
     * @param {Object} filters - Optional filters for the audit log
     * @returns {Array<Object>} - Security audit log entries
     */
    getSecurityAuditLog(filters = {}) {
        return this.securityManager.getAuditLog(filters);
    }
    
    /**
     * Get security manager instance for testing purposes
     * @returns {SecurityManager} - Security manager instance
     */
    getSecurityManager() {
        return this.securityManager;
    }
}

/**
 * FallbackHandler - Handles requests when no specific agent can process them
 * Provides default behavior similar to the original system
 */
class FallbackHandler {
    constructor() {
        this.debug = window.debugManager.createModuleLogger('FallbackHandler');
    }
    
    /**
     * Handle requests that no specific agent could process
     * @param {string} inputText - The user's input text
     * @param {Object} context - Context object containing app state and dependencies
     * @returns {Promise<Object>} - Fallback response object
     */
    async handle(inputText, context) {
        const startTime = Date.now();
        
        try {
            this.debug.info('Fallback handler processing request');
            
            // Validate context has required dependencies
            if (!context.apiClient || !context.systemPromptsManager) {
                throw new Error('Required dependencies not available in context');
            }
            
            // Generate system prompt using existing system
            const systemPrompt = context.systemPromptsManager.getSystemPrompt();
            
            // Add fallback context
            const fallbackPrompt = systemPrompt + '\n\nYou are handling a general banking inquiry that doesn\'t fit into specific categories.';
            
            // Call LLM using existing API client
            const messages = [
                { role: 'system', content: fallbackPrompt },
                { role: 'user', content: inputText }
            ];
            
            const response = await context.apiClient.generateChatCompletion(messages, {
                model: 'gpt-3.5-turbo',
                maxTokens: 400,
                temperature: 0.7
            });
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            const processingTime = Date.now() - startTime;
            
            return {
                success: true,
                response: response.content,
                agentName: 'FallbackHandler',
                processingTime,
                tokensUsed: response.tokensUsed || 0,
                error: null,
                metadata: {
                    timestamp: new Date().toISOString(),
                    fallbackUsed: true
                }
            };
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.debug.error('Fallback handler failed', { error: error.message });
            
            return {
                success: false,
                response: 'I apologize, but I\'m having trouble processing your request right now. Please try again later.',
                agentName: 'FallbackHandler',
                processingTime,
                tokensUsed: 0,
                error: error.message,
                metadata: {
                    timestamp: new Date().toISOString(),
                    fallbackError: true
                }
            };
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AgentRouter, FallbackHandler };
} else {
    window.AgentRouter = AgentRouter;
    window.FallbackHandler = FallbackHandler;
}
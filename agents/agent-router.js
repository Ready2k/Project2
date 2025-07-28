/**
 * AgentRouter - Routes user input to appropriate domain-specific agents
 * Implements priority-based agent selection with fallback handling
 */
class AgentRouter {
    constructor({ agents = [], apiClient } = {}) {
        this.agents = agents;
        this.apiClient = apiClient;
        this.debug = window.debugManager.createModuleLogger('AgentRouter');
        this.fallbackHandler = new FallbackHandler(this.apiClient);
        
        // Initialize routing cache
        this.routingCache = new LRUCache(100);
        this.cacheHits = 0;
        this.cacheMisses = 0;
        
        // Initialize routing fallback chain
        this.fallbackChain = new RoutingFallbackChain(this);
        
        // Initialize conversation context manager
        this.contextManager = new ConversationContextManager();

        
        // Initialize configuration manager
        this.configManager = new AgentConfigManager();
        
        // Initialize security manager
        this.securityManager = new SecurityManager();
        
        // Initialize guardrails manager (if available)
        this.guardrailsManager = null;
        try {
            if (typeof GuardrailsManager !== 'undefined') {
                this.guardrailsManager = new GuardrailsManager();
            }
        } catch (error) {
            this.debug.warn('GuardrailsManager not available, continuing without guardrails');
        }
        
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
        
        // Set guardrails manager (if available)
        if (this.guardrailsManager) {
            agent.setGuardrailsManager(this.guardrailsManager);
        }
        
        this.debug.info('Security and guardrails initialized for agent', { name: agent.name });
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
        
        // Invalidate routing cache due to new agent registration
        this.invalidateRoutingCache('New agent registered');
        
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
            // Invalidate routing cache due to agent removal
            this.invalidateRoutingCache('Agent unregistered');
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
                
                // Invalidate routing cache due to configuration change
                this.invalidateRoutingCache('Agent configuration changed');
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
                
                // Invalidate routing cache due to configuration change
                this.invalidateRoutingCache('Agent configuration changed');
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
                
                // Invalidate routing cache due to configuration change
                this.invalidateRoutingCache('Agent priority changed');
            }
        }
        return success;
    }
    
    /**
     * Generate cache key for routing decisions
     * @param {string} inputText - User input text
     * @param {Object} context - Context object
     * @returns {string} - Cache key
     */
    generateCacheKey(inputText, context = {}) {
        // Normalize input text for consistent caching
        const normalizedInput = inputText.toLowerCase().trim();
        
        // Include relevant context in cache key
        const contextParts = [];
        if (context.lastAgentUsed) {
            contextParts.push(`lastAgent:${context.lastAgentUsed}`);
        }
        
        // Include enabled agents configuration in cache key
        const enabledAgentNames = this.getEnabledAgents().map(a => a.name).sort().join(',');
        contextParts.push(`agents:${enabledAgentNames}`);
        
        // Create hash-like key to avoid very long keys
        const contextString = contextParts.join('|');
        const cacheKey = `${normalizedInput}|${contextString}`;
        
        // Truncate very long keys to prevent memory issues
        return cacheKey.length > 200 ? cacheKey.substring(0, 200) + '...' : cacheKey;
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
            
            // Check cache first for routing decision
            const cacheKey = this.generateCacheKey(inputText, context);
            const cachedAgentName = this.routingCache.get(cacheKey);
            
            let agent = null;
            if (cachedAgentName) {
                // Find cached agent by name
                agent = this.agents.find(a => a.name === cachedAgentName && a.enabled !== false);
                if (agent) {
                    this.cacheHits++;
                    this.debug.info('Using cached routing decision', { 
                        agentName: cachedAgentName,
                        cacheKey: cacheKey.substring(0, 50) + '...'
                    });
                } else {
                    // Cached agent no longer available, invalidate cache entry
                    this.routingCache.delete(cacheKey);
                    this.debug.warn('Cached agent no longer available, invalidating cache', { 
                        cachedAgentName 
                    });
                }
            }
            
            // If no cached result or cached agent unavailable, find best agent
            if (!agent) {
                this.cacheMisses++;
                
                // Enhance context with conversation history
                const enhancedContext = {
                    ...context,
                    ...this.contextManager.getRoutingContext()
                };
                
                agent = await this.findBestAgent(inputText, enhancedContext);
                
                // Cache the routing decision if successful
                if (agent) {
                    this.routingCache.set(cacheKey, agent.name);
                    this.debug.info('Cached routing decision', { 
                        agentName: agent.name,
                        cacheKey: cacheKey.substring(0, 50) + '...'
                    });
                }
            }
            
            // Log agent routing decision for debugging
            if (window.debugManager) {
                window.debugManager.logAgentRouting(inputText, agent, this.agents);
            }
            
            if (agent) {
                this.debug.info('Agent selected', { agentName: agent.name });
                
                // Record user message in conversation history
                this.contextManager.addMessage('user', inputText);
                
                // Create sandboxed API client for this agent if not already set
                if (!agent.sandboxedApiClient && context.apiClient) {
                    const sandboxedClient = this.securityManager.createSandboxedApiClient(agent.name, context.apiClient);
                    agent.setSandboxedApiClient(sandboxedClient);
                }
                
                // Activate agent and process request
                agent.onActivate(inputText, context);
                const result = await agent.handle(inputText, context);
                agent.onComplete(result, inputText, startTime);
                
                // Record agent response in conversation history
                if (result.success && result.response) {
                    this.contextManager.addMessage('assistant', result.response, agent.name, {
                        processingTime: result.processingTime,
                        tokensUsed: result.tokensUsed
                    });
                }
                
                const processingTime = Date.now() - startTime;
                
                // Log routing decision with performance monitoring
                this.logRoutingDecision(inputText, agent, processingTime, {
                    cacheHit: cachedAgentName !== null,
                    success: result.success,
                    tokensUsed: result.tokensUsed
                });
                
                return result;
            }
            
            // No agent could handle the request, use fallback
            this.debug.info('No agent found, using fallback handler');
            
            // Record user message in conversation history
            this.contextManager.addMessage('user', inputText);
            
            const result = await this.fallbackHandler.handle(inputText, context);
            
            // Record fallback response in conversation history
            if (result.success && result.response) {
                this.contextManager.addMessage('assistant', result.response, 'FallbackHandler', {
                    processingTime: result.processingTime,
                    tokensUsed: result.tokensUsed,
                    fallbackUsed: true
                });
            }
            
            const processingTime = Date.now() - startTime;
            
            // Log fallback routing decision
            this.logRoutingDecision(inputText, null, processingTime, {
                fallbackUsed: true,
                success: result.success,
                tokensUsed: result.tokensUsed
            });
            
            return result;
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            // Enhanced error handling with detailed context
            const errorContext = {
                inputText: inputText.substring(0, 100),
                processingTime,
                enabledAgents: this.getEnabledAgents().map(a => a.name),
                cacheStats: this.getCacheStats(),
                contextStats: this.contextManager.getStats(),
                errorType: error.constructor.name,
                stackTrace: error.stack
            };
            
            this.debug.error('Routing failed with detailed context', { 
                error: error.message, 
                context: errorContext 
            });
            
            // Record error in conversation history
            this.contextManager.addMessage('user', inputText);
            this.contextManager.addMessage('assistant', 'Error occurred during routing', 'AgentRouter', {
                error: true,
                errorMessage: error.message,
                processingTime
            });
            
            // Attempt graceful degradation
            const fallbackResponse = await this.handleRoutingError(error, inputText, context, startTime);
            
            return fallbackResponse;
        }
    }
    
    /**
     * Find the best agent to handle the given input
     * Uses fallback chain with multiple routing strategies
     * @param {string} inputText - The user's input text
     * @param {Object} context - Context object for routing
     * @returns {Promise<BaseAgent|null>} - Best matching agent or null if none found
     */
    async findBestAgent(inputText, context = null) {
        if (!inputText || typeof inputText !== 'string') {
            this.debug.warn('Invalid input text for agent selection');
            return null;
        }
        
        try {
            // Use fallback chain to find best agent
            const agent = await this.fallbackChain.findBestAgentWithFallback(inputText, context);
            
            if (agent) {
                this.debug.info('Agent found via fallback chain', {
                    agentName: agent.name,
                    inputPreview: inputText.substring(0, 50)
                });
                return agent;
            }
            
            this.debug.info('No matching enabled agent found via fallback chain', { 
                inputPreview: inputText.substring(0, 50),
                enabledAgents: this.getEnabledAgents().map(a => a.name),
                totalAgents: this.agents.length
            });
            
            return null;
            
        } catch (error) {
            this.debug.error('Fallback chain routing failed', { 
                error: error.message,
                inputPreview: inputText.substring(0, 50)
            });
            return null;
        }
    }

    /**
     * Use AI to determine the best agent based on semantic understanding
     * @param {string} inputText - The user's input text
     * @param {Array<BaseAgent>} enabledAgents - Available agents
     * @param {Object} context - Context object with API client
     * @returns {Promise<BaseAgent|null>} - Best matching agent or null
     */
    async findAgentWithAI(inputText, enabledAgents, context) {
        try {
            // Get conversation context if available
            const conversationContext = this.getConversationContext(context);
            
            // Create agent descriptions for AI analysis
            const agentDescriptions = enabledAgents.map(agent => ({
                name: agent.name,
                description: agent.description,
                capabilities: this.getAgentCapabilities(agent)
            }));

            const systemPrompt = `You are an intelligent agent router for a voice banking system. Your job is to analyze user input and determine which specialized agent should handle the request.

Available Agents:
${agentDescriptions.map(agent => `- ${agent.name}: ${agent.description}\n  Capabilities: ${agent.capabilities.join(', ')}`).join('\n')}

Context Rules:
- PaymentsAgent: Handles money transfers, payments, sending money, payment cancellations
- FraudAgent: Handles card blocking, fraud reports, security issues, suspicious activity, card freezing
- IDVAgent: Handles identity verification, password resets, account security, authentication
- BankingInfoAgent: Handles balance inquiries, transaction history, account information

Conversation Context:
${conversationContext}

User Input: "${inputText}"

IMPORTANT CONTEXTUAL ROUTING RULES:
1. If the user gives a confirmation response (yes, yeah, ok, sure, do it, stop it, block it) and the last agent was FraudAgent, route to FraudAgent
2. If the user gives a denial response (no, nope, don't) and the last agent was FraudAgent, still route to FraudAgent (they're responding about fraud)
3. If the user says "cancel it" or "stop that" and the last agent was PaymentsAgent, route to PaymentsAgent
4. If the user gives a confirmation response and the last agent was IDVAgent, route to IDVAgent
5. Ambiguous responses like "yeah", "stop it", "cancel it" should use the conversation context heavily

Analyze the user input considering:
1. Conversation context is CRITICAL for ambiguous responses
2. Direct intent (what they're explicitly asking for)
3. Semantic meaning (understanding "yeah stop it" in fraud context means block card)
4. Follow-up responses (confirmations, clarifications, denials)

Respond with ONLY the agent name that should handle this request, or "NONE" if no agent is appropriate.

Examples:
- "What's my balance?" → BankingInfoAgent
- "Send money to Alice" → PaymentsAgent
- "Block my card" → FraudAgent
- "Yeah, block it" (after fraud discussion) → FraudAgent
- "Yes, stop it now" (after card security question) → FraudAgent
- "Cancel that" (after payment discussion) → PaymentsAgent
- "Yes, do that" (after IDV discussion) → IDVAgent
- "Nope, don't do it" (after fraud discussion) → FraudAgent
- "Verify my identity" → IDVAgent`;

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: inputText }
            ];

            const response = await context.apiClient.generateChatCompletion(messages, {
                model: 'gpt-3.5-turbo',
                maxTokens: 50,
                temperature: 0.1 // Low temperature for consistent routing decisions
            });

            if (response.success) {
                const agentName = response.text.trim();
                const selectedAgent = enabledAgents.find(agent => agent.name === agentName);
                
                if (selectedAgent) {
                    this.debug.info('AI selected agent', { 
                        agentName,
                        inputText: inputText.substring(0, 50),
                        aiResponse: response.text
                    });
                    return selectedAgent;
                }
            }

            return null;

        } catch (error) {
            this.debug.error('AI agent routing failed', { error: error.message });
            return null;
        }
    }

    /**
     * Get conversation context for AI routing
     * @param {Object} context - Application context
     * @returns {string} - Formatted conversation context
     */
    getConversationContext(context) {
        let contextInfo = [];
        
        // Add last agent used information
        if (context.lastAgentUsed) {
            contextInfo.push(`Last agent used: ${context.lastAgentUsed}`);
        }
        
        // Try to get recent conversation history
        if (context.conversationHistory && context.conversationHistory.length > 0) {
            const recentMessages = context.conversationHistory.slice(-4); // Last 2 exchanges
            contextInfo.push('Recent conversation:');
            recentMessages.forEach(msg => {
                if (msg.agent) {
                    contextInfo.push(`${msg.role} (${msg.agent}): ${msg.content}`);
                } else {
                    contextInfo.push(`${msg.role}: ${msg.content}`);
                }
            });
        }
        
        // Add contextual hints based on last agent
        if (context.lastAgentUsed) {
            switch (context.lastAgentUsed) {
                case 'FraudAgent':
                    contextInfo.push('Context: User was discussing card security/fraud issues');
                    break;
                case 'PaymentsAgent':
                    contextInfo.push('Context: User was discussing payments/transfers');
                    break;
                case 'IDVAgent':
                    contextInfo.push('Context: User was discussing identity verification');
                    break;
                case 'BankingInfoAgent':
                    contextInfo.push('Context: User was discussing account information');
                    break;
            }
        }
        
        return contextInfo.length > 0 ? contextInfo.join('\n') : 'No previous conversation context available.';
    }

    /**
     * Find best agent using only keyword matching (synchronous)
     * @param {string} inputText - User input text
     * @returns {BaseAgent|null} - Best matching agent or null if none found
     */
    findBestAgentSync(inputText) {
        if (!inputText || typeof inputText !== 'string') {
            this.debug.warn('Invalid input text for agent selection');
            return null;
        }
        
        // Get only enabled agents, already sorted by priority
        const enabledAgents = this.getEnabledAgents();
        
        // Try keyword matching only
        for (const agent of enabledAgents) {
            try {
                if (agent.canHandle(inputText)) {
                    this.debug.info('Agent match found via keywords (sync)', { 
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
            }
        }
        
        this.debug.info('No agent match found via keywords (sync)', { 
            inputPreview: inputText.substring(0, 50)
        });
        return null;
    }

    /**
     * Get agent capabilities for AI analysis
     * @param {BaseAgent} agent - Agent to analyze
     * @returns {Array<string>} - List of agent capabilities
     */
    getAgentCapabilities(agent) {
        const capabilityMap = {
            'PaymentsAgent': ['money transfers', 'payments', 'sending money', 'payment history'],
            'FraudAgent': ['card blocking', 'fraud reporting', 'security alerts', 'suspicious activity'],
            'IDVAgent': ['identity verification', 'password reset', 'account security', 'authentication'],
            'BankingInfoAgent': ['balance inquiry', 'transaction history', 'account information', 'statements']
        };

        return capabilityMap[agent.name] || ['general banking assistance'];
    }
    
    /**
     * Invalidate routing cache
     * @param {string} reason - Reason for cache invalidation
     */
    invalidateRoutingCache(reason = 'Configuration change') {
        const previousSize = this.routingCache.size();
        this.routingCache.clear();
        this.debug.info('Routing cache invalidated', { reason, previousSize });
    }

    /**
     * Get routing cache statistics
     * @returns {Object} - Cache performance statistics
     */
    getCacheStats() {
        const totalRequests = this.cacheHits + this.cacheMisses;
        const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;
        
        return {
            ...this.routingCache.getStats(),
            hits: this.cacheHits,
            misses: this.cacheMisses,
            totalRequests,
            hitRate: Math.round(hitRate * 100) / 100
        };
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
            securityStats: this.securityManager.getSecurityStats(),
            cacheStats: this.getCacheStats(),
            fallbackChainStats: this.fallbackChain.getStats(),
            contextStats: this.contextManager.getStats(),
            routingMetrics: this.getRoutingMetrics()
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
    
    /**
     * Get conversation context manager instance
     * @returns {ConversationContextManager} - Context manager instance
     */
    getContextManager() {
        return this.contextManager;
    }
    
    /**
     * Clear conversation context
     */
    clearConversationContext() {
        this.contextManager.clearContext();
        this.debug.info('Conversation context cleared');
    }
    
    /**
     * Handle routing errors with graceful degradation
     * @param {Error} error - The error that occurred
     * @param {string} inputText - Original user input
     * @param {Object} context - Request context
     * @param {number} startTime - Request start time
     * @returns {Promise<Object>} - Error response with fallback attempt
     */
    async handleRoutingError(error, inputText, context, startTime) {
        const processingTime = Date.now() - startTime;
        
        this.debug.info('Attempting graceful degradation after routing error', {
            errorType: error.constructor.name,
            errorMessage: error.message
        });
        
        // Try different fallback strategies based on error type
        try {
            // Strategy 1: Try simple keyword matching without AI
            if (error.message.includes('API') || error.message.includes('network')) {
                this.debug.info('Attempting keyword-only fallback due to API/network error');
                const keywordAgent = await this.fallbackChain.findAgentWithKeywords(inputText, context);
                
                if (keywordAgent) {
                    this.debug.info('Keyword fallback successful', { agentName: keywordAgent.name });
                    
                    try {
                        const result = await keywordAgent.handle(inputText, context);
                        result.metadata = {
                            ...result.metadata,
                            fallbackUsed: true,
                            fallbackReason: 'routing_error_recovery',
                            originalError: error.message
                        };
                        return result;
                    } catch (agentError) {
                        this.debug.warn('Keyword fallback agent failed', { 
                            agentName: keywordAgent.name,
                            error: agentError.message 
                        });
                    }
                }
            }
            
            // Strategy 2: Try context-based fallback
            if (context.lastAgentUsed) {
                this.debug.info('Attempting context-based fallback');
                const contextAgent = this.agents.find(a => 
                    a.name === context.lastAgentUsed && a.enabled !== false
                );
                
                if (contextAgent) {
                    try {
                        const result = await contextAgent.handle(inputText, context);
                        result.metadata = {
                            ...result.metadata,
                            fallbackUsed: true,
                            fallbackReason: 'context_based_recovery',
                            originalError: error.message
                        };
                        return result;
                    } catch (agentError) {
                        this.debug.warn('Context fallback agent failed', { 
                            agentName: contextAgent.name,
                            error: agentError.message 
                        });
                    }
                }
            }
            
            // Strategy 3: Use fallback handler as last resort
            this.debug.info('Using fallback handler as last resort');
            const fallbackResult = await this.fallbackHandler.handle(inputText, context);
            fallbackResult.metadata = {
                ...fallbackResult.metadata,
                fallbackUsed: true,
                fallbackReason: 'routing_error_final_fallback',
                originalError: error.message
            };
            return fallbackResult;
            
        } catch (fallbackError) {
            this.debug.error('All fallback strategies failed', { 
                originalError: error.message,
                fallbackError: fallbackError.message 
            });
            
            // Return comprehensive error response
            return {
                success: false,
                response: this.generateUserFriendlyErrorMessage(error, inputText),
                agentName: 'AgentRouter',
                processingTime,
                tokensUsed: 0,
                error: error.message,
                metadata: {
                    timestamp: new Date().toISOString(),
                    routingError: true,
                    fallbackFailed: true,
                    originalError: error.message,
                    fallbackError: fallbackError.message,
                    errorSeverity: this.classifyErrorSeverity(error),
                    recoveryAttempted: true
                }
            };
        }
    }
    
    /**
     * Generate user-friendly error message based on error type
     * @param {Error} error - The error that occurred
     * @param {string} inputText - User input text
     * @returns {string} - User-friendly error message
     */
    generateUserFriendlyErrorMessage(error, inputText) {
        const errorType = error.constructor.name;
        const errorMessage = error.message.toLowerCase();
        
        // Network/API related errors
        if (errorMessage.includes('network') || errorMessage.includes('fetch') || 
            errorMessage.includes('connection') || errorMessage.includes('timeout')) {
            return "I'm having trouble connecting to my services right now. Please check your internet connection and try again in a moment.";
        }
        
        // API key or authentication errors
        if (errorMessage.includes('api key') || errorMessage.includes('unauthorized') || 
            errorMessage.includes('authentication')) {
            return "There seems to be an authentication issue. Please contact support if this problem persists.";
        }
        
        // Rate limiting errors
        if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
            return "I'm receiving too many requests right now. Please wait a moment and try again.";
        }
        
        // Configuration errors
        if (errorMessage.includes('configuration') || errorMessage.includes('config')) {
            return "There's a configuration issue that's preventing me from processing your request. Please contact support.";
        }
        
        // Generic fallback message
        return "I encountered an unexpected error while processing your request. Please try rephrasing your question or contact support if the problem continues.";
    }
    
    /**
     * Classify error severity for monitoring and alerting
     * @param {Error} error - The error to classify
     * @returns {string} - Error severity level
     */
    classifyErrorSeverity(error) {
        const errorMessage = error.message.toLowerCase();
        
        // Critical errors that require immediate attention
        if (errorMessage.includes('authentication') || errorMessage.includes('api key') ||
            errorMessage.includes('security') || errorMessage.includes('unauthorized')) {
            return 'CRITICAL';
        }
        
        // High severity errors that affect functionality
        if (errorMessage.includes('network') || errorMessage.includes('connection') ||
            errorMessage.includes('timeout') || errorMessage.includes('service unavailable')) {
            return 'HIGH';
        }
        
        // Medium severity errors that may affect some users
        if (errorMessage.includes('rate limit') || errorMessage.includes('quota') ||
            errorMessage.includes('configuration')) {
            return 'MEDIUM';
        }
        
        // Low severity errors that are likely temporary
        return 'LOW';
    }
    
    /**
     * Log routing decision with performance monitoring
     * @param {string} inputText - User input
     * @param {BaseAgent|null} selectedAgent - Selected agent
     * @param {number} processingTime - Time taken for routing decision
     * @param {Object} additionalData - Additional logging data
     */
    logRoutingDecision(inputText, selectedAgent, processingTime, additionalData = {}) {
        const logData = {
            inputPreview: inputText.substring(0, 50),
            selectedAgent: selectedAgent?.name || 'none',
            processingTime,
            cacheHit: additionalData.cacheHit || false,
            fallbackUsed: additionalData.fallbackUsed || false,
            timestamp: new Date().toISOString(),
            ...additionalData
        };
        
        // Log performance warning if routing takes too long
        if (processingTime > 2000) { // 2 seconds
            this.debug.warn('Slow routing decision detected', logData);
        } else {
            this.debug.info('Routing decision completed', logData);
        }
        
        // Store routing metrics for analysis
        this.updateRoutingMetrics(logData);
    }
    
    /**
     * Update routing performance metrics
     * @param {Object} routingData - Routing decision data
     */
    updateRoutingMetrics(routingData) {
        // Initialize metrics if not exists
        if (!this.routingMetrics) {
            this.routingMetrics = {
                totalRequests: 0,
                averageProcessingTime: 0,
                slowRequests: 0,
                errorCount: 0,
                cacheHitRate: 0,
                agentUsageCount: new Map(),
                lastUpdated: Date.now()
            };
        }
        
        const metrics = this.routingMetrics;
        metrics.totalRequests++;
        
        // Update average processing time
        metrics.averageProcessingTime = 
            (metrics.averageProcessingTime * (metrics.totalRequests - 1) + routingData.processingTime) / 
            metrics.totalRequests;
        
        // Count slow requests
        if (routingData.processingTime > 2000) {
            metrics.slowRequests++;
        }
        
        // Count errors
        if (routingData.error) {
            metrics.errorCount++;
        }
        
        // Update cache hit rate
        const totalCacheRequests = this.cacheHits + this.cacheMisses;
        metrics.cacheHitRate = totalCacheRequests > 0 ? (this.cacheHits / totalCacheRequests) * 100 : 0;
        
        // Track agent usage
        if (routingData.selectedAgent && routingData.selectedAgent !== 'none') {
            const currentCount = metrics.agentUsageCount.get(routingData.selectedAgent) || 0;
            metrics.agentUsageCount.set(routingData.selectedAgent, currentCount + 1);
        }
        
        metrics.lastUpdated = Date.now();
    }
    
    /**
     * Get routing performance metrics
     * @returns {Object} - Routing performance metrics
     */
    getRoutingMetrics() {
        return {
            ...this.routingMetrics,
            agentUsageCount: Object.fromEntries(this.routingMetrics?.agentUsageCount || new Map()),
            errorRate: this.routingMetrics ? 
                (this.routingMetrics.errorCount / this.routingMetrics.totalRequests) * 100 : 0,
            slowRequestRate: this.routingMetrics ? 
                (this.routingMetrics.slowRequests / this.routingMetrics.totalRequests) * 100 : 0
        };
    }
}

/**
 * FallbackHandler - Handles requests when no specific agent can process them
 * Provides default behavior similar to the original system
 */
class FallbackHandler {
    constructor(apiClient) {
      this.apiClient = apiClient;
      this.debug = window.debugManager?.createModuleLogger('FallbackHandler') || console;
    }
  
    async handle(inputText, context = {}) {
      const startTime = Date.now();
      this.debug.info("Fallback handler processing request");
  
      try {
        const messages = [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: inputText }
        ];
  
        const result = await this.apiClient.generateChatCompletion(messages);
  
        if (!result || !result.choices || !result.choices.length) {
          throw new Error("No valid choices returned by OpenAI");
        }
  
        const content = result.choices[0].message.content;
        const processingTime = Date.now() - startTime;
  
        return {
          success: true,
          response: content,
          agentName: "Default Agent",
          processingTime,
          tokensUsed: result.usage?.total_tokens || 0,
          error: null,
          metadata: {
            timestamp: new Date().toISOString(),
            fallbackUsed: true
          }
        };
  
      } catch (error) {
        const processingTime = Date.now() - startTime;
        this.debug.error("Fallback handler failed", {
          error: error?.message || String(error) || "Unknown error"
        });
  
        return {
          success: false,
          response: "I apologize, but I'm having trouble processing your request right now. Please try again later.",
          agentName: "Default Agent",
          processingTime,
          tokensUsed: 0,
          error: error?.message || "Unknown error",
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
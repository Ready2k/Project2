/**
 * RoutingFallbackChain - Implements multiple routing strategies with fallback
 * Provides a chain of routing methods that are tried in order until one succeeds
 */
class RoutingFallbackChain {
    constructor(router) {
        this.router = router;
        this.debug = window.debugManager?.createModuleLogger('RoutingFallbackChain') || console;
        
        // Define routing strategies in order of preference
        // Context and AI routing should come first to handle follow-up responses
        this.strategies = [
            {
                name: 'context',
                method: this.findAgentWithContext.bind(this),
                description: 'Context-based routing using conversation history'
            },
            {
                name: 'ai',
                method: this.findAgentWithAI.bind(this),
                description: 'AI-powered semantic routing with conversation context'
            },
            {
                name: 'keyword',
                method: this.findAgentWithKeywords.bind(this),
                description: 'Keyword-based routing using agent canHandle() methods'
            },
            {
                name: 'default',
                method: this.getDefaultAgent.bind(this),
                description: 'Default agent fallback'
            }
        ];
    }

    /**
     * Find best agent using fallback chain
     * @param {string} inputText - User input text
     * @param {Object} context - Context object
     * @returns {Promise<BaseAgent|null>} - Best matching agent or null
     */
    async findBestAgentWithFallback(inputText, context = {}) {
        const startTime = Date.now();
        let lastError = null;
        
        this.debug.info('Starting fallback chain routing', { 
            inputText: inputText.substring(0, 50),
            strategiesCount: this.strategies.length
        });

        for (const strategy of this.strategies) {
            try {
                this.debug.debug(`Trying routing strategy: ${strategy.name}`, {
                    description: strategy.description
                });
                
                console.log(`DEBUG: Trying routing strategy: ${strategy.name}`, {
                    inputText: inputText.substring(0, 50)
                });

                const agent = await strategy.method(inputText, context);
                
                if (agent) {
                    const processingTime = Date.now() - startTime;
                    this.debug.info('Routing strategy succeeded', {
                        strategy: strategy.name,
                        agentName: agent.name,
                        processingTime
                    });
                    return agent;
                }
                
                this.debug.debug(`Strategy ${strategy.name} returned no agent`);
                
            } catch (error) {
                lastError = error;
                this.debug.warn(`Routing strategy ${strategy.name} failed`, {
                    error: error.message,
                    strategy: strategy.name,
                    errorType: error.constructor.name,
                    inputPreview: inputText.substring(0, 50)
                });
                
                // Log strategy failure for monitoring
                this.logStrategyFailure(strategy.name, error, inputText);
                
                // Continue to next strategy instead of failing completely
                continue;
            }
        }

        const processingTime = Date.now() - startTime;
        this.debug.error('All routing strategies failed', {
            processingTime,
            lastError: lastError?.message,
            strategiesAttempted: this.strategies.length
        });

        return null;
    }

    /**
     * Find agent using keyword matching
     * @param {string} inputText - User input text
     * @param {Object} context - Context object
     * @returns {Promise<BaseAgent|null>} - Matching agent or null
     */
    async findAgentWithKeywords(inputText, context = {}) {
        if (!inputText || typeof inputText !== 'string') {
            throw new Error('Invalid input text for keyword routing');
        }

        const enabledAgents = this.router.getEnabledAgents();
        
        for (const agent of enabledAgents) {
            try {
                if (agent.canHandle && agent.canHandle(inputText)) {
                    this.debug.info('Keyword match found', {
                        agentName: agent.name,
                        inputPreview: inputText.substring(0, 50)
                    });
                    return agent;
                }
            } catch (error) {
                this.debug.warn('Error in agent canHandle() method', {
                    agentName: agent.name,
                    error: error.message
                });
                // Continue checking other agents
            }
        }

        return null;
    }

    /**
     * Find agent using AI-powered routing
     * @param {string} inputText - User input text
     * @param {Object} context - Context object
     * @returns {Promise<BaseAgent|null>} - Matching agent or null
     */
    async findAgentWithAI(inputText, context = {}) {
        if (!context.apiClient) {
            throw new Error('API client required for AI routing');
        }

        // Use the router's existing AI routing method
        const enabledAgents = this.router.getEnabledAgents();
        return await this.router.findAgentWithAI(inputText, enabledAgents, context);
    }

    /**
     * Find agent using conversation context
     * @param {string} inputText - User input text
     * @param {Object} context - Context object
     * @returns {Promise<BaseAgent|null>} - Matching agent or null
     */
    async findAgentWithContext(inputText, context = {}) {
        const enabledAgents = this.router.getEnabledAgents();
        
        // Use context manager to get suggested agent
        if (this.router.contextManager) {
            const suggestedAgent = this.router.contextManager.getSuggestedAgent(inputText, enabledAgents);
            if (suggestedAgent) {
                this.debug.info('Context manager suggested agent', {
                    agentName: suggestedAgent.name,
                    inputText: inputText.substring(0, 50)
                });
                return suggestedAgent;
            }
        }
        
        // Fallback to original context-based logic
        // If we have a last agent used and the input is ambiguous, prefer that agent
        if (context.lastAgentUsed && this.isAmbiguousInput(inputText)) {
            const lastAgent = this.router.agents.find(a => 
                a.name === context.lastAgentUsed && a.enabled !== false
            );
            
            if (lastAgent) {
                this.debug.info('Context-based routing selected last agent', {
                    agentName: lastAgent.name,
                    inputText: inputText.substring(0, 50),
                    reason: 'ambiguous input with conversation context'
                });
                return lastAgent;
            }
        }

        // Try to infer from conversation history
        if (context.conversationHistory && context.conversationHistory.length > 0) {
            const recentAgent = this.inferAgentFromHistory(context.conversationHistory, inputText);
            if (recentAgent) {
                this.debug.info('Context-based routing from conversation history', {
                    agentName: recentAgent.name,
                    inputText: inputText.substring(0, 50)
                });
                return recentAgent;
            }
        }

        return null;
    }

    /**
     * Get default agent as last resort
     * @param {string} inputText - User input text
     * @param {Object} context - Context object
     * @returns {Promise<BaseAgent|null>} - Default agent or null
     */
    async getDefaultAgent(inputText, context = {}) {
        const enabledAgents = this.router.getEnabledAgents();
        
        // Return the first enabled agent as default, or null if none available
        if (enabledAgents.length > 0) {
            const defaultAgent = enabledAgents[0];
            this.debug.info('Using default agent fallback', {
                agentName: defaultAgent.name,
                inputText: inputText.substring(0, 50)
            });
            return defaultAgent;
        }

        this.debug.warn('No default agent available', {
            totalAgents: this.router.agents.length,
            enabledAgents: enabledAgents.length
        });
        return null;
    }

    /**
     * Check if input is ambiguous (short responses, confirmations, etc.)
     * @param {string} inputText - User input text
     * @returns {boolean} - True if input is ambiguous
     */
    isAmbiguousInput(inputText) {
        const normalizedInput = inputText.toLowerCase().trim();
        
        // Common ambiguous responses
        const ambiguousPatterns = [
            /^(yes|yeah|yep|ok|okay|sure|do it|go ahead)$/,
            /^(no|nope|don't|stop|cancel)$/,
            /^(maybe|perhaps|i think so|not sure)$/,
            /^(what|huh|sorry|pardon)$/
        ];

        // Very short inputs are often ambiguous
        if (normalizedInput.length <= 3) {
            return true;
        }

        // Check against ambiguous patterns
        return ambiguousPatterns.some(pattern => pattern.test(normalizedInput));
    }

    /**
     * Infer agent from conversation history
     * @param {Array} conversationHistory - Recent conversation messages
     * @param {string} currentInput - Current user input
     * @returns {BaseAgent|null} - Inferred agent or null
     */
    inferAgentFromHistory(conversationHistory, currentInput) {
        if (!conversationHistory || conversationHistory.length === 0) {
            return null;
        }

        // Look at the most recent assistant message to see which agent was used
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const message = conversationHistory[i];
            if (message.role === 'assistant' && message.agent) {
                const agent = this.router.agents.find(a => 
                    a.name === message.agent && a.enabled !== false
                );
                
                if (agent) {
                    return agent;
                }
            }
        }

        return null;
    }

    /**
     * Get fallback chain statistics
     * @returns {Object} - Statistics about fallback chain usage
     */
    getStats() {
        return {
            strategiesCount: this.strategies.length,
            strategies: this.strategies.map(s => ({
                name: s.name,
                description: s.description
            })),
            failureStats: this.getFailureStats()
        };
    }

    /**
     * Add custom routing strategy
     * @param {string} name - Strategy name
     * @param {Function} method - Strategy method
     * @param {string} description - Strategy description
     * @param {number} position - Position in chain (optional, defaults to before default)
     */
    addStrategy(name, method, description, position = null) {
        const strategy = { name, method, description };
        
        if (position === null) {
            // Insert before the default strategy
            this.strategies.splice(-1, 0, strategy);
        } else {
            this.strategies.splice(position, 0, strategy);
        }
        
        this.debug.info('Custom routing strategy added', {
            name,
            description,
            position: position || this.strategies.length - 2,
            totalStrategies: this.strategies.length
        });
    }

    /**
     * Remove routing strategy
     * @param {string} name - Strategy name to remove
     * @returns {boolean} - True if strategy was removed
     */
    removeStrategy(name) {
        const initialLength = this.strategies.length;
        this.strategies = this.strategies.filter(s => s.name !== name);
        const removed = this.strategies.length < initialLength;
        
        if (removed) {
            this.debug.info('Routing strategy removed', { name });
        } else {
            this.debug.warn('Routing strategy not found for removal', { name });
        }
        
        return removed;
    }
    
    /**
     * Log strategy failure for monitoring
     * @param {string} strategyName - Name of failed strategy
     * @param {Error} error - Error that occurred
     * @param {string} inputText - User input text
     */
    logStrategyFailure(strategyName, error, inputText) {
        // Initialize failure tracking if not exists
        if (!this.strategyFailures) {
            this.strategyFailures = new Map();
        }
        
        const failureKey = `${strategyName}:${error.constructor.name}`;
        const currentCount = this.strategyFailures.get(failureKey) || 0;
        this.strategyFailures.set(failureKey, currentCount + 1);
        
        // Log warning if strategy is failing frequently
        if (currentCount > 5) {
            this.debug.error('Routing strategy failing frequently', {
                strategy: strategyName,
                errorType: error.constructor.name,
                failureCount: currentCount + 1,
                inputPreview: inputText.substring(0, 50)
            });
        }
    }
    
    /**
     * Get strategy failure statistics
     * @returns {Object} - Strategy failure statistics
     */
    getFailureStats() {
        if (!this.strategyFailures) {
            return { totalFailures: 0, failuresByStrategy: {} };
        }
        
        const failuresByStrategy = {};
        let totalFailures = 0;
        
        for (const [key, count] of this.strategyFailures) {
            const [strategy, errorType] = key.split(':');
            if (!failuresByStrategy[strategy]) {
                failuresByStrategy[strategy] = {};
            }
            failuresByStrategy[strategy][errorType] = count;
            totalFailures += count;
        }
        
        return {
            totalFailures,
            failuresByStrategy,
            lastUpdated: Date.now()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutingFallbackChain;
} else {
    window.RoutingFallbackChain = RoutingFallbackChain;
}
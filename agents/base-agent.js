/**
 * BaseAgent - Abstract base class for all domain-specific agents
 * Provides core interface methods and debug logging integration
 */
class BaseAgent {
    constructor(name, description) {
        if (this.constructor === BaseAgent) {
            throw new Error('BaseAgent is abstract and cannot be instantiated directly');
        }
        
        this.name = name;
        this.description = description;
        this.debug = window.debugManager.createModuleLogger(`Agent:${name}`);
        
        // Initialize security manager reference (will be set by AgentRouter)
        this.securityManager = null;
        this.sandboxedApiClient = null;
        
        this.debug.info('Agent initialized', { name, description });
    }
    
    /**
     * Abstract method to determine if this agent can handle the given input
     * @param {string} inputText - The user's input text
     * @returns {boolean} - True if this agent can handle the input
     */
    canHandle(inputText) {
        throw new Error(`Agent ${this.name} must implement canHandle() method`);
    }
    
    /**
     * Abstract method to handle the user's input and generate a response
     * @param {string} inputText - The user's input text
     * @param {Object} context - Context object containing app state and dependencies
     * @returns {Promise<Object>} - Agent response object
     */
    async handle(inputText, context) {
        throw new Error(`Agent ${this.name} must implement handle() method`);
    }
    
    /**
     * Optional telemetry hook called when agent is activated
     * Override in subclasses if telemetry is needed
     * @param {string} inputText - The user's input text that triggered activation
     * @param {Object} context - Context object containing app state
     */
    onActivate(inputText, context) {
        const activationData = {
            agentName: this.name,
            inputPreview: inputText ? inputText.substring(0, 100) : 'N/A',
            timestamp: new Date().toISOString(),
            contextAvailable: !!context
        };
        
        this.debug.info('Agent activated', activationData);
        
        // Track activation metrics
        this._trackActivation(activationData);
        
        // Allow subclasses to add custom telemetry
        this._onActivateCustom(inputText, context);
    }
    
    /**
     * Optional telemetry hook called when agent completes processing
     * Override in subclasses if telemetry is needed
     * @param {Object} result - The result returned by handle()
     * @param {string} inputText - The original input text
     * @param {number} startTime - Processing start time for metrics
     */
    onComplete(result, inputText, startTime) {
        const completionData = {
            agentName: this.name,
            success: result.success,
            processingTime: result.processingTime || (startTime ? Date.now() - startTime : 0),
            tokensUsed: result.tokensUsed || 0,
            timestamp: new Date().toISOString(),
            hasError: !!result.error,
            inputLength: inputText ? inputText.length : 0,
            responseLength: result.response ? result.response.length : 0
        };
        
        this.debug.info('Agent completed processing', completionData);
        
        // Track completion metrics
        this._trackCompletion(completionData);
        
        // Allow subclasses to add custom telemetry
        this._onCompleteCustom(result, inputText, completionData);
    }
    
    /**
     * Track agent activation metrics
     * @private
     * @param {Object} activationData - Activation telemetry data
     */
    _trackActivation(activationData) {
        // Initialize metrics if not exists
        if (!this._metrics) {
            this._metrics = {
                activations: 0,
                completions: 0,
                totalProcessingTime: 0,
                totalTokensUsed: 0,
                successCount: 0,
                errorCount: 0,
                averageProcessingTime: 0,
                averageTokensUsed: 0,
                lastActivated: null,
                activationHistory: []
            };
        }
        
        this._metrics.activations++;
        this._metrics.lastActivated = activationData.timestamp;
        
        // Keep last 10 activations for debugging
        this._metrics.activationHistory.unshift({
            timestamp: activationData.timestamp,
            inputPreview: activationData.inputPreview
        });
        
        if (this._metrics.activationHistory.length > 10) {
            this._metrics.activationHistory.pop();
        }
        
        // Store in global telemetry if available
        if (window.agentTelemetry) {
            window.agentTelemetry.recordActivation(this.name, activationData);
        }
    }
    
    /**
     * Track agent completion metrics
     * @private
     * @param {Object} completionData - Completion telemetry data
     */
    _trackCompletion(completionData) {
        if (!this._metrics) return;
        
        this._metrics.completions++;
        this._metrics.totalProcessingTime += completionData.processingTime;
        this._metrics.totalTokensUsed += completionData.tokensUsed;
        
        if (completionData.success) {
            this._metrics.successCount++;
        } else {
            this._metrics.errorCount++;
        }
        
        // Calculate averages
        this._metrics.averageProcessingTime = this._metrics.totalProcessingTime / this._metrics.completions;
        this._metrics.averageTokensUsed = this._metrics.totalTokensUsed / this._metrics.completions;
        
        // Store in global telemetry if available
        if (window.agentTelemetry) {
            window.agentTelemetry.recordCompletion(this.name, completionData);
        }
    }
    
    /**
     * Get agent performance metrics
     * @returns {Object} - Performance metrics for this agent
     */
    getMetrics() {
        return this._metrics ? { ...this._metrics } : null;
    }
    
    /**
     * Reset agent metrics
     */
    resetMetrics() {
        this._metrics = null;
        this.debug.info('Agent metrics reset');
    }
    
    /**
     * Custom activation telemetry hook for subclasses
     * @protected
     * @param {string} inputText - The user's input text
     * @param {Object} context - Context object
     */
    _onActivateCustom(inputText, context) {
        // Override in subclasses for custom telemetry
    }
    
    /**
     * Custom completion telemetry hook for subclasses
     * @protected
     * @param {Object} result - The result returned by handle()
     * @param {string} inputText - The original input text
     * @param {Object} completionData - Completion telemetry data
     */
    _onCompleteCustom(result, inputText, completionData) {
        // Override in subclasses for custom telemetry
    }
    
    /**
     * Helper method to get current persona data from context
     * @param {Object} context - Context object containing PersonaManager
     * @returns {Object} - Current persona data
     */
    getPersonaData(context) {
        if (!context.personaManager) {
            this.debug.warn('PersonaManager not available in context');
            return null;
        }
        return context.personaManager.getCurrentPersonaData();
    }
    
    /**
     * Helper method to generate system prompt for this agent
     * Can be overridden by subclasses for domain-specific prompts
     * @param {Object} context - Context object containing SystemPromptsManager
     * @param {string} userInput - The user's input text
     * @returns {string} - Generated system prompt
     */
    generateSystemPrompt(context, userInput) {
        if (!context.systemPromptsManager) {
            this.debug.warn('SystemPromptsManager not available in context');
            return '';
        }
        
        // Get current persona data for context
        const personaData = this.getPersonaData(context);
        
        // Check if agent wants to override any system prompt components
        const overrides = this.getSystemPromptOverrides(context, personaData);
        
        // Generate base system prompt with persona integration and any overrides
        let basePrompt;
        if (overrides.basePersonality || overrides.financialContext || overrides.responseInstructions) {
            // Agent wants to override specific components
            basePrompt = this.buildCustomSystemPrompt(context, personaData, userInput, overrides);
        } else {
            // Use standard system prompt generation
            basePrompt = context.systemPromptsManager.generateSystemPrompt(personaData, userInput);
        }
        
        // Allow agent to supplement the base prompt
        basePrompt = this.supplementSystemPrompt(context, basePrompt, personaData);
        
        // Add agent-specific context
        const agentContext = `\n\nYou are currently operating as ${this.name}: ${this.description}`;
        
        // Add persona-specific behavior modifications for this agent
        const personaBehavior = this.generatePersonaBehaviorModifications(personaData);
        
        // Add any additional instructions from overrides
        let additionalInstructions = '';
        if (overrides.additionalInstructions && overrides.additionalInstructions.length > 0) {
            additionalInstructions = '\n\nADDITIONAL AGENT INSTRUCTIONS:\n' + 
                overrides.additionalInstructions.map(instruction => `- ${instruction}`).join('\n');
        }
        
        return basePrompt + agentContext + personaBehavior + additionalInstructions;
    }
    
    /**
     * Build custom system prompt with agent-specific overrides
     * @param {Object} context - Context object containing SystemPromptsManager
     * @param {Object} personaData - Current persona data
     * @param {string} userInput - The user's input text
     * @param {Object} overrides - System prompt component overrides
     * @returns {string} - Custom system prompt
     */
    buildCustomSystemPrompt(context, personaData, userInput, overrides) {
        const spm = context.systemPromptsManager;
        
        // Use overrides or fall back to defaults (with defensive checks)
        const basePersonality = overrides.basePersonality || 
            (spm.getBasePersonality ? spm.getBasePersonality() : 'You are a helpful banking assistant.');
        const financialContext = overrides.financialContext || 
            (spm.getFinancialContext ? spm.getFinancialContext() : 'Provide helpful financial information.');
        const responseInstructions = overrides.responseInstructions || 
            (spm.getResponseInstructions ? spm.getResponseInstructions() : 'Keep responses conversational and concise.');
        
        let systemPrompt = basePersonality + '\n\n';
        systemPrompt += financialContext + '\n\n';
        systemPrompt += responseInstructions + '\n\n';

        // Add persona context if provided
        if (personaData) {
            systemPrompt += `Customer Information:
- Name: ${personaData.name}
- Account Type: ${personaData.accountType}
- Current Balance: ${context.personaManager.formatCurrency(personaData.balance)}
- Card Last 4 Digits: ${personaData.cardLast4}`;

            // Add recent transactions if available
            if (personaData.recentTransactions && personaData.recentTransactions.length > 0) {
                systemPrompt += '\n- Recent Transactions:\n';
                personaData.recentTransactions.slice(0, 3).forEach(tx => {
                    const amount = context.personaManager.formatCurrency(tx.amount);
                    systemPrompt += `  ${tx.date}: ${amount} - ${tx.description}\n`;
                });
            }
        } else {
            systemPrompt += 'Customer Information: No customer data available';
        }

        // Add custom prompts if any
        const customPrompts = spm.getCustomPrompts ? spm.getCustomPrompts() : [];
        if (customPrompts && customPrompts.length > 0) {
            systemPrompt += '\n\nAdditional Instructions:\n';
            customPrompts.forEach(customPrompt => {
                systemPrompt += `- ${customPrompt.name}: ${customPrompt.prompt}\n`;
            });
        }

        return systemPrompt;
    }
    
    /**
     * Generate persona-specific behavior modifications for this agent
     * Can be overridden by subclasses for domain-specific persona adaptations
     * @param {Object} personaData - Current persona data
     * @returns {string} - Persona-specific behavior modifications
     */
    generatePersonaBehaviorModifications(personaData) {
        if (!personaData) {
            return '';
        }
        
        let behaviorMods = `\n\nPERSONA-SPECIFIC BEHAVIOR ADAPTATIONS:`;
        
        // Account type specific behavior
        if (personaData.accountType) {
            behaviorMods += `\n- Account Type Context: Tailor responses for ${personaData.accountType} account holder`;
        }
        
        // Balance-based behavior adaptations
        if (typeof personaData.balance === 'number') {
            if (personaData.balance < 100) {
                behaviorMods += `\n- Financial Sensitivity: Be extra considerate about low balance situations`;
            } else if (personaData.balance > 10000) {
                behaviorMods += `\n- Premium Service: Provide enhanced service level for high-value account`;
            }
        }
        
        // Transaction history based adaptations
        if (personaData.recentTransactions && personaData.recentTransactions.length > 0) {
            const hasRecentActivity = personaData.recentTransactions.some(tx => {
                const txDate = new Date(tx.date);
                const daysDiff = (Date.now() - txDate.getTime()) / (1000 * 60 * 60 * 24);
                return daysDiff <= 7;
            });
            
            if (hasRecentActivity) {
                behaviorMods += `\n- Activity Context: Reference recent account activity when relevant`;
            }
        }
        
        // Persona-specific communication style
        if (personaData.name) {
            behaviorMods += `\n- Personal Touch: Address customer as ${personaData.name.split(' ')[0]} when appropriate`;
        }
        
        return behaviorMods;
    }
    
    /**
     * Generate LLM response using the configured provider
     * @param {Array<Object>} messages - Array of message objects
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} - LLM response
     */
    async generateLLMResponse(messages, options = {}) {
        try {
            // Get LLM provider manager from global context
            const llmManager = window.llmProviderManager;
            if (!llmManager) {
                throw new Error('LLM Provider Manager not available');
            }
            
            // Use agent-specific provider or default
            return await llmManager.generateChatCompletion(this.name, messages, options);
        } catch (error) {
            this.debug.error('LLM response generation failed', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Generate streaming LLM response using the configured provider
     * @param {Array<Object>} messages - Array of message objects
     * @param {Object} options - Generation options
     * @param {Function} onChunk - Callback for each chunk
     * @returns {Promise<Object>} - LLM response
     */
    async generateStreamingLLMResponse(messages, options = {}, onChunk = null) {
        try {
            // Get LLM provider manager from global context
            const llmManager = window.llmProviderManager;
            if (!llmManager) {
                throw new Error('LLM Provider Manager not available');
            }
            
            // Use agent-specific provider or default
            return await llmManager.generateStreamingCompletion(this.name, messages, options, onChunk);
        } catch (error) {
            this.debug.error('Streaming LLM response generation failed', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Helper method to create standardized agent response
     * @param {boolean} success - Whether the operation was successful
     * @param {string} response - The response text
     * @param {number} processingTime - Time taken to process in milliseconds
     * @param {number} tokensUsed - Number of tokens used (optional)
     * @param {string} error - Error message if any (optional)
     * @param {Object} metadata - Additional metadata (optional)
     * @returns {Object} - Standardized agent response
     */
    createResponse(success, response, processingTime, tokensUsed = 0, error = null, metadata = {}) {
        return {
            success,
            response,
            agentName: this.name,
            processingTime,
            tokensUsed,
            error,
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString(),
                llmProvider: metadata.provider || 'unknown'
            }
        };
    }
    
    /**
     * Helper method to validate context object has required dependencies
     * @param {Object} context - Context object to validate
     * @param {Array<string>} requiredDependencies - Array of required property names
     * @throws {Error} - If required dependencies are missing
     */
    validateContext(context, requiredDependencies = []) {
        const defaultDependencies = ['personaManager', 'systemPromptsManager', 'apiClient'];
        const allRequired = [...defaultDependencies, ...requiredDependencies];
        
        for (const dependency of allRequired) {
            if (!context[dependency]) {
                const error = `Required dependency '${dependency}' not found in context`;
                this.debug.error(error);
                throw new Error(error);
            }
        }
    }
    
    /**
     * Sets the security manager for this agent (called by AgentRouter)
     * @param {SecurityManager} securityManager - Security manager instance
     */
    setSecurityManager(securityManager) {
        this.securityManager = securityManager;
        this.debug.info('Security manager set for agent');
    }
    
    /**
     * Sets the sandboxed API client for this agent (called by AgentRouter)
     * @param {Object} sandboxedApiClient - Sandboxed API client with access controls
     */
    setSandboxedApiClient(sandboxedApiClient) {
        this.sandboxedApiClient = sandboxedApiClient;
        this.debug.info('Sandboxed API client set for agent');
    }
    
    /**
     * Validates data access permissions before accessing data
     * @param {Array<string>} dataTypes - Data types the agent wants to access
     * @returns {Object} - Validation result
     * @throws {Error} - If security manager is not available or access is denied
     */
    validateDataAccess(dataTypes) {
        if (!this.securityManager) {
            throw new Error('Security manager not available - cannot validate data access');
        }
        
        const validation = this.securityManager.validateDataAccess(this.name, dataTypes);
        
        if (!validation.success) {
            const error = `Data access denied for ${this.name}: ${validation.deniedDataTypes.join(', ')}`;
            this.debug.error(error);
            throw new Error(error);
        }
        
        this.debug.info('Data access validated', {
            allowedDataTypes: validation.allowedDataTypes
        });
        
        return validation;
    }
    
    /**
     * Validates API access permissions before making API calls
     * @param {Array<string>} apiCalls - API calls the agent wants to make
     * @returns {Object} - Validation result
     * @throws {Error} - If security manager is not available or access is denied
     */
    validateApiAccess(apiCalls) {
        if (!this.securityManager) {
            throw new Error('Security manager not available - cannot validate API access');
        }
        
        const validation = this.securityManager.validateApiAccess(this.name, apiCalls);
        
        if (!validation.success) {
            const error = `API access denied for ${this.name}: ${validation.deniedApiCalls.join(', ')}`;
            this.debug.error(error);
            throw new Error(error);
        }
        
        this.debug.info('API access validated', {
            allowedApiCalls: validation.allowedApiCalls
        });
        
        return validation;
    }
    
    /**
     * Securely accesses data through the sandboxed API client
     * @param {Array<string>} dataTypes - Data types to access
     * @returns {Promise<Object>} - Data access result
     */
    async secureDataAccess(dataTypes) {
        if (!this.sandboxedApiClient) {
            throw new Error('Sandboxed API client not available - cannot access data securely');
        }
        
        // Validate access permissions first
        this.validateDataAccess(dataTypes);
        
        // Access data through sandboxed client
        return await this.sandboxedApiClient.accessData(dataTypes);
    }
    
    /**
     * Securely makes API calls through the sandboxed API client
     * @param {string} apiCall - API call to make
     * @param {Object} parameters - Parameters for the API call
     * @returns {Promise<Object>} - API call result
     */
    async secureApiCall(apiCall, parameters = {}) {
        if (!this.sandboxedApiClient) {
            throw new Error('Sandboxed API client not available - cannot make secure API calls');
        }
        
        // Validate access permissions first
        this.validateApiAccess([apiCall]);
        
        // Make API call through sandboxed client
        return await this.sandboxedApiClient.callDomainApi(apiCall, parameters);
    }
    
    /**
     * Allow agents to supplement system prompts with additional instructions
     * This method can be overridden by subclasses to add domain-specific prompt enhancements
     * @param {Object} context - Context object containing SystemPromptsManager
     * @param {string} basePrompt - The base system prompt
     * @param {Object} personaData - Current persona data
     * @returns {string} - Enhanced system prompt
     */
    supplementSystemPrompt(context, basePrompt, personaData) {
        // Default implementation returns the base prompt unchanged
        // Subclasses can override this to add their own enhancements
        return basePrompt;
    }
    
    /**
     * Allow agents to override specific parts of the system prompt
     * This provides more granular control than supplementSystemPrompt
     * @param {Object} context - Context object containing SystemPromptsManager
     * @param {Object} personaData - Current persona data
     * @returns {Object} - Object with prompt overrides
     */
    getSystemPromptOverrides(context, personaData) {
        // Default implementation returns no overrides
        // Subclasses can override this to provide specific prompt modifications
        return {
            basePersonality: null,      // Override base personality if needed
            financialContext: null,     // Override financial context if needed
            responseInstructions: null, // Override response instructions if needed
            additionalInstructions: []  // Add additional custom instructions
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseAgent;
} else {
    window.BaseAgent = BaseAgent;
}
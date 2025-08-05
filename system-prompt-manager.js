/**
 * SystemPromptManager - Manages system prompts with proper fallback hierarchy
 * 
 * Hierarchy:
 * 1. Agent-specific systemPrompts in config (highest priority)
 * 2. system-prompts.json fallback defaults (lowest priority)
 * 
 * This ensures agents can override system prompts when needed while maintaining
 * consistent fallback defaults across the application.
 */
class SystemPromptManager {
    constructor() {
        this.debug = window.debugManager?.createModuleLogger('SystemPromptManager') || console;
        
        // Cache for loaded system prompts
        this.systemPromptsCache = null;
        this.lastLoadTime = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        this.debug.info('SystemPromptManager initialized');
    }
    
    /**
     * Load system prompts from system-prompts.json
     * @returns {Promise<Object>} System prompts configuration
     */
    async loadSystemPrompts() {
        try {
            // Check cache first
            if (this.systemPromptsCache && this.lastLoadTime && 
                (Date.now() - this.lastLoadTime) < this.cacheTimeout) {
                return this.systemPromptsCache;
            }
            
            const response = await fetch('system-prompts.json');
            if (!response.ok) {
                throw new Error(`Failed to load system-prompts.json: ${response.status} ${response.statusText}`);
            }
            
            const systemPrompts = await response.json();
            
            // Validate structure
            if (!this.validateSystemPromptsStructure(systemPrompts)) {
                throw new Error('Invalid system-prompts.json structure');
            }
            
            // Cache the results
            this.systemPromptsCache = systemPrompts;
            this.lastLoadTime = Date.now();
            
            this.debug.info('System prompts loaded successfully', {
                hasBasePersonality: !!systemPrompts.basePersonality,
                hasFinancialContext: !!systemPrompts.financialContext,
                hasResponseInstructions: !!systemPrompts.responseInstructions,
                customPromptsCount: systemPrompts.customPrompts?.length || 0
            });
            
            return systemPrompts;
            
        } catch (error) {
            this.debug.error('Failed to load system prompts', { error: error.message });
            
            // Return minimal fallback to prevent complete failure
            return this.getMinimalFallbackPrompts();
        }
    }
    
    /**
     * Get system prompts for a specific agent with proper fallback hierarchy
     * @param {string} agentName - Name of the agent
     * @param {Object} agentConfig - Agent configuration object
     * @returns {Promise<Object>} Resolved system prompts
     */
    async getSystemPromptsForAgent(agentName, agentConfig) {
        try {
            // Load fallback system prompts
            const fallbackPrompts = await this.loadSystemPrompts();
            
            // If agent has no systemPrompts config, use fallback entirely
            if (!agentConfig.systemPrompts) {
                this.debug.info(`Using fallback system prompts for ${agentName} (no agent overrides)`);
                return fallbackPrompts;
            }
            
            // Merge agent overrides with fallback defaults
            const resolvedPrompts = {
                basePersonality: agentConfig.systemPrompts.basePersonality || fallbackPrompts.basePersonality,
                financialContext: agentConfig.systemPrompts.financialContext || fallbackPrompts.financialContext,
                responseInstructions: agentConfig.systemPrompts.responseInstructions || fallbackPrompts.responseInstructions,
                customPrompts: this.mergeCustomPrompts(
                    fallbackPrompts.customPrompts || [],
                    agentConfig.systemPrompts.customPrompts || []
                )
            };
            
            this.debug.info(`Resolved system prompts for ${agentName}`, {
                basePersonalitySource: agentConfig.systemPrompts.basePersonality ? 'agent' : 'fallback',
                financialContextSource: agentConfig.systemPrompts.financialContext ? 'agent' : 'fallback',
                responseInstructionsSource: agentConfig.systemPrompts.responseInstructions ? 'agent' : 'fallback',
                customPromptsCount: resolvedPrompts.customPrompts.length
            });
            
            return resolvedPrompts;
            
        } catch (error) {
            this.debug.error(`Failed to resolve system prompts for ${agentName}`, { error: error.message });
            
            // Return minimal fallback to prevent complete failure
            return this.getMinimalFallbackPrompts();
        }
    }
    
    /**
     * Generate complete system prompt for an agent
     * @param {string} agentName - Name of the agent
     * @param {Object} agentConfig - Agent configuration object
     * @param {Object} personaData - Current persona data (optional)
     * @param {string} userInput - User input for context (optional)
     * @returns {Promise<string>} Complete system prompt
     */
    async generateSystemPromptForAgent(agentName, agentConfig, personaData = null, userInput = '') {
        try {
            const systemPrompts = await this.getSystemPromptsForAgent(agentName, agentConfig);
            
            let prompt = systemPrompts.basePersonality + '\n\n';
            prompt += systemPrompts.financialContext + '\n\n';
            prompt += systemPrompts.responseInstructions + '\n\n';
            
            // Add persona context if provided
            if (personaData) {
                prompt += this.generatePersonaContext(personaData);
            }
            
            // Add custom prompts
            if (systemPrompts.customPrompts && systemPrompts.customPrompts.length > 0) {
                prompt += '\n\nAdditional Instructions:\n';
                systemPrompts.customPrompts.forEach(customPrompt => {
                    prompt += `- ${customPrompt.name}: ${customPrompt.prompt}\n`;
                });
            }
            
            // Add agent-specific context
            prompt += `\n\nYou are currently operating as ${agentName}: ${agentConfig.description || 'Specialized banking agent'}`;
            
            this.debug.info(`Generated system prompt for ${agentName}`, {
                promptLength: prompt.length,
                hasPersonaData: !!personaData,
                customPromptsCount: systemPrompts.customPrompts?.length || 0
            });
            
            return prompt;
            
        } catch (error) {
            this.debug.error(`Failed to generate system prompt for ${agentName}`, { error: error.message });
            
            // Return minimal fallback prompt
            return this.getMinimalSystemPrompt(agentName, agentConfig);
        }
    }
    
    /**
     * Generate persona context section for system prompt
     * @param {Object} personaData - Persona data object
     * @returns {string} Formatted persona context
     */
    generatePersonaContext(personaData) {
        if (!personaData) return '';
        
        let context = 'Customer Information:\n';
        context += `- Name: ${personaData.name || 'Not provided'}\n`;
        context += `- Account Type: ${personaData.accountType || 'Standard'}\n`;
        
        if (typeof personaData.balance === 'number') {
            context += `- Current Balance: £${personaData.balance.toFixed(2)}\n`;
        }
        
        if (personaData.cardLast4) {
            context += `- Card Last 4 Digits: ${personaData.cardLast4}\n`;
        }
        
        // Add recent transactions if available
        if (personaData.recentTransactions && personaData.recentTransactions.length > 0) {
            context += '- Recent Transactions:\n';
            personaData.recentTransactions.slice(0, 3).forEach(tx => {
                const amount = typeof tx.amount === 'number' ? `£${tx.amount.toFixed(2)}` : tx.amount;
                context += `  ${tx.date}: ${amount} - ${tx.description}\n`;
            });
        }
        
        return context + '\n';
    }
    
    /**
     * Merge custom prompts from fallback and agent configs
     * Agent prompts with same name override fallback prompts
     * @param {Array} fallbackPrompts - Custom prompts from system-prompts.json
     * @param {Array} agentPrompts - Custom prompts from agent config
     * @returns {Array} Merged custom prompts
     */
    mergeCustomPrompts(fallbackPrompts, agentPrompts) {
        const merged = [...fallbackPrompts];
        
        // Add or override with agent prompts
        agentPrompts.forEach(agentPrompt => {
            const existingIndex = merged.findIndex(fp => fp.name === agentPrompt.name);
            if (existingIndex >= 0) {
                // Override existing prompt
                merged[existingIndex] = agentPrompt;
                this.debug.info(`Custom prompt '${agentPrompt.name}' overridden by agent config`);
            } else {
                // Add new prompt
                merged.push(agentPrompt);
                this.debug.info(`Custom prompt '${agentPrompt.name}' added from agent config`);
            }
        });
        
        return merged;
    }
    
    /**
     * Validate system prompts structure
     * @param {Object} systemPrompts - System prompts object to validate
     * @returns {boolean} True if valid
     */
    validateSystemPromptsStructure(systemPrompts) {
        if (!systemPrompts || typeof systemPrompts !== 'object') {
            return false;
        }
        
        // Check required fields
        const requiredFields = ['basePersonality', 'financialContext', 'responseInstructions'];
        for (const field of requiredFields) {
            if (!systemPrompts[field] || typeof systemPrompts[field] !== 'string') {
                this.debug.error(`Invalid or missing system prompt field: ${field}`);
                return false;
            }
        }
        
        // Validate custom prompts if present
        if (systemPrompts.customPrompts) {
            if (!Array.isArray(systemPrompts.customPrompts)) {
                this.debug.error('customPrompts must be an array');
                return false;
            }
            
            for (const prompt of systemPrompts.customPrompts) {
                if (!prompt.name || !prompt.prompt || 
                    typeof prompt.name !== 'string' || typeof prompt.prompt !== 'string') {
                    this.debug.error('Invalid custom prompt structure', prompt);
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Get minimal fallback prompts when system-prompts.json fails to load
     * @returns {Object} Minimal system prompts
     */
    getMinimalFallbackPrompts() {
        return {
            basePersonality: "You are a helpful, professional, and friendly AI voice assistant for a UK financial services company. You should be empathetic, clear in your communication, and engaging in conversation.",
            financialContext: "When handling financial services requests, be conversational and natural in your responses. Provide helpful and accurate information about UK banking. Ask clarifying questions when needed.",
            responseInstructions: "Keep responses conversational and concise (suitable for voice). Use natural speech patterns with contractions. Address users in a friendly manner. Sound human and empathetic, not robotic.",
            customPrompts: []
        };
    }
    
    /**
     * Get minimal system prompt when all else fails
     * @param {string} agentName - Name of the agent
     * @param {Object} agentConfig - Agent configuration
     * @returns {string} Minimal system prompt
     */
    getMinimalSystemPrompt(agentName, agentConfig) {
        const fallback = this.getMinimalFallbackPrompts();
        return `${fallback.basePersonality}\n\n${fallback.financialContext}\n\n${fallback.responseInstructions}\n\nYou are currently operating as ${agentName}: ${agentConfig.description || 'Banking assistant'}`;
    }
    
    /**
     * Clear system prompts cache to force reload
     */
    clearCache() {
        this.systemPromptsCache = null;
        this.lastLoadTime = null;
        this.debug.info('System prompts cache cleared');
    }
    
    /**
     * Get cache status for debugging
     * @returns {Object} Cache status information
     */
    getCacheStatus() {
        return {
            isCached: !!this.systemPromptsCache,
            lastLoadTime: this.lastLoadTime,
            cacheAge: this.lastLoadTime ? Date.now() - this.lastLoadTime : null,
            cacheTimeout: this.cacheTimeout
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemPromptManager;
} else {
    window.SystemPromptManager = SystemPromptManager;
}
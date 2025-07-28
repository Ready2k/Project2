/**
 * ConversationContextManager - Manages conversation context and history
 * Provides context-based agent routing and conversation state persistence
 */
class ConversationContextManager {
    constructor(maxHistorySize = 50, maxContextAge = 30 * 60 * 1000) { // 30 minutes
        this.maxHistorySize = maxHistorySize;
        this.maxContextAge = maxContextAge;
        this.conversationHistory = [];
        this.contextData = new Map();
        this.sessionStartTime = Date.now();
        this.debug = window.debugManager?.createModuleLogger('ConversationContextManager') || console;
        
        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredContext();
        }, 5 * 60 * 1000); // Cleanup every 5 minutes
        
        this.debug.info('ConversationContextManager initialized', {
            maxHistorySize,
            maxContextAge: maxContextAge / 1000 / 60 + ' minutes'
        });
    }

    /**
     * Add message to conversation history
     * @param {string} role - Message role ('user' or 'assistant')
     * @param {string} content - Message content
     * @param {string} agentName - Name of agent that handled the message (for assistant messages)
     * @param {Object} metadata - Additional metadata
     */
    addMessage(role, content, agentName = null, metadata = {}) {
        const message = {
            role,
            content,
            agent: agentName,
            timestamp: Date.now(),
            metadata: {
                ...metadata,
                sessionTime: Date.now() - this.sessionStartTime
            }
        };

        this.conversationHistory.push(message);
        
        // Maintain history size limit
        if (this.conversationHistory.length > this.maxHistorySize) {
            const removed = this.conversationHistory.shift();
            this.debug.debug('Removed old message from history', {
                removedTimestamp: removed.timestamp,
                currentHistorySize: this.conversationHistory.length
            });
        }

        // Update context data
        if (role === 'assistant' && agentName) {
            this.updateContextData('lastAgentUsed', agentName);
            this.updateContextData('lastAgentTimestamp', Date.now());
        }

        this.debug.debug('Message added to conversation history', {
            role,
            agentName,
            contentPreview: content.substring(0, 50),
            historySize: this.conversationHistory.length
        });
    }

    /**
     * Get conversation history
     * @param {number} limit - Maximum number of messages to return (optional)
     * @returns {Array} - Array of conversation messages
     */
    getHistory(limit = null) {
        if (limit && limit > 0) {
            return this.conversationHistory.slice(-limit);
        }
        return [...this.conversationHistory];
    }

    /**
     * Get recent conversation context for agent routing
     * @param {number} messageCount - Number of recent messages to include
     * @returns {Object} - Context object for routing
     */
    getRoutingContext(messageCount = 4) {
        const recentHistory = this.getHistory(messageCount);
        const lastAgentUsed = this.getContextData('lastAgentUsed');
        const lastAgentTimestamp = this.getContextData('lastAgentTimestamp');
        
        // Check if last agent usage is recent (within 5 minutes)
        const isRecentAgent = lastAgentTimestamp && 
            (Date.now() - lastAgentTimestamp) < (5 * 60 * 1000);

        return {
            conversationHistory: recentHistory,
            lastAgentUsed: isRecentAgent ? lastAgentUsed : null,
            lastAgentTimestamp,
            sessionDuration: Date.now() - this.sessionStartTime,
            messageCount: this.conversationHistory.length,
            contextAge: this.getContextAge()
        };
    }

    /**
     * Update context data
     * @param {string} key - Context key
     * @param {*} value - Context value
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    updateContextData(key, value, ttl = null) {
        const contextEntry = {
            value,
            timestamp: Date.now(),
            ttl: ttl ? Date.now() + ttl : null
        };
        
        this.contextData.set(key, contextEntry);
        
        this.debug.debug('Context data updated', {
            key,
            hasValue: value !== null && value !== undefined,
            ttl: ttl ? ttl / 1000 + 's' : 'none'
        });
    }

    /**
     * Get context data
     * @param {string} key - Context key
     * @returns {*} - Context value or null if not found/expired
     */
    getContextData(key) {
        const entry = this.contextData.get(key);
        
        if (!entry) {
            return null;
        }
        
        // Check if entry has expired
        if (entry.ttl && Date.now() > entry.ttl) {
            this.contextData.delete(key);
            this.debug.debug('Context data expired and removed', { key });
            return null;
        }
        
        return entry.value;
    }

    /**
     * Get context age in milliseconds
     * @returns {number} - Age of oldest context entry
     */
    getContextAge() {
        if (this.conversationHistory.length === 0) {
            return 0;
        }
        
        const oldestMessage = this.conversationHistory[0];
        return Date.now() - oldestMessage.timestamp;
    }

    /**
     * Determine if input is a follow-up to previous conversation
     * @param {string} inputText - User input text
     * @returns {boolean} - True if input appears to be a follow-up
     */
    isFollowUpInput(inputText) {
        const normalizedInput = inputText.toLowerCase().trim();
        
        // Check for follow-up patterns
        const followUpPatterns = [
            /^(yes|yeah|yep|ok|okay|sure|do it|go ahead|proceed)$/,
            /^(no|nope|don't|stop|cancel|abort)$/,
            /^(what about|how about|also|and|but|however).*$/,
            /^(that|this|it|they|them).*$/,
            /^(more|another|again|continue|next).*$/
        ];

        // Very short responses are often follow-ups
        if (normalizedInput.length <= 5) {
            return true;
        }

        return followUpPatterns.some(pattern => pattern.test(normalizedInput));
    }

    /**
     * Get suggested agent based on conversation context
     * @param {string} inputText - User input text
     * @param {Array} availableAgents - Available agents to choose from
     * @returns {BaseAgent|null} - Suggested agent or null
     */
    getSuggestedAgent(inputText, availableAgents) {
        const lastAgentUsed = this.getContextData('lastAgentUsed');
        
        // If input is a follow-up and we have a recent agent, suggest that agent
        if (this.isFollowUpInput(inputText) && lastAgentUsed) {
            const lastAgent = availableAgents.find(a => a.name === lastAgentUsed);
            if (lastAgent && lastAgent.enabled !== false) {
                this.debug.info('Suggested agent based on follow-up context', {
                    agentName: lastAgent.name,
                    inputText: inputText.substring(0, 50),
                    reason: 'follow-up to previous conversation'
                });
                return lastAgent;
            }
        }

        // Analyze conversation history for patterns
        if (this.conversationHistory.length >= 2) {
            const recentMessages = this.getHistory(4);
            const agentPattern = this.analyzeAgentPattern(recentMessages);
            
            if (agentPattern) {
                const suggestedAgent = availableAgents.find(a => a.name === agentPattern);
                if (suggestedAgent && suggestedAgent.enabled !== false) {
                    this.debug.info('Suggested agent based on conversation pattern', {
                        agentName: suggestedAgent.name,
                        inputText: inputText.substring(0, 50),
                        reason: 'conversation pattern analysis'
                    });
                    return suggestedAgent;
                }
            }
        }

        return null;
    }

    /**
     * Analyze conversation history for agent patterns
     * @param {Array} messages - Recent conversation messages
     * @returns {string|null} - Suggested agent name or null
     */
    analyzeAgentPattern(messages) {
        const agentCounts = new Map();
        
        // Count agent usage in recent messages
        messages.forEach(message => {
            if (message.role === 'assistant' && message.agent) {
                const count = agentCounts.get(message.agent) || 0;
                agentCounts.set(message.agent, count + 1);
            }
        });

        // Find most frequently used agent
        let mostUsedAgent = null;
        let maxCount = 0;
        
        for (const [agent, count] of agentCounts) {
            if (count > maxCount) {
                maxCount = count;
                mostUsedAgent = agent;
            }
        }

        return mostUsedAgent;
    }

    /**
     * Clean up expired context data
     */
    cleanupExpiredContext() {
        const now = Date.now();
        let cleanedCount = 0;
        
        // Clean up expired context entries
        for (const [key, entry] of this.contextData) {
            if (entry.ttl && now > entry.ttl) {
                this.contextData.delete(key);
                cleanedCount++;
            }
        }
        
        // Clean up old conversation history based on age
        const cutoffTime = now - this.maxContextAge;
        const initialHistorySize = this.conversationHistory.length;
        
        this.conversationHistory = this.conversationHistory.filter(
            message => message.timestamp > cutoffTime
        );
        
        const removedMessages = initialHistorySize - this.conversationHistory.length;
        
        if (cleanedCount > 0 || removedMessages > 0) {
            this.debug.info('Context cleanup completed', {
                expiredContextEntries: cleanedCount,
                removedMessages,
                remainingHistory: this.conversationHistory.length,
                remainingContext: this.contextData.size
            });
        }
    }

    /**
     * Clear all conversation context
     */
    clearContext() {
        const previousHistorySize = this.conversationHistory.length;
        const previousContextSize = this.contextData.size;
        
        this.conversationHistory = [];
        this.contextData.clear();
        this.sessionStartTime = Date.now();
        
        this.debug.info('Conversation context cleared', {
            previousHistorySize,
            previousContextSize
        });
    }

    /**
     * Get context statistics
     * @returns {Object} - Context statistics
     */
    getStats() {
        const now = Date.now();
        const sessionDuration = now - this.sessionStartTime;
        
        return {
            historySize: this.conversationHistory.length,
            maxHistorySize: this.maxHistorySize,
            contextEntries: this.contextData.size,
            sessionDuration: Math.round(sessionDuration / 1000), // in seconds
            oldestMessageAge: this.getContextAge(),
            lastAgentUsed: this.getContextData('lastAgentUsed'),
            averageMessageLength: this.getAverageMessageLength(),
            userMessages: this.conversationHistory.filter(m => m.role === 'user').length,
            assistantMessages: this.conversationHistory.filter(m => m.role === 'assistant').length
        };
    }

    /**
     * Get average message length
     * @returns {number} - Average message length in characters
     */
    getAverageMessageLength() {
        if (this.conversationHistory.length === 0) {
            return 0;
        }
        
        const totalLength = this.conversationHistory.reduce(
            (sum, message) => sum + message.content.length, 0
        );
        
        return Math.round(totalLength / this.conversationHistory.length);
    }

    /**
     * Export conversation history for analysis or backup
     * @returns {Object} - Exportable conversation data
     */
    exportContext() {
        return {
            conversationHistory: this.conversationHistory,
            contextData: Object.fromEntries(this.contextData),
            sessionStartTime: this.sessionStartTime,
            exportTimestamp: Date.now(),
            stats: this.getStats()
        };
    }

    /**
     * Import conversation context from exported data
     * @param {Object} contextData - Previously exported context data
     */
    importContext(contextData) {
        if (contextData.conversationHistory) {
            this.conversationHistory = contextData.conversationHistory;
        }
        
        if (contextData.contextData) {
            this.contextData = new Map(Object.entries(contextData.contextData));
        }
        
        if (contextData.sessionStartTime) {
            this.sessionStartTime = contextData.sessionStartTime;
        }
        
        this.debug.info('Context imported', {
            historySize: this.conversationHistory.length,
            contextEntries: this.contextData.size
        });
    }

    /**
     * Destroy the context manager and clean up resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        this.clearContext();
        this.debug.info('ConversationContextManager destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConversationContextManager;
} else {
    window.ConversationContextManager = ConversationContextManager;
}
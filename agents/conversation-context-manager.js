/**
 * ConversationContextManager - Manages conversation context and history
 * Provides context-based agent routing and conversation state persistence
 * Enhanced with streaming session support for real-time conversations
 */
class ConversationContextManager {
    constructor(maxHistorySize = 50, maxContextAge = 30 * 60 * 1000) { // 30 minutes
        this.maxHistorySize = maxHistorySize;
        this.maxContextAge = maxContextAge;
        this.conversationHistory = [];
        this.contextData = new Map();
        this.sessionStartTime = Date.now();
        this.debug = window.debugManager?.createModuleLogger('ConversationContextManager') || console;

        // Streaming session support
        this.streamingSessions = new Map(); // sessionId -> StreamingSessionContext
        this.streamingMetrics = {
            totalSessions: 0,
            activeSessions: 0,
            agentSwitches: 0,
            reconnections: 0,
            averageSessionDuration: 0
        };

        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredContext();
            this.cleanupExpiredStreamingSessions();
        }, 5 * 60 * 1000); // Cleanup every 5 minutes

        this.debug.info('ConversationContextManager initialized', {
            maxHistorySize,
            maxContextAge: maxContextAge / 1000 / 60 + ' minutes',
            streamingSupport: true
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
     * Check if input contains a new intent that should trigger agent change
     * @param {string} inputText - User input text
     * @returns {boolean} - True if input contains new intent
     */
    containsNewIntent(inputText) {
        const lowerInput = inputText.toLowerCase();

        // Strong intent keywords that indicate a new request
        const newIntentPatterns = [
            // Fraud and security
            /fraud/, /fraudulent/, /unauthorized/, /not.*me/, /didn't.*make/, /suspicious/, /block/, /freeze/, /stolen/, /compromised/,
            // Payments and transfers
            /transfer/, /send.*money/, /payment/, /pay.*bill/, /wire/, /standing.*order/, /direct.*debit/,
            // Account information
            /balance/, /statement/, /transaction.*history/, /account.*details/, /sort.*code/, /account.*number/,
            // Identity verification
            /verify.*identity/, /prove.*who/, /security.*question/, /authentication/, /two.*factor/,
            // New requests
            /i.*want/, /i.*need/, /can.*you/, /help.*me.*with/, /i.*have.*problem/
        ];

        return newIntentPatterns.some(pattern => pattern.test(lowerInput));
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

        // Check if this looks like information being provided in response to a request
        const informationPatterns = [
            /£\d+(\.\d{2})?\s+(at|from|to)\s+/,  // Transaction amounts with locations
            /\d{2}\/\d{2}\/\d{4}/,               // Dates
            /\d{4}\s*\d{4}\s*\d{4}\s*\d{4}/,    // Card numbers
            /^\d{2}[a-z]{2}\s+[a-z]+\s+\d{4}$/i, // Date formats like "15th March 1985"
            /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i // Email addresses
        ];

        // Check if this looks like a fraud-related confirmation/response
        const fraudResponsePatterns = [
            /yes.*block/, /yeah.*block/, /yes.*freeze/, /yeah.*freeze/,
            /yes.*stop/, /yeah.*stop/, /yes.*cancel/, /yeah.*cancel/,
            /block.*card/, /freeze.*card/, /stop.*card/,
            /yes.*that.*card/, /block.*that/, /freeze.*that/
        ];

        // If this looks like a fraud response, it's definitely a follow-up
        if (fraudResponsePatterns.some(pattern => pattern.test(normalizedInput))) {
            this.debug.info('Detected fraud-related follow-up response', {
                inputText: inputText.substring(0, 50)
            });
            return true;
        }

        // If we have recent conversation history, check if this looks like a response to a question
        if (this.conversationHistory.length > 0) {
            const lastMessage = this.conversationHistory[this.conversationHistory.length - 1];

            // If the last message was from an assistant and contained question words
            if (lastMessage.role === 'assistant') {
                const questionWords = ['provide', 'please', 'confirm', 'verify', 'what', 'when', 'where', 'how'];
                const containsQuestion = questionWords.some(word =>
                    lastMessage.content.toLowerCase().includes(word)
                );

                if (containsQuestion) {
                    // Check if current input looks like information being provided
                    const looksLikeInformation = informationPatterns.some(pattern =>
                        pattern.test(normalizedInput)
                    );

                    if (looksLikeInformation) {
                        this.debug.info('Detected information response to question', {
                            inputText: inputText.substring(0, 50),
                            lastMessage: lastMessage.content.substring(0, 50)
                        });
                        return true;
                    }
                }
            }
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
        const lastAgentTimestamp = this.getContextData('lastAgentTimestamp');

        console.log('DEBUG: getSuggestedAgent called', {
            inputText: inputText.substring(0, 50),
            lastAgentUsed,
            lastAgentTimestamp,
            timeSinceLastAgent: lastAgentTimestamp ? Math.round((Date.now() - lastAgentTimestamp) / 1000) : null
        });

        // Check if last agent usage is very recent (within 2 minutes)
        const isVeryRecentAgent = lastAgentTimestamp &&
            (Date.now() - lastAgentTimestamp) < (2 * 60 * 1000);

        const lowerInput = inputText.toLowerCase();

        // CRITICAL: Check for clear intent changes that should bypass context routing
        // These patterns indicate the user wants a different service entirely
        const intentChangePatterns = [
            // Fraud-related intents
            { patterns: [/fraud/, /fraudulent/, /unauthorized/, /not.*me/, /didn't.*make/, /suspicious.*transaction/, /block.*card/, /freeze.*card/, /stolen/, /compromised/], targetAgent: 'FraudAgent' },
            // Payment-related intents  
            { patterns: [/transfer/, /send.*money/, /payment/, /pay.*bill/, /wire/, /standing.*order/, /direct.*debit/], targetAgent: 'PaymentsAgent' },
            // Identity verification intents
            { patterns: [/verify.*identity/, /prove.*who/, /security.*question/, /authentication/, /two.*factor/, /verify.*account/], targetAgent: 'IDVAgent' },
            // Banking info intents (but only if very specific)
            { patterns: [/balance/, /statement/, /transaction.*history/, /account.*details/, /sort.*code/, /account.*number/], targetAgent: 'BankingInfoAgent' }
        ];

        // Check if this is a clear intent change
        for (const intentGroup of intentChangePatterns) {
            const hasIntent = intentGroup.patterns.some(pattern => pattern.test(lowerInput));
            if (hasIntent) {
                // If the intent clearly belongs to a different agent than the last one used, don't suggest context
                if (lastAgentUsed && intentGroup.targetAgent !== lastAgentUsed) {
                    this.debug.info('Intent change detected - bypassing context routing', {
                        inputText: inputText.substring(0, 50),
                        detectedIntent: intentGroup.targetAgent,
                        lastAgent: lastAgentUsed,
                        reason: 'clear intent change detected'
                    });
                    return null; // Let AI routing handle this
                }

                // If it matches the current agent, we can suggest it
                const targetAgent = availableAgents.find(a => a.name === intentGroup.targetAgent);
                if (targetAgent && targetAgent.enabled !== false) {
                    this.debug.info('Intent matches current context', {
                        agentName: targetAgent.name,
                        inputText: inputText.substring(0, 50),
                        reason: 'intent matches context'
                    });
                    return targetAgent;
                }
            }
        }

        // Special handling for fraud-related follow-ups
        const fraudFollowUpPatterns = [
            /yes.*block/, /yeah.*block/, /yes.*freeze/, /yeah.*freeze/,
            /yes.*stop/, /yeah.*stop/, /yes.*cancel/, /yeah.*cancel/,
            /block.*card/, /freeze.*card/, /stop.*card/,
            /yes.*that.*card/, /block.*that/, /freeze.*that/
        ];

        const isFraudFollowUp = fraudFollowUpPatterns.some(pattern => pattern.test(lowerInput));

        if (isFraudFollowUp) {
            // For fraud follow-ups, always prefer FraudAgent regardless of last agent
            const fraudAgent = availableAgents.find(a => a.name === 'FraudAgent');
            if (fraudAgent && fraudAgent.enabled !== false) {
                this.debug.info('Suggested FraudAgent for fraud follow-up', {
                    inputText: inputText.substring(0, 50),
                    reason: 'fraud-related follow-up detected'
                });
                return fraudAgent;
            }
        }

        // If we have a very recent agent and any kind of response, strongly prefer that agent
        // BUT only for genuine follow-ups, not new intents
        if (isVeryRecentAgent && lastAgentUsed) {
            const lastAgent = availableAgents.find(a => a.name === lastAgentUsed);
            if (lastAgent && lastAgent.enabled !== false) {
                // Check if the last message was asking for information
                const lastMessage = this.conversationHistory.length > 0 ?
                    this.conversationHistory[this.conversationHistory.length - 1] : null;

                if (lastMessage && lastMessage.role === 'assistant') {
                    const askingForInfo = ['provide', 'please', 'confirm', 'verify', 'enter', 'give me'].some(word =>
                        lastMessage.content.toLowerCase().includes(word)
                    );

                    if (askingForInfo && this.isFollowUpInput(inputText)) {
                        this.debug.info('Suggested agent based on recent information request', {
                            agentName: lastAgent.name,
                            inputText: inputText.substring(0, 50),
                            reason: 'responding to recent information request',
                            timeSinceLastAgent: Math.round((Date.now() - lastAgentTimestamp) / 1000) + 's'
                        });
                        return lastAgent;
                    }
                }
            }
        }

        // If input is a follow-up and we have a recent agent, suggest that agent
        // BUT only for genuine follow-ups that don't contain new intents
        if (this.isFollowUpInput(inputText) && lastAgentUsed && !this.containsNewIntent(inputText)) {
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

        // Don't use conversation pattern analysis for agent suggestions
        // This was causing the cache hit issue by always returning the most used agent
        // Let AI routing handle intent detection instead

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
     * Get streaming-specific context data for a session
     * @param {string} sessionId - WebSocket session ID
     * @returns {Object} - Streaming context data
     */
    getStreamingContext(sessionId) {
        const session = this.streamingSessions.get(sessionId);
        
        if (!session) {
            this.debug.warn('Streaming session not found', { sessionId });
            return null;
        }

        // Update last accessed time
        session.lastAccessTime = Date.now();

        // Get recent conversation history for context
        const recentHistory = this.getHistory(8); // More history for streaming context

        return {
            sessionId,
            currentAgent: session.currentAgent,
            agentHistory: [...session.agentHistory],
            conversationContext: {
                ...this.getRoutingContext(6),
                streamingMode: true,
                sessionDuration: Date.now() - session.startTime,
                agentSwitchCount: session.agentHistory.length
            },
            voiceConfiguration: {
                currentVoice: session.voiceConfiguration.currentVoice,
                agentVoices: new Map(session.voiceConfiguration.agentVoices)
            },
            routingMetrics: {
                ...session.routingMetrics,
                sessionUptime: Date.now() - session.startTime
            },
            webSocketState: {
                connected: session.webSocketState.connected,
                lastReconnection: session.webSocketState.lastReconnection,
                reconnectionCount: session.webSocketState.reconnectionCount
            }
        };
    }

    /**
     * Update streaming context for agent changes and session events
     * @param {string} sessionId - WebSocket session ID
     * @param {Object} updates - Context updates to apply
     */
    updateStreamingContext(sessionId, updates) {
        let session = this.streamingSessions.get(sessionId);

        // Create new session if it doesn't exist
        if (!session) {
            session = this.createStreamingSession(sessionId);
            this.debug.info('Created new streaming session', { sessionId });
        }

        const previousAgent = session.currentAgent;
        session.lastAccessTime = Date.now();

        // Handle agent changes
        if (updates.currentAgent && updates.currentAgent !== session.currentAgent) {
            // Record agent switch
            if (session.currentAgent) {
                session.agentHistory.push({
                    agentName: session.currentAgent,
                    endTime: Date.now(),
                    duration: Date.now() - session.agentStartTime,
                    switchReason: updates.switchReason || 'context_change'
                });
            }

            session.currentAgent = updates.currentAgent;
            session.agentStartTime = Date.now();
            session.routingMetrics.agentSwitches++;
            this.streamingMetrics.agentSwitches++;

            this.debug.info('Agent switched in streaming session', {
                sessionId,
                previousAgent,
                newAgent: updates.currentAgent,
                switchReason: updates.switchReason
            });
        }

        // Update voice configuration
        if (updates.voiceConfiguration) {
            if (updates.voiceConfiguration.currentVoice) {
                session.voiceConfiguration.currentVoice = updates.voiceConfiguration.currentVoice;
            }
            if (updates.voiceConfiguration.agentVoices) {
                // Merge agent voice mappings
                for (const [agent, voice] of Object.entries(updates.voiceConfiguration.agentVoices)) {
                    session.voiceConfiguration.agentVoices.set(agent, voice);
                }
            }
        }

        // Update routing metrics
        if (updates.routingMetrics) {
            Object.assign(session.routingMetrics, updates.routingMetrics);
        }

        // Update WebSocket state
        if (updates.webSocketState) {
            Object.assign(session.webSocketState, updates.webSocketState);
        }

        // Update conversation context if provided
        if (updates.conversationContext) {
            // Add to regular conversation history if it's a message
            if (updates.conversationContext.role && updates.conversationContext.content) {
                this.addMessage(
                    updates.conversationContext.role,
                    updates.conversationContext.content,
                    updates.conversationContext.agent || session.currentAgent,
                    { 
                        sessionId,
                        streamingMode: true,
                        ...updates.conversationContext.metadata 
                    }
                );
            }
        }

        this.debug.debug('Streaming context updated', {
            sessionId,
            currentAgent: session.currentAgent,
            agentSwitches: session.routingMetrics.agentSwitches,
            sessionDuration: Math.round((Date.now() - session.startTime) / 1000) + 's'
        });
    }

    /**
     * Preserve context across WebSocket reconnection
     * @param {string} sessionId - WebSocket session ID
     * @param {Object} reconnectionInfo - Information about the reconnection
     * @returns {Object} - Preserved context for session restoration
     */
    preserveContextAcrossReconnection(sessionId, reconnectionInfo = {}) {
        const session = this.streamingSessions.get(sessionId);

        if (!session) {
            this.debug.warn('Cannot preserve context - session not found', { sessionId });
            return null;
        }

        // Update reconnection metrics
        session.webSocketState.lastReconnection = Date.now();
        session.webSocketState.reconnectionCount++;
        session.webSocketState.connected = false; // Will be set to true when reconnected
        this.streamingMetrics.reconnections++;

        // Create preservation snapshot
        const preservedContext = {
            sessionId,
            preservationTime: Date.now(),
            currentAgent: session.currentAgent,
            agentStartTime: session.agentStartTime,
            conversationHistory: this.getHistory(10), // More history for reconnection
            contextData: this.exportContextData(),
            voiceConfiguration: {
                currentVoice: session.voiceConfiguration.currentVoice,
                agentVoices: Object.fromEntries(session.voiceConfiguration.agentVoices)
            },
            routingMetrics: { ...session.routingMetrics },
            sessionMetrics: {
                startTime: session.startTime,
                totalDuration: Date.now() - session.startTime,
                reconnectionCount: session.webSocketState.reconnectionCount
            },
            reconnectionInfo: {
                reason: reconnectionInfo.reason || 'unknown',
                lastMessageTime: reconnectionInfo.lastMessageTime,
                connectionLostTime: Date.now()
            }
        };

        this.debug.info('Context preserved for reconnection', {
            sessionId,
            currentAgent: session.currentAgent,
            historySize: preservedContext.conversationHistory.length,
            reconnectionCount: session.webSocketState.reconnectionCount
        });

        return preservedContext;
    }

    /**
     * Restore context after WebSocket reconnection
     * @param {string} sessionId - WebSocket session ID
     * @param {Object} preservedContext - Previously preserved context
     * @returns {boolean} - True if restoration was successful
     */
    restoreContextAfterReconnection(sessionId, preservedContext) {
        if (!preservedContext || preservedContext.sessionId !== sessionId) {
            this.debug.error('Invalid preserved context for restoration', { sessionId });
            return false;
        }

        let session = this.streamingSessions.get(sessionId);
        
        // Recreate session if it was cleaned up
        if (!session) {
            session = this.createStreamingSession(sessionId);
        }

        // Restore session state
        session.currentAgent = preservedContext.currentAgent;
        session.agentStartTime = preservedContext.agentStartTime;
        session.startTime = preservedContext.sessionMetrics.startTime;
        session.webSocketState.connected = true;
        session.webSocketState.reconnectionCount = preservedContext.sessionMetrics.reconnectionCount;
        session.lastAccessTime = Date.now();

        // Restore voice configuration
        session.voiceConfiguration.currentVoice = preservedContext.voiceConfiguration.currentVoice;
        session.voiceConfiguration.agentVoices = new Map(
            Object.entries(preservedContext.voiceConfiguration.agentVoices)
        );

        // Restore routing metrics
        Object.assign(session.routingMetrics, preservedContext.routingMetrics);

        // Import conversation history if needed
        if (preservedContext.conversationHistory.length > this.conversationHistory.length) {
            this.conversationHistory = preservedContext.conversationHistory;
        }

        // Import context data
        if (preservedContext.contextData) {
            this.importContextData(preservedContext.contextData);
        }

        const restorationTime = Date.now() - preservedContext.preservationTime;

        this.debug.info('Context restored after reconnection', {
            sessionId,
            currentAgent: session.currentAgent,
            restorationTime: restorationTime + 'ms',
            reconnectionCount: session.webSocketState.reconnectionCount
        });

        return true;
    }

    /**
     * Create a new streaming session context
     * @param {string} sessionId - WebSocket session ID
     * @returns {Object} - New streaming session context
     */
    createStreamingSession(sessionId) {
        const session = {
            sessionId,
            startTime: Date.now(),
            lastAccessTime: Date.now(),
            currentAgent: null,
            agentStartTime: null,
            agentHistory: [],
            voiceConfiguration: {
                currentVoice: 'alloy', // Default OpenAI voice
                agentVoices: new Map()
            },
            routingMetrics: {
                routingLatency: 0,
                agentSwitches: 0,
                fallbackCount: 0,
                totalRoutingCalls: 0,
                averageRoutingTime: 0
            },
            webSocketState: {
                connected: true,
                lastReconnection: null,
                reconnectionCount: 0
            }
        };

        this.streamingSessions.set(sessionId, session);
        this.streamingMetrics.totalSessions++;
        this.streamingMetrics.activeSessions++;

        this.debug.info('Created streaming session', {
            sessionId,
            totalSessions: this.streamingMetrics.totalSessions,
            activeSessions: this.streamingMetrics.activeSessions
        });

        return session;
    }

    /**
     * End a streaming session and clean up resources
     * @param {string} sessionId - WebSocket session ID
     * @param {string} reason - Reason for ending the session
     */
    endStreamingSession(sessionId, reason = 'session_ended') {
        const session = this.streamingSessions.get(sessionId);

        if (!session) {
            this.debug.warn('Cannot end session - not found', { sessionId });
            return;
        }

        const sessionDuration = Date.now() - session.startTime;

        // Record final agent usage if there was one
        if (session.currentAgent) {
            session.agentHistory.push({
                agentName: session.currentAgent,
                endTime: Date.now(),
                duration: Date.now() - session.agentStartTime,
                switchReason: 'session_ended'
            });
        }

        // Update metrics
        this.streamingMetrics.activeSessions--;
        this.updateAverageSessionDuration(sessionDuration);

        this.debug.info('Streaming session ended', {
            sessionId,
            reason,
            duration: Math.round(sessionDuration / 1000) + 's',
            agentSwitches: session.routingMetrics.agentSwitches,
            reconnections: session.webSocketState.reconnectionCount
        });

        this.streamingSessions.delete(sessionId);
    }

    /**
     * Get streaming session metrics and statistics
     * @returns {Object} - Streaming metrics
     */
    getStreamingMetrics() {
        const activeSessions = Array.from(this.streamingSessions.values());
        const currentTime = Date.now();

        return {
            ...this.streamingMetrics,
            activeSessions: activeSessions.length,
            activeSessionDetails: activeSessions.map(session => ({
                sessionId: session.sessionId,
                currentAgent: session.currentAgent,
                duration: Math.round((currentTime - session.startTime) / 1000),
                agentSwitches: session.routingMetrics.agentSwitches,
                reconnections: session.webSocketState.reconnectionCount,
                connected: session.webSocketState.connected
            })),
            totalActiveTime: activeSessions.reduce((total, session) => 
                total + (currentTime - session.startTime), 0
            )
        };
    }

    /**
     * Clean up expired streaming sessions
     */
    cleanupExpiredStreamingSessions() {
        const now = Date.now();
        const maxSessionAge = 60 * 60 * 1000; // 1 hour
        const maxInactiveTime = 10 * 60 * 1000; // 10 minutes
        let cleanedCount = 0;

        for (const [sessionId, session] of this.streamingSessions) {
            const sessionAge = now - session.startTime;
            const inactiveTime = now - session.lastAccessTime;

            if (sessionAge > maxSessionAge || inactiveTime > maxInactiveTime) {
                this.endStreamingSession(sessionId, 'expired');
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.debug.info('Cleaned up expired streaming sessions', {
                cleanedCount,
                remainingSessions: this.streamingSessions.size
            });
        }
    }

    /**
     * Update average session duration metric
     * @param {number} sessionDuration - Duration of completed session
     */
    updateAverageSessionDuration(sessionDuration) {
        const completedSessions = this.streamingMetrics.totalSessions - this.streamingMetrics.activeSessions;
        
        if (completedSessions === 1) {
            this.streamingMetrics.averageSessionDuration = sessionDuration;
        } else {
            // Calculate running average
            const currentAverage = this.streamingMetrics.averageSessionDuration;
            this.streamingMetrics.averageSessionDuration = 
                ((currentAverage * (completedSessions - 1)) + sessionDuration) / completedSessions;
        }
    }

    /**
     * Export context data for preservation
     * @returns {Object} - Exportable context data
     */
    exportContextData() {
        const contextObj = {};
        for (const [key, entry] of this.contextData) {
            contextObj[key] = entry;
        }
        return contextObj;
    }

    /**
     * Import context data from preservation
     * @param {Object} contextData - Context data to import
     */
    importContextData(contextData) {
        for (const [key, entry] of Object.entries(contextData)) {
            this.contextData.set(key, entry);
        }
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
     * Reset context routing to allow fresh agent selection
     * Useful when context routing is being too aggressive
     */
    resetContextRouting() {
        // Clear last agent data to prevent context bias
        this.contextData.delete('lastAgentUsed');
        this.contextData.delete('lastAgentTimestamp');

        this.debug.info('Context routing reset', {
            reason: 'Allow fresh agent selection'
        });

        // If we have access to the router, invalidate its cache too
        if (window.agentRouter && typeof window.agentRouter.invalidateRoutingCache === 'function') {
            window.agentRouter.invalidateRoutingCache('Context routing reset');
            this.debug.info('Router cache invalidated due to context reset');
        }
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
            assistantMessages: this.conversationHistory.filter(m => m.role === 'assistant').length,
            streaming: this.getStreamingMetrics()
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
            stats: this.getStats(),
            streamingSessions: Array.from(this.streamingSessions.entries()).map(([id, session]) => ({
                sessionId: id,
                ...session,
                voiceConfiguration: {
                    currentVoice: session.voiceConfiguration.currentVoice,
                    agentVoices: Object.fromEntries(session.voiceConfiguration.agentVoices)
                }
            }))
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

        // Import streaming sessions if available
        if (contextData.streamingSessions) {
            this.streamingSessions.clear();
            contextData.streamingSessions.forEach(sessionData => {
                const session = {
                    ...sessionData,
                    voiceConfiguration: {
                        currentVoice: sessionData.voiceConfiguration.currentVoice,
                        agentVoices: new Map(Object.entries(sessionData.voiceConfiguration.agentVoices))
                    }
                };
                this.streamingSessions.set(sessionData.sessionId, session);
            });
        }

        this.debug.info('Context imported', {
            historySize: this.conversationHistory.length,
            contextEntries: this.contextData.size,
            streamingSessions: this.streamingSessions.size
        });
    }

    /**
     * Optimize memory usage for streaming sessions
     * @returns {Object} - Optimization results
     */
    optimizeStreamingMemory() {
        const startTime = Date.now();
        let optimizedSessions = 0;
        let freedMemory = 0;

        try {
            // Compress old conversation history in sessions
            for (const [sessionId, session] of this.streamingSessions.entries()) {
                const sessionAge = Date.now() - session.startTime;
                
                // For sessions older than 30 minutes, compress agent history
                if (sessionAge > 30 * 60 * 1000 && session.agentHistory.length > 10) {
                    const originalSize = JSON.stringify(session.agentHistory).length;
                    
                    // Keep only the last 5 agent switches and summarize the rest
                    const recentHistory = session.agentHistory.slice(-5);
                    const oldHistory = session.agentHistory.slice(0, -5);
                    
                    // Create summary of old history
                    const historySummary = {
                        totalSwitches: oldHistory.length,
                        firstSwitch: oldHistory[0],
                        lastSwitch: oldHistory[oldHistory.length - 1],
                        mostUsedAgent: this.getMostUsedAgent(oldHistory),
                        compressed: true,
                        compressionTime: Date.now()
                    };
                    
                    session.agentHistory = [historySummary, ...recentHistory];
                    
                    const newSize = JSON.stringify(session.agentHistory).length;
                    freedMemory += originalSize - newSize;
                    optimizedSessions++;
                    
                    this.debug.debug('Compressed agent history for session', {
                        sessionId,
                        originalEntries: oldHistory.length + recentHistory.length,
                        compressedEntries: session.agentHistory.length,
                        memorySaved: originalSize - newSize
                    });
                }
            }

            // Clean up expired context data
            const expiredKeys = [];
            for (const [key, entry] of this.contextData.entries()) {
                if (entry.ttl && Date.now() > entry.ttl) {
                    expiredKeys.push(key);
                }
            }

            expiredKeys.forEach(key => {
                const entry = this.contextData.get(key);
                if (entry) {
                    freedMemory += JSON.stringify(entry).length;
                }
                this.contextData.delete(key);
            });

            const optimizationTime = Date.now() - startTime;

            this.debug.info('Streaming memory optimization completed', {
                optimizedSessions,
                expiredContextKeys: expiredKeys.length,
                freedMemoryBytes: freedMemory,
                optimizationTime,
                activeSessions: this.streamingSessions.size,
                contextEntries: this.contextData.size
            });

            return {
                success: true,
                optimizedSessions,
                expiredContextKeys: expiredKeys.length,
                freedMemoryBytes: freedMemory,
                optimizationTime,
                activeSessions: this.streamingSessions.size
            };

        } catch (error) {
            this.debug.error('Streaming memory optimization failed', {
                error: error.message,
                optimizedSessions,
                freedMemory
            });

            return {
                success: false,
                error: error.message,
                optimizedSessions,
                freedMemoryBytes: freedMemory
            };
        }
    }

    /**
     * Get the most used agent from history
     * @param {Array} agentHistory - Agent history array
     * @returns {string} - Most used agent name
     */
    getMostUsedAgent(agentHistory) {
        const agentCounts = {};
        
        agentHistory.forEach(entry => {
            if (entry.agentName && !entry.compressed) {
                agentCounts[entry.agentName] = (agentCounts[entry.agentName] || 0) + 1;
            }
        });

        let mostUsedAgent = null;
        let maxCount = 0;

        for (const [agent, count] of Object.entries(agentCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostUsedAgent = agent;
            }
        }

        return mostUsedAgent;
    }

    /**
     * Get memory usage statistics
     * @returns {Object} - Memory usage statistics
     */
    getMemoryUsageStats() {
        try {
            const conversationHistorySize = JSON.stringify(this.conversationHistory).length;
            const contextDataSize = JSON.stringify(Object.fromEntries(this.contextData)).length;
            
            let streamingSessionsSize = 0;
            let compressedSessions = 0;
            
            for (const [sessionId, session] of this.streamingSessions.entries()) {
                streamingSessionsSize += JSON.stringify(session).length;
                
                // Check if session has compressed history
                if (session.agentHistory.some(entry => entry.compressed)) {
                    compressedSessions++;
                }
            }

            const totalSize = conversationHistorySize + contextDataSize + streamingSessionsSize;

            return {
                totalMemoryBytes: totalSize,
                conversationHistoryBytes: conversationHistorySize,
                contextDataBytes: contextDataSize,
                streamingSessionsBytes: streamingSessionsSize,
                conversationHistoryEntries: this.conversationHistory.length,
                contextDataEntries: this.contextData.size,
                streamingSessions: this.streamingSessions.size,
                compressedSessions,
                averageSessionSize: this.streamingSessions.size > 0 ? 
                    Math.round(streamingSessionsSize / this.streamingSessions.size) : 0
            };

        } catch (error) {
            this.debug.error('Failed to calculate memory usage stats', {
                error: error.message
            });

            return {
                totalMemoryBytes: 0,
                error: error.message
            };
        }
    }

    /**
     * Destroy the context manager and clean up resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Clean up all streaming sessions
        for (const [sessionId] of this.streamingSessions) {
            this.endStreamingSession(sessionId, 'manager_destroyed');
        }

        this.clearContext();
        this.debug.info('ConversationContextManager destroyed', {
            cleanedStreamingSessions: this.streamingSessions.size
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConversationContextManager;
} else {
    window.ConversationContextManager = ConversationContextManager;
}
/**
 * StreamingSessionManager - WebSocket session management for agent routing
 * Handles session state, retry logic, validation, cleanup, and metrics tracking
 */
class StreamingSessionManager {
    constructor(streamingManager, streamingAgentRouter) {
        if (!streamingManager) {
            throw new Error('StreamingManager instance is required');
        }
        if (!streamingAgentRouter) {
            throw new Error('StreamingAgentRouter instance is required');
        }

        this.streamingManager = streamingManager;
        this.streamingAgentRouter = streamingAgentRouter;
        
        // Initialize debug logger
        this.debug = window.debugManager ? 
            window.debugManager.createModuleLogger('StreamingSessionManager') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

        // Session state management
        this.sessions = new Map(); // sessionId -> SessionState
        this.currentSessionId = null;
        this.sessionIdCounter = 0;

        // Session update retry configuration
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 100, // Base delay in ms
            maxDelay: 2000, // Maximum delay in ms
            backoffMultiplier: 2 // Exponential backoff multiplier
        };

        // Session validation configuration
        this.validationConfig = {
            instructionValidationTimeout: 5000, // 5 seconds
            sessionUpdateTimeout: 3000, // 3 seconds
            maxValidationRetries: 2
        };

        // Session cleanup configuration
        this.cleanupConfig = {
            sessionExpiryTime: 30 * 60 * 1000, // 30 minutes
            cleanupInterval: 5 * 60 * 1000, // 5 minutes
            maxInactiveSessions: 10
        };

        // Metrics tracking
        this.metrics = {
            sessionsCreated: 0,
            sessionsDestroyed: 0,
            sessionUpdates: 0,
            sessionUpdateRetries: 0,
            sessionUpdateFailures: 0,
            validationAttempts: 0,
            validationFailures: 0,
            cleanupOperations: 0,
            expiredSessions: 0,
            averageSessionDuration: 0,
            totalSessionTime: 0
        };

        // Cleanup timer
        this.cleanupTimer = null;

        // Initialize cleanup timer
        this.startCleanupTimer();

        this.debug.info('StreamingSessionManager initialized', {
            retryConfig: this.retryConfig,
            validationConfig: this.validationConfig,
            cleanupConfig: this.cleanupConfig
        });
    }

    /**
     * Create a new session for agent context management
     * @param {Object} initialContext - Initial session context
     * @returns {string} - Session ID
     */
    createSession(initialContext = {}) {
        try {
            const sessionId = `session_${++this.sessionIdCounter}_${Date.now()}`;
            const now = Date.now();

            const sessionState = {
                sessionId: sessionId,
                createdAt: now,
                lastUpdatedAt: now,
                lastAccessedAt: now,
                isActive: true,
                
                // Agent context
                currentAgent: null,
                previousAgent: null,
                agentHistory: [],
                agentInstructions: null,
                
                // WebSocket session state
                websocketSessionId: null,
                sessionUpdatePending: false,
                lastSessionUpdate: null,
                sessionValidated: false,
                
                // Context data
                conversationContext: initialContext.conversationContext || {},
                voiceConfiguration: initialContext.voiceConfiguration || {},
                userPreferences: initialContext.userPreferences || {},
                
                // Retry tracking
                retryCount: 0,
                lastRetryAt: null,
                retryHistory: [],
                
                // Validation tracking
                validationAttempts: 0,
                lastValidationAt: null,
                validationErrors: [],
                
                // Metrics
                agentSwitches: 0,
                sessionUpdates: 0,
                totalRetries: 0,
                averageUpdateLatency: 0,
                updateLatencies: []
            };

            this.sessions.set(sessionId, sessionState);
            this.currentSessionId = sessionId;
            this.metrics.sessionsCreated++;

            this.debug.info('Session created', {
                sessionId: sessionId,
                totalSessions: this.sessions.size,
                initialContext: Object.keys(initialContext)
            });

            return sessionId;

        } catch (error) {
            this.debug.error('Failed to create session', {
                error: error.message,
                initialContext: initialContext
            });
            throw error;
        }
    }

    /**
     * Get session state by ID
     * @param {string} sessionId - Session ID
     * @returns {Object|null} - Session state or null if not found
     */
    getSession(sessionId) {
        if (!sessionId) {
            return null;
        }

        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastAccessedAt = Date.now();
            return session;
        }

        return null;
    }

    /**
     * Get current active session
     * @returns {Object|null} - Current session state or null
     */
    getCurrentSession() {
        return this.getSession(this.currentSessionId);
    }

    /**
     * Update session with agent context and instructions
     * @param {string} sessionId - Session ID
     * @param {Object} agentContext - Agent context data
     * @param {string} instructions - Agent-specific instructions
     * @returns {Promise<boolean>} - Success status
     */
    async updateSessionForAgent(sessionId, agentContext, instructions) {
        const startTime = Date.now();
        
        try {
            const session = this.getSession(sessionId);
            if (!session) {
                throw new Error(`Session not found: ${sessionId}`);
            }

            this.debug.info('Updating session for agent', {
                sessionId: sessionId,
                agentName: agentContext.agentName,
                hasInstructions: !!instructions
            });

            // Mark session update as pending
            session.sessionUpdatePending = true;
            session.lastUpdatedAt = Date.now();

            // Update agent context
            const previousAgent = session.currentAgent;
            session.previousAgent = previousAgent;
            session.currentAgent = agentContext;
            session.agentInstructions = instructions;

            // Track agent switch if different
            if (previousAgent && previousAgent.agentName !== agentContext.agentName) {
                session.agentSwitches++;
                session.agentHistory.push({
                    fromAgent: previousAgent.agentName,
                    toAgent: agentContext.agentName,
                    timestamp: Date.now(),
                    reason: agentContext.switchReason || 'context_change'
                });
            }

            // Perform session update with retry logic
            const updateSuccess = await this.performSessionUpdateWithRetry(session, instructions);
            
            if (updateSuccess) {
                // Update metrics
                const latency = Date.now() - startTime;
                session.sessionUpdates++;
                session.updateLatencies.push(latency);
                session.averageUpdateLatency = session.updateLatencies.reduce((a, b) => a + b, 0) / session.updateLatencies.length;
                
                // Keep only last 10 latencies for average calculation
                if (session.updateLatencies.length > 10) {
                    session.updateLatencies = session.updateLatencies.slice(-10);
                }

                this.metrics.sessionUpdates++;
                session.sessionUpdatePending = false;
                session.lastSessionUpdate = Date.now();

                this.debug.info('Session update completed successfully', {
                    sessionId: sessionId,
                    agentName: agentContext.agentName,
                    latency: latency,
                    totalUpdates: session.sessionUpdates
                });

                return true;
            } else {
                session.sessionUpdatePending = false;
                this.metrics.sessionUpdateFailures++;
                
                this.debug.error('Session update failed after retries', {
                    sessionId: sessionId,
                    agentName: agentContext.agentName,
                    retryCount: session.retryCount
                });

                return false;
            }

        } catch (error) {
            this.debug.error('Error updating session for agent', {
                error: error.message,
                sessionId: sessionId,
                agentContext: agentContext
            });

            // Clear pending flag on error
            const session = this.getSession(sessionId);
            if (session) {
                session.sessionUpdatePending = false;
            }

            return false;
        }
    }

    /**
     * Perform session update with exponential backoff retry logic
     * @param {Object} session - Session state
     * @param {string} instructions - Agent instructions
     * @returns {Promise<boolean>} - Success status
     */
    async performSessionUpdateWithRetry(session, instructions) {
        let retryCount = 0;
        let lastError = null;

        while (retryCount <= this.retryConfig.maxRetries) {
            try {
                // Calculate delay for exponential backoff
                const delay = retryCount === 0 ? 0 : Math.min(
                    this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount - 1),
                    this.retryConfig.maxDelay
                );

                if (delay > 0) {
                    this.debug.info('Retrying session update after delay', {
                        sessionId: session.sessionId,
                        retryCount: retryCount,
                        delay: delay
                    });
                    await this.sleep(delay);
                }

                // Attempt session update
                const success = await this.sendSessionUpdate(session, instructions);
                
                if (success) {
                    // Reset retry count on success
                    session.retryCount = 0;
                    return true;
                }

                throw new Error('Session update failed');

            } catch (error) {
                lastError = error;
                retryCount++;
                session.retryCount = retryCount;
                session.lastRetryAt = Date.now();
                session.retryHistory.push({
                    attempt: retryCount,
                    timestamp: Date.now(),
                    error: error.message
                });

                this.metrics.sessionUpdateRetries++;

                this.debug.warn('Session update attempt failed', {
                    sessionId: session.sessionId,
                    attempt: retryCount,
                    maxRetries: this.retryConfig.maxRetries,
                    error: error.message
                });

                if (retryCount > this.retryConfig.maxRetries) {
                    break;
                }
            }
        }

        this.debug.error('Session update failed after all retries', {
            sessionId: session.sessionId,
            totalAttempts: retryCount,
            lastError: lastError?.message
        });

        return false;
    }

    /**
     * Send session update to WebSocket
     * @param {Object} session - Session state
     * @param {string} instructions - Agent instructions
     * @returns {Promise<boolean>} - Success status
     */
    async sendSessionUpdate(session, instructions) {
        try {
            // Get current persona and voice configuration
            const currentPersona = this.streamingManager.getCurrentPersonaInfo();
            const voiceConfig = this.streamingManager.getVoiceConfigForAgent(
                session.currentAgent?.agentName || 'DefaultAgent'
            );

            // Create session update message
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    modalities: ['text', 'audio'],
                    instructions: instructions,
                    voice: voiceConfig.voice,
                    input_audio_format: 'pcm16',
                    output_audio_format: 'pcm16',
                    input_audio_transcription: {
                        model: 'whisper-1'
                    },
                    turn_detection: {
                        type: 'server_vad',
                        threshold: this.streamingManager.getVadThreshold(),
                        prefix_padding_ms: 300,
                        silence_duration_ms: this.streamingManager.settings.responseDelay * 1000
                    },
                    tools: [],
                    tool_choice: 'auto',
                    temperature: voiceConfig.temperature || 0.9,
                    max_response_output_tokens: 500
                }
            };

            // Send the update
            this.streamingManager.sendMessage(sessionUpdate);

            // Wait for validation
            const validated = await this.validateSessionUpdate(session, sessionUpdate);
            
            return validated;

        } catch (error) {
            this.debug.error('Failed to send session update', {
                sessionId: session.sessionId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Validate that session update was properly applied
     * @param {Object} session - Session state
     * @param {Object} sessionUpdate - The update that was sent
     * @returns {Promise<boolean>} - Validation success
     */
    async validateSessionUpdate(session, sessionUpdate) {
        try {
            session.validationAttempts++;
            session.lastValidationAt = Date.now();
            this.metrics.validationAttempts++;

            this.debug.info('Validating session update', {
                sessionId: session.sessionId,
                validationAttempt: session.validationAttempts
            });

            // Create a promise that resolves when we receive session.updated event
            const validationPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Session validation timeout'));
                }, this.validationConfig.sessionUpdateTimeout);

                // Listen for session.updated event (simplified - in production you'd hook into message handler)
                const originalHandleMessage = this.streamingManager.handleMessage.bind(this.streamingManager);
                
                this.streamingManager.handleMessage = async (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        
                        if (message.type === 'session.updated') {
                            clearTimeout(timeout);
                            this.streamingManager.handleMessage = originalHandleMessage;
                            resolve(true);
                            return;
                        }
                        
                        if (message.type === 'error' && message.error) {
                            clearTimeout(timeout);
                            this.streamingManager.handleMessage = originalHandleMessage;
                            reject(new Error(`Session update error: ${message.error.message}`));
                            return;
                        }
                        
                        // Call original handler for other messages
                        await originalHandleMessage(event);
                        
                    } catch (error) {
                        clearTimeout(timeout);
                        this.streamingManager.handleMessage = originalHandleMessage;
                        reject(error);
                    }
                };
            });

            // Wait for validation with timeout
            const validated = await validationPromise;
            
            if (validated) {
                session.sessionValidated = true;
                this.debug.info('Session update validated successfully', {
                    sessionId: session.sessionId
                });
                return true;
            }

        } catch (error) {
            session.validationErrors.push({
                timestamp: Date.now(),
                error: error.message,
                attempt: session.validationAttempts
            });

            this.metrics.validationFailures++;

            this.debug.error('Session validation failed', {
                sessionId: session.sessionId,
                error: error.message,
                attempt: session.validationAttempts
            });

            // Retry validation if under limit
            if (session.validationAttempts < this.validationConfig.maxValidationRetries) {
                this.debug.info('Retrying session validation', {
                    sessionId: session.sessionId,
                    nextAttempt: session.validationAttempts + 1
                });
                
                await this.sleep(500); // Brief delay before retry
                return await this.validateSessionUpdate(session, sessionUpdate);
            }

            return false;
        }
    }

    /**
     * Clean up disconnected or expired sessions
     * @param {boolean} force - Force cleanup of all inactive sessions
     * @returns {number} - Number of sessions cleaned up
     */
    cleanupSessions(force = false) {
        try {
            const now = Date.now();
            let cleanedUp = 0;
            const sessionsToRemove = [];

            this.debug.info('Starting session cleanup', {
                totalSessions: this.sessions.size,
                force: force
            });

            for (const [sessionId, session] of this.sessions) {
                let shouldCleanup = false;

                if (force) {
                    shouldCleanup = !session.isActive;
                } else {
                    // Check if session is expired
                    const sessionAge = now - session.lastAccessedAt;
                    const isExpired = sessionAge > this.cleanupConfig.sessionExpiryTime;
                    
                    // Check if session is inactive
                    const isInactive = !session.isActive || session.sessionUpdatePending;
                    
                    shouldCleanup = isExpired || (isInactive && sessionAge > 60000); // 1 minute for inactive
                }

                if (shouldCleanup) {
                    sessionsToRemove.push(sessionId);
                    
                    // Update metrics
                    if (now - session.lastAccessedAt > this.cleanupConfig.sessionExpiryTime) {
                        this.metrics.expiredSessions++;
                    }
                    
                    // Track session duration
                    const sessionDuration = now - session.createdAt;
                    this.metrics.totalSessionTime += sessionDuration;
                    this.metrics.averageSessionDuration = this.metrics.totalSessionTime / this.metrics.sessionsDestroyed;
                }
            }

            // Remove sessions
            for (const sessionId of sessionsToRemove) {
                this.sessions.delete(sessionId);
                cleanedUp++;
                this.metrics.sessionsDestroyed++;
                
                // Clear current session if it was cleaned up
                if (this.currentSessionId === sessionId) {
                    this.currentSessionId = null;
                }
            }

            this.metrics.cleanupOperations++;

            this.debug.info('Session cleanup completed', {
                cleanedUp: cleanedUp,
                remainingSessions: this.sessions.size,
                expiredSessions: this.metrics.expiredSessions
            });

            return cleanedUp;

        } catch (error) {
            this.debug.error('Error during session cleanup', {
                error: error.message
            });
            return 0;
        }
    }

    /**
     * Start automatic cleanup timer
     */
    startCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanupSessions();
        }, this.cleanupConfig.cleanupInterval);

        this.debug.info('Cleanup timer started', {
            interval: this.cleanupConfig.cleanupInterval
        });
    }

    /**
     * Stop automatic cleanup timer
     */
    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            this.debug.info('Cleanup timer stopped');
        }
    }

    /**
     * Get session metrics for monitoring and debugging
     * @returns {Object} - Session metrics
     */
    getSessionMetrics() {
        const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive).length;
        const pendingUpdates = Array.from(this.sessions.values()).filter(s => s.sessionUpdatePending).length;
        
        return {
            ...this.metrics,
            activeSessions: activeSessions,
            totalSessions: this.sessions.size,
            pendingUpdates: pendingUpdates,
            currentSessionId: this.currentSessionId,
            
            // Performance metrics
            averageRetryCount: this.metrics.sessionUpdateRetries / Math.max(this.metrics.sessionUpdates, 1),
            validationSuccessRate: (this.metrics.validationAttempts - this.metrics.validationFailures) / Math.max(this.metrics.validationAttempts, 1),
            sessionUpdateSuccessRate: (this.metrics.sessionUpdates - this.metrics.sessionUpdateFailures) / Math.max(this.metrics.sessionUpdates, 1)
        };
    }

    /**
     * Get detailed session information for debugging
     * @param {string} sessionId - Session ID (optional, defaults to current)
     * @returns {Object} - Detailed session information
     */
    getSessionDetails(sessionId = null) {
        const targetSessionId = sessionId || this.currentSessionId;
        const session = this.getSession(targetSessionId);
        
        if (!session) {
            return null;
        }

        return {
            sessionId: session.sessionId,
            createdAt: new Date(session.createdAt).toISOString(),
            lastUpdatedAt: new Date(session.lastUpdatedAt).toISOString(),
            lastAccessedAt: new Date(session.lastAccessedAt).toISOString(),
            isActive: session.isActive,
            
            // Agent information
            currentAgent: session.currentAgent,
            previousAgent: session.previousAgent,
            agentSwitches: session.agentSwitches,
            agentHistory: session.agentHistory,
            
            // Session state
            sessionUpdatePending: session.sessionUpdatePending,
            sessionValidated: session.sessionValidated,
            lastSessionUpdate: session.lastSessionUpdate ? new Date(session.lastSessionUpdate).toISOString() : null,
            
            // Performance metrics
            sessionUpdates: session.sessionUpdates,
            totalRetries: session.totalRetries,
            averageUpdateLatency: session.averageUpdateLatency,
            
            // Error tracking
            validationAttempts: session.validationAttempts,
            validationErrors: session.validationErrors,
            retryHistory: session.retryHistory.slice(-5) // Last 5 retries
        };
    }

    /**
     * Destroy a specific session
     * @param {string} sessionId - Session ID to destroy
     * @returns {boolean} - Success status
     */
    destroySession(sessionId) {
        try {
            const session = this.getSession(sessionId);
            if (!session) {
                return false;
            }

            // Mark as inactive
            session.isActive = false;
            
            // Track session duration
            const sessionDuration = Date.now() - session.createdAt;
            this.metrics.totalSessionTime += sessionDuration;
            
            // Remove from sessions map
            this.sessions.delete(sessionId);
            this.metrics.sessionsDestroyed++;
            
            // Clear current session if it was destroyed
            if (this.currentSessionId === sessionId) {
                this.currentSessionId = null;
            }

            this.debug.info('Session destroyed', {
                sessionId: sessionId,
                duration: sessionDuration,
                remainingSessions: this.sessions.size
            });

            return true;

        } catch (error) {
            this.debug.error('Error destroying session', {
                sessionId: sessionId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Cleanup all resources and stop timers
     */
    cleanup() {
        try {
            this.debug.info('Cleaning up StreamingSessionManager');
            
            // Stop cleanup timer
            this.stopCleanupTimer();
            
            // Clean up all sessions
            const cleanedUp = this.cleanupSessions(true);
            
            // Clear current session
            this.currentSessionId = null;
            
            this.debug.info('StreamingSessionManager cleanup completed', {
                sessionsCleanedUp: cleanedUp
            });

        } catch (error) {
            this.debug.error('Error during StreamingSessionManager cleanup', {
                error: error.message
            });
        }
    }

    /**
     * Utility method for sleeping/delays
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} - Promise that resolves after delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.StreamingSessionManager = StreamingSessionManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingSessionManager;
}
/**
 * StreamingErrorHandler - Comprehensive error handling and fallback mechanisms for streaming agent routing
 * Implements circuit breaker patterns, timeout handling, graceful degradation, and recovery mechanisms
 */
class StreamingErrorHandler {
    constructor(streamingManager, streamingAgentRouter) {
        if (!streamingManager) {
            throw new Error('StreamingManager instance is required');
        }

        this.streamingManager = streamingManager;
        this.streamingAgentRouter = streamingAgentRouter;
        
        // Initialize debug logger
        this.debug = window.debugManager ? 
            window.debugManager.createModuleLogger('StreamingErrorHandler') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

        // Circuit breaker configuration
        this.circuitBreaker = {
            isOpen: false,
            failureCount: 0,
            successCount: 0,
            lastFailureTime: null,
            resetTimeout: 30000, // 30 seconds
            failureThreshold: 5, // Open after 5 consecutive failures
            successThreshold: 3, // Close after 3 consecutive successes
            halfOpenMaxAttempts: 1
        };

        // Timeout configuration
        this.timeouts = {
            routingTimeout: 200, // 200ms max additional delay as per requirements
            sessionUpdateTimeout: 5000, // 5 seconds for session updates
            reconnectionTimeout: 10000, // 10 seconds for reconnection
            agentSwitchTimeout: 3000 // 3 seconds for agent switching
        };

        // Retry configuration with exponential backoff
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 100, // Start with 100ms
            maxDelay: 2000, // Cap at 2 seconds
            backoffMultiplier: 2
        };

        // Error tracking and metrics
        this.errorMetrics = {
            totalErrors: 0,
            routingTimeouts: 0,
            agentErrors: 0,
            sessionUpdateFailures: 0,
            websocketErrors: 0,
            circuitBreakerTrips: 0,
            fallbackActivations: 0,
            recoveryAttempts: 0,
            successfulRecoveries: 0
        };

        // Fallback strategies
        this.fallbackStrategies = {
            ROUTING_TIMEOUT: this.handleRoutingTimeout.bind(this),
            AGENT_ERROR: this.handleAgentError.bind(this),
            SESSION_UPDATE_FAILED: this.handleSessionUpdateFailure.bind(this),
            WEBSOCKET_ERROR: this.handleWebSocketError.bind(this),
            CRITICAL_FAILURE: this.handleCriticalFailure.bind(this)
        };

        // WebSocket reconnection state
        this.reconnectionState = {
            isReconnecting: false,
            reconnectionAttempts: 0,
            maxReconnectionAttempts: 5,
            preservedContext: null,
            lastKnownAgent: null,
            sessionBackup: null
        };

        // Active timeouts for cleanup
        this.activeTimeouts = new Map();

        this.debug.info('StreamingErrorHandler initialized', {
            circuitBreakerThreshold: this.circuitBreaker.failureThreshold,
            routingTimeout: this.timeouts.routingTimeout,
            maxRetries: this.retryConfig.maxRetries,
            fallbackStrategies: Object.keys(this.fallbackStrategies)
        });
    }

    /**
     * Handle routing timeout with fallback to standard streaming
     * @param {Error} error - Timeout error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Fallback result
     */
    async handleRoutingTimeout(error, context = {}) {
        this.errorMetrics.routingTimeouts++;
        this.errorMetrics.totalErrors++;

        this.debug.warn('Routing timeout detected, falling back to standard streaming', {
            timeout: this.timeouts.routingTimeout,
            transcript: context.transcript?.substring(0, 50),
            attemptNumber: context.attemptNumber || 1
        });

        try {
            // Record circuit breaker failure
            this.recordCircuitBreakerFailure();

            // Create fallback response for standard streaming
            const fallbackResponse = {
                success: true,
                fallbackReason: 'routing_timeout',
                continueWithStandardStreaming: true,
                preserveTranscript: context.transcript,
                metadata: {
                    originalError: error.message,
                    timeoutDuration: this.timeouts.routingTimeout,
                    fallbackTime: Date.now()
                }
            };

            // Log comprehensive error information
            this.logError('ROUTING_TIMEOUT', error, {
                ...context,
                fallbackResponse,
                circuitBreakerState: this.getCircuitBreakerState()
            });

            // Update fallback metrics
            this.errorMetrics.fallbackActivations++;

            return fallbackResponse;

        } catch (fallbackError) {
            this.debug.error('Fallback handling failed for routing timeout', {
                originalError: error.message,
                fallbackError: fallbackError.message
            });

            return this.createEmergencyFallback(error, 'routing_timeout_fallback_failed');
        }
    }

    /**
     * Handle agent processing errors with graceful degradation
     * @param {Error} error - Agent error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Fallback result
     */
    async handleAgentError(error, context = {}) {
        this.errorMetrics.agentErrors++;
        this.errorMetrics.totalErrors++;

        this.debug.warn('Agent processing error detected', {
            agentName: context.agentName,
            error: error.message,
            transcript: context.transcript?.substring(0, 50)
        });

        try {
            // Record circuit breaker failure
            this.recordCircuitBreakerFailure();

            // Attempt graceful degradation
            const degradationResult = await this.attemptGracefulDegradation(error, context);

            if (degradationResult.success) {
                this.debug.info('Graceful degradation successful', {
                    strategy: degradationResult.strategy,
                    agentName: context.agentName
                });

                return {
                    success: true,
                    fallbackReason: 'agent_error_graceful_degradation',
                    degradationResult,
                    continueWithFallback: true,
                    metadata: {
                        originalError: error.message,
                        degradationStrategy: degradationResult.strategy,
                        fallbackTime: Date.now()
                    }
                };
            }

            // Graceful degradation failed, fall back to standard streaming
            this.debug.warn('Graceful degradation failed, falling back to standard streaming', {
                agentName: context.agentName,
                degradationError: degradationResult.error
            });

            // Log comprehensive error information
            this.logError('AGENT_ERROR', error, {
                ...context,
                degradationResult,
                circuitBreakerState: this.getCircuitBreakerState()
            });

            this.errorMetrics.fallbackActivations++;

            return {
                success: true,
                fallbackReason: 'agent_error_standard_fallback',
                continueWithStandardStreaming: true,
                preserveTranscript: context.transcript,
                metadata: {
                    originalError: error.message,
                    degradationAttempted: true,
                    degradationError: degradationResult.error,
                    fallbackTime: Date.now()
                }
            };

        } catch (fallbackError) {
            this.debug.error('Fallback handling failed for agent error', {
                originalError: error.message,
                fallbackError: fallbackError.message,
                agentName: context.agentName
            });

            return this.createEmergencyFallback(error, 'agent_error_fallback_failed');
        }
    }

    /**
     * Handle session update failures with retry and exponential backoff
     * @param {Error} error - Session update error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Retry result
     */
    async handleSessionUpdateFailure(error, context = {}) {
        this.errorMetrics.sessionUpdateFailures++;
        this.errorMetrics.totalErrors++;

        const attemptNumber = context.attemptNumber || 1;
        const maxRetries = this.retryConfig.maxRetries;

        this.debug.warn('Session update failure detected', {
            attemptNumber,
            maxRetries,
            error: error.message,
            agentName: context.agentName
        });

        try {
            if (attemptNumber <= maxRetries) {
                // Calculate exponential backoff delay
                const delay = Math.min(
                    this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attemptNumber - 1),
                    this.retryConfig.maxDelay
                );

                this.debug.info('Retrying session update with exponential backoff', {
                    attemptNumber,
                    delay,
                    agentName: context.agentName
                });

                // Wait for backoff delay
                await this.delay(delay);

                // Attempt retry
                const retryResult = await this.retrySessionUpdate(context, attemptNumber);

                if (retryResult.success) {
                    this.debug.info('Session update retry successful', {
                        attemptNumber,
                        agentName: context.agentName
                    });

                    // Record circuit breaker success
                    this.recordCircuitBreakerSuccess();

                    return {
                        success: true,
                        retrySuccessful: true,
                        attemptNumber,
                        retryResult,
                        metadata: {
                            originalError: error.message,
                            retryDelay: delay,
                            successTime: Date.now()
                        }
                    };
                } else {
                    // Retry failed, try again if attempts remaining
                    if (attemptNumber < maxRetries) {
                        return await this.handleSessionUpdateFailure(retryResult.error || error, {
                            ...context,
                            attemptNumber: attemptNumber + 1
                        });
                    }
                }
            }

            // All retries exhausted, record failure and continue with current agent
            this.debug.warn('Session update retries exhausted, continuing with current agent', {
                maxRetries,
                agentName: context.agentName,
                finalError: error.message
            });

            this.recordCircuitBreakerFailure();

            // Log comprehensive error information
            this.logError('SESSION_UPDATE_FAILED', error, {
                ...context,
                attemptNumber,
                maxRetries,
                circuitBreakerState: this.getCircuitBreakerState()
            });

            this.errorMetrics.fallbackActivations++;

            return {
                success: true,
                fallbackReason: 'session_update_retries_exhausted',
                continueWithCurrentAgent: true,
                retriesAttempted: attemptNumber,
                metadata: {
                    originalError: error.message,
                    maxRetries,
                    finalAttempt: attemptNumber,
                    fallbackTime: Date.now()
                }
            };

        } catch (fallbackError) {
            this.debug.error('Fallback handling failed for session update failure', {
                originalError: error.message,
                fallbackError: fallbackError.message,
                attemptNumber
            });

            return this.createEmergencyFallback(error, 'session_update_fallback_failed');
        }
    }

    /**
     * Handle WebSocket errors with context preservation and reconnection
     * @param {Error} error - WebSocket error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Recovery result
     */
    async handleWebSocketError(error, context = {}) {
        this.errorMetrics.websocketErrors++;
        this.errorMetrics.totalErrors++;

        this.debug.warn('WebSocket error detected', {
            error: error.message,
            connectionState: this.streamingManager.websocket?.readyState,
            isReconnecting: this.reconnectionState.isReconnecting
        });

        try {
            // Preserve current agent context before attempting recovery
            await this.preserveAgentContextForReconnection(context);

            // Check if already reconnecting
            if (this.reconnectionState.isReconnecting) {
                this.debug.info('Reconnection already in progress, waiting for completion');
                return {
                    success: true,
                    fallbackReason: 'websocket_error_reconnection_in_progress',
                    waitForReconnection: true,
                    metadata: {
                        originalError: error.message,
                        reconnectionAttempt: this.reconnectionState.reconnectionAttempts,
                        preservedContext: !!this.reconnectionState.preservedContext
                    }
                };
            }

            // Attempt WebSocket reconnection with context restoration
            const reconnectionResult = await this.attemptWebSocketReconnection(error, context);

            if (reconnectionResult.success) {
                this.debug.info('WebSocket reconnection successful', {
                    reconnectionAttempts: this.reconnectionState.reconnectionAttempts,
                    contextRestored: reconnectionResult.contextRestored
                });

                // Record successful recovery
                this.errorMetrics.recoveryAttempts++;
                this.errorMetrics.successfulRecoveries++;
                this.recordCircuitBreakerSuccess();

                return {
                    success: true,
                    reconnectionSuccessful: true,
                    contextRestored: reconnectionResult.contextRestored,
                    reconnectionResult,
                    metadata: {
                        originalError: error.message,
                        reconnectionAttempts: this.reconnectionState.reconnectionAttempts,
                        recoveryTime: Date.now()
                    }
                };
            } else {
                // Reconnection failed, fall back to standard streaming
                this.debug.error('WebSocket reconnection failed, falling back to standard streaming', {
                    reconnectionError: reconnectionResult.error,
                    attempts: this.reconnectionState.reconnectionAttempts
                });

                this.recordCircuitBreakerFailure();

                // Log comprehensive error information
                this.logError('WEBSOCKET_ERROR', error, {
                    ...context,
                    reconnectionResult,
                    reconnectionAttempts: this.reconnectionState.reconnectionAttempts,
                    circuitBreakerState: this.getCircuitBreakerState()
                });

                this.errorMetrics.fallbackActivations++;

                return {
                    success: true,
                    fallbackReason: 'websocket_reconnection_failed',
                    continueWithStandardStreaming: true,
                    reconnectionAttempted: true,
                    metadata: {
                        originalError: error.message,
                        reconnectionError: reconnectionResult.error,
                        reconnectionAttempts: this.reconnectionState.reconnectionAttempts,
                        fallbackTime: Date.now()
                    }
                };
            }

        } catch (fallbackError) {
            this.debug.error('Fallback handling failed for WebSocket error', {
                originalError: error.message,
                fallbackError: fallbackError.message
            });

            return this.createEmergencyFallback(error, 'websocket_error_fallback_failed');
        }
    }

    /**
     * Handle critical failures by disabling agent routing
     * @param {Error} error - Critical error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Disable result
     */
    async handleCriticalFailure(error, context = {}) {
        this.errorMetrics.totalErrors++;

        this.debug.error('Critical failure detected, disabling agent routing', {
            error: error.message,
            context: context.type || 'unknown',
            circuitBreakerState: this.getCircuitBreakerState()
        });

        try {
            // Force circuit breaker open
            this.circuitBreaker.isOpen = true;
            this.circuitBreaker.lastFailureTime = Date.now();
            this.errorMetrics.circuitBreakerTrips++;

            // Disable agent routing in StreamingManager if available
            if (this.streamingManager && typeof this.streamingManager.disableAgentRouting === 'function') {
                this.streamingManager.disableAgentRouting();
                this.debug.info('Agent routing disabled in StreamingManager');
            }

            // Log comprehensive error information
            this.logError('CRITICAL_FAILURE', error, {
                ...context,
                circuitBreakerForced: true,
                agentRoutingDisabled: true,
                circuitBreakerState: this.getCircuitBreakerState()
            });

            this.errorMetrics.fallbackActivations++;

            return {
                success: true,
                fallbackReason: 'critical_failure_agent_routing_disabled',
                agentRoutingDisabled: true,
                circuitBreakerForced: true,
                continueWithStandardStreaming: true,
                metadata: {
                    originalError: error.message,
                    criticalFailureTime: Date.now(),
                    circuitBreakerState: this.getCircuitBreakerState()
                }
            };

        } catch (fallbackError) {
            this.debug.error('Critical failure handling failed', {
                originalError: error.message,
                fallbackError: fallbackError.message
            });

            return this.createEmergencyFallback(error, 'critical_failure_fallback_failed');
        }
    }

    /**
     * Preserve agent context for WebSocket reconnection
     * @param {Object} context - Current context
     * @returns {Promise<void>}
     */
    async preserveAgentContextForReconnection(context) {
        try {
            this.debug.info('Preserving agent context for reconnection');

            // Get current agent information
            const currentAgent = this.streamingAgentRouter?.currentAgent;
            const sessionContext = this.streamingAgentRouter?.sessionContext;

            // Preserve context
            this.reconnectionState.preservedContext = {
                timestamp: Date.now(),
                currentAgent: currentAgent ? {
                    name: currentAgent.name,
                    description: currentAgent.description,
                    config: currentAgent.config
                } : null,
                sessionContext: sessionContext ? {
                    sessionId: sessionContext.sessionId,
                    conversationContext: sessionContext.conversationContext,
                    agentHistory: sessionContext.agentHistory,
                    routingMetrics: sessionContext.routingMetrics
                } : null,
                streamingState: {
                    isConnected: this.streamingManager.isConnected,
                    isStreamingAudio: this.streamingManager.isStreamingAudio,
                    currentTextResponse: this.streamingManager.currentTextResponse,
                    settings: this.streamingManager.settings
                },
                errorContext: context
            };

            this.reconnectionState.lastKnownAgent = currentAgent?.name;

            // Create session backup
            this.reconnectionState.sessionBackup = {
                instructions: await this.getCurrentSessionInstructions(),
                voiceConfig: this.getCurrentVoiceConfig(),
                timestamp: Date.now()
            };

            this.debug.info('Agent context preserved for reconnection', {
                hasCurrentAgent: !!currentAgent,
                hasSessionContext: !!sessionContext,
                hasSessionBackup: !!this.reconnectionState.sessionBackup,
                lastKnownAgent: this.reconnectionState.lastKnownAgent
            });

        } catch (error) {
            this.debug.error('Failed to preserve agent context for reconnection', {
                error: error.message
            });
        }
    }

    /**
     * Attempt WebSocket reconnection with context restoration
     * @param {Error} originalError - Original WebSocket error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Reconnection result
     */
    async attemptWebSocketReconnection(originalError, context) {
        this.reconnectionState.isReconnecting = true;
        this.reconnectionState.reconnectionAttempts++;
        this.errorMetrics.recoveryAttempts++;

        try {
            this.debug.info('Attempting WebSocket reconnection', {
                attempt: this.reconnectionState.reconnectionAttempts,
                maxAttempts: this.reconnectionState.maxReconnectionAttempts,
                hasPreservedContext: !!this.reconnectionState.preservedContext
            });

            // Check if max attempts reached
            if (this.reconnectionState.reconnectionAttempts > this.reconnectionState.maxReconnectionAttempts) {
                throw new Error(`Max reconnection attempts (${this.reconnectionState.maxReconnectionAttempts}) exceeded`);
            }

            // Attempt reconnection with timeout
            const reconnectionPromise = this.performWebSocketReconnection();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Reconnection timeout')), this.timeouts.reconnectionTimeout);
            });

            const reconnectionResult = await Promise.race([reconnectionPromise, timeoutPromise]);

            if (reconnectionResult.success) {
                // Attempt to restore agent context
                const contextRestorationResult = await this.restoreAgentContext();

                this.debug.info('WebSocket reconnection successful', {
                    attempt: this.reconnectionState.reconnectionAttempts,
                    contextRestored: contextRestorationResult.success
                });

                // Reset reconnection state
                this.reconnectionState.isReconnecting = false;
                this.reconnectionState.reconnectionAttempts = 0;

                return {
                    success: true,
                    contextRestored: contextRestorationResult.success,
                    contextRestorationResult,
                    reconnectionAttempts: this.reconnectionState.reconnectionAttempts
                };
            } else {
                throw new Error(reconnectionResult.error || 'Reconnection failed');
            }

        } catch (error) {
            this.debug.error('WebSocket reconnection attempt failed', {
                attempt: this.reconnectionState.reconnectionAttempts,
                error: error.message
            });

            // If more attempts available, retry with exponential backoff
            if (this.reconnectionState.reconnectionAttempts < this.reconnectionState.maxReconnectionAttempts) {
                const delay = Math.min(
                    this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, this.reconnectionState.reconnectionAttempts - 1),
                    this.retryConfig.maxDelay
                );

                this.debug.info('Retrying WebSocket reconnection after delay', {
                    delay,
                    nextAttempt: this.reconnectionState.reconnectionAttempts + 1
                });

                await this.delay(delay);
                return await this.attemptWebSocketReconnection(originalError, context);
            }

            // All attempts exhausted
            this.reconnectionState.isReconnecting = false;
            
            return {
                success: false,
                error: error.message,
                reconnectionAttempts: this.reconnectionState.reconnectionAttempts,
                maxAttemptsReached: true
            };
        }
    }

    /**
     * Perform the actual WebSocket reconnection
     * @returns {Promise<Object>} - Reconnection result
     */
    async performWebSocketReconnection() {
        try {
            this.debug.info('Performing WebSocket reconnection');

            // Disconnect existing connection
            if (this.streamingManager.websocket) {
                this.streamingManager.websocket.close();
            }

            // Attempt new connection
            const connectionResult = await this.streamingManager.connect();

            if (connectionResult.success) {
                this.debug.info('WebSocket reconnection successful');
                return { success: true };
            } else {
                throw new Error(connectionResult.error || 'Connection failed');
            }

        } catch (error) {
            this.debug.error('WebSocket reconnection failed', {
                error: error.message
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Restore agent context after reconnection
     * @returns {Promise<Object>} - Restoration result
     */
    async restoreAgentContext() {
        try {
            if (!this.reconnectionState.preservedContext) {
                this.debug.warn('No preserved context available for restoration');
                return { success: false, error: 'No preserved context' };
            }

            this.debug.info('Restoring agent context after reconnection');

            const preserved = this.reconnectionState.preservedContext;

            // Restore agent if available
            if (preserved.currentAgent && this.streamingAgentRouter) {
                try {
                    // Find the agent in registered agents
                    const registeredAgents = this.streamingAgentRouter.agentRouter?.getRegisteredAgents() || [];
                    const agent = registeredAgents.find(a => a.name === preserved.currentAgent.name);

                    if (agent) {
                        // Restore current agent
                        this.streamingAgentRouter.currentAgent = agent;
                        
                        // Restore session context
                        if (preserved.sessionContext) {
                            this.streamingAgentRouter.sessionContext = {
                                ...this.streamingAgentRouter.sessionContext,
                                ...preserved.sessionContext
                            };
                        }

                        this.debug.info('Agent context restored', {
                            agentName: agent.name,
                            hasSessionContext: !!preserved.sessionContext
                        });
                    } else {
                        this.debug.warn('Previously active agent not found in registered agents', {
                            agentName: preserved.currentAgent.name
                        });
                    }
                } catch (agentError) {
                    this.debug.error('Failed to restore agent', {
                        error: agentError.message,
                        agentName: preserved.currentAgent.name
                    });
                }
            }

            // Restore session configuration if available
            if (this.reconnectionState.sessionBackup) {
                try {
                    await this.restoreSessionConfiguration(this.reconnectionState.sessionBackup);
                    this.debug.info('Session configuration restored');
                } catch (sessionError) {
                    this.debug.error('Failed to restore session configuration', {
                        error: sessionError.message
                    });
                }
            }

            // Clear preserved context
            this.reconnectionState.preservedContext = null;
            this.reconnectionState.sessionBackup = null;

            return { success: true };

        } catch (error) {
            this.debug.error('Failed to restore agent context', {
                error: error.message
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Restore session configuration after reconnection
     * @param {Object} sessionBackup - Backed up session configuration
     * @returns {Promise<void>}
     */
    async restoreSessionConfiguration(sessionBackup) {
        try {
            if (!this.streamingManager.websocket || this.streamingManager.websocket.readyState !== WebSocket.OPEN) {
                throw new Error('WebSocket not ready for session configuration');
            }

            const sessionConfig = {
                type: 'session.update',
                session: {
                    modalities: ['text', 'audio'],
                    instructions: sessionBackup.instructions,
                    voice: sessionBackup.voiceConfig?.voice || 'shimmer',
                    input_audio_format: 'pcm16',
                    output_audio_format: 'pcm16',
                    input_audio_transcription: {
                        model: 'whisper-1'
                    },
                    turn_detection: {
                        type: 'server_vad',
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 1000
                    },
                    temperature: 0.9,
                    max_response_output_tokens: 500
                }
            };

            this.streamingManager.sendMessage(sessionConfig);
            this.debug.info('Session configuration restored', {
                voice: sessionConfig.session.voice,
                hasInstructions: !!sessionConfig.session.instructions
            });

        } catch (error) {
            this.debug.error('Failed to restore session configuration', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Attempt graceful degradation for agent errors
     * @param {Error} error - Agent error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Degradation result
     */
    async attemptGracefulDegradation(error, context) {
        try {
            this.debug.info('Attempting graceful degradation for agent error', {
                agentName: context.agentName,
                error: error.message
            });

            // Strategy 1: Try fallback agent if available
            if (context.agentName && context.agentName !== 'DefaultAgent') {
                const fallbackResult = await this.tryFallbackAgent(context);
                if (fallbackResult.success) {
                    return {
                        success: true,
                        strategy: 'fallback_agent',
                        fallbackAgent: fallbackResult.agentName,
                        response: fallbackResult.response
                    };
                }
            }

            // Strategy 2: Use cached response if available
            const cachedResult = await this.tryCachedResponse(context);
            if (cachedResult.success) {
                return {
                    success: true,
                    strategy: 'cached_response',
                    response: cachedResult.response,
                    cacheAge: cachedResult.age
                };
            }

            // Strategy 3: Generate simple acknowledgment response
            const acknowledgmentResult = await this.generateAcknowledgmentResponse(context);
            if (acknowledgmentResult.success) {
                return {
                    success: true,
                    strategy: 'acknowledgment_response',
                    response: acknowledgmentResult.response
                };
            }

            // All degradation strategies failed
            return {
                success: false,
                error: 'All graceful degradation strategies failed',
                strategiesAttempted: ['fallback_agent', 'cached_response', 'acknowledgment_response']
            };

        } catch (error) {
            this.debug.error('Graceful degradation attempt failed', {
                error: error.message,
                agentName: context.agentName
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Try using a fallback agent
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Fallback agent result
     */
    async tryFallbackAgent(context) {
        try {
            // Get registered agents
            const registeredAgents = this.streamingAgentRouter?.agentRouter?.getRegisteredAgents() || [];
            
            // Find a suitable fallback agent (prefer DefaultAgent or BankingInfoAgent)
            const fallbackCandidates = ['DefaultAgent', 'BankingInfoAgent', 'MultiAgentOrchestrator'];
            let fallbackAgent = null;

            for (const candidateName of fallbackCandidates) {
                if (candidateName !== context.agentName) {
                    fallbackAgent = registeredAgents.find(a => a.name === candidateName);
                    if (fallbackAgent) break;
                }
            }

            if (!fallbackAgent) {
                // Use any available agent except the failed one
                fallbackAgent = registeredAgents.find(a => a.name !== context.agentName);
            }

            if (fallbackAgent) {
                this.debug.info('Attempting fallback agent', {
                    originalAgent: context.agentName,
                    fallbackAgent: fallbackAgent.name
                });

                // Try to process with fallback agent
                const response = await fallbackAgent.processMessage(context.transcript || '', {
                    fallbackMode: true,
                    originalAgent: context.agentName,
                    apiClient: context.apiClient || window.apiClient
                });

                if (response && response.response) {
                    return {
                        success: true,
                        agentName: fallbackAgent.name,
                        response: response.response
                    };
                }
            }

            return { success: false, error: 'No suitable fallback agent available' };

        } catch (error) {
            this.debug.error('Fallback agent attempt failed', {
                error: error.message,
                originalAgent: context.agentName
            });
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Try using cached response
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Cached response result
     */
    async tryCachedResponse(context) {
        try {
            // Simple cache implementation - in a real system this would be more sophisticated
            const cacheKey = this.generateCacheKey(context.transcript);
            const cachedResponse = this.getFromCache(cacheKey);

            if (cachedResponse && Date.now() - cachedResponse.timestamp < 300000) { // 5 minutes
                this.debug.info('Using cached response for degradation', {
                    cacheKey: cacheKey.substring(0, 20),
                    age: Date.now() - cachedResponse.timestamp
                });

                return {
                    success: true,
                    response: cachedResponse.response,
                    age: Date.now() - cachedResponse.timestamp
                };
            }

            return { success: false, error: 'No suitable cached response available' };

        } catch (error) {
            this.debug.error('Cached response attempt failed', {
                error: error.message
            });
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate simple acknowledgment response
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Acknowledgment result
     */
    async generateAcknowledgmentResponse(context) {
        try {
            const acknowledgmentResponses = [
                "I understand your request. Let me help you with that through our standard service.",
                "I'm here to help. Let me connect you with our general banking assistance.",
                "Thank you for your inquiry. I'll make sure you get the help you need.",
                "I'm processing your request. Please give me a moment to assist you properly.",
                "I understand. Let me provide you with the best possible assistance."
            ];

            const response = acknowledgmentResponses[Math.floor(Math.random() * acknowledgmentResponses.length)];

            this.debug.info('Generated acknowledgment response for degradation');

            return {
                success: true,
                response: response
            };

        } catch (error) {
            this.debug.error('Acknowledgment response generation failed', {
                error: error.message
            });
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Retry session update with context
     * @param {Object} context - Retry context
     * @param {number} attemptNumber - Current attempt number
     * @returns {Promise<Object>} - Retry result
     */
    async retrySessionUpdate(context, attemptNumber) {
        try {
            this.debug.info('Retrying session update', {
                attemptNumber,
                agentName: context.agentName
            });

            if (!this.streamingAgentRouter || !context.agentName) {
                throw new Error('Missing required components for session update retry');
            }

            // Get the agent
            const registeredAgents = this.streamingAgentRouter.agentRouter?.getRegisteredAgents() || [];
            const agent = registeredAgents.find(a => a.name === context.agentName);

            if (!agent) {
                throw new Error(`Agent ${context.agentName} not found for retry`);
            }

            // Attempt session update
            const updateResult = await this.streamingAgentRouter.updateSessionForAgent(
                agent,
                context.sessionContext || {}
            );

            return updateResult;

        } catch (error) {
            this.debug.error('Session update retry failed', {
                error: error.message,
                attemptNumber,
                agentName: context.agentName
            });
            
            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Record circuit breaker failure
     */
    recordCircuitBreakerFailure() {
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.successCount = 0;
        this.circuitBreaker.lastFailureTime = Date.now();

        if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
            this.circuitBreaker.isOpen = true;
            this.errorMetrics.circuitBreakerTrips++;
            
            this.debug.warn('Circuit breaker opened', {
                failureCount: this.circuitBreaker.failureCount,
                threshold: this.circuitBreaker.failureThreshold
            });

            // Set timeout to attempt reset
            this.scheduleCircuitBreakerReset();
        }
    }

    /**
     * Record circuit breaker success
     */
    recordCircuitBreakerSuccess() {
        this.circuitBreaker.successCount++;
        this.circuitBreaker.failureCount = 0;

        if (this.circuitBreaker.isOpen && this.circuitBreaker.successCount >= this.circuitBreaker.successThreshold) {
            this.circuitBreaker.isOpen = false;
            this.circuitBreaker.successCount = 0;
            
            this.debug.info('Circuit breaker closed', {
                successCount: this.circuitBreaker.successCount,
                threshold: this.circuitBreaker.successThreshold
            });
        }
    }

    /**
     * Schedule circuit breaker reset attempt
     */
    scheduleCircuitBreakerReset() {
        const timeoutId = setTimeout(() => {
            if (this.circuitBreaker.isOpen && 
                Date.now() - this.circuitBreaker.lastFailureTime >= this.circuitBreaker.resetTimeout) {
                
                this.debug.info('Attempting circuit breaker reset');
                this.circuitBreaker.isOpen = false;
                this.circuitBreaker.failureCount = 0;
                this.circuitBreaker.successCount = 0;
            }
            
            this.activeTimeouts.delete('circuitBreakerReset');
        }, this.circuitBreaker.resetTimeout);

        this.activeTimeouts.set('circuitBreakerReset', timeoutId);
    }

    /**
     * Create emergency fallback response
     * @param {Error} error - Original error
     * @param {string} reason - Fallback reason
     * @returns {Object} - Emergency fallback
     */
    createEmergencyFallback(error, reason) {
        this.debug.error('Creating emergency fallback', {
            error: error.message,
            reason
        });

        return {
            success: true,
            fallbackReason: 'emergency_fallback',
            emergencyReason: reason,
            continueWithStandardStreaming: true,
            disableAgentRouting: true,
            metadata: {
                originalError: error.message,
                emergencyFallbackTime: Date.now(),
                reason
            }
        };
    }

    /**
     * Log comprehensive error information
     * @param {string} errorType - Type of error
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     */
    logError(errorType, error, context = {}) {
        const errorLog = {
            timestamp: Date.now(),
            errorType,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context,
            metrics: this.getErrorMetrics(),
            circuitBreakerState: this.getCircuitBreakerState(),
            reconnectionState: {
                isReconnecting: this.reconnectionState.isReconnecting,
                attempts: this.reconnectionState.reconnectionAttempts,
                hasPreservedContext: !!this.reconnectionState.preservedContext
            }
        };

        // Log to debug system
        this.debug.error('Comprehensive error log', errorLog);

        // Store in error history for analysis (keep last 100 errors)
        if (!this.errorHistory) {
            this.errorHistory = [];
        }
        
        this.errorHistory.push(errorLog);
        if (this.errorHistory.length > 100) {
            this.errorHistory.shift();
        }
    }

    /**
     * Get current circuit breaker state
     * @returns {Object} - Circuit breaker state
     */
    getCircuitBreakerState() {
        return {
            isOpen: this.circuitBreaker.isOpen,
            failureCount: this.circuitBreaker.failureCount,
            successCount: this.circuitBreaker.successCount,
            lastFailureTime: this.circuitBreaker.lastFailureTime,
            timeSinceLastFailure: this.circuitBreaker.lastFailureTime ? 
                Date.now() - this.circuitBreaker.lastFailureTime : null
        };
    }

    /**
     * Get error metrics
     * @returns {Object} - Error metrics
     */
    getErrorMetrics() {
        return { ...this.errorMetrics };
    }

    /**
     * Get current session instructions
     * @returns {Promise<string>} - Current session instructions
     */
    async getCurrentSessionInstructions() {
        try {
            if (this.streamingAgentRouter?.currentAgent) {
                return await this.streamingAgentRouter.generateSessionInstructions(
                    this.streamingAgentRouter.currentAgent,
                    '',
                    {}
                );
            }
            
            return this.streamingAgentRouter?.getDefaultSessionInstructions() || 
                   'You are a helpful banking assistant.';

        } catch (error) {
            this.debug.warn('Failed to get current session instructions', {
                error: error.message
            });
            
            return 'You are a helpful banking assistant.';
        }
    }

    /**
     * Get current voice configuration
     * @returns {Object} - Current voice configuration
     */
    getCurrentVoiceConfig() {
        try {
            if (this.streamingAgentRouter?.currentAgent) {
                return this.streamingAgentRouter.getAgentVoiceConfig(this.streamingAgentRouter.currentAgent);
            }
            
            return { voice: 'shimmer', speed: 1.0, pitch: 1.0 };

        } catch (error) {
            this.debug.warn('Failed to get current voice config', {
                error: error.message
            });
            
            return { voice: 'shimmer', speed: 1.0, pitch: 1.0 };
        }
    }

    /**
     * Generate cache key for response caching
     * @param {string} text - Text to generate key for
     * @returns {string} - Cache key
     */
    generateCacheKey(text) {
        // Simple hash function for cache key
        let hash = 0;
        if (text.length === 0) return hash.toString();
        
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString();
    }

    /**
     * Get response from cache
     * @param {string} key - Cache key
     * @returns {Object|null} - Cached response or null
     */
    getFromCache(key) {
        // Simple in-memory cache - in production this would be more sophisticated
        if (!this.responseCache) {
            this.responseCache = new Map();
        }
        
        return this.responseCache.get(key) || null;
    }

    /**
     * Store response in cache
     * @param {string} key - Cache key
     * @param {string} response - Response to cache
     */
    storeInCache(key, response) {
        if (!this.responseCache) {
            this.responseCache = new Map();
        }
        
        this.responseCache.set(key, {
            response,
            timestamp: Date.now()
        });
        
        // Limit cache size
        if (this.responseCache.size > 100) {
            const firstKey = this.responseCache.keys().next().value;
            this.responseCache.delete(firstKey);
        }
    }

    /**
     * Utility function to create a delay
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => {
            const timeoutId = setTimeout(resolve, ms);
            this.activeTimeouts.set(`delay_${Date.now()}`, timeoutId);
        });
    }

    /**
     * Check if circuit breaker allows operation
     * @returns {boolean} - Whether operation is allowed
     */
    isOperationAllowed() {
        if (!this.circuitBreaker.isOpen) {
            return true;
        }

        // Check if enough time has passed for reset attempt
        if (Date.now() - this.circuitBreaker.lastFailureTime >= this.circuitBreaker.resetTimeout) {
            return true; // Allow one attempt to test if service is back
        }

        return false;
    }

    /**
     * Get comprehensive error handler status
     * @returns {Object} - Status information
     */
    getStatus() {
        return {
            circuitBreaker: this.getCircuitBreakerState(),
            errorMetrics: this.getErrorMetrics(),
            reconnectionState: {
                isReconnecting: this.reconnectionState.isReconnecting,
                attempts: this.reconnectionState.reconnectionAttempts,
                maxAttempts: this.reconnectionState.maxReconnectionAttempts,
                hasPreservedContext: !!this.reconnectionState.preservedContext,
                lastKnownAgent: this.reconnectionState.lastKnownAgent
            },
            timeouts: this.timeouts,
            retryConfig: this.retryConfig,
            activeTimeouts: this.activeTimeouts.size,
            errorHistorySize: this.errorHistory?.length || 0
        };
    }

    /**
     * Reset error handler state (for testing or manual reset)
     */
    reset() {
        this.debug.info('Resetting error handler state');

        // Reset circuit breaker
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failureCount = 0;
        this.circuitBreaker.successCount = 0;
        this.circuitBreaker.lastFailureTime = null;

        // Reset reconnection state
        this.reconnectionState.isReconnecting = false;
        this.reconnectionState.reconnectionAttempts = 0;
        this.reconnectionState.preservedContext = null;
        this.reconnectionState.lastKnownAgent = null;
        this.reconnectionState.sessionBackup = null;

        // Clear active timeouts
        for (const [key, timeoutId] of this.activeTimeouts) {
            clearTimeout(timeoutId);
        }
        this.activeTimeouts.clear();

        // Reset metrics (but keep history for analysis)
        this.errorMetrics = {
            totalErrors: 0,
            routingTimeouts: 0,
            agentErrors: 0,
            sessionUpdateFailures: 0,
            websocketErrors: 0,
            circuitBreakerTrips: 0,
            fallbackActivations: 0,
            recoveryAttempts: 0,
            successfulRecoveries: 0
        };

        this.debug.info('Error handler state reset completed');
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.debug.info('Cleaning up error handler resources');

        // Clear all active timeouts
        for (const [key, timeoutId] of this.activeTimeouts) {
            clearTimeout(timeoutId);
        }
        this.activeTimeouts.clear();

        // Clear caches
        if (this.responseCache) {
            this.responseCache.clear();
        }

        // Reset state
        this.reset();

        this.debug.info('Error handler cleanup completed');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.StreamingErrorHandler = StreamingErrorHandler;
}
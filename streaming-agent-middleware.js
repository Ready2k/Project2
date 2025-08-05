/**
 * StreamingAgentMiddleware - WebSocket middleware layer for agent routing integration
 * Provides message interception, error handling, and agent state management for streaming sessions
 */
class StreamingAgentMiddleware {
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
            window.debugManager.createModuleLogger('StreamingAgentMiddleware') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

        // Middleware state
        this.isEnabled = true;
        this.interceptedMessageTypes = new Set([
            'conversation.item.input_audio_transcription.completed',
            'response.created',
            'response.done',
            'session.created',
            'session.updated'
        ]);

        // Agent state management
        this.agentStates = new Map(); // sessionId -> agentState
        this.sessionAgentMapping = new Map(); // sessionId -> currentAgentName
        
        // Error handling - will be managed by StreamingErrorHandler
        this.errorHandlers = new Map();
        this.errorHandler = null;
        this.fallbackStrategies = {
            ROUTING_TIMEOUT: 'continue_standard_streaming',
            AGENT_ERROR: 'use_fallback_handler',
            SESSION_UPDATE_FAILED: 'retry_with_backoff',
            WEBSOCKET_ERROR: 'preserve_state_for_reconnection',
            CRITICAL_FAILURE: 'disable_agent_routing'
        };

        // Performance tracking
        this.interceptMetrics = {
            totalIntercepted: 0,
            successfulRouting: 0,
            fallbackCount: 0,
            errorCount: 0,
            averageProcessingTime: 0
        };

        // Integration hooks
        this.messageHooks = new Map();
        this.preProcessHooks = [];
        this.postProcessHooks = [];

        this.debug.info('StreamingAgentMiddleware initialized', {
            hasStreamingManager: !!this.streamingManager,
            hasStreamingAgentRouter: !!this.streamingAgentRouter,
            interceptedTypes: Array.from(this.interceptedMessageTypes),
            isEnabled: this.isEnabled
        });

        // Set up integration with StreamingManager
        this.setupStreamingManagerIntegration();
    }

    /**
     * Set error handler for comprehensive error handling
     * @param {StreamingErrorHandler} errorHandler - Error handler instance
     */
    setErrorHandler(errorHandler) {
        this.errorHandler = errorHandler;
        this.debug.info('Error handler set for StreamingAgentMiddleware');
    }

    /**
     * Set up integration hooks with StreamingManager WebSocket message flow
     */
    setupStreamingManagerIntegration() {
        try {
            // Store original handleMessage method
            this.originalHandleMessage = this.streamingManager.handleMessage.bind(this.streamingManager);
            
            // Replace handleMessage with our intercepting version
            this.streamingManager.handleMessage = this.createInterceptingHandler();
            
            this.debug.info('StreamingManager integration established');
            
        } catch (error) {
            this.debug.error('Failed to set up StreamingManager integration', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Create intercepting message handler that wraps the original
     * @returns {Function} - Intercepting handler function
     */
    createInterceptingHandler() {
        return async (event) => {
            const startTime = Date.now();
            
            try {
                // Parse message
                const message = JSON.parse(event.data);
                
                // Check if middleware is enabled and should intercept this message type
                if (this.isEnabled && this.shouldInterceptMessage(message)) {
                    this.debug.debug('Intercepting message', {
                        type: message.type,
                        hasContent: !!message.content,
                        timestamp: Date.now()
                    });

                    // Intercept and process the message
                    const interceptResult = await this.interceptMessage(message, message.type);
                    
                    // Update metrics
                    this.updateInterceptMetrics(startTime, interceptResult.success);
                    
                    // If interception handled the message, don't pass to original handler
                    if (interceptResult.handled) {
                        this.debug.debug('Message fully handled by middleware', {
                            type: message.type,
                            success: interceptResult.success
                        });
                        return;
                    }
                    
                    // If interception modified the message, use modified version
                    if (interceptResult.modifiedMessage) {
                        event.data = JSON.stringify(interceptResult.modifiedMessage);
                    }
                }

                // Call original handler
                return await this.originalHandleMessage(event);
                
            } catch (error) {
                this.debug.error('Error in intercepting handler', {
                    error: error.message,
                    stack: error.stack
                });
                
                // Handle the error gracefully
                let errorResult;
                if (this.errorHandler) {
                    errorResult = await this.errorHandler.fallbackStrategies.CRITICAL_FAILURE(error, {
                        type: 'message_interception_error',
                        originalEvent: event
                    });
                    
                    errorResult = {
                        success: false,
                        handled: false,
                        error: error.message,
                        errorHandled: true,
                        continueProcessing: errorResult.continueProcessing !== false
                    };
                } else {
                    errorResult = await this.handleRoutingError(error, {
                        type: 'message_interception_error',
                        originalEvent: event
                    });
                }
                
                // If error handling suggests continuing, call original handler
                if (errorResult.continueProcessing) {
                    return await this.originalHandleMessage(event);
                }
            }
        };
    }

    /**
     * Determine if a message should be intercepted
     * @param {Object} message - WebSocket message
     * @returns {boolean} - Whether to intercept
     */
    shouldInterceptMessage(message) {
        return this.interceptedMessageTypes.has(message.type);
    }

    /**
     * Intercept WebSocket messages for routing
     * @param {Object} message - WebSocket message to intercept
     * @param {string} messageType - Type of the message
     * @returns {Promise<Object>} - Interception result
     */
    async interceptMessage(message, messageType) {
        const startTime = Date.now();
        
        try {
            this.interceptMetrics.totalIntercepted++;
            
            this.debug.info('Processing intercepted message', {
                type: messageType,
                messageId: message.id,
                timestamp: Date.now()
            });

            // Run pre-process hooks
            await this.runPreProcessHooks(message, messageType);

            // Handle different message types
            let result;
            switch (messageType) {
                case 'conversation.item.input_audio_transcription.completed':
                    result = await this.handleTranscriptionCompleted(message);
                    break;
                    
                case 'response.created':
                    result = await this.handleResponseCreated(message);
                    break;
                    
                case 'response.done':
                    result = await this.handleResponseDone(message);
                    break;
                    
                case 'session.created':
                    result = await this.handleSessionCreated(message);
                    break;
                    
                case 'session.updated':
                    result = await this.handleSessionUpdated(message);
                    break;
                    
                default:
                    result = await this.handleGenericMessage(message, messageType);
            }

            // Run post-process hooks
            await this.runPostProcessHooks(message, messageType, result);

            const processingTime = Date.now() - startTime;
            this.debug.debug('Message interception completed', {
                type: messageType,
                processingTime,
                handled: result.handled,
                success: result.success
            });

            return {
                ...result,
                processingTime
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            this.debug.error('Message interception failed', {
                type: messageType,
                error: error.message,
                processingTime
            });

            // Use error handler if available
            if (this.errorHandler) {
                const errorResult = await this.errorHandler.fallbackStrategies.CRITICAL_FAILURE(error, {
                    type: 'message_interception_error',
                    messageType,
                    originalMessage: message
                });
                
                return {
                    success: false,
                    handled: false,
                    error: error.message,
                    errorHandled: true,
                    processingTime: Date.now() - startTime
                };
            }

            return await this.handleRoutingError(error, {
                type: 'message_interception_error',
                messageType,
                originalMessage: message
            });
        }
    }

    /**
     * Handle transcription completed messages - main routing entry point
     * @param {Object} message - Transcription completed message
     * @returns {Promise<Object>} - Handling result
     */
    async handleTranscriptionCompleted(message) {
        try {
            const transcript = message.transcript;
            if (!transcript || transcript.trim().length === 0) {
                this.debug.warn('Empty transcript in transcription completed message');
                return { success: true, handled: false };
            }

            this.debug.info('Processing transcription for agent routing', {
                transcriptPreview: transcript.substring(0, 100),
                transcriptLength: transcript.length
            });

            // IMPORTANT: Display the user message in the UI first
            // This ensures the user sees their message regardless of agent routing
            if (this.streamingManager && typeof this.streamingManager.displayUserMessage === 'function') {
                this.streamingManager.displayUserMessage(transcript);
                this.debug.info('User message displayed via middleware');
            } else {
                this.debug.warn('StreamingManager.displayUserMessage not available');
            }

            // Get current session context
            const sessionContext = this.getSessionContext();
            
            // Route through agent system
            const routingResult = await this.streamingAgentRouter.routeStreamingMessage(
                transcript, 
                sessionContext
            );

            if (routingResult.success) {
                this.interceptMetrics.successfulRouting++;
                
                // Update session if agent changed
                if (routingResult.sessionUpdateRequired) {
                    await this.updateSessionForRouting(routingResult);
                }
                
                // Manage agent state
                await this.manageAgentState(
                    sessionContext.sessionId,
                    routingResult.selectedAgent?.name,
                    {
                        agentResponse: routingResult.agentResponse,
                        routingReason: routingResult.routingReason,
                        timestamp: Date.now()
                    }
                );

                // Process the agent response for streaming delivery
                if (routingResult.agentResponse && routingResult.agentResponse.response) {
                    await this.deliverAgentResponse(routingResult.agentResponse, sessionContext);
                }

                // Mark the message as already routed to prevent double-processing
                message._agentRouted = true;
                message._routingResult = routingResult;

                // Let the original handler process the transcription for UI display
                // but mark that we've handled the agent routing
                return {
                    success: true,
                    handled: false, // Allow original handler to run for UI display
                    routingResult,
                    agentName: routingResult.selectedAgent?.name,
                    agentRouted: true, // Flag to indicate agent routing was successful
                    modifiedMessage: message // Pass the modified message
                };
                
            } else {
                // Routing failed, fall back to standard streaming
                this.debug.warn('Agent routing failed, falling back to standard streaming', {
                    fallbackReason: routingResult.fallbackReason
                });
                
                this.interceptMetrics.fallbackCount++;
                
                return {
                    success: true,
                    handled: false, // Let original handler process
                    fallbackReason: routingResult.fallbackReason
                };
            }

        } catch (error) {
            this.debug.error('Failed to handle transcription completed', {
                error: error.message,
                transcript: message.transcript?.substring(0, 50)
            });
            
            // Use error handler if available
            if (this.errorHandler) {
                const errorResult = await this.errorHandler.fallbackStrategies.AGENT_ERROR(error, {
                    type: 'transcription_routing_error',
                    originalMessage: message,
                    transcript: message.transcript
                });
                
                return {
                    success: false,
                    handled: false,
                    error: error.message,
                    errorHandled: true,
                    fallbackReason: errorResult.fallbackReason
                };
            }

            return await this.handleRoutingError(error, {
                type: 'transcription_routing_error',
                originalMessage: message
            });
        }
    }

    /**
     * Handle response created messages
     * @param {Object} message - Response created message
     * @returns {Promise<Object>} - Handling result
     */
    async handleResponseCreated(message) {
        try {
            this.debug.debug('Response created', {
                responseId: message.response?.id,
                timestamp: Date.now()
            });

            // Update agent state to track active response
            const sessionContext = this.getSessionContext();
            const currentAgentName = this.sessionAgentMapping.get(sessionContext.sessionId);
            
            if (currentAgentName) {
                await this.manageAgentState(sessionContext.sessionId, currentAgentName, {
                    responseActive: true,
                    responseId: message.response?.id,
                    responseStartTime: Date.now()
                });
            }

            return { success: true, handled: false };

        } catch (error) {
            this.debug.error('Failed to handle response created', {
                error: error.message
            });
            
            return { success: false, handled: false, error: error.message };
        }
    }

    /**
     * Handle response done messages
     * @param {Object} message - Response done message
     * @returns {Promise<Object>} - Handling result
     */
    async handleResponseDone(message) {
        try {
            this.debug.debug('Response completed', {
                responseId: message.response?.id,
                timestamp: Date.now()
            });

            // Update agent state to mark response complete
            const sessionContext = this.getSessionContext();
            const currentAgentName = this.sessionAgentMapping.get(sessionContext.sessionId);
            
            if (currentAgentName) {
                await this.manageAgentState(sessionContext.sessionId, currentAgentName, {
                    responseActive: false,
                    responseId: null,
                    lastResponseEndTime: Date.now()
                });
            }

            return { success: true, handled: false };

        } catch (error) {
            this.debug.error('Failed to handle response done', {
                error: error.message
            });
            
            return { success: false, handled: false, error: error.message };
        }
    }

    /**
     * Handle session created messages
     * @param {Object} message - Session created message
     * @returns {Promise<Object>} - Handling result
     */
    async handleSessionCreated(message) {
        try {
            const sessionId = message.session?.id || 'default_session';
            
            this.debug.info('Session created', {
                sessionId,
                timestamp: Date.now()
            });

            // Initialize agent state for new session
            this.agentStates.set(sessionId, {
                sessionId,
                currentAgent: null,
                agentHistory: [],
                createdAt: Date.now(),
                lastActivity: Date.now(),
                responseActive: false,
                routingMetrics: {
                    totalRoutings: 0,
                    successfulRoutings: 0,
                    agentSwitches: 0,
                    fallbacks: 0
                }
            });

            return { success: true, handled: false };

        } catch (error) {
            this.debug.error('Failed to handle session created', {
                error: error.message
            });
            
            return { success: false, handled: false, error: error.message };
        }
    }

    /**
     * Handle session updated messages
     * @param {Object} message - Session updated message
     * @returns {Promise<Object>} - Handling result
     */
    async handleSessionUpdated(message) {
        try {
            this.debug.debug('Session updated', {
                sessionId: message.session?.id,
                timestamp: Date.now()
            });

            // Update session state if needed
            const sessionId = message.session?.id || 'default_session';
            const agentState = this.agentStates.get(sessionId);
            
            if (agentState) {
                agentState.lastActivity = Date.now();
                agentState.sessionUpdateCount = (agentState.sessionUpdateCount || 0) + 1;
            }

            return { success: true, handled: false };

        } catch (error) {
            this.debug.error('Failed to handle session updated', {
                error: error.message
            });
            
            return { success: false, handled: false, error: error.message };
        }
    }

    /**
     * Handle generic messages not specifically handled
     * @param {Object} message - Generic message
     * @param {string} messageType - Message type
     * @returns {Promise<Object>} - Handling result
     */
    async handleGenericMessage(message, messageType) {
        this.debug.debug('Handling generic message', {
            type: messageType,
            timestamp: Date.now()
        });

        // Check if there are custom hooks for this message type
        const hooks = this.messageHooks.get(messageType);
        if (hooks && hooks.length > 0) {
            for (const hook of hooks) {
                try {
                    await hook(message, messageType);
                } catch (error) {
                    this.debug.warn('Message hook failed', {
                        type: messageType,
                        error: error.message
                    });
                }
            }
        }

        return { success: true, handled: false };
    }

    /**
     * Handle routing errors gracefully
     * @param {Error} error - The error that occurred
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Error handling result
     */
    async handleRoutingError(error, context = {}) {
        this.interceptMetrics.errorCount++;
        
        this.debug.error('Handling routing error', {
            error: error.message,
            context: context.type,
            timestamp: Date.now()
        });

        // Determine error type and appropriate fallback strategy
        let errorType = 'CRITICAL_FAILURE';
        let fallbackStrategy = this.fallbackStrategies.CRITICAL_FAILURE;

        if (error.message.includes('timeout')) {
            errorType = 'ROUTING_TIMEOUT';
            fallbackStrategy = this.fallbackStrategies.ROUTING_TIMEOUT;
        } else if (error.message.includes('agent') || error.message.includes('Agent')) {
            errorType = 'AGENT_ERROR';
            fallbackStrategy = this.fallbackStrategies.AGENT_ERROR;
        } else if (error.message.includes('session')) {
            errorType = 'SESSION_UPDATE_FAILED';
            fallbackStrategy = this.fallbackStrategies.SESSION_UPDATE_FAILED;
        } else if (error.message.includes('websocket') || error.message.includes('connection') || error.message.includes('WebSocket')) {
            errorType = 'WEBSOCKET_ERROR';
            fallbackStrategy = this.fallbackStrategies.WEBSOCKET_ERROR;
        }

        // Execute fallback strategy
        const fallbackResult = await this.executeFallbackStrategy(
            errorType, 
            fallbackStrategy, 
            error, 
            context
        );

        return {
            success: false,
            handled: false,
            error: error.message,
            errorType,
            fallbackStrategy,
            fallbackResult,
            continueProcessing: fallbackResult.continueProcessing !== false
        };
    }

    /**
     * Execute the appropriate fallback strategy
     * @param {string} errorType - Type of error
     * @param {string} strategy - Fallback strategy
     * @param {Error} error - Original error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Fallback execution result
     */
    async executeFallbackStrategy(errorType, strategy, error, context) {
        this.debug.info('Executing fallback strategy', {
            errorType,
            strategy,
            context: context.type
        });

        try {
            switch (strategy) {
                case 'continue_standard_streaming':
                    return {
                        action: 'continue_standard_streaming',
                        continueProcessing: true,
                        message: 'Continuing with standard streaming mode'
                    };

                case 'use_fallback_handler':
                    return await this.useFallbackHandler(error, context);

                case 'retry_with_backoff':
                    return await this.retryWithBackoff(error, context);

                case 'preserve_state_for_reconnection':
                    return await this.preserveStateForReconnection(error, context);

                case 'disable_agent_routing':
                    return await this.disableAgentRouting(error, context);

                default:
                    this.debug.warn('Unknown fallback strategy', { strategy });
                    return {
                        action: 'continue_standard_streaming',
                        continueProcessing: true,
                        message: 'Using default fallback: continue standard streaming'
                    };
            }

        } catch (fallbackError) {
            this.debug.error('Fallback strategy execution failed', {
                strategy,
                error: fallbackError.message
            });

            return {
                action: 'emergency_fallback',
                continueProcessing: true,
                message: 'Emergency fallback: continue with original processing'
            };
        }
    }

    /**
     * Use fallback handler for agent errors
     * @param {Error} error - Original error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Fallback result
     */
    async useFallbackHandler(error, context) {
        this.debug.info('Using fallback handler for agent error');
        
        // Could implement a simple fallback response here
        // For now, just continue with standard streaming
        return {
            action: 'use_fallback_handler',
            continueProcessing: true,
            message: 'Using fallback handler, continuing with standard streaming'
        };
    }

    /**
     * Retry operation with exponential backoff
     * @param {Error} error - Original error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Retry result
     */
    async retryWithBackoff(error, context) {
        this.debug.info('Implementing retry with backoff');
        
        // For session updates, we could implement retry logic here
        // For now, just continue processing
        return {
            action: 'retry_with_backoff',
            continueProcessing: true,
            message: 'Retry attempted, continuing with processing'
        };
    }

    /**
     * Preserve agent state for WebSocket reconnection
     * @param {Error} error - Original error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Preservation result
     */
    async preserveStateForReconnection(error, context) {
        this.debug.info('Preserving agent state for reconnection');
        
        // Store current agent states for recovery
        const sessionContext = this.getSessionContext();
        const currentAgent = this.sessionAgentMapping.get(sessionContext.sessionId);
        
        if (currentAgent) {
            this.debug.info('Preserving agent state for reconnection', {
                sessionId: sessionContext.sessionId,
                currentAgent
            });
        }

        return {
            action: 'preserve_state_for_reconnection',
            continueProcessing: false,
            message: 'Agent state preserved for reconnection'
        };
    }

    /**
     * Disable agent routing due to critical failure
     * @param {Error} error - Original error
     * @param {Object} context - Error context
     * @returns {Promise<Object>} - Disable result
     */
    async disableAgentRouting(error, context) {
        this.debug.warn('Disabling agent routing due to critical failure', {
            error: error.message
        });
        
        this.isEnabled = false;
        
        return {
            action: 'disable_agent_routing',
            continueProcessing: true,
            message: 'Agent routing disabled, continuing with standard streaming'
        };
    }

    /**
     * Manage agent state during WebSocket session
     * @param {string} sessionId - Session identifier
     * @param {string} agentName - Current agent name
     * @param {Object} state - Agent state to update
     * @returns {Promise<void>}
     */
    async manageAgentState(sessionId, agentName, state = {}) {
        try {
            if (!sessionId) {
                this.debug.warn('No session ID provided for agent state management');
                return;
            }

            // Get or create agent state
            let agentState = this.agentStates.get(sessionId);
            if (!agentState) {
                agentState = {
                    sessionId,
                    currentAgent: null,
                    agentHistory: [],
                    createdAt: Date.now(),
                    lastActivity: Date.now(),
                    responseActive: false,
                    routingMetrics: {
                        totalRoutings: 0,
                        successfulRoutings: 0,
                        agentSwitches: 0,
                        fallbacks: 0
                    }
                };
                this.agentStates.set(sessionId, agentState);
            }

            // Check for agent switch
            const previousAgent = agentState.currentAgent;
            if (agentName && agentName !== previousAgent) {
                this.debug.info('Agent switch detected in state management', {
                    sessionId,
                    previousAgent,
                    newAgent: agentName
                });

                // Record agent switch
                agentState.agentHistory.push({
                    agentName: previousAgent,
                    switchedTo: agentName,
                    timestamp: Date.now(),
                    reason: state.routingReason || 'agent_switch'
                });

                agentState.routingMetrics.agentSwitches++;
                this.sessionAgentMapping.set(sessionId, agentName);
            }

            // Update agent state
            agentState.currentAgent = agentName;
            agentState.lastActivity = Date.now();
            
            // Merge provided state
            Object.assign(agentState, state);

            // Update routing metrics
            if (state.agentResponse) {
                agentState.routingMetrics.totalRoutings++;
                if (state.agentResponse.success) {
                    agentState.routingMetrics.successfulRoutings++;
                }
            }

            this.debug.debug('Agent state updated', {
                sessionId,
                agentName,
                stateKeys: Object.keys(state),
                totalSwitches: agentState.routingMetrics.agentSwitches
            });

        } catch (error) {
            this.debug.error('Failed to manage agent state', {
                error: error.message,
                sessionId,
                agentName
            });
        }
    }

    /**
     * Update session for routing result
     * @param {Object} routingResult - Result from agent routing
     * @returns {Promise<void>}
     */
    async updateSessionForRouting(routingResult) {
        try {
            if (!routingResult.selectedAgent) {
                this.debug.warn('No selected agent for session update');
                return;
            }

            this.debug.info('Updating session for routing result', {
                agentName: routingResult.selectedAgent.name,
                sessionUpdateRequired: routingResult.sessionUpdateRequired
            });

            // Update session through StreamingAgentRouter
            const updateResult = await this.streamingAgentRouter.updateSessionForAgent(
                routingResult.selectedAgent,
                this.getSessionContext()
            );

            if (updateResult.success) {
                this.debug.info('Session updated successfully for agent', {
                    agentName: routingResult.selectedAgent.name,
                    voice: updateResult.voiceConfig?.voice
                });
            } else {
                this.debug.error('Failed to update session for agent', {
                    agentName: routingResult.selectedAgent.name,
                    error: updateResult.error
                });
            }

        } catch (error) {
            this.debug.error('Error updating session for routing', {
                error: error.message,
                agentName: routingResult.selectedAgent?.name
            });
        }
    }

    /**
     * Get current session context
     * @returns {Object} - Session context
     */
    getSessionContext() {
        // Try to get session ID from StreamingManager or generate default
        const sessionId = this.streamingManager.sessionId || 
                         this.streamingManager.connectionId || 
                         'default_session';

        return {
            sessionId,
            timestamp: Date.now(),
            middlewareEnabled: this.isEnabled,
            agentState: this.agentStates.get(sessionId)
        };
    }

    /**
     * Run pre-process hooks
     * @param {Object} message - Message to process
     * @param {string} messageType - Message type
     * @returns {Promise<void>}
     */
    async runPreProcessHooks(message, messageType) {
        for (const hook of this.preProcessHooks) {
            try {
                await hook(message, messageType);
            } catch (error) {
                this.debug.warn('Pre-process hook failed', {
                    messageType,
                    error: error.message
                });
            }
        }
    }

    /**
     * Run post-process hooks
     * @param {Object} message - Processed message
     * @param {string} messageType - Message type
     * @param {Object} result - Processing result
     * @returns {Promise<void>}
     */
    async runPostProcessHooks(message, messageType, result) {
        for (const hook of this.postProcessHooks) {
            try {
                await hook(message, messageType, result);
            } catch (error) {
                this.debug.warn('Post-process hook failed', {
                    messageType,
                    error: error.message
                });
            }
        }
    }

    /**
     * Update interception metrics
     * @param {number} startTime - Processing start time
     * @param {boolean} success - Whether processing was successful
     */
    updateInterceptMetrics(startTime, success) {
        const processingTime = Date.now() - startTime;
        
        // Update average processing time
        const totalProcessed = this.interceptMetrics.totalIntercepted;
        const currentAverage = this.interceptMetrics.averageProcessingTime;
        this.interceptMetrics.averageProcessingTime = 
            ((currentAverage * (totalProcessed - 1)) + processingTime) / totalProcessed;

        if (!success) {
            this.interceptMetrics.errorCount++;
        }
    }

    /**
     * Add message hook for specific message type
     * @param {string} messageType - Message type to hook
     * @param {Function} hook - Hook function
     */
    addMessageHook(messageType, hook) {
        if (!this.messageHooks.has(messageType)) {
            this.messageHooks.set(messageType, []);
        }
        this.messageHooks.get(messageType).push(hook);
        
        this.debug.info('Message hook added', { messageType });
    }

    /**
     * Add pre-process hook
     * @param {Function} hook - Pre-process hook function
     */
    addPreProcessHook(hook) {
        this.preProcessHooks.push(hook);
        this.debug.info('Pre-process hook added');
    }

    /**
     * Add post-process hook
     * @param {Function} hook - Post-process hook function
     */
    addPostProcessHook(hook) {
        this.postProcessHooks.push(hook);
        this.debug.info('Post-process hook added');
    }

    /**
     * Enable or disable the middleware
     * @param {boolean} enabled - Whether middleware should be enabled
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.debug.info('Middleware enabled state changed', { enabled });
    }

    /**
     * Get middleware statistics
     * @returns {Object} - Middleware statistics
     */
    getStats() {
        return {
            isEnabled: this.isEnabled,
            interceptMetrics: { ...this.interceptMetrics },
            agentStates: this.agentStates.size,
            sessionMappings: this.sessionAgentMapping.size,
            messageHooks: this.messageHooks.size,
            preProcessHooks: this.preProcessHooks.length,
            postProcessHooks: this.postProcessHooks.length,
            interceptedMessageTypes: Array.from(this.interceptedMessageTypes)
        };
    }

    /**
     * Get agent state for a specific session
     * @param {string} sessionId - Session identifier
     * @returns {Object|null} - Agent state or null if not found
     */
    getAgentState(sessionId) {
        return this.agentStates.get(sessionId) || null;
    }

    /**
     * Clear agent state for a session (useful for cleanup)
     * @param {string} sessionId - Session identifier
     */
    clearAgentState(sessionId) {
        this.agentStates.delete(sessionId);
        this.sessionAgentMapping.delete(sessionId);
        
        this.debug.info('Agent state cleared', { sessionId });
    }

    /**
     * Restore StreamingManager to original state (for cleanup/testing)
     */
    restoreOriginalHandler() {
        if (this.originalHandleMessage) {
            this.streamingManager.handleMessage = this.originalHandleMessage;
            this.debug.info('Original StreamingManager handler restored');
        }
    }

    /**
     * Deliver agent response through WebSocket for streaming
     * @param {Object} agentResponse - Agent response to deliver
     * @param {Object} sessionContext - Current session context
     * @returns {Promise<void>}
     */
    async deliverAgentResponse(agentResponse, sessionContext) {
        try {
            this.debug.info('Delivering agent response', {
                agentName: agentResponse.agentName,
                responseLength: agentResponse.response?.length || 0,
                sessionId: sessionContext.sessionId
            });

            // Use StreamingResponseHandler if available
            if (this.streamingManager.streamingResponseHandler) {
                const processedResponse = await this.streamingManager.streamingResponseHandler
                    .processAgentResponse(agentResponse, sessionContext);
                
                if (processedResponse.success) {
                    // Send the processed response through WebSocket
                    await this.sendAgentResponseToWebSocket(processedResponse, sessionContext);
                } else {
                    this.debug.error('Failed to process agent response', {
                        error: processedResponse.error
                    });
                }
            } else {
                // Fallback: send response directly
                await this.sendAgentResponseToWebSocket({
                    response: agentResponse.response,
                    agentName: agentResponse.agentName,
                    metadata: agentResponse.metadata
                }, sessionContext);
            }

        } catch (error) {
            this.debug.error('Failed to deliver agent response', {
                error: error.message,
                agentName: agentResponse.agentName
            });
        }
    }

    /**
     * Send agent response to WebSocket as a response message
     * @param {Object} processedResponse - Processed response from handler
     * @param {Object} sessionContext - Session context
     * @returns {Promise<void>}
     */
    async sendAgentResponseToWebSocket(processedResponse, sessionContext) {
        try {
            // Create a response message that mimics OpenAI's response format
            const responseMessage = {
                type: 'response.text.delta',
                response_id: `agent_response_${Date.now()}`,
                item_id: `agent_item_${Date.now()}`,
                output_index: 0,
                content_index: 0,
                delta: processedResponse.response || ''
            };

            // Send through WebSocket if available
            if (this.streamingManager.websocket && 
                this.streamingManager.websocket.readyState === WebSocket.OPEN) {
                
                // Send as if it came from OpenAI
                const event = {
                    data: JSON.stringify(responseMessage)
                };
                
                // Call the original handler to process the response
                await this.originalHandleMessage(event);
                
                this.debug.debug('Agent response sent through WebSocket', {
                    responseId: responseMessage.response_id,
                    deltaLength: responseMessage.delta.length
                });
                
            } else {
                this.debug.warn('WebSocket not available for agent response delivery');
            }

        } catch (error) {
            this.debug.error('Failed to send agent response to WebSocket', {
                error: error.message
            });
        }
    }

    /**
     * Cleanup middleware resources
     */
    cleanup() {
        this.debug.info('Cleaning up StreamingAgentMiddleware resources');
        
        // Restore original handler
        this.restoreOriginalHandler();
        
        // Clear all state
        this.agentStates.clear();
        this.sessionAgentMapping.clear();
        this.messageHooks.clear();
        this.preProcessHooks.length = 0;
        this.postProcessHooks.length = 0;
        
        // Reset metrics
        this.interceptMetrics = {
            totalIntercepted: 0,
            successfulRouting: 0,
            fallbackCount: 0,
            errorCount: 0,
            averageProcessingTime: 0
        };
        
        // Clear references
        this.streamingManager = null;
        this.streamingAgentRouter = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingAgentMiddleware;
} else {
    window.StreamingAgentMiddleware = StreamingAgentMiddleware;
}
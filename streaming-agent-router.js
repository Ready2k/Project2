/**
 * StreamingAgentRouter - Bridge between streaming WebSocket messages and existing agent routing logic
 * Integrates agent routing capabilities with OpenAI Realtime API streaming mode
 */
class StreamingAgentRouter {
    constructor(agentRouter, streamingManager) {
        if (!agentRouter) {
            throw new Error('AgentRouter instance is required');
        }
        if (!streamingManager) {
            throw new Error('StreamingManager instance is required');
        }

        this.agentRouter = agentRouter;
        this.streamingManager = streamingManager;
        
        // Initialize debug logger
        this.debug = window.debugManager ? 
            window.debugManager.createModuleLogger('StreamingAgentRouter') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

        // Streaming session state
        this.currentAgent = null;
        this.sessionContext = {
            sessionId: null,
            conversationContext: {},
            agentHistory: [],
            routingMetrics: {
                routingLatency: 0,
                agentSwitches: 0,
                fallbackCount: 0
            }
        };

        // Performance tracking
        this.routingTimeouts = new Map();
        this.routingLatencyThreshold = 100; // 100ms threshold as per requirements
        this.maxRoutingTimeout = 200; // 200ms max additional delay as per requirements

        // Error handling - will be managed by StreamingErrorHandler
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 3;
        this.circuitBreakerOpen = false;
        this.circuitBreakerResetTime = null;
        this.errorHandler = null;
        
        // Session management
        this.sessionManager = null;

        // Performance optimization
        this.performanceOptimizer = null;
        this.optimizationEnabled = true;

        this.debug.info('StreamingAgentRouter initialized', {
            hasAgentRouter: !!this.agentRouter,
            hasStreamingManager: !!this.streamingManager,
            routingLatencyThreshold: this.routingLatencyThreshold,
            maxRoutingTimeout: this.maxRoutingTimeout,
            optimizationEnabled: this.optimizationEnabled
        });
    }

    /**
     * Set error handler for comprehensive error handling
     * @param {StreamingErrorHandler} errorHandler - Error handler instance
     */
    setErrorHandler(errorHandler) {
        this.errorHandler = errorHandler;
        this.debug.info('Error handler set for StreamingAgentRouter');
    }

    /**
     * Set performance optimizer for routing optimization
     * @param {StreamingPerformanceOptimizer} optimizer - Performance optimizer instance
     */
    setPerformanceOptimizer(optimizer) {
        this.performanceOptimizer = optimizer;
        this.debug.info('Performance optimizer set for StreamingAgentRouter');
    }

    /**
     * Set session manager for WebSocket session management
     * @param {StreamingSessionManager} sessionManager - Session manager instance
     */
    setSessionManager(sessionManager) {
        this.sessionManager = sessionManager;
        this.debug.info('Session manager set for StreamingAgentRouter');
    }

    /**
     * Enable or disable performance optimization
     * @param {boolean} enabled - Whether optimization should be enabled
     */
    setOptimizationEnabled(enabled) {
        this.optimizationEnabled = enabled;
        this.debug.info('Performance optimization ' + (enabled ? 'enabled' : 'disabled'));
    }

    /**
     * Route transcribed message through agent system
     * @param {string} transcript - Transcribed user message
     * @param {Object} sessionContext - Current streaming session context
     * @returns {Promise<Object>} - Routing result with agent response
     */
    async routeStreamingMessage(transcript, sessionContext = {}) {
        // Use performance optimizer if available and enabled
        if (this.performanceOptimizer && this.optimizationEnabled) {
            try {
                return await this.performanceOptimizer.optimizeRoutingMessage(transcript, sessionContext);
            } catch (error) {
                this.debug.warn('Performance optimization failed, falling back to standard routing', {
                    error: error.message
                });
                // Fall through to standard routing
            }
        }

        // Standard routing implementation
        return await this.routeStreamingMessageStandard(transcript, sessionContext);
    }

    /**
     * Standard routing implementation (without optimization)
     * @param {string} transcript - Transcribed user message
     * @param {Object} sessionContext - Current streaming session context
     * @returns {Promise<Object>} - Routing result with agent response
     */
    async routeStreamingMessageStandard(transcript, sessionContext = {}) {
        const startTime = Date.now();
        
        try {
            this.debug.info('Routing streaming message (standard)', {
                transcriptPreview: transcript.substring(0, 100),
                currentAgent: this.currentAgent?.name,
                sessionId: sessionContext.sessionId
            });

            // Check circuit breaker via error handler if available
            if (this.errorHandler && !this.errorHandler.isOperationAllowed()) {
                this.debug.warn('Circuit breaker open, falling back to standard streaming');
                this.sessionContext.routingMetrics.fallbackCount++;
                return this.createFallbackResponse('Circuit breaker open');
            }

            // Create timeout promise for routing
            const routingPromise = this.performAgentRouting(transcript, sessionContext);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Routing timeout')), this.maxRoutingTimeout);
            });

            // Race between routing and timeout
            const routingResult = await Promise.race([routingPromise, timeoutPromise]);
            
            const routingLatency = Date.now() - startTime;
            this.sessionContext.routingMetrics.routingLatency = routingLatency;

            // Log performance metrics
            this.debug.info('Routing completed (standard)', {
                latency: routingLatency,
                success: routingResult.success,
                selectedAgent: routingResult.selectedAgent?.name,
                withinThreshold: routingLatency <= this.routingLatencyThreshold
            });

            // Reset error counter on success
            if (routingResult.success) {
                this.consecutiveErrors = 0;
            }

            return routingResult;

        } catch (error) {
            const routingLatency = Date.now() - startTime;
            
            this.debug.error('Routing failed', {
                error: error.message,
                latency: routingLatency,
                transcript: transcript.substring(0, 50)
            });

            // Handle routing errors via error handler if available
            if (this.errorHandler) {
                const errorResult = await this.errorHandler.fallbackStrategies.ROUTING_TIMEOUT(error, {
                    transcript,
                    sessionContext,
                    agentName: this.currentAgent?.name,
                    attemptNumber: 1
                });
                
                return {
                    success: false,
                    fallbackReason: errorResult.fallbackReason || 'routing_error',
                    error: error.message,
                    errorHandled: true
                };
            }

            // Fallback to original error handling
            return this.handleRoutingError(error, transcript, sessionContext);
        }
    }

    /**
     * Perform the actual agent routing logic
     * @param {string} transcript - User transcript
     * @param {Object} sessionContext - Session context
     * @returns {Promise<Object>} - Routing result
     */
    async performAgentRouting(transcript, sessionContext) {
        try {
            // Prepare context for agent routing
            const routingContext = {
                ...sessionContext,
                streamingMode: true,
                currentAgent: this.currentAgent?.name,
                sessionId: this.sessionContext.sessionId,
                apiClient: this.streamingManager.apiClient || window.apiClient,
                // Add required dependencies for agents
                personaManager: window.personaManager || (window.speechApp && window.speechApp.personaManager),
                conversationContextManager: window.conversationContextManager || (window.speechApp && window.speechApp.conversationContextManager),
                systemPromptsManager: window.systemPromptsManager || (window.speechApp && window.speechApp.systemPromptsManager),
                debugManager: window.debugManager,
                systemLogger: window.systemLogger
            };

            // Route through existing agent system
            const agentResponse = await this.agentRouter.route(transcript, routingContext);

            if (agentResponse.success) {
                // Determine if agent changed
                const selectedAgentName = agentResponse.agentName;
                const agentChanged = this.currentAgent?.name !== selectedAgentName;

                if (agentChanged) {
                    this.debug.info('Agent switch detected', {
                        previousAgent: this.currentAgent?.name,
                        newAgent: selectedAgentName
                    });
                    
                    // Update current agent
                    const newAgent = this.agentRouter.getRegisteredAgents()
                        .find(a => a.name === selectedAgentName);
                    
                    if (newAgent) {
                        this.currentAgent = newAgent;
                        this.sessionContext.routingMetrics.agentSwitches++;
                        
                        // Record agent switch in history
                        this.sessionContext.agentHistory.push({
                            agentName: selectedAgentName,
                            timestamp: Date.now(),
                            switchReason: 'routing_decision'
                        });
                    }
                }

                // Generate streaming-compatible response
                const streamingResponse = await this.generateStreamingResponse(
                    agentResponse, 
                    transcript, 
                    routingContext
                );

                return {
                    success: true,
                    selectedAgent: this.currentAgent,
                    agentResponse: streamingResponse,
                    agentChanged,
                    sessionUpdateRequired: agentChanged,
                    routingReason: 'agent_routing_success'
                };
            } else {
                // Agent routing failed, use fallback
                this.debug.warn('Agent routing returned failure', {
                    error: agentResponse.error || 'Unknown error'
                });
                
                return this.createFallbackResponse('Agent routing failed');
            }

        } catch (error) {
            this.debug.error('Agent routing threw exception', {
                error: error.message,
                stack: error.stack
            });
            
            throw error;
        }
    }

    /**
     * Generate streaming-compatible response from agent response
     * @param {Object} agentResponse - Response from agent
     * @param {string} originalTranscript - Original user transcript
     * @param {Object} context - Routing context
     * @returns {Promise<Object>} - Streaming response object
     */
    async generateStreamingResponse(agentResponse, originalTranscript, context) {
        try {
            // Extract response text
            const responseText = agentResponse.response || '';
            
            // Generate session instructions for the agent
            const sessionInstructions = await this.generateSessionInstructions(
                this.currentAgent, 
                responseText,
                context
            );

            return {
                success: true,
                response: responseText,
                agentName: this.currentAgent?.name,
                streamingInstructions: sessionInstructions,
                voiceConfig: this.getAgentVoiceConfig(this.currentAgent),
                metadata: {
                    processingTime: agentResponse.processingTime || 0,
                    tokensUsed: agentResponse.tokensUsed || 0,
                    requiresSessionUpdate: true,
                    chunkingStrategy: 'sentence_based',
                    originalTranscript: originalTranscript
                }
            };

        } catch (error) {
            this.debug.error('Failed to generate streaming response', {
                error: error.message,
                agentName: this.currentAgent?.name
            });

            // Return basic response on error
            return {
                success: false,
                response: agentResponse.response || '',
                agentName: this.currentAgent?.name,
                error: error.message
            };
        }
    }

    /**
     * Generate session instructions for the current agent
     * @param {Object} agent - Current agent instance
     * @param {string} responseText - Agent's response text
     * @param {Object} context - Current context
     * @returns {Promise<string>} - Session instructions for OpenAI
     */
    async generateSessionInstructions(agent, responseText, context) {
        try {
            if (!agent) {
                return this.getDefaultSessionInstructions();
            }

            // Get agent-specific instructions
            const agentInstructions = this.getAgentSpecificInstructions(agent);
            
            // Get current persona information
            const personaInfo = this.getCurrentPersonaInfo();
            
            // Build context information
            let contextInfo = '';
            
            // Add preserved context information if this is an agent switch
            if (context.preservedContext) {
                const preserved = context.preservedContext;
                contextInfo += `\nContext Preserved from Previous Agent (${preserved.preservedFrom}):`;
                
                if (preserved.conversationHistory && preserved.conversationHistory.length > 0) {
                    contextInfo += `\n- Recent conversation history available`;
                }
                
                if (preserved.userPreferences && Object.keys(preserved.userPreferences).length > 0) {
                    contextInfo += `\n- User preferences: ${JSON.stringify(preserved.userPreferences)}`;
                }
                
                if (preserved.sessionData && Object.keys(preserved.sessionData).length > 0) {
                    contextInfo += `\n- Session data preserved`;
                }
                
                if (preserved.agentSpecificData && Object.keys(preserved.agentSpecificData).length > 0) {
                    contextInfo += `\n- Previous agent context available`;
                }
                
                if (context.switchReason) {
                    contextInfo += `\n- Agent switch reason: ${context.switchReason}`;
                }
            }
            
            // Add current conversation context
            if (this.sessionContext.conversationContext && 
                Object.keys(this.sessionContext.conversationContext).length > 0) {
                contextInfo += `\nCurrent Session Context: Available`;
            }
            
            // Add agent history if available
            if (this.sessionContext.agentHistory.length > 0) {
                const recentSwitches = this.sessionContext.agentHistory.slice(-3);
                contextInfo += `\nRecent Agent Activity:`;
                recentSwitches.forEach(switch_ => {
                    if (switch_.success !== false) {
                        contextInfo += `\n- ${switch_.agentName} (${switch_.switchReason})`;
                    }
                });
            }
            
            // Combine instructions
            let combinedInstructions = `${personaInfo.instructions || ''}

${agentInstructions}

Current Context: You are now operating as ${agent.name}. ${agent.description || ''}`;

            if (contextInfo) {
                combinedInstructions += `\n${contextInfo}`;
            }

            if (responseText) {
                combinedInstructions += `\n\nRecent Response: "${responseText}"`;
            }

            combinedInstructions += `\n\nPlease continue the conversation maintaining this agent's expertise and personality. Use any preserved context to provide continuity in the conversation.`;

            this.debug.debug('Generated session instructions', {
                agentName: agent.name,
                instructionsLength: combinedInstructions.length,
                hasPersona: !!personaInfo.name,
                hasPreservedContext: !!context.preservedContext,
                isAgentSwitch: !!context.switchReason,
                contextInfoLength: contextInfo.length
            });

            return combinedInstructions;

        } catch (error) {
            this.debug.error('Failed to generate session instructions', {
                error: error.message,
                agentName: agent?.name,
                hasContext: !!context,
                hasPreservedContext: !!context.preservedContext
            });
            
            return this.getDefaultSessionInstructions();
        }
    }

    /**
     * Get agent-specific instructions for session updates
     * @param {Object} agent - Agent instance
     * @returns {string} - Agent-specific instructions
     */
    getAgentSpecificInstructions(agent) {
        const agentInstructions = {
            'FraudAgent': `You are a fraud prevention specialist. Focus on:
- Card security and blocking suspicious transactions
- Identity verification for security purposes
- Fraud detection and prevention
- Helping users secure their accounts
- Be security-conscious and thorough in verification`,

            'PaymentsAgent': `You are a payments specialist. Focus on:
- Money transfers and payments
- Standing orders and direct debits
- Payment confirmations and cancellations
- Transaction processing
- Be precise with amounts and recipient details`,

            'IDVAgent': `You are an identity verification specialist. Focus on:
- Account security and authentication
- Password resets and security questions
- Two-factor authentication setup
- Identity verification processes
- Be thorough but user-friendly with security procedures`,

            'BankingInfoAgent': `You are a banking information specialist. Focus on:
- Account balances and statements
- Transaction history and details
- Account information and sort codes
- General banking inquiries
- Provide accurate and helpful account information`,

            'MultiAgentOrchestrator': `You are coordinating multiple banking services. Focus on:
- Complex requests requiring multiple agents
- Workflow coordination
- Comprehensive banking assistance
- Seamless service integration`
        };

        return agentInstructions[agent.name] || `You are ${agent.name}. ${agent.description || 'Provide helpful banking assistance.'}`;
    }

    /**
     * Get default session instructions when no agent is active
     * @returns {string} - Default instructions
     */
    getDefaultSessionInstructions() {
        const personaInfo = this.getCurrentPersonaInfo();
        return personaInfo.instructions || 'You are a helpful banking assistant. Provide friendly and professional assistance with banking inquiries.';
    }

    /**
     * Get current persona information from the main application
     * @returns {Object} - Current persona info
     */
    getCurrentPersonaInfo() {
        try {
            // Try to get persona from global state
            if (window.currentPersona) {
                return window.currentPersona;
            }
            
            // Try to get from persona manager
            if (window.personaManager && typeof window.personaManager.getCurrentPersona === 'function') {
                return window.personaManager.getCurrentPersona();
            }
            
            // Fallback to default
            return {
                name: 'Default Assistant',
                instructions: 'You are a helpful banking assistant.'
            };

        } catch (error) {
            this.debug.warn('Failed to get current persona info', { error: error.message });
            return {
                name: 'Default Assistant',
                instructions: 'You are a helpful banking assistant.'
            };
        }
    }

    /**
     * Get voice configuration for the current agent
     * @param {Object} agent - Agent instance
     * @returns {Object} - Voice configuration
     */
    getAgentVoiceConfig(agent) {
        // Default voice configuration
        const defaultVoice = {
            voice: 'shimmer',
            speed: 1.0,
            pitch: 1.0
        };

        if (!agent) {
            return defaultVoice;
        }

        // Agent-specific voice configurations
        const agentVoices = {
            'FraudAgent': { voice: 'alloy', speed: 0.9, pitch: 1.0 }, // More serious tone
            'PaymentsAgent': { voice: 'echo', speed: 1.0, pitch: 1.0 }, // Clear and precise
            'IDVAgent': { voice: 'fable', speed: 0.95, pitch: 1.0 }, // Trustworthy tone
            'BankingInfoAgent': { voice: 'shimmer', speed: 1.0, pitch: 1.0 }, // Friendly default
            'MultiAgentOrchestrator': { voice: 'nova', speed: 1.0, pitch: 1.0 } // Professional
        };

        return agentVoices[agent.name] || defaultVoice;
    }

    /**
     * Handle agent switching during streaming session
     * @param {Object} newAgent - New agent to switch to
     * @param {Object} currentContext - Current conversation context
     * @param {string} switchReason - Reason for the agent switch
     * @returns {Promise<Object>} - Switch result
     */
    async switchAgent(newAgent, currentContext = {}, switchReason = 'manual_switch') {
        const startTime = Date.now();
        
        try {
            this.debug.info('Initiating agent switch', {
                currentAgent: this.currentAgent?.name,
                newAgent: newAgent?.name,
                switchReason,
                sessionId: this.sessionContext.sessionId
            });

            // Validate the new agent
            const validationResult = this.validateAgentSwitch(newAgent, currentContext);
            if (!validationResult.valid) {
                this.debug.warn('Agent switch validation failed', {
                    reason: validationResult.reason,
                    newAgent: newAgent?.name
                });
                
                return {
                    success: false,
                    error: validationResult.reason,
                    currentAgent: this.currentAgent?.name,
                    switchLatency: Date.now() - startTime
                };
            }

            // Preserve current conversation context
            const preservedContext = await this.preserveAgentContext(this.currentAgent, currentContext);
            
            // Store previous agent for rollback if needed
            const previousAgent = this.currentAgent;
            const previousContext = { ...this.sessionContext.conversationContext };

            try {
                // Update current agent
                this.currentAgent = newAgent;
                
                // Update session context with preserved context
                this.sessionContext.conversationContext = {
                    ...this.sessionContext.conversationContext,
                    ...preservedContext,
                    agentSwitchContext: {
                        previousAgent: previousAgent?.name,
                        switchTime: Date.now(),
                        switchReason,
                        preservedData: preservedContext
                    }
                };

                // Update session instructions via WebSocket
                const sessionUpdateResult = await this.updateSessionForAgent(newAgent, {
                    ...currentContext,
                    preservedContext,
                    switchReason
                });

                if (!sessionUpdateResult.success) {
                    // Rollback on session update failure
                    this.debug.warn('Session update failed during agent switch, rolling back', {
                        error: sessionUpdateResult.error,
                        newAgent: newAgent.name
                    });
                    
                    this.currentAgent = previousAgent;
                    this.sessionContext.conversationContext = previousContext;
                    
                    return {
                        success: false,
                        error: `Session update failed: ${sessionUpdateResult.error}`,
                        rolledBack: true,
                        currentAgent: this.currentAgent?.name,
                        switchLatency: Date.now() - startTime
                    };
                }

                // Record successful agent switch
                this.recordAgentSwitch(newAgent, switchReason, startTime);

                // Update routing metrics
                this.sessionContext.routingMetrics.agentSwitches++;

                const switchLatency = Date.now() - startTime;
                
                this.debug.info('Agent switch completed successfully', {
                    previousAgent: previousAgent?.name,
                    newAgent: newAgent.name,
                    switchReason,
                    switchLatency,
                    totalSwitches: this.sessionContext.routingMetrics.agentSwitches
                });

                return {
                    success: true,
                    previousAgent: previousAgent?.name,
                    newAgent: newAgent.name,
                    switchReason,
                    switchLatency,
                    preservedContext,
                    sessionUpdateResult,
                    voiceConfig: this.getAgentVoiceConfig(newAgent)
                };

            } catch (sessionError) {
                // Rollback on any error during switch
                this.debug.error('Error during agent switch, rolling back', {
                    error: sessionError.message,
                    newAgent: newAgent.name
                });
                
                this.currentAgent = previousAgent;
                this.sessionContext.conversationContext = previousContext;
                
                throw sessionError;
            }

        } catch (error) {
            const switchLatency = Date.now() - startTime;
            
            this.debug.error('Agent switch failed', {
                error: error.message,
                currentAgent: this.currentAgent?.name,
                targetAgent: newAgent?.name,
                switchReason,
                switchLatency
            });

            // Record failed switch attempt
            this.recordFailedAgentSwitch(newAgent, switchReason, error.message, startTime);

            return {
                success: false,
                error: error.message,
                currentAgent: this.currentAgent?.name,
                targetAgent: newAgent?.name,
                switchReason,
                switchLatency
            };
        }
    }

    /**
     * Validate if an agent switch is allowed and safe
     * @param {Object} newAgent - Agent to switch to
     * @param {Object} currentContext - Current context
     * @returns {Object} - Validation result
     */
    validateAgentSwitch(newAgent, currentContext) {
        // Check if new agent exists and is valid
        if (!newAgent) {
            return { valid: false, reason: 'New agent is null or undefined' };
        }

        if (!newAgent.name) {
            return { valid: false, reason: 'New agent missing name property' };
        }

        if (typeof newAgent.processMessage !== 'function') {
            return { valid: false, reason: 'New agent missing processMessage method' };
        }

        // Check if switching to the same agent
        if (this.currentAgent && this.currentAgent.name === newAgent.name) {
            return { valid: false, reason: 'Already using the requested agent' };
        }

        // Check if agent is in the registered agents list
        const registeredAgents = this.agentRouter.getRegisteredAgents();
        const isRegistered = registeredAgents.some(agent => agent.name === newAgent.name);
        
        if (!isRegistered) {
            return { valid: false, reason: 'Agent is not registered in the agent router' };
        }

        // Check WebSocket connection for session updates
        if (!this.streamingManager.websocket || 
            this.streamingManager.websocket.readyState !== WebSocket.OPEN) {
            return { valid: false, reason: 'WebSocket connection not available for session updates' };
        }

        // Check if we're in a valid state for switching
        if (this.circuitBreakerOpen) {
            return { valid: false, reason: 'Circuit breaker is open, agent switching disabled' };
        }

        // All validations passed
        return { valid: true };
    }

    /**
     * Preserve context from current agent before switching
     * @param {Object} currentAgent - Current agent instance
     * @param {Object} currentContext - Current conversation context
     * @returns {Promise<Object>} - Preserved context data
     */
    async preserveAgentContext(currentAgent, currentContext) {
        try {
            const preservedContext = {
                timestamp: Date.now(),
                preservedFrom: currentAgent?.name || 'no_agent',
                conversationHistory: currentContext.conversationHistory || [],
                userPreferences: currentContext.userPreferences || {},
                sessionData: currentContext.sessionData || {},
                agentSpecificData: {}
            };

            // If there's a current agent, try to preserve its specific context
            if (currentAgent && typeof currentAgent.preserveContext === 'function') {
                try {
                    const agentContext = await currentAgent.preserveContext(currentContext);
                    preservedContext.agentSpecificData[currentAgent.name] = agentContext;
                    
                    this.debug.debug('Preserved agent-specific context', {
                        agentName: currentAgent.name,
                        contextKeys: Object.keys(agentContext)
                    });
                } catch (agentError) {
                    this.debug.warn('Failed to preserve agent-specific context', {
                        agentName: currentAgent.name,
                        error: agentError.message
                    });
                }
            }

            // Preserve conversation context manager state
            if (window.conversationContextManager && 
                typeof window.conversationContextManager.getStreamingContext === 'function') {
                try {
                    const streamingContext = await window.conversationContextManager.getStreamingContext();
                    preservedContext.streamingContext = streamingContext;
                    
                    this.debug.debug('Preserved streaming context from ConversationContextManager');
                } catch (contextError) {
                    this.debug.warn('Failed to preserve streaming context', {
                        error: contextError.message
                    });
                }
            }

            this.debug.info('Context preservation completed', {
                preservedFrom: currentAgent?.name,
                contextSize: JSON.stringify(preservedContext).length,
                hasAgentSpecificData: Object.keys(preservedContext.agentSpecificData).length > 0,
                hasStreamingContext: !!preservedContext.streamingContext
            });

            return preservedContext;

        } catch (error) {
            this.debug.error('Failed to preserve agent context', {
                error: error.message,
                currentAgent: currentAgent?.name
            });

            // Return minimal preserved context on error
            return {
                timestamp: Date.now(),
                preservedFrom: currentAgent?.name || 'no_agent',
                conversationHistory: currentContext.conversationHistory || [],
                error: error.message
            };
        }
    }

    /**
     * Record successful agent switch in history and metrics
     * @param {Object} newAgent - The new agent
     * @param {string} switchReason - Reason for switch
     * @param {number} startTime - Switch start timestamp
     */
    recordAgentSwitch(newAgent, switchReason, startTime) {
        const switchRecord = {
            agentName: newAgent.name,
            timestamp: Date.now(),
            switchReason,
            switchLatency: Date.now() - startTime,
            success: true
        };

        // Add to agent history
        this.sessionContext.agentHistory.push(switchRecord);

        // Limit history size to prevent memory issues
        if (this.sessionContext.agentHistory.length > 50) {
            this.sessionContext.agentHistory = this.sessionContext.agentHistory.slice(-25);
        }

        this.debug.info('Agent switch recorded in history', {
            agentName: newAgent.name,
            switchReason,
            switchLatency: switchRecord.switchLatency,
            totalSwitchesInSession: this.sessionContext.agentHistory.length
        });
    }

    /**
     * Record failed agent switch attempt
     * @param {Object} targetAgent - The agent we tried to switch to
     * @param {string} switchReason - Reason for switch attempt
     * @param {string} errorMessage - Error that occurred
     * @param {number} startTime - Switch start timestamp
     */
    recordFailedAgentSwitch(targetAgent, switchReason, errorMessage, startTime) {
        const failedSwitchRecord = {
            targetAgentName: targetAgent?.name || 'unknown',
            timestamp: Date.now(),
            switchReason,
            switchLatency: Date.now() - startTime,
            success: false,
            error: errorMessage
        };

        // Add to agent history for debugging
        this.sessionContext.agentHistory.push(failedSwitchRecord);

        // Limit history size
        if (this.sessionContext.agentHistory.length > 50) {
            this.sessionContext.agentHistory = this.sessionContext.agentHistory.slice(-25);
        }

        this.debug.warn('Failed agent switch recorded', {
            targetAgent: targetAgent?.name,
            switchReason,
            error: errorMessage,
            switchLatency: failedSwitchRecord.switchLatency
        });
    }

    /**
     * Update OpenAI session with agent-specific instructions
     * @param {Object} agent - Agent to update session for
     * @param {Object} context - Current context
     * @returns {Promise<Object>} - Update result
     */
    async updateSessionForAgent(agent, context = {}) {
        const maxRetries = 3;
        const baseDelay = 100; // Base delay in ms for exponential backoff
        
        try {
            this.debug.info('Updating session for agent', {
                agentName: agent?.name,
                sessionId: this.sessionContext.sessionId,
                isAgentSwitch: !!context.switchReason
            });

            if (!agent) {
                this.debug.warn('No agent provided for session update');
                return { success: false, error: 'No agent provided' };
            }

            // Generate session instructions with preserved context
            const instructions = await this.generateSessionInstructions(agent, '', context);
            
            // Get voice configuration
            const voiceConfig = this.getAgentVoiceConfig(agent);

            // Create session update message
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    instructions: instructions,
                    voice: voiceConfig.voice,
                    modalities: ['text', 'audio'],
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

            // Attempt session update with retry logic
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // Check WebSocket connection
                    if (!this.streamingManager.websocket || 
                        this.streamingManager.websocket.readyState !== WebSocket.OPEN) {
                        throw new Error('WebSocket not connected');
                    }

                    // Send session update
                    this.streamingManager.sendMessage(sessionUpdate);
                    
                    // Wait for a brief moment to allow the update to be processed
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    this.debug.info('Session update sent successfully', {
                        agentName: agent.name,
                        voice: voiceConfig.voice,
                        instructionsLength: instructions.length,
                        attempt,
                        isAgentSwitch: !!context.switchReason
                    });

                    return {
                        success: true,
                        agentName: agent.name,
                        voiceConfig: voiceConfig,
                        instructions: instructions,
                        attempt,
                        isAgentSwitch: !!context.switchReason,
                        preservedContext: context.preservedContext
                    };

                } catch (attemptError) {
                    this.debug.warn('Session update attempt failed', {
                        attempt,
                        maxRetries,
                        error: attemptError.message,
                        agentName: agent.name
                    });

                    // If this was the last attempt, throw the error
                    if (attempt === maxRetries) {
                        throw attemptError;
                    }

                    // Wait with exponential backoff before retry
                    const delay = baseDelay * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

        } catch (error) {
            this.debug.error('Failed to update session for agent after all retries', {
                error: error.message,
                agentName: agent?.name,
                maxRetries,
                isAgentSwitch: !!context.switchReason
            });

            return { 
                success: false, 
                error: error.message,
                agentName: agent?.name,
                maxRetries,
                isAgentSwitch: !!context.switchReason
            };
        }
    }

    /**
     * Handle routing errors with fallback mechanisms
     * @param {Error} error - The routing error
     * @param {string} transcript - Original transcript
     * @param {Object} sessionContext - Session context
     * @returns {Object} - Fallback response
     */
    handleRoutingError(error, transcript, sessionContext) {
        this.consecutiveErrors++;
        this.sessionContext.routingMetrics.fallbackCount++;

        this.debug.error('Handling routing error', {
            error: error.message,
            consecutiveErrors: this.consecutiveErrors,
            transcript: transcript.substring(0, 50)
        });

        // Open circuit breaker if too many consecutive errors
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            this.circuitBreakerOpen = true;
            this.circuitBreakerResetTime = Date.now() + (30 * 1000); // 30 seconds
            
            this.debug.warn('Circuit breaker opened due to consecutive errors', {
                consecutiveErrors: this.consecutiveErrors,
                resetTime: new Date(this.circuitBreakerResetTime).toISOString()
            });
        }

        // Determine fallback strategy based on error type
        let fallbackReason = 'unknown_error';
        if (error.message.includes('timeout')) {
            fallbackReason = 'routing_timeout';
        } else if (error.message.includes('network')) {
            fallbackReason = 'network_error';
        } else if (error.message.includes('agent')) {
            fallbackReason = 'agent_error';
        }

        return this.createFallbackResponse(fallbackReason);
    }

    /**
     * Create fallback response for error scenarios
     * @param {string} reason - Reason for fallback
     * @returns {Object} - Fallback response object
     */
    createFallbackResponse(reason) {
        return {
            success: false,
            selectedAgent: null,
            agentResponse: null,
            agentChanged: false,
            sessionUpdateRequired: false,
            fallbackStrategy: 'continue_standard_streaming',
            fallbackReason: reason,
            routingReason: 'fallback_due_to_error'
        };
    }

    /**
     * Get current session context
     * @returns {Object} - Current session context
     */
    getSessionContext() {
        return {
            ...this.sessionContext,
            currentAgent: this.currentAgent?.name,
            timestamp: Date.now()
        };
    }

    /**
     * Manually switch to a specific agent by name
     * @param {string} agentName - Name of the agent to switch to
     * @param {string} switchReason - Reason for the manual switch
     * @returns {Promise<Object>} - Switch result
     */
    async switchToAgent(agentName, switchReason = 'manual_request') {
        try {
            this.debug.info('Manual agent switch requested', {
                targetAgent: agentName,
                currentAgent: this.currentAgent?.name,
                switchReason
            });

            // Find the requested agent
            const registeredAgents = this.agentRouter.getRegisteredAgents();
            const targetAgent = registeredAgents.find(agent => agent.name === agentName);

            if (!targetAgent) {
                this.debug.warn('Requested agent not found', {
                    requestedAgent: agentName,
                    availableAgents: registeredAgents.map(a => a.name)
                });

                return {
                    success: false,
                    error: `Agent '${agentName}' not found`,
                    availableAgents: registeredAgents.map(a => a.name)
                };
            }

            // Perform the agent switch
            const switchResult = await this.switchAgent(
                targetAgent, 
                this.getSessionContext(), 
                switchReason
            );

            this.debug.info('Manual agent switch completed', {
                success: switchResult.success,
                targetAgent: agentName,
                error: switchResult.error
            });

            return switchResult;

        } catch (error) {
            this.debug.error('Manual agent switch failed', {
                error: error.message,
                targetAgent: agentName,
                switchReason
            });

            return {
                success: false,
                error: error.message,
                targetAgent: agentName,
                switchReason
            };
        }
    }

    /**
     * Reset session state (useful for new conversations)
     * @param {string} sessionId - Optional new session ID
     */
    resetSession(sessionId = null) {
        this.debug.info('Resetting streaming agent router session', {
            previousSessionId: this.sessionContext.sessionId,
            newSessionId: sessionId,
            previousAgent: this.currentAgent?.name
        });
        
        this.currentAgent = null;
        this.sessionContext = {
            sessionId: sessionId || `session_${Date.now()}`,
            sessionStartTime: Date.now(),
            conversationContext: {},
            agentHistory: [],
            routingMetrics: {
                routingLatency: 0,
                agentSwitches: 0,
                fallbackCount: 0
            }
        };

        // Reset error tracking
        this.consecutiveErrors = 0;
        this.circuitBreakerOpen = false;
        this.circuitBreakerResetTime = null;

        // Clear any pending timeouts
        this.routingTimeouts.clear();

        this.debug.info('Session reset completed', {
            sessionId: this.sessionContext.sessionId,
            sessionStartTime: new Date(this.sessionContext.sessionStartTime).toISOString()
        });
    }

    /**
     * Get routing statistics
     * @returns {Object} - Routing statistics
     */
    getRoutingStats() {
        return {
            currentAgent: this.currentAgent?.name,
            sessionMetrics: this.sessionContext.routingMetrics,
            errorTracking: {
                consecutiveErrors: this.consecutiveErrors,
                circuitBreakerOpen: this.circuitBreakerOpen,
                circuitBreakerResetTime: this.circuitBreakerResetTime
            },
            agentHistory: this.sessionContext.agentHistory,
            agentSwitching: this.getAgentSwitchingStats(),
            performance: {
                routingLatencyThreshold: this.routingLatencyThreshold,
                maxRoutingTimeout: this.maxRoutingTimeout
            }
        };
    }

    /**
     * Get detailed agent switching statistics
     * @returns {Object} - Agent switching statistics
     */
    getAgentSwitchingStats() {
        const history = this.sessionContext.agentHistory;
        const successfulSwitches = history.filter(h => h.success !== false);
        const failedSwitches = history.filter(h => h.success === false);
        
        // Calculate average switch latency
        const switchLatencies = successfulSwitches
            .filter(h => h.switchLatency)
            .map(h => h.switchLatency);
        
        const avgSwitchLatency = switchLatencies.length > 0 
            ? switchLatencies.reduce((sum, lat) => sum + lat, 0) / switchLatencies.length 
            : 0;

        // Get switch reasons breakdown
        const switchReasons = {};
        successfulSwitches.forEach(h => {
            const reason = h.switchReason || 'unknown';
            switchReasons[reason] = (switchReasons[reason] || 0) + 1;
        });

        // Get agent usage statistics
        const agentUsage = {};
        successfulSwitches.forEach(h => {
            const agentName = h.agentName || 'unknown';
            agentUsage[agentName] = (agentUsage[agentName] || 0) + 1;
        });

        // Calculate success rate
        const totalSwitchAttempts = successfulSwitches.length + failedSwitches.length;
        const successRate = totalSwitchAttempts > 0 
            ? (successfulSwitches.length / totalSwitchAttempts) * 100 
            : 100;

        return {
            totalSwitches: this.sessionContext.routingMetrics.agentSwitches,
            successfulSwitches: successfulSwitches.length,
            failedSwitches: failedSwitches.length,
            successRate: Math.round(successRate * 100) / 100,
            averageSwitchLatency: Math.round(avgSwitchLatency * 100) / 100,
            switchReasons,
            agentUsage,
            recentSwitches: history.slice(-5), // Last 5 switches
            currentSessionDuration: this.sessionContext.sessionId 
                ? Date.now() - (this.sessionContext.sessionStartTime || Date.now())
                : 0
        };
    }

    /**
     * Get agent switching capabilities and status
     * @returns {Object} - Agent switching capabilities
     */
    getAgentSwitchingCapabilities() {
        const registeredAgents = this.agentRouter.getRegisteredAgents();
        const availableAgents = registeredAgents.map(agent => ({
            name: agent.name,
            description: agent.description || '',
            isCurrentAgent: this.currentAgent?.name === agent.name,
            voiceConfig: this.getAgentVoiceConfig(agent),
            canSwitchTo: this.validateAgentSwitch(agent, {}).valid
        }));

        return {
            switchingEnabled: !this.circuitBreakerOpen,
            currentAgent: this.currentAgent?.name,
            availableAgents,
            totalAvailableAgents: availableAgents.length,
            switchableAgents: availableAgents.filter(a => a.canSwitchTo).length,
            webSocketConnected: this.streamingManager.websocket?.readyState === WebSocket.OPEN,
            circuitBreakerStatus: {
                open: this.circuitBreakerOpen,
                resetTime: this.circuitBreakerResetTime,
                consecutiveErrors: this.consecutiveErrors
            }
        };
    }

    /**
     * Enable/disable circuit breaker for testing
     * @param {boolean} enabled - Whether circuit breaker should be enabled
     */
    setCircuitBreakerEnabled(enabled) {
        if (!enabled) {
            this.circuitBreakerOpen = false;
            this.circuitBreakerResetTime = null;
            this.consecutiveErrors = 0;
        }
        
        this.debug.info('Circuit breaker enabled state changed', { enabled });
    }

    /**
     * Cleanup resources and connections
     */
    cleanup() {
        this.debug.info('Cleaning up StreamingAgentRouter resources');
        
        // Clear any pending timeouts
        this.routingTimeouts.clear();
        
        // Reset session state
        this.resetSession();
        
        // Clear references
        this.agentRouter = null;
        this.streamingManager = null;
    }

    /**
     * Update configuration from StreamingAgentConfig
     * @param {Object} config - Configuration object from StreamingAgentConfig
     */
    updateConfiguration(config) {
        try {
            this.debug.log('Updating StreamingAgentRouter configuration', config);

            // Update routing settings
            if (config.routingSettings) {
                this.routingLatencyThreshold = config.routingSettings.routingTimeout || 100;
                this.maxRoutingTimeout = Math.min(config.routingSettings.routingTimeout * 2, 200);
                this.maxConsecutiveErrors = config.routingSettings.maxRetries || 3;
                
                this.debug.log('Updated routing settings', {
                    routingLatencyThreshold: this.routingLatencyThreshold,
                    maxRoutingTimeout: this.maxRoutingTimeout,
                    maxConsecutiveErrors: this.maxConsecutiveErrors
                });
            }

            // Update agent priority configuration if available
            if (config.agentPriority && this.agentRouter && typeof this.agentRouter.updateAgentPriorities === 'function') {
                this.agentRouter.updateAgentPriorities(config.agentPriority);
                this.debug.log('Updated agent priorities', config.agentPriority);
            }

            // Store configuration for future reference
            this.configuration = {
                ...this.configuration,
                ...config
            };

            this.debug.log('StreamingAgentRouter configuration updated successfully');

        } catch (error) {
            this.debug.error('Error updating StreamingAgentRouter configuration:', error);
        }
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfiguration() {
        return {
            routingLatencyThreshold: this.routingLatencyThreshold,
            maxRoutingTimeout: this.maxRoutingTimeout,
            maxConsecutiveErrors: this.maxConsecutiveErrors,
            circuitBreakerOpen: this.circuitBreakerOpen,
            currentAgent: this.currentAgent?.name || null,
            sessionMetrics: this.sessionContext.routingMetrics,
            configuration: this.configuration || {}
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingAgentRouter;
} else {
    window.StreamingAgentRouter = StreamingAgentRouter;
}
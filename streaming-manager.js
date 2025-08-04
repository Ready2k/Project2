/**
 * Streaming Manager
 * Handles OpenAI Realtime API WebSocket connections and real-time audio streaming
 */
class StreamingManager {
    constructor(apiKey, debugCallback = null, tokenTracker = null) {
        this.apiKey = apiKey;
        this.debugCallback = debugCallback;
        this.tokenTracker = tokenTracker;
        
        // Initialize debug logger for this module
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('StreamingManager') : {
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        };

        // Initialize resource management systems
        this.resourceManager = new (window.AudioResourceManager || class { 
            registerResource() { return null; }
            disposeAllResources() { return { total: 0, disposed: 0, errors: [] }; }
            verifyCleanup() { return { isClean: true, activeResources: [] }; }
            getResourcesByType() { return []; }
            disposeResource() { return true; }
            getStats() { return { created: 0, disposed: 0, active: 0 }; }
            cleanupDisposedResources() { return 0; }
            forceDisposeOldResources() { return 0; }
        })();
        
        this.timeoutManager = new (window.TimeoutManager || class { 
            createTimeout(op, timeout) { return op(); }
            cancelAllTimeouts() { return 0; }
            getActiveTimeoutCount() { return 0; }
            getStats() { return { created: 0, completed: 0, timedOut: 0, cancelled: 0, active: 0 }; }
            cleanupCompletedTimeouts() { return 0; }
        })();
        
        this.connectionManager = new (window.ConnectionManager || class { 
            connectWithRetry(fn) { return fn(); }
            disconnectAll() { return 0; }
            disconnect() { return true; }
            setReconnectionCallbacks() { return; }
            getAllConnectionStatuses() { return []; }
            getStats() { return { totalAttempts: 0, successfulConnections: 0, failedConnections: 0, reconnections: 0, activeConnections: 0 }; }
            cleanupCompletedConnections() { return 0; }
        })();

        // Connection state
        this.websocket = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.connectionId = null;

        // Agent routing integration
        this.agentRoutingEnabled = false;
        this.streamingAgentRouter = null;
        this.streamingResponseHandler = null;
        this.currentStreamingAgent = null;
        this.streamingErrorHandler = null;
        this.streamingPerformanceOptimizer = null;
        this.streamingSessionManager = null;

        // Voice configuration for agent-specific voices
        this.voiceConfiguration = {
            currentVoice: 'shimmer', // Default voice
            previousVoice: null,
            agentVoices: new Map([
                ['FraudAgent', { voice: 'alloy', speed: 0.9, pitch: 1.0, temperature: 0.8 }],
                ['PaymentsAgent', { voice: 'echo', speed: 1.0, pitch: 1.0, temperature: 0.7 }],
                ['IDVAgent', { voice: 'coral', speed: 0.95, pitch: 1.0, temperature: 0.8 }],
                ['BankingInfoAgent', { voice: 'shimmer', speed: 1.0, pitch: 1.0, temperature: 0.9 }],
                ['MultiAgentOrchestrator', { voice: 'sage', speed: 1.0, pitch: 1.0, temperature: 0.9 }],
                ['DefaultAgent', { voice: 'shimmer', speed: 1.0, pitch: 1.0, temperature: 0.9 }]
            ]),
            voiceTransitionInProgress: false,
            fallbackVoice: 'shimmer',
            voiceChangeHistory: []
        };

        // Audio context and streaming
        this.audioContext = null;
        this.mediaStream = null;
        this.processor = null;
        this.isStreamingAudio = false;
        this.audioWorkletNode = null;
        this.speechStopTimer = null;
        this.isResponseActive = false;
        this.currentTextResponse = '';
        this.currentUserTranscript = '';
        this.hasAudioResponse = false;
        this.audioResponseElement = null;
        this.audioChunks = [];
        this.isPlayingAudio = false;
        this.audioQueue = [];
        this.audioBuffer = [];
        this.minBufferSize = 2; // Wait for at least 2 chunks before starting playback
        this.isBuffering = false;
        this.audioResponseStarted = false;
        this.totalAudioChunks = 0;

        // Settings
        this.settings = {
            responseDelay: 1.0,
            vadSensitivity: 'medium',
            audioBufferSize: 'medium',
            connectionQuality: 'auto'
        };

        // Token tracking for streaming
        this.streamingSession = {
            startTime: null,
            endTime: null,
            audioMinutesReceived: 0,
            audioMinutesSent: 0,
            estimatedInputTokens: 0,
            estimatedOutputTokens: 0,
            textResponseLength: 0
        };

        // Debug logging
        this.debug.log('StreamingManager initialized with token tracking:', !!this.tokenTracker);
        
        // Initialize agent routing if available
        this.initializeAgentRouting();
        
        // Initialize error handler
        this.initializeErrorHandler();
        
        // Initialize performance optimizer
        this.initializePerformanceOptimizer();
    }

    // Legacy debug method for backward compatibility with debugCallback
    debugLegacy(message, data = null) {
        this.debug.log(message, data);
        
        if (this.debugCallback) {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] StreamingManager: ${message}`;
            this.debugCallback(logMessage, data);
        }
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.debug.log('API key updated');
    }

    setTokenTracker(tokenTracker) {
        this.tokenTracker = tokenTracker;
        this.debug.log('Token tracker updated');
    }

    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this.debug.log('Settings updated', this.settings);
    }

    /**
     * Connect to OpenAI Realtime API
     */
    async connect() {
        if (this.isConnecting || this.isConnected) {
            this.debug.log('Already connecting or connected');
            return { success: false, error: 'Already connecting or connected' };
        }

        if (!this.apiKey) {
            this.debug.log('No API key provided');
            return { success: false, error: 'API key required' };
        }

        try {
            this.isConnecting = true;
            this.debug.log('Starting connection to OpenAI Realtime API...');

            // Use connection manager for robust connection with retry logic
            const connectFunction = () => {
                return new Promise((resolve, reject) => {
                    // OpenAI Realtime API WebSocket URL with latest model
                    const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;

                    this.debug.log('Connecting to WebSocket URL:', wsUrl);

                    // Create WebSocket with authentication
                    this.websocket = this.createAuthenticatedWebSocket(wsUrl);
                    this.websocket.binaryType = 'arraybuffer';

                    // Register WebSocket as a resource
                    const wsResourceId = this.resourceManager.registerResource(
                        this.websocket,
                        'websocket',
                        (ws) => {
                            if (ws && ws.readyState !== WebSocket.CLOSED) {
                                ws.close(1000, 'Resource cleanup');
                            }
                        }
                    );

                    this.websocket.onopen = () => {
                        this.debug.log('WebSocket connection opened');
                        this.isConnected = true;
                        this.isConnecting = false;

                        // Try to restore voice configuration from previous session
                        const voiceRestored = this.restoreVoiceConfiguration();
                        
                        // Send initial session configuration
                        this.sendSessionConfig();

                        if (voiceRestored) {
                            this.debug.log('Voice configuration restored after reconnection');
                        }

                        resolve(this.websocket);
                    };

                    this.websocket.onmessage = (event) => {
                        this.handleMessage(event);
                    };

                    this.websocket.onerror = (error) => {
                        this.debug.error('WebSocket error:', error);
                        reject(new Error(`WebSocket error: ${error.message || 'Unknown error'}`));
                    };

                    this.websocket.onclose = (event) => {
                        this.debug.log('WebSocket closed:', { code: event.code, reason: event.reason });
                        this.isConnected = false;
                        this.isConnecting = false;

                        // Persist voice configuration for potential reconnection
                        this.persistVoiceConfiguration();

                        if (this.isConnecting) {
                            reject(new Error(`Connection failed: ${event.reason || 'Unknown reason'}`));
                        }
                    };
                });
            };

            // Use connection manager with retry logic
            const connection = await this.connectionManager.connectWithRetry(connectFunction, {
                maxRetries: 3,
                connectionTimeout: 10000,
                autoReconnect: true
            });

            // Store connection ID for management - connection is the WebSocket itself
            this.connectionId = 'websocket_connection';

            // Set up reconnection callbacks if the connection manager supports it
            if (typeof this.connectionManager.setReconnectionCallbacks === 'function') {
                this.connectionManager.setReconnectionCallbacks(
                    this.connectionId,
                    (newConnection) => {
                        this.debug.log('WebSocket reconnected successfully');
                        this.websocket = newConnection;
                        this.isConnected = true;
                        this.sendSessionConfig();
                    },
                    (error) => {
                        this.debug.error('WebSocket reconnection failed:', error);
                        this.cleanup();
                    }
                );
            }

            return { success: true };

        } catch (error) {
            this.debug.error('Connection error:', error);
            this.cleanup();
            return { success: false, error: error.message };
        }
    }

    /**
     * Send initial session configuration to OpenAI
     */
    sendSessionConfig() {
        // Get current persona information from the main app
        const currentPersona = this.getCurrentPersonaInfo();

        const instructions = this.generateInstructions(currentPersona);

        // Get voice configuration for current agent or default
        const voiceConfig = this.getVoiceConfigForAgent(this.currentStreamingAgent?.name || 'DefaultAgent');

        const config = {
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
                    threshold: this.getVadThreshold(),
                    prefix_padding_ms: 300,
                    silence_duration_ms: this.settings.responseDelay * 1000
                },
                tools: [],
                tool_choice: 'auto',
                temperature: voiceConfig.temperature || 0.9,
                max_response_output_tokens: 500 // Allow longer responses
            }
        };

        // Update current voice configuration
        this.voiceConfiguration.currentVoice = voiceConfig.voice;

        this.debug.log('Sending session config with persona and voice:', {
            persona: currentPersona?.name || 'Unknown',
            voice: voiceConfig.voice,
            agent: this.currentStreamingAgent?.name || 'DefaultAgent'
        });
        this.sendMessage(config);
    }

    /**
     * Create WebSocket with authentication
     * OpenAI Realtime API requires specific authentication method
     */
    createAuthenticatedWebSocket(url) {
        // OpenAI Realtime API uses specific subprotocols for authentication
        // Following the exact spec from OpenAI documentation
        const subprotocols = [
            'realtime',
            // Auth
            `openai-insecure-api-key.${this.apiKey}`,
            // Beta protocol, required
            'openai-beta.realtime-v1'
        ];

        this.debug.log('Creating WebSocket with subprotocols:', subprotocols.map(p => p.startsWith('openai-insecure-api-key') ? 'openai-insecure-api-key.[HIDDEN]' : p));

        return new WebSocket(url, subprotocols);
    }

    /**
     * Get VAD threshold based on sensitivity setting
     */
    getVadThreshold() {
        switch (this.settings.vadSensitivity) {
            case 'low': return 0.3;
            case 'high': return 0.7;
            case 'medium':
            default: return 0.5;
        }
    }

    /**
     * Get voice configuration for a specific agent
     * @param {string} agentName - Name of the agent
     * @returns {Object} - Voice configuration object
     */
    getVoiceConfigForAgent(agentName) {
        try {
            const agentVoiceConfig = this.voiceConfiguration.agentVoices.get(agentName);
            
            if (agentVoiceConfig) {
                this.debug.log('Using agent-specific voice configuration', {
                    agentName: agentName,
                    voice: agentVoiceConfig.voice
                });
                return agentVoiceConfig;
            }

            // Fallback to default voice configuration
            const defaultConfig = this.voiceConfiguration.agentVoices.get('DefaultAgent') || {
                voice: this.voiceConfiguration.fallbackVoice,
                speed: 1.0,
                pitch: 1.0,
                temperature: 0.9
            };

            this.debug.log('Using fallback voice configuration', {
                agentName: agentName,
                voice: defaultConfig.voice
            });

            return defaultConfig;

        } catch (error) {
            this.debug.error('Error getting voice config for agent', {
                error: error.message,
                agentName: agentName
            });

            // Return safe fallback
            return {
                voice: this.voiceConfiguration.fallbackVoice,
                speed: 1.0,
                pitch: 1.0,
                temperature: 0.9
            };
        }
    }

    /**
     * Switch voice configuration for a new agent
     * @param {string} newAgentName - Name of the new agent
     * @param {Object} context - Current streaming context
     * @returns {Promise<boolean>} - Success status of voice switch
     */
    async switchAgentVoice(newAgentName, context = {}) {
        try {
            if (this.voiceConfiguration.voiceTransitionInProgress) {
                this.debug.warn('Voice transition already in progress, skipping switch');
                return false;
            }

            const newVoiceConfig = this.getVoiceConfigForAgent(newAgentName);
            const currentVoice = this.voiceConfiguration.currentVoice;

            // Check if voice change is needed
            if (newVoiceConfig.voice === currentVoice) {
                this.debug.log('Voice change not needed, same voice', {
                    agentName: newAgentName,
                    voice: currentVoice
                });
                return true;
            }

            this.debug.log('Switching voice for agent', {
                agentName: newAgentName,
                fromVoice: currentVoice,
                toVoice: newVoiceConfig.voice
            });

            // Mark transition in progress
            this.voiceConfiguration.voiceTransitionInProgress = true;
            this.voiceConfiguration.previousVoice = currentVoice;

            try {
                // Update session with new voice configuration
                const success = await this.updateSessionVoice(newVoiceConfig, newAgentName, context);
                
                if (success) {
                    // Update current voice configuration
                    this.voiceConfiguration.currentVoice = newVoiceConfig.voice;
                    
                    // Record voice change in history
                    this.voiceConfiguration.voiceChangeHistory.push({
                        timestamp: Date.now(),
                        fromVoice: currentVoice,
                        toVoice: newVoiceConfig.voice,
                        agentName: newAgentName,
                        success: true
                    });

                    this.debug.log('Voice switch completed successfully', {
                        agentName: newAgentName,
                        newVoice: newVoiceConfig.voice
                    });

                    return true;
                } else {
                    throw new Error('Session voice update failed');
                }

            } catch (error) {
                this.debug.error('Voice switch failed', {
                    error: error.message,
                    agentName: newAgentName,
                    targetVoice: newVoiceConfig.voice
                });

                // Record failed voice change
                this.voiceConfiguration.voiceChangeHistory.push({
                    timestamp: Date.now(),
                    fromVoice: currentVoice,
                    toVoice: newVoiceConfig.voice,
                    agentName: newAgentName,
                    success: false,
                    error: error.message
                });

                // Handle voice switch failure gracefully
                return await this.handleVoiceTransitionFailure(currentVoice, newAgentName);

            } finally {
                // Clear transition flag
                this.voiceConfiguration.voiceTransitionInProgress = false;
            }

        } catch (error) {
            this.debug.error('Critical error in voice switching', {
                error: error.message,
                agentName: newAgentName
            });

            this.voiceConfiguration.voiceTransitionInProgress = false;
            return false;
        }
    }

    /**
     * Update session with new voice configuration
     * @param {Object} voiceConfig - New voice configuration
     * @param {string} agentName - Agent name for context
     * @param {Object} context - Current streaming context
     * @returns {Promise<boolean>} - Success status
     */
    async updateSessionVoice(voiceConfig, agentName, context) {
        try {
            // Get current persona and generate instructions
            const currentPersona = this.getCurrentPersonaInfo();
            const instructions = this.generateInstructions(currentPersona, agentName);

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
                        threshold: this.getVadThreshold(),
                        prefix_padding_ms: 300,
                        silence_duration_ms: this.settings.responseDelay * 1000
                    },
                    tools: [],
                    tool_choice: 'auto',
                    temperature: voiceConfig.temperature || 0.9,
                    max_response_output_tokens: 500
                }
            };

            // Send session update with retry logic
            return await this.sendSessionUpdateWithRetry(sessionUpdate, 3);

        } catch (error) {
            this.debug.error('Failed to update session voice', {
                error: error.message,
                agentName: agentName,
                voice: voiceConfig.voice
            });
            return false;
        }
    }

    /**
     * Send session update with retry logic
     * @param {Object} sessionUpdate - Session update message
     * @param {number} maxRetries - Maximum number of retries
     * @returns {Promise<boolean>} - Success status
     */
    async sendSessionUpdateWithRetry(sessionUpdate, maxRetries = 3) {
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                // Send the session update
                this.sendMessage(sessionUpdate);
                
                // Wait for confirmation (simplified - in production you'd wait for session.updated event)
                await new Promise(resolve => setTimeout(resolve, 100));
                
                this.debug.log('Session update sent successfully', {
                    voice: sessionUpdate.session.voice,
                    retryCount: retryCount
                });
                
                return true;

            } catch (error) {
                retryCount++;
                const delay = Math.pow(2, retryCount) * 100; // Exponential backoff
                
                this.debug.warn('Session update failed, retrying', {
                    error: error.message,
                    retryCount: retryCount,
                    maxRetries: maxRetries,
                    nextRetryDelay: delay
                });

                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    this.debug.error('Session update failed after all retries', {
                        error: error.message,
                        totalRetries: retryCount
                    });
                    return false;
                }
            }
        }
        
        return false;
    }

    /**
     * Handle voice transition failure gracefully
     * @param {string} previousVoice - Previous voice that was working
     * @param {string} agentName - Agent name for context
     * @returns {Promise<boolean>} - Recovery success status
     */
    async handleVoiceTransitionFailure(previousVoice, agentName) {
        try {
            this.debug.log('Handling voice transition failure', {
                previousVoice: previousVoice,
                agentName: agentName
            });

            // Try to revert to previous voice
            if (previousVoice && previousVoice !== this.voiceConfiguration.currentVoice) {
                const revertConfig = {
                    voice: previousVoice,
                    speed: 1.0,
                    pitch: 1.0,
                    temperature: 0.9
                };

                const revertSuccess = await this.updateSessionVoice(revertConfig, agentName, {});
                
                if (revertSuccess) {
                    this.voiceConfiguration.currentVoice = previousVoice;
                    this.debug.log('Successfully reverted to previous voice', {
                        voice: previousVoice
                    });
                    return true;
                }
            }

            // If revert fails, try fallback voice
            const fallbackConfig = {
                voice: this.voiceConfiguration.fallbackVoice,
                speed: 1.0,
                pitch: 1.0,
                temperature: 0.9
            };

            const fallbackSuccess = await this.updateSessionVoice(fallbackConfig, agentName, {});
            
            if (fallbackSuccess) {
                this.voiceConfiguration.currentVoice = this.voiceConfiguration.fallbackVoice;
                this.debug.log('Successfully switched to fallback voice', {
                    voice: this.voiceConfiguration.fallbackVoice
                });
                return true;
            }

            // If all else fails, continue with current voice
            this.debug.warn('Voice transition recovery failed, continuing with current voice');
            return false;

        } catch (error) {
            this.debug.error('Error in voice transition failure handling', {
                error: error.message,
                previousVoice: previousVoice,
                agentName: agentName
            });
            return false;
        }
    }

    /**
     * Configure agent-specific voice settings
     * @param {string} agentName - Agent name
     * @param {Object} voiceSettings - Voice configuration
     */
    configureAgentVoice(agentName, voiceSettings) {
        try {
            if (!agentName || !voiceSettings) {
                throw new Error('Agent name and voice settings are required');
            }

            // Validate voice settings
            const validatedSettings = {
                voice: voiceSettings.voice || this.voiceConfiguration.fallbackVoice,
                speed: Math.max(0.5, Math.min(2.0, voiceSettings.speed || 1.0)),
                pitch: Math.max(0.5, Math.min(2.0, voiceSettings.pitch || 1.0)),
                temperature: Math.max(0.1, Math.min(1.0, voiceSettings.temperature || 0.9))
            };

            // Update agent voice configuration
            this.voiceConfiguration.agentVoices.set(agentName, validatedSettings);

            this.debug.log('Agent voice configuration updated', {
                agentName: agentName,
                voiceSettings: validatedSettings
            });

            // If this is the current agent, apply the voice change immediately
            if (this.currentStreamingAgent?.name === agentName) {
                this.switchAgentVoice(agentName).catch(error => {
                    this.debug.error('Failed to apply immediate voice change', {
                        error: error.message,
                        agentName: agentName
                    });
                });
            }

        } catch (error) {
            this.debug.error('Error configuring agent voice', {
                error: error.message,
                agentName: agentName,
                voiceSettings: voiceSettings
            });
        }
    }

    /**
     * Get current voice configuration state
     * @returns {Object} - Current voice configuration
     */
    getVoiceConfiguration() {
        return {
            currentVoice: this.voiceConfiguration.currentVoice,
            previousVoice: this.voiceConfiguration.previousVoice,
            currentAgent: this.currentStreamingAgent?.name || 'DefaultAgent',
            agentVoices: Object.fromEntries(this.voiceConfiguration.agentVoices),
            voiceTransitionInProgress: this.voiceConfiguration.voiceTransitionInProgress,
            fallbackVoice: this.voiceConfiguration.fallbackVoice,
            voiceChangeHistory: this.voiceConfiguration.voiceChangeHistory.slice(-10) // Last 10 changes
        };
    }

    /**
     * Persist voice configuration across WebSocket reconnections
     */
    persistVoiceConfiguration() {
        try {
            const voiceConfig = this.getVoiceConfiguration();
            
            // Store in session storage for reconnection recovery
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('streamingVoiceConfig', JSON.stringify({
                    currentVoice: voiceConfig.currentVoice,
                    currentAgent: voiceConfig.currentAgent,
                    timestamp: Date.now()
                }));
            }

            this.debug.log('Voice configuration persisted', {
                currentVoice: voiceConfig.currentVoice,
                currentAgent: voiceConfig.currentAgent
            });

        } catch (error) {
            this.debug.error('Failed to persist voice configuration', {
                error: error.message
            });
        }
    }

    /**
     * Restore voice configuration after WebSocket reconnection
     */
    restoreVoiceConfiguration() {
        try {
            if (typeof sessionStorage === 'undefined') {
                return false;
            }

            const storedConfig = sessionStorage.getItem('streamingVoiceConfig');
            if (!storedConfig) {
                return false;
            }

            const config = JSON.parse(storedConfig);
            
            // Check if stored config is recent (within last 5 minutes)
            if (Date.now() - config.timestamp > 5 * 60 * 1000) {
                sessionStorage.removeItem('streamingVoiceConfig');
                return false;
            }

            // Restore voice configuration
            if (config.currentVoice && config.currentAgent) {
                this.voiceConfiguration.currentVoice = config.currentVoice;
                
                // Apply the restored configuration
                this.switchAgentVoice(config.currentAgent).catch(error => {
                    this.debug.error('Failed to restore voice configuration', {
                        error: error.message,
                        config: config
                    });
                });

                this.debug.log('Voice configuration restored', {
                    currentVoice: config.currentVoice,
                    currentAgent: config.currentAgent
                });

                return true;
            }

        } catch (error) {
            this.debug.error('Error restoring voice configuration', {
                error: error.message
            });
        }

        return false;
    }

    /**
     * Send message to WebSocket
     */
    sendMessage(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
            this.debug.log('Message sent:', message.type);
        } else {
            this.debug.log('Cannot send message - WebSocket not connected');
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    async handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.debug.log('Message received:', message.type, message);

            switch (message.type) {
                case 'session.created':
                    this.debug.log('Session created successfully');
                    // Start tracking session
                    this.streamingSession.startTime = Date.now();
                    break;

                case 'session.updated':
                    this.debug.log('Session updated');
                    break;

                case 'error':
                    this.debug.error('API Error:', message.error);
                    // Check if this error is causing response truncation
                    if (message.error && message.error.message) {
                        this.debug.error('Error details:', message.error.message);
                        if (message.error.message.includes('token') || message.error.message.includes('limit')) {
                            this.debug.log('WARNING: Token limit may be causing response truncation');
                        }
                    }
                    break;

                case 'input_audio_buffer.speech_started':
                    this.debug.log('Speech started detected');
                    break;

                case 'input_audio_buffer.speech_stopped':
                    this.debug.log('Speech stopped detected');
                    // Add delay before committing to ensure we have enough audio
                    this.scheduleAudioCommit();
                    break;

                case 'conversation.item.input_audio_transcription.completed':
                    this.debug.log('Transcription completed:', message.transcript);
                    // Track input transcription for token estimation
                    const transcript = message.transcript || this.currentUserTranscript;
                    if (transcript) {
                        this.trackInputText(transcript);
                        this.displayUserMessage(transcript);
                        if (message.transcript) {
                            this.currentUserTranscript = '';
                        }
                        
                        // NEW: Route through agents if agent routing is enabled
                        // But only if not already handled by middleware
                        if (this.agentRoutingEnabled && this.streamingAgentRouter && !message._agentRouted) {
                            this.debug.log('Routing transcript through agents:', transcript);
                            await this.routeThroughAgentsWithErrorHandling(transcript);
                            return; // Skip default OpenAI response generation
                        } else if (message._agentRouted) {
                            this.debug.log('Transcript already routed by middleware, skipping StreamingManager routing');
                            // Don't return here - let normal processing continue for UI display
                        }
                    } else {
                        this.debug.log('Warning: No transcript in transcription completed message');
                    }
                    break;

                case 'response.audio.delta':
                    this.debug.log('Audio response chunk received');
                    if (message.delta) {
                        this.handleAudioResponse(message.delta);
                        // Track audio output for cost estimation
                        this.trackAudioOutput(message.delta);
                        // Also indicate audio response in chat
                        this.indicateAudioResponse();
                    }
                    break;

                case 'response.text.delta':
                    this.debug.log('Text response chunk:', message.delta);
                    // Accumulate text response
                    this.accumulateTextResponse(message.delta);
                    break;

                case 'response.text.done':
                    this.debug.log('Text response completed');
                    // Display complete text response
                    this.displayBotTextResponse();
                    break;

                case 'response.output_item.added':
                    this.debug.log('Response output item added:', message.item);
                    if (message.item && message.item.content) {
                        message.item.content.forEach(content => {
                            if (content.type === 'text' && content.text) {
                                this.debug.log('Found text content:', content.text);
                                this.displayBotMessage(content.text);
                            }
                        });
                    }
                    break;

                case 'response.output_item.done':
                    this.debug.log('Response output item completed:', message.item);
                    if (message.item && message.item.content) {
                        // Look for completed text content
                        message.item.content.forEach(content => {
                            if (content.type === 'text' && content.text) {
                                this.debug.log('Complete text response:', content.text);
                                this.trackOutputText(content.text);
                                this.displayBotMessage(content.text);
                                this.updateDebugPanel('gptResponse', content.text);
                            }
                        });
                    }
                    break;

                case 'response.text.delta':
                    this.debug.log('Text response delta:', message.delta);
                    this.accumulateTextResponse(message.delta);
                    break;

                case 'response.text.done':
                    this.debug.log('Text response completed');
                    if (this.currentTextResponse) {
                        this.debug.log('Final accumulated text:', this.currentTextResponse);
                        this.displayBotMessage(this.currentTextResponse);
                        this.updateDebugPanel('gptResponse', this.currentTextResponse);
                        this.currentTextResponse = '';
                    }
                    break;

                case 'response.content_part.added':
                    this.debug.log('Response content part added:', message.part);
                    if (message.part && message.part.type === 'text' && message.part.text) {
                        this.debug.log('Found text part:', message.part.text);
                        this.displayBotMessage(message.part.text);
                    }
                    break;

                case 'response.audio_transcript.delta':
                    this.debug.log('Audio transcript delta:', message.delta);
                    this.accumulateTextResponse(message.delta);
                    break;

                case 'response.audio_transcript.done':
                    this.debug.log('Audio transcript completed');
                    this.displayBotTextResponse();
                    break;

                case 'response.audio.done':
                    this.debug.log('Audio response completed - all audio chunks received');
                    // Audio is complete, but don't reset state until full response is done
                    break;

                case 'response.cancelled':
                    this.debug.log('Response was cancelled - this may cause truncation');
                    this.isResponseActive = false;
                    break;

                case 'response.failed':
                    this.debug.error('Response failed:', message.error);
                    this.isResponseActive = false;
                    break;

                case 'response.done':
                    this.debug.log(`Full response completed - received ${this.totalAudioChunks} total audio chunks`);
                    this.isResponseActive = false;
                    this.audioResponseStarted = false;

                    // Track the completed response
                    this.trackResponseCompletion();

                    // Wait longer for all queued audio to finish playing
                    setTimeout(() => {
                        this.completeAudioResponse();
                        this.totalAudioChunks = 0;
                    }, 4000); // Wait 4 seconds for all audio to finish
                    break;

                case 'response.created':
                    this.debug.log('Response created');
                    this.isResponseActive = true;
                    break;

                case 'conversation.item.input_audio_transcription.delta':
                    this.debug.log('Transcription delta:', message.delta);
                    // Accumulate user transcription
                    if (!this.currentUserTranscript) {
                        this.currentUserTranscript = '';
                    }
                    this.currentUserTranscript += message.delta;
                    break;

                default:
                    this.debug.log('Unknown message type:', message.type, message);
            }

        } catch (error) {
            this.debug.error('Error parsing message:', error);
        }
    }

    /**
     * Initialize error handler for streaming agent routing
     */
    initializeErrorHandler() {
        try {
            if (window.StreamingErrorHandler && this.streamingAgentRouter) {
                this.streamingErrorHandler = new window.StreamingErrorHandler(this, this.streamingAgentRouter);
                
                // Connect error handler to router
                if (typeof this.streamingAgentRouter.setErrorHandler === 'function') {
                    this.streamingAgentRouter.setErrorHandler(this.streamingErrorHandler);
                }
                
                // Connect error handler to middleware if available
                if (this.streamingAgentMiddleware && typeof this.streamingAgentMiddleware.setErrorHandler === 'function') {
                    this.streamingAgentMiddleware.setErrorHandler(this.streamingErrorHandler);
                }
                
                this.debug.log('StreamingErrorHandler initialized and connected');
            } else {
                this.debug.log('StreamingErrorHandler not available or agent router not initialized');
            }
        } catch (error) {
            this.debug.error('Failed to initialize StreamingErrorHandler:', error);
        }
    }



    /**
     * Disconnect from the streaming service
     */
    async disconnect() {
        this.debug.log('Disconnecting...');
        // Track session end
        this.streamingSession.endTime = Date.now();
        this.trackSessionEnd();
        
        // Cleanup error handler
        if (this.streamingErrorHandler) {
            this.streamingErrorHandler.cleanup();
        }
        
        this.cleanup();
        return { success: true };
    }

    /**
     * Track input text for token estimation
     */
    trackInputText(text) {
        if (!text) return;
        
        // Rough token estimation: ~4 characters per token for English
        const estimatedTokens = Math.ceil(text.length / 4);
        this.streamingSession.estimatedInputTokens += estimatedTokens;
        
        this.debug.log(`Tracked input text: ${text.length} chars, ~${estimatedTokens} tokens`);
    }

    /**
     * Track output text for token estimation
     */
    trackOutputText(text) {
        if (!text) return;
        
        // Rough token estimation: ~4 characters per token for English
        const estimatedTokens = Math.ceil(text.length / 4);
        this.streamingSession.estimatedOutputTokens += estimatedTokens;
        this.streamingSession.textResponseLength += text.length;
        
        this.debug.log(`Tracked output text: ${text.length} chars, ~${estimatedTokens} tokens`);
    }

    /**
     * Track audio input for duration estimation
     */
    trackAudioInput(audioBytes) {
        if (!audioBytes) return;
        
        // PCM16 at 24kHz: ~48KB per second of audio
        const estimatedSeconds = audioBytes / 48000;
        const estimatedMinutes = estimatedSeconds / 60;
        
        this.streamingSession.audioMinutesSent += estimatedMinutes;
        
        // Log occasionally to avoid spam
        if (Math.random() < 0.01) { // 1% of chunks
            this.debug.log(`Audio input tracking: +${estimatedMinutes.toFixed(4)} min (total sent: ${this.streamingSession.audioMinutesSent.toFixed(4)} min)`);
        }
    }

    /**
     * Track audio output for duration estimation
     */
    trackAudioOutput(audioData) {
        if (!audioData) return;
        
        // Estimate audio duration from base64 data size
        // PCM16 at 24kHz: ~48KB per second of audio
        const audioBytes = (audioData.length * 3) / 4; // base64 to bytes
        const estimatedSeconds = audioBytes / 48000;
        const estimatedMinutes = estimatedSeconds / 60;
        
        this.streamingSession.audioMinutesReceived += estimatedMinutes;
        
        // Log occasionally to avoid spam
        if (Math.random() < 0.05) { // 5% of chunks
            this.debug.log(`Audio output tracking: +${estimatedMinutes.toFixed(4)} min (total received: ${this.streamingSession.audioMinutesReceived.toFixed(4)} min)`);
        }
    }

    /**
     * Track response completion and update token tracker
     */
    trackResponseCompletion() {
        if (!this.tokenTracker) {
            this.debug.log('No token tracker available for streaming session tracking');
            return;
        }

        const session = this.streamingSession;
        
        this.debug.log('Tracking streaming session completion:', {
            inputTokens: session.estimatedInputTokens,
            outputTokens: session.estimatedOutputTokens,
            audioMinutes: session.audioMinutesReceived,
            textLength: session.textResponseLength
        });

        // Track GPT usage (estimated tokens)
        if (session.estimatedInputTokens > 0 || session.estimatedOutputTokens > 0) {
            this.tokenTracker.trackGptUsage(
                session.estimatedInputTokens,
                session.estimatedOutputTokens
            );
        }

        // Track TTS usage (audio generation)
        if (session.textResponseLength > 0) {
            // Use tts-1-hd pricing for streaming as it's higher quality
            this.tokenTracker.trackTtsUsage(session.textResponseLength, 'tts-1-hd');
        }

        // Track Whisper usage (input transcription)
        if (session.audioMinutesSent > 0) {
            this.tokenTracker.trackWhisperUsage(session.audioMinutesSent);
        }

        // Update display
        this.tokenTracker.updateDisplay();

        // Reset session tracking
        this.resetSessionTracking();
    }

    /**
     * Track session end
     */
    trackSessionEnd() {
        if (this.streamingSession.startTime && !this.streamingSession.endTime) {
            this.streamingSession.endTime = Date.now();
            const sessionDuration = (this.streamingSession.endTime - this.streamingSession.startTime) / 1000;
            this.debug.log(`Streaming session ended after ${sessionDuration.toFixed(1)} seconds`);
        }
    }

    /**
     * Reset session tracking
     */
    resetSessionTracking() {
        this.streamingSession = {
            startTime: null,
            endTime: null,
            audioMinutesReceived: 0,
            audioMinutesSent: 0,
            estimatedInputTokens: 0,
            estimatedOutputTokens: 0,
            textResponseLength: 0
        };
    }

    /**
     * Get current session tracking stats
     */
    getSessionStats() {
        return { ...this.streamingSession };
    }

    /**
     * Get resource management statistics
     */
    getResourceStats() {
        return {
            resourceManager: typeof this.resourceManager.getStats === 'function' ? 
                this.resourceManager.getStats() : { created: 0, disposed: 0, active: 0 },
            timeoutManager: typeof this.timeoutManager.getStats === 'function' ? 
                this.timeoutManager.getStats() : { created: 0, completed: 0, timedOut: 0, cancelled: 0, active: 0 },
            connectionManager: typeof this.connectionManager.getStats === 'function' ? 
                this.connectionManager.getStats() : { totalAttempts: 0, successfulConnections: 0, failedConnections: 0, reconnections: 0, activeConnections: 0 }
        };
    }

    /**
     * Perform comprehensive cleanup verification
     */
    verifyResourceCleanup() {
        const verification = {
            resourceManager: typeof this.resourceManager.verifyCleanup === 'function' ? 
                this.resourceManager.verifyCleanup() : { isClean: true, activeResources: [] },
            activeTimeouts: typeof this.timeoutManager.getActiveTimeoutCount === 'function' ? 
                this.timeoutManager.getActiveTimeoutCount() : 0,
            activeConnections: typeof this.connectionManager.getAllConnectionStatuses === 'function' ? 
                this.connectionManager.getAllConnectionStatuses().filter(conn => conn.connected).length : 0,
            timestamp: new Date().toISOString()
        };

        const isFullyClean = verification.resourceManager.isClean && 
                           verification.activeTimeouts === 0 && 
                           verification.activeConnections === 0;

        this.debug.log('Resource cleanup verification:', {
            isFullyClean,
            activeResources: verification.resourceManager.activeResources ? verification.resourceManager.activeResources.length : 0,
            activeTimeouts: verification.activeTimeouts,
            activeConnections: verification.activeConnections
        });

        return {
            ...verification,
            isFullyClean
        };
    }

    /**
     * Manually trigger token tracking update (for testing)
     */
    updateTokenDisplay() {
        if (this.tokenTracker) {
            this.tokenTracker.updateDisplay();
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.debug.log('Cleaning up resources...');

        this.isConnected = false;
        this.isConnecting = false;

        // Stop audio streaming with enhanced cleanup
        this.stopAudioStreaming();

        // Disconnect all connections through connection manager
        if (this.connectionId && typeof this.connectionManager.disconnect === 'function') {
            this.connectionManager.disconnect(this.connectionId, true);
            this.connectionId = null;
        }

        // Cancel all active timeouts
        if (typeof this.timeoutManager.cancelAllTimeouts === 'function') {
            const cancelledTimeouts = this.timeoutManager.cancelAllTimeouts();
            if (cancelledTimeouts > 0) {
                this.debug.log(`Cancelled ${cancelledTimeouts} active timeouts`);
            }
        }

        // Dispose of all registered resources
        if (typeof this.resourceManager.disposeAllResources === 'function') {
            const disposalResults = this.resourceManager.disposeAllResources();
            this.debug.log(`Resource disposal: ${disposalResults.disposed}/${disposalResults.total} resources disposed`);
            
            if (disposalResults.errors && disposalResults.errors.length > 0) {
                this.debug.warn(`Resource disposal errors:`, disposalResults.errors);
            }
        }

        // Clear WebSocket reference
        this.websocket = null;

        // Clean up voice configuration
        this.voiceConfiguration.voiceTransitionInProgress = false;
        this.voiceConfiguration.previousVoice = null;
        
        // Clear voice change history (keep last 5 for debugging)
        if (this.voiceConfiguration.voiceChangeHistory.length > 5) {
            this.voiceConfiguration.voiceChangeHistory = this.voiceConfiguration.voiceChangeHistory.slice(-5);
        }

        // Reset current streaming agent
        this.currentStreamingAgent = null;
        
        // Cleanup session manager
        if (this.streamingSessionManager) {
            this.streamingSessionManager.cleanup();
            this.streamingSessionManager = null;
        }

        // Verify cleanup was successful
        if (typeof this.resourceManager.verifyCleanup === 'function') {
            const verification = this.resourceManager.verifyCleanup();
            if (!verification.isClean) {
                this.debug.warn(`Cleanup verification failed: ${verification.activeResources.length} resources still active`);
                
                // Force cleanup of old resources as emergency measure
                if (typeof this.resourceManager.forceDisposeOldResources === 'function') {
                    const forceDisposed = this.resourceManager.forceDisposeOldResources(5000); // 5 seconds
                    if (forceDisposed > 0) {
                        this.debug.warn(`Force disposed ${forceDisposed} old resources`);
                    }
                }
            } else {
                this.debug.log('Cleanup verification passed: all resources properly disposed');
            }
        }

        // Clean up disposed resources from memory
        if (typeof this.resourceManager.cleanupDisposedResources === 'function') {
            this.resourceManager.cleanupDisposedResources();
        }
        if (typeof this.timeoutManager.cleanupCompletedTimeouts === 'function') {
            this.timeoutManager.cleanupCompletedTimeouts();
        }
        if (typeof this.connectionManager.cleanupCompletedConnections === 'function') {
            this.connectionManager.cleanupCompletedConnections();
        }

        this.debug.log('Enhanced cleanup completed');
    }

    /**
     * Start audio streaming
     */
    async startAudioStreaming() {
        if (!this.isConnected) {
            this.debug.log('Cannot start audio streaming - not connected');
            return { success: false, error: 'Not connected to streaming service' };
        }

        if (this.isStreamingAudio) {
            this.debug.log('Audio streaming already active');
            return { success: true };
        }

        try {
            this.debug.log('Starting audio streaming...');

            // Get microphone access with timeout
            if (typeof this.timeoutManager.createTimeout === 'function') {
                this.mediaStream = await this.timeoutManager.createTimeout(
                    () => navigator.mediaDevices.getUserMedia({
                        audio: {
                            sampleRate: 24000, // OpenAI Realtime API expects 24kHz
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    }),
                    5000, // 5 second timeout for media access
                    'media_stream_access'
                );
            } else {
                // Fallback without timeout
                this.mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: 24000, // OpenAI Realtime API expects 24kHz
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            }

            // Register media stream as a resource
            if (typeof this.resourceManager.registerResource === 'function') {
                this.resourceManager.registerResource(
                    this.mediaStream,
                    'mediaStream',
                    (stream) => {
                        if (stream) {
                            stream.getTracks().forEach(track => {
                                track.stop();
                                this.debug.log(`Stopped media track: ${track.kind}`);
                            });
                        }
                    }
                );
            }

            // Create audio context with timeout
            if (typeof this.timeoutManager.createTimeout === 'function') {
                this.audioContext = await this.timeoutManager.createTimeout(
                    () => new (window.AudioContext || window.webkitAudioContext)({
                        sampleRate: 24000
                    }),
                    2000, // 2 second timeout for audio context creation
                    'audio_context_creation'
                );
            } else {
                // Fallback without timeout
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 24000
                });
            }

            // Register audio context as a resource
            if (typeof this.resourceManager.registerResource === 'function') {
                this.resourceManager.registerResource(
                    this.audioContext,
                    'audioContext',
                    (context) => {
                        if (context && context.state !== 'closed') {
                            context.close().catch(err => {
                                this.debug.warn('Error closing audio context:', err);
                            });
                            this.debug.log('Closed audio context');
                        }
                    }
                );
            }

            // Create audio source
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Register audio source as a resource
            if (typeof this.resourceManager.registerResource === 'function') {
                this.resourceManager.registerResource(
                    source,
                    'audioSource',
                    (src) => {
                        if (src && typeof src.disconnect === 'function') {
                            src.disconnect();
                            this.debug.log('Disconnected audio source');
                        }
                    }
                );
            }

            // Create script processor for audio data
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

            // Register processor as a resource
            if (typeof this.resourceManager.registerResource === 'function') {
                this.resourceManager.registerResource(
                    this.processor,
                    'processor',
                    (proc) => {
                        if (proc && typeof proc.disconnect === 'function') {
                            proc.disconnect();
                            this.debug.log('Disconnected audio processor');
                        }
                    }
                );
            }

            this.processor.onaudioprocess = (event) => {
                if (this.isStreamingAudio && this.isConnected) {
                    this.processAudioChunk(event.inputBuffer);
                    // Update audio level indicator
                    this.updateAudioLevel(event.inputBuffer);
                }
            };

            // Connect audio pipeline
            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);

            this.isStreamingAudio = true;
            this.debug.log('Audio streaming started successfully');

            return { success: true };

        } catch (error) {
            this.debug.log('Error starting audio streaming:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Process audio chunk and send to OpenAI
     */
    processAudioChunk(inputBuffer) {
        try {
            // Get audio data from the first channel
            const audioData = inputBuffer.getChannelData(0);

            // Convert Float32Array to PCM16 format
            const pcm16Data = this.convertToPCM16(audioData);

            // Convert to base64 for transmission
            const base64Audio = this.arrayBufferToBase64(pcm16Data);

            // Send audio data to OpenAI
            const audioMessage = {
                type: 'input_audio_buffer.append',
                audio: base64Audio
            };

            this.sendMessage(audioMessage);

            // Track audio input for cost estimation
            this.trackAudioInput(pcm16Data.byteLength);

            // Debug: Log audio chunk info (but not the data itself)
            if (Math.random() < 0.01) { // Log only 1% of chunks to avoid spam
                this.debug.log(`Audio chunk sent: ${audioData.length} samples, ${pcm16Data.byteLength} bytes`);
            }

        } catch (error) {
            this.debug.log('Error processing audio chunk:', error);
        }
    }

    /**
     * Convert Float32Array to PCM16 format
     */
    convertToPCM16(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);

        for (let i = 0; i < float32Array.length; i++) {
            // Convert float (-1 to 1) to 16-bit signed integer
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(i * 2, pcm, true); // little-endian
        }

        return buffer;
    }

    /**
     * Convert ArrayBuffer to base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Pause audio streaming (mute)
     */
    pauseAudioStreaming() {
        this.debug.log('Pausing audio streaming (mute)...');
        
        if (this.mediaStream) {
            this.mediaStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
        }
        
        this.debug.log('Audio streaming paused');
    }

    /**
     * Resume audio streaming (unmute)
     */
    resumeAudioStreaming() {
        this.debug.log('Resuming audio streaming (unmute)...');
        
        if (this.mediaStream) {
            this.mediaStream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });
        }
        
        this.debug.log('Audio streaming resumed');
    }

    /**
     * Stop audio streaming
     */
    stopAudioStreaming() {
        this.debug.log('Stopping audio streaming...');

        this.isStreamingAudio = false;
        this.isResponseActive = false;
        this.isPlayingAudio = false;

        // Clear audio queue, buffer, and chunks
        this.audioQueue = [];
        this.audioBuffer = [];
        this.audioChunks = [];
        this.isBuffering = false;
        this.audioResponseStarted = false;
        this.totalAudioChunks = 0;

        // Clear any pending timers
        if (this.speechStopTimer) {
            clearTimeout(this.speechStopTimer);
            this.speechStopTimer = null;
        }

        // Dispose of audio-related resources through resource manager
        if (typeof this.resourceManager.getResourcesByType === 'function' && 
            typeof this.resourceManager.disposeResource === 'function') {
            
            const audioResources = [
                ...this.resourceManager.getResourcesByType('processor'),
                ...this.resourceManager.getResourcesByType('audioSource'),
                ...this.resourceManager.getResourcesByType('audioContext'),
                ...this.resourceManager.getResourcesByType('mediaStream'),
                ...this.resourceManager.getResourcesByType('audioElement'),
                ...this.resourceManager.getResourcesByType('audioBuffer')
            ];

            let disposed = 0;
            audioResources.forEach(resourceInfo => {
                if (this.resourceManager.disposeResource(resourceInfo.id)) {
                    disposed++;
                }
            });

            if (disposed > 0) {
                this.debug.log(`Disposed ${disposed} audio resources through resource manager`);
            }

            // Verify audio resources are cleaned up
            const remainingAudioResources = [
                ...this.resourceManager.getResourcesByType('processor'),
                ...this.resourceManager.getResourcesByType('audioSource'),
                ...this.resourceManager.getResourcesByType('audioContext'),
                ...this.resourceManager.getResourcesByType('mediaStream'),
                ...this.resourceManager.getResourcesByType('audioElement'),
                ...this.resourceManager.getResourcesByType('audioBuffer')
            ];

            if (remainingAudioResources.length > 0) {
                this.debug.warn(`${remainingAudioResources.length} audio resources still active after cleanup`);
            } else {
                this.debug.log('All audio resources successfully cleaned up');
            }
        } else {
            // Fallback to manual cleanup
            if (this.processor) {
                this.processor.disconnect();
                this.processor = null;
            }

            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }

            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }
        }

        // Clear references
        this.processor = null;
        this.audioContext = null;
        this.mediaStream = null;

        this.debug.log('Enhanced audio streaming stopped');
    }

    /**
     * Handle incoming audio response from OpenAI
     */
    handleAudioResponse(audioData) {
        try {
            this.debug.log('Received audio response chunk from OpenAI');

            this.totalAudioChunks++;
            this.debug.log(`Received audio chunk ${this.totalAudioChunks} from OpenAI`);

            // Add to queue for processing
            this.audioQueue.push({ type: 'base64', data: audioData });

            // Smart buffering: Wait for initial chunks before starting playback
            if (!this.isPlayingAudio) {
                if (this.totalAudioChunks === 1) {
                    // First chunk - start buffering with delay
                    this.debug.log('First audio chunk received, starting buffered playback...');
                    setTimeout(() => {
                        if (!this.isPlayingAudio && this.audioQueue.length > 0) {
                            this.debug.log(`Starting playback after buffer delay with ${this.audioQueue.length} chunks`);
                            this.playQueuedAudio();
                        }
                    }, 300); // 300ms buffer delay for smoother start
                } else if (this.audioQueue.length >= 2) {
                    // Multiple chunks available - start immediately
                    this.debug.log('Multiple chunks available, starting playback immediately');
                    this.playQueuedAudio();
                }
            } else {
                this.debug.log(`Added chunk to queue, ${this.audioQueue.length} chunks queued`);
                // Ensure playback continues even if there was a gap
                setTimeout(() => {
                    if (!this.isPlayingAudio && this.audioQueue.length > 0) {
                        this.debug.log('Restarting stalled audio playback');
                        this.playQueuedAudio();
                    }
                }, 100);
            }

        } catch (error) {
            this.debug.log('Error handling audio response:', error);
        }
    }

    /**
     * Start buffered audio playback
     */
    async startBufferedPlayback() {
        if (this.isPlayingAudio) {
            return;
        }

        this.isBuffering = true;
        this.isPlayingAudio = true;

        // Move buffered chunks to the play queue
        while (this.audioBuffer.length > 0) {
            this.audioQueue.push(this.audioBuffer.shift());
        }

        this.isBuffering = false;
        this.debug.log(`Starting playback with ${this.audioQueue.length} buffered chunks`);

        // Start continuous playback
        this.playQueuedAudio();
    }

    /**
     * Play queued audio chunks sequentially
     */
    async playQueuedAudio() {
        if (this.isPlayingAudio) {
            this.debug.log('Audio already playing, skipping');
            return;
        }

        if (this.audioQueue.length === 0) {
            this.debug.log('No audio chunks in queue');
            return;
        }

        this.isPlayingAudio = true;
        this.debug.log(`Starting queued audio playback with ${this.audioQueue.length} chunks`);

        try {
            let chunkIndex = 0;
            while (this.audioQueue.length > 0) {
                const audioItem = this.audioQueue.shift();
                this.debug.log(`Playing audio chunk ${chunkIndex + 1}`);

                try {
                    // Try alternative method first, then fall back to PCM16
                    await this.playAudioAlternative(audioItem.data);
                    chunkIndex++;
                    this.debug.log(`Chunk ${chunkIndex} completed successfully`);
                } catch (chunkError) {
                    this.debug.log(`Error playing chunk ${chunkIndex + 1}:`, chunkError);
                    // Continue with next chunk instead of stopping
                }

                // Small delay to prevent audio overlap
                await new Promise(resolve => setTimeout(resolve, 25));
            }
        } catch (error) {
            this.debug.log('Error in queued audio playback:', error);
        } finally {
            // Check if there are more chunks to play
            if (this.audioQueue.length > 0) {
                this.debug.log(`Continuing playback with ${this.audioQueue.length} more chunks`);
                // Continue playing immediately without delay
                this.playQueuedAudio();
            } else {
                this.isPlayingAudio = false;
                this.debug.log(`All queued audio chunks played (${this.totalAudioChunks} total received)`);
            }
        }
    }

    /**
     * Play PCM16 audio response
     */
    async playPCM16Audio(pcm16Buffer) {
        try {
            if (!this.audioContext) {
                // Create audio context with optimal settings for voice
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 24000, // Match OpenAI's output exactly
                    latencyHint: 'interactive' // Optimize for real-time playback
                });
                this.debug.log('Created optimized audio context for streaming');
            }

            // Debug: Log buffer info
            this.debug.log(`Playing audio: ${pcm16Buffer.byteLength} bytes, ${pcm16Buffer.byteLength / 2} samples`);

            // Convert PCM16 to AudioBuffer
            // Try different sample rates to see which sounds correct
            const possibleSampleRates = [24000, 16000, 22050, 44100];
            const sampleRate = possibleSampleRates[0]; // Start with 24kHz as documented
            const numSamples = pcm16Buffer.byteLength / 2; // 16-bit = 2 bytes per sample

            if (numSamples === 0) {
                this.debug.log('Empty audio buffer, skipping playback');
                return Promise.resolve();
            }

            this.debug.log(`Creating audio buffer: ${numSamples} samples at ${sampleRate}Hz`);

            const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
            const channelData = audioBuffer.getChannelData(0);

            // Convert PCM16 to Float32 with proper endianness
            const view = new DataView(pcm16Buffer);
            for (let i = 0; i < numSamples; i++) {
                const sample = view.getInt16(i * 2, true); // little-endian
                channelData[i] = sample / 32768.0; // Convert to -1.0 to 1.0 range
            }

            // Create enhanced audio processing chain for better quality
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            const compressor = this.audioContext.createDynamicsCompressor();

            // Configure compressor for voice enhancement
            compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime);
            compressor.knee.setValueAtTime(30, this.audioContext.currentTime);
            compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
            compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
            compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);

            source.buffer = audioBuffer;
            gainNode.gain.value = 1.0; // Full volume with compression

            // Connect enhanced audio processing chain
            source.connect(gainNode);
            gainNode.connect(compressor);
            compressor.connect(this.audioContext.destination);

            // Return a promise that resolves when audio finishes
            return new Promise((resolve, reject) => {
                source.onended = () => {
                    this.debug.log(`High-quality PCM16 audio completed: ${numSamples} samples`);
                    resolve();
                };

                source.onerror = (error) => {
                    this.debug.log('Error during audio playback:', error);
                    reject(error);
                };

                source.start();
                this.debug.log(`Playing enhanced PCM16 audio: ${numSamples} samples at ${sampleRate}Hz with compression`);
            });

        } catch (error) {
            this.debug.log('Error playing PCM16 audio response:', error);
            throw error;
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        if (this.isConnecting) return 'connecting';
        if (this.isConnected) return 'connected';
        return 'disconnected';
    }

    /**
     * Schedule audio commit with delay to ensure sufficient audio
     */
    scheduleAudioCommit() {
        // Clear any existing timer
        if (this.speechStopTimer) {
            clearTimeout(this.speechStopTimer);
        }

        // Wait 500ms after speech stops to ensure we have enough audio
        this.speechStopTimer = setTimeout(() => {
            this.commitAudioAndRespond();
        }, 500);
    }

    /**
     * Commit audio buffer and request response from OpenAI
     */
    commitAudioAndRespond() {
        if (this.isResponseActive) {
            this.debug.log('Response already active, skipping new request');
            return;
        }

        this.debug.log('Committing audio buffer and requesting response...');

        // Commit the input audio buffer
        this.sendMessage({
            type: 'input_audio_buffer.commit'
        });

        // Create a response with explicit instructions for complete responses
        this.sendMessage({
            type: 'response.create',
            response: {
                modalities: ['text', 'audio'],
                instructions: 'Please provide a complete and detailed response to the user\'s financial question. Include all relevant information and end with asking if there is anything else you can help with. Do not truncate your response.'
            }
        });

        this.isResponseActive = true;
        this.debug.log('Response creation requested with complete response instructions');
    }

    /**
     * Update audio level indicator
     */
    updateAudioLevel(inputBuffer) {
        try {
            const audioData = inputBuffer.getChannelData(0);

            // Calculate RMS for audio level
            let sum = 0;
            for (let i = 0; i < audioData.length; i++) {
                sum += audioData[i] * audioData[i];
            }
            const rms = Math.sqrt(sum / audioData.length);
            const level = Math.min(100, Math.max(0, rms * 100 / 0.1)); // Scale to 0-100

            // Update UI elements
            const audioLevelFill = document.getElementById('audioLevel');
            const audioLevelText = document.getElementById('audioLevelText');

            if (audioLevelFill) {
                audioLevelFill.style.width = level + '%';
            }

            if (audioLevelText) {
                audioLevelText.textContent = Math.round(level) + '%';
            }

        } catch (error) {
            this.debug.log('Error updating audio level:', error);
        }
    }

    /**
     * Alternative audio playback method using Web Audio API decoding
     */
    async playAudioAlternative(audioData) {
        try {
            this.debug.log('Trying alternative audio playback method');

            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Convert base64 to ArrayBuffer
            const binaryString = atob(audioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Try to decode as standard audio format first
            try {
                const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer.slice());
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.audioContext.destination);
                source.start();
                this.debug.log('Alternative audio playback successful');
                return;
            } catch (decodeError) {
                this.debug.log('Standard audio decode failed, using PCM16 method');
                // Fall back to PCM16 method
                return this.playPCM16Audio(bytes.buffer);
            }

        } catch (error) {
            this.debug.log('Alternative audio playback failed:', error);
            throw error;
        }
    }

    /**
     * Display user message in chat interface
     */
    displayUserMessage(transcript) {
        try {
            const conversation = document.getElementById('conversation');
            if (conversation) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'user-message';
                messageDiv.innerHTML = `<div class="message-content">${transcript}</div>`;
                conversation.appendChild(messageDiv);
                conversation.scrollTop = conversation.scrollHeight;
                this.debug.log('User message displayed in chat');
            }
        } catch (error) {
            this.debug.log('Error displaying user message:', error);
        }
    }

    /**
     * Accumulate text response chunks
     */
    accumulateTextResponse(delta) {
        if (!this.currentTextResponse) {
            this.currentTextResponse = '';
        }
        this.currentTextResponse += delta;
    }

    /**
     * Display bot message directly
     */
    displayBotMessage(text) {
        try {
            const conversation = document.getElementById('conversation');
            if (conversation) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'bot-message';
                messageDiv.innerHTML = `<div class="message-content">${text}</div>`;
                conversation.appendChild(messageDiv);
                conversation.scrollTop = conversation.scrollHeight;
                this.debug.log('Bot message displayed in chat:', text);

                // Also update debug panel
                this.updateDebugPanel('gptResponse', text);
            }
        } catch (error) {
            this.debug.log('Error displaying bot message:', error);
        }
    }

    /**
     * Display complete bot text response
     */
    displayBotTextResponse() {
        try {
            if (this.currentTextResponse) {
                this.displayBotMessage(this.currentTextResponse);
                this.currentTextResponse = '';
            }
        } catch (error) {
            this.debug.log('Error displaying bot text response:', error);
        }
    }

    /**
     * Indicate audio response in chat
     */
    indicateAudioResponse() {
        if (!this.hasAudioResponse) {
            this.hasAudioResponse = true;
            try {
                const conversation = document.getElementById('conversation');
                if (conversation) {
                    this.audioResponseElement = document.createElement('div');
                    this.audioResponseElement.className = 'bot-message';
                    this.audioResponseElement.innerHTML = `<div class="message-content">🔊 <em>Playing audio response...</em></div>`;
                    conversation.appendChild(this.audioResponseElement);
                    conversation.scrollTop = conversation.scrollHeight;
                    this.debug.log('Audio response indicator added to chat');
                }
            } catch (error) {
                this.debug.log('Error indicating audio response:', error);
            }
        }
    }

    /**
     * Complete audio response display
     */
    completeAudioResponse() {
        if (this.hasAudioResponse && this.audioResponseElement) {
            try {
                // Wait a bit to ensure all audio has finished playing
                setTimeout(() => {
                    if (this.audioResponseElement) {
                        this.audioResponseElement.innerHTML = `<div class="message-content">🔊 <em>Audio response completed</em></div>`;
                        this.debug.log('Audio response completed in chat');
                    }
                }, 1000);
            } catch (error) {
                this.debug.log('Error completing audio response:', error);
            }
        }
        // Reset for next response
        this.hasAudioResponse = false;
        this.audioResponseElement = null;
    }

    /**
     * Get current persona information from the main app
     */
    getCurrentPersonaInfo() {
        try {
            // Access the main app instance to get current persona
            if (window.app && window.app.personaManager) {
                const persona = window.app.personaManager.getCurrentPersonaData();
                this.debug.log('Retrieved persona info:', persona?.name || 'Unknown');
                return persona;
            }
            this.debug.log('No persona information available');
            return null;
        } catch (error) {
            this.debug.log('Error getting persona info:', error);
            return null;
        }
    }

    /**
     * Generate instructions with persona context and agent-specific guidance
     * @param {Object} persona - Current persona information
     * @param {string} agentName - Name of the current agent (optional)
     */
    generateInstructions(persona, agentName = null) {
        try {
            // Use the SystemPromptsManager from the main app if available
            if (window.app && window.app.systemPromptsManager) {
                this.debug.log('Using SystemPromptsManager for streaming instructions', {
                    agentName: agentName
                });
                return window.app.systemPromptsManager.generateSystemPrompt(persona, 'streaming', agentName);
            }
        } catch (error) {
            this.debug.log('Error using SystemPromptsManager, falling back to hardcoded:', error);
        }

        // Fallback to hardcoded instructions if SystemPromptsManager is not available
        this.debug.log('Using fallback hardcoded instructions for streaming', {
            agentName: agentName
        });
        
        let instructions = `You are a helpful, professional, and friendly financial services AI assistant. You should be empathetic, clear in your communication, and always prioritize customer satisfaction. Speak in a conversational tone while maintaining professionalism.

Keep responses conversational and concise (suitable for voice). Use natural speech patterns with contractions (I'll, you're, we'll). Sound human and empathetic, not robotic. Use clear, simple language avoiding jargon. Always end with asking if there's anything else you can help with. Maximum response length: 2-3 sentences for voice clarity.`;

        // Add agent-specific instructions if agent is specified
        if (agentName) {
            const agentInstructions = this.getAgentSpecificInstructions(agentName);
            if (agentInstructions) {
                instructions += `\n\nAGENT CONTEXT: ${agentInstructions}`;
            }
        }

        if (persona) {
            instructions += `\n\nCURRENT CUSTOMER INFORMATION:
- Name: ${persona.name}
- Account Balance: ${window.app && window.app.personaManager ? window.app.personaManager.formatCurrency(persona.balance) : '£' + persona.balance.toFixed(2)}
- Card ending in: ${persona.cardLast4}
- Account Type: ${persona.accountType}
- Recent Transactions: ${persona.recentTransactions.map(t =>
                `${t.date}: ${window.app && window.app.personaManager ? window.app.personaManager.formatCurrency(t.amount) : '£' + t.amount.toFixed(2)} - ${t.description}`
            ).join(', ')}

When the customer asks about their account, balance, transactions, or card, use this specific information. Address them by name when appropriate.`;
        }

        return instructions;
    }

    /**
     * Generate default instructions for an agent
     * @param {Object} agent - Agent instance
     * @returns {string} - Default instructions
     */
    generateDefaultInstructions(agent) {
        try {
            const currentPersona = this.getCurrentPersonaInfo();
            return this.generateInstructions(currentPersona, agent.name);
        } catch (error) {
            this.debug.error('Error generating default instructions', {
                error: error.message,
                agentName: agent.name
            });
            return 'You are a helpful financial services AI assistant. Provide clear, concise responses suitable for voice interaction.';
        }
    }

    /**
     * Get agent-specific instructions for streaming context
     * @param {string} agentName - Name of the agent
     * @returns {string} - Agent-specific instructions
     */
    getAgentSpecificInstructions(agentName) {
        const agentInstructions = {
            'FraudAgent': 'You are now operating as a fraud prevention specialist. Focus on security concerns, card blocking, suspicious activity, and account protection. Use a confident, security-focused tone while being reassuring.',
            
            'PaymentsAgent': 'You are now operating as a payments specialist. Focus on money transfers, payment processing, transaction confirmations, and payment-related inquiries. Be precise with amounts and verification details.',
            
            'IDVAgent': 'You are now operating as an identity verification specialist. Focus on account security, password resets, authentication processes, and identity verification. Be thorough but user-friendly with security procedures.',
            
            'BankingInfoAgent': 'You are now operating as a banking information specialist. Focus on account balances, transaction history, statements, and general account information. Provide accurate and helpful account details.',
            
            'MultiAgentOrchestrator': 'You are coordinating multiple banking services. Handle complex requests that may require multiple types of assistance. Provide comprehensive banking support.',
            
            'DefaultAgent': 'You are providing general banking assistance. Handle a wide range of banking inquiries with friendly, professional service.'
        };

        return agentInstructions[agentName] || null;
    }

    /**
     * Flush remaining audio when response is complete
     */
    flushRemainingAudio() {
        this.debug.log(`Flushing remaining audio - Buffer: ${this.audioBuffer.length}, Queue: ${this.audioQueue.length}`);

        // Move all buffered chunks to queue regardless of buffer size
        while (this.audioBuffer.length > 0) {
            this.audioQueue.push(this.audioBuffer.shift());
        }

        // Start playing if not already playing
        if (!this.isPlayingAudio && this.audioQueue.length > 0) {
            this.debug.log(`Starting final playback with ${this.audioQueue.length} remaining chunks`);
            this.playQueuedAudio();
        }
    }

    /**
     * Flush any remaining audio buffer when response is complete
     */
    flushAudioBuffer() {
        if (this.audioBuffer.length > 0) {
            this.debug.log(`Flushing ${this.audioBuffer.length} remaining audio chunks`);

            // If not currently playing, start playback with remaining chunks
            if (!this.isPlayingAudio) {
                this.startBufferedPlayback();
            } else {
                // If already playing, the chunks will be picked up by the continuous playback
                this.debug.log('Audio already playing, buffered chunks will be processed automatically');
            }
        }
    }

    /**
     * Update debug panel
     */
    updateDebugPanel(elementId, content) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                const timestamp = new Date().toLocaleTimeString();
                element.textContent = `[${timestamp}] ${content}`;
            }
        } catch (error) {
            this.debug.log('Error updating debug panel:', error);
        }
    }

    /**
     * Get audio streaming status
     */
    getAudioStatus() {
        return this.isStreamingAudio ? 'streaming' : 'stopped';
    }

    /**
     * Clear conversation state
     */
    clearConversationState() {
        this.debug.log('Clearing streaming conversation state');
        
        // Reset text response accumulation
        this.currentTextResponse = '';
        this.currentUserTranscript = '';
        
        // Reset response state
        this.isResponseActive = false;
        this.audioResponseStarted = false;
        this.hasAudioResponse = false;
        
        // Clear audio buffers
        this.audioQueue = [];
        this.audioBuffer = [];
        this.audioChunks = [];
        this.totalAudioChunks = 0;
        
        // Reset session tracking for new conversation
        this.resetSessionTracking();
        
        this.debug.log('Streaming conversation state cleared');
    }

    /**
     * Initialize agent routing integration
     */
    initializeAgentRouting() {
        try {
            this.debug.log('Initializing agent routing integration...');
            
            // Check if required components are available
            if (typeof window.StreamingAgentRouter === 'function' && 
                typeof window.StreamingResponseHandler === 'function' &&
                window.agentRouter) {
                
                // Initialize StreamingAgentRouter
                this.streamingAgentRouter = new window.StreamingAgentRouter(
                    window.agentRouter, 
                    this
                );
                
                // Initialize StreamingResponseHandler
                this.streamingResponseHandler = new window.StreamingResponseHandler(this);
                
                // Initialize StreamingAgentMiddleware if available
                if (typeof window.StreamingAgentMiddleware === 'function') {
                    this.streamingAgentMiddleware = new window.StreamingAgentMiddleware(
                        this,
                        this.streamingAgentRouter
                    );
                    this.debug.log('StreamingAgentMiddleware initialized');
                }
                
                // Initialize StreamingSessionManager
                if (typeof window.StreamingSessionManager === 'function') {
                    this.streamingSessionManager = new window.StreamingSessionManager(
                        this,
                        this.streamingAgentRouter
                    );
                    
                    // Connect session manager to router
                    if (typeof this.streamingAgentRouter.setSessionManager === 'function') {
                        this.streamingAgentRouter.setSessionManager(this.streamingSessionManager);
                    }
                    
                    this.debug.log('StreamingSessionManager initialized and connected');
                }
                
                // Enable agent routing by default if components are available
                this.agentRoutingEnabled = true;
                
                this.debug.log('Agent routing integration initialized successfully', {
                    hasStreamingAgentRouter: !!this.streamingAgentRouter,
                    hasStreamingResponseHandler: !!this.streamingResponseHandler,
                    agentRoutingEnabled: this.agentRoutingEnabled
                });
                
            } else {
                this.debug.log('Agent routing components not available, running in standard streaming mode', {
                    hasStreamingAgentRouter: typeof window.StreamingAgentRouter === 'function',
                    hasStreamingResponseHandler: typeof window.StreamingResponseHandler === 'function',
                    hasAgentRouter: !!window.agentRouter
                });
                this.agentRoutingEnabled = false;
            }
            
        } catch (error) {
            this.debug.error('Failed to initialize agent routing integration:', error);
            this.agentRoutingEnabled = false;
        }
        
        // Load configuration after initialization
        this.loadAgentRoutingConfiguration();
        
        // Listen for configuration changes
        this.setupConfigurationEventListeners();
    }

    /**
     * Initialize performance optimizer for streaming routing
     */
    initializePerformanceOptimizer() {
        try {
            this.debug.log('Initializing performance optimizer...');
            
            // Check if performance optimizer is available and agent routing is initialized
            if (typeof window.StreamingPerformanceOptimizer === 'function' && 
                this.streamingAgentRouter) {
                
                // Initialize performance optimizer
                this.streamingPerformanceOptimizer = new window.StreamingPerformanceOptimizer(
                    this.streamingAgentRouter,
                    this
                );
                
                // Set the optimizer in the agent router
                this.streamingAgentRouter.setPerformanceOptimizer(this.streamingPerformanceOptimizer);
                
                this.debug.log('Performance optimizer initialized successfully', {
                    hasOptimizer: !!this.streamingPerformanceOptimizer,
                    optimizationEnabled: this.streamingAgentRouter.optimizationEnabled
                });
                
            } else {
                this.debug.log('Performance optimizer not available or agent routing not initialized', {
                    hasOptimizerClass: typeof window.StreamingPerformanceOptimizer === 'function',
                    hasAgentRouter: !!this.streamingAgentRouter
                });
            }
            
        } catch (error) {
            this.debug.error('Failed to initialize performance optimizer:', error);
            this.streamingPerformanceOptimizer = null;
        }
    }

    /**
     * Load agent routing configuration from StreamingAgentConfig
     */
    loadAgentRoutingConfiguration() {
        try {
            // Use a timeout to ensure StreamingAgentConfig is loaded
            setTimeout(() => {
                if (window.streamingAgentConfig) {
                    const config = window.streamingAgentConfig.getConfiguration();
                    this.updateAgentRoutingConfig(config);
                    this.debug.log('Agent routing configuration loaded successfully');
                } else {
                    // Set default enabled state
                    this.agentRoutingEnabled = false;
                    this.debug.log('StreamingAgentConfig not available, using default settings');
                }
            }, 100);
        } catch (error) {
            this.debug.error('Error loading agent routing configuration:', error);
            this.agentRoutingEnabled = false;
        }
    }

    /**
     * Update agent routing configuration
     * @param {Object} config - Configuration object from StreamingAgentConfig
     */
    updateAgentRoutingConfig(config) {
        try {
            this.debug.log('Updating agent routing configuration', config);
            
            // Update enabled state
            this.agentRoutingEnabled = config.enabled && !!this.streamingAgentRouter;
            
            // Update voice configuration with agent-specific voices
            if (config.agentVoices) {
                Object.entries(config.agentVoices).forEach(([agentName, voiceConfig]) => {
                    this.voiceConfiguration.agentVoices.set(agentName, voiceConfig);
                });
            }
            
            // Update voice settings
            if (config.voiceSettings) {
                this.voiceConfiguration.fallbackVoice = config.voiceSettings.fallbackVoice || 'shimmer';
                this.voiceConfiguration.enableVoiceSwitching = config.voiceSettings.enableVoiceSwitching !== false;
                this.voiceConfiguration.smoothTransitions = config.voiceSettings.smoothTransitions !== false;
                this.voiceConfiguration.transitionDelay = config.voiceSettings.transitionDelay || 200;
            }
            
            // Update routing settings if StreamingAgentRouter is available
            if (this.streamingAgentRouter && typeof this.streamingAgentRouter.updateConfiguration === 'function') {
                this.streamingAgentRouter.updateConfiguration(config);
            }
            
            this.debug.log('Agent routing configuration updated successfully', {
                enabled: this.agentRoutingEnabled,
                agentVoicesCount: this.voiceConfiguration.agentVoices.size,
                fallbackVoice: this.voiceConfiguration.fallbackVoice
            });
            
        } catch (error) {
            this.debug.error('Error updating agent routing configuration:', error);
        }
    }

    /**
     * Setup event listeners for configuration changes
     */
    setupConfigurationEventListeners() {
        try {
            // Listen for configuration changes from StreamingAgentConfig
            window.addEventListener('streamingAgentConfigChanged', (event) => {
                if (event.detail && event.detail.config) {
                    this.debug.log('Configuration change event received');
                    this.updateAgentRoutingConfig(event.detail.config);
                }
            });
            
            this.debug.log('Configuration event listeners setup successfully');
        } catch (error) {
            this.debug.error('Error setting up configuration event listeners:', error);
        }
    }

    /**
     * Route transcript through agent system
     * @param {string} transcript - Transcribed user message
     */
    async routeThroughAgents(transcript) {
        try {
            this.debug.log('Routing transcript through agents:', transcript.substring(0, 100));
            
            if (!this.streamingAgentRouter) {
                this.debug.warn('StreamingAgentRouter not available, falling back to standard streaming');
                this.handleTranscriptionFallback(transcript);
                return;
            }

            // Get or create session context
            let sessionContext = this.getSessionContext();
            let sessionId = null;
            
            // Create or get session if session manager is available
            if (this.streamingSessionManager) {
                const currentSession = this.streamingSessionManager.getCurrentSession();
                if (!currentSession) {
                    sessionId = this.streamingSessionManager.createSession({
                        conversationContext: sessionContext,
                        voiceConfiguration: this.getVoiceConfiguration()
                    });
                    this.debug.log('Created new streaming session', { sessionId });
                } else {
                    sessionId = currentSession.sessionId;
                    this.debug.log('Using existing streaming session', { sessionId });
                }
                
                // Update session context with session ID
                sessionContext.sessionId = sessionId;
            }
            
            // Route through agent system
            const routingResult = await this.streamingAgentRouter.routeStreamingMessage(
                transcript, 
                sessionContext
            );

            if (routingResult.success) {
                this.debug.log('Agent routing successful', {
                    selectedAgent: routingResult.selectedAgent?.name,
                    agentChanged: routingResult.agentChanged,
                    sessionUpdateRequired: routingResult.sessionUpdateRequired
                });

                // Check if agent changed and handle voice switching
                const previousAgent = this.currentStreamingAgent?.name || 'DefaultAgent';
                const newAgent = routingResult.selectedAgent?.name || 'DefaultAgent';
                
                if (newAgent !== previousAgent) {
                    this.debug.log('Agent changed, switching voice', {
                        fromAgent: previousAgent,
                        toAgent: newAgent
                    });

                    // Switch voice for new agent
                    const voiceSwitchSuccess = await this.switchAgentVoice(newAgent, this.getSessionContext());
                    
                    if (!voiceSwitchSuccess) {
                        this.debug.warn('Voice switch failed, continuing with current voice', {
                            targetAgent: newAgent,
                            currentVoice: this.voiceConfiguration.currentVoice
                        });
                    }
                }

                // Update session with agent response
                await this.updateSessionWithAgentResponse(routingResult);
                
                // Update current streaming agent
                if (routingResult.selectedAgent) {
                    this.currentStreamingAgent = routingResult.selectedAgent;
                }
                
            } else {
                this.debug.warn('Agent routing failed, falling back to standard streaming', {
                    fallbackReason: routingResult.fallbackReason,
                    error: routingResult.error
                });
                
                // Fallback to standard streaming
                this.handleTranscriptionFallback(transcript);
            }

        } catch (error) {
            this.debug.error('Error routing through agents:', error);
            this.handleTranscriptionFallback(transcript);
        }
    }

    /**
     * Update OpenAI session with agent response
     * @param {Object} routingResult - Result from agent routing
     */
    async updateSessionWithAgentResponse(routingResult) {
        try {
            this.debug.log('Updating session with agent response', {
                agentName: routingResult.selectedAgent?.name,
                sessionUpdateRequired: routingResult.sessionUpdateRequired
            });

            if (!routingResult.agentResponse) {
                this.debug.warn('No agent response to update session with');
                return;
            }

            // Process agent response for streaming if response handler is available
            let processedResponse = routingResult.agentResponse;
            if (this.streamingResponseHandler) {
                const streamingContext = this.getSessionContext();
                processedResponse = await this.streamingResponseHandler.processAgentResponse(
                    routingResult.agentResponse,
                    streamingContext
                );
            }

            // Update session instructions if required
            if (routingResult.sessionUpdateRequired && routingResult.selectedAgent) {
                let sessionUpdateResult;
                
                // Use session manager if available
                if (this.streamingSessionManager) {
                    const currentSession = this.streamingSessionManager.getCurrentSession();
                    if (currentSession) {
                        const agentContext = {
                            agentName: routingResult.selectedAgent.name,
                            agentType: routingResult.selectedAgent.type || 'unknown',
                            switchReason: routingResult.routingReason || 'context_change'
                        };
                        
                        const instructions = processedResponse.streamingInstructions || 
                                           routingResult.agentResponse.streamingInstructions ||
                                           this.generateDefaultInstructions(routingResult.selectedAgent);
                        
                        const updateSuccess = await this.streamingSessionManager.updateSessionForAgent(
                            currentSession.sessionId,
                            agentContext,
                            instructions
                        );
                        
                        sessionUpdateResult = {
                            success: updateSuccess,
                            error: updateSuccess ? null : 'Session manager update failed'
                        };
                    } else {
                        this.debug.warn('No current session available for update');
                        sessionUpdateResult = { success: false, error: 'No current session' };
                    }
                } else {
                    // Fallback to direct router update
                    sessionUpdateResult = await this.streamingAgentRouter.updateSessionForAgent(
                        routingResult.selectedAgent,
                        this.getSessionContext()
                    );
                }

                if (sessionUpdateResult.success) {
                    this.debug.log('Session updated successfully for agent', {
                        agentName: routingResult.selectedAgent.name,
                        usingSessionManager: !!this.streamingSessionManager
                    });
                } else {
                    this.debug.warn('Failed to update session for agent', {
                        error: sessionUpdateResult.error,
                        agentName: routingResult.selectedAgent.name,
                        usingSessionManager: !!this.streamingSessionManager
                    });
                }
            }

            // Generate response using OpenAI with updated session
            if (processedResponse.success && processedResponse.response) {
                // Create a conversation item with the agent's response
                const responseMessage = {
                    type: 'conversation.item.create',
                    item: {
                        type: 'message',
                        role: 'assistant',
                        content: [{
                            type: 'text',
                            text: processedResponse.response
                        }]
                    }
                };

                // Send the agent response to OpenAI for audio generation
                this.sendMessage(responseMessage);

                // Create response to trigger audio generation
                const createResponse = {
                    type: 'response.create',
                    response: {
                        modalities: ['audio', 'text'],
                        instructions: `Please respond with the following message in the configured voice: "${processedResponse.response}"`
                    }
                };

                this.sendMessage(createResponse);

                this.debug.log('Agent response sent to OpenAI for audio generation', {
                    responseLength: processedResponse.response.length,
                    agentName: routingResult.selectedAgent?.name
                });
            }

        } catch (error) {
            this.debug.error('Error updating session with agent response:', error);
            // Don't fallback here as the session update might have partially succeeded
        }
    }

    /**
     * Handle fallback to standard streaming when agent routing fails
     * @param {string} transcript - Original transcript to process
     */
    handleTranscriptionFallback(transcript) {
        try {
            this.debug.log('Handling transcription fallback for:', transcript.substring(0, 50));

            // Create a conversation item with the user's transcript
            const userMessage = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: transcript
                    }]
                }
            };

            // Send user message
            this.sendMessage(userMessage);

            // Create response to generate standard OpenAI response
            const createResponse = {
                type: 'response.create',
                response: {
                    modalities: ['audio', 'text']
                }
            };

            this.sendMessage(createResponse);

            this.debug.log('Fallback to standard streaming initiated');

        } catch (error) {
            this.debug.error('Error in transcription fallback:', error);
        }
    }

    /**
     * Get current session context for agent routing
     * @returns {Object} - Session context object
     */
    getSessionContext() {
        return {
            sessionId: this.connectionId || 'streaming_session',
            currentAgent: this.currentStreamingAgent,
            conversationContext: {
                isStreamingMode: true,
                hasAudioResponse: this.hasAudioResponse,
                isResponseActive: this.isResponseActive
            },
            voiceConfiguration: this.getVoiceConfiguration(),
            streamingSession: this.streamingSession,
            timestamp: Date.now()
        };
    }



    /**
     * Initialize error handler
     */
    initializeErrorHandler() {
        try {
            if (typeof StreamingErrorHandler !== 'undefined') {
                this.streamingErrorHandler = new StreamingErrorHandler(this);
                this.debug.log('Streaming error handler initialized');
            }
        } catch (error) {
            this.debug.error('Error initializing error handler:', error);
        }
    }

    /**
     * Route transcript through agents with error handling
     * @param {string} transcript - The transcribed text to route
     */
    async routeThroughAgentsWithErrorHandling(transcript) {
        const startTime = Date.now();
        
        try {
            // Update UI to show agent switching
            if (window.streamingAgentUI) {
                window.streamingAgentUI.showAgentSwitching();
                window.streamingAgentUI.logRoutingState(`Starting agent routing for: "${transcript.substring(0, 50)}..."`);
            }

            // Route through the streaming agent router
            const routingResult = await this.streamingAgentRouter.routeStreamingMessage(
                transcript, 
                this.getSessionContext()
            );

            const routingLatency = Date.now() - startTime;

            if (routingResult.success) {
                // Update current agent
                this.currentStreamingAgent = routingResult.selectedAgent?.name || 'DefaultAgent';
                
                // Update UI with new agent
                if (window.streamingAgentUI) {
                    window.streamingAgentUI.updateCurrentAgent(
                        this.currentStreamingAgent,
                        routingResult.selectedAgent?.type
                    );
                    window.streamingAgentUI.hideAgentSwitching();
                    window.streamingAgentUI.addPerformanceMetric('routingLatency', routingLatency);
                    window.streamingAgentUI.logAgentDecision(
                        `Routed to ${this.currentStreamingAgent} (${routingLatency}ms)`,
                        'success'
                    );
                }

                // Update session with agent response
                await this.updateSessionWithAgentResponse(routingResult);

                this.debug.log('Agent routing completed successfully', {
                    agent: this.currentStreamingAgent,
                    latency: routingLatency
                });

            } else {
                // Routing failed, fallback to standard streaming
                this.debug.log('Agent routing failed, falling back to standard streaming');
                
                if (window.streamingAgentUI) {
                    window.streamingAgentUI.hideAgentSwitching();
                    window.streamingAgentUI.addPerformanceMetric('fallback', 1);
                    window.streamingAgentUI.logAgentDecision(
                        `Routing failed: ${routingResult.error || 'Unknown error'}`,
                        'error'
                    );
                }

                this.handleTranscriptionFallback(transcript);
            }

        } catch (error) {
            const routingLatency = Date.now() - startTime;
            this.debug.error('Error in agent routing:', error);

            // Update UI with error state
            if (window.streamingAgentUI) {
                window.streamingAgentUI.hideAgentSwitching();
                window.streamingAgentUI.addPerformanceMetric('fallback', 1);
                window.streamingAgentUI.logAgentDecision(
                    `Routing error: ${error.message}`,
                    'error'
                );
            }

            // Fallback to standard streaming
            this.handleTranscriptionFallback(transcript);
        }
    }

    /**
     * Enable or disable agent routing
     * @param {boolean} enabled - Whether to enable agent routing
     */
    setAgentRoutingEnabled(enabled) {
        const wasEnabled = this.agentRoutingEnabled;
        this.agentRoutingEnabled = enabled && !!this.streamingAgentRouter;
        
        this.debug.log('Agent routing enabled state changed', {
            wasEnabled: wasEnabled,
            nowEnabled: this.agentRoutingEnabled,
            requested: enabled,
            hasComponents: !!this.streamingAgentRouter
        });

        // Reset current agent if disabling
        if (!this.agentRoutingEnabled) {
            this.currentStreamingAgent = null;
        }
    }

    /**
     * Get agent routing status and statistics
     * @returns {Object} - Agent routing status
     */
    getAgentRoutingStatus() {
        return {
            enabled: this.agentRoutingEnabled,
            currentAgent: this.currentStreamingAgent,
            hasStreamingAgentRouter: !!this.streamingAgentRouter,
            hasStreamingResponseHandler: !!this.streamingResponseHandler,
            routingStats: this.streamingAgentRouter ? 
                this.streamingAgentRouter.getRoutingStats() : null,
            sessionContext: this.getSessionContext()
        };
    }

    /**
     * Reset agent routing state (useful for new conversations)
     */
    resetAgentRoutingState() {
        this.debug.log('Resetting agent routing state');
        
        this.currentStreamingAgent = null;
        
        if (this.streamingAgentRouter) {
            this.streamingAgentRouter.resetSession();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingManager;
}

// Export to global scope for browser usage
if (typeof window !== 'undefined') {
    window.StreamingManager = StreamingManager;
}
class SpeechToSpeechApp {
    constructor() {
        this.openaiApiKey = '';
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        // Initialize debug logger for this module
        this.debug = window.debugManager.createModuleLogger('SpeechToSpeechApp');

        // Initialize persona manager
        this.personaManager = new PersonaManager();

        // Initialize system prompts manager
        this.systemPromptsManager = new SystemPromptsManager();

        // Initialize voice configuration manager
        this.voiceConfigManager = new VoiceConfigManager();

        // Initialize API client and token tracker
        this.tokenTracker = new TokenTracker();
        this.apiClient = new OpenAIClient(this.openaiApiKey, this.tokenTracker);

        // Initialize AgentRouter with all domain agents
        this.initializeAgentRouter();

        // Initialize LLM Manager integration
        this.initializeLLMManager();

        // Initialize agent telemetry if available
        if (window.agentTelemetry) {
            window.agentTelemetry.enable();
            this.debug.info('Agent telemetry initialized and enabled');
        }

        // Initialize telemetry hooks manager for extensibility
        try {
            if (typeof TelemetryHooksManager !== 'undefined') {
                window.telemetryHooksManager = new TelemetryHooksManager();
                this.debug.info('Telemetry hooks manager initialized');
            } else {
                this.debug.warn('TelemetryHooksManager not available');
            }
        } catch (error) {
            this.debug.error('Failed to initialize telemetry hooks manager', { error: error.message });
        }

        // Initialize streaming manager with token tracker
        this.streamingManager = new StreamingManager(this.openaiApiKey, this.debugStreamingMessage.bind(this), this.tokenTracker);

        // Streaming mode properties
        this.isStreamingMode = localStorage.getItem('streaming_mode') === 'true' || false;
        this.isConnected = false;
        this.websocket = null;
        this.audioContext = null;
        this.processor = null;
        this.silenceTimer = null;
        this.isSpeaking = false;

        // Mute functionality
        this.isMuted = false;
        this.mutedStream = null;

        // Microphone stream caching
        this.cachedMicStream = null;
        this.micPermissionGranted = false;

        // State management
        this.currentState = 'ready'; // ready, recording, processing, speaking
        this.currentAudio = null; // Track current audio element for cleanup

        // Audio monitoring
        this.audioAnalyser = null;
        this.audioLevelInterval = null;

        // GPT model setting
        this.gptModel = localStorage.getItem('gpt_model') || 'gpt-3.5-turbo';

        // Conversation context for AI-powered agent routing
        this.conversationHistory = [];
        this.lastAgentUsed = null;

        // TTS settings
        this.ttsMode = localStorage.getItem('tts_mode') || 'openai';
        this.ttsSettings = {
            model: localStorage.getItem('tts_model') || 'tts-1',
            voice: localStorage.getItem('tts_voice') || 'nova',
            speed: parseFloat(localStorage.getItem('tts_speed')) || 1.0
        };

        // Browser TTS settings
        this.browserTtsSettings = {
            voice: localStorage.getItem('browser_tts_voice') || '',
            rate: parseFloat(localStorage.getItem('browser_tts_rate')) || 1.0,
            pitch: parseFloat(localStorage.getItem('browser_tts_pitch')) || 1.0,
            volume: parseFloat(localStorage.getItem('browser_tts_volume')) || 1.0
        };

        // Available browser voices
        this.availableVoices = [];

        // Speech recognition settings
        this.speechSettings = {
            audioQuality: localStorage.getItem('audio_quality') || 'high',
            noiseReduction: localStorage.getItem('noise_reduction') || 'medium',
            whisperLanguage: localStorage.getItem('whisper_language') || 'en',
            recognitionMode: localStorage.getItem('recognition_mode') || 'financial',
            keepMicActive: localStorage.getItem('keep_mic_active') === 'true' || true // Default to true to avoid permission popups
        };

        // Fix for old localStorage data - force reset to 'en' if it's 'en-US'
        if (this.speechSettings.whisperLanguage === 'en-US') {
            this.speechSettings.whisperLanguage = 'en';
            localStorage.setItem('whisper_language', 'en');
            console.log('Fixed old language setting from en-US to en');
        }

        // Debug: Check what's actually stored
        console.log('Loaded speech settings:', this.speechSettings);

        // Streaming settings
        this.streamingSettings = {
            responseDelay: parseFloat(localStorage.getItem('response_delay')) || 1.0,
            vadSensitivity: localStorage.getItem('vad_sensitivity') || 'medium',
            audioBufferSize: localStorage.getItem('audio_buffer_size') || 'medium',
            connectionQuality: localStorage.getItem('connection_quality') || 'auto'
        };





        this.init();
    }

    /**
     * Initialize AgentRouter with all domain-specific agents
     */
    initializeAgentRouter() {
        try {
            // Check if required classes are available
            if (typeof BaseAgent === 'undefined' || 
                typeof IDVAgent === 'undefined' || 
                typeof BankingInfoAgent === 'undefined' || 
                typeof FraudAgent === 'undefined' || 
                typeof PaymentsAgent === 'undefined' || 
                typeof AgentRouter === 'undefined' ||
                typeof AgentConfigManager === 'undefined') {
                throw new Error('Agent classes not loaded - falling back to original behavior');
            }

            // Initialize AgentRouter first (this creates the configuration manager)
            this.agentRouter = new AgentRouter([]);

            // Create domain-specific agents and register them with configurations
            const agents = [
                { class: PaymentsAgent, name: 'PaymentsAgent' },
                { class: FraudAgent, name: 'FraudAgent' },
                { class: IDVAgent, name: 'IDVAgent' },
                { class: BankingInfoAgent, name: 'BankingInfoAgent' }
            ];

            // Register each agent with the router
            agents.forEach(({ class: AgentClass, name }) => {
                try {
                    const agent = new AgentClass();
                    this.agentRouter.registerAgent(agent);
                    this.debug.info(`${name} registered successfully`);
                } catch (agentError) {
                    this.debug.error(`Failed to register ${name}`, { error: agentError.message });
                }
            });

            const stats = this.agentRouter.getStats();
            this.debug.info('AgentRouter initialized successfully with configuration management', {
                totalAgents: stats.totalAgents,
                enabledAgents: stats.enabledAgents,
                disabledAgents: stats.disabledAgents,
                agentNames: stats.agentNames
            });

            // Make AgentRouter available globally for extensibility system
            window.agentRouter = this.agentRouter;

        } catch (error) {
            this.debug.error('Failed to initialize AgentRouter', { error: error.message });
            // Set agentRouter to null so we can fall back to original behavior
            this.agentRouter = null;
        }
    }

    async init() {
        // Initialize persona manager first
        await this.personaManager.init();

        // Initialize system prompts manager
        await this.systemPromptsManager.init();

        // Set up currency formatter for system prompts
        this.systemPromptsManager.setCurrencyFormatter(this.personaManager.formatCurrency.bind(this.personaManager));

        this.setupEventListeners();
        this.setupCleanupListeners();
        this.loadPersonas();
        this.updatePersonaSelector();
        this.initializeGptSettings();
        this.initializeTtsSettings();
        this.initializeBrowserTts();
        this.initializeSpeechSettings();
        this.initializeStreamingSettings();
        this.initializeSystemPrompts();
        this.initializeDebugSettings();
        
        // Ensure token tracker is properly linked to API client
        this.apiClient.setTokenTracker(this.tokenTracker);
        this.tokenTracker.updateDisplay();
        
        // Log token tracking status for debugging
        this.debug.log('Token tracking initialized:', {
            hasTokenTracker: !!this.tokenTracker,
            apiClientHasTracker: !!this.apiClient.tokenTracker,
            currentUsage: this.tokenTracker.getUsage()
        });
        
        this.initializeStreamingMode();
        this.initializeMuteButtons();
        
        // Initialize agent indicator
        this.updateAgentIndicator('Default Agent');
        
        // Initialize extensibility system
        await this.initializeExtensibilitySystem();
        this.updateKeyStatus();

        // Switch to Settings tab on startup for configuration
        this.switchTab('settings');
    }

    setupEventListeners() {
        this.debug.log('Setting up event listeners...');

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.debug.log('Tab clicked:', e.target.dataset.tab);
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Voice controls
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const clearConversationBtn = document.getElementById('clearConversationBtn');
        const clearStreamingConversationBtn = document.getElementById('clearStreamingConversationBtn');
        
        if (startBtn) startBtn.addEventListener('click', () => this.startRecording());
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopRecording());
        if (clearConversationBtn) clearConversationBtn.addEventListener('click', () => this.clearConversation());
        if (clearStreamingConversationBtn) clearStreamingConversationBtn.addEventListener('click', () => this.clearConversation());

        // Persona selector
        const personaSelect = document.getElementById('personaSelect');
        if (personaSelect) {
            personaSelect.addEventListener('change', (e) => {
                this.personaManager.setCurrentPersona(e.target.value);
            });
        }

        // Admin form
        const personaForm = document.getElementById('personaForm');
        if (personaForm) personaForm.addEventListener('submit', (e) => this.addPersona(e));

        // Transaction management
        const transactionPersonaSelect = document.getElementById('transactionPersonaSelect');
        const addTransactionForm = document.getElementById('addTransactionForm');

        if (transactionPersonaSelect) {
            transactionPersonaSelect.addEventListener('change', (e) => this.selectPersonaForTransactions(e.target.value));
        }
        if (addTransactionForm) {
            addTransactionForm.addEventListener('submit', (e) => this.addTransaction(e));
        }

        // Settings
        const saveKey = document.getElementById('saveKey');
        const clearKey = document.getElementById('clearKey');
        const gptModel = document.getElementById('gptModel');
        if (saveKey) saveKey.addEventListener('click', () => this.saveApiKey());
        if (clearKey) clearKey.addEventListener('click', () => this.clearApiKey());
        if (gptModel) gptModel.addEventListener('change', (e) => this.updateGptModel(e));

        // TTS Settings
        const ttsMode = document.getElementById('ttsMode');
        const ttsModel = document.getElementById('ttsModel');
        const ttsVoice = document.getElementById('ttsVoice');
        const ttsSpeed = document.getElementById('ttsSpeed');
        const testTtsVoice = document.getElementById('testTtsVoice');

        // Browser TTS Settings
        const browserVoice = document.getElementById('browserVoice');
        const browserRate = document.getElementById('browserRate');
        const browserPitch = document.getElementById('browserPitch');
        const browserVolume = document.getElementById('browserVolume');
        const testBrowserVoice = document.getElementById('testBrowserVoice');

        if (ttsMode) ttsMode.addEventListener('change', (e) => this.updateTtsMode(e));
        if (ttsModel) ttsModel.addEventListener('change', (e) => this.updateTtsModel(e));
        if (ttsVoice) ttsVoice.addEventListener('change', (e) => this.updateTtsVoice(e));
        if (ttsSpeed) ttsSpeed.addEventListener('input', (e) => this.updateTtsSpeed(e));
        if (testTtsVoice) testTtsVoice.addEventListener('click', () => this.testTtsVoice());

        if (browserVoice) browserVoice.addEventListener('change', (e) => this.updateBrowserVoice(e));
        if (browserRate) browserRate.addEventListener('input', (e) => this.updateBrowserRate(e));
        if (browserPitch) browserPitch.addEventListener('input', (e) => this.updateBrowserPitch(e));
        if (browserVolume) browserVolume.addEventListener('input', (e) => this.updateBrowserVolume(e));
        if (testBrowserVoice) testBrowserVoice.addEventListener('click', () => this.testBrowserVoice());

        // Streaming mode controls
        const streamingMode = document.getElementById('streamingMode');
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const muteBtn = document.getElementById('muteBtn');
        const batchMuteBtn = document.getElementById('batchMuteBtn');

        if (streamingMode) {
            streamingMode.addEventListener('change', (e) => {
                this.debug.log('Streaming mode toggled:', e.target.checked);
                this.toggleStreamingMode(e.target.checked);
            });
        }
        if (connectBtn) connectBtn.addEventListener('click', () => this.connectStreaming());
        if (disconnectBtn) disconnectBtn.addEventListener('click', () => this.disconnectStreaming());
        if (muteBtn) muteBtn.addEventListener('click', () => this.toggleMute());
        if (batchMuteBtn) batchMuteBtn.addEventListener('click', () => this.toggleMute());

        // System prompts management
        document.querySelectorAll('.prompt-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchPromptTab(e.target.dataset.prompt));
        });

        const savePrompts = document.getElementById('savePrompts');
        const resetPrompts = document.getElementById('resetPrompts');
        const testPrompts = document.getElementById('testPrompts');
        const addCustomPrompt = document.getElementById('addCustomPrompt');

        if (savePrompts) savePrompts.addEventListener('click', () => this.saveSystemPrompts());
        if (resetPrompts) resetPrompts.addEventListener('click', () => this.resetSystemPrompts());
        if (testPrompts) testPrompts.addEventListener('click', () => this.testSystemPrompts());
        if (addCustomPrompt) addCustomPrompt.addEventListener('click', () => this.addCustomPrompt());

        // Debug toggle
        const debugToggle = document.getElementById('debugToggle');
        if (debugToggle) {
            debugToggle.addEventListener('change', (e) => this.toggleDebugMode(e.target.checked));
        }

        // Agent configuration controls
        const openAgentConfig = document.getElementById('openAgentConfig');
        const refreshAgentStatus = document.getElementById('refreshAgentStatus');
        const testAgentRouting = document.getElementById('testAgentRouting');
        const testBasicRouting = document.getElementById('testBasicRouting');
        
        if (openAgentConfig) {
            openAgentConfig.addEventListener('click', () => this.openAgentConfiguration());
        }
        if (refreshAgentStatus) {
            refreshAgentStatus.addEventListener('click', () => this.refreshAgentStatus());
        }
        if (testAgentRouting) {
            testAgentRouting.addEventListener('click', () => this.openAgentRoutingTest());
        }
        if (testBasicRouting) {
            testBasicRouting.addEventListener('click', () => this.openBasicRoutingTest());
        }

        // Token management buttons
        const resetTokens = document.getElementById('resetTokens');
        const updateTokens = document.getElementById('updateTokens');
        const testTokens = document.getElementById('testTokens');
        
        if (resetTokens) {
            resetTokens.addEventListener('click', () => this.resetTokenUsage());
        }
        if (updateTokens) {
            updateTokens.addEventListener('click', () => this.updateTokenDisplay());
        }
        if (testTokens) {
            testTokens.addEventListener('click', () => this.testTokenTracking());
        }

        // Debug panel toggle button (Hide/Show)
        const toggleDebug = document.getElementById('toggleDebug');
        if (toggleDebug) {
            toggleDebug.addEventListener('click', () => this.toggleDebugPanel());
        }

        this.debug.log('Event listeners setup complete');
    }

    switchTab(tabName) {
        this.debug.log('Switching to tab:', tabName);

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const activeContent = document.getElementById(`${tabName}-tab`);
        if (activeContent) activeContent.classList.add('active');

        if (tabName === 'admin') {
            this.loadPersonas();
            // Refresh agent status when admin tab is opened
            this.refreshAgentStatus();
            // Refresh LLM Manager data when admin tab is opened
            this.refreshLLMData();
        }
    }

    async startRecording() {
        this.debug.log('Start recording clicked');
        if (!this.openaiApiKey) {
            const key = prompt("Enter your OpenAI API key:");
            if (key && key.trim()) {
                this.openaiApiKey = key.trim();
                this.apiClient.setApiKey(this.openaiApiKey);
                this.streamingManager.setApiKey(this.openaiApiKey);
                this.updateKeyStatus();
            } else {
                this.updateStatus('OpenAI API key is required to use this feature');
                return;
            }
        }

        if (this.currentState !== 'ready') {
            this.debug.log('Cannot start recording, current state:', this.currentState);
            return;
        }

        try {
            this.currentState = 'recording';
            let stream;

            // Check if we have a cached microphone stream with active tracks
            if (this.cachedMicStream && this.micPermissionGranted) {
                const tracks = this.cachedMicStream.getAudioTracks();
                const activeTrack = tracks.find(track => track.readyState === 'live');
                
                if (activeTrack) {
                    console.log('Using cached microphone stream');
                    stream = this.cachedMicStream;
                } else {
                    console.log('Cached stream tracks are inactive, requesting new access...');
                    this.cleanupMicrophoneStream();
                    stream = await this.requestMicrophoneAccess();
                }
            } else {
                console.log('No cached stream, requesting microphone access...');
                stream = await this.requestMicrophoneAccess();
            }

            console.log('Microphone stream ready');
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                console.log('Audio data available:', event.data.size, 'bytes');
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                console.log('Recording stopped, processing audio...');
                this.processAudio();
            };

            this.mediaRecorder.start();
            this.isRecording = true;

            // Start audio level monitoring
            this.startAudioLevelMonitoring(stream);

            // Update recording status
            this.updateRecordingStatus('🔴 Recording');

            const startBtn = document.getElementById('startBtn');
            const stopBtn = document.getElementById('stopBtn');
            const batchMuteBtn = document.getElementById('batchMuteBtn');
            if (startBtn) startBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = false;
            if (batchMuteBtn) batchMuteBtn.disabled = false;

            this.updateStatus('🎤 Listening... Click Stop when done speaking');
            console.log('Recording started successfully');

        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.currentState = 'ready';
            this.updateStatus('❌ Microphone access denied. Please allow microphone permissions.');
            this.micPermissionGranted = false;
            this.cachedMicStream = null;

            // Reset button states
            const startBtn = document.getElementById('startBtn');
            const stopBtn = document.getElementById('stopBtn');
            const batchMuteBtn = document.getElementById('batchMuteBtn');
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            if (batchMuteBtn) batchMuteBtn.disabled = true;

            // Show detailed error message
            if (error.name === 'NotAllowedError') {
                alert('Microphone access was denied. Please:\n1. Click the microphone icon in your browser address bar\n2. Allow microphone access\n3. Refresh the page and try again');
            } else if (error.name === 'NotFoundError') {
                alert('No microphone found. Please connect a microphone and try again.');
            } else {
                alert('Error accessing microphone: ' + error.message);
            }
        }
    }

    async requestMicrophoneAccess() {
        console.log('Requesting fresh microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: this.speechSettings.audioQuality === 'high' ? 48000 : 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: this.speechSettings.noiseReduction !== 'off',
                autoGainControl: true
            }
        });

        // Cache the stream for future use
        this.cachedMicStream = stream;
        this.micPermissionGranted = true;
        console.log('Microphone access granted and cached');

        return stream;
    }

    cleanupMicrophoneStream() {
        if (this.cachedMicStream) {
            this.cachedMicStream.getTracks().forEach(track => track.stop());
            this.cachedMicStream = null;
        }
        this.micPermissionGranted = false;
    }

    cleanupAllResources() {
        console.log('Cleaning up all resources...');
        
        // Stop any ongoing recording
        if (this.isRecording && this.mediaRecorder) {
            this.mediaRecorder.stop();
        }
        
        // Clean up microphone stream
        this.cleanupMicrophoneStream();
        
        // Stop any playing audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.src = '';
            this.currentAudio = null;
        }
        
        // Stop browser TTS
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
        }
        
        // Disconnect streaming if active
        if (this.isConnected && this.streamingManager) {
            this.streamingManager.disconnect();
        }
        
        // Stop audio level monitoring
        this.stopAudioLevelMonitoring();
    }

    stopRecording() {
        this.debug.log('Stop recording clicked');
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            
            // Only stop tracks if user preference is to not keep mic active
            if (!this.speechSettings.keepMicActive) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                this.cleanupMicrophoneStream();
            }
            
            this.isRecording = false;
            this.currentState = 'processing';

            // Stop audio level monitoring
            this.stopAudioLevelMonitoring();

            // Update recording status
            this.updateRecordingStatus('🔴 Not Recording');

            const startBtn = document.getElementById('startBtn');
            const stopBtn = document.getElementById('stopBtn');
            const batchMuteBtn = document.getElementById('batchMuteBtn');
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;
            if (batchMuteBtn) batchMuteBtn.disabled = true;

            this.updateStatus('Processing your speech...');
        }
    }

    // Audio processing methods
    async processAudio() {
        try {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            console.log('Processing audio blob:', audioBlob.size, 'bytes');

            // Validate audio blob size
            if (audioBlob.size === 0) {
                throw new Error('No audio data recorded');
            }

            // Convert speech to text using OpenAI Whisper
            const transcript = await this.speechToText(audioBlob);

            if (transcript && transcript.trim()) {
                this.addMessage(transcript, 'user');
                this.updateStatus('Generating response...');

                // Route through agents or use fallback
                const routingResult = await this.routeRequestThroughAgentsWithMetadata(transcript);
                this.addMessage(routingResult.response, 'bot', routingResult.agentName || 'Default Agent');

                // Convert response to speech using selected TTS mode with agent-specific voice
                this.currentState = 'speaking';
                await this.textToSpeech(routingResult.response, routingResult.agentName);

                this.currentState = 'ready';
                this.updateStatus('Ready to listen');
            } else {
                this.currentState = 'ready';
                this.updateStatus('No speech detected. Please try again.');
            }

        } catch (error) {
            console.error('Error processing audio:', error);
            this.currentState = 'ready';
            this.updateStatus('Error processing audio. Please try again.');
        }
    }

    async speechToText(audioBlob) {
        try {
            console.log('Sending audio to Whisper API...');
            this.updateStatus('🔄 Converting speech to text...');
            this.updateDebugOutput('sttOutput', 'Processing audio with Whisper...');

            console.log('Using language setting:', this.speechSettings.whisperLanguage);
            const result = await this.apiClient.speechToText(audioBlob, {
                language: this.speechSettings.whisperLanguage
            });
            
            // Debug: Check if tracking happened
            this.debug.log('After Whisper API call - Token tracker status:', {
                hasTracker: !!this.apiClient.tokenTracker,
                currentUsage: this.tokenTracker.getUsage()
            });

            if (result.success) {
                console.log('Transcription received:', result.text);
                this.updateDebugOutput('sttOutput', result.text, 'Transcribed Text:');
                return result.text;
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Speech-to-text error:', error);
            this.updateDebugOutput('sttOutput', `Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Route user request through AgentRouter or fallback to original behavior
     * @param {string} userMessage - The user's transcribed message
     * @returns {Promise<string>} - The response text
     */
    async routeRequestThroughAgents(userMessage) {
        const result = await this.routeRequestThroughAgentsWithMetadata(userMessage);
        return result.response;
    }

    /**
     * Route user request through AgentRouter with metadata
     * @param {string} userMessage - The user's transcribed message
     * @returns {Promise<{response: string, agentName: string|null}>} - The response and agent info
     */
    async routeRequestThroughAgentsWithMetadata(userMessage) {
        try {
            // If AgentRouter is available, use it
            if (this.agentRouter) {
                this.debug.info('Routing request through AgentRouter', { 
                    message: userMessage.substring(0, 50) + '...' 
                });

                // Create context object for agents
                const agentContext = {
                    personaManager: this.personaManager,
                    systemPromptsManager: this.systemPromptsManager,
                    apiClient: this.apiClient,
                    tokenTracker: this.tokenTracker,
                    currentPersona: this.personaManager.getCurrentPersona(),
                    sessionData: {},
                    debugMode: window.debugManager.isEnabled(),
                    conversationHistory: this.conversationHistory,
                    lastAgentUsed: this.lastAgentUsed
                };

                // Route through agents
                const agentResult = await this.agentRouter.route(userMessage, agentContext);

                if (agentResult.success) {
                    this.debug.info('Agent routing successful', { 
                        agentName: agentResult.agentName,
                        processingTime: agentResult.processingTime 
                    });
                    
                    // Update conversation context for future AI routing
                    this.updateConversationContext(userMessage, agentResult.response, agentResult.agentName);
                    
                    // Update debug output with agent information
                    this.updateDebugOutput('gptResponse', 
                        `Agent: ${agentResult.agentName}\nResponse: ${agentResult.response}`,
                        'Agent Response:'
                    );
                    
                    return {
                        response: agentResult.response,
                        agentName: agentResult.agentName
                    };
                } else {
                    this.debug.warn('Agent routing failed, falling back to original method', { 
                        error: agentResult.error 
                    });
                    // Fall through to original method
                }
            } else {
                this.debug.info('AgentRouter not available, using original method');
            }

            // Fallback to original generateResponse method
            const fallbackResponse = await this.generateResponse(userMessage);
            return {
                response: fallbackResponse,
                agentName: null
            };

        } catch (error) {
            this.debug.error('Error in agent routing, falling back to original method', { 
                error: error.message 
            });
            // Fallback to original method on any error
            const fallbackResponse = await this.generateResponse(userMessage);
            return {
                response: fallbackResponse,
                agentName: null
            };
        }
    }

    /**
     * Update conversation context for AI-powered agent routing
     * @param {string} userMessage - User's message
     * @param {string} agentResponse - Agent's response
     * @param {string} agentName - Name of the agent that handled the request
     */
    updateConversationContext(userMessage, agentResponse, agentName) {
        // Add user message
        this.conversationHistory.push({
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
        });

        // Add agent response
        this.conversationHistory.push({
            role: 'assistant',
            content: agentResponse,
            agent: agentName,
            timestamp: new Date().toISOString()
        });

        // Keep only last 10 messages (5 exchanges) for context
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }

        // Update last agent used
        this.lastAgentUsed = agentName;

        this.debug.info('Conversation context updated', {
            agentName,
            historyLength: this.conversationHistory.length,
            lastAgent: this.lastAgentUsed
        });
    }

    async generateResponse(userMessage) {
        const systemPrompt = this.generateSystemPrompt(this.personaManager.getCurrentPersona(), userMessage);

        try {
            console.log('Generating AI response for:', userMessage);
            this.updateStatus('🤖 Generating AI response...');

            // Update debug panel with system prompt
            this.updateDebugOutput('systemPrompt', systemPrompt);

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ];

            const result = await this.apiClient.generateChatCompletion(messages, {
                model: this.gptModel,
                maxTokens: 200,
                temperature: 0.8
            });
            
            // Debug: Check if tracking happened
            this.debug.log('After GPT API call - Token tracker status:', {
                hasTracker: !!this.apiClient.tokenTracker,
                currentUsage: this.tokenTracker.getUsage()
            });

            if (result.success) {
                console.log('AI response received:', result.content);
                this.updateDebugOutput('gptResponse', result.content);
                
                // Update conversation context for fallback responses too
                this.updateConversationContext(userMessage, result.content, 'FallbackHandler');
                
                return result.content;
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('AI response error:', error);
            this.updateDebugOutput('gptResponse', `Error: ${error.message}`);
            return "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
        }
    }

    async textToSpeech(text, agentName = null) {
        // Apply agent-specific voice configuration if available
        const voiceConfig = this.getAgentVoiceConfig(agentName);
        
        if (this.ttsMode === 'browser') {
            return this.textToSpeechBrowser(text, voiceConfig);
        } else {
            return this.textToSpeechOpenAI(text, voiceConfig);
        }
    }

    async textToSpeechOpenAI(text, voiceConfig = null) {
        try {
            console.log('Converting text to speech with OpenAI:', text);
            this.updateStatus('🔊 Generating voice...');
            
            // Use voice configuration if provided, otherwise fall back to default settings
            let ttsOptions;
            if (voiceConfig && voiceConfig.ttsSettings) {
                const ttsSettings = voiceConfig.ttsSettings;
                ttsOptions = {
                    model: ttsSettings.model || this.ttsSettings.model,
                    voice: ttsSettings.voice || this.ttsSettings.voice,
                    speed: ttsSettings.speed || this.ttsSettings.speed
                };
                this.updateDebugOutput('ttsOutput', `Generating speech with agent voice config - Model: ${ttsOptions.model}, Voice: ${ttsOptions.voice}, Speed: ${ttsOptions.speed}`);
            } else {
                ttsOptions = {
                    model: this.ttsSettings.model,
                    voice: this.ttsSettings.voice,
                    speed: this.ttsSettings.speed
                };
                this.updateDebugOutput('ttsOutput', `Generating speech with ${this.ttsSettings.model} (${this.ttsSettings.voice})`);
            }

            const result = await this.apiClient.textToSpeech(text, ttsOptions);
            
            // Debug: Check if tracking happened
            this.debug.log('After TTS API call - Token tracker status:', {
                hasTracker: !!this.apiClient.tokenTracker,
                currentUsage: this.tokenTracker.getUsage()
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            // Clean up previous audio if exists
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio.src = '';
                this.currentAudio = null;
            }

            const audioUrl = URL.createObjectURL(result.audioBlob);
            const audio = new Audio(audioUrl);
            this.currentAudio = audio;

            this.updateStatus('🔊 Speaking...');

            audio.onended = () => {
                console.log('Audio playback ended');
                this.updateStatus('Ready to listen');
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
            };

            audio.onerror = (error) => {
                console.error('Audio playback error:', error);
                this.updateStatus('Audio playback error - Ready to listen');
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
            };

            // Try to play audio
            try {
                await audio.play();
                console.log('Audio playback started');
            } catch (playError) {
                console.warn('Audio autoplay blocked:', playError);

                // Create manual play button
                const playButton = document.createElement('button');
                playButton.textContent = '🔊 Click to Play Audio Response';
                playButton.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; padding: 10px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;';

                playButton.onclick = () => {
                    audio.play().then(() => {
                        playButton.remove();
                    }).catch(err => {
                        console.error('Manual audio play failed:', err);
                        playButton.textContent = '❌ Audio play failed';
                        setTimeout(() => playButton.remove(), 3000);
                    });
                };

                document.body.appendChild(playButton);
                setTimeout(() => {
                    if (playButton.parentNode) {
                        playButton.remove();
                    }
                }, 10000);

                this.updateStatus('🔊 Audio ready - Click the blue button to play');
            }

            this.updateDebugOutput('ttsOutput', `Speech generated successfully\nCharacters: ${text.length}\nModel: ${this.ttsSettings.model}\nVoice: ${this.ttsSettings.voice}`);

        } catch (error) {
            console.error('OpenAI TTS error:', error);
            this.updateStatus('OpenAI TTS error - trying browser TTS...');
            this.updateDebugOutput('ttsOutput', `OpenAI TTS Error: ${error.message} - Falling back to browser TTS`);

            // Fallback to browser TTS
            return this.textToSpeechBrowser(text);
        }
    }

    async textToSpeechBrowser(text, voiceConfig = null) {
        return new Promise((resolve, reject) => {
            try {
                console.log('Converting text to speech with Browser TTS:', text);
                this.updateStatus('🔊 Generating voice with browser...');
                
                if (!('speechSynthesis' in window)) {
                    throw new Error('Browser TTS not supported');
                }

                // Stop any ongoing speech
                speechSynthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(text);

                // Apply voice configuration if provided, otherwise use default settings
                if (voiceConfig && voiceConfig.ttsSettings) {
                    const ttsSettings = voiceConfig.ttsSettings;
                    
                    // For browser TTS, we need to map the voice name to available voices
                    if (ttsSettings.voice && this.availableVoices.length > 0) {
                        const matchingVoice = this.availableVoices.find(voice => 
                            voice.name.toLowerCase().includes(ttsSettings.voice.toLowerCase())
                        );
                        if (matchingVoice) {
                            utterance.voice = matchingVoice;
                        }
                    }
                    
                    utterance.rate = ttsSettings.speed || this.browserTtsSettings.rate;
                    utterance.pitch = ttsSettings.pitch ? (ttsSettings.pitch / 10 + 1) : this.browserTtsSettings.pitch; // Convert semitones to browser pitch
                    utterance.volume = ttsSettings.volume || this.browserTtsSettings.volume;
                    
                    this.updateDebugOutput('ttsOutput', `Generating speech with agent voice config - Voice: ${utterance.voice?.name || 'Default'}, Rate: ${utterance.rate}, Pitch: ${utterance.pitch}`);
                } else {
                    // Apply default settings
                    if (this.browserTtsSettings.voice && this.availableVoices.length > 0) {
                        const voiceIndex = parseInt(this.browserTtsSettings.voice);
                        if (voiceIndex >= 0 && voiceIndex < this.availableVoices.length) {
                            utterance.voice = this.availableVoices[voiceIndex];
                        }
                    }

                    utterance.rate = this.browserTtsSettings.rate;
                    utterance.pitch = this.browserTtsSettings.pitch;
                    utterance.volume = this.browserTtsSettings.volume;
                    
                    this.updateDebugOutput('ttsOutput', `Generating speech with Browser TTS`);
                }

                utterance.onstart = () => {
                    console.log('Browser TTS started');
                    this.updateStatus('🔊 Speaking...');
                };

                utterance.onend = () => {
                    console.log('Browser TTS ended');
                    this.updateStatus('Ready to listen');
                    this.updateDebugOutput('ttsOutput', `Browser TTS completed successfully\nCharacters: ${text.length}\nVoice: ${utterance.voice ? utterance.voice.name : 'Default'}`);
                    resolve();
                };

                utterance.onerror = (error) => {
                    console.error('Browser TTS error:', error);
                    this.updateStatus('Browser TTS error - Ready to listen');
                    this.updateDebugOutput('ttsOutput', `Browser TTS Error: ${error.error}`);
                    reject(error);
                };

                speechSynthesis.speak(utterance);

            } catch (error) {
                console.error('Browser TTS setup error:', error);
                this.updateStatus('TTS error - Ready to listen');
                this.updateDebugOutput('ttsOutput', `Browser TTS Error: ${error.message}`);
                reject(error);
            }
        });
    }

    // Audio level monitoring methods
    startAudioLevelMonitoring(stream) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioAnalyser = this.audioContext.createAnalyser();
            const source = this.audioContext.createMediaStreamSource(stream);

            this.audioAnalyser.fftSize = 256;
            source.connect(this.audioAnalyser);

            const bufferLength = this.audioAnalyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            this.audioLevelInterval = setInterval(() => {
                this.audioAnalyser.getByteFrequencyData(dataArray);

                // Calculate RMS for audio level
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i] * dataArray[i];
                }
                const rms = Math.sqrt(sum / dataArray.length);
                const level = Math.min(100, Math.max(0, rms * 100 / 128));

                this.updateAudioLevel(level);
            }, 100);

            console.log('Audio level monitoring started');
        } catch (error) {
            console.error('Error starting audio level monitoring:', error);
        }
    }

    stopAudioLevelMonitoring() {
        if (this.audioLevelInterval) {
            clearInterval(this.audioLevelInterval);
            this.audioLevelInterval = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.audioAnalyser = null;
        this.updateAudioLevel(0);
        console.log('Audio level monitoring stopped');
    }

    updateAudioLevel(level) {
        const audioLevelFill = document.getElementById('audioLevel');
        const audioLevelText = document.getElementById('audioLevelText');

        if (audioLevelFill) {
            audioLevelFill.style.width = this.isMuted ? 0 : level + '%';
        }

        if (audioLevelText) {
            audioLevelText.textContent = this.isMuted ? '0%' : Math.round(level) + '%';
        }
    }

    // Mute functionality
    toggleMute() {
        console.log('Mute button clicked, current state:', this.isMuted);

        if (this.isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
    }

    mute() {
        console.log('Muting audio stream...');
        this.isMuted = true;

        // Update button states and text
        this.updateMuteButtonStates();

        // Stop audio streaming in streaming mode
        if (this.isStreamingMode && this.streamingManager) {
            this.streamingManager.pauseAudioStreaming();
        }

        // Stop recording in batch mode
        if (!this.isStreamingMode && this.isRecording) {
            this.pauseRecording();
        }

        // Mute microphone tracks
        this.muteMicrophoneTracks();

        this.updateStatus('🔇 Microphone muted - background noise blocked');
        console.log('Audio stream muted successfully');
    }

    unmute() {
        console.log('Unmuting audio stream...');
        this.isMuted = false;

        // Update button states and text
        this.updateMuteButtonStates();

        // Resume audio streaming in streaming mode
        if (this.isStreamingMode && this.streamingManager) {
            this.streamingManager.resumeAudioStreaming();
        }

        // Resume recording in batch mode if it was active
        if (!this.isStreamingMode && this.mutedStream) {
            this.resumeRecording();
        }

        // Unmute microphone tracks
        this.unmuteMicrophoneTracks();

        this.updateStatus(this.isStreamingMode ?
            (this.isConnected ? '🎤 Connected and listening' : 'Ready to connect') :
            'Ready to listen');
        console.log('Audio stream unmuted successfully');
    }

    updateMuteButtonStates() {
        const muteBtn = document.getElementById('muteBtn');
        const batchMuteBtn = document.getElementById('batchMuteBtn');
        const muteStatus = document.getElementById('muteStatus');

        const muteText = this.isMuted ? '🔊 Unmute' : '🎤 Mute';
        const muteClass = this.isMuted ? 'muted' : '';

        if (muteBtn) {
            muteBtn.textContent = muteText;
            muteBtn.className = `voice-btn mute-btn ${muteClass}`;
        }

        if (batchMuteBtn) {
            batchMuteBtn.textContent = muteText;
            batchMuteBtn.className = `voice-btn mute-btn ${muteClass}`;
        }

        if (muteStatus) {
            muteStatus.textContent = this.isMuted ? '🔇 Muted' : '🎤 Live';
            muteStatus.className = `mute-indicator ${this.isMuted ? 'muted' : 'live'}`;
        }
    }

    muteMicrophoneTracks() {
        // Mute all active microphone tracks
        if (this.cachedMicStream) {
            this.cachedMicStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
        }

        if (this.mediaRecorder && this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
        }
    }

    unmuteMicrophoneTracks() {
        // Unmute all active microphone tracks
        if (this.cachedMicStream) {
            this.cachedMicStream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });
        }

        if (this.mediaRecorder && this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });
        }
    }

    pauseRecording() {
        if (this.mediaRecorder && this.isRecording) {
            console.log('Pausing recording due to mute');
            this.mutedStream = this.mediaRecorder.stream;
            // Don't actually stop the recorder, just disable the tracks
        }
    }

    resumeRecording() {
        if (this.mutedStream) {
            console.log('Resuming recording after unmute');
            this.mutedStream = null;
        }
    }

    initializeMuteButtons() {
        console.log('Initializing mute buttons...');

        // Set initial mute button states
        this.updateMuteButtonStates();

        // Disable mute buttons initially (they get enabled when recording/connecting)
        const muteBtn = document.getElementById('muteBtn');
        const batchMuteBtn = document.getElementById('batchMuteBtn');

        if (muteBtn) {
            muteBtn.disabled = true;
            console.log('Streaming mute button found and disabled initially');
        } else {
            console.log('Streaming mute button not found!');
        }

        if (batchMuteBtn) {
            batchMuteBtn.disabled = true;
            console.log('Batch mute button found and disabled initially');
        } else {
            console.log('Batch mute button not found!');
        }

        console.log('Mute buttons initialized - they will be enabled when you start recording or connect');
    }

    /**
     * Initialize the extensibility system with LLM providers, agent loading, and telemetry
     */
    async initializeExtensibilitySystem() {
        try {
            this.debug.info('Initializing extensibility system');
            
            // Check if extensibility components are available
            if (typeof initializeExtensibilitySystem === 'undefined') {
                this.debug.warn('Extensibility system not available - skipping initialization');
                return;
            }

            // Ensure AgentRouter is available for extensibility system
            if (!this.agentRouter) {
                this.debug.warn('AgentRouter not available - extensibility system may have limited functionality');
            } else {
                // Make sure it's available globally
                window.agentRouter = this.agentRouter;
            }
            
            // Initialize with default configuration
            const config = {
                enablePredefinedHooks: true,
                llmProviders: {
                    openai: {
                        apiKey: this.openaiApiKey // Use the existing API key
                    }
                }
            };
            
            const result = await initializeExtensibilitySystem(config);
            
            if (result.success) {
                this.debug.info('Extensibility system initialized successfully', {
                    llmProviders: result.llmProviderManager ? 'Available' : 'Not available',
                    agentLoader: result.agentLoader ? 'Available' : 'Not available',
                    telemetryHooks: result.telemetryHooks ? 'Available' : 'Not available'
                });
                
                // Update API client to use LLM provider manager if available
                if (window.llmProviderManager) {
                    this.debug.info('LLM Provider Manager available - agents can now use multiple providers');
                }
                
                // Log extensibility status
                if (window.extensibilityAPI) {
                    const status = window.extensibilityAPI.utils.getSystemInfo();
                    this.debug.info('Extensibility system status', status);
                }
            } else {
                this.debug.error('Extensibility system initialization failed', {
                    errors: result.errors
                });
            }
        } catch (error) {
            this.debug.error('Failed to initialize extensibility system', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    updateRecordingStatus(status) {
        const recordingQuality = document.getElementById('recordingQuality');
        if (recordingQuality) {
            recordingQuality.textContent = status;
        }
    }

    // Debug panel methods
    updateDebugOutput(elementId, content, label = '') {
        const element = document.getElementById(elementId);
        if (element) {
            const timestamp = new Date().toLocaleTimeString();
            const displayContent = label ? `${label}\n${content}` : content;
            element.textContent = `[${timestamp}] ${displayContent}`;
        }
    }

    // Voice configuration helper methods
    getAgentVoiceConfig(agentName) {
        if (!agentName || !this.voiceConfigManager) {
            return null;
        }
        
        return this.voiceConfigManager.getVoiceConfig(agentName);
    }

    // Token tracking methods (now handled by TokenTracker class)





    // Token display is now handled by TokenTracker.updateDisplay()

    // Admin Panel - Personas Management
    loadPersonas() {
        this.debug.log('Loading personas...');
        const personaList = document.getElementById('personaList');
        if (!personaList) return;

        // Clear existing content
        personaList.innerHTML = '';

        // Create personas display
        const personas = this.personaManager.getAllPersonas();
        Object.keys(personas).forEach(personaId => {
            const persona = personas[personaId];
            const personaCard = document.createElement('div');
            personaCard.className = 'persona-card';
            personaCard.innerHTML = `
                <div class="persona-header">
                    <h4>${persona.name}</h4>
                    <button class="delete-persona-btn" onclick="app.deletePersona('${personaId}')">Delete</button>
                </div>
                <div class="persona-details">
                    <p><strong>Account Type:</strong> ${persona.accountType}</p>
                    <p><strong>Balance:</strong> ${this.personaManager.formatCurrency(persona.balance)}</p>
                    <p><strong>Card Last 4:</strong> ****${persona.cardLast4}</p>
                    <div class="recent-transactions">
                        <strong>Recent Transactions:</strong>
                        ${persona.recentTransactions && persona.recentTransactions.length > 0 ?
                    persona.recentTransactions.map(tx =>
                        `<div class="transaction">
                                    <span class="date">${tx.date}</span>
                                    <span class="amount ${tx.amount < 0 ? 'negative' : 'positive'}">
                                        ${this.personaManager.formatCurrency(tx.amount)}
                                    </span>
                                    <span class="description">${tx.description}</span>
                                </div>`
                    ).join('') :
                    '<p class="no-transactions">No recent transactions</p>'
                }
                    </div>
                </div>
            `;
            personaList.appendChild(personaCard);
        });

        // Add styling for persona cards
        this.addPersonaStyles();

        // Update transaction persona selector
        this.updateTransactionPersonaSelector();
    }

    addPersonaStyles() {
        if (!document.getElementById('persona-styles')) {
            const style = document.createElement('style');
            style.id = 'persona-styles';
            style.textContent = `
                .persona-card {
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 15px;
                    background: #f9f9f9;
                }
                .persona-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .persona-header h4 {
                    margin: 0;
                    color: #333;
                }
                .delete-persona-btn {
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .delete-persona-btn:hover {
                    background: #c82333;
                }
                .persona-details p {
                    margin: 5px 0;
                    color: #666;
                }
                .recent-transactions {
                    margin-top: 10px;
                }
                .transaction {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 0;
                    border-bottom: 1px solid #eee;
                    font-size: 14px;
                }
                .transaction:last-child {
                    border-bottom: none;
                }
                .amount.negative {
                    color: #dc3545;
                }
                .amount.positive {
                    color: #28a745;
                }
                .no-transactions {
                    color: #999;
                    font-style: italic;
                }
                
                /* Transaction Management Styles */
                .transaction-management {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .transaction-history {
                    margin-top: 20px;
                }
                .current-balance {
                    background: #e9ecef;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    text-align: center;
                }
                .transaction-items {
                    max-height: 300px;
                    overflow-y: auto;
                }
                .transaction-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    margin-bottom: 8px;
                    background: white;
                }
                .transaction-info {
                    display: flex;
                    gap: 15px;
                    align-items: center;
                    flex: 1;
                }
                .transaction-date {
                    font-weight: bold;
                    color: #495057;
                    min-width: 80px;
                }
                .transaction-description {
                    flex: 1;
                    color: #6c757d;
                }
                .transaction-amount.credit {
                    color: #28a745;
                    font-weight: bold;
                }
                .transaction-amount.debit {
                    color: #dc3545;
                    font-weight: bold;
                }
                .remove-transaction-btn {
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                }
                .remove-transaction-btn:hover {
                    background: #5a6268;
                }
            `;
            document.head.appendChild(style);
        }
    }

    addPersona(e) {
        e.preventDefault();
        this.debug.log('Add persona form submitted');

        // Get form values
        const name = document.getElementById('personaName').value.trim();
        const balance = parseFloat(document.getElementById('personaBalance').value);
        const cardLast4 = document.getElementById('personaCard').value.trim();
        const accountType = document.getElementById('personaAccountType').value;

        // Validate inputs
        if (!name || isNaN(balance) || !cardLast4 || cardLast4.length !== 4) {
            alert('Please fill in all fields correctly. Card number should be 4 digits.');
            return;
        }

        // Generate unique ID
        const personaId = this.personaManager.generatePersonaId(name);

        // Create new persona
        const newPersona = {
            name: name,
            balance: balance,
            cardLast4: cardLast4,
            accountType: accountType,
            currency: 'GBP',
            recentTransactions: [
                { date: new Date().toISOString().split('T')[0], amount: balance, description: 'Initial Balance', id: Date.now() }
            ]
        };

        // Add persona using persona manager
        this.personaManager.addPersona(personaId, newPersona);

        // Update UI
        this.updatePersonaSelector();
        this.loadPersonas();

        // Reset form
        document.getElementById('personaForm').reset();

        alert(`Persona "${name}" added successfully!`);
    }

    deletePersona(personaId) {
        if (confirm(`Are you sure you want to delete this persona?`)) {
            this.personaManager.deletePersona(personaId);

            // If deleted persona was selected, switch to first available
            if (this.personaManager.getCurrentPersona() === personaId) {
                const availablePersonas = this.personaManager.getPersonaIds();
                const newPersona = availablePersonas[0] || 'john_doe';
                this.personaManager.setCurrentPersona(newPersona);
            }

            this.updatePersonaSelector();
            this.loadPersonas();

            alert('Persona deleted successfully!');
        }
    }

    // Transaction Management
    selectPersonaForTransactions(personaId) {
        const transactionForm = document.getElementById('transactionForm');
        const transactionDate = document.getElementById('transactionDate');

        if (personaId && this.personaManager.personaExists(personaId)) {
            transactionForm.style.display = 'block';

            // Set default date to today
            if (transactionDate) {
                transactionDate.value = new Date().toISOString().split('T')[0];
            }

            this.loadTransactionHistory(personaId);
            this.updateTransactionPersonaSelector();
        } else {
            transactionForm.style.display = 'none';
        }
    }

    addTransaction(e) {
        e.preventDefault();

        const personaSelect = document.getElementById('transactionPersonaSelect');
        const personaId = personaSelect.value;

        if (!personaId) {
            alert('Please select a persona first.');
            return;
        }

        const date = document.getElementById('transactionDate').value;
        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const description = document.getElementById('transactionDescription').value.trim();

        if (!date || isNaN(amount) || !description) {
            alert('Please fill in all transaction fields.');
            return;
        }

        const transaction = { date, amount, description };

        if (this.personaManager.addTransaction(personaId, transaction)) {
            // Reset form
            document.getElementById('addTransactionForm').reset();
            document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];

            // Refresh displays
            this.loadTransactionHistory(personaId);
            this.loadPersonas();
            this.updatePersonaSelector();

            alert('Transaction added successfully!');
        } else {
            alert('Failed to add transaction.');
        }
    }

    loadTransactionHistory(personaId) {
        const transactionList = document.getElementById('transactionList');
        if (!transactionList) return;

        const transactions = this.personaManager.getTransactions(personaId);
        const persona = this.personaManager.getPersona(personaId);

        if (!transactions.length) {
            transactionList.innerHTML = '<p>No transactions found.</p>';
            return;
        }

        let html = `<div class="current-balance">
            <strong>Current Balance: ${this.personaManager.formatCurrency(persona.balance)}</strong>
        </div>`;

        html += '<div class="transaction-items">';
        transactions.forEach(tx => {
            const amountClass = tx.amount >= 0 ? 'credit' : 'debit';
            html += `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <span class="transaction-date">${tx.date}</span>
                        <span class="transaction-description">${tx.description}</span>
                        <span class="transaction-amount ${amountClass}">
                            ${this.personaManager.formatCurrency(tx.amount)}
                        </span>
                    </div>
                    <button class="remove-transaction-btn" onclick="app.removeTransaction('${personaId}', '${tx.id}')">
                        Remove
                    </button>
                </div>
            `;
        });
        html += '</div>';

        transactionList.innerHTML = html;
    }

    removeTransaction(personaId, transactionId) {
        if (confirm('Are you sure you want to remove this transaction?')) {
            if (this.personaManager.removeTransaction(personaId, transactionId)) {
                this.loadTransactionHistory(personaId);
                this.loadPersonas();
                this.updatePersonaSelector();
                alert('Transaction removed successfully!');
            } else {
                alert('Failed to remove transaction.');
            }
        }
    }

    updateTransactionPersonaSelector() {
        const selector = document.getElementById('transactionPersonaSelect');
        if (!selector) return;

        // Keep current selection
        const currentValue = selector.value;

        // Clear and repopulate
        selector.innerHTML = '<option value="">Select a persona...</option>';

        const personas = this.personaManager.getAllPersonas();
        Object.keys(personas).forEach(personaId => {
            const option = document.createElement('option');
            option.value = personaId;
            option.textContent = personas[personaId].name;
            selector.appendChild(option);
        });

        // Restore selection if it still exists
        if (currentValue && this.personaManager.personaExists(currentValue)) {
            selector.value = currentValue;
        }
    }

    // System Prompts Management
    initializeSystemPrompts() {
        console.log('Initializing system prompts...');
        const basePersonality = document.getElementById('basePersonality');
        const financialContext = document.getElementById('financialContext');
        const responseInstructions = document.getElementById('responseInstructions');

        if (basePersonality) basePersonality.value = this.systemPromptsManager.getBasePersonality();
        if (financialContext) financialContext.value = this.systemPromptsManager.getFinancialContext();
        if (responseInstructions) responseInstructions.value = this.systemPromptsManager.getResponseInstructions();

        // Load custom prompts
        this.loadCustomPrompts();
    }

    switchPromptTab(tabName) {
        console.log('Switching to prompt tab:', tabName);

        // Update tab buttons
        document.querySelectorAll('.prompt-tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeTab = document.querySelector(`[data-prompt="${tabName}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Update tab content
        document.querySelectorAll('.prompt-section').forEach(section => section.classList.remove('active'));
        const activeContent = document.getElementById(`${tabName}-prompt`);
        if (activeContent) activeContent.classList.add('active');
    }

    saveSystemPrompts() {
        try {
            console.log('Saving system prompts...');

            const basePersonality = document.getElementById('basePersonality');
            const financialContext = document.getElementById('financialContext');
            const responseInstructions = document.getElementById('responseInstructions');

            if (basePersonality) this.systemPromptsManager.updateBasePersonality(basePersonality.value);
            if (financialContext) this.systemPromptsManager.updateFinancialContext(financialContext.value);
            if (responseInstructions) this.systemPromptsManager.updateResponseInstructions(responseInstructions.value);

            // Save custom prompts
            this.saveCustomPrompts();

            // Show success message
            this.showPromptMessage('System prompts saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving prompts:', error);
            this.showPromptMessage('Error saving prompts. Please try again.', 'error');
        }
    }

    async resetSystemPrompts() {
        if (confirm('Are you sure you want to reset all system prompts to defaults? This cannot be undone.')) {
            try {
                await this.systemPromptsManager.resetToDefaults();

                // Update UI
                this.initializeSystemPrompts();

                this.showPromptMessage('System prompts reset to defaults.', 'info');
            } catch (error) {
                console.error('Error resetting prompts:', error);
                this.showPromptMessage('Error resetting prompts. Please try again.', 'error');
            }
        }
    }

    testSystemPrompts() {
        const currentPersona = this.personaManager.getCurrentPersona() || 'john_doe';
        const generatedPrompt = this.generateSystemPrompt(currentPersona, 'test message');
        const promptPreview = document.getElementById('promptPreview');
        if (promptPreview) {
            promptPreview.textContent = generatedPrompt;
        }
        this.showPromptMessage('System prompt preview updated below.', 'info');
    }

    generateSystemPrompt(personaId, userMessage) {
        const persona = this.personaManager.getPersona(personaId);
        return this.systemPromptsManager.generateSystemPrompt(persona, userMessage);
    }

    addCustomPrompt() {
        const customPromptsList = document.getElementById('customPromptsList');
        if (!customPromptsList) return;

        const newPromptItem = document.createElement('div');
        newPromptItem.className = 'custom-prompt-item';
        newPromptItem.innerHTML = `
            <input type="text" placeholder="Scenario name (e.g., 'Loan Inquiries')" class="scenario-name">
            <textarea placeholder="Custom prompt for this scenario..." class="custom-prompt-text" rows="4"></textarea>
            <button class="remove-custom-prompt" onclick="this.parentElement.remove()">Remove</button>
        `;
        customPromptsList.appendChild(newPromptItem);
    }

    saveCustomPrompts() {
        const customPrompts = [];
        const customPromptItems = document.querySelectorAll('.custom-prompt-item');

        customPromptItems.forEach(item => {
            const nameInput = item.querySelector('.scenario-name');
            const promptTextarea = item.querySelector('.custom-prompt-text');

            if (nameInput && promptTextarea) {
                const name = nameInput.value.trim();
                const prompt = promptTextarea.value.trim();

                if (name && prompt) {
                    customPrompts.push({ name, prompt });
                }
            }
        });

        this.systemPromptsManager.updateCustomPrompts(customPrompts);
    }

    loadCustomPrompts() {
        const customPromptsList = document.getElementById('customPromptsList');
        if (!customPromptsList) return;

        customPromptsList.innerHTML = '';

        this.systemPromptsManager.getCustomPrompts().forEach(customPrompt => {
            const promptItem = document.createElement('div');
            promptItem.className = 'custom-prompt-item';
            promptItem.innerHTML = `
                <input type="text" placeholder="Scenario name" class="scenario-name" value="${customPrompt.name}">
                <textarea placeholder="Custom prompt for this scenario..." class="custom-prompt-text" rows="4">${customPrompt.prompt}</textarea>
                <button class="remove-custom-prompt" onclick="this.parentElement.remove()">Remove</button>
            `;
            customPromptsList.appendChild(promptItem);
        });

        // Add one empty prompt item if none exist
        if (this.systemPromptsManager.getCustomPrompts().length === 0) {
            this.addCustomPrompt();
        }
    }

    showPromptMessage(message, type) {
        // Create or update message element
        let messageEl = document.getElementById('prompt-message');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'prompt-message';
            messageEl.style.cssText = 'padding: 10px; margin: 10px 0; border-radius: 4px; font-weight: bold;';

            const promptActions = document.querySelector('.prompt-actions');
            if (promptActions) {
                promptActions.parentNode.insertBefore(messageEl, promptActions);
            }
        }

        // Set message and styling based on type
        messageEl.textContent = message;
        messageEl.className = `prompt-message ${type}`;

        switch (type) {
            case 'success':
                messageEl.style.backgroundColor = '#d4edda';
                messageEl.style.color = '#155724';
                messageEl.style.border = '1px solid #c3e6cb';
                break;
            case 'error':
                messageEl.style.backgroundColor = '#f8d7da';
                messageEl.style.color = '#721c24';
                messageEl.style.border = '1px solid #f5c6cb';
                break;
            case 'info':
                messageEl.style.backgroundColor = '#d1ecf1';
                messageEl.style.color = '#0c5460';
                messageEl.style.border = '1px solid #bee5eb';
                break;
        }

        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 3000);
    }
    // UI Helper methods
    addMessage(content, type, agentName = null) {
        const conversation = document.getElementById('conversation');
        if (!conversation) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message`;

        messageDiv.innerHTML = `
            <div class="message-content">
                ${content}
            </div>
        `;

        conversation.appendChild(messageDiv);
        conversation.scrollTop = conversation.scrollHeight;
        
        // Update agent indicator for bot messages
        if (type === 'bot' && agentName) {
            this.updateAgentIndicator(agentName);
        }
        
        console.log('Message added:', type, content, agentName ? `(Agent: ${agentName})` : '');
    }

    updateAgentIndicator(agentName) {
        const agentElement = document.getElementById('currentAgent');
        if (!agentElement) return;

        // Update the agent name
        agentElement.textContent = agentName;
        
        // Remove existing agent classes
        agentElement.classList.remove('fraud-agent', 'payments-agent', 'idv-agent', 'banking-info-agent', 'default-agent');
        
        // Add appropriate class based on agent name
        const agentClass = this.getAgentClass(agentName);
        if (agentClass) {
            agentElement.classList.add(agentClass);
        }
        
        console.log('Agent indicator updated:', agentName);
    }

    getAgentClass(agentName) {
        const agentClassMap = {
            'FraudAgent': 'fraud-agent',
            'PaymentsAgent': 'payments-agent',
            'IDVAgent': 'idv-agent',
            'BankingInfoAgent': 'banking-info-agent',
            'Default Agent': 'default-agent'
        };
        
        return agentClassMap[agentName] || 'default-agent';
    }

    clearConversation() {
        const conversation = document.getElementById('conversation');
        if (!conversation) return;

        // Show confirmation dialog
        const confirmed = confirm('Are you sure you want to clear the conversation? This action cannot be undone.');
        
        if (confirmed) {
            // Clear all messages except keep the initial bot greeting
            conversation.innerHTML = `
                <div class="bot-message">
                    <div class="message-content">
                        Hello! I'm your AI voice assistant. How can I help you today?
                    </div>
                </div>
            `;
            
            // Reset agent indicator to default
            this.updateAgentIndicator('Default Agent');
            
            console.log('Conversation cleared');
            this.updateStatus('Conversation cleared - Ready to listen');
            
            // Clear streaming conversation state if in streaming mode
            if (this.streamingManager && this.isStreamingMode) {
                this.streamingManager.clearConversationState();
            }
            
            // Stop any currently playing audio
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio.src = '';
                this.currentAudio = null;
            }
            
            // Stop browser TTS if active
            if ('speechSynthesis' in window) {
                speechSynthesis.cancel();
            }
            
            // Reset current state to ready
            this.currentState = 'ready';
        }
    }

    speakWithBrowserTTS(text) {
        if ('speechSynthesis' in window) {
            console.log('Using browser TTS fallback for:', text);

            const speakText = () => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.9;
                utterance.pitch = 1;
                utterance.volume = 0.8;

                // Try to use a female voice
                const voices = speechSynthesis.getVoices();
                const femaleVoice = voices.find(voice =>
                    voice.name.toLowerCase().includes('female') ||
                    voice.name.toLowerCase().includes('zira') ||
                    voice.name.toLowerCase().includes('susan') ||
                    voice.name.toLowerCase().includes('samantha') ||
                    voice.name.toLowerCase().includes('karen')
                );

                if (femaleVoice) {
                    utterance.voice = femaleVoice;
                }

                utterance.onstart = () => {
                    this.updateStatus('🔊 Speaking (Browser TTS)...');
                };

                utterance.onend = () => {
                    this.updateStatus('Ready to listen');
                };

                utterance.onerror = (error) => {
                    console.error('Browser TTS error:', error);
                    this.updateStatus('TTS error - Ready to listen');
                };

                speechSynthesis.speak(utterance);
            };

            // If voices aren't loaded yet, wait for them
            if (speechSynthesis.getVoices().length === 0) {
                speechSynthesis.addEventListener('voiceschanged', speakText, { once: true });
            } else {
                speakText();
            }
        } else {
            console.error('Browser TTS not supported');
            this.updateStatus('TTS not supported - Ready to listen');
        }
    }

    // Settings and configuration methods
    saveApiKey() {
        console.log('Save API key clicked');
        const apiKeyInput = document.getElementById('openaiKey');
        if (apiKeyInput) {
            const apiKey = apiKeyInput.value.trim();
            if (apiKey) {
                this.openaiApiKey = apiKey;
                this.apiClient.setApiKey(apiKey);
                // Ensure token tracker is properly linked
                this.apiClient.setTokenTracker(this.tokenTracker);
                this.streamingManager.setApiKey(apiKey);
                this.updateKeyStatus();
                alert('API key saved successfully!');
                console.log('API key saved and updated');
            } else {
                alert('Please enter a valid API key.');
            }
        }
    }

    clearApiKey() {
        console.log('Clear API key clicked');

        const confirmed = confirm('Are you sure you want to clear your OpenAI API key?\n\nThis will:\n• Remove the key from memory\n• Disable all OpenAI features\n• Require re-entering the key to use the app');

        if (confirmed) {
            // Clear from memory
            this.openaiApiKey = '';

            // Clear from API clients
            this.apiClient.setApiKey('');
            this.streamingManager.setApiKey('');

            // Clear the input field
            const apiKeyInput = document.getElementById('openaiKey');
            if (apiKeyInput) {
                apiKeyInput.value = '';
            }

            // Update status
            this.updateKeyStatus();

            // Disconnect if connected
            if (this.isConnected) {
                this.disconnectStreaming();
            }

            alert('API key cleared successfully!\n\nYou will need to enter a new API key to use OpenAI features.');
            console.log('API key cleared from all locations');
        }
    }

    updateKeyStatus() {
        const keyStatus = document.getElementById('keyStatus');
        if (keyStatus) {
            if (this.openaiApiKey && this.openaiApiKey.length > 0) {
                keyStatus.textContent = `API Key Set (${this.openaiApiKey.substring(0, 7)}...)`;
                keyStatus.className = 'key-status key-set';
            } else {
                keyStatus.textContent = 'No API key set';
                keyStatus.className = 'key-status no-key';
            }
        }
    }

    // Debug callback for streaming manager
    debugStreamingMessage(message, data) {
        this.updateDebugOutput('streamingOutput', message + (data ? ` | Data: ${JSON.stringify(data)}` : ''));
    }

    toggleStreamingMode(enabled) {
        console.log('Toggle streaming mode:', enabled);
        this.isStreamingMode = enabled;
        localStorage.setItem('streaming_mode', enabled.toString());

        const batchControls = document.getElementById('batchControls');
        const streamingControls = document.getElementById('streamingControls');
        const modeDescription = document.getElementById('modeDescription');

        if (batchControls && streamingControls && modeDescription) {
            if (enabled) {
                batchControls.classList.add('hidden');
                streamingControls.classList.remove('hidden');
                modeDescription.textContent = 'Streaming Mode: Real-time conversation like a phone call';
            } else {
                batchControls.classList.remove('hidden');
                streamingControls.classList.add('hidden');
                modeDescription.textContent = 'Batch Mode: Click to record, then process';
            }
        }
    }

    async connectStreaming() {
        console.log('Connect streaming clicked');
        if (!this.openaiApiKey) {
            const key = prompt("Enter your OpenAI API key:");
            if (key && key.trim()) {
                this.openaiApiKey = key.trim();
                this.apiClient.setApiKey(this.openaiApiKey);
                this.streamingManager.setApiKey(this.openaiApiKey);
                this.updateKeyStatus();
            } else {
                this.updateStatus('OpenAI API key is required for streaming mode');
                return;
            }
        }

        if (this.isConnected) {
            console.log('Already connected to streaming');
            return;
        }

        try {
            this.updateConnectionStatus('connecting');
            this.updateStatus('🔄 Connecting to OpenAI Realtime API...');

            // Update streaming manager settings
            this.streamingManager.updateSettings(this.streamingSettings);

            // Attempt real connection to OpenAI Realtime API
            const result = await this.streamingManager.connect();

            if (result.success) {
                this.isConnected = true;
                this.updateConnectionStatus('connected');
                this.updateStatus('📞 Connected to OpenAI Realtime API!');
                this.updateDebugOutput('streamingOutput', 'Successfully connected to OpenAI Realtime API');

                // Start audio streaming
                const audioResult = await this.streamingManager.startAudioStreaming();
                if (audioResult.success) {
                    this.updateStatus('🎤 Connected and streaming audio!');
                    this.updateDebugOutput('streamingOutput', 'Audio streaming started successfully');
                } else {
                    this.updateStatus('📞 Connected but audio streaming failed');
                    this.updateDebugOutput('streamingOutput', `Audio streaming error: ${audioResult.error}`);
                }

                const connectBtn = document.getElementById('connectBtn');
                const disconnectBtn = document.getElementById('disconnectBtn');
                const muteBtn = document.getElementById('muteBtn');
                if (connectBtn) connectBtn.disabled = true;
                if (disconnectBtn) disconnectBtn.disabled = false;
                if (muteBtn) {
                    muteBtn.disabled = false;
                    console.log('Mute button enabled - you can now mute/unmute your microphone');
                }

            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('Streaming connection error:', error);
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            this.updateStatus(`❌ Connection failed: ${error.message}`);
            this.updateDebugOutput('streamingOutput', `Connection failed: ${error.message}`);

            const connectBtn = document.getElementById('connectBtn');
            const disconnectBtn = document.getElementById('disconnectBtn');
            const muteBtn = document.getElementById('muteBtn');
            if (connectBtn) connectBtn.disabled = false;
            if (disconnectBtn) disconnectBtn.disabled = true;
            if (muteBtn) muteBtn.disabled = true;
        }
    }

    async disconnectStreaming() {
        console.log('Disconnect streaming clicked');

        if (!this.isConnected) {
            console.log('Already disconnected from streaming');
            return;
        }

        try {
            this.updateStatus('🔄 Disconnecting...');

            // Use streaming manager to disconnect
            await this.streamingManager.disconnect();

            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            this.updateStatus('📞 Disconnected from OpenAI Realtime API');
            this.updateDebugOutput('streamingOutput', 'Disconnected from OpenAI Realtime API');

            const connectBtn = document.getElementById('connectBtn');
            const disconnectBtn = document.getElementById('disconnectBtn');
            const muteBtn = document.getElementById('muteBtn');
            if (connectBtn) connectBtn.disabled = false;
            if (disconnectBtn) disconnectBtn.disabled = true;
            if (muteBtn) muteBtn.disabled = true;

        } catch (error) {
            console.error('Error during disconnect:', error);
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            this.updateStatus('📞 Disconnected (with errors)');
            this.updateDebugOutput('streamingOutput', `Disconnect error: ${error.message}`);
        }
    }

    // Helper methods
    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) statusElement.textContent = message;
        console.log('Status:', message);
    }

    showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(notificationContainer);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : type === 'warning' ? '#fff3cd' : '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : type === 'warning' ? '#856404' : '#0c5460'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : type === 'warning' ? '#ffeaa7' : '#bee5eb'};
            border-radius: 4px;
            padding: 12px 16px;
            margin-bottom: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease-out;
            cursor: pointer;
            position: relative;
        `;

        notification.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${message}</span>
                <span style="margin-left: 10px; font-weight: bold; cursor: pointer;">&times;</span>
            </div>
        `;

        // Add click to dismiss
        notification.addEventListener('click', () => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });

        // Add CSS animations if not already added
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        notificationContainer.appendChild(notification);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);

        // Also log to console
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.className = `status-indicator ${status}`;
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
    }

    updatePersonaSelector() {
        const selector = document.getElementById('personaSelect');
        if (selector) {
            selector.innerHTML = '';
            const personas = this.personaManager.getAllPersonas();
            Object.keys(personas).forEach(personaId => {
                const option = document.createElement('option');
                option.value = personaId;
                option.textContent = personas[personaId].name;
                selector.appendChild(option);
            });

            // Set current selection
            selector.value = this.personaManager.getCurrentPersona();
        }
    }

    initializeGptSettings() {
        console.log('Initializing GPT settings...');

        const gptModel = document.getElementById('gptModel');
        const modelDescription = document.getElementById('modelDescription');

        if (gptModel) {
            gptModel.value = this.gptModel;
            this.updateModelDescription(this.gptModel);
        }

        console.log('GPT settings initialized:', { model: this.gptModel });
    }

    initializeTtsSettings() {
        console.log('Initializing TTS settings...');

        const ttsMode = document.getElementById('ttsMode');
        const ttsModel = document.getElementById('ttsModel');
        const ttsVoice = document.getElementById('ttsVoice');
        const ttsSpeed = document.getElementById('ttsSpeed');
        const ttsSpeedValue = document.getElementById('ttsSpeedValue');

        if (ttsMode) ttsMode.value = this.ttsMode;
        if (ttsModel) ttsModel.value = this.ttsSettings.model;
        if (ttsVoice) ttsVoice.value = this.ttsSettings.voice;
        if (ttsSpeed) ttsSpeed.value = this.ttsSettings.speed;
        if (ttsSpeedValue) ttsSpeedValue.textContent = this.ttsSettings.speed + 'x';

        // Show/hide appropriate settings based on mode
        this.toggleTtsSettings();

        console.log('TTS settings initialized:', { mode: this.ttsMode, settings: this.ttsSettings });
    }

    initializeBrowserTts() {
        console.log('Initializing Browser TTS...');

        // Load available voices
        this.loadBrowserVoices();

        // Initialize browser TTS settings
        const browserRate = document.getElementById('browserRate');
        const browserPitch = document.getElementById('browserPitch');
        const browserVolume = document.getElementById('browserVolume');
        const browserRateValue = document.getElementById('browserRateValue');
        const browserPitchValue = document.getElementById('browserPitchValue');
        const browserVolumeValue = document.getElementById('browserVolumeValue');

        if (browserRate) browserRate.value = this.browserTtsSettings.rate;
        if (browserPitch) browserPitch.value = this.browserTtsSettings.pitch;
        if (browserVolume) browserVolume.value = this.browserTtsSettings.volume;
        if (browserRateValue) browserRateValue.textContent = this.browserTtsSettings.rate + 'x';
        if (browserPitchValue) browserPitchValue.textContent = this.browserTtsSettings.pitch;
        if (browserVolumeValue) browserVolumeValue.textContent = Math.round(this.browserTtsSettings.volume * 100) + '%';

        console.log('Browser TTS settings initialized:', this.browserTtsSettings);
    }

    loadBrowserVoices() {
        if ('speechSynthesis' in window) {
            const loadVoices = () => {
                this.availableVoices = speechSynthesis.getVoices();
                console.log('Available browser voices:', this.availableVoices.length);

                const browserVoiceSelect = document.getElementById('browserVoice');
                if (browserVoiceSelect && this.availableVoices.length > 0) {
                    browserVoiceSelect.innerHTML = '';

                    this.availableVoices.forEach((voice, index) => {
                        const option = document.createElement('option');
                        option.value = index;
                        option.textContent = `${voice.name} (${voice.lang})`;
                        if (voice.default) option.textContent += ' - Default';
                        browserVoiceSelect.appendChild(option);
                    });

                    // Set saved voice or default
                    if (this.browserTtsSettings.voice) {
                        browserVoiceSelect.value = this.browserTtsSettings.voice;
                    }
                }
            };

            // Load voices immediately if available
            loadVoices();

            // Also listen for voices changed event (some browsers load voices asynchronously)
            speechSynthesis.onvoiceschanged = loadVoices;
        } else {
            console.warn('Browser TTS not supported');
        }
    }

    updateTtsModel(e) {
        this.ttsSettings.model = e.target.value;
        localStorage.setItem('tts_model', this.ttsSettings.model);
        console.log('TTS model updated:', this.ttsSettings.model);
    }

    updateTtsVoice(e) {
        this.ttsSettings.voice = e.target.value;
        localStorage.setItem('tts_voice', this.ttsSettings.voice);
        console.log('TTS voice updated:', this.ttsSettings.voice);
    }

    updateTtsSpeed(e) {
        this.ttsSettings.speed = parseFloat(e.target.value);
        const ttsSpeedValue = document.getElementById('ttsSpeedValue');
        if (ttsSpeedValue) ttsSpeedValue.textContent = this.ttsSettings.speed + 'x';
        localStorage.setItem('tts_speed', this.ttsSettings.speed);
        console.log('TTS speed updated:', this.ttsSettings.speed);
    }

    updateGptModel(e) {
        this.gptModel = e.target.value;
        localStorage.setItem('gpt_model', this.gptModel);
        this.updateModelDescription(this.gptModel);
        console.log('GPT model updated:', this.gptModel);
    }

    updateModelDescription(model) {
        const modelDescription = document.getElementById('modelDescription');
        const gptModelLabel = document.getElementById('gptModelLabel');

        const descriptions = {
            'gpt-3.5-turbo': 'Fast and cost-effective for basic financial conversations',
            'gpt-4o-mini': 'Better reasoning and accuracy, still cost-effective',
            'gpt-4o': 'High-quality responses with excellent reasoning',
            'gpt-4-turbo': 'Premium quality with advanced reasoning capabilities'
        };

        const labels = {
            'gpt-3.5-turbo': 'GPT-3.5 Turbo',
            'gpt-4o-mini': 'GPT-4o Mini',
            'gpt-4o': 'GPT-4o',
            'gpt-4-turbo': 'GPT-4 Turbo'
        };

        if (modelDescription) {
            modelDescription.textContent = descriptions[model] || 'Selected model for AI responses';
        }
        
        if (gptModelLabel) {
            gptModelLabel.textContent = labels[model] || model;
        }
    }

    updateTtsMode(e) {
        this.ttsMode = e.target.value;
        localStorage.setItem('tts_mode', this.ttsMode);
        this.toggleTtsSettings();
        console.log('TTS mode updated:', this.ttsMode);
    }

    toggleTtsSettings() {
        const openaiSettings = document.getElementById('openaiTtsSettings');
        const browserSettings = document.getElementById('browserTtsSettings');

        if (openaiSettings && browserSettings) {
            if (this.ttsMode === 'openai') {
                openaiSettings.classList.remove('hidden');
                browserSettings.classList.add('hidden');
            } else {
                openaiSettings.classList.add('hidden');
                browserSettings.classList.remove('hidden');
            }
        }
    }

    updateBrowserVoice(e) {
        this.browserTtsSettings.voice = e.target.value;
        localStorage.setItem('browser_tts_voice', this.browserTtsSettings.voice);
        console.log('Browser TTS voice updated:', this.browserTtsSettings.voice);
    }

    updateBrowserRate(e) {
        this.browserTtsSettings.rate = parseFloat(e.target.value);
        localStorage.setItem('browser_tts_rate', this.browserTtsSettings.rate);
        const rateValue = document.getElementById('browserRateValue');
        if (rateValue) rateValue.textContent = this.browserTtsSettings.rate + 'x';
        console.log('Browser TTS rate updated:', this.browserTtsSettings.rate);
    }

    updateBrowserPitch(e) {
        this.browserTtsSettings.pitch = parseFloat(e.target.value);
        localStorage.setItem('browser_tts_pitch', this.browserTtsSettings.pitch);
        const pitchValue = document.getElementById('browserPitchValue');
        if (pitchValue) pitchValue.textContent = this.browserTtsSettings.pitch;
        console.log('Browser TTS pitch updated:', this.browserTtsSettings.pitch);
    }

    updateBrowserVolume(e) {
        this.browserTtsSettings.volume = parseFloat(e.target.value);
        localStorage.setItem('browser_tts_volume', this.browserTtsSettings.volume);
        const volumeValue = document.getElementById('browserVolumeValue');
        if (volumeValue) volumeValue.textContent = Math.round(this.browserTtsSettings.volume * 100) + '%';
        console.log('Browser TTS volume updated:', this.browserTtsSettings.volume);
    }

    async testTtsVoice() {
        console.log('Test TTS voice clicked');
        if (!this.openaiApiKey) {
            const key = prompt("Enter your OpenAI API key:");
            if (key && key.trim()) {
                this.openaiApiKey = key.trim();
                this.apiClient.setApiKey(this.openaiApiKey);
                this.streamingManager.setApiKey(this.openaiApiKey);
                this.updateKeyStatus();
            } else {
                alert('OpenAI API key is required to test TTS voice');
                return;
            }
        }

        const testText = `Hello! I'm your AI voice assistant using the ${this.ttsSettings.voice} voice. This is how I sound with your current settings.`;

        try {
            await this.textToSpeechOpenAI(testText);
        } catch (error) {
            console.error('TTS test error:', error);
            this.textToSpeechBrowser(testText);
        }
    }

    testBrowserVoice() {
        const testText = "Hello! This is a test of the browser text-to-speech voice. How does it sound with your current settings?";
        this.textToSpeechBrowser(testText);
    }

    initializeSpeechSettings() {
        console.log('Initializing speech settings...');
    }

    initializeStreamingSettings() {
        console.log('Initializing streaming settings...');
        const responseDelay = document.getElementById('responseDelay');
        const responseDelayValue = document.getElementById('responseDelayValue');

        if (responseDelay) responseDelay.value = this.streamingSettings.responseDelay;
        if (responseDelayValue) responseDelayValue.textContent = this.streamingSettings.responseDelay + 's';
    }

    initializeStreamingMode() {
        console.log('Initializing streaming mode...');
        const streamingModeCheckbox = document.getElementById('streamingMode');
        if (streamingModeCheckbox) {
            streamingModeCheckbox.checked = this.isStreamingMode;
            this.toggleStreamingMode(this.isStreamingMode);
        }
    }

    // Cleanup methods
    cleanupMicrophoneStream() {
        if (this.cachedMicStream) {
            console.log('Cleaning up cached microphone stream');
            this.cachedMicStream.getTracks().forEach(track => {
                track.stop();
                console.log('Stopped audio track:', track.label);
            });
            this.cachedMicStream = null;
            this.micPermissionGranted = false;
        }
    }

    cleanupAllResources() {
        console.log('Cleaning up all resources...');

        this.cleanupMicrophoneStream();
        this.stopAudioLevelMonitoring();

        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.src = '';
            this.currentAudio = null;
        }

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        this.currentState = 'ready';
        this.isRecording = false;
        this.isConnected = false;

        this.updateRecordingStatus('🔴 Not Recording');
    }

    setupCleanupListeners() {
        console.log('Setting up cleanup listeners...');

        // Clean up all resources when page unloads
        window.addEventListener('beforeunload', () => {
            this.cleanupAllResources();
        });

        window.addEventListener('pagehide', () => {
            this.cleanupAllResources();
        });

        // Clean up microphone stream on visibility change (tab switch) if not recording
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !this.isRecording) {
                this.cleanupMicrophoneStream();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.currentState === 'recording') {
                this.debug.log('Tab hidden while recording, stopping recording...');
                this.stopRecording();
            }
        });
    }

    // Debug Settings Management
    initializeDebugSettings() {
        this.debug.log('Initializing debug settings...');

        const debugToggle = document.getElementById('debugToggle');
        const debugDescription = document.getElementById('debugDescription');

        if (debugToggle) {
            debugToggle.checked = window.debugManager.isEnabled();
            this.updateDebugDescription();
        }
    }

    toggleDebugMode(enabled) {
        if (enabled) {
            window.debugManager.enable();
        } else {
            window.debugManager.disable();
        }

        this.updateDebugDescription();
        this.debug.log('Debug mode toggled:', enabled ? 'enabled' : 'disabled');
    }

    updateDebugDescription() {
        const debugDescription = document.getElementById('debugDescription');
        if (debugDescription) {
            const isEnabled = window.debugManager.isEnabled();
            debugDescription.textContent = isEnabled
                ? 'Debug logging is enabled (detailed console output active)'
                : 'Debug logging is disabled (recommended for normal use)';
        }
    }

    // Reset token usage tracking
    resetTokenUsage() {
        this.debug.log('Resetting token usage...');

        if (this.tokenTracker) {
            this.tokenTracker.resetUsage();
            this.tokenTracker.updateDisplay();
            this.debug.log('Token usage reset successfully');

            // Show user feedback
            this.updateStatus('Token usage reset successfully');
            setTimeout(() => {
                this.updateStatus('Ready to listen');
            }, 2000);
        } else {
            this.debug.error('Token tracker not available');
        }
    }

    // Update token display manually
    updateTokenDisplay() {
        this.debug.log('Manually updating token display...');

        if (this.tokenTracker) {
            // Force reload from localStorage
            this.tokenTracker.usage = this.tokenTracker.loadUsage();
            this.tokenTracker.updateDisplay();

            const usage = this.tokenTracker.getUsage();
            this.debug.log('Current usage:', usage);

            // Show user feedback
            this.updateStatus(`Updated: ${usage.whisper.requests} Whisper, ${usage.gpt.tokens} GPT tokens, ${usage.tts.characters} TTS chars`);
            setTimeout(() => {
                this.updateStatus('Ready to listen');
            }, 3000);
        } else {
            this.debug.error('Token tracker not available');
            this.updateStatus('Error: Token tracker not available');
        }
    }

    // Test token tracking with sample data
    testTokenTracking() {
        this.debug.log('Testing token tracking with sample data...');

        if (this.tokenTracker) {
            // Add some test usage
            this.tokenTracker.trackWhisperUsage(0.25); // 15 seconds of audio
            this.tokenTracker.trackGptUsage(50, 25); // 50 input, 25 output tokens
            this.tokenTracker.trackTtsUsage(100, 'tts-1'); // 100 characters

            this.tokenTracker.updateDisplay();

            // Show user feedback
            this.updateStatus('Test data added: +1 Whisper request, +75 GPT tokens, +100 TTS chars');
            setTimeout(() => {
                this.updateStatus('Ready to listen');
            }, 3000);
        } else {
            this.debug.error('Token tracker not available');
            this.updateStatus('Error: Token tracker not available');
        }
    }

    // Toggle debug panel visibility (Hide/Show button)
    toggleDebugPanel() {
        const debugContent = document.getElementById('debugContent');
        const toggleButton = document.getElementById('toggleDebug');

        if (debugContent && toggleButton) {
            const isHidden = debugContent.classList.contains('hidden');

            if (isHidden) {
                // Show the panel
                debugContent.classList.remove('hidden');
                toggleButton.textContent = 'Hide';
                this.debug.log('Debug panel shown');
            } else {
                // Hide the panel
                debugContent.classList.add('hidden');
                toggleButton.textContent = 'Show';
                this.debug.log('Debug panel hidden');
            }
        } else {
            this.debug.error('Debug panel elements not found');
        }
    }

    // Agent Configuration Methods
    
    /**
     * Open the agent configuration page in a new tab
     */
    openAgentConfiguration() {
        this.debug.log('Opening agent configuration page...');
        
        // Open the configuration page in a new tab
        const configUrl = 'test-agent-configuration.html';
        const configWindow = window.open(configUrl, '_blank');
        
        if (configWindow) {
            this.debug.log('Agent configuration page opened successfully');
            this.updateStatus('Agent configuration page opened in new tab');
            
            // Refresh status after a short delay to show updated info
            setTimeout(() => {
                this.refreshAgentStatus();
                this.updateStatus('Ready to listen');
            }, 2000);
        } else {
            this.debug.error('Failed to open agent configuration page - popup blocked?');
            this.updateStatus('Failed to open configuration page - check popup blocker');
        }
    }

    /**
     * Refresh the agent status display in the admin panel
     */
    refreshAgentStatus() {
        this.debug.log('Refreshing agent status...');
        
        try {
            if (this.agentRouter) {
                const stats = this.agentRouter.getStats();
                
                // Update status display elements
                const totalAgentsEl = document.getElementById('totalAgents');
                const enabledAgentsEl = document.getElementById('enabledAgents');
                const disabledAgentsEl = document.getElementById('disabledAgents');
                
                if (totalAgentsEl) totalAgentsEl.textContent = stats.totalAgents;
                if (enabledAgentsEl) enabledAgentsEl.textContent = stats.enabledAgents;
                if (disabledAgentsEl) disabledAgentsEl.textContent = stats.disabledAgents;
                
                this.debug.log('Agent status updated', stats);
                this.updateStatus(`Agent status: ${stats.enabledAgents}/${stats.totalAgents} enabled`);
                
                // Brief status message
                setTimeout(() => {
                    this.updateStatus('Ready to listen');
                }, 2000);
                
            } else {
                this.debug.warn('AgentRouter not available');
                this.updateStatus('Agent system not available');
            }
        } catch (error) {
            this.debug.error('Failed to refresh agent status', { error: error.message });
            this.updateStatus('Error refreshing agent status');
        }
    }

    // ===== LLM Manager Integration Functions =====

    /**
     * Initialize LLM Manager integration
     */
    initializeLLMManager() {
        this.debug.log('Initializing LLM Manager integration...');
        
        try {
            // Initialize LLM Manager if available
            if (typeof LLMManager !== 'undefined') {
                this.llmManager = new LLMManager();
                this.debug.log('LLM Manager initialized successfully');
            }
            
            // Initialize Guardrails Manager if available
            if (typeof GuardrailsManager !== 'undefined') {
                this.guardrailsManager = new GuardrailsManager();
                this.debug.log('Guardrails Manager initialized successfully');
            }
            
            // Initialize Voice Config Manager if available
            if (typeof VoiceConfigManager !== 'undefined') {
                this.voiceConfigManager = new VoiceConfigManager();
                this.debug.log('Voice Config Manager initialized successfully');
            }
            
            // Set up LLM Manager event listeners
            this.setupLLMManagerEventListeners();
            
        } catch (error) {
            this.debug.error('Failed to initialize LLM Manager:', error);
        }
    }

    /**
     * Set up LLM Manager event listeners
     */
    setupLLMManagerEventListeners() {
        // LLM Manager navigation
        document.querySelectorAll('.llm-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchLLMSection(e.target.dataset.llmSection);
            });
        });

        // LLM Manager audit log filter
        const llmLogFilter = document.getElementById('llmLogFilter');
        if (llmLogFilter) {
            llmLogFilter.addEventListener('change', () => {
                this.filterLLMAuditLog(llmLogFilter.value);
            });
        }
    }

    /**
     * Switch between LLM Manager sections
     */
    switchLLMSection(sectionName) {
        this.debug.log('Switching to LLM section:', sectionName);
        
        // Update navigation
        document.querySelectorAll('.llm-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-llm-section="${sectionName}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.llm-content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`llm-${sectionName}-section`).classList.add('active');
        
        // Load section-specific content
        this.loadLLMSectionContent(sectionName);
    }

    /**
     * Load content for specific LLM Manager section
     */
    loadLLMSectionContent(sectionName) {
        switch (sectionName) {
            case 'overview':
                this.refreshLLMData();
                break;
            case 'configuration':
                this.loadLLMConfigurationContent();
                break;
            case 'guardrails':
                this.loadLLMGuardrailsContent();
                break;
            case 'voice':
                this.loadLLMVoiceContent();
                break;
            case 'audit':
                this.refreshLLMAuditLog();
                break;
        }
    }

    /**
     * Refresh LLM Manager data
     */
    refreshLLMData() {
        this.debug.log('Refreshing LLM Manager data...');
        
        try {
            if (!this.llmManager) {
                this.debug.warn('LLM Manager not available');
                return;
            }
            
            const stats = this.llmManager.getConfigurationStats();
            const agents = this.llmManager.getAgentConfigurations();
            
            // Update statistics
            const totalEl = document.getElementById('llmTotalAgents');
            const enabledEl = document.getElementById('llmEnabledAgents');
            const disabledEl = document.getElementById('llmDisabledAgents');
            const lastUpdatedEl = document.getElementById('llmLastUpdated');
            
            if (totalEl) totalEl.textContent = stats.totalAgents;
            if (enabledEl) enabledEl.textContent = stats.enabledAgents;
            if (disabledEl) disabledEl.textContent = stats.disabledAgents;
            if (lastUpdatedEl) {
                lastUpdatedEl.textContent = stats.lastUpdated ? 
                    new Date(stats.lastUpdated).toLocaleString() : 'Never';
            }
            
            // Update agent grid
            this.renderLLMAgentGrid(agents);
            
            this.debug.log('LLM Manager data refreshed successfully');
            
        } catch (error) {
            this.debug.error('Failed to refresh LLM Manager data:', error);
        }
    }

    /**
     * Render LLM Manager agent grid
     */
    renderLLMAgentGrid(agents) {
        const grid = document.getElementById('llmAgentsGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        Object.entries(agents).forEach(([name, config]) => {
            const card = this.createLLMAgentCard(name, config);
            grid.appendChild(card);
        });
    }

    /**
     * Create LLM Manager agent card element
     */
    createLLMAgentCard(name, config) {
        const card = document.createElement('div');
        card.className = 'llm-agent-card';
        
        const statusClass = config.enabled !== false ? 'enabled' : 'disabled';
        const statusText = config.enabled !== false ? 'Enabled' : 'Disabled';
        const statusIndicator = config.enabled !== false ? 'online' : 'offline';
        
        card.innerHTML = `
            <div class="llm-agent-header">
                <div class="llm-agent-name">
                    <span class="llm-status-indicator ${statusIndicator}"></span>
                    ${name}
                </div>
                <div class="llm-agent-status ${statusClass}">${statusText}</div>
            </div>
            
            <div class="llm-agent-description">
                ${config.description || 'No description available'}
            </div>
            
            <div class="llm-agent-details">
                <div class="llm-detail-item">
                    <span class="llm-detail-label">Provider:</span>
                    <span class="llm-detail-value">${config.llmProvider || 'openai'}</span>
                </div>
                <div class="llm-detail-item">
                    <span class="llm-detail-label">Model:</span>
                    <span class="llm-detail-value">${config.llmModel || 'gpt-4'}</span>
                </div>
                <div class="llm-detail-item">
                    <span class="llm-detail-label">Priority:</span>
                    <span class="llm-detail-value">${config.priority || 'N/A'}</span>
                </div>
                <div class="llm-detail-item">
                    <span class="llm-detail-label">Max Tokens:</span>
                    <span class="llm-detail-value">${config.maxTokens || 'N/A'}</span>
                </div>
            </div>
            
            <div class="llm-agent-actions">
                <button class="llm-btn llm-btn-primary" onclick="app.openLLMAgentConfiguration('${name}')">
                    ⚙️ Configure
                </button>
                <button class="llm-btn llm-btn-secondary" onclick="app.openLLMGuardrailsEditor('${name}')">
                    🛡️ Guardrails
                </button>
                <button class="llm-btn llm-btn-warning" onclick="app.openLLMVoiceConfig('${name}')">
                    🎤 Voice
                </button>
                <button class="llm-btn ${statusClass === 'enabled' ? 'llm-btn-danger' : 'llm-btn-success'}" 
                        onclick="app.toggleLLMAgent('${name}')">
                    ${statusClass === 'enabled' ? '⏸️ Disable' : '▶️ Enable'}
                </button>
            </div>
        `;
        
        return card;
    }

    /**
     * Load LLM configuration content
     */
    loadLLMConfigurationContent() {
        const content = document.getElementById('llmConfigurationContent');
        if (!content || !this.llmManager) return;
        
        const agents = this.llmManager.getAgentConfigurations();
        
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Select Agent to Configure</label>
                <select class="llm-form-select" id="llmConfigAgentSelect" onchange="app.openLLMAgentConfiguration(this.value)">
                    <option value="">Choose an agent...</option>
                    ${Object.keys(agents).map(name => 
                        `<option value="${name}">${name}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="llm-config-info">
                <h5>Configuration Management</h5>
                <ul class="feature-list">
                    <li>Modify agent settings and parameters</li>
                    <li>Configure LLM provider and model settings</li>
                    <li>Manage trigger keywords and priorities</li>
                    <li>Enable/disable agents and telemetry</li>
                    <li>View configuration history and metadata</li>
                </ul>
                <p style="margin-top: 15px; color: #6c757d;">
                    Select an agent from the dropdown above to configure its settings.
                </p>
            </div>
        `;
    }

    /**
     * Load LLM guardrails content
     */
    loadLLMGuardrailsContent() {
        const content = document.getElementById('llmGuardrailsContent');
        if (!content || !this.llmManager) return;
        
        const agents = this.llmManager.getAgentConfigurations();
        
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Select Agent</label>
                <select class="llm-form-select" id="llmGuardrailsAgentSelect" onchange="app.loadLLMGuardrailsEditor(this.value)">
                    <option value="">Choose an agent...</option>
                    ${Object.keys(agents).map(name => 
                        `<option value="${name}">${name}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div id="llmGuardrailsEditor" style="display: none;">
                <!-- Guardrails editor will be loaded here -->
            </div>
        `;
    }

    /**
     * Load LLM voice content
     */
    loadLLMVoiceContent() {
        const content = document.getElementById('llmVoiceContent');
        if (!content || !this.llmManager) return;
        
        const agents = this.llmManager.getAgentConfigurations();
        
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Select Agent</label>
                <select class="llm-form-select" id="llmVoiceAgentSelect" onchange="app.loadLLMVoiceEditor(this.value)">
                    <option value="">Choose an agent...</option>
                    ${Object.keys(agents).map(name => 
                        `<option value="${name}">${name}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div id="llmVoiceEditor" style="display: none;">
                <!-- Voice editor will be loaded here -->
            </div>
        `;
    }

    /**
     * Refresh LLM audit log
     */
    refreshLLMAuditLog() {
        const entries = document.getElementById('llmAuditLogEntries');
        if (!entries) return;
        
        // Mock audit log entries for demonstration
        const mockEntries = [
            {
                timestamp: new Date().toISOString(),
                action: 'Agent Configuration Updated',
                details: 'PaymentsAgent configuration modified',
                type: 'config'
            },
            {
                timestamp: new Date(Date.now() - 300000).toISOString(),
                action: 'Guardrails Modified',
                details: 'FraudAgent guardrails updated',
                type: 'guardrails'
            },
            {
                timestamp: new Date(Date.now() - 600000).toISOString(),
                action: 'Voice Settings Changed',
                details: 'BankingInfoAgent voice configuration updated',
                type: 'voice'
            }
        ];
        
        entries.innerHTML = mockEntries.map(entry => `
            <div class="llm-log-entry">
                <div class="llm-log-info">
                    <div class="llm-log-action">${entry.action}</div>
                    <div class="llm-log-details">${entry.details}</div>
                </div>
                <div class="llm-log-timestamp">${new Date(entry.timestamp).toLocaleString()}</div>
            </div>
        `).join('');
    }

    /**
     * Filter LLM audit log
     */
    filterLLMAuditLog(filterType) {
        this.debug.log('Filtering LLM audit log:', filterType);
        // Implementation would filter the audit log based on type
        this.refreshLLMAuditLog();
    }

    /**
     * Open full LLM Manager in new window
     */
    openFullLLMManager() {
        this.debug.log('Opening full LLM Manager...');
        window.open('llm-manager-admin-ui.html', '_blank', 'width=1200,height=800');
    }

    /**
     * Export LLM configuration
     */
    exportLLMConfiguration() {
        this.debug.log('Exporting LLM configuration...');
        
        try {
            if (!this.llmManager) {
                this.showNotification('LLM Manager not available', 'error');
                return;
            }
            
            const config = this.llmManager.exportConfiguration();
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `llm-config-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Configuration exported successfully', 'success');
            
        } catch (error) {
            this.debug.error('Failed to export configuration:', error);
            this.showNotification('Failed to export configuration', 'error');
        }
    }

    /**
     * Import LLM configuration
     */
    importLLMConfiguration() {
        this.debug.log('Importing LLM configuration...');
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    
                    if (this.llmManager) {
                        this.llmManager.importConfiguration(config);
                        this.refreshLLMData();
                        this.showNotification('Configuration imported successfully', 'success');
                    } else {
                        this.showNotification('LLM Manager not available', 'error');
                    }
                    
                } catch (error) {
                    this.debug.error('Failed to import configuration:', error);
                    this.showNotification('Failed to import configuration', 'error');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    /**
     * Enable all agents
     */
    async enableAllAgents() {
        this.debug.log('Enabling all agents...');
        
        try {
            if (!this.llmManager) {
                this.showNotification('LLM Manager not available', 'error');
                return;
            }
            
            const agents = this.llmManager.getAgentConfigurations();
            const updatePromises = Object.keys(agents).map(async (agentName) => {
                return await this.llmManager.updateAgentConfiguration(agentName, { enabled: true });
            });
            
            // Wait for all updates to complete
            await Promise.all(updatePromises);
            
            this.refreshLLMData();
            this.showNotification('All agents enabled successfully', 'success');
            
        } catch (error) {
            this.debug.error('Failed to enable all agents:', error);
            this.showNotification('Failed to enable all agents', 'error');
        }
    }

    /**
     * Disable all agents
     */
    async disableAllAgents() {
        this.debug.log('Disabling all agents...');
        
        try {
            if (!this.llmManager) {
                this.showNotification('LLM Manager not available', 'error');
                return;
            }
            
            const agents = this.llmManager.getAgentConfigurations();
            const updatePromises = Object.keys(agents).map(async (agentName) => {
                return await this.llmManager.updateAgentConfiguration(agentName, { enabled: false });
            });
            
            // Wait for all updates to complete
            await Promise.all(updatePromises);
            
            this.refreshLLMData();
            this.showNotification('All agents disabled successfully', 'success');
            
        } catch (error) {
            this.debug.error('Failed to disable all agents:', error);
            this.showNotification('Failed to disable all agents', 'error');
        }
    }

    /**
     * Reset all configurations to defaults
     */
    resetAllToDefaults() {
        this.debug.log('Resetting all configurations to defaults...');
        
        if (confirm('Are you sure you want to reset all agent configurations to defaults? This cannot be undone.')) {
            try {
                if (!this.llmManager) {
                    this.showNotification('LLM Manager not available', 'error');
                    return;
                }
                
                this.llmManager.resetToDefaults();
                this.refreshLLMData();
                this.showNotification('All configurations reset to defaults', 'success');
                
            } catch (error) {
                this.debug.error('Failed to reset configurations:', error);
                this.showNotification('Failed to reset configurations', 'error');
            }
        }
    }

    /**
     * Validate all configurations
     */
    validateAllConfigurations() {
        this.debug.log('Validating all configurations...');
        
        try {
            if (!this.llmManager) {
                this.showNotification('LLM Manager not available', 'error');
                return;
            }
            
            const validationResults = this.llmManager.validateAllConfigurations();
            const validCount = validationResults.filter(r => r.valid).length;
            const totalCount = validationResults.length;
            
            if (validCount === totalCount) {
                this.showNotification(`All ${totalCount} configurations are valid`, 'success');
            } else {
                this.showNotification(`${validCount}/${totalCount} configurations are valid`, 'warning');
            }
            
        } catch (error) {
            this.debug.error('Failed to validate configurations:', error);
            this.showNotification('Failed to validate configurations', 'error');
        }
    }

    /**
     * Clear LLM audit log
     */
    clearLLMAuditLog() {
        this.debug.log('Clearing LLM audit log...');
        
        if (confirm('Are you sure you want to clear the audit log?')) {
            const entries = document.getElementById('llmAuditLogEntries');
            if (entries) {
                entries.innerHTML = '<div class="llm-log-entry"><div class="llm-log-info"><div class="llm-log-action">Audit log cleared</div></div></div>';
            }
            this.showNotification('Audit log cleared', 'success');
        }
    }

    /**
     * Open LLM agent configuration
     */
    openLLMAgentConfiguration(agentName) {
        if (!agentName) return;
        
        this.debug.log('Opening LLM agent configuration for:', agentName);
        this.switchLLMSection('configuration');
        
        // Set the selected agent in the dropdown
        const select = document.getElementById('llmConfigAgentSelect');
        if (select) {
            select.value = agentName;
        }
        
        this.showNotification(`Configuration for ${agentName} opened`, 'info');
    }

    /**
     * Open LLM guardrails editor
     */
    openLLMGuardrailsEditor(agentName) {
        if (!agentName) return;
        
        this.debug.log('Opening LLM guardrails editor for:', agentName);
        this.switchLLMSection('guardrails');
        
        // Set the selected agent in the dropdown
        const select = document.getElementById('llmGuardrailsAgentSelect');
        if (select) {
            select.value = agentName;
        }
        
        this.loadLLMGuardrailsEditor(agentName);
    }

    /**
     * Open LLM voice configuration
     */
    openLLMVoiceConfig(agentName) {
        if (!agentName) return;
        
        this.debug.log('Opening LLM voice config for:', agentName);
        this.switchLLMSection('voice');
        
        // Set the selected agent in the dropdown
        const select = document.getElementById('llmVoiceAgentSelect');
        if (select) {
            select.value = agentName;
        }
        
        this.loadLLMVoiceEditor(agentName);
    }

    /**
     * Toggle LLM agent enabled/disabled state
     */
    toggleLLMAgent(agentName) {
        if (!agentName || !this.llmManager) return;
        
        this.debug.log('Toggling LLM agent:', agentName);
        
        try {
            const config = this.llmManager.getAgentConfiguration(agentName);
            if (config) {
                const newState = !config.enabled;
                this.llmManager.updateAgentConfiguration(agentName, { enabled: newState });
                this.refreshLLMData();
                this.showNotification(`${agentName} ${newState ? 'enabled' : 'disabled'}`, 'success');
            }
        } catch (error) {
            this.debug.error('Failed to toggle agent:', error);
            this.showNotification('Failed to toggle agent', 'error');
        }
    }

    /**
     * Load LLM guardrails editor for specific agent
     */
    loadLLMGuardrailsEditor(agentName) {
        if (!agentName) {
            document.getElementById('llmGuardrailsEditor').style.display = 'none';
            return;
        }
        
        const editor = document.getElementById('llmGuardrailsEditor');
        if (!editor) return;
        
        editor.style.display = 'block';
        editor.innerHTML = `
            <h5>Guardrails for ${agentName}</h5>
            <p style="color: #6c757d; margin-bottom: 15px;">
                Configure security boundaries and capability restrictions for this agent.
            </p>
            
            <div class="form-group">
                <label class="form-label">Max Transaction Amount (£)</label>
                <input type="number" class="llm-form-select" value="1000" min="0" step="0.01">
            </div>
            
            <div class="form-group">
                <label class="form-label">Allowed Operations</label>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 10px;">
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" checked> Account Balance
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" checked> Transaction History
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox"> Money Transfers
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox"> Card Management
                    </label>
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <button class="llm-btn llm-btn-primary" onclick="app.saveLLMGuardrails('${agentName}')">
                    Save Guardrails
                </button>
                <button class="llm-btn llm-btn-secondary" onclick="app.testLLMGuardrails('${agentName}')">
                    Test Guardrails
                </button>
            </div>
        `;
    }

    /**
     * Load LLM voice editor for specific agent
     */
    loadLLMVoiceEditor(agentName) {
        if (!agentName) {
            document.getElementById('llmVoiceEditor').style.display = 'none';
            return;
        }
        
        const editor = document.getElementById('llmVoiceEditor');
        if (!editor) return;
        
        editor.style.display = 'block';
        editor.innerHTML = `
            <h5>Voice Configuration for ${agentName}</h5>
            <p style="color: #6c757d; margin-bottom: 15px;">
                Configure TTS settings and voice personality for this agent.
            </p>
            
            <div class="form-group">
                <label class="form-label">Voice Model</label>
                <select class="llm-form-select">
                    <option value="nova">Nova (Female, Recommended)</option>
                    <option value="alloy">Alloy (Neutral)</option>
                    <option value="echo">Echo (Male)</option>
                    <option value="fable">Fable (British Male)</option>
                    <option value="onyx">Onyx (Deep Male)</option>
                    <option value="shimmer">Shimmer (Female, Warm)</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Speech Speed</label>
                <input type="range" class="llm-form-select" min="0.25" max="4.0" step="0.25" value="1.0">
                <span>1.0x</span>
            </div>
            
            <div class="form-group">
                <label class="form-label">Voice Personality</label>
                <select class="llm-form-select">
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="empathetic">Empathetic</option>
                    <option value="authoritative">Authoritative</option>
                </select>
            </div>
            
            <div style="margin-top: 20px;">
                <button class="llm-btn llm-btn-primary" onclick="app.saveLLMVoiceConfig('${agentName}')">
                    Save Voice Config
                </button>
                <button class="llm-btn llm-btn-secondary" onclick="app.testLLMVoice('${agentName}')">
                    Test Voice
                </button>
            </div>
        `;
    }

    /**
     * Save LLM guardrails
     */
    saveLLMGuardrails(agentName) {
        this.debug.log('Saving LLM guardrails for:', agentName);
        this.showNotification(`Guardrails saved for ${agentName}`, 'success');
    }

    /**
     * Test LLM guardrails
     */
    testLLMGuardrails(agentName) {
        this.debug.log('Testing LLM guardrails for:', agentName);
        this.showNotification(`Guardrails test completed for ${agentName}`, 'info');
    }

    /**
     * Save LLM voice configuration
     */
    saveLLMVoiceConfig(agentName) {
        this.debug.log('Saving LLM voice config for:', agentName);
        this.showNotification(`Voice configuration saved for ${agentName}`, 'success');
    }

    /**
     * Test LLM voice
     */
    testLLMVoice(agentName) {
        this.debug.log('Testing LLM voice for:', agentName);
        this.showNotification(`Voice test completed for ${agentName}`, 'info');
    }

    /**
     * Open the AI agent routing test page in a new tab
     */
    openAgentRoutingTest() {
        this.debug.log('Opening AI agent routing test page...');
        
        // Open the AI routing test page in a new tab
        const testUrl = 'test-ai-agent-routing.html';
        const testWindow = window.open(testUrl, '_blank');
        
        if (testWindow) {
            this.debug.log('AI agent routing test page opened successfully');
            this.updateStatus('AI agent routing test page opened in new tab');
            
            setTimeout(() => {
                this.updateStatus('Ready to listen');
            }, 2000);
        } else {
            this.debug.error('Failed to open AI agent routing test page - popup blocked?');
            this.updateStatus('Failed to open test page - check popup blocker');
        }
    }

    /**
     * Open the basic agent routing test page in a new tab
     */
    openBasicRoutingTest() {
        this.debug.log('Opening basic agent routing test page...');
        
        // Open the basic routing test page in a new tab
        const testUrl = 'test-agent-routing.html';
        const testWindow = window.open(testUrl, '_blank');
        
        if (testWindow) {
            this.debug.log('Basic agent routing test page opened successfully');
            this.updateStatus('Basic agent routing test page opened in new tab');
            
            setTimeout(() => {
                this.updateStatus('Ready to listen');
            }, 2000);
        } else {
            this.debug.error('Failed to open basic agent routing test page - popup blocked?');
            this.updateStatus('Failed to open test page - check popup blocker');
        }
    }
}

// Global function for quick agent toggle (called from HTML buttons)
function toggleAgent(agentName) {
    if (window.app && window.app.agentRouter) {
        const configManager = window.app.agentRouter.getConfigManager();
        const currentConfig = configManager.getAgentConfig(agentName);
        
        if (currentConfig) {
            const newStatus = !currentConfig.enabled;
            
            if (newStatus) {
                configManager.enableAgent(agentName);
                console.log(`${agentName} enabled`);
                window.app.updateStatus(`${agentName} enabled`);
            } else {
                configManager.disableAgent(agentName);
                console.log(`${agentName} disabled`);
                window.app.updateStatus(`${agentName} disabled`);
            }
            
            // Refresh the status display
            setTimeout(() => {
                window.app.refreshAgentStatus();
            }, 500);
            
        } else {
            console.error(`Agent ${agentName} not found`);
            window.app.updateStatus(`Agent ${agentName} not found`);
        }
    } else {
        console.error('Agent system not available');
        if (window.app) {
            window.app.updateStatus('Agent system not available');
        }
    }
}

// Initialize the app
console.log('Initializing Speech-to-Speech (STS) App...');
const app = new SpeechToSpeechApp();
window.app = app; // Make app globally accessible for streaming manager

console.log('Speech-to-Speech (STS) App initialized successfully!');

// Global LLM Manager functions for HTML onclick handlers
function refreshLLMData() {
    if (window.app) {
        window.app.refreshLLMData();
    }
}

function exportLLMConfiguration() {
    if (window.app) {
        window.app.exportLLMConfiguration();
    }
}

function importLLMConfiguration() {
    if (window.app) {
        window.app.importLLMConfiguration();
    }
}

function openFullLLMManager() {
    if (window.app) {
        window.app.openFullLLMManager();
    }
}

async function enableAllAgents() {
    if (window.app) {
        await window.app.enableAllAgents();
    }
}

async function disableAllAgents() {
    if (window.app) {
        await window.app.disableAllAgents();
    }
}

function resetAllToDefaults() {
    if (window.app) {
        window.app.resetAllToDefaults();
    }
}

function validateAllConfigurations() {
    if (window.app) {
        window.app.validateAllConfigurations();
    }
}

function clearLLMAuditLog() {
    if (window.app) {
        window.app.clearLLMAuditLog();
    }
}

function loadGuardrailsEditor(agentName) {
    if (window.app) {
        window.app.loadLLMGuardrailsEditor(agentName);
    }
}
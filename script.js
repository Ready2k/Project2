class SpeechToSpeechApp {
    constructor() {
        this.openaiApiKey = localStorage.getItem('openai_api_key') || '';
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        // Initialize persona manager
        this.personaManager = new PersonaManager();
        
        // Initialize system prompts manager
        this.systemPromptsManager = new SystemPromptsManager();

        // Initialize API client and token tracker
        this.tokenTracker = new TokenTracker();
        this.apiClient = new OpenAIClient(this.openaiApiKey, this.tokenTracker);

        // Initialize streaming manager
        this.streamingManager = new StreamingManager(this.openaiApiKey, this.debugStreamingMessage.bind(this));

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
            recognitionMode: localStorage.getItem('recognition_mode') || 'financial'
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
        this.initializeTtsSettings();
        this.initializeBrowserTts();
        this.initializeSpeechSettings();
        this.initializeStreamingSettings();
        this.initializeSystemPrompts();
        this.tokenTracker.updateDisplay();
        this.initializeStreamingMode();
        this.initializeMuteButtons();
        this.updateKeyStatus();

        // Switch to Settings tab on startup for configuration
        this.switchTab('settings');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Tab clicked:', e.target.dataset.tab);
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Voice controls
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        if (startBtn) startBtn.addEventListener('click', () => this.startRecording());
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopRecording());

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
        if (saveKey) saveKey.addEventListener('click', () => this.saveApiKey());
        if (clearKey) clearKey.addEventListener('click', () => this.clearApiKey());

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
                console.log('Streaming mode toggled:', e.target.checked);
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

        console.log('Event listeners setup complete');
    }

    switchTab(tabName) {
        console.log('Switching to tab:', tabName);

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
        }
    }

    async startRecording() {
        console.log('Start recording clicked');
        if (!this.openaiApiKey) {
            this.updateStatus('Please set your OpenAI API key in Settings first!');
            this.switchTab('settings');
            return;
        }

        if (this.currentState !== 'ready') {
            console.log('Cannot start recording, current state:', this.currentState);
            return;
        }

        try {
            this.currentState = 'recording';
            let stream;

            // Check if we have a cached microphone stream
            if (this.cachedMicStream && this.micPermissionGranted) {
                console.log('Using cached microphone stream');
                stream = this.cachedMicStream;

                // Verify all tracks are still active
                const tracks = stream.getAudioTracks();
                const activeTrack = tracks.find(track => track.readyState === 'live');
                if (!activeTrack) {
                    console.log('Cached stream is inactive, requesting new access...');
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

    stopRecording() {
        console.log('Stop recording clicked');
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
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

                // Generate AI response
                const response = await this.generateResponse(transcript);
                this.addMessage(response, 'bot');

                // Convert response to speech using selected TTS mode
                this.currentState = 'speaking';
                await this.textToSpeech(response);

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
                maxTokens: 200,
                temperature: 0.8
            });

            if (result.success) {
                console.log('AI response received:', result.content);
                this.updateDebugOutput('gptResponse', result.content);
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

    async textToSpeech(text) {
        if (this.ttsMode === 'browser') {
            return this.textToSpeechBrowser(text);
        } else {
            return this.textToSpeechOpenAI(text);
        }
    }

    async textToSpeechOpenAI(text) {
        try {
            console.log('Converting text to speech with OpenAI:', text);
            this.updateStatus('🔊 Generating voice...');
            this.updateDebugOutput('ttsOutput', `Generating speech with ${this.ttsSettings.model} (${this.ttsSettings.voice})`);

            const result = await this.apiClient.textToSpeech(text, {
                model: this.ttsSettings.model,
                voice: this.ttsSettings.voice,
                speed: this.ttsSettings.speed
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

    async textToSpeechBrowser(text) {
        return new Promise((resolve, reject) => {
            try {
                console.log('Converting text to speech with Browser TTS:', text);
                this.updateStatus('🔊 Generating voice with browser...');
                this.updateDebugOutput('ttsOutput', `Generating speech with Browser TTS`);

                if (!('speechSynthesis' in window)) {
                    throw new Error('Browser TTS not supported');
                }

                // Stop any ongoing speech
                speechSynthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(text);

                // Apply settings
                if (this.browserTtsSettings.voice && this.availableVoices.length > 0) {
                    const voiceIndex = parseInt(this.browserTtsSettings.voice);
                    if (voiceIndex >= 0 && voiceIndex < this.availableVoices.length) {
                        utterance.voice = this.availableVoices[voiceIndex];
                    }
                }

                utterance.rate = this.browserTtsSettings.rate;
                utterance.pitch = this.browserTtsSettings.pitch;
                utterance.volume = this.browserTtsSettings.volume;

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

    // Token tracking methods (now handled by TokenTracker class)





    // Token display is now handled by TokenTracker.updateDisplay()

    // Admin Panel - Personas Management
    loadPersonas() {
        console.log('Loading personas...');
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
        console.log('Add persona form submitted');

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
    addMessage(content, type) {
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
        console.log('Message added:', type, content);
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
                this.streamingManager.setApiKey(apiKey);
                localStorage.setItem('openai_api_key', apiKey);
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

        const confirmed = confirm('Are you sure you want to clear your OpenAI API key?\n\nThis will:\n• Remove the key from local storage\n• Disable all OpenAI features\n• Require re-entering the key to use the app');

        if (confirmed) {
            // Clear from memory
            this.openaiApiKey = '';

            // Clear from API clients
            this.apiClient.setApiKey('');
            this.streamingManager.setApiKey('');

            // Clear from localStorage
            localStorage.removeItem('openai_api_key');

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
            this.updateStatus('Please set your OpenAI API key in Settings first!');
            this.switchTab('settings');
            return;
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
            alert('Please set your OpenAI API key first!');
            return;
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

        window.addEventListener('beforeunload', () => {
            this.cleanupAllResources();
        });

        window.addEventListener('pagehide', () => {
            this.cleanupAllResources();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.currentState === 'recording') {
                console.log('Tab hidden while recording, stopping recording...');
                this.stopRecording();
            }
        });
    }
}

// Initialize the app
console.log('Initializing Speech-to-Speech (STS) App...');
const app = new SpeechToSpeechApp();
window.app = app; // Make app globally accessible for streaming manager

console.log('Speech-to-Speech (STS) App initialized successfully!');
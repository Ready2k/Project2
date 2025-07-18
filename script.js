class FinanceBotApp {
    constructor() {
        this.openaiApiKey = localStorage.getItem('openai_api_key') || '';
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentPersona = 'john_doe';

        // Streaming mode properties
        this.isStreamingMode = localStorage.getItem('streaming_mode') === 'true' || false;
        this.isConnected = false;
        this.websocket = null;
        this.audioContext = null;
        this.processor = null;
        this.silenceTimer = null;
        this.isSpeaking = false;

        // Microphone stream caching
        this.cachedMicStream = null;
        this.micPermissionGranted = false;

        // OpenAI TTS settings
        this.ttsSettings = {
            model: localStorage.getItem('tts_model') || 'tts-1',
            voice: localStorage.getItem('tts_voice') || 'nova',
            speed: parseFloat(localStorage.getItem('tts_speed')) || 1.0
        };

        // Speech recognition settings
        this.speechSettings = {
            audioQuality: localStorage.getItem('audio_quality') || 'high',
            noiseReduction: localStorage.getItem('noise_reduction') || 'medium',
            whisperLanguage: localStorage.getItem('whisper_language') || 'en-US',
            recognitionMode: localStorage.getItem('recognition_mode') || 'financial'
        };

        // Streaming settings
        this.streamingSettings = {
            responseDelay: parseFloat(localStorage.getItem('response_delay')) || 1.0,
            vadSensitivity: localStorage.getItem('vad_sensitivity') || 'medium',
            audioBufferSize: localStorage.getItem('audio_buffer_size') || 'medium',
            connectionQuality: localStorage.getItem('connection_quality') || 'auto'
        };

        // System prompts configuration
        this.systemPrompts = JSON.parse(localStorage.getItem('system_prompts')) || {
            basePersonality: "You are a helpful, professional, and friendly financial services AI assistant.",
            financialContext: "Handle financial requests professionally and securely.",
            responseInstructions: "Keep responses conversational and concise.",
            customPrompts: []
        };

        // Token usage tracking
        this.tokenUsage = JSON.parse(localStorage.getItem('token_usage')) || {
            whisper: { requests: 0, cost: 0 },
            gpt: { tokens: 0, cost: 0 },
            tts: { characters: 0, cost: 0 },
            total: 0
        };

        // Pricing
        this.pricing = {
            whisper: 0.006,
            gpt35turbo: { input: 0.0005, output: 0.0015 },
            tts1: 0.015,
            tts1hd: 0.030
        };

        // Default personas
        this.personas = JSON.parse(localStorage.getItem('personas')) || {
            john_doe: {
                name: 'John Doe',
                balance: 2450.75,
                cardLast4: '1234',
                accountType: 'checking',
                recentTransactions: []
            }
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadPersonas();
        this.updatePersonaSelector();
        this.initializeTtsSettings();
        this.initializeSpeechSettings();
        this.initializeStreamingSettings();
        this.initializeSystemPrompts();
        this.updateTokenDisplay();
        this.initializeStreamingMode();

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
                this.currentPersona = e.target.value;
            });
        }

        // Admin form
        const personaForm = document.getElementById('personaForm');
        if (personaForm) personaForm.addEventListener('submit', (e) => this.addPersona(e));

        // Settings
        const saveKey = document.getElementById('saveKey');
        if (saveKey) saveKey.addEventListener('click', () => this.saveApiKey());

        // TTS Settings
        const ttsModel = document.getElementById('ttsModel');
        const ttsVoice = document.getElementById('ttsVoice');
        const ttsSpeed = document.getElementById('ttsSpeed');
        const testTtsVoice = document.getElementById('testTtsVoice');

        if (ttsModel) ttsModel.addEventListener('change', (e) => this.updateTtsModel(e));
        if (ttsVoice) ttsVoice.addEventListener('change', (e) => this.updateTtsVoice(e));
        if (ttsSpeed) ttsSpeed.addEventListener('input', (e) => this.updateTtsSpeed(e));
        if (testTtsVoice) testTtsVoice.addEventListener('click', () => this.testTtsVoice());

        // Streaming mode controls
        const streamingMode = document.getElementById('streamingMode');
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');

        if (streamingMode) {
            streamingMode.addEventListener('change', (e) => {
                console.log('Streaming mode toggled:', e.target.checked);
                this.toggleStreamingMode(e.target.checked);
            });
        }
        if (connectBtn) connectBtn.addEventListener('click', () => this.connectStreaming());
        if (disconnectBtn) disconnectBtn.addEventListener('click', () => this.disconnectStreaming());

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

        try {
            let stream;

            // Check if we have a cached microphone stream
            if (this.cachedMicStream && this.micPermissionGranted) {
                console.log('Using cached microphone stream');
                stream = this.cachedMicStream;

                // Verify the stream is still active
                const tracks = stream.getAudioTracks();
                if (tracks.length === 0 || tracks[0].readyState === 'ended') {
                    console.log('Cached stream is inactive, requesting new access...');
                    this.cachedMicStream = null;
                    this.micPermissionGranted = false;
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

            const startBtn = document.getElementById('startBtn');
            const stopBtn = document.getElementById('stopBtn');
            if (startBtn) startBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = false;

            this.updateStatus('🎤 Listening... Click Stop when done speaking');
            console.log('Recording started successfully');

        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.updateStatus('❌ Microphone access denied. Please allow microphone permissions.');
            this.micPermissionGranted = false;
            this.cachedMicStream = null;

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

            const startBtn = document.getElementById('startBtn');
            const stopBtn = document.getElementById('stopBtn');
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;

            this.updateStatus('Processing your speech...');
        }
    }

    addPersona(e) {
        e.preventDefault();
        console.log('Add persona form submitted');
        alert('Persona functionality ready');
    }

    saveApiKey() {
        console.log('Save API key clicked');
        const apiKeyInput = document.getElementById('openaiKey');
        if (apiKeyInput) {
            const apiKey = apiKeyInput.value.trim();
            if (apiKey) {
                this.openaiApiKey = apiKey;
                localStorage.setItem('openai_api_key', apiKey);
                alert('API key saved successfully!');
            } else {
                alert('Please enter a valid API key.');
            }
        }
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

        this.updateConnectionStatus('connecting');
        this.updateStatus('🔄 Connecting to streaming service...');

        // Simulate connection for now
        setTimeout(() => {
            this.updateConnectionStatus('connected');
            this.updateStatus('📞 Connected - Streaming mode ready!');

            const connectBtn = document.getElementById('connectBtn');
            const disconnectBtn = document.getElementById('disconnectBtn');
            if (connectBtn) connectBtn.disabled = true;
            if (disconnectBtn) disconnectBtn.disabled = false;
        }, 2000);
    }

    async disconnectStreaming() {
        console.log('Disconnect streaming clicked');
        this.updateConnectionStatus('disconnected');
        this.updateStatus('📞 Disconnected');

        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        if (connectBtn) connectBtn.disabled = false;
        if (disconnectBtn) disconnectBtn.disabled = true;
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

    loadPersonas() {
        console.log('Loading personas...');
        const personaList = document.getElementById('personaList');
        if (personaList) {
            personaList.innerHTML = '<p>Persona management ready</p>';
        }
    }

    updatePersonaSelector() {
        const selector = document.getElementById('personaSelect');
        if (selector) {
            selector.innerHTML = '';
            Object.keys(this.personas).forEach(personaId => {
                const option = document.createElement('option');
                option.value = personaId;
                option.textContent = this.personas[personaId].name;
                selector.appendChild(option);
            });
        }
    }

    initializeTtsSettings() {
        console.log('Initializing TTS settings...');
        const ttsModel = document.getElementById('ttsModel');
        const ttsVoice = document.getElementById('ttsVoice');
        const ttsSpeed = document.getElementById('ttsSpeed');
        const ttsSpeedValue = document.getElementById('ttsSpeedValue');

        if (ttsModel) ttsModel.value = this.ttsSettings.model;
        if (ttsVoice) ttsVoice.value = this.ttsSettings.voice;
        if (ttsSpeed) ttsSpeed.value = this.ttsSettings.speed;
        if (ttsSpeedValue) ttsSpeedValue.textContent = this.ttsSettings.speed + 'x';
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

    async testTtsVoice() {
        console.log('Test TTS voice clicked');
        if (!this.openaiApiKey) {
            alert('Please set your OpenAI API key first!');
            return;
        }

        const testText = `Hello! I'm your financial assistant using the ${this.ttsSettings.voice} voice. This is how I sound with your current settings.`;

        try {
            await this.textToSpeechOpenAI(testText);
        } catch (error) {
            console.error('TTS test error:', error);
            // Fallback to browser TTS for testing
            this.speakWithBrowserTTS(testText);
        }
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

    initializeSystemPrompts() {
        console.log('Initializing system prompts...');
    }

    updateTokenDisplay() {
        console.log('Updating token display...');
    }

    initializeStreamingMode() {
        console.log('Initializing streaming mode...');
        const streamingModeCheckbox = document.getElementById('streamingMode');
        if (streamingModeCheckbox) {
            streamingModeCheckbox.checked = this.isStreamingMode;
            this.toggleStreamingMode(this.isStreamingMode);
        }
    }

    // Audio processing methods
    async processAudio() {
        try {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            console.log('Processing audio blob:', audioBlob.size, 'bytes');

            // Convert speech to text using OpenAI Whisper
            const transcript = await this.speechToText(audioBlob);

            if (transcript) {
                this.addMessage(transcript, 'user');
                this.updateStatus('Generating response...');

                // Generate AI response
                const response = await this.generateResponse(transcript);
                this.addMessage(response, 'bot');

                // Convert response to speech using OpenAI TTS
                await this.textToSpeechOpenAI(response);

                this.updateStatus('Ready to listen');
            }

        } catch (error) {
            console.error('Error processing audio:', error);
            this.updateStatus('Error processing audio. Please try again.');
        }
    }

    async speechToText(audioBlob) {
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.wav');
        formData.append('model', 'whisper-1');

        try {
            console.log('Sending audio to Whisper API...');
            this.updateStatus('🔄 Converting speech to text...');

            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Transcription received:', data.text);
            return data.text;

        } catch (error) {
            console.error('Speech-to-text error:', error);
            throw error;
        }
    }

    async generateResponse(userMessage) {
        try {
            console.log('Generating AI response for:', userMessage);
            this.updateStatus('🤖 Generating AI response...');

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a helpful, professional, and friendly financial services AI assistant. Keep responses conversational and concise (suitable for voice). Customer: ${this.personas[this.currentPersona].name}, Balance: $${this.personas[this.currentPersona].balance.toFixed(2)}`
                        },
                        { role: 'user', content: userMessage }
                    ],
                    max_tokens: 200,
                    temperature: 0.8
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const aiResponse = data.choices[0].message.content;
            console.log('AI response received:', aiResponse);
            return aiResponse;

        } catch (error) {
            console.error('AI response error:', error);
            return "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
        }
    }

    async textToSpeechOpenAI(text) {
        try {
            console.log('Converting text to speech:', text);
            console.log('Using TTS settings:', this.ttsSettings);
            this.updateStatus('🔊 Generating voice...');

            const requestBody = {
                model: this.ttsSettings.model,
                input: text,
                voice: this.ttsSettings.voice,
                speed: this.ttsSettings.speed
            };
            console.log('TTS request body:', requestBody);

            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            console.log('TTS response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('TTS API error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            // Get audio blob and play it
            console.log('Getting audio blob...');
            const audioBlob = await response.blob();
            console.log('Audio blob size:', audioBlob.size, 'bytes');

            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            this.updateStatus('🔊 Speaking...');

            audio.onended = () => {
                console.log('Audio playback ended');
                this.updateStatus('Ready to listen');
                URL.revokeObjectURL(audioUrl);
            };

            audio.onerror = (error) => {
                console.error('Audio playback error:', error);
                this.updateStatus('Audio playback error - Ready to listen');
                URL.revokeObjectURL(audioUrl);
            };

            // Try to play audio, handle autoplay restrictions
            try {
                await audio.play();
                console.log('Audio playback started');
            } catch (playError) {
                console.warn('Audio autoplay blocked, trying user interaction workaround:', playError);

                // Show a user-friendly message and provide a manual play option
                const playButton = document.createElement('button');
                playButton.textContent = '🔊 Click to Play Audio Response';
                playButton.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; padding: 10px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;';

                playButton.onclick = () => {
                    audio.play().then(() => {
                        playButton.remove();
                        console.log('Manual audio playback started');
                    }).catch(err => {
                        console.error('Manual audio play failed:', err);
                        playButton.textContent = '❌ Audio play failed';
                        setTimeout(() => playButton.remove(), 3000);
                    });
                };

                document.body.appendChild(playButton);

                // Auto-remove button after 10 seconds
                setTimeout(() => {
                    if (playButton.parentNode) {
                        playButton.remove();
                    }
                }, 10000);

                this.updateStatus('🔊 Audio ready - Click the blue button to play');
            }

        } catch (error) {
            console.error('TTS error:', error);
            console.error('Error details:', error.message, error.stack);
            this.updateStatus('TTS error - Ready to listen');

            // Try fallback to browser TTS
            console.log('Attempting browser TTS fallback...');
            this.speakWithBrowserTTS(text);
        }
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

    // Welcome message functionality
    async playWelcomeMessage() {
        const welcomeText = "Hello! I'm your financial assistant. How can I help you today?";
        console.log('Playing welcome message...');

        if (this.openaiApiKey) {
            try {
                await this.textToSpeechOpenAI(welcomeText);
            } catch (error) {
                console.error('Error playing welcome message:', error);
                // Fallback to browser speech synthesis
                this.speakWithBrowserTTS(welcomeText);
            }
        } else {
            // Use browser TTS if no API key
            this.speakWithBrowserTTS(welcomeText);
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
                console.log('Available voices:', voices.length);

                const femaleVoice = voices.find(voice =>
                    voice.name.toLowerCase().includes('female') ||
                    voice.name.toLowerCase().includes('zira') ||
                    voice.name.toLowerCase().includes('susan') ||
                    voice.name.toLowerCase().includes('samantha') ||
                    voice.name.toLowerCase().includes('karen')
                );

                if (femaleVoice) {
                    utterance.voice = femaleVoice;
                    console.log('Using voice:', femaleVoice.name);
                } else {
                    console.log('Using default voice');
                }

                utterance.onstart = () => {
                    console.log('Browser TTS started');
                    this.updateStatus('🔊 Speaking (Browser TTS)...');
                };

                utterance.onend = () => {
                    console.log('Browser TTS ended');
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

    // Cleanup method for microphone stream
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

    // Call cleanup when page unloads
    setupCleanupListeners() {
        window.addEventListener('beforeunload', () => {
            this.cleanupMicrophoneStream();
        });

        window.addEventListener('pagehide', () => {
            this.cleanupMicrophoneStream();
        });
    }
}

// Initialize the app
console.log('Initializing FinanceBot App...');
const app = new FinanceBotApp();

// Set up cleanup listeners
app.setupCleanupListeners();

// Note: Welcome message will play after first user interaction to comply with browser autoplay policies
console.log('FinanceBot App initialized successfully!');
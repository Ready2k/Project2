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
            console.log('Requesting microphone access...');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.speechSettings.audioQuality === 'high' ? 48000 : 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: this.speechSettings.noiseReduction !== 'off',
                    autoGainControl: true
                }
            });

            console.log('Microphone access granted');
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
            this.updateStatus('🔊 Generating voice...');

            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: this.ttsSettings.model,
                    input: text,
                    voice: this.ttsSettings.voice,
                    speed: this.ttsSettings.speed
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get audio blob and play it
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            this.updateStatus('🔊 Speaking...');

            audio.onended = () => {
                this.updateStatus('Ready to listen');
                URL.revokeObjectURL(audioUrl);
            };

            audio.onerror = (error) => {
                console.error('Audio playback error:', error);
                this.updateStatus('Audio playback error - Ready to listen');
                URL.revokeObjectURL(audioUrl);
            };

            await audio.play();
            console.log('Audio playback started');

        } catch (error) {
            console.error('TTS error:', error);
            this.updateStatus('TTS error - Ready to listen');
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
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 0.8;

            // Try to use a female voice
            const voices = speechSynthesis.getVoices();
            const femaleVoice = voices.find(voice =>
                voice.name.toLowerCase().includes('female') ||
                voice.name.toLowerCase().includes('zira') ||
                voice.name.toLowerCase().includes('susan')
            );
            if (femaleVoice) utterance.voice = femaleVoice;

            speechSynthesis.speak(utterance);
            console.log('Browser TTS welcome message played');
        }
    }
}

// Initialize the app and play welcome message
console.log('Initializing FinanceBot App...');
const app = new FinanceBotApp();

// Play welcome message after a short delay to ensure everything is loaded
setTimeout(() => {
    app.playWelcomeMessage();
}, 1000);

console.log('FinanceBot App initialized successfully!');
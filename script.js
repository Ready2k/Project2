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

        // State management
        this.currentState = 'ready'; // ready, recording, processing, speaking
        this.currentAudio = null; // Track current audio element for cleanup

        // Audio monitoring
        this.audioAnalyser = null;
        this.audioLevelInterval = null;

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
        this.setupCleanupListeners();
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
            if (startBtn) startBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = false;

            this.updateStatus('🎤 Listening... Click Stop when done speaking');
            console.log('Recording started successfully');

        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.currentState = 'ready'; // Reset state on error
            this.updateStatus('❌ Microphone access denied. Please allow microphone permissions.');
            this.micPermissionGranted = false;
            this.cachedMicStream = null;

            // Reset button states
            const startBtn = document.getElementById('startBtn');
            const stopBtn = document.getElementById('stopBtn');
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;

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
            if (startBtn) startBtn.disabled = false;
            if (stopBtn) stopBtn.disabled = true;

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

                // Convert response to speech using OpenAI TTS
                this.currentState = 'speaking';
                await this.textToSpeechOpenAI(response);

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
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.wav');
        formData.append('model', 'whisper-1');

        try {
            console.log('Sending audio to Whisper API...');
            this.updateStatus('🔄 Converting speech to text...');
            this.updateDebugOutput('sttOutput', 'Processing audio with Whisper...');

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

            // Track Whisper usage
            this.trackWhisperUsage();

            // Update debug output
            this.updateDebugOutput('sttOutput', data.text, 'Transcribed Text:');

            return data.text;

        } catch (error) {
            console.error('Speech-to-text error:', error);
            this.updateDebugOutput('sttOutput', `Error: ${error.message}`);
            throw error;
        }
    }

    async generateResponse(userMessage) {
        const systemPrompt = `You are a helpful, professional, and friendly financial services AI assistant. Keep responses conversational and concise (suitable for voice). Customer: ${this.personas[this.currentPersona].name}, Balance: $${this.personas[this.currentPersona].balance.toFixed(2)}`;

        try {
            console.log('Generating AI response for:', userMessage);
            this.updateStatus('🤖 Generating AI response...');

            // Update debug panel with system prompt
            this.updateDebugOutput('systemPrompt', systemPrompt);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
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

            // Track GPT usage
            if (data.usage) {
                this.trackGptUsage(data.usage.prompt_tokens, data.usage.completion_tokens);
            }

            // Update debug panel with GPT response
            this.updateDebugOutput('gptResponse', aiResponse);

            return aiResponse;

        } catch (error) {
            console.error('AI response error:', error);
            this.updateDebugOutput('gptResponse', `Error: ${error.message}`);
            return "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
        }
    }

    async textToSpeechOpenAI(text) {
        try {
            console.log('Converting text to speech:', text);
            this.updateStatus('🔊 Generating voice...');
            this.updateDebugOutput('ttsOutput', `Generating speech with ${this.ttsSettings.model} (${this.ttsSettings.voice})`);

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

            // Validate audio blob
            if (audioBlob.size === 0) {
                throw new Error('Empty audio response from TTS API');
            }

            // Clean up previous audio if exists
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio.src = '';
                this.currentAudio = null;
            }

            const audioUrl = URL.createObjectURL(audioBlob);
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

            // Track TTS usage
            this.trackTtsUsage(text.length);
            this.updateDebugOutput('ttsOutput', `Speech generated successfully\nCharacters: ${text.length}\nModel: ${this.ttsSettings.model}\nVoice: ${this.ttsSettings.voice}`);

        } catch (error) {
            console.error('TTS error:', error);
            this.updateStatus('TTS error - Ready to listen');
            this.updateDebugOutput('ttsOutput', `Error: ${error.message}`);

            // Try fallback to browser TTS
            this.speakWithBrowserTTS(text);
        }
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
            audioLevelFill.style.width = level + '%';
        }

        if (audioLevelText) {
            audioLevelText.textContent = Math.round(level) + '%';
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

    // Token tracking methods
    trackWhisperUsage(minutes = 0.17) {
        this.tokenUsage.whisper.requests += 1;
        const cost = minutes * this.pricing.whisper;
        this.tokenUsage.whisper.cost += cost;
        this.tokenUsage.total += cost;
        this.saveTokenUsage();
        this.updateTokenDisplay();
    }

    trackGptUsage(inputTokens, outputTokens) {
        this.tokenUsage.gpt.tokens += (inputTokens + outputTokens);
        const inputCost = (inputTokens / 1000) * this.pricing.gpt35turbo.input;
        const outputCost = (outputTokens / 1000) * this.pricing.gpt35turbo.output;
        const totalCost = inputCost + outputCost;
        this.tokenUsage.gpt.cost += totalCost;
        this.tokenUsage.total += totalCost;
        this.saveTokenUsage();
        this.updateTokenDisplay();
    }

    trackTtsUsage(characters) {
        this.tokenUsage.tts.characters += characters;
        const pricePerChar = this.ttsSettings.model === 'tts-1-hd' ?
            this.pricing.tts1hd / 1000 : this.pricing.tts1 / 1000;
        const cost = characters * pricePerChar;
        this.tokenUsage.tts.cost += cost;
        this.tokenUsage.total += cost;
        this.saveTokenUsage();
        this.updateTokenDisplay();
    }

    saveTokenUsage() {
        localStorage.setItem('token_usage', JSON.stringify(this.tokenUsage));
    }

    updateTokenDisplay() {
        const whisperTokens = document.getElementById('whisperTokens');
        const whisperCost = document.getElementById('whisperCost');
        const gptTokens = document.getElementById('gptTokens');
        const gptCost = document.getElementById('gptCost');
        const ttsTokens = document.getElementById('ttsTokens');
        const ttsCost = document.getElementById('ttsCost');
        const totalCost = document.getElementById('totalCost');

        if (whisperTokens) whisperTokens.textContent = `${this.tokenUsage.whisper.requests} requests`;
        if (whisperCost) whisperCost.textContent = `$${this.tokenUsage.whisper.cost.toFixed(4)}`;
        if (gptTokens) gptTokens.textContent = `${this.tokenUsage.gpt.tokens} tokens`;
        if (gptCost) gptCost.textContent = `$${this.tokenUsage.gpt.cost.toFixed(4)}`;
        if (ttsTokens) ttsTokens.textContent = `${this.tokenUsage.tts.characters} chars`;
        if (ttsCost) ttsCost.textContent = `$${this.tokenUsage.tts.cost.toFixed(4)}`;
        if (totalCost) totalCost.textContent = `$${this.tokenUsage.total.toFixed(4)}`;
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

    // Settings and UI methods
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

        if (this.isConnected) {
            console.log('Already connected to streaming');
            return;
        }

        try {
            this.updateConnectionStatus('connecting');
            this.updateStatus('🔄 Connecting to streaming service...');

            // Simulate connection
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (Math.random() > 0.9) {
                        reject(new Error('Connection timeout'));
                    } else {
                        resolve();
                    }
                }, 2000);
            });

            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.updateStatus('📞 Connected - Streaming mode ready!');

            const connectBtn = document.getElementById('connectBtn');
            const disconnectBtn = document.getElementById('disconnectBtn');
            if (connectBtn) connectBtn.disabled = true;
            if (disconnectBtn) disconnectBtn.disabled = false;

        } catch (error) {
            console.error('Streaming connection error:', error);
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            this.updateStatus('❌ Connection failed. Please try again.');

            const connectBtn = document.getElementById('connectBtn');
            const disconnectBtn = document.getElementById('disconnectBtn');
            if (connectBtn) connectBtn.disabled = false;
            if (disconnectBtn) disconnectBtn.disabled = true;
        }
    }

    async disconnectStreaming() {
        console.log('Disconnect streaming clicked');

        if (!this.isConnected) {
            console.log('Already disconnected from streaming');
            return;
        }

        try {
            // Clean up streaming resources
            if (this.websocket) {
                this.websocket.close();
                this.websocket = null;
            }

            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }

            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            this.updateStatus('📞 Disconnected');

            const connectBtn = document.getElementById('connectBtn');
            const disconnectBtn = document.getElementById('disconnectBtn');
            if (connectBtn) connectBtn.disabled = false;
            if (disconnectBtn) disconnectBtn.disabled = true;

        } catch (error) {
            console.error('Error during disconnect:', error);
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            this.updateStatus('📞 Disconnected (with errors)');
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
console.log('Initializing FinanceBot App...');
const app = new FinanceBotApp();

console.log('FinanceBot App initialized successfully!');
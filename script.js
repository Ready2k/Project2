class FinanceBotApp {
    constructor() {
        this.openaiApiKey = localStorage.getItem('openai_api_key') || '';
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentPersona = 'john_doe';

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

        // Audio monitoring
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.audioLevelInterval = null;

        // Token usage tracking
        this.tokenUsage = JSON.parse(localStorage.getItem('token_usage')) || {
            whisper: { requests: 0, cost: 0 },
            gpt: { tokens: 0, cost: 0 },
            tts: { characters: 0, cost: 0 },
            total: 0
        };

        // Pricing (as of 2025 - update these if needed)
        this.pricing = {
            whisper: 0.006, // per minute
            gpt35turbo: { input: 0.0005, output: 0.0015 }, // per 1K tokens
            tts1: 0.015, // per 1K characters
            tts1hd: 0.030 // per 1K characters
        };

        // Default personas
        this.personas = JSON.parse(localStorage.getItem('personas')) || {
            john_doe: {
                name: 'John Doe',
                balance: 2450.75,
                cardLast4: '1234',
                accountType: 'checking',
                recentTransactions: [
                    { date: '2025-01-15', amount: -45.67, description: 'Coffee Shop' },
                    { date: '2025-01-14', amount: -120.00, description: 'Grocery Store' },
                    { date: '2025-01-13', amount: 1500.00, description: 'Salary Deposit' }
                ]
            },
            sarah_smith: {
                name: 'Sarah Smith',
                balance: 8750.25,
                cardLast4: '5678',
                accountType: 'premium',
                recentTransactions: [
                    { date: '2025-01-16', amount: -89.99, description: 'Online Shopping' },
                    { date: '2025-01-15', amount: -25.00, description: 'Gas Station' },
                    { date: '2025-01-14', amount: 2000.00, description: 'Investment Return' }
                ]
            },
            mike_johnson: {
                name: 'Mike Johnson',
                balance: 156.80,
                cardLast4: '9012',
                accountType: 'savings',
                recentTransactions: [
                    { date: '2025-01-16', amount: -12.50, description: 'Fast Food' },
                    { date: '2025-01-15', amount: -75.00, description: 'Utility Bill' },
                    { date: '2025-01-10', amount: 200.00, description: 'Part-time Job' }
                ]
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
        this.updateTokenDisplay();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Voice controls
        document.getElementById('startBtn').addEventListener('click', () => this.startRecording());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopRecording());

        // Persona selector
        document.getElementById('personaSelect').addEventListener('change', (e) => {
            this.currentPersona = e.target.value;
        });

        // Admin form
        document.getElementById('personaForm').addEventListener('submit', (e) => this.addPersona(e));

        // Settings
        document.getElementById('saveKey').addEventListener('click', () => this.saveApiKey());
        document.getElementById('ttsModel').addEventListener('change', (e) => this.updateTtsModel(e));
        document.getElementById('ttsVoice').addEventListener('change', (e) => this.updateTtsVoice(e));
        document.getElementById('ttsSpeed').addEventListener('input', (e) => this.updateTtsSpeed(e));
        document.getElementById('testTtsVoice').addEventListener('click', () => this.testTtsVoice());

        // Debug and token panels
        document.getElementById('toggleDebug').addEventListener('click', () => this.toggleDebugPanel());
        document.getElementById('resetTokens').addEventListener('click', () => this.resetTokenUsage());

        // Speech recognition settings
        document.getElementById('audioQuality').addEventListener('change', (e) => this.updateSpeechSetting('audioQuality', e.target.value));
        document.getElementById('noiseReduction').addEventListener('change', (e) => this.updateSpeechSetting('noiseReduction', e.target.value));
        document.getElementById('whisperLanguage').addEventListener('change', (e) => this.updateSpeechSetting('whisperLanguage', e.target.value));
        document.getElementById('recognitionMode').addEventListener('change', (e) => this.updateSpeechSetting('recognitionMode', e.target.value));
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');

        if (tabName === 'admin') {
            this.loadPersonas();
        }
    }

    async startRecording() {
        if (!this.openaiApiKey) {
            this.updateStatus('Please set your OpenAI API key in Settings first!');
            this.switchTab('settings');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                this.processAudio();
            };

            this.mediaRecorder.start();
            this.isRecording = true;

            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
            this.updateStatus('🎤 Listening... Click Stop when done speaking');

        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.updateStatus('Error: Could not access microphone');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;

            document.getElementById('startBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
            this.updateStatus('Processing your speech...');
        }
    }

    async processAudio() {
        try {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });

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

            // Track Whisper usage (estimate 1 request = ~10 seconds = ~0.17 minutes)
            this.trackWhisperUsage(0.17);

            this.updateDebugOutput('sttOutput', data.text, 'Transcribed Text:');
            return data.text;

        } catch (error) {
            console.error('Speech-to-text error:', error);
            this.updateDebugOutput('sttOutput', `Error: ${error.message}`);
            throw error;
        }
    }

    async generateResponse(userMessage) {
        const persona = this.personas[this.currentPersona];
        const systemPrompt = `You are a helpful financial services AI assistant. You are speaking with ${persona.name}.
        
Customer Information:
- Name: ${persona.name}
- Account Balance: $${persona.balance.toFixed(2)}
- Account Type: ${persona.accountType}
- Card ending in: ${persona.cardLast4}
- Recent transactions: ${JSON.stringify(persona.recentTransactions)}

You should:
1. Be professional but friendly and conversational
2. Address the customer by name when appropriate
3. Provide specific information based on their account
4. Handle common requests like lost cards, balance inquiries, disputes, transfers
5. Keep responses conversational and concise (suitable for voice)
6. Use natural speech patterns with contractions (I'll, you're, we'll)
7. If asked about a lost card, offer to block it and send a replacement
8. For balance inquiries, provide the current balance and recent transactions if relevant
9. For disputes, guide them through the process
10. For transfers, ask for necessary details
11. Sound human and empathetic, not robotic

Current customer message: "${userMessage}"`;

        try {
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

            // Track GPT usage
            this.trackGptUsage(data.usage.prompt_tokens, data.usage.completion_tokens);

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

            // Track TTS usage
            this.trackTtsUsage(text.length);

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

            this.updateDebugOutput('ttsOutput', `Speech generated successfully\nCharacters: ${text.length}\nModel: ${this.ttsSettings.model}\nVoice: ${this.ttsSettings.voice}\nSpeed: ${this.ttsSettings.speed}x`);

        } catch (error) {
            console.error('TTS error:', error);
            this.updateDebugOutput('ttsOutput', `Error: ${error.message}`);
            this.updateStatus('TTS error - Ready to listen');
        }
    }

    // Token tracking methods
    trackWhisperUsage(minutes) {
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
        document.getElementById('whisperTokens').textContent = `${this.tokenUsage.whisper.requests} requests`;
        document.getElementById('whisperCost').textContent = `$${this.tokenUsage.whisper.cost.toFixed(4)}`;

        document.getElementById('gptTokens').textContent = `${this.tokenUsage.gpt.tokens} tokens`;
        document.getElementById('gptCost').textContent = `$${this.tokenUsage.gpt.cost.toFixed(4)}`;

        document.getElementById('ttsTokens').textContent = `${this.tokenUsage.tts.characters} chars`;
        document.getElementById('ttsCost').textContent = `$${this.tokenUsage.tts.cost.toFixed(4)}`;

        document.getElementById('totalCost').textContent = `$${this.tokenUsage.total.toFixed(4)}`;
    }

    resetTokenUsage() {
        if (confirm('Are you sure you want to reset all token usage data?')) {
            this.tokenUsage = {
                whisper: { requests: 0, cost: 0 },
                gpt: { tokens: 0, cost: 0 },
                tts: { characters: 0, cost: 0 },
                total: 0
            };
            this.saveTokenUsage();
            this.updateTokenDisplay();
        }
    }

    // TTS Settings methods
    initializeTtsSettings() {
        document.getElementById('ttsModel').value = this.ttsSettings.model;
        document.getElementById('ttsVoice').value = this.ttsSettings.voice;
        document.getElementById('ttsSpeed').value = this.ttsSettings.speed;
        document.getElementById('ttsSpeedValue').textContent = this.ttsSettings.speed + 'x';
    }

    updateTtsModel(e) {
        this.ttsSettings.model = e.target.value;
        localStorage.setItem('tts_model', this.ttsSettings.model);
    }

    updateTtsVoice(e) {
        this.ttsSettings.voice = e.target.value;
        localStorage.setItem('tts_voice', this.ttsSettings.voice);
    }

    updateTtsSpeed(e) {
        this.ttsSettings.speed = parseFloat(e.target.value);
        document.getElementById('ttsSpeedValue').textContent = this.ttsSettings.speed + 'x';
        localStorage.setItem('tts_speed', this.ttsSettings.speed);
    }

    async testTtsVoice() {
        const testText = `Hello! I'm your financial assistant using the ${this.ttsSettings.voice} voice. This is how I sound with your current settings.`;
        await this.textToSpeechOpenAI(testText);
    }

    // UI Helper methods
    addMessage(content, type) {
        const conversation = document.getElementById('conversation');
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message`;

        messageDiv.innerHTML = `
            <div class="message-content">
                ${content}
            </div>
        `;

        conversation.appendChild(messageDiv);
        conversation.scrollTop = conversation.scrollHeight;
    }

    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }

    updateDebugOutput(elementId, content, label = '') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = label ? `${label}\n${content}` : content;
            element.classList.add('updated');
            setTimeout(() => element.classList.remove('updated'), 500);
        }
    }

    toggleDebugPanel() {
        const debugContent = document.getElementById('debugContent');
        const toggleBtn = document.getElementById('toggleDebug');

        if (debugContent.classList.contains('hidden')) {
            debugContent.classList.remove('hidden');
            toggleBtn.textContent = 'Hide';
        } else {
            debugContent.classList.add('hidden');
            toggleBtn.textContent = 'Show';
        }
    }

    // Persona management methods
    addPersona(e) {
        e.preventDefault();

        const name = document.getElementById('personaName').value;
        const balance = parseFloat(document.getElementById('personaBalance').value);
        const cardLast4 = document.getElementById('personaCard').value;
        const accountType = document.getElementById('personaAccountType').value;

        const personaId = name.toLowerCase().replace(/\s+/g, '_');

        this.personas[personaId] = {
            name,
            balance,
            cardLast4,
            accountType,
            recentTransactions: []
        };

        this.savePersonas();
        this.loadPersonas();
        this.updatePersonaSelector();

        // Reset form
        document.getElementById('personaForm').reset();
    }

    deletePersona(personaId) {
        if (confirm('Are you sure you want to delete this persona?')) {
            delete this.personas[personaId];
            this.savePersonas();
            this.loadPersonas();
            this.updatePersonaSelector();
        }
    }

    loadPersonas() {
        const personaList = document.getElementById('personaList');
        personaList.innerHTML = '';

        Object.entries(this.personas).forEach(([id, persona]) => {
            const personaCard = document.createElement('div');
            personaCard.className = 'persona-card';
            personaCard.innerHTML = `
                <h4>${persona.name}</h4>
                <p><strong>Balance:</strong> $${persona.balance.toFixed(2)}</p>
                <p><strong>Card:</strong> ****${persona.cardLast4}</p>
                <p><strong>Account:</strong> ${persona.accountType}</p>
                <button class="delete-btn" onclick="app.deletePersona('${id}')">Delete</button>
            `;
            personaList.appendChild(personaCard);
        });
    }

    updatePersonaSelector() {
        const selector = document.getElementById('personaSelect');
        selector.innerHTML = '';

        Object.entries(this.personas).forEach(([id, persona]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = persona.name;
            if (id === this.currentPersona) {
                option.selected = true;
            }
            selector.appendChild(option);
        });
    }

    savePersonas() {
        localStorage.setItem('personas', JSON.stringify(this.personas));
    }

    saveApiKey() {
        const apiKey = document.getElementById('openaiKey').value.trim();
        if (apiKey) {
            this.openaiApiKey = apiKey;
            localStorage.setItem('openai_api_key', apiKey);
            alert('API key saved successfully!');
        }
    }
}

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new FinanceBotApp();
});
// Speech Recognition Enhancement Methods
initializeSpeechSettings() {
    document.getElementById('audioQuality').value = this.speechSettings.audioQuality;
    document.getElementById('noiseReduction').value = this.speechSettings.noiseReduction;
    document.getElementById('whisperLanguage').value = this.speechSettings.whisperLanguage;
    document.getElementById('recognitionMode').value = this.speechSettings.recognitionMode;
}

updateSpeechSetting(setting, value) {
    this.speechSettings[setting] = value;
    localStorage.setItem(setting.replace(/([A-Z])/g, '_$1').toLowerCase(), value);

    // Update debug info if available
    this.updateDebugOutput('sttOutput', `Speech setting updated: ${setting} = ${value}`);
}
    
    async startRecordingEnhanced() {
    if (!this.openaiApiKey) {
        this.updateStatus('Please set your OpenAI API key in Settings first!');
        this.switchTab('settings');
        return;
    }

    try {
        // Enhanced audio constraints based on settings
        const audioConstraints = this.getAudioConstraints();
        const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);

        // Setup audio monitoring
        await this.setupAudioMonitoring(stream);

        // Setup MediaRecorder with enhanced settings
        const options = this.getRecorderOptions();
        this.mediaRecorder = new MediaRecorder(stream, options);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
            this.audioChunks.push(event.data);
        };

        this.mediaRecorder.onstop = () => {
            this.stopAudioMonitoring();
            this.processAudioEnhanced();
        };

        this.mediaRecorder.start();
        this.isRecording = true;

        // Update UI
        document.getElementById('startBtn').disabled = true;
        document.getElementById('startBtn').classList.add('recording');
        document.getElementById('stopBtn').disabled = false;
        document.getElementById('recordingQuality').textContent = '🟡 Recording...';
        document.getElementById('recordingQuality').className = 'quality-indicator good';

        this.updateStatus('🎤 Listening... Speak clearly and watch the audio level');

    } catch (error) {
        console.error('Error accessing microphone:', error);
        this.updateStatus('Error: Could not access microphone');
        this.updateRecordingQuality('error', 'Microphone Error');
    }
}

getAudioConstraints() {
    const constraints = {
        audio: {
            echoCancellation: true,
            noiseSuppression: this.speechSettings.noiseReduction !== 'off',
            autoGainControl: true,
            channelCount: 1
        }
    };

    // Set sample rate based on quality setting
    if (this.speechSettings.audioQuality === 'high') {
        constraints.audio.sampleRate = 48000;
        constraints.audio.sampleSize = 16;
    } else {
        constraints.audio.sampleRate = 16000;
        constraints.audio.sampleSize = 16;
    }

    return constraints;
}

getRecorderOptions() {
    const options = {};

    // Set MIME type based on browser support
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
    }

    // Set bitrate for quality
    if (this.speechSettings.audioQuality === 'high') {
        options.audioBitsPerSecond = 128000;
    } else {
        options.audioBitsPerSecond = 64000;
    }

    return options;
}
    
    async setupAudioMonitoring(stream) {
    try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.microphone = this.audioContext.createMediaStreamSource(stream);

        this.analyser.fftSize = 256;
        this.microphone.connect(this.analyser);

        // Start monitoring audio levels
        this.startAudioLevelMonitoring();

    } catch (error) {
        console.error('Error setting up audio monitoring:', error);
    }
}

startAudioLevelMonitoring() {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const updateLevel = () => {
        if (!this.isRecording) return;

        this.analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const percentage = Math.round((average / 255) * 100);

        // Update UI
        this.updateAudioLevel(percentage);
        this.updateRecordingQualityFromLevel(percentage);

        // Continue monitoring
        this.audioLevelInterval = requestAnimationFrame(updateLevel);
    };

    updateLevel();
}

updateAudioLevel(percentage) {
    const levelFill = document.getElementById('audioLevel');
    const levelText = document.getElementById('audioLevelText');

    if (levelFill && levelText) {
        levelFill.style.width = `${percentage}%`;
        levelText.textContent = `${percentage}%`;
    }
}

updateRecordingQualityFromLevel(level) {
    let quality, text, className;

    if (level < 10) {
        quality = 'poor';
        text = '🔴 Too Quiet';
        className = 'quality-indicator poor';
    } else if (level < 30) {
        quality = 'good';
        text = '🟡 Good Level';
        className = 'quality-indicator good';
    } else if (level < 70) {
        quality = 'excellent';
        text = '🟢 Excellent';
        className = 'quality-indicator excellent';
    } else {
        quality = 'poor';
        text = '🔴 Too Loud';
        className = 'quality-indicator poor';
    }

    this.updateRecordingQuality(quality, text, className);
}

updateRecordingQuality(quality, text, className = null) {
    const indicator = document.getElementById('recordingQuality');
    if (indicator) {
        indicator.textContent = text;
        indicator.className = className || `quality-indicator ${quality}`;
    }
}

stopAudioMonitoring() {
    if (this.audioLevelInterval) {
        cancelAnimationFrame(this.audioLevelInterval);
        this.audioLevelInterval = null;
    }

    if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
    }

    this.analyser = null;
    this.microphone = null;
}

stopRecordingEnhanced() {
    if (this.mediaRecorder && this.isRecording) {
        this.mediaRecorder.stop();
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        this.isRecording = false;

        // Update UI
        document.getElementById('startBtn').disabled = false;
        document.getElementById('startBtn').classList.remove('recording');
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('recordingQuality').textContent = '🔴 Not Recording';
        document.getElementById('recordingQuality').className = 'quality-indicator not-recording';

        // Reset audio level
        this.updateAudioLevel(0);

        this.updateStatus('Processing your speech...');
    }
}
    
    async processAudioEnhanced() {
    try {
        let audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });

        // Apply noise reduction if enabled
        if (this.speechSettings.noiseReduction !== 'off') {
            audioBlob = await this.applyNoiseReduction(audioBlob);
        }

        // Convert speech to text using enhanced Whisper
        const transcript = await this.speechToTextEnhanced(audioBlob);

        if (transcript && transcript.trim()) {
            this.addMessage(transcript, 'user');
            this.updateStatus('Generating response...');

            // Generate AI response
            const response = await this.generateResponse(transcript);
            this.addMessage(response, 'bot');

            // Convert response to speech using OpenAI TTS
            await this.textToSpeechOpenAI(response);

            this.updateStatus('Ready to listen');
        } else {
            this.updateStatus('No speech detected. Please try again.');
            setTimeout(() => this.updateStatus('Ready to listen'), 2000);
        }

    } catch (error) {
        console.error('Error processing audio:', error);
        this.updateStatus('Error processing audio. Please try again.');
        setTimeout(() => this.updateStatus('Ready to listen'), 3000);
    }
}
    
    async applyNoiseReduction(audioBlob) {
    // Simple noise reduction using Web Audio API
    try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Apply basic noise gate and normalization
        const channelData = audioBuffer.getChannelData(0);
        const threshold = this.getNoiseThreshold();

        for (let i = 0; i < channelData.length; i++) {
            if (Math.abs(channelData[i]) < threshold) {
                channelData[i] = 0; // Remove low-level noise
            }
        }

        // Convert back to blob
        const processedBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
        processedBuffer.copyToChannel(channelData, 0);

        // Note: This is a simplified implementation
        // In production, you'd use more sophisticated noise reduction
        return audioBlob; // Return original for now

    } catch (error) {
        console.error('Noise reduction error:', error);
        return audioBlob; // Fallback to original
    }
}

getNoiseThreshold() {
    switch (this.speechSettings.noiseReduction) {
        case 'low': return 0.01;
        case 'medium': return 0.02;
        case 'high': return 0.03;
        default: return 0;
    }
}
    
    async speechToTextEnhanced(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', 'whisper-1');

    // Add language specification
    if (this.speechSettings.whisperLanguage !== 'en') {
        formData.append('language', this.speechSettings.whisperLanguage);
    }

    // Add financial context prompt based on recognition mode
    const prompt = this.getWhisperPrompt();
    if (prompt) {
        formData.append('prompt', prompt);
    }

    // Add response format for better parsing
    formData.append('response_format', 'json');

    try {
        this.updateDebugOutput('sttOutput', `Processing with Whisper (${this.speechSettings.whisperLanguage}, ${this.speechSettings.recognitionMode} mode)...`);

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

        // Track Whisper usage
        this.trackWhisperUsage(0.17);

        this.updateDebugOutput('sttOutput', `${data.text}\n\nLanguage: ${this.speechSettings.whisperLanguage}\nMode: ${this.speechSettings.recognitionMode}\nConfidence: Enhanced`);
        return data.text;

    } catch (error) {
        console.error('Enhanced speech-to-text error:', error);
        this.updateDebugOutput('sttOutput', `Error: ${error.message}`);
        throw error;
    }
}

getWhisperPrompt() {
    switch (this.speechSettings.recognitionMode) {
        case 'financial':
            return "This is a conversation with a financial services customer. Common terms include: account balance, credit card, debit card, transaction, transfer, payment, dispute, lost card, blocked card, PIN, statement, deposit, withdrawal, checking account, savings account.";
        case 'precise':
            return "Please transcribe this audio with high precision, paying attention to numbers, names, and financial terminology.";
        default:
            return null;
    }
}

    // Override the original methods to use enhanced versions
    async startRecording() {
    return this.startRecordingEnhanced();
}

stopRecording() {
    return this.stopRecordingEnhanced();
}
    
    async processAudio() {
    return this.processAudioEnhanced();
}
    
    async speechToText(audioBlob) {
    return this.speechToTextEnhanced(audioBlob);
}
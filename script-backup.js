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
            basePersonality: "You are a helpful, professional, and friendly financial services AI assistant. You should be empathetic, clear in your communication, and always prioritize customer satisfaction. Speak in a conversational tone while maintaining professionalism.",
            financialContext: `When handling financial requests:
1. Always verify customer identity through account details
2. For lost cards, immediately offer to block the card and arrange replacement
3. For balance inquiries, provide current balance and recent transactions
4. For disputes, guide customers through the dispute process step-by-step
5. For transfers, ask for necessary details (amount, recipient, account)
6. Always prioritize security and fraud prevention
7. Offer additional relevant services when appropriate`,
            responseInstructions: `Response Guidelines:
1. Keep responses conversational and concise (suitable for voice)
2. Use natural speech patterns with contractions (I'll, you're, we'll)
3. Address customers by name when appropriate
4. Provide specific information based on their account data
5. Sound human and empathetic, not robotic
6. Use clear, simple language avoiding jargon
7. Always end with asking if there's anything else you can help with
8. Maximum response length: 2-3 sentences for voice clarity`,
            customPrompts: []
        };

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
        this.initializeStreamingSettings();
        this.initializeSystemPrompts();
        this.updateTokenDisplay();
        this.initializeStreamingMode();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Voice controls
        document.getElementById('startBtn')?.addEventListener('click', () => this.startRecording());
        document.getElementById('stopBtn')?.addEventListener('click', () => this.stopRecording());

        // Persona selector
        document.getElementById('personaSelect')?.addEventListener('change', (e) => {
            this.currentPersona = e.target.value;
        });

        // Admin form
        document.getElementById('personaForm')?.addEventListener('submit', (e) => this.addPersona(e));

        // Settings
        document.getElementById('saveKey')?.addEventListener('click', () => this.saveApiKey());
        document.getElementById('ttsModel')?.addEventListener('change', (e) => this.updateTtsModel(e));
        document.getElementById('ttsVoice')?.addEventListener('change', (e) => this.updateTtsVoice(e));
        document.getElementById('ttsSpeed')?.addEventListener('input', (e) => this.updateTtsSpeed(e));
        document.getElementById('testTtsVoice')?.addEventListener('click', () => this.testTtsVoice());

        // Debug and token panels
        document.getElementById('toggleDebug')?.addEventListener('click', () => this.toggleDebugPanel());
        document.getElementById('resetTokens')?.addEventListener('click', () => this.resetTokenUsage());

        // Speech recognition settings
        document.getElementById('audioQuality')?.addEventListener('change', (e) => this.updateSpeechSetting('audioQuality', e.target.value));
        document.getElementById('noiseReduction')?.addEventListener('change', (e) => this.updateSpeechSetting('noiseReduction', e.target.value));
        document.getElementById('whisperLanguage')?.addEventListener('change', (e) => this.updateSpeechSetting('whisperLanguage', e.target.value));
        document.getElementById('recognitionMode')?.addEventListener('change', (e) => this.updateSpeechSetting('recognitionMode', e.target.value));

        // System prompts management
        document.querySelectorAll('.prompt-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchPromptTab(e.target.dataset.prompt));
        });
        document.getElementById('savePrompts')?.addEventListener('click', () => this.saveSystemPrompts());
        document.getElementById('resetPrompts')?.addEventListener('click', () => this.resetSystemPrompts());
        document.getElementById('testPrompts')?.addEventListener('click', () => this.testSystemPrompts());
        document.getElementById('addCustomPrompt')?.addEventListener('click', () => this.addCustomPrompt());

        // Streaming mode controls
        const streamingModeEl = document.getElementById('streamingMode');
        const connectBtnEl = document.getElementById('connectBtn');
        const disconnectBtnEl = document.getElementById('disconnectBtn');

        console.log('Streaming elements found:', {
            streamingMode: !!streamingModeEl,
            connectBtn: !!connectBtnEl,
            disconnectBtn: !!disconnectBtnEl
        });

        streamingModeEl?.addEventListener('change', (e) => {
            console.log('Streaming mode toggled:', e.target.checked);
            this.toggleStreamingMode(e.target.checked);
        });
        connectBtnEl?.addEventListener('click', () => {
            console.log('Connect button clicked');
            this.connectStreaming();
        });
        disconnectBtnEl?.addEventListener('click', () => {
            console.log('Disconnect button clicked');
            this.disconnectStreaming();
        });

        // Streaming settings
        document.getElementById('responseDelay')?.addEventListener('input', (e) => this.updateStreamingSetting('responseDelay', parseFloat(e.target.value)));
        document.getElementById('vadSensitivity')?.addEventListener('change', (e) => this.updateStreamingSetting('vadSensitivity', e.target.value));
        document.getElementById('audioBufferSize')?.addEventListener('change', (e) => this.updateStreamingSetting('audioBufferSize', e.target.value));
        document.getElementById('connectionQuality')?.addEventListener('change', (e) => this.updateStreamingSetting('connectionQuality', e.target.value));
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`)?.classList.add('active');

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

            // Track Whisper usage
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
        const systemPrompt = this.generateSystemPrompt(this.currentPersona, userMessage);

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
    }

    updateTtsVoice(e) {
        this.ttsSettings.voice = e.target.value;
        localStorage.setItem('tts_voice', this.ttsSettings.voice);
    }

    updateTtsSpeed(e) {
        this.ttsSettings.speed = parseFloat(e.target.value);
        const ttsSpeedValue = document.getElementById('ttsSpeedValue');
        if (ttsSpeedValue) ttsSpeedValue.textContent = this.ttsSettings.speed + 'x';
        localStorage.setItem('tts_speed', this.ttsSettings.speed);
    }

    async testTtsVoice() {
        const testText = `Hello! I'm your financial assistant using the ${this.ttsSettings.voice} voice. This is how I sound with your current settings.`;
        await this.textToSpeechOpenAI(testText);
    }

    // Speech Recognition Settings
    initializeSpeechSettings() {
        const audioQuality = document.getElementById('audioQuality');
        const noiseReduction = document.getElementById('noiseReduction');
        const whisperLanguage = document.getElementById('whisperLanguage');
        const recognitionMode = document.getElementById('recognitionMode');

        if (audioQuality) audioQuality.value = this.speechSettings.audioQuality;
        if (noiseReduction) noiseReduction.value = this.speechSettings.noiseReduction;
        if (whisperLanguage) whisperLanguage.value = this.speechSettings.whisperLanguage;
        if (recognitionMode) recognitionMode.value = this.speechSettings.recognitionMode;
    }

    updateSpeechSetting(setting, value) {
        this.speechSettings[setting] = value;
        localStorage.setItem(setting.replace(/([A-Z])/g, '_$1').toLowerCase(), value);

        // Update debug info if available
        this.updateDebugOutput('sttOutput', `Speech setting updated: ${setting} = ${value}`);
    }

    // System Prompts Management Methods
    initializeSystemPrompts() {
        const basePersonality = document.getElementById('basePersonality');
        const financialContext = document.getElementById('financialContext');
        const responseInstructions = document.getElementById('responseInstructions');

        if (basePersonality) basePersonality.value = this.systemPrompts.basePersonality;
        if (financialContext) financialContext.value = this.systemPrompts.financialContext;
        if (responseInstructions) responseInstructions.value = this.systemPrompts.responseInstructions;

        // Load custom prompts
        this.loadCustomPrompts();
    }

    switchPromptTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.prompt-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-prompt="${tabName}"]`)?.classList.add('active');

        // Update tab content
        document.querySelectorAll('.prompt-section').forEach(section => section.classList.remove('active'));
        document.getElementById(`${tabName}-prompt`)?.classList.add('active');
    }

    saveSystemPrompts() {
        try {
            const basePersonality = document.getElementById('basePersonality');
            const financialContext = document.getElementById('financialContext');
            const responseInstructions = document.getElementById('responseInstructions');

            if (basePersonality) this.systemPrompts.basePersonality = basePersonality.value;
            if (financialContext) this.systemPrompts.financialContext = financialContext.value;
            if (responseInstructions) this.systemPrompts.responseInstructions = responseInstructions.value;

            // Save custom prompts
            this.saveCustomPrompts();

            // Save to localStorage
            localStorage.setItem('system_prompts', JSON.stringify(this.systemPrompts));

            // Show success message
            this.showPromptMessage('System prompts saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving prompts:', error);
            this.showPromptMessage('Error saving prompts. Please try again.', 'error');
        }
    }

    resetSystemPrompts() {
        if (confirm('Are you sure you want to reset all system prompts to defaults? This cannot be undone.')) {
            // Reset to default prompts
            this.systemPrompts = {
                basePersonality: "You are a helpful, professional, and friendly financial services AI assistant. You should be empathetic, clear in your communication, and always prioritize customer satisfaction. Speak in a conversational tone while maintaining professionalism.",
                financialContext: `When handling financial requests:
1. Always verify customer identity through account details
2. For lost cards, immediately offer to block the card and arrange replacement
3. For balance inquiries, provide current balance and recent transactions
4. For disputes, guide customers through the dispute process step-by-step
5. For transfers, ask for necessary details (amount, recipient, account)
6. Always prioritize security and fraud prevention
7. Offer additional relevant services when appropriate`,
                responseInstructions: `Response Guidelines:
1. Keep responses conversational and concise (suitable for voice)
2. Use natural speech patterns with contractions (I'll, you're, we'll)
3. Address customers by name when appropriate
4. Provide specific information based on their account data
5. Sound human and empathetic, not robotic
6. Use clear, simple language avoiding jargon
7. Always end with asking if there's anything else you can help with
8. Maximum response length: 2-3 sentences for voice clarity`,
                customPrompts: []
            };

            // Update UI
            this.initializeSystemPrompts();

            // Save to localStorage
            localStorage.setItem('system_prompts', JSON.stringify(this.systemPrompts));

            this.showPromptMessage('System prompts reset to defaults.', 'info');
        }
    }

    testSystemPrompts() {
        const generatedPrompt = this.generateSystemPrompt('john_doe', 'test message');
        const promptPreview = document.getElementById('promptPreview');
        if (promptPreview) promptPreview.textContent = generatedPrompt;
        this.showPromptMessage('System prompt preview updated below.', 'info');
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

        this.systemPrompts.customPrompts = customPrompts;
    }

    loadCustomPrompts() {
        const customPromptsList = document.getElementById('customPromptsList');
        if (!customPromptsList) return;

        customPromptsList.innerHTML = '';

        this.systemPrompts.customPrompts.forEach(customPrompt => {
            const promptItem = document.createElement('div');
            promptItem.className = 'custom-prompt-item';
            promptItem.innerHTML = `
                <input type="text" placeholder="Scenario name" class="scenario-name" value="${customPrompt.name}">
                <textarea placeholder="Custom prompt for this scenario..." class="custom-prompt-text" rows="4">${customPrompt.prompt}</textarea>
                <button class="remove-custom-prompt" onclick="this.parentElement.remove()">Remove</button>
            `;
            customPromptsList.appendChild(promptItem);
        });

        // Always add one empty prompt for new entries
        this.addCustomPrompt();
    }

    generateSystemPrompt(personaId, userMessage) {
        const persona = this.personas[personaId];
        if (!persona) return '';

        let systemPrompt = this.systemPrompts.basePersonality + '\n\n';
        systemPrompt += this.systemPrompts.financialContext + '\n\n';
        systemPrompt += this.systemPrompts.responseInstructions + '\n\n';

        // Add custom prompts if any match the context
        this.systemPrompts.customPrompts.forEach(customPrompt => {
            if (userMessage.toLowerCase().includes(customPrompt.name.toLowerCase().split(' ')[0])) {
                systemPrompt += `${customPrompt.name}: ${customPrompt.prompt}\n\n`;
            }
        });

        systemPrompt += `Customer Information:
- Name: ${persona.name}
- Account Balance: $${persona.balance.toFixed(2)}
- Account Type: ${persona.accountType}
- Card ending in: ${persona.cardLast4}
- Recent transactions: ${JSON.stringify(persona.recentTransactions)}

Current customer message: "${userMessage}"`;

        return systemPrompt;
    }

    showPromptMessage(message, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.prompt-message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `prompt-message ${type}`;
        messageDiv.textContent = message;

        // Insert after prompt actions
        const promptActions = document.querySelector('.prompt-actions');
        if (promptActions) {
            promptActions.parentNode.insertBefore(messageDiv, promptActions.nextSibling);
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
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
    }

    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) statusElement.textContent = message;
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

        if (debugContent && toggleBtn) {
            if (debugContent.classList.contains('hidden')) {
                debugContent.classList.remove('hidden');
                toggleBtn.textContent = 'Hide';
            } else {
                debugContent.classList.add('hidden');
                toggleBtn.textContent = 'Show';
            }
        }
    }

    // Persona management methods
    addPersona(e) {
        e.preventDefault();

        const nameInput = document.getElementById('personaName');
        const balanceInput = document.getElementById('personaBalance');
        const cardInput = document.getElementById('personaCard');
        const accountTypeInput = document.getElementById('personaAccountType');

        if (!nameInput || !balanceInput || !cardInput || !accountTypeInput) return;

        const name = nameInput.value;
        const balance = parseFloat(balanceInput.value);
        const cardLast4 = cardInput.value;
        const accountType = accountTypeInput.value;

        const personaId = name.toLowerCase().replace(/\s+/g, '_');

        // Add new persona
        this.personas[personaId] = {
            name: name,
            balance: balance,
            cardLast4: cardLast4,
            accountType: accountType,
            recentTransactions: [
                { date: new Date().toISOString().split('T')[0], amount: 0, description: 'Account opened' }
            ]
        };

        // Save to localStorage
        localStorage.setItem('personas', JSON.stringify(this.personas));

        // Update UI
        this.updatePersonaSelector();
        this.loadPersonas();

        // Reset form
        const form = document.getElementById('personaForm');
        if (form) form.reset();

        alert(`Persona "${name}" added successfully!`);
    }

    deletePersona(personaId) {
        if (confirm('Are you sure you want to delete this persona?')) {
            delete this.personas[personaId];
            localStorage.setItem('personas', JSON.stringify(this.personas));
            this.updatePersonaSelector();
            this.loadPersonas();
        }
    }

    updatePersonaSelector() {
        const selector = document.getElementById('personaSelect');
        if (!selector) return;

        selector.innerHTML = '';

        Object.keys(this.personas).forEach(personaId => {
            const option = document.createElement('option');
            option.value = personaId;
            option.textContent = this.personas[personaId].name;
            selector.appendChild(option);
        });

        selector.value = this.currentPersona;
    }

    loadPersonas() {
        const personaList = document.getElementById('personaList');
        if (!personaList) return;

        personaList.innerHTML = '';

        Object.keys(this.personas).forEach(personaId => {
            const persona = this.personas[personaId];
            const personaCard = document.createElement('div');
            personaCard.className = 'persona-card';
            personaCard.innerHTML = `
                <h4>${persona.name}</h4>
                <p><strong>Balance:</strong> $${persona.balance.toFixed(2)}</p>
                <p><strong>Card:</strong> ****${persona.cardLast4}</p>
                <p><strong>Account Type:</strong> ${persona.accountType}</p>
                <button class="delete-btn" onclick="app.deletePersona('${personaId}')">Delete</button>
            `;
            personaList.appendChild(personaCard);
        });
    }

    saveApiKey() {
        const apiKeyInput = document.getElementById('openaiKey');
        if (!apiKeyInput) return;

        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            this.openaiApiKey = apiKey;
            localStorage.setItem('openai_api_key', apiKey);
            alert('API key saved successfully!');
        } else {
            alert('Please enter a valid API key.');
        }
    }

    // Streaming Mode Methods
    initializeStreamingMode() {
        const streamingModeCheckbox = document.getElementById('streamingMode');
        if (streamingModeCheckbox) {
            streamingModeCheckbox.checked = this.isStreamingMode;
            this.toggleStreamingMode(this.isStreamingMode);
        }
    }

    initializeStreamingSettings() {
        const responseDelay = document.getElementById('responseDelay');
        const responseDelayValue = document.getElementById('responseDelayValue');
        const vadSensitivity = document.getElementById('vadSensitivity');
        const audioBufferSize = document.getElementById('audioBufferSize');
        const connectionQuality = document.getElementById('connectionQuality');

        if (responseDelay) responseDelay.value = this.streamingSettings.responseDelay;
        if (responseDelayValue) responseDelayValue.textContent = this.streamingSettings.responseDelay + 's';
        if (vadSensitivity) vadSensitivity.value = this.streamingSettings.vadSensitivity;
        if (audioBufferSize) audioBufferSize.value = this.streamingSettings.audioBufferSize;
        if (connectionQuality) connectionQuality.value = this.streamingSettings.connectionQuality;
    }

    toggleStreamingMode(enabled) {
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

                // Disconnect any existing streaming connection when switching modes
                if (this.isConnected) {
                    this.disconnectStreaming();
                }
            } else {
                batchControls.classList.remove('hidden');
                streamingControls.classList.add('hidden');
                modeDescription.textContent = 'Batch Mode: Click to record, then process';

                // Stop any recording when switching to batch mode
                if (this.isRecording) {
                    this.stopRecording();
                }
            }
        }
    }

    updateStreamingSetting(setting, value) {
        this.streamingSettings[setting] = value;
        localStorage.setItem(setting.replace(/([A-Z])/g, '_$1').toLowerCase(), value);

        // Update UI display for responseDelay
        if (setting === 'responseDelay') {
            const responseDelayValue = document.getElementById('responseDelayValue');
            if (responseDelayValue) responseDelayValue.textContent = value + 's';
        }

        // Update debug info if available
        this.updateDebugOutput('sttOutput', `Streaming setting updated: ${setting} = ${value}`);
    }

    async connectStreaming() {
        console.log('connectStreaming called');

        if (!this.openaiApiKey) {
            console.log('No API key found');
            this.updateStatus('Please set your OpenAI API key in Settings first!');
            this.switchTab('settings');
            return;
        }

        try {
            console.log('Starting connection process');
            this.updateConnectionStatus('connecting');
            this.updateStatus('🔄 Connecting to streaming service...');

            // Initialize audio context for streaming
            await this.initializeAudioStreaming();

            // Connect to OpenAI Realtime API via WebSocket
            await this.connectWebSocket();

            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.updateStatus('📞 Connected - Start speaking naturally');

            const connectBtn = document.getElementById('connectBtn');
            const disconnectBtn = document.getElementById('disconnectBtn');
            if (connectBtn) connectBtn.disabled = true;
            if (disconnectBtn) disconnectBtn.disabled = false;

        } catch (error) {
            console.error('Streaming connection error:', error);
            this.updateConnectionStatus('disconnected');
            this.updateStatus('❌ Connection failed - Please try again');
            this.showStreamingError('Failed to connect to streaming service. Please check your internet connection and API key.');
        }
    }

    async disconnectStreaming() {
        try {
            this.updateStatus('🔄 Disconnecting...');

            // Close WebSocket connection
            if (this.websocket) {
                this.websocket.close();
                this.websocket = null;
            }

            // Stop audio processing
            if (this.processor) {
                this.processor.disconnect();
                this.processor = null;
            }

            if (this.audioContext) {
                await this.audioContext.close();
                this.audioContext = null;
            }

            // Clear any pending timers
            if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
                this.silenceTimer = null;
            }

            this.isConnected = false;
            this.isSpeaking = false;
            this.updateConnectionStatus('disconnected');
            this.updateSpeakingIndicator(false);
            this.updateStatus('📞 Disconnected');

            const connectBtn = document.getElementById('connectBtn');
            const disconnectBtn = document.getElementById('disconnectBtn');
            if (connectBtn) connectBtn.disabled = false;
            if (disconnectBtn) disconnectBtn.disabled = true;

        } catch (error) {
            console.error('Disconnect error:', error);
            this.updateStatus('❌ Disconnect error - Connection may still be active');
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        statusElement.className = `status-indicator ${status}`;

        switch (status) {
            case 'connecting':
                statusElement.textContent = 'Connecting...';
                break;
            case 'connected':
                statusElement.textContent = 'Connected';
                break;
            case 'disconnected':
                statusElement.textContent = 'Disconnected';
                break;
        }
    }

    updateSpeakingIndicator(isSpeaking) {
        const indicator = document.getElementById('speakingIndicator');
        if (!indicator) return;

        if (isSpeaking) {
            indicator.textContent = '🎤';
            indicator.classList.add('speaking');
        } else {
            indicator.textContent = '🔇';
            indicator.classList.remove('speaking');
        }
    }

    showStreamingError(message) {
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'streaming-error';
        errorDiv.innerHTML = `
            <div class="error-content">
                <h4>⚠️ Streaming Connection Error</h4>
                <p>${message}</p>
                <div class="error-actions">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="dismiss-btn">Dismiss</button>
                    <button onclick="app.toggleStreamingMode(false)" class="switch-batch-btn">Switch to Batch Mode</button>
                </div>
            </div>
        `;

        // Insert error message
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(errorDiv, container.firstChild);
        }

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }
        });

        // Always add one empty prompt for new entries
        this.addCustomPrompt();
    }

    generateSystemPrompt(personaId, userMessage) {
        const persona = this.personas[personaId];
        if (!persona) return '';

        let systemPrompt = this.systemPrompts.basePersonality + '\n\n';
        systemPrompt += this.systemPrompts.financialContext + '\n\n';
        systemPrompt += this.systemPrompts.responseInstructions + '\n\n';

        // Add custom prompts if any match the context
        this.systemPrompts.customPrompts.forEach(customPrompt => {
            if (userMessage.toLowerCase().includes(customPrompt.name.toLowerCase().split(' ')[0])) {
                systemPrompt += `${ customPrompt.name }: ${ customPrompt.prompt } \n\n`;
            }
        });

        systemPrompt += `Customer Information:
- Name: ${ persona.name }
- Account Balance: $${ persona.balance.toFixed(2) }
- Account Type: ${ persona.accountType }
- Card ending in: ${ persona.cardLast4 }
- Recent transactions: ${ JSON.stringify(persona.recentTransactions) }

Current customer message: "${userMessage}"`;

        return systemPrompt;
    }

    showPromptMessage(message, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.prompt-message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `prompt - message ${ type } `;
        messageDiv.textContent = message;

        // Insert after prompt actions
        const promptActions = document.querySelector('.prompt-actions');
        if (promptActions) {
            promptActions.parentNode.insertBefore(messageDiv, promptActions.nextSibling);
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    // UI Helper methods
    addMessage(content, type) {
        const conversation = document.getElementById('conversation');
        if (!conversation) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `${ type } -message`;

        messageDiv.innerHTML = `
    < div class="message-content" >
        ${ content }
            </div >
    `;

        conversation.appendChild(messageDiv);
        conversation.scrollTop = conversation.scrollHeight;
    }

    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) statusElement.textContent = message;
    }

    updateDebugOutput(elementId, content, label = '') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = label ? `${ label } \n${ content } ` : content;
            element.classList.add('updated');
            setTimeout(() => element.classList.remove('updated'), 500);
        }
    }

    toggleDebugPanel() {
        const debugContent = document.getElementById('debugContent');
        const toggleBtn = document.getElementById('toggleDebug');

        if (debugContent && toggleBtn) {
            if (debugContent.classList.contains('hidden')) {
                debugContent.classList.remove('hidden');
                toggleBtn.textContent = 'Hide';
            } else {
                debugContent.classList.add('hidden');
                toggleBtn.textContent = 'Show';
            }
        }
    }

    // Persona management methods
    addPersona(e) {
        e.preventDefault();

        const nameInput = document.getElementById('personaName');
        const balanceInput = document.getElementById('personaBalance');
        const cardInput = document.getElementById('personaCard');
        const accountTypeInput = document.getElementById('personaAccountType');

        if (!nameInput || !balanceInput || !cardInput || !accountTypeInput) return;

        const name = nameInput.value;
        const balance = parseFloat(balanceInput.value);
        const cardLast4 = cardInput.value;
        const accountType = accountTypeInput.value;

        const personaId = name.toLowerCase().replace(/\s+/g, '_');

        // Add new persona
        this.personas[personaId] = {
            name: name,
            balance: balance,
            cardLast4: cardLast4,
            accountType: accountType,
            recentTransactions: [
                { date: new Date().toISOString().split('T')[0], amount: 0, description: 'Account opened' }
            ]
        };

        // Save to localStorage
        localStorage.setItem('personas', JSON.stringify(this.personas));

        // Update UI
        this.updatePersonaSelector();
        this.loadPersonas();

        // Reset form
        const form = document.getElementById('personaForm');
        if (form) form.reset();

        alert(`Persona "${name}" added successfully!`);
    }

    deletePersona(personaId) {
        if (confirm('Are you sure you want to delete this persona?')) {
            delete this.personas[personaId];
            localStorage.setItem('personas', JSON.stringify(this.personas));
            this.updatePersonaSelector();
            this.loadPersonas();
        }
    }

    updatePersonaSelector() {
        const selector = document.getElementById('personaSelect');
        if (!selector) return;

        selector.innerHTML = '';

        Object.keys(this.personas).forEach(personaId => {
            const option = document.createElement('option');
            option.value = personaId;
            option.textContent = this.personas[personaId].name;
            selector.appendChild(option);
        });

        selector.value = this.currentPersona;
    }

    loadPersonas() {
        const personaList = document.getElementById('personaList');
        if (!personaList) return;

        personaList.innerHTML = '';

        Object.keys(this.personas).forEach(personaId => {
            const persona = this.personas[personaId];
            const personaCard = document.createElement('div');
            personaCard.className = 'persona-card';
            personaCard.innerHTML = `
    < h4 > ${ persona.name }</h4 >
                <p><strong>Balance:</strong> $${persona.balance.toFixed(2)}</p>
                <p><strong>Card:</strong> ****${persona.cardLast4}</p>
                <p><strong>Account Type:</strong> ${persona.accountType}</p>
                <button class="delete-btn" onclick="app.deletePersona('${personaId}')">Delete</button>
`;
            personaList.appendChild(personaCard);
        });
    }

    saveApiKey() {
        const apiKeyInput = document.getElementById('openaiKey');
        if (!apiKeyInput) return;

        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            this.openaiApiKey = apiKey;
            localStorage.setItem('openai_api_key', apiKey);
            alert('API key saved successfully!');
        } else {
            alert('Please enter a valid API key.');
        }
    }

    // Streaming Mode Methods
    initializeStreamingMode() {
        const streamingModeCheckbox = document.getElementById('streamingMode');
        if (streamingModeCheckbox) {
            streamingModeCheckbox.checked = this.isStreamingMode;
            this.toggleStreamingMode(this.isStreamingMode);
        }
    }

    initializeStreamingSettings() {
        const responseDelay = document.getElementById('responseDelay');
        const responseDelayValue = document.getElementById('responseDelayValue');
        const vadSensitivity = document.getElementById('vadSensitivity');
        const audioBufferSize = document.getElementById('audioBufferSize');
        const connectionQuality = document.getElementById('connectionQuality');

        if (responseDelay) responseDelay.value = this.streamingSettings.responseDelay;
        if (responseDelayValue) responseDelayValue.textContent = this.streamingSettings.responseDelay + 's';
        if (vadSensitivity) vadSensitivity.value = this.streamingSettings.vadSensitivity;
        if (audioBufferSize) audioBufferSize.value = this.streamingSettings.audioBufferSize;
        if (connectionQuality) connectionQuality.value = this.streamingSettings.connectionQuality;
    }

    toggleStreamingMode(enabled) {
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

                // Disconnect any existing streaming connection when switching modes
                if (this.isConnected) {
                    this.disconnectStreaming();
                }
            } else {
                batchControls.classList.remove('hidden');
                streamingControls.classList.add('hidden');
                modeDescription.textContent = 'Batch Mode: Click to record, then process';

                // Stop any recording when switching to batch mode
                if (this.isRecording) {
                    this.stopRecording();
                }
            }
        }
    }

    updateStreamingSetting(setting, value) {
        this.streamingSettings[setting] = value;
        localStorage.setItem(setting.replace(/([A-Z])/g, '_$1').toLowerCase(), value);

        // Update UI display for responseDelay
        if (setting === 'responseDelay') {
            const responseDelayValue = document.getElementById('responseDelayValue');
            if (responseDelayValue) responseDelayValue.textContent = value + 's';
        }

        // Update debug info if available
        this.updateDebugOutput('sttOutput', `Streaming setting updated: ${ setting } = ${ value } `);
    }

    async connectStreaming() {
        console.log('connectStreaming called');

        if (!this.openaiApiKey) {
            console.log('No API key found');
            this.updateStatus('Please set your OpenAI API key in Settings first!');
            this.switchTab('settings');
            return;
        }

        try {
            console.log('Starting connection process');
            this.updateConnectionStatus('connecting');
            this.updateStatus('🔄 Connecting to streaming service...');

            // Initialize audio context for streaming
            await this.initializeAudioStreaming();

            // Connect to OpenAI Realtime API via WebSocket
            await this.connectWebSocket();

            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.updateStatus('📞 Connected - Start speaking naturally');

            const connectBtn = document.getElementById('connectBtn');
            const disconnectBtn = document.getElementById('disconnectBtn');
            if (connectBtn) connectBtn.disabled = true;
            if (disconnectBtn) disconnectBtn.disabled = false;

        } catch (error) {
            console.error('Streaming connection error:', error);
            this.updateConnectionStatus('disconnected');
            this.updateStatus('❌ Connection failed - Please try again');
            this.showStreamingError('Failed to connect to streaming service. Please check your internet connection and API key.');
        }
    }

    async disconnectStreaming() {
        try {
            this.updateStatus('🔄 Disconnecting...');

            // Close WebSocket connection
            if (this.websocket) {
                this.websocket.close();
                this.websocket = null;
            }

            // Stop audio processing
            if (this.processor) {
                this.processor.disconnect();
                this.processor = null;
            }

            if (this.audioContext) {
                await this.audioContext.close();
                this.audioContext = null;
            }

            // Clear any pending timers
            if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
                this.silenceTimer = null;
            }

            this.isConnected = false;
            this.isSpeaking = false;
            this.updateConnectionStatus('disconnected');
            this.updateSpeakingIndicator(false);
            this.updateStatus('📞 Disconnected');

            const connectBtn = document.getElementById('connectBtn');
            const disconnectBtn = document.getElementById('disconnectBtn');
            if (connectBtn) connectBtn.disabled = false;
            if (disconnectBtn) disconnectBtn.disabled = true;

        } catch (error) {
            console.error('Disconnect error:', error);
            this.updateStatus('❌ Disconnect error - Connection may still be active');
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        statusElement.className = `status - indicator ${ status } `;

        switch (status) {
            case 'connecting':
                statusElement.textContent = 'Connecting...';
                break;
            case 'connected':
                statusElement.textContent = 'Connected';
                break;
            case 'disconnected':
                statusElement.textContent = 'Disconnected';
                break;
        }
    }

    updateSpeakingIndicator(isSpeaking) {
        const indicator = document.getElementById('speakingIndicator');
        if (!indicator) return;

        if (isSpeaking) {
            indicator.textContent = '🎤';
            indicator.classList.add('speaking');
        } else {
            indicator.textContent = '🔇';
            indicator.classList.remove('speaking');
        }
    }

    showStreamingError(message) {
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'streaming-error';
        errorDiv.innerHTML = `
    < div class="error-content" >
                <h4>⚠️ Streaming Connection Error</h4>
                <p>${message}</p>
                <div class="error-actions">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="dismiss-btn">Dismiss</button>
                    <button onclick="app.toggleStreamingMode(false)" class="switch-batch-btn">Switch to Batch Mode</button>
                </div>
            </div >
    `;

        // Insert error message
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(errorDiv, container.firstChild);
        }

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }
}

    async initializeAudioStreaming() {
    try {
        console.log('Initializing audio streaming...');

        // Get user media for streaming
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: this.speechSettings.audioQuality === 'high' ? 48000 : 24000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: this.speechSettings.noiseReduction !== 'off',
                autoGainControl: true
            }
        });

        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 24000 // OpenAI Realtime API prefers 24kHz
        });

        const source = this.audioContext.createMediaStreamSource(stream);

        // Create script processor for real-time audio processing
        const bufferSize = this.getBufferSize();
        this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

        // Set up audio processing
        this.processor.onaudioprocess = (event) => {
            this.processStreamingAudio(event.inputBuffer);
        };

        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        console.log('Audio streaming initialized successfully');
        this.updateDebugOutput('sttOutput', 'Audio streaming initialized successfully');

    } catch (error) {
        console.error('Audio streaming initialization error:', error);
        throw new Error('Failed to initialize audio streaming: ' + error.message);
    }
}

getBufferSize() {
    switch (this.streamingSettings.audioBufferSize) {
        case 'small': return 1024;  // Low latency
        case 'large': return 8192;  // High quality
        default: return 4096;       // Balanced
    }
}

    async connectWebSocket() {
    return new Promise((resolve, reject) => {
        try {
            console.log('Connecting to OpenAI Realtime API...');

            // OpenAI Realtime API WebSocket URL
            const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                console.log('WebSocket connection established');
                this.updateDebugOutput('sttOutput', 'WebSocket connection established');

                // Send authentication and initial configuration
                this.sendWebSocketMessage({
                    type: 'session.update',
                    session: {
                        modalities: ['text', 'audio'],
                        instructions: this.generateSystemPrompt(this.currentPersona, ''),
                        voice: this.ttsSettings.voice,
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        input_audio_transcription: {
                            model: 'whisper-1'
                        },
                        turn_detection: {
                            type: 'server_vad',
                            threshold: this.getVadThreshold(),
                            prefix_padding_ms: 300,
                            silence_duration_ms: this.streamingSettings.responseDelay * 1000
                        },
                        temperature: 0.8,
                        max_response_output_tokens: 4096
                    }
                });

                // Send authorization header
                this.sendWebSocketMessage({
                    type: 'auth',
                    token: this.openaiApiKey
                });

                resolve();
            };

            this.websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(new Error('WebSocket connection failed'));
            };

            this.websocket.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                if (this.isConnected) {
                    this.showStreamingError('Connection lost. Please reconnect.');
                    this.disconnectStreaming();
                }
            };

        } catch (error) {
            reject(error);
        }
    });
}

getVadThreshold() {
    switch (this.streamingSettings.vadSensitivity) {
        case 'low': return 0.3;
        case 'high': return 0.7;
        default: return 0.5; // medium
    }
}

sendWebSocketMessage(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        console.log('Sending WebSocket message:', message.type);
        this.websocket.send(JSON.stringify(message));
    } else {
        console.warn('WebSocket not ready, message not sent:', message.type);
    }
}

processStreamingAudio(inputBuffer) {
    if (!this.isConnected || !this.websocket) return;

    // Convert audio buffer to PCM16 format
    const audioData = this.convertToPCM16(inputBuffer);

    // Send audio data to OpenAI Realtime API
    this.sendWebSocketMessage({
        type: 'input_audio_buffer.append',
        audio: this.arrayBufferToBase64(audioData)
    });

    // Update audio level indicator
    this.updateAudioLevel(inputBuffer);
}

convertToPCM16(inputBuffer) {
    const inputData = inputBuffer.getChannelData(0);
    const outputData = new Int16Array(inputData.length);

    for (let i = 0; i < inputData.length; i++) {
        const sample = Math.max(-1, Math.min(1, inputData[i]));
        outputData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    return outputData.buffer;
}

arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

handleWebSocketMessage(message) {
    console.log('Received WebSocket message:', message.type);

    switch (message.type) {
        case 'session.created':
            console.log('Streaming session created successfully');
            this.updateDebugOutput('systemPrompt', 'Streaming session created successfully');
            break;

        case 'session.updated':
            console.log('Session configuration updated');
            break;

        case 'input_audio_buffer.speech_started':
            console.log('Speech started detected');
            this.isSpeaking = true;
            this.updateSpeakingIndicator(true);
            this.updateStatus('🎤 Listening...');
            break;

        case 'input_audio_buffer.speech_stopped':
            console.log('Speech stopped detected');
            this.isSpeaking = false;
            this.updateSpeakingIndicator(false);
            this.updateStatus('🤔 Processing...');
            break;

        case 'conversation.item.input_audio_transcription.completed':
            const transcript = message.transcript;
            console.log('Transcription completed:', transcript);
            this.addMessage(transcript, 'user');
            this.updateDebugOutput('sttOutput', transcript, 'Transcribed Text:');
            break;

        case 'response.audio.delta':
            // Handle streaming audio response
            this.playStreamingAudio(message.delta);
            break;

        case 'response.audio.done':
            console.log('Audio response completed');
            this.updateStatus('📞 Connected - Ready for next input');
            break;

        case 'response.text.delta':
            // Handle streaming text response
            this.handleStreamingTextResponse(message.delta);
            break;

        case 'response.done':
            console.log('Response completed');
            this.updateStatus('📞 Connected - Ready for next input');
            break;

        case 'error':
            console.error('Streaming API error:', message.error);
            this.showStreamingError(`API Error: ${ message.error.message || 'Unknown error' } `);
            break;

        case 'rate_limits.updated':
            console.log('Rate limits updated:', message.rate_limits);
            break;

        default:
            // Log other message types for debugging
            console.log('Unhandled message type:', message.type);
            this.updateDebugOutput('gptResponse', `Received: ${ message.type } `);
            break;
    }
}

playStreamingAudio(audioData) {
    try {
        // Convert base64 audio data to audio buffer and play
        const audioBuffer = this.base64ToArrayBuffer(audioData);
        const audioBlob = new Blob([audioBuffer], { type: 'audio/pcm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.play().then(() => {
            this.updateStatus('🔊 Speaking...');
        }).catch(error => {
            console.error('Audio playback error:', error);
        });

        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            this.updateStatus('📞 Connected - Ready for next input');
        };

    } catch (error) {
        console.error('Streaming audio playback error:', error);
    }
}

base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

handleStreamingTextResponse(textDelta) {
    // Accumulate text response for display
    if (!this.currentStreamingResponse) {
        this.currentStreamingResponse = '';
    }
    this.currentStreamingResponse += textDelta;
    this.updateDebugOutput('gptResponse', this.currentStreamingResponse, 'AI Response (streaming):');
}

updateAudioLevel(inputBuffer) {
    const inputData = inputBuffer.getChannelData(0);
    let sum = 0;

    for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
    }

    const rms = Math.sqrt(sum / inputData.length);
    const level = Math.min(100, Math.max(0, rms * 100 * 10)); // Scale and clamp

    const audioLevelFill = document.getElementById('audioLevel');
    const audioLevelText = document.getElementById('audioLevelText');

    if (audioLevelFill && audioLevelText) {
        audioLevelFill.style.width = level + '%';
        audioLevelText.textContent = Math.round(level) + '%';
    }
}
}

// Initialize the app
const app = new FinanceBotApp();         
       <textarea placeholder="Custom prompt for this scenario..." class="custom-prompt-text" rows="4">${customPrompt.prompt}</textarea>
                <button class="remove-custom-prompt" onclick="this.parentElement.remove()">Remove</button>
            `;
customPromptsList.appendChild(promptItem);
        });

// Always add one empty prompt for new entries
this.addCustomPrompt();
    }

generateSystemPrompt(personaId, userMessage) {
    const persona = this.personas[personaId];
    if (!persona) return '';

    let systemPrompt = this.systemPrompts.basePersonality + '\n\n';
    systemPrompt += this.systemPrompts.financialContext + '\n\n';
    systemPrompt += this.systemPrompts.responseInstructions + '\n\n';

    // Add custom prompts if any match the context
    this.systemPrompts.customPrompts.forEach(customPrompt => {
        if (userMessage.toLowerCase().includes(customPrompt.name.toLowerCase().split(' ')[0])) {
            systemPrompt += `${customPrompt.name}: ${customPrompt.prompt}\n\n`;
        }
    });

    systemPrompt += `Customer Information:
- Name: ${persona.name}
- Account Balance: $${persona.balance.toFixed(2)}
- Account Type: ${persona.accountType}
- Card ending in: ${persona.cardLast4}
- Recent transactions: ${JSON.stringify(persona.recentTransactions)}

Current customer message: "${userMessage}"`;

    return systemPrompt;
}

showPromptMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.prompt-message');
    existingMessages.forEach(msg => msg.remove());

    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `prompt-message ${type}`;
    messageDiv.textContent = message;

    // Insert after prompt actions
    const promptActions = document.querySelector('.prompt-actions');
    if (promptActions) {
        promptActions.parentNode.insertBefore(messageDiv, promptActions.nextSibling);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
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
}

updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) statusElement.textContent = message;
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

    if (debugContent && toggleBtn) {
        if (debugContent.classList.contains('hidden')) {
            debugContent.classList.remove('hidden');
            toggleBtn.textContent = 'Hide';
        } else {
            debugContent.classList.add('hidden');
            toggleBtn.textContent = 'Show';
        }
    }
}

// Persona management methods
addPersona(e) {
    e.preventDefault();

    const nameInput = document.getElementById('personaName');
    const balanceInput = document.getElementById('personaBalance');
    const cardInput = document.getElementById('personaCard');
    const accountTypeInput = document.getElementById('personaAccountType');

    if (!nameInput || !balanceInput || !cardInput || !accountTypeInput) return;

    const name = nameInput.value;
    const balance = parseFloat(balanceInput.value);
    const cardLast4 = cardInput.value;
    const accountType = accountTypeInput.value;

    const personaId = name.toLowerCase().replace(/\s+/g, '_');

    // Add new persona
    this.personas[personaId] = {
        name: name,
        balance: balance,
        cardLast4: cardLast4,
        accountType: accountType,
        recentTransactions: [
            { date: new Date().toISOString().split('T')[0], amount: 0, description: 'Account opened' }
        ]
    };

    // Save to localStorage
    localStorage.setItem('personas', JSON.stringify(this.personas));

    // Update UI
    this.updatePersonaSelector();
    this.loadPersonas();

    // Reset form
    const form = document.getElementById('personaForm');
    if (form) form.reset();

    alert(`Persona "${name}" added successfully!`);
}

deletePersona(personaId) {
    if (confirm('Are you sure you want to delete this persona?')) {
        delete this.personas[personaId];
        localStorage.setItem('personas', JSON.stringify(this.personas));
        this.updatePersonaSelector();
        this.loadPersonas();
    }
}

updatePersonaSelector() {
    const selector = document.getElementById('personaSelect');
    if (!selector) return;

    selector.innerHTML = '';

    Object.keys(this.personas).forEach(personaId => {
        const option = document.createElement('option');
        option.value = personaId;
        option.textContent = this.personas[personaId].name;
        selector.appendChild(option);
    });

    selector.value = this.currentPersona;
}

loadPersonas() {
    const personaList = document.getElementById('personaList');
    if (!personaList) return;

    personaList.innerHTML = '';

    Object.keys(this.personas).forEach(personaId => {
        const persona = this.personas[personaId];
        const personaCard = document.createElement('div');
        personaCard.className = 'persona-card';
        personaCard.innerHTML = `
                <h4>${persona.name}</h4>
                <p><strong>Balance:</strong> $${persona.balance.toFixed(2)}</p>
                <p><strong>Card:</strong> ****${persona.cardLast4}</p>
                <p><strong>Account Type:</strong> ${persona.accountType}</p>
                <button class="delete-btn" onclick="app.deletePersona('${personaId}')">Delete</button>
            `;
        personaList.appendChild(personaCard);
    });
}

saveApiKey() {
    const apiKeyInput = document.getElementById('openaiKey');
    if (!apiKeyInput) return;

    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        this.openaiApiKey = apiKey;
        localStorage.setItem('openai_api_key', apiKey);
        alert('API key saved successfully!');
    } else {
        alert('Please enter a valid API key.');
    }
}

// Streaming Mode Methods
initializeStreamingMode() {
    const streamingModeCheckbox = document.getElementById('streamingMode');
    if (streamingModeCheckbox) {
        streamingModeCheckbox.checked = this.isStreamingMode;
        this.toggleStreamingMode(this.isStreamingMode);
    }
}

initializeStreamingSettings() {
    const responseDelay = document.getElementById('responseDelay');
    const responseDelayValue = document.getElementById('responseDelayValue');
    const vadSensitivity = document.getElementById('vadSensitivity');
    const audioBufferSize = document.getElementById('audioBufferSize');
    const connectionQuality = document.getElementById('connectionQuality');

    if (responseDelay) responseDelay.value = this.streamingSettings.responseDelay;
    if (responseDelayValue) responseDelayValue.textContent = this.streamingSettings.responseDelay + 's';
    if (vadSensitivity) vadSensitivity.value = this.streamingSettings.vadSensitivity;
    if (audioBufferSize) audioBufferSize.value = this.streamingSettings.audioBufferSize;
    if (connectionQuality) connectionQuality.value = this.streamingSettings.connectionQuality;
}

toggleStreamingMode(enabled) {
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

            // Disconnect any existing streaming connection when switching modes
            if (this.isConnected) {
                this.disconnectStreaming();
            }
        } else {
            batchControls.classList.remove('hidden');
            streamingControls.classList.add('hidden');
            modeDescription.textContent = 'Batch Mode: Click to record, then process';

            // Stop any recording when switching to batch mode
            if (this.isRecording) {
                this.stopRecording();
            }
        }
    }
}

updateStreamingSetting(setting, value) {
    this.streamingSettings[setting] = value;
    localStorage.setItem(setting.replace(/([A-Z])/g, '_$1').toLowerCase(), value);

    // Update UI display for responseDelay
    if (setting === 'responseDelay') {
        const responseDelayValue = document.getElementById('responseDelayValue');
        if (responseDelayValue) responseDelayValue.textContent = value + 's';
    }

    // Update debug info if available
    this.updateDebugOutput('sttOutput', `Streaming setting updated: ${setting} = ${value}`);
}

    async connectStreaming() {
    console.log('connectStreaming called');

    if (!this.openaiApiKey) {
        console.log('No API key found');
        this.updateStatus('Please set your OpenAI API key in Settings first!');
        this.switchTab('settings');
        return;
    }

    try {
        console.log('Starting connection process');
        this.updateConnectionStatus('connecting');
        this.updateStatus('🔄 Connecting to streaming service...');

        // Initialize audio context for streaming
        await this.initializeAudioStreaming();

        // Connect to OpenAI Realtime API via WebSocket
        await this.connectWebSocket();

        this.isConnected = true;
        this.updateConnectionStatus('connected');
        this.updateStatus('📞 Connected - Start speaking naturally');

        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        if (connectBtn) connectBtn.disabled = true;
        if (disconnectBtn) disconnectBtn.disabled = false;

    } catch (error) {
        console.error('Streaming connection error:', error);
        this.updateConnectionStatus('disconnected');
        this.updateStatus('❌ Connection failed - Please try again');
        this.showStreamingError('Failed to connect to streaming service. Please check your internet connection and API key.');
    }
}

    async disconnectStreaming() {
    try {
        this.updateStatus('🔄 Disconnecting...');

        // Close WebSocket connection
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        // Stop audio processing
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        // Clear any pending timers
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }

        this.isConnected = false;
        this.isSpeaking = false;
        this.updateConnectionStatus('disconnected');
        this.updateSpeakingIndicator(false);
        this.updateStatus('📞 Disconnected');

        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        if (connectBtn) connectBtn.disabled = false;
        if (disconnectBtn) disconnectBtn.disabled = true;

    } catch (error) {
        console.error('Disconnect error:', error);
        this.updateStatus('❌ Disconnect error - Connection may still be active');
    }
}

    async initializeAudioStreaming() {
    try {
        console.log('Initializing audio streaming...');

        // Get user media for streaming
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: this.speechSettings.audioQuality === 'high' ? 48000 : 24000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: this.speechSettings.noiseReduction !== 'off',
                autoGainControl: true
            }
        });

        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 24000 // OpenAI Realtime API prefers 24kHz
        });

        const source = this.audioContext.createMediaStreamSource(stream);

        // Create script processor for real-time audio processing
        const bufferSize = this.getBufferSize();
        this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

        // Set up audio processing
        this.processor.onaudioprocess = (event) => {
            this.processStreamingAudio(event.inputBuffer);
        };

        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        console.log('Audio streaming initialized successfully');
        this.updateDebugOutput('sttOutput', 'Audio streaming initialized successfully');

    } catch (error) {
        console.error('Audio streaming initialization error:', error);
        throw new Error('Failed to initialize audio streaming: ' + error.message);
    }
}

getBufferSize() {
    switch (this.streamingSettings.audioBufferSize) {
        case 'small': return 1024;  // Low latency
        case 'large': return 8192;  // High quality
        default: return 4096;       // Balanced
    }
}

    async connectWebSocket() {
    return new Promise((resolve, reject) => {
        try {
            console.log('Connecting to OpenAI Realtime API...');

            // OpenAI Realtime API WebSocket URL
            const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                console.log('WebSocket connection established');
                this.updateDebugOutput('sttOutput', 'WebSocket connection established');

                // Send authentication and initial configuration
                this.sendWebSocketMessage({
                    type: 'session.update',
                    session: {
                        modalities: ['text', 'audio'],
                        instructions: this.generateSystemPrompt(this.currentPersona, ''),
                        voice: this.ttsSettings.voice,
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        input_audio_transcription: {
                            model: 'whisper-1'
                        },
                        turn_detection: {
                            type: 'server_vad',
                            threshold: this.getVadThreshold(),
                            prefix_padding_ms: 300,
                            silence_duration_ms: this.streamingSettings.responseDelay * 1000
                        },
                        temperature: 0.8,
                        max_response_output_tokens: 4096
                    }
                });

                // Send authorization header
                this.sendWebSocketMessage({
                    type: 'auth',
                    token: this.openaiApiKey
                });

                resolve();
            };

            this.websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(new Error('WebSocket connection failed'));
            };

            this.websocket.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                if (this.isConnected) {
                    this.showStreamingError('Connection lost. Please reconnect.');
                    this.disconnectStreaming();
                }
            };

        } catch (error) {
            reject(error);
        }
    });
}

getVadThreshold() {
    switch (this.streamingSettings.vadSensitivity) {
        case 'low': return 0.3;
        case 'high': return 0.7;
        default: return 0.5; // medium
    }
}

sendWebSocketMessage(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        console.log('Sending WebSocket message:', message.type);
        this.websocket.send(JSON.stringify(message));
    } else {
        console.warn('WebSocket not ready, message not sent:', message.type);
    }
}

processStreamingAudio(inputBuffer) {
    if (!this.isConnected || !this.websocket) return;

    // Convert audio buffer to PCM16 format
    const audioData = this.convertToPCM16(inputBuffer);

    // Send audio data to OpenAI Realtime API
    this.sendWebSocketMessage({
        type: 'input_audio_buffer.append',
        audio: this.arrayBufferToBase64(audioData)
    });

    // Update audio level indicator
    this.updateAudioLevel(inputBuffer);
}

convertToPCM16(inputBuffer) {
    const inputData = inputBuffer.getChannelData(0);
    const outputData = new Int16Array(inputData.length);

    for (let i = 0; i < inputData.length; i++) {
        const sample = Math.max(-1, Math.min(1, inputData[i]));
        outputData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    return outputData.buffer;
}

arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

handleWebSocketMessage(message) {
    console.log('Received WebSocket message:', message.type);

    switch (message.type) {
        case 'session.created':
            console.log('Streaming session created successfully');
            this.updateDebugOutput('systemPrompt', 'Streaming session created successfully');
            break;

        case 'session.updated':
            console.log('Session configuration updated');
            break;

        case 'input_audio_buffer.speech_started':
            console.log('Speech started detected');
            this.isSpeaking = true;
            this.updateSpeakingIndicator(true);
            this.updateStatus('🎤 Listening...');
            break;

        case 'input_audio_buffer.speech_stopped':
            console.log('Speech stopped detected');
            this.isSpeaking = false;
            this.updateSpeakingIndicator(false);
            this.updateStatus('🤔 Processing...');
            break;

        case 'conversation.item.input_audio_transcription.completed':
            const transcript = message.transcript;
            console.log('Transcription completed:', transcript);
            this.addMessage(transcript, 'user');
            this.updateDebugOutput('sttOutput', transcript, 'Transcribed Text:');
            break;

        case 'response.audio.delta':
            // Handle streaming audio response
            this.playStreamingAudio(message.delta);
            break;

        case 'response.audio.done':
            console.log('Audio response completed');
            this.updateStatus('📞 Connected - Ready for next input');
            break;

        case 'response.text.delta':
            // Handle streaming text response
            this.handleStreamingTextResponse(message.delta);
            break;

        case 'response.done':
            console.log('Response completed');
            this.updateStatus('📞 Connected - Ready for next input');
            break;

        case 'error':
            console.error('Streaming API error:', message.error);
            this.showStreamingError(`API Error: ${message.error.message || 'Unknown error'}`);
            break;

        case 'rate_limits.updated':
            console.log('Rate limits updated:', message.rate_limits);
            break;

        default:
            // Log other message types for debugging
            console.log('Unhandled message type:', message.type);
            this.updateDebugOutput('gptResponse', `Received: ${message.type}`);
            break;
    }
}

playStreamingAudio(audioData) {
    try {
        // Convert base64 audio data to audio buffer and play
        const audioBuffer = this.base64ToArrayBuffer(audioData);
        const audioBlob = new Blob([audioBuffer], { type: 'audio/pcm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.play().then(() => {
            this.updateStatus('🔊 Speaking...');
        }).catch(error => {
            console.error('Audio playback error:', error);
        });

        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            this.updateStatus('📞 Connected - Ready for next input');
        };

    } catch (error) {
        console.error('Streaming audio playback error:', error);
    }
}

base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

handleStreamingTextResponse(textDelta) {
    // Accumulate text response for display
    if (!this.currentStreamingResponse) {
        this.currentStreamingResponse = '';
    }
    this.currentStreamingResponse += textDelta;
    this.updateDebugOutput('gptResponse', this.currentStreamingResponse, 'AI Response (streaming):');
}

updateConnectionStatus(status) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;

    statusElement.className = `status-indicator ${status}`;

    switch (status) {
        case 'connecting':
            statusElement.textContent = 'Connecting...';
            break;
        case 'connected':
            statusElement.textContent = 'Connected';
            break;
        case 'disconnected':
            statusElement.textContent = 'Disconnected';
            break;
    }
}

updateSpeakingIndicator(isSpeaking) {
    const indicator = document.getElementById('speakingIndicator');
    if (!indicator) return;

    if (isSpeaking) {
        indicator.textContent = '🎤';
        indicator.classList.add('speaking');
    } else {
        indicator.textContent = '🔇';
        indicator.classList.remove('speaking');
    }
}

updateAudioLevel(inputBuffer) {
    const inputData = inputBuffer.getChannelData(0);
    let sum = 0;

    for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
    }

    const rms = Math.sqrt(sum / inputData.length);
    const level = Math.min(100, Math.max(0, rms * 100 * 10)); // Scale and clamp

    const audioLevelFill = document.getElementById('audioLevel');
    const audioLevelText = document.getElementById('audioLevelText');

    if (audioLevelFill && audioLevelText) {
        audioLevelFill.style.width = level + '%';
        audioLevelText.textContent = Math.round(level) + '%';
    }
}

showStreamingError(message) {
    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.className = 'streaming-error';
    errorDiv.innerHTML = `
            <div class="error-content">
                <h4>⚠️ Streaming Connection Error</h4>
                <p>${message}</p>
                <div class="error-actions">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="dismiss-btn">Dismiss</button>
                    <button onclick="app.toggleStreamingMode(false)" class="switch-batch-btn">Switch to Batch Mode</button>
                </div>
            </div>
        `;

    // Insert error message
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(errorDiv, container.firstChild);
    }

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 10000);
}
}

// Initialize the app
const app = new FinanceBotApp();
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
        this.initializeSystemPrompts();
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

        // System prompts management
        document.querySelectorAll('.prompt-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchPromptTab(e.target.dataset.prompt));
        });
        document.getElementById('savePrompts').addEventListener('click', () => this.saveSystemPrompts());
        document.getElementById('resetPrompts').addEventListener('click', () => this.resetSystemPrompts());
        document.getElementById('testPrompts').addEventListener('click', () => this.testSystemPrompts());
        document.getElementById('addCustomPrompt').addEventListener('click', () => this.addCustomPrompt());
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

    // Speech Recognition Settings
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

    // System Prompts Management Methods
    initializeSystemPrompts() {
        // Load saved prompts into the UI
        document.getElementById('basePersonality').value = this.systemPrompts.basePersonality;
        document.getElementById('financialContext').value = this.systemPrompts.financialContext;
        document.getElementById('responseInstructions').value = this.systemPrompts.responseInstructions;

        // Load custom prompts
        this.loadCustomPrompts();
    }

    switchPromptTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.prompt-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-prompt="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.prompt-section').forEach(section => section.classList.remove('active'));
        document.getElementById(`${tabName}-prompt`).classList.add('active');
    }

    saveSystemPrompts() {
        try {
            // Get values from textareas
            this.systemPrompts.basePersonality = document.getElementById('basePersonality').value;
            this.systemPrompts.financialContext = document.getElementById('financialContext').value;
            this.systemPrompts.responseInstructions = document.getElementById('responseInstructions').value;

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
        document.getElementById('promptPreview').textContent = generatedPrompt;
        this.showPromptMessage('System prompt preview updated below.', 'info');
    }

    addCustomPrompt() {
        const customPromptsList = document.getElementById('customPromptsList');
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
            const name = item.querySelector('.scenario-name').value.trim();
            const prompt = item.querySelector('.custom-prompt-text').value.trim();

            if (name && prompt) {
                customPrompts.push({ name, prompt });
            }
        });

        this.systemPrompts.customPrompts = customPrompts;
    }

    loadCustomPrompts() {
        const customPromptsList = document.getElementById('customPromptsList');
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
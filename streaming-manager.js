/**
 * Streaming Manager
 * Handles OpenAI Realtime API WebSocket connections and real-time audio streaming
 */
class StreamingManager {
    constructor(apiKey, debugCallback = null) {
        this.apiKey = apiKey;
        this.debugCallback = debugCallback;

        // Connection state
        this.websocket = null;
        this.isConnected = false;
        this.isConnecting = false;

        // Audio context and streaming
        this.audioContext = null;
        this.mediaStream = null;
        this.processor = null;
        this.isStreamingAudio = false;
        this.audioWorkletNode = null;
        this.speechStopTimer = null;
        this.isResponseActive = false;
        this.currentTextResponse = '';
        this.hasAudioResponse = false;
        this.audioResponseElement = null;
        this.audioChunks = [];
        this.isPlayingAudio = false;
        this.audioQueue = [];
        this.audioBuffer = [];
        this.minBufferSize = 3; // Wait for at least 3 chunks before starting playback
        this.isBuffering = false;

        // Settings
        this.settings = {
            responseDelay: 1.0,
            vadSensitivity: 'medium',
            audioBufferSize: 'medium',
            connectionQuality: 'auto'
        };

        // Debug logging
        this.debug('StreamingManager initialized');
    }

    debug(message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] StreamingManager: ${message}`;

        console.log(logMessage, data || '');

        if (this.debugCallback) {
            this.debugCallback(logMessage, data);
        }
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.debug('API key updated');
    }

    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this.debug('Settings updated', this.settings);
    }

    /**
     * Connect to OpenAI Realtime API
     */
    async connect() {
        if (this.isConnecting || this.isConnected) {
            this.debug('Already connecting or connected');
            return { success: false, error: 'Already connecting or connected' };
        }

        if (!this.apiKey) {
            this.debug('No API key provided');
            return { success: false, error: 'API key required' };
        }

        try {
            this.isConnecting = true;
            this.debug('Starting connection to OpenAI Realtime API...');

            // OpenAI Realtime API WebSocket URL with latest model
            const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;

            this.debug('Connecting to WebSocket URL:', wsUrl);

            // Try using the Authorization header approach with a workaround
            // Create a custom request to establish the connection with proper headers
            const headers = {
                'Authorization': `Bearer ${this.apiKey}`,
                'OpenAI-Beta': 'realtime=v1'
            };

            // For browser compatibility, we'll try a different approach
            // Create WebSocket with custom headers using a proxy approach
            this.websocket = this.createAuthenticatedWebSocket(wsUrl, headers);

            this.websocket.binaryType = 'arraybuffer';

            // Set up event handlers
            return new Promise((resolve, reject) => {
                const connectionTimeout = setTimeout(() => {
                    this.debug('Connection timeout');
                    this.cleanup();
                    reject(new Error('Connection timeout'));
                }, 10000); // 10 second timeout

                this.websocket.onopen = () => {
                    clearTimeout(connectionTimeout);
                    this.debug('WebSocket connection opened');
                    this.isConnected = true;
                    this.isConnecting = false;

                    // Send initial session configuration
                    this.sendSessionConfig();

                    resolve({ success: true });
                };

                this.websocket.onmessage = (event) => {
                    this.handleMessage(event);
                };

                this.websocket.onerror = (error) => {
                    clearTimeout(connectionTimeout);
                    this.debug('WebSocket error:', error);
                    this.cleanup();
                    reject(new Error(`WebSocket error: ${error.message || 'Unknown error'}`));
                };

                this.websocket.onclose = (event) => {
                    clearTimeout(connectionTimeout);
                    this.debug('WebSocket closed:', { code: event.code, reason: event.reason });
                    this.cleanup();

                    if (this.isConnecting) {
                        reject(new Error(`Connection failed: ${event.reason || 'Unknown reason'}`));
                    }
                };
            });

        } catch (error) {
            this.debug('Connection error:', error);
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

        const config = {
            type: 'session.update',
            session: {
                modalities: ['text', 'audio'],
                instructions: instructions,
                voice: 'alloy',
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
                temperature: 0.8,
                max_response_output_tokens: 200
            }
        };

        this.debug('Sending session config with persona:', currentPersona?.name || 'Unknown');
        this.sendMessage(config);
    }

    /**
     * Create WebSocket with authentication
     * OpenAI Realtime API requires specific authentication method
     */
    createAuthenticatedWebSocket(url, headers) {
        // OpenAI Realtime API uses specific subprotocols for authentication
        // Following the exact spec from OpenAI documentation
        const subprotocols = [
            'realtime',
            // Auth
            `openai-insecure-api-key.${this.apiKey}`,
            // Beta protocol, required
            'openai-beta.realtime-v1'
        ];

        this.debug('Creating WebSocket with subprotocols:', subprotocols.map(p => p.startsWith('openai-insecure-api-key') ? 'openai-insecure-api-key.[HIDDEN]' : p));

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
     * Send message to WebSocket
     */
    sendMessage(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
            this.debug('Message sent:', message.type);
        } else {
            this.debug('Cannot send message - WebSocket not connected');
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.debug('Message received:', message.type, message);

            switch (message.type) {
                case 'session.created':
                    this.debug('Session created successfully');
                    break;

                case 'session.updated':
                    this.debug('Session updated');
                    break;

                case 'error':
                    this.debug('API Error:', message.error);
                    break;

                case 'input_audio_buffer.speech_started':
                    this.debug('Speech started detected');
                    break;

                case 'input_audio_buffer.speech_stopped':
                    this.debug('Speech stopped detected');
                    // Add delay before committing to ensure we have enough audio
                    this.scheduleAudioCommit();
                    break;

                case 'conversation.item.input_audio_transcription.completed':
                    this.debug('Transcription completed:', message.transcript);
                    // Display user message in chat
                    this.displayUserMessage(message.transcript);
                    break;

                case 'response.audio.delta':
                    this.debug('Audio response chunk received');
                    if (message.delta) {
                        this.handleAudioResponse(message.delta);
                        // Also indicate audio response in chat
                        this.indicateAudioResponse();
                    }
                    break;

                case 'response.text.delta':
                    this.debug('Text response chunk:', message.delta);
                    // Accumulate text response
                    this.accumulateTextResponse(message.delta);
                    break;

                case 'response.text.done':
                    this.debug('Text response completed');
                    // Display complete text response
                    this.displayBotTextResponse();
                    break;

                case 'response.output_item.added':
                    this.debug('Response output item added:', message.item);
                    if (message.item && message.item.content) {
                        message.item.content.forEach(content => {
                            if (content.type === 'text' && content.text) {
                                this.debug('Found text content:', content.text);
                                this.displayBotMessage(content.text);
                            }
                        });
                    }
                    break;

                case 'response.content_part.added':
                    this.debug('Response content part added:', message.part);
                    if (message.part && message.part.type === 'text' && message.part.text) {
                        this.debug('Found text part:', message.part.text);
                        this.displayBotMessage(message.part.text);
                    }
                    break;

                case 'response.done':
                    this.debug('Response completed');
                    this.isResponseActive = false;
                    // If we had an audio-only response, show completion
                    this.completeAudioResponse();
                    break;

                case 'response.created':
                    this.debug('Response created');
                    this.isResponseActive = true;
                    break;

                case 'conversation.item.input_audio_transcription.delta':
                    this.debug('Transcription delta:', message.delta);
                    break;

                default:
                    this.debug('Unknown message type:', message.type);
            }

        } catch (error) {
            this.debug('Error parsing message:', error);
        }
    }

    /**
     * Disconnect from the streaming service
     */
    async disconnect() {
        this.debug('Disconnecting...');
        this.cleanup();
        return { success: true };
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.debug('Cleaning up resources...');

        this.isConnected = false;
        this.isConnecting = false;

        // Stop audio streaming
        this.stopAudioStreaming();

        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        this.debug('Cleanup completed');
    }

    /**
     * Start audio streaming
     */
    async startAudioStreaming() {
        if (!this.isConnected) {
            this.debug('Cannot start audio streaming - not connected');
            return { success: false, error: 'Not connected to streaming service' };
        }

        if (this.isStreamingAudio) {
            this.debug('Audio streaming already active');
            return { success: true };
        }

        try {
            this.debug('Starting audio streaming...');

            // Get microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 24000, // OpenAI Realtime API expects 24kHz
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000
            });

            // Create audio source
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Create script processor for audio data
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

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
            this.debug('Audio streaming started successfully');

            return { success: true };

        } catch (error) {
            this.debug('Error starting audio streaming:', error);
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

            // Debug: Log audio chunk info (but not the data itself)
            if (Math.random() < 0.01) { // Log only 1% of chunks to avoid spam
                this.debug(`Audio chunk sent: ${audioData.length} samples, ${pcm16Data.byteLength} bytes`);
            }

        } catch (error) {
            this.debug('Error processing audio chunk:', error);
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
     * Stop audio streaming
     */
    stopAudioStreaming() {
        this.debug('Stopping audio streaming...');

        this.isStreamingAudio = false;
        this.isResponseActive = false;
        this.isPlayingAudio = false;

        // Clear audio queue, buffer, and chunks
        this.audioQueue = [];
        this.audioBuffer = [];
        this.audioChunks = [];
        this.isBuffering = false;

        // Clear any pending timers
        if (this.speechStopTimer) {
            clearTimeout(this.speechStopTimer);
            this.speechStopTimer = null;
        }

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

        this.debug('Audio streaming stopped');
    }

    /**
     * Handle incoming audio response from OpenAI
     */
    handleAudioResponse(audioData) {
        try {
            this.debug('Received audio response chunk from OpenAI');

            // Add directly to queue for immediate processing
            this.audioQueue.push({ type: 'base64', data: audioData });

            // Start playing if not already playing
            if (!this.isPlayingAudio) {
                this.debug('Starting audio playback immediately');
                this.playQueuedAudio();
            } else {
                this.debug(`Added chunk to queue, ${this.audioQueue.length} chunks queued`);
            }

        } catch (error) {
            this.debug('Error handling audio response:', error);
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
        this.debug(`Starting playback with ${this.audioQueue.length} buffered chunks`);

        // Start continuous playback
        this.playQueuedAudio();
    }

    /**
     * Play queued audio chunks sequentially
     */
    async playQueuedAudio() {
        if (this.isPlayingAudio) {
            this.debug('Audio already playing, skipping');
            return;
        }

        if (this.audioQueue.length === 0) {
            this.debug('No audio chunks in queue');
            return;
        }

        this.isPlayingAudio = true;
        this.debug(`Starting queued audio playback with ${this.audioQueue.length} chunks`);

        try {
            let chunkIndex = 0;
            while (this.audioQueue.length > 0) {
                const audioItem = this.audioQueue.shift();
                this.debug(`Playing audio chunk ${chunkIndex + 1}`);

                try {
                    // Try alternative method first, then fall back to PCM16
                    await this.playAudioAlternative(audioItem.data);
                    chunkIndex++;
                    this.debug(`Chunk ${chunkIndex} completed successfully`);
                } catch (chunkError) {
                    this.debug(`Error playing chunk ${chunkIndex + 1}:`, chunkError);
                    // Continue with next chunk instead of stopping
                }

                // Small delay to ensure smooth playback
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        } catch (error) {
            this.debug('Error in queued audio playback:', error);
        } finally {
            // Check if there are more chunks to play
            if (this.audioQueue.length > 0) {
                this.debug(`Continuing playback with ${this.audioQueue.length} more chunks`);
                // Continue playing immediately
                setTimeout(() => this.playQueuedAudio(), 10);
            } else {
                this.isPlayingAudio = false;
                this.debug('All audio chunks played');
            }
        }
    }

    /**
     * Play PCM16 audio response
     */
    async playPCM16Audio(pcm16Buffer) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Debug: Log buffer info
            this.debug(`Playing audio: ${pcm16Buffer.byteLength} bytes, ${pcm16Buffer.byteLength / 2} samples`);

            // Convert PCM16 to AudioBuffer
            // Try different sample rates to see which sounds correct
            const possibleSampleRates = [24000, 16000, 22050, 44100];
            const sampleRate = possibleSampleRates[0]; // Start with 24kHz as documented
            const numSamples = pcm16Buffer.byteLength / 2; // 16-bit = 2 bytes per sample

            if (numSamples === 0) {
                this.debug('Empty audio buffer, skipping playback');
                return Promise.resolve();
            }

            this.debug(`Creating audio buffer: ${numSamples} samples at ${sampleRate}Hz`);

            const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
            const channelData = audioBuffer.getChannelData(0);

            // Convert PCM16 to Float32 with proper endianness
            const view = new DataView(pcm16Buffer);
            for (let i = 0; i < numSamples; i++) {
                const sample = view.getInt16(i * 2, true); // little-endian
                channelData[i] = sample / 32768.0; // Convert to -1.0 to 1.0 range
            }

            // Create audio source with gain control
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();

            source.buffer = audioBuffer;
            gainNode.gain.value = 0.8; // Slightly reduce volume to prevent clipping

            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // Return a promise that resolves when audio finishes
            return new Promise((resolve, reject) => {
                source.onended = () => {
                    this.debug(`PCM16 audio chunk completed: ${numSamples} samples`);
                    resolve();
                };

                source.onerror = (error) => {
                    this.debug('Error during audio playback:', error);
                    reject(error);
                };

                source.start();
                this.debug(`Playing PCM16 audio: ${numSamples} samples at ${sampleRate}Hz`);
            });

        } catch (error) {
            this.debug('Error playing PCM16 audio response:', error);
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
            this.debug('Response already active, skipping new request');
            return;
        }

        this.debug('Committing audio buffer and requesting response...');

        // Commit the input audio buffer
        this.sendMessage({
            type: 'input_audio_buffer.commit'
        });

        // Create a response (only if no active response)
        this.sendMessage({
            type: 'response.create',
            response: {
                modalities: ['text', 'audio'],
                instructions: 'Please respond to the user\'s question about their financial account.'
            }
        });

        this.isResponseActive = true;
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
            this.debug('Error updating audio level:', error);
        }
    }

    /**
     * Alternative audio playback method using Web Audio API decoding
     */
    async playAudioAlternative(audioData) {
        try {
            this.debug('Trying alternative audio playback method');

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
                this.debug('Alternative audio playback successful');
                return;
            } catch (decodeError) {
                this.debug('Standard audio decode failed, using PCM16 method');
                // Fall back to PCM16 method
                return this.playPCM16Audio(bytes.buffer);
            }

        } catch (error) {
            this.debug('Alternative audio playback failed:', error);
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
                this.debug('User message displayed in chat');
            }
        } catch (error) {
            this.debug('Error displaying user message:', error);
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
                this.debug('Bot message displayed in chat:', text);

                // Also update debug panel
                this.updateDebugPanel('gptResponse', text);
            }
        } catch (error) {
            this.debug('Error displaying bot message:', error);
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
            this.debug('Error displaying bot text response:', error);
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
                    this.debug('Audio response indicator added to chat');
                }
            } catch (error) {
                this.debug('Error indicating audio response:', error);
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
                        this.debug('Audio response completed in chat');
                    }
                }, 1000);
            } catch (error) {
                this.debug('Error completing audio response:', error);
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
            if (window.app && window.app.currentPersona && window.app.personas) {
                const personaId = window.app.currentPersona;
                const persona = window.app.personas[personaId];
                this.debug('Retrieved persona info:', persona?.name || 'Unknown');
                return persona;
            }
            this.debug('No persona information available');
            return null;
        } catch (error) {
            this.debug('Error getting persona info:', error);
            return null;
        }
    }

    /**
     * Generate instructions with persona context
     */
    generateInstructions(persona) {
        let instructions = `You are a helpful, professional, and friendly financial services AI assistant. You should be empathetic, clear in your communication, and always prioritize customer satisfaction. Speak in a conversational tone while maintaining professionalism.

Keep responses conversational and concise (suitable for voice). Use natural speech patterns with contractions (I'll, you're, we'll). Sound human and empathetic, not robotic. Use clear, simple language avoiding jargon. Always end with asking if there's anything else you can help with. Maximum response length: 2-3 sentences for voice clarity.`;

        if (persona) {
            instructions += `\n\nCURRENT CUSTOMER INFORMATION:
- Name: ${persona.name}
- Account Balance: $${persona.balance.toFixed(2)}
- Card ending in: ${persona.cardLast4}
- Account Type: ${persona.accountType}
- Recent Transactions: ${persona.recentTransactions.map(t =>
                `${t.date}: ${t.amount >= 0 ? '+' : ''}$${t.amount.toFixed(2)} - ${t.description}`
            ).join(', ')}

When the customer asks about their account, balance, transactions, or card, use this specific information. Address them by name when appropriate.`;
        }

        return instructions;
    }

    /**
     * Flush any remaining audio buffer when response is complete
     */
    flushAudioBuffer() {
        if (this.audioBuffer.length > 0) {
            this.debug(`Flushing ${this.audioBuffer.length} remaining audio chunks`);

            // If not currently playing, start playback with remaining chunks
            if (!this.isPlayingAudio) {
                this.startBufferedPlayback();
            } else {
                // If already playing, the chunks will be picked up by the continuous playback
                this.debug('Audio already playing, buffered chunks will be processed automatically');
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
            this.debug('Error updating debug panel:', error);
        }
    }

    /**
     * Get audio streaming status
     */
    getAudioStatus() {
        return this.isStreamingAudio ? 'streaming' : 'stopped';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingManager;
}
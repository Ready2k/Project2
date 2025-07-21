/**
 * Streaming Manager
 * Handles OpenAI Realtime API WebSocket connections and real-time audio streaming
 */
class StreamingManager {
    constructor(apiKey, debugCallback = null) {
        this.apiKey = apiKey;
        this.debugCallback = debugCallback;
        
        // Initialize debug logger for this module
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('StreamingManager') : {
            log: () => {}, warn: () => {}, error: () => {}, info: () => {}
        };

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

        // Debug logging
        this.debug.log('StreamingManager initialized');
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

            // OpenAI Realtime API WebSocket URL with latest model
            const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;

            this.debug.log('Connecting to WebSocket URL:', wsUrl);

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
                    this.debug.log('Connection timeout');
                    this.cleanup();
                    reject(new Error('Connection timeout'));
                }, 10000); // 10 second timeout

                this.websocket.onopen = () => {
                    clearTimeout(connectionTimeout);
                    this.debug.log('WebSocket connection opened');
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
                    this.debug.error('WebSocket error:', error);
                    this.cleanup();
                    reject(new Error(`WebSocket error: ${error.message || 'Unknown error'}`));
                };

                this.websocket.onclose = (event) => {
                    clearTimeout(connectionTimeout);
                    this.debug.log('WebSocket closed:', { code: event.code, reason: event.reason });
                    this.cleanup();

                    if (this.isConnecting) {
                        reject(new Error(`Connection failed: ${event.reason || 'Unknown reason'}`));
                    }
                };
            });

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

        const config = {
            type: 'session.update',
            session: {
                modalities: ['text', 'audio'],
                instructions: instructions,
                voice: 'shimmer', // More expressive voice
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
                temperature: 0.9, // More expressive responses
                max_response_output_tokens: 500 // Allow longer responses
            }
        };

        this.debug.log('Sending session config with persona:', currentPersona?.name || 'Unknown');
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
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.debug.log('Message received:', message.type, message);

            switch (message.type) {
                case 'session.created':
                    this.debug.log('Session created successfully');
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
                    // Display user message in chat
                    if (message.transcript) {
                        this.displayUserMessage(message.transcript);
                    } else if (this.currentUserTranscript) {
                        // Use accumulated transcript from deltas
                        this.displayUserMessage(this.currentUserTranscript);
                        this.currentUserTranscript = '';
                    } else {
                        this.debug.log('Warning: No transcript in transcription completed message');
                    }
                    break;

                case 'response.audio.delta':
                    this.debug.log('Audio response chunk received');
                    if (message.delta) {
                        this.handleAudioResponse(message.delta);
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
     * Disconnect from the streaming service
     */
    async disconnect() {
        this.debug.log('Disconnecting...');
        this.cleanup();
        return { success: true };
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.debug.log('Cleaning up resources...');

        this.isConnected = false;
        this.isConnecting = false;

        // Stop audio streaming
        this.stopAudioStreaming();

        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        this.debug.log('Cleanup completed');
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

        this.debug.log('Audio streaming stopped');
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
     * Generate instructions with persona context
     */
    generateInstructions(persona) {
        try {
            // Use the SystemPromptsManager from the main app if available
            if (window.app && window.app.systemPromptsManager) {
                this.debug.log('Using SystemPromptsManager for streaming instructions');
                return window.app.systemPromptsManager.generateSystemPrompt(persona, 'streaming');
            }
        } catch (error) {
            this.debug.log('Error using SystemPromptsManager, falling back to hardcoded:', error);
        }

        // Fallback to hardcoded instructions if SystemPromptsManager is not available
        this.debug.log('Using fallback hardcoded instructions for streaming');
        let instructions = `You are a helpful, professional, and friendly financial services AI assistant. You should be empathetic, clear in your communication, and always prioritize customer satisfaction. Speak in a conversational tone while maintaining professionalism.

Keep responses conversational and concise (suitable for voice). Use natural speech patterns with contractions (I'll, you're, we'll). Sound human and empathetic, not robotic. Use clear, simple language avoiding jargon. Always end with asking if there's anything else you can help with. Maximum response length: 2-3 sentences for voice clarity.`;

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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingManager;
}
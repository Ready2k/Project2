/**
 * Modern Audio Streaming Manager
 * 
 * This replaces the deprecated ScriptProcessorNode with AudioWorkletNode
 * for better performance and reduced audio glitches in streaming audio.
 */

class ModernAudioStreaming {
    constructor(streamingManager) {
        this.streamingManager = streamingManager;
        this.debug = streamingManager.debug;
        
        // Audio context and worklet
        this.audioContext = null;
        this.audioWorkletNode = null;
        this.mediaStream = null;
        this.sourceNode = null;
        
        // State
        this.isStreaming = false;
        this.isWorkletLoaded = false;
        
        // Configuration
        this.config = {
            bufferSize: 4096,
            sampleRate: 16000,
            channelCount: 1
        };
        
        this.debug.info('ModernAudioStreaming initialized');
    }
    
    /**
     * Initialize the audio worklet and start streaming
     * @param {MediaStream} mediaStream - Microphone stream
     * @returns {Promise<boolean>} - Success status
     */
    async startAudioStreaming(mediaStream) {
        try {
            this.debug.info('Starting modern audio streaming...');
            
            // Store the media stream
            this.mediaStream = mediaStream;
            
            // Create audio context if not exists
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: this.config.sampleRate
                });
            }
            
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Load the audio worklet if not already loaded
            if (!this.isWorkletLoaded) {
                await this.loadAudioWorklet();
            }
            
            // Create source node from media stream
            this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream);
            
            // Create audio worklet node
            this.audioWorkletNode = new AudioWorkletNode(
                this.audioContext, 
                'streaming-audio-processor',
                {
                    numberOfInputs: 1,
                    numberOfOutputs: 0, // We don't need output, just processing
                    channelCount: this.config.channelCount,
                    processorOptions: {
                        bufferSize: this.config.bufferSize,
                        sampleRate: this.config.sampleRate
                    }
                }
            );
            
            // Set up message handling from the worklet
            this.audioWorkletNode.port.onmessage = (event) => {
                this.handleWorkletMessage(event.data);
            };
            
            // Connect the audio graph
            this.sourceNode.connect(this.audioWorkletNode);
            
            // Configure the worklet
            this.audioWorkletNode.port.postMessage({
                type: 'configure',
                data: {
                    bufferSize: this.config.bufferSize,
                    sampleRate: this.config.sampleRate
                }
            });
            
            this.isStreaming = true;
            this.debug.info('Modern audio streaming started successfully');
            
            return true;
            
        } catch (error) {
            this.debug.error('Failed to start modern audio streaming:', error);
            await this.stopAudioStreaming();
            return false;
        }
    }
    
    /**
     * Load the audio worklet processor
     * @returns {Promise<void>}
     */
    async loadAudioWorklet() {
        try {
            this.debug.info('Loading audio worklet processor...');
            
            // Add the worklet module
            await this.audioContext.audioWorklet.addModule('audio-worklet-processor.js');
            
            this.isWorkletLoaded = true;
            this.debug.info('Audio worklet processor loaded successfully');
            
        } catch (error) {
            this.debug.error('Failed to load audio worklet processor:', error);
            throw error;
        }
    }
    
    /**
     * Handle messages from the audio worklet
     * @param {Object} message - Message from worklet
     */
    handleWorkletMessage(message) {
        const { type, data } = message;
        
        switch (type) {
            case 'audiodata':
                this.processAudioData(data);
                break;
            default:
                this.debug.warn('Unknown worklet message type:', type);
        }
    }
    
    /**
     * Process audio data received from the worklet
     * @param {Int16Array} pcm16Data - PCM16 audio data
     */
    processAudioData(pcm16Data) {
        try {
            // Convert to the format expected by the streaming manager
            const audioBuffer = new ArrayBuffer(pcm16Data.length * 2);
            const view = new DataView(audioBuffer);
            
            // Write PCM16 data to buffer
            for (let i = 0; i < pcm16Data.length; i++) {
                view.setInt16(i * 2, pcm16Data[i], true); // little-endian
            }
            
            // Send to streaming manager (same interface as the old ScriptProcessor)
            if (this.streamingManager && this.streamingManager.websocket) {
                const message = {
                    type: 'input_audio_buffer.append',
                    audio: this.arrayBufferToBase64(audioBuffer)
                };
                
                this.streamingManager.websocket.send(JSON.stringify(message));
            }
            
        } catch (error) {
            this.debug.error('Error processing audio data:', error);
        }
    }
    
    /**
     * Convert ArrayBuffer to base64 string
     * @param {ArrayBuffer} buffer - Audio buffer
     * @returns {string} - Base64 encoded string
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
     * Stop audio streaming and cleanup resources
     * @returns {Promise<void>}
     */
    async stopAudioStreaming() {
        try {
            this.debug.info('Stopping modern audio streaming...');
            
            this.isStreaming = false;
            
            // Disconnect audio nodes
            if (this.sourceNode) {
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }
            
            if (this.audioWorkletNode) {
                this.audioWorkletNode.disconnect();
                this.audioWorkletNode = null;
            }
            
            // Close audio context
            if (this.audioContext && this.audioContext.state !== 'closed') {
                await this.audioContext.close();
                this.audioContext = null;
                this.isWorkletLoaded = false;
            }
            
            this.debug.info('Modern audio streaming stopped');
            
        } catch (error) {
            this.debug.error('Error stopping modern audio streaming:', error);
        }
    }
    
    /**
     * Check if modern audio streaming is supported
     * @returns {boolean} - Support status
     */
    static isSupported() {
        try {
            // Check if AudioContext is available
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                return false;
            }
            
            // Check if AudioWorkletNode is available
            if (!window.AudioWorkletNode) {
                return false;
            }
            
            // Check if audioWorklet is available on AudioContext prototype
            // We need to be careful about how we access this to avoid "Illegal invocation"
            const hasAudioWorklet = 'audioWorklet' in AudioContextClass.prototype;
            
            return hasAudioWorklet;
            
        } catch (error) {
            console.warn('Error checking AudioWorklet support:', error);
            return false;
        }
    }
    
    /**
     * Get current streaming status
     * @returns {Object} - Status information
     */
    getStatus() {
        return {
            isStreaming: this.isStreaming,
            isWorkletLoaded: this.isWorkletLoaded,
            hasAudioContext: !!this.audioContext,
            audioContextState: this.audioContext?.state || 'none',
            hasWorkletNode: !!this.audioWorkletNode,
            hasSourceNode: !!this.sourceNode,
            config: { ...this.config }
        };
    }
    
    /**
     * Update configuration
     * @param {Object} newConfig - New configuration options
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // If worklet is active, send new config
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({
                type: 'configure',
                data: this.config
            });
        }
        
        this.debug.info('Audio streaming config updated:', this.config);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModernAudioStreaming;
} else {
    window.ModernAudioStreaming = ModernAudioStreaming;
}
/**
 * AudioWorklet Processor for Real-time Audio Streaming
 * 
 * This replaces the deprecated ScriptProcessorNode with the modern AudioWorkletNode
 * for better performance and reduced audio glitches.
 */

class StreamingAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // Buffer for collecting audio data
        this.audioBuffer = [];
        this.bufferSize = 4096; // Same as the old ScriptProcessor
        this.sampleRate = 16000; // Target sample rate for streaming
        
        // Listen for messages from the main thread
        this.port.onmessage = (event) => {
            const { type, data } = event.data;
            
            switch (type) {
                case 'configure':
                    this.bufferSize = data.bufferSize || 4096;
                    this.sampleRate = data.sampleRate || 16000;
                    break;
                case 'reset':
                    this.audioBuffer = [];
                    break;
            }
        };
    }
    
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        
        // If we have input audio
        if (input && input.length > 0) {
            const inputChannel = input[0]; // Get first channel
            
            if (inputChannel && inputChannel.length > 0) {
                // Add samples to our buffer
                for (let i = 0; i < inputChannel.length; i++) {
                    this.audioBuffer.push(inputChannel[i]);
                }
                
                // When we have enough samples, send them to the main thread
                if (this.audioBuffer.length >= this.bufferSize) {
                    // Convert to the format expected by the streaming API
                    const audioData = new Float32Array(this.audioBuffer.splice(0, this.bufferSize));
                    
                    // Convert to PCM16 format (16-bit signed integers)
                    const pcm16Data = this.convertToPCM16(audioData);
                    
                    // Send to main thread
                    this.port.postMessage({
                        type: 'audiodata',
                        data: pcm16Data,
                        sampleRate: this.sampleRate,
                        timestamp: currentTime
                    });
                }
            }
        }
        
        // Keep the processor alive
        return true;
    }
    
    /**
     * Convert Float32 audio data to PCM16 format
     * @param {Float32Array} float32Data - Input audio data
     * @returns {Int16Array} - PCM16 formatted data
     */
    convertToPCM16(float32Data) {
        const pcm16Data = new Int16Array(float32Data.length);
        
        for (let i = 0; i < float32Data.length; i++) {
            // Clamp the value to [-1, 1] range
            const clamped = Math.max(-1, Math.min(1, float32Data[i]));
            
            // Convert to 16-bit signed integer
            pcm16Data[i] = Math.round(clamped * 32767);
        }
        
        return pcm16Data;
    }
    
    /**
     * Resample audio data to target sample rate
     * @param {Float32Array} inputData - Input audio data
     * @param {number} inputSampleRate - Input sample rate
     * @param {number} outputSampleRate - Target sample rate
     * @returns {Float32Array} - Resampled audio data
     */
    resampleAudio(inputData, inputSampleRate, outputSampleRate) {
        if (inputSampleRate === outputSampleRate) {
            return inputData;
        }
        
        const ratio = inputSampleRate / outputSampleRate;
        const outputLength = Math.round(inputData.length / ratio);
        const outputData = new Float32Array(outputLength);
        
        for (let i = 0; i < outputLength; i++) {
            const inputIndex = i * ratio;
            const inputIndexFloor = Math.floor(inputIndex);
            const inputIndexCeil = Math.min(inputIndexFloor + 1, inputData.length - 1);
            const fraction = inputIndex - inputIndexFloor;
            
            // Linear interpolation
            outputData[i] = inputData[inputIndexFloor] * (1 - fraction) + 
                           inputData[inputIndexCeil] * fraction;
        }
        
        return outputData;
    }
}

// Register the processor
registerProcessor('streaming-audio-processor', StreamingAudioProcessor);
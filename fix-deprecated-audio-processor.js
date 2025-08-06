/**
 * Fix Deprecated Audio Processor
 * 
 * This script replaces the deprecated ScriptProcessorNode with modern AudioWorkletNode
 * to eliminate the deprecation warning and improve audio performance.
 */

console.log('🔧 Loading deprecated audio processor fix...');

// Function to patch the streaming manager with modern audio processing
function fixDeprecatedAudioProcessor() {
    console.log('🔧 Applying deprecated audio processor fix...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.streamingManager) {
        console.error('❌ StreamingManager not available');
        return false;
    }
    
    const streamingManager = speechApp.streamingManager;
    
    // Check if modern audio streaming is supported
    if (!ModernAudioStreaming.isSupported()) {
        console.warn('⚠️ AudioWorkletNode not supported, keeping legacy implementation');
        return false;
    }
    
    // Create modern audio streaming instance
    if (!streamingManager.modernAudioStreaming) {
        streamingManager.modernAudioStreaming = new ModernAudioStreaming(streamingManager);
        console.log('✅ ModernAudioStreaming instance created');
    }
    
    // Store the original startAudioStreaming method
    if (!streamingManager._originalStartAudioStreaming) {
        streamingManager._originalStartAudioStreaming = streamingManager.startAudioStreaming.bind(streamingManager);
    }
    
    // Replace the startAudioStreaming method with modern implementation
    streamingManager.startAudioStreaming = async function(mediaStream) {
        console.log('🎤 Using modern AudioWorklet-based audio streaming');
        
        try {
            // Try modern implementation first
            const success = await this.modernAudioStreaming.startAudioStreaming(mediaStream);
            
            if (success) {
                this.isStreamingAudio = true;
                this.mediaStream = mediaStream;
                console.log('✅ Modern audio streaming started successfully');
                return true;
            } else {
                throw new Error('Modern audio streaming failed');
            }
            
        } catch (error) {
            console.warn('⚠️ Modern audio streaming failed, falling back to legacy:', error.message);
            
            // Fallback to original implementation
            return await this._originalStartAudioStreaming(mediaStream);
        }
    };
    
    // Store the original stopAudioStreaming method
    if (!streamingManager._originalStopAudioStreaming) {
        streamingManager._originalStopAudioStreaming = streamingManager.stopAudioStreaming?.bind(streamingManager);
    }
    
    // Replace the stopAudioStreaming method
    streamingManager.stopAudioStreaming = async function() {
        console.log('🛑 Stopping modern audio streaming');
        
        try {
            if (this.modernAudioStreaming) {
                await this.modernAudioStreaming.stopAudioStreaming();
            }
            
            // Also call original cleanup if it exists
            if (this._originalStopAudioStreaming) {
                await this._originalStopAudioStreaming();
            }
            
            this.isStreamingAudio = false;
            console.log('✅ Modern audio streaming stopped');
            
        } catch (error) {
            console.error('❌ Error stopping modern audio streaming:', error);
        }
    };
    
    console.log('✅ Deprecated audio processor fix applied');
    console.log('💡 ScriptProcessorNode replaced with AudioWorkletNode');
    
    return true;
}

// Function to check if the fix is needed
function checkAudioProcessorStatus() {
    console.log('🔍 Checking audio processor status...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.streamingManager) {
        console.log('❌ StreamingManager not available');
        return { available: false };
    }
    
    const status = {
        hasStreamingManager: true,
        hasModernAudioStreaming: !!speechApp.streamingManager.modernAudioStreaming,
        isAudioWorkletSupported: ModernAudioStreaming.isSupported(),
        isStreamingAudio: speechApp.streamingManager.isStreamingAudio || false,
        hasOriginalMethods: !!(speechApp.streamingManager._originalStartAudioStreaming),
        modernStreamingStatus: speechApp.streamingManager.modernAudioStreaming?.getStatus() || null
    };
    
    console.log('🔍 Audio processor status:', status);
    
    return status;
}

// Function to test the modern audio streaming
function testModernAudioStreaming() {
    console.log('🧪 Testing modern audio streaming...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.streamingManager) {
        console.error('❌ StreamingManager not available');
        return;
    }
    
    if (!speechApp.streamingManager.modernAudioStreaming) {
        console.error('❌ ModernAudioStreaming not initialized');
        return;
    }
    
    const status = speechApp.streamingManager.modernAudioStreaming.getStatus();
    console.log('🧪 Modern audio streaming test results:', status);
    
    if (ModernAudioStreaming.isSupported()) {
        console.log('✅ AudioWorkletNode is supported');
        console.log('✅ Modern audio streaming is available');
    } else {
        console.log('❌ AudioWorkletNode is not supported in this browser');
    }
    
    return status;
}

// Function to revert to legacy audio processing (if needed)
function revertToLegacyAudioProcessing() {
    console.log('🔄 Reverting to legacy audio processing...');
    
    const speechApp = window.speechApp || window.speechToSpeechApp;
    if (!speechApp || !speechApp.streamingManager) {
        console.error('❌ StreamingManager not available');
        return false;
    }
    
    const streamingManager = speechApp.streamingManager;
    
    // Restore original methods if they exist
    if (streamingManager._originalStartAudioStreaming) {
        streamingManager.startAudioStreaming = streamingManager._originalStartAudioStreaming;
        delete streamingManager._originalStartAudioStreaming;
    }
    
    if (streamingManager._originalStopAudioStreaming) {
        streamingManager.stopAudioStreaming = streamingManager._originalStopAudioStreaming;
        delete streamingManager._originalStopAudioStreaming;
    }
    
    // Clean up modern audio streaming
    if (streamingManager.modernAudioStreaming) {
        streamingManager.modernAudioStreaming.stopAudioStreaming();
        delete streamingManager.modernAudioStreaming;
    }
    
    console.log('✅ Reverted to legacy audio processing');
    return true;
}

// Auto-apply fix when script loads
if (typeof window !== 'undefined') {
    setTimeout(() => {
        console.log('🔧 Deprecated audio processor fix ready');
        console.log('Available functions:');
        console.log('- fixDeprecatedAudioProcessor() - Apply the fix');
        console.log('- checkAudioProcessorStatus() - Check current status');
        console.log('- testModernAudioStreaming() - Test modern implementation');
        console.log('- revertToLegacyAudioProcessing() - Revert to legacy (if needed)');
        
        // Auto-check status
        const status = checkAudioProcessorStatus();
        
        if (status.available && status.isAudioWorkletSupported && !status.hasModernAudioStreaming) {
            console.log('💡 Modern audio streaming is supported but not enabled');
            console.log('💡 Run fixDeprecatedAudioProcessor() to eliminate the deprecation warning');
        }
    }, 2000);
}

// Export functions globally
if (typeof window !== 'undefined') {
    window.fixDeprecatedAudioProcessor = fixDeprecatedAudioProcessor;
    window.checkAudioProcessorStatus = checkAudioProcessorStatus;
    window.testModernAudioStreaming = testModernAudioStreaming;
    window.revertToLegacyAudioProcessing = revertToLegacyAudioProcessing;
}

console.log('✅ Deprecated audio processor fix loaded');
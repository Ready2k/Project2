/**
 * Suppress verbose audio logging messages from StreamingManager
 * This reduces console noise while keeping important messages
 */

console.log('🔇 Loading audio log suppression...');

// Wait for StreamingManager to be available
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        suppressAudioLogs();
    }, 1000);
});

function suppressAudioLogs() {
    console.log('🔇 Applying audio log suppression...');
    
    // Get the StreamingManager instance
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (!streamingManager || !streamingManager.debug) {
        console.log('❌ StreamingManager debug not available for suppression');
        return;
    }
    
    // Store the original debug.log method
    const originalDebugLog = streamingManager.debug.log;
    
    // List of audio-related messages to suppress
    const suppressedMessages = [
        'High-quality PCM16 audio completed',
        'Playing audio chunk',
        'Trying alternative audio playback method',
        'Standard audio decode failed, using PCM16 method',
        'Playing audio:',
        'Creating audio buffer:',
        'Playing enhanced PCM16 audio:',
        'Audio response chunk received',
        'Chunk',
        'completed successfully',
        'Message received: response.audio.delta',
        'Message sent: input_audio_buffer.append',
        'Received audio response chunk from OpenAI',
        'Received audio chunk',
        'Added chunk to queue',
        'chunks queued',
        'Message received: response.audio_transcript.delta',
        'Audio transcript delta:',
        // Additional messages you're seeing
        'Posting PCM16 buffer to worklet',
        'Audio chunk #',
        'received'
    ];
    
    // Override the debug.log method
    streamingManager.debug.log = function(message, data) {
        // Check if this message should be suppressed
        const shouldSuppress = suppressedMessages.some(suppressedMsg => 
            typeof message === 'string' && message.includes(suppressedMsg)
        );
        
        // Only log if not suppressed
        if (!shouldSuppress) {
            originalDebugLog.call(this, message, data);
        }
    };
    
    console.log('✅ Audio log suppression applied to StreamingManager');
    console.log(`🔇 Suppressing ${suppressedMessages.length} types of audio messages`);
}

// Also suppress at the global debug manager level if needed
function suppressGlobalAudioLogs() {
    if (window.debugManager && window.debugManager.createModuleLogger) {
        const originalCreateModuleLogger = window.debugManager.createModuleLogger;
        
        window.debugManager.createModuleLogger = function(moduleName) {
            const logger = originalCreateModuleLogger.call(this, moduleName);
            
            if (moduleName === 'StreamingManager') {
                const originalLog = logger.log;
                
                logger.log = function(message, data) {
                    const suppressedMessages = [
                        'High-quality PCM16 audio completed',
                        'Playing audio chunk',
                        'Trying alternative audio playback method',
                        'Standard audio decode failed',
                        'Playing audio:',
                        'Creating audio buffer:',
                        'Playing enhanced PCM16 audio:',
                        'Audio response chunk received',
                        'completed successfully',
                        'Message received: response.audio.delta',
                        'Message sent: input_audio_buffer.append',
                        'Received audio response chunk from OpenAI',
                        'Received audio chunk',
                        'Added chunk to queue',
                        'chunks queued',
                        'Message received: response.audio_transcript.delta',
                        'Audio transcript delta:',
                        // Additional messages you're seeing
                        'Posting PCM16 buffer to worklet',
                        'Audio chunk #',
                        'received'
                    ];
                    
                    const shouldSuppress = suppressedMessages.some(suppressedMsg => 
                        typeof message === 'string' && message.includes(suppressedMsg)
                    );
                    
                    if (!shouldSuppress) {
                        originalLog.call(this, message, data);
                    }
                };
            }
            
            return logger;
        };
        
        console.log('✅ Global debug manager audio suppression applied');
    }
}

// Apply global suppression early
suppressGlobalAudioLogs();

// Apply specific suppression after delay
setTimeout(() => {
    suppressAudioLogs();
}, 2000);

// Make function available globally
window.suppressAudioLogs = suppressAudioLogs;

console.log('🔇 Audio log suppression loaded');
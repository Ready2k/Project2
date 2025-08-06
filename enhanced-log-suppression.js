/**
 * Enhanced Log Suppression
 * 
 * This script provides more aggressive suppression of verbose streaming logs
 * by intercepting console methods directly.
 */

console.log('🔇 Loading enhanced log suppression...');

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

// Messages to suppress (including the ones you're seeing)
const suppressedPatterns = [
    // Exact matches
    'Message sent: input_audio_buffer.append',
    'Posting PCM16 buffer to worklet',
    'Message received: response.audio.delta',
    
    // Pattern matches
    /StreamingManager: Message sent: input_audio_buffer\.append/,
    /StreamingManager: Posting PCM16 buffer to worklet/,
    /StreamingManager: Message received: response\.audio\.delta/,
    /StreamingManager: Audio chunk #\d+ received/,
    /Audio chunk #\d+ received/,
    /PCM16 buffer to worklet/,
    /response\.audio\.delta/,
    /input_audio_buffer\.append/,
    
    // Other verbose streaming messages
    /High-quality PCM16 audio completed/,
    /Playing audio chunk/,
    /Trying alternative audio playback method/,
    /Standard audio decode failed/,
    /Playing audio:/,
    /Creating audio buffer:/,
    /Playing enhanced PCM16 audio:/,
    /Audio response chunk received/,
    /Received audio response chunk from OpenAI/,
    /Received audio chunk/,
    /Added chunk to queue/,
    /chunks queued/,
    /Audio transcript delta:/
];

// Function to check if a message should be suppressed
function shouldSuppressMessage(message) {
    if (typeof message !== 'string') {
        return false;
    }
    
    return suppressedPatterns.some(pattern => {
        if (typeof pattern === 'string') {
            return message.includes(pattern);
        } else if (pattern instanceof RegExp) {
            return pattern.test(message);
        }
        return false;
    });
}

// Override console.log
console.log = function(...args) {
    // Check if any of the arguments should be suppressed
    const shouldSuppress = args.some(arg => shouldSuppressMessage(String(arg)));
    
    if (!shouldSuppress) {
        originalConsoleLog.apply(console, args);
    }
};

// Override console.info
console.info = function(...args) {
    const shouldSuppress = args.some(arg => shouldSuppressMessage(String(arg)));
    
    if (!shouldSuppress) {
        originalConsoleInfo.apply(console, args);
    }
};

// Override console.debug
console.debug = function(...args) {
    const shouldSuppress = args.some(arg => shouldSuppressMessage(String(arg)));
    
    if (!shouldSuppress) {
        originalConsoleDebug.apply(console, args);
    }
};

// Function to temporarily disable suppression for debugging
function disableLogSuppression() {
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.debug = originalConsoleDebug;
    console.log('🔊 Log suppression disabled');
}

// Function to re-enable suppression
function enableLogSuppression() {
    // Re-apply the overrides (this function recreates the closures)
    console.log = function(...args) {
        const shouldSuppress = args.some(arg => shouldSuppressMessage(String(arg)));
        if (!shouldSuppress) {
            originalConsoleLog.apply(console, args);
        }
    };
    
    console.info = function(...args) {
        const shouldSuppress = args.some(arg => shouldSuppressMessage(String(arg)));
        if (!shouldSuppress) {
            originalConsoleInfo.apply(console, args);
        }
    };
    
    console.debug = function(...args) {
        const shouldSuppress = args.some(arg => shouldSuppressMessage(String(arg)));
        if (!shouldSuppress) {
            originalConsoleDebug.apply(console, args);
        }
    };
    
    originalConsoleLog('🔇 Log suppression enabled');
}

// Function to show what's being suppressed (for debugging)
function showSuppressedLogs() {
    let suppressedCount = 0;
    
    // Temporarily override to count suppressed messages
    const tempConsoleLog = console.log;
    console.log = function(...args) {
        const shouldSuppress = args.some(arg => shouldSuppressMessage(String(arg)));
        if (shouldSuppress) {
            suppressedCount++;
            originalConsoleLog(`[SUPPRESSED ${suppressedCount}]:`, ...args);
        } else {
            originalConsoleLog.apply(console, args);
        }
    };
    
    originalConsoleLog('🔍 Showing suppressed logs for 10 seconds...');
    
    // Restore after 10 seconds
    setTimeout(() => {
        console.log = tempConsoleLog;
        originalConsoleLog(`🔇 Suppressed ${suppressedCount} messages in 10 seconds`);
    }, 10000);
}

// Make functions available globally
window.disableLogSuppression = disableLogSuppression;
window.enableLogSuppression = enableLogSuppression;
window.showSuppressedLogs = showSuppressedLogs;

// Add a test function to verify our debug logs still work
function testDebugLogsVisible() {
    console.log('🧪 TEST: This debug log should be visible');
    console.log('🤖 TEST: Agent routing test message');
    console.log('📝 TEST: System prompt generation test');
    console.log('✅ TEST: Debug logs are working');
}

window.testDebugLogsVisible = testDebugLogsVisible;

console.log('✅ Enhanced log suppression applied');
console.log(`🔇 Suppressing ${suppressedPatterns.length} types of streaming messages`);
console.log('💡 Use disableLogSuppression() to disable, enableLogSuppression() to re-enable');
console.log('💡 Use showSuppressedLogs() to see what\'s being suppressed');
console.log('💡 Use testDebugLogsVisible() to test if debug logs are working');
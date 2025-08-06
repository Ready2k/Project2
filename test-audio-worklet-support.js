/**
 * Test Audio Worklet Support
 * 
 * Simple test to verify AudioWorklet support without errors
 */

function testAudioWorkletSupport() {
    console.log('🧪 Testing AudioWorklet support...');
    
    try {
        // Test 1: Check AudioContext availability
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        console.log('✅ AudioContext available:', !!AudioContextClass);
        
        // Test 2: Check AudioWorkletNode availability
        console.log('✅ AudioWorkletNode available:', !!window.AudioWorkletNode);
        
        // Test 3: Check audioWorklet property (safely)
        let hasAudioWorklet = false;
        if (AudioContextClass) {
            hasAudioWorklet = 'audioWorklet' in AudioContextClass.prototype;
        }
        console.log('✅ audioWorklet property available:', hasAudioWorklet);
        
        // Test 4: Try creating an AudioContext
        let canCreateContext = false;
        try {
            const testContext = new AudioContextClass();
            canCreateContext = !!testContext.audioWorklet;
            testContext.close(); // Clean up
        } catch (e) {
            console.warn('Cannot create AudioContext:', e.message);
        }
        console.log('✅ Can create AudioContext with audioWorklet:', canCreateContext);
        
        // Overall support
        const isSupported = !!AudioContextClass && !!window.AudioWorkletNode && hasAudioWorklet;
        console.log('🎯 Overall AudioWorklet support:', isSupported);
        
        return {
            hasAudioContext: !!AudioContextClass,
            hasAudioWorkletNode: !!window.AudioWorkletNode,
            hasAudioWorkletProperty: hasAudioWorklet,
            canCreateContext,
            isSupported
        };
        
    } catch (error) {
        console.error('❌ Error testing AudioWorklet support:', error);
        return {
            hasAudioContext: false,
            hasAudioWorkletNode: false,
            hasAudioWorkletProperty: false,
            canCreateContext: false,
            isSupported: false,
            error: error.message
        };
    }
}

// Export globally
if (typeof window !== 'undefined') {
    window.testAudioWorkletSupport = testAudioWorkletSupport;
}

console.log('🧪 AudioWorklet support test loaded');
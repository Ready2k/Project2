// Comprehensive verification script for the new interface
class InterfaceVerifier {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    addTest(name, testFunction) {
        this.tests.push({ name, testFunction });
    }

    async runAllTests() {
        console.log('🧪 Starting Interface Verification Tests...\n');
        
        for (const test of this.tests) {
            try {
                console.log(`Testing: ${test.name}`);
                const result = await test.testFunction();
                if (result) {
                    console.log(`✅ PASSED: ${test.name}`);
                    this.results.passed++;
                } else {
                    console.log(`❌ FAILED: ${test.name}`);
                    this.results.failed++;
                }
            } catch (error) {
                console.log(`💥 ERROR: ${test.name} - ${error.message}`);
                this.results.failed++;
                this.results.errors.push({ test: test.name, error: error.message });
            }
            console.log(''); // Empty line for readability
        }

        this.printSummary();
    }

    printSummary() {
        console.log('📊 Test Summary:');
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📈 Success Rate: ${((this.results.passed / this.tests.length) * 100).toFixed(1)}%`);
        
        if (this.results.errors.length > 0) {
            console.log('\n🚨 Errors:');
            this.results.errors.forEach(error => {
                console.log(`  - ${error.test}: ${error.error}`);
            });
        }
    }
}

// Initialize verifier
const verifier = new InterfaceVerifier();

// Test 1: Check if main interface elements exist
verifier.addTest('Main Interface Elements', () => {
    const requiredElements = [
        'settingsBtn', 'adminBtn', 'debugBtn', 'helpBtn',
        'conversation', 'startBtn', 'stopBtn', 'clearConversationBtn',
        'connectionStatus', 'currentAgent', 'audioLevel', 'status'
    ];
    
    const missing = requiredElements.filter(id => !document.getElementById(id));
    if (missing.length > 0) {
        console.log(`  Missing elements: ${missing.join(', ')}`);
        return false;
    }
    return true;
});

// Test 2: Check if CSS classes are properly applied
verifier.addTest('CSS Classes and Styling', () => {
    const topNav = document.querySelector('.top-nav');
    const mainContent = document.querySelector('.main-content');
    const voiceInterface = document.querySelector('.voice-interface');
    
    if (!topNav || !mainContent || !voiceInterface) {
        console.log('  Missing main layout elements');
        return false;
    }
    
    // Check if styles are loaded
    const computedStyle = window.getComputedStyle(topNav);
    if (computedStyle.display === 'flex') {
        return true;
    } else {
        console.log('  CSS styles may not be loaded properly');
        return false;
    }
});

// Test 3: Check if panels can be opened and closed
verifier.addTest('Panel Functionality', () => {
    if (!window.mainInterface) {
        console.log('  MainInterfaceController not initialized');
        return false;
    }
    
    // Test opening settings panel
    window.mainInterface.openPanel('settingsPanel');
    const settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel.classList.contains('open')) {
        console.log('  Settings panel failed to open');
        return false;
    }
    
    // Test closing panel
    window.mainInterface.closePanel('settingsPanel');
    if (settingsPanel.classList.contains('open')) {
        console.log('  Settings panel failed to close');
        return false;
    }
    
    return true;
});

// Test 4: Check admin panel navigation
verifier.addTest('Admin Panel Navigation', () => {
    if (!window.mainInterface) {
        console.log('  MainInterfaceController not initialized');
        return false;
    }
    
    // Test switching admin sections
    window.mainInterface.switchAdminSection('agents');
    const agentsSection = document.getElementById('agents-section');
    const personasSection = document.getElementById('personas-section');
    
    if (!agentsSection || !personasSection) {
        console.log('  Admin sections not found');
        return false;
    }
    
    if (!agentsSection.classList.contains('active') || personasSection.classList.contains('active')) {
        console.log('  Admin section switching failed');
        return false;
    }
    
    return true;
});

// Test 5: Check interface update methods
verifier.addTest('Interface Update Methods', () => {
    if (!window.mainInterface) {
        console.log('  MainInterfaceController not initialized');
        return false;
    }
    
    // Test status update
    window.mainInterface.updateStatus('Test status message');
    const statusElement = document.getElementById('status');
    if (statusElement.textContent !== 'Test status message') {
        console.log('  Status update failed');
        return false;
    }
    
    // Test agent indicator update
    window.mainInterface.updateAgentIndicator('Test Agent');
    const agentElement = document.getElementById('currentAgent');
    if (agentElement.textContent !== 'Test Agent') {
        console.log('  Agent indicator update failed');
        return false;
    }
    
    // Test connection status update
    window.mainInterface.updateConnectionStatus('connected');
    const connectionElement = document.getElementById('connectionStatus');
    if (!connectionElement.classList.contains('connected')) {
        console.log('  Connection status update failed');
        return false;
    }
    
    return true;
});

// Test 6: Check audio level and recording quality updates
verifier.addTest('Audio and Recording Updates', () => {
    if (!window.mainInterface) {
        console.log('  MainInterfaceController not initialized');
        return false;
    }
    
    // Test audio level update
    window.mainInterface.updateAudioLevel(75);
    const levelFill = document.getElementById('audioLevel');
    const levelText = document.getElementById('audioLevelText');
    
    if (levelFill.style.width !== '75%' || levelText.textContent !== '75%') {
        console.log('  Audio level update failed');
        return false;
    }
    
    // Test recording quality update
    window.mainInterface.updateRecordingQuality('recording');
    const qualityElement = document.getElementById('recordingQuality');
    if (!qualityElement.classList.contains('recording')) {
        console.log('  Recording quality update failed');
        return false;
    }
    
    return true;
});

// Test 7: Check token stats updates
verifier.addTest('Token Statistics Updates', () => {
    if (!window.mainInterface) {
        console.log('  MainInterfaceController not initialized');
        return false;
    }
    
    const testStats = {
        whisper: '5',
        gpt: '1250',
        tts: '850',
        total: '$2.45',
        whisperCost: '$0.15',
        gptCost: '$1.25',
        ttsCost: '$1.05'
    };
    
    window.mainInterface.updateTokenStats(testStats);
    
    // Check if values were updated
    const whisperElement = document.getElementById('whisperTokens');
    const totalElement = document.getElementById('totalCost');
    
    if (whisperElement.textContent !== '5' || totalElement.textContent !== '$2.45') {
        console.log('  Token stats update failed');
        return false;
    }
    
    return true;
});

// Test 8: Check debug output functionality
verifier.addTest('Debug Output Updates', () => {
    if (!window.mainInterface) {
        console.log('  MainInterfaceController not initialized');
        return false;
    }
    
    // Test debug output update
    window.mainInterface.updateDebugOutput('sttOutput', 'Test debug message');
    const debugElement = document.getElementById('sttOutput');
    
    if (!debugElement.textContent.includes('Test debug message')) {
        console.log('  Debug output update failed');
        return false;
    }
    
    return true;
});

// Test 9: Check quick action functionality
verifier.addTest('Quick Action Buttons', () => {
    const actionButtons = document.querySelectorAll('.action-btn');
    if (actionButtons.length === 0) {
        console.log('  No action buttons found');
        return false;
    }
    
    // Test if buttons have proper structure
    const firstButton = actionButtons[0];
    const icon = firstButton.querySelector('i');
    const span = firstButton.querySelector('span');
    
    if (!icon || !span) {
        console.log('  Action buttons missing icon or text');
        return false;
    }
    
    return true;
});

// Test 10: Check responsive design elements
verifier.addTest('Responsive Design Elements', () => {
    const statusIndicators = document.querySelector('.status-indicators');
    const actionGrid = document.querySelector('.action-grid');
    const statsGrid = document.querySelector('.stats-grid');
    
    if (!statusIndicators || !actionGrid || !statsGrid) {
        console.log('  Missing responsive grid elements');
        return false;
    }
    
    // Check if CSS Grid is being used
    const statusStyle = window.getComputedStyle(statusIndicators);
    if (statusStyle.display !== 'grid') {
        console.log('  CSS Grid not properly applied');
        return false;
    }
    
    return true;
});

// Export for use in browser
if (typeof window !== 'undefined') {
    window.InterfaceVerifier = InterfaceVerifier;
    window.verifier = verifier;
}

// Auto-run tests if in browser environment
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait a bit for everything to initialize
        setTimeout(() => {
            console.log('🚀 Starting automated interface verification...\n');
            verifier.runAllTests();
        }, 1000);
    });
}

console.log('✅ Interface verification script loaded successfully!');
/**
 * Verification script for Admin UI global functions
 * Run this in the browser console to verify all functions are properly exposed
 */

console.log('🔍 Verifying Admin UI Global Functions...');

// List of all required global functions
const requiredFunctions = [
    'refreshAgentData',
    'exportConfiguration', 
    'importConfiguration',
    'resetToDefaults',
    'clearAuditLog',
    'closeModal',
    'saveAgentConfiguration',
    'addTrigger',
    'updateVoiceOptions',
    'openAgentConfiguration',
    'openGuardrailsEditor', 
    'openVoiceConfig',
    'toggleAgent',
    'saveGuardrails',
    'testGuardrails',
    'saveVoiceConfig',
    'resetVoiceConfig',
    'previewVoice',
    'loadGuardrailsEditor',
    'loadVoiceEditor'
];

let passed = 0;
let failed = 0;

console.log('\n📋 Function Availability Check:');
console.log('='.repeat(50));

requiredFunctions.forEach(funcName => {
    if (typeof window[funcName] === 'function') {
        console.log(`✅ ${funcName} - Available`);
        passed++;
    } else {
        console.log(`❌ ${funcName} - Missing`);
        failed++;
    }
});

console.log('='.repeat(50));
console.log(`📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
    console.log('🎉 All functions are properly exposed!');
} else {
    console.log('⚠️  Some functions are missing. Check the implementation.');
}

// Check if adminUI is available
console.log('\n🔧 Admin UI Instance Check:');
if (window.adminUI) {
    console.log('✅ adminUI global instance is available');
    
    if (window.adminUI.llmManager) {
        console.log('✅ LLM Manager is initialized');
    } else {
        console.log('❌ LLM Manager is not initialized');
    }
    
    if (window.adminUI.guardrailsManager) {
        console.log('✅ Guardrails Manager is initialized');
    } else {
        console.log('❌ Guardrails Manager is not initialized');
    }
    
    if (window.adminUI.voiceConfigManager) {
        console.log('✅ Voice Config Manager is initialized');
    } else {
        console.log('❌ Voice Config Manager is not initialized');
    }
} else {
    console.log('❌ adminUI global instance is not available');
}

console.log('\n✨ Verification complete!');

// Export results for potential use
window.adminUIVerificationResults = {
    totalFunctions: requiredFunctions.length,
    passed: passed,
    failed: failed,
    successRate: ((passed / requiredFunctions.length) * 100).toFixed(1) + '%',
    adminUIAvailable: !!window.adminUI,
    managersInitialized: {
        llm: !!(window.adminUI && window.adminUI.llmManager),
        guardrails: !!(window.adminUI && window.adminUI.guardrailsManager),
        voiceConfig: !!(window.adminUI && window.adminUI.voiceConfigManager)
    }
};
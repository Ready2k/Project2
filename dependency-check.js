// Dependency Check Script
// This script verifies that all required classes are available before the main app initializes

console.log('🔍 Checking dependencies...');

const requiredClasses = [
    'PersonaManager',
    'SystemPromptsManager', 
    'TokenTracker',
    'OpenAIClient',
    'StreamingManager',
    'BaseAgent',
    'PaymentsAgent',
    'FraudAgent',
    'IDVAgent',
    'BankingInfoAgent',
    'GuardrailsManager',
    'SecurityManager',
    'VoiceConfigManager',
    'LLMManager',
    'AgentConfigManager',
    'AgentRouter',
    'LLMManagerAdminUI',
    // AgentRouter dependencies
    'LRUCache',
    'RoutingFallbackChain',
    'ConversationContextManager',
    'FallbackHandler',
    // SecurityManager dependencies
    'RateLimiter',
    'RateLimitError',
    'RequestValidator',
    'ValidationError',
    'AuditLogger'
];

const missingClasses = [];
const availableClasses = [];

requiredClasses.forEach(className => {
    if (typeof window[className] !== 'undefined') {
        availableClasses.push(className);
        console.log(`✅ ${className} - Available`);
    } else {
        missingClasses.push(className);
        console.log(`❌ ${className} - Missing`);
    }
});

console.log(`\n📊 Dependency Summary:`);
console.log(`✅ Available: ${availableClasses.length}/${requiredClasses.length}`);
console.log(`❌ Missing: ${missingClasses.length}/${requiredClasses.length}`);

if (missingClasses.length > 0) {
    console.log(`\n🚨 Missing Dependencies:`);
    missingClasses.forEach(className => {
        console.log(`   - ${className}`);
    });
    console.log(`\n⚠️  The application may not function correctly with missing dependencies.`);
} else {
    console.log(`\n🎉 All dependencies are available!`);
}

// Export results for other scripts to use
window.dependencyCheck = {
    available: availableClasses,
    missing: missingClasses,
    allAvailable: missingClasses.length === 0
};

// Also check for debug manager
if (window.debugManager) {
    console.log('✅ Debug Manager - Available');
} else {
    console.log('❌ Debug Manager - Missing');
}

// Check for main interface controller (after DOM loads)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.MainInterfaceController) {
            console.log('✅ MainInterfaceController - Available');
        } else {
            console.log('❌ MainInterfaceController - Missing');
        }
    }, 100);
});
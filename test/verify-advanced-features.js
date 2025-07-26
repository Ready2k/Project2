/**
 * Verification script for Advanced LLM Manager Features
 * Tests all implemented features to ensure they work correctly
 */

// Mock debug manager for testing
const mockDebugManager = {
    createModuleLogger: (module) => ({
        log: (...args) => console.log(`[${module}]`, ...args),
        warn: (...args) => console.warn(`[${module}]`, ...args),
        error: (...args) => console.error(`[${module}]`, ...args)
    })
};

// Set up global debug manager
if (typeof window !== 'undefined') {
    window.debugManager = mockDebugManager;
} else {
    global.debugManager = mockDebugManager;
}

// Test results storage
const testResults = {
    passed: 0,
    failed: 0,
    errors: []
};

function logTest(testName, passed, error = null) {
    if (passed) {
        console.log(`✅ ${testName}: PASSED`);
        testResults.passed++;
    } else {
        console.log(`❌ ${testName}: FAILED${error ? ` - ${error}` : ''}`);
        testResults.failed++;
        if (error) testResults.errors.push({ test: testName, error });
    }
}

async function runAdvancedFeaturesTests() {
    console.log('🚀 Starting Advanced LLM Manager Features Verification');
    console.log('=' .repeat(60));

    try {
        // Load required modules (simulate browser environment)
        const LLMManager = require('./agents/llm-manager.js');
        const GuardrailsManager = require('./agents/guardrails-manager.js');
        const VoiceConfigManager = require('./agents/voice-config-manager.js');

        // Initialize managers
        const llmManager = new LLMManager();
        const guardrailsManager = new GuardrailsManager();
        const voiceConfigManager = new VoiceConfigManager();
        
        llmManager.setManagers(guardrailsManager, voiceConfigManager, null);

        // Test 1: Configuration Templates
        console.log('\n📋 Testing Configuration Templates');
        try {
            const templates = llmManager.getConfigurationTemplates();
            logTest('Get Configuration Templates', Object.keys(templates).length > 0);
            
            const templateKeys = Object.keys(templates);
            const firstTemplate = templates[templateKeys[0]];
            logTest('Template Structure Validation', 
                firstTemplate.name && firstTemplate.description && firstTemplate.config);
            
            // Test template application
            const applyResult = await llmManager.applyConfigurationTemplate(
                'TestAgent', 
                templateKeys[0], 
                { description: 'Test agent' }
            );
            logTest('Apply Configuration Template', applyResult.success);
            
        } catch (error) {
            logTest('Configuration Templates', false, error.message);
        }

        // Test 2: Performance Metrics
        console.log('\n📊 Testing Performance Metrics');
        try {
            const allMetrics = llmManager.getAgentPerformanceMetrics();
            logTest('Get All Agent Metrics', Object.keys(allMetrics).length > 0);
            
            const agentNames = Object.keys(allMetrics);
            const firstAgentMetrics = allMetrics[agentNames[0]];
            const requiredFields = ['totalRequests', 'successfulRequests', 'averageResponseTime', 'totalTokensUsed'];
            const hasAllFields = requiredFields.every(field => firstAgentMetrics.hasOwnProperty(field));
            logTest('Metrics Structure Validation', hasAllFields);
            
            // Test specific agent metrics
            const specificMetrics = llmManager.getAgentPerformanceMetrics(agentNames[0]);
            logTest('Get Specific Agent Metrics', specificMetrics[agentNames[0]] !== undefined);
            
        } catch (error) {
            logTest('Performance Metrics', false, error.message);
        }

        // Test 3: Configuration Comparison
        console.log('\n🔍 Testing Configuration Comparison');
        try {
            const agents = llmManager.getAgentConfigurations();
            const agentNames = Object.keys(agents);
            
            if (agentNames.length >= 2) {
                const comparison = llmManager.compareConfigurations(agentNames[0], agentNames[1]);
                logTest('Compare Configurations', comparison.success);
                logTest('Comparison Structure', 
                    comparison.differences !== undefined && comparison.similarities !== undefined);
                
                // Test configuration diff
                const oldConfig = { priority: 1, enabled: true };
                const newConfig = { priority: 5, enabled: true, newField: 'test' };
                const diff = llmManager.createConfigurationDiff(oldConfig, newConfig);
                logTest('Create Configuration Diff', 
                    diff.added && diff.removed && diff.modified && diff.unchanged);
            } else {
                logTest('Configuration Comparison', false, 'Need at least 2 agents for comparison');
            }
            
        } catch (error) {
            logTest('Configuration Comparison', false, error.message);
        }

        // Test 4: Scheduled Changes
        console.log('\n⏰ Testing Scheduled Changes');
        try {
            const scheduleTime = new Date(Date.now() + 60000); // 1 minute from now
            const testConfig = { priority: 99, enabled: true };
            
            const scheduleResult = llmManager.scheduleConfigurationChange(
                'TestAgent', 
                testConfig, 
                scheduleTime, 
                { reason: 'Test scheduled change' }
            );
            logTest('Schedule Configuration Change', scheduleResult.success);
            
            const scheduledChanges = llmManager.getScheduledChanges();
            logTest('Get Scheduled Changes', Array.isArray(scheduledChanges));
            
            if (scheduleResult.success) {
                const cancelResult = llmManager.cancelScheduledChange(scheduleResult.scheduleId);
                logTest('Cancel Scheduled Change', cancelResult.success);
            }
            
        } catch (error) {
            logTest('Scheduled Changes', false, error.message);
        }

        // Test 5: Environment Management
        console.log('\n🌍 Testing Environment Management');
        try {
            const environments = llmManager.getEnvironmentConfigurations();
            logTest('Get Environment Configurations', typeof environments === 'object');
            
            const testConfig = { name: 'TestAgent', priority: 1, enabled: true };
            const saveResult = llmManager.saveConfigurationToEnvironment(
                'development', 
                'TestAgent', 
                testConfig
            );
            logTest('Save Configuration to Environment', saveResult.success);
            
            const loadedConfig = llmManager.loadConfigurationFromEnvironment(
                'development', 
                'TestAgent'
            );
            logTest('Load Configuration from Environment', loadedConfig !== null);
            
            if (saveResult.success) {
                const promoteResult = await llmManager.promoteConfiguration(
                    'development', 
                    'staging', 
                    'TestAgent'
                );
                logTest('Promote Configuration', promoteResult.success);
            }
            
        } catch (error) {
            logTest('Environment Management', false, error.message);
        }

        // Test 6: Integration Tests
        console.log('\n🧪 Testing Integration');
        try {
            // Test that all features work together
            const stats = llmManager.getConfigurationStats();
            logTest('Configuration Statistics', stats.totalAgents > 0);
            
            // Test cleanup
            llmManager.cleanup();
            logTest('Manager Cleanup', true);
            
        } catch (error) {
            logTest('Integration Tests', false, error.message);
        }

    } catch (error) {
        console.error('❌ Failed to initialize test environment:', error);
        testResults.failed++;
        testResults.errors.push({ test: 'Initialization', error: error.message });
    }

    // Print test summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 Test Summary');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

    if (testResults.errors.length > 0) {
        console.log('\n❌ Errors:');
        testResults.errors.forEach(({ test, error }) => {
            console.log(`  • ${test}: ${error}`);
        });
    }

    console.log('\n🎉 Advanced Features Verification Complete!');
    
    return testResults.failed === 0;
}

// Run tests if this is the main module
if (require.main === module) {
    runAdvancedFeaturesTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { runAdvancedFeaturesTests };
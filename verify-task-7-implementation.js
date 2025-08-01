/**
 * Task 7 Implementation Verification Script
 * Verifies that admin panel navigation and references have been updated according to requirements
 */

class Task7ImplementationVerifier {
    constructor() {
        this.results = [];
        this.fs = require('fs');
        this.path = require('path');
    }

    log(message) {
        console.log(`[Task7Verifier] ${message}`);
    }

    addResult(test, status, details) {
        this.results.push({ test, status, details });
        const icon = status === 'PASS' ? '✅' : '❌';
        this.log(`${icon} ${test}: ${status} - ${details}`);
    }

    readFile(filePath) {
        try {
            return this.fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            this.log(`Error reading file ${filePath}: ${error.message}`);
            return null;
        }
    }

    verifyIndexHtml() {
        this.log('Verifying index.html for admin panel navigation updates...');
        
        const indexContent = this.readFile('index.html');
        if (!indexContent) {
            this.addResult('Index HTML File', 'FAIL', 'Could not read index.html');
            return;
        }

        // Check for updated LLM section description
        const hasComprehensiveMessage = indexContent.includes('All agent configurations, including the Default Agent, are now managed through the LLM Manager') &&
                                       indexContent.includes('The LLM Manager provides comprehensive configuration options for:') &&
                                       indexContent.includes('Default Agent (Base AI Personality, Financial Services Context, Response Instructions, Custom Scenario Prompts)') &&
                                       indexContent.includes('Specialized Agents (Banking Info, Payments, Fraud Detection, Identity Verification)');

        if (hasComprehensiveMessage) {
            this.addResult('LLM Section Description Update', 'PASS', 'Comprehensive informational message found');
        } else {
            this.addResult('LLM Section Description Update', 'FAIL', 'Comprehensive informational message not found or incomplete');
        }

        // Check for informational message directing to LLM Manager
        const hasLLMManagerDirection = indexContent.includes('Use the "Open Full Manager" button below to access all agent configuration options') &&
                                      indexContent.includes('openFullLLMManager()');

        if (hasLLMManagerDirection) {
            this.addResult('LLM Manager Direction Message', 'PASS', 'Clear direction to LLM Manager found');
        } else {
            this.addResult('LLM Manager Direction Message', 'FAIL', 'LLM Manager direction message not found');
        }

        // Check that System Prompts navigation is not present
        const hasSystemPromptsNav = indexContent.includes('data-admin-section="prompts"') ||
                                   indexContent.includes('System Prompts');

        if (!hasSystemPromptsNav) {
            this.addResult('System Prompts Navigation Removal', 'PASS', 'No System Prompts navigation found');
        } else {
            this.addResult('System Prompts Navigation Removal', 'FAIL', 'System Prompts navigation still exists');
        }

        // Check for Agent Configuration section title
        const hasAgentConfigurationTitle = indexContent.includes('Agent Configuration Console');

        if (hasAgentConfigurationTitle) {
            this.addResult('Agent Configuration Title', 'PASS', 'Agent Configuration Console title found');
        } else {
            this.addResult('Agent Configuration Title', 'FAIL', 'Agent Configuration Console title not found');
        }
    }

    verifyMainInterfaceJs() {
        this.log('Verifying main-interface.js for System Prompts function removal...');
        
        const mainInterfaceContent = this.readFile('main-interface.js');
        if (!mainInterfaceContent) {
            this.addResult('Main Interface JS File', 'FAIL', 'Could not read main-interface.js');
            return;
        }

        // Check for removed System Prompts functions
        const systemPromptsFunctions = [
            'initializeSystemPrompts',
            'switchPromptTab',
            'saveSystemPrompts',
            'loadSystemPrompts'
        ];

        let foundFunctions = [];
        systemPromptsFunctions.forEach(funcName => {
            if (mainInterfaceContent.includes(funcName)) {
                foundFunctions.push(funcName);
            }
        });

        if (foundFunctions.length === 0) {
            this.addResult('System Prompts Functions Removal', 'PASS', 'No System Prompts functions found in main-interface.js');
        } else {
            this.addResult('System Prompts Functions Removal', 'FAIL', `Found functions: ${foundFunctions.join(', ')}`);
        }

        // Check that LLM Manager integration functions exist
        const hasLLMManagerFunctions = mainInterfaceContent.includes('openFullLLMManager') &&
                                      mainInterfaceContent.includes('refreshLLMData');

        if (hasLLMManagerFunctions) {
            this.addResult('LLM Manager Integration Functions', 'PASS', 'LLM Manager integration functions found');
        } else {
            this.addResult('LLM Manager Integration Functions', 'FAIL', 'LLM Manager integration functions missing');
        }
    }

    verifyScriptJs() {
        this.log('Verifying script.js for System Prompts integration...');
        
        const scriptContent = this.readFile('script.js');
        if (!scriptContent) {
            this.addResult('Script JS File', 'FAIL', 'Could not read script.js');
            return;
        }

        // Check that SystemPromptsManager integration is still intact for LLM Manager
        const hasSystemPromptsManager = scriptContent.includes('SystemPromptsManager') &&
                                       scriptContent.includes('this.systemPromptsManager');

        if (hasSystemPromptsManager) {
            this.addResult('SystemPromptsManager Integration', 'PASS', 'SystemPromptsManager integration preserved for LLM Manager');
        } else {
            this.addResult('SystemPromptsManager Integration', 'FAIL', 'SystemPromptsManager integration missing');
        }

        // Check for removed System Prompts UI functions
        const systemPromptsUIFunctions = [
            'initializeSystemPrompts',
            'switchPromptTab'
        ];

        let foundUIFunctions = [];
        systemPromptsUIFunctions.forEach(funcName => {
            if (scriptContent.includes(funcName)) {
                foundUIFunctions.push(funcName);
            }
        });

        if (foundUIFunctions.length === 0) {
            this.addResult('System Prompts UI Functions Removal', 'PASS', 'No System Prompts UI functions found in script.js');
        } else {
            this.addResult('System Prompts UI Functions Removal', 'FAIL', `Found UI functions: ${foundUIFunctions.join(', ')}`);
        }
    }

    verifyRequirementsCompliance() {
        this.log('Verifying requirements compliance...');

        // Requirement 2.2: Update LLM Console section description to indicate it handles all agent configuration
        const indexContent = this.readFile('index.html');
        const hasUpdatedDescription = indexContent && (
            indexContent.includes('All agent configurations, including the Default Agent, are now managed through the LLM Manager') &&
            indexContent.includes('The LLM Manager provides comprehensive configuration options for:')
        );

        if (hasUpdatedDescription) {
            this.addResult('Requirement 2.2 Compliance', 'PASS', 'LLM Console section description updated to indicate it handles all agent configuration');
        } else {
            this.addResult('Requirement 2.2 Compliance', 'FAIL', 'LLM Console section description not properly updated');
        }

        // Check for informational message directing users to LLM Manager
        const hasDirectionMessage = indexContent && indexContent.includes('Use the "Open Full Manager" button below to access all agent configuration options');

        if (hasDirectionMessage) {
            this.addResult('LLM Manager Direction', 'PASS', 'Informational message directing users to LLM Manager found');
        } else {
            this.addResult('LLM Manager Direction', 'FAIL', 'Informational message directing users to LLM Manager not found');
        }

        // Check that System Prompts related event handlers and functions are removed
        const mainInterfaceContent = this.readFile('main-interface.js');
        const scriptContent = this.readFile('script.js');
        
        const hasSystemPromptsCode = (mainInterfaceContent && (
            mainInterfaceContent.includes('initializeSystemPrompts') ||
            mainInterfaceContent.includes('switchPromptTab')
        )) || (scriptContent && (
            scriptContent.includes('initializeSystemPrompts') ||
            scriptContent.includes('switchPromptTab')
        ));

        if (!hasSystemPromptsCode) {
            this.addResult('System Prompts Code Removal', 'PASS', 'System Prompts related event handlers and functions removed');
        } else {
            this.addResult('System Prompts Code Removal', 'FAIL', 'System Prompts related code still exists');
        }
    }

    run() {
        this.log('Starting Task 7 implementation verification...');
        this.log('='.repeat(50));

        this.verifyIndexHtml();
        this.verifyMainInterfaceJs();
        this.verifyScriptJs();
        this.verifyRequirementsCompliance();

        this.log('='.repeat(50));
        this.log('Verification Summary:');

        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.status === 'PASS').length;
        const failedTests = totalTests - passedTests;

        this.log(`Total tests: ${totalTests}`);
        this.log(`Passed: ${passedTests}`);
        this.log(`Failed: ${failedTests}`);

        if (passedTests === totalTests) {
            this.log('\n🎉 ALL TESTS PASSED! Task 7 implementation is complete.');
            this.log('✅ LLM Console section description updated to indicate it handles all agent configuration');
            this.log('✅ Informational message directing users to LLM Manager added');
            this.log('✅ System Prompts related event handlers and functions removed from main interface');
            this.log('✅ SystemPromptsManager integration preserved for LLM Manager functionality');
        } else {
            this.log('\n❌ Some tests failed. Please review the implementation.');
            this.results.filter(r => r.status === 'FAIL').forEach(result => {
                this.log(`   - ${result.test}: ${result.details}`);
            });
        }

        this.log('\nNEXT STEPS:');
        this.log('1. Open test-task-7-implementation.html in a browser to run interactive tests');
        this.log('2. Verify that the admin panel works correctly with updated navigation');
        this.log('3. Test that LLM Manager integration functions work properly');
        this.log('4. Confirm that users are properly directed to LLM Manager for agent configuration');

        return passedTests === totalTests;
    }
}

// Run verification if called directly
if (require.main === module) {
    const verifier = new Task7ImplementationVerifier();
    const success = verifier.run();
    process.exit(success ? 0 : 1);
}

module.exports = Task7ImplementationVerifier;
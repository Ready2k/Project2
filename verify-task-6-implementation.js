/**
 * Task 6 Implementation Verification Script
 * Verifies that the System Prompts section has been completely removed from the Administrator panel
 */

const fs = require('fs');
const path = require('path');

class Task6Verifier {
    constructor() {
        this.results = [];
        this.errors = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
        console.log(logMessage);
        
        if (type === 'error') {
            this.errors.push(message);
        }
    }

    addResult(test, status, details = '') {
        this.results.push({ test, status, details });
        const statusIcon = status === 'PASS' ? '✅' : '❌';
        this.log(`${statusIcon} ${test}: ${status}${details ? ' - ' + details : ''}`, status === 'PASS' ? 'info' : 'error');
    }

    readFile(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            this.log(`Error reading file ${filePath}: ${error.message}`, 'error');
            return null;
        }
    }

    verifyIndexHtml() {
        this.log('Verifying index.html for System Prompts section removal...');
        
        const indexContent = this.readFile('index.html');
        if (!indexContent) {
            this.addResult('Index.html File Read', 'FAIL', 'Could not read index.html');
            return;
        }

        // Check for System Prompts navigation button
        const hasSystemPromptsNav = indexContent.includes('data-admin-section="prompts"') ||
                                   indexContent.includes('System Prompts');
        
        if (!hasSystemPromptsNav) {
            this.addResult('System Prompts Navigation Removal', 'PASS', 'No System Prompts navigation found');
        } else {
            this.addResult('System Prompts Navigation Removal', 'FAIL', 'System Prompts navigation still exists');
        }

        // Check for System Prompts content section
        const hasSystemPromptsSection = indexContent.includes('prompts-section') ||
                                       indexContent.includes('id="prompts-section"');
        
        if (!hasSystemPromptsSection) {
            this.addResult('System Prompts Content Section Removal', 'PASS', 'No System Prompts content section found');
        } else {
            this.addResult('System Prompts Content Section Removal', 'FAIL', 'System Prompts content section still exists');
        }

        // Check for System Prompts form elements
        const systemPromptsElements = [
            'basePersonality',
            'financialContext',
            'responseInstructions'
        ];

        let foundElements = [];
        systemPromptsElements.forEach(elementId => {
            if (indexContent.includes(`id="${elementId}"`)) {
                foundElements.push(elementId);
            }
        });

        if (foundElements.length === 0) {
            this.addResult('System Prompts Form Elements Removal', 'PASS', 'No System Prompts form elements found');
        } else {
            this.addResult('System Prompts Form Elements Removal', 'FAIL', `Found elements: ${foundElements.join(', ')}`);
        }

        // Verify remaining admin sections are intact
        const requiredSections = ['personas-section', 'agents-section', 'llm-section'];
        let missingSections = [];
        
        requiredSections.forEach(sectionId => {
            if (!indexContent.includes(`id="${sectionId}"`)) {
                missingSections.push(sectionId);
            }
        });

        if (missingSections.length === 0) {
            this.addResult('Remaining Admin Sections Intact', 'PASS', 'All required admin sections present');
        } else {
            this.addResult('Remaining Admin Sections Intact', 'FAIL', `Missing sections: ${missingSections.join(', ')}`);
        }
    }

    verifyScriptJs() {
        this.log('Verifying script.js for System Prompts method removal...');
        
        const scriptContent = this.readFile('script.js');
        if (!scriptContent) {
            this.addResult('Script.js File Read', 'FAIL', 'Could not read script.js');
            return;
        }

        // Check for removed methods
        const removedMethods = [
            'initializeSystemPrompts',
            'switchPromptTab'
        ];

        let foundMethods = [];
        removedMethods.forEach(method => {
            if (scriptContent.includes(`${method}(`)) {
                foundMethods.push(method);
            }
        });

        if (foundMethods.length === 0) {
            this.addResult('System Prompts Methods Removal', 'PASS', 'No System Prompts methods found');
        } else {
            this.addResult('System Prompts Methods Removal', 'FAIL', `Found methods: ${foundMethods.join(', ')}`);
        }

        // Check for removed event listeners
        const hasPromptTabListeners = scriptContent.includes('.prompt-tab-btn') ||
                                     scriptContent.includes('data-prompt');

        if (!hasPromptTabListeners) {
            this.addResult('System Prompts Event Listeners Removal', 'PASS', 'No System Prompts event listeners found');
        } else {
            this.addResult('System Prompts Event Listeners Removal', 'FAIL', 'System Prompts event listeners still exist');
        }

        // Verify SystemPromptsManager integration is still intact for LLM Manager
        const hasSystemPromptsManager = scriptContent.includes('SystemPromptsManager') &&
                                       scriptContent.includes('this.systemPromptsManager');

        if (hasSystemPromptsManager) {
            this.addResult('SystemPromptsManager Integration', 'PASS', 'SystemPromptsManager integration preserved');
        } else {
            this.addResult('SystemPromptsManager Integration', 'FAIL', 'SystemPromptsManager integration missing');
        }
    }

    verifyMainInterfaceJs() {
        this.log('Verifying main-interface.js for System Prompts method removal...');
        
        const mainInterfaceContent = this.readFile('main-interface.js');
        if (!mainInterfaceContent) {
            this.addResult('Main-interface.js File Read', 'FAIL', 'Could not read main-interface.js');
            return;
        }

        // Check for removed switchPromptTab method
        const hasSwitchPromptTab = mainInterfaceContent.includes('switchPromptTab');

        if (!hasSwitchPromptTab) {
            this.addResult('Main Interface switchPromptTab Removal', 'PASS', 'switchPromptTab method removed');
        } else {
            this.addResult('Main Interface switchPromptTab Removal', 'FAIL', 'switchPromptTab method still exists');
        }

        // Verify admin section switching is still intact
        const hasAdminSectionSwitching = mainInterfaceContent.includes('switchAdminSection') &&
                                        mainInterfaceContent.includes('data-admin-section');

        if (hasAdminSectionSwitching) {
            this.addResult('Admin Section Switching Intact', 'PASS', 'Admin section switching functionality preserved');
        } else {
            this.addResult('Admin Section Switching Intact', 'FAIL', 'Admin section switching functionality missing');
        }
    }

    verifyRequirements() {
        this.log('Verifying requirements compliance...');

        // Requirement 2.1: System Prompts Configuration section removed from Administrator panel
        const indexContent = this.readFile('index.html');
        const hasSystemPromptsInAdmin = indexContent && (
            indexContent.includes('System Prompts Configuration') ||
            indexContent.includes('data-admin-section="prompts"')
        );

        if (!hasSystemPromptsInAdmin) {
            this.addResult('Requirement 2.1 Compliance', 'PASS', 'System Prompts Configuration section removed from admin panel');
        } else {
            this.addResult('Requirement 2.1 Compliance', 'FAIL', 'System Prompts Configuration section still in admin panel');
        }

        // Requirement 2.2: System Prompts navigation button removed from admin navigation
        const hasSystemPromptsNav = indexContent && indexContent.includes('System Prompts');

        if (!hasSystemPromptsNav) {
            this.addResult('Requirement 2.2 Compliance', 'PASS', 'System Prompts navigation button removed');
        } else {
            this.addResult('Requirement 2.2 Compliance', 'FAIL', 'System Prompts navigation button still exists');
        }
    }

    generateReport() {
        this.log('\n' + '='.repeat(80));
        this.log('TASK 6 IMPLEMENTATION VERIFICATION REPORT');
        this.log('='.repeat(80));

        const passCount = this.results.filter(r => r.status === 'PASS').length;
        const failCount = this.results.filter(r => r.status === 'FAIL').length;
        const totalCount = this.results.length;

        this.log(`\nSUMMARY: ${passCount}/${totalCount} tests passed`);
        
        if (failCount > 0) {
            this.log('\nFAILED TESTS:');
            this.results.filter(r => r.status === 'FAIL').forEach(result => {
                this.log(`❌ ${result.test}: ${result.details}`);
            });
        }

        if (passCount === totalCount) {
            this.log('\n🎉 ALL TESTS PASSED! Task 6 implementation is complete.');
            this.log('✅ System Prompts section has been successfully removed from Administrator panel');
            this.log('✅ All System Prompts related JavaScript code has been cleaned up');
            this.log('✅ Admin panel functionality remains intact');
        } else {
            this.log('\n⚠️  SOME TESTS FAILED. Please review the implementation.');
        }

        this.log('\nNEXT STEPS:');
        this.log('1. Open test-task-6-implementation.html in a browser to run interactive tests');
        this.log('2. Verify that the admin panel works correctly without System Prompts section');
        this.log('3. Confirm that LLM Manager handles default agent configuration');

        return passCount === totalCount;
    }

    async run() {
        this.log('Starting Task 6 implementation verification...');
        
        try {
            this.verifyIndexHtml();
            this.verifyScriptJs();
            this.verifyMainInterfaceJs();
            this.verifyRequirements();
            
            return this.generateReport();
        } catch (error) {
            this.log(`Verification failed with error: ${error.message}`, 'error');
            return false;
        }
    }
}

// Run verification if called directly
if (require.main === module) {
    const verifier = new Task6Verifier();
    verifier.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = Task6Verifier;
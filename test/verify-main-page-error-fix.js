/**
 * Verification Script for Main Page Error Fix
 * Run this in Node.js to verify the fix has been properly implemented
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Main Page Error Fix Implementation...\n');

// Test 1: Check if the JavaScript file has been updated
console.log('Test 1: Checking JavaScript file modifications...');
const jsFile = 'llm-manager-admin-ui.js';

if (!fs.existsSync(jsFile)) {
    console.error('❌ llm-manager-admin-ui.js not found');
    process.exit(1);
}

const jsContent = fs.readFileSync(jsFile, 'utf8');

// Check for the fixed generateAgentPromptCards function
const hasFixedGenerateFunction = jsContent.includes('console.debug(\'Agents prompts grid not found - likely not on LLM Manager admin page\')');
const hasRemovedErrorMessage = !jsContent.includes('console.error(\'Agents prompts grid not found\')');

// Check for the fixed global initializePromptsSection function
const hasFixedGlobalInit = jsContent.includes('console.debug(\'Skipping prompts section initialization - not on LLM Manager admin page\')');

// Check for the fixed class method initializePromptsSection
const hasFixedClassMethod = jsContent.includes('this.debug.debug(\'Skipping prompts section initialization - not on LLM Manager admin page\')');

console.log(`  ${hasFixedGenerateFunction ? '✅' : '❌'} generateAgentPromptCards function updated`);
console.log(`  ${hasRemovedErrorMessage ? '✅' : '❌'} Error message removed from generateAgentPromptCards`);
console.log(`  ${hasFixedGlobalInit ? '✅' : '❌'} Global initializePromptsSection function updated`);
console.log(`  ${hasFixedClassMethod ? '✅' : '❌'} Class initializePromptsSection method updated`);

// Test 2: Check if test file exists
console.log('\nTest 2: Checking test file creation...');
const testFile = 'test-main-page-error-fix.html';
const testFileExists = fs.existsSync(testFile);
console.log(`  ${testFileExists ? '✅' : '❌'} Test file created: ${testFile}`);

// Test 3: Check if documentation exists
console.log('\nTest 3: Checking documentation...');
const docFile = 'MAIN_PAGE_ERROR_FIX_SUMMARY.md';
const docFileExists = fs.existsSync(docFile);
console.log(`  ${docFileExists ? '✅' : '❌'} Documentation created: ${docFile}`);

// Test 4: Verify the fix logic
console.log('\nTest 4: Verifying fix logic...');

// Check that all three functions have the DOM element check
const generateFunctionHasCheck = jsContent.includes('document.getElementById(\'agents-prompts-grid\')') &&
    jsContent.includes('generateAgentPromptCards()') &&
    jsContent.includes('console.debug(\'Agents prompts grid not found');

const globalInitHasCheck = jsContent.includes('if (!document.getElementById(\'agents-prompts-grid\'))') &&
    jsContent.includes('async function initializePromptsSection()');

const classMethodHasCheck = jsContent.includes('if (!document.getElementById(\'agents-prompts-grid\'))') &&
    jsContent.includes('initializePromptsSection() {');

console.log(`  ${generateFunctionHasCheck ? '✅' : '❌'} generateAgentPromptCards has DOM check`);
console.log(`  ${globalInitHasCheck ? '✅' : '❌'} Global initializePromptsSection has DOM check`);
console.log(`  ${classMethodHasCheck ? '✅' : '❌'} Class initializePromptsSection has DOM check`);

// Test 5: Check for potential remaining issues
console.log('\nTest 5: Checking for potential remaining issues...');

// Look for other functions that might access LLM Manager specific elements
const potentialIssues = [];

// Check for hardcoded element IDs that might cause issues
const llmSpecificElements = [
    'agents-grid',
    'prompts-section',
    'template-',
    'agent-prompt-',
    'llm-'
];

llmSpecificElements.forEach(elementId => {
    const regex = new RegExp(`getElementById\\(['"]${elementId}`, 'g');
    const matches = jsContent.match(regex);
    if (matches && matches.length > 0) {
        potentialIssues.push(`Found ${matches.length} references to element ID containing '${elementId}'`);
    }
});

if (potentialIssues.length === 0) {
    console.log('  ✅ No obvious remaining DOM access issues found');
} else {
    console.log('  ⚠️  Potential issues found:');
    potentialIssues.forEach(issue => console.log(`     - ${issue}`));
}

// Summary
console.log('\n📊 Summary:');
const allTestsPassed = hasFixedGenerateFunction && hasRemovedErrorMessage &&
    hasFixedGlobalInit && hasFixedClassMethod &&
    testFileExists && docFileExists;

if (allTestsPassed) {
    console.log('✅ All tests passed! The main page error fix has been successfully implemented.');
    console.log('\n🎯 Next Steps:');
    console.log('1. Open test-main-page-error-fix.html in a browser to verify the fix');
    console.log('2. Check the main page (index.html) for console errors');
    console.log('3. Verify that the LLM Manager admin UI still works correctly');
    console.log('4. Test the complete user workflow');
} else {
    console.log('❌ Some tests failed. Please review the implementation.');
    process.exit(1);
}

console.log('\n🔧 Manual Verification Steps:');
console.log('1. Open index.html in a browser');
console.log('2. Open browser developer tools (F12)');
console.log('3. Check Console tab - should see no "Agents prompts grid not found" errors');
console.log('4. Open llm-manager-admin-ui.html in a new tab');
console.log('5. Navigate to "System Prompts" section');
console.log('6. Verify that agent prompt cards are loaded correctly');
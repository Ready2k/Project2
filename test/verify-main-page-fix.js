/**
 * Verification script to test that the main page loads without syntax errors
 */

// Test script.js syntax by attempting to parse it
const fs = require('fs');
const path = require('path');

function verifyJavaScriptSyntax(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Try to create a function with the content to check for syntax errors
        new Function(content);
        
        console.log(`✅ ${path.basename(filePath)}: Syntax is valid`);
        return true;
    } catch (error) {
        console.error(`❌ ${path.basename(filePath)}: Syntax error - ${error.message}`);
        return false;
    }
}

function verifyMainPageFiles() {
    console.log('🔍 Verifying main page JavaScript files for syntax errors...\n');
    
    const filesToCheck = [
        'script.js',
        'agents/config-update-manager.js',
        'agents/llm-manager.js',
        'agents/guardrails-manager.js',
        'agents/voice-config-manager.js',
        'agents/base-agent.js'
    ];
    
    let allValid = true;
    
    for (const file of filesToCheck) {
        if (fs.existsSync(file)) {
            const isValid = verifyJavaScriptSyntax(file);
            if (!isValid) {
                allValid = false;
            }
        } else {
            console.warn(`⚠️  ${file}: File not found`);
        }
    }
    
    console.log('\n📊 VERIFICATION RESULTS');
    console.log('========================');
    
    if (allValid) {
        console.log('🎉 All JavaScript files have valid syntax!');
        console.log('✅ The main page should now load without syntax errors.');
    } else {
        console.log('❌ Some files have syntax errors that need to be fixed.');
    }
    
    return allValid;
}

// Run verification
if (require.main === module) {
    verifyMainPageFiles();
}

module.exports = { verifyJavaScriptSyntax, verifyMainPageFiles };
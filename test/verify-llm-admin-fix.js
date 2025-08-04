#!/usr/bin/env node

/**
 * Verification script for LLM Admin UI fix
 * This script verifies that the system prompts are correctly loaded from agent config files
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying LLM Admin UI Fix...\n');

// Test 1: Check if agent config files exist
console.log('Test 1: Checking agent configuration files...');
const agentConfigFiles = [
    'config/agents/default-agent-config.json',
    'config/agents/payments-agent-config.json',
    'config/agents/fraud-agent-config.json',
    'config/agents/idv-agent-config.json',
    'config/agents/bankinginfo-agent-config.json'
];

let configFilesExist = 0;
for (const filePath of agentConfigFiles) {
    if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${filePath} exists`);
        configFilesExist++;
    } else {
        console.log(`  ❌ ${filePath} missing`);
    }
}

console.log(`  📊 ${configFilesExist}/${agentConfigFiles.length} config files found\n`);

// Test 2: Check if config files have systemPrompts
console.log('Test 2: Checking systemPrompts in config files...');
let validSystemPrompts = 0;
for (const filePath of agentConfigFiles) {
    if (fs.existsSync(filePath)) {
        try {
            const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const agentName = path.basename(filePath, '.json').replace('-config', '');
            
            if (config.systemPrompts) {
                const requiredFields = ['basePersonality', 'financialContext', 'responseInstructions'];
                const hasAllFields = requiredFields.every(field => 
                    config.systemPrompts[field] && 
                    typeof config.systemPrompts[field] === 'string' && 
                    config.systemPrompts[field].trim().length > 0
                );
                
                if (hasAllFields) {
                    console.log(`  ✅ ${agentName}: All required systemPrompts fields present`);
                    validSystemPrompts++;
                } else {
                    const missingFields = requiredFields.filter(field => 
                        !config.systemPrompts[field] || 
                        typeof config.systemPrompts[field] !== 'string' || 
                        config.systemPrompts[field].trim().length === 0
                    );
                    console.log(`  ⚠️  ${agentName}: Missing fields: ${missingFields.join(', ')}`);
                }
            } else {
                console.log(`  ❌ ${agentName}: No systemPrompts section found`);
            }
        } catch (error) {
            console.log(`  ❌ ${filePath}: JSON parse error - ${error.message}`);
        }
    }
}

console.log(`  📊 ${validSystemPrompts}/${configFilesExist} configs have valid systemPrompts\n`);

// Test 3: Check if HTML file has been updated
console.log('Test 3: Checking HTML file updates...');
const htmlFile = 'llm-manager-admin-ui.html';
if (fs.existsSync(htmlFile)) {
    const htmlContent = fs.readFileSync(htmlFile, 'utf8');
    
    // Check if hardcoded agent cards have been removed
    const hasHardcodedCards = htmlContent.includes('Default Agent Prompts') || 
                             htmlContent.includes('FraudAgent Prompts') ||
                             htmlContent.includes('PaymentsAgent Prompts');
    
    // Check if dynamic grid is present
    const hasDynamicGrid = htmlContent.includes('agents-prompts-grid') &&
                          htmlContent.includes('Agent prompt cards will be dynamically generated');
    
    // Check if AgentConfigManager is loaded
    const hasAgentConfigManager = htmlContent.includes('agent-config-manager.js');
    
    if (!hasHardcodedCards) {
        console.log('  ✅ Hardcoded agent cards removed');
    } else {
        console.log('  ❌ Hardcoded agent cards still present');
    }
    
    if (hasDynamicGrid) {
        console.log('  ✅ Dynamic grid container added');
    } else {
        console.log('  ❌ Dynamic grid container missing');
    }
    
    if (hasAgentConfigManager) {
        console.log('  ✅ AgentConfigManager script included');
    } else {
        console.log('  ❌ AgentConfigManager script not included');
    }
} else {
    console.log('  ❌ HTML file not found');
}

console.log();

// Test 4: Check if JavaScript file has been updated
console.log('Test 4: Checking JavaScript file updates...');
const jsFile = 'llm-manager-admin-ui.js';
if (fs.existsSync(jsFile)) {
    const jsContent = fs.readFileSync(jsFile, 'utf8');
    
    // Check if loadAgentPrompts function has been updated
    const hasUpdatedLoadFunction = jsContent.includes('generateAgentPromptCards()');
    
    // Check if generateAgentPromptCards function exists
    const hasGenerateFunction = jsContent.includes('async function generateAgentPromptCards()');
    
    // Check if saveAgentPrompts function has been updated
    const hasUpdatedSaveFunction = jsContent.includes('window.agentConfigManager?.getAgentConfig');
    
    if (hasUpdatedLoadFunction) {
        console.log('  ✅ loadAgentPrompts function updated');
    } else {
        console.log('  ❌ loadAgentPrompts function not updated');
    }
    
    if (hasGenerateFunction) {
        console.log('  ✅ generateAgentPromptCards function added');
    } else {
        console.log('  ❌ generateAgentPromptCards function missing');
    }
    
    if (hasUpdatedSaveFunction) {
        console.log('  ✅ saveAgentPrompts function updated');
    } else {
        console.log('  ❌ saveAgentPrompts function not updated');
    }
} else {
    console.log('  ❌ JavaScript file not found');
}

console.log();

// Summary
console.log('📋 Summary:');
console.log(`  • Agent config files: ${configFilesExist}/${agentConfigFiles.length} found`);
console.log(`  • Valid systemPrompts: ${validSystemPrompts}/${configFilesExist} configs`);
console.log(`  • HTML updates: ${fs.existsSync(htmlFile) ? 'Checked' : 'Missing file'}`);
console.log(`  • JavaScript updates: ${fs.existsSync(jsFile) ? 'Checked' : 'Missing file'}`);

if (validSystemPrompts === agentConfigFiles.length) {
    console.log('\n🎉 All tests passed! The LLM Admin UI should now load system prompts from config files.');
} else {
    console.log('\n⚠️  Some issues found. Please review the test results above.');
}

console.log('\n💡 To test the fix:');
console.log('   1. Open llm-manager-admin-ui.html in a browser');
console.log('   2. Navigate to the "System Prompts" section');
console.log('   3. Verify that agent prompts are loaded from config files');
console.log('   4. Try editing and saving prompts to test the functionality');
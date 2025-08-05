/**
 * Fix agents to use their configuration file prompts instead of fallback prompts
 * This ensures agents use the systemPrompts from their config files
 */

console.log('🔧 Loading agent config prompts fix...');

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        fixAgentConfigPrompts();
    }, 2000);
});

async function fixAgentConfigPrompts() {
    console.log('🔧 Fixing agent config prompts...');
    
    try {
        // Load agent configurations
        await loadAgentConfigurations();
        
        // Patch agents to use their config prompts
        patchAgentPromptMethods();
        
        console.log('✅ Agent config prompts fix applied');
        
    } catch (error) {
        console.error('❌ Failed to fix agent config prompts:', error);
    }
}

async function loadAgentConfigurations() {
    console.log('📋 Loading agent configurations...');
    
    const agentConfigs = {};
    const agentNames = ['bankinginfo-agent', 'payments-agent', 'fraud-agent', 'idv-agent'];
    
    for (const agentName of agentNames) {
        try {
            const response = await fetch(`config/agents/${agentName}-config.json`);
            if (response.ok) {
                const config = await response.json();
                agentConfigs[config.name] = config;
                console.log(`✅ Loaded config for ${config.name}`);
            } else {
                console.log(`⚠️ Could not load config for ${agentName}`);
            }
        } catch (error) {
            console.log(`❌ Error loading config for ${agentName}:`, error);
        }
    }
    
    // Store configurations globally
    window.agentConfigurations = agentConfigs;
    
    console.log('📋 Agent configurations loaded:', Object.keys(agentConfigs));
}

function patchAgentPromptMethods() {
    console.log('🔧 Patching agent prompt methods...');
    
    const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
    
    if (!agentRouter) {
        console.log('❌ AgentRouter not available for patching');
        return;
    }
    
    const agents = agentRouter.getRegisteredAgents();
    
    agents.forEach(agent => {
        patchAgentPromptOverrides(agent);
    });
    
    console.log(`✅ Patched ${agents.length} agents`);
}

function patchAgentPromptOverrides(agent) {
    if (!agent || !agent.name) {
        return;
    }
    
    // Get the agent's configuration
    const agentConfig = window.agentConfigurations && window.agentConfigurations[agent.name];
    
    if (!agentConfig || !agentConfig.systemPrompts) {
        console.log(`⚠️ No system prompts config found for ${agent.name}`);
        return;
    }
    
    console.log(`🔧 Patching ${agent.name} with config prompts`);
    
    // Override the getSystemPromptOverrides method
    if (agent.getSystemPromptOverrides && !agent.getSystemPromptOverrides._configPatched) {
        const originalMethod = agent.getSystemPromptOverrides;
        
        agent.getSystemPromptOverrides = function(context, personaData) {
            const config = window.agentConfigurations && window.agentConfigurations[this.name];
            
            if (config && config.systemPrompts) {
                console.log(`🎯 Using config prompts for ${this.name}`);
                
                // Build custom prompts from config
                const customPrompts = [];
                if (config.systemPrompts.customPrompts) {
                    config.systemPrompts.customPrompts.forEach(cp => {
                        customPrompts.push(`${cp.name}: ${cp.prompt}`);
                    });
                }
                
                return {
                    basePersonality: config.systemPrompts.basePersonality,
                    financialContext: config.systemPrompts.financialContext,
                    responseInstructions: config.systemPrompts.responseInstructions,
                    additionalInstructions: customPrompts
                };
            }
            
            // Fallback to original method
            return originalMethod.call(this, context, personaData);
        };
        
        agent.getSystemPromptOverrides._configPatched = true;
        console.log(`✅ Patched ${agent.name} prompt overrides`);
    }
    
    // Also patch the generateSystemPrompt method to ensure it uses the overrides
    if (agent.generateSystemPrompt && !agent.generateSystemPrompt._configPatched) {
        const originalGenerateSystemPrompt = agent.generateSystemPrompt;
        
        agent.generateSystemPrompt = function(context, userInput) {
            // Get the overrides (which now come from config)
            const overrides = this.getSystemPromptOverrides(context, this.getPersonaData(context));
            
            if (overrides.basePersonality || overrides.financialContext || overrides.responseInstructions) {
                console.log(`🎯 Generating custom system prompt for ${this.name}`);
                
                // Build the system prompt from config
                let systemPrompt = '';
                
                if (overrides.basePersonality) {
                    systemPrompt += overrides.basePersonality + '\n\n';
                }
                
                if (overrides.financialContext) {
                    systemPrompt += overrides.financialContext + '\n\n';
                }
                
                if (overrides.responseInstructions) {
                    systemPrompt += overrides.responseInstructions + '\n\n';
                }
                
                // Add agent context
                systemPrompt += `\nYou are currently operating as ${this.name}: ${this.description}\n`;
                
                // Add custom prompts
                if (overrides.additionalInstructions && overrides.additionalInstructions.length > 0) {
                    systemPrompt += '\nADDITIONAL INSTRUCTIONS:\n';
                    overrides.additionalInstructions.forEach(instruction => {
                        systemPrompt += `- ${instruction}\n`;
                    });
                }
                
                // Add persona behavior modifications
                const personaData = this.getPersonaData(context);
                if (personaData) {
                    systemPrompt += `\nCURRENT CUSTOMER: ${personaData.name || 'Customer'}`;
                    if (personaData.balance !== undefined) {
                        systemPrompt += `\nAccount Balance: £${personaData.balance}`;
                    }
                    if (personaData.accountType) {
                        systemPrompt += `\nAccount Type: ${personaData.accountType}`;
                    }
                }
                
                return systemPrompt;
            }
            
            // Fallback to original method
            return originalGenerateSystemPrompt.call(this, context, userInput);
        };
        
        agent.generateSystemPrompt._configPatched = true;
        console.log(`✅ Patched ${agent.name} system prompt generation`);
    }
}

// Also update the debug panel to show the correct system prompt
function updateDebugPanelWithAgentPrompt() {
    // Hook into the streaming manager to capture agent-specific prompts
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (streamingManager && streamingManager.updateSessionWithAgentResponse && !streamingManager.updateSessionWithAgentResponse._promptHooked) {
        const originalMethod = streamingManager.updateSessionWithAgentResponse;
        
        streamingManager.updateSessionWithAgentResponse = async function(routingResult) {
            // Capture the agent's system prompt for debug display
            if (routingResult.agentResponse && routingResult.agentResponse.streamingInstructions) {
                console.log('🔧 Captured agent-specific system prompt for debug display');
                
                // Update debug panel
                setTimeout(() => {
                    const systemPromptPanels = document.querySelectorAll('.debug-section, .debug-panel');
                    systemPromptPanels.forEach(panel => {
                        const text = panel.textContent || panel.innerText;
                        if (text.includes('System Prompt to GPT')) {
                            const contentArea = panel.querySelector('pre') || panel.querySelector('.debug-content');
                            if (contentArea) {
                                contentArea.textContent = routingResult.agentResponse.streamingInstructions;
                            }
                        }
                    });
                }, 100);
            }
            
            return originalMethod.call(this, routingResult);
        };
        
        streamingManager.updateSessionWithAgentResponse._promptHooked = true;
        console.log('✅ Hooked into agent prompt updates for debug display');
    }
}

// Apply the debug panel update hook
setTimeout(() => {
    updateDebugPanelWithAgentPrompt();
}, 3000);

// Make functions available globally
window.fixAgentConfigPrompts = fixAgentConfigPrompts;
window.loadAgentConfigurations = loadAgentConfigurations;

console.log('🔧 Agent config prompts fix loaded');
/**
 * Direct fix for debug panels - forces correct content in the right places
 */

console.log('🔧 Loading direct debug panel fix...');

// Wait for everything to load
window.addEventListener('load', function() {
    setTimeout(() => {
        directDebugPanelFix();
    }, 4000);
});

function directDebugPanelFix() {
    console.log('🔧 Applying direct debug panel fix...');
    
    // Fix 1: Force system prompt in correct panel
    forceSystemPromptInCorrectPanel();
    
    // Fix 2: Monitor for changes and update
    monitorAndUpdatePanels();
    
    console.log('✅ Direct debug panel fix applied');
}

function forceSystemPromptInCorrectPanel() {
    console.log('🎯 Forcing system prompt in correct panel...');
    
    // Find all potential debug panels
    const allElements = document.querySelectorAll('*');
    let systemPromptPanel = null;
    let streamingRoutingPanel = null;
    
    allElements.forEach(element => {
        const text = element.textContent || element.innerText || '';
        
        // Find System Prompt to GPT panel
        if (text.includes('System Prompt to GPT') && !systemPromptPanel) {
            // Look for the parent container that has the content area
            let parent = element;
            while (parent && parent !== document.body) {
                const contentArea = parent.querySelector('pre, div[style*="background"], .debug-content');
                if (contentArea) {
                    systemPromptPanel = { container: parent, content: contentArea };
                    break;
                }
                parent = parent.parentElement;
            }
        }
        
        // Find Streaming Agent Routing panel
        if (text.includes('Streaming Agent Routing') && !streamingRoutingPanel) {
            let parent = element;
            while (parent && parent !== document.body) {
                const contentArea = parent.querySelector('pre, div[style*="background"], .debug-content');
                if (contentArea) {
                    streamingRoutingPanel = { container: parent, content: contentArea };
                    break;
                }
                parent = parent.parentElement;
            }
        }
    });
    
    console.log('Found panels:', {
        systemPrompt: !!systemPromptPanel,
        streamingRouting: !!streamingRoutingPanel
    });
    
    // Update System Prompt panel
    if (systemPromptPanel) {
        updateSystemPromptPanel(systemPromptPanel.content);
    }
    
    // Clear and update Streaming Routing panel
    if (streamingRoutingPanel) {
        updateStreamingRoutingPanel(streamingRoutingPanel.content);
    }
}

function updateSystemPromptPanel(contentArea) {
    if (!contentArea) return;
    
    console.log('🔧 Updating System Prompt panel...');
    
    // Get the current agent-specific system prompt
    const systemPrompt = getAgentSystemPrompt();
    
    // Update the content
    contentArea.textContent = systemPrompt;
    contentArea.style.cssText = 'white-space: pre-wrap; font-family: monospace; font-size: 12px; background: #2d3748; color: #e2e8f0; padding: 10px; border-radius: 4px; max-height: 300px; overflow-y: auto; margin: 10px 0;';
    
    console.log('✅ System Prompt panel updated');
}

function updateStreamingRoutingPanel(contentArea) {
    if (!contentArea) return;
    
    console.log('🔧 Updating Streaming Routing panel...');
    
    // Clear any system prompt content that might be there
    contentArea.innerHTML = '';
    
    // Add proper routing information
    const routingInfo = document.createElement('div');
    routingInfo.style.cssText = 'font-family: monospace; font-size: 12px; background: #2d3748; color: #e2e8f0; padding: 10px; border-radius: 4px; margin: 10px 0;';
    
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
    
    const currentAgent = streamingManager?.currentStreamingAgent || 'Default Agent';
    const availableAgents = agentRouter ? agentRouter.getRegisteredAgents().map(a => a.name).join(', ') : 'Loading...';
    const routingEnabled = streamingManager?.agentRoutingEnabled ? '✅ Enabled' : '❌ Disabled';
    
    routingInfo.innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong style="color: #4fd1c7;">🔄 Agent Routing Status</strong>
        </div>
        <div style="margin-bottom: 5px;">
            <strong>Status:</strong> <span style="color: #68d391;">${routingEnabled}</span>
        </div>
        <div style="margin-bottom: 5px;">
            <strong>Current Agent:</strong> <span style="color: #fbb6ce;">${currentAgent}</span>
        </div>
        <div style="margin-bottom: 5px;">
            <strong>Available Agents:</strong> <span style="color: #90cdf4;">${availableAgents}</span>
        </div>
        <div style="margin-bottom: 5px;">
            <strong>Last Update:</strong> <span style="color: #f6e05e;">${new Date().toLocaleTimeString()}</span>
        </div>
    `;
    
    contentArea.appendChild(routingInfo);
    
    console.log('✅ Streaming Routing panel updated');
}

function getAgentSystemPrompt() {
    // Try to get agent-specific prompt first
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    const currentAgent = streamingManager?.currentStreamingAgent;
    
    console.log('🔍 Getting system prompt for current agent:', currentAgent);
    
    // Check if we have agent configurations loaded
    if (currentAgent && currentAgent !== 'DefaultAgent' && window.agentConfigurations) {
        const agentConfig = window.agentConfigurations[currentAgent];
        
        if (agentConfig && agentConfig.systemPrompts) {
            console.log('✅ Using agent-specific system prompt for:', currentAgent);
            
            let prompt = '';
            
            if (agentConfig.systemPrompts.basePersonality) {
                prompt += `🤖 AGENT: ${currentAgent}\n`;
                prompt += `${agentConfig.systemPrompts.basePersonality}\n\n`;
            }
            
            if (agentConfig.systemPrompts.financialContext) {
                prompt += `💼 FINANCIAL CONTEXT:\n${agentConfig.systemPrompts.financialContext}\n\n`;
            }
            
            if (agentConfig.systemPrompts.responseInstructions) {
                prompt += `📋 RESPONSE INSTRUCTIONS:\n${agentConfig.systemPrompts.responseInstructions}\n\n`;
            }
            
            if (agentConfig.systemPrompts.customPrompts && agentConfig.systemPrompts.customPrompts.length > 0) {
                prompt += `🎯 SPECIALIZED INSTRUCTIONS:\n`;
                agentConfig.systemPrompts.customPrompts.forEach(cp => {
                    prompt += `• ${cp.name}: ${cp.prompt}\n`;
                });
                prompt += '\n';
            }
            
            // Add current persona context
            const personaData = window.personaManager?.getCurrentPersonaData();
            if (personaData) {
                prompt += `👤 CURRENT CUSTOMER: ${personaData.name || 'Customer'}\n`;
                if (personaData.balance !== undefined) {
                    prompt += `💰 Balance: £${personaData.balance}\n`;
                }
                if (personaData.accountType) {
                    prompt += `🏦 Account Type: ${personaData.accountType}\n`;
                }
            }
            
            return prompt;
        }
    }
    
    // Fallback to generic system prompt
    console.log('⚠️ Using fallback system prompt');
    
    const personaData = window.personaManager?.getCurrentPersonaData();
    let fallbackPrompt = `You are a helpful, professional, and friendly AI voice assistant for Barclays Bank (www.barclays.co.uk) a UK financial services company. You should be empathetic, clear in your communication, and engaging in conversation.

🔄 STREAMING MODE: ${streamingManager ? 'Active' : 'Inactive'}
🤖 CURRENT AGENT: ${currentAgent || 'Default Agent'}
🎯 AGENT ROUTING: ${streamingManager?.agentRoutingEnabled ? 'Enabled' : 'Disabled'}

Available Agents: PaymentsAgent, FraudAgent, IDVAgent, BankingInfoAgent`;

    if (personaData) {
        fallbackPrompt += `\n\n👤 CURRENT CUSTOMER: ${personaData.name || 'Customer'}`;
        if (personaData.balance !== undefined) {
            fallbackPrompt += `\n💰 Balance: £${personaData.balance}`;
        }
    }
    
    return fallbackPrompt;
}

function monitorAndUpdatePanels() {
    console.log('🔍 Starting panel monitoring...');
    
    let lastAgent = null;
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    setInterval(() => {
        const currentAgent = streamingManager?.currentStreamingAgent;
        
        if (currentAgent !== lastAgent) {
            console.log('🔄 Agent changed, updating panels:', lastAgent, '->', currentAgent);
            
            // Re-run the panel fix
            setTimeout(() => {
                forceSystemPromptInCorrectPanel();
            }, 500);
            
            lastAgent = currentAgent;
        }
    }, 2000);
}

// Make functions available globally
window.directDebugPanelFix = directDebugPanelFix;
window.forceSystemPromptInCorrectPanel = forceSystemPromptInCorrectPanel;
window.getAgentSystemPrompt = getAgentSystemPrompt;

console.log('🔧 Direct debug panel fix loaded');
console.log('Available functions:');
console.log('- directDebugPanelFix() - Apply the fix');
console.log('- forceSystemPromptInCorrectPanel() - Force correct content');
console.log('- getAgentSystemPrompt() - Get current agent prompt');
/**
 * Fix debug panel to show the last system prompt sent
 */

console.log('🔧 Loading debug system prompt fix...');

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        fixDebugSystemPrompt();
    }, 2000);
});

function fixDebugSystemPrompt() {
    console.log('🔧 Fixing debug system prompt display...');
    
    // Find the system prompt debug panel
    const systemPromptPanel = document.querySelector('[data-debug-section="system-prompt"]') ||
                             document.getElementById('systemPromptPanel') ||
                             document.querySelector('.debug-panel:has(h3:contains("System Prompt"))');
    
    if (systemPromptPanel) {
        const contentArea = systemPromptPanel.querySelector('.debug-content') || 
                           systemPromptPanel.querySelector('pre') ||
                           systemPromptPanel;
        
        if (contentArea) {
            // Show current system prompt
            updateSystemPromptDisplay(contentArea);
            console.log('✅ System prompt debug panel updated');
        }
    }
    
    // Hook into streaming manager to capture system prompts
    hookIntoSystemPromptUpdates();
}

function updateSystemPromptDisplay(contentArea) {
    // Get current system prompt from various sources
    let systemPrompt = getCurrentSystemPrompt();
    
    if (!systemPrompt) {
        systemPrompt = "System prompt will appear here when a conversation starts...";
    }
    
    // Update the display
    if (contentArea.tagName === 'PRE') {
        contentArea.textContent = systemPrompt;
    } else {
        contentArea.innerHTML = `<pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; background: #2d3748; color: #e2e8f0; padding: 10px; border-radius: 4px; max-height: 300px; overflow-y: auto;">${systemPrompt}</pre>`;
    }
}

function getCurrentSystemPrompt() {
    // Try to get from various sources
    
    // 1. From system prompts manager
    if (window.systemPromptsManager && typeof window.systemPromptsManager.generateSystemPrompt === 'function') {
        try {
            const currentPersona = window.personaManager?.getCurrentPersona() || 'john_doe';
            return window.systemPromptsManager.generateSystemPrompt(currentPersona);
        } catch (error) {
            console.log('Could not get system prompt from systemPromptsManager:', error);
        }
    }
    
    // 2. From speechApp
    if (window.speechApp && window.speechApp.systemPromptsManager) {
        try {
            const currentPersona = window.speechApp.personaManager?.getCurrentPersona() || 'john_doe';
            return window.speechApp.systemPromptsManager.generateSystemPrompt(currentPersona);
        } catch (error) {
            console.log('Could not get system prompt from speechApp:', error);
        }
    }
    
    // 3. From streaming manager's last session config
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    if (streamingManager && streamingManager.lastSessionConfig) {
        return streamingManager.lastSessionConfig.instructions;
    }
    
    // 4. Default fallback
    return `You are a helpful, professional, and friendly AI voice assistant for Barclays Bank (www.barclays.co.uk) a UK financial services company. You should be empathetic, clear in your communication, and engaging in conversation. Speak in a conversational tone while being informative and helpful.

Current Context: You are operating in streaming mode with agent routing enabled.
Available Agents: PaymentsAgent, FraudAgent, IDVAgent, BankingInfoAgent

Please provide helpful banking assistance while maintaining a professional and friendly tone.`;
}

function hookIntoSystemPromptUpdates() {
    // Hook into streaming manager's sendSessionConfig method
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (streamingManager && streamingManager.sendSessionConfig && !streamingManager.sendSessionConfig._promptHooked) {
        const originalSendSessionConfig = streamingManager.sendSessionConfig;
        
        streamingManager.sendSessionConfig = function() {
            const result = originalSendSessionConfig.call(this);
            
            // Capture the session config for debug display
            if (arguments.length > 0 && arguments[0] && arguments[0].session && arguments[0].session.instructions) {
                this.lastSessionConfig = arguments[0].session;
                console.log('🔧 Captured system prompt for debug display');
                
                // Update debug panel
                setTimeout(() => {
                    const systemPromptPanel = document.querySelector('[data-debug-section="system-prompt"]') ||
                                             document.getElementById('systemPromptPanel');
                    if (systemPromptPanel) {
                        const contentArea = systemPromptPanel.querySelector('.debug-content') || 
                                           systemPromptPanel.querySelector('pre') ||
                                           systemPromptPanel;
                        if (contentArea) {
                            updateSystemPromptDisplay(contentArea);
                        }
                    }
                }, 100);
            }
            
            return result;
        };
        
        streamingManager.sendSessionConfig._promptHooked = true;
        console.log('✅ Hooked into system prompt updates');
    }
}

// Make functions available globally
window.fixDebugSystemPrompt = fixDebugSystemPrompt;
window.updateSystemPromptDisplay = updateSystemPromptDisplay;

console.log('🔧 Debug system prompt fix loaded');
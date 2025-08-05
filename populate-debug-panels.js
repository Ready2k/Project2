/**
 * Populate debug panels with actual data
 * This ensures the debug panels show real information
 */

console.log('🔧 Loading debug panels population fix...');

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        populateDebugPanels();
    }, 3000);
});

function populateDebugPanels() {
    console.log('🔧 Populating debug panels...');
    
    // Fix 1: Populate System Prompt panel
    populateSystemPromptPanel();
    
    // Fix 2: Populate Streaming Agent Routing panel
    populateStreamingAgentRoutingPanel();
    
    // Fix 3: Hook into real-time updates
    setupRealTimeUpdates();
    
    console.log('✅ Debug panels populated');
}

function populateSystemPromptPanel() {
    // Find the system prompt panel more specifically
    const debugSections = document.querySelectorAll('h3, h4, .debug-section-title');
    let systemPromptPanel = null;
    
    debugSections.forEach(heading => {
        const text = heading.textContent || heading.innerText;
        if (text.includes('System Prompt to GPT')) {
            // Find the parent container
            systemPromptPanel = heading.closest('.debug-section') || heading.parentElement;
        }
    });
    
    // Also try finding by the yellow heading text
    if (!systemPromptPanel) {
        const yellowHeadings = document.querySelectorAll('[style*="color"], .debug-section-header');
        yellowHeadings.forEach(heading => {
            const text = heading.textContent || heading.innerText;
            if (text.includes('System Prompt to GPT')) {
                systemPromptPanel = heading.closest('.debug-section') || heading.parentElement;
            }
        });
    }
    
    if (systemPromptPanel) {
        // Find or create the content area - look for the dark box
        let contentArea = systemPromptPanel.querySelector('pre') || 
                         systemPromptPanel.querySelector('div[style*="#2d3748"]') ||
                         systemPromptPanel.querySelector('div[style*="background"]') ||
                         systemPromptPanel.querySelector('.debug-content');
        
        if (!contentArea) {
            // Create content area if it doesn't exist
            contentArea = document.createElement('pre');
            contentArea.style.cssText = 'white-space: pre-wrap; font-family: monospace; font-size: 12px; background: #2d3748; color: #e2e8f0; padding: 10px; border-radius: 4px; max-height: 300px; overflow-y: auto; margin: 10px 0;';
            systemPromptPanel.appendChild(contentArea);
        }
        
        // Clear any existing content
        contentArea.textContent = '';
        
        // Get current system prompt - try to get agent-specific one
        const systemPrompt = getAgentSpecificSystemPrompt();
        contentArea.textContent = systemPrompt;
        
        console.log('✅ System Prompt panel populated with agent-specific prompt');
    } else {
        console.log('❌ System Prompt panel not found');
    }
}

function populateStreamingAgentRoutingPanel() {
    // Find the streaming agent routing panel
    const debugPanels = document.querySelectorAll('.debug-section, .debug-panel');
    let routingPanel = null;
    
    debugPanels.forEach(panel => {
        const text = panel.textContent || panel.innerText;
        if (text.includes('Streaming Agent Routing')) {
            routingPanel = panel;
        }
    });
    
    if (routingPanel) {
        // Clear existing content and add our own
        const existingContent = routingPanel.querySelector('.debug-content') || routingPanel;
        
        // Create comprehensive routing info
        const routingInfo = document.createElement('div');
        routingInfo.className = 'streaming-routing-info';
        routingInfo.style.cssText = 'font-family: monospace; font-size: 12px; background: #2d3748; color: #e2e8f0; padding: 10px; border-radius: 4px; margin: 10px 0;';
        
        routingInfo.innerHTML = `
            <div style="margin-bottom: 15px;">
                <h4 style="color: #4fd1c7; margin: 0 0 10px 0;">🔄 Agent Routing Status</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <strong>Routing Enabled:</strong> <span id="routing-enabled" style="color: #68d391;">✅ Yes</span>
                    </div>
                    <div>
                        <strong>Current Agent:</strong> <span id="current-routing-agent" style="color: #fbb6ce;">Default Agent</span>
                    </div>
                    <div>
                        <strong>Available Agents:</strong> <span id="available-agents" style="color: #90cdf4;">Loading...</span>
                    </div>
                    <div>
                        <strong>Last Routing:</strong> <span id="last-routing-time" style="color: #f6e05e;">Ready</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <h4 style="color: #4fd1c7; margin: 0 0 10px 0;">📊 Routing Metrics</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                    <div>
                        <strong>Total Routes:</strong> <span id="total-routes" style="color: #68d391;">0</span>
                    </div>
                    <div>
                        <strong>Success Rate:</strong> <span id="success-rate" style="color: #68d391;">0%</span>
                    </div>
                    <div>
                        <strong>Avg Latency:</strong> <span id="avg-latency" style="color: #90cdf4;">0ms</span>
                    </div>
                </div>
            </div>
            
            <div>
                <h4 style="color: #4fd1c7; margin: 0 0 10px 0;">🔍 Recent Activity</h4>
                <div id="recent-activity" style="max-height: 150px; overflow-y: auto; background: #1a202c; padding: 8px; border-radius: 4px;">
                    <div style="color: #a0aec0; font-style: italic;">Waiting for routing activity...</div>
                </div>
            </div>
        `;
        
        // Clear any existing content that might be system prompts
        existingContent.innerHTML = '';
        existingContent.appendChild(routingInfo);
        
        // Update with real data
        updateRoutingPanelData();
        
        console.log('✅ Streaming Agent Routing panel populated');
    } else {
        console.log('❌ Streaming Agent Routing panel not found');
    }
}

function getAgentSpecificSystemPrompt() {
    // Try to get the current active agent's system prompt
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    const currentAgent = streamingManager?.currentStreamingAgent;
    
    console.log('🔍 Getting system prompt for agent:', currentAgent);
    
    // If we have an active agent, try to get its specific prompt
    if (currentAgent && currentAgent !== 'DefaultAgent' && window.agentConfigurations) {
        const agentConfig = window.agentConfigurations[currentAgent];
        
        if (agentConfig && agentConfig.systemPrompts) {
            console.log('✅ Found agent-specific system prompt for:', currentAgent);
            
            let agentPrompt = '';
            
            if (agentConfig.systemPrompts.basePersonality) {
                agentPrompt += agentConfig.systemPrompts.basePersonality + '\n\n';
            }
            
            if (agentConfig.systemPrompts.financialContext) {
                agentPrompt += agentConfig.systemPrompts.financialContext + '\n\n';
            }
            
            if (agentConfig.systemPrompts.responseInstructions) {
                agentPrompt += agentConfig.systemPrompts.responseInstructions + '\n\n';
            }
            
            // Add agent context
            agentPrompt += `\n🤖 ACTIVE AGENT: ${currentAgent}\n`;
            agentPrompt += `Description: ${agentConfig.description}\n\n`;
            
            // Add custom prompts
            if (agentConfig.systemPrompts.customPrompts && agentConfig.systemPrompts.customPrompts.length > 0) {
                agentPrompt += 'SPECIALIZED INSTRUCTIONS:\n';
                agentConfig.systemPrompts.customPrompts.forEach(cp => {
                    agentPrompt += `• ${cp.name}: ${cp.prompt}\n`;
                });
            }
            
            // Add persona context
            const personaData = window.personaManager?.getCurrentPersonaData();
            if (personaData) {
                agentPrompt += `\n👤 CURRENT CUSTOMER: ${personaData.name || 'Customer'}\n`;
                if (personaData.balance !== undefined) {
                    agentPrompt += `Account Balance: £${personaData.balance}\n`;
                }
                if (personaData.accountType) {
                    agentPrompt += `Account Type: ${personaData.accountType}\n`;
                }
            }
            
            return agentPrompt;
        }
    }
    
    // Fallback to generic system prompt
    return getCurrentSystemPrompt();
}

function getCurrentSystemPrompt() {
    // Try multiple sources for the system prompt
    
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
    
    // 3. Default system prompt
    return `You are a helpful, professional, and friendly AI voice assistant for Barclays Bank (www.barclays.co.uk) a UK financial services company. You should be empathetic, clear in your communication, and engaging in conversation. Speak in a conversational tone while being informative and helpful.

🔄 STREAMING MODE ACTIVE
Agent Routing: ENABLED
Available Agents: PaymentsAgent, FraudAgent, IDVAgent, BankingInfoAgent

Current Context: You are operating in streaming mode with intelligent agent routing. When users mention specific banking needs, you will be routed to specialized agents for optimal assistance.

Please provide helpful banking assistance while maintaining a professional and friendly tone.`;
}

function updateRoutingPanelData() {
    // Update available agents
    const availableAgentsElement = document.getElementById('available-agents');
    if (availableAgentsElement) {
        const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
        if (agentRouter) {
            const agents = agentRouter.getRegisteredAgents();
            availableAgentsElement.textContent = agents.map(a => a.name).join(', ');
        }
    }
    
    // Update current agent
    const currentAgentElement = document.getElementById('current-routing-agent');
    if (currentAgentElement) {
        const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
        const currentAgent = streamingManager?.currentStreamingAgent || 'Default Agent';
        currentAgentElement.textContent = currentAgent;
    }
    
    // Update last routing time
    const lastRoutingElement = document.getElementById('last-routing-time');
    if (lastRoutingElement) {
        lastRoutingElement.textContent = new Date().toLocaleTimeString();
    }
}

function setupRealTimeUpdates() {
    // Monitor for agent routing events and update panels
    let routingCount = 0;
    let successCount = 0;
    
    // Hook into agent routing to capture events
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (streamingManager && streamingManager.routeThroughAgentsWithErrorHandling) {
        const originalMethod = streamingManager.routeThroughAgentsWithErrorHandling;
        
        streamingManager.routeThroughAgentsWithErrorHandling = async function(transcript) {
            const startTime = Date.now();
            routingCount++;
            
            try {
                const result = await originalMethod.call(this, transcript);
                const latency = Date.now() - startTime;
                
                if (result && !result.error) {
                    successCount++;
                }
                
                // Update metrics
                updateMetrics(routingCount, successCount, latency, this.currentStreamingAgent);
                
                // Add to recent activity
                addRecentActivity(`Routed "${transcript.substring(0, 30)}..." to ${this.currentStreamingAgent || 'Default'} (${latency}ms)`);
                
                return result;
            } catch (error) {
                const latency = Date.now() - startTime;
                updateMetrics(routingCount, successCount, latency, 'Error');
                addRecentActivity(`❌ Routing failed for "${transcript.substring(0, 30)}..." (${latency}ms)`);
                throw error;
            }
        };
        
        console.log('✅ Real-time routing monitoring enabled');
    }
}

function updateMetrics(totalRoutes, successCount, latency, currentAgent) {
    // Update total routes
    const totalRoutesElement = document.getElementById('total-routes');
    if (totalRoutesElement) {
        totalRoutesElement.textContent = totalRoutes;
    }
    
    // Update success rate
    const successRateElement = document.getElementById('success-rate');
    if (successRateElement) {
        const rate = totalRoutes > 0 ? Math.round((successCount / totalRoutes) * 100) : 0;
        successRateElement.textContent = `${rate}%`;
    }
    
    // Update average latency (simplified)
    const avgLatencyElement = document.getElementById('avg-latency');
    if (avgLatencyElement) {
        avgLatencyElement.textContent = `${latency}ms`;
    }
    
    // Update current agent
    const currentAgentElement = document.getElementById('current-routing-agent');
    if (currentAgentElement && currentAgent) {
        currentAgentElement.textContent = currentAgent;
    }
}

function addRecentActivity(activity) {
    const recentActivityElement = document.getElementById('recent-activity');
    if (recentActivityElement) {
        const timestamp = new Date().toLocaleTimeString();
        const activityDiv = document.createElement('div');
        activityDiv.style.cssText = 'margin-bottom: 5px; padding: 3px 0; border-bottom: 1px solid #2d3748;';
        activityDiv.innerHTML = `<span style="color: #a0aec0;">[${timestamp}]</span> ${activity}`;
        
        // Add to top
        recentActivityElement.insertBefore(activityDiv, recentActivityElement.firstChild);
        
        // Keep only last 10 activities
        while (recentActivityElement.children.length > 10) {
            recentActivityElement.removeChild(recentActivityElement.lastChild);
        }
    }
}

// Monitor for agent changes and update system prompt panel
function monitorAgentChangesForPrompt() {
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (!streamingManager) {
        return;
    }
    
    let lastAgent = streamingManager.currentStreamingAgent;
    
    setInterval(() => {
        const currentAgent = streamingManager.currentStreamingAgent;
        
        if (currentAgent !== lastAgent) {
            console.log('🔄 Agent changed, updating system prompt panel:', lastAgent, '->', currentAgent);
            
            // Update the system prompt panel with the new agent's prompt
            setTimeout(() => {
                populateSystemPromptPanel();
            }, 500);
            
            lastAgent = currentAgent;
        }
    }, 1000);
}

// Start monitoring after a delay
setTimeout(() => {
    monitorAgentChangesForPrompt();
}, 4000);

// Make functions available globally
window.populateDebugPanels = populateDebugPanels;
window.updateRoutingPanelData = updateRoutingPanelData;
window.getAgentSpecificSystemPrompt = getAgentSpecificSystemPrompt;
window.monitorAgentChangesForPrompt = monitorAgentChangesForPrompt;

console.log('🔧 Debug panels population fix loaded');
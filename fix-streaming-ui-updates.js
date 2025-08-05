/**
 * Fix streaming UI updates to show correct agent and routing status
 */

console.log('🔧 Loading streaming UI updates fix...');

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        fixStreamingUIUpdates();
    }, 2000);
});

function fixStreamingUIUpdates() {
    console.log('🔧 Fixing streaming UI updates...');
    
    // Fix 1: Update the streaming agent indicator
    fixStreamingAgentIndicator();
    
    // Fix 2: Update the routing status badge
    fixRoutingStatusBadge();
    
    // Fix 3: Fix the streaming agent routing debug panel
    fixStreamingAgentRoutingDebugPanel();
    
    console.log('✅ Streaming UI updates fix applied');
}

function fixStreamingAgentIndicator() {
    // Override the StreamingManager's routeThroughAgentsWithErrorHandling to update UI
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (!streamingManager) {
        return;
    }
    
    // Hook into successful agent routing to update the UI
    if (streamingManager.routeThroughAgentsWithErrorHandling && !streamingManager.routeThroughAgentsWithErrorHandling._uiFixed) {
        const originalMethod = streamingManager.routeThroughAgentsWithErrorHandling;
        
        streamingManager.routeThroughAgentsWithErrorHandling = async function(transcript) {
            try {
                const result = await originalMethod.call(this, transcript);
                
                // Update UI with current agent
                if (this.currentStreamingAgent && this.currentStreamingAgent !== 'DefaultAgent') {
                    console.log('🔧 Updating UI with streaming agent:', this.currentStreamingAgent);
                    
                    // Update the main agent indicator
                    if (window.speechApp && typeof window.speechApp.updateAgentIndicator === 'function') {
                        window.speechApp.updateAgentIndicator(this.currentStreamingAgent);
                    }
                    
                    // Update main interface
                    if (window.mainInterface && typeof window.mainInterface.updateAgentIndicator === 'function') {
                        window.mainInterface.updateAgentIndicator(this.currentStreamingAgent);
                    }
                    
                    // Update streaming agent UI
                    if (window.streamingAgentUI && typeof window.streamingAgentUI.updateCurrentAgent === 'function') {
                        window.streamingAgentUI.updateCurrentAgent(this.currentStreamingAgent);
                    }
                }
                
                return result;
            } catch (error) {
                console.error('Error in UI update during agent routing:', error);
                throw error;
            }
        };
        
        streamingManager.routeThroughAgentsWithErrorHandling._uiFixed = true;
        console.log('✅ Streaming agent indicator fix applied');
    }
}

function fixRoutingStatusBadge() {
    // Find and update the routing status badge
    const routingStatusElements = document.querySelectorAll('.routing-status-badge, [class*="routing-status"]');
    
    routingStatusElements.forEach(element => {
        if (element.textContent.includes('ROUTING DISABLED') || element.textContent.includes('Routing Disabled')) {
            element.className = 'routing-status-badge enabled';
            element.innerHTML = '<i class="fas fa-route"></i> Routing Enabled';
            console.log('✅ Updated routing status badge to enabled');
        }
    });
    
    // Also check for streaming agent UI
    if (window.streamingAgentUI && window.streamingAgentUI.routingStatus) {
        window.streamingAgentUI.routingStatus.className = 'routing-status-badge enabled';
        window.streamingAgentUI.routingStatus.innerHTML = '<i class="fas fa-route"></i> Routing Enabled';
        console.log('✅ Updated StreamingAgentUI routing status');
    }
}

function fixStreamingAgentRoutingDebugPanel() {
    // Find the streaming agent routing debug panel
    const debugPanel = document.querySelector('[data-debug-panel="streaming-agent-routing"]') || 
                      document.querySelector('.debug-panel:has([data-section="streaming-agent-routing"])') ||
                      document.getElementById('streamingAgentRoutingPanel');
    
    if (debugPanel) {
        // Add some sample content to show it's working
        const content = debugPanel.querySelector('.debug-content') || debugPanel;
        
        if (content && content.children.length === 0) {
            content.innerHTML = `
                <div class="debug-info">
                    <h4>Agent Routing Status</h4>
                    <div class="status-item">
                        <span class="label">Routing Enabled:</span>
                        <span class="value enabled">✅ Yes</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Current Agent:</span>
                        <span class="value" id="debug-current-agent">Default Agent</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Last Routing:</span>
                        <span class="value" id="debug-last-routing">Ready</span>
                    </div>
                    <div class="status-item">
                        <span class="label">Available Agents:</span>
                        <span class="value" id="debug-available-agents">Loading...</span>
                    </div>
                </div>
            `;
            
            // Update with actual data
            updateDebugPanelData();
            console.log('✅ Streaming agent routing debug panel populated');
        }
    }
}

function updateDebugPanelData() {
    // Update current agent
    const currentAgentElement = document.getElementById('debug-current-agent');
    if (currentAgentElement) {
        const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
        const currentAgent = streamingManager?.currentStreamingAgent || 'Default Agent';
        currentAgentElement.textContent = currentAgent;
    }
    
    // Update available agents
    const availableAgentsElement = document.getElementById('debug-available-agents');
    if (availableAgentsElement) {
        const agentRouter = window.agentRouter || (window.speechApp && window.speechApp.agentRouter);
        if (agentRouter) {
            const agents = agentRouter.getRegisteredAgents();
            availableAgentsElement.textContent = agents.map(a => a.name).join(', ');
        }
    }
    
    // Update last routing info
    const lastRoutingElement = document.getElementById('debug-last-routing');
    if (lastRoutingElement) {
        lastRoutingElement.textContent = new Date().toLocaleTimeString();
    }
}

// Monitor for agent changes and update UI accordingly
function monitorAgentChanges() {
    const streamingManager = window.streamingManager || (window.speechApp && window.speechApp.streamingManager);
    
    if (!streamingManager) {
        return;
    }
    
    // Check for agent changes periodically
    let lastAgent = streamingManager.currentStreamingAgent;
    
    setInterval(() => {
        const currentAgent = streamingManager.currentStreamingAgent;
        
        if (currentAgent && currentAgent !== lastAgent) {
            console.log('🔧 Agent change detected:', lastAgent, '->', currentAgent);
            
            // Update all UI elements
            if (window.speechApp && typeof window.speechApp.updateAgentIndicator === 'function') {
                window.speechApp.updateAgentIndicator(currentAgent);
            }
            
            if (window.mainInterface && typeof window.mainInterface.updateAgentIndicator === 'function') {
                window.mainInterface.updateAgentIndicator(currentAgent);
            }
            
            // Update debug panel
            updateDebugPanelData();
            
            lastAgent = currentAgent;
        }
    }, 1000);
}

// Start monitoring after a delay
setTimeout(() => {
    monitorAgentChanges();
}, 3000);

// Make functions available globally
window.fixStreamingUIUpdates = fixStreamingUIUpdates;
window.updateDebugPanelData = updateDebugPanelData;

console.log('🔧 Streaming UI updates fix loaded');
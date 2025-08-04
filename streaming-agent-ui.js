/**
 * Streaming Agent UI Manager
 * Handles UI updates for streaming agent routing integration
 */
class StreamingAgentUI {
    constructor() {
        this.isStreamingMode = false;
        this.currentAgent = 'DefaultAgent';
        this.agentType = 'General';
        this.routingEnabled = false;
        this.isAgentSwitching = false;
        
        // Debug information storage
        this.routingHistory = [];
        this.performanceMetrics = {
            routingLatency: [],
            agentSwitches: 0,
            fallbackCount: 0,
            lastUpdate: null
        };
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        // Main agent indicator elements
        this.currentAgentElement = document.getElementById('currentAgent');
        this.agentSwitchingIndicator = document.getElementById('agentSwitchingIndicator');
        
        // Streaming-specific elements
        this.streamingAgentStatus = document.getElementById('streamingAgentStatus');
        this.streamingCurrentAgent = document.getElementById('streamingCurrentAgent');
        this.streamingAgentType = document.getElementById('streamingAgentType');
        this.routingStatus = document.getElementById('routingStatus');
        
        // Debug panel elements
        this.streamingAgentDebug = document.getElementById('streamingAgentDebug');
        this.streamingRoutingState = document.getElementById('streamingRoutingState');
        this.streamingAgentDecisions = document.getElementById('streamingAgentDecisions');
        this.streamingPerformanceMetrics = document.getElementById('streamingPerformanceMetrics');
    }

    setupEventListeners() {
        // Listen for streaming mode changes
        const streamingModeToggle = document.getElementById('streamingMode');
        if (streamingModeToggle) {
            streamingModeToggle.addEventListener('change', (e) => {
                this.setStreamingMode(e.target.checked);
            });
            
            // Initialize with current state
            this.setStreamingMode(streamingModeToggle.checked);
        }
    }

    /**
     * Set streaming mode and update UI accordingly
     */
    setStreamingMode(enabled) {
        this.isStreamingMode = enabled;
        
        if (enabled) {
            this.showStreamingAgentStatus();
            this.showStreamingDebugPanel();
        } else {
            this.hideStreamingAgentStatus();
            this.hideStreamingDebugPanel();
        }
        
        this.updateRoutingStatus();
    }

    /**
     * Update the current active agent
     */
    updateCurrentAgent(agentName, agentType = null) {
        const previousAgent = this.currentAgent;
        this.currentAgent = agentName;
        
        if (agentType) {
            this.agentType = agentType;
        } else {
            // Infer agent type from name
            this.agentType = this.inferAgentType(agentName);
        }

        // Update main agent indicator
        if (this.currentAgentElement) {
            this.currentAgentElement.textContent = this.formatAgentName(agentName);
            this.updateAgentStyling(this.currentAgentElement, agentName);
        }

        // Update streaming-specific elements if in streaming mode
        if (this.isStreamingMode) {
            if (this.streamingCurrentAgent) {
                this.streamingCurrentAgent.textContent = this.formatAgentName(agentName);
                this.updateAgentStyling(this.streamingCurrentAgent, agentName);
            }
            
            if (this.streamingAgentType) {
                this.streamingAgentType.textContent = this.agentType;
                this.updateAgentTypeStyling(this.streamingAgentType, this.agentType);
            }
        }

        // Track agent switch for metrics
        if (previousAgent !== agentName) {
            this.performanceMetrics.agentSwitches++;
            this.logAgentDecision(`Agent switched from ${previousAgent} to ${agentName}`, 'switch');
        }

        // Update debug information
        this.updateDebugInformation();
    }

    /**
     * Show agent switching loading state
     */
    showAgentSwitching() {
        this.isAgentSwitching = true;
        
        if (this.agentSwitchingIndicator) {
            this.agentSwitchingIndicator.classList.remove('hidden');
        }
        
        if (this.routingStatus) {
            this.routingStatus.className = 'routing-status-badge processing';
            this.routingStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Processing';
        }
        
        this.logAgentDecision('Agent switching initiated', 'switching');
    }

    /**
     * Hide agent switching loading state
     */
    hideAgentSwitching() {
        this.isAgentSwitching = false;
        
        if (this.agentSwitchingIndicator) {
            this.agentSwitchingIndicator.classList.add('hidden');
        }
        
        this.updateRoutingStatus();
        this.logAgentDecision('Agent switching completed', 'switched');
    }

    /**
     * Update routing status indicator
     */
    updateRoutingStatus() {
        if (!this.routingStatus) return;
        
        if (this.isAgentSwitching) {
            this.routingStatus.className = 'routing-status-badge processing';
            this.routingStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Processing';
        } else if (this.routingEnabled && this.isStreamingMode) {
            this.routingStatus.className = 'routing-status-badge enabled';
            this.routingStatus.innerHTML = '<i class="fas fa-route"></i> Routing Enabled';
        } else {
            this.routingStatus.className = 'routing-status-badge disabled';
            this.routingStatus.innerHTML = '<i class="fas fa-route"></i> Routing Disabled';
        }
    }

    /**
     * Enable/disable agent routing
     */
    setRoutingEnabled(enabled) {
        this.routingEnabled = enabled;
        this.updateRoutingStatus();
        
        const status = enabled ? 'enabled' : 'disabled';
        this.logRoutingState(`Agent routing ${status}`);
    }

    /**
     * Show streaming agent status section
     */
    showStreamingAgentStatus() {
        if (this.streamingAgentStatus) {
            this.streamingAgentStatus.style.display = 'flex';
        }
    }

    /**
     * Hide streaming agent status section
     */
    hideStreamingAgentStatus() {
        if (this.streamingAgentStatus) {
            this.streamingAgentStatus.style.display = 'none';
        }
    }

    /**
     * Show streaming debug panel
     */
    showStreamingDebugPanel() {
        if (this.streamingAgentDebug) {
            this.streamingAgentDebug.style.display = 'block';
        }
    }

    /**
     * Hide streaming debug panel
     */
    hideStreamingDebugPanel() {
        if (this.streamingAgentDebug) {
            this.streamingAgentDebug.style.display = 'none';
        }
    }

    /**
     * Log routing state information
     */
    logRoutingState(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        
        this.routingHistory.unshift(logEntry);
        if (this.routingHistory.length > 50) {
            this.routingHistory = this.routingHistory.slice(0, 50);
        }
        
        this.updateRoutingStateDisplay();
    }

    /**
     * Log agent decision information
     */
    logAgentDecision(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
        
        this.routingHistory.unshift(logEntry);
        if (this.routingHistory.length > 50) {
            this.routingHistory = this.routingHistory.slice(0, 50);
        }
        
        this.updateAgentDecisionsDisplay();
    }

    /**
     * Add performance metric
     */
    addPerformanceMetric(type, value) {
        const timestamp = Date.now();
        
        switch (type) {
            case 'routingLatency':
                this.performanceMetrics.routingLatency.push({ value, timestamp });
                if (this.performanceMetrics.routingLatency.length > 100) {
                    this.performanceMetrics.routingLatency = this.performanceMetrics.routingLatency.slice(-100);
                }
                break;
            case 'fallback':
                this.performanceMetrics.fallbackCount++;
                break;
        }
        
        this.performanceMetrics.lastUpdate = timestamp;
        this.updatePerformanceMetricsDisplay();
    }

    /**
     * Update debug information displays
     */
    updateDebugInformation() {
        this.updateRoutingStateDisplay();
        this.updateAgentDecisionsDisplay();
        this.updatePerformanceMetricsDisplay();
    }

    /**
     * Update routing state display
     */
    updateRoutingStateDisplay() {
        if (!this.streamingRoutingState) return;
        
        const state = {
            streamingMode: this.isStreamingMode,
            routingEnabled: this.routingEnabled,
            currentAgent: this.currentAgent,
            agentType: this.agentType,
            isAgentSwitching: this.isAgentSwitching
        };
        
        this.streamingRoutingState.textContent = JSON.stringify(state, null, 2);
    }

    /**
     * Update agent decisions display
     */
    updateAgentDecisionsDisplay() {
        if (!this.streamingAgentDecisions) return;
        
        const recentDecisions = this.routingHistory.slice(0, 10);
        this.streamingAgentDecisions.innerHTML = recentDecisions.join('\n') || 'No recent decisions...';
    }

    /**
     * Update performance metrics display
     */
    updatePerformanceMetricsDisplay() {
        if (!this.streamingPerformanceMetrics) return;
        
        const avgLatency = this.calculateAverageLatency();
        const metrics = {
            averageRoutingLatency: `${avgLatency}ms`,
            totalAgentSwitches: this.performanceMetrics.agentSwitches,
            fallbackCount: this.performanceMetrics.fallbackCount,
            lastUpdate: this.performanceMetrics.lastUpdate ? 
                new Date(this.performanceMetrics.lastUpdate).toLocaleTimeString() : 'Never'
        };
        
        this.streamingPerformanceMetrics.textContent = JSON.stringify(metrics, null, 2);
    }

    /**
     * Calculate average routing latency
     */
    calculateAverageLatency() {
        if (this.performanceMetrics.routingLatency.length === 0) return 0;
        
        const sum = this.performanceMetrics.routingLatency.reduce((acc, metric) => acc + metric.value, 0);
        return Math.round(sum / this.performanceMetrics.routingLatency.length);
    }

    /**
     * Format agent name for display
     */
    formatAgentName(agentName) {
        // Convert from class names like 'FraudAgent' to display names like 'Fraud Agent'
        return agentName
            .replace(/Agent$/, '')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .replace(/^./, str => str.toUpperCase()) + ' Agent';
    }

    /**
     * Infer agent type from agent name
     */
    inferAgentType(agentName) {
        const typeMap = {
            'FraudAgent': 'Security',
            'PaymentsAgent': 'Payments',
            'IDVAgent': 'Verification',
            'BankingInfoAgent': 'Information',
            'DefaultAgent': 'General',
            'MultiAgentOrchestrator': 'Orchestrator'
        };
        
        return typeMap[agentName] || 'General';
    }

    /**
     * Update agent-specific styling
     */
    updateAgentStyling(element, agentName) {
        if (!element) return;
        
        // Remove existing agent classes
        element.className = element.className.replace(/agent-\w+/g, '');
        
        // Add new agent class
        const agentClass = agentName.toLowerCase().replace(/agent$/, '') + 'agent';
        element.classList.add(`agent-${agentClass}`);
    }

    /**
     * Update agent type styling
     */
    updateAgentTypeStyling(element, agentType) {
        if (!element) return;
        
        // Remove existing type classes
        element.className = element.className.replace(/\b(security|payments|verification|information|general)\b/g, '');
        
        // Add new type class
        const typeClass = agentType.toLowerCase();
        element.classList.add(typeClass);
    }

    /**
     * Reset all metrics and history
     */
    reset() {
        this.routingHistory = [];
        this.performanceMetrics = {
            routingLatency: [],
            agentSwitches: 0,
            fallbackCount: 0,
            lastUpdate: null
        };
        
        this.updateDebugInformation();
    }

    /**
     * Get current state for external access
     */
    getState() {
        return {
            isStreamingMode: this.isStreamingMode,
            currentAgent: this.currentAgent,
            agentType: this.agentType,
            routingEnabled: this.routingEnabled,
            isAgentSwitching: this.isAgentSwitching,
            performanceMetrics: { ...this.performanceMetrics },
            routingHistoryCount: this.routingHistory.length
        };
    }
}

// Initialize the streaming agent UI manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.streamingAgentUI = new StreamingAgentUI();
    console.log('[StreamingAgentUI] Initialized streaming agent UI manager');
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingAgentUI;
}
/**
 * AgentTelemetry - Global telemetry system for tracking agent performance and usage
 * Provides centralized metrics collection and debugging features
 */
class AgentTelemetry {
    constructor() {
        this.debug = window.debugManager.createModuleLogger('AgentTelemetry');
        this.enabled = localStorage.getItem('agent_telemetry_enabled') === 'true' || false;
        
        // Global metrics storage
        this.globalMetrics = {
            totalActivations: 0,
            totalCompletions: 0,
            totalProcessingTime: 0,
            totalTokensUsed: 0,
            totalSuccesses: 0,
            totalErrors: 0,
            sessionStartTime: Date.now(),
            lastActivity: null
        };
        
        // Per-agent metrics storage
        this.agentMetrics = new Map();
        
        // Request history for debugging
        this.requestHistory = [];
        this.maxHistorySize = 100;
        
        // Performance tracking
        this.performanceThresholds = {
            slowProcessingTime: 5000, // 5 seconds
            highTokenUsage: 1000,     // 1000 tokens
            errorRateThreshold: 0.1   // 10% error rate
        };
        
        this.debug.info('Agent telemetry system initialized', {
            enabled: this.enabled,
            thresholds: this.performanceThresholds
        });
    }
    
    /**
     * Enable telemetry collection
     */
    enable() {
        this.enabled = true;
        localStorage.setItem('agent_telemetry_enabled', 'true');
        this.debug.info('Agent telemetry enabled');
    }
    
    /**
     * Disable telemetry collection
     */
    disable() {
        this.enabled = false;
        localStorage.setItem('agent_telemetry_enabled', 'false');
        this.debug.info('Agent telemetry disabled');
    }
    
    /**
     * Toggle telemetry collection
     * @returns {boolean} - New enabled state
     */
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.enabled;
    }
    
    /**
     * Check if telemetry is enabled
     * @returns {boolean} - True if telemetry is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    
    /**
     * Record agent activation
     * @param {string} agentName - Name of the activated agent
     * @param {Object} activationData - Activation telemetry data
     */
    recordActivation(agentName, activationData) {
        if (!this.enabled) return;
        
        // Update global metrics
        this.globalMetrics.totalActivations++;
        this.globalMetrics.lastActivity = activationData.timestamp;
        
        // Update per-agent metrics
        if (!this.agentMetrics.has(agentName)) {
            this.agentMetrics.set(agentName, {
                name: agentName,
                activations: 0,
                completions: 0,
                totalProcessingTime: 0,
                totalTokensUsed: 0,
                successCount: 0,
                errorCount: 0,
                averageProcessingTime: 0,
                averageTokensUsed: 0,
                successRate: 0,
                errorRate: 0,
                firstActivated: activationData.timestamp,
                lastActivated: activationData.timestamp,
                recentRequests: []
            });
        }
        
        const agentMetric = this.agentMetrics.get(agentName);
        agentMetric.activations++;
        agentMetric.lastActivated = activationData.timestamp;
        
        // Add to request history
        this.requestHistory.unshift({
            type: 'activation',
            agentName,
            timestamp: activationData.timestamp,
            inputPreview: activationData.inputPreview,
            data: activationData
        });
        
        // Trim history if needed
        if (this.requestHistory.length > this.maxHistorySize) {
            this.requestHistory.pop();
        }
        
        this.debug.info('Agent activation recorded', {
            agentName,
            totalActivations: this.globalMetrics.totalActivations,
            agentActivations: agentMetric.activations
        });
    }
    
    /**
     * Record agent completion
     * @param {string} agentName - Name of the completed agent
     * @param {Object} completionData - Completion telemetry data
     */
    recordCompletion(agentName, completionData) {
        if (!this.enabled) return;
        
        // Update global metrics
        this.globalMetrics.totalCompletions++;
        this.globalMetrics.totalProcessingTime += completionData.processingTime;
        this.globalMetrics.totalTokensUsed += completionData.tokensUsed;
        this.globalMetrics.lastActivity = completionData.timestamp;
        
        if (completionData.success) {
            this.globalMetrics.totalSuccesses++;
        } else {
            this.globalMetrics.totalErrors++;
        }
        
        // Update per-agent metrics
        const agentMetric = this.agentMetrics.get(agentName);
        if (agentMetric) {
            agentMetric.completions++;
            agentMetric.totalProcessingTime += completionData.processingTime;
            agentMetric.totalTokensUsed += completionData.tokensUsed;
            
            if (completionData.success) {
                agentMetric.successCount++;
            } else {
                agentMetric.errorCount++;
            }
            
            // Calculate rates and averages
            agentMetric.averageProcessingTime = agentMetric.totalProcessingTime / agentMetric.completions;
            agentMetric.averageTokensUsed = agentMetric.totalTokensUsed / agentMetric.completions;
            agentMetric.successRate = agentMetric.successCount / agentMetric.completions;
            agentMetric.errorRate = agentMetric.errorCount / agentMetric.completions;
            
            // Track recent requests
            agentMetric.recentRequests.unshift({
                timestamp: completionData.timestamp,
                success: completionData.success,
                processingTime: completionData.processingTime,
                tokensUsed: completionData.tokensUsed,
                inputLength: completionData.inputLength,
                responseLength: completionData.responseLength
            });
            
            // Keep only last 20 requests per agent
            if (agentMetric.recentRequests.length > 20) {
                agentMetric.recentRequests.pop();
            }
        }
        
        // Add to request history
        this.requestHistory.unshift({
            type: 'completion',
            agentName,
            timestamp: completionData.timestamp,
            success: completionData.success,
            processingTime: completionData.processingTime,
            tokensUsed: completionData.tokensUsed,
            data: completionData
        });
        
        // Trim history if needed
        if (this.requestHistory.length > this.maxHistorySize) {
            this.requestHistory.pop();
        }
        
        // Check for performance issues
        this._checkPerformanceAlerts(agentName, completionData);
        
        this.debug.info('Agent completion recorded', {
            agentName,
            success: completionData.success,
            processingTime: completionData.processingTime,
            tokensUsed: completionData.tokensUsed,
            totalCompletions: this.globalMetrics.totalCompletions
        });
    }
    
    /**
     * Check for performance alerts and log warnings
     * @private
     * @param {string} agentName - Name of the agent
     * @param {Object} completionData - Completion data to check
     */
    _checkPerformanceAlerts(agentName, completionData) {
        const alerts = [];
        
        // Check processing time
        if (completionData.processingTime > this.performanceThresholds.slowProcessingTime) {
            alerts.push(`Slow processing time: ${completionData.processingTime}ms`);
        }
        
        // Check token usage
        if (completionData.tokensUsed > this.performanceThresholds.highTokenUsage) {
            alerts.push(`High token usage: ${completionData.tokensUsed} tokens`);
        }
        
        // Check error rate for this agent
        const agentMetric = this.agentMetrics.get(agentName);
        if (agentMetric && agentMetric.errorRate > this.performanceThresholds.errorRateThreshold) {
            alerts.push(`High error rate: ${(agentMetric.errorRate * 100).toFixed(1)}%`);
        }
        
        if (alerts.length > 0) {
            this.debug.warn('Performance alerts for agent', {
                agentName,
                alerts,
                completionData
            });
        }
    }
    
    /**
     * Get global telemetry metrics
     * @returns {Object} - Global metrics summary
     */
    getGlobalMetrics() {
        const sessionDuration = Date.now() - this.globalMetrics.sessionStartTime;
        const globalSuccessRate = this.globalMetrics.totalCompletions > 0 
            ? this.globalMetrics.totalSuccesses / this.globalMetrics.totalCompletions 
            : 0;
        const globalErrorRate = this.globalMetrics.totalCompletions > 0 
            ? this.globalMetrics.totalErrors / this.globalMetrics.totalCompletions 
            : 0;
        const averageProcessingTime = this.globalMetrics.totalCompletions > 0 
            ? this.globalMetrics.totalProcessingTime / this.globalMetrics.totalCompletions 
            : 0;
        const averageTokensUsed = this.globalMetrics.totalCompletions > 0 
            ? this.globalMetrics.totalTokensUsed / this.globalMetrics.totalCompletions 
            : 0;
        
        return {
            ...this.globalMetrics,
            sessionDuration,
            globalSuccessRate,
            globalErrorRate,
            averageProcessingTime,
            averageTokensUsed,
            activeAgents: this.agentMetrics.size,
            enabled: this.enabled
        };
    }
    
    /**
     * Get metrics for a specific agent
     * @param {string} agentName - Name of the agent
     * @returns {Object|null} - Agent metrics or null if not found
     */
    getAgentMetrics(agentName) {
        return this.agentMetrics.get(agentName) || null;
    }
    
    /**
     * Get metrics for all agents
     * @returns {Array<Object>} - Array of agent metrics
     */
    getAllAgentMetrics() {
        return Array.from(this.agentMetrics.values());
    }
    
    /**
     * Get request history
     * @param {Object} filters - Optional filters
     * @returns {Array<Object>} - Filtered request history
     */
    getRequestHistory(filters = {}) {
        let history = [...this.requestHistory];
        
        if (filters.agentName) {
            history = history.filter(req => req.agentName === filters.agentName);
        }
        
        if (filters.type) {
            history = history.filter(req => req.type === filters.type);
        }
        
        if (filters.success !== undefined) {
            history = history.filter(req => req.success === filters.success);
        }
        
        if (filters.limit) {
            history = history.slice(0, filters.limit);
        }
        
        return history;
    }
    
    /**
     * Get performance summary for debugging
     * @returns {Object} - Performance summary
     */
    getPerformanceSummary() {
        const globalMetrics = this.getGlobalMetrics();
        const agentMetrics = this.getAllAgentMetrics();
        
        // Find top performing agents
        const topAgentsByActivations = agentMetrics
            .sort((a, b) => b.activations - a.activations)
            .slice(0, 5);
        
        const topAgentsBySuccessRate = agentMetrics
            .filter(a => a.completions > 0)
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, 5);
        
        const slowestAgents = agentMetrics
            .filter(a => a.completions > 0)
            .sort((a, b) => b.averageProcessingTime - a.averageProcessingTime)
            .slice(0, 5);
        
        return {
            global: globalMetrics,
            topAgentsByActivations,
            topAgentsBySuccessRate,
            slowestAgents,
            thresholds: this.performanceThresholds,
            recentErrors: this.getRequestHistory({ success: false, limit: 10 })
        };
    }
    
    /**
     * Reset all telemetry data
     */
    reset() {
        this.globalMetrics = {
            totalActivations: 0,
            totalCompletions: 0,
            totalProcessingTime: 0,
            totalTokensUsed: 0,
            totalSuccesses: 0,
            totalErrors: 0,
            sessionStartTime: Date.now(),
            lastActivity: null
        };
        
        this.agentMetrics.clear();
        this.requestHistory = [];
        
        this.debug.info('Agent telemetry data reset');
    }
    
    /**
     * Export telemetry data for analysis
     * @returns {Object} - Complete telemetry data export
     */
    exportData() {
        return {
            global: this.getGlobalMetrics(),
            agents: this.getAllAgentMetrics(),
            history: this.requestHistory,
            thresholds: this.performanceThresholds,
            exportTimestamp: new Date().toISOString()
        };
    }
    
    /**
     * Generate debug report showing which agents handled recent requests
     * @param {number} limit - Number of recent requests to include
     * @returns {string} - Formatted debug report
     */
    generateDebugReport(limit = 20) {
        const recentHistory = this.getRequestHistory({ limit });
        
        let report = `\n=== AGENT ROUTING DEBUG REPORT ===\n`;
        report += `Generated: ${new Date().toLocaleString()}\n`;
        report += `Total Requests: ${this.globalMetrics.totalCompletions}\n`;
        report += `Active Agents: ${this.agentMetrics.size}\n\n`;
        
        if (recentHistory.length === 0) {
            report += `No recent requests found.\n`;
            return report;
        }
        
        report += `Recent Requests (last ${Math.min(limit, recentHistory.length)}):\n`;
        report += `${'Time'.padEnd(12)} | ${'Agent'.padEnd(20)} | ${'Status'.padEnd(8)} | ${'Time(ms)'.padEnd(10)} | Input Preview\n`;
        report += `${'-'.repeat(12)} | ${'-'.repeat(20)} | ${'-'.repeat(8)} | ${'-'.repeat(10)} | ${'-'.repeat(30)}\n`;
        
        recentHistory.forEach(req => {
            if (req.type === 'completion') {
                const time = new Date(req.timestamp).toLocaleTimeString().substring(0, 8);
                const agent = req.agentName.substring(0, 20).padEnd(20);
                const status = (req.success ? 'SUCCESS' : 'ERROR').padEnd(8);
                const processingTime = req.processingTime.toString().padEnd(10);
                const inputPreview = (req.data.inputPreview || 'N/A').substring(0, 30);
                
                report += `${time.padEnd(12)} | ${agent} | ${status} | ${processingTime} | ${inputPreview}\n`;
            }
        });
        
        // Add agent performance summary
        report += `\n=== AGENT PERFORMANCE SUMMARY ===\n`;
        const agentMetrics = this.getAllAgentMetrics();
        
        if (agentMetrics.length > 0) {
            report += `${'Agent'.padEnd(20)} | ${'Requests'.padEnd(10)} | ${'Success%'.padEnd(10)} | ${'Avg Time(ms)'.padEnd(15)} | Avg Tokens\n`;
            report += `${'-'.repeat(20)} | ${'-'.repeat(10)} | ${'-'.repeat(10)} | ${'-'.repeat(15)} | ${'-'.repeat(11)}\n`;
            
            agentMetrics.forEach(agent => {
                const name = agent.name.substring(0, 20).padEnd(20);
                const requests = agent.completions.toString().padEnd(10);
                const successRate = (agent.successRate * 100).toFixed(1).padEnd(10);
                const avgTime = Math.round(agent.averageProcessingTime).toString().padEnd(15);
                const avgTokens = Math.round(agent.averageTokensUsed).toString();
                
                report += `${name} | ${requests} | ${successRate} | ${avgTime} | ${avgTokens}\n`;
            });
        } else {
            report += `No agent metrics available.\n`;
        }
        
        return report;
    }
}

// Create global agent telemetry instance
window.agentTelemetry = new AgentTelemetry();
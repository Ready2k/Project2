/**
 * Streaming Routing Monitor
 * Provides detailed logging for agent routing decisions and context changes
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
class StreamingRoutingMonitor {
    constructor() {
        this.isEnabled = true;
        this.logLevel = 'INFO';
        this.maxLogHistory = 2000;
        
        // Logging storage
        this.routingLogs = [];
        this.contextChangeLogs = [];
        this.performanceLogs = [];
        this.errorLogs = [];
        
        // Performance tracking
        this.routingMetrics = {
            totalDecisions: 0,
            successfulDecisions: 0,
            failedDecisions: 0,
            averageLatency: 0,
            maxLatency: 0,
            minLatency: Infinity,
            timeoutCount: 0,
            fallbackCount: 0
        };
        
        // Context tracking
        this.currentContext = {
            sessionId: null,
            currentAgent: null,
            previousAgent: null,
            conversationTurns: 0,
            contextSwitches: 0,
            lastRoutingDecision: null
        };
        
        // Agent performance tracking
        this.agentMetrics = new Map();
        
        // Initialize debug logger
        this.debug = window.debugManager ? 
            window.debugManager.createModuleLogger('StreamingRoutingMonitor') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
            
        this.initializeMonitoring();
        
        this.debug.info('StreamingRoutingMonitor initialized');
    }

    /**
     * Initialize monitoring hooks
     */
    initializeMonitoring() {
        // Hook into streaming manager if available
        if (window.streamingManager) {
            this.hookIntoStreamingManager();
        }
        
        // Hook into agent router if available
        if (window.agentRouter) {
            this.hookIntoAgentRouter();
        }
        
        // Set up periodic cleanup
        setInterval(() => {
            this.cleanupOldLogs();
        }, 60000); // Every minute
    }

    /**
     * Hook into streaming manager for monitoring
     */
    hookIntoStreamingManager() {
        const streamingManager = window.streamingManager;
        
        // Monitor connection events
        const originalConnect = streamingManager.connect;
        streamingManager.connect = async (...args) => {
            const startTime = performance.now();
            try {
                const result = await originalConnect.apply(streamingManager, args);
                const endTime = performance.now();
                
                this.logConnectionEvent({
                    type: 'connection_established',
                    timestamp: Date.now(),
                    latency: endTime - startTime,
                    success: result.success,
                    sessionId: streamingManager.connectionId
                });
                
                if (result.success) {
                    this.currentContext.sessionId = streamingManager.connectionId;
                }
                
                return result;
            } catch (error) {
                const endTime = performance.now();
                
                this.logConnectionEvent({
                    type: 'connection_failed',
                    timestamp: Date.now(),
                    latency: endTime - startTime,
                    success: false,
                    error: error.message
                });
                
                throw error;
            }
        };

        // Monitor agent routing decisions
        if (streamingManager.streamingAgentRouter) {
            this.hookIntoStreamingAgentRouter(streamingManager.streamingAgentRouter);
        }

        // Monitor voice configuration changes
        const originalSwitchVoice = streamingManager.switchAgentVoice;
        if (originalSwitchVoice) {
            streamingManager.switchAgentVoice = async (...args) => {
                const startTime = performance.now();
                const [newAgentName, context] = args;
                
                try {
                    const result = await originalSwitchVoice.apply(streamingManager, args);
                    const endTime = performance.now();
                    
                    this.logVoiceConfigurationChange({
                        timestamp: Date.now(),
                        agentName: newAgentName,
                        previousVoice: streamingManager.voiceConfiguration.previousVoice,
                        newVoice: streamingManager.voiceConfiguration.currentVoice,
                        latency: endTime - startTime,
                        success: result,
                        context: context
                    });
                    
                    return result;
                } catch (error) {
                    const endTime = performance.now();
                    
                    this.logVoiceConfigurationError({
                        timestamp: Date.now(),
                        agentName: newAgentName,
                        error: error.message,
                        latency: endTime - startTime
                    });
                    
                    throw error;
                }
            };
        }
    }

    /**
     * Hook into streaming agent router for detailed routing monitoring
     */
    hookIntoStreamingAgentRouter(router) {
        // Monitor routing decisions
        const originalRoute = router.routeStreamingMessage;
        router.routeStreamingMessage = async (...args) => {
            const [transcript, sessionContext] = args;
            const routingId = this.generateRoutingId();
            const startTime = performance.now();
            
            this.logRoutingStart({
                routingId,
                timestamp: Date.now(),
                input: transcript,
                sessionContext: sessionContext,
                currentAgent: this.currentContext.currentAgent
            });
            
            try {
                const result = await originalRoute.apply(router, args);
                const endTime = performance.now();
                const latency = endTime - startTime;
                
                this.logRoutingDecision({
                    routingId,
                    timestamp: Date.now(),
                    input: transcript,
                    selectedAgent: result.selectedAgent?.name || null,
                    confidence: result.confidence || 0,
                    latency: latency,
                    success: result.success,
                    fallbackUsed: result.fallbackUsed || false,
                    routingReason: result.routingReason || 'Unknown',
                    sessionContext: sessionContext,
                    agentResponse: result.response || null
                });
                
                // Update context if agent changed
                if (result.selectedAgent && result.selectedAgent.name !== this.currentContext.currentAgent) {
                    this.logAgentSwitch({
                        timestamp: Date.now(),
                        fromAgent: this.currentContext.currentAgent,
                        toAgent: result.selectedAgent.name,
                        reason: result.routingReason,
                        confidence: result.confidence,
                        contextPreserved: result.contextPreserved || false
                    });
                    
                    this.currentContext.previousAgent = this.currentContext.currentAgent;
                    this.currentContext.currentAgent = result.selectedAgent.name;
                    this.currentContext.contextSwitches++;
                }
                
                // Update metrics
                this.updateRoutingMetrics(latency, true, result.fallbackUsed);
                this.updateAgentMetrics(result.selectedAgent?.name, latency, true);
                
                return result;
            } catch (error) {
                const endTime = performance.now();
                const latency = endTime - startTime;
                
                this.logRoutingError({
                    routingId,
                    timestamp: Date.now(),
                    input: transcript,
                    error: error.message,
                    latency: latency,
                    sessionContext: sessionContext
                });
                
                // Update metrics
                this.updateRoutingMetrics(latency, false, false);
                
                throw error;
            }
        };

        // Monitor agent switching
        const originalSwitch = router.switchAgent;
        if (originalSwitch) {
            router.switchAgent = async (...args) => {
                const [newAgent, currentContext] = args;
                const startTime = performance.now();
                
                try {
                    const result = await originalSwitch.apply(router, args);
                    const endTime = performance.now();
                    
                    this.logAgentSwitchComplete({
                        timestamp: Date.now(),
                        fromAgent: this.currentContext.currentAgent,
                        toAgent: newAgent.name,
                        latency: endTime - startTime,
                        success: true,
                        contextTransferred: result.contextTransferred || false,
                        sessionUpdated: result.sessionUpdated || false
                    });
                    
                    return result;
                } catch (error) {
                    const endTime = performance.now();
                    
                    this.logAgentSwitchError({
                        timestamp: Date.now(),
                        fromAgent: this.currentContext.currentAgent,
                        toAgent: newAgent.name,
                        error: error.message,
                        latency: endTime - startTime
                    });
                    
                    throw error;
                }
            };
        }
    }

    /**
     * Hook into agent router for general routing monitoring
     */
    hookIntoAgentRouter() {
        const agentRouter = window.agentRouter;
        
        // Monitor general routing decisions
        const originalRoute = agentRouter.route;
        agentRouter.route = async (...args) => {
            const [input, context] = args;
            const startTime = performance.now();
            
            try {
                const result = await originalRoute.apply(agentRouter, args);
                const endTime = performance.now();
                
                this.logGeneralRoutingDecision({
                    timestamp: Date.now(),
                    input: input,
                    selectedAgent: result.agent?.name || null,
                    confidence: result.confidence || 0,
                    latency: endTime - startTime,
                    success: !!result.agent,
                    context: context
                });
                
                return result;
            } catch (error) {
                const endTime = performance.now();
                
                this.logGeneralRoutingError({
                    timestamp: Date.now(),
                    input: input,
                    error: error.message,
                    latency: endTime - startTime,
                    context: context
                });
                
                throw error;
            }
        };
    }

    /**
     * Log routing decision start
     */
    logRoutingStart(data) {
        if (!this.isEnabled) return;
        
        const logEntry = {
            type: 'routing_start',
            level: 'DEBUG',
            ...data,
            sanitizedInput: this.sanitizeInput(data.input)
        };
        
        this.routingLogs.push(logEntry);
        this.debug.debug('Routing started', logEntry);
    }

    /**
     * Log detailed routing decision
     */
    logRoutingDecision(data) {
        if (!this.isEnabled) return;
        
        const logEntry = {
            type: 'routing_decision',
            level: data.success ? 'INFO' : 'WARN',
            ...data,
            sanitizedInput: this.sanitizeInput(data.input),
            performanceCategory: this.categorizePerformance(data.latency),
            confidenceCategory: this.categorizeConfidence(data.confidence)
        };
        
        this.routingLogs.push(logEntry);
        this.currentContext.lastRoutingDecision = logEntry;
        this.currentContext.conversationTurns++;
        
        // Log to debug manager if available
        if (window.debugManager) {
            window.debugManager.logRoutingDecision({
                inputText: data.input,
                selectedAgent: data.selectedAgent ? { name: data.selectedAgent } : null,
                confidence: data.confidence,
                fallbackUsed: data.fallbackUsed,
                processingTime: data.latency,
                context: data.sessionContext
            });
        }
        
        this.debug.info('Routing decision made', logEntry);
    }

    /**
     * Log routing error
     */
    logRoutingError(data) {
        if (!this.isEnabled) return;
        
        const logEntry = {
            type: 'routing_error',
            level: 'ERROR',
            ...data,
            sanitizedInput: this.sanitizeInput(data.input),
            errorCategory: this.categorizeError(data.error)
        };
        
        this.routingLogs.push(logEntry);
        this.errorLogs.push(logEntry);
        
        this.debug.error('Routing error occurred', logEntry);
    }

    /**
     * Log agent switch
     */
    logAgentSwitch(data) {
        if (!this.isEnabled) return;
        
        const logEntry = {
            type: 'agent_switch',
            level: 'INFO',
            ...data
        };
        
        this.contextChangeLogs.push(logEntry);
        
        // Log state transition if debug manager is available
        if (window.debugManager) {
            window.debugManager.logStateTransition(
                'streaming-agent-router',
                data.fromAgent || 'none',
                data.toAgent,
                {
                    trigger: 'routing_decision',
                    reason: data.reason,
                    confidence: data.confidence
                }
            );
        }
        
        this.debug.info('Agent switch initiated', logEntry);
    }

    /**
     * Log agent switch completion
     */
    logAgentSwitchComplete(data) {
        if (!this.isEnabled) return;
        
        const logEntry = {
            type: 'agent_switch_complete',
            level: data.success ? 'INFO' : 'ERROR',
            ...data,
            performanceCategory: this.categorizePerformance(data.latency)
        };
        
        this.contextChangeLogs.push(logEntry);
        
        this.debug.info('Agent switch completed', logEntry);
    }

    /**
     * Log agent switch error
     */
    logAgentSwitchError(data) {
        if (!this.isEnabled) return;
        
        const logEntry = {
            type: 'agent_switch_error',
            level: 'ERROR',
            ...data,
            errorCategory: this.categorizeError(data.error)
        };
        
        this.contextChangeLogs.push(logEntry);
        this.errorLogs.push(logEntry);
        
        this.debug.error('Agent switch error', logEntry);
    }

    /**
     * Log voice configuration change
     */
    logVoiceConfigurationChange(data) {
        if (!this.isEnabled) return;
        
        const logEntry = {
            type: 'voice_config_change',
            level: 'INFO',
            ...data
        };
        
        this.contextChangeLogs.push(logEntry);
        
        this.debug.info('Voice configuration changed', logEntry);
    }

    /**
     * Log voice configuration error
     */
    logVoiceConfigurationError(data) {
        if (!this.isEnabled) return;
        
        const logEntry = {
            type: 'voice_config_error',
            level: 'ERROR',
            ...data
        };
        
        this.contextChangeLogs.push(logEntry);
        this.errorLogs.push(logEntry);
        
        this.debug.error('Voice configuration error', logEntry);
    }

    /**
     * Log connection events
     */
    logConnectionEvent(data) {
        if (!this.isEnabled) return;
        
        const logEntry = {
            type: 'connection_event',
            level: data.success ? 'INFO' : 'ERROR',
            ...data
        };
        
        this.contextChangeLogs.push(logEntry);
        
        if (!data.success) {
            this.errorLogs.push(logEntry);
        }
        
        this.debug.info('Connection event', logEntry);
    }

    /**
     * Log general routing decision (non-streaming)
     */
    logGeneralRoutingDecision(data) {
        if (!this.isEnabled) return;
        
        const logEntry = {
            type: 'general_routing_decision',
            level: 'INFO',
            ...data,
            sanitizedInput: this.sanitizeInput(data.input)
        };
        
        this.routingLogs.push(logEntry);
        
        this.debug.info('General routing decision', logEntry);
    }

    /**
     * Log general routing error
     */
    logGeneralRoutingError(data) {
        if (!this.isEnabled) return;
        
        const logEntry = {
            type: 'general_routing_error',
            level: 'ERROR',
            ...data,
            sanitizedInput: this.sanitizeInput(data.input)
        };
        
        this.routingLogs.push(logEntry);
        this.errorLogs.push(logEntry);
        
        this.debug.error('General routing error', logEntry);
    }

    /**
     * Update routing metrics
     */
    updateRoutingMetrics(latency, success, fallbackUsed) {
        this.routingMetrics.totalDecisions++;
        
        if (success) {
            this.routingMetrics.successfulDecisions++;
        } else {
            this.routingMetrics.failedDecisions++;
        }
        
        if (fallbackUsed) {
            this.routingMetrics.fallbackCount++;
        }
        
        // Update latency metrics
        this.routingMetrics.averageLatency = 
            (this.routingMetrics.averageLatency * (this.routingMetrics.totalDecisions - 1) + latency) / 
            this.routingMetrics.totalDecisions;
        
        this.routingMetrics.maxLatency = Math.max(this.routingMetrics.maxLatency, latency);
        this.routingMetrics.minLatency = Math.min(this.routingMetrics.minLatency, latency);
        
        // Check for timeout (>200ms as per requirements)
        if (latency > 200) {
            this.routingMetrics.timeoutCount++;
        }
    }

    /**
     * Update agent-specific metrics
     */
    updateAgentMetrics(agentName, latency, success) {
        if (!agentName) return;
        
        if (!this.agentMetrics.has(agentName)) {
            this.agentMetrics.set(agentName, {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageLatency: 0,
                maxLatency: 0,
                minLatency: Infinity
            });
        }
        
        const metrics = this.agentMetrics.get(agentName);
        metrics.totalRequests++;
        
        if (success) {
            metrics.successfulRequests++;
        } else {
            metrics.failedRequests++;
        }
        
        // Update latency metrics
        metrics.averageLatency = 
            (metrics.averageLatency * (metrics.totalRequests - 1) + latency) / 
            metrics.totalRequests;
        
        metrics.maxLatency = Math.max(metrics.maxLatency, latency);
        metrics.minLatency = Math.min(metrics.minLatency, latency);
    }

    /**
     * Get routing analytics
     */
    getRoutingAnalytics(timeRange = 3600000) { // Default: last hour
        const cutoff = Date.now() - timeRange;
        const recentLogs = this.routingLogs.filter(log => log.timestamp > cutoff);
        
        return {
            summary: {
                totalDecisions: recentLogs.length,
                successfulDecisions: recentLogs.filter(log => log.success).length,
                failedDecisions: recentLogs.filter(log => !log.success).length,
                averageLatency: this.calculateAverageLatency(recentLogs),
                timeoutCount: recentLogs.filter(log => log.latency > 200).length
            },
            agentUsage: this.calculateAgentUsage(recentLogs),
            performanceDistribution: this.calculatePerformanceDistribution(recentLogs),
            errorAnalysis: this.analyzeErrors(recentLogs),
            trends: this.calculateTrends(recentLogs)
        };
    }

    /**
     * Get context change analytics
     */
    getContextAnalytics(timeRange = 3600000) {
        const cutoff = Date.now() - timeRange;
        const recentLogs = this.contextChangeLogs.filter(log => log.timestamp > cutoff);
        
        return {
            summary: {
                totalSwitches: recentLogs.filter(log => log.type === 'agent_switch').length,
                successfulSwitches: recentLogs.filter(log => 
                    log.type === 'agent_switch_complete' && log.success
                ).length,
                voiceChanges: recentLogs.filter(log => log.type === 'voice_config_change').length,
                connectionEvents: recentLogs.filter(log => log.type === 'connection_event').length
            },
            switchPatterns: this.analyzeSwitchPatterns(recentLogs),
            contextPreservation: this.analyzeContextPreservation(recentLogs)
        };
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            routing: { ...this.routingMetrics },
            agents: Object.fromEntries(this.agentMetrics),
            context: { ...this.currentContext },
            systemHealth: this.calculateSystemHealth()
        };
    }

    /**
     * Export monitoring data
     */
    exportMonitoringData(format = 'json') {
        const data = {
            timestamp: new Date().toISOString(),
            metrics: this.getPerformanceMetrics(),
            analytics: {
                routing: this.getRoutingAnalytics(),
                context: this.getContextAnalytics()
            },
            logs: {
                routing: this.routingLogs.slice(-500), // Last 500 routing logs
                contextChanges: this.contextChangeLogs.slice(-200), // Last 200 context changes
                errors: this.errorLogs.slice(-100) // Last 100 errors
            }
        };
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertToCSV(data);
            default:
                return data;
        }
    }

    /**
     * Helper methods
     */
    generateRoutingId() {
        return `routing_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    sanitizeInput(input) {
        if (!input || typeof input !== 'string') return '';
        
        // Truncate and sanitize sensitive information
        const truncated = input.length > 100 ? input.substring(0, 100) + '...' : input;
        return truncated
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
            .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
            .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
    }

    categorizePerformance(latency) {
        if (latency < 50) return 'EXCELLENT';
        if (latency < 100) return 'GOOD';
        if (latency < 200) return 'ACCEPTABLE';
        return 'POOR';
    }

    categorizeConfidence(confidence) {
        if (confidence >= 0.8) return 'HIGH';
        if (confidence >= 0.6) return 'MEDIUM';
        if (confidence >= 0.4) return 'LOW';
        return 'VERY_LOW';
    }

    categorizeError(error) {
        if (error.includes('timeout')) return 'TIMEOUT';
        if (error.includes('network')) return 'NETWORK';
        if (error.includes('agent')) return 'AGENT';
        if (error.includes('routing')) return 'ROUTING';
        return 'UNKNOWN';
    }

    calculateAverageLatency(logs) {
        const latencies = logs.filter(log => log.latency).map(log => log.latency);
        return latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    }

    calculateAgentUsage(logs) {
        const usage = {};
        logs.forEach(log => {
            if (log.selectedAgent) {
                usage[log.selectedAgent] = (usage[log.selectedAgent] || 0) + 1;
            }
        });
        return usage;
    }

    calculatePerformanceDistribution(logs) {
        const distribution = { EXCELLENT: 0, GOOD: 0, ACCEPTABLE: 0, POOR: 0 };
        logs.forEach(log => {
            if (log.latency) {
                const category = this.categorizePerformance(log.latency);
                distribution[category]++;
            }
        });
        return distribution;
    }

    analyzeErrors(logs) {
        const errorLogs = logs.filter(log => log.level === 'ERROR');
        const errorTypes = {};
        
        errorLogs.forEach(log => {
            const category = this.categorizeError(log.error || '');
            errorTypes[category] = (errorTypes[category] || 0) + 1;
        });
        
        return {
            totalErrors: errorLogs.length,
            errorTypes: errorTypes,
            errorRate: logs.length > 0 ? (errorLogs.length / logs.length) * 100 : 0
        };
    }

    calculateTrends(logs) {
        // Simple trend calculation - could be enhanced
        const recent = logs.slice(-10);
        const older = logs.slice(-20, -10);
        
        const recentSuccessRate = recent.filter(log => log.success).length / recent.length;
        const olderSuccessRate = older.filter(log => log.success).length / older.length;
        
        return {
            successRateTrend: recentSuccessRate - olderSuccessRate,
            latencyTrend: this.calculateAverageLatency(recent) - this.calculateAverageLatency(older)
        };
    }

    analyzeSwitchPatterns(logs) {
        const switches = logs.filter(log => log.type === 'agent_switch');
        const patterns = {};
        
        switches.forEach(log => {
            const pattern = `${log.fromAgent || 'none'} -> ${log.toAgent}`;
            patterns[pattern] = (patterns[pattern] || 0) + 1;
        });
        
        return patterns;
    }

    analyzeContextPreservation(logs) {
        const switches = logs.filter(log => log.type === 'agent_switch_complete');
        const preserved = switches.filter(log => log.contextTransferred).length;
        
        return {
            totalSwitches: switches.length,
            contextPreserved: preserved,
            preservationRate: switches.length > 0 ? (preserved / switches.length) * 100 : 0
        };
    }

    calculateSystemHealth() {
        const successRate = this.routingMetrics.totalDecisions > 0 
            ? (this.routingMetrics.successfulDecisions / this.routingMetrics.totalDecisions) * 100 
            : 100;
        
        const avgLatency = this.routingMetrics.averageLatency;
        const errorRate = this.errorLogs.length / Math.max(this.routingLogs.length, 1) * 100;
        
        let health = 'EXCELLENT';
        if (successRate < 95 || avgLatency > 150 || errorRate > 5) {
            health = 'GOOD';
        }
        if (successRate < 90 || avgLatency > 200 || errorRate > 10) {
            health = 'POOR';
        }
        if (successRate < 80 || avgLatency > 300 || errorRate > 20) {
            health = 'CRITICAL';
        }
        
        return {
            status: health,
            successRate: successRate,
            averageLatency: avgLatency,
            errorRate: errorRate
        };
    }

    convertToCSV(data) {
        // Simple CSV conversion for routing logs
        const headers = ['timestamp', 'type', 'agent', 'latency', 'success', 'input'];
        const rows = [headers.join(',')];
        
        data.logs.routing.forEach(log => {
            const row = [
                new Date(log.timestamp).toISOString(),
                log.type,
                log.selectedAgent || '',
                log.latency || '',
                log.success || false,
                `"${log.sanitizedInput || ''}"`
            ];
            rows.push(row.join(','));
        });
        
        return rows.join('\n');
    }

    cleanupOldLogs() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        
        this.routingLogs = this.routingLogs.filter(log => log.timestamp > cutoff);
        this.contextChangeLogs = this.contextChangeLogs.filter(log => log.timestamp > cutoff);
        this.errorLogs = this.errorLogs.filter(log => log.timestamp > cutoff);
        
        // Keep only recent performance logs
        if (this.routingLogs.length > this.maxLogHistory) {
            this.routingLogs = this.routingLogs.slice(-this.maxLogHistory);
        }
        
        this.debug.debug('Old logs cleaned up');
    }

    /**
     * Enable/disable monitoring
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.debug.info('Monitoring ' + (enabled ? 'enabled' : 'disabled'));
    }

    /**
     * Set log level
     */
    setLogLevel(level) {
        this.logLevel = level;
        this.debug.info('Log level set to:', level);
    }

    /**
     * Clear all logs
     */
    clearLogs() {
        this.routingLogs = [];
        this.contextChangeLogs = [];
        this.errorLogs = [];
        
        // Reset metrics
        this.routingMetrics = {
            totalDecisions: 0,
            successfulDecisions: 0,
            failedDecisions: 0,
            averageLatency: 0,
            maxLatency: 0,
            minLatency: Infinity,
            timeoutCount: 0,
            fallbackCount: 0
        };
        
        this.agentMetrics.clear();
        
        this.debug.info('All logs cleared');
    }
}

// Initialize global monitoring instance
window.streamingRoutingMonitor = new StreamingRoutingMonitor();
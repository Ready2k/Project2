/**
 * Streaming Error Tracking and Analysis Tool
 * Provides error tracking and analysis tools for routing failures
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
class StreamingErrorTracker {
    constructor() {
        this.isEnabled = true;
        this.maxErrorHistory = 1000;
        
        // Error storage and categorization
        this.errors = [];
        this.errorPatterns = new Map();
        this.errorCategories = {
            ROUTING: 'routing',
            AGENT_SWITCH: 'agent_switch',
            VOICE_CONFIG: 'voice_config',
            CONNECTION: 'connection',
            TIMEOUT: 'timeout',
            VALIDATION: 'validation',
            UNKNOWN: 'unknown'
        };
        
        // Error severity levels
        this.severityLevels = {
            LOW: 1,
            MEDIUM: 2,
            HIGH: 3,
            CRITICAL: 4
        };
        
        // Error statistics
        this.errorStats = {
            totalErrors: 0,
            errorsByCategory: new Map(),
            errorsBySeverity: new Map(),
            errorsByAgent: new Map(),
            recentErrorRate: 0,
            averageResolutionTime: 0
        };
        
        // Error analysis rules
        this.analysisRules = new Map();
        this.alertThresholds = {
            errorRate: 10, // errors per minute
            criticalErrors: 5, // critical errors per hour
            patternOccurrence: 3 // same pattern occurring 3+ times
        };
        
        // Recovery tracking
        this.recoveryAttempts = new Map();
        this.recoveryStrategies = new Map();
        
        // Initialize debug logger
        this.debug = window.debugManager ? 
            window.debugManager.createModuleLogger('StreamingErrorTracker') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
            
        this.initializeErrorTracking();
        
        this.debug.info('StreamingErrorTracker initialized');
    }

    /**
     * Initialize error tracking system
     */
    initializeErrorTracking() {
        // Set up error analysis rules
        this.setupAnalysisRules();
        
        // Hook into existing error sources
        this.hookIntoErrorSources();
        
        // Set up periodic analysis
        setInterval(() => {
            this.performPeriodicAnalysis();
        }, 60000); // Every minute
        
        // Set up cleanup
        setInterval(() => {
            this.cleanupOldErrors();
        }, 300000); // Every 5 minutes
    }

    /**
     * Setup error analysis rules
     */
    setupAnalysisRules() {
        // Rule: High frequency of same error
        this.analysisRules.set('high_frequency', {
            condition: (error) => {
                const pattern = this.getErrorPattern(error);
                const recentSimilar = this.errors.filter(e => 
                    Date.now() - e.timestamp < 300000 && // Last 5 minutes
                    this.getErrorPattern(e) === pattern
                ).length;
                return recentSimilar >= 3;
            },
            action: (error) => {
                this.escalateError(error, 'HIGH_FREQUENCY', 
                    `Error pattern "${this.getErrorPattern(error)}" occurring frequently`);
            }
        });

        // Rule: Critical routing failures
        this.analysisRules.set('critical_routing', {
            condition: (error) => {
                return error.category === this.errorCategories.ROUTING && 
                       error.severity >= this.severityLevels.HIGH;
            },
            action: (error) => {
                this.escalateError(error, 'CRITICAL_ROUTING', 
                    'Critical routing failure detected');
            }
        });

        // Rule: Agent switching cascade failures
        this.analysisRules.set('agent_cascade', {
            condition: (error) => {
                if (error.category !== this.errorCategories.AGENT_SWITCH) return false;
                
                const recentSwitchErrors = this.errors.filter(e => 
                    Date.now() - e.timestamp < 60000 && // Last minute
                    e.category === this.errorCategories.AGENT_SWITCH
                ).length;
                
                return recentSwitchErrors >= 3;
            },
            action: (error) => {
                this.escalateError(error, 'AGENT_CASCADE', 
                    'Multiple agent switching failures detected');
            }
        });

        // Rule: Connection instability
        this.analysisRules.set('connection_instability', {
            condition: (error) => {
                if (error.category !== this.errorCategories.CONNECTION) return false;
                
                const recentConnectionErrors = this.errors.filter(e => 
                    Date.now() - e.timestamp < 180000 && // Last 3 minutes
                    e.category === this.errorCategories.CONNECTION
                ).length;
                
                return recentConnectionErrors >= 2;
            },
            action: (error) => {
                this.escalateError(error, 'CONNECTION_INSTABILITY', 
                    'Connection instability detected');
            }
        });

        // Rule: Timeout pattern
        this.analysisRules.set('timeout_pattern', {
            condition: (error) => {
                return error.category === this.errorCategories.TIMEOUT ||
                       (error.message && error.message.toLowerCase().includes('timeout'));
            },
            action: (error) => {
                this.escalateError(error, 'TIMEOUT_PATTERN', 
                    'Timeout error detected - potential performance issue');
            }
        });
    }

    /**
     * Hook into existing error sources
     */
    hookIntoErrorSources() {
        // Hook into streaming manager errors
        if (window.streamingManager) {
            this.hookIntoStreamingManager();
        }

        // Hook into agent router errors
        if (window.streamingManager?.streamingAgentRouter) {
            this.hookIntoAgentRouter();
        }

        // Hook into global error handlers
        this.hookIntoGlobalErrors();
    }

    /**
     * Hook into streaming manager for error tracking
     */
    hookIntoStreamingManager() {
        const streamingManager = window.streamingManager;
        
        // Hook into connection errors
        const originalConnect = streamingManager.connect;
        streamingManager.connect = async (...args) => {
            try {
                return await originalConnect.apply(streamingManager, args);
            } catch (error) {
                this.trackError({
                    type: 'connection_error',
                    category: this.errorCategories.CONNECTION,
                    severity: this.severityLevels.HIGH,
                    message: error.message,
                    context: {
                        operation: 'connect',
                        args: args
                    },
                    stackTrace: error.stack
                });
                throw error;
            }
        };

        // Hook into WebSocket errors
        if (streamingManager.websocket) {
            const originalOnError = streamingManager.websocket.onerror;
            streamingManager.websocket.onerror = (error) => {
                this.trackError({
                    type: 'websocket_error',
                    category: this.errorCategories.CONNECTION,
                    severity: this.severityLevels.HIGH,
                    message: 'WebSocket error occurred',
                    context: {
                        readyState: streamingManager.websocket.readyState,
                        url: streamingManager.websocket.url
                    },
                    originalError: error
                });
                
                if (originalOnError) {
                    originalOnError.call(streamingManager.websocket, error);
                }
            };
        }

        // Hook into voice configuration errors
        const originalSwitchVoice = streamingManager.switchAgentVoice;
        if (originalSwitchVoice) {
            streamingManager.switchAgentVoice = async (...args) => {
                try {
                    return await originalSwitchVoice.apply(streamingManager, args);
                } catch (error) {
                    this.trackError({
                        type: 'voice_config_error',
                        category: this.errorCategories.VOICE_CONFIG,
                        severity: this.severityLevels.MEDIUM,
                        message: error.message,
                        context: {
                            operation: 'switchAgentVoice',
                            agentName: args[0],
                            context: args[1]
                        },
                        stackTrace: error.stack
                    });
                    throw error;
                }
            };
        }
    }

    /**
     * Hook into agent router for error tracking
     */
    hookIntoAgentRouter() {
        const router = window.streamingManager.streamingAgentRouter;
        
        // Hook into routing errors
        const originalRoute = router.routeStreamingMessage;
        router.routeStreamingMessage = async (...args) => {
            try {
                return await originalRoute.apply(router, args);
            } catch (error) {
                this.trackError({
                    type: 'routing_error',
                    category: this.errorCategories.ROUTING,
                    severity: this.severityLevels.HIGH,
                    message: error.message,
                    context: {
                        operation: 'routeStreamingMessage',
                        input: args[0],
                        sessionContext: args[1]
                    },
                    stackTrace: error.stack
                });
                throw error;
            }
        };

        // Hook into agent switching errors
        const originalSwitch = router.switchAgent;
        if (originalSwitch) {
            router.switchAgent = async (...args) => {
                try {
                    return await originalSwitch.apply(router, args);
                } catch (error) {
                    this.trackError({
                        type: 'agent_switch_error',
                        category: this.errorCategories.AGENT_SWITCH,
                        severity: this.severityLevels.HIGH,
                        message: error.message,
                        context: {
                            operation: 'switchAgent',
                            newAgent: args[0]?.name,
                            currentContext: args[1]
                        },
                        stackTrace: error.stack
                    });
                    throw error;
                }
            };
        }
    }

    /**
     * Hook into global error handlers
     */
    hookIntoGlobalErrors() {
        // Hook into unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            if (this.isStreamingRelatedError(event.reason)) {
                this.trackError({
                    type: 'unhandled_rejection',
                    category: this.categorizeError(event.reason),
                    severity: this.severityLevels.HIGH,
                    message: event.reason?.message || 'Unhandled promise rejection',
                    context: {
                        operation: 'unhandled_rejection',
                        promise: event.promise
                    },
                    stackTrace: event.reason?.stack
                });
            }
        });

        // Hook into global errors
        window.addEventListener('error', (event) => {
            if (this.isStreamingRelatedError(event.error)) {
                this.trackError({
                    type: 'global_error',
                    category: this.categorizeError(event.error),
                    severity: this.severityLevels.MEDIUM,
                    message: event.message,
                    context: {
                        operation: 'global_error',
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno
                    },
                    stackTrace: event.error?.stack
                });
            }
        });
    }

    /**
     * Track an error
     */
    trackError(errorData) {
        if (!this.isEnabled) return;

        const error = {
            id: this.generateErrorId(),
            timestamp: Date.now(),
            type: errorData.type,
            category: errorData.category || this.categorizeError(errorData),
            severity: errorData.severity || this.assessSeverity(errorData),
            message: this.sanitizeMessage(errorData.message),
            context: this.sanitizeContext(errorData.context || {}),
            stackTrace: errorData.stackTrace,
            pattern: this.getErrorPattern(errorData),
            resolved: false,
            resolutionTime: null,
            recoveryAttempts: 0,
            metadata: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                sessionId: window.streamingManager?.connectionId,
                currentAgent: window.streamingManager?.currentStreamingAgent?.name
            }
        };

        // Store error
        this.errors.push(error);
        this.updateErrorStats(error);

        // Apply analysis rules
        this.applyAnalysisRules(error);

        // Attempt automatic recovery if applicable
        this.attemptRecovery(error);

        // Log to debug manager
        if (window.debugManager) {
            window.debugManager.error('Streaming error tracked', {
                errorId: error.id,
                type: error.type,
                category: error.category,
                severity: error.severity,
                message: error.message
            });
        }

        // Cleanup if needed
        if (this.errors.length > this.maxErrorHistory) {
            this.errors.shift();
        }

        this.debug.error('Error tracked', error);
        
        return error;
    }

    /**
     * Update error statistics
     */
    updateErrorStats(error) {
        this.errorStats.totalErrors++;
        
        // Update category stats
        const categoryCount = this.errorStats.errorsByCategory.get(error.category) || 0;
        this.errorStats.errorsByCategory.set(error.category, categoryCount + 1);
        
        // Update severity stats
        const severityCount = this.errorStats.errorsBySeverity.get(error.severity) || 0;
        this.errorStats.errorsBySeverity.set(error.severity, severityCount + 1);
        
        // Update agent stats if applicable
        if (error.metadata.currentAgent) {
            const agentCount = this.errorStats.errorsByAgent.get(error.metadata.currentAgent) || 0;
            this.errorStats.errorsByAgent.set(error.metadata.currentAgent, agentCount + 1);
        }
        
        // Update recent error rate
        this.updateRecentErrorRate();
    }

    /**
     * Apply analysis rules to error
     */
    applyAnalysisRules(error) {
        for (const [ruleName, rule] of this.analysisRules.entries()) {
            try {
                if (rule.condition(error)) {
                    rule.action(error);
                }
            } catch (ruleError) {
                this.debug.error('Analysis rule failed', {
                    ruleName: ruleName,
                    error: ruleError.message
                });
            }
        }
    }

    /**
     * Escalate error based on analysis
     */
    escalateError(error, escalationType, reason) {
        const escalation = {
            errorId: error.id,
            type: escalationType,
            reason: reason,
            timestamp: Date.now(),
            originalError: error
        };

        // Log escalation
        this.debug.warn('Error escalated', escalation);

        // Notify debug panel if available
        if (window.streamingDebugPanel) {
            window.streamingDebugPanel.logRoutingError({
                timestamp: Date.now(),
                input: error.context.input || 'N/A',
                error: `${escalationType}: ${reason}`,
                latency: 0
            });
        }

        // Trigger alerts if thresholds are met
        this.checkAlertThresholds(escalation);
    }

    /**
     * Attempt automatic recovery
     */
    attemptRecovery(error) {
        const recoveryStrategy = this.getRecoveryStrategy(error);
        if (!recoveryStrategy) return;

        const attemptId = `${error.id}_${Date.now()}`;
        
        this.recoveryAttempts.set(attemptId, {
            errorId: error.id,
            strategy: recoveryStrategy.name,
            startTime: Date.now(),
            status: 'in_progress'
        });

        recoveryStrategy.execute(error)
            .then((result) => {
                const attempt = this.recoveryAttempts.get(attemptId);
                if (attempt) {
                    attempt.status = result.success ? 'success' : 'failed';
                    attempt.endTime = Date.now();
                    attempt.result = result;
                }

                if (result.success) {
                    this.markErrorResolved(error.id, Date.now() - error.timestamp);
                }

                this.debug.info('Recovery attempt completed', {
                    errorId: error.id,
                    strategy: recoveryStrategy.name,
                    success: result.success
                });
            })
            .catch((recoveryError) => {
                const attempt = this.recoveryAttempts.get(attemptId);
                if (attempt) {
                    attempt.status = 'failed';
                    attempt.endTime = Date.now();
                    attempt.error = recoveryError.message;
                }

                this.debug.error('Recovery attempt failed', {
                    errorId: error.id,
                    strategy: recoveryStrategy.name,
                    error: recoveryError.message
                });
            });
    }

    /**
     * Get recovery strategy for error
     */
    getRecoveryStrategy(error) {
        switch (error.category) {
            case this.errorCategories.CONNECTION:
                return {
                    name: 'reconnect',
                    execute: async (error) => {
                        try {
                            if (window.streamingManager && !window.streamingManager.isConnected) {
                                const result = await window.streamingManager.connect();
                                return { success: result.success, message: 'Reconnection attempted' };
                            }
                            return { success: false, message: 'Already connected' };
                        } catch (e) {
                            return { success: false, message: e.message };
                        }
                    }
                };

            case this.errorCategories.AGENT_SWITCH:
                return {
                    name: 'fallback_agent',
                    execute: async (error) => {
                        try {
                            if (window.streamingManager?.streamingAgentRouter) {
                                // Try to switch to default agent
                                const result = await window.streamingManager.streamingAgentRouter.switchAgent(
                                    { name: 'DefaultAgent' }, 
                                    error.context
                                );
                                return { success: true, message: 'Switched to fallback agent' };
                            }
                            return { success: false, message: 'No agent router available' };
                        } catch (e) {
                            return { success: false, message: e.message };
                        }
                    }
                };

            case this.errorCategories.VOICE_CONFIG:
                return {
                    name: 'reset_voice',
                    execute: async (error) => {
                        try {
                            if (window.streamingManager) {
                                // Reset to default voice
                                window.streamingManager.voiceConfiguration.currentVoice = 'shimmer';
                                return { success: true, message: 'Voice reset to default' };
                            }
                            return { success: false, message: 'No streaming manager available' };
                        } catch (e) {
                            return { success: false, message: e.message };
                        }
                    }
                };

            default:
                return null;
        }
    }

    /**
     * Mark error as resolved
     */
    markErrorResolved(errorId, resolutionTime) {
        const error = this.errors.find(e => e.id === errorId);
        if (error) {
            error.resolved = true;
            error.resolutionTime = resolutionTime;
            
            // Update average resolution time
            const resolvedErrors = this.errors.filter(e => e.resolved);
            if (resolvedErrors.length > 0) {
                const totalResolutionTime = resolvedErrors.reduce((sum, e) => sum + e.resolutionTime, 0);
                this.errorStats.averageResolutionTime = totalResolutionTime / resolvedErrors.length;
            }
        }
    }

    /**
     * Get error analysis
     */
    getErrorAnalysis(timeRange = 3600000) { // Default: last hour
        const cutoff = Date.now() - timeRange;
        const recentErrors = this.errors.filter(error => error.timestamp > cutoff);

        return {
            summary: {
                totalErrors: recentErrors.length,
                resolvedErrors: recentErrors.filter(e => e.resolved).length,
                criticalErrors: recentErrors.filter(e => e.severity >= this.severityLevels.HIGH).length,
                averageResolutionTime: this.calculateAverageResolutionTime(recentErrors)
            },
            categoryBreakdown: this.getCategoryBreakdown(recentErrors),
            severityDistribution: this.getSeverityDistribution(recentErrors),
            topErrorPatterns: this.getTopErrorPatterns(recentErrors),
            agentErrorBreakdown: this.getAgentErrorBreakdown(recentErrors),
            timelineAnalysis: this.getTimelineAnalysis(recentErrors),
            recoveryAnalysis: this.getRecoveryAnalysis(recentErrors)
        };
    }

    /**
     * Get error patterns
     */
    getErrorPatterns() {
        const patterns = new Map();
        
        this.errors.forEach(error => {
            const pattern = error.pattern;
            if (!patterns.has(pattern)) {
                patterns.set(pattern, {
                    pattern: pattern,
                    count: 0,
                    firstOccurrence: error.timestamp,
                    lastOccurrence: error.timestamp,
                    errors: []
                });
            }
            
            const patternData = patterns.get(pattern);
            patternData.count++;
            patternData.lastOccurrence = Math.max(patternData.lastOccurrence, error.timestamp);
            patternData.errors.push(error);
        });
        
        return Array.from(patterns.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10 patterns
    }

    /**
     * Export error data
     */
    exportErrorData(format = 'json', timeRange = null) {
        let errorsToExport = this.errors;
        
        if (timeRange) {
            const cutoff = Date.now() - timeRange;
            errorsToExport = this.errors.filter(error => error.timestamp > cutoff);
        }

        const data = {
            timestamp: new Date().toISOString(),
            summary: {
                totalErrors: errorsToExport.length,
                timeRange: timeRange,
                exportedAt: Date.now()
            },
            errors: errorsToExport,
            analysis: this.getErrorAnalysis(timeRange),
            patterns: this.getErrorPatterns(),
            statistics: this.errorStats,
            recoveryAttempts: Array.from(this.recoveryAttempts.values())
        };

        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertErrorsToCSV(errorsToExport);
            default:
                return data;
        }
    }

    /**
     * Helper methods
     */
    generateErrorId() {
        return `error_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    isStreamingRelatedError(error) {
        if (!error) return false;
        
        const message = error.message || error.toString();
        const stack = error.stack || '';
        
        const streamingKeywords = [
            'streaming', 'agent', 'routing', 'websocket', 'voice', 
            'realtime', 'openai', 'StreamingManager', 'AgentRouter'
        ];
        
        return streamingKeywords.some(keyword => 
            message.toLowerCase().includes(keyword.toLowerCase()) ||
            stack.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    categorizeError(error) {
        const message = (error.message || error.toString()).toLowerCase();
        
        if (message.includes('routing') || message.includes('agent')) {
            return this.errorCategories.ROUTING;
        }
        if (message.includes('switch') || message.includes('agent')) {
            return this.errorCategories.AGENT_SWITCH;
        }
        if (message.includes('voice') || message.includes('audio')) {
            return this.errorCategories.VOICE_CONFIG;
        }
        if (message.includes('websocket') || message.includes('connection')) {
            return this.errorCategories.CONNECTION;
        }
        if (message.includes('timeout') || message.includes('time')) {
            return this.errorCategories.TIMEOUT;
        }
        if (message.includes('validation') || message.includes('invalid')) {
            return this.errorCategories.VALIDATION;
        }
        
        return this.errorCategories.UNKNOWN;
    }

    assessSeverity(error) {
        const message = (error.message || error.toString()).toLowerCase();
        
        if (message.includes('critical') || message.includes('fatal')) {
            return this.severityLevels.CRITICAL;
        }
        if (message.includes('connection') || message.includes('routing')) {
            return this.severityLevels.HIGH;
        }
        if (message.includes('warning') || message.includes('timeout')) {
            return this.severityLevels.MEDIUM;
        }
        
        return this.severityLevels.LOW;
    }

    getErrorPattern(error) {
        // Create a pattern based on error type, category, and key message parts
        const messageWords = (error.message || '').toLowerCase()
            .replace(/[^a-z\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .slice(0, 3)
            .join('_');
        
        return `${error.type}_${error.category}_${messageWords}`;
    }

    sanitizeMessage(message) {
        if (!message) return '';
        
        return message
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
            .replace(/\b[A-Za-z0-9]{20,}\b/g, '[TOKEN]')
            .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
    }

    sanitizeContext(context) {
        if (!context || typeof context !== 'object') return {};
        
        const sanitized = {};
        for (const [key, value] of Object.entries(context)) {
            if (this.isSensitiveField(key)) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeContext(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    isSensitiveField(fieldName) {
        const sensitiveFields = [
            'password', 'token', 'key', 'secret', 'auth', 'credential',
            'apiKey', 'accessToken', 'sessionId', 'userId', 'email'
        ];
        
        const lowerField = fieldName.toLowerCase();
        return sensitiveFields.some(sensitive => lowerField.includes(sensitive));
    }

    updateRecentErrorRate() {
        const recentErrors = this.errors.filter(error => 
            Date.now() - error.timestamp < 60000 // Last minute
        );
        this.errorStats.recentErrorRate = recentErrors.length;
    }

    checkAlertThresholds(escalation) {
        // Check if we should trigger alerts based on thresholds
        if (this.errorStats.recentErrorRate > this.alertThresholds.errorRate) {
            this.debug.warn('High error rate alert', {
                currentRate: this.errorStats.recentErrorRate,
                threshold: this.alertThresholds.errorRate
            });
        }
    }

    performPeriodicAnalysis() {
        // Perform periodic analysis of error patterns
        const recentErrors = this.errors.filter(error => 
            Date.now() - error.timestamp < 3600000 // Last hour
        );

        const criticalErrors = recentErrors.filter(error => 
            error.severity >= this.severityLevels.HIGH
        );

        if (criticalErrors.length > this.alertThresholds.criticalErrors) {
            this.debug.warn('High critical error count', {
                count: criticalErrors.length,
                threshold: this.alertThresholds.criticalErrors
            });
        }

        // Analyze patterns
        const patterns = this.getErrorPatterns();
        patterns.forEach(pattern => {
            if (pattern.count >= this.alertThresholds.patternOccurrence) {
                this.debug.warn('Recurring error pattern detected', {
                    pattern: pattern.pattern,
                    count: pattern.count
                });
            }
        });
    }

    cleanupOldErrors() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        const initialCount = this.errors.length;
        
        this.errors = this.errors.filter(error => error.timestamp > cutoff);
        
        const removedCount = initialCount - this.errors.length;
        if (removedCount > 0) {
            this.debug.debug('Cleaned up old errors', { removedCount });
        }
    }

    // Analysis helper methods
    getCategoryBreakdown(errors) {
        const breakdown = {};
        errors.forEach(error => {
            breakdown[error.category] = (breakdown[error.category] || 0) + 1;
        });
        return breakdown;
    }

    getSeverityDistribution(errors) {
        const distribution = {};
        errors.forEach(error => {
            distribution[error.severity] = (distribution[error.severity] || 0) + 1;
        });
        return distribution;
    }

    getTopErrorPatterns(errors) {
        const patterns = {};
        errors.forEach(error => {
            patterns[error.pattern] = (patterns[error.pattern] || 0) + 1;
        });
        
        return Object.entries(patterns)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([pattern, count]) => ({ pattern, count }));
    }

    getAgentErrorBreakdown(errors) {
        const breakdown = {};
        errors.forEach(error => {
            const agent = error.metadata.currentAgent || 'Unknown';
            breakdown[agent] = (breakdown[agent] || 0) + 1;
        });
        return breakdown;
    }

    getTimelineAnalysis(errors) {
        // Group errors by hour
        const timeline = {};
        errors.forEach(error => {
            const hour = new Date(error.timestamp).getHours();
            timeline[hour] = (timeline[hour] || 0) + 1;
        });
        return timeline;
    }

    getRecoveryAnalysis(errors) {
        const recoveredErrors = errors.filter(e => e.resolved);
        const totalAttempts = Array.from(this.recoveryAttempts.values()).length;
        const successfulAttempts = Array.from(this.recoveryAttempts.values())
            .filter(attempt => attempt.status === 'success').length;

        return {
            recoveryRate: errors.length > 0 ? (recoveredErrors.length / errors.length * 100) : 0,
            attemptSuccessRate: totalAttempts > 0 ? (successfulAttempts / totalAttempts * 100) : 0,
            averageResolutionTime: this.calculateAverageResolutionTime(recoveredErrors)
        };
    }

    calculateAverageResolutionTime(errors) {
        const resolvedErrors = errors.filter(e => e.resolved && e.resolutionTime);
        if (resolvedErrors.length === 0) return 0;
        
        const totalTime = resolvedErrors.reduce((sum, e) => sum + e.resolutionTime, 0);
        return totalTime / resolvedErrors.length;
    }

    convertErrorsToCSV(errors) {
        const headers = ['timestamp', 'type', 'category', 'severity', 'message', 'resolved', 'agent'];
        const rows = [headers.join(',')];
        
        errors.forEach(error => {
            const row = [
                new Date(error.timestamp).toISOString(),
                error.type,
                error.category,
                error.severity,
                `"${error.message.replace(/"/g, '""')}"`,
                error.resolved,
                error.metadata.currentAgent || ''
            ];
            rows.push(row.join(','));
        });
        
        return rows.join('\n');
    }

    /**
     * Control methods
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.debug.info('Error tracking ' + (enabled ? 'enabled' : 'disabled'));
    }

    clearErrors() {
        this.errors = [];
        this.errorStats = {
            totalErrors: 0,
            errorsByCategory: new Map(),
            errorsBySeverity: new Map(),
            errorsByAgent: new Map(),
            recentErrorRate: 0,
            averageResolutionTime: 0
        };
        this.recoveryAttempts.clear();
        
        this.debug.info('All errors cleared');
    }

    getErrorById(errorId) {
        return this.errors.find(error => error.id === errorId);
    }

    getErrorsByCategory(category) {
        return this.errors.filter(error => error.category === category);
    }

    getUnresolvedErrors() {
        return this.errors.filter(error => !error.resolved);
    }
}

// Initialize global error tracker instance
window.streamingErrorTracker = new StreamingErrorTracker();
/**
 * Comprehensive Debug Logging System
 * 
 * Provides detailed logging for agent routing decision process,
 * state transition logging for all major components, and debug
 * log filtering and analysis tools.
 * 
 * Requirements: 7.3, 7.4
 */

class DebugManager {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.logLevel = options.logLevel || 'INFO';
        this.maxLogHistory = options.maxLogHistory || 5000;
        this.enableConsoleOutput = options.enableConsoleOutput !== false;
        this.enablePersistence = options.enablePersistence !== false;
        
        // Log levels hierarchy
        this.logLevels = {
            TRACE: 0,
            DEBUG: 1,
            INFO: 2,
            WARN: 3,
            ERROR: 4,
            FATAL: 5
        };
        
        // Log storage
        this.logs = [];
        this.componentLogs = new Map();
        this.routingDecisionLogs = [];
        this.stateTransitionLogs = new Map();
        this.performanceLogs = [];
        
        // Filtering and analysis
        this.filters = new Map();
        this.logCallbacks = new Set();
        this.analysisRules = new Map();
        
        // Component state tracking
        this.componentStates = new Map();
        this.stateHistory = new Map();
        
        // Initialize debug logging
        this.initializeDebugLogging();
    }

    /**
     * Initialize debug logging system
     */
    initializeDebugLogging() {
        if (!this.enabled) return;
        
        // Set up periodic log cleanup
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldLogs();
        }, 60000); // Every minute
        
        // Initialize component state monitoring
        this.initializeStateMonitoring();
        
        // Load persisted logs if enabled
        if (this.enablePersistence) {
            this.loadPersistedLogs();
        }
    }

    /**
     * Initialize component state monitoring
     */
    initializeStateMonitoring() {
        // Monitor common component states
        const commonComponents = [
            'api-client', 'agent-router', 'streaming-manager', 
            'token-tracker', 'error-reporter', 'performance-monitor'
        ];
        
        for (const component of commonComponents) {
            this.componentStates.set(component, {
                state: 'UNKNOWN',
                lastUpdate: Date.now(),
                transitions: 0
            });
        }
    }

    /**
     * Main logging method
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} context - Additional context
     * @param {Object} options - Logging options
     */
    log(level, message, context = {}, options = {}) {
        if (!this.enabled || !this.shouldLog(level)) {
            return;
        }
        
        const logEntry = this.createLogEntry(level, message, context, options);
        
        // Store log entry
        this.storeLogs(logEntry);
        
        // Output to console if enabled
        if (this.enableConsoleOutput) {
            this.outputToConsole(logEntry);
        }
        
        // Call registered callbacks
        this.callLogCallbacks(logEntry);
        
        // Persist if enabled
        if (this.enablePersistence) {
            this.persistLog(logEntry);
        }
        
        // Analyze log for patterns
        this.analyzeLogEntry(logEntry);
        
        return logEntry;
    }

    /**
     * Create a comprehensive log entry
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} context - Additional context
     * @param {Object} options - Logging options
     * @returns {Object} Log entry
     */
    createLogEntry(level, message, context, options) {
        const timestamp = Date.now();
        const isoTimestamp = new Date(timestamp).toISOString();
        
        return {
            id: this.generateLogId(),
            timestamp,
            isoTimestamp,
            level,
            message: this.sanitizeMessage(message),
            context: this.sanitizeContext(context),
            component: context.component || 'unknown',
            operation: context.operation || 'unknown',
            correlationId: context.correlationId || options.correlationId,
            sessionId: context.sessionId,
            userId: context.userId ? this.hashUserId(context.userId) : null,
            stackTrace: options.includeStack ? this.captureStackTrace() : null,
            metadata: {
                threadId: this.getCurrentThreadId(),
                processId: this.getCurrentProcessId(),
                memoryUsage: this.getMemoryUsage(),
                performanceNow: typeof performance !== 'undefined' ? performance.now() : null
            },
            tags: options.tags || [],
            category: this.categorizeLog(level, message, context)
        };
    }

    /**
     * Log agent routing decision with detailed context
     * @param {Object} routingContext - Routing decision context
     */
    logRoutingDecision(routingContext) {
        const {
            inputText,
            selectedAgent,
            allAgents,
            decisionProcess,
            confidence,
            fallbackUsed,
            processingTime,
            context
        } = routingContext;
        
        const routingLog = {
            id: this.generateLogId(),
            timestamp: Date.now(),
            type: 'ROUTING_DECISION',
            inputText: this.sanitizeUserInput(inputText),
            selectedAgent: selectedAgent ? {
                name: selectedAgent.name,
                type: selectedAgent.type,
                confidence: confidence
            } : null,
            availableAgents: allAgents ? allAgents.map(a => ({
                name: a.name,
                type: a.type,
                score: a.score || 0
            })) : [],
            decisionProcess: {
                strategy: decisionProcess?.strategy || 'unknown',
                steps: decisionProcess?.steps || [],
                fallbackUsed: fallbackUsed || false,
                processingTime: processingTime || 0
            },
            context: this.sanitizeContext(context || {}),
            analysis: {
                inputLength: inputText ? inputText.length : 0,
                hasContext: context && Object.keys(context).length > 0,
                agentCount: allAgents ? allAgents.length : 0,
                confidenceLevel: this.categorizeConfidence(confidence)
            }
        };
        
        this.routingDecisionLogs.push(routingLog);
        
        // Keep only recent routing decisions
        if (this.routingDecisionLogs.length > 1000) {
            this.routingDecisionLogs.shift();
        }
        
        // Log as regular debug entry
        this.log('DEBUG', 'Agent routing decision made', {
            component: 'agent-router',
            operation: 'route',
            selectedAgent: selectedAgent?.name,
            confidence,
            fallbackUsed,
            processingTime
        }, { tags: ['routing', 'decision'] });
        
        return routingLog;
    }

    /**
     * Log component state transition
     * @param {string} component - Component name
     * @param {string} fromState - Previous state
     * @param {string} toState - New state
     * @param {Object} context - Transition context
     */
    logStateTransition(component, fromState, toState, context = {}) {
        const transition = {
            id: this.generateLogId(),
            timestamp: Date.now(),
            component,
            fromState,
            toState,
            context: this.sanitizeContext(context),
            duration: context.duration || null,
            trigger: context.trigger || 'unknown',
            metadata: {
                transitionCount: this.getTransitionCount(component),
                stateHistory: this.getRecentStateHistory(component, 5)
            }
        };
        
        // Update component state tracking
        this.updateComponentState(component, toState, context);
        
        // Store state transition
        if (!this.stateTransitionLogs.has(component)) {
            this.stateTransitionLogs.set(component, []);
        }
        
        const componentTransitions = this.stateTransitionLogs.get(component);
        componentTransitions.push(transition);
        
        // Keep only recent transitions
        if (componentTransitions.length > 500) {
            componentTransitions.shift();
        }
        
        // Log as regular debug entry
        this.log('DEBUG', `State transition: ${fromState} → ${toState}`, {
            component,
            operation: 'state-transition',
            fromState,
            toState,
            trigger: context.trigger
        }, { tags: ['state', 'transition'] });
        
        return transition;
    }

    /**
     * Update component state tracking
     * @param {string} component - Component name
     * @param {string} state - New state
     * @param {Object} context - State context
     */
    updateComponentState(component, state, context = {}) {
        const currentState = this.componentStates.get(component) || {
            state: 'UNKNOWN',
            lastUpdate: Date.now(),
            transitions: 0
        };
        
        const newState = {
            state,
            lastUpdate: Date.now(),
            transitions: currentState.transitions + 1,
            context: this.sanitizeContext(context),
            previousState: currentState.state
        };
        
        this.componentStates.set(component, newState);
        
        // Update state history
        if (!this.stateHistory.has(component)) {
            this.stateHistory.set(component, []);
        }
        
        const history = this.stateHistory.get(component);
        history.push({
            state,
            timestamp: Date.now(),
            context: this.sanitizeContext(context)
        });
        
        // Keep only recent history
        if (history.length > 100) {
            history.shift();
        }
    }

    /**
     * Log performance metrics
     * @param {Object} performanceData - Performance data
     */
    logPerformance(performanceData) {
        const performanceLog = {
            id: this.generateLogId(),
            timestamp: Date.now(),
            type: 'PERFORMANCE',
            operation: performanceData.operation,
            component: performanceData.component,
            duration: performanceData.duration,
            success: performanceData.success,
            metrics: {
                startTime: performanceData.startTime,
                endTime: performanceData.endTime,
                memoryBefore: performanceData.memoryBefore,
                memoryAfter: performanceData.memoryAfter,
                cpuTime: performanceData.cpuTime
            },
            context: this.sanitizeContext(performanceData.context || {})
        };
        
        this.performanceLogs.push(performanceLog);
        
        // Keep only recent performance logs
        if (this.performanceLogs.length > 2000) {
            this.performanceLogs.shift();
        }
        
        // Log as regular debug entry for slow operations
        if (performanceData.duration > 1000) { // > 1 second
            this.log('WARN', `Slow operation detected: ${performanceData.operation}`, {
                component: performanceData.component,
                operation: performanceData.operation,
                duration: performanceData.duration
            }, { tags: ['performance', 'slow'] });
        }
        
        return performanceLog;
    }

    /**
     * Convenience methods for different log levels
     */
    trace(message, context = {}, options = {}) {
        return this.log('TRACE', message, context, options);
    }

    debug(message, context = {}, options = {}) {
        return this.log('DEBUG', message, context, options);
    }

    info(message, context = {}, options = {}) {
        return this.log('INFO', message, context, options);
    }

    warn(message, context = {}, options = {}) {
        return this.log('WARN', message, context, options);
    }

    error(message, context = {}, options = {}) {
        return this.log('ERROR', message, context, options);
    }

    fatal(message, context = {}, options = {}) {
        return this.log('FATAL', message, context, options);
    }

    /**
     * Filter logs based on criteria
     * @param {Object} criteria - Filter criteria
     * @returns {Array} Filtered logs
     */
    filterLogs(criteria) {
        let filteredLogs = [...this.logs];
        
        // Filter by level
        if (criteria.level) {
            const minLevel = this.logLevels[criteria.level];
            filteredLogs = filteredLogs.filter(log => 
                this.logLevels[log.level] >= minLevel
            );
        }
        
        // Filter by component
        if (criteria.component) {
            filteredLogs = filteredLogs.filter(log => 
                log.component === criteria.component
            );
        }
        
        // Filter by operation
        if (criteria.operation) {
            filteredLogs = filteredLogs.filter(log => 
                log.operation === criteria.operation
            );
        }
        
        // Filter by time range
        if (criteria.startTime || criteria.endTime) {
            filteredLogs = filteredLogs.filter(log => {
                const logTime = log.timestamp;
                return (!criteria.startTime || logTime >= criteria.startTime) &&
                       (!criteria.endTime || logTime <= criteria.endTime);
            });
        }
        
        // Filter by tags
        if (criteria.tags && criteria.tags.length > 0) {
            filteredLogs = filteredLogs.filter(log => 
                criteria.tags.some(tag => log.tags.includes(tag))
            );
        }
        
        // Filter by message content
        if (criteria.messageContains) {
            const searchTerm = criteria.messageContains.toLowerCase();
            filteredLogs = filteredLogs.filter(log => 
                log.message.toLowerCase().includes(searchTerm)
            );
        }
        
        // Filter by correlation ID
        if (criteria.correlationId) {
            filteredLogs = filteredLogs.filter(log => 
                log.correlationId === criteria.correlationId
            );
        }
        
        return filteredLogs;
    }

    /**
     * Analyze logs for patterns and issues
     * @param {Array} logs - Logs to analyze (optional, uses all logs if not provided)
     * @returns {Object} Analysis results
     */
    analyzeLogs(logs = null) {
        const logsToAnalyze = logs || this.logs;
        const analysis = {
            summary: {
                totalLogs: logsToAnalyze.length,
                timeRange: this.getTimeRange(logsToAnalyze),
                levelDistribution: this.getLevelDistribution(logsToAnalyze),
                componentDistribution: this.getComponentDistribution(logsToAnalyze)
            },
            patterns: {
                errorPatterns: this.findErrorPatterns(logsToAnalyze),
                performanceIssues: this.findPerformanceIssues(logsToAnalyze),
                frequentOperations: this.findFrequentOperations(logsToAnalyze),
                correlatedEvents: this.findCorrelatedEvents(logsToAnalyze)
            },
            recommendations: this.generateRecommendations(logsToAnalyze)
        };
        
        return analysis;
    }

    /**
     * Get routing decision analysis
     * @param {Object} criteria - Analysis criteria
     * @returns {Object} Routing analysis
     */
    analyzeRoutingDecisions(criteria = {}) {
        let decisions = [...this.routingDecisionLogs];
        
        // Apply time filter if specified
        if (criteria.timeRange) {
            const cutoff = Date.now() - criteria.timeRange;
            decisions = decisions.filter(d => d.timestamp > cutoff);
        }
        
        const analysis = {
            summary: {
                totalDecisions: decisions.length,
                successfulRouting: decisions.filter(d => d.selectedAgent).length,
                fallbackUsed: decisions.filter(d => d.decisionProcess.fallbackUsed).length,
                averageProcessingTime: this.calculateAverageProcessingTime(decisions)
            },
            agentUsage: this.analyzeAgentUsage(decisions),
            confidenceDistribution: this.analyzeConfidenceDistribution(decisions),
            commonPatterns: this.findRoutingPatterns(decisions),
            issues: this.findRoutingIssues(decisions)
        };
        
        return analysis;
    }

    /**
     * Get state transition analysis for a component
     * @param {string} component - Component name
     * @returns {Object} State transition analysis
     */
    analyzeStateTransitions(component) {
        const transitions = this.stateTransitionLogs.get(component) || [];
        
        const analysis = {
            component,
            summary: {
                totalTransitions: transitions.length,
                uniqueStates: [...new Set(transitions.map(t => t.toState))],
                averageTransitionTime: this.calculateAverageTransitionTime(transitions),
                mostCommonTransition: this.findMostCommonTransition(transitions)
            },
            stateFrequency: this.analyzeStateFrequency(transitions),
            transitionPatterns: this.analyzeTransitionPatterns(transitions),
            anomalies: this.findTransitionAnomalies(transitions)
        };
        
        return analysis;
    }

    /**
     * Export logs in various formats
     * @param {string} format - Export format ('json', 'csv', 'text')
     * @param {Object} criteria - Filter criteria
     * @returns {string} Exported logs
     */
    exportLogs(format = 'json', criteria = {}) {
        const logs = this.filterLogs(criteria);
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(logs, null, 2);
            
            case 'csv':
                return this.exportToCSV(logs);
            
            case 'text':
                return this.exportToText(logs);
            
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Helper methods for internal operations
     */

    shouldLog(level) {
        return this.logLevels[level] >= this.logLevels[this.logLevel];
    }

    storeLogs(logEntry) {
        this.logs.push(logEntry);
        
        // Store by component
        const component = logEntry.component;
        if (!this.componentLogs.has(component)) {
            this.componentLogs.set(component, []);
        }
        this.componentLogs.get(component).push(logEntry);
        
        // Cleanup if needed
        if (this.logs.length > this.maxLogHistory) {
            this.logs.shift();
        }
        
        // Cleanup component logs
        const componentLog = this.componentLogs.get(component);
        if (componentLog.length > 1000) {
            componentLog.shift();
        }
    }

    outputToConsole(logEntry) {
        const consoleMethod = this.getConsoleMethod(logEntry.level);
        const prefix = `[${logEntry.isoTimestamp}] [${logEntry.level}] [${logEntry.component}]`;
        
        consoleMethod(`${prefix} ${logEntry.message}`, logEntry.context);
    }

    getConsoleMethod(level) {
        switch (level) {
            case 'TRACE':
            case 'DEBUG':
                return console.debug;
            case 'INFO':
                return console.info;
            case 'WARN':
                return console.warn;
            case 'ERROR':
            case 'FATAL':
                return console.error;
            default:
                return console.log;
        }
    }

    callLogCallbacks(logEntry) {
        for (const callback of this.logCallbacks) {
            try {
                callback(logEntry);
            } catch (error) {
                console.error('Log callback failed:', error);
            }
        }
    }

    analyzeLogEntry(logEntry) {
        // Apply analysis rules
        for (const [ruleName, rule] of this.analysisRules.entries()) {
            try {
                if (rule.condition(logEntry)) {
                    rule.action(logEntry, ruleName);
                }
            } catch (error) {
                console.error(`Analysis rule ${ruleName} failed:`, error);
            }
        }
    }

    cleanupOldLogs() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        
        // Clean main logs
        this.logs = this.logs.filter(log => log.timestamp > cutoff);
        
        // Clean component logs
        for (const [component, logs] of this.componentLogs.entries()) {
            const filteredLogs = logs.filter(log => log.timestamp > cutoff);
            this.componentLogs.set(component, filteredLogs);
        }
        
        // Clean routing decision logs
        this.routingDecisionLogs = this.routingDecisionLogs.filter(log => log.timestamp > cutoff);
        
        // Clean state transition logs
        for (const [component, transitions] of this.stateTransitionLogs.entries()) {
            const filteredTransitions = transitions.filter(t => t.timestamp > cutoff);
            this.stateTransitionLogs.set(component, filteredTransitions);
        }
        
        // Clean performance logs
        this.performanceLogs = this.performanceLogs.filter(log => log.timestamp > cutoff);
    }

    // Utility methods
    generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }

    sanitizeMessage(message) {
        if (typeof message !== 'string') {
            message = String(message);
        }
        
        // Remove potential sensitive data
        return message
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
            .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
            .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
            .replace(/\b[A-Za-z0-9]{20,}\b/g, '[TOKEN]');
    }

    sanitizeContext(context) {
        if (!context || typeof context !== 'object') {
            return {};
        }
        
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

    sanitizeUserInput(input) {
        if (!input) return null;
        
        // Truncate long inputs and sanitize
        const truncated = input.length > 200 ? input.substring(0, 200) + '...' : input;
        return this.sanitizeMessage(truncated);
    }

    isSensitiveField(fieldName) {
        const sensitiveFields = [
            'password', 'token', 'key', 'secret', 'auth', 'credential',
            'apiKey', 'accessToken', 'refreshToken', 'sessionId',
            'userId', 'email', 'phone', 'ssn', 'account'
        ];
        
        const lowerField = fieldName.toLowerCase();
        return sensitiveFields.some(sensitive => lowerField.includes(sensitive));
    }

    hashUserId(userId) {
        // Simple hash for client-side use
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `user_${Math.abs(hash).toString(16)}`;
    }

    captureStackTrace() {
        const error = new Error();
        return error.stack ? error.stack.split('\n').slice(2, 10) : null;
    }

    getCurrentThreadId() {
        return `thread_${Date.now()}_main`;
    }

    getCurrentProcessId() {
        return `process_${Date.now()}_browser`;
    }

    getMemoryUsage() {
        if (typeof performance !== 'undefined' && performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    categorizeLog(level, message, context) {
        if (context.component === 'agent-router') return 'routing';
        if (context.operation === 'state-transition') return 'state';
        if (message.includes('performance') || message.includes('slow')) return 'performance';
        if (level === 'ERROR' || level === 'FATAL') return 'error';
        return 'general';
    }

    categorizeConfidence(confidence) {
        if (confidence >= 0.8) return 'HIGH';
        if (confidence >= 0.6) return 'MEDIUM';
        if (confidence >= 0.4) return 'LOW';
        return 'VERY_LOW';
    }

    getTransitionCount(component) {
        const state = this.componentStates.get(component);
        return state ? state.transitions : 0;
    }

    getRecentStateHistory(component, limit = 5) {
        const history = this.stateHistory.get(component) || [];
        return history.slice(-limit);
    }

    // Analysis helper methods (simplified implementations)
    getTimeRange(logs) {
        if (logs.length === 0) return null;
        const timestamps = logs.map(log => log.timestamp);
        return {
            start: Math.min(...timestamps),
            end: Math.max(...timestamps),
            duration: Math.max(...timestamps) - Math.min(...timestamps)
        };
    }

    getLevelDistribution(logs) {
        const distribution = {};
        for (const level of Object.keys(this.logLevels)) {
            distribution[level] = logs.filter(log => log.level === level).length;
        }
        return distribution;
    }

    getComponentDistribution(logs) {
        const distribution = {};
        for (const log of logs) {
            distribution[log.component] = (distribution[log.component] || 0) + 1;
        }
        return distribution;
    }

    findErrorPatterns(logs) {
        const errorLogs = logs.filter(log => log.level === 'ERROR' || log.level === 'FATAL');
        const patterns = {};
        
        for (const log of errorLogs) {
            const key = `${log.component}:${log.operation}`;
            patterns[key] = (patterns[key] || 0) + 1;
        }
        
        return Object.entries(patterns)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([pattern, count]) => ({ pattern, count }));
    }

    findPerformanceIssues(logs) {
        return logs.filter(log => 
            log.tags && log.tags.includes('performance') && log.tags.includes('slow')
        ).slice(-10);
    }

    findFrequentOperations(logs) {
        const operations = {};
        for (const log of logs) {
            const key = `${log.component}:${log.operation}`;
            operations[key] = (operations[key] || 0) + 1;
        }
        
        return Object.entries(operations)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([operation, count]) => ({ operation, count }));
    }

    findCorrelatedEvents(logs) {
        const correlations = {};
        for (const log of logs) {
            if (log.correlationId) {
                if (!correlations[log.correlationId]) {
                    correlations[log.correlationId] = [];
                }
                correlations[log.correlationId].push(log);
            }
        }
        
        return Object.entries(correlations)
            .filter(([,events]) => events.length > 1)
            .slice(0, 5)
            .map(([correlationId, events]) => ({ correlationId, eventCount: events.length }));
    }

    generateRecommendations(logs) {
        const recommendations = [];
        
        const errorLogs = logs.filter(log => log.level === 'ERROR' || log.level === 'FATAL');
        if (errorLogs.length > logs.length * 0.1) {
            recommendations.push({
                type: 'HIGH_ERROR_RATE',
                message: 'High error rate detected. Consider reviewing error handling.',
                priority: 'HIGH'
            });
        }
        
        const slowLogs = logs.filter(log => log.tags && log.tags.includes('slow'));
        if (slowLogs.length > 0) {
            recommendations.push({
                type: 'PERFORMANCE_ISSUES',
                message: 'Slow operations detected. Consider performance optimization.',
                priority: 'MEDIUM'
            });
        }
        
        return recommendations;
    }

    // Additional analysis methods for routing and state transitions
    calculateAverageProcessingTime(decisions) {
        if (decisions.length === 0) return 0;
        const total = decisions.reduce((sum, d) => sum + (d.decisionProcess.processingTime || 0), 0);
        return total / decisions.length;
    }

    analyzeAgentUsage(decisions) {
        const usage = {};
        for (const decision of decisions) {
            if (decision.selectedAgent) {
                const agent = decision.selectedAgent.name;
                usage[agent] = (usage[agent] || 0) + 1;
            }
        }
        return usage;
    }

    analyzeConfidenceDistribution(decisions) {
        const distribution = { HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 };
        for (const decision of decisions) {
            if (decision.selectedAgent) {
                const level = this.categorizeConfidence(decision.selectedAgent.confidence);
                distribution[level]++;
            }
        }
        return distribution;
    }

    findRoutingPatterns(decisions) {
        // Simplified pattern detection
        return [];
    }

    findRoutingIssues(decisions) {
        const issues = [];
        
        const failedRoutings = decisions.filter(d => !d.selectedAgent);
        if (failedRoutings.length > 0) {
            issues.push({
                type: 'ROUTING_FAILURES',
                count: failedRoutings.length,
                percentage: (failedRoutings.length / decisions.length) * 100
            });
        }
        
        return issues;
    }

    calculateAverageTransitionTime(transitions) {
        const withDuration = transitions.filter(t => t.duration);
        if (withDuration.length === 0) return 0;
        const total = withDuration.reduce((sum, t) => sum + t.duration, 0);
        return total / withDuration.length;
    }

    findMostCommonTransition(transitions) {
        const transitionCounts = {};
        for (const t of transitions) {
            const key = `${t.fromState} → ${t.toState}`;
            transitionCounts[key] = (transitionCounts[key] || 0) + 1;
        }
        
        const entries = Object.entries(transitionCounts);
        if (entries.length === 0) return null;
        
        return entries.reduce((max, current) => 
            current[1] > max[1] ? current : max
        );
    }

    analyzeStateFrequency(transitions) {
        const frequency = {};
        for (const t of transitions) {
            frequency[t.toState] = (frequency[t.toState] || 0) + 1;
        }
        return frequency;
    }

    analyzeTransitionPatterns(transitions) {
        // Simplified pattern analysis
        return [];
    }

    findTransitionAnomalies(transitions) {
        // Simplified anomaly detection
        return [];
    }

    exportToCSV(logs) {
        const headers = ['timestamp', 'level', 'component', 'operation', 'message'];
        const rows = logs.map(log => [
            log.isoTimestamp,
            log.level,
            log.component,
            log.operation,
            log.message.replace(/"/g, '""')
        ]);
        
        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    exportToText(logs) {
        return logs.map(log => 
            `[${log.isoTimestamp}] [${log.level}] [${log.component}] ${log.message}`
        ).join('\n');
    }

    // Public API methods
    onLog(callback) {
        if (typeof callback === 'function') {
            this.logCallbacks.add(callback);
        }
    }

    offLog(callback) {
        this.logCallbacks.delete(callback);
    }

    addAnalysisRule(name, condition, action) {
        this.analysisRules.set(name, { condition, action });
    }

    removeAnalysisRule(name) {
        this.analysisRules.delete(name);
    }

    setLogLevel(level) {
        if (this.logLevels.hasOwnProperty(level)) {
            this.logLevel = level;
        }
    }

    getLogLevel() {
        return this.logLevel;
    }

    enable() {
        this.enabled = true;
        this.initializeDebugLogging();
    }

    disable() {
        this.enabled = false;
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }

    clear() {
        this.logs.length = 0;
        this.componentLogs.clear();
        this.routingDecisionLogs.length = 0;
        this.stateTransitionLogs.clear();
        this.performanceLogs.length = 0;
        this.componentStates.clear();
        this.stateHistory.clear();
    }

    // Persistence methods (simplified)
    persistLog(logEntry) {
        // In a real implementation, this would save to localStorage or send to server
        // For now, just a placeholder
    }

    loadPersistedLogs() {
        // In a real implementation, this would load from localStorage or server
        // For now, just a placeholder
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugManager;
} else if (typeof window !== 'undefined') {
    window.DebugManager = DebugManager;
}
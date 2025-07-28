/**
 * Enhanced Error Reporting System with Debugging and Monitoring
 * 
 * Provides error classification, context sanitization, alerting capabilities,
 * detailed stack trace capture, error correlation, and system state tracking
 * for the Voice Banking AI Assistant system.
 */

class ErrorReporter {
    constructor(options = {}) {
        this.alertThreshold = options.alertThreshold || 'HIGH';
        this.maxContextSize = options.maxContextSize || 1000;
        this.sensitiveFields = new Set([
            'password', 'token', 'key', 'secret', 'auth', 'credential',
            'apiKey', 'accessToken', 'refreshToken', 'sessionId',
            'userId', 'email', 'phone', 'ssn', 'account'
        ]);
        
        // Error rate tracking for requirement 9.2
        this.errorRates = new Map();
        this.alertCallbacks = new Set();
        this.loggingCallbacks = new Set();
        
        // Enhanced debugging features for requirement 7.1
        this.correlationMap = new Map(); // Track related errors
        this.systemStateCapture = new Map(); // Capture system state at error time
        this.errorChains = new Map(); // Track error chains and cascades
        this.contextHistory = new Map(); // Track context changes over time
        
        // Severity levels
        this.severityLevels = {
            LOW: 1,
            MEDIUM: 2,
            HIGH: 3,
            CRITICAL: 4
        };
        
        // Initialize system state monitoring
        this.initializeSystemStateMonitoring();
    }

    /**
     * Main error reporting method with enhanced debugging capabilities
     * @param {Error} error - The error to report
     * @param {Object} context - Additional context information
     * @param {Object} options - Reporting options
     */
    report(error, context = {}, options = {}) {
        try {
            // Generate correlation ID for tracking related issues
            const correlationId = options.correlationId || this.generateCorrelationId();
            
            // Capture current system state
            const systemState = this.captureSystemState();
            
            // Create enhanced error report
            const report = this.createEnhancedErrorReport(error, context, options, correlationId, systemState);
            
            // Track error correlations and chains
            this.trackErrorCorrelation(report, correlationId);
            
            // Update context history
            this.updateContextHistory(report);
            
            // Send to logging system
            this.sendToLogging(report);
            
            // Update error rate tracking
            this.updateErrorRates(report);
            
            // Send alerts for high-severity errors
            if (this.shouldAlert(report)) {
                this.sendAlert(report);
            }
            
            return report;
        } catch (reportingError) {
            // Fallback logging if error reporting itself fails
            console.error('Error reporting system failed:', reportingError);
            console.error('Original error:', error);
            return null;
        }
    }

    /**
     * Create an enhanced error report with detailed debugging information
     * @param {Error} error - The error to report
     * @param {Object} context - Additional context
     * @param {Object} options - Reporting options
     * @param {string} correlationId - Correlation ID for tracking related errors
     * @param {Object} systemState - Current system state
     * @returns {Object} Enhanced error report
     */
    createEnhancedErrorReport(error, context, options, correlationId, systemState) {
        const timestamp = new Date().toISOString();
        const severity = this.calculateSeverity(error, context);
        
        return {
            id: this.generateReportId(),
            correlationId,
            timestamp,
            severity: this.getSeverityName(severity),
            severityLevel: severity,
            error: this.serializeErrorWithEnhancedDetails(error),
            context: this.createEnhancedContext(context, systemState),
            stackTrace: this.captureDetailedStackTrace(error),
            environment: this.getEnvironmentInfo(),
            systemState: this.sanitizeSystemState(systemState),
            metadata: {
                component: context.component || 'unknown',
                operation: context.operation || 'unknown',
                userId: context.userId ? this.hashSensitiveData(context.userId) : null,
                sessionId: context.sessionId ? this.hashSensitiveData(context.sessionId) : null,
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
                url: typeof window !== 'undefined' ? window.location.href : null,
                threadId: this.getCurrentThreadId(),
                processId: this.getCurrentProcessId()
            },
            recovery: {
                attempted: options.recoveryAttempted || false,
                successful: options.recoverySuccessful || false,
                strategy: options.recoveryStrategy || null
            },
            debugging: {
                relatedErrors: this.getRelatedErrors(correlationId),
                errorChain: this.getErrorChain(error),
                contextHistory: this.getRecentContextHistory(context.component),
                performanceMetrics: this.getPerformanceMetrics(context.component)
            }
        };
    }

    /**
     * Serialize error object with enhanced details for debugging
     * @param {Error} error - Error to serialize
     * @returns {Object} Enhanced serialized error
     */
    serializeErrorWithEnhancedDetails(error) {
        const serialized = {
            name: error.name,
            message: this.sanitizeErrorMessage(error.message),
            code: error.code || 'UNKNOWN_ERROR',
            type: error.constructor.name,
            cause: error.cause ? this.serializeErrorWithEnhancedDetails(error.cause) : null,
            // Enhanced debugging information
            fileName: error.fileName || null,
            lineNumber: error.lineNumber || null,
            columnNumber: error.columnNumber || null,
            stack: error.stack ? this.captureDetailedStackTrace(error) : null
        };
        
        // Add any custom properties from the error object
        for (const [key, value] of Object.entries(error)) {
            if (!serialized.hasOwnProperty(key) && typeof value !== 'function') {
                serialized[key] = this.sanitizeValue(value);
            }
        }
        
        return serialized;
    }

    /**
     * Legacy method for backward compatibility
     * @param {Error} error - Error to serialize
     * @returns {Object} Serialized error
     */
    serializeError(error) {
        return this.serializeErrorWithEnhancedDetails(error);
    }

    /**
     * Sanitize context object for security
     * @param {Object} context - Context to sanitize
     * @returns {Object} Sanitized context
     */
    sanitizeContext(context) {
        if (!context || typeof context !== 'object') {
            return {};
        }

        const sanitized = {};
        const contextStr = JSON.stringify(context);
        
        // Check if context is too large
        if (contextStr.length > this.maxContextSize) {
            sanitized._truncated = true;
            sanitized._originalSize = contextStr.length;
        }

        for (const [key, value] of Object.entries(context)) {
            if (this.isSensitiveField(key)) {
                sanitized[key] = this.maskSensitiveData(value);
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeContext(value);
            } else if (typeof value === 'string' && value.length > 200) {
                sanitized[key] = value.substring(0, 200) + '...[truncated]';
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Calculate error severity based on error type and context
     * @param {Error} error - The error
     * @param {Object} context - Error context
     * @returns {number} Severity level
     */
    calculateSeverity(error, context) {
        // Critical errors
        if (error.name === 'SecurityError' || 
            error.name === 'RateLimitError' ||
            error.message.includes('CRITICAL') ||
            context.component === 'security' ||
            context.operation === 'authentication') {
            return this.severityLevels.CRITICAL;
        }

        // High severity errors
        if (error.name === 'NetworkError' ||
            error.name === 'ApiError' ||
            error.name === 'ConfigurationError' ||
            error.message.includes('failed to connect') ||
            error.message.includes('timeout') ||
            context.component === 'api-client' ||
            context.component === 'streaming') {
            return this.severityLevels.HIGH;
        }

        // Medium severity errors
        if (error.name === 'ValidationError' ||
            error.name === 'DataError' ||
            error.message.toLowerCase().includes('invalid') ||
            error.message.includes('corrupted') ||
            context.component === 'token-tracker' ||
            context.component === 'agent-router') {
            return this.severityLevels.MEDIUM;
        }

        // Default to low severity
        return this.severityLevels.LOW;
    }

    /**
     * Get severity name from level
     * @param {number} level - Severity level
     * @returns {string} Severity name
     */
    getSeverityName(level) {
        const names = Object.keys(this.severityLevels);
        return names.find(name => this.severityLevels[name] === level) || 'LOW';
    }

    /**
     * Check if field name is sensitive
     * @param {string} fieldName - Field name to check
     * @returns {boolean} True if sensitive
     */
    isSensitiveField(fieldName) {
        const lowerField = fieldName.toLowerCase();
        return Array.from(this.sensitiveFields).some(sensitive => 
            lowerField.includes(sensitive)
        );
    }

    /**
     * Mask sensitive data
     * @param {any} value - Value to mask
     * @returns {string} Masked value
     */
    maskSensitiveData(value) {
        if (typeof value === 'string') {
            if (value.length <= 4) {
                return '***';
            }
            return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
        }
        return '[REDACTED]';
    }

    /**
     * Hash sensitive data for tracking while preserving privacy
     * @param {string} data - Data to hash
     * @returns {string} Hashed data
     */
    hashSensitiveData(data) {
        // Simple hash for client-side use (not cryptographically secure)
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `hash_${Math.abs(hash).toString(16)}`;
    }

    /**
     * Sanitize stack trace to remove sensitive information
     * @param {string} stackTrace - Stack trace to sanitize
     * @returns {string} Sanitized stack trace
     */
    sanitizeStackTrace(stackTrace) {
        if (!stackTrace) return null;
        
        // Remove file paths that might contain sensitive information
        return stackTrace
            .split('\n')
            .map(line => {
                // Remove full file paths, keep only filename
                return line.replace(/\/[^\/\s]+\//g, '.../');
            })
            .join('\n');
    }

    /**
     * Sanitize error message
     * @param {string} message - Error message
     * @returns {string} Sanitized message
     */
    sanitizeErrorMessage(message) {
        if (!message) return '';
        
        // Remove potential sensitive data patterns
        return message
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
            .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
            .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
            .replace(/\b[A-Za-z0-9]{15,}\b/g, '[TOKEN]'); // Reduced from 20 to 15 characters
    }

    /**
     * Get environment information
     * @returns {Object} Environment info
     */
    getEnvironmentInfo() {
        return {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            platform: typeof navigator !== 'undefined' ? navigator.platform : null,
            language: typeof navigator !== 'undefined' ? navigator.language : null,
            timestamp: Date.now(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }

    /**
     * Generate unique report ID
     * @returns {string} Report ID
     */
    generateReportId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Update error rate tracking for requirement 9.2
     * @param {Object} report - Error report
     */
    updateErrorRates(report) {
        const component = report.metadata.component;
        const now = Date.now();
        const windowSize = 60000; // 1 minute window
        
        if (!this.errorRates.has(component)) {
            this.errorRates.set(component, []);
        }
        
        const errors = this.errorRates.get(component);
        errors.push({ timestamp: now, severity: report.severityLevel });
        
        // Clean old entries
        const cutoff = now - windowSize;
        const recentErrors = errors.filter(err => err.timestamp > cutoff);
        this.errorRates.set(component, recentErrors);
        
        // Check if error rate exceeds threshold
        this.checkErrorRateThreshold(component, recentErrors);
    }

    /**
     * Check if error rate exceeds threshold and send alerts
     * @param {string} component - Component name
     * @param {Array} recentErrors - Recent errors
     */
    checkErrorRateThreshold(component, recentErrors) {
        const highSeverityErrors = recentErrors.filter(err => 
            err.severity >= this.severityLevels.HIGH
        ).length;
        
        const totalErrors = recentErrors.length;
        
        // Alert if more than 5 high-severity errors in 1 minute
        if (highSeverityErrors > 5) {
            this.sendAlert({
                type: 'ERROR_RATE_THRESHOLD',
                component,
                message: `High error rate detected: ${highSeverityErrors} high-severity errors in 1 minute`,
                severity: 'CRITICAL',
                timestamp: new Date().toISOString(),
                metrics: {
                    highSeverityCount: highSeverityErrors,
                    totalErrorCount: totalErrors,
                    timeWindow: '1 minute'
                }
            });
        }
        
        // Alert if more than 20 total errors in 1 minute
        if (totalErrors > 20) {
            this.sendAlert({
                type: 'ERROR_VOLUME_THRESHOLD',
                component,
                message: `High error volume detected: ${totalErrors} errors in 1 minute`,
                severity: 'HIGH',
                timestamp: new Date().toISOString(),
                metrics: {
                    totalErrorCount: totalErrors,
                    timeWindow: '1 minute'
                }
            });
        }
    }

    /**
     * Determine if an alert should be sent
     * @param {Object} report - Error report
     * @returns {boolean} True if alert should be sent
     */
    shouldAlert(report) {
        const thresholdLevel = this.severityLevels[this.alertThreshold];
        return report.severityLevel >= thresholdLevel;
    }

    /**
     * Send error report to logging system
     * @param {Object} report - Error report
     */
    sendToLogging(report) {
        // Call all registered logging callbacks
        for (const callback of this.loggingCallbacks) {
            try {
                callback(report);
            } catch (error) {
                console.error('Logging callback failed:', error);
            }
        }
        
        // Default console logging
        if (this.loggingCallbacks.size === 0) {
            const logLevel = report.severityLevel >= this.severityLevels.HIGH ? 'error' : 'warn';
            console[logLevel]('Error Report:', {
                id: report.id,
                severity: report.severity,
                message: report.error.message,
                component: report.metadata.component,
                timestamp: report.timestamp
            });
        }
    }

    /**
     * Send alert for high-severity errors
     * @param {Object} report - Error report or alert object
     */
    sendAlert(report) {
        // Call all registered alert callbacks
        for (const callback of this.alertCallbacks) {
            try {
                callback(report);
            } catch (error) {
                console.error('Alert callback failed:', error);
            }
        }
        
        // Default console alerting
        if (this.alertCallbacks.size === 0) {
            console.error('🚨 ALERT:', {
                severity: report.severity,
                message: report.message || report.error?.message,
                component: report.metadata?.component || report.component,
                timestamp: report.timestamp,
                id: report.id
            });
        }
    }

    /**
     * Register a logging callback
     * @param {Function} callback - Logging callback function
     */
    onLog(callback) {
        if (typeof callback === 'function') {
            this.loggingCallbacks.add(callback);
        }
    }

    /**
     * Register an alert callback
     * @param {Function} callback - Alert callback function
     */
    onAlert(callback) {
        if (typeof callback === 'function') {
            this.alertCallbacks.add(callback);
        }
    }

    /**
     * Remove a logging callback
     * @param {Function} callback - Callback to remove
     */
    offLog(callback) {
        this.loggingCallbacks.delete(callback);
    }

    /**
     * Remove an alert callback
     * @param {Function} callback - Callback to remove
     */
    offAlert(callback) {
        this.alertCallbacks.delete(callback);
    }

    /**
     * Get error rate statistics for a component
     * @param {string} component - Component name
     * @returns {Object} Error rate statistics
     */
    getErrorRateStats(component) {
        const errors = this.errorRates.get(component) || [];
        const now = Date.now();
        const windowSize = 60000; // 1 minute
        
        const recentErrors = errors.filter(err => err.timestamp > (now - windowSize));
        const highSeverityErrors = recentErrors.filter(err => 
            err.severity >= this.severityLevels.HIGH
        );
        
        return {
            component,
            totalErrors: recentErrors.length,
            highSeverityErrors: highSeverityErrors.length,
            timeWindow: '1 minute',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get all error rate statistics
     * @returns {Array} Array of error rate statistics for all components
     */
    getAllErrorRateStats() {
        const stats = [];
        for (const component of this.errorRates.keys()) {
            stats.push(this.getErrorRateStats(component));
        }
        return stats;
    }

    /**
     * Clear error rate history for a component
     * @param {string} component - Component name
     */
    clearErrorRates(component) {
        if (component) {
            this.errorRates.delete(component);
        } else {
            this.errorRates.clear();
        }
    }

    // ===== ENHANCED DEBUGGING METHODS FOR REQUIREMENT 7.1 =====

    /**
     * Initialize system state monitoring
     */
    initializeSystemStateMonitoring() {
        // Monitor memory usage if available
        if (typeof performance !== 'undefined' && performance.memory) {
            this.memoryMonitoring = true;
        }
        
        // Monitor performance timing
        if (typeof performance !== 'undefined' && performance.now) {
            this.performanceMonitoring = true;
        }
        
        // Initialize component state tracking
        this.componentStates = new Map();
    }

    /**
     * Generate correlation ID for tracking related errors
     * @returns {string} Correlation ID
     */
    generateCorrelationId() {
        return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Capture current system state for debugging
     * @returns {Object} System state snapshot
     */
    captureSystemState() {
        const state = {
            timestamp: Date.now(),
            memory: this.captureMemoryState(),
            performance: this.capturePerformanceState(),
            components: this.captureComponentStates(),
            network: this.captureNetworkState(),
            storage: this.captureStorageState()
        };
        
        return state;
    }

    /**
     * Capture memory state information
     * @returns {Object} Memory state
     */
    captureMemoryState() {
        if (typeof performance !== 'undefined' && performance.memory) {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                memoryPressure: performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
            };
        }
        return { available: false };
    }

    /**
     * Capture performance state information
     * @returns {Object} Performance state
     */
    capturePerformanceState() {
        if (typeof performance !== 'undefined') {
            const navigation = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
            return {
                now: performance.now(),
                timeOrigin: performance.timeOrigin || Date.now(),
                navigation: navigation ? {
                    loadEventEnd: navigation.loadEventEnd,
                    domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
                    responseEnd: navigation.responseEnd
                } : null
            };
        }
        return { available: false };
    }

    /**
     * Capture component states
     * @returns {Object} Component states
     */
    captureComponentStates() {
        const states = {};
        for (const [component, state] of this.componentStates.entries()) {
            states[component] = {
                ...state,
                lastUpdated: state.lastUpdated || Date.now()
            };
        }
        return states;
    }

    /**
     * Capture network state information
     * @returns {Object} Network state
     */
    captureNetworkState() {
        if (typeof navigator !== 'undefined' && navigator.connection) {
            return {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt,
                saveData: navigator.connection.saveData
            };
        }
        return { available: false };
    }

    /**
     * Capture storage state information
     * @returns {Object} Storage state
     */
    captureStorageState() {
        try {
            const localStorage = typeof window !== 'undefined' ? window.localStorage : null;
            const sessionStorage = typeof window !== 'undefined' ? window.sessionStorage : null;
            
            return {
                localStorage: localStorage ? {
                    available: true,
                    length: localStorage.length,
                    estimatedSize: JSON.stringify(localStorage).length
                } : { available: false },
                sessionStorage: sessionStorage ? {
                    available: true,
                    length: sessionStorage.length,
                    estimatedSize: JSON.stringify(sessionStorage).length
                } : { available: false }
            };
        } catch (error) {
            return { available: false, error: error.message };
        }
    }

    /**
     * Capture detailed stack trace with source mapping
     * @param {Error} error - Error object
     * @returns {Object} Detailed stack trace information
     */
    captureDetailedStackTrace(error) {
        if (!error.stack) return null;
        
        const stackLines = error.stack.split('\n');
        const parsedStack = stackLines.map((line, index) => {
            const match = line.match(/^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
                         line.match(/^\s*at\s+(.+?):(\d+):(\d+)/) ||
                         line.match(/^\s*(.+?)@(.+?):(\d+):(\d+)/);
            
            if (match) {
                return {
                    index,
                    raw: line,
                    function: match[1] || 'anonymous',
                    file: this.sanitizeFilePath(match[2] || match[1]),
                    line: parseInt(match[3] || match[2]) || null,
                    column: parseInt(match[4] || match[3]) || null
                };
            }
            
            return {
                index,
                raw: line,
                parsed: false
            };
        });
        
        return {
            raw: this.sanitizeStackTrace(error.stack),
            parsed: parsedStack,
            depth: stackLines.length,
            topFrame: parsedStack.find(frame => frame.parsed) || null
        };
    }

    /**
     * Create enhanced context with system state
     * @param {Object} context - Original context
     * @param {Object} systemState - System state snapshot
     * @returns {Object} Enhanced context
     */
    createEnhancedContext(context, systemState) {
        const enhanced = this.sanitizeContext(context);
        
        // Add system state information
        enhanced._systemState = {
            capturedAt: systemState.timestamp,
            memory: systemState.memory,
            performance: systemState.performance,
            components: systemState.components
        };
        
        // Add context metadata
        enhanced._metadata = {
            contextSize: JSON.stringify(context).length,
            hasSystemState: true,
            captureTime: Date.now()
        };
        
        return enhanced;
    }

    /**
     * Track error correlations for related issue analysis
     * @param {Object} report - Error report
     * @param {string} correlationId - Correlation ID
     */
    trackErrorCorrelation(report, correlationId) {
        if (!this.correlationMap.has(correlationId)) {
            this.correlationMap.set(correlationId, []);
        }
        
        const correlatedErrors = this.correlationMap.get(correlationId);
        correlatedErrors.push({
            reportId: report.id,
            timestamp: report.timestamp,
            component: report.metadata.component,
            severity: report.severity,
            errorType: report.error.type,
            message: report.error.message
        });
        
        // Keep only recent correlations (last 100 per correlation ID)
        if (correlatedErrors.length > 100) {
            correlatedErrors.splice(0, correlatedErrors.length - 100);
        }
        
        // Clean old correlation IDs (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [id, errors] of this.correlationMap.entries()) {
            const recentErrors = errors.filter(err => 
                new Date(err.timestamp).getTime() > oneHourAgo
            );
            
            if (recentErrors.length === 0) {
                this.correlationMap.delete(id);
            } else {
                this.correlationMap.set(id, recentErrors);
            }
        }
    }

    /**
     * Update context history for debugging
     * @param {Object} report - Error report
     */
    updateContextHistory(report) {
        const component = report.metadata.component;
        
        if (!this.contextHistory.has(component)) {
            this.contextHistory.set(component, []);
        }
        
        const history = this.contextHistory.get(component);
        history.push({
            timestamp: report.timestamp,
            context: report.context,
            operation: report.metadata.operation,
            severity: report.severity
        });
        
        // Keep only recent history (last 50 entries per component)
        if (history.length > 50) {
            history.splice(0, history.length - 50);
        }
    }

    /**
     * Get related errors for correlation analysis
     * @param {string} correlationId - Correlation ID
     * @returns {Array} Related errors
     */
    getRelatedErrors(correlationId) {
        return this.correlationMap.get(correlationId) || [];
    }

    /**
     * Get error chain information
     * @param {Error} error - Error object
     * @returns {Array} Error chain
     */
    getErrorChain(error) {
        const chain = [];
        let currentError = error;
        
        while (currentError) {
            chain.push({
                name: currentError.name,
                message: this.sanitizeErrorMessage(currentError.message),
                type: currentError.constructor.name
            });
            
            currentError = currentError.cause;
            
            // Prevent infinite loops
            if (chain.length > 10) break;
        }
        
        return chain;
    }

    /**
     * Get recent context history for a component
     * @param {string} component - Component name
     * @returns {Array} Recent context history
     */
    getRecentContextHistory(component) {
        const history = this.contextHistory.get(component) || [];
        return history.slice(-10); // Last 10 entries
    }

    /**
     * Get performance metrics for a component
     * @param {string} component - Component name
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics(component) {
        // This would integrate with the performance monitoring system
        // For now, return basic metrics
        return {
            component,
            timestamp: Date.now(),
            available: false,
            note: 'Performance metrics integration pending'
        };
    }

    /**
     * Get current thread ID (simulated for browser environment)
     * @returns {string} Thread ID
     */
    getCurrentThreadId() {
        return `thread_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }

    /**
     * Get current process ID (simulated for browser environment)
     * @returns {string} Process ID
     */
    getCurrentProcessId() {
        return `process_${Date.now()}_main`;
    }

    /**
     * Sanitize system state for security
     * @param {Object} systemState - System state to sanitize
     * @returns {Object} Sanitized system state
     */
    sanitizeSystemState(systemState) {
        const sanitized = { ...systemState };
        
        // Remove sensitive component states
        if (sanitized.components) {
            for (const [component, state] of Object.entries(sanitized.components)) {
                sanitized.components[component] = this.sanitizeContext(state);
            }
        }
        
        return sanitized;
    }

    /**
     * Sanitize file paths to remove sensitive information
     * @param {string} filePath - File path to sanitize
     * @returns {string} Sanitized file path
     */
    sanitizeFilePath(filePath) {
        if (!filePath) return null;
        
        // Remove full paths, keep only filename and immediate directory
        const parts = filePath.split('/');
        if (parts.length > 2) {
            return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
        }
        return filePath;
    }

    /**
     * Sanitize any value for safe logging
     * @param {any} value - Value to sanitize
     * @returns {any} Sanitized value
     */
    sanitizeValue(value) {
        if (typeof value === 'string') {
            return this.sanitizeErrorMessage(value);
        } else if (typeof value === 'object' && value !== null) {
            return this.sanitizeContext(value);
        }
        return value;
    }

    /**
     * Update component state for monitoring
     * @param {string} component - Component name
     * @param {Object} state - Component state
     */
    updateComponentState(component, state) {
        this.componentStates.set(component, {
            ...state,
            lastUpdated: Date.now()
        });
    }

    /**
     * Get correlation statistics
     * @returns {Object} Correlation statistics
     */
    getCorrelationStats() {
        const stats = {
            totalCorrelations: this.correlationMap.size,
            correlations: []
        };
        
        for (const [id, errors] of this.correlationMap.entries()) {
            stats.correlations.push({
                correlationId: id,
                errorCount: errors.length,
                components: [...new Set(errors.map(e => e.component))],
                timeSpan: {
                    first: errors[0]?.timestamp,
                    last: errors[errors.length - 1]?.timestamp
                }
            });
        }
        
        return stats;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorReporter;
} else if (typeof window !== 'undefined') {
    window.ErrorReporter = ErrorReporter;
}
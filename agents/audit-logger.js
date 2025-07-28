/**
 * Comprehensive Audit Logging System for Voice Banking AI Assistant
 * Implements structured logging for security events, API calls, and agent routing decisions
 */

class AuditLogger {
    constructor(options = {}) {
        this.config = {
            // Enable/disable logging
            enabled: options.enabled !== false,
            
            // Log levels
            logLevel: options.logLevel || 'INFO', // DEBUG, INFO, WARN, ERROR, CRITICAL
            
            // Storage options
            storage: {
                console: options.storage?.console !== false,
                localStorage: options.storage?.localStorage || false,
                memory: options.storage?.memory !== false,
                maxMemoryEntries: options.storage?.maxMemoryEntries || 1000
            },
            
            // What to log
            logTypes: {
                apiCalls: options.logTypes?.apiCalls !== false,
                agentRouting: options.logTypes?.agentRouting !== false,
                securityEvents: options.logTypes?.securityEvents !== false,
                errors: options.logTypes?.errors !== false,
                performance: options.logTypes?.performance !== false,
                userActions: options.logTypes?.userActions !== false
            },
            
            // Data sanitization
            sanitize: {
                enabled: options.sanitize?.enabled !== false,
                maxStringLength: options.sanitize?.maxStringLength || 1000,
                sensitiveFields: options.sanitize?.sensitiveFields || [
                    'password', 'token', 'apiKey', 'secret', 'auth', 'authorization',
                    'ssn', 'social', 'credit', 'account', 'routing'
                ]
            }
        };

        // In-memory storage for logs
        this.memoryLogs = [];
        this.logCounts = {
            DEBUG: 0,
            INFO: 0,
            WARN: 0,
            ERROR: 0,
            CRITICAL: 0
        };

        // Session information
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
    }

    /**
     * Log an API call
     * @param {Object} details - API call details
     */
    logApiCall(details) {
        if (!this.config.logTypes.apiCalls) return;

        const logEntry = this.createLogEntry('API_CALL', 'INFO', {
            endpoint: details.endpoint,
            method: details.method || 'POST',
            requestId: details.requestId,
            userId: details.userId,
            duration: details.duration,
            statusCode: details.statusCode,
            model: details.model,
            tokenUsage: details.tokenUsage,
            success: details.success,
            errorType: details.errorType,
            userAgent: details.userAgent,
            ipAddress: this.sanitizeIpAddress(details.ipAddress)
        });

        this.writeLog(logEntry);
    }

    /**
     * Log agent routing decision
     * @param {Object} details - Routing details
     */
    logAgentRouting(details) {
        if (!this.config.logTypes.agentRouting) return;

        const logEntry = this.createLogEntry('AGENT_ROUTING', 'INFO', {
            inputText: this.sanitizeText(details.inputText),
            selectedAgent: details.selectedAgent,
            routingMethod: details.routingMethod, // 'ai', 'keyword', 'context', 'fallback'
            confidence: details.confidence,
            alternativeAgents: details.alternativeAgents,
            processingTime: details.processingTime,
            userId: details.userId,
            sessionId: details.sessionId,
            context: this.sanitizeObject(details.context),
            fallbackUsed: details.fallbackUsed,
            cacheHit: details.cacheHit
        });

        this.writeLog(logEntry);
    }

    /**
     * Log security event
     * @param {Object} details - Security event details
     */
    logSecurityEvent(details) {
        if (!this.config.logTypes.securityEvents) return;

        const level = this.getSecurityEventLevel(details.eventType);
        const logEntry = this.createLogEntry('SECURITY_EVENT', level, {
            eventType: details.eventType, // 'RATE_LIMIT', 'VALIDATION_FAILED', 'SUSPICIOUS_ACTIVITY', etc.
            severity: details.severity || 'MEDIUM',
            userId: details.userId,
            ipAddress: this.sanitizeIpAddress(details.ipAddress),
            userAgent: details.userAgent,
            endpoint: details.endpoint,
            requestData: this.sanitizeObject(details.requestData),
            reason: details.reason,
            action: details.action, // 'BLOCKED', 'ALLOWED', 'FLAGGED'
            riskScore: details.riskScore,
            geolocation: details.geolocation
        });

        this.writeLog(logEntry);

        // Alert for high-severity security events
        if (details.severity === 'HIGH' || details.severity === 'CRITICAL') {
            this.alertSecurityTeam(logEntry);
        }
    }

    /**
     * Log error event
     * @param {Error} error - Error object
     * @param {Object} context - Additional context
     */
    logError(error, context = {}) {
        if (!this.config.logTypes.errors) return;

        const level = error.name === 'ValidationError' ? 'WARN' : 'ERROR';
        const logEntry = this.createLogEntry('ERROR', level, {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: this.sanitizeStackTrace(error.stack),
            errorCode: error.code,
            component: context.component,
            operation: context.operation,
            userId: context.userId,
            requestId: context.requestId,
            inputData: this.sanitizeObject(context.inputData),
            systemState: context.systemState,
            recovery: context.recovery // How the error was handled
        });

        this.writeLog(logEntry);
    }

    /**
     * Log performance metrics
     * @param {Object} metrics - Performance metrics
     */
    logPerformance(metrics) {
        if (!this.config.logTypes.performance) return;

        const logEntry = this.createLogEntry('PERFORMANCE', 'INFO', {
            operation: metrics.operation,
            duration: metrics.duration,
            memoryUsage: metrics.memoryUsage,
            cpuUsage: metrics.cpuUsage,
            cacheHitRate: metrics.cacheHitRate,
            throughput: metrics.throughput,
            errorRate: metrics.errorRate,
            userId: metrics.userId,
            component: metrics.component,
            threshold: metrics.threshold,
            exceeded: metrics.duration > metrics.threshold
        });

        this.writeLog(logEntry);
    }

    /**
     * Log user action
     * @param {Object} details - User action details
     */
    logUserAction(details) {
        if (!this.config.logTypes.userActions) return;

        const logEntry = this.createLogEntry('USER_ACTION', 'INFO', {
            action: details.action, // 'LOGIN', 'LOGOUT', 'QUERY', 'CONFIG_CHANGE', etc.
            userId: details.userId,
            sessionId: details.sessionId,
            ipAddress: this.sanitizeIpAddress(details.ipAddress),
            userAgent: details.userAgent,
            timestamp: details.timestamp,
            success: details.success,
            details: this.sanitizeObject(details.details),
            duration: details.duration
        });

        this.writeLog(logEntry);
    }

    /**
     * Create a structured log entry
     * @param {string} type - Log type
     * @param {string} level - Log level
     * @param {Object} data - Log data
     * @returns {Object} Structured log entry
     */
    createLogEntry(type, level, data) {
        const timestamp = new Date().toISOString();
        const logId = this.generateLogId();

        return {
            logId,
            timestamp,
            sessionId: this.sessionId,
            type,
            level,
            data: this.sanitizeLogData(data),
            metadata: {
                version: '1.0',
                source: 'voice-banking-ai',
                environment: this.getEnvironment(),
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
            }
        };
    }

    /**
     * Write log entry to configured outputs
     * @param {Object} logEntry - Log entry to write
     */
    writeLog(logEntry) {
        if (!this.config.enabled) return;

        // Check log level
        if (!this.shouldLog(logEntry.level)) return;

        // Increment counter
        this.logCounts[logEntry.level]++;

        // Write to console
        if (this.config.storage.console) {
            this.writeToConsole(logEntry);
        }

        // Write to memory
        if (this.config.storage.memory) {
            this.writeToMemory(logEntry);
        }

        // Write to localStorage
        if (this.config.storage.localStorage && typeof localStorage !== 'undefined') {
            this.writeToLocalStorage(logEntry);
        }
    }

    /**
     * Write to console with appropriate formatting
     */
    writeToConsole(logEntry) {
        const message = `[${logEntry.timestamp}] ${logEntry.level} ${logEntry.type}: ${JSON.stringify(logEntry.data, null, 2)}`;
        
        switch (logEntry.level) {
            case 'DEBUG':
                console.debug(message);
                break;
            case 'INFO':
                console.info(message);
                break;
            case 'WARN':
                console.warn(message);
                break;
            case 'ERROR':
            case 'CRITICAL':
                console.error(message);
                break;
            default:
                console.log(message);
        }
    }

    /**
     * Write to memory storage
     */
    writeToMemory(logEntry) {
        this.memoryLogs.push(logEntry);
        
        // Maintain max entries limit
        if (this.memoryLogs.length > this.config.storage.maxMemoryEntries) {
            this.memoryLogs.shift(); // Remove oldest entry
        }
    }

    /**
     * Write to localStorage
     */
    writeToLocalStorage(logEntry) {
        try {
            const key = `audit_log_${Date.now()}_${logEntry.logId}`;
            localStorage.setItem(key, JSON.stringify(logEntry));
            
            // Clean up old entries (keep last 100)
            this.cleanupLocalStorage();
        } catch (error) {
            console.warn('Failed to write audit log to localStorage:', error.message);
        }
    }

    /**
     * Clean up old localStorage entries
     */
    cleanupLocalStorage() {
        try {
            const keys = Object.keys(localStorage).filter(key => key.startsWith('audit_log_'));
            if (keys.length > 100) {
                keys.sort().slice(0, keys.length - 100).forEach(key => {
                    localStorage.removeItem(key);
                });
            }
        } catch (error) {
            console.warn('Failed to cleanup audit logs from localStorage:', error.message);
        }
    }

    /**
     * Sanitize log data
     */
    sanitizeLogData(data) {
        if (!this.config.sanitize.enabled) return data;
        
        return this.sanitizeObject(data);
    }

    /**
     * Sanitize object recursively
     */
    sanitizeObject(obj, depth = 0) {
        if (depth > 5 || !obj || typeof obj !== 'object') return obj;
        
        const sanitized = Array.isArray(obj) ? [] : {};
        
        for (const [key, value] of Object.entries(obj)) {
            // Check for sensitive fields
            if (this.isSensitiveField(key)) {
                sanitized[key] = '[REDACTED]';
                continue;
            }
            
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeText(value);
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeObject(value, depth + 1);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    /**
     * Sanitize text content
     */
    sanitizeText(text) {
        if (typeof text !== 'string') return text;
        
        // Truncate long strings
        if (text.length > this.config.sanitize.maxStringLength) {
            text = text.substring(0, this.config.sanitize.maxStringLength) + '...[TRUNCATED]';
        }
        
        // Remove potential PII patterns
        text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]'); // SSN
        text = text.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]'); // Credit card
        text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]'); // Email
        
        return text;
    }

    /**
     * Sanitize IP address (keep first 3 octets)
     */
    sanitizeIpAddress(ip) {
        if (!ip || typeof ip !== 'string') return ip;
        
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
        }
        
        return '[IP]';
    }

    /**
     * Sanitize stack trace
     */
    sanitizeStackTrace(stack) {
        if (!stack) return stack;
        
        // Remove file paths that might contain sensitive information
        return stack.replace(/\/[^\s]+\//g, '/[PATH]/');
    }

    /**
     * Check if field is sensitive
     */
    isSensitiveField(fieldName) {
        const lowerField = fieldName.toLowerCase();
        return this.config.sanitize.sensitiveFields.some(sensitive => 
            lowerField.includes(sensitive.toLowerCase())
        );
    }

    /**
     * Determine if we should log at this level
     */
    shouldLog(level) {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
        const currentLevelIndex = levels.indexOf(this.config.logLevel);
        const logLevelIndex = levels.indexOf(level);
        
        return logLevelIndex >= currentLevelIndex;
    }

    /**
     * Get security event log level
     */
    getSecurityEventLevel(eventType) {
        const highSeverityEvents = ['RATE_LIMIT_EXCEEDED', 'VALIDATION_FAILED', 'SUSPICIOUS_ACTIVITY'];
        const criticalEvents = ['SECURITY_BREACH', 'UNAUTHORIZED_ACCESS'];
        
        if (criticalEvents.includes(eventType)) return 'CRITICAL';
        if (highSeverityEvents.includes(eventType)) return 'ERROR';
        return 'WARN';
    }

    /**
     * Alert security team for critical events
     */
    alertSecurityTeam(logEntry) {
        // In a real implementation, this would send alerts via email, Slack, etc.
        console.error('SECURITY ALERT:', logEntry);
    }

    /**
     * Get logs from memory
     */
    getLogs(filter = {}) {
        let logs = [...this.memoryLogs];
        
        if (filter.type) {
            logs = logs.filter(log => log.type === filter.type);
        }
        
        if (filter.level) {
            logs = logs.filter(log => log.level === filter.level);
        }
        
        if (filter.since) {
            const since = new Date(filter.since);
            logs = logs.filter(log => new Date(log.timestamp) >= since);
        }
        
        return logs;
    }

    /**
     * Get logging statistics
     */
    getStats() {
        return {
            sessionId: this.sessionId,
            startTime: new Date(this.startTime).toISOString(),
            uptime: Date.now() - this.startTime,
            totalLogs: this.memoryLogs.length,
            logCounts: { ...this.logCounts },
            config: this.config
        };
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate unique log ID
     */
    generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get environment info
     */
    getEnvironment() {
        if (typeof window !== 'undefined') {
            return 'browser';
        } else if (typeof process !== 'undefined') {
            return 'node';
        }
        return 'unknown';
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Clear all logs
     */
    clearLogs() {
        this.memoryLogs = [];
        this.logCounts = {
            DEBUG: 0,
            INFO: 0,
            WARN: 0,
            ERROR: 0,
            CRITICAL: 0
        };
    }
}

// Export class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuditLogger };
} else if (typeof window !== 'undefined') {
    window.AuditLogger = AuditLogger;
}
/**
 * Monitoring Dashboard Integration System
 * 
 * Provides metrics export for external monitoring systems,
 * health check endpoints for system monitoring, and
 * real-time status reporting capabilities.
 * 
 * Requirements: 7.4, 9.1
 */

class MonitoringDashboard {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.updateInterval = options.updateInterval || 30000; // 30 seconds
        this.metricsRetentionPeriod = options.metricsRetentionPeriod || 24 * 60 * 60 * 1000; // 24 hours
        this.healthCheckTimeout = options.healthCheckTimeout || 5000; // 5 seconds
        
        // Component references
        this.errorReporter = options.errorReporter;
        this.performanceMonitor = options.performanceMonitor;
        this.debugManager = options.debugManager;
        
        // Dashboard state
        this.metrics = new Map();
        this.healthStatus = new Map();
        this.alerts = [];
        this.systemStatus = 'UNKNOWN';
        this.lastUpdate = null;
        
        // Real-time monitoring
        this.subscribers = new Set();
        this.metricsHistory = [];
        this.healthHistory = [];
        
        // Health check definitions
        this.healthChecks = new Map();
        
        // Initialize monitoring dashboard
        this.initializeDashboard();
    }

    /**
     * Initialize monitoring dashboard
     */
    initializeDashboard() {
        if (!this.enabled) return;
        
        // Register default health checks
        this.registerDefaultHealthChecks();
        
        // Start periodic updates
        this.startPeriodicUpdates();
        
        // Initialize metrics collection
        this.initializeMetricsCollection();
    }

    /**
     * Register default health checks
     */
    registerDefaultHealthChecks() {
        // System memory health check
        this.registerHealthCheck('memory', async () => {
            if (typeof performance !== 'undefined' && performance.memory) {
                const memory = performance.memory;
                const usagePercentage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
                
                return {
                    status: usagePercentage < 0.8 ? 'HEALTHY' : usagePercentage < 0.9 ? 'WARNING' : 'CRITICAL',
                    details: {
                        usedJSHeapSize: memory.usedJSHeapSize,
                        totalJSHeapSize: memory.totalJSHeapSize,
                        jsHeapSizeLimit: memory.jsHeapSizeLimit,
                        usagePercentage: Math.round(usagePercentage * 100)
                    },
                    message: `Memory usage: ${Math.round(usagePercentage * 100)}%`
                };
            }
            
            return {
                status: 'UNKNOWN',
                details: {},
                message: 'Memory monitoring not available'
            };
        });

        // Error rate health check
        this.registerHealthCheck('error-rate', async () => {
            if (!this.errorReporter) {
                return {
                    status: 'UNKNOWN',
                    details: {},
                    message: 'Error reporter not available'
                };
            }
            
            const stats = this.errorReporter.getAllErrorRateStats();
            const totalErrors = stats.reduce((sum, stat) => sum + stat.totalErrors, 0);
            const totalHighSeverity = stats.reduce((sum, stat) => sum + stat.highSeverityErrors, 0);
            
            const status = totalHighSeverity > 10 ? 'CRITICAL' : 
                          totalErrors > 50 ? 'WARNING' : 'HEALTHY';
            
            return {
                status,
                details: {
                    totalErrors,
                    totalHighSeverity,
                    componentStats: stats
                },
                message: `Error rate: ${totalErrors} total, ${totalHighSeverity} high severity`
            };
        });

        // Performance health check
        this.registerHealthCheck('performance', async () => {
            if (!this.performanceMonitor) {
                return {
                    status: 'UNKNOWN',
                    details: {},
                    message: 'Performance monitor not available'
                };
            }
            
            const summary = this.performanceMonitor.getPerformanceSummary();
            const avgResponseTime = summary.operations.averageResponseTime;
            const errorRate = summary.operations.errorRate;
            
            const status = avgResponseTime > 5000 || errorRate > 0.1 ? 'CRITICAL' :
                          avgResponseTime > 2000 || errorRate > 0.05 ? 'WARNING' : 'HEALTHY';
            
            return {
                status,
                details: {
                    averageResponseTime: avgResponseTime,
                    errorRate: errorRate,
                    totalOperations: summary.operations.totalOperations,
                    bottlenecks: summary.bottlenecks.length
                },
                message: `Avg response: ${Math.round(avgResponseTime)}ms, Error rate: ${Math.round(errorRate * 100)}%`
            };
        });

        // Debug logging health check
        this.registerHealthCheck('debug-logging', async () => {
            if (!this.debugManager) {
                return {
                    status: 'UNKNOWN',
                    details: {},
                    message: 'Debug manager not available'
                };
            }
            
            const analysis = this.debugManager.analyzeLogs();
            const errorLogs = analysis.summary.levelDistribution.ERROR || 0;
            const fatalLogs = analysis.summary.levelDistribution.FATAL || 0;
            const totalLogs = analysis.summary.totalLogs;
            
            const errorPercentage = totalLogs > 0 ? (errorLogs + fatalLogs) / totalLogs : 0;
            const status = errorPercentage > 0.2 ? 'CRITICAL' :
                          errorPercentage > 0.1 ? 'WARNING' : 'HEALTHY';
            
            return {
                status,
                details: {
                    totalLogs,
                    errorLogs,
                    fatalLogs,
                    errorPercentage: Math.round(errorPercentage * 100),
                    recommendations: analysis.recommendations.length
                },
                message: `Log health: ${totalLogs} total, ${Math.round(errorPercentage * 100)}% errors`
            };
        });

        // Network connectivity health check
        this.registerHealthCheck('network', async () => {
            if (typeof navigator !== 'undefined' && navigator.onLine !== undefined) {
                const isOnline = navigator.onLine;
                const connection = navigator.connection;
                
                let status = 'HEALTHY';
                let message = 'Network connectivity normal';
                
                if (!isOnline) {
                    status = 'CRITICAL';
                    message = 'Network offline';
                } else if (connection && connection.effectiveType === 'slow-2g') {
                    status = 'WARNING';
                    message = 'Slow network connection detected';
                }
                
                return {
                    status,
                    details: {
                        online: isOnline,
                        effectiveType: connection?.effectiveType,
                        downlink: connection?.downlink,
                        rtt: connection?.rtt
                    },
                    message
                };
            }
            
            return {
                status: 'UNKNOWN',
                details: {},
                message: 'Network status not available'
            };
        });
    }

    /**
     * Start periodic updates
     */
    startPeriodicUpdates() {
        this.updateInterval = setInterval(async () => {
            await this.updateMetrics();
            await this.updateHealthStatus();
            this.notifySubscribers();
        }, this.updateInterval);
    }

    /**
     * Initialize metrics collection
     */
    initializeMetricsCollection() {
        // Set up metrics collection from various sources
        this.collectSystemMetrics();
    }

    /**
     * Register a health check
     * @param {string} name - Health check name
     * @param {Function} checkFunction - Health check function
     */
    registerHealthCheck(name, checkFunction) {
        this.healthChecks.set(name, {
            name,
            checkFunction,
            lastRun: null,
            lastResult: null
        });
    }

    /**
     * Remove a health check
     * @param {string} name - Health check name
     */
    unregisterHealthCheck(name) {
        this.healthChecks.delete(name);
    }

    /**
     * Run all health checks
     * @returns {Object} Health check results
     */
    async runHealthChecks() {
        const results = {};
        const promises = [];
        
        for (const [name, healthCheck] of this.healthChecks.entries()) {
            const promise = this.runSingleHealthCheck(name, healthCheck);
            promises.push(promise);
        }
        
        const healthCheckResults = await Promise.allSettled(promises);
        
        for (let i = 0; i < healthCheckResults.length; i++) {
            const result = healthCheckResults[i];
            const name = Array.from(this.healthChecks.keys())[i];
            
            if (result.status === 'fulfilled') {
                results[name] = result.value;
            } else {
                results[name] = {
                    status: 'ERROR',
                    details: { error: result.reason.message },
                    message: `Health check failed: ${result.reason.message}`
                };
            }
        }
        
        return results;
    }

    /**
     * Run a single health check with timeout
     * @param {string} name - Health check name
     * @param {Object} healthCheck - Health check definition
     * @returns {Object} Health check result
     */
    async runSingleHealthCheck(name, healthCheck) {
        const startTime = Date.now();
        
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Health check timeout')), this.healthCheckTimeout);
            });
            
            const result = await Promise.race([
                healthCheck.checkFunction(),
                timeoutPromise
            ]);
            
            const duration = Date.now() - startTime;
            
            healthCheck.lastRun = Date.now();
            healthCheck.lastResult = result;
            
            return {
                ...result,
                name,
                duration,
                timestamp: Date.now()
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            
            return {
                status: 'ERROR',
                name,
                duration,
                timestamp: Date.now(),
                details: { error: error.message },
                message: `Health check error: ${error.message}`
            };
        }
    }

    /**
     * Update system metrics
     */
    async updateMetrics() {
        const timestamp = Date.now();
        
        const metrics = {
            timestamp,
            system: await this.collectSystemMetrics(),
            performance: this.collectPerformanceMetrics(),
            errors: this.collectErrorMetrics(),
            debug: this.collectDebugMetrics(),
            custom: this.collectCustomMetrics()
        };
        
        // Store metrics
        this.metrics.set(timestamp, metrics);
        this.metricsHistory.push(metrics);
        
        // Clean old metrics
        this.cleanOldMetrics();
        
        this.lastUpdate = timestamp;
    }

    /**
     * Update health status
     */
    async updateHealthStatus() {
        const healthResults = await this.runHealthChecks();
        const timestamp = Date.now();
        
        // Determine overall system status
        const statuses = Object.values(healthResults).map(r => r.status);
        let overallStatus = 'HEALTHY';
        
        if (statuses.includes('CRITICAL')) {
            overallStatus = 'CRITICAL';
        } else if (statuses.includes('WARNING')) {
            overallStatus = 'WARNING';
        } else if (statuses.includes('ERROR')) {
            overallStatus = 'ERROR';
        } else if (statuses.includes('UNKNOWN')) {
            overallStatus = 'DEGRADED';
        }
        
        const healthStatus = {
            timestamp,
            overallStatus,
            checks: healthResults,
            summary: {
                total: Object.keys(healthResults).length,
                healthy: statuses.filter(s => s === 'HEALTHY').length,
                warning: statuses.filter(s => s === 'WARNING').length,
                critical: statuses.filter(s => s === 'CRITICAL').length,
                error: statuses.filter(s => s === 'ERROR').length,
                unknown: statuses.filter(s => s === 'UNKNOWN').length
            }
        };
        
        this.healthStatus.set(timestamp, healthStatus);
        this.healthHistory.push(healthStatus);
        this.systemStatus = overallStatus;
        
        // Clean old health status
        this.cleanOldHealthStatus();
    }

    /**
     * Collect system metrics
     * @returns {Object} System metrics
     */
    async collectSystemMetrics() {
        const metrics = {
            timestamp: Date.now(),
            memory: this.getMemoryMetrics(),
            performance: this.getPerformanceMetrics(),
            network: this.getNetworkMetrics(),
            storage: this.getStorageMetrics()
        };
        
        return metrics;
    }

    /**
     * Collect performance metrics
     * @returns {Object} Performance metrics
     */
    collectPerformanceMetrics() {
        if (!this.performanceMonitor) return null;
        
        const summary = this.performanceMonitor.getPerformanceSummary();
        return {
            operations: summary.operations,
            bottlenecks: summary.bottlenecks,
            monitoring: summary.monitoring
        };
    }

    /**
     * Collect error metrics
     * @returns {Object} Error metrics
     */
    collectErrorMetrics() {
        if (!this.errorReporter) return null;
        
        const stats = this.errorReporter.getAllErrorRateStats();
        return {
            componentStats: stats,
            totalErrors: stats.reduce((sum, stat) => sum + stat.totalErrors, 0),
            totalHighSeverity: stats.reduce((sum, stat) => sum + stat.highSeverityErrors, 0)
        };
    }

    /**
     * Collect debug metrics
     * @returns {Object} Debug metrics
     */
    collectDebugMetrics() {
        if (!this.debugManager) return null;
        
        const analysis = this.debugManager.analyzeLogs();
        return {
            totalLogs: analysis.summary.totalLogs,
            levelDistribution: analysis.summary.levelDistribution,
            componentDistribution: analysis.summary.componentDistribution,
            errorPatterns: analysis.patterns.errorPatterns.length,
            recommendations: analysis.recommendations.length
        };
    }

    /**
     * Collect custom metrics
     * @returns {Object} Custom metrics
     */
    collectCustomMetrics() {
        // Placeholder for custom metrics
        return {
            uptime: Date.now() - (this.startTime || Date.now()),
            version: '1.0.0',
            environment: 'browser'
        };
    }

    /**
     * Get memory metrics
     * @returns {Object} Memory metrics
     */
    getMemoryMetrics() {
        if (typeof performance !== 'undefined' && performance.memory) {
            const memory = performance.memory;
            return {
                usedJSHeapSize: memory.usedJSHeapSize,
                totalJSHeapSize: memory.totalJSHeapSize,
                jsHeapSizeLimit: memory.jsHeapSizeLimit,
                usagePercentage: memory.usedJSHeapSize / memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    /**
     * Get performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        if (typeof performance !== 'undefined') {
            return {
                now: performance.now(),
                timeOrigin: performance.timeOrigin || Date.now()
            };
        }
        return null;
    }

    /**
     * Get network metrics
     * @returns {Object} Network metrics
     */
    getNetworkMetrics() {
        if (typeof navigator !== 'undefined') {
            const connection = navigator.connection;
            return {
                online: navigator.onLine,
                effectiveType: connection?.effectiveType,
                downlink: connection?.downlink,
                rtt: connection?.rtt,
                saveData: connection?.saveData
            };
        }
        return null;
    }

    /**
     * Get storage metrics
     * @returns {Object} Storage metrics
     */
    getStorageMetrics() {
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
     * Export metrics in various formats
     * @param {string} format - Export format ('json', 'prometheus', 'csv')
     * @param {Object} options - Export options
     * @returns {string} Exported metrics
     */
    exportMetrics(format = 'json', options = {}) {
        const timeRange = options.timeRange || 3600000; // 1 hour default
        const cutoff = Date.now() - timeRange;
        
        const recentMetrics = this.metricsHistory.filter(m => m.timestamp > cutoff);
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(recentMetrics, null, 2);
            
            case 'prometheus':
                return this.exportToPrometheus(recentMetrics);
            
            case 'csv':
                return this.exportMetricsToCSV(recentMetrics);
            
            default:
                throw new Error(`Unsupported metrics export format: ${format}`);
        }
    }

    /**
     * Export to Prometheus format
     * @param {Array} metrics - Metrics to export
     * @returns {string} Prometheus format metrics
     */
    exportToPrometheus(metrics) {
        if (metrics.length === 0) return '';
        
        const latest = metrics[metrics.length - 1];
        let output = '';
        
        // Memory metrics
        if (latest.system.memory) {
            output += `# HELP memory_usage_bytes Memory usage in bytes\n`;
            output += `# TYPE memory_usage_bytes gauge\n`;
            output += `memory_usage_bytes{type="used"} ${latest.system.memory.usedJSHeapSize}\n`;
            output += `memory_usage_bytes{type="total"} ${latest.system.memory.totalJSHeapSize}\n`;
            output += `memory_usage_bytes{type="limit"} ${latest.system.memory.jsHeapSizeLimit}\n`;
        }
        
        // Performance metrics
        if (latest.performance) {
            output += `# HELP operations_total Total number of operations\n`;
            output += `# TYPE operations_total counter\n`;
            output += `operations_total ${latest.performance.operations.totalOperations}\n`;
            
            output += `# HELP response_time_ms Average response time in milliseconds\n`;
            output += `# TYPE response_time_ms gauge\n`;
            output += `response_time_ms ${latest.performance.operations.averageResponseTime}\n`;
            
            output += `# HELP error_rate Error rate as percentage\n`;
            output += `# TYPE error_rate gauge\n`;
            output += `error_rate ${latest.performance.operations.errorRate}\n`;
        }
        
        // Error metrics
        if (latest.errors) {
            output += `# HELP errors_total Total number of errors\n`;
            output += `# TYPE errors_total counter\n`;
            output += `errors_total ${latest.errors.totalErrors}\n`;
            
            output += `# HELP high_severity_errors_total Total number of high severity errors\n`;
            output += `# TYPE high_severity_errors_total counter\n`;
            output += `high_severity_errors_total ${latest.errors.totalHighSeverity}\n`;
        }
        
        return output;
    }

    /**
     * Export metrics to CSV
     * @param {Array} metrics - Metrics to export
     * @returns {string} CSV format metrics
     */
    exportMetricsToCSV(metrics) {
        if (metrics.length === 0) return '';
        
        const headers = [
            'timestamp',
            'memory_used',
            'memory_total',
            'memory_limit',
            'total_operations',
            'avg_response_time',
            'error_rate',
            'total_errors',
            'high_severity_errors'
        ];
        
        const rows = metrics.map(m => [
            new Date(m.timestamp).toISOString(),
            m.system.memory?.usedJSHeapSize || 0,
            m.system.memory?.totalJSHeapSize || 0,
            m.system.memory?.jsHeapSizeLimit || 0,
            m.performance?.operations.totalOperations || 0,
            m.performance?.operations.averageResponseTime || 0,
            m.performance?.operations.errorRate || 0,
            m.errors?.totalErrors || 0,
            m.errors?.totalHighSeverity || 0
        ]);
        
        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    /**
     * Get current dashboard status
     * @returns {Object} Dashboard status
     */
    getDashboardStatus() {
        const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
        const latestHealth = this.healthHistory[this.healthHistory.length - 1];
        
        return {
            timestamp: Date.now(),
            systemStatus: this.systemStatus,
            lastUpdate: this.lastUpdate,
            metrics: latestMetrics,
            health: latestHealth,
            uptime: Date.now() - (this.startTime || Date.now()),
            monitoring: {
                enabled: this.enabled,
                healthChecks: this.healthChecks.size,
                subscribers: this.subscribers.size,
                metricsHistory: this.metricsHistory.length,
                healthHistory: this.healthHistory.length
            }
        };
    }

    /**
     * Get health check endpoint response
     * @returns {Object} Health check response
     */
    async getHealthCheckResponse() {
        const healthResults = await this.runHealthChecks();
        const overallStatus = this.systemStatus;
        
        return {
            status: overallStatus,
            timestamp: Date.now(),
            checks: healthResults,
            uptime: Date.now() - (this.startTime || Date.now()),
            version: '1.0.0'
        };
    }

    /**
     * Subscribe to real-time updates
     * @param {Function} callback - Update callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        
        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * Notify all subscribers of updates
     */
    notifySubscribers() {
        const status = this.getDashboardStatus();
        
        for (const callback of this.subscribers) {
            try {
                callback(status);
            } catch (error) {
                console.error('Dashboard subscriber callback failed:', error);
            }
        }
    }

    /**
     * Clean old metrics
     */
    cleanOldMetrics() {
        const cutoff = Date.now() - this.metricsRetentionPeriod;
        
        // Clean metrics map
        for (const [timestamp] of this.metrics.entries()) {
            if (timestamp < cutoff) {
                this.metrics.delete(timestamp);
            }
        }
        
        // Clean metrics history
        this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoff);
    }

    /**
     * Clean old health status
     */
    cleanOldHealthStatus() {
        const cutoff = Date.now() - this.metricsRetentionPeriod;
        
        // Clean health status map
        for (const [timestamp] of this.healthStatus.entries()) {
            if (timestamp < cutoff) {
                this.healthStatus.delete(timestamp);
            }
        }
        
        // Clean health history
        this.healthHistory = this.healthHistory.filter(h => h.timestamp > cutoff);
    }

    /**
     * Start monitoring dashboard
     */
    start() {
        if (this.enabled) return;
        
        this.enabled = true;
        this.startTime = Date.now();
        this.initializeDashboard();
    }

    /**
     * Stop monitoring dashboard
     */
    stop() {
        this.enabled = false;
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        this.subscribers.clear();
    }

    /**
     * Reset dashboard state
     */
    reset() {
        this.metrics.clear();
        this.healthStatus.clear();
        this.metricsHistory.length = 0;
        this.healthHistory.length = 0;
        this.alerts.length = 0;
        this.systemStatus = 'UNKNOWN';
        this.lastUpdate = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MonitoringDashboard;
} else if (typeof window !== 'undefined') {
    window.MonitoringDashboard = MonitoringDashboard;
}
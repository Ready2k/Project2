/**
 * MetricsCollector - System performance metrics collection and threshold monitoring
 * Provides comprehensive system metrics collection with configurable thresholds and alerting
 */

class MetricsCollector {
    constructor(config = {}) {
        this.config = {
            collectionInterval: config.collectionInterval || 30000, // 30 seconds
            retentionPeriod: config.retentionPeriod || 3600000, // 1 hour
            thresholds: {
                memoryUsage: config.thresholds?.memoryUsage || 80, // 80%
                errorRate: config.thresholds?.errorRate || 5, // 5%
                responseTime: config.thresholds?.responseTime || 2000, // 2 seconds
                cpuUsage: config.thresholds?.cpuUsage || 70, // 70%
                ...config.thresholds
            },
            ...config
        };

        this.metrics = new Map();
        this.alerts = [];
        this.collectors = new Map();
        this.isCollecting = false;
        this.collectionTimer = null;
        
        this.initializeMetrics();
        this.setupCollectors();
    }

    /**
     * Initialize metric storage structures
     */
    initializeMetrics() {
        const metricTypes = [
            'memory_usage',
            'cpu_usage', 
            'response_time',
            'error_rate',
            'request_count',
            'active_connections',
            'cache_hit_rate',
            'token_usage',
            'agent_routing_time',
            'streaming_sessions'
        ];

        metricTypes.forEach(type => {
            this.metrics.set(type, {
                current: 0,
                history: [],
                threshold: this.config.thresholds[type.replace('_', '')] || null,
                lastAlert: null
            });
        });
    }

    /**
     * Setup metric collectors for different system components
     */
    setupCollectors() {
        // Memory usage collector
        this.collectors.set('memory', () => {
            if (typeof performance !== 'undefined' && performance.memory) {
                const used = performance.memory.usedJSHeapSize;
                const total = performance.memory.totalJSHeapSize;
                return (used / total) * 100;
            }
            return 0;
        });

        // Response time collector
        this.collectors.set('response_time', () => {
            const metric = this.metrics.get('response_time');
            return metric.current;
        });

        // Error rate collector
        this.collectors.set('error_rate', () => {
            const metric = this.metrics.get('error_rate');
            return metric.current;
        });

        // Request count collector
        this.collectors.set('request_count', () => {
            const metric = this.metrics.get('request_count');
            return metric.current;
        });

        // Active connections collector
        this.collectors.set('active_connections', () => {
            const metric = this.metrics.get('active_connections');
            return metric.current;
        });
    }

    /**
     * Start metrics collection
     */
    startCollection() {
        if (this.isCollecting) {
            return;
        }

        this.isCollecting = true;
        this.collectionTimer = setInterval(() => {
            this.collectMetrics();
        }, this.config.collectionInterval);

        console.log('MetricsCollector: Started metrics collection');
    }

    /**
     * Stop metrics collection
     */
    stopCollection() {
        if (!this.isCollecting) {
            return;
        }

        this.isCollecting = false;
        if (this.collectionTimer) {
            clearInterval(this.collectionTimer);
            this.collectionTimer = null;
        }

        console.log('MetricsCollector: Stopped metrics collection');
    }

    /**
     * Collect all metrics
     */
    collectMetrics() {
        const timestamp = Date.now();

        this.collectors.forEach((collector, name) => {
            try {
                const value = collector();
                this.recordMetric(name, value, timestamp);
            } catch (error) {
                console.error(`MetricsCollector: Error collecting ${name} metric:`, error);
            }
        });

        this.cleanupOldMetrics(timestamp);
        this.checkThresholds(timestamp);
    }

    /**
     * Record a metric value
     */
    recordMetric(type, value, timestamp = Date.now()) {
        const metricKey = type.replace(/([A-Z])/g, '_$1').toLowerCase();
        const metric = this.metrics.get(metricKey);
        
        if (!metric) {
            console.warn(`MetricsCollector: Unknown metric type: ${type}`);
            return;
        }

        metric.current = value;
        metric.history.push({
            value,
            timestamp
        });

        // Limit history size
        if (metric.history.length > 1000) {
            metric.history = metric.history.slice(-500);
        }
    }

    /**
     * Get current metric value
     */
    getMetric(type) {
        const metricKey = type.replace(/([A-Z])/g, '_$1').toLowerCase();
        const metric = this.metrics.get(metricKey);
        return metric ? metric.current : null;
    }

    /**
     * Get metric history
     */
    getMetricHistory(type, duration = 3600000) { // 1 hour default
        const metricKey = type.replace(/([A-Z])/g, '_$1').toLowerCase();
        const metric = this.metrics.get(metricKey);
        
        if (!metric) {
            return [];
        }

        const cutoff = Date.now() - duration;
        return metric.history.filter(entry => entry.timestamp >= cutoff);
    }

    /**
     * Get all current metrics
     */
    getAllMetrics() {
        const result = {};
        this.metrics.forEach((metric, type) => {
            result[type] = {
                current: metric.current,
                threshold: metric.threshold,
                historyCount: metric.history.length
            };
        });
        return result;
    }

    /**
     * Check thresholds and generate alerts
     */
    checkThresholds(timestamp) {
        this.metrics.forEach((metric, type) => {
            if (metric.threshold && metric.current > metric.threshold) {
                this.generateAlert(type, metric.current, metric.threshold, timestamp);
            }
        });
    }

    /**
     * Generate alert for threshold violation
     */
    generateAlert(metricType, currentValue, threshold, timestamp) {
        const metric = this.metrics.get(metricType);
        
        // Prevent alert spam - only alert once per 5 minutes for same metric
        if (metric.lastAlert && (timestamp - metric.lastAlert) < 300000) {
            return;
        }

        const alert = {
            id: this.generateAlertId(),
            type: 'THRESHOLD_VIOLATION',
            severity: this.calculateSeverity(metricType, currentValue, threshold),
            metric: metricType,
            currentValue,
            threshold,
            timestamp,
            message: `${metricType} exceeded threshold: ${currentValue} > ${threshold}`
        };

        this.alerts.push(alert);
        metric.lastAlert = timestamp;

        // Trigger alert handlers
        this.handleAlert(alert);

        console.warn('MetricsCollector Alert:', alert.message);
    }

    /**
     * Calculate alert severity
     */
    calculateSeverity(metricType, currentValue, threshold) {
        const ratio = currentValue / threshold;
        
        if (ratio >= 2.0) return 'CRITICAL';
        if (ratio >= 1.5) return 'HIGH';
        if (ratio >= 1.2) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Handle alert (can be extended for external integrations)
     */
    handleAlert(alert) {
        // Emit event for external handlers
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('metricsAlert', { detail: alert }));
        }

        // Store for retrieval
        this.trimAlerts();
    }

    /**
     * Clean up old metrics data
     */
    cleanupOldMetrics(timestamp) {
        const cutoff = timestamp - this.config.retentionPeriod;
        
        this.metrics.forEach(metric => {
            metric.history = metric.history.filter(entry => entry.timestamp >= cutoff);
        });
    }

    /**
     * Trim old alerts
     */
    trimAlerts() {
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-50);
        }
    }

    /**
     * Get recent alerts
     */
    getAlerts(severity = null, limit = 50) {
        let alerts = [...this.alerts];
        
        if (severity) {
            alerts = alerts.filter(alert => alert.severity === severity);
        }
        
        return alerts.slice(-limit).reverse();
    }

    /**
     * Export metrics for external monitoring systems
     */
    exportMetrics(format = 'json') {
        const timestamp = Date.now();
        const metrics = {};

        this.metrics.forEach((metric, type) => {
            metrics[type] = {
                value: metric.current,
                timestamp,
                threshold: metric.threshold,
                unit: this.getMetricUnit(type)
            };
        });

        switch (format.toLowerCase()) {
            case 'prometheus':
                return this.exportPrometheusFormat(metrics);
            case 'influxdb':
                return this.exportInfluxDBFormat(metrics);
            default:
                return {
                    timestamp,
                    metrics,
                    alerts: this.getAlerts(null, 10)
                };
        }
    }

    /**
     * Export in Prometheus format
     */
    exportPrometheusFormat(metrics) {
        let output = '';
        
        Object.entries(metrics).forEach(([name, data]) => {
            output += `# HELP ${name} ${this.getMetricDescription(name)}\n`;
            output += `# TYPE ${name} gauge\n`;
            output += `${name} ${data.value} ${data.timestamp}\n`;
        });
        
        return output;
    }

    /**
     * Export in InfluxDB line protocol format
     */
    exportInfluxDBFormat(metrics) {
        const lines = [];
        
        Object.entries(metrics).forEach(([name, data]) => {
            lines.push(`${name} value=${data.value} ${data.timestamp * 1000000}`);
        });
        
        return lines.join('\n');
    }

    /**
     * Get metric unit
     */
    getMetricUnit(type) {
        const units = {
            memory_usage: 'percent',
            cpu_usage: 'percent',
            response_time: 'milliseconds',
            error_rate: 'percent',
            request_count: 'count',
            active_connections: 'count',
            cache_hit_rate: 'percent',
            token_usage: 'count',
            agent_routing_time: 'milliseconds',
            streaming_sessions: 'count'
        };
        
        return units[type] || 'count';
    }

    /**
     * Get metric description
     */
    getMetricDescription(type) {
        const descriptions = {
            memory_usage: 'Current memory usage percentage',
            cpu_usage: 'Current CPU usage percentage',
            response_time: 'Average response time in milliseconds',
            error_rate: 'Current error rate percentage',
            request_count: 'Total number of requests',
            active_connections: 'Number of active connections',
            cache_hit_rate: 'Cache hit rate percentage',
            token_usage: 'Total token usage count',
            agent_routing_time: 'Agent routing time in milliseconds',
            streaming_sessions: 'Number of active streaming sessions'
        };
        
        return descriptions[type] || 'System metric';
    }

    /**
     * Generate unique alert ID
     */
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Update threshold for a metric
     */
    updateThreshold(metricType, threshold) {
        const metric = this.metrics.get(metricType);
        if (metric) {
            metric.threshold = threshold;
            console.log(`MetricsCollector: Updated threshold for ${metricType} to ${threshold}`);
        }
    }

    /**
     * Get system health summary
     */
    getHealthSummary() {
        const metrics = this.getAllMetrics();
        const recentAlerts = this.getAlerts(null, 5);
        
        let healthScore = 100;
        let status = 'HEALTHY';
        
        // Calculate health score based on threshold violations
        Object.entries(metrics).forEach(([type, metric]) => {
            if (metric.threshold && metric.current > metric.threshold) {
                const ratio = metric.current / metric.threshold;
                healthScore -= Math.min(30, ratio * 10);
            }
        });
        
        if (healthScore < 50) status = 'CRITICAL';
        else if (healthScore < 70) status = 'WARNING';
        else if (healthScore < 90) status = 'DEGRADED';
        
        return {
            status,
            healthScore: Math.max(0, Math.round(healthScore)),
            metrics,
            recentAlerts,
            timestamp: Date.now()
        };
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics.forEach(metric => {
            metric.current = 0;
            metric.history = [];
            metric.lastAlert = null;
        });
        
        this.alerts = [];
        console.log('MetricsCollector: Reset all metrics');
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stopCollection();
        this.metrics.clear();
        this.collectors.clear();
        this.alerts = [];
        console.log('MetricsCollector: Destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetricsCollector;
}

// Global registration for browser environments
if (typeof window !== 'undefined') {
    window.MetricsCollector = MetricsCollector;
}
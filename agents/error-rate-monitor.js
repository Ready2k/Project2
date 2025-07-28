/**
 * ErrorRateMonitor - Error rate calculation, trending, and alerting system
 * Provides comprehensive error rate monitoring with categorization and impact analysis
 */

class ErrorRateMonitor {
    constructor(config = {}) {
        this.config = {
            windowSize: config.windowSize || 300000, // 5 minutes
            alertThreshold: config.alertThreshold || 5, // 5% error rate
            criticalThreshold: config.criticalThreshold || 15, // 15% critical threshold
            trendingPeriod: config.trendingPeriod || 900000, // 15 minutes for trending
            maxHistorySize: config.maxHistorySize || 1000,
            categories: {
                api: { weight: 1.0, threshold: 5 },
                network: { weight: 0.8, threshold: 10 },
                validation: { weight: 0.6, threshold: 15 },
                timeout: { weight: 0.9, threshold: 8 },
                authentication: { weight: 1.2, threshold: 3 },
                ...config.categories
            },
            ...config
        };

        this.errors = [];
        this.requests = [];
        this.alerts = [];
        this.trends = new Map();
        this.categoryStats = new Map();
        this.impactAnalysis = new Map();
        
        this.initializeCategories();
        this.startTrendingAnalysis();
    }

    /**
     * Initialize error categories
     */
    initializeCategories() {
        Object.keys(this.config.categories).forEach(category => {
            this.categoryStats.set(category, {
                count: 0,
                rate: 0,
                trend: 'stable',
                lastAlert: null,
                history: []
            });
        });
    }

    /**
     * Record a request (success or error)
     */
    recordRequest(success = true, category = 'general', metadata = {}) {
        const timestamp = Date.now();
        const requestData = {
            timestamp,
            success,
            category,
            metadata: {
                userAgent: metadata.userAgent,
                endpoint: metadata.endpoint,
                duration: metadata.duration,
                statusCode: metadata.statusCode,
                ...metadata
            }
        };

        this.requests.push(requestData);

        if (!success) {
            this.recordError(category, metadata, timestamp);
        }

        this.cleanupOldData(timestamp);
        this.updateCategoryStats(category, timestamp);
        this.checkErrorRateThresholds(timestamp);
    }

    /**
     * Record an error with categorization
     */
    recordError(category = 'general', metadata = {}, timestamp = Date.now()) {
        const errorData = {
            timestamp,
            category,
            severity: this.calculateErrorSeverity(category, metadata),
            metadata: {
                message: metadata.message,
                stack: metadata.stack,
                component: metadata.component,
                userId: metadata.userId,
                sessionId: metadata.sessionId,
                ...metadata
            }
        };

        this.errors.push(errorData);
        
        // Update category statistics
        const categoryStats = this.categoryStats.get(category) || this.createCategoryStats();
        categoryStats.count++;
        categoryStats.history.push({ timestamp, severity: errorData.severity });
        this.categoryStats.set(category, categoryStats);

        // Update impact analysis
        this.updateImpactAnalysis(errorData);
    }

    /**
     * Calculate error severity based on category and metadata
     */
    calculateErrorSeverity(category, metadata) {
        const categoryConfig = this.config.categories[category] || { weight: 1.0 };
        let severity = 'medium';

        // Base severity on category weight
        if (categoryConfig.weight >= 1.2) severity = 'critical';
        else if (categoryConfig.weight >= 1.0) severity = 'high';
        else if (categoryConfig.weight >= 0.8) severity = 'medium';
        else severity = 'low';

        // Adjust based on metadata
        if (metadata.statusCode >= 500) severity = 'critical';
        else if (metadata.statusCode >= 400) severity = 'high';
        
        if (metadata.duration && metadata.duration > 10000) {
            severity = severity === 'low' ? 'medium' : severity;
        }

        return severity;
    }

    /**
     * Get current error rate
     */
    getCurrentErrorRate(category = null, windowSize = null) {
        const window = windowSize || this.config.windowSize;
        const cutoff = Date.now() - window;
        
        let totalRequests = this.requests.filter(r => r.timestamp >= cutoff);
        let totalErrors = this.errors.filter(e => e.timestamp >= cutoff);

        if (category) {
            totalRequests = totalRequests.filter(r => r.category === category);
            totalErrors = totalErrors.filter(e => e.category === category);
        }

        if (totalRequests.length === 0) return 0;
        
        return (totalErrors.length / totalRequests.length) * 100;
    }

    /**
     * Get error rate trend
     */
    getErrorRateTrend(category = null, periods = 3) {
        const periodSize = this.config.windowSize;
        const rates = [];
        
        for (let i = 0; i < periods; i++) {
            const endTime = Date.now() - (i * periodSize);
            const startTime = endTime - periodSize;
            
            let periodRequests = this.requests.filter(r => 
                r.timestamp >= startTime && r.timestamp < endTime
            );
            let periodErrors = this.errors.filter(e => 
                e.timestamp >= startTime && e.timestamp < endTime
            );

            if (category) {
                periodRequests = periodRequests.filter(r => r.category === category);
                periodErrors = periodErrors.filter(e => e.category === category);
            }

            const rate = periodRequests.length > 0 ? 
                (periodErrors.length / periodRequests.length) * 100 : 0;
            rates.unshift(rate);
        }

        return this.analyzeTrend(rates);
    }

    /**
     * Analyze trend from rate array
     */
    analyzeTrend(rates) {
        if (rates.length < 2) return { direction: 'stable', slope: 0, confidence: 0 };

        let increasing = 0;
        let decreasing = 0;
        let totalChange = 0;

        for (let i = 1; i < rates.length; i++) {
            const change = rates[i] - rates[i - 1];
            totalChange += change;
            
            if (change > 0.5) increasing++;
            else if (change < -0.5) decreasing++;
        }

        const avgChange = totalChange / (rates.length - 1);
        const confidence = Math.abs(avgChange) / Math.max(...rates, 1);

        let direction = 'stable';
        if (increasing > decreasing && avgChange > 0.5) direction = 'increasing';
        else if (decreasing > increasing && avgChange < -0.5) direction = 'decreasing';

        return {
            direction,
            slope: avgChange,
            confidence: Math.min(confidence, 1),
            rates
        };
    }

    /**
     * Update category statistics
     */
    updateCategoryStats(category, timestamp) {
        const stats = this.categoryStats.get(category) || this.createCategoryStats();
        
        stats.rate = this.getCurrentErrorRate(category);
        stats.trend = this.getErrorRateTrend(category).direction;
        
        this.categoryStats.set(category, stats);
    }

    /**
     * Create default category stats
     */
    createCategoryStats() {
        return {
            count: 0,
            rate: 0,
            trend: 'stable',
            lastAlert: null,
            history: []
        };
    }

    /**
     * Check error rate thresholds and generate alerts
     */
    checkErrorRateThresholds(timestamp) {
        // Check overall error rate
        const overallRate = this.getCurrentErrorRate();
        if (overallRate > this.config.alertThreshold) {
            this.generateErrorRateAlert('overall', overallRate, timestamp);
        }

        // Check category-specific rates
        this.categoryStats.forEach((stats, category) => {
            const categoryConfig = this.config.categories[category];
            const threshold = categoryConfig ? categoryConfig.threshold : this.config.alertThreshold;
            
            if (stats.rate > threshold) {
                this.generateErrorRateAlert(category, stats.rate, timestamp, 'category');
            }
        });
    }

    /**
     * Generate error rate alert
     */
    generateErrorRateAlert(category, rate, timestamp, type = 'overall') {
        const alertKey = `${type}_${category}`;
        const lastAlert = this.getLastAlert(alertKey);
        
        // Prevent alert spam - only alert once per 5 minutes
        if (lastAlert && (timestamp - lastAlert.timestamp) < 300000) {
            return;
        }

        const severity = this.calculateAlertSeverity(rate, category);
        const trend = this.getErrorRateTrend(category);
        
        const alert = {
            id: this.generateAlertId(),
            type: 'ERROR_RATE_THRESHOLD',
            category,
            severity,
            rate: Math.round(rate * 100) / 100,
            threshold: type === 'category' ? 
                this.config.categories[category]?.threshold : 
                this.config.alertThreshold,
            trend: trend.direction,
            timestamp,
            message: this.generateAlertMessage(category, rate, trend, type),
            metadata: {
                type,
                impactAnalysis: this.getImpactAnalysis(category),
                recentErrors: this.getRecentErrors(category, 10)
            }
        };

        this.alerts.push(alert);
        this.handleErrorRateAlert(alert);
        
        // Update last alert tracking
        if (type === 'category') {
            const stats = this.categoryStats.get(category);
            if (stats) stats.lastAlert = timestamp;
        }
    }

    /**
     * Calculate alert severity
     */
    calculateAlertSeverity(rate, category) {
        const criticalThreshold = this.config.criticalThreshold;
        const categoryConfig = this.config.categories[category];
        const weight = categoryConfig ? categoryConfig.weight : 1.0;
        
        const adjustedRate = rate * weight;
        
        if (adjustedRate >= criticalThreshold) return 'CRITICAL';
        if (adjustedRate >= this.config.alertThreshold * 2) return 'HIGH';
        if (adjustedRate >= this.config.alertThreshold) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Generate alert message
     */
    generateAlertMessage(category, rate, trend, type) {
        const rateStr = `${Math.round(rate * 100) / 100}%`;
        const trendStr = trend.direction !== 'stable' ? ` (${trend.direction})` : '';
        
        if (type === 'overall') {
            return `Overall error rate is ${rateStr}${trendStr}`;
        } else {
            return `Error rate for ${category} is ${rateStr}${trendStr}`;
        }
    }

    /**
     * Handle error rate alert
     */
    handleErrorRateAlert(alert) {
        console.warn('ErrorRateMonitor Alert:', alert.message);
        
        // Emit event for external handlers
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('errorRateAlert', { detail: alert }));
        }

        // Trigger escalation for critical alerts
        if (alert.severity === 'CRITICAL') {
            this.escalateCriticalAlert(alert);
        }
    }

    /**
     * Escalate critical alert
     */
    escalateCriticalAlert(alert) {
        console.error('CRITICAL ERROR RATE ALERT:', alert);
        
        // Additional escalation logic can be added here
        // e.g., send to external monitoring systems, page on-call engineer, etc.
    }

    /**
     * Update impact analysis
     */
    updateImpactAnalysis(errorData) {
        const category = errorData.category;
        const analysis = this.impactAnalysis.get(category) || {
            affectedUsers: new Set(),
            affectedEndpoints: new Set(),
            totalImpact: 0,
            severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 }
        };

        // Track affected users and endpoints
        if (errorData.metadata.userId) {
            analysis.affectedUsers.add(errorData.metadata.userId);
        }
        if (errorData.metadata.endpoint) {
            analysis.affectedEndpoints.add(errorData.metadata.endpoint);
        }

        // Update severity breakdown
        analysis.severityBreakdown[errorData.severity]++;
        analysis.totalImpact++;

        this.impactAnalysis.set(category, analysis);
    }

    /**
     * Get impact analysis for category
     */
    getImpactAnalysis(category) {
        const analysis = this.impactAnalysis.get(category);
        if (!analysis) return null;

        return {
            affectedUsers: analysis.affectedUsers.size,
            affectedEndpoints: analysis.affectedEndpoints.size,
            totalErrors: analysis.totalImpact,
            severityBreakdown: { ...analysis.severityBreakdown }
        };
    }

    /**
     * Get recent errors for category
     */
    getRecentErrors(category, limit = 10) {
        return this.errors
            .filter(e => !category || e.category === category)
            .slice(-limit)
            .map(e => ({
                timestamp: e.timestamp,
                category: e.category,
                severity: e.severity,
                message: e.metadata.message
            }));
    }

    /**
     * Get error rate statistics
     */
    getErrorRateStats(category = null) {
        const currentRate = this.getCurrentErrorRate(category);
        const trend = this.getErrorRateTrend(category);
        const recentErrors = this.getRecentErrors(category, 5);
        
        return {
            currentRate: Math.round(currentRate * 100) / 100,
            trend,
            recentErrors,
            impactAnalysis: category ? this.getImpactAnalysis(category) : null,
            threshold: category ? 
                this.config.categories[category]?.threshold : 
                this.config.alertThreshold
        };
    }

    /**
     * Get all category statistics
     */
    getAllCategoryStats() {
        const stats = {};
        this.categoryStats.forEach((categoryStats, category) => {
            stats[category] = {
                ...categoryStats,
                impactAnalysis: this.getImpactAnalysis(category),
                config: this.config.categories[category]
            };
        });
        return stats;
    }

    /**
     * Clean up old data
     */
    cleanupOldData(timestamp) {
        const cutoff = timestamp - (this.config.trendingPeriod * 2);
        
        this.errors = this.errors.filter(e => e.timestamp >= cutoff);
        this.requests = this.requests.filter(r => r.timestamp >= cutoff);
        
        // Clean up category history
        this.categoryStats.forEach(stats => {
            stats.history = stats.history.filter(h => h.timestamp >= cutoff);
        });
        
        // Trim alerts
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-50);
        }
    }

    /**
     * Start trending analysis
     */
    startTrendingAnalysis() {
        setInterval(() => {
            this.updateTrendingAnalysis();
        }, 60000); // Update every minute
    }

    /**
     * Update trending analysis
     */
    updateTrendingAnalysis() {
        this.categoryStats.forEach((stats, category) => {
            const trend = this.getErrorRateTrend(category);
            stats.trend = trend.direction;
            
            // Store trend data
            this.trends.set(category, {
                ...trend,
                timestamp: Date.now()
            });
        });
    }

    /**
     * Get last alert for key
     */
    getLastAlert(alertKey) {
        return this.alerts
            .filter(a => `${a.metadata?.type || 'overall'}_${a.category}` === alertKey)
            .pop();
    }

    /**
     * Generate unique alert ID
     */
    generateAlertId() {
        return `error_rate_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get recent alerts
     */
    getRecentAlerts(limit = 20, severity = null) {
        let alerts = [...this.alerts];
        
        if (severity) {
            alerts = alerts.filter(a => a.severity === severity);
        }
        
        return alerts.slice(-limit).reverse();
    }

    /**
     * Reset all data
     */
    reset() {
        this.errors = [];
        this.requests = [];
        this.alerts = [];
        this.trends.clear();
        this.impactAnalysis.clear();
        this.initializeCategories();
        console.log('ErrorRateMonitor: Reset all data');
    }

    /**
     * Get comprehensive error report
     */
    getErrorReport() {
        return {
            timestamp: Date.now(),
            overallStats: this.getErrorRateStats(),
            categoryStats: this.getAllCategoryStats(),
            recentAlerts: this.getRecentAlerts(10),
            trends: Object.fromEntries(this.trends),
            summary: {
                totalErrors: this.errors.length,
                totalRequests: this.requests.length,
                overallErrorRate: this.getCurrentErrorRate(),
                categoriesAboveThreshold: Array.from(this.categoryStats.entries())
                    .filter(([cat, stats]) => {
                        const threshold = this.config.categories[cat]?.threshold || this.config.alertThreshold;
                        return stats.rate > threshold;
                    })
                    .map(([cat]) => cat)
            }
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.errors = [];
        this.requests = [];
        this.alerts = [];
        this.trends.clear();
        this.categoryStats.clear();
        this.impactAnalysis.clear();
        console.log('ErrorRateMonitor: Destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorRateMonitor;
}

// Global registration for browser environments
if (typeof window !== 'undefined') {
    window.ErrorRateMonitor = ErrorRateMonitor;
}
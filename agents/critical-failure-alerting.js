/**
 * Critical Failure Alerting System
 * Provides immediate notification system for critical component failures,
 * escalation procedures for unresolved issues, and alert correlation to reduce noise
 */

class CriticalFailureAlerting {
    constructor(config = {}) {
        this.config = {
            // Alert thresholds
            criticalThresholds: {
                errorRate: config.criticalThresholds?.errorRate || 25, // 25% error rate
                responseTime: config.criticalThresholds?.responseTime || 10000, // 10 seconds
                memoryUsage: config.criticalThresholds?.memoryUsage || 95, // 95% memory usage
                consecutiveFailures: config.criticalThresholds?.consecutiveFailures || 5,
                ...config.criticalThresholds
            },
            
            // Escalation settings
            escalation: {
                levels: config.escalation?.levels || ['immediate', 'urgent', 'critical'],
                timeouts: config.escalation?.timeouts || [300000, 900000, 1800000], // 5min, 15min, 30min
                maxRetries: config.escalation?.maxRetries || 3,
                ...config.escalation
            },
            
            // Alert correlation settings
            correlation: {
                timeWindow: config.correlation?.timeWindow || 300000, // 5 minutes
                similarityThreshold: config.correlation?.similarityThreshold || 0.8,
                maxGroupSize: config.correlation?.maxGroupSize || 10,
                ...config.correlation
            },
            
            // Notification channels
            channels: {
                console: config.channels?.console !== false,
                events: config.channels?.events !== false,
                webhook: config.channels?.webhook || null,
                email: config.channels?.email || null,
                ...config.channels
            },
            
            ...config
        };

        // Alert storage and tracking
        this.alerts = new Map(); // alertId -> alert
        this.alertGroups = new Map(); // groupId -> group
        this.escalations = new Map(); // alertId -> escalation
        this.suppressions = new Map(); // pattern -> suppression
        this.statistics = {
            totalAlerts: 0,
            criticalAlerts: 0,
            escalatedAlerts: 0,
            suppressedAlerts: 0,
            resolvedAlerts: 0
        };

        // Component failure tracking
        this.componentFailures = new Map();
        this.failurePatterns = new Map();
        
        // Event handlers
        this.alertHandlers = new Set();
        this.escalationHandlers = new Set();
        
        this.initializeSystem();
    }

    /**
     * Initialize the alerting system
     */
    initializeSystem() {
        // Start periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldAlerts();
            this.processEscalations();
            this.updateFailurePatterns();
        }, 60000); // Every minute

        console.log('CriticalFailureAlerting: System initialized');
    }

    /**
     * Report a critical failure
     * @param {Object} failure - Failure details
     * @returns {string} Alert ID
     */
    reportCriticalFailure(failure) {
        const alert = this.createAlert(failure);
        
        // Check if this is truly critical
        if (!this.isCriticalFailure(alert)) {
            return null;
        }

        // Store alert
        this.alerts.set(alert.id, alert);
        this.statistics.totalAlerts++;
        this.statistics.criticalAlerts++;

        // Track component failure
        this.trackComponentFailure(alert);

        // Correlate with existing alerts
        const group = this.correlateAlert(alert);
        
        // Process alert (notifications, escalations)
        this.processAlert(alert, group);

        console.error('CRITICAL FAILURE ALERT:', {
            id: alert.id,
            component: alert.component,
            severity: alert.severity,
            message: alert.message
        });

        return alert.id;
    }

    /**
     * Create alert object from failure details
     * @param {Object} failure - Failure details
     * @returns {Object} Alert object
     */
    createAlert(failure) {
        const timestamp = Date.now();
        
        return {
            id: this.generateAlertId(),
            timestamp,
            component: failure.component || 'unknown',
            type: failure.type || 'CRITICAL_FAILURE',
            severity: this.calculateSeverity(failure),
            message: failure.message || 'Critical failure detected',
            details: {
                error: failure.error,
                context: failure.context || {},
                stackTrace: failure.stackTrace,
                metadata: failure.metadata || {},
                ...failure.details
            },
            status: 'ACTIVE',
            escalationLevel: 0,
            correlationKey: this.generateCorrelationKey(failure),
            fingerprint: this.generateFingerprint(failure)
        };
    }

    /**
     * Determine if a failure is critical
     * @param {Object} alert - Alert object
     * @returns {boolean} True if critical
     */
    isCriticalFailure(alert) {
        const { component, details, type } = alert;
        
        // Check component-specific criteria
        const componentFailures = this.componentFailures.get(component) || [];
        const recentFailures = componentFailures.filter(f => 
            Date.now() - f.timestamp < 300000 // Last 5 minutes
        );

        // Critical if too many consecutive failures
        if (recentFailures.length >= this.config.criticalThresholds.consecutiveFailures) {
            return true;
        }

        // Critical if error rate is too high
        if (details.errorRate && details.errorRate > this.config.criticalThresholds.errorRate) {
            return true;
        }

        // Critical if response time is too high
        if (details.responseTime && details.responseTime > this.config.criticalThresholds.responseTime) {
            return true;
        }

        // Critical if memory usage is too high
        if (details.memoryUsage && details.memoryUsage > this.config.criticalThresholds.memoryUsage) {
            return true;
        }

        // Critical failure types
        const criticalTypes = [
            'SYSTEM_CRASH',
            'MEMORY_EXHAUSTION',
            'SECURITY_BREACH',
            'DATA_CORRUPTION',
            'SERVICE_UNAVAILABLE',
            'AUTHENTICATION_FAILURE',
            'CRITICAL_COMPONENT_FAILURE'
        ];

        if (criticalTypes.includes(type)) {
            return true;
        }

        // Critical if marked as critical severity
        if (alert.severity === 'CRITICAL') {
            return true;
        }

        return false;
    }

    /**
     * Calculate alert severity
     * @param {Object} failure - Failure details
     * @returns {string} Severity level
     */
    calculateSeverity(failure) {
        if (failure.severity) {
            return failure.severity;
        }

        // Calculate based on impact and urgency
        let score = 0;

        // Impact factors
        if (failure.details?.errorRate > 50) score += 3;
        else if (failure.details?.errorRate > 25) score += 2;
        else if (failure.details?.errorRate > 10) score += 1;

        if (failure.details?.affectedUsers > 1000) score += 3;
        else if (failure.details?.affectedUsers > 100) score += 2;
        else if (failure.details?.affectedUsers > 10) score += 1;

        if (failure.details?.memoryUsage > 95) score += 3;
        else if (failure.details?.memoryUsage > 85) score += 2;
        else if (failure.details?.memoryUsage > 75) score += 1;

        // Urgency factors
        const criticalComponents = ['authentication', 'payment', 'security', 'database'];
        if (criticalComponents.includes(failure.component)) score += 2;

        if (failure.type === 'SECURITY_BREACH') score += 4;
        if (failure.type === 'DATA_CORRUPTION') score += 3;

        // Determine severity
        if (score >= 8) return 'CRITICAL';
        if (score >= 6) return 'HIGH';
        if (score >= 4) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Track component failure for pattern analysis
     * @param {Object} alert - Alert object
     */
    trackComponentFailure(alert) {
        const component = alert.component;
        
        if (!this.componentFailures.has(component)) {
            this.componentFailures.set(component, []);
        }

        const failures = this.componentFailures.get(component);
        failures.push({
            timestamp: alert.timestamp,
            type: alert.type,
            severity: alert.severity,
            fingerprint: alert.fingerprint
        });

        // Keep only recent failures (last hour)
        const oneHourAgo = Date.now() - 3600000;
        this.componentFailures.set(component, 
            failures.filter(f => f.timestamp >= oneHourAgo)
        );
    }

    /**
     * Correlate alert with existing alerts to reduce noise
     * @param {Object} alert - Alert to correlate
     * @returns {Object} Alert group
     */
    correlateAlert(alert) {
        const correlationWindow = Date.now() - this.config.correlation.timeWindow;
        
        // Find similar alerts within time window
        for (const [groupId, group] of this.alertGroups.entries()) {
            if (group.lastUpdate < correlationWindow) continue;
            
            // Check similarity
            const similarity = this.calculateAlertSimilarity(alert, group.representative);
            
            if (similarity >= this.config.correlation.similarityThreshold) {
                // Add to existing group
                group.alerts.push(alert.id);
                group.count++;
                group.lastUpdate = alert.timestamp;
                
                // Update representative if this alert is more severe
                if (this.getSeverityScore(alert.severity) > 
                    this.getSeverityScore(group.representative.severity)) {
                    group.representative = alert;
                }
                
                return group;
            }
        }
        
        // Create new group
        const groupId = this.generateGroupId();
        const group = {
            id: groupId,
            alerts: [alert.id],
            count: 1,
            representative: alert,
            created: alert.timestamp,
            lastUpdate: alert.timestamp,
            escalated: false
        };
        
        this.alertGroups.set(groupId, group);
        return group;
    }

    /**
     * Calculate similarity between two alerts
     * @param {Object} alert1 - First alert
     * @param {Object} alert2 - Second alert
     * @returns {number} Similarity score (0-1)
     */
    calculateAlertSimilarity(alert1, alert2) {
        let score = 0;
        let factors = 0;

        // Component similarity
        if (alert1.component === alert2.component) {
            score += 0.3;
        }
        factors++;

        // Type similarity
        if (alert1.type === alert2.type) {
            score += 0.3;
        }
        factors++;

        // Fingerprint similarity
        if (alert1.fingerprint === alert2.fingerprint) {
            score += 0.4;
        } else {
            // Partial fingerprint match
            const fp1 = alert1.fingerprint.split('_');
            const fp2 = alert2.fingerprint.split('_');
            const matches = fp1.filter(part => fp2.includes(part)).length;
            score += (matches / Math.max(fp1.length, fp2.length)) * 0.2;
        }
        factors++;

        return score / factors;
    }

    /**
     * Process alert (send notifications, start escalation)
     * @param {Object} alert - Alert to process
     * @param {Object} group - Alert group
     */
    processAlert(alert, group) {
        // Check if suppressed
        if (this.isAlertSuppressed(alert)) {
            this.statistics.suppressedAlerts++;
            return;
        }

        // Send immediate notifications
        this.sendNotifications(alert, group);

        // Start escalation timer
        this.startEscalation(alert, group);

        // Trigger alert handlers
        this.triggerAlertHandlers(alert, group);
    }

    /**
     * Check if alert should be suppressed
     * @param {Object} alert - Alert to check
     * @returns {boolean} True if suppressed
     */
    isAlertSuppressed(alert) {
        for (const [pattern, suppression] of this.suppressions.entries()) {
            if (this.matchesPattern(alert, pattern)) {
                if (suppression.until > Date.now()) {
                    return true;
                }
                // Remove expired suppression
                this.suppressions.delete(pattern);
            }
        }
        return false;
    }

    /**
     * Send notifications for alert
     * @param {Object} alert - Alert to notify about
     * @param {Object} group - Alert group
     */
    sendNotifications(alert, group) {
        const notification = {
            alert,
            group,
            timestamp: Date.now(),
            escalationLevel: alert.escalationLevel
        };

        // Console notification
        if (this.config.channels.console) {
            this.sendConsoleNotification(notification);
        }

        // Event notification
        if (this.config.channels.events) {
            this.sendEventNotification(notification);
        }

        // Webhook notification
        if (this.config.channels.webhook) {
            this.sendWebhookNotification(notification);
        }

        // Email notification
        if (this.config.channels.email) {
            this.sendEmailNotification(notification);
        }
    }

    /**
     * Send console notification
     * @param {Object} notification - Notification details
     */
    sendConsoleNotification(notification) {
        const { alert, group } = notification;
        
        console.error('🚨 CRITICAL FAILURE ALERT 🚨');
        console.error(`Alert ID: ${alert.id}`);
        console.error(`Component: ${alert.component}`);
        console.error(`Type: ${alert.type}`);
        console.error(`Severity: ${alert.severity}`);
        console.error(`Message: ${alert.message}`);
        console.error(`Group: ${group.id} (${group.count} similar alerts)`);
        console.error(`Time: ${new Date(alert.timestamp).toISOString()}`);
        
        if (alert.details.stackTrace) {
            console.error('Stack Trace:', alert.details.stackTrace);
        }
    }

    /**
     * Send event notification
     * @param {Object} notification - Notification details
     */
    sendEventNotification(notification) {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('criticalFailureAlert', {
                detail: notification
            }));
        }
    }

    /**
     * Send webhook notification
     * @param {Object} notification - Notification details
     */
    async sendWebhookNotification(notification) {
        if (!this.config.channels.webhook) return;

        try {
            const response = await fetch(this.config.channels.webhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'critical_failure_alert',
                    ...notification
                })
            });

            if (!response.ok) {
                console.error('Failed to send webhook notification:', response.statusText);
            }
        } catch (error) {
            console.error('Webhook notification error:', error);
        }
    }

    /**
     * Send email notification (placeholder)
     * @param {Object} notification - Notification details
     */
    sendEmailNotification(notification) {
        // Email implementation would depend on the email service being used
        console.log('Email notification would be sent:', notification.alert.id);
    }

    /**
     * Start escalation process for alert
     * @param {Object} alert - Alert to escalate
     * @param {Object} group - Alert group
     */
    startEscalation(alert, group) {
        const escalation = {
            alertId: alert.id,
            groupId: group.id,
            level: 0,
            startTime: Date.now(),
            nextEscalation: Date.now() + this.config.escalation.timeouts[0],
            attempts: 0,
            resolved: false
        };

        this.escalations.set(alert.id, escalation);
    }

    /**
     * Process escalations (called periodically)
     */
    processEscalations() {
        const now = Date.now();

        for (const [alertId, escalation] of this.escalations.entries()) {
            if (escalation.resolved) continue;

            const alert = this.alerts.get(alertId);
            if (!alert || alert.status === 'RESOLVED') {
                escalation.resolved = true;
                continue;
            }

            // Check if escalation is due
            if (now >= escalation.nextEscalation) {
                this.escalateAlert(alert, escalation);
            }
        }
    }

    /**
     * Escalate an alert to the next level
     * @param {Object} alert - Alert to escalate
     * @param {Object} escalation - Escalation details
     */
    escalateAlert(alert, escalation) {
        escalation.level++;
        escalation.attempts++;
        alert.escalationLevel = escalation.level;

        const levelName = this.config.escalation.levels[escalation.level - 1] || 'maximum';
        
        console.error(`🔥 ESCALATING ALERT ${alert.id} TO ${levelName.toUpperCase()} LEVEL 🔥`);

        // Send escalated notification
        const group = this.findAlertGroup(alert.id);
        this.sendNotifications(alert, group);

        // Trigger escalation handlers
        this.triggerEscalationHandlers(alert, escalation);

        // Schedule next escalation if not at max level
        if (escalation.level < this.config.escalation.levels.length &&
            escalation.attempts < this.config.escalation.maxRetries) {
            
            escalation.nextEscalation = Date.now() + 
                this.config.escalation.timeouts[escalation.level];
        }

        this.statistics.escalatedAlerts++;
    }

    /**
     * Resolve an alert
     * @param {string} alertId - Alert ID to resolve
     * @param {string} resolution - Resolution details
     */
    resolveAlert(alertId, resolution = 'Resolved') {
        const alert = this.alerts.get(alertId);
        if (!alert) return false;

        alert.status = 'RESOLVED';
        alert.resolvedAt = Date.now();
        alert.resolution = resolution;

        // Mark escalation as resolved
        const escalation = this.escalations.get(alertId);
        if (escalation) {
            escalation.resolved = true;
        }

        this.statistics.resolvedAlerts++;

        console.log(`Alert ${alertId} resolved: ${resolution}`);
        return true;
    }

    /**
     * Suppress alerts matching a pattern
     * @param {Object} pattern - Pattern to match
     * @param {number} duration - Suppression duration in ms
     */
    suppressAlerts(pattern, duration = 3600000) { // 1 hour default
        const patternKey = JSON.stringify(pattern);
        this.suppressions.set(patternKey, {
            pattern,
            until: Date.now() + duration,
            created: Date.now()
        });

        console.log(`Suppressing alerts matching pattern for ${duration/1000} seconds:`, pattern);
    }

    /**
     * Update failure patterns for analysis
     */
    updateFailurePatterns() {
        const now = Date.now();
        const oneHour = 3600000;

        // Analyze patterns in recent failures
        for (const [component, failures] of this.componentFailures.entries()) {
            const recentFailures = failures.filter(f => now - f.timestamp < oneHour);
            
            if (recentFailures.length >= 3) {
                // Look for patterns
                const typePattern = this.analyzeTypePattern(recentFailures);
                const timePattern = this.analyzeTimePattern(recentFailures);
                
                this.failurePatterns.set(component, {
                    typePattern,
                    timePattern,
                    lastAnalysis: now,
                    failureCount: recentFailures.length
                });
            }
        }
    }

    /**
     * Analyze failure type patterns
     * @param {Array} failures - Array of failures
     * @returns {Object} Type pattern analysis
     */
    analyzeTypePattern(failures) {
        const typeCounts = {};
        failures.forEach(f => {
            typeCounts[f.type] = (typeCounts[f.type] || 0) + 1;
        });

        const mostCommon = Object.entries(typeCounts)
            .sort(([,a], [,b]) => b - a)[0];

        return {
            mostCommonType: mostCommon[0],
            frequency: mostCommon[1] / failures.length,
            distribution: typeCounts
        };
    }

    /**
     * Analyze failure time patterns
     * @param {Array} failures - Array of failures
     * @returns {Object} Time pattern analysis
     */
    analyzeTimePattern(failures) {
        if (failures.length < 2) return { pattern: 'insufficient_data' };

        const intervals = [];
        for (let i = 1; i < failures.length; i++) {
            intervals.push(failures[i].timestamp - failures[i-1].timestamp);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((acc, interval) => 
            acc + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

        return {
            averageInterval: avgInterval,
            variance,
            pattern: variance < avgInterval * 0.1 ? 'regular' : 'irregular'
        };
    }

    /**
     * Get alert statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        return {
            ...this.statistics,
            activeAlerts: Array.from(this.alerts.values())
                .filter(a => a.status === 'ACTIVE').length,
            alertGroups: this.alertGroups.size,
            activeEscalations: Array.from(this.escalations.values())
                .filter(e => !e.resolved).length,
            suppressions: this.suppressions.size,
            componentFailures: Object.fromEntries(
                Array.from(this.componentFailures.entries())
                    .map(([comp, failures]) => [comp, failures.length])
            )
        };
    }

    /**
     * Get recent alerts
     * @param {number} limit - Maximum number of alerts
     * @returns {Array} Recent alerts
     */
    getRecentAlerts(limit = 50) {
        return Array.from(this.alerts.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Get alert groups
     * @returns {Array} Alert groups
     */
    getAlertGroups() {
        return Array.from(this.alertGroups.values())
            .sort((a, b) => b.lastUpdate - a.lastUpdate);
    }

    /**
     * Register alert handler
     * @param {Function} handler - Alert handler function
     */
    onAlert(handler) {
        if (typeof handler === 'function') {
            this.alertHandlers.add(handler);
        }
    }

    /**
     * Register escalation handler
     * @param {Function} handler - Escalation handler function
     */
    onEscalation(handler) {
        if (typeof handler === 'function') {
            this.escalationHandlers.add(handler);
        }
    }

    /**
     * Trigger alert handlers
     * @param {Object} alert - Alert object
     * @param {Object} group - Alert group
     */
    triggerAlertHandlers(alert, group) {
        for (const handler of this.alertHandlers) {
            try {
                handler(alert, group);
            } catch (error) {
                console.error('Alert handler error:', error);
            }
        }
    }

    /**
     * Trigger escalation handlers
     * @param {Object} alert - Alert object
     * @param {Object} escalation - Escalation details
     */
    triggerEscalationHandlers(alert, escalation) {
        for (const handler of this.escalationHandlers) {
            try {
                handler(alert, escalation);
            } catch (error) {
                console.error('Escalation handler error:', error);
            }
        }
    }

    /**
     * Utility methods
     */
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateGroupId() {
        return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateCorrelationKey(failure) {
        return `${failure.component}_${failure.type}`;
    }

    generateFingerprint(failure) {
        const parts = [
            failure.component,
            failure.type,
            failure.details?.errorCode,
            failure.details?.endpoint
        ].filter(Boolean);
        
        return parts.join('_').toLowerCase();
    }

    getSeverityScore(severity) {
        const scores = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
        return scores[severity] || 0;
    }

    matchesPattern(alert, pattern) {
        const patternObj = JSON.parse(pattern);
        
        for (const [key, value] of Object.entries(patternObj)) {
            if (alert[key] !== value) {
                return false;
            }
        }
        
        return true;
    }

    findAlertGroup(alertId) {
        for (const group of this.alertGroups.values()) {
            if (group.alerts.includes(alertId)) {
                return group;
            }
        }
        return null;
    }

    cleanupOldAlerts() {
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        
        // Clean up old alerts
        for (const [alertId, alert] of this.alerts.entries()) {
            if (alert.timestamp < cutoff && alert.status === 'RESOLVED') {
                this.alerts.delete(alertId);
                this.escalations.delete(alertId);
            }
        }
        
        // Clean up old groups
        for (const [groupId, group] of this.alertGroups.entries()) {
            if (group.lastUpdate < cutoff) {
                this.alertGroups.delete(groupId);
            }
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.alerts.clear();
        this.alertGroups.clear();
        this.escalations.clear();
        this.suppressions.clear();
        this.componentFailures.clear();
        this.failurePatterns.clear();
        this.alertHandlers.clear();
        this.escalationHandlers.clear();
        
        console.log('CriticalFailureAlerting: System destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CriticalFailureAlerting;
}

// Global registration for browser environments
if (typeof window !== 'undefined') {
    window.CriticalFailureAlerting = CriticalFailureAlerting;
}
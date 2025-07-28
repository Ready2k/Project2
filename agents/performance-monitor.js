/**
 * Performance Monitoring System
 * 
 * Implements timing instrumentation for all major operations,
 * performance metrics collection and analysis, and bottleneck
 * identification and alerting for the Voice Banking AI Assistant.
 * 
 * Requirements: 7.2, 9.3
 */

class PerformanceMonitor {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.maxMetricsHistory = options.maxMetricsHistory || 1000;
        this.alertThresholds = {
            responseTime: options.responseTimeThreshold || 5000, // 5 seconds
            memoryUsage: options.memoryUsageThreshold || 0.8, // 80% of heap limit
            errorRate: options.errorRateThreshold || 0.1, // 10% error rate
            ...options.alertThresholds
        };
        
        // Performance metrics storage
        this.metrics = new Map();
        this.timers = new Map();
        this.operationHistory = new Map();
        this.bottlenecks = new Map();
        this.alerts = [];
        
        // Performance observers
        this.observers = new Set();
        this.alertCallbacks = new Set();
        
        // Initialize performance monitoring
        this.initializeMonitoring();
    }

    /**
     * Initialize performance monitoring system
     */
    initializeMonitoring() {
        if (!this.enabled) return;
        
        // Initialize performance observers if available
        this.initializePerformanceObservers();
        
        // Start periodic metrics collection
        this.startPeriodicCollection();
        
        // Initialize memory monitoring
        this.initializeMemoryMonitoring();
    }

    /**
     * Initialize performance observers for browser APIs
     */
    initializePerformanceObservers() {
        if (typeof PerformanceObserver === 'undefined') return;
        
        try {
            // Observe navigation timing
            const navigationObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.recordNavigationMetrics(entry);
                }
            });
            navigationObserver.observe({ entryTypes: ['navigation'] });
            this.observers.add(navigationObserver);
            
            // Observe resource timing
            const resourceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.recordResourceMetrics(entry);
                }
            });
            resourceObserver.observe({ entryTypes: ['resource'] });
            this.observers.add(resourceObserver);
            
            // Observe measure timing
            const measureObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.recordMeasureMetrics(entry);
                }
            });
            measureObserver.observe({ entryTypes: ['measure'] });
            this.observers.add(measureObserver);
            
        } catch (error) {
            console.warn('Performance observers not fully supported:', error.message);
        }
    }

    /**
     * Start periodic metrics collection
     */
    startPeriodicCollection() {
        // Collect metrics every 30 seconds
        this.collectionInterval = setInterval(() => {
            this.collectSystemMetrics();
            this.analyzeBottlenecks();
            this.checkAlertThresholds();
        }, 30000);
    }

    /**
     * Initialize memory monitoring
     */
    initializeMemoryMonitoring() {
        if (typeof performance !== 'undefined' && performance.memory) {
            this.memoryMonitoringEnabled = true;
        }
    }

    /**
     * Start timing an operation
     * @param {string} operationName - Name of the operation
     * @param {Object} context - Additional context
     * @returns {string} Timer ID
     */
    startTimer(operationName, context = {}) {
        if (!this.enabled) return null;
        
        const timerId = this.generateTimerId(operationName);
        const startTime = performance.now();
        
        this.timers.set(timerId, {
            operationName,
            startTime,
            context,
            timestamp: Date.now()
        });
        
        return timerId;
    }

    /**
     * End timing an operation
     * @param {string} timerId - Timer ID from startTimer
     * @param {Object} result - Operation result
     * @returns {Object} Performance metrics
     */
    endTimer(timerId, result = {}) {
        if (!this.enabled || !timerId) return null;
        
        const timer = this.timers.get(timerId);
        if (!timer) {
            console.warn(`Timer ${timerId} not found`);
            return null;
        }
        
        const endTime = performance.now();
        const duration = endTime - timer.startTime;
        
        const metrics = {
            operationName: timer.operationName,
            duration,
            startTime: timer.startTime,
            endTime,
            timestamp: timer.timestamp,
            context: timer.context,
            result: this.sanitizeResult(result),
            success: result.success !== false
        };
        
        // Record metrics
        this.recordOperationMetrics(metrics);
        
        // Clean up timer
        this.timers.delete(timerId);
        
        return metrics;
    }

    /**
     * Record operation metrics
     * @param {Object} metrics - Operation metrics
     */
    recordOperationMetrics(metrics) {
        const operationName = metrics.operationName;
        
        if (!this.metrics.has(operationName)) {
            this.metrics.set(operationName, {
                totalCalls: 0,
                totalDuration: 0,
                averageDuration: 0,
                minDuration: Infinity,
                maxDuration: 0,
                successCount: 0,
                errorCount: 0,
                recentDurations: [],
                lastUpdated: Date.now()
            });
        }
        
        const operationMetrics = this.metrics.get(operationName);
        
        // Update metrics
        operationMetrics.totalCalls++;
        operationMetrics.totalDuration += metrics.duration;
        operationMetrics.averageDuration = operationMetrics.totalDuration / operationMetrics.totalCalls;
        operationMetrics.minDuration = Math.min(operationMetrics.minDuration, metrics.duration);
        operationMetrics.maxDuration = Math.max(operationMetrics.maxDuration, metrics.duration);
        operationMetrics.lastUpdated = Date.now();
        
        if (metrics.success) {
            operationMetrics.successCount++;
        } else {
            operationMetrics.errorCount++;
        }
        
        // Track recent durations for trend analysis
        operationMetrics.recentDurations.push({
            duration: metrics.duration,
            timestamp: metrics.timestamp,
            success: metrics.success
        });
        
        // Keep only recent durations (last 100)
        if (operationMetrics.recentDurations.length > 100) {
            operationMetrics.recentDurations.shift();
        }
        
        // Record in operation history
        this.recordOperationHistory(metrics);
    }

    /**
     * Record operation in history
     * @param {Object} metrics - Operation metrics
     */
    recordOperationHistory(metrics) {
        const operationName = metrics.operationName;
        
        if (!this.operationHistory.has(operationName)) {
            this.operationHistory.set(operationName, []);
        }
        
        const history = this.operationHistory.get(operationName);
        history.push(metrics);
        
        // Keep only recent history
        if (history.length > this.maxMetricsHistory) {
            history.shift();
        }
    }

    /**
     * Measure a function execution
     * @param {string} operationName - Name of the operation
     * @param {Function} fn - Function to measure
     * @param {Object} context - Additional context
     * @returns {Promise} Function result with timing
     */
    async measure(operationName, fn, context = {}) {
        if (!this.enabled) {
            return await fn();
        }
        
        const timerId = this.startTimer(operationName, context);
        
        try {
            const result = await fn();
            this.endTimer(timerId, { success: true, result });
            return result;
        } catch (error) {
            this.endTimer(timerId, { success: false, error: error.message });
            throw error;
        }
    }

    /**
     * Collect system-wide performance metrics
     */
    collectSystemMetrics() {
        const timestamp = Date.now();
        
        const systemMetrics = {
            timestamp,
            memory: this.collectMemoryMetrics(),
            timing: this.collectTimingMetrics(),
            network: this.collectNetworkMetrics(),
            operations: this.getOperationsSummary()
        };
        
        // Store system metrics
        if (!this.metrics.has('_system')) {
            this.metrics.set('_system', []);
        }
        
        const systemHistory = this.metrics.get('_system');
        systemHistory.push(systemMetrics);
        
        // Keep only recent system metrics (last 100)
        if (systemHistory.length > 100) {
            systemHistory.shift();
        }
    }

    /**
     * Collect memory metrics
     * @returns {Object} Memory metrics
     */
    collectMemoryMetrics() {
        if (!this.memoryMonitoringEnabled) {
            return { available: false };
        }
        
        const memory = performance.memory;
        return {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            usagePercentage: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
            available: true
        };
    }

    /**
     * Collect timing metrics
     * @returns {Object} Timing metrics
     */
    collectTimingMetrics() {
        if (typeof performance === 'undefined') {
            return { available: false };
        }
        
        return {
            now: performance.now(),
            timeOrigin: performance.timeOrigin || Date.now(),
            available: true
        };
    }

    /**
     * Collect network metrics
     * @returns {Object} Network metrics
     */
    collectNetworkMetrics() {
        if (typeof navigator === 'undefined' || !navigator.connection) {
            return { available: false };
        }
        
        const connection = navigator.connection;
        return {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData,
            available: true
        };
    }

    /**
     * Get operations summary
     * @returns {Object} Operations summary
     */
    getOperationsSummary() {
        const summary = {
            totalOperations: 0,
            averageResponseTime: 0,
            errorRate: 0,
            slowestOperations: []
        };
        
        let totalDuration = 0;
        let totalCalls = 0;
        let totalErrors = 0;
        const operationPerformance = [];
        
        for (const [operationName, metrics] of this.metrics.entries()) {
            if (operationName === '_system') continue;
            
            totalCalls += metrics.totalCalls;
            totalDuration += metrics.totalDuration;
            totalErrors += metrics.errorCount;
            
            operationPerformance.push({
                name: operationName,
                averageDuration: metrics.averageDuration,
                totalCalls: metrics.totalCalls,
                errorRate: metrics.errorCount / metrics.totalCalls
            });
        }
        
        summary.totalOperations = totalCalls;
        summary.averageResponseTime = totalCalls > 0 ? totalDuration / totalCalls : 0;
        summary.errorRate = totalCalls > 0 ? totalErrors / totalCalls : 0;
        
        // Find slowest operations
        summary.slowestOperations = operationPerformance
            .sort((a, b) => b.averageDuration - a.averageDuration)
            .slice(0, 5);
        
        return summary;
    }

    /**
     * Analyze performance bottlenecks with advanced degradation detection
     */
    analyzeBottlenecks() {
        const bottlenecks = [];
        const timestamp = Date.now();
        
        for (const [operationName, metrics] of this.metrics.entries()) {
            if (operationName === '_system') continue;
            
            // Check for slow operations
            if (metrics.averageDuration > this.alertThresholds.responseTime) {
                bottlenecks.push({
                    type: 'SLOW_OPERATION',
                    operationName,
                    averageDuration: metrics.averageDuration,
                    threshold: this.alertThresholds.responseTime,
                    severity: 'HIGH',
                    timestamp
                });
            }
            
            // Check for high error rates
            const errorRate = metrics.errorCount / metrics.totalCalls;
            if (errorRate > this.alertThresholds.errorRate) {
                bottlenecks.push({
                    type: 'HIGH_ERROR_RATE',
                    operationName,
                    errorRate,
                    threshold: this.alertThresholds.errorRate,
                    severity: 'HIGH',
                    timestamp
                });
            }
            
            // Advanced performance degradation detection
            const degradationAnalysis = this.detectPerformanceDegradation(operationName, metrics);
            if (degradationAnalysis.isDegraded) {
                bottlenecks.push({
                    type: 'PERFORMANCE_DEGRADATION',
                    operationName,
                    ...degradationAnalysis,
                    timestamp
                });
            }
            
            // Trend-based anomaly detection
            const trendAnalysis = this.analyzeTrendAnomalies(operationName, metrics);
            if (trendAnalysis.hasAnomaly) {
                bottlenecks.push({
                    type: 'TREND_ANOMALY',
                    operationName,
                    ...trendAnalysis,
                    timestamp
                });
            }
            
            // Resource utilization bottlenecks
            const resourceBottlenecks = this.detectResourceBottlenecks(operationName, metrics);
            bottlenecks.push(...resourceBottlenecks.map(rb => ({ ...rb, timestamp })));
        }
        
        // Update bottlenecks
        this.bottlenecks.set(timestamp, bottlenecks);
        
        // Clean old bottlenecks (keep last 24 hours)
        const oneDayAgo = timestamp - (24 * 60 * 60 * 1000);
        for (const [time] of this.bottlenecks.entries()) {
            if (time < oneDayAgo) {
                this.bottlenecks.delete(time);
            }
        }
        
        return bottlenecks;
    }

    /**
     * Detect performance degradation using statistical analysis
     * @param {string} operationName - Operation name
     * @param {Object} metrics - Operation metrics
     * @returns {Object} Degradation analysis
     */
    detectPerformanceDegradation(operationName, metrics) {
        const recentDurations = metrics.recentDurations.slice(-20); // Last 20 operations
        const historicalDurations = metrics.recentDurations.slice(0, -20); // Earlier operations
        
        if (recentDurations.length < 10 || historicalDurations.length < 10) {
            return { isDegraded: false, reason: 'insufficient_data' };
        }
        
        const recentStats = this.calculateStatistics(recentDurations.map(d => d.duration));
        const historicalStats = this.calculateStatistics(historicalDurations.map(d => d.duration));
        
        // Multiple degradation detection algorithms
        const algorithms = [
            this.detectMeanShift(recentStats, historicalStats),
            this.detectVarianceIncrease(recentStats, historicalStats),
            this.detectPercentileShift(recentDurations, historicalDurations),
            this.detectTrendDegradation(recentDurations)
        ];
        
        const positiveDetections = algorithms.filter(a => a.isDegraded);
        
        if (positiveDetections.length >= 2) {
            return {
                isDegraded: true,
                severity: this.calculateDegradationSeverity(positiveDetections),
                algorithms: positiveDetections,
                recentStats,
                historicalStats,
                degradationFactor: recentStats.mean / historicalStats.mean,
                confidence: positiveDetections.length / algorithms.length
            };
        }
        
        return { isDegraded: false, algorithms };
    }

    /**
     * Calculate statistical measures for performance data
     * @param {Array} durations - Array of duration values
     * @returns {Object} Statistical measures
     */
    calculateStatistics(durations) {
        if (durations.length === 0) return null;
        
        const sorted = [...durations].sort((a, b) => a - b);
        const sum = durations.reduce((a, b) => a + b, 0);
        const mean = sum / durations.length;
        
        const variance = durations.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / durations.length;
        const stdDev = Math.sqrt(variance);
        
        return {
            mean,
            median: sorted[Math.floor(sorted.length / 2)],
            min: sorted[0],
            max: sorted[sorted.length - 1],
            stdDev,
            variance,
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            count: durations.length
        };
    }

    /**
     * Detect mean shift in performance
     * @param {Object} recentStats - Recent statistics
     * @param {Object} historicalStats - Historical statistics
     * @returns {Object} Detection result
     */
    detectMeanShift(recentStats, historicalStats) {
        const meanRatio = recentStats.mean / historicalStats.mean;
        const threshold = 1.3; // 30% increase
        
        return {
            isDegraded: meanRatio > threshold,
            algorithm: 'mean_shift',
            meanRatio,
            threshold,
            severity: meanRatio > 2.0 ? 'CRITICAL' : meanRatio > 1.5 ? 'HIGH' : 'MEDIUM'
        };
    }

    /**
     * Detect variance increase (performance instability)
     * @param {Object} recentStats - Recent statistics
     * @param {Object} historicalStats - Historical statistics
     * @returns {Object} Detection result
     */
    detectVarianceIncrease(recentStats, historicalStats) {
        const varianceRatio = recentStats.variance / historicalStats.variance;
        const threshold = 2.0; // 100% increase in variance
        
        return {
            isDegraded: varianceRatio > threshold,
            algorithm: 'variance_increase',
            varianceRatio,
            threshold,
            severity: varianceRatio > 4.0 ? 'HIGH' : 'MEDIUM'
        };
    }

    /**
     * Detect percentile shift (tail latency degradation)
     * @param {Array} recentDurations - Recent duration data
     * @param {Array} historicalDurations - Historical duration data
     * @returns {Object} Detection result
     */
    detectPercentileShift(recentDurations, historicalDurations) {
        const recentStats = this.calculateStatistics(recentDurations.map(d => d.duration));
        const historicalStats = this.calculateStatistics(historicalDurations.map(d => d.duration));
        
        const p95Ratio = recentStats.p95 / historicalStats.p95;
        const threshold = 1.5; // 50% increase in 95th percentile
        
        return {
            isDegraded: p95Ratio > threshold,
            algorithm: 'percentile_shift',
            p95Ratio,
            threshold,
            severity: p95Ratio > 2.5 ? 'CRITICAL' : p95Ratio > 2.0 ? 'HIGH' : 'MEDIUM'
        };
    }

    /**
     * Detect trend-based degradation
     * @param {Array} recentDurations - Recent duration data
     * @returns {Object} Detection result
     */
    detectTrendDegradation(recentDurations) {
        if (recentDurations.length < 10) {
            return { isDegraded: false, algorithm: 'trend_degradation', reason: 'insufficient_data' };
        }
        
        const durations = recentDurations.map(d => d.duration);
        const trend = this.calculateLinearTrend(durations);
        
        // Positive slope indicates increasing duration (degradation)
        const isDegraded = trend.slope > 0 && trend.correlation > 0.7;
        
        return {
            isDegraded,
            algorithm: 'trend_degradation',
            slope: trend.slope,
            correlation: trend.correlation,
            severity: trend.slope > 100 ? 'HIGH' : 'MEDIUM'
        };
    }

    /**
     * Calculate linear trend for time series data
     * @param {Array} values - Array of values
     * @returns {Object} Trend analysis
     */
    calculateLinearTrend(values) {
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = values;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
        const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
        const sumYY = y.reduce((acc, yi) => acc + yi * yi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Calculate correlation coefficient
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
        const correlation = denominator === 0 ? 0 : numerator / denominator;
        
        return { slope, intercept, correlation };
    }

    /**
     * Calculate degradation severity based on multiple algorithms
     * @param {Array} detections - Array of positive detections
     * @returns {string} Severity level
     */
    calculateDegradationSeverity(detections) {
        const severityScores = {
            'LOW': 1,
            'MEDIUM': 2,
            'HIGH': 3,
            'CRITICAL': 4
        };
        
        const maxScore = Math.max(...detections.map(d => severityScores[d.severity] || 1));
        const avgScore = detections.reduce((sum, d) => sum + (severityScores[d.severity] || 1), 0) / detections.length;
        
        if (maxScore >= 4 || avgScore >= 3) return 'CRITICAL';
        if (maxScore >= 3 || avgScore >= 2.5) return 'HIGH';
        if (avgScore >= 2) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Analyze trend anomalies using time series analysis
     * @param {string} operationName - Operation name
     * @param {Object} metrics - Operation metrics
     * @returns {Object} Trend anomaly analysis
     */
    analyzeTrendAnomalies(operationName, metrics) {
        const durations = metrics.recentDurations.map(d => d.duration);
        
        if (durations.length < 20) {
            return { hasAnomaly: false, reason: 'insufficient_data' };
        }
        
        // Detect sudden spikes
        const spikeAnalysis = this.detectSuddenSpikes(durations);
        
        // Detect cyclical patterns
        const cyclicalAnalysis = this.detectCyclicalAnomalies(durations);
        
        // Detect sustained degradation
        const sustainedAnalysis = this.detectSustainedDegradation(durations);
        
        const hasAnomaly = spikeAnalysis.hasSpike || cyclicalAnalysis.hasAnomaly || sustainedAnalysis.hasDegradation;
        
        if (hasAnomaly) {
            return {
                hasAnomaly: true,
                spikeAnalysis,
                cyclicalAnalysis,
                sustainedAnalysis,
                severity: this.calculateAnomalySeverity([spikeAnalysis, cyclicalAnalysis, sustainedAnalysis])
            };
        }
        
        return { hasAnomaly: false };
    }

    /**
     * Detect sudden performance spikes
     * @param {Array} durations - Duration values
     * @returns {Object} Spike analysis
     */
    detectSuddenSpikes(durations) {
        const stats = this.calculateStatistics(durations);
        const threshold = stats.mean + (2 * stats.stdDev); // 2 standard deviations
        
        const spikes = durations.filter(d => d > threshold);
        const spikeRate = spikes.length / durations.length;
        
        return {
            hasSpike: spikeRate > 0.1, // More than 10% of requests are spikes
            spikeCount: spikes.length,
            spikeRate,
            threshold,
            maxSpike: Math.max(...spikes),
            severity: spikeRate > 0.2 ? 'HIGH' : 'MEDIUM'
        };
    }

    /**
     * Detect cyclical performance anomalies
     * @param {Array} durations - Duration values
     * @returns {Object} Cyclical analysis
     */
    detectCyclicalAnomalies(durations) {
        // Simple cyclical detection using moving averages
        const windowSize = 5;
        const movingAverages = [];
        
        for (let i = windowSize; i < durations.length; i++) {
            const window = durations.slice(i - windowSize, i);
            const avg = window.reduce((a, b) => a + b, 0) / window.length;
            movingAverages.push(avg);
        }
        
        if (movingAverages.length < 10) {
            return { hasAnomaly: false, reason: 'insufficient_data' };
        }
        
        // Detect oscillations in moving averages
        const oscillations = this.detectOscillations(movingAverages);
        
        return {
            hasAnomaly: oscillations.count > 3,
            oscillations,
            severity: oscillations.count > 5 ? 'HIGH' : 'MEDIUM'
        };
    }

    /**
     * Detect oscillations in time series
     * @param {Array} values - Time series values
     * @returns {Object} Oscillation analysis
     */
    detectOscillations(values) {
        let oscillationCount = 0;
        let direction = 0; // 1 for increasing, -1 for decreasing
        
        for (let i = 1; i < values.length; i++) {
            const currentDirection = values[i] > values[i - 1] ? 1 : -1;
            
            if (direction !== 0 && direction !== currentDirection) {
                oscillationCount++;
            }
            
            direction = currentDirection;
        }
        
        return {
            count: oscillationCount,
            frequency: oscillationCount / values.length
        };
    }

    /**
     * Detect sustained performance degradation
     * @param {Array} durations - Duration values
     * @returns {Object} Sustained degradation analysis
     */
    detectSustainedDegradation(durations) {
        const windowSize = 10;
        const threshold = 1.2; // 20% increase
        
        if (durations.length < windowSize * 2) {
            return { hasDegradation: false, reason: 'insufficient_data' };
        }
        
        const earlyWindow = durations.slice(0, windowSize);
        const lateWindow = durations.slice(-windowSize);
        
        const earlyAvg = earlyWindow.reduce((a, b) => a + b, 0) / earlyWindow.length;
        const lateAvg = lateWindow.reduce((a, b) => a + b, 0) / lateWindow.length;
        
        const degradationRatio = lateAvg / earlyAvg;
        
        return {
            hasDegradation: degradationRatio > threshold,
            degradationRatio,
            earlyAvg,
            lateAvg,
            severity: degradationRatio > 1.5 ? 'HIGH' : 'MEDIUM'
        };
    }

    /**
     * Calculate anomaly severity
     * @param {Array} analyses - Array of anomaly analyses
     * @returns {string} Severity level
     */
    calculateAnomalySeverity(analyses) {
        const severities = analyses
            .filter(a => a.severity)
            .map(a => a.severity);
        
        if (severities.includes('HIGH')) return 'HIGH';
        if (severities.includes('MEDIUM')) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Detect resource utilization bottlenecks
     * @param {string} operationName - Operation name
     * @param {Object} metrics - Operation metrics
     * @returns {Array} Resource bottlenecks
     */
    detectResourceBottlenecks(operationName, metrics) {
        const bottlenecks = [];
        
        // Memory-related bottlenecks
        if (this.memoryMonitoringEnabled) {
            const memoryMetrics = this.collectMemoryMetrics();
            if (memoryMetrics.usagePercentage > 0.9) {
                bottlenecks.push({
                    type: 'MEMORY_BOTTLENECK',
                    operationName,
                    memoryUsage: memoryMetrics.usagePercentage,
                    severity: 'HIGH'
                });
            }
        }
        
        // Concurrency bottlenecks
        const concurrentOperations = this.timers.size;
        if (concurrentOperations > 50) {
            bottlenecks.push({
                type: 'CONCURRENCY_BOTTLENECK',
                operationName,
                concurrentOperations,
                severity: concurrentOperations > 100 ? 'HIGH' : 'MEDIUM'
            });
        }
        
        return bottlenecks;
    }

    /**
     * Check alert thresholds and send alerts
     */
    checkAlertThresholds() {
        const systemMetrics = this.collectSystemMetrics();
        const alerts = [];
        
        // Check memory usage
        if (systemMetrics.memory.available && 
            systemMetrics.memory.usagePercentage > this.alertThresholds.memoryUsage) {
            alerts.push({
                type: 'HIGH_MEMORY_USAGE',
                value: systemMetrics.memory.usagePercentage,
                threshold: this.alertThresholds.memoryUsage,
                severity: 'HIGH',
                timestamp: Date.now(),
                details: systemMetrics.memory
            });
        }
        
        // Check overall system performance
        const operationsSummary = systemMetrics.operations;
        if (operationsSummary.averageResponseTime > this.alertThresholds.responseTime) {
            alerts.push({
                type: 'SLOW_SYSTEM_RESPONSE',
                value: operationsSummary.averageResponseTime,
                threshold: this.alertThresholds.responseTime,
                severity: 'HIGH',
                timestamp: Date.now(),
                details: operationsSummary
            });
        }
        
        // Send alerts
        for (const alert of alerts) {
            this.sendAlert(alert);
        }
        
        return alerts;
    }

    /**
     * Send performance alert
     * @param {Object} alert - Alert object
     */
    sendAlert(alert) {
        this.alerts.push(alert);
        
        // Keep only recent alerts (last 100)
        if (this.alerts.length > 100) {
            this.alerts.shift();
        }
        
        // Call alert callbacks
        for (const callback of this.alertCallbacks) {
            try {
                callback(alert);
            } catch (error) {
                console.error('Performance alert callback failed:', error);
            }
        }
        
        // Default console alerting
        if (this.alertCallbacks.size === 0) {
            console.warn('🚨 Performance Alert:', {
                type: alert.type,
                severity: alert.severity,
                value: alert.value,
                threshold: alert.threshold,
                timestamp: new Date(alert.timestamp).toISOString()
            });
        }
    }

    /**
     * Record navigation metrics
     * @param {PerformanceNavigationTiming} entry - Navigation timing entry
     */
    recordNavigationMetrics(entry) {
        const metrics = {
            operationName: 'page_navigation',
            duration: entry.loadEventEnd - entry.navigationStart,
            domContentLoaded: entry.domContentLoadedEventEnd - entry.navigationStart,
            firstPaint: entry.responseEnd - entry.navigationStart,
            timestamp: Date.now(),
            context: {
                type: entry.type,
                redirectCount: entry.redirectCount
            },
            success: true
        };
        
        this.recordOperationMetrics(metrics);
    }

    /**
     * Record resource metrics
     * @param {PerformanceResourceTiming} entry - Resource timing entry
     */
    recordResourceMetrics(entry) {
        const metrics = {
            operationName: `resource_load_${this.getResourceType(entry.name)}`,
            duration: entry.responseEnd - entry.startTime,
            timestamp: Date.now(),
            context: {
                name: entry.name,
                size: entry.transferSize || 0,
                cached: entry.transferSize === 0 && entry.decodedBodySize > 0
            },
            success: entry.responseEnd > 0
        };
        
        this.recordOperationMetrics(metrics);
    }

    /**
     * Record measure metrics
     * @param {PerformanceMeasure} entry - Measure timing entry
     */
    recordMeasureMetrics(entry) {
        const metrics = {
            operationName: entry.name,
            duration: entry.duration,
            timestamp: Date.now(),
            context: {
                startTime: entry.startTime,
                detail: entry.detail
            },
            success: true
        };
        
        this.recordOperationMetrics(metrics);
    }

    /**
     * Get resource type from URL
     * @param {string} url - Resource URL
     * @returns {string} Resource type
     */
    getResourceType(url) {
        if (url.includes('.js')) return 'script';
        if (url.includes('.css')) return 'stylesheet';
        if (url.includes('.png') || url.includes('.jpg') || url.includes('.gif')) return 'image';
        if (url.includes('/api/')) return 'api';
        return 'other';
    }

    /**
     * Generate unique timer ID
     * @param {string} operationName - Operation name
     * @returns {string} Timer ID
     */
    generateTimerId(operationName) {
        return `timer_${operationName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * Sanitize result for safe storage
     * @param {any} result - Result to sanitize
     * @returns {any} Sanitized result
     */
    sanitizeResult(result) {
        if (typeof result === 'object' && result !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(result)) {
                if (typeof value === 'string' && value.length > 100) {
                    sanitized[key] = value.substring(0, 100) + '...[truncated]';
                } else if (typeof value !== 'function') {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        }
        return result;
    }

    /**
     * Get performance metrics for an operation
     * @param {string} operationName - Operation name
     * @returns {Object} Performance metrics
     */
    getMetrics(operationName) {
        return this.metrics.get(operationName) || null;
    }

    /**
     * Get all performance metrics
     * @returns {Object} All metrics
     */
    getAllMetrics() {
        const allMetrics = {};
        for (const [operationName, metrics] of this.metrics.entries()) {
            allMetrics[operationName] = metrics;
        }
        return allMetrics;
    }

    /**
     * Get recent bottlenecks
     * @param {number} limit - Maximum number of bottlenecks to return
     * @returns {Array} Recent bottlenecks
     */
    getRecentBottlenecks(limit = 10) {
        const allBottlenecks = [];
        for (const bottlenecks of this.bottlenecks.values()) {
            allBottlenecks.push(...bottlenecks);
        }
        
        return allBottlenecks
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Collect automatic diagnostic information
     * @param {string} operationName - Operation to diagnose
     * @returns {Object} Diagnostic information
     */
    collectDiagnosticInfo(operationName = null) {
        const timestamp = Date.now();
        const diagnostics = {
            timestamp,
            system: this.collectSystemDiagnostics(),
            performance: this.collectPerformanceDiagnostics(operationName),
            environment: this.collectEnvironmentDiagnostics(),
            recommendations: this.generateRecommendations(operationName)
        };
        
        return diagnostics;
    }

    /**
     * Collect system-level diagnostics
     * @returns {Object} System diagnostics
     */
    collectSystemDiagnostics() {
        const memoryMetrics = this.collectMemoryMetrics();
        const networkMetrics = this.collectNetworkMetrics();
        
        return {
            memory: memoryMetrics,
            network: networkMetrics,
            activeConnections: this.timers.size,
            systemLoad: this.calculateSystemLoad(),
            resourceUtilization: this.calculateResourceUtilization()
        };
    }

    /**
     * Collect performance-specific diagnostics
     * @param {string} operationName - Specific operation to diagnose
     * @returns {Object} Performance diagnostics
     */
    collectPerformanceDiagnostics(operationName) {
        const diagnostics = {
            overallPerformance: this.getOperationsSummary(),
            recentBottlenecks: this.getRecentBottlenecks(10),
            performanceTrends: this.calculatePerformanceTrends()
        };
        
        if (operationName && this.metrics.has(operationName)) {
            const operationMetrics = this.metrics.get(operationName);
            diagnostics.operationSpecific = {
                metrics: operationMetrics,
                degradationAnalysis: this.detectPerformanceDegradation(operationName, operationMetrics),
                trendAnalysis: this.analyzeTrendAnomalies(operationName, operationMetrics),
                predictions: this.predictPerformanceTrend(operationName, operationMetrics)
            };
        }
        
        return diagnostics;
    }

    /**
     * Collect environment diagnostics
     * @returns {Object} Environment diagnostics
     */
    collectEnvironmentDiagnostics() {
        return {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
            language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
            cookieEnabled: typeof navigator !== 'undefined' ? navigator.cookieEnabled : false,
            onLine: typeof navigator !== 'undefined' ? navigator.onLine : true,
            hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 1,
            deviceMemory: typeof navigator !== 'undefined' ? navigator.deviceMemory : 'unknown',
            timestamp: Date.now()
        };
    }

    /**
     * Calculate system load based on active operations
     * @returns {Object} System load metrics
     */
    calculateSystemLoad() {
        const activeOperations = this.timers.size;
        const totalOperations = Array.from(this.metrics.values())
            .reduce((sum, metrics) => sum + (metrics.totalCalls || 0), 0);
        
        return {
            activeOperations,
            totalOperations,
            loadFactor: activeOperations / Math.max(1, totalOperations * 0.01), // Normalize to percentage
            isHighLoad: activeOperations > 20
        };
    }

    /**
     * Calculate resource utilization
     * @returns {Object} Resource utilization metrics
     */
    calculateResourceUtilization() {
        const memoryMetrics = this.collectMemoryMetrics();
        const networkMetrics = this.collectNetworkMetrics();
        
        return {
            memory: {
                utilization: memoryMetrics.available ? memoryMetrics.usagePercentage : 0,
                status: memoryMetrics.available ? 
                    (memoryMetrics.usagePercentage > 0.8 ? 'HIGH' : 
                     memoryMetrics.usagePercentage > 0.6 ? 'MEDIUM' : 'LOW') : 'UNKNOWN'
            },
            network: {
                quality: networkMetrics.available ? networkMetrics.effectiveType : 'unknown',
                rtt: networkMetrics.available ? networkMetrics.rtt : 0,
                status: networkMetrics.available ? 
                    (networkMetrics.rtt > 200 ? 'SLOW' : 
                     networkMetrics.rtt > 100 ? 'MEDIUM' : 'FAST') : 'UNKNOWN'
            }
        };
    }

    /**
     * Calculate performance trends across all operations
     * @returns {Object} Performance trends
     */
    calculatePerformanceTrends() {
        const trends = {};
        
        for (const [operationName, metrics] of this.metrics.entries()) {
            if (operationName === '_system' || metrics.recentDurations.length < 10) continue;
            
            const durations = metrics.recentDurations.map(d => d.duration);
            const trend = this.calculateLinearTrend(durations);
            
            trends[operationName] = {
                direction: trend.slope > 0 ? 'degrading' : 'improving',
                slope: trend.slope,
                correlation: trend.correlation,
                confidence: Math.abs(trend.correlation),
                prediction: this.predictPerformanceTrend(operationName, metrics)
            };
        }
        
        return trends;
    }

    /**
     * Predict performance trend for an operation
     * @param {string} operationName - Operation name
     * @param {Object} metrics - Operation metrics
     * @returns {Object} Performance prediction
     */
    predictPerformanceTrend(operationName, metrics) {
        const durations = metrics.recentDurations.map(d => d.duration);
        
        if (durations.length < 10) {
            return { available: false, reason: 'insufficient_data' };
        }
        
        const trend = this.calculateLinearTrend(durations);
        const currentAvg = durations.slice(-5).reduce((a, b) => a + b, 0) / 5;
        
        // Predict next 5 data points
        const predictions = [];
        for (let i = 1; i <= 5; i++) {
            const predictedValue = trend.intercept + (trend.slope * (durations.length + i));
            predictions.push(Math.max(0, predictedValue)); // Ensure non-negative
        }
        
        const predictedAvg = predictions.reduce((a, b) => a + b, 0) / predictions.length;
        const changePercent = ((predictedAvg - currentAvg) / currentAvg) * 100;
        
        return {
            available: true,
            currentAverage: currentAvg,
            predictedAverage: predictedAvg,
            changePercent,
            trend: changePercent > 5 ? 'degrading' : changePercent < -5 ? 'improving' : 'stable',
            confidence: Math.abs(trend.correlation),
            predictions,
            timeHorizon: '5 operations'
        };
    }

    /**
     * Generate performance recommendations
     * @param {string} operationName - Specific operation to analyze
     * @returns {Array} Array of recommendations
     */
    generateRecommendations(operationName = null) {
        const recommendations = [];
        const systemDiagnostics = this.collectSystemDiagnostics();
        
        // Memory recommendations
        if (systemDiagnostics.memory.available && systemDiagnostics.memory.usagePercentage > 0.8) {
            recommendations.push({
                type: 'MEMORY_OPTIMIZATION',
                priority: 'HIGH',
                message: 'High memory usage detected. Consider implementing memory cleanup or reducing cache sizes.',
                details: {
                    currentUsage: systemDiagnostics.memory.usagePercentage,
                    threshold: 0.8
                }
            });
        }
        
        // Network recommendations
        if (systemDiagnostics.network.available && systemDiagnostics.network.rtt > 200) {
            recommendations.push({
                type: 'NETWORK_OPTIMIZATION',
                priority: 'MEDIUM',
                message: 'High network latency detected. Consider implementing request batching or caching.',
                details: {
                    currentRTT: systemDiagnostics.network.rtt,
                    threshold: 200
                }
            });
        }
        
        // Operation-specific recommendations
        if (operationName && this.metrics.has(operationName)) {
            const metrics = this.metrics.get(operationName);
            const degradation = this.detectPerformanceDegradation(operationName, metrics);
            
            if (degradation.isDegraded) {
                recommendations.push({
                    type: 'OPERATION_OPTIMIZATION',
                    priority: degradation.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                    message: `Performance degradation detected in ${operationName}. Consider optimization or scaling.`,
                    details: {
                        operation: operationName,
                        degradationFactor: degradation.degradationFactor,
                        algorithms: degradation.algorithms
                    }
                });
            }
            
            // Error rate recommendations
            const errorRate = metrics.errorCount / metrics.totalCalls;
            if (errorRate > 0.05) {
                recommendations.push({
                    type: 'ERROR_REDUCTION',
                    priority: errorRate > 0.1 ? 'HIGH' : 'MEDIUM',
                    message: `High error rate detected in ${operationName}. Review error handling and input validation.`,
                    details: {
                        operation: operationName,
                        errorRate,
                        errorCount: metrics.errorCount,
                        totalCalls: metrics.totalCalls
                    }
                });
            }
        }
        
        // System load recommendations
        if (systemDiagnostics.systemLoad.isHighLoad) {
            recommendations.push({
                type: 'LOAD_BALANCING',
                priority: 'MEDIUM',
                message: 'High system load detected. Consider implementing request queuing or load balancing.',
                details: {
                    activeOperations: systemDiagnostics.systemLoad.activeOperations,
                    loadFactor: systemDiagnostics.systemLoad.loadFactor
                }
            });
        }
        
        return recommendations.sort((a, b) => {
            const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * Get comprehensive performance report with diagnostics and predictions
     * @param {string} operationName - Specific operation to analyze
     * @returns {Object} Comprehensive performance report
     */
    getComprehensiveReport(operationName = null) {
        return {
            timestamp: Date.now(),
            summary: this.getPerformanceSummary(),
            diagnostics: this.collectDiagnosticInfo(operationName),
            trends: this.calculatePerformanceTrends(),
            predictions: this.generatePerformancePredictions(),
            recommendations: this.generateRecommendations(operationName)
        };
    }

    /**
     * Generate performance predictions for all operations
     * @returns {Object} Performance predictions
     */
    generatePerformancePredictions() {
        const predictions = {};
        
        for (const [operationName, metrics] of this.metrics.entries()) {
            if (operationName === '_system') continue;
            
            predictions[operationName] = this.predictPerformanceTrend(operationName, metrics);
        }
        
        return predictions;
    }

    /**
     * Get performance summary with enhanced diagnostics
     * @returns {Object} Performance summary
     */
    getPerformanceSummary() {
        const systemMetrics = this.metrics.get('_system') || [];
        const latestSystemMetrics = systemMetrics[systemMetrics.length - 1];
        
        return {
            timestamp: Date.now(),
            system: latestSystemMetrics || {},
            operations: this.getOperationsSummary(),
            bottlenecks: this.getRecentBottlenecks(5),
            alerts: this.alerts.slice(-5),
            trends: this.calculatePerformanceTrends(),
            monitoring: {
                enabled: this.enabled,
                activeTimers: this.timers.size,
                trackedOperations: this.metrics.size - 1, // Exclude _system
                memoryMonitoring: this.memoryMonitoringEnabled
            }
        };
    }

    /**
     * Register alert callback
     * @param {Function} callback - Alert callback function
     */
    onAlert(callback) {
        if (typeof callback === 'function') {
            this.alertCallbacks.add(callback);
        }
    }

    /**
     * Remove alert callback
     * @param {Function} callback - Callback to remove
     */
    offAlert(callback) {
        this.alertCallbacks.delete(callback);
    }

    /**
     * Clear all metrics
     */
    clearMetrics() {
        this.metrics.clear();
        this.operationHistory.clear();
        this.bottlenecks.clear();
        this.alerts.length = 0;
    }

    /**
     * Disable performance monitoring
     */
    disable() {
        this.enabled = false;
        
        // Clear collection interval
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
        }
        
        // Disconnect observers
        for (const observer of this.observers) {
            observer.disconnect();
        }
        this.observers.clear();
    }

    /**
     * Enable performance monitoring
     */
    enable() {
        this.enabled = true;
        this.initializeMonitoring();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
} else if (typeof window !== 'undefined') {
    window.PerformanceMonitor = PerformanceMonitor;
}
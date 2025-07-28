/**
 * Resource Constraint Handler - Monitors and manages system resources
 * Implements memory usage monitoring, alerts, and graceful degradation
 */

class ResourceConstraintHandler {
    constructor(options = {}) {
        this.debug = options.debug || console;
        this.thresholds = {
            memory: {
                warning: options.memoryWarningThreshold || 50 * 1024 * 1024, // 50MB
                critical: options.memoryCriticalThreshold || 100 * 1024 * 1024, // 100MB
                maximum: options.memoryMaxThreshold || 200 * 1024 * 1024 // 200MB
            },
            storage: {
                warning: options.storageWarningThreshold || 5 * 1024 * 1024, // 5MB
                critical: options.storageCriticalThreshold || 1 * 1024 * 1024 // 1MB
            },
            connections: {
                warning: options.connectionsWarningThreshold || 50,
                critical: options.connectionsCriticalThreshold || 100
            }
        };
        
        this.currentUsage = {
            memory: 0,
            storage: 0,
            connections: 0
        };
        
        this.degradationLevel = 'none'; // none, low, medium, high, critical
        this.alertCallbacks = new Map();
        this.cleanupTasks = new Map();
        this.resourceTrackers = new Map();
        this.monitoringInterval = null;
        
        this.setupMonitoring();
        this.setupCleanupTasks();
    }

    /**
     * Setup resource monitoring
     */
    setupMonitoring() {
        // Monitor memory usage every 30 seconds
        this.monitoringInterval = setInterval(() => {
            this.checkResourceUsage();
        }, 30000);

        // Monitor storage usage when available
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
            this.monitorStorageUsage();
        }

        // Monitor performance if available
        if (typeof performance !== 'undefined' && performance.memory) {
            this.monitorPerformanceMemory();
        }
    }

    /**
     * Setup cleanup tasks for resource management
     */
    setupCleanupTasks() {
        // Cache cleanup
        this.addCleanupTask('cache_cleanup', () => {
            this.debug.info('Performing cache cleanup due to resource constraints');
            // Clear various caches
            if (typeof caches !== 'undefined') {
                caches.keys().then(names => {
                    names.forEach(name => {
                        if (name.includes('temp') || name.includes('cache')) {
                            caches.delete(name);
                        }
                    });
                });
            }
        });

        // Memory cleanup
        this.addCleanupTask('memory_cleanup', () => {
            this.debug.info('Performing memory cleanup due to resource constraints');
            // Force garbage collection if available
            if (typeof gc !== 'undefined') {
                gc();
            }
            // Clear large objects from memory
            this.clearLargeObjects();
        });

        // Connection cleanup
        this.addCleanupTask('connection_cleanup', () => {
            this.debug.info('Performing connection cleanup due to resource constraints');
            this.closeIdleConnections();
        });

        // Storage cleanup
        this.addCleanupTask('storage_cleanup', () => {
            this.debug.info('Performing storage cleanup due to resource constraints');
            this.cleanupLocalStorage();
        });
    }

    /**
     * Check current resource usage
     */
    async checkResourceUsage() {
        try {
            // Check memory usage
            await this.checkMemoryUsage();
            
            // Check storage usage
            await this.checkStorageUsage();
            
            // Check connection usage
            this.checkConnectionUsage();
            
            // Determine degradation level
            this.updateDegradationLevel();
            
            // Trigger alerts if necessary
            this.triggerAlerts();
            
        } catch (error) {
            this.debug.error('Error checking resource usage:', error);
        }
    }

    /**
     * Check memory usage
     */
    async checkMemoryUsage() {
        let memoryUsage = 0;
        
        // Use performance.memory if available (Chrome)
        if (typeof performance !== 'undefined' && performance.memory) {
            memoryUsage = performance.memory.usedJSHeapSize;
        } else {
            // Estimate memory usage based on tracked objects
            memoryUsage = this.estimateMemoryUsage();
        }
        
        this.currentUsage.memory = memoryUsage;
        
        // Check thresholds
        if (memoryUsage > this.thresholds.memory.critical) {
            this.handleCriticalMemoryUsage();
        } else if (memoryUsage > this.thresholds.memory.warning) {
            this.handleWarningMemoryUsage();
        }
    }

    /**
     * Check storage usage
     */
    async checkStorageUsage() {
        try {
            let storageUsage = 0;
            
            // Use Storage API if available
            if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                storageUsage = estimate.usage || 0;
            } else {
                // Estimate localStorage usage
                storageUsage = this.estimateLocalStorageUsage();
            }
            
            this.currentUsage.storage = storageUsage;
            
            // Check thresholds
            if (storageUsage > this.thresholds.storage.critical) {
                this.handleCriticalStorageUsage();
            } else if (storageUsage > this.thresholds.storage.warning) {
                this.handleWarningStorageUsage();
            }
            
        } catch (error) {
            this.debug.warn('Could not check storage usage:', error);
        }
    }

    /**
     * Check connection usage
     */
    checkConnectionUsage() {
        const connectionCount = this.getActiveConnectionCount();
        this.currentUsage.connections = connectionCount;
        
        if (connectionCount > this.thresholds.connections.critical) {
            this.handleCriticalConnectionUsage();
        } else if (connectionCount > this.thresholds.connections.warning) {
            this.handleWarningConnectionUsage();
        }
    }

    /**
     * Update degradation level based on resource usage
     */
    updateDegradationLevel() {
        const memoryRatio = this.currentUsage.memory / this.thresholds.memory.maximum;
        const storageRatio = this.currentUsage.storage / this.thresholds.storage.critical;
        const connectionRatio = this.currentUsage.connections / this.thresholds.connections.critical;
        
        const maxRatio = Math.max(memoryRatio, storageRatio, connectionRatio);
        
        let newLevel = 'none';
        if (maxRatio > 1.0) {
            newLevel = 'critical';
        } else if (maxRatio > 0.8) {
            newLevel = 'high';
        } else if (maxRatio > 0.6) {
            newLevel = 'medium';
        } else if (maxRatio > 0.4) {
            newLevel = 'low';
        }
        
        if (newLevel !== this.degradationLevel) {
            this.debug.info(`Degradation level changed from ${this.degradationLevel} to ${newLevel}`);
            this.degradationLevel = newLevel;
            this.applyDegradation(newLevel);
        }
    }

    /**
     * Apply degradation based on level
     */
    applyDegradation(level) {
        switch (level) {
            case 'low':
                this.applyLowDegradation();
                break;
            case 'medium':
                this.applyMediumDegradation();
                break;
            case 'high':
                this.applyHighDegradation();
                break;
            case 'critical':
                this.applyCriticalDegradation();
                break;
            default:
                this.removeDegradation();
        }
    }

    /**
     * Apply low-level degradation
     */
    applyLowDegradation() {
        this.debug.info('Applying low-level degradation');
        
        // Reduce cache sizes
        this.reduceCacheSizes(0.8);
        
        // Increase cleanup frequency
        this.increaseCleanupFrequency(1.5);
        
        // Reduce animation quality
        this.reduceAnimationQuality();
    }

    /**
     * Apply medium-level degradation
     */
    applyMediumDegradation() {
        this.debug.info('Applying medium-level degradation');
        
        // Further reduce cache sizes
        this.reduceCacheSizes(0.6);
        
        // Disable non-essential features
        this.disableNonEssentialFeatures(['animations', 'auto-save']);
        
        // Increase cleanup frequency more
        this.increaseCleanupFrequency(2.0);
        
        // Reduce concurrent operations
        this.reduceConcurrentOperations(0.7);
    }

    /**
     * Apply high-level degradation
     */
    applyHighDegradation() {
        this.debug.info('Applying high-level degradation');
        
        // Minimize cache sizes
        this.reduceCacheSizes(0.4);
        
        // Disable more features
        this.disableNonEssentialFeatures(['animations', 'auto-save', 'background-sync', 'preloading']);
        
        // Aggressive cleanup
        this.increaseCleanupFrequency(3.0);
        
        // Significantly reduce concurrent operations
        this.reduceConcurrentOperations(0.5);
        
        // Force immediate cleanup
        this.performImmediateCleanup();
    }

    /**
     * Apply critical-level degradation
     */
    applyCriticalDegradation() {
        this.debug.warn('Applying critical-level degradation');
        
        // Minimal cache
        this.reduceCacheSizes(0.2);
        
        // Disable all non-essential features
        this.disableNonEssentialFeatures(['animations', 'auto-save', 'background-sync', 'preloading', 'history', 'undo']);
        
        // Maximum cleanup frequency
        this.increaseCleanupFrequency(5.0);
        
        // Minimal concurrent operations
        this.reduceConcurrentOperations(0.3);
        
        // Emergency cleanup
        this.performEmergencyCleanup();
        
        // Alert user about degraded performance
        this.alertUser('critical_performance');
    }

    /**
     * Remove degradation when resources are available
     */
    removeDegradation() {
        this.debug.info('Removing degradation - resources available');
        
        // Restore normal cache sizes
        this.restoreCacheSizes();
        
        // Re-enable features
        this.enableFeatures();
        
        // Restore normal cleanup frequency
        this.restoreCleanupFrequency();
        
        // Restore concurrent operations
        this.restoreConcurrentOperations();
    }

    /**
     * Handle critical memory usage
     */
    handleCriticalMemoryUsage() {
        this.debug.warn('Critical memory usage detected');
        this.performCleanupTask('memory_cleanup');
        this.performCleanupTask('cache_cleanup');
        this.triggerAlert('critical_memory');
    }

    /**
     * Handle warning memory usage
     */
    handleWarningMemoryUsage() {
        this.debug.info('Warning memory usage detected');
        this.performCleanupTask('cache_cleanup');
        this.triggerAlert('warning_memory');
    }

    /**
     * Handle critical storage usage
     */
    handleCriticalStorageUsage() {
        this.debug.warn('Critical storage usage detected');
        this.performCleanupTask('storage_cleanup');
        this.triggerAlert('critical_storage');
    }

    /**
     * Handle warning storage usage
     */
    handleWarningStorageUsage() {
        this.debug.info('Warning storage usage detected');
        this.performCleanupTask('storage_cleanup');
        this.triggerAlert('warning_storage');
    }

    /**
     * Handle critical connection usage
     */
    handleCriticalConnectionUsage() {
        this.debug.warn('Critical connection usage detected');
        this.performCleanupTask('connection_cleanup');
        this.triggerAlert('critical_connections');
    }

    /**
     * Handle warning connection usage
     */
    handleWarningConnectionUsage() {
        this.debug.info('Warning connection usage detected');
        this.performCleanupTask('connection_cleanup');
        this.triggerAlert('warning_connections');
    }

    /**
     * Add cleanup task
     */
    addCleanupTask(name, task) {
        this.cleanupTasks.set(name, task);
    }

    /**
     * Perform specific cleanup task
     */
    performCleanupTask(taskName) {
        const task = this.cleanupTasks.get(taskName);
        if (task) {
            try {
                task();
                this.debug.info(`Cleanup task ${taskName} completed`);
            } catch (error) {
                this.debug.error(`Cleanup task ${taskName} failed:`, error);
            }
        }
    }

    /**
     * Perform immediate cleanup
     */
    performImmediateCleanup() {
        this.debug.info('Performing immediate cleanup');
        for (const [name, task] of this.cleanupTasks.entries()) {
            this.performCleanupTask(name);
        }
    }

    /**
     * Perform emergency cleanup
     */
    performEmergencyCleanup() {
        this.debug.warn('Performing emergency cleanup');
        
        // Clear all caches
        this.clearAllCaches();
        
        // Close unnecessary connections
        this.closeAllNonEssentialConnections();
        
        // Clear large data structures
        this.clearLargeDataStructures();
        
        // Force garbage collection
        this.forceGarbageCollection();
    }

    /**
     * Add alert callback
     */
    addAlertCallback(alertType, callback) {
        if (!this.alertCallbacks.has(alertType)) {
            this.alertCallbacks.set(alertType, new Set());
        }
        this.alertCallbacks.get(alertType).add(callback);
    }

    /**
     * Trigger alert
     */
    triggerAlert(alertType) {
        const callbacks = this.alertCallbacks.get(alertType);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback({
                        type: alertType,
                        usage: this.currentUsage,
                        thresholds: this.thresholds,
                        degradationLevel: this.degradationLevel,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    this.debug.error(`Alert callback failed for ${alertType}:`, error);
                }
            });
        }
    }

    /**
     * Trigger all relevant alerts
     */
    triggerAlerts() {
        // Check if we need to trigger any alerts based on current usage
        const memoryRatio = this.currentUsage.memory / this.thresholds.memory.critical;
        const storageRatio = this.currentUsage.storage / this.thresholds.storage.critical;
        const connectionRatio = this.currentUsage.connections / this.thresholds.connections.critical;
        
        if (memoryRatio > 1.0 || storageRatio > 1.0 || connectionRatio > 1.0) {
            this.triggerAlert('resource_critical');
        } else if (memoryRatio > 0.8 || storageRatio > 0.8 || connectionRatio > 0.8) {
            this.triggerAlert('resource_warning');
        }
    }

    /**
     * Get current resource usage
     */
    getResourceUsage() {
        return {
            ...this.currentUsage,
            degradationLevel: this.degradationLevel,
            thresholds: this.thresholds
        };
    }

    /**
     * Set resource thresholds
     */
    setThresholds(newThresholds) {
        Object.assign(this.thresholds, newThresholds);
        this.debug.info('Resource thresholds updated:', this.thresholds);
    }

    /**
     * Estimate memory usage (fallback method)
     */
    estimateMemoryUsage() {
        // Simple estimation based on tracked objects
        let estimate = 0;
        
        // Estimate based on DOM elements
        if (typeof document !== 'undefined') {
            estimate += document.getElementsByTagName('*').length * 100; // ~100 bytes per element
        }
        
        // Add estimates for tracked resources
        for (const [name, tracker] of this.resourceTrackers.entries()) {
            estimate += tracker.estimateSize();
        }
        
        return estimate;
    }

    /**
     * Estimate localStorage usage
     */
    estimateLocalStorageUsage() {
        if (typeof localStorage === 'undefined') return 0;
        
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return total * 2; // UTF-16 encoding
    }

    /**
     * Get active connection count
     */
    getActiveConnectionCount() {
        // This would need to be implemented based on your specific connection tracking
        // For now, return a placeholder
        return 0;
    }

    /**
     * Utility methods for degradation
     */
    reduceCacheSizes(factor) {
        // Implementation would depend on your caching system
        this.debug.info(`Reducing cache sizes by factor ${factor}`);
    }

    increaseCleanupFrequency(factor) {
        // Implementation would adjust cleanup intervals
        this.debug.info(`Increasing cleanup frequency by factor ${factor}`);
    }

    reduceAnimationQuality() {
        // Disable or reduce animations
        this.debug.info('Reducing animation quality');
    }

    disableNonEssentialFeatures(features) {
        this.debug.info('Disabling non-essential features:', features);
    }

    reduceConcurrentOperations(factor) {
        this.debug.info(`Reducing concurrent operations by factor ${factor}`);
    }

    restoreCacheSizes() {
        this.debug.info('Restoring normal cache sizes');
    }

    enableFeatures() {
        this.debug.info('Re-enabling features');
    }

    restoreCleanupFrequency() {
        this.debug.info('Restoring normal cleanup frequency');
    }

    restoreConcurrentOperations() {
        this.debug.info('Restoring normal concurrent operations');
    }

    clearLargeObjects() {
        this.debug.info('Clearing large objects from memory');
    }

    closeIdleConnections() {
        this.debug.info('Closing idle connections');
    }

    cleanupLocalStorage() {
        if (typeof localStorage !== 'undefined') {
            // Remove temporary or old data
            const keysToRemove = [];
            for (let key in localStorage) {
                if (key.includes('temp_') || key.includes('cache_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            this.debug.info(`Cleaned up ${keysToRemove.length} localStorage items`);
        }
    }

    clearAllCaches() {
        this.debug.info('Clearing all caches');
    }

    closeAllNonEssentialConnections() {
        this.debug.info('Closing all non-essential connections');
    }

    clearLargeDataStructures() {
        this.debug.info('Clearing large data structures');
    }

    forceGarbageCollection() {
        if (typeof gc !== 'undefined') {
            gc();
            this.debug.info('Forced garbage collection');
        }
    }

    alertUser(alertType) {
        this.debug.warn(`Alerting user about ${alertType}`);
        // Implementation would show user notification
    }

    /**
     * Monitor performance memory if available
     */
    monitorPerformanceMemory() {
        if (typeof performance !== 'undefined' && performance.memory) {
            setInterval(() => {
                const memory = performance.memory;
                this.debug.info('Performance memory:', {
                    used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                    total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                    limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
                });
            }, 60000); // Every minute
        }
    }

    /**
     * Monitor storage usage
     */
    async monitorStorageUsage() {
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                this.debug.info('Storage estimate:', {
                    quota: Math.round((estimate.quota || 0) / 1024 / 1024) + 'MB',
                    usage: Math.round((estimate.usage || 0) / 1024 / 1024) + 'MB',
                    available: Math.round(((estimate.quota || 0) - (estimate.usage || 0)) / 1024 / 1024) + 'MB'
                });
            } catch (error) {
                this.debug.warn('Could not get storage estimate:', error);
            }
        }
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        this.cleanupTasks.clear();
        this.alertCallbacks.clear();
        this.resourceTrackers.clear();
        
        this.debug.info('Resource constraint handler destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResourceConstraintHandler;
} else if (typeof window !== 'undefined') {
    window.ResourceConstraintHandler = ResourceConstraintHandler;
}
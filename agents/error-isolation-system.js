/**
 * Error Isolation System
 * Implements error boundaries and component isolation to prevent cascade failures
 * and contains failures within specific modules
 */
class ErrorIsolationSystem {
    constructor(options = {}) {
        this.options = {
            isolationTimeout: options.isolationTimeout || 5000, // 5 seconds
            maxErrorsPerModule: options.maxErrorsPerModule || 10,
            errorWindowMs: options.errorWindowMs || 60000, // 1 minute
            enableRecoveryLogging: options.enableRecoveryLogging !== false,
            autoIsolateOnThreshold: options.autoIsolateOnThreshold !== false,
            ...options
        };

        this.modules = new Map();
        this.errorBoundaries = new Map();
        this.isolatedModules = new Set();
        this.recoveryLog = [];
        this.stats = {
            totalErrors: 0,
            isolatedErrors: 0,
            cascadePrevented: 0,
            successfulRecoveries: 0,
            failedRecoveries: 0
        };

        // Initialize debug logger
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('ErrorIsolationSystem') : {
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        };

        this.debug.log('ErrorIsolationSystem initialized with options:', this.options);
    }

    /**
     * Register a module for error isolation
     * @param {string} moduleName - Name of the module
     * @param {Object} moduleInstance - Module instance
     * @param {Object} options - Module-specific options
     */
    registerModule(moduleName, moduleInstance, options = {}) {
        const moduleInfo = {
            name: moduleName,
            instance: moduleInstance,
            errors: [],
            isolated: false,
            isolatedAt: null,
            recoveryAttempts: 0,
            lastError: null,
            registeredAt: Date.now(),
            options: {
                critical: options.critical !== false,
                maxErrors: options.maxErrors || this.options.maxErrorsPerModule,
                recoveryFunction: options.recoveryFunction,
                isolationCallback: options.isolationCallback,
                dependencies: options.dependencies || [],
                ...options
            }
        };

        this.modules.set(moduleName, moduleInfo);
        this.debug.log(`Registered module ${moduleName} for error isolation`);
        
        return moduleInfo;
    }

    /**
     * Create an error boundary for a module
     * @param {string} moduleName - Name of the module
     * @param {Function} operation - Operation to execute within boundary
     * @param {Object} context - Additional context for error handling
     * @returns {Promise} - Promise that resolves with operation result
     */
    async createErrorBoundary(moduleName, operation, context = {}) {
        const moduleInfo = this.modules.get(moduleName);
        
        if (!moduleInfo) {
            throw new Error(`Module ${moduleName} not registered for error isolation`);
        }

        // Check if module is isolated
        if (this.isolatedModules.has(moduleName)) {
            const error = new Error(`Module ${moduleName} is currently isolated`);
            error.code = 'MODULE_ISOLATED';
            error.moduleName = moduleName;
            throw error;
        }

        const boundaryId = `${moduleName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            // Create boundary context
            const boundaryContext = {
                id: boundaryId,
                moduleName,
                startTime: Date.now(),
                context,
                isolated: false
            };

            this.errorBoundaries.set(boundaryId, boundaryContext);
            this.debug.log(`Created error boundary ${boundaryId} for module ${moduleName}`);

            // Execute operation with timeout
            const result = await this.executeWithTimeout(operation, this.options.isolationTimeout);
            
            // Clean up boundary on success
            this.errorBoundaries.delete(boundaryId);
            
            return result;

        } catch (error) {
            this.stats.totalErrors++;
            
            // Handle error within boundary
            const isolationResult = await this.handleBoundaryError(boundaryId, error, context);
            
            // Clean up boundary
            this.errorBoundaries.delete(boundaryId);
            
            if (isolationResult.isolated) {
                this.stats.isolatedErrors++;
                
                // Create isolated error
                const isolatedError = new Error(`Error isolated in module ${moduleName}: ${error.message}`);
                isolatedError.code = 'ERROR_ISOLATED';
                isolatedError.moduleName = moduleName;
                isolatedError.originalError = error;
                isolatedError.isolationResult = isolationResult;
                
                throw isolatedError;
            } else {
                // Re-throw original error if not isolated
                throw error;
            }
        }
    }

    /**
     * Handle error within a boundary
     * @param {string} boundaryId - ID of the error boundary
     * @param {Error} error - Error that occurred
     * @param {Object} context - Error context
     * @returns {Object} - Isolation result
     */
    async handleBoundaryError(boundaryId, error, context) {
        const boundary = this.errorBoundaries.get(boundaryId);
        
        if (!boundary) {
            return { isolated: false, reason: 'boundary_not_found' };
        }

        const moduleInfo = this.modules.get(boundary.moduleName);
        
        if (!moduleInfo) {
            return { isolated: false, reason: 'module_not_found' };
        }

        // Record error
        const errorRecord = {
            error,
            timestamp: Date.now(),
            boundaryId,
            context,
            stackTrace: error.stack
        };

        moduleInfo.errors.push(errorRecord);
        moduleInfo.lastError = errorRecord;

        // Clean up old errors outside the window
        const cutoffTime = Date.now() - this.options.errorWindowMs;
        moduleInfo.errors = moduleInfo.errors.filter(err => err.timestamp > cutoffTime);

        this.debug.error(`Error in module ${boundary.moduleName}:`, {
            error: error.message,
            boundaryId,
            errorCount: moduleInfo.errors.length
        });

        // Check if module should be isolated
        const shouldIsolate = this.shouldIsolateModule(boundary.moduleName, error, context);
        
        if (shouldIsolate) {
            await this.isolateModule(boundary.moduleName, error);
            boundary.isolated = true;
            
            return {
                isolated: true,
                reason: 'threshold_exceeded',
                errorCount: moduleInfo.errors.length,
                isolatedAt: Date.now()
            };
        }

        return {
            isolated: false,
            reason: 'below_threshold',
            errorCount: moduleInfo.errors.length
        };
    }

    /**
     * Determine if a module should be isolated
     * @param {string} moduleName - Name of the module
     * @param {Error} error - Current error
     * @param {Object} context - Error context
     * @returns {boolean} - True if module should be isolated
     */
    shouldIsolateModule(moduleName, error, context) {
        const moduleInfo = this.modules.get(moduleName);
        
        if (!moduleInfo || moduleInfo.isolated) {
            return false;
        }

        // Check error count threshold
        if (moduleInfo.errors.length >= moduleInfo.options.maxErrors) {
            this.debug.warn(`Module ${moduleName} exceeded error threshold: ${moduleInfo.errors.length}/${moduleInfo.options.maxErrors}`);
            return true;
        }

        // Check for critical errors
        if (this.isCriticalError(error)) {
            this.debug.warn(`Critical error in module ${moduleName}, isolating immediately`);
            return true;
        }

        // Check custom isolation conditions
        if (moduleInfo.options.isolationCondition) {
            try {
                return moduleInfo.options.isolationCondition(error, context, moduleInfo);
            } catch (conditionError) {
                this.debug.error(`Error in isolation condition for ${moduleName}:`, conditionError);
                return false;
            }
        }

        return false;
    }

    /**
     * Check if an error is critical
     * @param {Error} error - Error to check
     * @returns {boolean} - True if error is critical
     */
    isCriticalError(error) {
        const criticalPatterns = [
            /out of memory/i,
            /stack overflow/i,
            /maximum call stack/i,
            /security/i,
            /permission denied/i,
            /access denied/i
        ];

        const errorMessage = error.message || '';
        return criticalPatterns.some(pattern => pattern.test(errorMessage));
    }

    /**
     * Isolate a module to prevent cascade failures
     * @param {string} moduleName - Name of the module to isolate
     * @param {Error} triggerError - Error that triggered isolation
     * @returns {Promise<boolean>} - Success status
     */
    async isolateModule(moduleName, triggerError) {
        const moduleInfo = this.modules.get(moduleName);
        
        if (!moduleInfo) {
            this.debug.error(`Cannot isolate unknown module: ${moduleName}`);
            return false;
        }

        if (moduleInfo.isolated) {
            this.debug.warn(`Module ${moduleName} is already isolated`);
            return false;
        }

        try {
            // Mark module as isolated
            moduleInfo.isolated = true;
            moduleInfo.isolatedAt = Date.now();
            this.isolatedModules.add(moduleName);

            // Call isolation callback if provided
            if (moduleInfo.options.isolationCallback) {
                await moduleInfo.options.isolationCallback(moduleName, triggerError);
            }

            // Isolate dependent modules if they're critical
            await this.isolateDependentModules(moduleName);

            // Log isolation
            if (this.options.enableRecoveryLogging) {
                this.logRecoveryAction('module_isolated', {
                    moduleName,
                    triggerError: triggerError.message,
                    errorCount: moduleInfo.errors.length,
                    timestamp: Date.now()
                });
            }

            this.debug.error(`Isolated module ${moduleName} due to error: ${triggerError.message}`);

            // Emit isolation event
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('moduleIsolated', {
                    detail: { 
                        moduleName, 
                        triggerError: triggerError.message,
                        timestamp: Date.now()
                    }
                }));
            }

            return true;

        } catch (error) {
            this.debug.error(`Failed to isolate module ${moduleName}:`, error);
            
            // Rollback isolation state
            moduleInfo.isolated = false;
            moduleInfo.isolatedAt = null;
            this.isolatedModules.delete(moduleName);
            
            return false;
        }
    }

    /**
     * Isolate modules that depend on the failed module
     * @param {string} failedModuleName - Name of the failed module
     */
    async isolateDependentModules(failedModuleName) {
        const dependentModules = [];
        
        // Find modules that depend on the failed module
        for (const [moduleName, moduleInfo] of this.modules) {
            if (moduleInfo.options.dependencies.includes(failedModuleName)) {
                dependentModules.push(moduleName);
            }
        }

        if (dependentModules.length > 0) {
            this.debug.warn(`Found ${dependentModules.length} dependent modules for ${failedModuleName}:`, dependentModules);
            
            for (const dependentModule of dependentModules) {
                const dependentInfo = this.modules.get(dependentModule);
                
                // Only isolate critical dependent modules
                if (dependentInfo && dependentInfo.options.critical && !dependentInfo.isolated) {
                    this.debug.warn(`Isolating critical dependent module: ${dependentModule}`);
                    
                    const cascadeError = new Error(`Dependency ${failedModuleName} failed`);
                    cascadeError.code = 'DEPENDENCY_FAILURE';
                    
                    await this.isolateModule(dependentModule, cascadeError);
                    this.stats.cascadePrevented++;
                }
            }
        }
    }

    /**
     * Attempt to recover an isolated module
     * @param {string} moduleName - Name of the module to recover
     * @returns {Promise<boolean>} - Success status
     */
    async recoverModule(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        
        if (!moduleInfo) {
            this.debug.error(`Cannot recover unknown module: ${moduleName}`);
            return false;
        }

        if (!moduleInfo.isolated) {
            this.debug.warn(`Module ${moduleName} is not isolated`);
            return false;
        }

        moduleInfo.recoveryAttempts++;
        
        try {
            this.debug.log(`Attempting recovery for module ${moduleName} (attempt ${moduleInfo.recoveryAttempts})`);

            // Use custom recovery function if provided
            if (moduleInfo.options.recoveryFunction) {
                const recovered = await moduleInfo.options.recoveryFunction(moduleInfo);
                
                if (!recovered) {
                    throw new Error('Custom recovery function returned false');
                }
            } else {
                // Default recovery - reinitialize module if possible
                if (typeof moduleInfo.instance.initialize === 'function') {
                    await moduleInfo.instance.initialize();
                } else if (typeof moduleInfo.instance.reset === 'function') {
                    await moduleInfo.instance.reset();
                }
            }

            // Recovery successful
            moduleInfo.isolated = false;
            moduleInfo.isolatedAt = null;
            moduleInfo.errors = []; // Clear error history
            moduleInfo.recoveredAt = Date.now();
            this.isolatedModules.delete(moduleName);

            this.stats.successfulRecoveries++;

            // Log recovery
            if (this.options.enableRecoveryLogging) {
                this.logRecoveryAction('module_recovered', {
                    moduleName,
                    recoveryAttempts: moduleInfo.recoveryAttempts,
                    timestamp: Date.now()
                });
            }

            this.debug.log(`Successfully recovered module ${moduleName}`);

            // Emit recovery event
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('moduleRecovered', {
                    detail: { 
                        moduleName, 
                        recoveryAttempts: moduleInfo.recoveryAttempts,
                        timestamp: Date.now()
                    }
                }));
            }

            return true;

        } catch (error) {
            this.stats.failedRecoveries++;
            
            this.debug.error(`Failed to recover module ${moduleName}:`, error);

            // Log failed recovery
            if (this.options.enableRecoveryLogging) {
                this.logRecoveryAction('recovery_failed', {
                    moduleName,
                    recoveryAttempts: moduleInfo.recoveryAttempts,
                    error: error.message,
                    timestamp: Date.now()
                });
            }

            return false;
        }
    }

    /**
     * Execute operation with timeout
     * @param {Function} operation - Operation to execute
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} - Promise that resolves with operation result
     */
    async executeWithTimeout(operation, timeout) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeout}ms`));
            }, timeout);
        });

        return Promise.race([operation(), timeoutPromise]);
    }

    /**
     * Log recovery action
     * @param {string} action - Type of recovery action
     * @param {Object} details - Action details
     */
    logRecoveryAction(action, details) {
        const logEntry = {
            action,
            details,
            timestamp: Date.now()
        };

        this.recoveryLog.push(logEntry);

        // Keep only recent log entries (last 1000)
        if (this.recoveryLog.length > 1000) {
            this.recoveryLog = this.recoveryLog.slice(-1000);
        }

        this.debug.log(`Recovery action logged: ${action}`, details);
    }

    /**
     * Get module status
     * @param {string} moduleName - Name of the module
     * @returns {Object|null} - Module status or null if not found
     */
    getModuleStatus(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        
        if (!moduleInfo) {
            return null;
        }

        return {
            name: moduleName,
            isolated: moduleInfo.isolated,
            isolatedAt: moduleInfo.isolatedAt,
            recoveredAt: moduleInfo.recoveredAt,
            errorCount: moduleInfo.errors.length,
            recoveryAttempts: moduleInfo.recoveryAttempts,
            lastError: moduleInfo.lastError ? {
                message: moduleInfo.lastError.error.message,
                timestamp: moduleInfo.lastError.timestamp
            } : null,
            isCritical: moduleInfo.options.critical,
            dependencies: moduleInfo.options.dependencies
        };
    }

    /**
     * Get all module statuses
     * @returns {Array} - Array of module status objects
     */
    getAllModuleStatuses() {
        const statuses = [];
        
        for (const moduleName of this.modules.keys()) {
            const status = this.getModuleStatus(moduleName);
            if (status) {
                statuses.push(status);
            }
        }
        
        return statuses;
    }

    /**
     * Get system isolation summary
     * @returns {Object} - System isolation summary
     */
    getIsolationSummary() {
        const totalModules = this.modules.size;
        const isolatedModules = this.isolatedModules.size;
        const criticalModules = Array.from(this.modules.values())
            .filter(module => module.options.critical).length;
        const criticalIsolated = Array.from(this.modules.values())
            .filter(module => module.options.critical && module.isolated).length;

        return {
            totalModules,
            isolatedModules,
            criticalModules,
            criticalIsolated,
            systemHealth: criticalIsolated > 0 ? 'critical' : 
                         isolatedModules > 0 ? 'degraded' : 'healthy',
            stats: this.stats,
            recentRecoveryActions: this.recoveryLog.slice(-10)
        };
    }

    /**
     * Get recovery log
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} - Array of recovery log entries
     */
    getRecoveryLog(limit = 100) {
        return this.recoveryLog.slice(-limit);
    }

    /**
     * Clear recovery log
     */
    clearRecoveryLog() {
        this.recoveryLog = [];
        this.debug.log('Recovery log cleared');
    }

    /**
     * Unregister a module
     * @param {string} moduleName - Name of the module
     * @returns {boolean} - Success status
     */
    unregisterModule(moduleName) {
        const moduleInfo = this.modules.get(moduleName);
        
        if (!moduleInfo) {
            return false;
        }

        // Remove from isolated modules if present
        this.isolatedModules.delete(moduleName);

        // Remove module
        this.modules.delete(moduleName);
        
        this.debug.log(`Unregistered module ${moduleName}`);
        return true;
    }

    /**
     * Cleanup all modules and clear state
     */
    cleanup() {
        this.modules.clear();
        this.errorBoundaries.clear();
        this.isolatedModules.clear();
        this.recoveryLog = [];
        
        this.stats = {
            totalErrors: 0,
            isolatedErrors: 0,
            cascadePrevented: 0,
            successfulRecoveries: 0,
            failedRecoveries: 0

        };

        this.debug.log('ErrorIsolationSystem cleanup completed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorIsolationSystem;
} else if (typeof window !== 'undefined') {
    window.ErrorIsolationSystem = ErrorIsolationSystem;
}
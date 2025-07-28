/**
 * Component Fallback Manager
 * Provides fallback implementations for critical components and manages
 * graceful degradation when components fail
 */
class ComponentFallbackManager {
    constructor(options = {}) {
        this.options = {
            healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
            fallbackTimeout: options.fallbackTimeout || 5000, // 5 seconds
            maxFallbackAttempts: options.maxFallbackAttempts || 3,
            enableAutoFailover: options.enableAutoFailover !== false,
            ...options
        };

        this.components = new Map();
        this.fallbacks = new Map();
        this.healthChecks = new Map();
        this.stats = {
            totalComponents: 0,
            healthyComponents: 0,
            failedComponents: 0,
            fallbackActivations: 0,
            successfulFailovers: 0,
            failedFailovers: 0
        };

        // Initialize debug logger
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('ComponentFallbackManager') : {
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        };

        this.debug.log('ComponentFallbackManager initialized with options:', this.options);
    }

    /**
     * Register a component with its fallback implementation
     * @param {string} componentName - Name of the component
     * @param {Object} primaryComponent - Primary component instance
     * @param {Object} fallbackComponent - Fallback component instance
     * @param {Object} options - Component-specific options
     */
    registerComponent(componentName, primaryComponent, fallbackComponent, options = {}) {
        const componentInfo = {
            name: componentName,
            primary: primaryComponent,
            fallback: fallbackComponent,
            current: primaryComponent,
            status: 'healthy',
            usingFallback: false,
            lastHealthCheck: null,
            failureCount: 0,
            fallbackAttempts: 0,
            registeredAt: Date.now(),
            options: {
                critical: options.critical !== false,
                healthCheckFunction: options.healthCheckFunction,
                fallbackCondition: options.fallbackCondition,
                ...options
            }
        };

        this.components.set(componentName, componentInfo);
        this.stats.totalComponents++;
        this.stats.healthyComponents++;

        // Start health monitoring if enabled
        if (this.options.enableAutoFailover) {
            this.startHealthMonitoring(componentName);
        }

        this.debug.log(`Registered component ${componentName} with fallback`);
        return componentInfo;
    }

    /**
     * Get the current active component (primary or fallback)
     * @param {string} componentName - Name of the component
     * @returns {Object|null} - Current active component or null if not found
     */
    getComponent(componentName) {
        const componentInfo = this.components.get(componentName);
        
        if (!componentInfo) {
            this.debug.warn(`Component ${componentName} not found`);
            return null;
        }

        return componentInfo.current;
    }

    /**
     * Execute a method on a component with fallback support
     * @param {string} componentName - Name of the component
     * @param {string} methodName - Name of the method to execute
     * @param {Array} args - Arguments to pass to the method
     * @returns {Promise} - Promise that resolves with method result
     */
    async executeWithFallback(componentName, methodName, ...args) {
        const componentInfo = this.components.get(componentName);
        
        if (!componentInfo) {
            throw new Error(`Component ${componentName} not registered`);
        }

        try {
            // Try primary component first
            if (!componentInfo.usingFallback) {
                const result = await this.executeMethod(componentInfo.primary, methodName, args);
                
                // Reset failure count on success
                componentInfo.failureCount = 0;
                
                return result;
            } else {
                // Use fallback component
                return await this.executeMethod(componentInfo.fallback, methodName, args);
            }
        } catch (error) {
            this.debug.warn(`Method ${methodName} failed on ${componentName}:`, error.message);
            
            // Increment failure count
            componentInfo.failureCount++;
            
            // Try fallback if not already using it
            if (!componentInfo.usingFallback) {
                return await this.tryFallback(componentName, methodName, args, error);
            } else {
                // Already using fallback and it failed
                throw new Error(`Both primary and fallback failed for ${componentName}.${methodName}: ${error.message}`);
            }
        }
    }

    /**
     * Try fallback component when primary fails
     * @param {string} componentName - Name of the component
     * @param {string} methodName - Name of the method to execute
     * @param {Array} args - Arguments to pass to the method
     * @param {Error} primaryError - Error from primary component
     * @returns {Promise} - Promise that resolves with fallback result
     */
    async tryFallback(componentName, methodName, args, primaryError) {
        const componentInfo = this.components.get(componentName);
        
        if (!componentInfo || !componentInfo.fallback) {
            throw primaryError;
        }

        componentInfo.fallbackAttempts++;
        this.stats.fallbackActivations++;

        this.debug.warn(`Attempting fallback for ${componentName}.${methodName}`);

        try {
            // Check if fallback condition is met
            if (componentInfo.options.fallbackCondition) {
                const shouldUseFallback = await componentInfo.options.fallbackCondition(primaryError, componentInfo);
                if (!shouldUseFallback) {
                    throw primaryError;
                }
            }

            // Execute method on fallback component
            const result = await this.executeMethod(componentInfo.fallback, methodName, args);
            
            // Switch to fallback if successful
            if (componentInfo.fallbackAttempts <= this.options.maxFallbackAttempts) {
                await this.switchToFallback(componentName);
                this.stats.successfulFailovers++;
            }
            
            return result;
        } catch (fallbackError) {
            this.stats.failedFailovers++;
            this.debug.error(`Fallback also failed for ${componentName}.${methodName}:`, fallbackError.message);
            
            // Return original error if fallback also fails
            const combinedError = new Error(`Primary and fallback both failed for ${componentName}.${methodName}`);
            combinedError.primaryError = primaryError;
            combinedError.fallbackError = fallbackError;
            throw combinedError;
        }
    }

    /**
     * Execute a method on a component with timeout
     * @param {Object} component - Component instance
     * @param {string} methodName - Name of the method to execute
     * @param {Array} args - Arguments to pass to the method
     * @returns {Promise} - Promise that resolves with method result
     */
    async executeMethod(component, methodName, args) {
        if (!component || typeof component[methodName] !== 'function') {
            throw new Error(`Method ${methodName} not found on component`);
        }

        // Create timeout wrapper
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Method ${methodName} timed out after ${this.options.fallbackTimeout}ms`));
            }, this.options.fallbackTimeout);
        });

        // Execute method with timeout
        const methodPromise = component[methodName](...args);
        
        return Promise.race([methodPromise, timeoutPromise]);
    }

    /**
     * Switch component to use fallback implementation
     * @param {string} componentName - Name of the component
     * @returns {Promise<boolean>} - Success status
     */
    async switchToFallback(componentName) {
        const componentInfo = this.components.get(componentName);
        
        if (!componentInfo || componentInfo.usingFallback) {
            return false;
        }

        try {
            // Initialize fallback component if needed
            if (componentInfo.fallback && typeof componentInfo.fallback.initialize === 'function') {
                await componentInfo.fallback.initialize();
            }

            componentInfo.current = componentInfo.fallback;
            componentInfo.usingFallback = true;
            componentInfo.status = 'degraded';
            componentInfo.switchedToFallbackAt = Date.now();

            // Update stats
            this.stats.healthyComponents--;
            this.stats.failedComponents++;

            this.debug.warn(`Switched ${componentName} to fallback implementation`);

            // Emit event
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('componentFallbackActivated', {
                    detail: { componentName, timestamp: Date.now() }
                }));
            }

            return true;
        } catch (error) {
            this.debug.error(`Failed to switch ${componentName} to fallback:`, error);
            return false;
        }
    }

    /**
     * Switch component back to primary implementation
     * @param {string} componentName - Name of the component
     * @returns {Promise<boolean>} - Success status
     */
    async switchToPrimary(componentName) {
        const componentInfo = this.components.get(componentName);
        
        if (!componentInfo || !componentInfo.usingFallback) {
            return false;
        }

        try {
            // Test primary component health first
            const isHealthy = await this.checkComponentHealth(componentName, componentInfo.primary);
            
            if (!isHealthy) {
                this.debug.warn(`Primary component ${componentName} still unhealthy, cannot switch back`);
                return false;
            }

            componentInfo.current = componentInfo.primary;
            componentInfo.usingFallback = false;
            componentInfo.status = 'healthy';
            componentInfo.failureCount = 0;
            componentInfo.switchedToPrimaryAt = Date.now();

            // Update stats
            this.stats.healthyComponents++;
            this.stats.failedComponents--;

            this.debug.log(`Switched ${componentName} back to primary implementation`);

            // Emit event
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('componentPrimaryRestored', {
                    detail: { componentName, timestamp: Date.now() }
                }));
            }

            return true;
        } catch (error) {
            this.debug.error(`Failed to switch ${componentName} back to primary:`, error);
            return false;
        }
    }

    /**
     * Start health monitoring for a component
     * @param {string} componentName - Name of the component
     */
    startHealthMonitoring(componentName) {
        const componentInfo = this.components.get(componentName);
        
        if (!componentInfo) {
            return;
        }

        // Clear existing health check
        if (this.healthChecks.has(componentName)) {
            clearInterval(this.healthChecks.get(componentName));
        }

        // Set up periodic health check
        const healthCheckTimer = setInterval(async () => {
            await this.performHealthCheck(componentName);
        }, this.options.healthCheckInterval);

        this.healthChecks.set(componentName, healthCheckTimer);
        this.debug.log(`Started health monitoring for ${componentName}`);
    }

    /**
     * Perform health check on a component
     * @param {string} componentName - Name of the component
     */
    async performHealthCheck(componentName) {
        const componentInfo = this.components.get(componentName);
        
        if (!componentInfo) {
            return;
        }

        componentInfo.lastHealthCheck = Date.now();

        try {
            // Check primary component health
            const primaryHealthy = await this.checkComponentHealth(componentName, componentInfo.primary);
            
            if (primaryHealthy && componentInfo.usingFallback) {
                // Primary is healthy again, try to switch back
                this.debug.log(`Primary component ${componentName} is healthy again, attempting to switch back`);
                await this.switchToPrimary(componentName);
            } else if (!primaryHealthy && !componentInfo.usingFallback) {
                // Primary is unhealthy, consider switching to fallback
                if (componentInfo.failureCount >= 3) { // Threshold for automatic failover
                    this.debug.warn(`Primary component ${componentName} consistently unhealthy, switching to fallback`);
                    await this.switchToFallback(componentName);
                }
            }
        } catch (error) {
            this.debug.error(`Health check failed for ${componentName}:`, error);
        }
    }

    /**
     * Check health of a specific component
     * @param {string} componentName - Name of the component
     * @param {Object} component - Component instance to check
     * @returns {Promise<boolean>} - True if component is healthy
     */
    async checkComponentHealth(componentName, component) {
        const componentInfo = this.components.get(componentName);
        
        if (!componentInfo) {
            return false;
        }

        try {
            // Use custom health check function if provided
            if (componentInfo.options.healthCheckFunction) {
                return await componentInfo.options.healthCheckFunction(component);
            }

            // Default health check - try to call a health method or just check if component exists
            if (typeof component.healthCheck === 'function') {
                return await component.healthCheck();
            } else if (typeof component.isHealthy === 'function') {
                return await component.isHealthy();
            } else {
                // Basic check - component exists and is not null
                return component !== null && component !== undefined;
            }
        } catch (error) {
            this.debug.warn(`Health check failed for ${componentName}:`, error.message);
            return false;
        }
    }

    /**
     * Get component status
     * @param {string} componentName - Name of the component
     * @returns {Object|null} - Component status or null if not found
     */
    getComponentStatus(componentName) {
        const componentInfo = this.components.get(componentName);
        
        if (!componentInfo) {
            return null;
        }

        return {
            name: componentName,
            status: componentInfo.status,
            usingFallback: componentInfo.usingFallback,
            failureCount: componentInfo.failureCount,
            fallbackAttempts: componentInfo.fallbackAttempts,
            lastHealthCheck: componentInfo.lastHealthCheck,
            registeredAt: componentInfo.registeredAt,
            switchedToFallbackAt: componentInfo.switchedToFallbackAt,
            switchedToPrimaryAt: componentInfo.switchedToPrimaryAt,
            isCritical: componentInfo.options.critical
        };
    }

    /**
     * Get all component statuses
     * @returns {Array} - Array of component status objects
     */
    getAllComponentStatuses() {
        const statuses = [];
        
        for (const componentName of this.components.keys()) {
            const status = this.getComponentStatus(componentName);
            if (status) {
                statuses.push(status);
            }
        }
        
        return statuses;
    }

    /**
     * Get system health summary
     * @returns {Object} - System health summary
     */
    getSystemHealthSummary() {
        const components = Array.from(this.components.values());
        const criticalComponents = components.filter(comp => comp.options.critical);
        const criticalFailures = criticalComponents.filter(comp => comp.status !== 'healthy').length;
        
        let overallHealth = 'healthy';
        if (criticalFailures > 0) {
            overallHealth = 'critical';
        } else if (this.stats.failedComponents > 0) {
            overallHealth = 'degraded';
        }

        return {
            overallHealth,
            totalComponents: this.stats.totalComponents,
            healthyComponents: this.stats.healthyComponents,
            failedComponents: this.stats.failedComponents,
            criticalComponents: criticalComponents.length,
            criticalFailures,
            fallbackActivations: this.stats.fallbackActivations,
            successfulFailovers: this.stats.successfulFailovers,
            failedFailovers: this.stats.failedFailovers
        };
    }

    /**
     * Force failover for a component
     * @param {string} componentName - Name of the component
     * @returns {Promise<boolean>} - Success status
     */
    async forceFailover(componentName) {
        const componentInfo = this.components.get(componentName);
        
        if (!componentInfo) {
            this.debug.error(`Cannot force failover: component ${componentName} not found`);
            return false;
        }

        if (componentInfo.usingFallback) {
            this.debug.warn(`Component ${componentName} already using fallback`);
            return false;
        }

        this.debug.log(`Forcing failover for component ${componentName}`);
        return await this.switchToFallback(componentName);
    }

    /**
     * Stop health monitoring for a component
     * @param {string} componentName - Name of the component
     */
    stopHealthMonitoring(componentName) {
        if (this.healthChecks.has(componentName)) {
            clearInterval(this.healthChecks.get(componentName));
            this.healthChecks.delete(componentName);
            this.debug.log(`Stopped health monitoring for ${componentName}`);
        }
    }

    /**
     * Unregister a component
     * @param {string} componentName - Name of the component
     * @returns {boolean} - Success status
     */
    unregisterComponent(componentName) {
        const componentInfo = this.components.get(componentName);
        
        if (!componentInfo) {
            return false;
        }

        // Stop health monitoring
        this.stopHealthMonitoring(componentName);

        // Update stats
        this.stats.totalComponents--;
        if (componentInfo.status === 'healthy') {
            this.stats.healthyComponents--;
        } else {
            this.stats.failedComponents--;
        }

        // Remove component
        this.components.delete(componentName);
        
        this.debug.log(`Unregistered component ${componentName}`);
        return true;
    }

    /**
     * Cleanup all components and stop monitoring
     */
    cleanup() {
        // Stop all health checks
        for (const timer of this.healthChecks.values()) {
            clearInterval(timer);
        }
        this.healthChecks.clear();

        // Clear components
        this.components.clear();

        // Reset stats
        this.stats = {
            totalComponents: 0,
            healthyComponents: 0,
            failedComponents: 0,
            fallbackActivations: 0,
            successfulFailovers: 0,
            failedFailovers: 0
        };

        this.debug.log('ComponentFallbackManager cleanup completed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComponentFallbackManager;
} else if (typeof window !== 'undefined') {
    window.ComponentFallbackManager = ComponentFallbackManager;
}
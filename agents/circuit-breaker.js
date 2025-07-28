/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures by monitoring service health and failing fast
 * when external services are unavailable
 */
class CircuitBreaker {
    constructor(options = {}) {
        this.options = {
            failureThreshold: options.failureThreshold || 5, // Number of failures before opening
            recoveryTimeout: options.recoveryTimeout || 60000, // Time to wait before trying again (ms)
            monitoringPeriod: options.monitoringPeriod || 10000, // Period to monitor failures (ms)
            successThreshold: options.successThreshold || 2, // Successes needed to close circuit
            ...options
        };

        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            totalFailures: 0,
            totalSuccesses: 0,
            circuitOpenings: 0,
            circuitClosings: 0
        };

        // Initialize debug logger
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('CircuitBreaker') : {
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        };

        this.debug.log('CircuitBreaker initialized with options:', this.options);
    }

    /**
     * Execute a function with circuit breaker protection
     * @param {Function} operation - Async function to execute
     * @param {string} operationName - Name for logging purposes
     * @returns {Promise} - Promise that resolves with operation result
     */
    async execute(operation, operationName = 'operation') {
        this.stats.totalRequests++;

        // Check circuit state
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttemptTime) {
                const error = new Error(`Circuit breaker is OPEN for ${operationName}`);
                error.code = 'CIRCUIT_BREAKER_OPEN';
                error.nextAttemptTime = this.nextAttemptTime;
                throw error;
            } else {
                // Time to try half-open
                this.state = 'HALF_OPEN';
                this.debug.log(`Circuit breaker transitioning to HALF_OPEN for ${operationName}`);
            }
        }

        try {
            const result = await operation();
            this.onSuccess(operationName);
            return result;
        } catch (error) {
            this.onFailure(error, operationName);
            throw error;
        }
    }

    /**
     * Handle successful operation
     * @param {string} operationName - Name of the operation
     */
    onSuccess(operationName) {
        this.stats.totalSuccesses++;
        this.failureCount = 0;
        this.lastFailureTime = null;

        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            
            if (this.successCount >= this.options.successThreshold) {
                this.closeCircuit(operationName);
            }
        }

        this.debug.log(`Circuit breaker success for ${operationName}, state: ${this.state}`);
    }

    /**
     * Handle failed operation
     * @param {Error} error - The error that occurred
     * @param {string} operationName - Name of the operation
     */
    onFailure(error, operationName) {
        this.stats.totalFailures++;
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF_OPEN') {
            // Failed during half-open, go back to open
            this.openCircuit(operationName);
        } else if (this.state === 'CLOSED' && this.failureCount >= this.options.failureThreshold) {
            // Too many failures, open the circuit
            this.openCircuit(operationName);
        }

        this.debug.warn(`Circuit breaker failure for ${operationName}:`, {
            error: error.message,
            failureCount: this.failureCount,
            state: this.state
        });
    }

    /**
     * Open the circuit breaker
     * @param {string} operationName - Name of the operation
     */
    openCircuit(operationName) {
        this.state = 'OPEN';
        this.nextAttemptTime = Date.now() + this.options.recoveryTimeout;
        this.successCount = 0;
        this.stats.circuitOpenings++;

        this.debug.error(`Circuit breaker OPENED for ${operationName}`, {
            failureCount: this.failureCount,
            nextAttemptTime: new Date(this.nextAttemptTime).toISOString()
        });

        // Emit event if possible
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('circuitBreakerOpened', {
                detail: { operationName, nextAttemptTime: this.nextAttemptTime }
            }));
        }
    }

    /**
     * Close the circuit breaker
     * @param {string} operationName - Name of the operation
     */
    closeCircuit(operationName) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttemptTime = null;
        this.stats.circuitClosings++;

        this.debug.log(`Circuit breaker CLOSED for ${operationName}`);

        // Emit event if possible
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('circuitBreakerClosed', {
                detail: { operationName }
            }));
        }
    }

    /**
     * Get current circuit breaker state
     * @returns {Object} - Current state information
     */
    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            nextAttemptTime: this.nextAttemptTime,
            isOpen: this.state === 'OPEN',
            isHalfOpen: this.state === 'HALF_OPEN',
            isClosed: this.state === 'CLOSED'
        };
    }

    /**
     * Get circuit breaker statistics
     * @returns {Object} - Statistics object
     */
    getStats() {
        const uptime = this.stats.totalRequests > 0 ? 
            ((this.stats.totalSuccesses / this.stats.totalRequests) * 100).toFixed(2) : 0;

        return {
            ...this.stats,
            uptime: `${uptime}%`,
            currentState: this.state,
            failureRate: this.stats.totalRequests > 0 ? 
                ((this.stats.totalFailures / this.stats.totalRequests) * 100).toFixed(2) : 0
        };
    }

    /**
     * Reset circuit breaker to initial state
     */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;

        this.debug.log('Circuit breaker reset to initial state');
    }

    /**
     * Force open the circuit breaker
     * @param {number} duration - Duration to keep circuit open (ms)
     */
    forceOpen(duration = null) {
        this.state = 'OPEN';
        this.nextAttemptTime = Date.now() + (duration || this.options.recoveryTimeout);
        this.successCount = 0;

        this.debug.warn('Circuit breaker force opened', {
            duration: duration || this.options.recoveryTimeout,
            nextAttemptTime: new Date(this.nextAttemptTime).toISOString()
        });
    }

    /**
     * Force close the circuit breaker
     */
    forceClose() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttemptTime = null;

        this.debug.log('Circuit breaker force closed');
    }

    /**
     * Check if circuit breaker allows requests
     * @returns {boolean} - True if requests are allowed
     */
    allowsRequests() {
        if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
            return true;
        }

        if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
            return true;
        }

        return false;
    }

    /**
     * Get time until next attempt is allowed
     * @returns {number} - Milliseconds until next attempt, or 0 if allowed now
     */
    getTimeUntilNextAttempt() {
        if (this.state !== 'OPEN' || !this.nextAttemptTime) {
            return 0;
        }

        const timeLeft = this.nextAttemptTime - Date.now();
        return Math.max(0, timeLeft);
    }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
class CircuitBreakerManager {
    constructor() {
        this.breakers = new Map();
        this.defaultOptions = {
            failureThreshold: 5,
            recoveryTimeout: 60000,
            monitoringPeriod: 10000,
            successThreshold: 2
        };

        this.debug = window.debugManager ? window.debugManager.createModuleLogger('CircuitBreakerManager') : {
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        };
    }

    /**
     * Get or create a circuit breaker for a service
     * @param {string} serviceName - Name of the service
     * @param {Object} options - Circuit breaker options
     * @returns {CircuitBreaker} - Circuit breaker instance
     */
    getBreaker(serviceName, options = {}) {
        if (!this.breakers.has(serviceName)) {
            const breakerOptions = { ...this.defaultOptions, ...options };
            const breaker = new CircuitBreaker(breakerOptions);
            this.breakers.set(serviceName, breaker);
            
            this.debug.log(`Created circuit breaker for service: ${serviceName}`);
        }

        return this.breakers.get(serviceName);
    }

    /**
     * Execute operation with circuit breaker protection
     * @param {string} serviceName - Name of the service
     * @param {Function} operation - Operation to execute
     * @param {Object} options - Circuit breaker options
     * @returns {Promise} - Promise that resolves with operation result
     */
    async execute(serviceName, operation, options = {}) {
        const breaker = this.getBreaker(serviceName, options);
        return breaker.execute(operation, serviceName);
    }

    /**
     * Get all circuit breaker states
     * @returns {Object} - Map of service names to their states
     */
    getAllStates() {
        const states = {};
        
        for (const [serviceName, breaker] of this.breakers) {
            states[serviceName] = breaker.getState();
        }

        return states;
    }

    /**
     * Get all circuit breaker statistics
     * @returns {Object} - Map of service names to their statistics
     */
    getAllStats() {
        const stats = {};
        
        for (const [serviceName, breaker] of this.breakers) {
            stats[serviceName] = breaker.getStats();
        }

        return stats;
    }

    /**
     * Reset all circuit breakers
     */
    resetAll() {
        for (const [serviceName, breaker] of this.breakers) {
            breaker.reset();
            this.debug.log(`Reset circuit breaker for ${serviceName}`);
        }
    }

    /**
     * Remove a circuit breaker
     * @param {string} serviceName - Name of the service
     * @returns {boolean} - True if breaker was removed
     */
    removeBreaker(serviceName) {
        const removed = this.breakers.delete(serviceName);
        if (removed) {
            this.debug.log(`Removed circuit breaker for ${serviceName}`);
        }
        return removed;
    }

    /**
     * Get health summary of all services
     * @returns {Object} - Health summary
     */
    getHealthSummary() {
        const summary = {
            totalServices: this.breakers.size,
            healthyServices: 0,
            degradedServices: 0,
            failedServices: 0,
            services: {}
        };

        for (const [serviceName, breaker] of this.breakers) {
            const state = breaker.getState();
            const stats = breaker.getStats();
            
            let healthStatus = 'healthy';
            if (state.state === 'OPEN') {
                healthStatus = 'failed';
                summary.failedServices++;
            } else if (state.state === 'HALF_OPEN') {
                healthStatus = 'degraded';
                summary.degradedServices++;
            } else {
                summary.healthyServices++;
            }

            summary.services[serviceName] = {
                status: healthStatus,
                state: state.state,
                uptime: stats.uptime,
                failureRate: stats.failureRate
            };
        }

        return summary;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CircuitBreaker, CircuitBreakerManager };
} else if (typeof window !== 'undefined') {
    window.CircuitBreaker = CircuitBreaker;
    window.CircuitBreakerManager = CircuitBreakerManager;
}
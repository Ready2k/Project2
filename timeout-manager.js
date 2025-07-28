/**
 * Timeout Manager
 * Centralized management of timeouts for async operations
 * Prevents stuck operations and provides automatic cleanup
 */
class TimeoutManager {
    constructor() {
        this.timeouts = new Map();
        this.timeoutCounter = 0;
        this.stats = {
            created: 0,
            completed: 0,
            timedOut: 0,
            cancelled: 0
        };
        
        // Initialize debug logger
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('TimeoutManager') : {
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        };
        
        this.debug.log('TimeoutManager initialized');
    }

    /**
     * Create a timeout for an operation
     * @param {Function} operation - The operation to execute
     * @param {number} timeoutMs - Timeout in milliseconds
     * @param {string} operationType - Type of operation for logging
     * @param {Function} onTimeout - Optional callback when timeout occurs
     * @returns {Promise} - Promise that resolves/rejects based on operation or timeout
     */
    createTimeout(operation, timeoutMs, operationType = 'unknown', onTimeout = null) {
        const timeoutId = `timeout_${++this.timeoutCounter}`;
        
        return new Promise((resolve, reject) => {
            const timeoutInfo = {
                id: timeoutId,
                operationType,
                createdAt: Date.now(),
                timeoutMs,
                resolve,
                reject,
                onTimeout,
                completed: false,
                timedOut: false
            };

            // Create the actual timeout
            const timer = setTimeout(() => {
                this.handleTimeout(timeoutId);
            }, timeoutMs);

            timeoutInfo.timer = timer;
            this.timeouts.set(timeoutId, timeoutInfo);
            this.stats.created++;

            this.debug.log(`Created timeout ${timeoutId} for ${operationType} (${timeoutMs}ms)`);

            // Execute the operation
            try {
                const result = operation();
                
                // Handle promise-based operations
                if (result && typeof result.then === 'function') {
                    result
                        .then(value => this.completeTimeout(timeoutId, value))
                        .catch(error => this.failTimeout(timeoutId, error));
                } else {
                    // Handle synchronous operations
                    this.completeTimeout(timeoutId, result);
                }
            } catch (error) {
                this.failTimeout(timeoutId, error);
            }
        });
    }

    /**
     * Create a timeout for WebSocket connections
     * @param {Function} connectOperation - Function that returns WebSocket connection promise
     * @param {number} timeoutMs - Connection timeout in milliseconds
     * @returns {Promise} - Promise that resolves with connection or rejects on timeout
     */
    createWebSocketTimeout(connectOperation, timeoutMs = 10000) {
        return this.createTimeout(
            connectOperation,
            timeoutMs,
            'websocket_connection',
            () => {
                this.debug.warn('WebSocket connection timed out');
            }
        );
    }

    /**
     * Create a timeout for audio processing operations
     * @param {Function} audioOperation - Function that performs audio processing
     * @param {number} timeoutMs - Processing timeout in milliseconds
     * @returns {Promise} - Promise that resolves with result or rejects on timeout
     */
    createAudioProcessingTimeout(audioOperation, timeoutMs = 5000) {
        return this.createTimeout(
            audioOperation,
            timeoutMs,
            'audio_processing',
            () => {
                this.debug.warn('Audio processing operation timed out');
            }
        );
    }

    /**
     * Create a timeout for API calls
     * @param {Function} apiOperation - Function that makes API call
     * @param {number} timeoutMs - API timeout in milliseconds
     * @returns {Promise} - Promise that resolves with response or rejects on timeout
     */
    createApiTimeout(apiOperation, timeoutMs = 30000) {
        return this.createTimeout(
            apiOperation,
            timeoutMs,
            'api_call',
            () => {
                this.debug.warn('API call timed out');
            }
        );
    }

    /**
     * Handle timeout occurrence
     * @param {string} timeoutId - ID of the timeout that occurred
     */
    handleTimeout(timeoutId) {
        const timeoutInfo = this.timeouts.get(timeoutId);
        
        if (!timeoutInfo || timeoutInfo.completed || timeoutInfo.timedOut) {
            return;
        }

        timeoutInfo.timedOut = true;
        timeoutInfo.timedOutAt = Date.now();
        this.stats.timedOut++;

        this.debug.warn(`Timeout occurred for ${timeoutInfo.operationType} (${timeoutId}) after ${timeoutInfo.timeoutMs}ms`);

        // Call custom timeout handler if provided
        if (timeoutInfo.onTimeout) {
            try {
                timeoutInfo.onTimeout();
            } catch (error) {
                this.debug.error(`Error in timeout handler for ${timeoutId}:`, error);
            }
        }

        // Reject the promise
        const timeoutError = new Error(`Operation timed out after ${timeoutInfo.timeoutMs}ms`);
        timeoutError.code = 'TIMEOUT_ERROR';
        timeoutError.operationType = timeoutInfo.operationType;
        timeoutError.timeoutId = timeoutId;
        
        timeoutInfo.reject(timeoutError);
    }

    /**
     * Complete a timeout successfully
     * @param {string} timeoutId - ID of the timeout to complete
     * @param {any} result - Result to resolve with
     */
    completeTimeout(timeoutId, result) {
        const timeoutInfo = this.timeouts.get(timeoutId);
        
        if (!timeoutInfo || timeoutInfo.completed || timeoutInfo.timedOut) {
            return;
        }

        timeoutInfo.completed = true;
        timeoutInfo.completedAt = Date.now();
        this.stats.completed++;

        // Clear the timer
        clearTimeout(timeoutInfo.timer);

        const duration = timeoutInfo.completedAt - timeoutInfo.createdAt;
        this.debug.log(`Completed ${timeoutInfo.operationType} (${timeoutId}) in ${duration}ms`);

        // Resolve the promise
        timeoutInfo.resolve(result);
    }

    /**
     * Fail a timeout with an error
     * @param {string} timeoutId - ID of the timeout to fail
     * @param {Error} error - Error to reject with
     */
    failTimeout(timeoutId, error) {
        const timeoutInfo = this.timeouts.get(timeoutId);
        
        if (!timeoutInfo || timeoutInfo.completed || timeoutInfo.timedOut) {
            return;
        }

        timeoutInfo.completed = true;
        timeoutInfo.failedAt = Date.now();

        // Clear the timer
        clearTimeout(timeoutInfo.timer);

        const duration = timeoutInfo.failedAt - timeoutInfo.createdAt;
        this.debug.warn(`Failed ${timeoutInfo.operationType} (${timeoutId}) after ${duration}ms:`, error.message);

        // Reject the promise
        timeoutInfo.reject(error);
    }

    /**
     * Cancel a specific timeout
     * @param {string} timeoutId - ID of timeout to cancel
     * @returns {boolean} - Success status
     */
    cancelTimeout(timeoutId) {
        const timeoutInfo = this.timeouts.get(timeoutId);
        
        if (!timeoutInfo) {
            this.debug.warn(`Timeout not found: ${timeoutId}`);
            return false;
        }

        if (timeoutInfo.completed || timeoutInfo.timedOut) {
            this.debug.warn(`Timeout already completed: ${timeoutId}`);
            return false;
        }

        // Clear the timer
        clearTimeout(timeoutInfo.timer);
        
        // Mark as cancelled
        timeoutInfo.cancelled = true;
        timeoutInfo.cancelledAt = Date.now();
        this.stats.cancelled++;

        this.debug.log(`Cancelled timeout ${timeoutId} (${timeoutInfo.operationType})`);

        // Reject with cancellation error
        const cancelError = new Error('Operation was cancelled');
        cancelError.code = 'CANCELLED_ERROR';
        cancelError.operationType = timeoutInfo.operationType;
        cancelError.timeoutId = timeoutId;
        
        timeoutInfo.reject(cancelError);
        
        return true;
    }

    /**
     * Cancel all active timeouts
     * @returns {number} - Number of timeouts cancelled
     */
    cancelAllTimeouts() {
        let cancelled = 0;
        
        for (const [timeoutId, timeoutInfo] of this.timeouts) {
            if (!timeoutInfo.completed && !timeoutInfo.timedOut && !timeoutInfo.cancelled) {
                clearTimeout(timeoutInfo.timer);
                
                timeoutInfo.cancelled = true;
                timeoutInfo.cancelledAt = Date.now();
                this.stats.cancelled++;
                cancelled++;

                // Reject with cancellation error
                const cancelError = new Error('Operation was cancelled during cleanup');
                cancelError.code = 'CLEANUP_CANCELLED_ERROR';
                cancelError.operationType = timeoutInfo.operationType;
                cancelError.timeoutId = timeoutId;
                
                timeoutInfo.reject(cancelError);
            }
        }

        if (cancelled > 0) {
            this.debug.log(`Cancelled ${cancelled} active timeouts during cleanup`);
        }

        return cancelled;
    }

    /**
     * Clear all timeouts (emergency cleanup)
     * @returns {number} - Number of timeouts cleared
     */
    clearAllTimeouts() {
        let cleared = 0;
        
        for (const [timeoutId, timeoutInfo] of this.timeouts) {
            if (timeoutInfo.timer) {
                clearTimeout(timeoutInfo.timer);
                cleared++;
            }
        }

        // Clear the map
        this.timeouts.clear();

        if (cleared > 0) {
            this.debug.log(`Emergency cleared ${cleared} timeouts`);
        }

        return cleared;
    }

    /**
     * Get active timeout count
     * @returns {number} - Number of active timeouts
     */
    getActiveTimeoutCount() {
        let active = 0;
        
        for (const timeoutInfo of this.timeouts.values()) {
            if (!timeoutInfo.completed && !timeoutInfo.timedOut && !timeoutInfo.cancelled) {
                active++;
            }
        }
        
        return active;
    }

    /**
     * Get timeout statistics
     * @returns {Object} - Timeout statistics
     */
    getStats() {
        return {
            ...this.stats,
            active: this.getActiveTimeoutCount(),
            total: this.timeouts.size
        };
    }

    /**
     * Get active timeouts by type
     * @param {string} operationType - Type to filter by
     * @returns {Array} - Array of active timeout info
     */
    getActiveTimeoutsByType(operationType) {
        const activeTimeouts = [];
        
        for (const [timeoutId, timeoutInfo] of this.timeouts) {
            if (timeoutInfo.operationType === operationType && 
                !timeoutInfo.completed && 
                !timeoutInfo.timedOut && 
                !timeoutInfo.cancelled) {
                activeTimeouts.push({
                    id: timeoutId,
                    operationType: timeoutInfo.operationType,
                    createdAt: timeoutInfo.createdAt,
                    timeoutMs: timeoutInfo.timeoutMs,
                    age: Date.now() - timeoutInfo.createdAt
                });
            }
        }
        
        return activeTimeouts;
    }

    /**
     * Clean up completed timeouts from memory
     * @returns {number} - Number of timeouts cleaned up
     */
    cleanupCompletedTimeouts() {
        let cleaned = 0;
        
        for (const [timeoutId, timeoutInfo] of this.timeouts) {
            if (timeoutInfo.completed || timeoutInfo.timedOut || timeoutInfo.cancelled) {
                this.timeouts.delete(timeoutId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.debug.log(`Cleaned up ${cleaned} completed timeouts from memory`);
        }

        return cleaned;
    }

    /**
     * Create a timeout wrapper for promises
     * @param {Promise} promise - Promise to wrap with timeout
     * @param {number} timeoutMs - Timeout in milliseconds
     * @param {string} operationType - Type of operation
     * @returns {Promise} - Promise that rejects on timeout
     */
    wrapPromiseWithTimeout(promise, timeoutMs, operationType = 'promise') {
        return this.createTimeout(
            () => promise,
            timeoutMs,
            operationType
        );
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeoutManager;
} else if (typeof window !== 'undefined') {
    window.TimeoutManager = TimeoutManager;
}
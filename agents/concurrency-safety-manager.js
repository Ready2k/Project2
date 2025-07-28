/**
 * Concurrency Safety Manager - Handles thread-safe operations and prevents race conditions
 * Implements proper locking mechanisms and concurrent operation validation
 */

class ConcurrencySafetyManager {
    constructor(options = {}) {
        this.debug = options.debug || console;
        this.locks = new Map(); // Resource locks
        this.semaphores = new Map(); // Counting semaphores
        this.mutexes = new Map(); // Mutual exclusion locks
        this.operationQueues = new Map(); // Operation queues for serialization
        this.activeOperations = new Map(); // Track active operations
        this.operationTimeouts = new Map(); // Operation timeouts
        this.maxConcurrentOperations = options.maxConcurrentOperations || 10;
        this.defaultTimeout = options.defaultTimeout || 30000; // 30 seconds
        this.lockTimeout = options.lockTimeout || 5000; // 5 seconds
        
        this.setupCleanupInterval();
    }

    /**
     * Setup cleanup interval for expired locks and operations
     */
    setupCleanupInterval() {
        setInterval(() => {
            this.cleanupExpiredLocks();
            this.cleanupExpiredOperations();
        }, 10000); // Every 10 seconds
    }

    /**
     * Acquire a lock for a resource
     */
    async acquireLock(resourceId, timeout = this.lockTimeout) {
        const lockId = this.generateLockId();
        
        return new Promise((resolve, reject) => {
            const attemptLock = () => {
                if (!this.locks.has(resourceId)) {
                    // Resource is available, acquire lock
                    this.locks.set(resourceId, {
                        id: lockId,
                        acquiredAt: Date.now(),
                        timeout: timeout,
                        resourceId: resourceId
                    });
                    
                    this.debug.info(`Lock acquired for resource ${resourceId} with ID ${lockId}`);
                    resolve(lockId);
                } else {
                    // Resource is locked, check if lock has expired
                    const existingLock = this.locks.get(resourceId);
                    if (Date.now() - existingLock.acquiredAt > existingLock.timeout) {
                        this.debug.warn(`Expired lock detected for resource ${resourceId}, releasing`);
                        this.releaseLock(resourceId, existingLock.id);
                        attemptLock(); // Try again
                    } else {
                        // Wait and retry
                        setTimeout(attemptLock, 100);
                    }
                }
            };

            // Set timeout for lock acquisition
            const timeoutId = setTimeout(() => {
                reject(new Error(`Failed to acquire lock for resource ${resourceId} within ${timeout}ms`));
            }, timeout);

            attemptLock();
            
            // Clear timeout if lock is acquired
            const originalResolve = resolve;
            resolve = (value) => {
                clearTimeout(timeoutId);
                originalResolve(value);
            };
        });
    }

    /**
     * Release a lock for a resource
     */
    releaseLock(resourceId, lockId) {
        const lock = this.locks.get(resourceId);
        
        if (!lock) {
            this.debug.warn(`Attempted to release non-existent lock for resource ${resourceId}`);
            return false;
        }
        
        if (lock.id !== lockId) {
            this.debug.error(`Lock ID mismatch for resource ${resourceId}. Expected ${lock.id}, got ${lockId}`);
            return false;
        }
        
        this.locks.delete(resourceId);
        this.debug.info(`Lock released for resource ${resourceId} with ID ${lockId}`);
        return true;
    }

    /**
     * Execute operation with exclusive lock
     */
    async withLock(resourceId, operation, timeout = this.lockTimeout) {
        const lockId = await this.acquireLock(resourceId, timeout);
        
        try {
            const result = await operation();
            return result;
        } finally {
            this.releaseLock(resourceId, lockId);
        }
    }

    /**
     * Create a mutex for mutual exclusion
     */
    createMutex(mutexId) {
        if (this.mutexes.has(mutexId)) {
            this.debug.warn(`Mutex ${mutexId} already exists`);
            return this.mutexes.get(mutexId);
        }

        const mutex = {
            id: mutexId,
            locked: false,
            queue: [],
            lockHolder: null,
            createdAt: Date.now()
        };

        this.mutexes.set(mutexId, mutex);
        this.debug.info(`Mutex ${mutexId} created`);
        return mutex;
    }

    /**
     * Acquire mutex lock
     */
    async acquireMutex(mutexId, timeout = this.lockTimeout) {
        let mutex = this.mutexes.get(mutexId);
        if (!mutex) {
            mutex = this.createMutex(mutexId);
        }

        return new Promise((resolve, reject) => {
            const operationId = this.generateOperationId();
            
            const tryAcquire = () => {
                if (!mutex.locked) {
                    mutex.locked = true;
                    mutex.lockHolder = operationId;
                    this.debug.info(`Mutex ${mutexId} acquired by operation ${operationId}`);
                    resolve(operationId);
                } else {
                    // Add to queue
                    mutex.queue.push({ operationId, resolve, reject, timestamp: Date.now() });
                }
            };

            // Set timeout
            setTimeout(() => {
                // Remove from queue if still waiting
                const index = mutex.queue.findIndex(item => item.operationId === operationId);
                if (index !== -1) {
                    mutex.queue.splice(index, 1);
                    reject(new Error(`Failed to acquire mutex ${mutexId} within ${timeout}ms`));
                }
            }, timeout);

            tryAcquire();
        });
    }

    /**
     * Release mutex lock
     */
    releaseMutex(mutexId, operationId) {
        const mutex = this.mutexes.get(mutexId);
        
        if (!mutex) {
            this.debug.warn(`Attempted to release non-existent mutex ${mutexId}`);
            return false;
        }
        
        if (mutex.lockHolder !== operationId) {
            this.debug.error(`Mutex ${mutexId} not held by operation ${operationId}`);
            return false;
        }
        
        mutex.locked = false;
        mutex.lockHolder = null;
        
        // Process queue
        if (mutex.queue.length > 0) {
            const next = mutex.queue.shift();
            mutex.locked = true;
            mutex.lockHolder = next.operationId;
            this.debug.info(`Mutex ${mutexId} transferred to operation ${next.operationId}`);
            next.resolve(next.operationId);
        }
        
        this.debug.info(`Mutex ${mutexId} released by operation ${operationId}`);
        return true;
    }

    /**
     * Execute operation with mutex
     */
    async withMutex(mutexId, operation, timeout = this.lockTimeout) {
        const operationId = await this.acquireMutex(mutexId, timeout);
        
        try {
            const result = await operation();
            return result;
        } finally {
            this.releaseMutex(mutexId, operationId);
        }
    }

    /**
     * Create a semaphore for counting resources
     */
    createSemaphore(semaphoreId, maxCount = 1) {
        if (this.semaphores.has(semaphoreId)) {
            this.debug.warn(`Semaphore ${semaphoreId} already exists`);
            return this.semaphores.get(semaphoreId);
        }

        const semaphore = {
            id: semaphoreId,
            maxCount: maxCount,
            currentCount: maxCount,
            queue: [],
            holders: new Set(),
            createdAt: Date.now()
        };

        this.semaphores.set(semaphoreId, semaphore);
        this.debug.info(`Semaphore ${semaphoreId} created with max count ${maxCount}`);
        return semaphore;
    }

    /**
     * Acquire semaphore
     */
    async acquireSemaphore(semaphoreId, timeout = this.lockTimeout) {
        let semaphore = this.semaphores.get(semaphoreId);
        if (!semaphore) {
            semaphore = this.createSemaphore(semaphoreId);
        }

        return new Promise((resolve, reject) => {
            const operationId = this.generateOperationId();
            
            const tryAcquire = () => {
                if (semaphore.currentCount > 0) {
                    semaphore.currentCount--;
                    semaphore.holders.add(operationId);
                    this.debug.info(`Semaphore ${semaphoreId} acquired by operation ${operationId} (${semaphore.currentCount}/${semaphore.maxCount} remaining)`);
                    resolve(operationId);
                } else {
                    // Add to queue
                    semaphore.queue.push({ operationId, resolve, reject, timestamp: Date.now() });
                }
            };

            // Set timeout
            setTimeout(() => {
                // Remove from queue if still waiting
                const index = semaphore.queue.findIndex(item => item.operationId === operationId);
                if (index !== -1) {
                    semaphore.queue.splice(index, 1);
                    reject(new Error(`Failed to acquire semaphore ${semaphoreId} within ${timeout}ms`));
                }
            }, timeout);

            tryAcquire();
        });
    }

    /**
     * Release semaphore
     */
    releaseSemaphore(semaphoreId, operationId) {
        const semaphore = this.semaphores.get(semaphoreId);
        
        if (!semaphore) {
            this.debug.warn(`Attempted to release non-existent semaphore ${semaphoreId}`);
            return false;
        }
        
        if (!semaphore.holders.has(operationId)) {
            this.debug.error(`Semaphore ${semaphoreId} not held by operation ${operationId}`);
            return false;
        }
        
        semaphore.holders.delete(operationId);
        semaphore.currentCount++;
        
        // Process queue
        if (semaphore.queue.length > 0 && semaphore.currentCount > 0) {
            const next = semaphore.queue.shift();
            semaphore.currentCount--;
            semaphore.holders.add(next.operationId);
            this.debug.info(`Semaphore ${semaphoreId} transferred to operation ${next.operationId}`);
            next.resolve(next.operationId);
        }
        
        this.debug.info(`Semaphore ${semaphoreId} released by operation ${operationId} (${semaphore.currentCount}/${semaphore.maxCount} available)`);
        return true;
    }

    /**
     * Execute operation with semaphore
     */
    async withSemaphore(semaphoreId, operation, maxCount = 1, timeout = this.lockTimeout) {
        // Ensure semaphore exists
        if (!this.semaphores.has(semaphoreId)) {
            this.createSemaphore(semaphoreId, maxCount);
        }
        
        const operationId = await this.acquireSemaphore(semaphoreId, timeout);
        
        try {
            const result = await operation();
            return result;
        } finally {
            this.releaseSemaphore(semaphoreId, operationId);
        }
    }

    /**
     * Queue operation for serialized execution
     */
    async queueOperation(queueId, operation, priority = 0) {
        if (!this.operationQueues.has(queueId)) {
            this.operationQueues.set(queueId, {
                id: queueId,
                queue: [],
                processing: false,
                createdAt: Date.now()
            });
        }

        const queue = this.operationQueues.get(queueId);
        const operationId = this.generateOperationId();

        return new Promise((resolve, reject) => {
            const queueItem = {
                id: operationId,
                operation,
                resolve,
                reject,
                priority,
                queuedAt: Date.now()
            };

            // Insert based on priority (higher priority first)
            let inserted = false;
            for (let i = 0; i < queue.queue.length; i++) {
                if (queue.queue[i].priority < priority) {
                    queue.queue.splice(i, 0, queueItem);
                    inserted = true;
                    break;
                }
            }
            
            if (!inserted) {
                queue.queue.push(queueItem);
            }

            this.debug.info(`Operation ${operationId} queued in ${queueId} with priority ${priority}`);
            this.processQueue(queueId);
        });
    }

    /**
     * Process operation queue
     */
    async processQueue(queueId) {
        const queue = this.operationQueues.get(queueId);
        if (!queue || queue.processing || queue.queue.length === 0) {
            return;
        }

        queue.processing = true;

        while (queue.queue.length > 0) {
            const item = queue.queue.shift();
            
            try {
                this.debug.info(`Processing operation ${item.id} from queue ${queueId}`);
                const result = await item.operation();
                item.resolve(result);
            } catch (error) {
                this.debug.error(`Operation ${item.id} failed in queue ${queueId}:`, error);
                item.reject(error);
            }
        }

        queue.processing = false;
    }

    /**
     * Track concurrent operations
     */
    async trackConcurrentOperation(operationId, operation, timeout = this.defaultTimeout) {
        if (this.activeOperations.size >= this.maxConcurrentOperations) {
            throw new Error(`Maximum concurrent operations (${this.maxConcurrentOperations}) exceeded`);
        }

        const operationInfo = {
            id: operationId,
            startTime: Date.now(),
            timeout: timeout
        };

        this.activeOperations.set(operationId, operationInfo);
        
        // Set timeout
        const timeoutId = setTimeout(() => {
            this.debug.warn(`Operation ${operationId} timed out after ${timeout}ms`);
            this.activeOperations.delete(operationId);
        }, timeout);

        this.operationTimeouts.set(operationId, timeoutId);

        try {
            const result = await operation();
            return result;
        } finally {
            // Cleanup
            clearTimeout(timeoutId);
            this.operationTimeouts.delete(operationId);
            this.activeOperations.delete(operationId);
            
            const duration = Date.now() - operationInfo.startTime;
            this.debug.info(`Operation ${operationId} completed in ${duration}ms`);
        }
    }

    /**
     * Create atomic operation wrapper
     */
    createAtomicOperation(operationName) {
        return async (operation, resourceIds = []) => {
            const lockIds = [];
            
            try {
                // Acquire all locks in sorted order to prevent deadlocks
                const sortedResourceIds = [...resourceIds].sort();
                
                for (const resourceId of sortedResourceIds) {
                    const lockId = await this.acquireLock(resourceId);
                    lockIds.push({ resourceId, lockId });
                }
                
                this.debug.info(`Atomic operation ${operationName} started with ${lockIds.length} locks`);
                
                // Execute operation
                const result = await operation();
                
                this.debug.info(`Atomic operation ${operationName} completed successfully`);
                return result;
                
            } catch (error) {
                this.debug.error(`Atomic operation ${operationName} failed:`, error);
                throw error;
            } finally {
                // Release all locks in reverse order
                for (let i = lockIds.length - 1; i >= 0; i--) {
                    const { resourceId, lockId } = lockIds[i];
                    this.releaseLock(resourceId, lockId);
                }
            }
        };
    }

    /**
     * Validate concurrent operation safety
     */
    validateConcurrentSafety(operationId, resourceIds = []) {
        const conflicts = [];
        
        // Check for lock conflicts
        for (const resourceId of resourceIds) {
            if (this.locks.has(resourceId)) {
                const lock = this.locks.get(resourceId);
                conflicts.push({
                    type: 'lock_conflict',
                    resourceId,
                    conflictingLock: lock.id,
                    acquiredAt: lock.acquiredAt
                });
            }
        }
        
        // Check for operation limits
        if (this.activeOperations.size >= this.maxConcurrentOperations) {
            conflicts.push({
                type: 'operation_limit',
                current: this.activeOperations.size,
                maximum: this.maxConcurrentOperations
            });
        }
        
        return {
            safe: conflicts.length === 0,
            conflicts
        };
    }

    /**
     * Get concurrency status
     */
    getConcurrencyStatus() {
        return {
            locks: {
                active: this.locks.size,
                resources: Array.from(this.locks.keys())
            },
            mutexes: {
                count: this.mutexes.size,
                locked: Array.from(this.mutexes.values()).filter(m => m.locked).length
            },
            semaphores: {
                count: this.semaphores.size,
                usage: Array.from(this.semaphores.values()).map(s => ({
                    id: s.id,
                    used: s.maxCount - s.currentCount,
                    total: s.maxCount
                }))
            },
            operations: {
                active: this.activeOperations.size,
                maximum: this.maxConcurrentOperations,
                queues: this.operationQueues.size
            }
        };
    }

    /**
     * Cleanup expired locks
     */
    cleanupExpiredLocks() {
        const now = Date.now();
        const expiredLocks = [];
        
        for (const [resourceId, lock] of this.locks.entries()) {
            if (now - lock.acquiredAt > lock.timeout) {
                expiredLocks.push({ resourceId, lock });
            }
        }
        
        for (const { resourceId, lock } of expiredLocks) {
            this.debug.warn(`Cleaning up expired lock for resource ${resourceId}`);
            this.locks.delete(resourceId);
        }
        
        if (expiredLocks.length > 0) {
            this.debug.info(`Cleaned up ${expiredLocks.length} expired locks`);
        }
    }

    /**
     * Cleanup expired operations
     */
    cleanupExpiredOperations() {
        const now = Date.now();
        const expiredOperations = [];
        
        for (const [operationId, operation] of this.activeOperations.entries()) {
            if (now - operation.startTime > operation.timeout) {
                expiredOperations.push(operationId);
            }
        }
        
        for (const operationId of expiredOperations) {
            this.debug.warn(`Cleaning up expired operation ${operationId}`);
            
            // Clear timeout
            const timeoutId = this.operationTimeouts.get(operationId);
            if (timeoutId) {
                clearTimeout(timeoutId);
                this.operationTimeouts.delete(operationId);
            }
            
            this.activeOperations.delete(operationId);
        }
        
        if (expiredOperations.length > 0) {
            this.debug.info(`Cleaned up ${expiredOperations.length} expired operations`);
        }
    }

    /**
     * Generate unique lock ID
     */
    generateLockId() {
        return `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate unique operation ID
     */
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Destroy and cleanup all resources
     */
    destroy() {
        // Clear all locks
        this.locks.clear();
        
        // Clear all mutexes
        this.mutexes.clear();
        
        // Clear all semaphores
        this.semaphores.clear();
        
        // Clear operation queues
        this.operationQueues.clear();
        
        // Clear active operations and timeouts
        for (const timeoutId of this.operationTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        this.operationTimeouts.clear();
        this.activeOperations.clear();
        
        this.debug.info('Concurrency Safety Manager destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConcurrencySafetyManager;
} else if (typeof window !== 'undefined') {
    window.ConcurrencySafetyManager = ConcurrencySafetyManager;
}
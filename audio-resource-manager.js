/**
 * Audio Resource Manager
 * Centralized management of all audio resources to prevent memory leaks
 * and ensure proper cleanup of audio contexts, streams, and processors
 */
class AudioResourceManager {
    constructor() {
        this.resources = new Map();
        this.resourceCounter = 0;
        this.stats = {
            created: 0,
            disposed: 0,
            active: 0
        };
        
        // Initialize debug logger
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('AudioResourceManager') : {
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        };
        
        this.debug.log('AudioResourceManager initialized');
    }

    /**
     * Register a resource with cleanup callback
     * @param {any} resource - The resource to track
     * @param {string} type - Type of resource (audioContext, mediaStream, processor, etc.)
     * @param {Function} cleanupCallback - Function to call when disposing resource
     * @returns {string} - Resource ID for tracking
     */
    registerResource(resource, type, cleanupCallback) {
        if (!resource) {
            this.debug.warn('Attempted to register null/undefined resource');
            return null;
        }

        if (typeof cleanupCallback !== 'function') {
            this.debug.warn('Cleanup callback must be a function');
            return null;
        }

        const resourceId = `${type}_${++this.resourceCounter}`;
        
        const resourceInfo = {
            id: resourceId,
            resource,
            type,
            cleanupCallback,
            createdAt: Date.now(),
            disposed: false
        };

        this.resources.set(resourceId, resourceInfo);
        this.stats.created++;
        this.stats.active++;

        this.debug.log(`Registered ${type} resource with ID: ${resourceId}`);
        
        return resourceId;
    }

    /**
     * Dispose of a specific resource
     * @param {string} resourceId - ID of resource to dispose
     * @returns {boolean} - Success status
     */
    disposeResource(resourceId) {
        const resourceInfo = this.resources.get(resourceId);
        
        if (!resourceInfo) {
            this.debug.warn(`Resource not found: ${resourceId}`);
            return false;
        }

        if (resourceInfo.disposed) {
            this.debug.warn(`Resource already disposed: ${resourceId}`);
            return false;
        }

        try {
            // Call the cleanup callback
            resourceInfo.cleanupCallback(resourceInfo.resource);
            
            // Mark as disposed
            resourceInfo.disposed = true;
            resourceInfo.disposedAt = Date.now();
            
            // Update stats
            this.stats.disposed++;
            this.stats.active--;

            this.debug.log(`Disposed ${resourceInfo.type} resource: ${resourceId}`);
            
            return true;
        } catch (error) {
            this.debug.error(`Error disposing resource ${resourceId}:`, error);
            return false;
        }
    }

    /**
     * Dispose of all resources
     * @returns {Object} - Disposal results
     */
    disposeAllResources() {
        const results = {
            total: this.resources.size,
            disposed: 0,
            errors: []
        };

        this.debug.log(`Disposing all resources (${results.total} total)`);

        for (const [resourceId, resourceInfo] of this.resources) {
            if (!resourceInfo.disposed) {
                try {
                    resourceInfo.cleanupCallback(resourceInfo.resource);
                    resourceInfo.disposed = true;
                    resourceInfo.disposedAt = Date.now();
                    results.disposed++;
                    this.stats.disposed++;
                    this.stats.active--;
                } catch (error) {
                    this.debug.error(`Error disposing resource ${resourceId}:`, error);
                    results.errors.push({
                        resourceId,
                        type: resourceInfo.type,
                        error: error.message
                    });
                }
            }
        }

        this.debug.log(`Disposal complete: ${results.disposed}/${results.total} resources disposed, ${results.errors.length} errors`);
        
        return results;
    }

    /**
     * Get resources by type
     * @param {string} type - Resource type to filter by
     * @returns {Array} - Array of resource info objects
     */
    getResourcesByType(type) {
        const resources = [];
        
        for (const resourceInfo of this.resources.values()) {
            if (resourceInfo.type === type && !resourceInfo.disposed) {
                resources.push({
                    id: resourceInfo.id,
                    type: resourceInfo.type,
                    createdAt: resourceInfo.createdAt,
                    resource: resourceInfo.resource
                });
            }
        }
        
        return resources;
    }

    /**
     * Get active resource count
     * @returns {number} - Number of active resources
     */
    getActiveResourceCount() {
        return this.stats.active;
    }

    /**
     * Get resource statistics
     * @returns {Object} - Resource statistics
     */
    getStats() {
        return {
            ...this.stats,
            totalRegistered: this.resources.size,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    /**
     * Estimate memory usage of tracked resources
     * @returns {Object} - Memory usage estimates
     */
    estimateMemoryUsage() {
        let audioContexts = 0;
        let mediaStreams = 0;
        let processors = 0;
        let audioElements = 0;
        let buffers = 0;

        for (const resourceInfo of this.resources.values()) {
            if (!resourceInfo.disposed) {
                switch (resourceInfo.type) {
                    case 'audioContext':
                        audioContexts++;
                        break;
                    case 'mediaStream':
                        mediaStreams++;
                        break;
                    case 'processor':
                        processors++;
                        break;
                    case 'audioElement':
                        audioElements++;
                        break;
                    case 'audioBuffer':
                        buffers++;
                        break;
                }
            }
        }

        return {
            audioContexts,
            mediaStreams,
            processors,
            audioElements,
            buffers,
            // Rough memory estimates in MB
            estimatedMB: (audioContexts * 2) + (mediaStreams * 1) + (processors * 0.5) + (audioElements * 0.1) + (buffers * 0.5)
        };
    }

    /**
     * Clean up disposed resources from memory
     * @returns {number} - Number of resources cleaned up
     */
    cleanupDisposedResources() {
        let cleaned = 0;
        
        for (const [resourceId, resourceInfo] of this.resources) {
            if (resourceInfo.disposed) {
                this.resources.delete(resourceId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.debug.log(`Cleaned up ${cleaned} disposed resources from memory`);
        }

        return cleaned;
    }

    /**
     * Verify all resources are properly disposed
     * @returns {Object} - Verification results
     */
    verifyCleanup() {
        const activeResources = [];
        
        for (const [resourceId, resourceInfo] of this.resources) {
            if (!resourceInfo.disposed) {
                activeResources.push({
                    id: resourceId,
                    type: resourceInfo.type,
                    age: Date.now() - resourceInfo.createdAt
                });
            }
        }

        const isClean = activeResources.length === 0;
        
        if (!isClean) {
            this.debug.warn(`Cleanup verification failed: ${activeResources.length} resources still active`);
            activeResources.forEach(resource => {
                this.debug.warn(`Active resource: ${resource.id} (${resource.type}) - age: ${resource.age}ms`);
            });
        } else {
            this.debug.log('Cleanup verification passed: all resources disposed');
        }

        return {
            isClean,
            activeResources,
            stats: this.getStats()
        };
    }

    /**
     * Force dispose of old resources (emergency cleanup)
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {number} - Number of resources force disposed
     */
    forceDisposeOldResources(maxAge = 300000) { // 5 minutes default
        let forceDisposed = 0;
        const now = Date.now();

        for (const [resourceId, resourceInfo] of this.resources) {
            if (!resourceInfo.disposed && (now - resourceInfo.createdAt) > maxAge) {
                this.debug.warn(`Force disposing old resource: ${resourceId} (age: ${now - resourceInfo.createdAt}ms)`);
                
                try {
                    resourceInfo.cleanupCallback(resourceInfo.resource);
                    resourceInfo.disposed = true;
                    resourceInfo.disposedAt = now;
                    this.stats.disposed++;
                    this.stats.active--;
                    forceDisposed++;
                } catch (error) {
                    this.debug.error(`Error force disposing resource ${resourceId}:`, error);
                }
            }
        }

        if (forceDisposed > 0) {
            this.debug.log(`Force disposed ${forceDisposed} old resources`);
        }

        return forceDisposed;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioResourceManager;
} else if (typeof window !== 'undefined') {
    window.AudioResourceManager = AudioResourceManager;
}
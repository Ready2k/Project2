/**
 * LRUCache - Least Recently Used cache implementation
 * Provides efficient caching with automatic eviction of least recently used items
 */
class LRUCache {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.debug = window.debugManager?.createModuleLogger('LRUCache') || console;
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {*} - Cached value or undefined if not found
     */
    get(key) {
        if (this.cache.has(key)) {
            // Move to end (most recently used)
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            
            this.debug.debug('Cache hit', { key, cacheSize: this.cache.size });
            return value;
        }
        
        this.debug.debug('Cache miss', { key, cacheSize: this.cache.size });
        return undefined;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    set(key, value) {
        if (this.cache.has(key)) {
            // Update existing key
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.debug.debug('Cache eviction', { evictedKey: firstKey, newKey: key });
        }

        this.cache.set(key, value);
        this.debug.debug('Cache set', { key, cacheSize: this.cache.size });
    }

    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {boolean} - True if key exists
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * Delete key from cache
     * @param {string} key - Cache key
     * @returns {boolean} - True if key was deleted
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.debug.debug('Cache delete', { key, cacheSize: this.cache.size });
        }
        return deleted;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        const previousSize = this.cache.size;
        this.cache.clear();
        this.debug.info('Cache cleared', { previousSize });
    }

    /**
     * Get current cache size
     * @returns {number} - Number of items in cache
     */
    size() {
        return this.cache.size;
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            utilizationPercent: Math.round((this.cache.size / this.maxSize) * 100),
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Invalidate cache entries matching a pattern
     * @param {RegExp|string} pattern - Pattern to match keys against
     * @returns {number} - Number of keys invalidated
     */
    invalidatePattern(pattern) {
        let invalidatedCount = 0;
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
        
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                invalidatedCount++;
            }
        }
        
        if (invalidatedCount > 0) {
            this.debug.info('Cache pattern invalidation', { 
                pattern: pattern.toString(), 
                invalidatedCount,
                remainingSize: this.cache.size 
            });
        }
        
        return invalidatedCount;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LRUCache;
} else {
    window.LRUCache = LRUCache;
}
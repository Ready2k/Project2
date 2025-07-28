/**
 * Rate Limiting System for Voice Banking AI Assistant
 * Implements configurable rate limiting with per-user and per-IP tracking
 */

class RateLimitError extends Error {
    constructor(message, identifier, limit, resetTime) {
        super(message);
        this.name = 'RateLimitError';
        this.identifier = identifier;
        this.limit = limit;
        this.resetTime = resetTime;
        this.retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    }
}

class RateLimiter {
    constructor(options = {}) {
        // Default configuration
        this.config = {
            // Requests per window
            requestsPerWindow: options.requestsPerWindow || 100,
            // Window duration in milliseconds
            windowDuration: options.windowDuration || 60000, // 1 minute
            // Different limits for different types
            limits: options.limits || {
                api: { requests: 100, window: 60000 },
                user: { requests: 50, window: 60000 },
                ip: { requests: 200, window: 60000 },
                agent: { requests: 30, window: 60000 }
            },
            // Enable/disable rate limiting
            enabled: options.enabled !== false
        };

        // Storage for rate limit tracking
        this.limits = new Map(); // identifier -> { count, resetTime, type }
        this.windows = new Map(); // identifier -> array of timestamps
        
        // Cleanup interval to remove expired entries
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.config.windowDuration);
    }

    /**
     * Check if request is within rate limits
     * @param {string} identifier - User ID, IP address, or other identifier
     * @param {string} type - Type of limit to apply ('api', 'user', 'ip', 'agent')
     * @returns {Promise<boolean>} - True if within limits
     * @throws {RateLimitError} - If rate limit exceeded
     */
    async checkLimit(identifier, type = 'api') {
        if (!this.config.enabled) {
            return true;
        }

        const limitConfig = this.config.limits[type] || this.config.limits.api;
        const now = Date.now();
        const key = `${type}:${identifier}`;

        // Get or create limit tracking
        let limitData = this.limits.get(key);
        if (!limitData) {
            limitData = {
                count: 0,
                resetTime: now + limitConfig.window,
                type: type,
                identifier: identifier
            };
            this.limits.set(key, limitData);
        }

        // Reset window if expired
        if (now >= limitData.resetTime) {
            limitData.count = 0;
            limitData.resetTime = now + limitConfig.window;
        }

        // Check if limit exceeded
        if (limitData.count >= limitConfig.requests) {
            const error = new RateLimitError(
                `Rate limit exceeded for ${type}. Limit: ${limitConfig.requests} requests per ${limitConfig.window}ms`,
                identifier,
                limitConfig.requests,
                limitData.resetTime
            );
            
            // Log rate limit violation
            console.warn(`Rate limit exceeded:`, {
                identifier,
                type,
                count: limitData.count,
                limit: limitConfig.requests,
                resetTime: new Date(limitData.resetTime).toISOString()
            });
            
            throw error;
        }

        // Increment counter
        limitData.count++;
        this.limits.set(key, limitData);

        return true;
    }

    /**
     * Check multiple identifiers (e.g., both user and IP)
     * @param {Array<{identifier: string, type: string}>} checks
     * @returns {Promise<boolean>}
     */
    async checkMultipleLimits(checks) {
        for (const check of checks) {
            await this.checkLimit(check.identifier, check.type);
        }
        return true;
    }

    /**
     * Get current usage for an identifier
     * @param {string} identifier
     * @param {string} type
     * @returns {Object} Usage information
     */
    getUsage(identifier, type = 'api') {
        const key = `${type}:${identifier}`;
        const limitData = this.limits.get(key);
        const limitConfig = this.config.limits[type] || this.config.limits.api;

        if (!limitData) {
            return {
                count: 0,
                limit: limitConfig.requests,
                remaining: limitConfig.requests,
                resetTime: null,
                resetIn: null
            };
        }

        const now = Date.now();
        const remaining = Math.max(0, limitConfig.requests - limitData.count);
        const resetIn = Math.max(0, limitData.resetTime - now);

        return {
            count: limitData.count,
            limit: limitConfig.requests,
            remaining,
            resetTime: new Date(limitData.resetTime).toISOString(),
            resetIn: Math.ceil(resetIn / 1000) // seconds
        };
    }

    /**
     * Reset limits for a specific identifier
     * @param {string} identifier
     * @param {string} type
     */
    resetLimit(identifier, type = 'api') {
        const key = `${type}:${identifier}`;
        this.limits.delete(key);
    }

    /**
     * Update rate limit configuration
     * @param {Object} newConfig
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get all current limits (for monitoring)
     * @returns {Array} Array of limit data
     */
    getAllLimits() {
        const now = Date.now();
        const limits = [];

        for (const [key, data] of this.limits.entries()) {
            const [type, identifier] = key.split(':', 2);
            const limitConfig = this.config.limits[type] || this.config.limits.api;
            
            limits.push({
                identifier,
                type,
                count: data.count,
                limit: limitConfig.requests,
                remaining: Math.max(0, limitConfig.requests - data.count),
                resetTime: new Date(data.resetTime).toISOString(),
                resetIn: Math.max(0, Math.ceil((data.resetTime - now) / 1000)),
                isExpired: now >= data.resetTime
            });
        }

        return limits;
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];

        for (const [key, data] of this.limits.entries()) {
            if (now >= data.resetTime + this.config.windowDuration) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.limits.delete(key);
        }

        if (expiredKeys.length > 0) {
            console.debug(`Cleaned up ${expiredKeys.length} expired rate limit entries`);
        }
    }

    /**
     * Destroy the rate limiter and clean up resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.limits.clear();
        this.windows.clear();
    }

    /**
     * Get statistics about rate limiting
     * @returns {Object} Statistics
     */
    getStats() {
        const now = Date.now();
        let totalActive = 0;
        let totalRequests = 0;
        const typeStats = {};

        for (const [key, data] of this.limits.entries()) {
            const [type] = key.split(':', 1);
            
            if (now < data.resetTime) {
                totalActive++;
                totalRequests += data.count;
                
                if (!typeStats[type]) {
                    typeStats[type] = { active: 0, requests: 0 };
                }
                typeStats[type].active++;
                typeStats[type].requests += data.count;
            }
        }

        return {
            totalActive,
            totalRequests,
            typeStats,
            config: this.config
        };
    }
}

// Export classes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RateLimiter, RateLimitError };
} else if (typeof window !== 'undefined') {
    window.RateLimiter = RateLimiter;
    window.RateLimitError = RateLimitError;
}
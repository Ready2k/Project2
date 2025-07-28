/**
 * Connection Manager
 * Handles connection recovery with exponential backoff and automatic reconnection
 * for WebSocket connections and other network operations
 */
class ConnectionManager {
    constructor(options = {}) {
        this.options = {
            maxRetries: options.maxRetries || 5,
            initialDelay: options.initialDelay || 1000, // 1 second
            maxDelay: options.maxDelay || 30000, // 30 seconds
            backoffMultiplier: options.backoffMultiplier || 2,
            jitterFactor: options.jitterFactor || 0.1,
            connectionTimeout: options.connectionTimeout || 10000, // 10 seconds
            healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
            enableCircuitBreaker: options.enableCircuitBreaker !== false,
            ...options
        };

        this.connections = new Map();
        this.connectionCounter = 0;
        this.healthChecks = new Map();
        this.stats = {
            totalAttempts: 0,
            successfulConnections: 0,
            failedConnections: 0,
            reconnections: 0,
            healthCheckFailures: 0,
            circuitBreakerActivations: 0
        };

        // Initialize circuit breaker manager if enabled
        if (this.options.enableCircuitBreaker) {
            this.circuitBreakerManager = new (window.CircuitBreakerManager || class {
                async execute(name, op) { return op(); }
                getBreaker() { return { getState: () => ({ state: 'CLOSED' }) }; }
            })();
        }

        // Initialize debug logger
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('ConnectionManager') : {
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        };

        this.debug.log('ConnectionManager initialized with options:', this.options);
    }

    /**
     * Connect with retry logic and exponential backoff
     * @param {Function} connectFunction - Function that returns a connection promise
     * @param {Object} options - Connection options
     * @returns {Promise} - Promise that resolves with connection or rejects after max retries
     */
    async connectWithRetry(connectFunction, options = {}) {
        const connectionId = `conn_${++this.connectionCounter}`;
        const config = { ...this.options, ...options };
        const serviceName = options.serviceName || `connection_${connectionId}`;
        
        const connectionInfo = {
            id: connectionId,
            serviceName,
            connectFunction,
            config,
            attempts: 0,
            connected: false,
            connection: null,
            createdAt: Date.now(),
            lastAttemptAt: null,
            reconnectTimer: null,
            healthCheckTimer: null,
            lastHealthCheck: null,
            healthStatus: 'unknown'
        };

        this.connections.set(connectionId, connectionInfo);
        this.debug.log(`Starting connection ${connectionId} with retry logic for service ${serviceName}`);

        // Use circuit breaker if enabled
        if (this.options.enableCircuitBreaker && this.circuitBreakerManager) {
            try {
                return await this.circuitBreakerManager.execute(
                    serviceName,
                    () => this.attemptConnection(connectionId),
                    config.circuitBreakerOptions
                );
            } catch (error) {
                if (error.code === 'CIRCUIT_BREAKER_OPEN') {
                    this.stats.circuitBreakerActivations++;
                    this.debug.warn(`Circuit breaker prevented connection attempt for ${serviceName}`);
                }
                throw error;
            }
        } else {
            return this.attemptConnection(connectionId);
        }
    }

    /**
     * Attempt connection with exponential backoff
     * @param {string} connectionId - ID of connection to attempt
     * @returns {Promise} - Promise that resolves with connection
     */
    async attemptConnection(connectionId) {
        const connectionInfo = this.connections.get(connectionId);
        
        if (!connectionInfo) {
            throw new Error(`Connection ${connectionId} not found`);
        }

        connectionInfo.attempts++;
        connectionInfo.lastAttemptAt = Date.now();
        this.stats.totalAttempts++;

        this.debug.log(`Connection attempt ${connectionInfo.attempts}/${connectionInfo.config.maxRetries} for ${connectionId}`);

        try {
            // Create timeout wrapper for connection attempt
            const timeoutManager = window.timeoutManager || new (window.TimeoutManager || class { 
                createTimeout(op, timeout) { return op(); } 
            })();

            const connection = await timeoutManager.createTimeout(
                () => connectionInfo.connectFunction(),
                connectionInfo.config.connectionTimeout,
                'connection_attempt'
            );

            // Connection successful
            connectionInfo.connected = true;
            connectionInfo.connection = connection;
            connectionInfo.connectedAt = Date.now();
            this.stats.successfulConnections++;

            this.debug.log(`Connection ${connectionId} established successfully after ${connectionInfo.attempts} attempts`);

            // Set up connection monitoring
            this.setupConnectionMonitoring(connectionId);

            return connection;

        } catch (error) {
            this.debug.warn(`Connection attempt ${connectionInfo.attempts} failed for ${connectionId}:`, error.message);

            // Check if we should retry
            if (connectionInfo.attempts < connectionInfo.config.maxRetries) {
                const delay = this.calculateBackoffDelay(connectionInfo.attempts, connectionInfo.config);
                
                this.debug.log(`Retrying connection ${connectionId} in ${delay}ms`);

                // Wait for backoff delay then retry
                await this.sleep(delay);
                return this.attemptConnection(connectionId);
            } else {
                // Max retries reached
                connectionInfo.failed = true;
                connectionInfo.failedAt = Date.now();
                this.stats.failedConnections++;

                this.debug.error(`Connection ${connectionId} failed after ${connectionInfo.attempts} attempts`);
                
                const finalError = new Error(`Connection failed after ${connectionInfo.attempts} attempts: ${error.message}`);
                finalError.code = 'MAX_RETRIES_EXCEEDED';
                finalError.originalError = error;
                finalError.attempts = connectionInfo.attempts;
                
                throw finalError;
            }
        }
    }

    /**
     * Set up monitoring for an established connection
     * @param {string} connectionId - ID of connection to monitor
     */
    setupConnectionMonitoring(connectionId) {
        const connectionInfo = this.connections.get(connectionId);
        
        if (!connectionInfo || !connectionInfo.connection) {
            return;
        }

        const connection = connectionInfo.connection;

        // Monitor WebSocket connections
        if (connection instanceof WebSocket) {
            connection.addEventListener('close', (event) => {
                this.handleConnectionLoss(connectionId, event);
            });

            connection.addEventListener('error', (error) => {
                this.debug.warn(`Connection error for ${connectionId}:`, error);
                connectionInfo.healthStatus = 'error';
            });

            connection.addEventListener('open', () => {
                connectionInfo.healthStatus = 'healthy';
                this.debug.log(`Connection ${connectionId} opened successfully`);
            });
        }

        // Set up periodic health checks
        this.setupHealthCheck(connectionId);

        this.debug.log(`Set up monitoring for connection ${connectionId}`);
    }

    /**
     * Set up periodic health checks for a connection
     * @param {string} connectionId - ID of connection to monitor
     */
    setupHealthCheck(connectionId) {
        const connectionInfo = this.connections.get(connectionId);
        
        if (!connectionInfo || !connectionInfo.connected) {
            return;
        }

        // Clear existing health check timer
        if (connectionInfo.healthCheckTimer) {
            clearInterval(connectionInfo.healthCheckTimer);
        }

        // Set up periodic health check
        connectionInfo.healthCheckTimer = setInterval(async () => {
            await this.performHealthCheck(connectionId);
        }, this.options.healthCheckInterval);

        this.debug.log(`Set up health check for connection ${connectionId}`);
    }

    /**
     * Perform health check on a connection
     * @param {string} connectionId - ID of connection to check
     */
    async performHealthCheck(connectionId) {
        const connectionInfo = this.connections.get(connectionId);
        
        if (!connectionInfo || !connectionInfo.connected) {
            return;
        }

        connectionInfo.lastHealthCheck = Date.now();

        try {
            const connection = connectionInfo.connection;
            let isHealthy = false;

            // Check WebSocket health
            if (connection instanceof WebSocket) {
                isHealthy = connection.readyState === WebSocket.OPEN;
                
                // Send ping if supported
                if (isHealthy && typeof connection.ping === 'function') {
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Ping timeout')), 5000);
                        
                        connection.ping((error) => {
                            clearTimeout(timeout);
                            if (error) reject(error);
                            else resolve();
                        });
                    });
                }
            } else {
                // Generic health check - assume healthy if connection exists
                isHealthy = !!connection;
            }

            if (isHealthy) {
                connectionInfo.healthStatus = 'healthy';
            } else {
                throw new Error('Health check failed');
            }

        } catch (error) {
            connectionInfo.healthStatus = 'unhealthy';
            this.stats.healthCheckFailures++;
            
            this.debug.warn(`Health check failed for connection ${connectionId}:`, error.message);

            // Trigger reconnection if health check fails
            if (connectionInfo.config.autoReconnectOnHealthFailure !== false) {
                this.debug.log(`Triggering reconnection due to health check failure for ${connectionId}`);
                this.handleConnectionLoss(connectionId, { 
                    code: 1006, 
                    reason: 'Health check failed', 
                    wasClean: false 
                });
            }
        }
    }

    /**
     * Handle connection loss and attempt reconnection
     * @param {string} connectionId - ID of lost connection
     * @param {Event} event - Connection close/error event
     */
    async handleConnectionLoss(connectionId, event) {
        const connectionInfo = this.connections.get(connectionId);
        
        if (!connectionInfo) {
            return;
        }

        connectionInfo.connected = false;
        connectionInfo.disconnectedAt = Date.now();

        this.debug.warn(`Connection ${connectionId} lost:`, {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });

        // Check if this was an intentional disconnect
        if (event.wasClean || connectionInfo.intentionalDisconnect) {
            this.debug.log(`Connection ${connectionId} was intentionally closed`);
            return;
        }

        // Attempt automatic reconnection
        if (connectionInfo.config.autoReconnect !== false) {
            this.debug.log(`Starting automatic reconnection for ${connectionId}`);
            this.stats.reconnections++;
            
            // Reset attempt counter for reconnection
            connectionInfo.attempts = 0;
            
            try {
                const newConnection = await this.attemptConnection(connectionId);
                
                // Notify about successful reconnection
                if (connectionInfo.onReconnect) {
                    connectionInfo.onReconnect(newConnection);
                }
                
                this.debug.log(`Successfully reconnected ${connectionId}`);
            } catch (error) {
                this.debug.error(`Failed to reconnect ${connectionId}:`, error.message);
                
                // Notify about reconnection failure
                if (connectionInfo.onReconnectFailed) {
                    connectionInfo.onReconnectFailed(error);
                }
            }
        }
    }

    /**
     * Calculate exponential backoff delay with jitter
     * @param {number} attempt - Current attempt number
     * @param {Object} config - Configuration options
     * @returns {number} - Delay in milliseconds
     */
    calculateBackoffDelay(attempt, config) {
        // Exponential backoff: delay = initialDelay * (backoffMultiplier ^ (attempt - 1))
        let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
        
        // Cap at maximum delay
        delay = Math.min(delay, config.maxDelay);
        
        // Add jitter to prevent thundering herd
        const jitter = delay * config.jitterFactor * Math.random();
        delay += jitter;
        
        return Math.floor(delay);
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} - Promise that resolves after delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Disconnect a specific connection
     * @param {string} connectionId - ID of connection to disconnect
     * @param {boolean} intentional - Whether this is an intentional disconnect
     * @returns {boolean} - Success status
     */
    disconnect(connectionId, intentional = true) {
        const connectionInfo = this.connections.get(connectionId);
        
        if (!connectionInfo) {
            this.debug.warn(`Connection ${connectionId} not found for disconnect`);
            return false;
        }

        connectionInfo.intentionalDisconnect = intentional;

        // Clear timers
        if (connectionInfo.reconnectTimer) {
            clearTimeout(connectionInfo.reconnectTimer);
            connectionInfo.reconnectTimer = null;
        }

        if (connectionInfo.healthCheckTimer) {
            clearInterval(connectionInfo.healthCheckTimer);
            connectionInfo.healthCheckTimer = null;
        }

        // Close the connection
        if (connectionInfo.connection) {
            try {
                if (connectionInfo.connection instanceof WebSocket) {
                    connectionInfo.connection.close(1000, 'Intentional disconnect');
                } else if (typeof connectionInfo.connection.close === 'function') {
                    connectionInfo.connection.close();
                } else if (typeof connectionInfo.connection.disconnect === 'function') {
                    connectionInfo.connection.disconnect();
                }
                
                connectionInfo.connected = false;
                connectionInfo.disconnectedAt = Date.now();
                connectionInfo.healthStatus = 'disconnected';
                
                this.debug.log(`Disconnected connection ${connectionId}`);
                return true;
            } catch (error) {
                this.debug.error(`Error disconnecting ${connectionId}:`, error);
                return false;
            }
        }

        return true;
    }

    /**
     * Disconnect all connections
     * @returns {number} - Number of connections disconnected
     */
    disconnectAll() {
        let disconnected = 0;
        
        for (const connectionId of this.connections.keys()) {
            if (this.disconnect(connectionId, true)) {
                disconnected++;
            }
        }

        this.debug.log(`Disconnected ${disconnected} connections`);
        return disconnected;
    }

    /**
     * Get connection status
     * @param {string} connectionId - ID of connection to check
     * @returns {Object|null} - Connection status or null if not found
     */
    getConnectionStatus(connectionId) {
        const connectionInfo = this.connections.get(connectionId);
        
        if (!connectionInfo) {
            return null;
        }

        // Get circuit breaker state if available
        let circuitBreakerState = null;
        if (this.options.enableCircuitBreaker && this.circuitBreakerManager) {
            const breaker = this.circuitBreakerManager.getBreaker(connectionInfo.serviceName);
            circuitBreakerState = breaker.getState();
        }

        return {
            id: connectionId,
            serviceName: connectionInfo.serviceName,
            connected: connectionInfo.connected,
            attempts: connectionInfo.attempts,
            createdAt: connectionInfo.createdAt,
            connectedAt: connectionInfo.connectedAt,
            disconnectedAt: connectionInfo.disconnectedAt,
            lastAttemptAt: connectionInfo.lastAttemptAt,
            lastHealthCheck: connectionInfo.lastHealthCheck,
            healthStatus: connectionInfo.healthStatus,
            failed: connectionInfo.failed || false,
            circuitBreakerState
        };
    }

    /**
     * Get all connection statuses
     * @returns {Array} - Array of connection status objects
     */
    getAllConnectionStatuses() {
        const statuses = [];
        
        for (const connectionId of this.connections.keys()) {
            const status = this.getConnectionStatus(connectionId);
            if (status) {
                statuses.push(status);
            }
        }
        
        return statuses;
    }

    /**
     * Get connection statistics
     * @returns {Object} - Connection statistics
     */
    getStats() {
        const activeConnections = Array.from(this.connections.values())
            .filter(conn => conn.connected).length;
        
        const healthyConnections = Array.from(this.connections.values())
            .filter(conn => conn.healthStatus === 'healthy').length;

        const unhealthyConnections = Array.from(this.connections.values())
            .filter(conn => conn.healthStatus === 'unhealthy').length;

        // Get circuit breaker stats if available
        let circuitBreakerStats = null;
        if (this.options.enableCircuitBreaker && this.circuitBreakerManager) {
            circuitBreakerStats = this.circuitBreakerManager.getAllStats();
        }
        
        return {
            ...this.stats,
            activeConnections,
            healthyConnections,
            unhealthyConnections,
            totalConnections: this.connections.size,
            circuitBreakerStats
        };
    }

    /**
     * Set reconnection callback for a connection
     * @param {string} connectionId - ID of connection
     * @param {Function} onReconnect - Callback for successful reconnection
     * @param {Function} onReconnectFailed - Callback for failed reconnection
     */
    setReconnectionCallbacks(connectionId, onReconnect, onReconnectFailed) {
        const connectionInfo = this.connections.get(connectionId);
        
        if (connectionInfo) {
            connectionInfo.onReconnect = onReconnect;
            connectionInfo.onReconnectFailed = onReconnectFailed;
            this.debug.log(`Set reconnection callbacks for ${connectionId}`);
        }
    }

    /**
     * Clean up completed connections from memory
     * @returns {number} - Number of connections cleaned up
     */
    cleanupCompletedConnections() {
        let cleaned = 0;
        
        for (const [connectionId, connectionInfo] of this.connections) {
            if (!connectionInfo.connected && connectionInfo.failed) {
                this.connections.delete(connectionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.debug.log(`Cleaned up ${cleaned} completed connections from memory`);
        }

        return cleaned;
    }

    /**
     * Get network health summary
     * @returns {Object} - Network health summary
     */
    getNetworkHealthSummary() {
        const connections = Array.from(this.connections.values());
        const totalConnections = connections.length;
        
        if (totalConnections === 0) {
            return {
                status: 'no_connections',
                totalConnections: 0,
                healthyConnections: 0,
                unhealthyConnections: 0,
                failedConnections: 0,
                overallHealth: 'unknown'
            };
        }

        const healthyConnections = connections.filter(conn => conn.healthStatus === 'healthy').length;
        const unhealthyConnections = connections.filter(conn => conn.healthStatus === 'unhealthy').length;
        const failedConnections = connections.filter(conn => conn.failed).length;

        let overallHealth = 'healthy';
        const healthPercentage = (healthyConnections / totalConnections) * 100;
        
        if (healthPercentage < 50) {
            overallHealth = 'critical';
        } else if (healthPercentage < 80) {
            overallHealth = 'degraded';
        }

        return {
            status: 'active',
            totalConnections,
            healthyConnections,
            unhealthyConnections,
            failedConnections,
            overallHealth,
            healthPercentage: Math.round(healthPercentage),
            circuitBreakerSummary: this.options.enableCircuitBreaker && this.circuitBreakerManager ? 
                this.circuitBreakerManager.getHealthSummary() : null
        };
    }

    /**
     * Force close all connections and clear state
     * @returns {number} - Number of connections force closed
     */
    forceCleanup() {
        const count = this.disconnectAll();
        this.connections.clear();
        
        // Reset circuit breakers if enabled
        if (this.options.enableCircuitBreaker && this.circuitBreakerManager) {
            this.circuitBreakerManager.resetAll();
        }
        
        this.debug.log(`Force cleanup completed: ${count} connections closed`);
        return count;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConnectionManager;
} else if (typeof window !== 'undefined') {
    window.ConnectionManager = ConnectionManager;
}
/**
 * StreamingAgentRoutingIntegration - Main integration script for streaming agent routing
 * Provides easy-to-use functions for integrating streaming agent routing into the main application
 */
class StreamingAgentRoutingIntegration {
    constructor() {
        // Initialize debug logger
        this.debug = window.debugManager ? 
            window.debugManager.createModuleLogger('StreamingAgentRoutingIntegration') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

        // Integration state
        this.isIntegrated = false;
        this.integrationConfig = null;
        this.integrationStartTime = null;
        this.retryAttempts = 0;
        this.maxRetryAttempts = 5;
        this.retryInterval = null;

        // Default configuration
        this.defaultConfig = {
            agentRoutingEnabled: true,
            routingLatencyThreshold: 100,
            maxRoutingTimeout: 200,
            circuitBreakerThreshold: 5,
            sessionUpdateRetries: 3,
            performanceOptimizationEnabled: true,
            healthCheckInterval: 15000,
            autoInitialize: true,
            autoCleanup: true
        };

        this.debug.info('StreamingAgentRoutingIntegration created');
    }

    /**
     * Initialize streaming agent routing with the main application
     * @param {Object} config - Configuration options
     * @returns {Promise<Object>} - Integration result
     */
    async integrate(config = {}) {
        try {
            if (this.isIntegrated) {
                this.debug.warn('Streaming agent routing already integrated');
                return { success: true, message: 'Already integrated' };
            }

            this.integrationStartTime = Date.now();
            this.integrationConfig = { ...this.defaultConfig, ...config };

            this.debug.info('Starting streaming agent routing integration', {
                config: this.sanitizeConfig(this.integrationConfig)
            });

            // Step 1: Wait for required dependencies
            const dependencies = await this.waitForDependencies();
            if (!dependencies.success) {
                throw new Error(`Dependencies not available: ${dependencies.error}`);
            }

            // Step 2: Initialize the system
            if (this.integrationConfig.autoInitialize) {
                const initResult = await this.initializeSystem(dependencies.dependencies);
                if (!initResult.success) {
                    throw new Error(`Initialization failed: ${initResult.error}`);
                }
            }

            // Step 3: Set up integration hooks
            const hooksResult = await this.setupIntegrationHooks();
            if (!hooksResult.success) {
                this.debug.warn('Integration hooks setup failed', { error: hooksResult.error });
                // Don't fail integration for hooks issues
            }

            // Step 4: Set up cleanup handlers
            if (this.integrationConfig.autoCleanup) {
                this.setupCleanupHandlers();
            }

            this.isIntegrated = true;
            const integrationTime = Date.now() - this.integrationStartTime;

            this.debug.info('Streaming agent routing integration completed', {
                integrationTime: integrationTime,
                config: this.sanitizeConfig(this.integrationConfig)
            });

            return {
                success: true,
                integrationTime: integrationTime,
                config: this.integrationConfig,
                dependencies: dependencies.dependencies
            };

        } catch (error) {
            this.debug.error('Streaming agent routing integration failed', {
                error: error.message,
                integrationTime: Date.now() - this.integrationStartTime
            });

            return {
                success: false,
                error: error.message,
                integrationTime: Date.now() - this.integrationStartTime
            };
        }
    }

    /**
     * Wait for required dependencies to be available
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Object>} - Dependencies result
     */
    async waitForDependencies(timeout = 30000) {
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const checkDependencies = () => {
                try {
                    const dependencies = {
                        streamingManager: this.getStreamingManager(),
                        agentRouter: this.getAgentRouter(),
                        conversationContextManager: this.getConversationContextManager(),
                        debugManager: window.debugManager,
                        systemLogger: window.systemLogger
                    };

                    // Check required dependencies
                    const requiredDeps = ['streamingManager', 'agentRouter'];
                    const missingRequired = requiredDeps.filter(dep => !dependencies[dep]);

                    if (missingRequired.length === 0) {
                        this.debug.info('All required dependencies available', {
                            waitTime: Date.now() - startTime,
                            availableDependencies: Object.keys(dependencies).filter(key => dependencies[key])
                        });

                        resolve({
                            success: true,
                            dependencies: dependencies,
                            waitTime: Date.now() - startTime
                        });
                        return;
                    }

                    // Check timeout
                    if (Date.now() - startTime > timeout) {
                        this.debug.error('Dependency wait timeout', {
                            missingRequired: missingRequired,
                            waitTime: Date.now() - startTime
                        });

                        resolve({
                            success: false,
                            error: `Required dependencies not available: ${missingRequired.join(', ')}`,
                            missingRequired: missingRequired,
                            waitTime: Date.now() - startTime
                        });
                        return;
                    }

                    // Continue waiting
                    setTimeout(checkDependencies, 500);

                } catch (error) {
                    resolve({
                        success: false,
                        error: error.message,
                        waitTime: Date.now() - startTime
                    });
                }
            };

            checkDependencies();
        });
    }

    /**
     * Initialize the streaming agent routing system
     * @param {Object} dependencies - Available dependencies
     * @returns {Promise<Object>} - Initialization result
     */
    async initializeSystem(dependencies) {
        try {
            if (!window.streamingAgentRoutingInitializer) {
                throw new Error('StreamingAgentRoutingInitializer not available');
            }

            this.debug.info('Initializing streaming agent routing system');

            const result = await window.streamingAgentRoutingInitializer.initialize(
                this.integrationConfig,
                dependencies
            );

            if (result.success) {
                this.debug.info('System initialization successful', {
                    initializationTime: result.initializationTime,
                    componentsInitialized: result.componentsInitialized
                });
            }

            return result;

        } catch (error) {
            this.debug.error('System initialization failed', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Set up integration hooks with the main application
     * @returns {Promise<Object>} - Setup result
     */
    async setupIntegrationHooks() {
        try {
            this.debug.info('Setting up integration hooks');

            const hooks = [];

            // Hook into streaming manager if available
            const streamingManager = this.getStreamingManager();
            if (streamingManager) {
                // Add event listeners for streaming events
                if (streamingManager.addEventListener) {
                    const eventHandler = (event) => {
                        this.handleStreamingEvent(event);
                    };

                    streamingManager.addEventListener('agentSwitch', eventHandler);
                    streamingManager.addEventListener('routingError', eventHandler);
                    streamingManager.addEventListener('healthChange', eventHandler);

                    hooks.push('streamingManager events');
                }

                // Hook into connection events
                if (streamingManager.onConnectionChange) {
                    const originalHandler = streamingManager.onConnectionChange;
                    streamingManager.onConnectionChange = (status) => {
                        this.handleConnectionChange(status);
                        if (originalHandler) {
                            originalHandler(status);
                        }
                    };

                    hooks.push('connection change handler');
                }
            }

            // Hook into main interface if available
            if (window.mainInterface) {
                const originalUpdateAgentIndicator = window.mainInterface.updateAgentIndicator;
                if (originalUpdateAgentIndicator) {
                    window.mainInterface.updateAgentIndicator = (agentName) => {
                        this.handleAgentIndicatorUpdate(agentName);
                        originalUpdateAgentIndicator.call(window.mainInterface, agentName);
                    };

                    hooks.push('agent indicator update');
                }
            }

            // Hook into speech app if available
            if (window.speechApp) {
                // Monitor agent router changes
                if (window.speechApp.agentRouter && window.speechApp.agentRouter.on) {
                    window.speechApp.agentRouter.on('agentChange', (agentInfo) => {
                        this.handleAgentChange(agentInfo);
                    });

                    hooks.push('agent router events');
                }
            }

            this.debug.info('Integration hooks setup completed', {
                hooksSetup: hooks
            });

            return {
                success: true,
                hooksSetup: hooks
            };

        } catch (error) {
            this.debug.error('Integration hooks setup failed', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Set up cleanup handlers for proper resource management
     */
    setupCleanupHandlers() {
        try {
            this.debug.info('Setting up cleanup handlers');

            // Page unload handler
            const unloadHandler = () => {
                this.cleanup().catch(() => {
                    // Ignore errors during cleanup
                });
            };

            window.addEventListener('beforeunload', unloadHandler);
            window.addEventListener('pagehide', unloadHandler);

            // Visibility change handler
            const visibilityHandler = () => {
                if (document.visibilityState === 'hidden') {
                    // Page is hidden, consider pausing operations
                    this.handlePageHidden();
                } else if (document.visibilityState === 'visible') {
                    // Page is visible, resume operations
                    this.handlePageVisible();
                }
            };

            document.addEventListener('visibilitychange', visibilityHandler);

            this.debug.info('Cleanup handlers setup completed');

        } catch (error) {
            this.debug.error('Cleanup handlers setup failed', { error: error.message });
        }
    }

    /**
     * Handle streaming events
     * @param {Object} event - Streaming event
     */
    handleStreamingEvent(event) {
        try {
            this.debug.debug('Handling streaming event', {
                type: event.type,
                data: event.data
            });

            // Update UI or perform actions based on event type
            switch (event.type) {
                case 'agentSwitch':
                    this.handleAgentSwitch(event.data);
                    break;
                case 'routingError':
                    this.handleRoutingError(event.data);
                    break;
                case 'healthChange':
                    this.handleHealthChange(event.data);
                    break;
                default:
                    this.debug.debug('Unknown streaming event type', { type: event.type });
            }

        } catch (error) {
            this.debug.error('Error handling streaming event', {
                error: error.message,
                event: event
            });
        }
    }

    /**
     * Handle agent switch events
     * @param {Object} data - Agent switch data
     */
    handleAgentSwitch(data) {
        this.debug.info('Agent switch detected', {
            fromAgent: data.fromAgent,
            toAgent: data.toAgent,
            reason: data.reason
        });

        // Update UI if main interface is available
        if (window.mainInterface && window.mainInterface.updateAgentIndicator) {
            window.mainInterface.updateAgentIndicator(data.toAgent);
        }

        // Log to system logger if available
        if (window.systemLogger) {
            window.systemLogger.logUserAction('Agent switch in streaming mode', {
                fromAgent: data.fromAgent,
                toAgent: data.toAgent,
                reason: data.reason,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Handle routing errors
     * @param {Object} data - Error data
     */
    handleRoutingError(data) {
        this.debug.warn('Routing error detected', {
            error: data.error,
            fallbackUsed: data.fallbackUsed
        });

        // Show user notification if needed
        if (data.userVisible && window.mainInterface) {
            // Could show a temporary notification
            console.warn('Streaming agent routing error:', data.error);
        }
    }

    /**
     * Handle health changes
     * @param {Object} data - Health data
     */
    handleHealthChange(data) {
        this.debug.info('Health status changed', {
            previousHealth: data.previousHealth,
            currentHealth: data.currentHealth
        });

        // Update status indicators if available
        if (window.mainInterface && data.currentHealth === 'unhealthy') {
            // Could update connection status or show warning
            console.warn('Streaming agent routing health degraded');
        }
    }

    /**
     * Handle connection changes
     * @param {string} status - Connection status
     */
    handleConnectionChange(status) {
        this.debug.info('Connection status changed', { status: status });

        // Perform health check on reconnection
        if (status === 'connected' && window.streamingAgentRoutingInitializer) {
            window.streamingAgentRoutingInitializer.performHealthCheck().catch(() => {
                // Ignore errors during health check
            });
        }
    }

    /**
     * Handle agent indicator updates
     * @param {string} agentName - Agent name
     */
    handleAgentIndicatorUpdate(agentName) {
        this.debug.debug('Agent indicator updated', { agentName: agentName });
        
        // Could perform additional actions when agent indicator changes
    }

    /**
     * Handle agent changes
     * @param {Object} agentInfo - Agent information
     */
    handleAgentChange(agentInfo) {
        this.debug.info('Agent change detected', { agentInfo: agentInfo });
        
        // Could sync with streaming agent routing system
    }

    /**
     * Handle page hidden event
     */
    handlePageHidden() {
        this.debug.info('Page hidden, pausing non-essential operations');
        
        // Could pause health checks or reduce activity
    }

    /**
     * Handle page visible event
     */
    handlePageVisible() {
        this.debug.info('Page visible, resuming operations');
        
        // Could resume health checks or perform status update
        if (window.streamingAgentRoutingInitializer) {
            window.streamingAgentRoutingInitializer.performHealthCheck().catch(() => {
                // Ignore errors during health check
            });
        }
    }

    /**
     * Get streaming manager instance
     * @returns {Object|null} - StreamingManager instance
     */
    getStreamingManager() {
        if (window.streamingManager) {
            return window.streamingManager;
        }
        if (window.speechApp && window.speechApp.streamingManager) {
            return window.speechApp.streamingManager;
        }
        return null;
    }

    /**
     * Get agent router instance
     * @returns {Object|null} - AgentRouter instance
     */
    getAgentRouter() {
        if (window.speechApp && window.speechApp.agentRouter) {
            return window.speechApp.agentRouter;
        }
        if (window.agentRouter) {
            return window.agentRouter;
        }
        return null;
    }

    /**
     * Get conversation context manager instance
     * @returns {Object|null} - ConversationContextManager instance
     */
    getConversationContextManager() {
        if (window.speechApp && window.speechApp.conversationContextManager) {
            return window.speechApp.conversationContextManager;
        }
        if (window.conversationContextManager) {
            return window.conversationContextManager;
        }
        return null;
    }

    /**
     * Sanitize configuration for logging
     * @param {Object} config - Configuration to sanitize
     * @returns {Object} - Sanitized configuration
     */
    sanitizeConfig(config) {
        const sanitized = { ...config };
        
        // Remove or mask sensitive fields
        const sensitiveFields = ['apiKey', 'token', 'password', 'secret'];
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }

        return sanitized;
    }

    /**
     * Get integration status
     * @returns {Object} - Current status
     */
    getStatus() {
        return {
            isIntegrated: this.isIntegrated,
            integrationStartTime: this.integrationStartTime,
            config: this.sanitizeConfig(this.integrationConfig || {}),
            systemStatus: window.streamingAgentRoutingInitializer ? 
                window.streamingAgentRoutingInitializer.getStatus() : null
        };
    }

    /**
     * Set up retry mechanism for integration
     */
    setupRetryIntegration() {
        if (this.retryInterval || this.isIntegrated) {
            return; // Already set up or integrated
        }

        this.debug.info('Setting up retry integration mechanism');

        this.retryInterval = setInterval(async () => {
            try {
                this.retryAttempts++;
                
                if (this.retryAttempts > this.maxRetryAttempts) {
                    this.debug.warn('Max retry attempts reached, stopping retry integration');
                    clearInterval(this.retryInterval);
                    this.retryInterval = null;
                    return;
                }

                this.debug.debug(`Retry integration attempt ${this.retryAttempts}/${this.maxRetryAttempts}`);

                // Check if dependencies are now available
                const dependencies = await this.waitForDependencies(1000); // Short timeout for retry
                
                if (dependencies.success) {
                    this.debug.info('Dependencies now available, attempting integration');
                    
                    const result = await this.integrate();
                    
                    if (result.success) {
                        console.log('✅ Streaming agent routing integrated successfully on retry');
                        clearInterval(this.retryInterval);
                        this.retryInterval = null;
                    } else {
                        this.debug.debug('Integration retry failed', { error: result.error });
                    }
                } else {
                    this.debug.debug('Dependencies still not available for retry');
                }

            } catch (error) {
                this.debug.error('Error during retry integration', { error: error.message });
            }
        }, 5000); // Retry every 5 seconds
    }

    /**
     * Cleanup integration
     * @returns {Promise<Object>} - Cleanup result
     */
    async cleanup() {
        try {
            this.debug.info('Starting integration cleanup');

            // Cleanup the underlying system
            if (window.streamingAgentRoutingInitializer) {
                const result = await window.streamingAgentRoutingInitializer.cleanup();
                if (!result.success) {
                    this.debug.warn('System cleanup failed', { error: result.error });
                }
            }

            // Clear retry interval if active
            if (this.retryInterval) {
                clearInterval(this.retryInterval);
                this.retryInterval = null;
            }

            // Reset integration state
            this.isIntegrated = false;
            this.integrationConfig = null;
            this.integrationStartTime = null;
            this.retryAttempts = 0;

            this.debug.info('Integration cleanup completed');

            return { success: true };

        } catch (error) {
            this.debug.error('Integration cleanup failed', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Make the integration class available globally
window.StreamingAgentRoutingIntegration = StreamingAgentRoutingIntegration;

// Create global instance for easy access
window.streamingAgentRoutingIntegration = new StreamingAgentRoutingIntegration();

// Auto-integrate when DOM is ready (if enabled)
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure all dependencies are loaded
    setTimeout(async () => {
        try {
            // Only auto-integrate if not in test environment
            if (!window.isTestEnvironment || !window.isTestEnvironment()) {
                const result = await window.streamingAgentRoutingIntegration.integrate();
                if (result.success) {
                    console.log('✅ Streaming agent routing integrated successfully');
                } else {
                    console.log('📝 Streaming agent routing integration deferred:', result.error);
                    console.log('   This is normal if the main application dependencies are not ready yet.');
                    
                    // Set up retry mechanism
                    window.streamingAgentRoutingIntegration.setupRetryIntegration();
                }
            }
        } catch (error) {
            console.error('❌ Auto-integration error:', error);
        }
    }, 2000);
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingAgentRoutingIntegration;
}
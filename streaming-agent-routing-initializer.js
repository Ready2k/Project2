/**
 * StreamingAgentRoutingInitializer - Initialization and cleanup system for streaming agent routing integration
 * Handles component initialization, configuration validation, resource management, and health monitoring
 */
class StreamingAgentRoutingInitializer {
    constructor() {
        // Initialize debug logger
        this.debug = window.debugManager ? 
            window.debugManager.createModuleLogger('StreamingAgentRoutingInitializer') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

        // Initialization state
        this.isInitialized = false;
        this.isInitializing = false;
        this.initializationStartTime = null;
        this.initializationTimeout = 30000; // 30 seconds timeout

        // Component registry
        this.components = new Map();
        this.componentDependencies = new Map();
        this.initializationOrder = [
            'StreamingErrorHandler',
            'StreamingAgentRouter',
            'StreamingPerformanceOptimizer', 
            'StreamingSessionManager',
            'StreamingResponseHandler',
            'StreamingAgentMiddleware'
        ];

        // Configuration validation
        this.configurationSchema = {
            agentRoutingEnabled: { type: 'boolean', default: false },
            routingLatencyThreshold: { type: 'number', min: 50, max: 500, default: 100 },
            maxRoutingTimeout: { type: 'number', min: 100, max: 1000, default: 200 },
            circuitBreakerThreshold: { type: 'number', min: 1, max: 10, default: 5 },
            sessionUpdateRetries: { type: 'number', min: 1, max: 5, default: 3 },
            performanceOptimizationEnabled: { type: 'boolean', default: true },
            healthCheckInterval: { type: 'number', min: 5000, max: 60000, default: 15000 }
        };

        // Health monitoring
        this.healthCheck = {
            isRunning: false,
            interval: null,
            lastCheckTime: null,
            componentHealth: new Map(),
            overallHealth: 'unknown'
        };

        // Resource tracking
        this.resources = {
            intervals: new Set(),
            timeouts: new Set(),
            eventListeners: new Map(),
            webSocketConnections: new Set(),
            audioContexts: new Set()
        };

        // Error tracking
        this.initializationErrors = [];
        this.runtimeErrors = [];
        this.maxErrorHistory = 100;

        // Shutdown state
        this.isShuttingDown = false;
        this.shutdownTimeout = 10000; // 10 seconds for graceful shutdown

        this.debug.info('StreamingAgentRoutingInitializer created', {
            initializationTimeout: this.initializationTimeout,
            componentCount: this.initializationOrder.length,
            healthCheckInterval: this.configurationSchema.healthCheckInterval.default
        });
    }

    /**
     * Initialize streaming agent routing system
     * @param {Object} config - Configuration options
     * @param {Object} dependencies - Required dependencies (streamingManager, agentRouter, etc.)
     * @returns {Promise<Object>} - Initialization result
     */
    async initialize(config = {}, dependencies = {}) {
        if (this.isInitialized) {
            this.debug.warn('Streaming agent routing already initialized');
            return { success: true, message: 'Already initialized' };
        }

        if (this.isInitializing) {
            this.debug.warn('Initialization already in progress');
            return { success: false, error: 'Initialization already in progress' };
        }

        try {
            this.isInitializing = true;
            this.initializationStartTime = Date.now();
            this.initializationErrors = [];

            this.debug.info('Starting streaming agent routing initialization', {
                config: this.sanitizeConfig(config),
                dependencies: Object.keys(dependencies)
            });

            // Step 1: Validate configuration
            const validatedConfig = await this.validateConfiguration(config);
            if (!validatedConfig.isValid) {
                throw new Error(`Configuration validation failed: ${validatedConfig.errors.join(', ')}`);
            }

            // Step 2: Validate dependencies
            const dependencyValidation = await this.validateDependencies(dependencies);
            if (!dependencyValidation.isValid) {
                throw new Error(`Dependency validation failed: ${dependencyValidation.errors.join(', ')}`);
            }

            // Step 3: Initialize components in order
            const componentInitialization = await this.initializeComponents(validatedConfig.config, dependencies);
            if (!componentInitialization.success) {
                throw new Error(`Component initialization failed: ${componentInitialization.error}`);
            }

            // Step 4: Set up component dependencies and connections
            const connectionSetup = await this.setupComponentConnections();
            if (!connectionSetup.success) {
                throw new Error(`Component connection setup failed: ${connectionSetup.error}`);
            }

            // Step 5: Start health monitoring
            const healthMonitoring = await this.startHealthMonitoring(validatedConfig.config);
            if (!healthMonitoring.success) {
                this.debug.warn('Health monitoring failed to start', { error: healthMonitoring.error });
                // Don't fail initialization for health monitoring issues
            }

            // Step 6: Perform initial health check
            const initialHealthCheck = await this.performHealthCheck();
            
            this.isInitialized = true;
            this.isInitializing = false;

            const initializationTime = Date.now() - this.initializationStartTime;

            this.debug.info('Streaming agent routing initialization completed successfully', {
                initializationTime: initializationTime,
                componentsInitialized: this.components.size,
                healthStatus: initialHealthCheck.overallHealth,
                config: this.sanitizeConfig(validatedConfig.config)
            });

            return {
                success: true,
                initializationTime: initializationTime,
                componentsInitialized: Array.from(this.components.keys()),
                healthStatus: initialHealthCheck,
                config: validatedConfig.config
            };

        } catch (error) {
            this.isInitializing = false;
            this.initializationErrors.push({
                timestamp: Date.now(),
                error: error.message,
                stack: error.stack
            });

            this.debug.error('Streaming agent routing initialization failed', {
                error: error.message,
                initializationTime: Date.now() - this.initializationStartTime,
                componentsInitialized: this.components.size
            });

            // Attempt cleanup of partially initialized components
            await this.cleanup();

            return {
                success: false,
                error: error.message,
                initializationErrors: this.initializationErrors,
                partiallyInitializedComponents: Array.from(this.components.keys())
            };
        }
    }

    /**
     * Validate configuration against schema
     * @param {Object} config - Configuration to validate
     * @returns {Promise<Object>} - Validation result
     */
    async validateConfiguration(config) {
        try {
            const validatedConfig = {};
            const errors = [];

            // Validate each configuration option
            for (const [key, schema] of Object.entries(this.configurationSchema)) {
                const value = config[key];

                if (value === undefined || value === null) {
                    validatedConfig[key] = schema.default;
                    continue;
                }

                // Type validation
                if (schema.type === 'boolean' && typeof value !== 'boolean') {
                    errors.push(`${key} must be a boolean, got ${typeof value}`);
                    continue;
                }

                if (schema.type === 'number' && typeof value !== 'number') {
                    errors.push(`${key} must be a number, got ${typeof value}`);
                    continue;
                }

                // Range validation for numbers
                if (schema.type === 'number') {
                    if (schema.min !== undefined && value < schema.min) {
                        errors.push(`${key} must be >= ${schema.min}, got ${value}`);
                        continue;
                    }
                    if (schema.max !== undefined && value > schema.max) {
                        errors.push(`${key} must be <= ${schema.max}, got ${value}`);
                        continue;
                    }
                }

                validatedConfig[key] = value;
            }

            // Additional validation logic
            if (validatedConfig.maxRoutingTimeout <= validatedConfig.routingLatencyThreshold) {
                errors.push('maxRoutingTimeout must be greater than routingLatencyThreshold');
            }

            return {
                isValid: errors.length === 0,
                config: validatedConfig,
                errors: errors
            };

        } catch (error) {
            this.debug.error('Configuration validation error', { error: error.message });
            return {
                isValid: false,
                config: {},
                errors: [`Configuration validation error: ${error.message}`]
            };
        }
    }

    /**
     * Validate required dependencies
     * @param {Object} dependencies - Dependencies to validate
     * @returns {Promise<Object>} - Validation result
     */
    async validateDependencies(dependencies) {
        try {
            const errors = [];
            const requiredDependencies = [
                'streamingManager',
                'agentRouter'
            ];

            const optionalDependencies = [
                'conversationContextManager',
                'debugManager',
                'systemLogger'
            ];

            // Check required dependencies
            for (const dep of requiredDependencies) {
                if (!dependencies[dep]) {
                    errors.push(`Required dependency missing: ${dep}`);
                    continue;
                }

                // Basic type checking
                if (typeof dependencies[dep] !== 'object') {
                    errors.push(`Dependency ${dep} must be an object, got ${typeof dependencies[dep]}`);
                    continue;
                }

                // Specific validation for each dependency
                if (dep === 'streamingManager') {
                    if (typeof dependencies[dep].connect !== 'function') {
                        errors.push('streamingManager must have a connect method');
                    }
                    if (typeof dependencies[dep].sendMessage !== 'function') {
                        errors.push('streamingManager must have a sendMessage method');
                    }
                }

                if (dep === 'agentRouter') {
                    if (typeof dependencies[dep].route !== 'function') {
                        errors.push('agentRouter must have a route method');
                    }
                }
            }

            // Check optional dependencies and warn if missing
            for (const dep of optionalDependencies) {
                if (!dependencies[dep]) {
                    this.debug.warn(`Optional dependency missing: ${dep}. Some features may be limited.`);
                }
            }

            return {
                isValid: errors.length === 0,
                errors: errors,
                availableDependencies: Object.keys(dependencies),
                missingOptionalDependencies: optionalDependencies.filter(dep => !dependencies[dep])
            };

        } catch (error) {
            this.debug.error('Dependency validation error', { error: error.message });
            return {
                isValid: false,
                errors: [`Dependency validation error: ${error.message}`]
            };
        }
    }

    /**
     * Initialize components in the correct order
     * @param {Object} config - Validated configuration
     * @param {Object} dependencies - Validated dependencies
     * @returns {Promise<Object>} - Initialization result
     */
    async initializeComponents(config, dependencies) {
        try {
            const initializationResults = [];

            for (const componentName of this.initializationOrder) {
                try {
                    this.debug.info(`Initializing component: ${componentName}`);
                    
                    const startTime = Date.now();
                    let component = null;

                    // Initialize each component based on its type
                    switch (componentName) {
                        case 'StreamingErrorHandler':
                            if (window.StreamingErrorHandler) {
                                component = new window.StreamingErrorHandler(
                                    dependencies.streamingManager,
                                    null // Will be set after StreamingAgentRouter is initialized
                                );
                            }
                            break;

                        case 'StreamingPerformanceOptimizer':
                            if (window.StreamingPerformanceOptimizer) {
                                const streamingAgentRouter = this.components.get('StreamingAgentRouter');
                                if (streamingAgentRouter) {
                                    component = new window.StreamingPerformanceOptimizer(
                                        streamingAgentRouter,
                                        dependencies.streamingManager
                                    );
                                    if (component.setOptimizationEnabled) {
                                        component.setOptimizationEnabled(config.performanceOptimizationEnabled);
                                    }
                                } else {
                                    throw new Error('StreamingAgentRouter must be initialized before StreamingPerformanceOptimizer');
                                }
                            }
                            break;

                        case 'StreamingSessionManager':
                            if (window.StreamingSessionManager) {
                                const streamingAgentRouter = this.components.get('StreamingAgentRouter');
                                if (streamingAgentRouter) {
                                    component = new window.StreamingSessionManager(
                                        dependencies.streamingManager,
                                        streamingAgentRouter
                                    );
                                } else {
                                    throw new Error('StreamingAgentRouter must be initialized before StreamingSessionManager');
                                }
                            }
                            break;

                        case 'StreamingAgentRouter':
                            if (window.StreamingAgentRouter) {
                                component = new window.StreamingAgentRouter(
                                    dependencies.agentRouter,
                                    dependencies.streamingManager
                                );
                                
                                // Configure routing parameters
                                if (component.setRoutingLatencyThreshold) {
                                    component.setRoutingLatencyThreshold(config.routingLatencyThreshold);
                                }
                                if (component.setMaxRoutingTimeout) {
                                    component.setMaxRoutingTimeout(config.maxRoutingTimeout);
                                }
                            }
                            break;

                        case 'StreamingResponseHandler':
                            if (window.StreamingResponseHandler) {
                                component = new window.StreamingResponseHandler(
                                    dependencies.streamingManager
                                );
                            }
                            break;

                        case 'StreamingAgentMiddleware':
                            if (window.StreamingAgentMiddleware) {
                                const streamingAgentRouter = this.components.get('StreamingAgentRouter');
                                if (streamingAgentRouter) {
                                    component = new window.StreamingAgentMiddleware(
                                        dependencies.streamingManager,
                                        streamingAgentRouter
                                    );
                                }
                            }
                            break;

                        default:
                            this.debug.warn(`Unknown component: ${componentName}`);
                            continue;
                    }

                    const initializationTime = Date.now() - startTime;

                    if (component) {
                        this.components.set(componentName, component);
                        initializationResults.push({
                            componentName: componentName,
                            success: true,
                            initializationTime: initializationTime
                        });

                        this.debug.info(`Component ${componentName} initialized successfully`, {
                            initializationTime: initializationTime
                        });
                    } else {
                        const message = `Component class ${componentName} not available`;
                        this.debug.warn(message);
                        initializationResults.push({
                            componentName: componentName,
                            success: false,
                            error: message,
                            initializationTime: initializationTime
                        });
                    }

                } catch (error) {
                    const message = `Failed to initialize ${componentName}: ${error.message}`;
                    this.debug.error(message, { error: error.stack });
                    initializationResults.push({
                        componentName: componentName,
                        success: false,
                        error: message,
                        initializationTime: Date.now() - Date.now()
                    });

                    // For critical components, fail the entire initialization
                    if (['StreamingAgentRouter', 'StreamingErrorHandler'].includes(componentName)) {
                        throw new Error(message);
                    }
                }
            }

            const successfulComponents = initializationResults.filter(r => r.success);
            const failedComponents = initializationResults.filter(r => !r.success);

            this.debug.info('Component initialization completed', {
                successful: successfulComponents.length,
                failed: failedComponents.length,
                totalTime: initializationResults.reduce((sum, r) => sum + r.initializationTime, 0)
            });

            return {
                success: successfulComponents.length > 0,
                results: initializationResults,
                successfulComponents: successfulComponents.map(r => r.componentName),
                failedComponents: failedComponents.map(r => ({ name: r.componentName, error: r.error }))
            };

        } catch (error) {
            this.debug.error('Component initialization failed', { error: error.message });
            return {
                success: false,
                error: error.message,
                results: []
            };
        }
    }

    /**
     * Set up connections and dependencies between components
     * @returns {Promise<Object>} - Setup result
     */
    async setupComponentConnections() {
        try {
            this.debug.info('Setting up component connections');

            const streamingAgentRouter = this.components.get('StreamingAgentRouter');
            const streamingErrorHandler = this.components.get('StreamingErrorHandler');
            const streamingPerformanceOptimizer = this.components.get('StreamingPerformanceOptimizer');
            const streamingSessionManager = this.components.get('StreamingSessionManager');

            // Set up error handler connections
            if (streamingErrorHandler) {
                if (streamingAgentRouter && streamingAgentRouter.setErrorHandler) {
                    streamingAgentRouter.setErrorHandler(streamingErrorHandler);
                    this.debug.info('Connected error handler to agent router');
                }

                // Update error handler with agent router reference
                if (streamingErrorHandler.streamingAgentRouter === null && streamingAgentRouter) {
                    streamingErrorHandler.streamingAgentRouter = streamingAgentRouter;
                    this.debug.info('Updated error handler with agent router reference');
                }
            }

            // Set up performance optimizer connections
            if (streamingPerformanceOptimizer && streamingAgentRouter) {
                if (streamingAgentRouter.setPerformanceOptimizer) {
                    streamingAgentRouter.setPerformanceOptimizer(streamingPerformanceOptimizer);
                    this.debug.info('Connected performance optimizer to agent router');
                }
            }

            // Set up session manager connections
            if (streamingSessionManager && streamingAgentRouter) {
                if (streamingAgentRouter.setSessionManager) {
                    streamingAgentRouter.setSessionManager(streamingSessionManager);
                    this.debug.info('Connected session manager to agent router');
                }
            }

            // Set up streaming manager integration
            const streamingManager = this.getStreamingManager();
            if (streamingManager && streamingAgentRouter) {
                // Enable agent routing in streaming manager
                if (streamingManager.setAgentRoutingEnabled) {
                    streamingManager.setAgentRoutingEnabled(true);
                    this.debug.info('Enabled agent routing in streaming manager');
                }

                // Set streaming agent router reference
                if (streamingManager.setStreamingAgentRouter) {
                    streamingManager.setStreamingAgentRouter(streamingAgentRouter);
                    this.debug.info('Set streaming agent router in streaming manager');
                }
            }

            return {
                success: true,
                connectionsEstablished: [
                    'ErrorHandler -> AgentRouter',
                    'PerformanceOptimizer -> AgentRouter', 
                    'SessionManager -> AgentRouter',
                    'StreamingManager -> AgentRouter'
                ].filter(Boolean)
            };

        } catch (error) {
            this.debug.error('Component connection setup failed', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Start health monitoring system
     * @param {Object} config - Configuration
     * @returns {Promise<Object>} - Start result
     */
    async startHealthMonitoring(config) {
        try {
            if (this.healthCheck.isRunning) {
                this.debug.warn('Health monitoring already running');
                return { success: true, message: 'Already running' };
            }

            const interval = setInterval(async () => {
                try {
                    await this.performHealthCheck();
                } catch (error) {
                    this.debug.error('Health check failed', { error: error.message });
                }
            }, config.healthCheckInterval);

            this.healthCheck.interval = interval;
            this.healthCheck.isRunning = true;
            this.resources.intervals.add(interval);

            this.debug.info('Health monitoring started', {
                interval: config.healthCheckInterval
            });

            return { success: true };

        } catch (error) {
            this.debug.error('Failed to start health monitoring', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Perform health check on all components
     * @returns {Promise<Object>} - Health check result
     */
    async performHealthCheck() {
        try {
            const healthResults = new Map();
            let overallHealth = 'healthy';

            // Check each component
            for (const [componentName, component] of this.components) {
                try {
                    let componentHealth = 'healthy';
                    const healthData = {};

                    // Component-specific health checks
                    if (component.getHealthStatus && typeof component.getHealthStatus === 'function') {
                        const status = await component.getHealthStatus();
                        componentHealth = status.health || 'healthy';
                        Object.assign(healthData, status);
                    } else {
                        // Basic health check - component exists and has expected methods
                        const expectedMethods = this.getExpectedMethodsForComponent(componentName);
                        const missingMethods = expectedMethods.filter(method => 
                            typeof component[method] !== 'function'
                        );

                        if (missingMethods.length > 0) {
                            componentHealth = 'degraded';
                            healthData.missingMethods = missingMethods;
                        }
                    }

                    healthResults.set(componentName, {
                        health: componentHealth,
                        lastChecked: Date.now(),
                        ...healthData
                    });

                    // Update overall health
                    if (componentHealth === 'unhealthy') {
                        overallHealth = 'unhealthy';
                    } else if (componentHealth === 'degraded' && overallHealth === 'healthy') {
                        overallHealth = 'degraded';
                    }

                } catch (error) {
                    healthResults.set(componentName, {
                        health: 'unhealthy',
                        lastChecked: Date.now(),
                        error: error.message
                    });
                    overallHealth = 'unhealthy';
                }
            }

            // Update health check state
            this.healthCheck.lastCheckTime = Date.now();
            this.healthCheck.componentHealth = healthResults;
            this.healthCheck.overallHealth = overallHealth;

            this.debug.debug('Health check completed', {
                overallHealth: overallHealth,
                componentCount: healthResults.size,
                healthyComponents: Array.from(healthResults.entries())
                    .filter(([, health]) => health.health === 'healthy')
                    .map(([name]) => name)
            });

            return {
                overallHealth: overallHealth,
                componentHealth: Object.fromEntries(healthResults),
                lastChecked: this.healthCheck.lastCheckTime,
                summary: {
                    total: healthResults.size,
                    healthy: Array.from(healthResults.values()).filter(h => h.health === 'healthy').length,
                    degraded: Array.from(healthResults.values()).filter(h => h.health === 'degraded').length,
                    unhealthy: Array.from(healthResults.values()).filter(h => h.health === 'unhealthy').length
                }
            };

        } catch (error) {
            this.debug.error('Health check failed', { error: error.message });
            return {
                overallHealth: 'unhealthy',
                error: error.message,
                lastChecked: Date.now()
            };
        }
    }

    /**
     * Get expected methods for a component (for basic health checking)
     * @param {string} componentName - Name of the component
     * @returns {Array<string>} - Expected method names
     */
    getExpectedMethodsForComponent(componentName) {
        const methodMap = {
            'StreamingAgentRouter': ['routeStreamingMessage', 'switchAgent'],
            'StreamingErrorHandler': ['handleError', 'handleRoutingTimeout'],
            'StreamingResponseHandler': ['processAgentResponse', 'chunkResponseForStreaming'],
            'StreamingPerformanceOptimizer': ['optimizeRouting', 'getOptimizationMetrics'],
            'StreamingSessionManager': ['createSession', 'updateSession'],
            'StreamingAgentMiddleware': ['interceptMessage', 'handleRoutingError']
        };

        return methodMap[componentName] || [];
    }

    /**
     * Get streaming manager instance
     * @returns {Object|null} - StreamingManager instance
     */
    getStreamingManager() {
        // Try to get from global scope
        if (window.streamingManager) {
            return window.streamingManager;
        }

        // Try to get from speech app
        if (window.speechApp && window.speechApp.streamingManager) {
            return window.speechApp.streamingManager;
        }

        return null;
    }

    /**
     * Sanitize configuration for logging (remove sensitive data)
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
     * Get initialization status
     * @returns {Object} - Current status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isInitializing: this.isInitializing,
            isShuttingDown: this.isShuttingDown,
            initializationStartTime: this.initializationStartTime,
            components: Array.from(this.components.keys()),
            healthStatus: this.healthCheck.overallHealth,
            lastHealthCheck: this.healthCheck.lastCheckTime,
            errorCount: this.initializationErrors.length + this.runtimeErrors.length,
            resourceCount: {
                intervals: this.resources.intervals.size,
                timeouts: this.resources.timeouts.size,
                eventListeners: this.resources.eventListeners.size,
                webSocketConnections: this.resources.webSocketConnections.size,
                audioContexts: this.resources.audioContexts.size
            }
        };
    }

    /**
     * Cleanup and dispose of all resources
     * @returns {Promise<Object>} - Cleanup result
     */
    async cleanup() {
        if (this.isShuttingDown) {
            this.debug.warn('Cleanup already in progress');
            return { success: true, message: 'Already shutting down' };
        }

        try {
            this.isShuttingDown = true;
            const cleanupStartTime = Date.now();

            this.debug.info('Starting streaming agent routing cleanup');

            // Stop health monitoring
            if (this.healthCheck.isRunning && this.healthCheck.interval) {
                clearInterval(this.healthCheck.interval);
                this.resources.intervals.delete(this.healthCheck.interval);
                this.healthCheck.isRunning = false;
                this.debug.info('Health monitoring stopped');
            }

            // Cleanup components in reverse order
            const cleanupResults = [];
            const reverseOrder = [...this.initializationOrder].reverse();

            for (const componentName of reverseOrder) {
                const component = this.components.get(componentName);
                if (component) {
                    try {
                        // Call component cleanup if available
                        if (component.cleanup && typeof component.cleanup === 'function') {
                            await component.cleanup();
                        } else if (component.dispose && typeof component.dispose === 'function') {
                            await component.dispose();
                        }

                        this.components.delete(componentName);
                        cleanupResults.push({
                            componentName: componentName,
                            success: true
                        });

                        this.debug.info(`Component ${componentName} cleaned up successfully`);

                    } catch (error) {
                        cleanupResults.push({
                            componentName: componentName,
                            success: false,
                            error: error.message
                        });

                        this.debug.error(`Failed to cleanup component ${componentName}`, {
                            error: error.message
                        });
                    }
                }
            }

            // Cleanup resources
            const resourceCleanup = await this.cleanupResources();

            // Reset state
            this.isInitialized = false;
            this.isInitializing = false;
            this.isShuttingDown = false;
            this.initializationStartTime = null;

            const cleanupTime = Date.now() - cleanupStartTime;

            this.debug.info('Streaming agent routing cleanup completed', {
                cleanupTime: cleanupTime,
                componentsCleanedUp: cleanupResults.filter(r => r.success).length,
                resourcesCleanedUp: resourceCleanup.totalCleaned
            });

            return {
                success: true,
                cleanupTime: cleanupTime,
                componentResults: cleanupResults,
                resourceCleanup: resourceCleanup
            };

        } catch (error) {
            this.debug.error('Cleanup failed', { error: error.message });
            this.isShuttingDown = false;
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Cleanup all tracked resources
     * @returns {Promise<Object>} - Cleanup result
     */
    async cleanupResources() {
        let totalCleaned = 0;
        const cleanupResults = {};

        try {
            // Clear intervals
            for (const interval of this.resources.intervals) {
                clearInterval(interval);
                totalCleaned++;
            }
            cleanupResults.intervals = this.resources.intervals.size;
            this.resources.intervals.clear();

            // Clear timeouts
            for (const timeout of this.resources.timeouts) {
                clearTimeout(timeout);
                totalCleaned++;
            }
            cleanupResults.timeouts = this.resources.timeouts.size;
            this.resources.timeouts.clear();

            // Remove event listeners
            for (const [element, listeners] of this.resources.eventListeners) {
                for (const [event, handler] of listeners) {
                    element.removeEventListener(event, handler);
                    totalCleaned++;
                }
            }
            cleanupResults.eventListeners = this.resources.eventListeners.size;
            this.resources.eventListeners.clear();

            // Close WebSocket connections
            for (const ws of this.resources.webSocketConnections) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close(1000, 'Cleanup');
                    totalCleaned++;
                }
            }
            cleanupResults.webSocketConnections = this.resources.webSocketConnections.size;
            this.resources.webSocketConnections.clear();

            // Close audio contexts
            for (const audioContext of this.resources.audioContexts) {
                if (audioContext.state !== 'closed') {
                    await audioContext.close();
                    totalCleaned++;
                }
            }
            cleanupResults.audioContexts = this.resources.audioContexts.size;
            this.resources.audioContexts.clear();

            return {
                success: true,
                totalCleaned: totalCleaned,
                details: cleanupResults
            };

        } catch (error) {
            this.debug.error('Resource cleanup failed', { error: error.message });
            return {
                success: false,
                error: error.message,
                totalCleaned: totalCleaned,
                details: cleanupResults
            };
        }
    }

    /**
     * Graceful shutdown with timeout
     * @param {number} timeout - Shutdown timeout in milliseconds
     * @returns {Promise<Object>} - Shutdown result
     */
    async gracefulShutdown(timeout = null) {
        const shutdownTimeout = timeout || this.shutdownTimeout;
        
        this.debug.info('Starting graceful shutdown', { timeout: shutdownTimeout });

        return new Promise(async (resolve) => {
            // Set up timeout
            const timeoutId = setTimeout(() => {
                this.debug.warn('Graceful shutdown timed out, forcing cleanup');
                resolve({
                    success: false,
                    error: 'Shutdown timeout',
                    forced: true
                });
            }, shutdownTimeout);

            try {
                const result = await this.cleanup();
                clearTimeout(timeoutId);
                resolve({
                    ...result,
                    graceful: true
                });
            } catch (error) {
                clearTimeout(timeoutId);
                resolve({
                    success: false,
                    error: error.message,
                    graceful: false
                });
            }
        });
    }
}

// Make the initializer available globally
window.StreamingAgentRoutingInitializer = StreamingAgentRoutingInitializer;

// Create global instance for easy access
window.streamingAgentRoutingInitializer = new StreamingAgentRoutingInitializer();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingAgentRoutingInitializer;
}
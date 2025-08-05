/**
 * Component Initializer
 * Ensures all components are properly loaded and initialized before running tests
 */
class ComponentInitializer {
    constructor() {
        this.initializationPromise = null;
        this.componentsReady = false;
        this.requiredComponents = [
            'streamingDebugPanel',
            'streamingRoutingMonitor',
            'streamingPerformanceDashboard',
            'streamingErrorTracker'
        ];
        
        // Optional components that may or may not be instantiated
        this.optionalComponents = [
            'streamingManager', // This is instantiated by the main app, not always available
            'streamingAgentRoutingInitializer' // Streaming agent routing system
        ];
        
        this.debug = console;
    }

    /**
     * Wait for all components to be initialized
     */
    async waitForComponents(timeout = 5000) {
        if (this.componentsReady) {
            return true;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkComponents = () => {
                const missingRequired = this.requiredComponents.filter(component => 
                    !window[component]
                );

                const availableOptional = this.optionalComponents.filter(component => 
                    window[component]
                );

                // Only require the core debug components to be ready
                if (missingRequired.length === 0) {
                    this.componentsReady = true;
                    this.debug.log('✅ Core components initialized successfully');
                    if (availableOptional.length > 0) {
                        this.debug.log('📦 Optional components available:', availableOptional);
                    }
                    resolve(true);
                    return;
                }

                // Check timeout
                if (Date.now() - startTime > timeout) {
                    this.debug.warn('⚠️ Component initialization timeout. Missing required components:', missingRequired);
                    // Still resolve true if we have the debug components
                    if (missingRequired.length <= 2) { // Allow some flexibility
                        this.debug.log('✅ Proceeding with available components');
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                    return;
                }

                // Continue checking
                setTimeout(checkComponents, 100);
            };

            checkComponents();
        });

        return this.initializationPromise;
    }

    /**
     * Get component status
     */
    getComponentStatus() {
        const status = {};
        
        // Check required components
        this.requiredComponents.forEach(component => {
            status[component] = {
                available: !!window[component],
                type: typeof window[component],
                initialized: this.isComponentInitialized(component),
                required: true
            };
        });

        // Check optional components
        this.optionalComponents.forEach(component => {
            status[component] = {
                available: !!window[component],
                type: typeof window[component],
                initialized: this.isComponentInitialized(component),
                required: false
            };
        });

        // Check for class availability (like StreamingManager class)
        const classComponents = ['StreamingManager', 'StreamingDebugPanel', 'StreamingRoutingMonitor'];
        classComponents.forEach(component => {
            if (window[component] && typeof window[component] === 'function') {
                status[component + '_class'] = {
                    available: true,
                    type: 'class',
                    initialized: true,
                    required: false
                };
            }
        });

        return status;
    }

    /**
     * Check if a specific component is initialized
     */
    isComponentInitialized(componentName) {
        const component = window[componentName];
        if (!component) return false;

        // Check for common initialization indicators
        if (typeof component === 'object') {
            // Check if it has expected methods or properties
            switch (componentName) {
                case 'streamingManager':
                    return typeof component.connect === 'function';
                case 'streamingDebugPanel':
                    return typeof component.show === 'function';
                case 'streamingRoutingMonitor':
                    return typeof component.getRoutingAnalytics === 'function';
                case 'streamingPerformanceDashboard':
                    return typeof component.show === 'function';
                case 'streamingErrorTracker':
                    return typeof component.trackError === 'function';
                default:
                    return true;
            }
        }

        return true;
    }

    /**
     * Initialize components in the correct order
     */
    async initializeComponents() {
        this.debug.log('🚀 Starting component initialization...');

        try {
            // Wait for DOM to be ready
            if (document.readyState !== 'complete') {
                await new Promise(resolve => {
                    if (document.readyState === 'complete') {
                        resolve();
                    } else {
                        window.addEventListener('load', resolve);
                    }
                });
            }

            // Wait for components to be available
            const success = await this.waitForComponents();
            
            if (success) {
                this.debug.log('✅ Component initialization completed successfully');
                
                // Initialize streaming agent routing if available
                await this.initializeStreamingAgentRouting();
                
                // Log component status
                const status = this.getComponentStatus();
                this.debug.log('📊 Component Status:', status);
                
                return true;
            } else {
                this.debug.warn('⚠️ Component initialization completed with missing components');
                return false;
            }

        } catch (error) {
            this.debug.error('❌ Component initialization failed:', error);
            return false;
        }
    }

    /**
     * Initialize streaming agent routing system
     */
    async initializeStreamingAgentRouting() {
        try {
            if (!window.streamingAgentRoutingInitializer) {
                this.debug.warn('⚠️ Streaming agent routing initializer not available');
                return false;
            }

            // Check if we have the required dependencies
            const dependencies = {
                streamingManager: this.getStreamingManager(),
                agentRouter: this.getAgentRouter(),
                conversationContextManager: this.getConversationContextManager(),
                debugManager: window.debugManager,
                systemLogger: window.systemLogger
            };

            // Debug dependency availability
            this.debug.log('🔍 Checking streaming agent routing dependencies:', {
                streamingManager: !!dependencies.streamingManager,
                agentRouter: !!dependencies.agentRouter,
                conversationContextManager: !!dependencies.conversationContextManager,
                debugManager: !!dependencies.debugManager,
                systemLogger: !!dependencies.systemLogger,
                speechApp: !!window.speechApp,
                speechAppAgentRouter: !!(window.speechApp && window.speechApp.agentRouter)
            });

            // Only initialize if we have the core dependencies
            if (!dependencies.streamingManager || !dependencies.agentRouter) {
                this.debug.log('📝 Streaming agent routing dependencies not available, skipping initialization', {
                    missingStreamingManager: !dependencies.streamingManager,
                    missingAgentRouter: !dependencies.agentRouter,
                    note: 'This is normal if the main application has not fully loaded yet'
                });
                return false;
            }

            this.debug.log('🔄 Initializing streaming agent routing system...');

            const config = {
                agentRoutingEnabled: true,
                routingLatencyThreshold: 100,
                maxRoutingTimeout: 200,
                circuitBreakerThreshold: 5,
                sessionUpdateRetries: 3,
                performanceOptimizationEnabled: true,
                healthCheckInterval: 15000
            };

            const result = await window.streamingAgentRoutingInitializer.initialize(config, dependencies);

            if (result.success) {
                this.debug.log('✅ Streaming agent routing initialized successfully', {
                    initializationTime: result.initializationTime,
                    componentsInitialized: result.componentsInitialized
                });
                return true;
            } else {
                this.debug.warn('⚠️ Streaming agent routing initialization failed', {
                    error: result.error,
                    note: 'This may be normal if dependencies are not fully ready'
                });
                return false;
            }

        } catch (error) {
            this.debug.error('❌ Streaming agent routing initialization error:', error);
            return false;
        }
    }

    /**
     * Get streaming manager instance
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
     */
    getConversationContextManager() {
        // Add debugging to understand what's happening
        console.log('🔍 ComponentInitializer.getConversationContextManager() called');
        console.log('- window.speechApp:', !!window.speechApp);
        console.log('- window.speechApp.conversationContextManager:', !!(window.speechApp && window.speechApp.conversationContextManager));
        console.log('- window.conversationContextManager:', !!window.conversationContextManager);
        console.log('- ConversationContextManager class:', typeof ConversationContextManager);
        
        if (window.speechApp && window.speechApp.conversationContextManager) {
            console.log('✅ Returning conversationContextManager from speechApp');
            return window.speechApp.conversationContextManager;
        }
        if (window.conversationContextManager) {
            console.log('✅ Returning global conversationContextManager');
            return window.conversationContextManager;
        }
        
        // Try to create one if the class is available
        if (typeof ConversationContextManager !== 'undefined') {
            try {
                console.log('🔧 Creating ConversationContextManager as last resort');
                window.conversationContextManager = new ConversationContextManager();
                return window.conversationContextManager;
            } catch (error) {
                console.error('❌ Failed to create ConversationContextManager as last resort:', error);
            }
        }
        
        console.warn('❌ ConversationContextManager not available anywhere');
        return null;
    }

    /**
     * Check if streaming manager is available (class or instance)
     */
    isStreamingManagerAvailable() {
        return !!(window.StreamingManager || window.streamingManager);
    }

    /**
     * Get streaming manager info
     */
    getStreamingManagerInfo() {
        return {
            classAvailable: !!window.StreamingManager,
            instanceAvailable: !!window.streamingManager,
            note: 'StreamingManager instance is created when streaming mode is first used'
        };
    }

    /**
     * Run safe tests after components are ready
     */
    async runSafeTests() {
        const initialized = await this.initializeComponents();
        
        if (!initialized) {
            this.debug.warn('⚠️ Not all components are ready, skipping tests');
            return false;
        }

        // Show component status
        const status = this.getComponentStatus();
        this.debug.log('📊 Component Status:', status);

        // Show streaming manager info
        const streamingInfo = this.getStreamingManagerInfo();
        this.debug.log('🔄 StreamingManager Info:', streamingInfo);

        // Run message flow tests if available
        if (window.runMessageFlowTests) {
            this.debug.log('🧪 Running message flow tests...');
            try {
                const results = await window.runMessageFlowTests();
                this.debug.log('📊 Test results:', results);
                return results;
            } catch (error) {
                this.debug.error('❌ Test execution failed:', error);
                return false;
            }
        } else {
            this.debug.warn('⚠️ Message flow tests not available');
            return false;
        }
    }

    /**
     * Enable debug mode
     */
    enableDebugMode() {
        localStorage.setItem('debugMode', 'true');
        this.debug.log('🐛 Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebugMode() {
        localStorage.removeItem('debugMode');
        this.debug.log('🔇 Debug mode disabled');
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugMode() {
        return localStorage.getItem('debugMode') === 'true' || 
               new URLSearchParams(window.location.search).get('debug') === 'true';
    }

    /**
     * Cleanup all initialized components
     */
    async cleanup() {
        try {
            this.debug.log('🧹 Starting component cleanup...');

            // Cleanup streaming agent routing first
            if (window.streamingAgentRoutingInitializer) {
                const routingCleanup = await window.streamingAgentRoutingInitializer.cleanup();
                if (routingCleanup.success) {
                    this.debug.log('✅ Streaming agent routing cleaned up successfully');
                } else {
                    this.debug.warn('⚠️ Streaming agent routing cleanup failed:', routingCleanup.error);
                }
            }

            // Reset component state
            this.componentsReady = false;
            this.initializationPromise = null;

            this.debug.log('✅ Component cleanup completed');
            return true;

        } catch (error) {
            this.debug.error('❌ Component cleanup failed:', error);
            return false;
        }
    }

    /**
     * Get health status of all components
     */
    async getHealthStatus() {
        try {
            const status = {
                overall: 'healthy',
                components: {},
                timestamp: Date.now()
            };

            // Check streaming agent routing health
            if (window.streamingAgentRoutingInitializer) {
                const routingStatus = window.streamingAgentRoutingInitializer.getStatus();
                status.components.streamingAgentRouting = {
                    initialized: routingStatus.isInitialized,
                    health: routingStatus.healthStatus,
                    componentCount: routingStatus.components.length,
                    lastHealthCheck: routingStatus.lastHealthCheck
                };

                if (routingStatus.healthStatus === 'unhealthy') {
                    status.overall = 'unhealthy';
                } else if (routingStatus.healthStatus === 'degraded' && status.overall === 'healthy') {
                    status.overall = 'degraded';
                }
            }

            // Check other components
            const componentStatus = this.getComponentStatus();
            for (const [componentName, componentInfo] of Object.entries(componentStatus)) {
                status.components[componentName] = {
                    available: componentInfo.available,
                    initialized: componentInfo.initialized,
                    health: componentInfo.available && componentInfo.initialized ? 'healthy' : 'unhealthy'
                };

                if (!componentInfo.available || !componentInfo.initialized) {
                    if (componentInfo.required) {
                        status.overall = 'unhealthy';
                    } else if (status.overall === 'healthy') {
                        status.overall = 'degraded';
                    }
                }
            }

            return status;

        } catch (error) {
            this.debug.error('Health status check failed:', error);
            return {
                overall: 'unhealthy',
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
}

// Initialize global component initializer
window.componentInitializer = new ComponentInitializer();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Function to check if core dependencies are ready
    const checkDependencies = () => {
        const hasConversationContextManager = !!(window.conversationContextManager || 
            (window.speechApp && window.speechApp.conversationContextManager));
        const hasSpeechApp = !!window.speechApp;
        
        console.log('🔍 ComponentInitializer dependency check:', {
            hasConversationContextManager,
            hasSpeechApp,
            hasAgentRouter: !!window.agentRouter,
            hasStreamingManager: !!(window.StreamingManager || window.streamingManager)
        });
        
        return hasConversationContextManager && hasSpeechApp;
    };
    
    // Function to initialize with retries
    const initializeWithRetries = async (attempt = 1, maxAttempts = 5) => {
        console.log(`🚀 ComponentInitializer attempt ${attempt}/${maxAttempts}`);
        
        if (checkDependencies()) {
            console.log('✅ Dependencies ready, initializing components...');
            const initializer = window.componentInitializer;
            
            if (initializer.isDebugMode()) {
                initializer.debug.log('🐛 Debug mode detected, initializing components...');
                await initializer.runSafeTests();
            } else {
                // Just initialize components without running tests
                await initializer.initializeComponents();
            }
        } else if (attempt < maxAttempts) {
            console.log(`⏳ Dependencies not ready, retrying in ${attempt * 1000}ms...`);
            setTimeout(() => initializeWithRetries(attempt + 1, maxAttempts), attempt * 1000);
        } else {
            console.warn('⚠️ Max attempts reached, initializing anyway...');
            const initializer = window.componentInitializer;
            await initializer.initializeComponents();
        }
    };
    
    // Start with initial delay
    setTimeout(() => initializeWithRetries(), 1500);
});

// Make functions available globally
window.initializeComponents = () => window.componentInitializer.initializeComponents();
window.runSafeTests = () => window.componentInitializer.runSafeTests();
window.getComponentStatus = () => window.componentInitializer.getComponentStatus();
window.getStreamingManagerInfo = () => window.componentInitializer.getStreamingManagerInfo();
window.cleanupComponents = () => window.componentInitializer.cleanup();
window.getComponentHealthStatus = () => window.componentInitializer.getHealthStatus();

// Helper function to check if we're in a test environment
window.isTestEnvironment = () => {
    return window.location.pathname.includes('/test/') || 
           window.location.search.includes('test=true') ||
           localStorage.getItem('testMode') === 'true';
};

// Page lifecycle event handlers for proper cleanup
window.addEventListener('beforeunload', async (event) => {
    // Attempt graceful cleanup before page unload
    if (window.streamingAgentRoutingInitializer) {
        // Don't wait for cleanup to complete as the page is unloading
        window.streamingAgentRoutingInitializer.gracefulShutdown(2000).catch(() => {
            // Ignore errors during shutdown
        });
    }
});

window.addEventListener('pagehide', async (event) => {
    // Cleanup when page is hidden (mobile browsers)
    if (window.componentInitializer) {
        window.componentInitializer.cleanup().catch(() => {
            // Ignore errors during cleanup
        });
    }
});

// Visibility change handler for resource management
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // Page is hidden, consider pausing non-essential operations
        if (window.streamingAgentRoutingInitializer) {
            const status = window.streamingAgentRoutingInitializer.getStatus();
            if (status.isInitialized) {
                // Log that page is hidden for debugging
                console.log('Page hidden, streaming agent routing still active');
            }
        }
    } else if (document.visibilityState === 'visible') {
        // Page is visible again, resume operations if needed
        if (window.streamingAgentRoutingInitializer) {
            const status = window.streamingAgentRoutingInitializer.getStatus();
            if (status.isInitialized) {
                // Perform health check after page becomes visible
                window.streamingAgentRoutingInitializer.performHealthCheck().catch(() => {
                    // Ignore errors during health check
                });
            }
        }
    }
});
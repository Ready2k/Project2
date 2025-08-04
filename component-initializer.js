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
            'streamingManager' // This is instantiated by the main app, not always available
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
}

// Initialize global component initializer
window.componentInitializer = new ComponentInitializer();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure all scripts are loaded
    setTimeout(async () => {
        const initializer = window.componentInitializer;
        
        if (initializer.isDebugMode()) {
            initializer.debug.log('🐛 Debug mode detected, initializing components...');
            await initializer.runSafeTests();
        } else {
            // Just initialize components without running tests
            await initializer.initializeComponents();
        }
    }, 1000);
});

// Make functions available globally
window.initializeComponents = () => window.componentInitializer.initializeComponents();
window.runSafeTests = () => window.componentInitializer.runSafeTests();
window.getComponentStatus = () => window.componentInitializer.getComponentStatus();
window.getStreamingManagerInfo = () => window.componentInitializer.getStreamingManagerInfo();

// Helper function to check if we're in a test environment
window.isTestEnvironment = () => {
    return window.location.pathname.includes('/test/') || 
           window.location.search.includes('test=true') ||
           localStorage.getItem('testMode') === 'true';
};
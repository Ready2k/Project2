/**
 * Extensibility Initialization - Initialize all extensibility components
 * Sets up LLM providers, agent loading, and telemetry hooks
 */

/**
 * Initialize the extensibility system
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} - Initialization result
 */
async function initializeExtensibilitySystem(config = {}) {
    const debug = window.debugManager?.createModuleLogger('ExtensibilityInit') || console;
    
    try {
        debug.info('Initializing extensibility system', { config });
        
        const results = {
            llmProviderManager: null,
            agentLoader: null,
            telemetryHooks: null,
            success: false,
            errors: []
        };
        
        // 1. Initialize LLM Provider Manager
        try {
            debug.info('Initializing LLM Provider Manager');
            window.llmProviderManager = new LLMProviderManager();
            results.llmProviderManager = window.llmProviderManager;
            
            // Configure additional providers if specified
            if (config.llmProviders) {
                for (const [providerName, providerConfig] of Object.entries(config.llmProviders)) {
                    await window.llmProviderManager.updateProviderConfig(providerName, providerConfig);
                }
            }
            
            debug.info('LLM Provider Manager initialized successfully');
        } catch (error) {
            const errorMsg = `Failed to initialize LLM Provider Manager: ${error.message}`;
            debug.error(errorMsg);
            results.errors.push(errorMsg);
        }
        
        // 2. Initialize Telemetry Hooks (already initialized globally)
        try {
            debug.info('Setting up telemetry hooks');
            
            if (window.telemetryHooksManager) {
                results.telemetryHooks = window.telemetryHooksManager;
                
                // Create predefined hooks if enabled
                if (config.enablePredefinedHooks !== false) {
                    window.telemetryHooksManager.createPredefinedHooks();
                }
                
                // Register custom hooks if provided
                if (config.customHooks && Array.isArray(config.customHooks)) {
                    for (const hookConfig of config.customHooks) {
                        try {
                            window.telemetryHooksManager.registerHook(
                                hookConfig.events,
                                hookConfig.callback,
                                hookConfig.options
                            );
                        } catch (hookError) {
                            debug.error('Failed to register custom hook', { error: hookError.message });
                        }
                    }
                }
                
                debug.info('Telemetry hooks configured successfully');
            } else {
                throw new Error('Telemetry hooks manager not available');
            }
        } catch (error) {
            const errorMsg = `Failed to configure telemetry hooks: ${error.message}`;
            debug.error(errorMsg);
            results.errors.push(errorMsg);
        }
        
        // 3. Initialize Agent Loader (requires AgentRouter)
        try {
            debug.info('Initializing Agent Loader');
            
            if (!window.agentRouter) {
                throw new Error('AgentRouter not available - required for Agent Loader');
            }
            
            window.agentLoader = new AgentLoader(window.agentRouter);
            results.agentLoader = window.agentLoader;
            
            // Load agents from configuration if provided
            if (config.agents) {
                const loadResults = await window.agentLoader.loadAgentsFromConfig(config.agents);
                debug.info('Agents loaded from configuration', loadResults);
            }
            
            debug.info('Agent Loader initialized successfully');
        } catch (error) {
            const errorMsg = `Failed to initialize Agent Loader: ${error.message}`;
            debug.error(errorMsg);
            results.errors.push(errorMsg);
        }
        
        // 4. Integrate telemetry with existing systems
        try {
            debug.info('Integrating telemetry with existing systems');
            
            // Hook into agent telemetry if available
            if (window.agentTelemetry && window.telemetryEmitter) {
                // Override agent telemetry methods to emit events
                const originalRecordActivation = window.agentTelemetry.recordActivation.bind(window.agentTelemetry);
                const originalRecordCompletion = window.agentTelemetry.recordCompletion.bind(window.agentTelemetry);
                
                window.agentTelemetry.recordActivation = function(agentName, activationData) {
                    originalRecordActivation(agentName, activationData);
                    window.telemetryEmitter.agentActivated(agentName, activationData);
                };
                
                window.agentTelemetry.recordCompletion = function(agentName, completionData) {
                    originalRecordCompletion(agentName, completionData);
                    window.telemetryEmitter.agentCompleted(agentName, completionData);
                };
            }
            
            debug.info('Telemetry integration completed');
        } catch (error) {
            const errorMsg = `Failed to integrate telemetry: ${error.message}`;
            debug.error(errorMsg);
            results.errors.push(errorMsg);
        }
        
        // 5. Set up global extensibility API
        try {
            debug.info('Setting up global extensibility API');
            
            window.extensibilityAPI = {
                // LLM Provider Management
                llm: {
                    registerProvider: (provider, config) => window.llmProviderManager?.registerProvider(provider, config),
                    getProvider: (name) => window.llmProviderManager?.getProvider(name),
                    setDefaultProvider: (name) => window.llmProviderManager?.setDefaultProvider(name),
                    setAgentProvider: (agent, provider) => window.llmProviderManager?.setAgentProvider(agent, provider),
                    getStats: () => window.llmProviderManager?.getProviderStats()
                },
                
                // Agent Management
                agents: {
                    registerFactory: (name, factory) => window.agentLoader?.registerAgentFactory(name, factory),
                    loadAgent: (name, config) => window.agentLoader?.loadAgent(name, config),
                    unloadAgent: (name) => window.agentLoader?.unloadAgent(name),
                    reloadAgent: (name, config) => window.agentLoader?.reloadAgent(name, config),
                    getLoaded: () => window.agentLoader?.getLoadedAgents(),
                    getAvailable: () => window.agentLoader?.getAvailableFactories()
                },
                
                // Telemetry Management
                telemetry: {
                    registerHook: (events, callback, options) => window.telemetryHooksManager?.registerHook(events, callback, options),
                    unregisterHook: (hookId) => window.telemetryHooksManager?.unregisterHook(hookId),
                    emit: (event, data, context) => window.telemetryHooksManager?.emit(event, data, context),
                    getStats: () => window.telemetryHooksManager?.getHookStats(),
                    enable: () => window.telemetryHooksManager?.setEnabled(true),
                    disable: () => window.telemetryHooksManager?.setEnabled(false)
                },
                
                // Configuration Management
                config: {
                    exportAll: () => ({
                        llmProviders: window.llmProviderManager?.exportConfigurations(),
                        agents: window.agentLoader?.exportConfiguration(),
                        telemetry: window.telemetryHooksManager?.exportHooks()
                    }),
                    importAll: async (config) => {
                        const results = {};
                        if (config.llmProviders) {
                            results.llmProviders = await window.llmProviderManager?.importConfigurations(config.llmProviders);
                        }
                        if (config.agents) {
                            results.agents = await window.agentLoader?.importConfiguration(config.agents);
                        }
                        return results;
                    }
                },
                
                // Utility functions
                utils: {
                    generateId: () => `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    validateAgent: (agent) => window.agentLoader?.validateAgentInterface(agent),
                    getSystemInfo: () => ({
                        llmProviders: window.llmProviderManager?.getAvailableProviders(),
                        loadedAgents: window.agentLoader?.getLoadedAgents().map(a => a.name),
                        telemetryEnabled: window.telemetryHooksManager?.isEnabled(),
                        version: '1.0.0'
                    })
                }
            };
            
            debug.info('Global extensibility API configured');
        } catch (error) {
            const errorMsg = `Failed to set up extensibility API: ${error.message}`;
            debug.error(errorMsg);
            results.errors.push(errorMsg);
        }
        
        // Determine overall success
        results.success = results.errors.length === 0;
        
        if (results.success) {
            debug.info('Extensibility system initialized successfully', {
                llmProviders: window.llmProviderManager?.getAvailableProviders().length || 0,
                loadedAgents: window.agentLoader?.getLoadedAgents().length || 0,
                telemetryHooks: window.telemetryHooksManager?.getHookStats().totalHooks || 0
            });
        } else {
            debug.error('Extensibility system initialization completed with errors', {
                errorCount: results.errors.length,
                errors: results.errors
            });
        }
        
        return results;
    } catch (error) {
        debug.error('Critical error during extensibility system initialization', {
            error: error.message,
            stack: error.stack
        });
        
        return {
            success: false,
            errors: [`Critical initialization error: ${error.message}`],
            llmProviderManager: null,
            agentLoader: null,
            telemetryHooks: null
        };
    }
}

/**
 * Quick setup function for common configurations
 * @param {string} preset - Preset configuration name
 * @returns {Promise<Object>} - Initialization result
 */
async function quickSetup(preset = 'default') {
    const presets = {
        default: {
            enablePredefinedHooks: true,
            llmProviders: {
                openai: {
                    // Will use existing API key from localStorage or environment
                }
            }
        },
        
        development: {
            enablePredefinedHooks: true,
            llmProviders: {
                openai: {},
                claude: {} // Will only initialize if API key is available
            },
            customHooks: [
                {
                    events: ['agent.completed'],
                    callback: (event) => {
                        console.log('Development Hook - Agent Completed:', {
                            agent: event.data.agentName,
                            time: event.data.processingTime,
                            success: event.data.success
                        });
                    },
                    options: { async: true, metadata: { type: 'development' } }
                }
            ]
        },
        
        production: {
            enablePredefinedHooks: false, // Disable verbose logging in production
            llmProviders: {
                openai: {}
            },
            customHooks: [
                {
                    events: ['agent.error', 'llm.error'],
                    callback: (event) => {
                        // Send to external monitoring service
                        console.error('Production Error:', event);
                    },
                    options: { async: true, priority: 1, metadata: { type: 'production_monitoring' } }
                }
            ]
        },
        
        minimal: {
            enablePredefinedHooks: false
        }
    };
    
    const config = presets[preset] || presets.default;
    return await initializeExtensibilitySystem(config);
}

/**
 * Check if extensibility system is ready
 * @returns {boolean} - True if system is ready
 */
function isExtensibilityReady() {
    return !!(
        window.llmProviderManager &&
        window.telemetryHooksManager &&
        window.extensibilityAPI
    );
}

/**
 * Get extensibility system status
 * @returns {Object} - System status
 */
function getExtensibilityStatus() {
    return {
        ready: isExtensibilityReady(),
        components: {
            llmProviderManager: !!window.llmProviderManager,
            agentLoader: !!window.agentLoader,
            telemetryHooksManager: !!window.telemetryHooksManager,
            extensibilityAPI: !!window.extensibilityAPI
        },
        stats: isExtensibilityReady() ? {
            llmProviders: window.llmProviderManager.getAvailableProviders().length,
            loadedAgents: window.agentLoader?.getLoadedAgents().length || 0,
            telemetryHooks: window.telemetryHooksManager.getHookStats().totalHooks
        } : null
    };
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeExtensibilitySystem,
        quickSetup,
        isExtensibilityReady,
        getExtensibilityStatus
    };
} else {
    window.initializeExtensibilitySystem = initializeExtensibilitySystem;
    window.quickSetup = quickSetup;
    window.isExtensibilityReady = isExtensibilityReady;
    window.getExtensibilityStatus = getExtensibilityStatus;
}
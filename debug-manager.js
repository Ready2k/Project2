class DebugManager {
    constructor() {
        // Load debug setting from localStorage, default to false (off)
        this.debugEnabled = localStorage.getItem('debug_enabled') === 'true' || false;
        // Load test mode setting from localStorage, default to 'mock'
        this.testMode = localStorage.getItem('test_mode') || 'mock';
        this.debugLevels = {
            LOG: 'log',
            DEBUG: 'debug',
            WARN: 'warn',
            ERROR: 'error',
            INFO: 'info'
        };
    }

    isEnabled() {
        return this.debugEnabled;
    }

    enable() {
        this.debugEnabled = true;
        localStorage.setItem('debug_enabled', 'true');
        this.log('Debug mode enabled');
    }

    disable() {
        this.log('Debug mode disabled');
        this.debugEnabled = false;
        localStorage.setItem('debug_enabled', 'false');
    }

    toggle() {
        if (this.debugEnabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.debugEnabled;
    }

    // Main logging method
    _log(level, module, message, data = null) {
        if (!this.debugEnabled && level !== this.debugLevels.ERROR) {
            return; // Only show errors when debug is disabled
        }

        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}] ${module}:`;

        switch (level) {
            case this.debugLevels.LOG:
                console.log(prefix, message, data || '');
                break;
            case this.debugLevels.DEBUG:
                console.debug(prefix, message, data || '');
                break;
            case this.debugLevels.WARN:
                console.warn(prefix, message, data || '');
                break;
            case this.debugLevels.ERROR:
                console.error(prefix, message, data || '');
                break;
            case this.debugLevels.INFO:
                console.info(prefix, message, data || '');
                break;
        }
    }

    // Convenience methods for different modules
    log(module, message, data = null) {
        this._log(this.debugLevels.LOG, module, message, data);
    }

    warn(module, message, data = null) {
        this._log(this.debugLevels.WARN, module, message, data);
    }

    error(module, message, data = null) {
        this._log(this.debugLevels.ERROR, module, message, data);
    }

    info(module, message, data = null) {
        this._log(this.debugLevels.INFO, module, message, data);
    }

    debug(module, message, data = null) {
        this._log(this.debugLevels.DEBUG, module, message, data);
    }

    // Module-specific loggers
    createModuleLogger(moduleName) {
        return {
            log: (message, data) => this.log(moduleName, message, data),
            debug: (message, data) => this.debug(moduleName, message, data),
            info: (message, data) => this.info(moduleName, message, data),
            warn: (message, data) => this.warn(moduleName, message, data),
            error: (message, data) => this.error(moduleName, message, data)
        };
    }

    // Performance timing
    time(label) {
        if (this.debugEnabled) {
            console.time(label);
        }
    }

    timeEnd(label) {
        if (this.debugEnabled) {
            console.timeEnd(label);
        }
    }

    // Group logging for complex operations
    group(label) {
        if (this.debugEnabled) {
            console.group(label);
        }
    }

    groupEnd() {
        if (this.debugEnabled) {
            console.groupEnd();
        }
    }

    // Table logging for structured data
    table(data) {
        if (this.debugEnabled) {
            console.table(data);
        }
    }

    // Agent-specific debugging methods
    logAgentRouting(inputText, selectedAgent, availableAgents) {
        if (!this.debugEnabled) return;

        this.group(`🤖 Agent Routing: "${inputText.substring(0, 50)}..."`);
        this.info('AgentRouter', `Selected Agent: ${selectedAgent ? selectedAgent.name : 'None (Fallback)'}`);
        this.info('AgentRouter', `Available Agents: ${availableAgents.map(a => a.name).join(', ')}`);

        if (selectedAgent) {
            this.info('AgentRouter', `Agent Description: ${selectedAgent.description}`);
        }

        this.groupEnd();
    }

    logAgentPerformance(agentName, metrics) {
        if (!this.debugEnabled) return;

        this.group(`📊 Agent Performance: ${agentName}`);
        this.table({
            'Activations': metrics.activations,
            'Completions': metrics.completions,
            'Success Rate': `${(metrics.successRate * 100).toFixed(1)}%`,
            'Avg Processing Time': `${Math.round(metrics.averageProcessingTime)}ms`,
            'Avg Tokens Used': Math.round(metrics.averageTokensUsed),
            'Total Processing Time': `${Math.round(metrics.totalProcessingTime)}ms`,
            'Total Tokens Used': metrics.totalTokensUsed
        });
        this.groupEnd();
    }

    logAgentTelemetryReport() {
        if (!this.debugEnabled || !window.agentTelemetry) return;

        const report = window.agentTelemetry.generateDebugReport(10);
        this.group('📈 Agent Telemetry Report');
        console.log(report);
        this.groupEnd();
    }

    showAgentMetrics() {
        if (!window.agentTelemetry) {
            this.warn('DebugManager', 'Agent telemetry not available');
            return;
        }

        const globalMetrics = window.agentTelemetry.getGlobalMetrics();
        const agentMetrics = window.agentTelemetry.getAllAgentMetrics();

        this.group('🎯 Agent System Metrics');

        // Global metrics
        this.info('Global', 'Session Metrics', {
            'Total Activations': globalMetrics.totalActivations,
            'Total Completions': globalMetrics.totalCompletions,
            'Success Rate': `${(globalMetrics.globalSuccessRate * 100).toFixed(1)}%`,
            'Average Processing Time': `${Math.round(globalMetrics.averageProcessingTime)}ms`,
            'Total Tokens Used': globalMetrics.totalTokensUsed,
            'Session Duration': `${Math.round(globalMetrics.sessionDuration / 1000)}s`,
            'Active Agents': globalMetrics.activeAgents
        });

        // Per-agent metrics
        if (agentMetrics.length > 0) {
            this.info('Agents', 'Individual Agent Performance');
            agentMetrics.forEach(agent => {
                this.logAgentPerformance(agent.name, agent);
            });
        }

        this.groupEnd();
    }

    // Enhanced agent debugging commands
    enableAgentTelemetry() {
        if (window.agentTelemetry) {
            window.agentTelemetry.enable();
            this.info('DebugManager', 'Agent telemetry enabled');
        } else {
            this.warn('DebugManager', 'Agent telemetry not available');
        }
    }

    disableAgentTelemetry() {
        if (window.agentTelemetry) {
            window.agentTelemetry.disable();
            this.info('DebugManager', 'Agent telemetry disabled');
        } else {
            this.warn('DebugManager', 'Agent telemetry not available');
        }
    }

    resetAgentMetrics() {
        if (window.agentTelemetry) {
            window.agentTelemetry.reset();
            this.info('DebugManager', 'Agent metrics reset');
        } else {
            this.warn('DebugManager', 'Agent telemetry not available');
        }
    }

    exportAgentData() {
        if (!window.agentTelemetry) {
            this.warn('DebugManager', 'Agent telemetry not available');
            return null;
        }

        const data = window.agentTelemetry.exportData();
        this.info('DebugManager', 'Agent data exported', data);

        // Also log to console for easy copying
        console.log('Agent Telemetry Export:', JSON.stringify(data, null, 2));

        return data;
    }

    // Agent configuration and management debugging methods
    showAgentStatus() {
        if (!window.speechToSpeechApp || !window.speechToSpeechApp.agentRouter) {
            this.warn('DebugManager', 'Agent system not available');
            return;
        }

        const router = window.speechToSpeechApp.agentRouter;
        const stats = router.getStats();
        const configManager = router.getConfigManager();

        this.group('🔧 Agent Configuration Status');

        // Overall status
        this.info('System', 'Agent System Overview', {
            'Total Agents': stats.totalAgents,
            'Enabled Agents': stats.enabledAgents,
            'Disabled Agents': stats.disabledAgents
        });

        // Individual agent status
        this.info('Agents', 'Individual Agent Status');
        stats.agentDescriptions.forEach(agent => {
            const config = configManager.getAgentConfig(agent.name);
            const status = agent.enabled ? '✅ Enabled' : '❌ Disabled';

            console.log(`  ${status} ${agent.name} (Priority: ${agent.priority})`);
            console.log(`    Description: ${agent.description}`);
            if (config) {
                console.log(`    LLM Model: ${config.llmModel}`);
                console.log(`    Telemetry: ${config.telemetryEnabled ? 'On' : 'Off'}`);
            }
        });

        // Priority order
        if (stats.priorityOrder.length > 0) {
            this.info('Priority', 'Agent Priority Order (Enabled Only)');
            stats.priorityOrder.forEach((agent, index) => {
                console.log(`  ${index + 1}. ${agent.name} (Priority: ${agent.priority})`);
            });
        }

        this.groupEnd();
    }

    showAgentConfigurations() {
        if (!window.speechToSpeechApp || !window.speechToSpeechApp.agentRouter) {
            this.warn('DebugManager', 'Agent system not available');
            return;
        }

        const configManager = window.speechToSpeechApp.agentRouter.getConfigManager();
        const allConfigs = configManager.getAllConfigs();

        this.group('⚙️ Agent Configurations');

        Object.entries(allConfigs).forEach(([agentName, config]) => {
            this.info(agentName, 'Configuration Details', {
                'Enabled': config.enabled,
                'Priority': config.priority,
                'LLM Provider': config.llmProvider,
                'LLM Model': config.llmModel,
                'Telemetry': config.telemetryEnabled,
                'Max Retries': config.maxRetries,
                'Timeout': `${config.timeout}ms`,
                'Custom Settings': Object.keys(config.customSettings || {}).length > 0 ? config.customSettings : 'None'
            });
        });

        this.groupEnd();
    }

    enableAgent(agentName) {
        if (!window.speechToSpeechApp || !window.speechToSpeechApp.agentRouter) {
            this.warn('DebugManager', 'Agent system not available');
            return false;
        }

        const success = window.speechToSpeechApp.agentRouter.enableAgent(agentName);
        if (success) {
            this.info('DebugManager', `Agent ${agentName} enabled`);
        } else {
            this.warn('DebugManager', `Failed to enable agent ${agentName}`);
        }
        return success;
    }

    disableAgent(agentName) {
        if (!window.speechToSpeechApp || !window.speechToSpeechApp.agentRouter) {
            this.warn('DebugManager', 'Agent system not available');
            return false;
        }

        const success = window.speechToSpeechApp.agentRouter.disableAgent(agentName);
        if (success) {
            this.info('DebugManager', `Agent ${agentName} disabled`);
        } else {
            this.warn('DebugManager', `Failed to disable agent ${agentName}`);
        }
        return success;
    }

    setAgentPriority(agentName, priority) {
        if (!window.speechToSpeechApp || !window.speechToSpeechApp.agentRouter) {
            this.warn('DebugManager', 'Agent system not available');
            return false;
        }

        const success = window.speechToSpeechApp.agentRouter.setAgentPriority(agentName, priority);
        if (success) {
            this.info('DebugManager', `Agent ${agentName} priority set to ${priority}`);
        } else {
            this.warn('DebugManager', `Failed to set priority for agent ${agentName}`);
        }
        return success;
    }

    exportAgentConfigurations() {
        if (!window.speechToSpeechApp || !window.speechToSpeechApp.agentRouter) {
            this.warn('DebugManager', 'Agent system not available');
            return null;
        }

        const configManager = window.speechToSpeechApp.agentRouter.getConfigManager();
        const configJson = configManager.exportConfigurations();

        this.info('DebugManager', 'Agent configurations exported');
        console.log('Agent Configurations Export:', configJson);

        return configJson;
    }

    importAgentConfigurations(configJson) {
        if (!window.speechToSpeechApp || !window.speechToSpeechApp.agentRouter) {
            this.warn('DebugManager', 'Agent system not available');
            return false;
        }

        const configManager = window.speechToSpeechApp.agentRouter.getConfigManager();
        const success = configManager.importConfigurations(configJson);

        if (success) {
            this.info('DebugManager', 'Agent configurations imported successfully');
            // Reapply configurations to agents
            window.speechToSpeechApp.agentRouter.applyConfigurationsToAgents();
        } else {
            this.warn('DebugManager', 'Failed to import agent configurations');
        }

        return success;
    }

    resetAgentConfigurations() {
        if (!window.speechToSpeechApp || !window.speechToSpeechApp.agentRouter) {
            this.warn('DebugManager', 'Agent system not available');
            return false;
        }

        const configManager = window.speechToSpeechApp.agentRouter.getConfigManager();
        configManager.resetToDefaults();

        // Reapply configurations to agents
        window.speechToSpeechApp.agentRouter.applyConfigurationsToAgents();

        this.info('DebugManager', 'Agent configurations reset to defaults');
        return true;
    }

    // Test mode management
    getTestMode() {
        return this.testMode;
    }

    setTestMode(mode) {
        if (mode !== 'mock' && mode !== 'real') {
            this.warn('DebugManager', `Invalid test mode: ${mode}. Use 'mock' or 'real'`);
            return false;
        }

        this.testMode = mode;
        localStorage.setItem('test_mode', mode);
        this.info('DebugManager', `Test mode set to: ${mode}`);
        return true;
    }

    toggleTestMode() {
        const newMode = this.testMode === 'mock' ? 'real' : 'mock';
        this.setTestMode(newMode);
        return newMode;
    }

    isRealTestMode() {
        return this.testMode === 'real';
    }

    isMockTestMode() {
        return this.testMode === 'mock';
    }

}

// Create global debug manager instance
window.debugManager = new DebugManager();

// Global debugging functions for easy access in console
window.showAgentMetrics = () => window.debugManager.showAgentMetrics();
window.showAgentReport = () => window.debugManager.logAgentTelemetryReport();
window.exportAgentData = () => window.debugManager.exportAgentData();
window.resetAgentMetrics = () => window.debugManager.resetAgentMetrics();
window.enableAgentTelemetry = () => window.debugManager.enableAgentTelemetry();
window.disableAgentTelemetry = () => window.debugManager.disableAgentTelemetry();

// Agent configuration management functions
window.showAgentStatus = () => window.debugManager.showAgentStatus();
window.showAgentConfigurations = () => window.debugManager.showAgentConfigurations();
window.enableAgent = (agentName) => window.debugManager.enableAgent(agentName);
window.disableAgent = (agentName) => window.debugManager.disableAgent(agentName);
window.setAgentPriority = (agentName, priority) => window.debugManager.setAgentPriority(agentName, priority);
window.exportAgentConfigurations = () => window.debugManager.exportAgentConfigurations();
window.importAgentConfigurations = (configJson) => window.debugManager.importAgentConfigurations(configJson);
window.resetAgentConfigurations = () => window.debugManager.resetAgentConfigurations();

// Test mode management functions
window.getTestMode = () => window.debugManager.getTestMode();
window.setTestMode = (mode) => window.debugManager.setTestMode(mode);
window.toggleTestMode = () => window.debugManager.toggleTestMode();
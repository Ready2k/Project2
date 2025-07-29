class SystemLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 100; // Keep last 100 logs
        this.logElement = null;
        this.autoScroll = true;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        this.logElement = document.getElementById('systemLogs');
        if (this.logElement) {
            this.logElement.innerHTML = '<div class="log-entry system-info">System logger initialized</div>';
        }
        
        // Hook into existing systems
        this.setupSystemHooks();
        this.log('SYSTEM', 'System logger initialized', 'info');
    }

    setupSystemHooks() {
        // Hook into debug manager if available
        if (window.debugManager) {
            const originalLog = window.debugManager._log.bind(window.debugManager);
            window.debugManager._log = (level, module, message, data) => {
                // Call original method
                originalLog(level, module, message, data);
                
                // Also log to system logs if it's important
                if (level === 'error' || level === 'warn' || module === 'SYSTEM') {
                    this.log(module, message, level, data);
                }
            };
        }

        // Hook into window errors
        window.addEventListener('error', (event) => {
            this.log('ERROR', `JavaScript Error: ${event.message}`, 'error', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Hook into unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.log('ERROR', `Unhandled Promise Rejection: ${event.reason}`, 'error');
        });

        // Hook into API calls if api client exists
        this.setupAPIHooks();
        
        // Hook into agent system if available
        this.setupAgentHooks();
    }

    setupAPIHooks() {
        // Monitor fetch requests
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const url = args[0];
            const options = args[1] || {};
            
            this.log('API', `Request: ${options.method || 'GET'} ${url}`, 'info');
            
            try {
                const response = await originalFetch(...args);
                
                if (!response.ok) {
                    this.log('API', `Request failed: ${response.status} ${response.statusText} for ${url}`, 'warn');
                } else {
                    this.log('API', `Request successful: ${response.status} for ${url}`, 'info');
                }
                
                return response;
            } catch (error) {
                this.log('API', `Request error: ${error.message} for ${url}`, 'error');
                throw error;
            }
        };
    }

    setupAgentHooks() {
        // Monitor agent routing if available
        if (window.speechToSpeechApp && window.speechToSpeechApp.agentRouter) {
            const router = window.speechToSpeechApp.agentRouter;
            
            // Hook into agent selection
            const originalSelectAgent = router.selectAgent?.bind(router);
            if (originalSelectAgent) {
                router.selectAgent = (inputText) => {
                    const result = originalSelectAgent(inputText);
                    if (result) {
                        this.log('AGENT', `Selected agent: ${result.name} for input: "${inputText.substring(0, 50)}..."`, 'info');
                    } else {
                        this.log('AGENT', `No agent selected for input: "${inputText.substring(0, 50)}..."`, 'warn');
                    }
                    return result;
                };
            }
        }

        // Monitor streaming connections
        if (window.streamingManager) {
            const originalConnect = window.streamingManager.connect?.bind(window.streamingManager);
            if (originalConnect) {
                window.streamingManager.connect = async () => {
                    this.log('STREAMING', 'Attempting to connect to streaming service', 'info');
                    try {
                        const result = await originalConnect();
                        this.log('STREAMING', 'Successfully connected to streaming service', 'info');
                        return result;
                    } catch (error) {
                        this.log('STREAMING', `Failed to connect to streaming service: ${error.message}`, 'error');
                        throw error;
                    }
                };
            }

            const originalDisconnect = window.streamingManager.disconnect?.bind(window.streamingManager);
            if (originalDisconnect) {
                window.streamingManager.disconnect = () => {
                    this.log('STREAMING', 'Disconnecting from streaming service', 'info');
                    return originalDisconnect();
                };
            }
        }
    }

    log(module, message, level = 'info', data = null) {
        const timestamp = new Date();
        const logEntry = {
            timestamp,
            module,
            message,
            level,
            data,
            id: Date.now() + Math.random()
        };

        // Add to logs array
        this.logs.push(logEntry);
        
        // Keep only the last maxLogs entries
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Update UI
        this.updateLogDisplay();
    }

    updateLogDisplay() {
        if (!this.logElement) return;

        // Get the last 20 logs for display
        const recentLogs = this.logs.slice(-20);
        
        const logHTML = recentLogs.map(log => {
            const timeStr = log.timestamp.toLocaleTimeString();
            const levelClass = `log-${log.level}`;
            const dataStr = log.data ? ` (${JSON.stringify(log.data)})` : '';
            
            return `
                <div class="log-entry ${levelClass}">
                    <span class="log-time">[${timeStr}]</span>
                    <span class="log-module">${log.module}:</span>
                    <span class="log-message">${log.message}${dataStr}</span>
                </div>
            `;
        }).join('');

        this.logElement.innerHTML = logHTML;

        // Auto-scroll to bottom if enabled
        if (this.autoScroll) {
            this.logElement.scrollTop = this.logElement.scrollHeight;
        }
    }

    clear() {
        this.logs = [];
        if (this.logElement) {
            this.logElement.innerHTML = '<div class="log-entry system-info">Logs cleared</div>';
        }
        this.log('SYSTEM', 'System logs cleared', 'info');
    }

    export() {
        const exportData = {
            timestamp: new Date().toISOString(),
            totalLogs: this.logs.length,
            logs: this.logs
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `system-logs-${new Date().toISOString().slice(0, 19)}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        this.log('SYSTEM', 'System logs exported', 'info');
    }

    // Public methods for manual logging
    info(module, message, data = null) {
        this.log(module, message, 'info', data);
    }

    warn(module, message, data = null) {
        this.log(module, message, 'warn', data);
    }

    error(module, message, data = null) {
        this.log(module, message, 'error', data);
    }

    debug(module, message, data = null) {
        this.log(module, message, 'debug', data);
    }

    // System event logging methods
    logUserAction(action, details = null) {
        this.log('USER', `User action: ${action}`, 'info', details);
    }

    logSystemEvent(event, details = null) {
        this.log('SYSTEM', event, 'info', details);
    }

    logPerformance(operation, duration, details = null) {
        this.log('PERFORMANCE', `${operation} completed in ${duration}ms`, 'info', details);
    }

    logSecurity(event, details = null) {
        this.log('SECURITY', event, 'warn', details);
    }

    // Configuration methods
    setAutoScroll(enabled) {
        this.autoScroll = enabled;
    }

    setMaxLogs(max) {
        this.maxLogs = max;
        if (this.logs.length > max) {
            this.logs = this.logs.slice(-max);
            this.updateLogDisplay();
        }
    }

    // Filter methods
    getLogsByModule(module) {
        return this.logs.filter(log => log.module === module);
    }

    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }

    getLogsInTimeRange(startTime, endTime) {
        return this.logs.filter(log => 
            log.timestamp >= startTime && log.timestamp <= endTime
        );
    }
}

// Create global system logger instance
window.systemLogger = new SystemLogger();

// Global convenience functions
window.logSystemEvent = (event, details) => window.systemLogger.logSystemEvent(event, details);
window.logUserAction = (action, details) => window.systemLogger.logUserAction(action, details);
window.logPerformance = (operation, duration, details) => window.systemLogger.logPerformance(operation, duration, details);
window.logSecurity = (event, details) => window.systemLogger.logSecurity(event, details);
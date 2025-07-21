class DebugManager {
    constructor() {
        // Load debug setting from localStorage, default to false (off)
        this.debugEnabled = localStorage.getItem('debug_enabled') === 'true' || false;
        this.debugLevels = {
            LOG: 'log',
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

    // Module-specific loggers
    createModuleLogger(moduleName) {
        return {
            log: (message, data) => this.log(moduleName, message, data),
            warn: (message, data) => this.warn(moduleName, message, data),
            error: (message, data) => this.error(moduleName, message, data),
            info: (message, data) => this.info(moduleName, message, data)
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
}

// Create global debug manager instance
window.debugManager = new DebugManager();
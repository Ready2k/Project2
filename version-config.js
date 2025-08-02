/**
 * Version Configuration
 * Update this file whenever you make changes to the codebase
 */

const VERSION_CONFIG = {
    version: "v2.4.1",
    buildDate: "2025-02-08",
    lastUpdated: "Conversation Context & Quick Actions Improvements",
    releaseNotes: [
        "Fixed System Prompts Management to load agent-specific data from config files",
        "Enhanced Agent Configuration Management with full CRUD operations",
        "Improved page detection to prevent unnecessary initialization",
        "Added proper agent config file loading from config/agents/ directory",
        "Fixed console errors and warnings for better user experience"
    ],
    changelog: {
        "v2.4.0": {
            date: "2025-01-08",
            changes: [
                "Fixed System Prompts Management to load agent-specific data from config files",
                "Enhanced Agent Configuration Management with full CRUD operations",
                "Improved page detection to prevent unnecessary initialization",
                "Added proper agent config file loading from config/agents/ directory",
                "Fixed console errors and warnings for better user experience",
                "Added async config loading with caching for better performance"
            ]
        },
        "v2.3.0": {
            date: "2025-01-08",
            changes: [
                "Agent configuration files migration to config/agents/",
                "Enhanced LLM Manager Admin UI functionality",
                "Agent telemetry system implementation",
                "Comprehensive guardrails integration",
                "Improved configuration management system"
            ]
        },
        "v2.2.0": {
            date: "2025-01-29",
            changes: [
                "Complete experience restart on clear chat",
                "Enhanced state management and cleanup",
                "Improved UI reset functionality",
                "Comprehensive process termination",
                "Better user experience flow"
            ]
        },
        "v2.1.0": {
            date: "2025-01-29",
            changes: [
                "Security manager enhancements",
                "Agent routing optimization",
                "Performance monitoring integration",
                "Error handling improvements"
            ]
        },
        "v2.0.0": {
            date: "2025-01-28", 
            changes: [
                "Complete agent system refactor",
                "Streaming mode implementation",
                "Enhanced UI with slide-out panels",
                "Comprehensive testing framework"
            ]
        }
    }
};

// Function to update version display in help panel
function updateVersionDisplay() {
    const versionElement = document.getElementById('appVersion');
    const buildDateElement = document.getElementById('buildDate');
    const lastUpdatedElement = document.getElementById('lastUpdated');
    
    if (versionElement) versionElement.textContent = VERSION_CONFIG.version;
    if (buildDateElement) buildDateElement.textContent = VERSION_CONFIG.buildDate;
    if (lastUpdatedElement) lastUpdatedElement.textContent = VERSION_CONFIG.lastUpdated;
}

// Function to toggle version details visibility
function toggleVersionDetails() {
    const details = document.getElementById('versionDetails');
    const toggle = document.getElementById('versionToggle');
    
    if (details && toggle) {
        if (details.style.display === 'none') {
            details.style.display = 'flex';
            toggle.classList.add('expanded');
        } else {
            details.style.display = 'none';
            toggle.classList.remove('expanded');
        }
    }
}

// Auto-update version display when DOM is loaded
document.addEventListener('DOMContentLoaded', updateVersionDisplay);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VERSION_CONFIG;
}
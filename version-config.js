/**
 * Version Configuration
 * Update this file whenever you make changes to the codebase
 */

const VERSION_CONFIG = {
    version: "v2.3.0",
    buildDate: "2025-01-08",
    lastUpdated: "Agent Configuration System & LLM Admin UI Enhancements",
    releaseNotes: [
        "Complete agent configuration files migration to config/agents/",
        "Enhanced LLM Manager Admin UI with improved functionality",
        "Agent telemetry system for performance monitoring",
        "Comprehensive guardrails integration testing",
        "Improved agent configuration loading and management"
    ],
    changelog: {
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
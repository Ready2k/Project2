/**
 * Version Configuration
 * Update this file whenever you make changes to the codebase
 */

const VERSION_CONFIG = {
    version: "v2.1.0",
    buildDate: "2025-01-29",
    lastUpdated: "Security & Performance Enhancements",
    releaseNotes: [
        "Enhanced security manager with comprehensive validation",
        "Improved agent routing with fallback mechanisms", 
        "Added performance monitoring and error reporting",
        "Implemented circuit breaker patterns for reliability",
        "Enhanced debug tools and comprehensive logging"
    ],
    changelog: {
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
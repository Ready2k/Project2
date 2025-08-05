/**
 * Ensure PersonaManager is available globally for agents
 * This script makes sure PersonaManager is accessible at window.personaManager
 */

console.log('🔧 Loading PersonaManager availability fix...');

// Check and fix PersonaManager availability immediately
checkAndFixPersonaManager();

// Also check after DOM loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        checkAndFixPersonaManager();
    }, 500);
});

// Check again after a longer delay to catch late initialization
setTimeout(() => {
    checkAndFixPersonaManager();
}, 3000);

function checkAndFixPersonaManager() {
    console.log('🔍 Checking PersonaManager availability...');
    
    // Check if PersonaManager is already available globally
    if (window.personaManager) {
        console.log('✅ PersonaManager already available globally');
        return;
    }
    
    // Check if it's available via speechApp
    if (window.speechApp && window.speechApp.personaManager) {
        console.log('🔧 Making PersonaManager available globally from speechApp');
        window.personaManager = window.speechApp.personaManager;
        return;
    }
    
    // Check if the PersonaManager class is available and create an instance
    if (typeof PersonaManager !== 'undefined') {
        try {
            console.log('🔧 Creating new PersonaManager instance...');
            window.personaManager = new PersonaManager();
            console.log('✅ PersonaManager instance created and made available globally');
        } catch (error) {
            console.error('❌ Failed to create PersonaManager instance:', error);
        }
        return;
    }
    
    // If PersonaManager class is not available, create a mock
    console.warn('⚠️ PersonaManager class not available, creating mock...');
    createMockPersonaManager();
}

function createMockPersonaManager() {
    // Create a basic mock PersonaManager that provides the essential methods
    window.personaManager = {
        getCurrentPersona: () => 'john_doe',
        getCurrentPersonaData: () => ({
            id: 'john_doe',
            name: 'John Doe',
            balance: 2450.75,
            cardNumber: '1234',
            accountType: 'checking',
            transactions: [],
            // Add additional fields that agents might expect
            sortCode: '12-34-56',
            accountNumber: '12345678',
            email: 'john.doe@example.com',
            phone: '+44 7700 900123'
        }),
        setCurrentPersona: (personaId) => {
            console.log('Mock PersonaManager: setCurrentPersona called with', personaId);
        },
        getPersonaIds: () => ['john_doe', 'sarah_smith', 'mike_johnson'],
        getPersonaData: (personaId) => ({
            id: personaId,
            name: personaId.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            balance: 2450.75,
            cardNumber: '1234',
            accountType: 'checking',
            transactions: [],
            // Add additional fields that agents might expect
            sortCode: '12-34-56',
            accountNumber: '12345678',
            email: `${personaId}@example.com`,
            phone: '+44 7700 900123'
        }),
        addPersona: (personaId, personaData) => {
            console.log('Mock PersonaManager: addPersona called', personaId, personaData);
        },
        updatePersona: (personaId, updates) => {
            console.log('Mock PersonaManager: updatePersona called', personaId, updates);
        },
        deletePersona: (personaId) => {
            console.log('Mock PersonaManager: deletePersona called', personaId);
        }
    };
    
    console.log('✅ Mock PersonaManager created and made available globally');
}

// Monitor for speechApp creation and update PersonaManager reference
function monitorSpeechAppCreation() {
    let checkCount = 0;
    const maxChecks = 20; // Check for up to 10 seconds
    
    const checkInterval = setInterval(() => {
        checkCount++;
        
        if (window.speechApp && window.speechApp.personaManager && !window.personaManager) {
            console.log('🔧 SpeechApp created, updating PersonaManager reference');
            window.personaManager = window.speechApp.personaManager;
            clearInterval(checkInterval);
        } else if (checkCount >= maxChecks) {
            console.log('⏰ Stopped monitoring for speechApp creation');
            clearInterval(checkInterval);
        }
    }, 500);
}

// Start monitoring
monitorSpeechAppCreation();

// Make the check function available globally
window.checkAndFixPersonaManager = checkAndFixPersonaManager;

console.log('🔧 PersonaManager availability fix loaded');
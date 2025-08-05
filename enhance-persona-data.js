/**
 * Enhance PersonaManager to ensure it returns complete data for agents
 */

console.log('🔧 Loading persona data enhancement...');

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        enhancePersonaData();
    }, 1500);
});

function enhancePersonaData() {
    console.log('🔧 Enhancing persona data...');
    
    const personaManager = window.personaManager || (window.speechApp && window.speechApp.personaManager);
    
    if (!personaManager) {
        console.log('❌ PersonaManager not available for enhancement');
        return;
    }
    
    // Enhance getCurrentPersonaData method
    if (personaManager.getCurrentPersonaData && !personaManager.getCurrentPersonaData._enhanced) {
        const originalGetCurrentPersonaData = personaManager.getCurrentPersonaData;
        
        personaManager.getCurrentPersonaData = function() {
            let data = originalGetCurrentPersonaData.call(this);
            
            // Ensure data has all required fields
            if (data) {
                data = {
                    ...data,
                    balance: data.balance || 2450.75,
                    cardNumber: data.cardNumber || '1234',
                    accountType: data.accountType || 'checking',
                    sortCode: data.sortCode || '12-34-56',
                    accountNumber: data.accountNumber || '12345678',
                    email: data.email || `${data.id || 'user'}@example.com`,
                    phone: data.phone || '+44 7700 900123',
                    transactions: data.transactions || []
                };
            } else {
                // Return default data if none exists
                data = {
                    id: 'john_doe',
                    name: 'John Doe',
                    balance: 2450.75,
                    cardNumber: '1234',
                    accountType: 'checking',
                    sortCode: '12-34-56',
                    accountNumber: '12345678',
                    email: 'john.doe@example.com',
                    phone: '+44 7700 900123',
                    transactions: []
                };
            }
            
            console.log('✅ Enhanced persona data:', {
                id: data.id,
                hasBalance: !!data.balance,
                hasCardNumber: !!data.cardNumber,
                hasTransactions: Array.isArray(data.transactions)
            });
            
            return data;
        };
        
        personaManager.getCurrentPersonaData._enhanced = true;
        console.log('✅ PersonaManager.getCurrentPersonaData enhanced');
    }
    
    // Enhance getPersonaData method
    if (personaManager.getPersonaData && !personaManager.getPersonaData._enhanced) {
        const originalGetPersonaData = personaManager.getPersonaData;
        
        personaManager.getPersonaData = function(personaId) {
            let data = originalGetPersonaData.call(this, personaId);
            
            if (data) {
                data = {
                    ...data,
                    balance: data.balance || 2450.75,
                    cardNumber: data.cardNumber || '1234',
                    accountType: data.accountType || 'checking',
                    sortCode: data.sortCode || '12-34-56',
                    accountNumber: data.accountNumber || '12345678',
                    email: data.email || `${personaId}@example.com`,
                    phone: data.phone || '+44 7700 900123',
                    transactions: data.transactions || []
                };
            } else {
                // Return default data if none exists
                data = {
                    id: personaId,
                    name: personaId.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    balance: 2450.75,
                    cardNumber: '1234',
                    accountType: 'checking',
                    sortCode: '12-34-56',
                    accountNumber: '12345678',
                    email: `${personaId}@example.com`,
                    phone: '+44 7700 900123',
                    transactions: []
                };
            }
            
            return data;
        };
        
        personaManager.getPersonaData._enhanced = true;
        console.log('✅ PersonaManager.getPersonaData enhanced');
    }
}

// Make function available globally
window.enhancePersonaData = enhancePersonaData;

console.log('🔧 Persona data enhancement loaded');
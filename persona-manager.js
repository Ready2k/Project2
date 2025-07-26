class PersonaManager {
    constructor() {
        this.personas = {};
        this.currentPersona = 'john_doe';
        this.initialized = false;
        
        // Initialize debug logger for this module
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('PersonaManager') : {
            log: () => {}, warn: () => {}, error: () => {}, info: () => {}
        };
    }

    async init() {
        if (this.initialized) return;
        
        try {
            this.debug.log('PersonaManager initialization starting...');
            
            // Load personas from localStorage first (for custom personas)
            const storedPersonas = localStorage.getItem('personas');
            if (storedPersonas) {
                this.personas = JSON.parse(storedPersonas);
                this.debug.log('Loaded personas from localStorage:', Object.keys(this.personas));
            } else {
                this.debug.log('No personas found in localStorage');
            }

            // Try to load personas from JSON file first, fallback to embedded data
            let defaultPersonas = null;
            
            // Check if we're running on file:// protocol to avoid CORS errors
            const isFileProtocol = window.location.protocol === 'file:';
            
            if (!isFileProtocol) {
                try {
                    this.debug.log('Attempting to fetch personas.json...');
                    const response = await fetch('./personas.json');
                    this.debug.log('Fetch response status:', response.status, response.statusText);
                    
                    if (response.ok) {
                        defaultPersonas = await response.json();
                        this.debug.log('Loaded default personas from JSON file:', Object.keys(defaultPersonas));
                    } else {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                } catch (fetchError) {
                    this.debug.warn('Could not load personas.json:', fetchError.message);
                    this.debug.log('Using embedded default personas as fallback...');
                }
            } else {
                this.debug.log('File protocol detected, using embedded personas to avoid CORS issues...');
            }
            
            // Use embedded data if fetch failed or we're on file:// protocol
            if (!defaultPersonas) {
                
                // Fallback to embedded personas data
                defaultPersonas = {
                    "john_doe": {
                        "name": "John Doe",
                        "balance": 2450.75,
                        "cardLast4": "1234",
                        "accountType": "checking",
                        "currency": "GBP",
                        "recentTransactions": [
                            { "date": "2025-01-15", "amount": -45.67, "description": "Coffee Shop" },
                            { "date": "2025-01-14", "amount": -120.00, "description": "Tesco Groceries" },
                            { "date": "2025-01-13", "amount": 1500.00, "description": "Salary Deposit" }
                        ]
                    },
                    "sarah_smith": {
                        "name": "Sarah Smith",
                        "balance": 8750.25,
                        "cardLast4": "5678",
                        "accountType": "premium",
                        "currency": "GBP",
                        "recentTransactions": [
                            { "date": "2025-01-16", "amount": -89.99, "description": "ASOS Online Shopping" },
                            { "date": "2025-01-15", "amount": -25.00, "description": "Shell Petrol Station" },
                            { "date": "2025-01-14", "amount": 2000.00, "description": "Investment Return" }
                        ]
                    },
                    "mike_johnson": {
                        "name": "Mike Johnson",
                        "balance": 156.80,
                        "cardLast4": "9012",
                        "accountType": "savings",
                        "currency": "GBP",
                        "recentTransactions": [
                            { "date": "2025-01-16", "amount": -12.50, "description": "McDonald's" },
                            { "date": "2025-01-15", "amount": -75.00, "description": "British Gas Bill" },
                            { "date": "2025-01-10", "amount": 200.00, "description": "Part-time Job" }
                        ]
                    }
                };
                this.debug.log('Loaded embedded default personas:', Object.keys(defaultPersonas));
            }
            
            // Merge default personas with stored ones (stored takes precedence)
            this.personas = { ...defaultPersonas, ...this.personas };

            this.initialized = true;
            const personaCount = Object.keys(this.personas).length;
            this.debug.log('PersonaManager initialized with', personaCount, 'personas:', Object.keys(this.personas));
            
            if (personaCount === 0) {
                this.debug.error('No personas loaded! This will cause issues.');
                // Add a fallback persona to prevent complete failure
                this.personas = {
                    'fallback_user': {
                        name: 'Test User',
                        balance: 1000.00,
                        cardLast4: '0000',
                        accountType: 'Current Account',
                        currency: 'GBP',
                        recentTransactions: [
                            { date: '2025-01-15', amount: -50.00, description: 'Test Transaction' }
                        ]
                    }
                };
                this.debug.log('Added fallback persona');
            }
            
        } catch (error) {
            this.debug.error('Error initializing PersonaManager:', error);
            // Fallback to a basic persona object
            this.personas = {
                'fallback_user': {
                    name: 'Test User',
                    balance: 1000.00,
                    cardLast4: '0000',
                    accountType: 'Current Account',
                    currency: 'GBP',
                    recentTransactions: [
                        { date: '2025-01-15', amount: -50.00, description: 'Test Transaction' }
                    ]
                }
            };
            this.initialized = true;
            this.debug.log('Used fallback persona due to error');
        }
    }

    getPersona(personaId) {
        return this.personas[personaId] || this.personas['john_doe'] || null;
    }

    getAllPersonas() {
        return this.personas;
    }

    addPersona(personaId, personaData) {
        this.personas[personaId] = personaData;
        this.saveToLocalStorage();
    }

    deletePersona(personaId) {
        if (this.personas[personaId]) {
            delete this.personas[personaId];
            this.saveToLocalStorage();
            return true;
        }
        return false;
    }

    updatePersona(personaId, personaData) {
        if (this.personas[personaId]) {
            this.personas[personaId] = { ...this.personas[personaId], ...personaData };
            this.saveToLocalStorage();
            return true;
        }
        return false;
    }

    saveToLocalStorage() {
        localStorage.setItem('personas', JSON.stringify(this.personas));
    }

    setCurrentPersona(personaId) {
        if (this.personas[personaId]) {
            this.currentPersona = personaId;
            return true;
        }
        return false;
    }

    getCurrentPersona() {
        return this.currentPersona;
    }

    getCurrentPersonaData() {
        return this.getPersona(this.currentPersona);
    }

    getPersonaIds() {
        return Object.keys(this.personas);
    }

    personaExists(personaId) {
        return !!this.personas[personaId];
    }

    // Generate a unique ID for new personas
    generatePersonaId(name) {
        const baseId = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        let id = baseId;
        let counter = 1;
        
        while (this.personas[id]) {
            id = `${baseId}_${counter}`;
            counter++;
        }
        
        return id;
    }

    // Transaction management methods
    addTransaction(personaId, transaction) {
        const persona = this.personas[personaId];
        if (!persona) return false;

        // Ensure transaction has required fields
        const newTransaction = {
            date: transaction.date || new Date().toISOString().split('T')[0],
            amount: parseFloat(transaction.amount) || 0,
            description: transaction.description || 'Transaction',
            id: Date.now() + Math.random() // Simple unique ID
        };

        // Initialize transactions array if it doesn't exist
        if (!persona.recentTransactions) {
            persona.recentTransactions = [];
        }

        // Add transaction to the beginning (most recent first)
        persona.recentTransactions.unshift(newTransaction);

        // Update balance
        persona.balance += newTransaction.amount;

        // Keep only the most recent 10 transactions
        if (persona.recentTransactions.length > 10) {
            persona.recentTransactions = persona.recentTransactions.slice(0, 10);
        }

        this.saveToLocalStorage();
        return true;
    }

    removeTransaction(personaId, transactionId) {
        const persona = this.personas[personaId];
        if (!persona || !persona.recentTransactions) return false;

        const transactionIndex = persona.recentTransactions.findIndex(tx => tx.id === transactionId);
        if (transactionIndex === -1) return false;

        const removedTransaction = persona.recentTransactions[transactionIndex];
        
        // Remove transaction
        persona.recentTransactions.splice(transactionIndex, 1);
        
        // Adjust balance
        persona.balance -= removedTransaction.amount;

        this.saveToLocalStorage();
        return true;
    }

    getTransactions(personaId, limit = 10) {
        const persona = this.personas[personaId];
        if (!persona || !persona.recentTransactions) return [];
        
        return persona.recentTransactions.slice(0, limit);
    }

    // Format currency for UK Sterling
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP'
        }).format(amount);
    }

    // Get formatted balance for display
    getFormattedBalance(personaId) {
        const persona = this.personas[personaId];
        if (!persona) return '£0.00';
        
        return this.formatCurrency(persona.balance);
    }
}

// Export to global scope for browser usage
if (typeof window !== 'undefined') {
    window.PersonaManager = PersonaManager;
}
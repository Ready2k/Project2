// Persona Editor - Dedicated page for editing personas
class PersonaEditor {
    constructor() {
        this.personaManager = null;
        this.currentPersonaId = null;
        this.transactionCount = 0;
        
        // Initialize debug logger
        this.debug = window.debugManager ? window.debugManager.createModuleLogger('PersonaEditor') : {
            log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}
        };
    }

    async init() {
        this.debug.log('PersonaEditor initialization starting...');
        
        try {
            // Initialize managers
            if (window.DebugManager) {
                window.debugManager = new window.DebugManager();
            }
            
            if (window.SystemLogger) {
                window.systemLogger = new window.SystemLogger();
            }

            // Initialize PersonaManager
            if (window.PersonaManager) {
                this.personaManager = new window.PersonaManager();
                await this.personaManager.init();
            } else {
                throw new Error('PersonaManager not available');
            }

            // Get persona ID from URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            this.currentPersonaId = urlParams.get('personaId');

            if (!this.currentPersonaId) {
                throw new Error('No persona ID provided');
            }

            // Initialize event listeners
            this.initializeEventListeners();

            // Load persona data
            await this.loadPersonaData();

            // Hide loading overlay
            document.getElementById('loadingOverlay').style.display = 'none';

            this.debug.log('PersonaEditor initialized successfully');
        } catch (error) {
            this.debug.error('Failed to initialize PersonaEditor:', error);
            this.showError('Failed to initialize persona editor: ' + error.message);
        }
    }

    initializeEventListeners() {
        // Form submission
        const form = document.getElementById('personaEditorForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSavePersona(e));
        }

        // Add transaction button
        const addTransactionBtn = document.getElementById('addTransactionBtn');
        if (addTransactionBtn) {
            addTransactionBtn.addEventListener('click', () => this.addTransaction());
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEditor();
            }
        });

        this.debug.log('Event listeners initialized');
    }

    async loadPersonaData() {
        const persona = this.personaManager.getPersona(this.currentPersonaId);
        if (!persona) {
            throw new Error('Persona not found: ' + this.currentPersonaId);
        }

        // Populate form fields
        document.getElementById('personaId').value = this.currentPersonaId;
        document.getElementById('personaName').value = persona.name;
        document.getElementById('personaBalance').value = persona.balance;
        document.getElementById('personaCard').value = persona.cardLast4;
        document.getElementById('personaAccountType').value = persona.accountType;

        // Update page title
        document.title = `Edit ${persona.name} - Persona Editor`;
        document.querySelector('.editor-header h1').innerHTML = `
            <i class="fas fa-user-edit"></i>
            Edit ${persona.name}
        `;

        // Load transactions
        this.loadTransactions(persona.recentTransactions || []);

        this.debug.log('Persona data loaded:', persona);
    }

    loadTransactions(transactions) {
        const container = document.getElementById('transactionsList');
        if (!container) return;

        container.innerHTML = '';
        this.transactionCount = 0;

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 60px 40px; color: #6c757d; background: white; border: 2px dashed #e9ecef; border-radius: 8px;">
                    <i class="fas fa-receipt" style="font-size: 48px; margin-bottom: 20px; opacity: 0.3; color: #667eea;"></i>
                    <h4 style="margin: 0 0 10px 0; color: #495057;">No transactions yet</h4>
                    <p style="margin: 0; font-size: 14px;">Click "Add Transaction" to start building this persona's transaction history.</p>
                </div>
            `;
            return;
        }

        transactions.forEach((transaction, index) => {
            this.createTransactionItem(transaction, index);
            this.transactionCount++;
        });
    }

    createTransactionItem(transaction = null, index = null) {
        const container = document.getElementById('transactionsList');
        if (!container) return;

        const isNew = transaction === null;
        const itemIndex = index !== null ? index : this.transactionCount;

        const transactionItem = document.createElement('div');
        transactionItem.className = 'transaction-item';
        transactionItem.innerHTML = `
            <div class="transaction-field">
                <label>Date</label>
                <input type="date" name="transaction_${itemIndex}_date" 
                       value="${transaction ? transaction.date : new Date().toISOString().split('T')[0]}" 
                       required>
            </div>
            <div class="transaction-field">
                <label>Amount (£)</label>
                <input type="number" name="transaction_${itemIndex}_amount" 
                       step="0.01" placeholder="0.00"
                       value="${transaction ? transaction.amount : ''}" 
                       required>
            </div>
            <div class="transaction-field">
                <label>Description</label>
                <input type="text" name="transaction_${itemIndex}_description" 
                       placeholder="Transaction description"
                       value="${transaction ? transaction.description : ''}" 
                       required>
            </div>
            <div class="transaction-actions">
                <button type="button" class="remove-transaction-btn" 
                        onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        container.appendChild(transactionItem);

        // Add event listener for amount input to handle color coding
        const amountInput = transactionItem.querySelector('input[name*="_amount"]');
        if (amountInput) {
            amountInput.addEventListener('input', this.handleAmountChange.bind(this));
            // Trigger initial color coding if there's a value
            if (amountInput.value) {
                this.handleAmountChange({ target: amountInput });
            }
        }

        // Remove empty state if it exists
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
    }

    handleAmountChange(e) {
        const input = e.target;
        const value = parseFloat(input.value);
        
        // Remove existing data attributes
        input.removeAttribute('data-positive');
        input.removeAttribute('data-negative');
        
        if (!isNaN(value)) {
            if (value > 0) {
                input.setAttribute('data-positive', 'true');
            } else if (value < 0) {
                input.setAttribute('data-negative', 'true');
            }
        }
    }

    addTransaction() {
        this.createTransactionItem();
        this.transactionCount++;
        this.debug.log('Added new transaction entry');
    }

    collectTransactions() {
        const transactions = [];
        const container = document.getElementById('transactionsList');
        
        if (!container) return transactions;

        const items = container.querySelectorAll('.transaction-item');
        
        items.forEach(item => {
            const dateInput = item.querySelector('input[name*="_date"]');
            const amountInput = item.querySelector('input[name*="_amount"]');
            const descriptionInput = item.querySelector('input[name*="_description"]');

            if (dateInput && amountInput && descriptionInput) {
                const date = dateInput.value;
                const amount = parseFloat(amountInput.value);
                const description = descriptionInput.value;

                if (date && !isNaN(amount) && description) {
                    transactions.push({
                        date,
                        amount,
                        description,
                        id: Date.now() + Math.random()
                    });
                }
            }
        });

        // Sort by date (newest first)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        return transactions;
    }

    async handleSavePersona(e) {
        e.preventDefault();
        
        try {
            // Show loading state
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            submitBtn.disabled = true;

            // Collect form data
            const formData = new FormData(e.target);
            const name = formData.get('personaName') || document.getElementById('personaName').value;
            const balance = parseFloat(document.getElementById('personaBalance').value);
            const cardLast4 = document.getElementById('personaCard').value;
            const accountType = document.getElementById('personaAccountType').value;

            // Collect transactions
            const transactions = this.collectTransactions();

            // Create persona data
            const personaData = {
                name,
                balance,
                cardLast4,
                accountType,
                currency: 'GBP',
                recentTransactions: transactions
            };

            // Update persona
            const success = this.personaManager.updatePersona(this.currentPersonaId, personaData);

            if (success) {
                this.debug.log('Persona updated successfully:', personaData);
                this.showSuccess('Persona updated successfully!');
                
                // Immediately refresh parent window
                this.refreshParentWindow();
                
                // Also set a flag in localStorage that the parent can check
                localStorage.setItem('personaUpdateFlag', Date.now().toString());
                
                // Close editor after a short delay
                setTimeout(() => {
                    this.closeEditor();
                }, 1500);
            } else {
                throw new Error('Failed to update persona');
            }

        } catch (error) {
            this.debug.error('Error saving persona:', error);
            this.showError('Failed to save persona: ' + error.message);
        } finally {
            // Restore button state
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            submitBtn.disabled = false;
        }
    }

    closeEditor() {
        // Check if there are unsaved changes
        if (this.hasUnsavedChanges()) {
            if (!confirm('You have unsaved changes. Are you sure you want to close the editor?')) {
                return;
            }
        }

        // Refresh the parent window if possible
        if (window.opener && !window.opener.closed) {
            try {
                // Try to call the refresh method on the parent window
                if (window.opener.personaAdmin && typeof window.opener.personaAdmin.refreshPersonaData === 'function') {
                    window.opener.personaAdmin.refreshPersonaData();
                    this.debug.log('Successfully refreshed parent window persona data');
                }
            } catch (error) {
                this.debug.warn('Could not refresh parent window:', error);
            }
        }

        // Close the window/tab
        window.close();
    }

    refreshParentWindow() {
        console.log('🔄 Attempting to refresh parent window...');
        
        if (window.opener && !window.opener.closed) {
            try {
                console.log('✅ Parent window is available');
                
                // Check what's available on the parent window
                console.log('Parent window personaAdmin:', !!window.opener.personaAdmin);
                console.log('Parent window refreshPersonaData:', !!window.opener.refreshPersonaData);
                
                // Method 1: Direct function call
                if (window.opener.personaAdmin && typeof window.opener.personaAdmin.refreshPersonaData === 'function') {
                    console.log('🎯 Calling direct method...');
                    window.opener.personaAdmin.refreshPersonaData();
                    console.log('✅ Direct method called successfully');
                }
                
                // Method 2: Global function call
                if (typeof window.opener.refreshPersonaData === 'function') {
                    console.log('🎯 Calling global function...');
                    window.opener.refreshPersonaData();
                    console.log('✅ Global function called successfully');
                }
                
                // Method 3: Force a manual refresh by calling loadPersonaList directly
                if (window.opener.personaAdmin && typeof window.opener.personaAdmin.loadPersonaList === 'function') {
                    console.log('🎯 Calling loadPersonaList directly...');
                    window.opener.personaAdmin.loadPersonaList();
                    console.log('✅ loadPersonaList called successfully');
                }
                
                // Method 4: Force update persona selector
                if (window.opener.personaAdmin && typeof window.opener.personaAdmin.updatePersonaSelector === 'function') {
                    console.log('🎯 Calling updatePersonaSelector directly...');
                    window.opener.personaAdmin.updatePersonaSelector();
                    console.log('✅ updatePersonaSelector called successfully');
                }
                
                console.log('🔄 All refresh methods attempted');
                
            } catch (error) {
                console.error('❌ Error refreshing parent window:', error);
                this.debug.warn('Could not refresh parent window:', error);
            }
        } else {
            console.log('❌ Parent window not available or closed');
        }
    }

    hasUnsavedChanges() {
        // Simple check - in a real app you'd compare with original data
        const form = document.getElementById('personaEditorForm');
        const formData = new FormData(form);
        
        // Check if any field has been modified
        // This is a simplified check - you could make it more sophisticated
        return false; // For now, don't block closing
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
        
        // Hide loading overlay on error
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showMessage(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
            border-radius: 8px;
            z-index: 10001;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 400px;
        `;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Remove after 4 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 4000);
    }
}

// Global functions
window.closeEditor = function() {
    if (window.personaEditor) {
        window.personaEditor.closeEditor();
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.personaEditor = new PersonaEditor();
    await window.personaEditor.init();
});

// Export for global access
if (typeof window !== 'undefined') {
    window.PersonaEditor = PersonaEditor;
}
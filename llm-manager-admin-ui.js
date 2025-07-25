/**
 * LLM Manager Admin UI - JavaScript Controller
 * Handles all UI interactions and data management for the admin interface
 */

class LLMManagerAdminUI {
    constructor() {
        this.llmManager = null;
        this.guardrailsManager = null;
        this.voiceConfigManager = null;
        this.currentAgent = null;
        this.auditLog = [];
        
        this.debug = window.debugManager?.createModuleLogger('AdminUI') || console;
        
        this.initialize();
    }
    
    /**
     * Initialize the admin UI
     */
    initialize() {
        this.debug.log('Initializing LLM Manager Admin UI');
        
        // Initialize debug manager if not available
        if (!window.debugManager) {
            window.debugManager = {
                createModuleLogger: (module) => ({
                    log: (...args) => console.log(`[${module}]`, ...args),
                    warn: (...args) => console.warn(`[${module}]`, ...args),
                    error: (...args) => console.error(`[${module}]`, ...args)
                })
            };
        }
        
        // Initialize managers
        this.initializeManagers();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial data
        this.loadInitialData();
        
        this.debug.log('Admin UI initialized successfully');
    }
    
    /**
     * Initialize manager instances
     */
    initializeManagers() {
        try {
            this.llmManager = new LLMManager();
            this.guardrailsManager = new GuardrailsManager();
            this.voiceConfigManager = new VoiceConfigManager();
            
            // Set up dependencies
            this.llmManager.setManagers(this.guardrailsManager, this.voiceConfigManager, null);
            
            this.logAuditEvent('system', 'Managers initialized successfully');
            
        } catch (error) {
            this.debug.error('Failed to initialize managers:', error);
            this.showError('Failed to initialize system managers');
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.target.dataset.section);
            });
        });
        
        // Modal close events
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
        
        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                this.switchTab(e.target);
            }
        });

        // Auth toggle handling
        document.addEventListener('click', (e) => {
            if (e.target.dataset.authAction) {
                const detailsDiv = e.target.closest('.auth-action-config').querySelector('.auth-action-details');
                if (e.target.classList.contains('active')) {
                    detailsDiv.style.display = 'block';
                } else {
                    detailsDiv.style.display = 'none';
                }
            }
        });
        
        // Audit log filter
        const logFilter = document.getElementById('logFilter');
        if (logFilter) {
            logFilter.addEventListener('change', () => {
                this.filterAuditLog(logFilter.value);
            });
        }
    }
    
    /**
     * Load initial data
     */
    loadInitialData() {
        this.refreshAgentData();
        this.loadAuditLog();
    }
    
    /**
     * Switch between main sections
     */
    switchSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');
        
        // Load section-specific content
        this.loadSectionContent(sectionName);
    }
    
    /**
     * Load content for specific section
     */
    loadSectionContent(sectionName) {
        switch (sectionName) {
            case 'overview':
                this.refreshAgentData();
                break;
            case 'configuration':
                this.loadConfigurationContent();
                break;
            case 'guardrails':
                this.loadGuardrailsContent();
                break;
            case 'voice':
                this.loadVoiceContent();
                break;
            case 'audit':
                this.refreshAuditLog();
                break;
        }
    }
    
    /**
     * Load configuration content
     */
    loadConfigurationContent() {
        const content = document.getElementById('configurationContent');
        if (!content) return;
        
        const agents = this.llmManager.getAgentConfigurations();
        
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Select Agent to Configure</label>
                <select class="form-select" id="configAgentSelect" onchange="adminUI.openAgentConfiguration(this.value)">
                    <option value="">Choose an agent...</option>
                    ${Object.keys(agents).map(name => 
                        `<option value="${name}">${name}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="agent-config-info">
                <h4>Configuration Management</h4>
                <ul class="feature-list">
                    <li>Modify agent settings and parameters</li>
                    <li>Configure LLM provider and model settings</li>
                    <li>Manage trigger keywords and priorities</li>
                    <li>Enable/disable agents and telemetry</li>
                    <li>View configuration history and metadata</li>
                </ul>
                <p style="margin-top: 15px; color: #7f8c8d;">
                    Select an agent from the dropdown above to open the configuration modal with detailed settings.
                </p>
            </div>
        `;
    }
    
    /**
     * Refresh agent data and update overview
     */
    refreshAgentData() {
        if (!this.llmManager) return;
        
        try {
            const stats = this.llmManager.getConfigurationStats();
            const agents = this.llmManager.getAgentConfigurations();
            
            // Update statistics
            document.getElementById('totalAgents').textContent = stats.totalAgents;
            document.getElementById('enabledAgents').textContent = stats.enabledAgents;
            document.getElementById('disabledAgents').textContent = stats.disabledAgents;
            document.getElementById('lastUpdated').textContent = 
                stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never';
            
            // Update agent grid
            this.renderAgentGrid(agents);
            
            this.logAuditEvent('system', 'Agent data refreshed');
            
        } catch (error) {
            this.debug.error('Failed to refresh agent data:', error);
            this.showError('Failed to refresh agent data');
        }
    }
    
    /**
     * Render agent grid
     */
    renderAgentGrid(agents) {
        const grid = document.getElementById('agentsGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        Object.entries(agents).forEach(([name, config]) => {
            const card = this.createAgentCard(name, config);
            grid.appendChild(card);
        });
    }
    
    /**
     * Create agent card element
     */
    createAgentCard(name, config) {
        const card = document.createElement('div');
        card.className = 'agent-card';
        
        const statusClass = config.enabled !== false ? 'enabled' : 'disabled';
        const statusText = config.enabled !== false ? 'Enabled' : 'Disabled';
        const statusIndicator = config.enabled !== false ? 'online' : 'offline';
        
        card.innerHTML = `
            <div class="agent-header">
                <div class="agent-name">
                    <span class="status-indicator ${statusIndicator}"></span>
                    ${name}
                </div>
                <div class="agent-status ${statusClass}">${statusText}</div>
            </div>
            
            <div class="agent-description">
                ${config.description || 'No description available'}
            </div>
            
            <div class="agent-details">
                <div class="detail-item">
                    <span class="detail-label">Provider:</span>
                    <span class="detail-value">${config.llmProvider || 'openai'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Model:</span>
                    <span class="detail-value">${config.llmModel || 'gpt-4'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Priority:</span>
                    <span class="detail-value">${config.priority || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Max Tokens:</span>
                    <span class="detail-value">${config.maxTokens || 'N/A'}</span>
                </div>
            </div>
            
            <div class="agent-actions">
                <button class="btn btn-primary" onclick="openAgentConfiguration('${name}')">
                    ⚙️ Configure
                </button>
                <button class="btn btn-secondary" onclick="openGuardrailsEditor('${name}')">
                    🛡️ Guardrails
                </button>
                <button class="btn btn-warning" onclick="openVoiceConfig('${name}')">
                    🎤 Voice
                </button>
                <button class="btn ${statusClass === 'enabled' ? 'btn-danger' : 'btn-success'}" 
                        onclick="toggleAgent('${name}')">
                    ${statusClass === 'enabled' ? '⏸️ Disable' : '▶️ Enable'}
                </button>
            </div>
        `;
        
        return card;
    }
    
    /**
     * Open agent configuration modal
     */
    openAgentConfiguration(agentName) {
        this.currentAgent = agentName;
        const config = this.llmManager.getAgentConfiguration(agentName);
        
        if (!config) {
            this.showError(`Agent ${agentName} not found`);
            return;
        }
        
        // Update modal title
        document.querySelector('#configModal .modal-title').textContent = 
            `Configure ${agentName}`;
        
        // Load configuration forms
        this.loadConfigurationForms(config);
        
        // Show modal
        this.showModal('configModal');
        
        this.logAuditEvent('config', `Opened configuration for ${agentName}`);
    }
    
    /**
     * Load configuration forms
     */
    loadConfigurationForms(config) {
        // Basic Settings Tab
        document.getElementById('basic-tab').innerHTML = `
            <div class="form-group">
                <label class="form-label">Agent Name</label>
                <input type="text" class="form-input" id="agentName" value="${config.name || ''}" readonly>
            </div>
            
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" id="agentDescription" rows="3">${config.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label class="form-label">Priority</label>
                <input type="number" class="form-input" id="agentPriority" value="${config.priority || 1}" min="1" max="10">
            </div>
            
            <div class="form-group">
                <label class="form-label">Status</label>
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Agent Enabled</div>
                        <div class="toggle-description">Enable or disable this agent</div>
                    </div>
                    <div class="toggle-switch ${config.enabled !== false ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-field="enabled"></div>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Telemetry</label>
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Telemetry Enabled</div>
                        <div class="toggle-description">Enable telemetry and logging</div>
                    </div>
                    <div class="toggle-switch ${config.telemetryEnabled !== false ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-field="telemetryEnabled"></div>
                </div>
            </div>
        `;
        
        // LLM Configuration Tab
        document.getElementById('llm-tab').innerHTML = `
            <div class="form-group">
                <label class="form-label">LLM Provider</label>
                <select class="form-select" id="llmProvider">
                    <option value="openai" ${config.llmProvider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="claude" ${config.llmProvider === 'claude' ? 'selected' : ''}>Claude</option>
                    <option value="bedrock" ${config.llmProvider === 'bedrock' ? 'selected' : ''}>AWS Bedrock</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Model</label>
                <input type="text" class="form-input" id="llmModel" value="${config.llmModel || 'gpt-4'}">
            </div>
            
            <div class="form-group">
                <label class="form-label">Max Tokens</label>
                <input type="number" class="form-input" id="maxTokens" value="${config.maxTokens || 1000}" min="100" max="4000">
            </div>
            
            <div class="form-group">
                <label class="form-label">Temperature</label>
                <input type="range" class="form-input" id="temperature" value="${config.temperature || 0.7}" 
                       min="0" max="2" step="0.1" oninput="document.getElementById('tempValue').textContent = this.value">
                <span id="tempValue">${config.temperature || 0.7}</span>
            </div>
        `;
        
        // Triggers Tab
        const triggers = config.triggers || [];
        document.getElementById('triggers-tab').innerHTML = `
            <div class="form-group">
                <label class="form-label">Trigger Keywords</label>
                <div id="triggersList">
                    ${triggers.map((trigger, index) => `
                        <div class="trigger-item" style="display: flex; gap: 10px; margin-bottom: 10px;">
                            <input type="text" class="form-input" value="${trigger}" data-trigger-index="${index}">
                            <button class="btn btn-danger" onclick="this.parentElement.remove()">Remove</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-success" onclick="addTrigger()">Add Trigger</button>
            </div>
            
            <div class="form-group">
                <label class="form-label">Trigger Description</label>
                <p style="color: #7f8c8d; font-size: 0.9em;">
                    Keywords that will activate this agent when detected in user input.
                </p>
            </div>
        `;
        
        // Advanced Tab
        document.getElementById('advanced-tab').innerHTML = `
            <div class="form-group">
                <label class="form-label">Created At</label>
                <input type="text" class="form-input" value="${config.createdAt ? new Date(config.createdAt).toLocaleString() : 'Unknown'}" readonly>
            </div>
            
            <div class="form-group">
                <label class="form-label">Last Updated</label>
                <input type="text" class="form-input" value="${config.lastUpdated ? new Date(config.lastUpdated).toLocaleString() : 'Never'}" readonly>
            </div>
            
            <div class="form-group">
                <label class="form-label">Configuration JSON</label>
                <textarea class="form-textarea" rows="10" readonly>${JSON.stringify(config, null, 2)}</textarea>
            </div>
        `;
    }
    
    /**
     * Add trigger input field
     */
    addTrigger() {
        const triggersList = document.getElementById('triggersList');
        const triggerCount = triggersList.children.length;
        
        const triggerItem = document.createElement('div');
        triggerItem.className = 'trigger-item';
        triggerItem.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
        triggerItem.innerHTML = `
            <input type="text" class="form-input" placeholder="Enter trigger keyword" data-trigger-index="${triggerCount}">
            <button class="btn btn-danger" onclick="this.parentElement.remove()">Remove</button>
        `;
        
        triggersList.appendChild(triggerItem);
    }
    
    /**
     * Save agent configuration
     */
    saveAgentConfiguration() {
        if (!this.currentAgent) return;
        
        try {
            // Collect form data
            const config = {
                name: document.getElementById('agentName').value,
                description: document.getElementById('agentDescription').value,
                priority: parseInt(document.getElementById('agentPriority').value),
                enabled: document.querySelector('[data-field="enabled"]').classList.contains('active'),
                telemetryEnabled: document.querySelector('[data-field="telemetryEnabled"]').classList.contains('active'),
                llmProvider: document.getElementById('llmProvider').value,
                llmModel: document.getElementById('llmModel').value,
                maxTokens: parseInt(document.getElementById('maxTokens').value),
                temperature: parseFloat(document.getElementById('temperature').value)
            };
            
            // Collect triggers
            const triggerInputs = document.querySelectorAll('[data-trigger-index]');
            config.triggers = Array.from(triggerInputs)
                .map(input => input.value.trim())
                .filter(trigger => trigger.length > 0);
            
            // Update configuration
            const success = this.llmManager.updateAgentConfiguration(this.currentAgent, config);
            
            if (success) {
                this.showSuccess('Configuration saved successfully');
                this.closeModal('configModal');
                this.refreshAgentData();
                this.logAuditEvent('config', `Updated configuration for ${this.currentAgent}`, config);
            } else {
                this.showError('Failed to save configuration');
            }
            
        } catch (error) {
            this.debug.error('Error saving configuration:', error);
            this.showError('Error saving configuration: ' + error.message);
        }
    }
    
    /**
     * Open guardrails editor
     */
    openGuardrailsEditor(agentName) {
        this.currentAgent = agentName;
        this.switchSection('guardrails');
        this.loadGuardrailsEditor(agentName);
    }
    
    /**
     * Load guardrails content
     */
    loadGuardrailsContent() {
        const content = document.getElementById('guardrailsContent');
        if (!content) return;
        
        const agents = this.llmManager.getAgentConfigurations();
        
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Select Agent</label>
                <select class="form-select" id="guardrailsAgentSelect" onchange="loadGuardrailsEditor(this.value)">
                    <option value="">Choose an agent...</option>
                    ${Object.keys(agents).map(name => 
                        `<option value="${name}">${name}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div id="guardrailsEditor" style="display: none;">
                <!-- Guardrails editor will be loaded here -->
            </div>
        `;
        
        // Auto-select current agent if set
        if (this.currentAgent) {
            document.getElementById('guardrailsAgentSelect').value = this.currentAgent;
            this.loadGuardrailsEditor(this.currentAgent);
        }
    }
    
    /**
     * Load guardrails editor for specific agent
     */
    loadGuardrailsEditor(agentName) {
        if (!agentName) {
            document.getElementById('guardrailsEditor').style.display = 'none';
            return;
        }
        
        const guardrails = this.guardrailsManager.getGuardrails(agentName) || {};
        const editor = document.getElementById('guardrailsEditor');
        
        editor.style.display = 'block';
        editor.innerHTML = `
            <h3>Guardrails for ${agentName}</h3>
            
            <h4>Allowed Capabilities</h4>
            <div class="toggle-group">
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Access Account Data</div>
                        <div class="toggle-description">Allow access to customer account information</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canAccessAccountData ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canAccessAccountData"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Initiate Transactions</div>
                        <div class="toggle-description">Allow initiating money transfers and payments</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canInitiateTransactions ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canInitiateTransactions"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Block Cards</div>
                        <div class="toggle-description">Allow blocking/freezing customer cards</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canBlockCards ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canBlockCards"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Reset Passwords</div>
                        <div class="toggle-description">Allow password reset operations</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canResetPasswords ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canResetPasswords"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Access Transaction History</div>
                        <div class="toggle-description">Allow viewing transaction history</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canAccessTransactionHistory ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canAccessTransactionHistory"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Provide Balance Info</div>
                        <div class="toggle-description">Allow providing account balance information</div>
                    </div>
                    <div class="toggle-switch ${guardrails.allowedCapabilities?.canProvideBalanceInfo ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-capability="canProvideBalanceInfo"></div>
                </div>
            </div>
            
            <h4>Restrictions</h4>
            <div class="form-group">
                <label class="form-label">Max Transaction Amount (£)</label>
                <input type="number" class="form-input" id="maxTransactionAmount" 
                       value="${guardrails.restrictions?.maxTransactionAmount || 0}" min="0" step="0.01">
            </div>
            
            <div class="form-group">
                <label class="form-label">Blocked Keywords</label>
                <textarea class="form-textarea" id="blockedKeywords" rows="3" 
                          placeholder="Enter blocked keywords, one per line">${(guardrails.restrictions?.blockedKeywords || []).join('\n')}</textarea>
            </div>
            
            <h4>Secondary Authentication</h4>
            <div id="secondaryAuthConfig">
                ${this.renderSecondaryAuthConfig(agentName, guardrails)}
            </div>
            
            <h4>Custom Prompts</h4>
            <div id="customPromptsConfig">
                ${this.renderCustomPromptsConfig(agentName, guardrails)}
            </div>
            
            <h4>Compliance Rules</h4>
            <div class="toggle-group">
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Log All Actions</div>
                        <div class="toggle-description">Log every action performed by this agent</div>
                    </div>
                    <div class="toggle-switch ${guardrails.complianceRules?.logAllActions ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-compliance="logAllActions"></div>
                </div>
                
                <div class="toggle-item">
                    <div>
                        <div class="toggle-label">Require Audit Trail</div>
                        <div class="toggle-description">Maintain detailed audit trail</div>
                    </div>
                    <div class="toggle-switch ${guardrails.complianceRules?.requireAuditTrail ? 'active' : ''}" 
                         onclick="this.classList.toggle('active')" data-compliance="requireAuditTrail"></div>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Data Retention Days</label>
                <input type="number" class="form-input" id="dataRetentionDays" 
                       value="${guardrails.complianceRules?.dataRetentionDays || 90}" min="1">
            </div>
            
            <div style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="saveGuardrails('${agentName}')">
                    Save Guardrails
                </button>
                <button class="btn btn-secondary" onclick="testGuardrails('${agentName}')">
                    Test Guardrails
                </button>
            </div>
        `;
        
        this.logAuditEvent('guardrails', `Opened guardrails editor for ${agentName}`);
    }
    
    /**
     * Save guardrails configuration
     */
    saveGuardrails(agentName) {
        try {
            // Collect capabilities
            const capabilities = {};
            document.querySelectorAll('[data-capability]').forEach(toggle => {
                const capability = toggle.dataset.capability;
                capabilities[capability] = toggle.classList.contains('active');
            });
            
            // Collect compliance rules
            const complianceRules = {};
            document.querySelectorAll('[data-compliance]').forEach(toggle => {
                const rule = toggle.dataset.compliance;
                complianceRules[rule] = toggle.classList.contains('active');
            });
            
            // Collect secondary auth configuration
            const requiresSecondaryAuth = {};
            document.querySelectorAll('[data-auth-action]').forEach(toggle => {
                const action = toggle.dataset.authAction;
                const enabled = toggle.classList.contains('active');
                
                if (enabled) {
                    const authTypeSelect = document.querySelector(`[data-auth-type="${action}"]`);
                    requiresSecondaryAuth[action] = {
                        enabled: true,
                        authType: authTypeSelect ? authTypeSelect.value : 'sms',
                        prompt: 'default'
                    };
                }
            });
            
            // Collect custom prompts
            const prompts = {
                secondaryAuth: {},
                restrictionBlocked: {},
                compliance: {}
            };
            
            document.querySelectorAll('.prompt-textarea').forEach(textarea => {
                const category = textarea.dataset.promptCategory;
                const key = textarea.dataset.promptKey;
                const value = textarea.value.trim();
                
                if (value && prompts[category]) {
                    prompts[category][key] = value;
                }
            });
            
            // Collect other restrictions
            const blockedKeywords = document.getElementById('blockedKeywords').value
                .split('\n')
                .map(keyword => keyword.trim())
                .filter(keyword => keyword.length > 0);
            
            const guardrails = {
                allowedCapabilities: capabilities,
                restrictions: {
                    maxTransactionAmount: parseFloat(document.getElementById('maxTransactionAmount').value) || 0,
                    requiresSecondaryAuth: requiresSecondaryAuth,
                    blockedKeywords: blockedKeywords,
                    timeBasedRestrictions: {}
                },
                prompts: prompts,
                complianceRules: {
                    ...complianceRules,
                    dataRetentionDays: parseInt(document.getElementById('dataRetentionDays').value) || 90
                }
            };
            
            const success = this.guardrailsManager.setGuardrails(agentName, guardrails);
            
            if (success) {
                this.showSuccess('Guardrails saved successfully');
                this.logAuditEvent('guardrails', `Updated guardrails for ${agentName}`, guardrails);
            } else {
                this.showError('Failed to save guardrails');
            }
            
        } catch (error) {
            this.debug.error('Error saving guardrails:', error);
            this.showError('Error saving guardrails: ' + error.message);
        }
    }
    
    /**
     * Render secondary authentication configuration
     */
    renderSecondaryAuthConfig(agentName, guardrails) {
        const availableActions = this.guardrailsManager.getAvailableAuthActions(agentName);
        const authTypes = this.guardrailsManager.getAuthenticationTypes();
        const currentAuth = guardrails.restrictions?.requiresSecondaryAuth || {};
        
        return `
            <div class="auth-config-container">
                ${availableActions.map(action => {
                    const config = currentAuth[action.action] || { enabled: false, authType: 'sms', prompt: 'default' };
                    return `
                        <div class="auth-action-config">
                            <div class="auth-action-header">
                                <div class="toggle-switch ${config.enabled ? 'active' : ''}" 
                                     onclick="this.classList.toggle('active'); toggleAuthAction(this);" 
                                     data-auth-action="${action.action}"></div>
                                <span class="auth-action-label">${action.label}</span>
                            </div>
                            <div class="auth-action-details" style="display: ${config.enabled ? 'block' : 'none'}">
                                <div class="form-group">
                                    <label class="form-label">Authentication Type</label>
                                    <select class="form-select" data-auth-type="${action.action}">
                                        ${Object.entries(authTypes).map(([key, label]) => 
                                            `<option value="${key}" ${config.authType === key ? 'selected' : ''}>${label}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Render custom prompts configuration
     */
    renderCustomPromptsConfig(agentName, guardrails) {
        const promptTemplates = this.guardrailsManager.getPromptTemplates();
        const currentPrompts = guardrails.prompts || {};
        
        return `
            <div class="prompts-config-container">
                <div class="prompt-section">
                    <h5>Secondary Authentication Prompts</h5>
                    ${this.renderPromptCategory('secondaryAuth', promptTemplates.secondaryAuth, currentPrompts.secondaryAuth || {}, agentName)}
                </div>
                
                <div class="prompt-section">
                    <h5>Restriction Blocked Prompts</h5>
                    ${this.renderPromptCategory('restrictionBlocked', promptTemplates.restrictionBlocked, currentPrompts.restrictionBlocked || {}, agentName)}
                </div>
                
                <div class="prompt-section">
                    <h5>Compliance Prompts</h5>
                    ${this.renderPromptCategory('compliance', promptTemplates.compliance, currentPrompts.compliance || {}, agentName)}
                </div>
            </div>
        `;
    }

    /**
     * Render prompt category
     */
    renderPromptCategory(category, templates, currentPrompts, agentName) {
        return Object.entries(templates).map(([key, defaultPrompt]) => `
            <div class="prompt-config-item">
                <label class="form-label">${this.formatPromptLabel(key)}</label>
                <div class="prompt-input-group">
                    <textarea class="form-textarea prompt-textarea" 
                              data-prompt-category="${category}" 
                              data-prompt-key="${key}"
                              rows="2" 
                              placeholder="${defaultPrompt}">${currentPrompts[key] || ''}</textarea>
                    <button class="btn btn-small btn-secondary" 
                            onclick="usePromptTemplate(this);"
                            data-template="${defaultPrompt.replace(/"/g, '&quot;')}">
                        Use Template
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Format prompt label for display
     */
    formatPromptLabel(key) {
        return key.replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                  .replace(/([a-z])([A-Z])/g, '$1 $2');
    }

    /**
     * Test guardrails
     */
    testGuardrails(agentName) {
        const testActions = [
            { action: 'getAccountData', context: {} },
            { action: 'initiateTransfer', context: { amount: 500 } },
            { action: 'blockCard', context: {} },
            { action: 'transfer money', context: {} } // Should be blocked by keyword
        ];
        
        let results = `Guardrails Test Results for ${agentName}:\n\n`;
        
        testActions.forEach(test => {
            const result = this.guardrailsManager.validateAction(agentName, test.action, test.context);
            const status = result.allowed ? '✅ ALLOWED' : '❌ BLOCKED';
            results += `${status}: "${test.action}" - ${result.reason}\n`;
            if (result.prompt) {
                results += `   Prompt: "${result.prompt}"\n`;
            }
            if (result.authType) {
                results += `   Auth Type: ${result.authType}\n`;
            }
        });
        
        alert(results);
        this.logAuditEvent('guardrails', `Tested guardrails for ${agentName}`);
    }
    
    /**
     * Open voice configuration
     */
    openVoiceConfig(agentName) {
        this.currentAgent = agentName;
        this.switchSection('voice');
        this.loadVoiceEditor(agentName);
    }
    
    /**
     * Load voice content
     */
    loadVoiceContent() {
        const content = document.getElementById('voiceContent');
        if (!content) return;
        
        const agents = this.llmManager.getAgentConfigurations();
        
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label">Select Agent</label>
                <select class="form-select" id="voiceAgentSelect" onchange="loadVoiceEditor(this.value)">
                    <option value="">Choose an agent...</option>
                    ${Object.keys(agents).map(name => 
                        `<option value="${name}">${name}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div id="voiceEditor" style="display: none;">
                <!-- Voice editor will be loaded here -->
            </div>
        `;
        
        // Auto-select current agent if set
        if (this.currentAgent) {
            document.getElementById('voiceAgentSelect').value = this.currentAgent;
            this.loadVoiceEditor(this.currentAgent);
        }
    }
    
    /**
     * Load voice editor for specific agent
     */
    loadVoiceEditor(agentName) {
        if (!agentName) {
            document.getElementById('voiceEditor').style.display = 'none';
            return;
        }
        
        const voiceConfig = this.voiceConfigManager.getVoiceConfig(agentName) || {};
        const ttsSettings = voiceConfig.ttsSettings || {};
        const personalityTraits = voiceConfig.personalityTraits || {};
        const contextualAdaptation = voiceConfig.contextualAdaptation || {};
        
        const editor = document.getElementById('voiceEditor');
        editor.style.display = 'block';
        
        const availableVoices = {
            openai: this.voiceConfigManager.getAvailableVoices('openai'),
            elevenlabs: this.voiceConfigManager.getAvailableVoices('elevenlabs'),
            azure: this.voiceConfigManager.getAvailableVoices('azure')
        };
        
        editor.innerHTML = `
            <h3>Voice Configuration for ${agentName}</h3>
            
            <h4>TTS Settings</h4>
            <div class="form-group">
                <label class="form-label">TTS Provider</label>
                <select class="form-select" id="ttsProvider" onchange="updateVoiceOptions()">
                    <option value="openai" ${ttsSettings.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="elevenlabs" ${ttsSettings.provider === 'elevenlabs' ? 'selected' : ''}>ElevenLabs</option>
                    <option value="azure" ${ttsSettings.provider === 'azure' ? 'selected' : ''}>Azure</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Voice</label>
                <select class="form-select" id="voiceSelect">
                    ${this.generateVoiceOptions(ttsSettings.provider || 'openai', ttsSettings.voice, availableVoices)}
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Speed</label>
                <input type="range" class="form-input" id="voiceSpeed" value="${ttsSettings.speed || 1.0}" 
                       min="0.25" max="4.0" step="0.1" oninput="document.getElementById('speedValue').textContent = this.value">
                <span id="speedValue">${ttsSettings.speed || 1.0}</span>
            </div>
            
            <div class="form-group">
                <label class="form-label">Pitch</label>
                <input type="range" class="form-input" id="voicePitch" value="${ttsSettings.pitch || 0}" 
                       min="-20" max="20" step="1" oninput="document.getElementById('pitchValue').textContent = this.value">
                <span id="pitchValue">${ttsSettings.pitch || 0}</span>
            </div>
            
            <div class="form-group">
                <label class="form-label">Volume</label>
                <input type="range" class="form-input" id="voiceVolume" value="${ttsSettings.volume || 0.8}" 
                       min="0" max="1" step="0.1" oninput="document.getElementById('volumeValue').textContent = this.value">
                <span id="volumeValue">${ttsSettings.volume || 0.8}</span>
            </div>
            
            <h4>Personality Traits</h4>
            <div class="form-group">
                <label class="form-label">Tone</label>
                <select class="form-select" id="personalityTone">
                    <option value="professional" ${personalityTraits.tone === 'professional' ? 'selected' : ''}>Professional</option>
                    <option value="friendly" ${personalityTraits.tone === 'friendly' ? 'selected' : ''}>Friendly</option>
                    <option value="authoritative" ${personalityTraits.tone === 'authoritative' ? 'selected' : ''}>Authoritative</option>
                    <option value="empathetic" ${personalityTraits.tone === 'empathetic' ? 'selected' : ''}>Empathetic</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Formality</label>
                <select class="form-select" id="personalityFormality">
                    <option value="casual" ${personalityTraits.formality === 'casual' ? 'selected' : ''}>Casual</option>
                    <option value="professional" ${personalityTraits.formality === 'professional' ? 'selected' : ''}>Professional</option>
                    <option value="formal" ${personalityTraits.formality === 'formal' ? 'selected' : ''}>Formal</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Enthusiasm (1-10)</label>
                <input type="range" class="form-input" id="personalityEnthusiasm" value="${personalityTraits.enthusiasm || 5}" 
                       min="1" max="10" step="1" oninput="document.getElementById('enthusiasmValue').textContent = this.value">
                <span id="enthusiasmValue">${personalityTraits.enthusiasm || 5}</span>
            </div>
            
            <div class="form-group">
                <label class="form-label">Empathy (1-10)</label>
                <input type="range" class="form-input" id="personalityEmpathy" value="${personalityTraits.empathy || 6}" 
                       min="1" max="10" step="1" oninput="document.getElementById('empathyValue').textContent = this.value">
                <span id="empathyValue">${personalityTraits.empathy || 6}</span>
            </div>
            
            <h4>Contextual Adaptation</h4>
            <div class="form-group">
                <label class="form-label">Error Response Tone</label>
                <select class="form-select" id="errorResponseTone">
                    <option value="apologetic" ${contextualAdaptation.errorResponseTone === 'apologetic' ? 'selected' : ''}>Apologetic</option>
                    <option value="calm" ${contextualAdaptation.errorResponseTone === 'calm' ? 'selected' : ''}>Calm</option>
                    <option value="neutral" ${contextualAdaptation.errorResponseTone === 'neutral' ? 'selected' : ''}>Neutral</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Success Response Tone</label>
                <select class="form-select" id="successResponseTone">
                    <option value="confident" ${contextualAdaptation.successResponseTone === 'confident' ? 'selected' : ''}>Confident</option>
                    <option value="friendly" ${contextualAdaptation.successResponseTone === 'friendly' ? 'selected' : ''}>Friendly</option>
                    <option value="neutral" ${contextualAdaptation.successResponseTone === 'neutral' ? 'selected' : ''}>Neutral</option>
                </select>
            </div>
            
            <div class="voice-preview">
                <h4>Voice Preview</h4>
                <div class="preview-controls">
                    <input type="text" class="preview-text" id="previewText" 
                           value="Hello, this is a voice preview for the ${agentName} banking assistant." 
                           placeholder="Enter text to preview...">
                    <button class="btn btn-primary" onclick="previewVoice('${agentName}')">
                        🎤 Preview
                    </button>
                </div>
                <div id="previewResult" style="margin-top: 10px;"></div>
            </div>
            
            <div style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="saveVoiceConfig('${agentName}')">
                    Save Voice Configuration
                </button>
                <button class="btn btn-secondary" onclick="resetVoiceConfig('${agentName}')">
                    Reset to Default
                </button>
            </div>
        `;
        
        this.logAuditEvent('voice', `Opened voice configuration for ${agentName}`);
    }
    
    /**
     * Generate voice options for select dropdown
     */
    generateVoiceOptions(provider, selectedVoice, availableVoices) {
        const voices = availableVoices[provider] || [];
        return voices.map(voice => 
            `<option value="${voice}" ${voice === selectedVoice ? 'selected' : ''}>${voice}</option>`
        ).join('');
    }
    
    /**
     * Update voice options when provider changes
     */
    updateVoiceOptions() {
        const provider = document.getElementById('ttsProvider').value;
        const voiceSelect = document.getElementById('voiceSelect');
        const availableVoices = {
            openai: this.voiceConfigManager.getAvailableVoices('openai'),
            elevenlabs: this.voiceConfigManager.getAvailableVoices('elevenlabs'),
            azure: this.voiceConfigManager.getAvailableVoices('azure')
        };
        
        voiceSelect.innerHTML = this.generateVoiceOptions(provider, '', availableVoices);
    }
    
    /**
     * Preview voice configuration
     */
    async previewVoice(agentName) {
        const previewText = document.getElementById('previewText').value;
        const resultDiv = document.getElementById('previewResult');
        
        if (!previewText.trim()) {
            this.showError('Please enter text to preview');
            return;
        }
        
        // Collect current voice configuration
        const config = {
            ttsSettings: {
                provider: document.getElementById('ttsProvider').value,
                voice: document.getElementById('voiceSelect').value,
                speed: parseFloat(document.getElementById('voiceSpeed').value),
                pitch: parseFloat(document.getElementById('voicePitch').value),
                volume: parseFloat(document.getElementById('voiceVolume').value)
            },
            personalityTraits: {
                tone: document.getElementById('personalityTone').value,
                formality: document.getElementById('personalityFormality').value,
                enthusiasm: parseInt(document.getElementById('personalityEnthusiasm').value),
                empathy: parseInt(document.getElementById('personalityEmpathy').value)
            },
            contextualAdaptation: {
                errorResponseTone: document.getElementById('errorResponseTone').value,
                successResponseTone: document.getElementById('successResponseTone').value
            }
        };
        
        try {
            resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div>Generating preview...</div>';
            
            const preview = await this.voiceConfigManager.previewVoice(config, previewText);
            
            if (preview.success) {
                resultDiv.innerHTML = `
                    <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 10px; color: #155724;">
                        <strong>Preview Generated Successfully</strong><br>
                        Estimated Duration: ${preview.estimatedDuration} seconds<br>
                        <small>Note: This is a mock preview. In production, actual audio would be generated.</small>
                    </div>
                `;
            } else {
                resultDiv.innerHTML = `
                    <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 10px; color: #721c24;">
                        <strong>Preview Failed:</strong> ${preview.error}
                    </div>
                `;
            }
            
            this.logAuditEvent('voice', `Generated voice preview for ${agentName}`);
            
        } catch (error) {
            this.debug.error('Voice preview error:', error);
            resultDiv.innerHTML = `
                <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 10px; color: #721c24;">
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
        }
    }
    
    /**
     * Save voice configuration
     */
    saveVoiceConfig(agentName) {
        try {
            const config = {
                ttsSettings: {
                    provider: document.getElementById('ttsProvider').value,
                    voice: document.getElementById('voiceSelect').value,
                    speed: parseFloat(document.getElementById('voiceSpeed').value),
                    pitch: parseFloat(document.getElementById('voicePitch').value),
                    volume: parseFloat(document.getElementById('voiceVolume').value)
                },
                personalityTraits: {
                    tone: document.getElementById('personalityTone').value,
                    formality: document.getElementById('personalityFormality').value,
                    enthusiasm: parseInt(document.getElementById('personalityEnthusiasm').value),
                    empathy: parseInt(document.getElementById('personalityEmpathy').value)
                },
                contextualAdaptation: {
                    errorResponseTone: document.getElementById('errorResponseTone').value,
                    successResponseTone: document.getElementById('successResponseTone').value
                }
            };
            
            const success = this.voiceConfigManager.setVoiceConfig(agentName, config);
            
            if (success) {
                this.showSuccess('Voice configuration saved successfully');
                this.logAuditEvent('voice', `Updated voice configuration for ${agentName}`, config);
            } else {
                this.showError('Failed to save voice configuration');
            }
            
        } catch (error) {
            this.debug.error('Error saving voice configuration:', error);
            this.showError('Error saving voice configuration: ' + error.message);
        }
    }
    
    /**
     * Reset voice configuration to default
     */
    resetVoiceConfig(agentName) {
        if (confirm(`Reset voice configuration for ${agentName} to default settings?`)) {
            // This would reset to the default configuration
            this.voiceConfigManager.resetToDefaults();
            this.loadVoiceEditor(agentName);
            this.showSuccess('Voice configuration reset to defaults');
            this.logAuditEvent('voice', `Reset voice configuration for ${agentName} to defaults`);
        }
    }
    
    /**
     * Toggle agent enabled/disabled status
     */
    toggleAgent(agentName) {
        const config = this.llmManager.getAgentConfiguration(agentName);
        if (!config) return;
        
        const newStatus = !config.enabled;
        const success = this.llmManager.updateAgentConfiguration(agentName, { enabled: newStatus });
        
        if (success) {
            this.refreshAgentData();
            this.showSuccess(`Agent ${agentName} ${newStatus ? 'enabled' : 'disabled'}`);
            this.logAuditEvent('config', `${newStatus ? 'Enabled' : 'Disabled'} agent ${agentName}`);
        } else {
            this.showError(`Failed to ${newStatus ? 'enable' : 'disable'} agent`);
        }
    }
    
    /**
     * Export configuration
     */
    exportConfiguration() {
        try {
            const config = this.llmManager.exportConfiguration();
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `llm-manager-config-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showSuccess('Configuration exported successfully');
            this.logAuditEvent('system', 'Exported configuration');
            
        } catch (error) {
            this.debug.error('Export error:', error);
            this.showError('Failed to export configuration');
        }
    }
    
    /**
     * Import configuration
     */
    importConfiguration() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    const success = this.llmManager.importConfiguration(config);
                    
                    if (success) {
                        this.refreshAgentData();
                        this.showSuccess('Configuration imported successfully');
                        this.logAuditEvent('system', 'Imported configuration');
                    } else {
                        this.showError('Failed to import configuration');
                    }
                    
                } catch (error) {
                    this.debug.error('Import error:', error);
                    this.showError('Invalid configuration file');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    /**
     * Reset to defaults
     */
    resetToDefaults() {
        if (confirm('Reset all configurations to defaults? This cannot be undone.')) {
            this.llmManager.resetToDefaults();
            this.refreshAgentData();
            this.showSuccess('All configurations reset to defaults');
            this.logAuditEvent('system', 'Reset all configurations to defaults');
        }
    }
    
    /**
     * Load audit log
     */
    loadAuditLog() {
        // Load from localStorage or initialize empty
        const stored = localStorage.getItem('llm_manager_audit_log');
        this.auditLog = stored ? JSON.parse(stored) : [];
        this.renderAuditLog();
    }
    
    /**
     * Log audit event
     */
    logAuditEvent(category, action, details = null) {
        const event = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            category,
            action,
            details,
            user: 'admin' // In real implementation, this would be the actual user
        };
        
        this.auditLog.unshift(event);
        
        // Keep only last 1000 events
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog.slice(0, 1000);
        }
        
        // Save to localStorage
        localStorage.setItem('llm_manager_audit_log', JSON.stringify(this.auditLog));
        
        // Update UI if audit section is visible
        if (document.getElementById('audit-section').classList.contains('active')) {
            this.renderAuditLog();
        }
    }
    
    /**
     * Render audit log
     */
    renderAuditLog() {
        const container = document.getElementById('auditLogEntries');
        if (!container) return;
        
        const filter = document.getElementById('logFilter')?.value || 'all';
        const filteredLog = filter === 'all' ? 
            this.auditLog : 
            this.auditLog.filter(event => event.category === filter);
        
        if (filteredLog.length === 0) {
            container.innerHTML = '<div class="loading">No audit events found</div>';
            return;
        }
        
        container.innerHTML = filteredLog.map(event => `
            <div class="log-entry">
                <div class="log-info">
                    <div class="log-action">${event.action}</div>
                    <div class="log-details">
                        Category: ${event.category} | User: ${event.user}
                        ${event.details ? ` | Details: ${typeof event.details === 'object' ? JSON.stringify(event.details).substring(0, 100) + '...' : event.details}` : ''}
                    </div>
                </div>
                <div class="log-timestamp">${new Date(event.timestamp).toLocaleString()}</div>
            </div>
        `).join('');
    }
    
    /**
     * Filter audit log
     */
    filterAuditLog(filter) {
        this.renderAuditLog();
    }
    
    /**
     * Clear audit log
     */
    clearAuditLog() {
        if (confirm('Clear all audit log entries? This cannot be undone.')) {
            this.auditLog = [];
            localStorage.removeItem('llm_manager_audit_log');
            this.renderAuditLog();
            this.showSuccess('Audit log cleared');
        }
    }
    
    /**
     * Refresh audit log
     */
    refreshAuditLog() {
        this.renderAuditLog();
    }
    
    /**
     * Switch tabs in modal
     */
    switchTab(tabBtn) {
        const tabContainer = tabBtn.closest('.modal-body') || tabBtn.closest('.content-section');
        
        // Update tab buttons
        tabContainer.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        tabBtn.classList.add('active');
        
        // Update tab content
        const tabName = tabBtn.dataset.tab;
        tabContainer.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        tabContainer.querySelector(`#${tabName}-tab`).classList.add('active');
    }
    
    /**
     * Show modal
     */
    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }
    
    /**
     * Close modal
     */
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        this.currentAgent = null;
    }
    
    /**
     * Show success message
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    /**
     * Show error message
     */
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;
        
        // Set background color based on type
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };
        
        notification.style.background = colors[type] || colors.info;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
        
        // Add CSS animations if not already present
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Global functions for HTML onclick handlers
window.adminUI = null;

// Global functions
window.refreshAgentData = () => adminUI?.refreshAgentData();
window.exportConfiguration = () => adminUI?.exportConfiguration();
window.importConfiguration = () => adminUI?.importConfiguration();
window.resetToDefaults = () => adminUI?.resetToDefaults();
window.clearAuditLog = () => adminUI?.clearAuditLog();
window.closeModal = (modalId) => adminUI?.closeModal(modalId);
window.saveAgentConfiguration = () => adminUI?.saveAgentConfiguration();
window.addTrigger = () => adminUI?.addTrigger();
window.updateVoiceOptions = () => adminUI?.updateVoiceOptions();

// Agent management functions
window.openAgentConfiguration = (agentName) => adminUI?.openAgentConfiguration(agentName);
window.openGuardrailsEditor = (agentName) => adminUI?.openGuardrailsEditor(agentName);
window.openVoiceConfig = (agentName) => adminUI?.openVoiceConfig(agentName);
window.toggleAgent = (agentName) => adminUI?.toggleAgent(agentName);

// Guardrails functions
window.saveGuardrails = (agentName) => adminUI?.saveGuardrails(agentName);
window.testGuardrails = (agentName) => adminUI?.testGuardrails(agentName);

// Voice configuration functions
window.saveVoiceConfig = (agentName) => adminUI?.saveVoiceConfig(agentName);
window.resetVoiceConfig = (agentName) => adminUI?.resetVoiceConfig(agentName);
window.previewVoice = (agentName) => adminUI?.previewVoice(agentName);

// Content loading functions
window.loadGuardrailsEditor = (agentName) => adminUI?.loadGuardrailsEditor(agentName);
window.loadVoiceEditor = (agentName) => adminUI?.loadVoiceEditor(agentName);

// Enhanced guardrails functions
window.toggleAuthAction = (element) => {
    const detailsDiv = element.closest('.auth-action-config').querySelector('.auth-action-details');
    if (element.classList.contains('active')) {
        detailsDiv.style.display = 'block';
    } else {
        detailsDiv.style.display = 'none';
    }
};

window.usePromptTemplate = (button) => {
    const textarea = button.previousElementSibling;
    const template = button.dataset.template;
    if (template) {
        textarea.value = template;
        textarea.placeholder = '';
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminUI = new LLMManagerAdminUI();
});
/**
 * Streaming Agent Routing Configuration System
 * Manages configuration for streaming agent routing integration
 */
class StreamingAgentConfig {
    constructor() {
        this.config = {
            enabled: false,
            agentPriority: {
                'FraudAgent': 1,
                'PaymentsAgent': 2,
                'IDVAgent': 3,
                'BankingInfoAgent': 4,
                'DefaultAgent': 5
            },
            agentVoices: {
                'FraudAgent': { voice: 'alloy', speed: 0.9, pitch: 1.0, temperature: 0.8 },
                'PaymentsAgent': { voice: 'echo', speed: 1.0, pitch: 1.0, temperature: 0.7 },
                'IDVAgent': { voice: 'coral', speed: 0.95, pitch: 1.0, temperature: 0.8 },
                'BankingInfoAgent': { voice: 'shimmer', speed: 1.0, pitch: 1.0, temperature: 0.9 },
                'DefaultAgent': { voice: 'shimmer', speed: 1.0, pitch: 1.0, temperature: 0.9 }
            },
            routingSettings: {
                routingTimeout: 100, // milliseconds
                maxRetries: 3,
                fallbackEnabled: true,
                contextPreservation: true,
                performanceMonitoring: true
            },
            voiceSettings: {
                enableVoiceSwitching: true,
                smoothTransitions: true,
                fallbackVoice: 'shimmer',
                transitionDelay: 200 // milliseconds
            }
        };

        this.configKey = 'streamingAgentConfig';
        this.validationRules = this.initializeValidationRules();
        this.eventListeners = new Map();
        
        this.loadConfiguration();
        this.initializeUI();
    }

    /**
     * Initialize validation rules for configuration
     */
    initializeValidationRules() {
        return {
            agentPriority: {
                min: 1,
                max: 10,
                required: ['FraudAgent', 'PaymentsAgent', 'IDVAgent', 'BankingInfoAgent', 'DefaultAgent']
            },
            agentVoices: {
                validVoices: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'],
                speedRange: { min: 0.25, max: 4.0 },
                pitchRange: { min: 0.5, max: 2.0 },
                temperatureRange: { min: 0.1, max: 1.0 }
            },
            routingSettings: {
                routingTimeout: { min: 50, max: 500 },
                maxRetries: { min: 1, max: 5 }
            },
            voiceSettings: {
                transitionDelay: { min: 0, max: 1000 }
            }
        };
    }

    /**
     * Initialize UI elements and event listeners
     */
    initializeUI() {
        this.createConfigurationInterface();
        this.bindEventListeners();
        this.updateUIFromConfig();
    }

    /**
     * Create the configuration interface HTML
     */
    createConfigurationInterface() {
        // Find the settings panel content
        const settingsPanel = document.querySelector('#settingsPanel .panel-content');
        if (!settingsPanel) {
            console.error('[StreamingAgentConfig] Settings panel not found');
            return;
        }

        // Create streaming agent routing section
        const streamingSection = document.createElement('div');
        streamingSection.className = 'settings-section';
        streamingSection.id = 'streamingAgentRoutingSection';
        
        streamingSection.innerHTML = `
            <h3>Streaming Agent Routing</h3>
            
            <!-- Enable/Disable Toggle -->
            <div class="setting-group">
                <label class="toggle-label">
                    <input type="checkbox" id="streamingRoutingEnabled" class="setting-checkbox">
                    <span class="toggle-slider"></span>
                    <span class="toggle-text">Enable Agent Routing in Streaming Mode</span>
                </label>
                <div class="setting-description">
                    Automatically route streaming conversations to specialized agents based on context
                </div>
            </div>

            <!-- Agent Priority Configuration -->
            <div class="setting-group" id="agentPriorityGroup">
                <label>Agent Priority Configuration:</label>
                <div class="agent-priority-list">
                    <div class="priority-item">
                        <span class="agent-name">Fraud Detection Agent</span>
                        <input type="number" id="fraudAgentPriority" min="1" max="10" value="1" class="priority-input">
                        <span class="priority-label">Priority</span>
                    </div>
                    <div class="priority-item">
                        <span class="agent-name">Payments Agent</span>
                        <input type="number" id="paymentsAgentPriority" min="1" max="10" value="2" class="priority-input">
                        <span class="priority-label">Priority</span>
                    </div>
                    <div class="priority-item">
                        <span class="agent-name">Identity Verification Agent</span>
                        <input type="number" id="idvAgentPriority" min="1" max="10" value="3" class="priority-input">
                        <span class="priority-label">Priority</span>
                    </div>
                    <div class="priority-item">
                        <span class="agent-name">Banking Info Agent</span>
                        <input type="number" id="bankingAgentPriority" min="1" max="10" value="4" class="priority-input">
                        <span class="priority-label">Priority</span>
                    </div>
                    <div class="priority-item">
                        <span class="agent-name">Default Agent</span>
                        <input type="number" id="defaultAgentPriority" min="1" max="10" value="5" class="priority-input">
                        <span class="priority-label">Priority</span>
                    </div>
                </div>
                <div class="setting-description">
                    Lower numbers = higher priority. Agents with higher priority are selected first when multiple agents match.
                </div>
            </div>

            <!-- Agent Voice Assignment -->
            <div class="setting-group" id="agentVoiceGroup">
                <label>Agent Voice Assignment:</label>
                <div class="agent-voice-list">
                    <div class="voice-assignment-item">
                        <span class="agent-name">Fraud Detection Agent</span>
                        <div class="voice-controls">
                            <select id="fraudAgentVoice" class="voice-select">
                                <option value="alloy">Alloy</option>
                                <option value="ash">Ash</option>
                                <option value="ballad">Ballad</option>
                                <option value="coral">Coral</option>
                                <option value="echo">Echo</option>
                                <option value="sage">Sage</option>
                                <option value="shimmer">Shimmer</option>
                                <option value="verse">Verse</option>
                            </select>
                            <input type="range" id="fraudAgentSpeed" min="0.25" max="4.0" step="0.25" value="0.9" class="speed-slider">
                            <span class="speed-value">0.9x</span>
                        </div>
                    </div>
                    <div class="voice-assignment-item">
                        <span class="agent-name">Payments Agent</span>
                        <div class="voice-controls">
                            <select id="paymentsAgentVoice" class="voice-select">
                                <option value="alloy">Alloy</option>
                                <option value="ash">Ash</option>
                                <option value="ballad">Ballad</option>
                                <option value="coral">Coral</option>
                                <option value="echo">Echo</option>
                                <option value="sage">Sage</option>
                                <option value="shimmer">Shimmer</option>
                                <option value="verse">Verse</option>
                            </select>
                            <input type="range" id="paymentsAgentSpeed" min="0.25" max="4.0" step="0.25" value="1.0" class="speed-slider">
                            <span class="speed-value">1.0x</span>
                        </div>
                    </div>
                    <div class="voice-assignment-item">
                        <span class="agent-name">Identity Verification Agent</span>
                        <div class="voice-controls">
                            <select id="idvAgentVoice" class="voice-select">
                                <option value="alloy">Alloy</option>
                                <option value="ash">Ash</option>
                                <option value="ballad">Ballad</option>
                                <option value="coral">Coral</option>
                                <option value="echo">Echo</option>
                                <option value="sage">Sage</option>
                                <option value="shimmer">Shimmer</option>
                                <option value="verse">Verse</option>
                            </select>
                            <input type="range" id="idvAgentSpeed" min="0.25" max="4.0" step="0.25" value="0.95" class="speed-slider">
                            <span class="speed-value">0.95x</span>
                        </div>
                    </div>
                    <div class="voice-assignment-item">
                        <span class="agent-name">Banking Info Agent</span>
                        <div class="voice-controls">
                            <select id="bankingAgentVoice" class="voice-select">
                                <option value="alloy">Alloy</option>
                                <option value="ash">Ash</option>
                                <option value="ballad">Ballad</option>
                                <option value="coral">Coral</option>
                                <option value="echo">Echo</option>
                                <option value="sage">Sage</option>
                                <option value="shimmer">Shimmer</option>
                                <option value="verse">Verse</option>
                            </select>
                            <input type="range" id="bankingAgentSpeed" min="0.25" max="4.0" step="0.25" value="1.0" class="speed-slider">
                            <span class="speed-value">1.0x</span>
                        </div>
                    </div>
                    <div class="voice-assignment-item">
                        <span class="agent-name">Default Agent</span>
                        <div class="voice-controls">
                            <select id="defaultAgentVoice" class="voice-select">
                                <option value="alloy">Alloy</option>
                                <option value="ash">Ash</option>
                                <option value="ballad">Ballad</option>
                                <option value="coral">Coral</option>
                                <option value="echo">Echo</option>
                                <option value="sage">Sage</option>
                                <option value="shimmer">Shimmer</option>
                                <option value="verse">Verse</option>
                            </select>
                            <input type="range" id="defaultAgentSpeed" min="0.25" max="4.0" step="0.25" value="1.0" class="speed-slider">
                            <span class="speed-value">1.0x</span>
                        </div>
                    </div>
                </div>
                <div class="setting-description">
                    Assign specific voices and speech speeds to different agents for better user experience
                </div>
            </div>

            <!-- Advanced Settings -->
            <div class="setting-group" id="advancedRoutingGroup">
                <label>Advanced Routing Settings:</label>
                <div class="advanced-settings-grid">
                    <div class="advanced-setting">
                        <label>Routing Timeout (ms):</label>
                        <input type="number" id="routingTimeout" min="50" max="500" value="100" class="advanced-input">
                    </div>
                    <div class="advanced-setting">
                        <label>Max Retries:</label>
                        <input type="number" id="maxRetries" min="1" max="5" value="3" class="advanced-input">
                    </div>
                    <div class="advanced-setting">
                        <label>Voice Transition Delay (ms):</label>
                        <input type="number" id="transitionDelay" min="0" max="1000" value="200" class="advanced-input">
                    </div>
                    <div class="advanced-setting">
                        <label>Fallback Voice:</label>
                        <select id="fallbackVoice" class="advanced-select">
                            <option value="alloy">Alloy</option>
                            <option value="ash">Ash</option>
                            <option value="ballad">Ballad</option>
                            <option value="coral">Coral</option>
                            <option value="echo">Echo</option>
                            <option value="sage">Sage</option>
                            <option value="shimmer">Shimmer</option>
                            <option value="verse">Verse</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Additional Options -->
            <div class="setting-group" id="additionalOptionsGroup">
                <div class="checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="enableVoiceSwitching" class="setting-checkbox">
                        <span class="checkbox-text">Enable voice switching between agents</span>
                    </label>
                </div>
                <div class="checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="smoothTransitions" class="setting-checkbox">
                        <span class="checkbox-text">Enable smooth voice transitions</span>
                    </label>
                </div>
                <div class="checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="contextPreservation" class="setting-checkbox">
                        <span class="checkbox-text">Preserve conversation context during agent switches</span>
                    </label>
                </div>
                <div class="checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="performanceMonitoring" class="setting-checkbox">
                        <span class="checkbox-text">Enable performance monitoring and metrics</span>
                    </label>
                </div>
            </div>

            <!-- Configuration Actions -->
            <div class="setting-group">
                <div class="config-actions">
                    <button id="saveStreamingConfig" class="config-btn primary">
                        <i class="fas fa-save"></i>
                        Save Configuration
                    </button>
                    <button id="resetStreamingConfig" class="config-btn secondary">
                        <i class="fas fa-undo"></i>
                        Reset to Defaults
                    </button>
                    <button id="testStreamingConfig" class="config-btn tertiary">
                        <i class="fas fa-vial"></i>
                        Test Configuration
                    </button>
                </div>
                <div id="configStatus" class="config-status"></div>
            </div>
        `;

        // Insert the streaming section after the audio configuration section
        const audioSection = settingsPanel.querySelector('.settings-section:last-child');
        if (audioSection) {
            audioSection.insertAdjacentElement('afterend', streamingSection);
        } else {
            settingsPanel.appendChild(streamingSection);
        }

        // Add CSS styles
        this.addConfigurationStyles();
    }

    /**
     * Add CSS styles for the configuration interface
     */
    addConfigurationStyles() {
        const styleId = 'streamingAgentConfigStyles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            /* Streaming Agent Configuration Styles */
            .agent-priority-list, .agent-voice-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin: 10px 0;
            }

            .priority-item, .voice-assignment-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px;
                background: #f8f9fa;
                border-radius: 6px;
                border: 1px solid #e9ecef;
            }

            .agent-name {
                font-weight: 500;
                color: #495057;
                flex: 1;
            }

            .priority-input {
                width: 60px;
                padding: 4px 8px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                text-align: center;
            }

            .priority-label {
                font-size: 12px;
                color: #6c757d;
                margin-left: 8px;
            }

            .voice-controls {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .voice-select {
                padding: 4px 8px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                background: white;
            }

            .speed-slider {
                width: 80px;
            }

            .speed-value {
                font-size: 12px;
                color: #6c757d;
                min-width: 35px;
                text-align: center;
            }

            .advanced-settings-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin: 10px 0;
            }

            .advanced-setting {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .advanced-setting label {
                font-size: 12px;
                font-weight: 500;
                color: #495057;
            }

            .advanced-input, .advanced-select {
                padding: 6px 10px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                background: white;
            }

            .checkbox-group {
                margin: 8px 0;
            }

            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }

            .checkbox-text {
                font-size: 14px;
                color: #495057;
            }

            .config-actions {
                display: flex;
                gap: 10px;
                margin: 15px 0 10px 0;
            }

            .config-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s ease;
            }

            .config-btn.primary {
                background: #007bff;
                color: white;
            }

            .config-btn.primary:hover {
                background: #0056b3;
            }

            .config-btn.secondary {
                background: #6c757d;
                color: white;
            }

            .config-btn.secondary:hover {
                background: #545b62;
            }

            .config-btn.tertiary {
                background: #28a745;
                color: white;
            }

            .config-btn.tertiary:hover {
                background: #1e7e34;
            }

            .config-status {
                margin-top: 10px;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 13px;
                display: none;
            }

            .config-status.success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
                display: block;
            }

            .config-status.error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
                display: block;
            }

            .config-status.info {
                background: #d1ecf1;
                color: #0c5460;
                border: 1px solid #bee5eb;
                display: block;
            }

            .toggle-label {
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
            }

            .toggle-slider {
                position: relative;
                width: 50px;
                height: 24px;
                background: #ccc;
                border-radius: 12px;
                transition: background 0.3s ease;
            }

            .toggle-slider::before {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 20px;
                height: 20px;
                background: white;
                border-radius: 50%;
                transition: transform 0.3s ease;
            }

            .setting-checkbox:checked + .toggle-slider {
                background: #007bff;
            }

            .setting-checkbox:checked + .toggle-slider::before {
                transform: translateX(26px);
            }

            .setting-checkbox {
                display: none;
            }

            .setting-description {
                font-size: 12px;
                color: #6c757d;
                margin-top: 5px;
                line-height: 1.4;
            }

            /* Disabled state styles */
            .setting-group.disabled {
                opacity: 0.6;
                pointer-events: none;
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * Bind event listeners to UI elements
     */
    bindEventListeners() {
        // Main toggle
        const enableToggle = document.getElementById('streamingRoutingEnabled');
        if (enableToggle) {
            enableToggle.addEventListener('change', (e) => {
                this.config.enabled = e.target.checked;
                this.updateDependentGroups();
                this.saveConfiguration();
            });
        }

        // Priority inputs
        const priorityInputs = [
            { id: 'fraudAgentPriority', agent: 'FraudAgent' },
            { id: 'paymentsAgentPriority', agent: 'PaymentsAgent' },
            { id: 'idvAgentPriority', agent: 'IDVAgent' },
            { id: 'bankingAgentPriority', agent: 'BankingInfoAgent' },
            { id: 'defaultAgentPriority', agent: 'DefaultAgent' }
        ];

        priorityInputs.forEach(({ id, agent }) => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', (e) => {
                    const value = parseInt(e.target.value);
                    if (this.validatePriority(value)) {
                        this.config.agentPriority[agent] = value;
                        this.saveConfiguration();
                    } else {
                        this.showConfigStatus('Invalid priority value', 'error');
                        e.target.value = this.config.agentPriority[agent];
                    }
                });
            }
        });

        // Voice assignments
        const voiceAssignments = [
            { voiceId: 'fraudAgentVoice', speedId: 'fraudAgentSpeed', agent: 'FraudAgent' },
            { voiceId: 'paymentsAgentVoice', speedId: 'paymentsAgentSpeed', agent: 'PaymentsAgent' },
            { voiceId: 'idvAgentVoice', speedId: 'idvAgentSpeed', agent: 'IDVAgent' },
            { voiceId: 'bankingAgentVoice', speedId: 'bankingAgentSpeed', agent: 'BankingInfoAgent' },
            { voiceId: 'defaultAgentVoice', speedId: 'defaultAgentSpeed', agent: 'DefaultAgent' }
        ];

        voiceAssignments.forEach(({ voiceId, speedId, agent }) => {
            const voiceSelect = document.getElementById(voiceId);
            const speedSlider = document.getElementById(speedId);

            if (voiceSelect) {
                voiceSelect.addEventListener('change', (e) => {
                    this.config.agentVoices[agent].voice = e.target.value;
                    this.saveConfiguration();
                });
            }

            if (speedSlider) {
                speedSlider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    this.config.agentVoices[agent].speed = value;
                    
                    // Update speed display
                    const speedValue = speedSlider.nextElementSibling;
                    if (speedValue) {
                        speedValue.textContent = `${value}x`;
                    }
                });

                speedSlider.addEventListener('change', () => {
                    this.saveConfiguration();
                });
            }
        });

        // Advanced settings
        const advancedSettings = [
            { id: 'routingTimeout', path: 'routingSettings.routingTimeout' },
            { id: 'maxRetries', path: 'routingSettings.maxRetries' },
            { id: 'transitionDelay', path: 'voiceSettings.transitionDelay' },
            { id: 'fallbackVoice', path: 'voiceSettings.fallbackVoice' }
        ];

        advancedSettings.forEach(({ id, path }) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', (e) => {
                    const value = element.type === 'number' ? parseInt(e.target.value) : e.target.value;
                    this.setNestedValue(this.config, path, value);
                    this.saveConfiguration();
                });
            }
        });

        // Checkboxes
        const checkboxes = [
            { id: 'enableVoiceSwitching', path: 'voiceSettings.enableVoiceSwitching' },
            { id: 'smoothTransitions', path: 'voiceSettings.smoothTransitions' },
            { id: 'contextPreservation', path: 'routingSettings.contextPreservation' },
            { id: 'performanceMonitoring', path: 'routingSettings.performanceMonitoring' }
        ];

        checkboxes.forEach(({ id, path }) => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.setNestedValue(this.config, path, e.target.checked);
                    this.saveConfiguration();
                });
            }
        });

        // Action buttons
        const saveBtn = document.getElementById('saveStreamingConfig');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveConfiguration(true));
        }

        const resetBtn = document.getElementById('resetStreamingConfig');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetToDefaults());
        }

        const testBtn = document.getElementById('testStreamingConfig');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testConfiguration());
        }
    }

    /**
     * Update UI elements from current configuration
     */
    updateUIFromConfig() {
        // Main toggle
        const enableToggle = document.getElementById('streamingRoutingEnabled');
        if (enableToggle) {
            enableToggle.checked = this.config.enabled;
        }

        // Priority inputs
        const priorityMappings = {
            'fraudAgentPriority': 'FraudAgent',
            'paymentsAgentPriority': 'PaymentsAgent',
            'idvAgentPriority': 'IDVAgent',
            'bankingAgentPriority': 'BankingInfoAgent',
            'defaultAgentPriority': 'DefaultAgent'
        };

        Object.entries(priorityMappings).forEach(([id, agent]) => {
            const input = document.getElementById(id);
            if (input) {
                input.value = this.config.agentPriority[agent];
            }
        });

        // Voice assignments
        const voiceMappings = {
            'fraudAgentVoice': 'FraudAgent',
            'paymentsAgentVoice': 'PaymentsAgent',
            'idvAgentVoice': 'IDVAgent',
            'bankingAgentVoice': 'BankingInfoAgent',
            'defaultAgentVoice': 'DefaultAgent'
        };

        Object.entries(voiceMappings).forEach(([id, agent]) => {
            const select = document.getElementById(id);
            if (select) {
                select.value = this.config.agentVoices[agent].voice;
            }
        });

        // Speed sliders
        const speedMappings = {
            'fraudAgentSpeed': 'FraudAgent',
            'paymentsAgentSpeed': 'PaymentsAgent',
            'idvAgentSpeed': 'IDVAgent',
            'bankingAgentSpeed': 'BankingInfoAgent',
            'defaultAgentSpeed': 'DefaultAgent'
        };

        Object.entries(speedMappings).forEach(([id, agent]) => {
            const slider = document.getElementById(id);
            if (slider) {
                const speed = this.config.agentVoices[agent].speed;
                slider.value = speed;
                
                // Update display
                const speedValue = slider.nextElementSibling;
                if (speedValue) {
                    speedValue.textContent = `${speed}x`;
                }
            }
        });

        // Advanced settings
        const advancedMappings = {
            'routingTimeout': this.config.routingSettings.routingTimeout,
            'maxRetries': this.config.routingSettings.maxRetries,
            'transitionDelay': this.config.voiceSettings.transitionDelay,
            'fallbackVoice': this.config.voiceSettings.fallbackVoice
        };

        Object.entries(advancedMappings).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        });

        // Checkboxes
        const checkboxMappings = {
            'enableVoiceSwitching': this.config.voiceSettings.enableVoiceSwitching,
            'smoothTransitions': this.config.voiceSettings.smoothTransitions,
            'contextPreservation': this.config.routingSettings.contextPreservation,
            'performanceMonitoring': this.config.routingSettings.performanceMonitoring
        };

        Object.entries(checkboxMappings).forEach(([id, value]) => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.checked = value;
            }
        });

        // Update dependent groups
        this.updateDependentGroups();
    }

    /**
     * Update dependent UI groups based on main toggle
     */
    updateDependentGroups() {
        const dependentGroups = [
            'agentPriorityGroup',
            'agentVoiceGroup',
            'advancedRoutingGroup',
            'additionalOptionsGroup'
        ];

        dependentGroups.forEach(groupId => {
            const group = document.getElementById(groupId);
            if (group) {
                if (this.config.enabled) {
                    group.classList.remove('disabled');
                } else {
                    group.classList.add('disabled');
                }
            }
        });
    }

    /**
     * Load configuration from storage
     */
    loadConfiguration() {
        try {
            const stored = localStorage.getItem(this.configKey);
            if (stored) {
                const parsedConfig = JSON.parse(stored);
                this.config = this.mergeConfigurations(this.config, parsedConfig);
            }
        } catch (error) {
            console.error('[StreamingAgentConfig] Error loading configuration:', error);
        }
    }

    /**
     * Save configuration to storage
     */
    saveConfiguration(showStatus = false) {
        try {
            // Validate configuration before saving
            const validation = this.validateConfiguration();
            if (!validation.isValid) {
                this.showConfigStatus(`Validation failed: ${validation.errors.join(', ')}`, 'error');
                return false;
            }

            localStorage.setItem(this.configKey, JSON.stringify(this.config));
            
            // Notify other components of configuration change
            this.notifyConfigurationChange();
            
            if (showStatus) {
                this.showConfigStatus('Configuration saved successfully', 'success');
            }
            
            return true;
        } catch (error) {
            console.error('[StreamingAgentConfig] Error saving configuration:', error);
            this.showConfigStatus('Error saving configuration', 'error');
            return false;
        }
    }

    /**
     * Reset configuration to defaults
     */
    resetToDefaults() {
        if (confirm('Are you sure you want to reset all streaming agent routing settings to defaults?')) {
            // Reset to default configuration
            this.config = {
                enabled: false,
                agentPriority: {
                    'FraudAgent': 1,
                    'PaymentsAgent': 2,
                    'IDVAgent': 3,
                    'BankingInfoAgent': 4,
                    'DefaultAgent': 5
                },
                agentVoices: {
                    'FraudAgent': { voice: 'alloy', speed: 0.9, pitch: 1.0, temperature: 0.8 },
                    'PaymentsAgent': { voice: 'echo', speed: 1.0, pitch: 1.0, temperature: 0.7 },
                    'IDVAgent': { voice: 'coral', speed: 0.95, pitch: 1.0, temperature: 0.8 },
                    'BankingInfoAgent': { voice: 'shimmer', speed: 1.0, pitch: 1.0, temperature: 0.9 },
                    'DefaultAgent': { voice: 'shimmer', speed: 1.0, pitch: 1.0, temperature: 0.9 }
                },
                routingSettings: {
                    routingTimeout: 100,
                    maxRetries: 3,
                    fallbackEnabled: true,
                    contextPreservation: true,
                    performanceMonitoring: true
                },
                voiceSettings: {
                    enableVoiceSwitching: true,
                    smoothTransitions: true,
                    fallbackVoice: 'shimmer',
                    transitionDelay: 200
                }
            };

            this.updateUIFromConfig();
            this.saveConfiguration();
            this.showConfigStatus('Configuration reset to defaults', 'info');
        }
    }

    /**
     * Test current configuration
     */
    testConfiguration() {
        this.showConfigStatus('Testing configuration...', 'info');
        
        // Simulate configuration test
        setTimeout(() => {
            const validation = this.validateConfiguration();
            if (validation.isValid) {
                this.showConfigStatus('Configuration test passed successfully', 'success');
            } else {
                this.showConfigStatus(`Configuration test failed: ${validation.errors.join(', ')}`, 'error');
            }
        }, 1000);
    }

    /**
     * Validate current configuration
     */
    validateConfiguration() {
        const errors = [];

        // Validate agent priorities
        const priorities = Object.values(this.config.agentPriority);
        const rules = this.validationRules.agentPriority;
        
        priorities.forEach(priority => {
            if (priority < rules.min || priority > rules.max) {
                errors.push(`Priority must be between ${rules.min} and ${rules.max}`);
            }
        });

        // Validate agent voices
        Object.entries(this.config.agentVoices).forEach(([agent, voiceConfig]) => {
            const voiceRules = this.validationRules.agentVoices;
            
            if (!voiceRules.validVoices.includes(voiceConfig.voice)) {
                errors.push(`Invalid voice for ${agent}: ${voiceConfig.voice}`);
            }
            
            if (voiceConfig.speed < voiceRules.speedRange.min || voiceConfig.speed > voiceRules.speedRange.max) {
                errors.push(`Invalid speed for ${agent}: ${voiceConfig.speed}`);
            }
        });

        // Validate routing settings
        const routingRules = this.validationRules.routingSettings;
        if (this.config.routingSettings.routingTimeout < routingRules.routingTimeout.min || 
            this.config.routingSettings.routingTimeout > routingRules.routingTimeout.max) {
            errors.push('Invalid routing timeout value');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate priority value
     */
    validatePriority(value) {
        const rules = this.validationRules.agentPriority;
        return value >= rules.min && value <= rules.max;
    }

    /**
     * Show configuration status message
     */
    showConfigStatus(message, type = 'info') {
        const statusElement = document.getElementById('configStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `config-status ${type}`;
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * Merge configurations (deep merge)
     */
    mergeConfigurations(defaultConfig, userConfig) {
        const merged = JSON.parse(JSON.stringify(defaultConfig));
        
        Object.keys(userConfig).forEach(key => {
            if (typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])) {
                merged[key] = this.mergeConfigurations(merged[key] || {}, userConfig[key]);
            } else {
                merged[key] = userConfig[key];
            }
        });
        
        return merged;
    }

    /**
     * Set nested value in object using dot notation
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in current)) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    /**
     * Notify other components of configuration changes
     */
    notifyConfigurationChange() {
        // Notify StreamingManager if available
        if (window.streamingManager && typeof window.streamingManager.updateAgentRoutingConfig === 'function') {
            window.streamingManager.updateAgentRoutingConfig(this.config);
        }

        // Notify StreamingAgentRouter if available
        if (window.streamingAgentRouter && typeof window.streamingAgentRouter.updateConfiguration === 'function') {
            window.streamingAgentRouter.updateConfiguration(this.config);
        }

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('streamingAgentConfigChanged', {
            detail: { config: this.config }
        }));
    }

    /**
     * Get current configuration
     */
    getConfiguration() {
        return JSON.parse(JSON.stringify(this.config));
    }

    /**
     * Update configuration programmatically
     */
    updateConfiguration(newConfig) {
        this.config = this.mergeConfigurations(this.config, newConfig);
        this.updateUIFromConfig();
        this.saveConfiguration();
    }

    /**
     * Check if streaming agent routing is enabled
     */
    isEnabled() {
        return this.config.enabled;
    }

    /**
     * Get agent priority configuration
     */
    getAgentPriorities() {
        return { ...this.config.agentPriority };
    }

    /**
     * Get agent voice configuration
     */
    getAgentVoices() {
        return JSON.parse(JSON.stringify(this.config.agentVoices));
    }

    /**
     * Get routing settings
     */
    getRoutingSettings() {
        return { ...this.config.routingSettings };
    }

    /**
     * Get voice settings
     */
    getVoiceSettings() {
        return { ...this.config.voiceSettings };
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.streamingAgentConfig = new StreamingAgentConfig();
    console.log('[StreamingAgentConfig] Streaming agent routing configuration system initialized');
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingAgentConfig;
}
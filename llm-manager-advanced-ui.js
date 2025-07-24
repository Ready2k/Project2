/**
 * LLM Manager Advanced UI - Extended functionality for advanced features
 * Handles configuration templates, performance metrics, diff tools, scheduling, and multi-environment management
 */

class LLMManagerAdvancedUI {
    constructor(llmManager) {
        this.llmManager = llmManager;
        this.debug = window.debugManager?.createModuleLogger('AdvancedUI') || console;
        this.currentEnvironment = 'production';
        this.metricsUpdateInterval = null;
        
        this.initialize();
    }
    
    /**
     * Initialize the advanced UI
     */
    initialize() {
        this.debug.log('Initializing LLM Manager Advanced UI');
        
        // Set up event listeners for advanced features
        this.setupAdvancedEventListeners();
        
        // Start metrics updates
        this.startMetricsUpdates();
        
        this.debug.log('Advanced UI initialized successfully');
    }
    
    /**
     * Set up event listeners for advanced features
     */
    setupAdvancedEventListeners() {
        // Listen for scheduled change completions
        window.addEventListener('scheduledChangeCompleted', (event) => {
            this.handleScheduledChangeCompletion(event.detail);
        });
        
        // Environment switching
        document.addEventListener('change', (e) => {
            if (e.target.id === 'environmentSelector') {
                this.switchEnvironment(e.target.value);
            }
        });
    }
    
    /**
     * Start automatic metrics updates
     */
    startMetricsUpdates() {
        // Update metrics every 30 seconds
        this.metricsUpdateInterval = setInterval(() => {
            if (document.querySelector('.metrics-section:not(.hidden)')) {
                this.refreshPerformanceMetrics();
            }
        }, 30000);
    }
    
    /**
     * Stop metrics updates
     */
    stopMetricsUpdates() {
        if (this.metricsUpdateInterval) {
            clearInterval(this.metricsUpdateInterval);
            this.metricsUpdateInterval = null;
        }
    }
    
    /**
     * Show configuration templates modal
     */
    showConfigurationTemplates() {
        const templates = this.llmManager.getConfigurationTemplates();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'templatesModal';
        modal.innerHTML = `
            <div class="modal-content large-modal">
                <div class="modal-header">
                    <h2 class="modal-title">Configuration Templates</h2>
                    <button class="modal-close" onclick="closeModal('templatesModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="templates-grid">
                        ${Object.entries(templates).map(([key, template]) => `
                            <div class="template-card" data-template="${key}">
                                <div class="template-header">
                                    <h3>${template.name}</h3>
                                    <div class="template-actions">
                                        <button class="btn btn-primary btn-sm" onclick="advancedUI.previewTemplate('${key}')">
                                            👁️ Preview
                                        </button>
                                        <button class="btn btn-success btn-sm" onclick="advancedUI.applyTemplate('${key}')">
                                            ✅ Apply
                                        </button>
                                    </div>
                                </div>
                                <div class="template-description">
                                    ${template.description}
                                </div>
                                <div class="template-features">
                                    <div class="feature-tag">Priority: ${template.config.priority}</div>
                                    <div class="feature-tag">Provider: ${template.config.llmProvider}</div>
                                    <div class="feature-tag">Model: ${template.config.llmModel}</div>
                                    <div class="feature-tag">Tokens: ${template.config.maxTokens}</div>
                                </div>
                                <div class="template-capabilities">
                                    <h4>Capabilities:</h4>
                                    <ul>
                                        ${Object.entries(template.config.guardrails.allowedCapabilities)
                                            .filter(([_, enabled]) => enabled)
                                            .map(([capability]) => `<li>${this.formatCapabilityName(capability)}</li>`)
                                            .join('')}
                                    </ul>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('templatesModal')">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    }
    
    /**
     * Preview configuration template
     */
    previewTemplate(templateKey) {
        const templates = this.llmManager.getConfigurationTemplates();
        const template = templates[templateKey];
        
        if (!template) {
            this.showError('Template not found');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'templatePreviewModal';
        modal.innerHTML = `
            <div class="modal-content large-modal">
                <div class="modal-header">
                    <h2 class="modal-title">Template Preview: ${template.name}</h2>
                    <button class="modal-close" onclick="closeModal('templatePreviewModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="template-preview">
                        <h3>Configuration</h3>
                        <pre class="config-preview">${JSON.stringify(template.config, null, 2)}</pre>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-success" onclick="advancedUI.applyTemplate('${templateKey}')">Apply Template</button>
                    <button class="btn btn-secondary" onclick="closeModal('templatePreviewModal')">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    }
    
    /**
     * Apply configuration template
     */
    async applyTemplate(templateKey) {
        const agentName = prompt('Enter agent name to apply template to:');
        if (!agentName) return;
        
        const overrides = {};
        const customDescription = prompt('Enter custom description (optional):');
        if (customDescription) {
            overrides.description = customDescription;
        }
        
        try {
            const result = await this.llmManager.applyConfigurationTemplate(agentName, templateKey, overrides);
            
            if (result.success) {
                this.showSuccess(`Template applied successfully to ${agentName}`);
                this.closeModal('templatesModal');
                this.closeModal('templatePreviewModal');
                // Refresh the UI
                if (window.adminUI) {
                    window.adminUI.refreshAgentData();
                }
            } else {
                this.showError(`Failed to apply template: ${result.error}`);
            }
        } catch (error) {
            this.showError(`Error applying template: ${error.message}`);
        }
    }
    
    /**
     * Show performance metrics dashboard
     */
    showPerformanceMetrics() {
        const metrics = this.llmManager.getAgentPerformanceMetrics();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'metricsModal';
        modal.innerHTML = `
            <div class="modal-content extra-large-modal">
                <div class="modal-header">
                    <h2 class="modal-title">Agent Performance Metrics</h2>
                    <div class="metrics-controls">
                        <select id="metricsTimeRange" onchange="advancedUI.updateMetricsTimeRange(this.value)">
                            <option value="1h">Last Hour</option>
                            <option value="24h" selected>Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                        </select>
                        <button class="btn btn-primary btn-sm" onclick="advancedUI.refreshPerformanceMetrics()">
                            🔄 Refresh
                        </button>
                    </div>
                    <button class="modal-close" onclick="closeModal('metricsModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="metricsContent">
                        ${this.renderMetricsDashboard(metrics)}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="advancedUI.exportMetrics()">Export Metrics</button>
                    <button class="btn btn-secondary" onclick="closeModal('metricsModal')">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    }
    
    /**
     * Render metrics dashboard
     */
    renderMetricsDashboard(metrics) {
        const agentNames = Object.keys(metrics);
        
        return `
            <div class="metrics-overview">
                <div class="metrics-summary">
                    <div class="metric-card">
                        <h3>Total Agents</h3>
                        <div class="metric-value">${agentNames.length}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Total Requests</h3>
                        <div class="metric-value">${Object.values(metrics).reduce((sum, m) => sum + m.totalRequests, 0)}</div>
                    </div>
                    <div class="metric-card">
                        <h3>Average Success Rate</h3>
                        <div class="metric-value">${(Object.values(metrics).reduce((sum, m) => sum + (m.successfulRequests / m.totalRequests), 0) / agentNames.length * 100).toFixed(1)}%</div>
                    </div>
                    <div class="metric-card">
                        <h3>Total Tokens Used</h3>
                        <div class="metric-value">${Object.values(metrics).reduce((sum, m) => sum + m.totalTokensUsed, 0).toLocaleString()}</div>
                    </div>
                </div>
                
                <div class="metrics-agents">
                    ${agentNames.map(agentName => {
                        const agentMetrics = metrics[agentName];
                        const successRate = (agentMetrics.successfulRequests / agentMetrics.totalRequests * 100).toFixed(1);
                        
                        return `
                            <div class="agent-metrics-card">
                                <div class="agent-metrics-header">
                                    <h3>${agentName}</h3>
                                    <div class="metrics-status ${successRate > 95 ? 'excellent' : successRate > 90 ? 'good' : 'warning'}">
                                        ${successRate}% Success Rate
                                    </div>
                                </div>
                                
                                <div class="agent-metrics-grid">
                                    <div class="metric-item">
                                        <span class="metric-label">Requests</span>
                                        <span class="metric-value">${agentMetrics.totalRequests}</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Avg Response Time</span>
                                        <span class="metric-value">${agentMetrics.averageResponseTime}ms</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Tokens Used</span>
                                        <span class="metric-value">${agentMetrics.totalTokensUsed.toLocaleString()}</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Activations</span>
                                        <span class="metric-value">${agentMetrics.activationCount}</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Error Rate</span>
                                        <span class="metric-value">${(agentMetrics.errorRate * 100).toFixed(2)}%</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Last Active</span>
                                        <span class="metric-value">${new Date(agentMetrics.lastActivated).toLocaleString()}</span>
                                    </div>
                                </div>
                                
                                <div class="top-triggers">
                                    <h4>Top Triggers</h4>
                                    <div class="triggers-list">
                                        ${agentMetrics.topTriggers.map(trigger => `
                                            <div class="trigger-stat">
                                                <span class="trigger-name">${trigger.trigger}</span>
                                                <span class="trigger-count">${trigger.count}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                
                                <div class="activity-chart">
                                    <h4>24-Hour Activity</h4>
                                    <div class="chart-container">
                                        ${this.renderActivityChart(agentMetrics.hourlyActivity)}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * Render activity chart
     */
    renderActivityChart(hourlyActivity) {
        const maxRequests = Math.max(...hourlyActivity.map(h => h.requests));
        
        return `
            <div class="activity-bars">
                ${hourlyActivity.map(hour => `
                    <div class="activity-bar" style="height: ${(hour.requests / maxRequests) * 100}%" 
                         title="Hour ${hour.hour}: ${hour.requests} requests">
                        <div class="bar-fill"></div>
                        <div class="bar-label">${hour.hour}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * Show configuration comparison tool
     */
    showConfigurationComparison() {
        const agents = this.llmManager.getAgentConfigurations();
        const agentNames = Object.keys(agents);
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'comparisonModal';
        modal.innerHTML = `
            <div class="modal-content large-modal">
                <div class="modal-header">
                    <h2 class="modal-title">Configuration Comparison</h2>
                    <button class="modal-close" onclick="closeModal('comparisonModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="comparison-controls">
                        <div class="form-group">
                            <label class="form-label">First Agent</label>
                            <select class="form-select" id="compareAgent1">
                                <option value="">Select agent...</option>
                                ${agentNames.map(name => `<option value="${name}">${name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Second Agent</label>
                            <select class="form-select" id="compareAgent2">
                                <option value="">Select agent...</option>
                                ${agentNames.map(name => `<option value="${name}">${name}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn btn-primary" onclick="advancedUI.performComparison()">
                            Compare Configurations
                        </button>
                    </div>
                    <div id="comparisonResults" class="comparison-results" style="display: none;">
                        <!-- Comparison results will be displayed here -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('comparisonModal')">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    }
    
    /**
     * Perform configuration comparison
     */
    performComparison() {
        const agent1 = document.getElementById('compareAgent1').value;
        const agent2 = document.getElementById('compareAgent2').value;
        
        if (!agent1 || !agent2) {
            this.showError('Please select both agents to compare');
            return;
        }
        
        if (agent1 === agent2) {
            this.showError('Please select different agents to compare');
            return;
        }
        
        const comparison = this.llmManager.compareConfigurations(agent1, agent2);
        
        if (!comparison.success) {
            this.showError(comparison.error);
            return;
        }
        
        const resultsDiv = document.getElementById('comparisonResults');
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = this.renderComparisonResults(comparison);
    }
    
    /**
     * Render comparison results
     */
    renderComparisonResults(comparison) {
        return `
            <div class="comparison-summary">
                <h3>Comparison: ${comparison.agent1} vs ${comparison.agent2}</h3>
                <div class="compatibility-score">
                    <span class="score-label">Compatibility Score:</span>
                    <span class="score-value ${comparison.compatibilityScore > 0.8 ? 'high' : comparison.compatibilityScore > 0.5 ? 'medium' : 'low'}">
                        ${(comparison.compatibilityScore * 100).toFixed(1)}%
                    </span>
                </div>
            </div>
            
            <div class="comparison-sections">
                <div class="comparison-section">
                    <h4>Differences (${comparison.differences.length})</h4>
                    <div class="differences-list">
                        ${comparison.differences.map(diff => `
                            <div class="difference-item">
                                <div class="diff-property">${diff.property}</div>
                                <div class="diff-values">
                                    <div class="diff-value agent1">
                                        <span class="agent-label">${comparison.agent1}:</span>
                                        <span class="value">${this.formatDiffValue(diff.agent1)}</span>
                                    </div>
                                    <div class="diff-value agent2">
                                        <span class="agent-label">${comparison.agent2}:</span>
                                        <span class="value">${this.formatDiffValue(diff.agent2)}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="comparison-section">
                    <h4>Similarities (${comparison.similarities.length})</h4>
                    <div class="similarities-list">
                        ${comparison.similarities.map(sim => `
                            <div class="similarity-item">
                                <span class="sim-property">${sim.property}:</span>
                                <span class="sim-value">${this.formatDiffValue(sim.value)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Show scheduled changes manager
     */
    showScheduledChanges() {
        const scheduledChanges = this.llmManager.getScheduledChanges();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'scheduledChangesModal';
        modal.innerHTML = `
            <div class="modal-content large-modal">
                <div class="modal-header">
                    <h2 class="modal-title">Scheduled Configuration Changes</h2>
                    <button class="btn btn-success btn-sm" onclick="advancedUI.showScheduleChangeForm()">
                        ➕ Schedule New Change
                    </button>
                    <button class="modal-close" onclick="closeModal('scheduledChangesModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="scheduledChangesList">
                        ${this.renderScheduledChangesList(scheduledChanges)}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="advancedUI.refreshScheduledChanges()">Refresh</button>
                    <button class="btn btn-secondary" onclick="closeModal('scheduledChangesModal')">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    }
    
    /**
     * Render scheduled changes list
     */
    renderScheduledChangesList(scheduledChanges) {
        if (scheduledChanges.length === 0) {
            return '<div class="empty-state">No scheduled changes found</div>';
        }
        
        return `
            <div class="scheduled-changes-list">
                ${scheduledChanges.map(change => `
                    <div class="scheduled-change-item ${change.status}">
                        <div class="change-header">
                            <div class="change-info">
                                <h4>${change.agentName}</h4>
                                <div class="change-status status-${change.status}">${change.status.toUpperCase()}</div>
                            </div>
                            <div class="change-actions">
                                ${change.status === 'scheduled' ? `
                                    <button class="btn btn-warning btn-sm" onclick="advancedUI.cancelScheduledChange('${change.id}')">
                                        Cancel
                                    </button>
                                ` : ''}
                                <button class="btn btn-info btn-sm" onclick="advancedUI.viewScheduledChange('${change.id}')">
                                    View Details
                                </button>
                            </div>
                        </div>
                        <div class="change-details">
                            <div class="detail-item">
                                <span class="detail-label">Scheduled Time:</span>
                                <span class="detail-value">${new Date(change.scheduledTime).toLocaleString()}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Created:</span>
                                <span class="detail-value">${new Date(change.createdAt).toLocaleString()}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Reason:</span>
                                <span class="detail-value">${change.options.reason}</span>
                            </div>
                            ${change.executedAt ? `
                                <div class="detail-item">
                                    <span class="detail-label">Executed:</span>
                                    <span class="detail-value">${new Date(change.executedAt).toLocaleString()}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * Show environment management interface
     */
    showEnvironmentManagement() {
        const environments = this.llmManager.getEnvironmentConfigurations();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'environmentModal';
        modal.innerHTML = `
            <div class="modal-content extra-large-modal">
                <div class="modal-header">
                    <h2 class="modal-title">Multi-Environment Configuration Management</h2>
                    <div class="environment-selector">
                        <label>Current Environment:</label>
                        <select id="environmentSelector" onchange="advancedUI.switchEnvironment(this.value)">
                            <option value="development" ${this.currentEnvironment === 'development' ? 'selected' : ''}>Development</option>
                            <option value="staging" ${this.currentEnvironment === 'staging' ? 'selected' : ''}>Staging</option>
                            <option value="production" ${this.currentEnvironment === 'production' ? 'selected' : ''}>Production</option>
                        </select>
                    </div>
                    <button class="modal-close" onclick="closeModal('environmentModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="environmentContent">
                        ${this.renderEnvironmentContent(environments)}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="advancedUI.saveCurrentEnvironment()">Save Current Config</button>
                    <button class="btn btn-warning" onclick="advancedUI.promoteConfiguration()">Promote Config</button>
                    <button class="btn btn-secondary" onclick="closeModal('environmentModal')">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    }
    
    /**
     * Render environment content
     */
    renderEnvironmentContent(environments) {
        return `
            <div class="environment-tabs">
                ${Object.keys(environments).map(env => `
                    <button class="tab-btn ${env === this.currentEnvironment ? 'active' : ''}" 
                            onclick="advancedUI.switchEnvironmentTab('${env}')">
                        ${env.charAt(0).toUpperCase() + env.slice(1)}
                    </button>
                `).join('')}
            </div>
            
            <div class="environment-content">
                ${Object.entries(environments).map(([env, configs]) => `
                    <div class="environment-tab-content ${env === this.currentEnvironment ? 'active' : ''}" 
                         id="env-${env}">
                        <h3>${env.charAt(0).toUpperCase() + env.slice(1)} Environment</h3>
                        ${Object.keys(configs).length === 0 ? 
                            '<div class="empty-state">No configurations saved in this environment</div>' :
                            `<div class="environment-configs">
                                ${Object.entries(configs).map(([agentName, config]) => `
                                    <div class="env-config-item">
                                        <div class="config-header">
                                            <h4>${agentName}</h4>
                                            <div class="config-actions">
                                                <button class="btn btn-primary btn-sm" 
                                                        onclick="advancedUI.loadEnvironmentConfig('${env}', '${agentName}')">
                                                    Load
                                                </button>
                                                <button class="btn btn-info btn-sm" 
                                                        onclick="advancedUI.viewEnvironmentConfig('${env}', '${agentName}')">
                                                    View
                                                </button>
                                            </div>
                                        </div>
                                        <div class="config-meta">
                                            <span>Saved: ${new Date(config.savedAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>`
                        }
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * Format capability name for display
     */
    formatCapabilityName(capability) {
        return capability.replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase())
                        .replace(/^Can /, '');
    }
    
    /**
     * Format diff value for display
     */
    formatDiffValue(value) {
        if (Array.isArray(value)) {
            return value.length > 0 ? value.join(', ') : 'None';
        }
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return String(value);
    }
    
    /**
     * Close modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    }
    
    /**
     * Show success message
     */
    showSuccess(message) {
        // Implementation would depend on existing notification system
        console.log('Success:', message);
        if (window.adminUI && window.adminUI.showSuccess) {
            window.adminUI.showSuccess(message);
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        // Implementation would depend on existing notification system
        console.error('Error:', message);
        if (window.adminUI && window.adminUI.showError) {
            window.adminUI.showError(message);
        }
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopMetricsUpdates();
        this.debug.log('Advanced UI cleanup completed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LLMManagerAdvancedUI;
} else if (typeof window !== 'undefined') {
    window.LLMManagerAdvancedUI = LLMManagerAdvancedUI;
}
/**
 * Streaming Agent Routing Debug and Monitoring Panel
 * Provides real-time debugging and monitoring capabilities for streaming agent routing
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
class StreamingDebugPanel {
    constructor() {
        this.isVisible = false;
        this.isMonitoring = false;
        this.routingMetrics = {
            totalDecisions: 0,
            successfulRoutes: 0,
            agentSwitches: 0,
            fallbackCount: 0,
            averageLatency: 0,
            errorCount: 0
        };
        
        // Real-time data storage
        this.routingDecisions = [];
        this.performanceMetrics = [];
        this.errorLogs = [];
        this.agentSwitchHistory = [];
        
        // Chart instances for real-time updates
        this.latencyChart = null;
        this.successRateChart = null;
        this.agentUsageChart = null;
        
        // Update intervals
        this.metricsUpdateInterval = null;
        this.chartUpdateInterval = null;
        
        // Initialize debug logger
        this.debug = window.debugManager ? 
            window.debugManager.createModuleLogger('StreamingDebugPanel') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
            
        this.initializePanel();
        this.setupEventListeners();
        
        this.debug.info('StreamingDebugPanel initialized');
    }

    /**
     * Initialize the debug panel UI
     */
    initializePanel() {
        // Create panel HTML structure
        const panelHTML = `
            <div id="streamingDebugPanel" class="debug-panel" style="display: none;">
                <div class="debug-panel-header">
                    <h3><i class="fas fa-stream"></i> Streaming Agent Routing Debug</h3>
                    <div class="debug-panel-controls">
                        <button id="toggleMonitoring" class="debug-btn">
                            <i class="fas fa-play"></i> Start Monitoring
                        </button>
                        <button id="clearDebugData" class="debug-btn">
                            <i class="fas fa-trash"></i> Clear Data
                        </button>
                        <button id="exportDebugData" class="debug-btn">
                            <i class="fas fa-download"></i> Export
                        </button>
                        <button id="closeDebugPanel" class="debug-btn close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <div class="debug-panel-content">
                    <!-- Real-time Metrics Dashboard -->
                    <div class="debug-section">
                        <h4><i class="fas fa-tachometer-alt"></i> Real-time Metrics</h4>
                        <div class="metrics-grid">
                            <div class="metric-card">
                                <div class="metric-value" id="totalDecisions">0</div>
                                <div class="metric-label">Total Decisions</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-value" id="successRate">0%</div>
                                <div class="metric-label">Success Rate</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-value" id="avgLatency">0ms</div>
                                <div class="metric-label">Avg Latency</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-value" id="agentSwitches">0</div>
                                <div class="metric-label">Agent Switches</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-value" id="errorCount">0</div>
                                <div class="metric-label">Errors</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-value" id="currentAgent">None</div>
                                <div class="metric-label">Current Agent</div>
                            </div>
                        </div>
                    </div>

                    <!-- Performance Charts -->
                    <div class="debug-section">
                        <h4><i class="fas fa-chart-line"></i> Performance Charts</h4>
                        <div class="charts-container">
                            <div class="chart-wrapper">
                                <h5>Routing Latency (ms)</h5>
                                <canvas id="latencyChart" width="400" height="200"></canvas>
                            </div>
                            <div class="chart-wrapper">
                                <h5>Success Rate (%)</h5>
                                <canvas id="successRateChart" width="400" height="200"></canvas>
                            </div>
                            <div class="chart-wrapper">
                                <h5>Agent Usage Distribution</h5>
                                <canvas id="agentUsageChart" width="400" height="200"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Routing Decisions Log -->
                    <div class="debug-section">
                        <h4><i class="fas fa-route"></i> Routing Decisions</h4>
                        <div class="log-controls">
                            <button id="pauseRoutingLog" class="debug-btn-small">
                                <i class="fas fa-pause"></i> Pause
                            </button>
                            <button id="clearRoutingLog" class="debug-btn-small">
                                <i class="fas fa-eraser"></i> Clear
                            </button>
                            <select id="routingLogFilter">
                                <option value="all">All Decisions</option>
                                <option value="successful">Successful Only</option>
                                <option value="failed">Failed Only</option>
                                <option value="fallback">Fallback Used</option>
                            </select>
                        </div>
                        <div id="routingDecisionsList" class="debug-log-container">
                            <!-- Routing decisions will be populated here -->
                        </div>
                    </div>

                    <!-- Agent Switch History -->
                    <div class="debug-section">
                        <h4><i class="fas fa-exchange-alt"></i> Agent Switch History</h4>
                        <div id="agentSwitchHistory" class="debug-log-container">
                            <!-- Agent switches will be populated here -->
                        </div>
                    </div>

                    <!-- Error Analysis -->
                    <div class="debug-section">
                        <h4><i class="fas fa-exclamation-triangle"></i> Error Analysis</h4>
                        <div class="error-summary">
                            <div class="error-stats">
                                <span>Routing Errors: <span id="routingErrorCount">0</span></span>
                                <span>Timeout Errors: <span id="timeoutErrorCount">0</span></span>
                                <span>Agent Errors: <span id="agentErrorCount">0</span></span>
                            </div>
                        </div>
                        <div id="errorLogsList" class="debug-log-container">
                            <!-- Error logs will be populated here -->
                        </div>
                    </div>

                    <!-- Context Information -->
                    <div class="debug-section">
                        <h4><i class="fas fa-info-circle"></i> Current Context</h4>
                        <div id="contextInfo" class="context-display">
                            <div class="context-item">
                                <strong>Session ID:</strong> <span id="sessionId">-</span>
                            </div>
                            <div class="context-item">
                                <strong>Connection Status:</strong> <span id="connectionStatus">-</span>
                            </div>
                            <div class="context-item">
                                <strong>Agent Routing Enabled:</strong> <span id="agentRoutingStatus">-</span>
                            </div>
                            <div class="context-item">
                                <strong>Voice Configuration:</strong> <span id="voiceConfig">-</span>
                            </div>
                            <div class="context-item">
                                <strong>Last Decision Time:</strong> <span id="lastDecisionTime">-</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add panel to DOM
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        
        // Add CSS styles
        this.addPanelStyles();
    }

    /**
     * Add CSS styles for the debug panel
     */
    addPanelStyles() {
        const styles = `
            <style id="streamingDebugPanelStyles">
                .debug-panel {
                    position: fixed;
                    top: 0;
                    right: 0;
                    width: 80%;
                    height: 100vh;
                    background: #1a1a1a;
                    color: #ffffff;
                    z-index: 10000;
                    overflow-y: auto;
                    box-shadow: -5px 0 15px rgba(0,0,0,0.3);
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                }

                .debug-panel-header {
                    background: #2d2d2d;
                    padding: 15px 20px;
                    border-bottom: 1px solid #444;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                }

                .debug-panel-header h3 {
                    margin: 0;
                    color: #00ff88;
                    font-size: 16px;
                }

                .debug-panel-controls {
                    display: flex;
                    gap: 10px;
                }

                .debug-btn {
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: background-color 0.2s;
                }

                .debug-btn:hover {
                    background: #0056b3;
                }

                .debug-btn.close-btn {
                    background: #dc3545;
                }

                .debug-btn.close-btn:hover {
                    background: #c82333;
                }

                .debug-btn-small {
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                    margin-right: 5px;
                }

                .debug-panel-content {
                    padding: 20px;
                }

                .debug-section {
                    margin-bottom: 30px;
                    border: 1px solid #444;
                    border-radius: 6px;
                    padding: 15px;
                    background: #2a2a2a;
                }

                .debug-section h4 {
                    margin: 0 0 15px 0;
                    color: #ffc107;
                    font-size: 14px;
                    border-bottom: 1px solid #444;
                    padding-bottom: 8px;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .metric-card {
                    background: #333;
                    padding: 15px;
                    border-radius: 6px;
                    text-align: center;
                    border: 1px solid #555;
                }

                .metric-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #00ff88;
                    margin-bottom: 5px;
                }

                .metric-label {
                    font-size: 11px;
                    color: #ccc;
                    text-transform: uppercase;
                }

                .charts-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 20px;
                }

                .chart-wrapper {
                    background: #333;
                    padding: 15px;
                    border-radius: 6px;
                    border: 1px solid #555;
                }

                .chart-wrapper h5 {
                    margin: 0 0 10px 0;
                    color: #ffc107;
                    font-size: 12px;
                }

                .debug-log-container {
                    max-height: 300px;
                    overflow-y: auto;
                    background: #1e1e1e;
                    border: 1px solid #444;
                    border-radius: 4px;
                    padding: 10px;
                }

                .log-entry {
                    padding: 8px;
                    margin-bottom: 5px;
                    border-radius: 3px;
                    border-left: 3px solid #007bff;
                    background: #2a2a2a;
                    font-size: 11px;
                }

                .log-entry.success {
                    border-left-color: #28a745;
                }

                .log-entry.error {
                    border-left-color: #dc3545;
                }

                .log-entry.warning {
                    border-left-color: #ffc107;
                }

                .log-timestamp {
                    color: #6c757d;
                    font-size: 10px;
                }

                .log-content {
                    margin-top: 3px;
                }

                .log-controls {
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .log-controls select {
                    background: #333;
                    color: white;
                    border: 1px solid #555;
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-size: 11px;
                }

                .context-display {
                    background: #1e1e1e;
                    padding: 15px;
                    border-radius: 4px;
                    border: 1px solid #444;
                }

                .context-item {
                    margin-bottom: 8px;
                    font-size: 11px;
                }

                .context-item strong {
                    color: #ffc107;
                    display: inline-block;
                    width: 150px;
                }

                .error-summary {
                    background: #1e1e1e;
                    padding: 10px;
                    border-radius: 4px;
                    border: 1px solid #444;
                    margin-bottom: 10px;
                }

                .error-stats {
                    display: flex;
                    gap: 20px;
                    font-size: 11px;
                }

                .error-stats span {
                    color: #dc3545;
                }

                /* Scrollbar styling */
                .debug-log-container::-webkit-scrollbar {
                    width: 6px;
                }

                .debug-log-container::-webkit-scrollbar-track {
                    background: #1a1a1a;
                }

                .debug-log-container::-webkit-scrollbar-thumb {
                    background: #555;
                    border-radius: 3px;
                }

                .debug-log-container::-webkit-scrollbar-thumb:hover {
                    background: #777;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Setup event listeners for panel controls
     */
    setupEventListeners() {
        // Toggle monitoring
        document.getElementById('toggleMonitoring').addEventListener('click', () => {
            this.toggleMonitoring();
        });

        // Clear debug data
        document.getElementById('clearDebugData').addEventListener('click', () => {
            this.clearAllData();
        });

        // Export debug data
        document.getElementById('exportDebugData').addEventListener('click', () => {
            this.exportDebugData();
        });

        // Close panel
        document.getElementById('closeDebugPanel').addEventListener('click', () => {
            this.hide();
        });

        // Routing log controls
        document.getElementById('pauseRoutingLog').addEventListener('click', (e) => {
            this.toggleRoutingLogPause(e.target);
        });

        document.getElementById('clearRoutingLog').addEventListener('click', () => {
            this.clearRoutingLog();
        });

        document.getElementById('routingLogFilter').addEventListener('change', (e) => {
            this.filterRoutingLog(e.target.value);
        });

        // Listen for streaming manager events
        this.setupStreamingEventListeners();
    }

    /**
     * Setup listeners for streaming manager events
     */
    setupStreamingEventListeners() {
        // Listen for routing decisions
        if (window.streamingManager && window.streamingManager.streamingAgentRouter) {
            const router = window.streamingManager.streamingAgentRouter;
            
            // Hook into routing decision method
            const originalRouteMethod = router.routeStreamingMessage;
            router.routeStreamingMessage = async (...args) => {
                const startTime = performance.now();
                try {
                    const result = await originalRouteMethod.apply(router, args);
                    const endTime = performance.now();
                    
                    this.logRoutingDecision({
                        timestamp: Date.now(),
                        input: args[0],
                        result: result,
                        latency: endTime - startTime,
                        success: result.success,
                        agent: result.selectedAgent?.name || 'None'
                    });
                    
                    return result;
                } catch (error) {
                    const endTime = performance.now();
                    
                    this.logRoutingError({
                        timestamp: Date.now(),
                        input: args[0],
                        error: error.message,
                        latency: endTime - startTime
                    });
                    
                    throw error;
                }
            };
        }

        // Listen for agent switches
        if (window.streamingManager) {
            const originalSwitchMethod = window.streamingManager.switchStreamingAgent;
            if (originalSwitchMethod) {
                window.streamingManager.switchStreamingAgent = async (...args) => {
                    const startTime = performance.now();
                    try {
                        const result = await originalSwitchMethod.apply(window.streamingManager, args);
                        const endTime = performance.now();
                        
                        this.logAgentSwitch({
                            timestamp: Date.now(),
                            fromAgent: args[1] || 'Unknown',
                            toAgent: args[0] || 'Unknown',
                            latency: endTime - startTime,
                            success: true
                        });
                        
                        return result;
                    } catch (error) {
                        const endTime = performance.now();
                        
                        this.logAgentSwitchError({
                            timestamp: Date.now(),
                            fromAgent: args[1] || 'Unknown',
                            toAgent: args[0] || 'Unknown',
                            error: error.message,
                            latency: endTime - startTime
                        });
                        
                        throw error;
                    }
                };
            }
        }
    }  
  /**
     * Show the debug panel
     */
    show() {
        const panel = document.getElementById('streamingDebugPanel');
        if (panel) {
            panel.style.display = 'block';
            this.isVisible = true;
            this.updateContextInfo();
            this.debug.info('Debug panel shown');
        }
    }

    /**
     * Hide the debug panel
     */
    hide() {
        const panel = document.getElementById('streamingDebugPanel');
        if (panel) {
            panel.style.display = 'none';
            this.isVisible = false;
            this.debug.info('Debug panel hidden');
        }
    }

    /**
     * Toggle monitoring on/off
     */
    toggleMonitoring() {
        this.isMonitoring = !this.isMonitoring;
        const button = document.getElementById('toggleMonitoring');
        
        if (this.isMonitoring) {
            button.innerHTML = '<i class="fas fa-stop"></i> Stop Monitoring';
            button.style.background = '#dc3545';
            this.startMonitoring();
        } else {
            button.innerHTML = '<i class="fas fa-play"></i> Start Monitoring';
            button.style.background = '#007bff';
            this.stopMonitoring();
        }
        
        this.debug.info('Monitoring toggled:', this.isMonitoring);
    }

    /**
     * Start monitoring streaming agent routing
     */
    startMonitoring() {
        // Start metrics update interval
        this.metricsUpdateInterval = setInterval(() => {
            this.updateMetricsDisplay();
        }, 1000);

        // Start chart update interval
        this.chartUpdateInterval = setInterval(() => {
            this.updateCharts();
        }, 2000);

        // Initialize charts if not already done
        this.initializeCharts();
        
        this.debug.info('Monitoring started');
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.metricsUpdateInterval) {
            clearInterval(this.metricsUpdateInterval);
            this.metricsUpdateInterval = null;
        }

        if (this.chartUpdateInterval) {
            clearInterval(this.chartUpdateInterval);
            this.chartUpdateInterval = null;
        }
        
        this.debug.info('Monitoring stopped');
    }

    /**
     * Initialize performance charts
     */
    initializeCharts() {
        try {
            // Check if Chart.js is available
            if (typeof Chart === 'undefined') {
                this.loadChartJS(() => {
                    this.createCharts();
                });
            } else {
                this.createCharts();
            }
        } catch (error) {
            this.debug.error('Failed to initialize charts:', error);
        }
    }

    /**
     * Load Chart.js library
     */
    loadChartJS(callback) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = callback;
        document.head.appendChild(script);
    }

    /**
     * Create the performance charts
     */
    createCharts() {
        try {
            // Latency Chart
            const latencyCtx = document.getElementById('latencyChart').getContext('2d');
            this.latencyChart = new Chart(latencyCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Routing Latency (ms)',
                        data: [],
                        borderColor: '#00ff88',
                        backgroundColor: 'rgba(0, 255, 136, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: '#444' },
                            ticks: { color: '#ccc' }
                        },
                        x: {
                            grid: { color: '#444' },
                            ticks: { color: '#ccc' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#ccc' } }
                    }
                }
            });

            // Success Rate Chart
            const successCtx = document.getElementById('successRateChart').getContext('2d');
            this.successRateChart = new Chart(successCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Success Rate (%)',
                        data: [],
                        borderColor: '#ffc107',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            grid: { color: '#444' },
                            ticks: { color: '#ccc' }
                        },
                        x: {
                            grid: { color: '#444' },
                            ticks: { color: '#ccc' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#ccc' } }
                    }
                }
            });

            // Agent Usage Chart
            const agentCtx = document.getElementById('agentUsageChart').getContext('2d');
            this.agentUsageChart = new Chart(agentCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#007bff', '#28a745', '#ffc107', '#dc3545', 
                            '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { 
                            labels: { color: '#ccc' },
                            position: 'bottom'
                        }
                    }
                }
            });

            this.debug.info('Charts initialized successfully');
        } catch (error) {
            this.debug.error('Failed to create charts:', error);
        }
    }

    /**
     * Update metrics display
     */
    updateMetricsDisplay() {
        try {
            // Calculate current metrics
            const successRate = this.routingMetrics.totalDecisions > 0 
                ? (this.routingMetrics.successfulRoutes / this.routingMetrics.totalDecisions * 100).toFixed(1)
                : 0;

            // Update metric cards
            document.getElementById('totalDecisions').textContent = this.routingMetrics.totalDecisions;
            document.getElementById('successRate').textContent = successRate + '%';
            document.getElementById('avgLatency').textContent = this.routingMetrics.averageLatency.toFixed(0) + 'ms';
            document.getElementById('agentSwitches').textContent = this.routingMetrics.agentSwitches;
            document.getElementById('errorCount').textContent = this.routingMetrics.errorCount;
            
            // Update current agent
            const currentAgent = this.getCurrentAgent();
            document.getElementById('currentAgent').textContent = currentAgent || 'None';

            // Update context info
            this.updateContextInfo();
        } catch (error) {
            this.debug.error('Failed to update metrics display:', error);
        }
    }

    /**
     * Update performance charts
     */
    updateCharts() {
        try {
            if (!this.latencyChart || !this.successRateChart || !this.agentUsageChart) {
                return;
            }

            const now = new Date().toLocaleTimeString();

            // Update latency chart
            const recentLatencies = this.performanceMetrics.slice(-20);
            this.latencyChart.data.labels = recentLatencies.map(() => '');
            this.latencyChart.data.datasets[0].data = recentLatencies.map(m => m.latency);
            this.latencyChart.update('none');

            // Update success rate chart
            const recentDecisions = this.routingDecisions.slice(-20);
            const successRates = this.calculateSuccessRateOverTime(recentDecisions);
            this.successRateChart.data.labels = successRates.map(() => '');
            this.successRateChart.data.datasets[0].data = successRates;
            this.successRateChart.update('none');

            // Update agent usage chart
            const agentUsage = this.calculateAgentUsage();
            this.agentUsageChart.data.labels = Object.keys(agentUsage);
            this.agentUsageChart.data.datasets[0].data = Object.values(agentUsage);
            this.agentUsageChart.update('none');

        } catch (error) {
            this.debug.error('Failed to update charts:', error);
        }
    }

    /**
     * Log a routing decision
     */
    logRoutingDecision(decision) {
        if (!this.isMonitoring) return;

        // Store decision
        this.routingDecisions.push(decision);
        
        // Update metrics
        this.routingMetrics.totalDecisions++;
        if (decision.success) {
            this.routingMetrics.successfulRoutes++;
        }
        
        // Update average latency
        this.updateAverageLatency(decision.latency);
        
        // Store performance metric
        this.performanceMetrics.push({
            timestamp: decision.timestamp,
            latency: decision.latency,
            type: 'routing'
        });

        // Add to UI
        this.addRoutingDecisionToUI(decision);
        
        // Keep only recent decisions (last 1000)
        if (this.routingDecisions.length > 1000) {
            this.routingDecisions.shift();
        }
        
        this.debug.debug('Routing decision logged:', decision);
    }

    /**
     * Log a routing error
     */
    logRoutingError(error) {
        if (!this.isMonitoring) return;

        // Store error
        this.errorLogs.push({
            ...error,
            type: 'routing'
        });
        
        // Update metrics
        this.routingMetrics.errorCount++;
        this.routingMetrics.totalDecisions++;
        
        // Update average latency
        this.updateAverageLatency(error.latency);

        // Add to UI
        this.addErrorToUI(error);
        
        // Keep only recent errors (last 500)
        if (this.errorLogs.length > 500) {
            this.errorLogs.shift();
        }
        
        this.debug.error('Routing error logged:', error);
    }

    /**
     * Log an agent switch
     */
    logAgentSwitch(switchData) {
        if (!this.isMonitoring) return;

        // Store switch
        this.agentSwitchHistory.push(switchData);
        
        // Update metrics
        this.routingMetrics.agentSwitches++;

        // Add to UI
        this.addAgentSwitchToUI(switchData);
        
        // Keep only recent switches (last 200)
        if (this.agentSwitchHistory.length > 200) {
            this.agentSwitchHistory.shift();
        }
        
        this.debug.info('Agent switch logged:', switchData);
    }

    /**
     * Log an agent switch error
     */
    logAgentSwitchError(error) {
        if (!this.isMonitoring) return;

        // Store error
        this.errorLogs.push({
            ...error,
            type: 'agent_switch'
        });
        
        // Update metrics
        this.routingMetrics.errorCount++;

        // Add to UI
        this.addErrorToUI(error);
        
        this.debug.error('Agent switch error logged:', error);
    }

    /**
     * Add routing decision to UI
     */
    addRoutingDecisionToUI(decision) {
        const container = document.getElementById('routingDecisionsList');
        if (!container) return;

        const entry = document.createElement('div');
        entry.className = `log-entry ${decision.success ? 'success' : 'error'}`;
        
        const timestamp = new Date(decision.timestamp).toLocaleTimeString();
        const inputPreview = decision.input ? decision.input.substring(0, 50) + '...' : 'No input';
        
        entry.innerHTML = `
            <div class="log-timestamp">${timestamp}</div>
            <div class="log-content">
                <strong>Input:</strong> ${inputPreview}<br>
                <strong>Agent:</strong> ${decision.agent}<br>
                <strong>Latency:</strong> ${decision.latency.toFixed(1)}ms<br>
                <strong>Status:</strong> ${decision.success ? 'Success' : 'Failed'}
            </div>
        `;

        container.insertBefore(entry, container.firstChild);
        
        // Keep only recent entries in UI (last 50)
        while (container.children.length > 50) {
            container.removeChild(container.lastChild);
        }
    }

    /**
     * Add agent switch to UI
     */
    addAgentSwitchToUI(switchData) {
        const container = document.getElementById('agentSwitchHistory');
        if (!container) return;

        const entry = document.createElement('div');
        entry.className = `log-entry ${switchData.success ? 'success' : 'error'}`;
        
        const timestamp = new Date(switchData.timestamp).toLocaleTimeString();
        
        entry.innerHTML = `
            <div class="log-timestamp">${timestamp}</div>
            <div class="log-content">
                <strong>Switch:</strong> ${switchData.fromAgent} → ${switchData.toAgent}<br>
                <strong>Latency:</strong> ${switchData.latency.toFixed(1)}ms<br>
                <strong>Status:</strong> ${switchData.success ? 'Success' : 'Failed'}
            </div>
        `;

        container.insertBefore(entry, container.firstChild);
        
        // Keep only recent entries in UI (last 30)
        while (container.children.length > 30) {
            container.removeChild(container.lastChild);
        }
    }

    /**
     * Add error to UI
     */
    addErrorToUI(error) {
        const container = document.getElementById('errorLogsList');
        if (!container) return;

        const entry = document.createElement('div');
        entry.className = 'log-entry error';
        
        const timestamp = new Date(error.timestamp).toLocaleTimeString();
        
        entry.innerHTML = `
            <div class="log-timestamp">${timestamp}</div>
            <div class="log-content">
                <strong>Type:</strong> ${error.type}<br>
                <strong>Error:</strong> ${error.error}<br>
                ${error.input ? `<strong>Input:</strong> ${error.input.substring(0, 50)}...<br>` : ''}
                <strong>Latency:</strong> ${error.latency ? error.latency.toFixed(1) + 'ms' : 'N/A'}
            </div>
        `;

        container.insertBefore(entry, container.firstChild);
        
        // Keep only recent entries in UI (last 30)
        while (container.children.length > 30) {
            container.removeChild(container.lastChild);
        }

        // Update error counts
        this.updateErrorCounts();
    }

    /**
     * Update context information
     */
    updateContextInfo() {
        try {
            // Session ID
            const sessionId = window.streamingManager?.connectionId || 'Not connected';
            document.getElementById('sessionId').textContent = sessionId;

            // Connection status
            const connectionStatus = window.streamingManager?.isConnected ? 'Connected' : 'Disconnected';
            document.getElementById('connectionStatus').textContent = connectionStatus;

            // Agent routing status
            const routingEnabled = window.streamingManager?.agentRoutingEnabled ? 'Enabled' : 'Disabled';
            document.getElementById('agentRoutingStatus').textContent = routingEnabled;

            // Voice configuration
            const voiceConfig = window.streamingManager?.voiceConfiguration?.currentVoice || 'Unknown';
            document.getElementById('voiceConfig').textContent = voiceConfig;

            // Last decision time
            const lastDecision = this.routingDecisions[this.routingDecisions.length - 1];
            const lastDecisionTime = lastDecision 
                ? new Date(lastDecision.timestamp).toLocaleTimeString()
                : 'None';
            document.getElementById('lastDecisionTime').textContent = lastDecisionTime;

        } catch (error) {
            this.debug.error('Failed to update context info:', error);
        }
    }

    /**
     * Helper methods
     */
    updateAverageLatency(newLatency) {
        const totalLatency = this.routingMetrics.averageLatency * (this.routingMetrics.totalDecisions - 1) + newLatency;
        this.routingMetrics.averageLatency = totalLatency / this.routingMetrics.totalDecisions;
    }

    getCurrentAgent() {
        return window.streamingManager?.currentStreamingAgent?.name || null;
    }

    calculateSuccessRateOverTime(decisions) {
        const rates = [];
        let successCount = 0;
        
        decisions.forEach((decision, index) => {
            if (decision.success) successCount++;
            const rate = ((successCount / (index + 1)) * 100);
            rates.push(rate);
        });
        
        return rates;
    }

    calculateAgentUsage() {
        const usage = {};
        
        this.routingDecisions.forEach(decision => {
            if (decision.agent && decision.success) {
                usage[decision.agent] = (usage[decision.agent] || 0) + 1;
            }
        });
        
        return usage;
    }

    updateErrorCounts() {
        const routingErrors = this.errorLogs.filter(e => e.type === 'routing').length;
        const timeoutErrors = this.errorLogs.filter(e => e.error && e.error.includes('timeout')).length;
        const agentErrors = this.errorLogs.filter(e => e.type === 'agent_switch').length;

        document.getElementById('routingErrorCount').textContent = routingErrors;
        document.getElementById('timeoutErrorCount').textContent = timeoutErrors;
        document.getElementById('agentErrorCount').textContent = agentErrors;
    }

    /**
     * Panel control methods
     */
    clearAllData() {
        this.routingDecisions = [];
        this.performanceMetrics = [];
        this.errorLogs = [];
        this.agentSwitchHistory = [];
        
        // Reset metrics
        this.routingMetrics = {
            totalDecisions: 0,
            successfulRoutes: 0,
            agentSwitches: 0,
            fallbackCount: 0,
            averageLatency: 0,
            errorCount: 0
        };

        // Clear UI
        document.getElementById('routingDecisionsList').innerHTML = '';
        document.getElementById('agentSwitchHistory').innerHTML = '';
        document.getElementById('errorLogsList').innerHTML = '';

        // Reset charts
        if (this.latencyChart) {
            this.latencyChart.data.labels = [];
            this.latencyChart.data.datasets[0].data = [];
            this.latencyChart.update();
        }

        if (this.successRateChart) {
            this.successRateChart.data.labels = [];
            this.successRateChart.data.datasets[0].data = [];
            this.successRateChart.update();
        }

        if (this.agentUsageChart) {
            this.agentUsageChart.data.labels = [];
            this.agentUsageChart.data.datasets[0].data = [];
            this.agentUsageChart.update();
        }

        this.debug.info('All debug data cleared');
    }

    clearRoutingLog() {
        document.getElementById('routingDecisionsList').innerHTML = '';
        this.debug.info('Routing log cleared');
    }

    toggleRoutingLogPause(button) {
        // Implementation for pausing routing log updates
        const isPaused = button.dataset.paused === 'true';
        
        if (isPaused) {
            button.innerHTML = '<i class="fas fa-pause"></i> Pause';
            button.dataset.paused = 'false';
        } else {
            button.innerHTML = '<i class="fas fa-play"></i> Resume';
            button.dataset.paused = 'true';
        }
    }

    filterRoutingLog(filter) {
        const container = document.getElementById('routingDecisionsList');
        const entries = container.querySelectorAll('.log-entry');

        entries.forEach(entry => {
            const content = entry.textContent.toLowerCase();
            let show = true;

            switch (filter) {
                case 'successful':
                    show = entry.classList.contains('success');
                    break;
                case 'failed':
                    show = entry.classList.contains('error');
                    break;
                case 'fallback':
                    show = content.includes('fallback');
                    break;
                case 'all':
                default:
                    show = true;
                    break;
            }

            entry.style.display = show ? 'block' : 'none';
        });
    }

    exportDebugData() {
        const data = {
            timestamp: new Date().toISOString(),
            metrics: this.routingMetrics,
            routingDecisions: this.routingDecisions,
            performanceMetrics: this.performanceMetrics,
            errorLogs: this.errorLogs,
            agentSwitchHistory: this.agentSwitchHistory
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `streaming-debug-data-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        this.debug.info('Debug data exported');
    }

    /**
     * Cleanup method
     */
    destroy() {
        this.stopMonitoring();
        
        // Remove event listeners and DOM elements
        const panel = document.getElementById('streamingDebugPanel');
        if (panel) {
            panel.remove();
        }
        
        const styles = document.getElementById('streamingDebugPanelStyles');
        if (styles) {
            styles.remove();
        }
        
        this.debug.info('StreamingDebugPanel destroyed');
    }
}

// Initialize global debug panel instance
window.streamingDebugPanel = new StreamingDebugPanel();
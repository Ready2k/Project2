/**
 * Streaming Performance Monitoring Dashboard
 * Creates performance monitoring dashboard for streaming routing
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
class StreamingPerformanceDashboard {
    constructor() {
        this.isVisible = false;
        this.updateInterval = null;
        this.chartUpdateInterval = null;
        
        // Performance data storage
        this.performanceHistory = [];
        this.alertHistory = [];
        this.thresholds = {
            latency: {
                warning: 100,
                critical: 200
            },
            successRate: {
                warning: 95,
                critical: 90
            },
            errorRate: {
                warning: 5,
                critical: 10
            }
        };
        
        // Chart instances
        this.charts = {
            latency: null,
            successRate: null,
            throughput: null,
            errorRate: null,
            agentDistribution: null,
            systemHealth: null
        };
        
        // Real-time metrics
        this.currentMetrics = {
            latency: 0,
            successRate: 100,
            throughput: 0,
            errorRate: 0,
            activeConnections: 0,
            systemHealth: 'EXCELLENT'
        };
        
        // Initialize debug logger
        this.debug = window.debugManager ? 
            window.debugManager.createModuleLogger('StreamingPerformanceDashboard') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
            
        this.initializeDashboard();
        
        this.debug.info('StreamingPerformanceDashboard initialized');
    }

    /**
     * Initialize the performance dashboard
     */
    initializeDashboard() {
        this.createDashboardHTML();
        this.addDashboardStyles();
        this.setupEventListeners();
        this.initializeAlertSystem();
    }

    /**
     * Create dashboard HTML structure
     */
    createDashboardHTML() {
        const dashboardHTML = `
            <div id="streamingPerformanceDashboard" class="performance-dashboard" style="display: none;">
                <div class="dashboard-header">
                    <h3><i class="fas fa-tachometer-alt"></i> Streaming Performance Dashboard</h3>
                    <div class="dashboard-controls">
                        <button id="refreshDashboard" class="dashboard-btn">
                            <i class="fas fa-sync"></i> Refresh
                        </button>
                        <button id="exportPerformanceData" class="dashboard-btn">
                            <i class="fas fa-download"></i> Export
                        </button>
                        <button id="dashboardSettings" class="dashboard-btn">
                            <i class="fas fa-cog"></i> Settings
                        </button>
                        <button id="closeDashboard" class="dashboard-btn close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <div class="dashboard-content">
                    <!-- System Health Overview -->
                    <div class="dashboard-section">
                        <h4><i class="fas fa-heartbeat"></i> System Health Overview</h4>
                        <div class="health-indicators">
                            <div class="health-indicator" id="overallHealth">
                                <div class="health-status excellent">EXCELLENT</div>
                                <div class="health-label">Overall Health</div>
                            </div>
                            <div class="health-indicator" id="latencyHealth">
                                <div class="health-value">0ms</div>
                                <div class="health-label">Avg Latency</div>
                            </div>
                            <div class="health-indicator" id="successRateHealth">
                                <div class="health-value">100%</div>
                                <div class="health-label">Success Rate</div>
                            </div>
                            <div class="health-indicator" id="throughputHealth">
                                <div class="health-value">0/min</div>
                                <div class="health-label">Throughput</div>
                            </div>
                            <div class="health-indicator" id="errorRateHealth">
                                <div class="health-value">0%</div>
                                <div class="health-label">Error Rate</div>
                            </div>
                            <div class="health-indicator" id="connectionsHealth">
                                <div class="health-value">0</div>
                                <div class="health-label">Active Connections</div>
                            </div>
                        </div>
                    </div>

                    <!-- Performance Charts -->
                    <div class="dashboard-section">
                        <h4><i class="fas fa-chart-area"></i> Performance Metrics</h4>
                        <div class="charts-grid">
                            <div class="chart-container">
                                <h5>Routing Latency Trend</h5>
                                <canvas id="latencyTrendChart" width="400" height="250"></canvas>
                            </div>
                            <div class="chart-container">
                                <h5>Success Rate Trend</h5>
                                <canvas id="successRateTrendChart" width="400" height="250"></canvas>
                            </div>
                            <div class="chart-container">
                                <h5>Throughput (Requests/min)</h5>
                                <canvas id="throughputChart" width="400" height="250"></canvas>
                            </div>
                            <div class="chart-container">
                                <h5>Error Rate Trend</h5>
                                <canvas id="errorRateChart" width="400" height="250"></canvas>
                            </div>
                            <div class="chart-container">
                                <h5>Agent Usage Distribution</h5>
                                <canvas id="agentDistributionChart" width="400" height="250"></canvas>
                            </div>
                            <div class="chart-container">
                                <h5>System Health Score</h5>
                                <canvas id="systemHealthChart" width="400" height="250"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Performance Alerts -->
                    <div class="dashboard-section">
                        <h4><i class="fas fa-exclamation-triangle"></i> Performance Alerts</h4>
                        <div class="alert-controls">
                            <button id="clearAlerts" class="dashboard-btn-small">
                                <i class="fas fa-trash"></i> Clear Alerts
                            </button>
                            <select id="alertFilter">
                                <option value="all">All Alerts</option>
                                <option value="critical">Critical Only</option>
                                <option value="warning">Warning Only</option>
                                <option value="info">Info Only</option>
                            </select>
                        </div>
                        <div id="alertsList" class="alerts-container">
                            <!-- Alerts will be populated here -->
                        </div>
                    </div>

                    <!-- Detailed Metrics -->
                    <div class="dashboard-section">
                        <h4><i class="fas fa-list-alt"></i> Detailed Metrics</h4>
                        <div class="metrics-table-container">
                            <table class="metrics-table">
                                <thead>
                                    <tr>
                                        <th>Metric</th>
                                        <th>Current</th>
                                        <th>Average (1h)</th>
                                        <th>Min/Max (1h)</th>
                                        <th>Threshold</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody id="metricsTableBody">
                                    <!-- Metrics rows will be populated here -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Agent Performance Breakdown -->
                    <div class="dashboard-section">
                        <h4><i class="fas fa-users"></i> Agent Performance Breakdown</h4>
                        <div id="agentPerformanceList" class="agent-performance-container">
                            <!-- Agent performance data will be populated here -->
                        </div>
                    </div>

                    <!-- Configuration Panel -->
                    <div id="dashboardSettingsPanel" class="settings-panel" style="display: none;">
                        <h4><i class="fas fa-cog"></i> Dashboard Settings</h4>
                        <div class="settings-grid">
                            <div class="setting-group">
                                <label>Update Interval (seconds)</label>
                                <input type="number" id="updateInterval" value="5" min="1" max="60">
                            </div>
                            <div class="setting-group">
                                <label>Chart Update Interval (seconds)</label>
                                <input type="number" id="chartUpdateInterval" value="10" min="5" max="120">
                            </div>
                            <div class="setting-group">
                                <label>Latency Warning Threshold (ms)</label>
                                <input type="number" id="latencyWarning" value="100" min="50" max="500">
                            </div>
                            <div class="setting-group">
                                <label>Latency Critical Threshold (ms)</label>
                                <input type="number" id="latencyCritical" value="200" min="100" max="1000">
                            </div>
                            <div class="setting-group">
                                <label>Success Rate Warning (%)</label>
                                <input type="number" id="successRateWarning" value="95" min="80" max="99">
                            </div>
                            <div class="setting-group">
                                <label>Success Rate Critical (%)</label>
                                <input type="number" id="successRateCritical" value="90" min="70" max="95">
                            </div>
                        </div>
                        <div class="settings-actions">
                            <button id="saveSettings" class="dashboard-btn">Save Settings</button>
                            <button id="resetSettings" class="dashboard-btn">Reset to Defaults</button>
                            <button id="closeSettings" class="dashboard-btn">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dashboardHTML);
    }

    /**
     * Add dashboard CSS styles
     */
    addDashboardStyles() {
        const styles = `
            <style id="streamingPerformanceDashboardStyles">
                .performance-dashboard {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100vh;
                    background: #0f1419;
                    color: #ffffff;
                    z-index: 9999;
                    overflow-y: auto;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    font-size: 13px;
                }

                .dashboard-header {
                    background: linear-gradient(135deg, #1e3a8a, #3b82f6);
                    padding: 20px 30px;
                    border-bottom: 2px solid #1e40af;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                }

                .dashboard-header h3 {
                    margin: 0;
                    color: #ffffff;
                    font-size: 20px;
                    font-weight: 600;
                }

                .dashboard-controls {
                    display: flex;
                    gap: 12px;
                }

                .dashboard-btn {
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.2);
                    padding: 10px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                    backdrop-filter: blur(10px);
                }

                .dashboard-btn:hover {
                    background: rgba(255,255,255,0.2);
                    border-color: rgba(255,255,255,0.3);
                }

                .dashboard-btn.close-btn {
                    background: rgba(239, 68, 68, 0.8);
                    border-color: rgba(239, 68, 68, 0.9);
                }

                .dashboard-btn.close-btn:hover {
                    background: rgba(239, 68, 68, 1);
                }

                .dashboard-btn-small {
                    background: #374151;
                    color: white;
                    border: 1px solid #4b5563;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                    margin-right: 8px;
                }

                .dashboard-content {
                    padding: 30px;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .dashboard-section {
                    margin-bottom: 40px;
                    background: #1f2937;
                    border-radius: 12px;
                    padding: 25px;
                    border: 1px solid #374151;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }

                .dashboard-section h4 {
                    margin: 0 0 20px 0;
                    color: #60a5fa;
                    font-size: 16px;
                    font-weight: 600;
                    border-bottom: 2px solid #374151;
                    padding-bottom: 10px;
                }

                .health-indicators {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 20px;
                }

                .health-indicator {
                    background: #111827;
                    padding: 20px;
                    border-radius: 8px;
                    text-align: center;
                    border: 1px solid #374151;
                    transition: transform 0.2s;
                }

                .health-indicator:hover {
                    transform: translateY(-2px);
                }

                .health-status {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 8px;
                    padding: 8px 12px;
                    border-radius: 6px;
                    text-transform: uppercase;
                }

                .health-status.excellent {
                    background: #065f46;
                    color: #10b981;
                }

                .health-status.good {
                    background: #1f2937;
                    color: #60a5fa;
                }

                .health-status.warning {
                    background: #451a03;
                    color: #f59e0b;
                }

                .health-status.critical {
                    background: #450a0a;
                    color: #ef4444;
                }

                .health-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #60a5fa;
                    margin-bottom: 8px;
                }

                .health-label {
                    font-size: 12px;
                    color: #9ca3af;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .charts-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
                    gap: 25px;
                }

                .chart-container {
                    background: #111827;
                    padding: 20px;
                    border-radius: 8px;
                    border: 1px solid #374151;
                }

                .chart-container h5 {
                    margin: 0 0 15px 0;
                    color: #f3f4f6;
                    font-size: 14px;
                    font-weight: 500;
                }

                .alerts-container {
                    max-height: 400px;
                    overflow-y: auto;
                    background: #111827;
                    border: 1px solid #374151;
                    border-radius: 8px;
                    padding: 15px;
                }

                .alert-item {
                    padding: 12px;
                    margin-bottom: 8px;
                    border-radius: 6px;
                    border-left: 4px solid;
                    font-size: 12px;
                }

                .alert-item.critical {
                    background: rgba(239, 68, 68, 0.1);
                    border-left-color: #ef4444;
                }

                .alert-item.warning {
                    background: rgba(245, 158, 11, 0.1);
                    border-left-color: #f59e0b;
                }

                .alert-item.info {
                    background: rgba(96, 165, 250, 0.1);
                    border-left-color: #60a5fa;
                }

                .alert-timestamp {
                    color: #6b7280;
                    font-size: 10px;
                    margin-bottom: 4px;
                }

                .alert-message {
                    color: #f3f4f6;
                }

                .metrics-table-container {
                    overflow-x: auto;
                    background: #111827;
                    border-radius: 8px;
                    border: 1px solid #374151;
                }

                .metrics-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }

                .metrics-table th,
                .metrics-table td {
                    padding: 12px 15px;
                    text-align: left;
                    border-bottom: 1px solid #374151;
                }

                .metrics-table th {
                    background: #1f2937;
                    color: #60a5fa;
                    font-weight: 600;
                    text-transform: uppercase;
                    font-size: 11px;
                    letter-spacing: 0.5px;
                }

                .metrics-table td {
                    color: #f3f4f6;
                }

                .status-indicator {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: bold;
                    text-transform: uppercase;
                }

                .status-indicator.good {
                    background: #065f46;
                    color: #10b981;
                }

                .status-indicator.warning {
                    background: #451a03;
                    color: #f59e0b;
                }

                .status-indicator.critical {
                    background: #450a0a;
                    color: #ef4444;
                }

                .agent-performance-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                }

                .agent-card {
                    background: #111827;
                    padding: 20px;
                    border-radius: 8px;
                    border: 1px solid #374151;
                }

                .agent-card h5 {
                    margin: 0 0 15px 0;
                    color: #60a5fa;
                    font-size: 14px;
                }

                .agent-metric {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 12px;
                }

                .agent-metric-label {
                    color: #9ca3af;
                }

                .agent-metric-value {
                    color: #f3f4f6;
                    font-weight: 500;
                }

                .settings-panel {
                    position: absolute;
                    top: 80px;
                    right: 30px;
                    width: 400px;
                    background: #1f2937;
                    border: 1px solid #374151;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                    z-index: 10;
                }

                .settings-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .setting-group label {
                    display: block;
                    color: #9ca3af;
                    font-size: 12px;
                    margin-bottom: 5px;
                }

                .setting-group input {
                    width: 100%;
                    background: #111827;
                    border: 1px solid #374151;
                    color: #f3f4f6;
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                }

                .settings-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }

                .alert-controls {
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .alert-controls select {
                    background: #111827;
                    color: #f3f4f6;
                    border: 1px solid #374151;
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 11px;
                }

                /* Scrollbar styling */
                .alerts-container::-webkit-scrollbar,
                .dashboard-content::-webkit-scrollbar {
                    width: 8px;
                }

                .alerts-container::-webkit-scrollbar-track,
                .dashboard-content::-webkit-scrollbar-track {
                    background: #111827;
                }

                .alerts-container::-webkit-scrollbar-thumb,
                .dashboard-content::-webkit-scrollbar-thumb {
                    background: #374151;
                    border-radius: 4px;
                }

                .alerts-container::-webkit-scrollbar-thumb:hover,
                .dashboard-content::-webkit-scrollbar-thumb:hover {
                    background: #4b5563;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Dashboard controls
        document.getElementById('refreshDashboard').addEventListener('click', () => {
            this.refreshDashboard();
        });

        document.getElementById('exportPerformanceData').addEventListener('click', () => {
            this.exportPerformanceData();
        });

        document.getElementById('dashboardSettings').addEventListener('click', () => {
            this.toggleSettingsPanel();
        });

        document.getElementById('closeDashboard').addEventListener('click', () => {
            this.hide();
        });

        // Alert controls
        document.getElementById('clearAlerts').addEventListener('click', () => {
            this.clearAlerts();
        });

        document.getElementById('alertFilter').addEventListener('change', (e) => {
            this.filterAlerts(e.target.value);
        });

        // Settings panel
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('resetSettings').addEventListener('click', () => {
            this.resetSettings();
        });

        document.getElementById('closeSettings').addEventListener('click', () => {
            this.toggleSettingsPanel();
        });
    }

    /**
     * Initialize alert system
     */
    initializeAlertSystem() {
        // Set up performance monitoring
        setInterval(() => {
            this.checkPerformanceThresholds();
        }, 5000); // Check every 5 seconds
    }    /**

     * Show the dashboard
     */
    show() {
        const dashboard = document.getElementById('streamingPerformanceDashboard');
        if (dashboard) {
            dashboard.style.display = 'block';
            this.isVisible = true;
            this.startMonitoring();
            this.initializeCharts();
            this.refreshDashboard();
            this.debug.info('Performance dashboard shown');
        }
    }

    /**
     * Hide the dashboard
     */
    hide() {
        const dashboard = document.getElementById('streamingPerformanceDashboard');
        if (dashboard) {
            dashboard.style.display = 'none';
            this.isVisible = false;
            this.stopMonitoring();
            this.debug.info('Performance dashboard hidden');
        }
    }

    /**
     * Start monitoring
     */
    startMonitoring() {
        // Start regular updates
        this.updateInterval = setInterval(() => {
            this.updateMetrics();
        }, 5000); // Update every 5 seconds

        // Start chart updates
        this.chartUpdateInterval = setInterval(() => {
            this.updateCharts();
        }, 10000); // Update charts every 10 seconds

        this.debug.info('Performance monitoring started');
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        if (this.chartUpdateInterval) {
            clearInterval(this.chartUpdateInterval);
            this.chartUpdateInterval = null;
        }

        this.debug.info('Performance monitoring stopped');
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
     * Create performance charts
     */
    createCharts() {
        try {
            const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#374151' },
                        ticks: { color: '#9ca3af' }
                    },
                    x: {
                        grid: { color: '#374151' },
                        ticks: { color: '#9ca3af' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#f3f4f6' } }
                }
            };

            // Latency Trend Chart
            const latencyCtx = document.getElementById('latencyTrendChart').getContext('2d');
            this.charts.latency = new Chart(latencyCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Average Latency (ms)',
                        data: [],
                        borderColor: '#60a5fa',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Warning Threshold',
                        data: [],
                        borderColor: '#f59e0b',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false
                    }]
                },
                options: chartOptions
            });

            // Success Rate Chart
            const successCtx = document.getElementById('successRateTrendChart').getContext('2d');
            this.charts.successRate = new Chart(successCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Success Rate (%)',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    ...chartOptions,
                    scales: {
                        ...chartOptions.scales,
                        y: { ...chartOptions.scales.y, max: 100 }
                    }
                }
            });

            // Throughput Chart
            const throughputCtx = document.getElementById('throughputChart').getContext('2d');
            this.charts.throughput = new Chart(throughputCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Requests/min',
                        data: [],
                        backgroundColor: '#8b5cf6',
                        borderColor: '#a78bfa',
                        borderWidth: 1
                    }]
                },
                options: chartOptions
            });

            // Error Rate Chart
            const errorCtx = document.getElementById('errorRateChart').getContext('2d');
            this.charts.errorRate = new Chart(errorCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Error Rate (%)',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    ...chartOptions,
                    scales: {
                        ...chartOptions.scales,
                        y: { ...chartOptions.scales.y, max: 20 }
                    }
                }
            });

            // Agent Distribution Chart
            const agentCtx = document.getElementById('agentDistributionChart').getContext('2d');
            this.charts.agentDistribution = new Chart(agentCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#60a5fa', '#10b981', '#f59e0b', '#ef4444',
                            '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#f3f4f6' },
                            position: 'bottom'
                        }
                    }
                }
            });

            // System Health Chart
            const healthCtx = document.getElementById('systemHealthChart').getContext('2d');
            this.charts.systemHealth = new Chart(healthCtx, {
                type: 'radar',
                data: {
                    labels: ['Latency', 'Success Rate', 'Throughput', 'Error Rate', 'Availability'],
                    datasets: [{
                        label: 'System Health',
                        data: [100, 100, 100, 100, 100],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        pointBackgroundColor: '#10b981'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100,
                            grid: { color: '#374151' },
                            pointLabels: { color: '#f3f4f6' },
                            ticks: { color: '#9ca3af' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#f3f4f6' } }
                    }
                }
            });

            this.debug.info('Performance charts initialized');
        } catch (error) {
            this.debug.error('Failed to create charts:', error);
        }
    }

    /**
     * Update metrics from monitoring data
     */
    updateMetrics() {
        try {
            // Get data from streaming routing monitor
            const monitor = window.streamingRoutingMonitor;
            if (!monitor) return;

            const analytics = monitor.getRoutingAnalytics();
            const contextAnalytics = monitor.getContextAnalytics();
            const performanceMetrics = monitor.getPerformanceMetrics();

            // Update current metrics
            this.currentMetrics = {
                latency: analytics.summary.averageLatency || 0,
                successRate: analytics.summary.totalDecisions > 0 
                    ? (analytics.summary.successfulDecisions / analytics.summary.totalDecisions * 100) 
                    : 100,
                throughput: this.calculateThroughput(analytics.summary.totalDecisions),
                errorRate: analytics.errorAnalysis.errorRate || 0,
                activeConnections: this.getActiveConnections(),
                systemHealth: performanceMetrics.systemHealth.status
            };

            // Update health indicators
            this.updateHealthIndicators();

            // Update detailed metrics table
            this.updateMetricsTable();

            // Update agent performance breakdown
            this.updateAgentPerformance(analytics.agentUsage, performanceMetrics.agents);

            // Store performance history
            this.performanceHistory.push({
                timestamp: Date.now(),
                ...this.currentMetrics
            });

            // Keep only recent history (last 100 points)
            if (this.performanceHistory.length > 100) {
                this.performanceHistory.shift();
            }

        } catch (error) {
            this.debug.error('Failed to update metrics:', error);
        }
    }

    /**
     * Update health indicators
     */
    updateHealthIndicators() {
        // Overall health
        const healthElement = document.getElementById('overallHealth');
        const healthStatus = healthElement.querySelector('.health-status');
        healthStatus.textContent = this.currentMetrics.systemHealth;
        healthStatus.className = `health-status ${this.currentMetrics.systemHealth.toLowerCase()}`;

        // Individual metrics
        document.querySelector('#latencyHealth .health-value').textContent = 
            Math.round(this.currentMetrics.latency) + 'ms';
        
        document.querySelector('#successRateHealth .health-value').textContent = 
            this.currentMetrics.successRate.toFixed(1) + '%';
        
        document.querySelector('#throughputHealth .health-value').textContent = 
            Math.round(this.currentMetrics.throughput) + '/min';
        
        document.querySelector('#errorRateHealth .health-value').textContent = 
            this.currentMetrics.errorRate.toFixed(1) + '%';
        
        document.querySelector('#connectionsHealth .health-value').textContent = 
            this.currentMetrics.activeConnections;
    }

    /**
     * Update charts with latest data
     */
    updateCharts() {
        try {
            if (!this.charts.latency) return;

            const timeLabels = this.performanceHistory.slice(-20).map(p => 
                new Date(p.timestamp).toLocaleTimeString()
            );

            // Update latency chart
            this.charts.latency.data.labels = timeLabels;
            this.charts.latency.data.datasets[0].data = this.performanceHistory.slice(-20).map(p => p.latency);
            this.charts.latency.data.datasets[1].data = new Array(timeLabels.length).fill(this.thresholds.latency.warning);
            this.charts.latency.update('none');

            // Update success rate chart
            this.charts.successRate.data.labels = timeLabels;
            this.charts.successRate.data.datasets[0].data = this.performanceHistory.slice(-20).map(p => p.successRate);
            this.charts.successRate.update('none');

            // Update throughput chart
            this.charts.throughput.data.labels = timeLabels;
            this.charts.throughput.data.datasets[0].data = this.performanceHistory.slice(-20).map(p => p.throughput);
            this.charts.throughput.update('none');

            // Update error rate chart
            this.charts.errorRate.data.labels = timeLabels;
            this.charts.errorRate.data.datasets[0].data = this.performanceHistory.slice(-20).map(p => p.errorRate);
            this.charts.errorRate.update('none');

            // Update agent distribution
            this.updateAgentDistributionChart();

            // Update system health radar
            this.updateSystemHealthChart();

        } catch (error) {
            this.debug.error('Failed to update charts:', error);
        }
    }

    /**
     * Update agent distribution chart
     */
    updateAgentDistributionChart() {
        const monitor = window.streamingRoutingMonitor;
        if (!monitor) return;

        const analytics = monitor.getRoutingAnalytics();
        const agentUsage = analytics.agentUsage || {};

        this.charts.agentDistribution.data.labels = Object.keys(agentUsage);
        this.charts.agentDistribution.data.datasets[0].data = Object.values(agentUsage);
        this.charts.agentDistribution.update('none');
    }

    /**
     * Update system health radar chart
     */
    updateSystemHealthChart() {
        const healthScores = [
            this.calculateLatencyScore(this.currentMetrics.latency),
            this.currentMetrics.successRate,
            this.calculateThroughputScore(this.currentMetrics.throughput),
            100 - this.currentMetrics.errorRate,
            this.getAvailabilityScore()
        ];

        this.charts.systemHealth.data.datasets[0].data = healthScores;
        this.charts.systemHealth.update('none');
    }

    /**
     * Update metrics table
     */
    updateMetricsTable() {
        const tbody = document.getElementById('metricsTableBody');
        if (!tbody) return;

        const metrics = [
            {
                name: 'Routing Latency',
                current: Math.round(this.currentMetrics.latency) + 'ms',
                average: this.calculateAverageMetric('latency') + 'ms',
                minMax: this.calculateMinMaxMetric('latency'),
                threshold: this.thresholds.latency.warning + 'ms',
                status: this.getMetricStatus('latency', this.currentMetrics.latency)
            },
            {
                name: 'Success Rate',
                current: this.currentMetrics.successRate.toFixed(1) + '%',
                average: this.calculateAverageMetric('successRate') + '%',
                minMax: this.calculateMinMaxMetric('successRate'),
                threshold: this.thresholds.successRate.warning + '%',
                status: this.getMetricStatus('successRate', this.currentMetrics.successRate)
            },
            {
                name: 'Throughput',
                current: Math.round(this.currentMetrics.throughput) + '/min',
                average: this.calculateAverageMetric('throughput') + '/min',
                minMax: this.calculateMinMaxMetric('throughput'),
                threshold: 'N/A',
                status: 'good'
            },
            {
                name: 'Error Rate',
                current: this.currentMetrics.errorRate.toFixed(1) + '%',
                average: this.calculateAverageMetric('errorRate') + '%',
                minMax: this.calculateMinMaxMetric('errorRate'),
                threshold: this.thresholds.errorRate.warning + '%',
                status: this.getMetricStatus('errorRate', this.currentMetrics.errorRate)
            }
        ];

        tbody.innerHTML = metrics.map(metric => `
            <tr>
                <td>${metric.name}</td>
                <td>${metric.current}</td>
                <td>${metric.average}</td>
                <td>${metric.minMax}</td>
                <td>${metric.threshold}</td>
                <td><span class="status-indicator ${metric.status}">${metric.status}</span></td>
            </tr>
        `).join('');
    }

    /**
     * Update agent performance breakdown
     */
    updateAgentPerformance(agentUsage, agentMetrics) {
        const container = document.getElementById('agentPerformanceList');
        if (!container) return;

        const agentCards = Object.keys(agentUsage).map(agentName => {
            const usage = agentUsage[agentName] || 0;
            const metrics = agentMetrics[agentName] || {
                totalRequests: 0,
                successfulRequests: 0,
                averageLatency: 0
            };

            const successRate = metrics.totalRequests > 0 
                ? (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(1)
                : '0.0';

            return `
                <div class="agent-card">
                    <h5>${agentName}</h5>
                    <div class="agent-metric">
                        <span class="agent-metric-label">Usage Count:</span>
                        <span class="agent-metric-value">${usage}</span>
                    </div>
                    <div class="agent-metric">
                        <span class="agent-metric-label">Success Rate:</span>
                        <span class="agent-metric-value">${successRate}%</span>
                    </div>
                    <div class="agent-metric">
                        <span class="agent-metric-label">Avg Latency:</span>
                        <span class="agent-metric-value">${Math.round(metrics.averageLatency)}ms</span>
                    </div>
                    <div class="agent-metric">
                        <span class="agent-metric-label">Total Requests:</span>
                        <span class="agent-metric-value">${metrics.totalRequests}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = agentCards || '<p style="color: #9ca3af; text-align: center;">No agent data available</p>';
    }

    /**
     * Check performance thresholds and generate alerts
     */
    checkPerformanceThresholds() {
        const now = Date.now();

        // Check latency threshold
        if (this.currentMetrics.latency > this.thresholds.latency.critical) {
            this.addAlert('critical', 'High Latency Alert', 
                `Routing latency (${Math.round(this.currentMetrics.latency)}ms) exceeds critical threshold (${this.thresholds.latency.critical}ms)`);
        } else if (this.currentMetrics.latency > this.thresholds.latency.warning) {
            this.addAlert('warning', 'Latency Warning', 
                `Routing latency (${Math.round(this.currentMetrics.latency)}ms) exceeds warning threshold (${this.thresholds.latency.warning}ms)`);
        }

        // Check success rate threshold
        if (this.currentMetrics.successRate < this.thresholds.successRate.critical) {
            this.addAlert('critical', 'Low Success Rate Alert', 
                `Success rate (${this.currentMetrics.successRate.toFixed(1)}%) below critical threshold (${this.thresholds.successRate.critical}%)`);
        } else if (this.currentMetrics.successRate < this.thresholds.successRate.warning) {
            this.addAlert('warning', 'Success Rate Warning', 
                `Success rate (${this.currentMetrics.successRate.toFixed(1)}%) below warning threshold (${this.thresholds.successRate.warning}%)`);
        }

        // Check error rate threshold
        if (this.currentMetrics.errorRate > this.thresholds.errorRate.critical) {
            this.addAlert('critical', 'High Error Rate Alert', 
                `Error rate (${this.currentMetrics.errorRate.toFixed(1)}%) exceeds critical threshold (${this.thresholds.errorRate.critical}%)`);
        } else if (this.currentMetrics.errorRate > this.thresholds.errorRate.warning) {
            this.addAlert('warning', 'Error Rate Warning', 
                `Error rate (${this.currentMetrics.errorRate.toFixed(1)}%) exceeds warning threshold (${this.thresholds.errorRate.warning}%)`);
        }
    }

    /**
     * Add alert to the alerts list
     */
    addAlert(level, title, message) {
        // Check if similar alert already exists recently
        const recentAlerts = this.alertHistory.filter(alert => 
            Date.now() - alert.timestamp < 60000 && // Within last minute
            alert.title === title
        );

        if (recentAlerts.length > 0) return; // Don't spam similar alerts

        const alert = {
            id: Date.now(),
            timestamp: Date.now(),
            level: level,
            title: title,
            message: message
        };

        this.alertHistory.push(alert);
        this.displayAlert(alert);

        // Keep only recent alerts (last 50)
        if (this.alertHistory.length > 50) {
            this.alertHistory.shift();
        }
    }

    /**
     * Display alert in UI
     */
    displayAlert(alert) {
        const container = document.getElementById('alertsList');
        if (!container) return;

        const alertElement = document.createElement('div');
        alertElement.className = `alert-item ${alert.level}`;
        alertElement.innerHTML = `
            <div class="alert-timestamp">${new Date(alert.timestamp).toLocaleString()}</div>
            <div class="alert-message"><strong>${alert.title}:</strong> ${alert.message}</div>
        `;

        container.insertBefore(alertElement, container.firstChild);

        // Keep only recent alerts in UI (last 20)
        while (container.children.length > 20) {
            container.removeChild(container.lastChild);
        }
    }

    /**
     * Helper methods
     */
    calculateThroughput(totalDecisions) {
        // Calculate requests per minute based on recent activity
        const recentHistory = this.performanceHistory.slice(-12); // Last 12 data points (1 minute at 5s intervals)
        if (recentHistory.length < 2) return 0;

        const timeSpan = (recentHistory[recentHistory.length - 1].timestamp - recentHistory[0].timestamp) / 1000 / 60; // minutes
        return timeSpan > 0 ? totalDecisions / timeSpan : 0;
    }

    getActiveConnections() {
        return window.streamingManager?.isConnected ? 1 : 0;
    }

    calculateLatencyScore(latency) {
        if (latency <= 50) return 100;
        if (latency <= 100) return 80;
        if (latency <= 200) return 60;
        return 40;
    }

    calculateThroughputScore(throughput) {
        // Normalize throughput to 0-100 scale (assuming 60 req/min is excellent)
        return Math.min(100, (throughput / 60) * 100);
    }

    getAvailabilityScore() {
        return window.streamingManager?.isConnected ? 100 : 0;
    }

    calculateAverageMetric(metricName) {
        if (this.performanceHistory.length === 0) return 0;
        
        const sum = this.performanceHistory.reduce((acc, p) => acc + (p[metricName] || 0), 0);
        return Math.round(sum / this.performanceHistory.length);
    }

    calculateMinMaxMetric(metricName) {
        if (this.performanceHistory.length === 0) return 'N/A';
        
        const values = this.performanceHistory.map(p => p[metricName] || 0);
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        return `${Math.round(min)} / ${Math.round(max)}`;
    }

    getMetricStatus(metricName, value) {
        switch (metricName) {
            case 'latency':
                if (value > this.thresholds.latency.critical) return 'critical';
                if (value > this.thresholds.latency.warning) return 'warning';
                return 'good';
            case 'successRate':
                if (value < this.thresholds.successRate.critical) return 'critical';
                if (value < this.thresholds.successRate.warning) return 'warning';
                return 'good';
            case 'errorRate':
                if (value > this.thresholds.errorRate.critical) return 'critical';
                if (value > this.thresholds.errorRate.warning) return 'warning';
                return 'good';
            default:
                return 'good';
        }
    }

    /**
     * Dashboard control methods
     */
    refreshDashboard() {
        this.updateMetrics();
        this.updateCharts();
        this.debug.info('Dashboard refreshed');
    }

    exportPerformanceData() {
        const data = {
            timestamp: new Date().toISOString(),
            currentMetrics: this.currentMetrics,
            performanceHistory: this.performanceHistory,
            alertHistory: this.alertHistory,
            thresholds: this.thresholds
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `streaming-performance-data-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        this.debug.info('Performance data exported');
    }

    toggleSettingsPanel() {
        const panel = document.getElementById('dashboardSettingsPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    saveSettings() {
        // Get settings from form
        const updateInterval = parseInt(document.getElementById('updateInterval').value) * 1000;
        const chartUpdateInterval = parseInt(document.getElementById('chartUpdateInterval').value) * 1000;
        
        this.thresholds.latency.warning = parseInt(document.getElementById('latencyWarning').value);
        this.thresholds.latency.critical = parseInt(document.getElementById('latencyCritical').value);
        this.thresholds.successRate.warning = parseInt(document.getElementById('successRateWarning').value);
        this.thresholds.successRate.critical = parseInt(document.getElementById('successRateCritical').value);

        // Restart monitoring with new intervals
        this.stopMonitoring();
        setTimeout(() => {
            this.startMonitoring();
        }, 100);

        this.toggleSettingsPanel();
        this.debug.info('Settings saved');
    }

    resetSettings() {
        // Reset to defaults
        this.thresholds = {
            latency: { warning: 100, critical: 200 },
            successRate: { warning: 95, critical: 90 },
            errorRate: { warning: 5, critical: 10 }
        };

        // Update form
        document.getElementById('updateInterval').value = 5;
        document.getElementById('chartUpdateInterval').value = 10;
        document.getElementById('latencyWarning').value = 100;
        document.getElementById('latencyCritical').value = 200;
        document.getElementById('successRateWarning').value = 95;
        document.getElementById('successRateCritical').value = 90;

        this.debug.info('Settings reset to defaults');
    }

    clearAlerts() {
        this.alertHistory = [];
        const container = document.getElementById('alertsList');
        if (container) {
            container.innerHTML = '<p style="color: #9ca3af; text-align: center;">No alerts</p>';
        }
        this.debug.info('Alerts cleared');
    }

    filterAlerts(filter) {
        const container = document.getElementById('alertsList');
        if (!container) return;

        const alerts = container.querySelectorAll('.alert-item');
        alerts.forEach(alert => {
            const show = filter === 'all' || alert.classList.contains(filter);
            alert.style.display = show ? 'block' : 'none';
        });
    }

    /**
     * Cleanup method
     */
    destroy() {
        this.stopMonitoring();
        
        // Remove DOM elements
        const dashboard = document.getElementById('streamingPerformanceDashboard');
        if (dashboard) {
            dashboard.remove();
        }
        
        const styles = document.getElementById('streamingPerformanceDashboardStyles');
        if (styles) {
            styles.remove();
        }
        
        this.debug.info('StreamingPerformanceDashboard destroyed');
    }
}

// Initialize global performance dashboard instance
window.streamingPerformanceDashboard = new StreamingPerformanceDashboard();
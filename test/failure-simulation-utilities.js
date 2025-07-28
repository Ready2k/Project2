/**
 * Failure Simulation Testing Utilities
 * Provides mock failure scenarios for all external dependencies
 */

class FailureSimulator {
    constructor() {
        this.originalFetch = global.fetch;
        this.originalWebSocket = global.WebSocket;
        this.originalLocalStorage = global.localStorage;
        this.failureScenarios = new Map();
        this.networkFailures = new Map();
        this.resourceExhaustion = new Map();
    }

    /**
     * Mock API failures for external dependencies
     */
    mockApiFailures(config = {}) {
        const {
            openaiFailureRate = 0,
            networkTimeout = false,
            rateLimitError = false,
            serverError = false
        } = config;

        global.fetch = async (url, options) => {
            // Simulate OpenAI API failures
            if (url.includes('openai.com') && Math.random() < openaiFailureRate) {
                if (rateLimitError) {
                    throw new Error('Rate limit exceeded');
                }
                if (serverError) {
                    throw new Error('Internal server error');
                }
                if (networkTimeout) {
                    throw new Error('Network timeout');
                }
            }

            // Simulate network timeout
            if (networkTimeout && Math.random() < 0.3) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                throw new Error('Request timeout');
            }

            return this.originalFetch(url, options);
        };
    }

    /**
     * Mock WebSocket failures for streaming components
     */
    mockWebSocketFailures(config = {}) {
        const {
            connectionFailureRate = 0,
            messageDropRate = 0,
            unexpectedClose = false
        } = config;

        global.WebSocket = class MockWebSocket extends EventTarget {
            constructor(url) {
                super();
                this.url = url;
                this.readyState = WebSocket.CONNECTING;
                
                setTimeout(() => {
                    if (Math.random() < connectionFailureRate) {
                        this.readyState = WebSocket.CLOSED;
                        this.dispatchEvent(new Event('error'));
                        return;
                    }
                    
                    this.readyState = WebSocket.OPEN;
                    this.dispatchEvent(new Event('open'));
                    
                    if (unexpectedClose) {
                        setTimeout(() => {
                            this.readyState = WebSocket.CLOSED;
                            this.dispatchEvent(new CloseEvent('close', { code: 1006 }));
                        }, Math.random() * 5000);
                    }
                }, 100);
            }

            send(data) {
                if (this.readyState !== WebSocket.OPEN) {
                    throw new Error('WebSocket is not open');
                }
                
                // Simulate message drops
                if (Math.random() < messageDropRate) {
                    return;
                }
                
                // Simulate successful send
                setTimeout(() => {
                    this.dispatchEvent(new MessageEvent('message', {
                        data: JSON.stringify({ type: 'response', content: 'Mock response' })
                    }));
                }, 50);
            }

            close() {
                this.readyState = WebSocket.CLOSED;
                this.dispatchEvent(new CloseEvent('close', { code: 1000 }));
            }
        };

        // Copy static properties
        global.WebSocket.CONNECTING = 0;
        global.WebSocket.OPEN = 1;
        global.WebSocket.CLOSING = 2;
        global.WebSocket.CLOSED = 3;
    }

    /**
     * Mock localStorage failures
     */
    mockStorageFailures(config = {}) {
        const {
            quotaExceeded = false,
            corruptData = false,
            accessDenied = false
        } = config;

        const mockStorage = {
            getItem: (key) => {
                if (accessDenied) {
                    throw new Error('Access denied');
                }
                
                if (corruptData && key === 'token_usage') {
                    return '{"invalid": json}';
                }
                
                return this.originalLocalStorage.getItem(key);
            },
            
            setItem: (key, value) => {
                if (quotaExceeded) {
                    throw new Error('QuotaExceededError');
                }
                
                if (accessDenied) {
                    throw new Error('Access denied');
                }
                
                return this.originalLocalStorage.setItem(key, value);
            },
            
            removeItem: (key) => {
                return this.originalLocalStorage.removeItem(key);
            },
            
            clear: () => {
                return this.originalLocalStorage.clear();
            }
        };

        global.localStorage = mockStorage;
    }

    /**
     * Simulate resource exhaustion scenarios
     */
    simulateResourceExhaustion(config = {}) {
        const {
            memoryPressure = false,
            cpuThrottling = false,
            diskSpaceLimit = false
        } = config;

        if (memoryPressure) {
            // Mock memory pressure by creating large objects
            this.memoryPressureInterval = setInterval(() => {
                const largeArray = new Array(1000000).fill('memory pressure simulation');
                setTimeout(() => {
                    largeArray.length = 0;
                }, 100);
            }, 500);
        }

        if (cpuThrottling) {
            // Mock CPU throttling by adding delays
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = (callback, delay) => {
                return originalSetTimeout(callback, delay * 2); // Double all delays
            };
        }

        if (diskSpaceLimit) {
            // Mock disk space limitations
            const originalSetItem = global.localStorage.setItem;
            global.localStorage.setItem = (key, value) => {
                if (value.length > 1000) {
                    throw new Error('Insufficient storage space');
                }
                return originalSetItem.call(global.localStorage, key, value);
            };
        }
    }

    /**
     * Simulate network conditions
     */
    simulateNetworkConditions(config = {}) {
        const {
            latency = 0,
            packetLoss = 0,
            bandwidth = Infinity
        } = config;

        const originalFetch = global.fetch;
        global.fetch = async (url, options) => {
            // Simulate latency
            if (latency > 0) {
                await new Promise(resolve => setTimeout(resolve, latency));
            }

            // Simulate packet loss
            if (Math.random() < packetLoss) {
                throw new Error('Network packet lost');
            }

            // Simulate bandwidth limitations
            if (bandwidth < Infinity) {
                const delay = Math.random() * (1000 / bandwidth);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            return originalFetch(url, options);
        };
    }

    /**
     * Create specific failure scenarios
     */
    createFailureScenario(name, config) {
        this.failureScenarios.set(name, config);
        
        switch (name) {
            case 'api_outage':
                this.mockApiFailures({ openaiFailureRate: 1.0, serverError: true });
                break;
                
            case 'network_instability':
                this.mockWebSocketFailures({ connectionFailureRate: 0.5, messageDropRate: 0.3 });
                this.simulateNetworkConditions({ latency: 2000, packetLoss: 0.2 });
                break;
                
            case 'storage_corruption':
                this.mockStorageFailures({ corruptData: true, quotaExceeded: true });
                break;
                
            case 'resource_exhaustion':
                this.simulateResourceExhaustion({ memoryPressure: true, cpuThrottling: true });
                break;
                
            case 'cascading_failures':
                this.mockApiFailures({ openaiFailureRate: 0.7 });
                this.mockWebSocketFailures({ connectionFailureRate: 0.5 });
                this.mockStorageFailures({ accessDenied: true });
                break;
        }
    }

    /**
     * Reset all mocks to original state
     */
    reset() {
        global.fetch = this.originalFetch;
        global.WebSocket = this.originalWebSocket;
        global.localStorage = this.originalLocalStorage;
        
        if (this.memoryPressureInterval) {
            clearInterval(this.memoryPressureInterval);
        }
        
        this.failureScenarios.clear();
        this.networkFailures.clear();
        this.resourceExhaustion.clear();
    }

    /**
     * Get active failure scenarios
     */
    getActiveScenarios() {
        return Array.from(this.failureScenarios.keys());
    }

    /**
     * Test system resilience under failure conditions
     */
    async testResilience(testFunction, scenarios = []) {
        const results = [];
        
        for (const scenario of scenarios) {
            try {
                this.createFailureScenario(scenario);
                const result = await testFunction();
                results.push({
                    scenario,
                    success: true,
                    result,
                    error: null
                });
            } catch (error) {
                results.push({
                    scenario,
                    success: false,
                    result: null,
                    error: error.message
                });
            } finally {
                this.reset();
            }
        }
        
        return results;
    }
}

/**
 * Network Failure Simulator
 * Specialized for streaming and real-time components
 */
class NetworkFailureSimulator {
    constructor() {
        this.activeSimulations = new Set();
    }

    /**
     * Simulate intermittent connectivity
     */
    simulateIntermittentConnectivity(duration = 5000) {
        const simulation = {
            type: 'intermittent',
            startTime: Date.now(),
            duration
        };
        
        this.activeSimulations.add(simulation);
        
        const interval = setInterval(() => {
            if (Date.now() - simulation.startTime > duration) {
                clearInterval(interval);
                this.activeSimulations.delete(simulation);
                return;
            }
            
            // Toggle network availability
            const isOnline = Math.random() > 0.5;
            Object.defineProperty(navigator, 'onLine', {
                value: isOnline,
                configurable: true
            });
            
            // Dispatch online/offline events
            window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
        }, 1000);
        
        return simulation;
    }

    /**
     * Simulate connection drops during streaming
     */
    simulateStreamingDrops(websocket, dropRate = 0.1) {
        const originalSend = websocket.send;
        websocket.send = function(data) {
            if (Math.random() < dropRate) {
                // Simulate connection drop
                this.dispatchEvent(new CloseEvent('close', { code: 1006 }));
                return;
            }
            return originalSend.call(this, data);
        };
    }

    /**
     * Stop all active simulations
     */
    stopAll() {
        this.activeSimulations.clear();
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            configurable: true
        });
    }
}

/**
 * Resource Exhaustion Simulator
 */
class ResourceExhaustionSimulator {
    constructor() {
        this.memoryLeaks = [];
        this.cpuIntensiveTasks = [];
    }

    /**
     * Simulate memory leaks
     */
    simulateMemoryLeak(size = 1000000, interval = 1000) {
        const leak = setInterval(() => {
            const largeObject = new Array(size).fill('memory leak simulation');
            this.memoryLeaks.push(largeObject);
        }, interval);
        
        return leak;
    }

    /**
     * Simulate CPU intensive operations
     */
    simulateCpuLoad(intensity = 0.5, duration = 5000) {
        const startTime = Date.now();
        
        const cpuTask = () => {
            const cycleTime = 100;
            const workTime = cycleTime * intensity;
            const idleTime = cycleTime - workTime;
            
            const work = () => {
                const start = Date.now();
                while (Date.now() - start < workTime) {
                    // CPU intensive work
                    Math.random() * Math.random();
                }
            };
            
            work();
            
            if (Date.now() - startTime < duration) {
                setTimeout(cpuTask, idleTime);
            }
        };
        
        cpuTask();
    }

    /**
     * Clean up all simulated resource usage
     */
    cleanup() {
        this.memoryLeaks.length = 0;
        this.cpuIntensiveTasks.forEach(task => clearTimeout(task));
        this.cpuIntensiveTasks.length = 0;
    }
}

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FailureSimulator,
        NetworkFailureSimulator,
        ResourceExhaustionSimulator
    };
} else {
    window.FailureSimulator = FailureSimulator;
    window.NetworkFailureSimulator = NetworkFailureSimulator;
    window.ResourceExhaustionSimulator = ResourceExhaustionSimulator;
}
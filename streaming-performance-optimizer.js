/**
 * StreamingPerformanceOptimizer - Performance optimization for streaming agent routing
 * Implements caching, parallel processing, preemptive loading, and memory optimization
 */
class StreamingPerformanceOptimizer {
    constructor(streamingAgentRouter, streamingManager) {
        this.streamingAgentRouter = streamingAgentRouter;
        this.streamingManager = streamingManager;
        
        // Initialize debug logger
        this.debug = window.debugManager ? 
            window.debugManager.createModuleLogger('StreamingPerformanceOptimizer') : 
            { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

        // Routing decision cache
        this.routingCache = new Map();
        this.cacheConfig = {
            maxSize: 100,
            ttl: 5 * 60 * 1000, // 5 minutes
            hitThreshold: 0.8, // 80% similarity threshold for cache hits
            cleanupInterval: 60 * 1000 // 1 minute cleanup interval
        };

        // Parallel processing state
        this.parallelProcessing = {
            enabled: true,
            maxConcurrentOperations: 5,
            activeOperations: new Map(),
            operationQueue: [],
            lastWarningTime: 0,
            warningThrottleMs: 5000 // Only warn every 5 seconds
        };

        // Preemptive agent context loading
        this.contextPreloader = {
            enabled: true,
            preloadThreshold: 0.7, // Preload when confidence > 70%
            maxPreloadedContexts: 5,
            preloadedContexts: new Map(),
            preloadHistory: []
        };

        // Routing latency monitoring
        this.latencyMonitor = {
            enabled: true,
            thresholds: {
                warning: 100, // 100ms warning threshold
                critical: 200, // 200ms critical threshold (fallback trigger)
                timeout: 300 // 300ms absolute timeout
            },
            measurements: [],
            maxMeasurements: 100,
            averageLatency: 0,
            fallbackTriggered: false,
            consecutiveSlowRequests: 0,
            maxConsecutiveSlowRequests: 3
        };

        // Memory optimization
        this.memoryOptimizer = {
            enabled: true,
            maxSessionContexts: 10,
            contextCleanupInterval: 2 * 60 * 1000, // 2 minutes
            memoryThreshold: 50 * 1024 * 1024, // 50MB threshold
            compressionEnabled: true,
            sessionContexts: new Map(),
            cleanupHistory: []
        };

        // Performance metrics
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            parallelOperations: 0,
            preloadedContextsUsed: 0,
            fallbacksTriggered: 0,
            memoryCleanups: 0,
            averageRoutingTime: 0,
            totalOptimizedRequests: 0
        };

        // Initialize optimization systems
        this.initializeOptimizations();

        this.debug.info('StreamingPerformanceOptimizer initialized', {
            cacheEnabled: true,
            parallelProcessingEnabled: this.parallelProcessing.enabled,
            preloadingEnabled: this.contextPreloader.enabled,
            latencyMonitoringEnabled: this.latencyMonitor.enabled,
            memoryOptimizationEnabled: this.memoryOptimizer.enabled
        });
    }

    /**
     * Initialize all optimization systems
     */
    initializeOptimizations() {
        // Start cache cleanup interval
        this.cacheCleanupInterval = setInterval(() => {
            this.cleanupRoutingCache();
        }, this.cacheConfig.cleanupInterval);

        // Start memory optimization interval
        this.memoryCleanupInterval = setInterval(() => {
            this.optimizeMemoryUsage();
        }, this.memoryOptimizer.contextCleanupInterval);

        // Initialize performance monitoring
        this.startPerformanceMonitoring();
    }

    /**
     * Optimize routing message processing with caching and parallel processing
     * @param {string} transcript - User transcript
     * @param {Object} sessionContext - Session context
     * @returns {Promise<Object>} - Optimized routing result
     */
    async optimizeRoutingMessage(transcript, sessionContext) {
        const startTime = Date.now();
        this.metrics.totalOptimizedRequests++;

        try {
            // Check routing cache first
            const cacheResult = await this.checkRoutingCache(transcript, sessionContext);
            if (cacheResult.hit) {
                this.metrics.cacheHits++;
                const latency = Date.now() - startTime;
                this.recordLatencyMeasurement(latency, 'cache_hit');
                
                this.debug.info('Routing cache hit', {
                    transcript: transcript.substring(0, 50),
                    latency,
                    cacheKey: cacheResult.key
                });

                return {
                    ...cacheResult.result,
                    optimized: true,
                    cacheHit: true,
                    latency
                };
            }

            this.metrics.cacheMisses++;

            // Start parallel processing if enabled
            let routingPromise;
            if (this.parallelProcessing.enabled) {
                routingPromise = this.processRoutingInParallel(transcript, sessionContext);
            } else {
                routingPromise = this.streamingAgentRouter.routeStreamingMessage(transcript, sessionContext);
            }

            // Start preemptive context loading based on transcript analysis
            const preloadPromise = this.preloadAgentContexts(transcript, sessionContext);

            // Wait for routing result
            const routingResult = await routingPromise;
            const latency = Date.now() - startTime;

            // Record latency measurement
            this.recordLatencyMeasurement(latency, 'routing_complete');

            // Check if we should trigger fallback due to slow performance
            if (this.shouldTriggerLatencyFallback(latency)) {
                this.debug.warn('Triggering latency fallback', {
                    latency,
                    threshold: this.latencyMonitor.thresholds.critical
                });
                
                this.metrics.fallbacksTriggered++;
                return this.createLatencyFallbackResponse(transcript, sessionContext, latency);
            }

            // Cache the successful result
            if (routingResult.success) {
                await this.cacheRoutingResult(transcript, sessionContext, routingResult);
            }

            // Wait for preloading to complete (don't block on it)
            preloadPromise.catch(error => {
                this.debug.warn('Preloading failed', { error: error.message });
            });

            return {
                ...routingResult,
                optimized: true,
                cacheHit: false,
                latency,
                preloadingActive: true
            };

        } catch (error) {
            const latency = Date.now() - startTime;
            this.recordLatencyMeasurement(latency, 'routing_error');
            
            this.debug.error('Optimized routing failed', {
                error: error.message,
                latency,
                transcript: transcript.substring(0, 50)
            });

            throw error;
        }
    }

    /**
     * Check routing cache for similar requests
     * @param {string} transcript - User transcript
     * @param {Object} sessionContext - Session context
     * @returns {Promise<Object>} - Cache check result
     */
    async checkRoutingCache(transcript, sessionContext) {
        try {
            const cacheKey = this.generateCacheKey(transcript, sessionContext);
            const cachedEntry = this.routingCache.get(cacheKey);

            // Check exact match first
            if (cachedEntry && !this.isCacheEntryExpired(cachedEntry)) {
                return {
                    hit: true,
                    key: cacheKey,
                    result: cachedEntry.result,
                    similarity: 1.0
                };
            }

            // Check for similar entries using fuzzy matching
            const similarEntry = await this.findSimilarCacheEntry(transcript, sessionContext);
            if (similarEntry) {
                return {
                    hit: true,
                    key: similarEntry.key,
                    result: similarEntry.result,
                    similarity: similarEntry.similarity
                };
            }

            return { hit: false };

        } catch (error) {
            this.debug.error('Cache check failed', { error: error.message });
            return { hit: false };
        }
    }

    /**
     * Generate cache key for routing request
     * @param {string} transcript - User transcript
     * @param {Object} sessionContext - Session context
     * @returns {string} - Cache key
     */
    generateCacheKey(transcript, sessionContext) {
        // Normalize transcript for consistent caching
        const normalizedTranscript = transcript.toLowerCase().trim();
        
        // Include relevant context factors
        const contextFactors = {
            currentAgent: sessionContext.currentAgent || 'none',
            hasHistory: (sessionContext.conversationHistory?.length || 0) > 0,
            sessionAge: sessionContext.sessionAge || 0
        };

        // Create hash-like key
        const keyData = `${normalizedTranscript}|${JSON.stringify(contextFactors)}`;
        return this.simpleHash(keyData);
    }

    /**
     * Simple hash function for cache keys
     * @param {string} str - String to hash
     * @returns {string} - Hash string
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Find similar cache entry using fuzzy matching
     * @param {string} transcript - User transcript
     * @param {Object} sessionContext - Session context
     * @returns {Promise<Object|null>} - Similar cache entry or null
     */
    async findSimilarCacheEntry(transcript, sessionContext) {
        try {
            const normalizedTranscript = transcript.toLowerCase().trim();
            let bestMatch = null;
            let bestSimilarity = 0;

            for (const [key, entry] of this.routingCache.entries()) {
                if (this.isCacheEntryExpired(entry)) {
                    continue;
                }

                // Calculate similarity
                const similarity = this.calculateTextSimilarity(
                    normalizedTranscript, 
                    entry.originalTranscript.toLowerCase().trim()
                );

                if (similarity > bestSimilarity && similarity >= this.cacheConfig.hitThreshold) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        key,
                        result: entry.result,
                        similarity
                    };
                }
            }

            return bestMatch;

        } catch (error) {
            this.debug.error('Similar cache entry search failed', { error: error.message });
            return null;
        }
    }

    /**
     * Calculate text similarity using simple algorithm
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {number} - Similarity score (0-1)
     */
    calculateTextSimilarity(text1, text2) {
        // Simple word-based similarity
        const words1 = new Set(text1.split(/\s+/));
        const words2 = new Set(text2.split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * Check if cache entry is expired
     * @param {Object} entry - Cache entry
     * @returns {boolean} - True if expired
     */
    isCacheEntryExpired(entry) {
        return Date.now() - entry.timestamp > this.cacheConfig.ttl;
    }

    /**
     * Cache routing result
     * @param {string} transcript - Original transcript
     * @param {Object} sessionContext - Session context
     * @param {Object} result - Routing result
     */
    async cacheRoutingResult(transcript, sessionContext, result) {
        try {
            const cacheKey = this.generateCacheKey(transcript, sessionContext);
            
            // Clean cache if it's getting too large
            if (this.routingCache.size >= this.cacheConfig.maxSize) {
                this.cleanupRoutingCache();
            }

            const cacheEntry = {
                timestamp: Date.now(),
                originalTranscript: transcript,
                sessionContext: {
                    currentAgent: sessionContext.currentAgent,
                    hasHistory: (sessionContext.conversationHistory?.length || 0) > 0
                },
                result: {
                    ...result,
                    // Remove large objects to save memory
                    agentResponse: result.agentResponse ? {
                        success: result.agentResponse.success,
                        agentName: result.agentResponse.agentName,
                        response: result.agentResponse.response?.substring(0, 200) // Truncate response
                    } : null
                }
            };

            this.routingCache.set(cacheKey, cacheEntry);

            this.debug.debug('Routing result cached', {
                cacheKey,
                transcript: transcript.substring(0, 50),
                cacheSize: this.routingCache.size
            });

        } catch (error) {
            this.debug.error('Failed to cache routing result', { error: error.message });
        }
    }

    /**
     * Process routing in parallel with audio processing
     * @param {string} transcript - User transcript
     * @param {Object} sessionContext - Session context
     * @returns {Promise<Object>} - Routing result
     */
    async processRoutingInParallel(transcript, sessionContext) {
        const operationId = `routing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            // Check if we can start a new parallel operation
            if (this.parallelProcessing.activeOperations.size >= this.parallelProcessing.maxConcurrentOperations) {
                // Throttle warnings to avoid spam
                const now = Date.now();
                if (now - this.parallelProcessing.lastWarningTime > this.parallelProcessing.warningThrottleMs) {
                    this.debug.warn('Max parallel operations reached, queuing request', {
                        activeOperations: this.parallelProcessing.activeOperations.size,
                        maxConcurrent: this.parallelProcessing.maxConcurrentOperations,
                        queueLength: this.parallelProcessing.operationQueue.length
                    });
                    this.parallelProcessing.lastWarningTime = now;
                }
                
                // Queue the operation
                return new Promise((resolve, reject) => {
                    this.parallelProcessing.operationQueue.push({
                        operationId,
                        transcript,
                        sessionContext,
                        resolve,
                        reject
                    });
                });
            }

            // Start parallel operation
            this.parallelProcessing.activeOperations.set(operationId, {
                startTime: Date.now(),
                transcript: transcript.substring(0, 50)
            });

            this.metrics.parallelOperations++;

            this.debug.debug('Starting parallel routing operation', {
                operationId,
                activeOperations: this.parallelProcessing.activeOperations.size
            });

            // Execute routing
            const result = await this.streamingAgentRouter.routeStreamingMessage(transcript, sessionContext);

            return result;

        } catch (error) {
            this.debug.error('Parallel routing operation failed', {
                operationId,
                error: error.message
            });
            throw error;

        } finally {
            // Clean up operation
            this.parallelProcessing.activeOperations.delete(operationId);
            
            // Process queued operations
            this.processQueuedOperations();
        }
    }

    /**
     * Process queued parallel operations
     */
    processQueuedOperations() {
        while (this.parallelProcessing.operationQueue.length > 0 && 
               this.parallelProcessing.activeOperations.size < this.parallelProcessing.maxConcurrentOperations) {
            
            const queuedOperation = this.parallelProcessing.operationQueue.shift();
            
            // Execute queued operation
            this.processRoutingInParallel(
                queuedOperation.transcript, 
                queuedOperation.sessionContext
            ).then(queuedOperation.resolve)
             .catch(queuedOperation.reject);
        }
    }

    /**
     * Preload agent contexts based on transcript analysis
     * @param {string} transcript - User transcript
     * @param {Object} sessionContext - Session context
     * @returns {Promise<void>}
     */
    async preloadAgentContexts(transcript, sessionContext) {
        if (!this.contextPreloader.enabled) {
            return;
        }

        try {
            // Analyze transcript to predict likely agents
            const agentPredictions = await this.predictLikelyAgents(transcript, sessionContext);
            
            // Preload contexts for high-confidence predictions
            const preloadPromises = [];
            
            for (const prediction of agentPredictions) {
                if (prediction.confidence >= this.contextPreloader.preloadThreshold &&
                    !this.contextPreloader.preloadedContexts.has(prediction.agentName)) {
                    
                    preloadPromises.push(this.preloadAgentContext(prediction.agentName, sessionContext));
                }
            }

            if (preloadPromises.length > 0) {
                await Promise.allSettled(preloadPromises);
                
                this.debug.info('Preloaded agent contexts', {
                    preloadedAgents: agentPredictions
                        .filter(p => p.confidence >= this.contextPreloader.preloadThreshold)
                        .map(p => p.agentName),
                    totalPreloaded: this.contextPreloader.preloadedContexts.size
                });
            }

        } catch (error) {
            this.debug.error('Agent context preloading failed', { error: error.message });
        }
    }

    /**
     * Predict likely agents based on transcript analysis
     * @param {string} transcript - User transcript
     * @param {Object} sessionContext - Session context
     * @returns {Promise<Array>} - Array of agent predictions with confidence scores
     */
    async predictLikelyAgents(transcript, sessionContext) {
        const predictions = [];
        const lowerTranscript = transcript.toLowerCase();

        // Define agent prediction patterns
        const agentPatterns = {
            'FraudAgent': {
                patterns: [/fraud/, /fraudulent/, /unauthorized/, /suspicious/, /block/, /freeze/, /stolen/],
                baseConfidence: 0.8
            },
            'PaymentsAgent': {
                patterns: [/transfer/, /payment/, /send.*money/, /pay.*bill/, /wire/],
                baseConfidence: 0.75
            },
            'IDVAgent': {
                patterns: [/verify/, /identity/, /authentication/, /security.*question/],
                baseConfidence: 0.7
            },
            'BankingInfoAgent': {
                patterns: [/balance/, /statement/, /account.*details/, /transaction.*history/],
                baseConfidence: 0.65
            }
        };

        // Calculate confidence for each agent
        for (const [agentName, config] of Object.entries(agentPatterns)) {
            let confidence = 0;
            let matchCount = 0;

            for (const pattern of config.patterns) {
                if (pattern.test(lowerTranscript)) {
                    matchCount++;
                }
            }

            if (matchCount > 0) {
                confidence = config.baseConfidence * (matchCount / config.patterns.length);
                
                // Boost confidence if this agent was recently used
                if (sessionContext.currentAgent === agentName) {
                    confidence += 0.1;
                }

                predictions.push({
                    agentName,
                    confidence: Math.min(confidence, 1.0),
                    matchCount
                });
            }
        }

        // Sort by confidence
        predictions.sort((a, b) => b.confidence - a.confidence);

        return predictions;
    }

    /**
     * Preload context for a specific agent
     * @param {string} agentName - Agent name
     * @param {Object} sessionContext - Session context
     * @returns {Promise<void>}
     */
    async preloadAgentContext(agentName, sessionContext) {
        try {
            // Check if already preloaded
            if (this.contextPreloader.preloadedContexts.has(agentName)) {
                return;
            }

            // Check preload limit
            if (this.contextPreloader.preloadedContexts.size >= this.contextPreloader.maxPreloadedContexts) {
                // Remove oldest preloaded context
                const oldestKey = this.contextPreloader.preloadedContexts.keys().next().value;
                this.contextPreloader.preloadedContexts.delete(oldestKey);
            }

            // Get agent instance
            const agent = this.streamingAgentRouter.agentRouter.getRegisteredAgents()
                .find(a => a.name === agentName);

            if (!agent) {
                this.debug.warn('Agent not found for preloading', { agentName });
                return;
            }

            // Prepare context data
            const contextData = {
                agentName,
                preloadTime: Date.now(),
                sessionInstructions: await this.streamingAgentRouter.generateSessionInstructions(
                    agent, 
                    '', 
                    sessionContext
                ),
                voiceConfig: this.streamingAgentRouter.getAgentVoiceConfig(agent),
                agentMetadata: {
                    name: agent.name,
                    description: agent.description,
                    capabilities: agent.capabilities || []
                }
            };

            // Store preloaded context
            this.contextPreloader.preloadedContexts.set(agentName, contextData);
            
            // Record preload history
            this.contextPreloader.preloadHistory.push({
                agentName,
                timestamp: Date.now(),
                used: false
            });

            this.debug.debug('Agent context preloaded', {
                agentName,
                preloadedContexts: this.contextPreloader.preloadedContexts.size
            });

        } catch (error) {
            this.debug.error('Failed to preload agent context', {
                agentName,
                error: error.message
            });
        }
    }

    /**
     * Get preloaded context for an agent
     * @param {string} agentName - Agent name
     * @returns {Object|null} - Preloaded context or null
     */
    getPreloadedContext(agentName) {
        const context = this.contextPreloader.preloadedContexts.get(agentName);
        
        if (context) {
            // Mark as used
            const historyEntry = this.contextPreloader.preloadHistory
                .find(h => h.agentName === agentName && !h.used);
            if (historyEntry) {
                historyEntry.used = true;
                historyEntry.usedTime = Date.now();
            }

            this.metrics.preloadedContextsUsed++;
            
            this.debug.info('Using preloaded context', {
                agentName,
                preloadAge: Date.now() - context.preloadTime
            });
        }

        return context;
    }

    /**
     * Record latency measurement
     * @param {number} latency - Latency in milliseconds
     * @param {string} operation - Operation type
     */
    recordLatencyMeasurement(latency, operation) {
        const measurement = {
            timestamp: Date.now(),
            latency,
            operation
        };

        this.latencyMonitor.measurements.push(measurement);

        // Maintain measurement history limit
        if (this.latencyMonitor.measurements.length > this.latencyMonitor.maxMeasurements) {
            this.latencyMonitor.measurements.shift();
        }

        // Update average latency
        const totalLatency = this.latencyMonitor.measurements.reduce((sum, m) => sum + m.latency, 0);
        this.latencyMonitor.averageLatency = totalLatency / this.latencyMonitor.measurements.length;
        this.metrics.averageRoutingTime = this.latencyMonitor.averageLatency;

        // Check for consecutive slow requests
        if (latency > this.latencyMonitor.thresholds.warning) {
            this.latencyMonitor.consecutiveSlowRequests++;
        } else {
            this.latencyMonitor.consecutiveSlowRequests = 0;
        }

        this.debug.debug('Latency measurement recorded', {
            latency,
            operation,
            averageLatency: Math.round(this.latencyMonitor.averageLatency),
            consecutiveSlowRequests: this.latencyMonitor.consecutiveSlowRequests
        });
    }

    /**
     * Check if latency fallback should be triggered
     * @param {number} latency - Current latency
     * @returns {boolean} - True if fallback should be triggered
     */
    shouldTriggerLatencyFallback(latency) {
        // Trigger fallback if latency exceeds critical threshold
        if (latency > this.latencyMonitor.thresholds.critical) {
            return true;
        }

        // Trigger fallback if we have too many consecutive slow requests
        if (this.latencyMonitor.consecutiveSlowRequests >= this.latencyMonitor.maxConsecutiveSlowRequests) {
            return true;
        }

        return false;
    }

    /**
     * Create latency fallback response
     * @param {string} transcript - Original transcript
     * @param {Object} sessionContext - Session context
     * @param {number} latency - Measured latency
     * @returns {Object} - Fallback response
     */
    createLatencyFallbackResponse(transcript, sessionContext, latency) {
        this.latencyMonitor.fallbackTriggered = true;

        return {
            success: false,
            fallbackReason: 'latency_timeout',
            latency,
            error: `Routing took too long (${latency}ms), falling back to standard streaming`,
            fallbackResponse: {
                agent: sessionContext.currentAgent || 'DefaultAgent',
                response: 'I apologize for the delay. Let me help you with that.',
                streamingInstructions: 'Continue the conversation naturally.'
            },
            optimized: true,
            fallbackTriggered: true
        };
    }

    /**
     * Optimize memory usage by cleaning up old contexts and data
     */
    optimizeMemoryUsage() {
        try {
            const startTime = Date.now();
            let cleanedItems = 0;

            // Clean up expired cache entries
            const expiredCacheKeys = [];
            for (const [key, entry] of this.routingCache.entries()) {
                if (this.isCacheEntryExpired(entry)) {
                    expiredCacheKeys.push(key);
                }
            }

            expiredCacheKeys.forEach(key => {
                this.routingCache.delete(key);
                cleanedItems++;
            });

            // Clean up old preloaded contexts
            const expiredPreloadKeys = [];
            for (const [agentName, context] of this.contextPreloader.preloadedContexts.entries()) {
                if (Date.now() - context.preloadTime > 10 * 60 * 1000) { // 10 minutes
                    expiredPreloadKeys.push(agentName);
                }
            }

            expiredPreloadKeys.forEach(key => {
                this.contextPreloader.preloadedContexts.delete(key);
                cleanedItems++;
            });

            // Clean up old latency measurements
            const cutoffTime = Date.now() - (30 * 60 * 1000); // 30 minutes
            const oldMeasurements = this.latencyMonitor.measurements.length;
            this.latencyMonitor.measurements = this.latencyMonitor.measurements
                .filter(m => m.timestamp > cutoffTime);
            cleanedItems += oldMeasurements - this.latencyMonitor.measurements.length;

            // Clean up preload history
            const oldHistoryLength = this.contextPreloader.preloadHistory.length;
            this.contextPreloader.preloadHistory = this.contextPreloader.preloadHistory
                .filter(h => Date.now() - h.timestamp < 60 * 60 * 1000) // 1 hour
                .slice(-50); // Keep last 50 entries
            cleanedItems += oldHistoryLength - this.contextPreloader.preloadHistory.length;

            const cleanupTime = Date.now() - startTime;
            this.metrics.memoryCleanups++;

            // Record cleanup
            this.memoryOptimizer.cleanupHistory.push({
                timestamp: Date.now(),
                cleanedItems,
                cleanupTime,
                cacheSize: this.routingCache.size,
                preloadedContexts: this.contextPreloader.preloadedContexts.size
            });

            // Keep cleanup history limited
            if (this.memoryOptimizer.cleanupHistory.length > 20) {
                this.memoryOptimizer.cleanupHistory.shift();
            }

            this.debug.info('Memory optimization completed', {
                cleanedItems,
                cleanupTime,
                cacheSize: this.routingCache.size,
                preloadedContexts: this.contextPreloader.preloadedContexts.size,
                latencyMeasurements: this.latencyMonitor.measurements.length
            });

        } catch (error) {
            this.debug.error('Memory optimization failed', { error: error.message });
        }
    }

    /**
     * Clean up routing cache
     */
    cleanupRoutingCache() {
        const expiredKeys = [];
        
        for (const [key, entry] of this.routingCache.entries()) {
            if (this.isCacheEntryExpired(entry)) {
                expiredKeys.push(key);
            }
        }

        expiredKeys.forEach(key => this.routingCache.delete(key));

        // If cache is still too large, remove oldest entries
        if (this.routingCache.size > this.cacheConfig.maxSize) {
            const entries = Array.from(this.routingCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            const toRemove = entries.slice(0, entries.length - this.cacheConfig.maxSize);
            toRemove.forEach(([key]) => this.routingCache.delete(key));
        }

        this.debug.debug('Routing cache cleaned', {
            expiredKeys: expiredKeys.length,
            currentSize: this.routingCache.size
        });
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        // Monitor performance every 30 seconds
        this.performanceMonitorInterval = setInterval(() => {
            this.updatePerformanceMetrics();
        }, 30 * 1000);
    }

    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        try {
            // Calculate cache hit rate
            const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
            const cacheHitRate = totalCacheRequests > 0 ? 
                (this.metrics.cacheHits / totalCacheRequests) * 100 : 0;

            // Calculate preload effectiveness
            const totalPreloads = this.contextPreloader.preloadHistory.length;
            const usedPreloads = this.contextPreloader.preloadHistory.filter(h => h.used).length;
            const preloadEffectiveness = totalPreloads > 0 ? 
                (usedPreloads / totalPreloads) * 100 : 0;

            // Update metrics
            this.metrics.cacheHitRate = cacheHitRate;
            this.metrics.preloadEffectiveness = preloadEffectiveness;

            this.debug.debug('Performance metrics updated', {
                cacheHitRate: Math.round(cacheHitRate) + '%',
                preloadEffectiveness: Math.round(preloadEffectiveness) + '%',
                averageLatency: Math.round(this.latencyMonitor.averageLatency) + 'ms',
                activeOperations: this.parallelProcessing.activeOperations.size,
                queuedOperations: this.parallelProcessing.operationQueue.length
            });

        } catch (error) {
            this.debug.error('Performance metrics update failed', { error: error.message });
        }
    }

    /**
     * Get current performance metrics
     * @returns {Object} - Performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.metrics,
            cache: {
                size: this.routingCache.size,
                hitRate: this.metrics.cacheHitRate || 0,
                maxSize: this.cacheConfig.maxSize
            },
            parallelProcessing: {
                activeOperations: this.parallelProcessing.activeOperations.size,
                queuedOperations: this.parallelProcessing.operationQueue.length,
                maxConcurrent: this.parallelProcessing.maxConcurrentOperations
            },
            preloading: {
                preloadedContexts: this.contextPreloader.preloadedContexts.size,
                effectiveness: this.metrics.preloadEffectiveness || 0,
                maxPreloaded: this.contextPreloader.maxPreloadedContexts
            },
            latency: {
                average: Math.round(this.latencyMonitor.averageLatency),
                measurements: this.latencyMonitor.measurements.length,
                consecutiveSlowRequests: this.latencyMonitor.consecutiveSlowRequests,
                fallbackTriggered: this.latencyMonitor.fallbackTriggered
            },
            memory: {
                cleanups: this.metrics.memoryCleanups,
                lastCleanup: this.memoryOptimizer.cleanupHistory.length > 0 ? 
                    this.memoryOptimizer.cleanupHistory[this.memoryOptimizer.cleanupHistory.length - 1] : null
            }
        };
    }

    /**
     * Reset performance metrics
     */
    resetPerformanceMetrics() {
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            parallelOperations: 0,
            preloadedContextsUsed: 0,
            fallbacksTriggered: 0,
            memoryCleanups: 0,
            averageRoutingTime: 0,
            totalOptimizedRequests: 0
        };

        this.latencyMonitor.measurements = [];
        this.latencyMonitor.averageLatency = 0;
        this.latencyMonitor.consecutiveSlowRequests = 0;
        this.latencyMonitor.fallbackTriggered = false;

        this.debug.info('Performance metrics reset');
    }

    /**
     * Cleanup and dispose of resources
     */
    dispose() {
        // Clear intervals
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
        }
        if (this.memoryCleanupInterval) {
            clearInterval(this.memoryCleanupInterval);
        }
        if (this.performanceMonitorInterval) {
            clearInterval(this.performanceMonitorInterval);
        }

        // Clear caches and data
        this.routingCache.clear();
        this.contextPreloader.preloadedContexts.clear();
        this.parallelProcessing.activeOperations.clear();
        this.parallelProcessing.operationQueue = [];

        this.debug.info('StreamingPerformanceOptimizer disposed');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.StreamingPerformanceOptimizer = StreamingPerformanceOptimizer;
}
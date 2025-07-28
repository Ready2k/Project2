/**
 * Error Message Generator - Creates user-friendly error messages
 * Provides context-aware error explanations and localization support
 */

class ErrorMessageGenerator {
    constructor(options = {}) {
        this.locale = options.locale || 'en';
        this.debug = options.debug || console;
        this.customMessages = new Map();
        this.contextProviders = new Map();
        this.localization = new Map();
        this.setupDefaultMessages();
        this.setupLocalization();
    }

    /**
     * Setup default error messages
     */
    setupDefaultMessages() {
        // API-related errors
        this.addMessageTemplate('api_error', {
            title: 'Connection Issue',
            message: 'We\'re having trouble connecting to our services. Please try again in a moment.',
            suggestion: 'Check your internet connection and try again.',
            technical: 'API request failed: {error}'
        });

        this.addMessageTemplate('api_timeout', {
            title: 'Request Timeout',
            message: 'Your request is taking longer than expected.',
            suggestion: 'Please try again. If the problem persists, try refreshing the page.',
            technical: 'Request timed out after {timeout}ms'
        });

        this.addMessageTemplate('api_rate_limit', {
            title: 'Too Many Requests',
            message: 'You\'re sending requests too quickly.',
            suggestion: 'Please wait a moment before trying again.',
            technical: 'Rate limit exceeded: {limit} requests per {window}'
        });

        // Input validation errors
        this.addMessageTemplate('invalid_input', {
            title: 'Invalid Input',
            message: 'The information you provided isn\'t in the right format.',
            suggestion: 'Please check your input and try again.',
            technical: 'Validation failed: {field} - {error}'
        });

        this.addMessageTemplate('missing_input', {
            title: 'Missing Information',
            message: 'Some required information is missing.',
            suggestion: 'Please fill in all required fields.',
            technical: 'Required field missing: {field}'
        });

        this.addMessageTemplate('input_too_long', {
            title: 'Input Too Long',
            message: 'Your message is too long.',
            suggestion: 'Please shorten your message and try again.',
            technical: 'Input length {length} exceeds maximum {max}'
        });

        // System errors
        this.addMessageTemplate('system_error', {
            title: 'System Error',
            message: 'Something went wrong on our end.',
            suggestion: 'Please try again. If the problem continues, contact support.',
            technical: 'Internal system error: {error}'
        });

        this.addMessageTemplate('memory_error', {
            title: 'System Overload',
            message: 'Our system is currently overloaded.',
            suggestion: 'Please try again in a few minutes.',
            technical: 'Memory usage exceeded: {usage}MB'
        });

        this.addMessageTemplate('storage_error', {
            title: 'Storage Issue',
            message: 'We couldn\'t save your information.',
            suggestion: 'Please try again. Your progress may not be saved.',
            technical: 'Storage operation failed: {operation}'
        });

        // Authentication errors
        this.addMessageTemplate('auth_error', {
            title: 'Authentication Required',
            message: 'You need to be signed in to do that.',
            suggestion: 'Please sign in and try again.',
            technical: 'Authentication failed: {reason}'
        });

        this.addMessageTemplate('permission_error', {
            title: 'Permission Denied',
            message: 'You don\'t have permission to perform this action.',
            suggestion: 'Contact your administrator if you think this is a mistake.',
            technical: 'Insufficient permissions: {required}'
        });

        // Network errors
        this.addMessageTemplate('network_error', {
            title: 'Network Problem',
            message: 'We can\'t reach our servers right now.',
            suggestion: 'Check your internet connection and try again.',
            technical: 'Network error: {type} - {details}'
        });

        this.addMessageTemplate('offline_error', {
            title: 'You\'re Offline',
            message: 'This feature requires an internet connection.',
            suggestion: 'Please check your connection and try again.',
            technical: 'Operation requires network connectivity'
        });

        // Agent-specific errors
        this.addMessageTemplate('agent_routing_error', {
            title: 'Processing Error',
            message: 'We couldn\'t understand your request.',
            suggestion: 'Try rephrasing your question or be more specific.',
            technical: 'Agent routing failed: {reason}'
        });

        this.addMessageTemplate('agent_unavailable', {
            title: 'Service Temporarily Unavailable',
            message: 'This service is temporarily unavailable.',
            suggestion: 'Please try again later or contact support.',
            technical: 'Agent {agent} is unavailable: {reason}'
        });

        // Token/usage errors
        this.addMessageTemplate('token_limit_exceeded', {
            title: 'Usage Limit Reached',
            message: 'You\'ve reached your usage limit for today.',
            suggestion: 'Your limit will reset tomorrow, or contact support to increase it.',
            technical: 'Token limit exceeded: {used}/{limit}'
        });

        this.addMessageTemplate('token_tracking_error', {
            title: 'Usage Tracking Issue',
            message: 'We couldn\'t track your usage properly.',
            suggestion: 'Your usage may not be accurately recorded.',
            technical: 'Token tracking failed: {error}'
        });
    }

    /**
     * Setup localization for different languages
     */
    setupLocalization() {
        // Spanish translations
        this.localization.set('es', {
            'Connection Issue': 'Problema de Conexión',
            'We\'re having trouble connecting to our services. Please try again in a moment.': 
                'Tenemos problemas para conectarnos a nuestros servicios. Inténtalo de nuevo en un momento.',
            'Check your internet connection and try again.': 
                'Verifica tu conexión a internet e inténtalo de nuevo.',
            'Request Timeout': 'Tiempo de Espera Agotado',
            'Your request is taking longer than expected.': 
                'Tu solicitud está tardando más de lo esperado.',
            'Please try again. If the problem persists, try refreshing the page.': 
                'Inténtalo de nuevo. Si el problema persiste, intenta actualizar la página.',
            'Invalid Input': 'Entrada Inválida',
            'The information you provided isn\'t in the right format.': 
                'La información que proporcionaste no está en el formato correcto.',
            'Please check your input and try again.': 
                'Verifica tu entrada e inténtalo de nuevo.',
            'System Error': 'Error del Sistema',
            'Something went wrong on our end.': 
                'Algo salió mal de nuestro lado.',
            'Please try again. If the problem continues, contact support.': 
                'Inténtalo de nuevo. Si el problema continúa, contacta soporte.'
        });

        // French translations
        this.localization.set('fr', {
            'Connection Issue': 'Problème de Connexion',
            'We\'re having trouble connecting to our services. Please try again in a moment.': 
                'Nous avons des difficultés à nous connecter à nos services. Veuillez réessayer dans un moment.',
            'Check your internet connection and try again.': 
                'Vérifiez votre connexion internet et réessayez.',
            'Request Timeout': 'Délai d\'Attente Dépassé',
            'Your request is taking longer than expected.': 
                'Votre demande prend plus de temps que prévu.',
            'Invalid Input': 'Entrée Invalide',
            'The information you provided isn\'t in the right format.': 
                'Les informations que vous avez fournies ne sont pas dans le bon format.',
            'System Error': 'Erreur Système',
            'Something went wrong on our end.': 
                'Quelque chose s\'est mal passé de notre côté.'
        });
    }

    /**
     * Add a custom message template
     */
    addMessageTemplate(errorType, template) {
        this.customMessages.set(errorType, template);
    }

    /**
     * Add a context provider for enhanced error messages
     */
    addContextProvider(name, provider) {
        this.contextProviders.set(name, provider);
    }

    /**
     * Generate user-friendly error message
     */
    generateMessage(error, context = {}) {
        try {
            const errorType = this.classifyError(error, context);
            const template = this.getMessageTemplate(errorType);
            const enhancedContext = this.enhanceContext(context, error);
            
            return this.buildMessage(template, enhancedContext, error);
            
        } catch (messageError) {
            this.debug.error('Error generating user message:', messageError);
            return this.getFallbackMessage(error);
        }
    }

    /**
     * Classify error to determine appropriate message template
     */
    classifyError(error, context) {
        // Check for specific error types first
        if (error.name === 'ValidationError') return 'invalid_input';
        if (error.name === 'RateLimitError') return 'api_rate_limit';
        if (error.name === 'TimeoutError') return 'api_timeout';
        if (error.name === 'NetworkError') return 'network_error';
        if (error.name === 'AuthenticationError') return 'auth_error';
        if (error.name === 'PermissionError') return 'permission_error';

        // Check error message content
        const message = error.message.toLowerCase();
        if (message.includes('timeout')) return 'api_timeout';
        if (message.includes('network') || message.includes('connection')) return 'network_error';
        if (message.includes('rate limit')) return 'api_rate_limit';
        if (message.includes('validation') || message.includes('invalid')) return 'invalid_input';
        if (message.includes('missing') || message.includes('required')) return 'missing_input';
        if (message.includes('too long') || message.includes('length')) return 'input_too_long';
        if (message.includes('memory') || message.includes('heap')) return 'memory_error';
        if (message.includes('storage') || message.includes('localStorage')) return 'storage_error';
        if (message.includes('agent') || message.includes('routing')) return 'agent_routing_error';
        if (message.includes('token') || message.includes('usage')) return 'token_tracking_error';
        if (message.includes('offline') || message.includes('navigator')) return 'offline_error';

        // Check context for additional clues
        if (context.operation === 'api_call') return 'api_error';
        if (context.operation === 'agent_routing') return 'agent_routing_error';
        if (context.operation === 'token_tracking') return 'token_tracking_error';

        // Default to system error
        return 'system_error';
    }

    /**
     * Get message template for error type
     */
    getMessageTemplate(errorType) {
        return this.customMessages.get(errorType) || this.customMessages.get('system_error');
    }

    /**
     * Enhance context with additional information
     */
    enhanceContext(context, error) {
        const enhanced = { ...context };

        // Add error details
        enhanced.error = error.message;
        enhanced.errorType = error.name;
        enhanced.timestamp = new Date().toISOString();

        // Add context from providers
        for (const [name, provider] of this.contextProviders.entries()) {
            try {
                enhanced[name] = provider(error, context);
            } catch (providerError) {
                this.debug.warn(`Context provider ${name} failed:`, providerError);
            }
        }

        // Add user-friendly error classification
        enhanced.severity = this.calculateSeverity(error, context);
        enhanced.category = this.categorizeError(error);

        return enhanced;
    }

    /**
     * Build the final user message
     */
    buildMessage(template, context, error) {
        const message = {
            title: this.localize(this.interpolate(template.title, context)),
            message: this.localize(this.interpolate(template.message, context)),
            suggestion: this.localize(this.interpolate(template.suggestion, context)),
            technical: template.technical ? this.interpolate(template.technical, context) : null,
            severity: context.severity,
            category: context.category,
            timestamp: context.timestamp,
            canRetry: this.canRetry(error, context),
            supportInfo: this.getSupportInfo(error, context)
        };

        // Add recovery suggestions if available
        const recovery = this.getRecoverySuggestions(error, context);
        if (recovery.length > 0) {
            message.recovery = recovery;
        }

        return message;
    }

    /**
     * Interpolate variables in message templates
     */
    interpolate(template, context) {
        if (!template) return '';
        
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            return context[key] !== undefined ? context[key] : match;
        });
    }

    /**
     * Localize message text
     */
    localize(text) {
        if (this.locale === 'en') return text;
        
        const translations = this.localization.get(this.locale);
        return translations && translations[text] ? translations[text] : text;
    }

    /**
     * Calculate error severity
     */
    calculateSeverity(error, context) {
        // Critical errors that prevent core functionality
        if (error.name === 'SystemError' || error.message.includes('critical')) {
            return 'critical';
        }
        
        // High severity errors that significantly impact user experience
        if (error.name === 'NetworkError' || error.name === 'AuthenticationError') {
            return 'high';
        }
        
        // Medium severity errors that cause inconvenience
        if (error.name === 'ValidationError' || error.name === 'TimeoutError') {
            return 'medium';
        }
        
        // Low severity errors that are minor issues
        return 'low';
    }

    /**
     * Categorize error for better organization
     */
    categorizeError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('network') || message.includes('connection')) return 'connectivity';
        if (message.includes('validation') || message.includes('input')) return 'input';
        if (message.includes('auth') || message.includes('permission')) return 'security';
        if (message.includes('system') || message.includes('internal')) return 'system';
        if (message.includes('api') || message.includes('service')) return 'service';
        
        return 'general';
    }

    /**
     * Determine if operation can be retried
     */
    canRetry(error, context) {
        const retryableErrors = [
            'TimeoutError', 'NetworkError', 'RateLimitError', 
            'TemporaryError', 'ServiceUnavailableError'
        ];
        
        return retryableErrors.includes(error.name) || 
               error.message.includes('timeout') ||
               error.message.includes('temporary') ||
               context.retryable === true;
    }

    /**
     * Get support information for the error
     */
    getSupportInfo(error, context) {
        const info = {
            errorId: this.generateErrorId(error, context),
            category: this.categorizeError(error),
            severity: context.severity
        };

        // Add specific support suggestions based on error type
        if (error.name === 'NetworkError') {
            info.suggestion = 'Check your internet connection and firewall settings';
        } else if (error.name === 'AuthenticationError') {
            info.suggestion = 'Verify your login credentials or contact your administrator';
        } else if (context.severity === 'critical') {
            info.suggestion = 'Contact technical support immediately';
        }

        return info;
    }

    /**
     * Get recovery suggestions
     */
    getRecoverySuggestions(error, context) {
        const suggestions = [];
        
        if (this.canRetry(error, context)) {
            suggestions.push('Try the operation again');
        }
        
        if (error.name === 'NetworkError') {
            suggestions.push('Check your internet connection');
            suggestions.push('Try refreshing the page');
        }
        
        if (error.name === 'ValidationError') {
            suggestions.push('Check your input format');
            suggestions.push('Ensure all required fields are filled');
        }
        
        if (context.operation === 'agent_routing') {
            suggestions.push('Try rephrasing your question');
            suggestions.push('Be more specific in your request');
        }
        
        return suggestions;
    }

    /**
     * Generate unique error ID for tracking
     */
    generateErrorId(error, context) {
        const timestamp = Date.now();
        const errorHash = this.simpleHash(error.message + error.name);
        return `ERR-${timestamp}-${errorHash}`;
    }

    /**
     * Simple hash function for error IDs
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).substring(0, 6);
    }

    /**
     * Get fallback message when message generation fails
     */
    getFallbackMessage(error) {
        return {
            title: 'An Error Occurred',
            message: 'Something went wrong. Please try again.',
            suggestion: 'If the problem continues, contact support.',
            technical: error.message,
            severity: 'medium',
            category: 'general',
            timestamp: new Date().toISOString(),
            canRetry: true,
            supportInfo: {
                errorId: `FALLBACK-${Date.now()}`,
                category: 'general',
                severity: 'medium'
            }
        };
    }

    /**
     * Set locale for message localization
     */
    setLocale(locale) {
        this.locale = locale;
    }

    /**
     * Add translation for a specific locale
     */
    addTranslation(locale, translations) {
        if (!this.localization.has(locale)) {
            this.localization.set(locale, {});
        }
        
        const existing = this.localization.get(locale);
        Object.assign(existing, translations);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorMessageGenerator;
} else if (typeof window !== 'undefined') {
    window.ErrorMessageGenerator = ErrorMessageGenerator;
}
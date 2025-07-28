/**
 * Edge Case Handler - Comprehensive framework for handling edge cases gracefully
 * Provides input validation, error handling, and fallback behaviors
 */

class EdgeCaseHandler {
    constructor(options = {}) {
        this.debug = options.debug || console;
        this.fallbackBehaviors = new Map();
        this.validationRules = new Map();
        this.errorHandlers = new Map();
        this.setupDefaultHandlers();
    }

    /**
     * Setup default edge case handlers
     */
    setupDefaultHandlers() {
        // Default validation rules
        this.addValidationRule('string', (value) => {
            if (typeof value !== 'string') return { valid: false, error: 'Expected string' };
            if (value.length > 10000) return { valid: false, error: 'String too long' };
            return { valid: true };
        });

        this.addValidationRule('number', (value) => {
            if (typeof value !== 'number') return { valid: false, error: 'Expected number' };
            if (!isFinite(value)) return { valid: false, error: 'Number must be finite' };
            return { valid: true };
        });

        this.addValidationRule('array', (value) => {
            if (!Array.isArray(value)) return { valid: false, error: 'Expected array' };
            if (value.length > 1000) return { valid: false, error: 'Array too large' };
            return { valid: true };
        });

        this.addValidationRule('object', (value) => {
            if (typeof value !== 'object' || value === null) return { valid: false, error: 'Expected object' };
            if (Array.isArray(value)) return { valid: false, error: 'Expected object, not array' };
            return { valid: true };
        });

        // Default fallback behaviors
        this.addFallbackBehavior('empty_string', () => '');
        this.addFallbackBehavior('zero_number', () => 0);
        this.addFallbackBehavior('empty_array', () => []);
        this.addFallbackBehavior('empty_object', () => ({}));
        this.addFallbackBehavior('null_value', () => null);
        this.addFallbackBehavior('default_message', () => 'Operation completed with default values');

        // Default error handlers
        this.addErrorHandler('validation_error', (error, context) => {
            this.debug.warn(`Validation error: ${error.message}`, context);
            return { handled: true, fallback: this.getFallback('null_value') };
        });

        this.addErrorHandler('type_error', (error, context) => {
            this.debug.warn(`Type error: ${error.message}`, context);
            return { handled: true, fallback: this.getFallback('null_value') };
        });

        this.addErrorHandler('range_error', (error, context) => {
            this.debug.warn(`Range error: ${error.message}`, context);
            return { handled: true, fallback: this.getFallback('zero_number') };
        });
    }

    /**
     * Add a validation rule for a specific type
     */
    addValidationRule(type, validator) {
        this.validationRules.set(type, validator);
    }

    /**
     * Add a fallback behavior
     */
    addFallbackBehavior(name, behavior) {
        this.fallbackBehaviors.set(name, behavior);
    }

    /**
     * Add an error handler
     */
    addErrorHandler(type, handler) {
        this.errorHandlers.set(type, handler);
    }

    /**
     * Validate input with comprehensive edge case checking
     */
    validateInput(value, type, options = {}) {
        try {
            // Handle null/undefined
            if (value === null || value === undefined) {
                if (options.allowNull) {
                    return { valid: true, value };
                }
                return { 
                    valid: false, 
                    error: 'Value cannot be null or undefined',
                    fallback: this.getFallback('null_value')
                };
            }

            // Handle empty values
            if (this.isEmpty(value) && !options.allowEmpty) {
                return {
                    valid: false,
                    error: 'Value cannot be empty',
                    fallback: this.getFallback(`empty_${type}`) || this.getFallback('null_value')
                };
            }

            // Type-specific validation
            const validator = this.validationRules.get(type);
            if (validator) {
                const result = validator(value, options);
                if (!result.valid) {
                    return {
                        ...result,
                        fallback: this.getFallback(`empty_${type}`) || this.getFallback('null_value')
                    };
                }
            }

            // Additional edge case checks
            return this.performEdgeCaseChecks(value, type, options);

        } catch (error) {
            return {
                valid: false,
                error: `Validation failed: ${error.message}`,
                fallback: this.getFallback('null_value')
            };
        }
    }

    /**
     * Perform additional edge case checks
     */
    performEdgeCaseChecks(value, type, options) {
        // Check for circular references in objects
        if (type === 'object' && typeof value === 'object') {
            try {
                JSON.stringify(value);
            } catch (error) {
                if (error.message.includes('circular')) {
                    return {
                        valid: false,
                        error: 'Object contains circular references',
                        fallback: this.getFallback('empty_object')
                    };
                }
            }
        }

        // Check for extremely large strings
        if (type === 'string' && typeof value === 'string') {
            if (value.length > (options.maxLength || 10000)) {
                return {
                    valid: false,
                    error: `String exceeds maximum length of ${options.maxLength || 10000}`,
                    fallback: value.substring(0, options.maxLength || 1000)
                };
            }
        }

        // Check for special number values
        if (type === 'number' && typeof value === 'number') {
            if (Number.isNaN(value)) {
                return {
                    valid: false,
                    error: 'Number is NaN',
                    fallback: this.getFallback('zero_number')
                };
            }
            if (value === Infinity || value === -Infinity) {
                return {
                    valid: false,
                    error: 'Number is infinite',
                    fallback: this.getFallback('zero_number')
                };
            }
        }

        return { valid: true, value };
    }

    /**
     * Handle errors gracefully without crashing
     */
    handleError(error, context = {}) {
        try {
            const errorType = this.classifyError(error);
            const handler = this.errorHandlers.get(errorType);
            
            if (handler) {
                const result = handler(error, context);
                if (result.handled) {
                    this.debug.info(`Error handled gracefully: ${error.message}`);
                    return result.fallback;
                }
            }

            // Default error handling
            this.debug.error(`Unhandled error: ${error.message}`, { error, context });
            return this.getFallback('null_value');

        } catch (handlingError) {
            this.debug.error('Error in error handling:', handlingError);
            return null;
        }
    }

    /**
     * Execute operation with edge case protection
     */
    async safeExecute(operation, fallbackValue = null, context = {}) {
        try {
            const result = await operation();
            
            // Validate result
            if (result === undefined) {
                this.debug.warn('Operation returned undefined, using fallback');
                return fallbackValue;
            }
            
            return result;
            
        } catch (error) {
            this.debug.warn(`Operation failed, using fallback: ${error.message}`);
            return this.handleError(error, context) || fallbackValue;
        }
    }

    /**
     * Create fallback behavior for unexpected scenarios
     */
    createFallbackBehavior(scenario, behavior) {
        this.addFallbackBehavior(scenario, behavior);
        
        return (operation, context = {}) => {
            try {
                return operation();
            } catch (error) {
                this.debug.warn(`Fallback triggered for ${scenario}: ${error.message}`);
                return behavior(error, context);
            }
        };
    }

    /**
     * Classify error type for appropriate handling
     */
    classifyError(error) {
        if (error instanceof TypeError) return 'type_error';
        if (error instanceof RangeError) return 'range_error';
        if (error instanceof ReferenceError) return 'reference_error';
        if (error instanceof SyntaxError) return 'syntax_error';
        if (error.name === 'ValidationError') return 'validation_error';
        return 'unknown_error';
    }

    /**
     * Check if value is empty
     */
    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }

    /**
     * Get fallback behavior
     */
    getFallback(name) {
        const behavior = this.fallbackBehaviors.get(name);
        return behavior ? behavior() : null;
    }

    /**
     * Sanitize input to prevent common edge cases
     */
    sanitizeInput(value, type = 'string') {
        try {
            switch (type) {
                case 'string':
                    if (typeof value !== 'string') value = String(value);
                    return value.trim().substring(0, 10000);
                
                case 'number':
                    const num = Number(value);
                    return isFinite(num) ? num : 0;
                
                case 'array':
                    return Array.isArray(value) ? value.slice(0, 1000) : [];
                
                case 'object':
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        // Remove circular references
                        return JSON.parse(JSON.stringify(value));
                    }
                    return {};
                
                default:
                    return value;
            }
        } catch (error) {
            this.debug.warn(`Sanitization failed: ${error.message}`);
            return this.getFallback(`empty_${type}`) || null;
        }
    }

    /**
     * Validate and sanitize multiple inputs
     */
    validateInputs(inputs, schema) {
        const results = {};
        const errors = [];

        for (const [key, config] of Object.entries(schema)) {
            const value = inputs[key];
            const validation = this.validateInput(value, config.type, config.options);
            
            if (validation.valid) {
                results[key] = validation.value;
            } else {
                errors.push({ field: key, error: validation.error });
                results[key] = validation.fallback;
            }
        }

        return {
            valid: errors.length === 0,
            results,
            errors
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EdgeCaseHandler;
} else if (typeof window !== 'undefined') {
    window.EdgeCaseHandler = EdgeCaseHandler;
}
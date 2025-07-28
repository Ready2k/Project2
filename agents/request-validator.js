/**
 * Request Validation Layer for Voice Banking AI Assistant
 * Implements input sanitization and schema validation for all requests
 */

class ValidationError extends Error {
    constructor(message, field, value, rule) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.value = value;
        this.rule = rule;
    }
}

class RequestValidator {
    constructor(options = {}) {
        this.config = {
            // Maximum string lengths
            maxStringLength: options.maxStringLength || 10000,
            maxArrayLength: options.maxArrayLength || 100,
            maxObjectDepth: options.maxObjectDepth || 10,
            
            // Allowed patterns
            allowedPatterns: {
                email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                phone: /^\+?[\d\s\-\(\)]+$/,
                alphanumeric: /^[a-zA-Z0-9\s]+$/,
                uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            },
            
            // Dangerous patterns to reject
            dangerousPatterns: [
                /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi,
                /eval\s*\(/gi,
                /function\s*\(/gi,
                /setTimeout\s*\(/gi,
                /setInterval\s*\(/gi
            ],
            
            // SQL injection patterns
            sqlPatterns: [
                /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
                /(--|\/\*|\*\/|;)/g,
                /(\b(OR|AND)\b.*=.*)/gi
            ]
        };

        // Define validation schemas for different request types
        this.schemas = {
            chatCompletion: {
                messages: { type: 'array', required: true, minLength: 1, maxLength: 50 },
                model: { type: 'string', required: false, maxLength: 100 },
                temperature: { type: 'number', required: false, min: 0, max: 2 },
                max_tokens: { type: 'number', required: false, min: 1, max: 4000 },
                stream: { type: 'boolean', required: false }
            },
            
            agentRouting: {
                inputText: { type: 'string', required: true, minLength: 1, maxLength: 5000 },
                context: { type: 'object', required: false },
                userId: { type: 'string', required: false, pattern: 'alphanumeric' },
                sessionId: { type: 'string', required: false, pattern: 'uuid' }
            },
            
            tokenTracking: {
                type: { type: 'string', required: true, enum: ['input', 'output', 'total'] },
                amount: { type: 'number', required: true, min: 0, max: 1000000 },
                cost: { type: 'number', required: false, min: 0, max: 1000 },
                model: { type: 'string', required: false, maxLength: 100 }
            },
            
            streamingRequest: {
                text: { type: 'string', required: true, minLength: 1, maxLength: 5000 },
                voice: { type: 'string', required: false, maxLength: 50 },
                speed: { type: 'number', required: false, min: 0.25, max: 4.0 },
                format: { type: 'string', required: false, enum: ['mp3', 'opus', 'aac', 'flac'] }
            }
        };
    }

    /**
     * Validate a request against a schema
     * @param {Object} request - The request object to validate
     * @param {string} schemaName - Name of the schema to use
     * @returns {Object} - Sanitized and validated request
     * @throws {ValidationError} - If validation fails
     */
    validate(request, schemaName) {
        if (!request || typeof request !== 'object') {
            throw new ValidationError('Request must be a valid object', 'request', request, 'type');
        }

        const schema = this.schemas[schemaName];
        if (!schema) {
            throw new ValidationError(`Unknown schema: ${schemaName}`, 'schema', schemaName, 'existence');
        }

        // Create sanitized copy
        const sanitized = {};

        // Validate each field in the schema
        for (const [fieldName, rules] of Object.entries(schema)) {
            const value = request[fieldName];
            
            // Check required fields
            if (rules.required && (value === undefined || value === null)) {
                throw new ValidationError(
                    `Required field '${fieldName}' is missing`,
                    fieldName,
                    value,
                    'required'
                );
            }

            // Skip validation for optional undefined fields
            if (value === undefined || value === null) {
                continue;
            }

            // Validate and sanitize the field
            sanitized[fieldName] = this.validateField(fieldName, value, rules);
        }

        // Check for unexpected fields
        for (const fieldName of Object.keys(request)) {
            if (!schema[fieldName]) {
                console.warn(`Unexpected field '${fieldName}' in request for schema '${schemaName}'`);
            }
        }

        return sanitized;
    }

    /**
     * Validate a single field against its rules
     * @param {string} fieldName
     * @param {*} value
     * @param {Object} rules
     * @returns {*} Sanitized value
     */
    validateField(fieldName, value, rules) {
        // Type validation
        if (rules.type) {
            this.validateType(fieldName, value, rules.type);
        }

        // Sanitize based on type
        let sanitized = this.sanitizeValue(value, rules.type);

        // Additional validations based on type
        switch (rules.type) {
            case 'string':
                sanitized = this.validateString(fieldName, sanitized, rules);
                break;
            case 'number':
                sanitized = this.validateNumber(fieldName, sanitized, rules);
                break;
            case 'array':
                sanitized = this.validateArray(fieldName, sanitized, rules);
                break;
            case 'object':
                sanitized = this.validateObject(fieldName, sanitized, rules);
                break;
            case 'boolean':
                sanitized = this.validateBoolean(fieldName, sanitized, rules);
                break;
        }

        return sanitized;
    }

    /**
     * Validate type of value
     */
    validateType(fieldName, value, expectedType) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        
        if (actualType !== expectedType) {
            throw new ValidationError(
                `Field '${fieldName}' must be of type ${expectedType}, got ${actualType}`,
                fieldName,
                value,
                'type'
            );
        }
    }

    /**
     * Sanitize value based on type
     */
    sanitizeValue(value, type) {
        switch (type) {
            case 'string':
                return this.sanitizeString(value);
            case 'number':
                return Number(value);
            case 'boolean':
                return Boolean(value);
            case 'array':
                return Array.isArray(value) ? [...value] : value;
            case 'object':
                return typeof value === 'object' ? { ...value } : value;
            default:
                return value;
        }
    }

    /**
     * Sanitize string input
     */
    sanitizeString(str) {
        if (typeof str !== 'string') return str;
        
        // Remove null bytes
        str = str.replace(/\0/g, '');
        
        // Trim whitespace
        str = str.trim();
        
        // Check for dangerous patterns
        for (const pattern of this.config.dangerousPatterns) {
            if (pattern.test(str)) {
                throw new ValidationError(
                    'String contains potentially dangerous content',
                    'content',
                    str,
                    'security'
                );
            }
        }
        
        // Check for SQL injection patterns
        for (const pattern of this.config.sqlPatterns) {
            if (pattern.test(str)) {
                throw new ValidationError(
                    'String contains potentially malicious SQL patterns',
                    'content',
                    str,
                    'sql_injection'
                );
            }
        }
        
        return str;
    }

    /**
     * Validate string field
     */
    validateString(fieldName, value, rules) {
        // Length validation
        if (rules.minLength && value.length < rules.minLength) {
            throw new ValidationError(
                `Field '${fieldName}' must be at least ${rules.minLength} characters`,
                fieldName,
                value,
                'minLength'
            );
        }
        
        if (rules.maxLength && value.length > rules.maxLength) {
            throw new ValidationError(
                `Field '${fieldName}' must be at most ${rules.maxLength} characters`,
                fieldName,
                value,
                'maxLength'
            );
        }
        
        // Pattern validation
        if (rules.pattern) {
            const pattern = this.config.allowedPatterns[rules.pattern];
            if (pattern && !pattern.test(value)) {
                throw new ValidationError(
                    `Field '${fieldName}' does not match required pattern`,
                    fieldName,
                    value,
                    'pattern'
                );
            }
        }
        
        // Enum validation
        if (rules.enum && !rules.enum.includes(value)) {
            throw new ValidationError(
                `Field '${fieldName}' must be one of: ${rules.enum.join(', ')}`,
                fieldName,
                value,
                'enum'
            );
        }
        
        return value;
    }

    /**
     * Validate number field
     */
    validateNumber(fieldName, value, rules) {
        if (isNaN(value) || !isFinite(value)) {
            throw new ValidationError(
                `Field '${fieldName}' must be a valid number`,
                fieldName,
                value,
                'number'
            );
        }
        
        if (rules.min !== undefined && value < rules.min) {
            throw new ValidationError(
                `Field '${fieldName}' must be at least ${rules.min}`,
                fieldName,
                value,
                'min'
            );
        }
        
        if (rules.max !== undefined && value > rules.max) {
            throw new ValidationError(
                `Field '${fieldName}' must be at most ${rules.max}`,
                fieldName,
                value,
                'max'
            );
        }
        
        return value;
    }

    /**
     * Validate array field
     */
    validateArray(fieldName, value, rules) {
        if (rules.minLength && value.length < rules.minLength) {
            throw new ValidationError(
                `Field '${fieldName}' must have at least ${rules.minLength} items`,
                fieldName,
                value,
                'minLength'
            );
        }
        
        if (rules.maxLength && value.length > rules.maxLength) {
            throw new ValidationError(
                `Field '${fieldName}' must have at most ${rules.maxLength} items`,
                fieldName,
                value,
                'maxLength'
            );
        }
        
        // Sanitize array items
        return value.map((item, index) => {
            if (typeof item === 'string') {
                return this.sanitizeString(item);
            }
            return item;
        });
    }

    /**
     * Validate object field
     */
    validateObject(fieldName, value, rules) {
        // Check object depth to prevent deeply nested attacks
        const depth = this.getObjectDepth(value);
        if (depth > this.config.maxObjectDepth) {
            throw new ValidationError(
                `Field '${fieldName}' exceeds maximum object depth of ${this.config.maxObjectDepth}`,
                fieldName,
                value,
                'depth'
            );
        }
        
        return value;
    }

    /**
     * Validate boolean field
     */
    validateBoolean(fieldName, value, rules) {
        return Boolean(value);
    }

    /**
     * Get object depth
     */
    getObjectDepth(obj, depth = 0) {
        if (depth > this.config.maxObjectDepth) return depth;
        
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            let maxDepth = depth;
            for (const value of Object.values(obj)) {
                if (typeof value === 'object' && value !== null) {
                    maxDepth = Math.max(maxDepth, this.getObjectDepth(value, depth + 1));
                }
            }
            return maxDepth + 1;
        }
        
        return depth;
    }

    /**
     * Add custom validation schema
     */
    addSchema(name, schema) {
        this.schemas[name] = schema;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Quick validation for common patterns
     */
    static validateEmail(email) {
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(email);
    }

    static validatePhone(phone) {
        const pattern = /^\+?[\d\s\-\(\)]+$/;
        return pattern.test(phone);
    }

    static validateUUID(uuid) {
        const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return pattern.test(uuid);
    }
}

// Export classes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RequestValidator, ValidationError };
} else if (typeof window !== 'undefined') {
    window.RequestValidator = RequestValidator;
    window.ValidationError = ValidationError;
}
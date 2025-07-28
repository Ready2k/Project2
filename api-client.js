// Custom error class for API response validation
class ApiResponseError extends Error {
  constructor(message, response = null, context = {}) {
    super(message);
    this.name = 'ApiResponseError';
    this.response = response;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

class OpenAIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.pricing = {
      whisper: 0.006,
      gpt35turbo: { input: 0.0005, output: 0.0015 },
      tts1: 0.015,
      tts1hd: 0.030
    };
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  setTokenTracker(tokenTracker) {
    this.tokenTracker = tokenTracker;
  }

  // Validate input parameters for generateChatCompletion
  validateChatCompletionInput(messages, options = {}) {
    if (!messages || !Array.isArray(messages)) {
      throw new ApiResponseError('Messages must be a non-empty array', null, { messages, options });
    }

    if (messages.length === 0) {
      throw new ApiResponseError('Messages array cannot be empty', null, { messages, options });
    }

    // Validate each message structure
    messages.forEach((message, index) => {
      if (!message || typeof message !== 'object') {
        throw new ApiResponseError(`Message at index ${index} must be an object`, null, { message, index });
      }
      
      if (!message.role || typeof message.role !== 'string') {
        throw new ApiResponseError(`Message at index ${index} must have a valid role`, null, { message, index });
      }
      
      if (!message.content || typeof message.content !== 'string') {
        throw new ApiResponseError(`Message at index ${index} must have valid content`, null, { message, index });
      }
    });

    // Validate options if provided
    if (options.maxTokens !== undefined && (typeof options.maxTokens !== 'number' || options.maxTokens <= 0)) {
      throw new ApiResponseError('maxTokens must be a positive number', null, { options });
    }

    if (options.temperature !== undefined && (typeof options.temperature !== 'number' || options.temperature < 0 || options.temperature > 2)) {
      throw new ApiResponseError('temperature must be a number between 0 and 2', null, { options });
    }

    if (options.top_p !== undefined && (typeof options.top_p !== 'number' || options.top_p < 0 || options.top_p > 1)) {
      throw new ApiResponseError('top_p must be a number between 0 and 1', null, { options });
    }
  }

  // Validate chat completion response structure
  validateChatCompletionResponse(data) {
    if (!data || typeof data !== 'object') {
      throw new ApiResponseError('API response must be a valid object', data);
    }

    if (!data.choices || !Array.isArray(data.choices)) {
      throw new ApiResponseError('API response must contain a choices array', data);
    }

    if (data.choices.length === 0) {
      throw new ApiResponseError('API response choices array cannot be empty', data);
    }

    const choice = data.choices[0];
    if (!choice || typeof choice !== 'object') {
      throw new ApiResponseError('First choice must be a valid object', data);
    }

    if (!choice.message || typeof choice.message !== 'object') {
      throw new ApiResponseError('Choice must contain a valid message object', data);
    }

    if (!choice.message.content || typeof choice.message.content !== 'string') {
      throw new ApiResponseError('Message must contain valid string content', data);
    }

    const text = choice.message.content.trim();
    if (!text) {
      throw new ApiResponseError('Message content cannot be empty after trimming', data);
    }

    return true;
  }

  // Handle API errors with detailed context and retry logic
  async handleApiError(error, operation, context = {}) {
    const errorContext = {
      operation,
      timestamp: new Date().toISOString(),
      apiKey: this.apiKey ? '[REDACTED]' : 'missing',
      ...context
    };

    // Check if error is retryable (network issues, rate limits, server errors)
    const isRetryable = this.isRetryableError(error);
    
    if (error instanceof ApiResponseError) {
      console.error(`[${operation}] API Response Error:`, error.message, errorContext);
      return {
        success: false,
        error: {
          message: error.message,
          type: 'ApiResponseError',
          code: 'INVALID_RESPONSE',
          timestamp: error.timestamp,
          context: errorContext,
          retryable: false
        }
      };
    }

    // Handle HTTP errors
    if (error.message && error.message.includes('Chat completion error:')) {
      const statusMatch = error.message.match(/(\d{3})/);
      const status = statusMatch ? parseInt(statusMatch[1]) : null;
      
      console.error(`[${operation}] HTTP Error:`, error.message, errorContext);
      return {
        success: false,
        error: {
          message: error.message,
          type: 'HttpError',
          code: status ? `HTTP_${status}` : 'HTTP_ERROR',
          timestamp: new Date().toISOString(),
          context: errorContext,
          retryable: isRetryable && status >= 500
        }
      };
    }

    // Handle network/fetch errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error(`[${operation}] Network Error:`, error.message, errorContext);
      return {
        success: false,
        error: {
          message: 'Network connection failed',
          type: 'NetworkError',
          code: 'NETWORK_ERROR',
          timestamp: new Date().toISOString(),
          context: errorContext,
          retryable: true
        }
      };
    }

    // Handle generic errors
    console.error(`[${operation}] Unexpected Error:`, error.message, errorContext);
    return {
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        type: error.constructor.name,
        code: 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
        context: errorContext,
        retryable: isRetryable
      }
    };
  }

  // Determine if an error is retryable
  isRetryableError(error) {
    if (!error || !error.message) return false;
    
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /502/,
      /503/,
      /504/,
      /rate limit/i,
      /too many requests/i
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  // Retry logic with exponential backoff
  async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry if error is not retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.warn(`[retryWithBackoff] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms:`, error.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  convertToISO639(language) {
    // Dummy fallback map
    const map = {
      'en-GB': 'en',
      'en-US': 'en',
      'fr-FR': 'fr',
    };
    return map[language] || language.slice(0, 2);
  }

  async generateChatCompletion(messages, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate input parameters
      this.validateChatCompletionInput(messages, options);

      const {
        maxTokens,
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        stop,
        ...rest
      } = options;
    
      const payload = {
        model: 'gpt-4-0613', // or gpt-3.5-turbo
        messages,
        ...(maxTokens !== undefined && { max_tokens: maxTokens }),
        ...(temperature !== undefined && { temperature }),
        ...(top_p !== undefined && { top_p }),
        ...(frequency_penalty !== undefined && { frequency_penalty }),
        ...(presence_penalty !== undefined && { presence_penalty }),
        ...(stop !== undefined && { stop }),
        ...rest
      };

      // Wrap the API call with retry logic for transient failures
      const result = await this.retryWithBackoff(async () => {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
    
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[generateChatCompletion] API error:', response.status, errorText);
          throw new Error(`Chat completion error: ${response.status} – ${errorText}`);
        }
    
        const data = await response.json();
        console.log('[generateChatCompletion] API success:', data);
    
        // Validate response structure
        this.validateChatCompletionResponse(data);
        
        return data;
      });

      const choice = result.choices[0];
      const text = choice.message.content.trim();
      const processingTime = Date.now() - startTime;
      
      // Track GPT usage if available
      if (this.tokenTracker && result.usage) {
        console.log('Tracking GPT usage:', result.usage.prompt_tokens, 'input,', result.usage.completion_tokens, 'output tokens');
        this.tokenTracker.trackGptUsage(
          result.usage.prompt_tokens || 0, 
          result.usage.completion_tokens || 0
        );
      } else {
        console.warn('Token tracker not available for GPT usage tracking', { 
          hasTracker: !!this.tokenTracker, 
          hasUsage: !!result.usage 
        });
      }
    
      // Return consistent response format with success flag and metadata
      return {
        success: true,
        text,
        usage: result.usage,
        model: result.model,
        choices: result.choices,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: result.id,
          processingTime
        }
      };

    } catch (err) {
      // If it's already an ApiResponseError from validation, re-throw it directly
      if (err instanceof ApiResponseError) {
        throw err;
      }
      
      // Use comprehensive error handling for other errors
      const errorResponse = await this.handleApiError(err, 'generateChatCompletion', {
        messagesCount: messages?.length,
        options,
        processingTime: Date.now() - startTime
      });
      
      // For backward compatibility, throw the error but with enhanced context
      const enhancedError = new Error(errorResponse.error.message);
      enhancedError.context = errorResponse.error.context;
      enhancedError.code = errorResponse.error.code;
      enhancedError.retryable = errorResponse.error.retryable;
      
      throw enhancedError;
    }
  }
  

  async speechToText(audioBlob, { language = 'en' } = {}) {
    const startTime = Date.now();
    
    try {
      // Validate inputs
      if (!audioBlob) {
        throw new Error('Audio blob is required for speech-to-text conversion');
      }
      
      if (!this.apiKey) {
        throw new Error('OpenAI API key is required for speech-to-text conversion');
      }
      
      console.log('Creating FormData for Whisper API...');
      console.log('Audio blob details:', {
        size: audioBlob.size,
        type: audioBlob.type,
        constructor: audioBlob.constructor.name
      });
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-1');
      
      console.log('FormData created successfully');
    
      if (language) {
        const isoLanguage = this.convertToISO639(language);
        console.log('Original language:', language, 'Converted to:', isoLanguage);
        if (isoLanguage) {
          formData.append('language', isoLanguage);
        }
        console.log("Language (sanitized):", isoLanguage);
      }
    
      console.log('Sending request to Whisper API...');
      console.log('Request details:', {
        url: 'https://api.openai.com/v1/audio/transcriptions',
        method: 'POST',
        hasApiKey: !!this.apiKey,
        apiKeyLength: this.apiKey ? this.apiKey.length : 0,
        formDataEntries: Array.from(formData.entries()).map(([key, value]) => ({
          key,
          valueType: typeof value,
          valueSize: value.size || value.length || 'unknown'
        }))
      });
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`
        },
        body: formData
      });
      
      console.log('Fetch completed, response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
    
      if (!response.ok) {
        let errorMessage = `Whisper API error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error && errorData.error.message) {
            errorMessage += ` - ${errorData.error.message}`;
          }
        } catch (parseError) {
          console.warn('Could not parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      console.log('Parsing Whisper API response...');
      const result = await response.json();
      console.log("✅ Whisper API response:", result);

      if (!result || typeof result !== 'object') {
        throw new Error("Whisper API returned invalid response format");
      }

      if (!result.text) {
        throw new Error("Whisper returned no transcription text");
      }

      // Track token usage if available
      if (this.tokenTracker && result.usage) {
        // Whisper API returns usage in seconds, convert to minutes
        const minutes = result.usage.seconds ? result.usage.seconds / 60 : 0.17; // Default to ~10 seconds if not provided
        this.tokenTracker.trackWhisperUsage(minutes);
      }

      return result.text;
      
    } catch (err) {
      const processingTime = Date.now() - startTime;
      console.error('Speech-to-text error:', err);
      
      // Handle different types of errors
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to OpenAI API. Please check your internet connection.');
      }
      
      if (err.message.includes('API key')) {
        throw new Error('Invalid or missing OpenAI API key. Please check your API key configuration.');
      }
      
      if (err.message.includes('401')) {
        throw new Error('Authentication failed: Invalid OpenAI API key.');
      }
      
      if (err.message.includes('429')) {
        throw new Error('Rate limit exceeded: Too many requests to OpenAI API. Please try again later.');
      }
      
      if (err.message.includes('500') || err.message.includes('502') || err.message.includes('503')) {
        throw new Error('OpenAI API server error: Please try again in a few moments.');
      }
      
      // Re-throw the original error if it's already a meaningful error
      if (err.message && !err.message.includes('Type error')) {
        throw err;
      }
      
      // Generic fallback for unknown errors
      throw new Error(`Speech-to-text conversion failed: ${err.message || 'Unknown error occurred'}`);
    }
  }
  async textToSpeech(text, { voice = 'alloy', model = 'tts-1', response_format = 'mp3' } = {}) {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, voice, input: text, response_format })
      });
  
      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `TTS error: ${response.status} – ${errorBody}` };
      }
  
      const audioBlob = await response.blob();
      
      // Track TTS usage if available
      if (this.tokenTracker && text) {
        console.log('Tracking TTS usage:', text.length, 'characters, model:', model);
        this.tokenTracker.trackTtsUsage(text.length, model);
      } else {
        console.warn('Token tracker not available for TTS usage tracking', { 
          hasTracker: !!this.tokenTracker, 
          hasText: !!text 
        });
      }
      
      return { success: true, audioBlob };
    } catch (err) {
      return { success: false, error: err.message || 'Unknown TTS error' };
    }
  }
  
}
window.OpenAIClient = OpenAIClient;
window.ApiResponseError = ApiResponseError;
/**
 * OpenAI API Client
 * Handles all interactions with OpenAI services (Whisper, GPT, TTS)
 */
class OpenAIClient {
    constructor(apiKey, tokenTracker = null) {
        this.apiKey = apiKey;
        this.tokenTracker = tokenTracker;
        
        // Default pricing (can be updated)
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

    /**
     * Convert locale format to ISO-639-1 format for Whisper API
     */
    convertToISO639(language) {
        if (!language) return null;
        
        // Convert locale format (en-US) to ISO-639-1 format (en)
        const languageMap = {
            'en-US': 'en',
            'en-GB': 'en', 
            'en-AU': 'en',
            'en': 'en'
        };
        
        return languageMap[language] || language.split('-')[0];
    }

    /**
     * Convert speech to text using Whisper API
     */
    async speechToText(audioBlob, options = {}) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not set');
        }

        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.wav');
        formData.append('model', options.model || 'whisper-1');
        
        if (options.language) {
            const isoLanguage = this.convertToISO639(options.language);
            console.log('Original language:', options.language, 'Converted to:', isoLanguage);
            if (isoLanguage) {
                formData.append('language', isoLanguage);
            }
        }

        try {
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Whisper API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            
            // Track usage if tracker is available
            if (this.tokenTracker) {
                this.tokenTracker.trackWhisperUsage();
            }
            
            return {
                text: data.text,
                success: true
            };

        } catch (error) {
            console.error('Speech-to-text error:', error);
            return {
                text: '',
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate chat completion using GPT
     */
    async generateChatCompletion(messages, options = {}) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not set');
        }

        const requestBody = {
            model: options.model || 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: options.maxTokens || 200,
            temperature: options.temperature || 0.8
        };

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`GPT API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            
            // Track usage if tracker is available
            if (this.tokenTracker && data.usage) {
                this.tokenTracker.trackGptUsage(
                    data.usage.prompt_tokens, 
                    data.usage.completion_tokens
                );
            }
            
            return {
                content: data.choices[0].message.content,
                usage: data.usage,
                success: true
            };

        } catch (error) {
            console.error('GPT completion error:', error);
            return {
                content: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.",
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Convert text to speech using OpenAI TTS
     */
    async textToSpeech(text, options = {}) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not set');
        }

        const requestBody = {
            model: options.model || 'tts-1',
            input: text,
            voice: options.voice || 'nova',
            speed: options.speed || 1.0
        };

        try {
            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`TTS API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
            }

            const audioBlob = await response.blob();
            
            if (audioBlob.size === 0) {
                throw new Error('Empty audio response from TTS API');
            }

            // Track usage if tracker is available
            if (this.tokenTracker) {
                this.tokenTracker.trackTtsUsage(text.length, requestBody.model);
            }

            return {
                audioBlob: audioBlob,
                success: true
            };

        } catch (error) {
            console.error('TTS error:', error);
            return {
                audioBlob: null,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Test API connection
     */
    async testConnection() {
        try {
            const testResult = await this.generateChatCompletion([
                { role: 'user', content: 'Say "API connection successful"' }
            ], { maxTokens: 10 });
            
            return testResult.success;
        } catch (error) {
            console.error('API connection test failed:', error);
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpenAIClient;
}
// Simple Node.js test for API client enhancements
const fs = require('fs');

// Load the API client code
const apiClientCode = fs.readFileSync('api-client.js', 'utf8');

// Remove window assignments and evaluate the code
const modifiedCode = apiClientCode
  .replace('window.OpenAIClient = OpenAIClient;', 'global.OpenAIClient = OpenAIClient;')
  .replace('window.ApiResponseError = ApiResponseError;', 'global.ApiResponseError = ApiResponseError;');

eval(modifiedCode);

const { OpenAIClient, ApiResponseError } = global;

async function runTests() {
  console.log('🧪 Running API Client Enhancement Tests...\n');
  
  const client = new OpenAIClient('test-key');
  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Input validation - null messages
  totalTests++;
  try {
    await client.generateChatCompletion(null);
    console.log('❌ Test 1 Failed: Should have thrown validation error for null messages');
  } catch (error) {
    if (error instanceof ApiResponseError) {
      console.log('✅ Test 1 Passed: Input validation working for null messages');
      passedTests++;
    } else {
      console.log('❌ Test 1 Failed: Wrong error type:', error.constructor.name);
    }
  }

  // Test 2: Empty messages validation
  totalTests++;
  try {
    await client.generateChatCompletion([]);
    console.log('❌ Test 2 Failed: Should have thrown validation error for empty messages');
  } catch (error) {
    if (error instanceof ApiResponseError) {
      console.log('✅ Test 2 Passed: Empty messages validation working');
      passedTests++;
    } else {
      console.log('❌ Test 2 Failed: Wrong error type:', error.constructor.name);
    }
  }

  // Test 3: Invalid message structure validation
  totalTests++;
  try {
    await client.generateChatCompletion([{ role: 'user' }]); // missing content
    console.log('❌ Test 3 Failed: Should have thrown validation error for invalid message');
  } catch (error) {
    if (error instanceof ApiResponseError) {
      console.log('✅ Test 3 Passed: Message structure validation working');
      passedTests++;
    } else {
      console.log('❌ Test 3 Failed: Wrong error type:', error.constructor.name);
    }
  }

  // Test 4: Options validation
  totalTests++;
  try {
    await client.generateChatCompletion([{ role: 'user', content: 'test' }], { temperature: 5 }); // invalid temperature
    console.log('❌ Test 4 Failed: Should have thrown validation error for invalid temperature');
  } catch (error) {
    if (error instanceof ApiResponseError) {
      console.log('✅ Test 4 Passed: Options validation working');
      passedTests++;
    } else {
      console.log('❌ Test 4 Failed: Wrong error type:', error.constructor.name);
    }
  }

  // Test 5: Response validation - invalid response
  totalTests++;
  try {
    client.validateChatCompletionResponse({});
    console.log('❌ Test 5 Failed: Should have thrown validation error for invalid response');
  } catch (error) {
    if (error instanceof ApiResponseError) {
      console.log('✅ Test 5 Passed: Response validation working');
      passedTests++;
    } else {
      console.log('❌ Test 5 Failed: Wrong error type:', error.constructor.name);
    }
  }

  // Test 6: Valid response validation
  totalTests++;
  try {
    const validResponse = {
      choices: [{
        message: {
          content: 'Hello, world!'
        }
      }]
    };
    const result = client.validateChatCompletionResponse(validResponse);
    if (result === true) {
      console.log('✅ Test 6 Passed: Valid response validation working');
      passedTests++;
    } else {
      console.log('❌ Test 6 Failed: Valid response should return true');
    }
  } catch (error) {
    console.log('❌ Test 6 Failed: Valid response should not throw error:', error.message);
  }

  // Test 7: Error handling method
  totalTests++;
  try {
    const testError = new Error('Test network error');
    const errorResponse = await client.handleApiError(testError, 'testOperation');
    
    if (errorResponse.success === false && errorResponse.error && errorResponse.error.message) {
      console.log('✅ Test 7 Passed: Error handling method working');
      passedTests++;
    } else {
      console.log('❌ Test 7 Failed: Error handling method not returning proper format');
    }
  } catch (error) {
    console.log('❌ Test 7 Failed: Error handling method should not throw:', error.message);
  }

  // Test 8: ApiResponseError class functionality
  totalTests++;
  try {
    const testError = new ApiResponseError('Test message', { test: 'data' }, { context: 'test' });
    if (testError instanceof Error && 
        testError instanceof ApiResponseError && 
        testError.name === 'ApiResponseError' &&
        testError.message === 'Test message' &&
        testError.response.test === 'data' &&
        testError.context.context === 'test' &&
        testError.timestamp) {
      console.log('✅ Test 8 Passed: ApiResponseError class working correctly');
      passedTests++;
    } else {
      console.log('❌ Test 8 Failed: ApiResponseError class not working correctly');
    }
  } catch (error) {
    console.log('❌ Test 8 Failed: ApiResponseError class threw error:', error.message);
  }

  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! API client enhancements are working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the implementation.');
  }
}

runTests().catch(console.error);
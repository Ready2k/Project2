# Streaming Agent Routing Test Suite

This comprehensive test suite validates the streaming agent routing integration functionality as specified in the requirements document. The tests cover all aspects of the streaming agent routing system including core functionality, integration, performance, error handling, and context preservation.

## Test Coverage

### Requirements Validation

The test suite validates the following requirements:

- **Requirements 1.1-1.4**: Agent routing and response generation
- **Requirements 2.1-2.3**: Agent switching and context preservation  
- **Requirements 3.1-3.2**: Performance optimization and latency requirements
- **Additional Coverage**: Error handling, fallback mechanisms, and memory management

### Test Suites

#### 1. Unit Tests (`test-streaming-agent-router-unit.js`)
Tests core functionality of the StreamingAgentRouter class:
- Constructor validation and initialization
- Message routing accuracy and latency
- Agent switching logic and validation
- Session instruction generation
- Voice configuration management
- Error handling and recovery
- Performance metrics tracking
- Context preservation mechanisms

#### 2. Integration Tests (`test-streaming-agent-integration.js`)
Tests end-to-end streaming agent routing flow:
- Complete routing pipeline from transcription to response
- Agent switching with context preservation
- WebSocket integration and session updates
- Voice transition handling
- Fallback mechanism integration
- Performance under realistic load conditions

#### 3. Performance Tests (`test-streaming-agent-performance.js`)
Tests routing latency, throughput, and optimization:
- Routing latency benchmarks (<100ms average, <200ms max)
- Throughput capacity testing (>10 requests/second)
- Concurrent routing performance
- Memory usage and leak detection
- Agent switching performance
- Response processing optimization
- Stress testing under high load

#### 4. Error Scenario Tests (`test-streaming-agent-error-scenarios.js`)
Tests fallback mechanisms and error recovery:
- Routing timeout handling and fallback
- Agent processing error recovery
- WebSocket connection error handling
- Session update failure recovery
- Circuit breaker behavior
- Network error resilience
- Cascading error recovery

#### 5. Context Switching Tests (`test-streaming-agent-context-switching.js`)
Tests agent switching with context preservation:
- Basic agent switching scenarios
- Context preservation across multiple switches
- Complex conversation flow handling
- Rapid agent switching performance
- Context inheritance chains
- Agent-specific context handling
- Memory management for long conversations
- Concurrent context switching
- Context validation and integrity

## Running the Tests

### Browser-Based Testing

Open `test-streaming-agent-routing-comprehensive.html` in a web browser:

```bash
# Navigate to the test directory
cd Project2/test

# Open in browser (example with Chrome)
open test-streaming-agent-routing-comprehensive.html
```

The browser interface provides:
- Individual test suite execution
- Real-time progress tracking
- Detailed test results with pass/fail status
- Console output capture
- Performance metrics visualization
- Requirements coverage mapping

### Command Line Testing

Run tests from the command line using Node.js:

```bash
# Run all test suites
node test/run-streaming-agent-tests.js

# Run with verbose output
node test/run-streaming-agent-tests.js --verbose

# Run specific test suite
node test/run-streaming-agent-tests.js --suite unit

# Show help
node test/run-streaming-agent-tests.js --help
```

Available test suites for individual execution:
- `unit`: Unit tests for core functionality
- `integration`: End-to-end integration tests  
- `performance`: Performance and latency tests
- `error`: Error handling and fallback tests
- `context`: Context switching and preservation tests

## Test Results Interpretation

### Success Criteria

Tests are considered successful when:
- **Unit Tests**: All core functionality works correctly
- **Integration Tests**: End-to-end flow completes successfully
- **Performance Tests**: Latency <200ms, throughput >10 req/s, success rate >90%
- **Error Tests**: All error scenarios handled gracefully with recovery
- **Context Tests**: Context preserved accurately across agent switches

### Performance Benchmarks

The following performance benchmarks must be met:
- **Routing Latency**: Average <100ms, Maximum <200ms
- **Agent Switching**: Average <75ms, Maximum <150ms  
- **Response Processing**: Average <50ms, Maximum <75ms
- **WebSocket Formatting**: Average <15ms, Maximum <25ms
- **Throughput**: Minimum 10 requests/second
- **Concurrent Requests**: 90% success rate with 20 concurrent requests
- **Memory Usage**: <1MB per operation, no memory leaks
- **Error Recovery**: <1 second recovery time after errors

### Error Handling Validation

Error scenarios must be handled gracefully:
- **Routing Timeouts**: Fallback to standard streaming
- **Agent Failures**: Graceful degradation with error logging
- **WebSocket Errors**: Automatic reconnection with state preservation
- **Session Update Failures**: Retry with exponential backoff
- **Circuit Breaker**: Temporary disable with automatic recovery

## Test Dependencies

### Required Components

The tests require the following components to be available:
- `StreamingAgentRouter` class
- `StreamingResponseHandler` class  
- `StreamingAgentMiddleware` class
- Mock agent router and streaming manager
- WebSocket mock implementation

### Mock Components

The test suite includes comprehensive mocks for:
- AgentRouter with realistic routing logic
- StreamingManager with WebSocket simulation
- Agent instances with processing capabilities
- Debug logging system
- Performance monitoring utilities

## Debugging Test Failures

### Common Issues

1. **Timing Issues**: Tests may fail due to timing sensitivity
   - Solution: Adjust timeout values in test configuration
   - Check system performance and load

2. **Mock Configuration**: Incorrect mock setup
   - Solution: Verify mock components match expected interfaces
   - Check mock data and response formats

3. **Memory Constraints**: Tests failing under memory pressure
   - Solution: Run tests individually or increase system memory
   - Check for memory leaks in test cleanup

4. **WebSocket Simulation**: WebSocket mock not behaving correctly
   - Solution: Verify WebSocket state transitions
   - Check message format and timing

### Debug Output

Enable detailed debug output by:
- Using browser developer tools console
- Running with `--verbose` flag in command line
- Checking individual test suite console outputs
- Reviewing performance metrics and timing data

## Extending the Test Suite

### Adding New Tests

To add new test cases:

1. **Unit Tests**: Add methods to `StreamingAgentRouterUnitTests` class
2. **Integration Tests**: Add scenarios to `StreamingAgentIntegrationTests` class
3. **Performance Tests**: Add benchmarks to `StreamingAgentPerformanceTests` class
4. **Error Tests**: Add error scenarios to `StreamingAgentErrorScenarioTests` class
5. **Context Tests**: Add switching scenarios to `StreamingAgentContextSwitchingTests` class

### Test Structure

Follow this structure for new tests:

```javascript
async testNewFeature() {
    console.log('Testing new feature...');
    
    try {
        // Test setup
        const testData = setupTestData();
        
        // Execute test
        const result = await executeTest(testData);
        
        // Validate results
        this.assertTrue(result.success, 'Test should succeed');
        this.assertEqual(result.value, expectedValue, 'Values should match');
        
        // Record success
        this.addResult('new_feature_test', true, 'New feature working correctly');
        
    } catch (error) {
        // Record failure
        this.addResult('new_feature_test', false, `New feature failed: ${error.message}`);
    }
}
```

### Mock Updates

When adding new functionality, update mocks accordingly:
- Add new methods to mock classes
- Update response formats and data structures
- Ensure mock behavior matches real component behavior
- Add appropriate error simulation capabilities

## Continuous Integration

### Automated Testing

The test suite can be integrated into CI/CD pipelines:

```bash
# Example CI script
#!/bin/bash
set -e

echo "Running Streaming Agent Routing Tests..."
cd Project2/test

# Run tests and capture exit code
node run-streaming-agent-tests.js
TEST_RESULT=$?

# Generate test report
if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ All tests passed"
else
    echo "❌ Tests failed with exit code $TEST_RESULT"
    exit $TEST_RESULT
fi
```

### Test Reporting

Test results can be exported in various formats:
- Console output with detailed results
- JSON format for automated processing
- HTML reports for human review
- Performance metrics for monitoring

## Maintenance

### Regular Updates

Keep the test suite updated by:
- Adding tests for new features
- Updating performance benchmarks
- Reviewing and updating mock components
- Validating test coverage against requirements
- Monitoring test execution performance

### Performance Monitoring

Monitor test suite performance:
- Track test execution time trends
- Identify slow or flaky tests
- Optimize test data and setup
- Review resource usage patterns

The test suite is designed to be comprehensive, maintainable, and reliable for validating the streaming agent routing integration functionality.
# Contract Testing Guide

## Overview

Contract testing is a technique for ensuring that API providers and consumers agree on the API structure. In the Cloud Gallery project, we use Pact to implement consumer-driven contract testing, which helps prevent integration issues and ensures API compatibility.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Consumer      │    │   Pact Files    │    │   Provider      │
│   (Client)       │───▶│   (Contracts)   │◀───│   (Server)       │
│                 │    │                 │    │                 │
│ - Defines       │    │ - JSON files    │    │ - Verifies      │
│   expectations  │    │ - Request/      │    │   implementation│
│ - Generates     │    │   response      │    │ - Validates     │
│   contracts     │    │   pairs         │    │   compliance    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Concepts

### Consumer-Driven Contracts
- **Consumer**: The client application that makes API requests
- **Provider**: The server application that fulfills API requests  
- **Contract**: A JSON file documenting expected request/response pairs
- **Verification**: Process of ensuring provider implementation matches contracts

### Benefits
1. **Early Detection**: Catch integration issues during development
2. **Documentation**: Contracts serve as living API documentation
3. **Safety**: Prevent breaking changes from reaching production
4. **Speed**: Faster than end-to-end tests
5. **Reliability**: Ensures API stability across versions

## Project Structure

```
tests/contracts/
├── README.md                    # This guide
├── consumer/                    # Consumer contract tests
│   ├── auth.test.ts            # Authentication contracts
│   ├── photos.test.ts          # Photo CRUD contracts
│   ├── albums.test.ts          # Album management contracts
│   └── search.test.ts          # Search API contracts
├── provider/                    # Provider verification tests
│   ├── auth.test.ts            # Auth endpoint verification
│   ├── photos.test.ts          # Photo endpoint verification
│   ├── albums.test.ts          # Album endpoint verification
│   └── search.test.ts          # Search endpoint verification
├── pacts/                       # Generated contract files
├── utils/                       # Contract testing utilities
│   ├── setup.ts                # Pact configuration
│   └── helpers.ts              # Common test helpers
└── broker-config.json           # Pact broker configuration
```

## Running Tests

### Consumer Tests (Generate Contracts)
```bash
# Run all consumer tests
npm run test:contracts:consumer

# Run specific consumer test
npm run test:contracts:consumer -- auth.test.ts
```

### Provider Tests (Verify Implementation)
```bash
# Run all provider verification tests
npm run test:contracts:provider

# Run specific provider test
npm run test:contracts:provider -- auth.test.ts
```

### All Contract Tests
```bash
# Run both consumer and provider tests
npm run test:contracts
```

## Writing Consumer Tests

### Basic Structure
```typescript
import { PactV4 } from '@pact-foundation/pact';
import { like, eachLike } from '@pact-foundation/pact-core';
import { createPact, authHeaders } from '../utils/setup';

describe('API Consumer Tests', () => {
  const provider = createPact();

  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  it('should define API expectations', async () => {
    await provider
      .given('provider state')  // Setup condition
      .uponReceiving('request description')
      .withRequest({
        method: 'GET',
        path: '/api/photos',
        headers: authHeaders,
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          photos: eachLike(createPhotoMatcher()),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/photos`, {
        method: 'GET',
        headers: authHeaders,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.photos).toBeDefined();
    });
  });
});
```

### Using Matchers
```typescript
import { like, term, eachLike } from '@pact-foundation/pact-core';
import { matchers } from '../utils/setup';

// Flexible matching for dynamic values
const photoMatcher = like({
  id: matchers.uuid,           // UUID pattern matching
  createdAt: matchers.timestamp, // ISO timestamp pattern
  filename: like('photo.jpg'), // Exact string matching
  tags: eachLike('vacation'),  // Array matching
  size: like(1024000),         // Number matching
});

// Regex matching for specific patterns
const emailMatcher = term({
  matcher: 'regex',
  regex: '^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$',
  generate: 'user@example.com'
});
```

## Provider States

Provider states setup the conditions for contract verification:

```typescript
stateHandlers: {
  'user has photos': async () => {
    // Create test photos in database
    await createTestPhotos();
  },
  'photo does not exist': async () => {
    // Ensure no test photo exists
    await cleanupTestPhotos();
  },
}
```

### Common Provider States
- `user is authenticated` - User session is active
- `user has photos` - User has test photos in database
- `photo exists and belongs to user` - Specific photo is available
- `photo does not exist` - Photo ID is invalid
- `user has no photos` - Empty photo collection

## Writing Provider Tests

### Basic Verification
```typescript
import { Verifier } from '@pact-foundation/pact';
import path from 'path';

describe('API Provider Verification', () => {
  const verifier = new Verifier({
    providerBaseUrl: 'http://localhost:5000',
    provider: 'cloud-gallery-api',
    providerStatesSetupUrl: 'http://localhost:5000/api/pact/states',
    stateHandlers: {
      // State handlers here
    },
  });

  it('should validate contracts', async () => {
    const pactFiles = [
      path.resolve(__dirname, '..', 'pacts', '*.json')
    ];

    const output = await verifier.verifyPacts({
      pactFiles,
      timeout: 30000,
    });

    expect(output).toBeDefined();
  });
});
```

## CI/CD Integration

### GitHub Actions Workflow
The project includes a dedicated contract testing workflow (`.github/workflows/contract-testing.yml`) that:

1. **Consumer Tests**: Generate contracts from client expectations
2. **Provider Tests**: Verify server implementation against contracts
3. **Breach Detection**: Identify contract violations
4. **Reporting**: Generate compliance reports and PR comments

### Workflow Steps
```yaml
jobs:
  consumer-tests:
    # Generate contract files
    runs-on: ubuntu-latest
    steps:
      - name: Run consumer contract tests
        run: npm run test:contracts:consumer

  provider-tests:
    # Verify implementation
    needs: consumer-tests
    services:
      postgres: # Database for testing
    steps:
      - name: Run provider contract verification
        run: npm run test:contracts:provider

  contract-breach-detection:
    # Analyze results
    needs: [consumer-tests, provider-tests]
    steps:
      - name: Analyze contract breaches
        run: # Check for violations
```

## Best Practices

### Consumer Tests
1. **Test Real Scenarios**: Focus on actual client usage patterns
2. **Use Flexible Matchers**: Avoid exact matching for dynamic values
3. **Cover All Endpoints**: Test all critical API interactions
4. **Document States**: Clear provider state descriptions
5. **Keep Tests Focused**: One interaction per test

### Provider Tests
1. **Real Implementation**: Test against actual API, not mocks
2. **Proper State Setup**: Ensure database is in correct state
3. **Error Scenarios**: Test both success and failure cases
4. **Authentication**: Handle auth requirements properly
5. **Timeout Management**: Allow adequate time for verification

### General Guidelines
1. **Version Control**: Commit contracts to track changes
2. **Regular Updates**: Update contracts when API changes
3. **Team Communication**: Share contract changes with team
4. **Documentation**: Keep contract documentation current
5. **Monitoring**: Track contract test results in CI/CD

## Troubleshooting

### Common Issues

#### Consumer Test Failures
- **Problem**: Mock server not responding
- **Solution**: Check pact configuration and port availability
- **Problem**: Matcher validation failing
- **Solution**: Verify matcher patterns match actual data

#### Provider Test Failures
- **Problem**: Server not starting
- **Solution**: Check environment variables and database setup
- **Problem**: State setup failing
- **Solution**: Verify state handler implementation
- **Problem**: Contract mismatches
- **Solution**: Compare expected vs actual API responses

#### CI/CD Issues
- **Problem**: Artifact download failures
- **Solution**: Check artifact names and paths
- **Problem**: Database connection issues
- **Solution**: Verify service configuration and timing

### Debugging Tips

1. **Enable Verbose Logging**: Set logLevel to 'DEBUG'
2. **Check Pact Files**: Review generated contract JSON
3. **Test Locally**: Run tests locally before CI
4. **Isolate Issues**: Test individual endpoints
5. **Review State Setup**: Ensure proper test data

## Advanced Features

### Pact Broker Integration
For team collaboration, configure a Pact Broker:

```json
{
  "brokerUrl": "https://pact-broker.example.com",
  "consumer": "cloud-gallery-client",
  "provider": "cloud-gallery-api",
  "publish": true,
  "tags": ["dev", "production"]
}
```

### Custom Matchers
Create domain-specific matchers:

```typescript
export const photoMatchers = {
  photoId: {
    matcher: 'regex',
    regex: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    generate: '123e4567-e89b-12d3-a456-426614174000'
  },
  imageUrl: {
    matcher: 'regex',
    regex: '^https?://.*/photo/.*\\.(jpg|jpeg|png|gif)$',
    generate: 'https://example.com/photo/test.jpg'
  }
};
```

### Contract Versioning
Manage contract versions for different API releases:

```typescript
// In consumer test
const provider = pact({
  consumer: 'cloud-gallery-client-v2',
  provider: 'cloud-gallery-api-v2',
  // ... other config
});
```

## Integration with Existing Tests

Contract testing complements other testing types:

- **Unit Tests**: Test individual functions
- **Integration Tests**: Test component interactions
- **Contract Tests**: Test API agreements
- **E2E Tests**: Test complete user flows

### Test Pyramid
```
    E2E Tests (Few)
       ▲
       │
  Contract Tests (Some)
       ▲
       │
Integration Tests (Many)
       ▲
       │
   Unit Tests (Most)
```

## Metrics and Reporting

### Key Metrics
- **Contract Coverage**: Percentage of endpoints with contracts
- **Verification Success Rate**: Provider test pass rate
- **Breach Detection**: Number of contract violations
- **Test Execution Time**: Performance of contract tests

### Reporting
- **PR Comments**: Automated contract status reports
- **CI/CD Dashboards**: Visual contract compliance metrics
- **Artifact Storage**: Historical contract test results
- **Trend Analysis**: Contract compliance over time

## Security Considerations

### Test Data Security
- **No Production Data**: Use test databases only
- **Sensitive Data**: Avoid real passwords/tokens in tests
- **Environment Isolation**: Separate test environments
- **Data Cleanup**: Remove test data after tests

### API Security
- **Authentication**: Test both authenticated and unauthenticated scenarios
- **Authorization**: Verify proper access controls
- **Rate Limiting**: Test rate limiting behavior
- **Input Validation**: Verify input sanitization

## Future Enhancements

### Planned Improvements
1. **Pact Broker Integration**: Centralized contract management
2. **Automated Publishing**: Auto-publish contracts on success
3. **Enhanced Reporting**: More detailed contract analytics
4. **Performance Testing**: Contract-based performance tests
5. **Multi-Provider Support**: Test against multiple API versions

### Integration Opportunities
- **API Documentation**: Generate docs from contracts
- **SDK Generation**: Auto-generate client libraries
- **Monitoring**: Contract compliance monitoring
- **Alerting**: Automated breach notifications

## Resources

### Documentation
- [Pact Documentation](https://docs.pact.io/)
- [Pact JavaScript Guide](https://docs.pact.io/implementation_guides/javascript/)
- [Contract Testing Best Practices](https://docs.pact.io/best_practices/)

### Tools
- [Pact Broker](https://pactflow.io/)
- [Pact CLI](https://github.com/pact-foundation/pact-cli)
- [Contract Testing VS Code Extension](https://marketplace.visualstudio.com/)

### Community
- [Pact Slack](https://slack.pact.io/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/pact)
- [GitHub Discussions](https://github.com/pact-foundation/pact-js/discussions)

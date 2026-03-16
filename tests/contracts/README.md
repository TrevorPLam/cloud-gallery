# API Contract Testing

This directory contains consumer-driven contract tests for the Cloud Gallery API endpoints using Pact.

## Structure

```
tests/contracts/
├── README.md                    # This file
├── consumer/                    # Consumer contract tests
│   ├── auth.test.ts            # Authentication endpoint contracts
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

## How It Works

1. **Consumer Tests**: Define expectations for API responses from the client perspective
2. **Contract Generation**: Tests generate JSON pact files documenting the expected interactions
3. **Provider Verification**: Server tests verify that the actual API implementation satisfies all consumer contracts
4. **CI/CD Integration**: Automated verification in GitHub Actions workflow

## Running Tests

```bash
# Run consumer tests (generates contracts)
npm run test:contracts:consumer

# Run provider verification tests
npm run test:contracts:provider

# Run all contract tests
npm run test:contracts
```

## Key Concepts

- **Consumer**: The client application that makes API requests
- **Provider**: The server application that fulfills API requests
- **Contract**: A JSON file documenting expected request/response pairs
- **Verification**: Process of ensuring provider implementation matches contracts

## Best Practices

1. Test only what the consumer actually uses (consumer-driven)
2. Use flexible matching for dynamic values (timestamps, IDs)
3. Keep contracts focused on business-critical endpoints
4. Verify contracts against real implementation, not mocks
5. Publish contracts to broker for team sharing

# Zero-Knowledge Key Management System

This document describes the comprehensive zero-knowledge key management system implemented for Cloud Gallery, providing secure encryption with biometric authentication support.

## Overview

The key management system implements a hierarchical key derivation architecture using Argon2id for password-based key derivation, with support for biometric authentication and secure storage integration.

## Architecture

### Key Hierarchy

```
Master Key (derived from password using Argon2id)
├── File Keys (for individual file encryption)
├── Sharing Keys (for shared album encryption)
└── Device Keys (for device-specific operations)
```

### Components

1. **Key Derivation** (`key-derivation.ts`)
   - Argon2id implementation with OWASP parameters
   - Context-specific key derivation
   - Secure salt generation

2. **Key Hierarchy** (`key-hierarchy.ts`)
   - Hierarchical key management
   - Key caching with expiration
   - Key rotation support

3. **Biometric Authentication** (`biometric-auth.ts`)
   - Face ID, Touch ID, and fingerprint support
   - Fallback authentication methods
   - Rate limiting and security

4. **Auth Context Integration** (`AuthContext.tsx`)
   - React context for key management
   - Biometric enable/disable
   - Password change functionality

## Security Features

### Argon2id Parameters

Following OWASP recommendations for mobile devices:

```typescript
export const ARGON2ID_CONFIG = {
  memoryCost: 64 * 1024, // 64MB
  timeCost: 3, // 3 iterations
  parallelism: 2, // 2 threads
  hashLength: 32, // 256-bit key
  type: "argon2id",
};
```

### Key Separation

- **Domain Separation**: Different contexts for each key type
- **Cryptographic Isolation**: Keys cannot be derived from each other
- **Unique Salts**: Per-key random salt generation

### Biometric Protection

- **Platform Integration**: iOS Secure Enclave, Android KeyStore
- **Fallback Support**: Device passcode when biometrics unavailable
- **Rate Limiting**: Prevent brute force attacks

## Usage Examples

### Basic Key Setup

```typescript
import { useAuth } from '@/contexts/AuthContext';

function SetupEncryption() {
  const { setupEncryption } = useAuth();

  const handleSetup = async () => {
    const success = await setupEncryption("user-password-123", true);
    if (success) {
      console.log("Encryption setup completed with biometrics");
    }
  };

  return <button onPress={handleSetup}>Setup Encryption</button>;
}
```

### File Encryption

```typescript
import { getFileEncryptionKey } from '@/lib/key-hierarchy';

async function encryptFile(fileId: string, fileData: Uint8Array) {
  const fileKey = await getFileEncryptionKey(fileId);
  const encryptedData = encryptData(fileData, fileKey);
  return encryptedData;
}
```

### Biometric Authentication

```typescript
import { useAuth } from '@/contexts/AuthContext';

function BiometricLogin() {
  const { authenticateWithBiometrics } = useAuth();

  const handleBiometricAuth = async () => {
    const result = await authenticateWithBiometrics("Access encrypted photos");
    if (result.success) {
      console.log("Biometric authentication successful");
    }
  };

  return <button onPress={handleBiometricAuth}>Login with Biometrics</button>;
}
```

## API Reference

### Key Derivation Functions

#### `deriveMasterKey(password, salt?)`
Derives the master key from user password using Argon2id.

**Parameters:**
- `password: string` - User password
- `salt?: string` - Optional 16-byte salt (generated if not provided)

**Returns:** `Promise<DerivedKey>` - Master key derivation result

#### `deriveSpecializedKey(masterKey, keyType, identifier?)`
Derives specialized keys from master key with context separation.

**Parameters:**
- `masterKey: string` - Hex-encoded master key
- `keyType: KeyType` - Type of key to derive (FILE, SHARING, DEVICE)
- `identifier?: string` - Optional unique identifier

**Returns:** `Promise<DerivedKey>` - Specialized key derivation result

### Key Hierarchy Functions

#### `getFileEncryptionKey(fileId, requireBiometrics?)`
Gets or derives a file-specific encryption key.

**Parameters:**
- `fileId: string` - Unique file identifier
- `requireBiometrics?: boolean` - Whether to require biometric authentication

**Returns:** `Promise<string>` - File encryption key

#### `getSharingEncryptionKey(sharingId, requireBiometrics?)`
Gets or derives a sharing-specific encryption key.

**Parameters:**
- `sharingId: string` - Unique sharing identifier
- `requireBiometrics?: boolean` - Whether to require biometric authentication

**Returns:** `Promise<string>` - Sharing encryption key

### Biometric Authentication Functions

#### `authenticateWithBiometrics(reason?)`
Performs biometric authentication with fallback support.

**Parameters:**
- `reason?: string` - Authentication reason shown to user

**Returns:** `Promise<BiometricAuthResult>` - Authentication result

#### `checkBiometricSupport()`
Checks biometric hardware availability and enrollment status.

**Returns:** `Promise<{available: boolean, enrolled: boolean, types: string[]}>`

### Auth Context Functions

#### `setupEncryption(password, enableBiometrics?)`
Sets up zero-knowledge encryption for the user.

**Parameters:**
- `password: string` - User password for master key derivation
- `enableBiometrics?: boolean` - Whether to enable biometric protection

**Returns:** `Promise<boolean>` - Setup success status

#### `unlockEncryption(password?)`
Unlocks encryption with password or biometrics.

**Parameters:**
- `password?: string` - Optional password for unlock

**Returns:** `Promise<boolean>` - Unlock success status

## Security Considerations

### Threat Model

1. **Password Security**: Argon2id prevents brute force attacks
2. **Key Separation**: Domain separation prevents key cross-derivation
3. **Biometric Protection**: Platform secure element integration
4. **Secure Storage**: Platform keychain/keystore utilization

### Best Practices

1. **Strong Passwords**: Enforce minimum password requirements
2. **Biometric Fallback**: Always provide password fallback
3. **Key Rotation**: Implement periodic key rotation
4. **Secure Cleanup**: Proper memory management for sensitive data

### Compliance

- **GDPR**: User data protection and right to be forgotten
- **HIPAA**: Healthcare data protection requirements
- **SOC 2**: Security and privacy controls

## Performance Considerations

### Key Derivation Performance

- **Argon2id Tuning**: Balanced parameters for mobile devices
- **Caching Strategy**: Intelligent key caching with expiration
- **Async Operations**: Non-blocking key derivation

### Memory Management

- **Secure Wiping**: Memory cleanup for sensitive data
- **Buffer Management**: Efficient buffer allocation
- **Cache Limits**: Prevent memory exhaustion

## Testing

### Unit Tests

Comprehensive test suite covering:
- Key derivation correctness
- Biometric authentication flows
- Error handling scenarios
- Security properties

### Integration Tests

End-to-end testing of:
- Complete key setup flows
- File encryption/decryption
- Biometric authentication
- Key rotation scenarios

### Security Tests

Property-based testing for:
- Key separation guarantees
- Cryptographic properties
- Rate limiting effectiveness
- Memory security

## Troubleshooting

### Common Issues

1. **Biometric Not Available**
   - Check device hardware support
   - Verify biometric enrollment
   - Fallback to password authentication

2. **Key Derivation Failures**
   - Verify password strength
   - Check available memory
   - Review Argon2id parameters

3. **Secure Storage Issues**
   - Check platform keychain access
   - Verify app permissions
   - Review storage configuration

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
// Enable debug mode
import { keyHierarchy } from '@/lib/key-hierarchy';
console.log("Cache stats:", keyHierarchy.getCacheStats());
```

## Migration Guide

### From Previous Encryption

1. **Backup Data**: Ensure data backup before migration
2. **Password Migration**: Securely migrate user passwords
3. **Key Re-derivation**: Re-derive keys with new system
4. **Verification**: Verify data integrity post-migration

### Rollback Plan

1. **Key Backup**: Maintain backup of previous keys
2. **Data Integrity**: Verify data can be decrypted
3. **User Communication**: Inform users of changes
4. **Support Plan**: Provide support for migration issues

## Future Enhancements

### Planned Features

1. **Hardware Security Module (HSM) Integration**
2. **Multi-Device Key Synchronization**
3. **Advanced Biometric Support**
4. **Quantum-Resistant Algorithms**

### Research Areas

1. **Post-Quantum Cryptography**
2. **Zero-Knowledge Proofs**
3. **Secure Multi-Party Computation**
4. **Homomorphic Encryption**

---

*This documentation covers the zero-knowledge key management system implementation. For specific API details, refer to the inline code documentation and TypeScript definitions.*

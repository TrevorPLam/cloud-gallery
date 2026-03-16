// Client-side Search Token implementation for privacy-preserving search
// Generates encrypted search tokens that prevent server query exposure

import { Buffer } from "buffer";
import sodium from "@s77rt/react-native-sodium";
import { 
  SearchToken, 
  SearchTokenType, 
  SearchOperator,
  initializeSSE,
  encryptSearchTerm,
  generateTokenId,
  secureWipeSSE,
  MAX_QUERY_LENGTH
} from "./encrypted-search";

// Token configuration constants
export const TOKEN_VERSION = "1.0.0";
export const TOKEN_EXPIRY_DEFAULT = 3600000; // 1 hour in milliseconds
export const TOKEN_EXPIRY_MAX = 86400000; // 24 hours max
export const TOKEN_CACHE_SIZE = 100; // Cache 100 tokens
export const TOKEN_SIGNATURE_SIZE = 64; // 512-bit signature

// Token validation result
export interface TokenValidationResult {
  isValid: boolean;
  tokenId: string;
  expiresAt: number;
  timeRemaining: number;
  isExpired: boolean;
  error?: string;
}

// Token cache entry
export interface TokenCacheEntry {
  token: SearchToken;
  createdAt: number;
  lastUsed: number;
  useCount: number;
}

// Token manager interface
export interface TokenManager {
  activeTokens: Map<string, TokenCacheEntry>;
  revokedTokens: Set<string>;
  tokenCache: Map<string, SearchToken>;
  sseKey: string;
  defaultExpiry: number;
}

// Search request with token
export interface TokenizedSearchRequest {
  token: SearchToken;
  encryptedQuery: string;
  requestMetadata: {
    userAgent: string;
    timestamp: number;
    requestId: string;
  };
}

// Token verification result
export interface TokenVerificationResult {
  isValid: boolean;
  tokenId: string;
  queryType: SearchTokenType;
  operators?: SearchOperator[];
  decryptedQuery?: string;
  error?: string;
}

/**
 * Initialize token manager
 * @param sseKey - SSE encryption key for token generation
 * @param defaultExpiry - Default token expiry time in milliseconds
 * @returns New token manager
 */
export async function initializeTokenManager(
  sseKey: string,
  defaultExpiry: number = TOKEN_EXPIRY_DEFAULT
): Promise<TokenManager> {
  await initializeSSE();

  return {
    activeTokens: new Map(),
    revokedTokens: new Set(),
    tokenCache: new Map(),
    sseKey,
    defaultExpiry
  };
}

/**
 * Generate search token for exact match query
 * @param manager - Token manager
 * @param query - Plain text search query
 * @param expiry - Optional custom expiry time
 * @returns Search token
 */
export async function generateExactMatchToken(
  manager: TokenManager,
  query: string,
  expiry?: number
): Promise<SearchToken> {
  try {
    // Validate query
    if (!query || query.trim().length === 0) {
      throw new Error("Query cannot be empty");
    }

    if (query.length > MAX_QUERY_LENGTH) {
      throw new Error(`Query exceeds maximum length of ${MAX_QUERY_LENGTH}`);
    }

    // Generate token components
    const tokenId = generateTokenId();
    const now = Date.now();
    const tokenExpiry = expiry || manager.defaultExpiry;
    const expiresAt = now + Math.min(tokenExpiry, TOKEN_EXPIRY_MAX);

    // Encrypt the query
    const encryptedQuery = encryptSearchTerm(query.trim(), manager.sseKey, SearchTokenType.EXACT);

    // Create token
    const token: SearchToken = {
      tokenId,
      encryptedQuery: encryptedQuery.encryptedTerm,
      queryType: SearchTokenType.EXACT,
      timestamp: now,
      expiresAt
    };

    // Cache the token
    cacheToken(manager, token);

    return token;

  } catch (error) {
    console.error("Failed to generate exact match token:", error);
    throw error;
  }
}

/**
 * Generate search token for prefix match query
 * @param manager - Token manager
 * @param prefix - Plain text search prefix
 * @param expiry - Optional custom expiry time
 * @returns Search token
 */
export async function generatePrefixToken(
  manager: TokenManager,
  prefix: string,
  expiry?: number
): Promise<SearchToken> {
  try {
    // Validate prefix
    if (!prefix || prefix.trim().length === 0) {
      throw new Error("Prefix cannot be empty");
    }

    if (prefix.length > MAX_QUERY_LENGTH) {
      throw new Error(`Prefix exceeds maximum length of ${MAX_QUERY_LENGTH}`);
    }

    // Generate token components
    const tokenId = generateTokenId();
    const now = Date.now();
    const tokenExpiry = expiry || manager.defaultExpiry;
    const expiresAt = now + Math.min(tokenExpiry, TOKEN_EXPIRY_MAX);

    // Encrypt the prefix with prefix token type
    const encryptedPrefix = encryptSearchTerm(prefix.trim() + "*", manager.sseKey, SearchTokenType.PREFIX);

    // Create token
    const token: SearchToken = {
      tokenId,
      encryptedQuery: encryptedPrefix.encryptedTerm,
      queryType: SearchTokenType.PREFIX,
      timestamp: now,
      expiresAt
    };

    // Cache the token
    cacheToken(manager, token);

    return token;

  } catch (error) {
    console.error("Failed to generate prefix token:", error);
    throw error;
  }
}

/**
 * Generate search token for boolean query
 * @param manager - Token manager
 * @param terms - List of search terms
 * @param operators - List of boolean operators
 * @param expiry - Optional custom expiry time
 * @returns Search token
 */
export async function generateBooleanToken(
  manager: TokenManager,
  terms: string[],
  operators: SearchOperator[],
  expiry?: number
): Promise<SearchToken> {
  try {
    // Validate inputs
    if (!terms || terms.length === 0) {
      throw new Error("At least one term is required for boolean search");
    }

    if (terms.length > 10) {
      throw new Error("Maximum 10 terms allowed for boolean search");
    }

    if (!operators || operators.length !== terms.length - 1) {
      throw new Error("Number of operators must be one less than number of terms");
    }

    // Validate each term
    for (const term of terms) {
      if (!term || term.trim().length === 0) {
        throw new Error("All terms must be non-empty");
      }
      if (term.length > MAX_QUERY_LENGTH) {
        throw new Error(`Term exceeds maximum length of ${MAX_QUERY_LENGTH}`);
      }
    }

    // Generate token components
    const tokenId = generateTokenId();
    const now = Date.now();
    const tokenExpiry = expiry || manager.defaultExpiry;
    const expiresAt = now + Math.min(tokenExpiry, TOKEN_EXPIRY_MAX);

    // Create boolean query string
    const booleanQuery = constructBooleanQuery(terms, operators);

    // Encrypt the boolean query
    const encryptedQuery = encryptSearchTerm(booleanQuery, manager.sseKey, SearchTokenType.BOOLEAN);

    // Create token
    const token: SearchToken = {
      tokenId,
      encryptedQuery: encryptedQuery.encryptedTerm,
      queryType: SearchTokenType.BOOLEAN,
      operators,
      timestamp: now,
      expiresAt
    };

    // Cache the token
    cacheToken(manager, token);

    return token;

  } catch (error) {
    console.error("Failed to generate boolean token:", error);
    throw error;
  }
}

/**
 * Construct boolean query string from terms and operators
 * @param terms - List of search terms
 * @param operators - List of boolean operators
 * @returns Boolean query string
 */
function constructBooleanQuery(terms: string[], operators: SearchOperator[]): string {
  try {
    let query = terms[0].trim();
    
    for (let i = 0; i < operators.length; i++) {
      const operator = operators[i];
      const term = terms[i + 1].trim();
      
      switch (operator) {
        case SearchOperator.AND:
          query += ` AND ${term}`;
          break;
        case SearchOperator.OR:
          query += ` OR ${term}`;
          break;
        case SearchOperator.NOT:
          query += ` NOT ${term}`;
          break;
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }
    }

    return query;

  } catch (error) {
    console.error("Failed to construct boolean query:", error);
    throw error;
  }
}

/**
 * Cache token in manager
 * @param manager - Token manager
 * @param token - Token to cache
 */
function cacheToken(manager: TokenManager, token: SearchToken): void {
  try {
    // Remove oldest tokens if cache is full
    if (manager.activeTokens.size >= TOKEN_CACHE_SIZE) {
      const oldestToken = Array.from(manager.activeTokens.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      
      if (oldestToken) {
        manager.activeTokens.delete(oldestToken[0]);
      }
    }

    // Add token to cache
    const cacheEntry: TokenCacheEntry = {
      token,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      useCount: 1
    };

    manager.activeTokens.set(token.tokenId, cacheEntry);

  } catch (error) {
    console.error("Failed to cache token:", error);
    throw error;
  }
}

/**
 * Validate token
 * @param manager - Token manager
 * @param tokenId - Token ID to validate
 * @returns Token validation result
 */
export function validateToken(manager: TokenManager, tokenId: string): TokenValidationResult {
  try {
    // Check if token is revoked
    if (manager.revokedTokens.has(tokenId)) {
      return {
        isValid: false,
        tokenId,
        expiresAt: 0,
        timeRemaining: 0,
        isExpired: true,
        error: "Token has been revoked"
      };
    }

    // Check if token exists in cache
    const cacheEntry = manager.activeTokens.get(tokenId);
    if (!cacheEntry) {
      return {
        isValid: false,
        tokenId,
        expiresAt: 0,
        timeRemaining: 0,
        isExpired: true,
        error: "Token not found"
      };
    }

    const token = cacheEntry.token;
    const now = Date.now();
    const timeRemaining = token.expiresAt - now;
    const isExpired = timeRemaining <= 0;

    return {
      isValid: !isExpired,
      tokenId,
      expiresAt: token.expiresAt,
      timeRemaining: Math.max(0, timeRemaining),
      isExpired
    };

  } catch (error) {
    console.error("Token validation failed:", error);
    return {
      isValid: false,
      tokenId,
      expiresAt: 0,
      timeRemaining: 0,
      isExpired: true,
      error: "Validation error"
    };
  }
}

/**
 * Revoke token
 * @param manager - Token manager
 * @param tokenId - Token ID to revoke
 */
export function revokeToken(manager: TokenManager, tokenId: string): void {
  try {
    // Remove from active tokens
    manager.activeTokens.delete(tokenId);
    
    // Add to revoked tokens
    manager.revokedTokens.add(tokenId);
    
    // Remove from cache
    manager.tokenCache.delete(tokenId);

    console.log(`Token ${tokenId} has been revoked`);

  } catch (error) {
    console.error("Failed to revoke token:", error);
    throw error;
  }
}

/**
 * Create tokenized search request
 * @param manager - Token manager
 * @param token - Search token
 * @param requestMetadata - Additional request metadata
 * @returns Tokenized search request
 */
export function createTokenizedRequest(
  manager: TokenManager,
  token: SearchToken,
  requestMetadata?: Partial<TokenizedSearchRequest["requestMetadata"]>
): TokenizedSearchRequest {
  try {
    // Validate token
    const validation = validateToken(manager, token.tokenId);
    if (!validation.isValid) {
      throw new Error(`Invalid token: ${validation.error}`);
    }

    // Update token usage
    const cacheEntry = manager.activeTokens.get(token.tokenId);
    if (cacheEntry) {
      cacheEntry.lastUsed = Date.now();
      cacheEntry.useCount++;
    }

    // Create request
    const tokenizedRequest: TokenizedSearchRequest = {
      token,
      encryptedQuery: token.encryptedQuery,
      requestMetadata: {
        userAgent: requestMetadata?.userAgent || "CloudGallery/1.0",
        timestamp: requestMetadata?.timestamp || Date.now(),
        requestId: requestMetadata?.requestId || generateTokenId()
      }
    };

    return tokenizedRequest;

  } catch (error) {
    console.error("Failed to create tokenized request:", error);
    throw error;
  }
}

/**
 * Verify tokenized search request (server-side)
 * @param request - Tokenized search request
 * @param sseKey - SSE key for verification
 * @returns Token verification result
 */
export async function verifyTokenizedRequest(
  request: TokenizedSearchRequest,
  sseKey: string
): Promise<TokenVerificationResult> {
  try {
    const { token, encryptedQuery } = request;
    const now = Date.now();

    // Check token expiry
    if (now > token.expiresAt) {
      return {
        isValid: false,
        tokenId: token.tokenId,
        queryType: token.queryType,
        error: "Token has expired"
      };
    }

    // Verify token integrity (simplified - in production, use digital signatures)
    const expectedQuery = token.encryptedQuery;
    if (encryptedQuery !== expectedQuery) {
      return {
        isValid: false,
        tokenId: token.tokenId,
        queryType: token.queryType,
        error: "Token integrity verification failed"
      };
    }

    // Decrypt query for processing (server-side)
    // Note: In a zero-knowledge system, the server would work with encrypted data only
    // This is for demonstration purposes
    let decryptedQuery: string | undefined;
    try {
      // This would normally be done client-side only
      // decryptedQuery = decryptSearchTerm(token.encryptedQuery, sseKey);
    } catch (error) {
      // Decryption failed - continue with encrypted processing
    }

    return {
      isValid: true,
      tokenId: token.tokenId,
      queryType: token.queryType,
      operators: token.operators,
      decryptedQuery
    };

  } catch (error) {
    console.error("Tokenized request verification failed:", error);
    return {
      isValid: false,
      tokenId: request.token.tokenId,
      queryType: request.token.queryType,
      error: "Verification error"
    };
  }
}

/**
 * Clean up expired tokens
 * @param manager - Token manager
 * @returns Number of tokens cleaned up
 */
export function cleanupExpiredTokens(manager: TokenManager): number {
  try {
    const now = Date.now();
    let cleanedCount = 0;

    // Remove expired tokens from active tokens
    for (const [tokenId, cacheEntry] of manager.activeTokens.entries()) {
      if (now > cacheEntry.token.expiresAt) {
        manager.activeTokens.delete(tokenId);
        cleanedCount++;
      }
    }

    // Clean up old revoked tokens (older than 24 hours)
    const revokedArray = Array.from(manager.revokedTokens);
    for (const tokenId of revokedArray) {
      // In a real implementation, we'd track when tokens were revoked
      // For now, we'll keep revoked tokens indefinitely
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired tokens`);
    }

    return cleanedCount;

  } catch (error) {
    console.error("Token cleanup failed:", error);
    return 0;
  }
}

/**
 * Get token manager statistics
 * @param manager - Token manager
 * @returns Token manager statistics
 */
export function getTokenManagerStats(manager: TokenManager): {
  activeTokens: number;
  revokedTokens: number;
  cachedTokens: number;
  averageUseCount: number;
  oldestTokenAge: number;
  newestTokenAge: number;
} {
  try {
    const now = Date.now();
    const activeTokens = manager.activeTokens.size;
    const revokedTokens = manager.revokedTokens.size;
    const cachedTokens = manager.tokenCache.size;

    // Calculate average use count
    let totalUseCount = 0;
    let oldestTokenAge = 0;
    let newestTokenAge = Infinity;

    for (const cacheEntry of manager.activeTokens.values()) {
      totalUseCount += cacheEntry.useCount;
      
      const tokenAge = now - cacheEntry.createdAt;
      oldestTokenAge = Math.max(oldestTokenAge, tokenAge);
      newestTokenAge = Math.min(newestTokenAge, tokenAge);
    }

    const averageUseCount = activeTokens > 0 ? totalUseCount / activeTokens : 0;

    return {
      activeTokens,
      revokedTokens,
      cachedTokens,
      averageUseCount,
      oldestTokenAge,
      newestTokenAge: newestTokenAge === Infinity ? 0 : newestTokenAge
    };

  } catch (error) {
    console.error("Failed to get token manager stats:", error);
    throw error;
  }
}

/**
 * Export token manager state for persistence
 * @param manager - Token manager to export
 * @returns Serialized token manager state
 */
export function exportTokenManager(manager: TokenManager): string {
  try {
    const exported = {
      activeTokens: Array.from(manager.activeTokens.entries()),
      revokedTokens: Array.from(manager.revokedTokens),
      tokenCache: Array.from(manager.tokenCache.entries()),
      defaultExpiry: manager.defaultExpiry
      // Note: sseKey is not exported for security reasons
    };

    return JSON.stringify(exported);
  } catch (error) {
    console.error("Failed to export token manager:", error);
    throw error;
  }
}

/**
 * Import token manager state
 * @param serializedData - Serialized token manager state
 * @param sseKey - SSE encryption key
 * @returns Imported token manager
 */
export function importTokenManager(serializedData: string, sseKey: string): TokenManager {
  try {
    const parsed = JSON.parse(serializedData);

    const manager: TokenManager = {
      activeTokens: new Map(parsed.activeTokens),
      revokedTokens: new Set(parsed.revokedTokens),
      tokenCache: new Map(parsed.tokenCache),
      sseKey,
      defaultExpiry: parsed.defaultExpiry || TOKEN_EXPIRY_DEFAULT
    };

    // Clean up expired tokens on import
    cleanupExpiredTokens(manager);

    return manager;

  } catch (error) {
    console.error("Failed to import token manager:", error);
    throw error;
  }
}

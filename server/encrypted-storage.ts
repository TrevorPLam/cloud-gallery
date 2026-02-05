// AI-META-BEGIN
// AI-META: Field-level encrypted user persistence helpers on top of Postgres
// OWNERSHIP: server/security
// ENTRYPOINTS: imported by auth/account services needing encrypted storage
// DEPENDENCIES: drizzle-orm/postgres-js, ../shared/schema, ./db-encryption
// DANGER: Incorrect encryption/decryption can corrupt or expose sensitive user data
// CHANGE-SAFETY: Keep encrypted field list and return shapes stable for callers
// TESTS: server/db-encryption.test.ts, npm run check:types
// AI-META-END

// Encrypted storage layer for Cloud Gallery
// Provides database operations with field-level encryption

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../shared/schema";
import {
  encryptField,
  decryptField,
  encryptSensitiveFields,
  decryptSensitiveFields,
  validateEncryptionConfig,
} from "./db-encryption";

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString);
const db = drizzle(client);

// Sensitive fields that should be encrypted
const SENSITIVE_USER_FIELDS = ["password"] as const;

/**
 * Validate encryption configuration on startup
 */
const encryptionValidation = validateEncryptionConfig();
if (!encryptionValidation.isValid) {
  console.warn("Database encryption configuration warnings:", encryptionValidation.warnings);
}

/**
 * Create a new user with encrypted sensitive fields
 */
export async function createEncryptedUser(userData: {
  username: string;
  password: string;
}) {
  try {
    // Encrypt sensitive fields before insertion
    const encryptedData = encryptSensitiveFields(userData, SENSITIVE_USER_FIELDS);
    
    const [user] = await db.insert(users).values(encryptedData).returning();
    
    // Decrypt sensitive fields for response
    return decryptSensitiveFields(user, SENSITIVE_USER_FIELDS);
  } catch (error) {
    console.error("Error creating encrypted user:", error);
    throw error;
  }
}

/**
 * Get user by username with decrypted sensitive fields
 */
export async function getEncryptedUserByUsername(username: string) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where((users) => users.username.eq(username))
      .limit(1);
    
    if (!user) return null;
    
    // Decrypt sensitive fields for response
    return decryptSensitiveFields(user, SENSITIVE_USER_FIELDS);
  } catch (error) {
    console.error("Error getting encrypted user:", error);
    throw error;
  }
}

/**
 * Get user by ID with decrypted sensitive fields
 */
export async function getEncryptedUserById(id: string) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where((users) => users.id.eq(id))
      .limit(1);
    
    if (!user) return null;
    
    // Decrypt sensitive fields for response
    return decryptSensitiveFields(user, SENSITIVE_USER_FIELDS);
  } catch (error) {
    console.error("Error getting encrypted user by ID:", error);
    throw error;
  }
}

/**
 * Update user with encryption for sensitive fields
 */
export async function updateEncryptedUser(
  id: string,
  updateData: Partial<{
    username: string;
    password: string;
  }>
) {
  try {
    // Encrypt sensitive fields before update
    const encryptedData = encryptSensitiveFields(updateData, SENSITIVE_USER_FIELDS);
    
    const [user] = await db
      .update(users)
      .set(encryptedData)
      .where((users) => users.id.eq(id))
      .returning();
    
    // Decrypt sensitive fields for response
    return decryptSensitiveFields(user, SENSITIVE_USER_FIELDS);
  } catch (error) {
    console.error("Error updating encrypted user:", error);
    throw error;
  }
}

/**
 * Delete user by ID
 */
export async function deleteEncryptedUser(id: string) {
  try {
    const [user] = await db
      .delete(users)
      .where((users) => users.id.eq(id))
      .returning();
    
    return user;
  } catch (error) {
    console.error("Error deleting encrypted user:", error);
    throw error;
  }
}

/**
 * Migrate existing unencrypted data to encrypted format
 * This should be run once when enabling encryption
 */
export async function migrateToEncryption() {
  try {
    console.log("Starting migration to encrypted storage...");
    
    // Get all users
    const allUsers = await db.select().from(users);
    
    let migratedCount = 0;
    
    for (const user of allUsers) {
      // Check if password is already encrypted
      if (user.password && !user.password.startsWith("{")) {
        // Encrypt the password
        const encryptedPassword = encryptField(user.password);
        
        await db
          .update(users)
          .set({ password: encryptedPassword })
          .where((users) => users.id.eq(user.id));
        
        migratedCount++;
      }
    }
    
    console.log(`Migration completed. Encrypted ${migratedCount} user records.`);
    return migratedCount;
  } catch (error) {
    console.error("Error during encryption migration:", error);
    throw error;
  }
}

/**
 * Verify encryption is working correctly
 */
export async function verifyEncryption() {
  try {
    // Create a test user
    const testUserData = {
      username: "encryption-test-" + Date.now(),
      password: "test-password-123",
    };
    
    // Create user with encryption
    const createdUser = await createEncryptedUser(testUserData);
    
    // Verify password is encrypted in database
    const rawUser = await db
      .select()
      .from(users)
      .where((users) => users.id.eq(createdUser.id))
      .limit(1);
    
    const isPasswordEncrypted = rawUser[0]?.password?.startsWith("{") || false;
    
    // Clean up test user
    await deleteEncryptedUser(createdUser.id);
    
    return {
      success: true,
      passwordEncrypted: isPasswordEncrypted,
      decryptedPasswordMatches: createdUser.password === testUserData.password,
    };
  } catch (error) {
    console.error("Error verifying encryption:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Export the database instance for direct queries if needed
export { db };

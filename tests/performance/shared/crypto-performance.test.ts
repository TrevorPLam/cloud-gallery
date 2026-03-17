/**
 * Cryptographic operations performance benchmarks
 * Tests hashing, encryption, and security-related operations
 */

import { bench, describe } from "vitest";
import {
  PerformanceAssertions,
  measureBatchPerformance,
} from "../utils/benchmark-helpers";
import { sharedThresholds } from "../utils/thresholds";

// Mock cryptographic operations
class MockCryptoService {
  // Simulate Argon2 password hashing
  async hashPassword(
    password: string,
    options: {
      iterations?: number;
      memorySize?: number;
      parallelism?: number;
    } = {},
  ): Promise<string> {
    const startTime = performance.now();
    const { iterations = 3, memorySize = 65536, parallelism = 2 } = options;

    // Simulate Argon2 computation time based on parameters
    const baseTime = 50; // Base computation time in ms
    const iterationFactor = iterations / 3;
    const memoryFactor = Math.log2(memorySize / 65536) + 1;
    const parallelismFactor = 2 / parallelism;

    const estimatedTime =
      baseTime * iterationFactor * memoryFactor * parallelismFactor;
    await new Promise((resolve) => setTimeout(resolve, estimatedTime));

    // Generate mock hash
    const hash = `$argon2id$v=19$m=${memorySize},t=${iterations},p=${parallelism}$${Buffer.from("salt").toString("base64")}${Buffer.from(password).toString("base64")}`;

    return {
      hash,
      duration: performance.now() - startTime,
      iterations,
      memorySize,
      parallelism,
    } as any;
  }

  // Simulate password verification
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const startTime = performance.now();

    // Extract parameters from hash (simplified)
    const params = hash.match(/\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d)/);
    if (!params) {
      throw new Error("Invalid hash format");
    }

    const [, memorySize, iterations, parallelism] = params.map(Number);

    // Simulate verification time (slightly faster than hashing)
    const baseTime = 40;
    const iterationFactor = iterations / 3;
    const memoryFactor = Math.log2(memorySize / 65536) + 1;
    const parallelismFactor = 2 / parallelism;

    const estimatedTime =
      baseTime * iterationFactor * memoryFactor * parallelismFactor * 0.8;
    await new Promise((resolve) => setTimeout(resolve, estimatedTime));

    // Simulate password verification (always true for mock)
    const isValid = password.length > 0;

    return {
      isValid,
      duration: performance.now() - startTime,
    } as any;
  }

  // Simulate AES-256-GCM encryption
  async encrypt(
    data: string,
    key: string,
  ): Promise<{
    ciphertext: string;
    iv: string;
    tag: string;
  }> {
    const startTime = performance.now();

    // Simulate encryption overhead
    const dataSize = data.length;
    const estimatedTime = Math.max(10, dataSize / 10000); // 10ms base + data size factor
    await new Promise((resolve) => setTimeout(resolve, estimatedTime));

    // Generate mock encrypted data
    const iv = Buffer.from("iv123456789012345").toString("base64");
    const tag = Buffer.from("tag123456789012").toString("base64");
    const ciphertext = Buffer.from(data).toString("base64");

    return {
      ciphertext,
      iv,
      tag,
      duration: performance.now() - startTime,
    } as any;
  }

  // Simulate AES-256-GCM decryption
  async decrypt(
    encryptedData: {
      ciphertext: string;
      iv: string;
      tag: string;
    },
    key: string,
  ): Promise<string> {
    const startTime = performance.now();

    // Simulate decryption overhead
    const dataSize = Buffer.from(encryptedData.ciphertext, "base64").length;
    const estimatedTime = Math.max(8, dataSize / 12000); // Slightly faster than encryption
    await new Promise((resolve) => setTimeout(resolve, estimatedTime));

    // Simulate decryption
    const plaintext = Buffer.from(
      encryptedData.ciphertext,
      "base64",
    ).toString();

    return {
      plaintext,
      duration: performance.now() - startTime,
    } as any;
  }

  // Simulate HMAC calculation
  async calculateHMAC(data: string, secret: string): Promise<string> {
    const startTime = performance.now();

    // Simulate HMAC calculation
    const dataSize = data.length;
    const estimatedTime = Math.max(5, dataSize / 50000);
    await new Promise((resolve) => setTimeout(resolve, estimatedTime));

    // Generate mock HMAC
    const hmac = Buffer.from(`${data}:${secret}`).toString("base64");

    return {
      hmac,
      duration: performance.now() - startTime,
    } as any;
  }

  // Simulate key derivation
  async deriveKey(
    password: string,
    salt: string,
    iterations: number = 100000,
  ): Promise<string> {
    const startTime = performance.now();

    // Simulate PBKDF2 computation
    const estimatedTime = Math.max(20, iterations / 5000);
    await new Promise((resolve) => setTimeout(resolve, estimatedTime));

    // Generate mock derived key
    const key = Buffer.from(`${password}:${salt}:${iterations}`).toString(
      "base64",
    );

    return {
      key,
      duration: performance.now() - startTime,
      iterations,
    } as any;
  }

  // Simulate random token generation
  async generateToken(length: number = 32): Promise<string> {
    const startTime = performance.now();

    // Simulate secure random generation
    const estimatedTime = Math.max(2, length / 100);
    await new Promise((resolve) => setTimeout(resolve, estimatedTime));

    // Generate mock token
    const token = Buffer.from(length.toString())
      .toString("base64")
      .slice(0, length);

    return {
      token,
      duration: performance.now() - startTime,
      length,
    } as any;
  }
}

describe("Cryptographic Operations Performance Tests", () => {
  const cryptoService = new MockCryptoService();

  describe("Password Hashing Performance", () => {
    bench("hash password (default parameters)", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.hashPassword("test_password_123"),
        sharedThresholds.crypto.hash.maxTime,
        "Password hashing should complete within threshold",
      );
    });

    bench("hash password (high security)", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () =>
          cryptoService.hashPassword("test_password_123", {
            iterations: 4,
            memorySize: 131072, // 128MB
            parallelism: 1,
          }),
        sharedThresholds.crypto.hash.maxTime * 2,
        "High security password hashing should complete within threshold",
      );
    });

    bench("hash password (fast)", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () =>
          cryptoService.hashPassword("test_password_123", {
            iterations: 2,
            memorySize: 32768, // 32MB
            parallelism: 4,
          }),
        sharedThresholds.crypto.hash.maxTime * 0.5,
        "Fast password hashing should complete within threshold",
      );
    });

    bench("verify password", async () => {
      const hashResult = await cryptoService.hashPassword("test_password_123");
      await PerformanceAssertions.assertTimeThreshold(
        () =>
          cryptoService.verifyPassword("test_password_123", hashResult.hash),
        sharedThresholds.crypto.hash.maxTime * 0.8,
        "Password verification should complete within threshold",
      );
    });

    bench("batch password hashing 10 passwords", async () => {
      const passwords = Array.from({ length: 10 }, (_, i) => `password_${i}`);

      const { totalTime, avgTime, throughput } = await measureBatchPerformance(
        passwords,
        (password) => cryptoService.hashPassword(password),
        { batchSize: 10, iterations: 1 },
      );

      console.log(
        `Batch password hashing: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(2)}ms avg, ${throughput.toFixed(2)} ops/sec`,
      );
    });
  });

  describe("Encryption/Decryption Performance", () => {
    const smallData = "Small test data string";
    const mediumData = "M".repeat(1024 * 10); // 10KB
    const largeData = "L".repeat(1024 * 1024); // 1MB

    bench("encrypt small data", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.encrypt(smallData, "test_key_123456"),
        sharedThresholds.crypto.encrypt.maxTime,
        "Encrypt small data should complete within threshold",
      );
    });

    bench("encrypt medium data", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.encrypt(mediumData, "test_key_123456"),
        sharedThresholds.crypto.encrypt.maxTime * 2,
        "Encrypt medium data should complete within threshold",
      );
    });

    bench("encrypt large data", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.encrypt(largeData, "test_key_123456"),
        sharedThresholds.crypto.encrypt.maxTime * 10,
        "Encrypt large data should complete within threshold",
      );
    });

    bench("decrypt small data", async () => {
      const encrypted = await cryptoService.encrypt(
        smallData,
        "test_key_123456",
      );
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.decrypt(encrypted, "test_key_123456"),
        sharedThresholds.crypto.decrypt.maxTime,
        "Decrypt small data should complete within threshold",
      );
    });

    bench("decrypt medium data", async () => {
      const encrypted = await cryptoService.encrypt(
        mediumData,
        "test_key_123456",
      );
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.decrypt(encrypted, "test_key_123456"),
        sharedThresholds.crypto.decrypt.maxTime * 2,
        "Decrypt medium data should complete within threshold",
      );
    });

    bench("decrypt large data", async () => {
      const encrypted = await cryptoService.encrypt(
        largeData,
        "test_key_123456",
      );
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.decrypt(encrypted, "test_key_123456"),
        sharedThresholds.crypto.decrypt.maxTime * 10,
        "Decrypt large data should complete within threshold",
      );
    });

    bench("encrypt/decrypt roundtrip", async () => {
      const data = mediumData;
      const key = "test_key_123456";

      const encrypted = await cryptoService.encrypt(data, key);
      const decrypted = await cryptoService.decrypt(encrypted, key);

      const totalTime = encrypted.duration + decrypted.duration;

      if (totalTime > sharedThresholds.crypto.encrypt.maxTime * 4) {
        throw new Error(
          `Encrypt/decrypt roundtrip too slow: ${totalTime.toFixed(2)}ms`,
        );
      }

      console.log(`Encrypt/decrypt roundtrip: ${totalTime.toFixed(2)}ms`);
    });
  });

  describe("HMAC Performance", () => {
    bench("calculate HMAC small data", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.calculateHMAC("small data", "secret_key"),
        10, // 10ms max for HMAC
        "HMAC calculation should complete within threshold",
      );
    });

    bench("calculate HMAC medium data", async () => {
      const data = "M".repeat(1024 * 5); // 5KB
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.calculateHMAC(data, "secret_key"),
        20, // 20ms max for medium data
        "HMAC calculation should complete within threshold",
      );
    });

    bench("calculate HMAC large data", async () => {
      const data = "L".repeat(1024 * 100); // 100KB
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.calculateHMAC(data, "secret_key"),
        50, // 50ms max for large data
        "HMAC calculation should complete within threshold",
      );
    });

    bench("batch HMAC calculation 50 items", async () => {
      const items = Array.from({ length: 50 }, (_, i) => `data_item_${i}`);

      const { totalTime, throughput } = await measureBatchPerformance(
        items,
        (item) => cryptoService.calculateHMAC(item, "secret_key"),
        { batchSize: 50, iterations: 1 },
      );

      console.log(
        `Batch HMAC calculation: ${totalTime.toFixed(2)}ms total, ${throughput.toFixed(2)} ops/sec`,
      );
    });
  });

  describe("Key Derivation Performance", () => {
    bench("derive key (default iterations)", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.deriveKey("password", "salt", 100000),
        40, // 40ms max for key derivation
        "Key derivation should complete within threshold",
      );
    });

    bench("derive key (high iterations)", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.deriveKey("password", "salt", 500000),
        200, // 200ms max for high iterations
        "High iteration key derivation should complete within threshold",
      );
    });

    bench("derive key (low iterations)", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.deriveKey("password", "salt", 50000),
        20, // 20ms max for low iterations
        "Low iteration key derivation should complete within threshold",
      );
    });
  });

  describe("Token Generation Performance", () => {
    bench("generate short token (16 bytes)", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.generateToken(16),
        5, // 5ms max for short token
        "Short token generation should complete within threshold",
      );
    });

    bench("generate medium token (32 bytes)", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.generateToken(32),
        10, // 10ms max for medium token
        "Medium token generation should complete within threshold",
      );
    });

    bench("generate long token (64 bytes)", async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => cryptoService.generateToken(64),
        20, // 20ms max for long token
        "Long token generation should complete within threshold",
      );
    });

    bench("batch token generation 100 tokens", async () => {
      const { totalTime, throughput } = await measureBatchPerformance(
        Array.from({ length: 100 }, () => 32),
        (length) => cryptoService.generateToken(length),
        { batchSize: 100, iterations: 1 },
      );

      console.log(
        `Batch token generation: ${totalTime.toFixed(2)}ms total, ${throughput.toFixed(2)} tokens/sec`,
      );
    });
  });

  describe("Memory Usage Tests", () => {
    bench("memory usage during encryption", async () => {
      const data = "M".repeat(1024 * 1024); // 1MB

      const { memoryDelta } = await PerformanceAssertions.assertMemoryThreshold(
        () => cryptoService.encrypt(data, "test_key_123456"),
        10 * 1024 * 1024, // 10MB max for 1MB encryption
        "Encryption should not exceed memory threshold",
      );

      console.log(
        `Encryption memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`,
      );
    });

    bench("memory usage during password hashing", async () => {
      const { memoryDelta } = await PerformanceAssertions.assertMemoryThreshold(
        () =>
          cryptoService.hashPassword("test_password_123", {
            iterations: 4,
            memorySize: 131072, // 128MB
          }),
        150 * 1024 * 1024, // 150MB max for high security hashing
        "Password hashing should not exceed memory threshold",
      );

      console.log(
        `Password hashing memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`,
      );
    });
  });

  describe("Security Performance Trade-offs", () => {
    bench("compare hashing parameters", async () => {
      const password = "test_password_123";
      const configurations = [
        { iterations: 2, memorySize: 32768, parallelism: 4, name: "fast" },
        { iterations: 3, memorySize: 65536, parallelism: 2, name: "default" },
        { iterations: 4, memorySize: 131072, parallelism: 1, name: "secure" },
      ];

      const results = [];

      for (const config of configurations) {
        const result = await cryptoService.hashPassword(password, config);
        results.push({
          name: config.name,
          duration: result.duration,
          iterations: result.iterations,
          memorySize: result.memorySize,
          parallelism: result.parallelism,
        });
      }

      console.log("Hashing performance comparison:");
      results.forEach((r) => {
        console.log(
          `  ${r.name}: ${r.duration.toFixed(2)}ms (m=${r.memorySize}, t=${r.iterations}, p=${r.parallelism})`,
        );
      });

      // Verify that more secure configurations take longer
      const fastTime = results.find((r) => r.name === "fast")?.duration || 0;
      const secureTime =
        results.find((r) => r.name === "secure")?.duration || 0;

      if (secureTime <= fastTime) {
        throw new Error("Secure hashing should be slower than fast hashing");
      }
    });

    bench("encryption throughput vs data size", async () => {
      const dataSizes = [1024, 10240, 102400, 1024000]; // 1KB, 10KB, 100KB, 1MB
      const results = [];

      for (const size of dataSizes) {
        const data = "D".repeat(size);
        const result = await cryptoService.encrypt(data, "test_key_123456");

        results.push({
          size,
          duration: result.duration,
          throughput: size / (result.duration / 1000), // bytes per second
        });
      }

      console.log("Encryption throughput by data size:");
      results.forEach((r) => {
        console.log(
          `  ${(r.size / 1024).toFixed(1)}KB: ${r.duration.toFixed(2)}ms, ${(r.throughput / 1024).toFixed(1)}KB/sec`,
        );
      });

      // Verify that throughput remains reasonable
      const avgThroughput =
        results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
      const minThroughput = 1024 * 1024; // 1MB/sec minimum

      if (avgThroughput < minThroughput) {
        throw new Error(
          `Encryption throughput too low: ${(avgThroughput / 1024).toFixed(1)}KB/sec`,
        );
      }
    });
  });
});

// SRP Session Management with Redis
// Provides secure, scalable storage for SRP authentication sessions

import Redis from "ioredis";
import { generateSecureToken } from "./security";

export interface SRPSessionData {
  email: string;
  serverSession: any; // SRPServerSession from tssrp6a
  expiresAt: number;
  createdAt: number;
}

export class SRPSessionManager {
  private redis: Redis;
  private keyPrefix = "srp:session:";
  private defaultTTL = 5 * 60; // 5 minutes

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    // Handle Redis connection errors gracefully
    this.redis.on("error", (error) => {
      console.error("SRP Redis session manager error:", error);
    });

    this.redis.on("connect", () => {
      console.log("SRP Redis session manager connected");
    });
  }

  /**
   * Store SRP session data in Redis with automatic expiration
   */
  async storeSession(sessionData: Omit<SRPSessionData, "createdAt">): Promise<string> {
    const sessionId = generateSecureToken(32);
    const key = this.keyPrefix + sessionId;
    
    const data: SRPSessionData = {
      ...sessionData,
      createdAt: Date.now(),
    };

    try {
      // Store session with TTL
      await this.redis.setex(key, this.defaultTTL, JSON.stringify(data));
      return sessionId;
    } catch (error) {
      console.error("Failed to store SRP session:", error);
      throw new Error("Failed to store authentication session");
    }
  }

  /**
   * Retrieve SRP session data
   */
  async getSession(sessionId: string): Promise<SRPSessionData | null> {
    const key = this.keyPrefix + sessionId;

    try {
      const data = await this.redis.get(key);
      if (!data) {
        return null;
      }

      const sessionData: SRPSessionData = JSON.parse(data);
      
      // Check if session has expired
      if (Date.now() > sessionData.expiresAt) {
        await this.deleteSession(sessionId);
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error("Failed to retrieve SRP session:", error);
      return null;
    }
  }

  /**
   * Delete SRP session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = this.keyPrefix + sessionId;

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error("Failed to delete SRP session:", error);
    }
  }

  /**
   * Clean up expired sessions (Redis handles this automatically with TTL)
   * This method is for manual cleanup if needed
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const pattern = this.keyPrefix + "*";
      const keys = await this.redis.keys(pattern);
      
      let deletedCount = 0;
      const now = Date.now();

      for (const key of keys) {
        try {
          const data = await this.redis.get(key);
          if (data) {
            const sessionData: SRPSessionData = JSON.parse(data);
            if (now > sessionData.expiresAt) {
              await this.redis.del(key);
              deletedCount++;
            }
          }
        } catch (error) {
          // If we can't parse a session, delete it
          await this.redis.del(key);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error("Failed to cleanup expired SRP sessions:", error);
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  }> {
    try {
      const pattern = this.keyPrefix + "*";
      const keys = await this.redis.keys(pattern);
      
      let activeCount = 0;
      let expiredCount = 0;
      const now = Date.now();

      for (const key of keys) {
        try {
          const data = await this.redis.get(key);
          if (data) {
            const sessionData: SRPSessionData = JSON.parse(data);
            if (now <= sessionData.expiresAt) {
              activeCount++;
            } else {
              expiredCount++;
            }
          }
        } catch (error) {
          expiredCount++;
        }
      }

      return {
        totalSessions: keys.length,
        activeSessions: activeCount,
        expiredSessions: expiredCount,
      };
    } catch (error) {
      console.error("Failed to get SRP session stats:", error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
      };
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error("Error closing SRP Redis connection:", error);
    }
  }

  /**
   * Check Redis connection status
   */
  async isConnected(): Promise<boolean> {
    try {
      const status = await this.redis.ping();
      return status === "PONG";
    } catch (error) {
      return false;
    }
  }
}

// Fallback in-memory session manager for development/testing
export class InMemorySRPSessionManager {
  private sessions = new Map<string, SRPSessionData>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired sessions every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 1000);
  }

  async storeSession(sessionData: Omit<SRPSessionData, "createdAt">): Promise<string> {
    const sessionId = generateSecureToken(32);
    
    const data: SRPSessionData = {
      ...sessionData,
      createdAt: Date.now(),
    };

    this.sessions.set(sessionId, data);
    return sessionId;
  }

  async getSession(sessionId: string): Promise<SRPSessionData | null> {
    const sessionData = this.sessions.get(sessionId);
    
    if (!sessionData) {
      return null;
    }

    // Check if session has expired
    if (Date.now() > sessionData.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return sessionData;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    let deletedCount = 0;

    for (const [sessionId, sessionData] of this.sessions.entries()) {
      if (now > sessionData.expiresAt) {
        this.sessions.delete(sessionId);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  }> {
    const now = Date.now();
    let activeCount = 0;
    let expiredCount = 0;

    for (const sessionData of this.sessions.values()) {
      if (now <= sessionData.expiresAt) {
        activeCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeCount,
      expiredSessions: expiredCount,
    };
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }

  async isConnected(): Promise<boolean> {
    return true; // In-memory is always "connected"
  }
}

// Factory function to create appropriate session manager
export function createSRPSessionManager(): SRPSessionManager | InMemorySRPSessionManager {
  // Use Redis in production, in-memory for development/testing
  if (process.env.NODE_ENV === "production" && process.env.REDIS_URL) {
    return new SRPSessionManager();
  } else {
    console.warn("Using in-memory SRP session manager (development mode)");
    return new InMemorySRPSessionManager();
  }
}

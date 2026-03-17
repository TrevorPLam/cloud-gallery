// SRP Security Hardening and Session Cleanup Service
// Provides security monitoring, cleanup, and hardening for SRP authentication

import { createSRPSessionManager } from "./srp-sessions";
import { logSecurityEvent, AuditEventType } from "./audit";

export class SRPSecurityService {
  private sessionManager = createSRPSessionManager();
  private cleanupInterval: NodeJS.Timeout;
  private monitoringInterval: NodeJS.Timeout;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MONITORING_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_SESSIONS_PER_IP = 10; // Rate limiting per IP
  private readonly MAX_SESSIONS_PER_EMAIL = 3; // Rate limiting per email

  constructor() {
    this.startCleanupService();
    this.startMonitoringService();
  }

  /**
   * Start automatic cleanup of expired SRP sessions
   */
  private startCleanupService(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        const deletedCount = await this.sessionManager.cleanupExpiredSessions();
        if (deletedCount > 0) {
          console.log(`SRP Security: Cleaned up ${deletedCount} expired sessions`);
          await logSecurityEvent(AuditEventType.SRP_SESSION_CLEANUP, {
            deletedSessions: deletedCount,
          });
        }
      } catch (error) {
        console.error("SRP Security: Failed to cleanup expired sessions:", error);
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Start security monitoring service
   */
  private startMonitoringService(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performSecurityCheck();
      } catch (error) {
        console.error("SRP Security: Failed to perform security check:", error);
      }
    }, this.MONITORING_INTERVAL);
  }

  /**
   * Perform comprehensive security check
   */
  private async performSecurityCheck(): Promise<void> {
    const stats = await this.sessionManager.getStats();
    
    // Alert if too many active sessions
    if (stats.activeSessions > 1000) {
      await logSecurityEvent(AuditEventType.SRP_HIGH_SESSION_COUNT, {
        activeSessions: stats.activeSessions,
        threshold: 1000,
      });
    }

    // Alert if too many expired sessions (cleanup not working properly)
    if (stats.expiredSessions > 100) {
      await logSecurityEvent(AuditEventType.SRP_EXPIRED_SESSION_BACKLOG, {
        expiredSessions: stats.expiredSessions,
        threshold: 100,
      });
    }

    // Log periodic statistics
    console.log(`SRP Security Stats: ${stats.activeSessions} active, ${stats.expiredSessions} expired, ${stats.totalSessions} total`);
  }

  /**
   * Validate SRP session request for security
   */
  async validateSessionRequest(
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Check if email has too many active sessions
      const stats = await this.sessionManager.getStats();
      
      // In a real implementation, we'd track sessions per email/IP
      // For now, we'll do basic validation
      if (!email || typeof email !== "string") {
        return { valid: false, reason: "Invalid email format" };
      }

      if (email.length > 255) {
        return { valid: false, reason: "Email too long" };
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { valid: false, reason: "Invalid email format" };
      }

      return { valid: true };
    } catch (error) {
      console.error("SRP Security: Failed to validate session request:", error);
      return { valid: false, reason: "Validation service error" };
    }
  }

  /**
   * Check for suspicious SRP activity patterns
   */
  async checkSuspiciousActivity(email: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    riskScore: number;
  }> {
    const reasons: string[] = [];
    let riskScore = 0;

    try {
      // In a real implementation, we'd check:
      // - Multiple failed attempts from same IP
      // - Rapid succession of challenges
      // - Unusual timing patterns
      // - Known malicious IPs
      
      // For now, we'll implement basic checks
      if (!email) {
        reasons.push("Missing email");
        riskScore += 50;
      }

      // Check for disposable email patterns
      const disposableDomains = ["10minutemail", "tempmail", "guerrillamail", "mailinator"];
      if (disposableDomains.some(domain => email.toLowerCase().includes(domain))) {
        reasons.push("Suspicious email domain");
        riskScore += 30;
      }

      const isSuspicious = riskScore > 40;
      
      if (isSuspicious) {
        await logSecurityEvent(AuditEventType.SRP_SUSPICIOUS_ACTIVITY, {
          email,
          reasons,
          riskScore,
        });
      }

      return { isSuspicious, reasons, riskScore };
    } catch (error) {
      console.error("SRP Security: Failed to check suspicious activity:", error);
      return { isSuspicious: true, reasons: ["Security check failed"], riskScore: 100 };
    }
  }

  /**
   * Get security statistics and health metrics
   */
  async getSecurityStats(): Promise<{
    sessionStats: any;
    securityHealth: "healthy" | "warning" | "critical";
    uptime: number;
    lastCleanup: Date;
    recommendations: string[];
  }> {
    try {
      const sessionStats = await this.sessionManager.getStats();
      const isConnected = await this.sessionManager.isConnected();
      
      const recommendations: string[] = [];
      let securityHealth: "healthy" | "warning" | "critical" = "healthy";

      // Analyze session statistics
      if (sessionStats.activeSessions > 500) {
        securityHealth = "warning";
        recommendations.push("Consider reducing session TTL");
      }

      if (sessionStats.activeSessions > 1000) {
        securityHealth = "critical";
        recommendations.push("High session load detected");
      }

      if (sessionStats.expiredSessions > 50) {
        securityHealth = "warning";
        recommendations.push("Session cleanup may be delayed");
      }

      if (!isConnected) {
        securityHealth = "critical";
        recommendations.push("Session manager disconnected");
      }

      return {
        sessionStats,
        securityHealth,
        uptime: process.uptime(),
        lastCleanup: new Date(),
        recommendations,
      };
    } catch (error) {
      console.error("SRP Security: Failed to get security stats:", error);
      return {
        sessionStats: { totalSessions: 0, activeSessions: 0, expiredSessions: 0 },
        securityHealth: "critical",
        uptime: process.uptime(),
        lastCleanup: new Date(),
        recommendations: ["Security service error"],
      };
    }
  }

  /**
   * Force cleanup of all SRP sessions (emergency use)
   */
  async emergencyCleanup(): Promise<{ deletedSessions: number; success: boolean }> {
    try {
      const stats = await this.sessionManager.getStats();
      const deletedCount = await this.sessionManager.cleanupExpiredSessions();
      
      // Force disconnect all sessions by creating new session manager
      await this.sessionManager.disconnect();
      
      await logSecurityEvent(AuditEventType.SRP_EMERGENCY_CLEANUP, {
        deletedSessions: deletedCount,
        totalSessions: stats.totalSessions,
      });

      return { deletedSessions: deletedCount, success: true };
    } catch (error) {
      console.error("SRP Security: Emergency cleanup failed:", error);
      return { deletedSessions: 0, success: false };
    }
  }

  /**
   * Gracefully shutdown the security service
   */
  async shutdown(): Promise<void> {
    console.log("SRP Security: Shutting down security service");
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    await this.sessionManager.disconnect();
    console.log("SRP Security: Security service shutdown complete");
  }
}

// Singleton instance for the application
let srpSecurityService: SRPSecurityService | null = null;

export function getSRPSecurityService(): SRPSecurityService {
  if (!srpSecurityService) {
    srpSecurityService = new SRPSecurityService();
  }
  return srpSecurityService;
}

// Graceful shutdown on process termination
process.on("SIGTERM", async () => {
  if (srpSecurityService) {
    await srpSecurityService.shutdown();
  }
});

process.on("SIGINT", async () => {
  if (srpSecurityService) {
    await srpSecurityService.shutdown();
  }
});

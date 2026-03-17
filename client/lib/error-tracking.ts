// AI-META-BEGIN
// AI-META: Advanced error tracking system with categorization and automated analysis
// OWNERSHIP: client/lib/error-tracking
// ENTRYPOINTS: imported by ErrorBoundary, global error handlers, and error reporting services
// DEPENDENCIES: AsyncStorage, Platform, error boundary components, analytics services
// DANGER: Error aggregation may mask critical issues; automated escalation requires careful threshold tuning
// CHANGE-SAFETY: Error categorization logic affects alerting; add new error types by extending ErrorCategory enum
// TESTS: client/lib/error-tracking.test.ts, verify error categorization and aggregation
// AI-META-END

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export enum ErrorCategory {
  NETWORK = 'network',
  MEMORY = 'memory',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  STORAGE = 'storage',
  UI = 'ui',
  CAMERA = 'camera',
  ML = 'ml',
  SYNC = 'sync',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  userId?: string;
  sessionId: string;
  timestamp: number;
  platform: string;
  appVersion: string;
  deviceInfo: {
    os: string;
    version: string;
    model?: string;
  };
  userAction?: string;
  componentStack?: string;
  networkState?: {
    connected: boolean;
    type?: string;
    effectiveType?: string;
  };
  memoryUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface TrackedError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context: ErrorContext;
  count: number;
  firstSeen: number;
  lastSeen: number;
  resolved: boolean;
  impact: {
    affectedUsers: number;
    occurrenceRate: number;
    userImpactScore: number;
  };
  metadata?: Record<string, any>;
}

export interface ErrorAggregation {
  category: ErrorCategory;
  message: string;
  count: number;
  uniqueUsers: Set<string>;
  firstSeen: number;
  lastSeen: number;
  severity: ErrorSeverity;
  resolved: boolean;
  trend: 'increasing' | 'decreasing' | 'stable';
  recommendations: string[];
}

export interface ErrorTrend {
  timestamp: number;
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  uniqueUsers: number;
  crashRate: number;
  errorRate: number;
}

class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private errors: Map<string, TrackedError> = new Map();
  private aggregations: Map<string, ErrorAggregation> = new Map();
  private trends: ErrorTrend[] = [];
  private sessionId: string;
  private userId?: string;
  private isInitialized = false;

  private constructor() {
    this.sessionId = this.generateSessionId();
  }

  static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  async initialize(userId?: string): Promise<void> {
    if (this.isInitialized) return;

    this.userId = userId;
    
    try {
      // Load stored errors and aggregations
      await this.loadStoredErrors();
      await this.loadStoredAggregations();
      await this.loadStoredTrends();
      
      // Start periodic cleanup and analysis
      this.startPeriodicTasks();
      
      this.isInitialized = true;
      console.log('🔍 Error tracking service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize error tracking:', error);
    }
  }

  async trackError(
    error: Error | string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.isInitialized) {
      console.warn('⚠️ Error tracking not initialized, skipping error tracking');
      return;
    }

    const errorMessage = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;
    
    const context = await this.createErrorContext();
    const errorId = this.generateErrorId(errorMessage, category);
    
    const trackedError: TrackedError = {
      id: errorId,
      category,
      severity,
      message: errorMessage,
      stack,
      context,
      count: 1,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      resolved: false,
      impact: {
        affectedUsers: this.userId ? 1 : 0,
        occurrenceRate: 0,
        userImpactScore: this.calculateUserImpactScore(severity, category)
      },
      metadata
    };

    // Update existing error or add new one
    const existingError = this.errors.get(errorId);
    if (existingError) {
      existingError.count++;
      existingError.lastSeen = Date.now();
      existingError.severity = Math.max(existingError.severity, severity);
      if (this.userId && !existingError.context.userId) {
        existingError.context.userId = this.userId;
        existingError.impact.affectedUsers++;
      }
    } else {
      this.errors.set(errorId, trackedError);
    }

    // Update aggregation
    this.updateAggregation(trackedError);
    
    // Store errors periodically
    this.storeErrors();
    
    // Check for automated escalation
    this.checkEscalationRules(trackedError);
    
    console.log(`🔍 Tracked error: ${category} - ${errorMessage}`);
  }

  private async createErrorContext(): Promise<ErrorContext> {
    const context: ErrorContext = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      platform: Platform.OS,
      appVersion: await this.getAppVersion(),
      deviceInfo: {
        os: Platform.OS,
        version: Platform.Version?.toString() || 'unknown',
        model: Platform.select({
          ios: 'iOS Device',
          android: 'Android Device',
          default: 'Unknown'
        })
      }
    };

    // Add user info if available
    if (this.userId) {
      context.userId = this.userId;
    }

    // Add memory usage if available
    try {
      if (typeof performance !== 'undefined' && performance.memory) {
        context.memoryUsage = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          percentage: (performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize) * 100
        };
      }
    } catch (error) {
      // Memory info not available
    }

    return context;
  }

  private async getAppVersion(): Promise<string> {
    try {
      // In a real app, this would come from app config or constants
      return '1.0.0';
    } catch (error) {
      return 'unknown';
    }
  }

  private generateErrorId(message: string, category: ErrorCategory): string {
    // Create a consistent ID based on message and category
    const normalizedMessage = message.toLowerCase().replace(/\s+/g, '-').slice(0, 50);
    return `${category}-${normalizedMessage}`;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateUserImpactScore(severity: ErrorSeverity, category: ErrorCategory): number {
    const severityScores = {
      [ErrorSeverity.LOW]: 1,
      [ErrorSeverity.MEDIUM]: 3,
      [ErrorSeverity.HIGH]: 7,
      [ErrorSeverity.CRITICAL]: 10
    };

    const categoryMultipliers = {
      [ErrorCategory.CRITICAL]: 2.0,
      [ErrorCategory.NETWORK]: 1.5,
      [ErrorCategory.AUTHENTICATION]: 1.8,
      [ErrorCategory.STORAGE]: 1.3,
      [ErrorCategory.MEMORY]: 1.6,
      [ErrorCategory.CAMERA]: 1.2,
      [ErrorCategory.ML]: 1.4,
      [ErrorCategory.PERMISSION]: 1.7,
      [ErrorCategory.SYNC]: 1.3,
      [ErrorCategory.UI]: 0.8,
      [ErrorCategory.VALIDATION]: 0.6,
      [ErrorCategory.UNKNOWN]: 1.0
    };

    return severityScores[severity] * (categoryMultipliers[category] || 1.0);
  }

  private updateAggregation(error: TrackedError): void {
    const aggregationKey = `${error.category}-${error.message}`;
    const existing = this.aggregations.get(aggregationKey);

    if (existing) {
      existing.count++;
      existing.lastSeen = Date.now();
      existing.severity = Math.max(existing.severity, error.severity);
      if (error.context.userId) {
        existing.uniqueUsers.add(error.context.userId);
      }
    } else {
      const aggregation: ErrorAggregation = {
        category: error.category,
        message: error.message,
        count: 1,
        uniqueUsers: new Set(error.context.userId ? [error.context.userId] : []),
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        severity: error.severity,
        resolved: false,
        trend: 'stable',
        recommendations: this.generateRecommendations(error.category, error.severity)
      };
      this.aggregations.set(aggregationKey, aggregation);
    }
  }

  private generateRecommendations(category: ErrorCategory, severity: ErrorSeverity): string[] {
    const recommendations: string[] = [];

    switch (category) {
      case ErrorCategory.NETWORK:
        recommendations.push('Check network connectivity and retry logic');
        recommendations.push('Implement offline mode support');
        recommendations.push('Add request timeout and retry mechanisms');
        break;
      case ErrorCategory.MEMORY:
        recommendations.push('Implement memory cleanup and garbage collection');
        recommendations.push('Optimize image loading and caching');
        recommendations.push('Add memory usage monitoring');
        break;
      case ErrorCategory.PERMISSION:
        recommendations.push('Improve permission request UX and timing');
        recommendations.push('Add permission status checking');
        recommendations.push('Provide clear permission explanations');
        break;
      case ErrorCategory.AUTHENTICATION:
        recommendations.push('Implement token refresh logic');
        recommendations.push('Add session timeout handling');
        recommendations.push('Improve error messaging for auth issues');
        break;
      case ErrorCategory.STORAGE:
        recommendations.push('Check storage quota and cleanup');
        recommendations.push('Implement data validation');
        recommendations.push('Add backup and recovery mechanisms');
        break;
      case ErrorCategory.CAMERA:
        recommendations.push('Check camera permissions and availability');
        recommendations.push('Add fallback for camera failures');
        recommendations.push('Implement camera state monitoring');
        break;
      case ErrorCategory.ML:
        recommendations.push('Check model loading and availability');
        recommendations.push('Add fallback for ML failures');
        recommendations.push('Implement model version management');
        break;
      case ErrorCategory.CRITICAL:
        recommendations.push('Immediate investigation required');
        recommendations.push('Consider app stability impact');
        recommendations.push('Implement emergency fixes');
        break;
    }

    if (severity === ErrorSeverity.CRITICAL) {
      recommendations.unshift('ESCALATE: Critical error requires immediate attention');
    }

    return recommendations;
  }

  private checkEscalationRules(error: TrackedError): void {
    // Rule 1: Critical severity always escalates
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.escalateError(error, 'Critical severity detected');
      return;
    }

    // Rule 2: High count errors escalate
    if (error.count >= 10) {
      this.escalateError(error, `High occurrence count: ${error.count}`);
      return;
    }

    // Rule 3: Recent rapid increase escalates
    const timeSinceFirst = Date.now() - error.firstSeen;
    if (timeSinceFirst < 60000 && error.count >= 5) { // 5+ errors in 1 minute
      this.escalateError(error, 'Rapid error increase detected');
      return;
    }

    // Rule 4: High user impact escalates
    if (error.impact.userImpactScore >= 15) {
      this.escalateError(error, `High user impact score: ${error.impact.userImpactScore}`);
      return;
    }
  }

  private escalateError(error: TrackedError, reason: string): void {
    console.error(`🚨 ERROR ESCALATION: ${error.message}`);
    console.error(`   Reason: ${reason}`);
    console.error(`   Category: ${error.category}`);
    console.error(`   Severity: ${error.severity}`);
    console.error(`   Count: ${error.count}`);
    console.error(`   Impact Score: ${error.impact.userImpactScore}`);

    // In a real implementation, this would:
    // - Send alerts to monitoring systems
    // - Create tickets in issue tracking
    // - Notify development team
    // - Trigger automated responses

    // Store escalation info
    error.metadata = {
      ...error.metadata,
      escalated: true,
      escalationReason: reason,
      escalationTime: Date.now()
    };
  }

  private startPeriodicTasks(): void {
    // Update trends every minute
    setInterval(() => {
      this.updateTrends();
    }, 60000);

    // Cleanup old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000);

    // Analyze trends every 5 minutes
    setInterval(() => {
      this.analyzeTrends();
    }, 300000);
  }

  private updateTrends(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    const recentErrors = Array.from(this.errors.values())
      .filter(error => error.lastSeen >= oneHourAgo);

    const errorsByCategory: Record<ErrorCategory, number> = {} as any;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;

    Object.values(ErrorCategory).forEach(cat => {
      errorsByCategory[cat] = 0;
    });

    Object.values(ErrorSeverity).forEach(sev => {
      errorsBySeverity[sev] = 0;
    });

    recentErrors.forEach(error => {
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;
    });

    const trend: ErrorTrend = {
      timestamp: now,
      totalErrors: recentErrors.length,
      errorsByCategory,
      errorsBySeverity,
      uniqueUsers: new Set(recentErrors.map(e => e.context.userId).filter(Boolean)).size,
      crashRate: errorsBySeverity[ErrorSeverity.CRITICAL] / Math.max(1, recentErrors.length),
      errorRate: recentErrors.length / 60 // errors per minute
    };

    this.trends.push(trend);
    
    // Keep only last 24 hours of trends
    const oneDayAgo = now - 86400000;
    this.trends = this.trends.filter(t => t.timestamp >= oneDayAgo);

    this.storeTrends();
  }

  private analyzeTrends(): void {
    if (this.trends.length < 10) return;

    const recent = this.trends.slice(-10);
    const older = this.trends.slice(-20, -10);

    if (older.length === 0) return;

    const recentAvg = recent.reduce((sum, t) => sum + t.totalErrors, 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + t.totalErrors, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    // Update aggregation trends
    this.aggregations.forEach(aggregation => {
      if (change > 0.2) {
        aggregation.trend = 'increasing';
      } else if (change < -0.2) {
        aggregation.trend = 'decreasing';
      } else {
        aggregation.trend = 'stable';
      }
    });

    console.log(`📈 Error trend analysis: ${change > 0 ? 'Increasing' : change < 0 ? 'Decreasing' : 'Stable'} (${(change * 100).toFixed(1)}%)`);
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const oneWeekAgo = now - 604800000;

    // Clean up old errors
    let cleanedCount = 0;
    for (const [id, error] of this.errors.entries()) {
      if (error.lastSeen < oneWeekAgo && error.resolved) {
        this.errors.delete(id);
        cleanedCount++;
      }
    }

    // Clean up old aggregations
    for (const [id, aggregation] of this.aggregations.entries()) {
      if (aggregation.lastSeen < oneWeekAgo && aggregation.resolved) {
        this.aggregations.delete(id);
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old error records`);
      this.storeErrors();
      this.storeAggregations();
    }
  }

  // Storage methods
  private async storeErrors(): Promise<void> {
    try {
      const errorsArray = Array.from(this.errors.entries());
      await AsyncStorage.setItem('error_tracking_errors', JSON.stringify(errorsArray));
    } catch (error) {
      console.warn('⚠️ Failed to store errors:', error);
    }
  }

  private async loadStoredErrors(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('error_tracking_errors');
      if (stored) {
        const errorsArray = JSON.parse(stored);
        this.errors = new Map(errorsArray);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load stored errors:', error);
    }
  }

  private async storeAggregations(): Promise<void> {
    try {
      const aggregationsArray = Array.from(this.aggregations.entries());
      await AsyncStorage.setItem('error_tracking_aggregations', JSON.stringify(aggregationsArray));
    } catch (error) {
      console.warn('⚠️ Failed to store aggregations:', error);
    }
  }

  private async loadStoredAggregations(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('error_tracking_aggregations');
      if (stored) {
        const aggregationsArray = JSON.parse(stored);
        this.aggregations = new Map(aggregationsArray.map(([key, value]: [string, any]) => [
          key,
          { ...value, uniqueUsers: new Set(value.uniqueUsers) }
        ]));
      }
    } catch (error) {
      console.warn('⚠️ Failed to load stored aggregations:', error);
    }
  }

  private async storeTrends(): Promise<void> {
    try {
      await AsyncStorage.setItem('error_tracking_trends', JSON.stringify(this.trends));
    } catch (error) {
      console.warn('⚠️ Failed to store trends:', error);
    }
  }

  private async loadStoredTrends(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('error_tracking_trends');
      if (stored) {
        this.trends = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load stored trends:', error);
    }
  }

  // Public API methods
  getErrorSummary(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    topErrors: TrackedError[];
    recentTrends: ErrorTrend[];
  } {
    const errorsByCategory: Record<ErrorCategory, number> = {} as any;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any;

    Object.values(ErrorCategory).forEach(cat => {
      errorsByCategory[cat] = 0;
    });

    Object.values(ErrorSeverity).forEach(sev => {
      errorsBySeverity[sev] = 0;
    });

    this.errors.forEach(error => {
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;
    });

    const topErrors = Array.from(this.errors.values())
      .sort((a, b) => b.impact.userImpactScore - a.impact.userImpactScore)
      .slice(0, 10);

    return {
      totalErrors: this.errors.size,
      errorsByCategory,
      errorsBySeverity,
      topErrors,
      recentTrends: this.trends.slice(-10)
    };
  }

  markErrorResolved(errorId: string): void {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      this.storeErrors();
    }
  }

  clearAllErrors(): void {
    this.errors.clear();
    this.aggregations.clear();
    this.trends = [];
    this.storeErrors();
    this.storeAggregations();
    this.storeTrends();
  }
}

// Export singleton instance
export const errorTracking = ErrorTrackingService.getInstance();

// Convenience functions
export const trackError = (
  error: Error | string,
  category?: ErrorCategory,
  severity?: ErrorSeverity,
  metadata?: Record<string, any>
) => {
  errorTracking.trackError(error, category, severity, metadata);
};

export const initializeErrorTracking = (userId?: string) => {
  return errorTracking.initialize(userId);
};

export const getErrorSummary = () => {
  return errorTracking.getErrorSummary();
};

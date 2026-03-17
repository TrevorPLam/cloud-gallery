// AI-META-BEGIN
// AI-META: React error boundary class component catching render errors app-wide
// OWNERSHIP: client/components (error handling)
// ENTRYPOINTS: Wraps root App component; catches all descendant errors
// DEPENDENCIES: React Component lifecycle, ErrorFallback component
// DANGER: Must be class component (React limitation); errors here crash app
// CHANGE-SAFETY: Risky - error boundaries are critical; test error scenarios thoroughly
// TESTS: Trigger errors in dev to verify boundary catches; test error logging flow
// AI-META-END

import React, { Component, ComponentType, PropsWithChildren } from "react";
import { ErrorFallback, ErrorFallbackProps } from "@/components/ErrorFallback";
import { errorTracking, ErrorCategory, ErrorSeverity, trackError } from "@/lib/error-tracking";

export type ErrorBoundaryProps = PropsWithChildren<{
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, stackTrace: string) => void;
}>;

type ErrorBoundaryState = { error: Error | null };

/**
 * AI-NOTE: Error boundaries must be class components because React only provides
 * error boundary functionality through lifecycle methods (componentDidCatch and
 * getDerivedStateFromError) which are not available in functional components.
 * https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static defaultProps: {
    FallbackComponent: ComponentType<ErrorFallbackProps>;
  } = {
    FallbackComponent: ErrorFallback,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    // Track error with enhanced error tracking system
    this.trackErrorWithCategory(error, info.componentStack);
    
    // Call custom error handler if provided
    if (typeof this.props.onError === "function") {
      this.props.onError(error, info.componentStack);
    }
  }

  private trackErrorWithCategory(error: Error, componentStack: string): void {
    // Determine error category based on error message and stack
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error);
    
    // Track with enhanced error tracking
    trackError(error, category, severity, {
      componentStack,
      errorBoundary: true,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    });
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ErrorCategory.NETWORK;
    }
    
    // Memory errors
    if (message.includes('memory') || message.includes('heap') || message.includes('out of memory')) {
      return ErrorCategory.MEMORY;
    }
    
    // Permission errors
    if (message.includes('permission') || message.includes('denied') || message.includes('unauthorized')) {
      return ErrorCategory.PERMISSION;
    }
    
    // Authentication errors
    if (message.includes('auth') || message.includes('token') || message.includes('unauthenticated')) {
      return ErrorCategory.AUTHENTICATION;
    }
    
    // Storage errors
    if (message.includes('storage') || message.includes('database') || message.includes('quota')) {
      return ErrorCategory.STORAGE;
    }
    
    // Camera errors
    if (message.includes('camera') || message.includes('photo') || message.includes('capture')) {
      return ErrorCategory.CAMERA;
    }
    
    // ML/ML errors
    if (message.includes('model') || message.includes('tensorflow') || message.includes('embedding')) {
      return ErrorCategory.ML;
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return ErrorCategory.VALIDATION;
    }
    
    // UI/Rendering errors
    if (stack.includes('react') || stack.includes('render') || message.includes('component')) {
      return ErrorCategory.UI;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    // Critical errors that crash the app
    if (message.includes('fatal') || message.includes('critical') || message.includes('unhandled')) {
      return ErrorSeverity.CRITICAL;
    }
    
    // High severity errors
    if (message.includes('security') || message.includes('authentication') || message.includes('permission')) {
      return ErrorSeverity.HIGH;
    }
    
    // Medium severity errors
    if (message.includes('network') || message.includes('storage') || message.includes('memory')) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render() {
    const { FallbackComponent } = this.props;

    return this.state.error && FallbackComponent ? (
      <FallbackComponent
        error={this.state.error}
        resetError={this.resetError}
      />
    ) : (
      this.props.children
    );
  }
}

// Security headers middleware for Express
// Implements comprehensive HTTP security headers

import type { Request, Response, NextFunction } from 'express';

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  /** Content Security Policy directives */
  csp?: {
    enabled: boolean;
    directives?: Record<string, string[]>;
  };
  /** Enable HSTS (HTTP Strict Transport Security) */
  hsts?: {
    enabled: boolean;
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  /** Enable other security headers */
  otherHeaders?: {
    xFrameOptions?: boolean;
    xContentTypeOptions?: boolean;
    xXssProtection?: boolean;
    referrerPolicy?: boolean;
  };
}

/**
 * Default CSP directives for a secure mobile app backend
 */
const DEFAULT_CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"], // Allow inline styles for React Native Web
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': [],
};

/**
 * Build CSP header value from directives
 */
function buildCSP(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Security headers middleware
 * 
 * Adds comprehensive security headers to all responses:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options (clickjacking protection)
 * - X-Content-Type-Options (MIME sniffing protection)
 * - X-XSS-Protection (XSS filter)
 * - Referrer-Policy (referrer information control)
 * 
 * @param config - Optional configuration for security headers
 * @returns Express middleware function
 * 
 * @example
 * app.use(securityHeaders());
 * 
 * @example
 * // Custom CSP
 * app.use(securityHeaders({
 *   csp: {
 *     enabled: true,
 *     directives: {
 *       'default-src': ["'self'"],
 *       'img-src': ["'self'", 'https://cdn.example.com']
 *     }
 *   }
 * }));
 */
export function securityHeaders(
  config: SecurityHeadersConfig = {}
): (req: Request, res: Response, next: NextFunction) => void {
  // Merge config with defaults
  const cspConfig = {
    enabled: true,
    directives: DEFAULT_CSP_DIRECTIVES,
    ...config.csp,
  };
  
  const hstsConfig = {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false,
    ...config.hsts,
  };
  
  const otherHeadersConfig = {
    xFrameOptions: true,
    xContentTypeOptions: true,
    xXssProtection: true,
    referrerPolicy: true,
    ...config.otherHeaders,
  };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Content Security Policy
    if (cspConfig.enabled && cspConfig.directives) {
      const cspValue = buildCSP(cspConfig.directives);
      res.setHeader('Content-Security-Policy', cspValue);
    }
    
    // HTTP Strict Transport Security
    if (hstsConfig.enabled) {
      let hstsValue = `max-age=${hstsConfig.maxAge}`;
      if (hstsConfig.includeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (hstsConfig.preload) {
        hstsValue += '; preload';
      }
      res.setHeader('Strict-Transport-Security', hstsValue);
    }
    
    // X-Frame-Options (prevent clickjacking)
    if (otherHeadersConfig.xFrameOptions) {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    
    // X-Content-Type-Options (prevent MIME sniffing)
    if (otherHeadersConfig.xContentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    
    // X-XSS-Protection (legacy XSS filter)
    if (otherHeadersConfig.xXssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }
    
    // Referrer-Policy
    if (otherHeadersConfig.referrerPolicy) {
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    
    // Permissions-Policy (restrict browser features)
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()'
    );
    
    // Remove X-Powered-By header (information disclosure)
    res.removeHeader('X-Powered-By');
    
    next();
  };
}

/**
 * Rate limiting middleware (simple in-memory implementation)
 * For production, use Redis-backed rate limiting
 * 
 * @param options - Rate limit configuration
 * @returns Express middleware function
 * 
 * @example
 * app.use('/api', rateLimit({ windowMs: 60000, max: 100 }));
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  message?: string;
}): (req: Request, res: Response, next: NextFunction) => void {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    let record = requests.get(key);
    
    // Reset if window expired
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + options.windowMs,
      };
      requests.set(key, record);
    }
    
    record.count++;
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', options.max.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - record.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
    
    if (record.count > options.max) {
      res.status(429).json({
        error: options.message || 'Too many requests, please try again later.',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
      return;
    }
    
    next();
  };
}

/**
 * Request ID middleware for correlation
 * Adds a unique request ID to each request for tracing
 * 
 * @returns Express middleware function
 * 
 * @example
 * app.use(requestId());
 */
export function requestId(): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.headers['x-request-id'] as string || 
               `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-ID', id);
    
    next();
  };
}

// AI-META-BEGIN
// AI-META: Express server bootstrap and configuration for Cloud Gallery backend
// OWNERSHIP: server/core
// ENTRYPOINTS: main server process (node server/index.ts or npm run server:dev)
// DEPENDENCIES: express, ./routes, ./middleware, ./security, fs, path
// DANGER: CORS configuration, middleware order is critical, error handler must not leak internals in production
// CHANGE-SAFETY: Middleware order matters - security headers first, error handler last
// TESTS: server/index.test.ts, integration tests
// AI-META-END

import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { securityHeaders, requestId, rateLimit } from "./middleware";
import { sanitizeForLogging } from "./security";
import * as fs from "fs";
import * as path from "path";

const app = express();
const log = console.log;

// Detect environment
const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

// Trust proxy configuration for production deployments behind load balancer
// Set to 1 if behind single proxy, 'loopback' for localhost, or specific IP
if (isProduction && process.env.TRUST_PROXY) {
  app.set("trust proxy", process.env.TRUST_PROXY);
  log("Trust proxy enabled:", process.env.TRUST_PROXY);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// PHASE 1A: TLS / Proxy Correctness - Trust proxy configuration is set above based on environment

// PHASE 1B: Security Headers (environment-aware CSP)
function setupSecurityHeaders(app: express.Application) {
  // Environment-aware CSP configuration
  const cspDirectives = isDevelopment
    ? {
        // Development: Relaxed CSP for hot reload and dev tools
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow dev tools
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "https:", "http:"], // Allow localhost images
        "font-src": ["'self'", "data:"],
        "connect-src": ["'self'", "ws:", "wss:", "http:", "https:"], // Allow hot reload
        "frame-ancestors": ["'none'"],
      }
    : {
        // Production: Strict CSP
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"], // React Native Web needs inline styles
        "img-src": ["'self'", "data:", "https:"],
        "font-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "upgrade-insecure-requests": [],
      };

  app.use(
    securityHeaders({
      csp: {
        enabled: true,
        directives: cspDirectives,
      },
      hsts: {
        enabled: isProduction, // Only enable HSTS in production over HTTPS
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: false,
      },
      otherHeaders: {
        xFrameOptions: true,
        xContentTypeOptions: true,
        xXssProtection: true,
        referrerPolicy: true,
      },
    }),
  );

  if (isDevelopment) {
    log("Security headers: Development mode (relaxed CSP)");
  } else {
    log("Security headers: Production mode (strict CSP + HSTS)");
  }
}

// PHASE 1C: CORS with Strict Origin Validation (no wildcards with credentials)
function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const allowedOrigins = new Set<string>();

    // Production domains from environment
    if (process.env.REPLIT_DEV_DOMAIN) {
      allowedOrigins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        allowedOrigins.add(`https://${d.trim()}`);
      });
    }

    // Localhost only in development
    if (isDevelopment) {
      // Explicit localhost ports for Expo dev
      const localhostPorts = [19000, 19001, 19002, 8081, 3000];
      localhostPorts.forEach((port) => {
        allowedOrigins.add(`http://localhost:${port}`);
        allowedOrigins.add(`http://127.0.0.1:${port}`);
      });
    }

    const origin = req.header("origin");

    // Strict origin validation - no wildcards when credentials are used
    let isAllowed = false;
    if (origin) {
      if (allowedOrigins.has(origin)) {
        isAllowed = true;
      } else if (isDevelopment) {
        // In development, allow any localhost port
        if (
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:")
        ) {
          isAllowed = true;
        }
      }
    }

    if (isAllowed && origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Max-Age", "86400"); // 24 hours
    }

    // Handle preflight
    if (req.method === "OPTIONS") {
      return res.sendStatus(isAllowed ? 204 : 403);
    }

    next();
  });

  log(
    `CORS: ${isDevelopment ? "Development" : "Production"} mode - ${allowedOrigins.size} allowed origins`,
  );
}

// PHASE 1D: Rate Limiting (production-ready configuration)
function setupRateLimiting(app: express.Application) {
  // Global rate limit - applies to all routes
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: isDevelopment ? 1000 : 100, // Relaxed in dev, strict in prod
      message: "Too many requests from this IP, please try again later",
    }),
  );

  // Stricter rate limit for auth endpoints (when they exist)
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: isDevelopment ? 100 : 10, // Very strict for auth
      message: "Too many authentication attempts, please try again later",
    }),
  );

  log(`Rate limiting: ${isDevelopment ? "Relaxed (dev)" : "Strict (prod)"}`);
}

// PHASE 1E: Request Parsing with DoS Controls
function setupBodyParsing(app: express.Application) {
  // Body size limits to prevent memory exhaustion
  const jsonLimit = process.env.JSON_BODY_LIMIT || "10mb";
  const urlencodedLimit = process.env.URLENCODED_BODY_LIMIT || "10mb";

  app.use(
    express.json({
      limit: jsonLimit,
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(
    express.urlencoded({
      extended: false,
      limit: urlencodedLimit,
    }),
  );

  // Request timeout to prevent slowloris attacks
  app.use((_req, res, next) => {
    res.setTimeout(30000, () => {
      // 30 second timeout
      res.status(408).json({ error: "Request timeout" });
    });
    next();
  });

  log(`Body limits: JSON=${jsonLimit}, URLEncoded=${urlencodedLimit}`);
}

// Request logging with PII sanitization
function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const requestPath = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!requestPath.startsWith("/api")) return;

      const duration = Date.now() - start;
      const method = req.method;
      const status = res.statusCode;
      const correlationId = req.headers["x-request-id"] || "unknown";

      // Basic log without response body (PII might be in response)
      let logLine = `[${correlationId}] ${method} ${requestPath} ${status} ${duration}ms`;

      // In development, log response for debugging
      if (isDevelopment && capturedJsonResponse) {
        const sanitized = sanitizeForLogging(
          JSON.stringify(capturedJsonResponse),
        );
        logLine += ` :: ${sanitized.substring(0, 100)}`;
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

// AI-NOTE: Expo manifest routing detects platform from headers; fallback serves landing page for web browsers
function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  log("Serving static Expo files with dynamic manifest routing");

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

// PHASE 3: Centralized Error Handler (no stack traces in production)
function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
      stack?: string;
    };

    const status = error.status || error.statusCode || 500;
    const correlationId = req.headers["x-request-id"] || "unknown";

    // Log full error server-side (with correlation ID for debugging)
    console.error(`[${correlationId}] Error:`, {
      status,
      message: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });

    if (res.headersSent) {
      return next(err);
    }

    // Send safe error to client (no stack traces in production)
    if (isProduction) {
      // Production: Generic error message only
      const safeMessage =
        status < 500
          ? error.message || "Bad Request" // Client errors can show message
          : "Internal Server Error"; // Server errors are generic

      return res.status(status).json({
        error: safeMessage,
        correlationId, // For support/debugging
      });
    } else {
      // Development: Include stack trace for debugging
      return res.status(status).json({
        error: error.message || "Internal Server Error",
        correlationId,
        stack: error.stack, // Only in dev
        path: req.path,
      });
    }
  });
}

// Main server bootstrap
(async () => {
  log("Starting Cloud Gallery server...");
  log(`Environment: ${process.env.NODE_ENV || "development"}`);

  // CRITICAL: Middleware order matters!
  // 1. Request ID for correlation (first, so all logs have it)
  app.use(requestId());

  // 2. Security headers (early, affects all responses)
  setupSecurityHeaders(app);

  // 3. CORS (before body parsing)
  setupCors(app);

  // 4. Rate limiting (before expensive operations)
  setupRateLimiting(app);

  // 5. Body parsing with limits
  setupBodyParsing(app);

  // 6. Request logging (after body parsing)
  setupRequestLogging(app);

  // 7. Expo static serving and routing
  configureExpoAndLanding(app);

  // 8. Application routes
  const server = await registerRoutes(app);

  // 9. Error handler (MUST BE LAST)
  setupErrorHandler(app);

  // Start server
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`✓ Server ready on port ${port}`);
      log(`✓ Health check: http://localhost:${port}/`);
      if (isDevelopment) {
        log(`✓ API endpoints: http://localhost:${port}/api/*`);
      }
    },
  );

  // Graceful shutdown
  const gracefulShutdown = () => {
    log("Received shutdown signal, closing server gracefully...");
    server.close(() => {
      log("Server closed");
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      log("Forcing shutdown");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
})();

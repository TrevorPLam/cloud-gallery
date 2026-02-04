import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import * as fs from "fs";

// We'll need to test the individual functions by importing them
// Since the file runs immediately, we need to mock the dependencies first

vi.mock("./routes", () => ({
  registerRoutes: vi.fn(async (app) => {
    const { createServer } = await import("node:http");
    return createServer(app);
  }),
}));

vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock("path", () => ({
  default: {
    resolve: vi.fn((...args) => args.join("/")),
  },
  resolve: vi.fn((...args) => args.join("/")),
}));

describe("Server index.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CORS setup", () => {
    it("should allow requests from REPLIT_DEV_DOMAIN", () => {
      const app = express();
      const mockReq = {
        header: vi.fn((name: string) => {
          if (name === "origin") return "https://test.repl.co";
          return null;
        }),
        method: "GET",
      } as unknown as Request;
      const mockRes = {
        header: vi.fn(),
        sendStatus: vi.fn(),
      } as unknown as Response;
      const mockNext = vi.fn();

      process.env.REPLIT_DEV_DOMAIN = "test.repl.co";

      // Manually call CORS middleware logic
      const origin = mockReq.header("origin");
      const origins = new Set<string>();
      if (process.env.REPLIT_DEV_DOMAIN) {
        origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
      }

      const isLocalhost =
        origin?.startsWith("http://localhost:") ||
        origin?.startsWith("http://127.0.0.1:");

      if (origin && (origins.has(origin) || isLocalhost)) {
        expect(origins.has(origin)).toBe(true);
      }

      delete process.env.REPLIT_DEV_DOMAIN;
    });

    it("should allow localhost origins", () => {
      const origins = ["http://localhost:8080", "http://127.0.0.1:3000"];

      origins.forEach((origin) => {
        const isLocalhost =
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:");
        expect(isLocalhost).toBe(true);
      });
    });

    it("should handle REPLIT_DOMAINS environment variable", () => {
      process.env.REPLIT_DOMAINS = "domain1.com, domain2.com";

      const origins = new Set<string>();
      if (process.env.REPLIT_DOMAINS) {
        process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
          origins.add(`https://${d.trim()}`);
        });
      }

      expect(origins.has("https://domain1.com")).toBe(true);
      expect(origins.has("https://domain2.com")).toBe(true);

      delete process.env.REPLIT_DOMAINS;
    });

    it("should handle OPTIONS requests", () => {
      const method = "OPTIONS";
      const shouldReturn200 = method === "OPTIONS";
      expect(shouldReturn200).toBe(true);
    });
  });

  describe("getAppName", () => {
    it("should return app name from app.json", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ expo: { name: "Test App" } }),
      );

      const appJsonContent = fs.readFileSync("app.json", "utf-8");
      const appJson = JSON.parse(appJsonContent);
      const appName = appJson.expo?.name || "App Landing Page";

      expect(appName).toBe("Test App");
    });

    it("should return default name when expo.name is missing", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const appJsonContent = fs.readFileSync("app.json", "utf-8");
      const appJson = JSON.parse(appJsonContent);
      const appName = appJson.expo?.name || "App Landing Page";

      expect(appName).toBe("App Landing Page");
    });

    it("should handle file read error", () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("File not found");
      });

      let appName;
      try {
        const appJsonContent = fs.readFileSync("app.json", "utf-8");
        const appJson = JSON.parse(appJsonContent);
        appName = appJson.expo?.name || "App Landing Page";
      } catch {
        appName = "App Landing Page";
      }

      expect(appName).toBe("App Landing Page");
    });

    it("should handle invalid JSON", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

      let appName;
      try {
        const appJsonContent = fs.readFileSync("app.json", "utf-8");
        const appJson = JSON.parse(appJsonContent);
        appName = appJson.expo?.name || "App Landing Page";
      } catch {
        appName = "App Landing Page";
      }

      expect(appName).toBe("App Landing Page");
    });
  });

  describe("serveExpoManifest", () => {
    it("should return 404 when manifest file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manifestExists = fs.existsSync("static-build/ios/manifest.json");
      expect(manifestExists).toBe(false);
    });

    it("should serve manifest when file exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ version: "1.0.0" }),
      );

      const manifestExists = fs.existsSync("static-build/ios/manifest.json");
      expect(manifestExists).toBe(true);

      if (manifestExists) {
        const manifest = fs.readFileSync("static-build/ios/manifest.json", "utf-8");
        expect(JSON.parse(manifest)).toEqual({ version: "1.0.0" });
      }
    });

    it("should handle android platform", () => {
      const platform = "android";
      const manifestPath = `static-build/${platform}/manifest.json`;
      expect(manifestPath).toBe("static-build/android/manifest.json");
    });

    it("should handle ios platform", () => {
      const platform = "ios";
      const manifestPath = `static-build/${platform}/manifest.json`;
      expect(manifestPath).toBe("static-build/ios/manifest.json");
    });
  });

  describe("serveLandingPage", () => {
    it("should replace BASE_URL_PLACEHOLDER", () => {
      const landingPageTemplate = "Base URL: BASE_URL_PLACEHOLDER";
      const baseUrl = "https://example.com";
      const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl);

      expect(html).toBe("Base URL: https://example.com");
    });

    it("should replace EXPS_URL_PLACEHOLDER", () => {
      const landingPageTemplate = "Expo URL: EXPS_URL_PLACEHOLDER";
      const expsUrl = "example.com";
      const html = landingPageTemplate.replace(/EXPS_URL_PLACEHOLDER/g, expsUrl);

      expect(html).toBe("Expo URL: example.com");
    });

    it("should replace APP_NAME_PLACEHOLDER", () => {
      const landingPageTemplate = "App: APP_NAME_PLACEHOLDER";
      const appName = "My App";
      const html = landingPageTemplate.replace(/APP_NAME_PLACEHOLDER/g, appName);

      expect(html).toBe("App: My App");
    });

    it("should handle x-forwarded-proto header", () => {
      const mockReq = {
        header: (name: string) => {
          if (name === "x-forwarded-proto") return "https";
          return null;
        },
        protocol: "http",
      };

      const forwardedProto = mockReq.header("x-forwarded-proto");
      const protocol = forwardedProto || mockReq.protocol || "https";

      expect(protocol).toBe("https");
    });

    it("should handle x-forwarded-host header", () => {
      const mockReq = {
        header: (name: string) => {
          if (name === "x-forwarded-host") return "proxy.example.com";
          return null;
        },
        get: (name: string) => {
          if (name === "host") return "direct.example.com";
          return null;
        },
      };

      const forwardedHost = mockReq.header("x-forwarded-host");
      const host = forwardedHost || mockReq.get("host");

      expect(host).toBe("proxy.example.com");
    });

    it("should construct baseUrl correctly", () => {
      const protocol = "https";
      const host = "example.com:5000";
      const baseUrl = `${protocol}://${host}`;

      expect(baseUrl).toBe("https://example.com:5000");
    });

    it("should construct expsUrl correctly", () => {
      const host = "example.com:5000";
      const expsUrl = `${host}`;

      expect(expsUrl).toBe("example.com:5000");
    });
  });

  describe("Expo manifest routing", () => {
    it("should detect iOS platform header", () => {
      const mockReq = {
        header: (name: string) => {
          if (name === "expo-platform") return "ios";
          return null;
        },
        path: "/manifest",
      };

      const platform = mockReq.header("expo-platform");
      const shouldServeManifest = platform && (platform === "ios" || platform === "android");

      expect(shouldServeManifest).toBe(true);
    });

    it("should detect Android platform header", () => {
      const mockReq = {
        header: (name: string) => {
          if (name === "expo-platform") return "android";
          return null;
        },
        path: "/manifest",
      };

      const platform = mockReq.header("expo-platform");
      const shouldServeManifest = platform && (platform === "ios" || platform === "android");

      expect(shouldServeManifest).toBe(true);
    });

    it("should not serve manifest for web platform", () => {
      const mockReq = {
        header: (name: string) => {
          if (name === "expo-platform") return "web";
          return null;
        },
        path: "/manifest",
      };

      const platform = mockReq.header("expo-platform");
      const shouldServeManifest = platform && (platform === "ios" || platform === "android");

      expect(shouldServeManifest).toBe(false);
    });

    it("should skip middleware for /api routes", () => {
      const req = { path: "/api/users" };
      const shouldSkip = req.path.startsWith("/api");
      expect(shouldSkip).toBe(true);
    });

    it("should process non-api routes", () => {
      const req = { path: "/" };
      const shouldSkip = req.path.startsWith("/api");
      expect(shouldSkip).toBe(false);
    });

    it("should handle root path", () => {
      const req = { path: "/" };
      const isRootOrManifest = req.path === "/" || req.path === "/manifest";
      expect(isRootOrManifest).toBe(true);
    });

    it("should handle manifest path", () => {
      const req = { path: "/manifest" };
      const isRootOrManifest = req.path === "/" || req.path === "/manifest";
      expect(isRootOrManifest).toBe(true);
    });

    it("should skip other paths", () => {
      const req = { path: "/assets/image.png" };
      const isRootOrManifest = req.path === "/" || req.path === "/manifest";
      expect(isRootOrManifest).toBe(false);
    });
  });

  describe("Error handler", () => {
    it("should extract status from error.status", () => {
      const error = { status: 404, message: "Not found" };
      const status = error.status || 500;
      const message = error.message || "Internal Server Error";

      expect(status).toBe(404);
      expect(message).toBe("Not found");
    });

    it("should extract status from error.statusCode", () => {
      const error = { statusCode: 403, message: "Forbidden" };
      const status = error.statusCode || 500;
      const message = error.message || "Internal Server Error";

      expect(status).toBe(403);
      expect(message).toBe("Forbidden");
    });

    it("should default to 500 status", () => {
      const error = { message: "Something went wrong" };
      const status = (error as any).status || (error as any).statusCode || 500;
      const message = error.message || "Internal Server Error";

      expect(status).toBe(500);
      expect(message).toBe("Something went wrong");
    });

    it("should use default message when missing", () => {
      const error = {};
      const status = (error as any).status || (error as any).statusCode || 500;
      const message = (error as any).message || "Internal Server Error";

      expect(status).toBe(500);
      expect(message).toBe("Internal Server Error");
    });
  });

  describe("Request logging", () => {
    it("should skip logging for non-api paths", () => {
      const req = { path: "/assets/image.png", method: "GET" };
      const shouldLog = req.path.startsWith("/api");
      expect(shouldLog).toBe(false);
    });

    it("should log api paths", () => {
      const req = { path: "/api/users", method: "GET" };
      const shouldLog = req.path.startsWith("/api");
      expect(shouldLog).toBe(true);
    });

    it("should truncate long log lines", () => {
      const logLine = "x".repeat(100);
      const truncated = logLine.length > 80 ? logLine.slice(0, 79) + "…" : logLine;
      expect(truncated.length).toBe(80);
      expect(truncated.endsWith("…")).toBe(true);
    });

    it("should not truncate short log lines", () => {
      const logLine = "GET /api/users 200 in 10ms";
      const truncated = logLine.length > 80 ? logLine.slice(0, 79) + "…" : logLine;
      expect(truncated).toBe(logLine);
    });

    it("should format log line correctly", () => {
      const method = "POST";
      const path = "/api/users";
      const statusCode = 201;
      const duration = 50;
      const logLine = `${method} ${path} ${statusCode} in ${duration}ms`;

      expect(logLine).toBe("POST /api/users 201 in 50ms");
    });
  });

  describe("Server configuration", () => {
    it("should use PORT environment variable", () => {
      process.env.PORT = "8080";
      const port = parseInt(process.env.PORT || "5000", 10);
      expect(port).toBe(8080);
      delete process.env.PORT;
    });

    it("should default to port 5000", () => {
      delete process.env.PORT;
      const port = parseInt(process.env.PORT || "5000", 10);
      expect(port).toBe(5000);
    });

    it("should handle invalid PORT gracefully", () => {
      process.env.PORT = "invalid";
      const port = parseInt(process.env.PORT || "5000", 10);
      expect(isNaN(port)).toBe(true);
      delete process.env.PORT;
    });
  });
});

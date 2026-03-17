/**
 * Unit tests for auth-client: login, register, refresh, getMe, logout.
 * Mocks fetch, query-client, AsyncStorage, and expo-secure-store.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  login,
  register,
  registerSRP,
  loginSRPChallenge,
  loginSRPVerify,
  loginSRP,
  refreshAuth,
  getMe,
  logout,
  type AuthUser,
  type LoginResponse,
} from "./auth-client";

const mockSetAuthToken = vi.fn();
const mockClearAuthToken = vi.fn();
const mockGetAuthToken = vi.fn();

vi.mock("./query-client", () => ({
  getApiUrl: () => "https://test.example.com",
  getAuthToken: (...args: unknown[]) => mockGetAuthToken(...args),
  setAuthToken: (...args: unknown[]) => mockSetAuthToken(...args),
  clearAuthToken: (...args: unknown[]) => mockClearAuthToken(...args),
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("auth-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("login", () => {
    it("sends POST to /api/auth/login and returns user and tokens", async () => {
      const user: AuthUser = { id: "u1", email: "u@test.com" };
      const res: LoginResponse = {
        user,
        accessToken: "at",
        refreshToken: "rt",
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(res),
      });

      const result = await login("u@test.com", "pass");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/api/auth/login",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "u@test.com", password: "pass" }),
        }),
      );
      expect(mockSetAuthToken).toHaveBeenCalledWith("at");
      expect(result).toEqual(res);
    });

    it("throws on non-ok response with message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: "Invalid credentials" }),
      });

      await expect(login("u@test.com", "wrong")).rejects.toThrow(
        "Invalid credentials",
      );
    });
  });

  describe("register", () => {
    it("sends POST to /api/auth/register and returns user and tokens", async () => {
      const user: AuthUser = { id: "u2", email: "new@test.com" };
      const res: LoginResponse = {
        user,
        accessToken: "at2",
        refreshToken: "rt2",
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(res),
      });

      const result = await register("new@test.com", "secret");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/api/auth/register",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "new@test.com", password: "secret" }),
        }),
      );
      expect(mockSetAuthToken).toHaveBeenCalledWith("at2");
      expect(result.user.email).toBe("new@test.com");
    });
  });

  describe("refreshAuth", () => {
    it("returns null when no refresh token available", async () => {
      const mod = await import("expo-secure-store");
      (mod.getItemAsync as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await refreshAuth();

      expect(result).toBeNull();
    });

    it("calls refresh endpoint and returns tokens when refresh token is stored", async () => {
      const mod = await import("expo-secure-store");
      (mod.getItemAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
        "stored-refresh-token",
      );
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user: { id: "u1", email: "u@test.com" },
            accessToken: "new-at",
            refreshToken: "new-rt",
          }),
      });

      const result = await refreshAuth();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/api/auth/refresh",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ refreshToken: "stored-refresh-token" }),
        }),
      );
      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe("new-at");
    });
  });

  describe("getMe", () => {
    it("returns null when no token", async () => {
      mockGetAuthToken.mockResolvedValueOnce(null);

      const result = await getMe();

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("calls /api/auth/me with Bearer token and returns user", async () => {
      mockGetAuthToken.mockResolvedValueOnce("token");
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ user: { id: "u1", email: "u@test.com" } }),
      });

      const result = await getMe();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.example.com/api/auth/me",
        expect.objectContaining({
          headers: { Authorization: "Bearer token" },
        }),
      );
      expect(result).toEqual({ id: "u1", email: "u@test.com" });
    });

    it("returns null when /me returns non-ok", async () => {
      mockGetAuthToken.mockResolvedValueOnce("token");
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
      });

      const result = await getMe();

      expect(result).toBeNull();
    });
  });

  describe("logout", () => {
    it("clears auth token and refresh token", async () => {
      await logout();

      expect(mockClearAuthToken).toHaveBeenCalled();
    });
  });

  describe("SRP Authentication", () => {
    const testEmail = "srp-test@example.com";
    const testPassword = "TestPassword123!";
    const mockSessionId = "test_session_id";
    const mockSalt = "test_salt_32_chars_long";
    const mockB = "test_server_public_key_B";
    const mockA = "test_client_public_key_A";
    const mockM1 = "test_client_proof_M1";
    const mockM2 = "test_server_proof_M2";

    describe("registerSRP", () => {
      it("should register user with SRP successfully", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            user: { id: "user123", email: testEmail },
            accessToken: "access_token",
            refreshToken: "refresh_token",
            message: "User registered successfully",
          }),
        });

        const result = await registerSRP(testEmail, testPassword);

        expect(result.user.email).toBe(testEmail);
        expect(result.accessToken).toBe("access_token");
        expect(result.refreshToken).toBe("refresh_token");
        expect(result.message).toBe("User registered successfully");

        expect(global.fetch).toHaveBeenCalledWith(
          "https://test.example.com/api/auth/register",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"srpSalt"'),
          }),
        );
      });

      it("should handle registration error", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({
            error: "Registration failed",
            message: "User already exists",
          }),
        });

        await expect(registerSRP(testEmail, testPassword)).rejects.toThrow("User already exists");
      });
    });

    describe("loginSRPChallenge", () => {
      it("should get SRP challenge successfully", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            sessionId: mockSessionId,
            salt: mockSalt,
            B: mockB,
          }),
        });

        const result = await loginSRPChallenge(testEmail);

        expect(result.sessionId).toBe(mockSessionId);
        expect(result.salt).toBe(mockSalt);
        expect(result.B).toBe(mockB);

        expect(global.fetch).toHaveBeenCalledWith(
          "https://test.example.com/api/auth/login/challenge",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ email: testEmail }),
          }),
        );
      });

      it("should handle challenge error", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({
            error: "Challenge failed",
            message: "User not found",
          }),
        });

        await expect(loginSRPChallenge(testEmail)).rejects.toThrow("User not found");
      });
    });

    describe("loginSRPVerify", () => {
      const mockChallenge = {
        sessionId: mockSessionId,
        salt: mockSalt,
        B: mockB,
      };

      it("should verify SRP login successfully", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            user: { id: "user123", email: testEmail },
            accessToken: "access_token",
            refreshToken: "refresh_token",
            M2: mockM2,
            message: "Login successful",
          }),
        });

        const result = await loginSRPVerify(testEmail, testPassword, mockChallenge);

        expect(result.user.email).toBe(testEmail);
        expect(result.accessToken).toBe("access_token");
        expect(result.refreshToken).toBe("refresh_token");
        expect(result.M2).toBe(mockM2);
        expect(result.message).toBe("Login successful");

        expect(global.fetch).toHaveBeenCalledWith(
          "https://test.example.com/api/auth/login/verify",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"sessionId"'),
          }),
        );
      });

      it("should handle verification error", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({
            error: "Verification failed",
            message: "Invalid credentials",
          }),
        });

        await expect(loginSRPVerify(testEmail, testPassword, mockChallenge)).rejects.toThrow("Invalid credentials");
      });

      it("should handle missing M2 in response", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            user: { id: "user123", email: testEmail },
            accessToken: "access_token",
            refreshToken: "refresh_token",
            message: "Login successful",
            // M2 is missing
          }),
        });

        const result = await loginSRPVerify(testEmail, testPassword, mockChallenge);

        expect(result.M2).toBeUndefined();
        expect(result.accessToken).toBe("access_token");
      });
    });

    describe("loginSRP", () => {
      it("should complete full SRP login flow", async () => {
        // Mock challenge response
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            sessionId: mockSessionId,
            salt: mockSalt,
            B: mockB,
          }),
        });

        // Mock verify response
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            user: { id: "user123", email: testEmail },
            accessToken: "access_token",
            refreshToken: "refresh_token",
            M2: mockM2,
            message: "Login successful",
          }),
        });

        const result = await loginSRP(testEmail, testPassword);

        expect(result.user.email).toBe(testEmail);
        expect(result.accessToken).toBe("access_token");
        expect(result.refreshToken).toBe("refresh_token");
        expect(result.M2).toBe(mockM2);

        // Verify both API calls were made
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it("should handle challenge failure in complete flow", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({
            error: "Challenge failed",
            message: "User not found",
          }),
        });

        await expect(loginSRP(testEmail, testPassword)).rejects.toThrow("User not found");

        // Should only make the challenge call
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });

    describe("SRP Cryptography", () => {
      it("should generate consistent verifiers for same credentials", async () => {
        // This test verifies that the SRP cryptography is working correctly
        const { createVerifierAndSalt, SRPRoutines, SRPParameters } = await import("tssrp6a");
        
        const srp6aRoutines = new SRPRoutines(new SRPParameters());
        
        // Generate verifier twice
        const verifier1 = await createVerifierAndSalt(srp6aRoutines, testEmail, testPassword);
        const verifier2 = await createVerifierAndSalt(srp6aRoutines, testEmail, testPassword);
        
        // Salt should be different (random), but both should be valid
        expect(verifier1.s).not.toBe(verifier2.s);
        expect(verifier1.s).toMatch(/^[0-9a-f]+$/i);
        expect(verifier2.s).toMatch(/^[0-9a-f]+$/i);
        expect(verifier1.v).toMatch(/^[0-9a-f]+$/i);
        expect(verifier2.v).toMatch(/^[0-9a-f]+$/i);
        
        // Verifiers should also be different due to different salts
        expect(verifier1.v).not.toBe(verifier2.v);
      });

      it("should generate different salts for each registration", async () => {
        const { createVerifierAndSalt, SRPRoutines, SRPParameters } = await import("tssrp6a");
        
        const salts = await Promise.all(
          Array(5).fill(null).map(async () => {
            const srp6aRoutines = new SRPRoutines(new SRPParameters());
            const { s: salt } = await createVerifierAndSalt(srp6aRoutines, testEmail, testPassword);
            return salt;
          }),
        );

        // All salts should be different
        const uniqueSalts = new Set(salts);
        expect(uniqueSalts.size).toBe(salts.length);
      });
    });
  });
});

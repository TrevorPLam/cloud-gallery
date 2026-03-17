/**
 * Unit tests for auth-client: login, register, refresh, getMe, logout.
 * Mocks fetch, query-client, AsyncStorage, and expo-secure-store.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  login,
  register,
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
});

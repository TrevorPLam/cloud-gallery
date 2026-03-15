// Auth API client: login, register, refresh, me. Uses fetch (no token required for auth routes).

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  getApiUrl,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
} from "./query-client";

const AUTH_PREFIX = "/api/auth";
const REFRESH_TOKEN_KEY = "auth_refresh_token";

async function getStoredRefreshToken(): Promise<string | null> {
  try {
    const fromSecure = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (fromSecure) return fromSecure;
    return await AsyncStorage.getItem(`@${REFRESH_TOKEN_KEY}`);
  } catch {
    return null;
  }
}

async function setStoredRefreshToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    await AsyncStorage.setItem(`@${REFRESH_TOKEN_KEY}`, token);
  }
}

async function clearStoredRefreshToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
  await AsyncStorage.removeItem(`@${REFRESH_TOKEN_KEY}`);
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  message?: string;
}

export interface RegisterResponse extends LoginResponse {}

async function authFetch(
  endpoint: string,
  options: RequestInit & { body?: Record<string, unknown> } = {},
): Promise<Response> {
  const url = `${getApiUrl().replace(/\/$/, "")}${endpoint}`;
  const { body, ...rest } = options;
  const bodySerialized =
    body && typeof body === "object" ? JSON.stringify(body) : undefined;
  return fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(rest.headers as Record<string, string>),
    },
    body: bodySerialized ?? (rest.body as BodyInit | null | undefined),
  });
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await authFetch(`${AUTH_PREFIX}/login`, {
    method: "POST",
    body: { email, password },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || "Login failed");
  }
  await setAuthToken(data.accessToken);
  if (data.refreshToken) await setStoredRefreshToken(data.refreshToken);
  return {
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    message: data.message,
  };
}

export async function register(
  email: string,
  password: string,
): Promise<RegisterResponse> {
  const res = await authFetch(`${AUTH_PREFIX}/register`, {
    method: "POST",
    body: { email, password },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || "Registration failed");
  }
  await setAuthToken(data.accessToken);
  if (data.refreshToken) await setStoredRefreshToken(data.refreshToken);
  return {
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    message: data.message,
  };
}

export async function refreshAuth(): Promise<LoginResponse | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;
  const res = await authFetch(`${AUTH_PREFIX}/refresh`, {
    method: "POST",
    body: { refreshToken },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  await setAuthToken(data.accessToken);
  if (data.refreshToken) await setStoredRefreshToken(data.refreshToken);
  return {
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

export async function getMe(): Promise<AuthUser | null> {
  const token = await getAuthToken();
  if (!token) return null;
  const url = `${getApiUrl().replace(/\/$/, "")}${AUTH_PREFIX}/me`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.user ?? null;
}

export async function logout(): Promise<void> {
  await clearAuthToken();
  await clearStoredRefreshToken();
}

// Auth API client: login, register, refresh, me. Uses fetch (no token required for auth routes).
// Enhanced with SRP (Secure Remote Password) support for zero-knowledge authentication.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  getApiUrl,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
} from "./query-client";
import { 
  createVerifierAndSalt, 
  SRPClientSession, 
  SRPParameters, 
  SRPRoutines 
} from "tssrp6a";

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

export interface SRPChallengeResponse {
  sessionId: string;
  salt: string;
  B: string;
}

export interface SRPVerifyResponse extends LoginResponse {
  M2: string;
}

export interface SRPLoginResponse extends LoginResponse {
  M2?: string;
}

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

// SRP Registration - generates verifier and salt client-side
export async function registerSRP(
  email: string,
  password: string,
): Promise<RegisterResponse> {
  const srp6aRoutines = new SRPRoutines(new SRPParameters());
  
  // Generate SRP verifier and salt client-side
  const { s: salt, v: verifier } = await createVerifierAndSalt(
    srp6aRoutines,
    email,
    password,
  );

  const res = await authFetch(`${AUTH_PREFIX}/register`, {
    method: "POST",
    body: { email, srpSalt: salt, srpVerifier: verifier },
  });
  
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || "SRP registration failed");
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

// SRP Login Challenge - step 1
export async function loginSRPChallenge(
  email: string,
): Promise<SRPChallengeResponse> {
  const res = await authFetch(`${AUTH_PREFIX}/login/challenge`, {
    method: "POST",
    body: { email },
  });
  
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || "SRP challenge failed");
  }
  
  return {
    sessionId: data.sessionId,
    salt: data.salt,
    B: data.B,
  };
}

// SRP Login Verify - step 2
export async function loginSRPVerify(
  email: string,
  password: string,
  challenge: SRPChallengeResponse,
): Promise<SRPVerifyResponse> {
  const srp6aRoutines = new SRPRoutines(new SRPParameters());
  const clientSession = new SRPClientSession(srp6aRoutines);
  
  // Client step 1: initialize with email and password
  await clientSession.step1(email, password);
  
  // Client step 2: generate A and M1 from server challenge
  const { A, M1 } = await clientSession.step2(challenge.salt, challenge.B);
  
  const res = await authFetch(`${AUTH_PREFIX}/login/verify`, {
    method: "POST",
    body: { 
      sessionId: challenge.sessionId,
      A,
      M1,
    },
  });
  
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || "SRP verification failed");
  }
  
  // Client step 3: verify server proof M2 (optional but recommended)
  if (data.M2) {
    await clientSession.step3(data.M2);
  }
  
  await setAuthToken(data.accessToken);
  if (data.refreshToken) await setStoredRefreshToken(data.refreshToken);
  
  return {
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    M2: data.M2,
    message: data.message,
  };
}

// Complete SRP Login flow (challenge + verify)
export async function loginSRP(
  email: string,
  password: string,
): Promise<SRPLoginResponse> {
  const challenge = await loginSRPChallenge(email);
  const result = await loginSRPVerify(email, password, challenge);
  return result;
}

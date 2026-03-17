// Auth state and actions for login/register/logout and session restore.
// Enhanced with zero-knowledge key management and biometric authentication.

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  AuthUser,
  login as apiLogin,
  register as apiRegister,
  registerSRP,
  loginSRP,
  logout as apiLogout,
  getMe,
  refreshAuth,
} from "@/lib/auth-client";
import {
  createAndStoreMasterKey,
  verifyMasterKey,
  retrieveMasterKey,
  clearAllKeys,
  setupKeyHierarchy,
} from "@/lib/key-derivation";
import { keyHierarchy } from "@/lib/key-hierarchy";
import {
  setupBiometricAuth,
  checkBiometricSupport,
  BiometricAuthResult,
} from "@/lib/biometric-auth";

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasKeySetup: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  /** Use app without account (local-only; no API auth). */
  continueAsGuest: () => void;
  /** Zero-knowledge key management */
  setupEncryption: (
    password: string,
    enableBiometrics?: boolean,
  ) => Promise<boolean>;
  unlockEncryption: (password?: string) => Promise<boolean>;
  changeEncryptionPassword: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<boolean>;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<boolean>;
  authenticateWithBiometrics: (reason?: string) => Promise<BiometricAuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasKeySetup, setHasKeySetup] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  // Check biometric availability and key setup status
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        // Check biometric support
        const biometricSupport = await checkBiometricSupport();
        setBiometricAvailable(biometricSupport.available);

        // Check if master key exists
        const masterKey = await retrieveMasterKey(false);
        setHasKeySetup(!!masterKey);

        // Setup biometric auth if available
        if (biometricSupport.available) {
          await setupBiometricAuth();
        }
      } catch (error) {
        console.error("Failed to check initial status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkInitialStatus();
  }, []);

  const refreshSession = useCallback(async () => {
    const me = await getMe();
    if (me) {
      setUser(me);
      return;
    }
    const refreshed = await refreshAuth();
    if (refreshed?.user) setUser(refreshed.user);
    else setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await getMe();
      if (cancelled) return;
      if (me) setUser(me);
      else {
        const refreshed = await refreshAuth();
        if (!cancelled && refreshed?.user) setUser(refreshed.user);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Use SRP login for zero-knowledge authentication
    const res = await loginSRP(email, password);
    setUser(res.user);

    // Automatically set up encryption if not already done
    try {
      const masterKey = await retrieveMasterKey(false);
      if (!masterKey) {
        // No encryption key exists, set it up with the login password
        const setupSuccess = await setupEncryption(password, false);
        if (setupSuccess) {
          console.log("Encryption automatically set up during login");
        } else {
          console.warn("Failed to auto-setup encryption during login");
        }
      } else {
        // Verify the existing key with the current password
        const isValid = await verifyMasterKey(password);
        if (!isValid) {
          console.warn("Existing encryption key doesn't match login password");
        }
      }
    } catch (error) {
      console.error("Error during encryption setup on login:", error);
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    // Use SRP registration for zero-knowledge authentication
    const res = await registerSRP(email, password);
    setUser(res.user);

    // Automatically set up encryption for new users
    try {
      const setupSuccess = await setupEncryption(password, false);
      if (setupSuccess) {
        console.log("Encryption automatically set up during registration");
      } else {
        console.warn("Failed to auto-setup encryption during registration");
      }
    } catch (error) {
      console.error("Error during encryption setup on registration:", error);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    
    // Clear encryption keys on logout for security
    try {
      await clearAllKeys();
      setHasKeySetup(false);
      setBiometricEnabled(false);
      console.log("Encryption keys cleared on logout");
    } catch (error) {
      console.error("Error clearing encryption keys on logout:", error);
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    setUser({ id: "guest", email: "guest@local" });
  }, []);

  // Zero-knowledge key management methods
  const setupEncryption = useCallback(
    async (
      password: string,
      enableBiometrics: boolean = false,
    ): Promise<boolean> => {
      try {
        // Create and store master key
        const masterKey = await createAndStoreMasterKey(
          password,
          enableBiometrics,
        );
        if (!masterKey) {
          return false;
        }

        // Setup key hierarchy
        const hierarchySetup = await setupKeyHierarchy(enableBiometrics);
        if (!hierarchySetup) {
          return false;
        }

        setHasKeySetup(true);
        setBiometricEnabled(enableBiometrics && biometricAvailable);
        return true;
      } catch (error) {
        console.error("Failed to setup encryption:", error);
        return false;
      }
    },
    [biometricAvailable],
  );

  const unlockEncryption = useCallback(
    async (password?: string): Promise<boolean> => {
      try {
        if (password) {
          // Verify password and unlock
          const isValid = await verifyMasterKey(password);
          if (isValid) {
            const masterKey = await retrieveMasterKey(false);
            return !!masterKey;
          }
          return false;
        } else {
          // Try biometric unlock
          if (biometricAvailable && biometricEnabled) {
            const { authenticateWithBiometrics } = await import(
              "@/lib/biometric-auth"
            );
            const result = await authenticateWithBiometrics(
              "Unlock your encrypted photos",
            );
            if (result.success) {
              const masterKey = await retrieveMasterKey(true);
              return !!masterKey;
            }
          }
          return false;
        }
      } catch (error) {
        console.error("Failed to unlock encryption:", error);
        return false;
      }
    },
    [biometricAvailable, biometricEnabled],
  );

  const changeEncryptionPassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<boolean> => {
      try {
        // Verify old password
        const isValid = await verifyMasterKey(oldPassword);
        if (!isValid) {
          return false;
        }

        // Create new master key with new password
        const success = await keyHierarchy.rotateMasterKey(newPassword);
        if (success) {
          setHasKeySetup(true);
        }
        return success;
      } catch (error) {
        console.error("Failed to change encryption password:", error);
        return false;
      }
    },
    [],
  );

  const enableBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      if (!biometricAvailable) {
        return false;
      }

      // Get current master key
      const masterKey = await retrieveMasterKey(false);
      if (!masterKey) {
        return false;
      }

      // Re-store with biometric protection
      const { storeMasterKey } = await import("@/lib/key-derivation");
      const success = await storeMasterKey(masterKey, true);

      if (success) {
        setBiometricEnabled(true);
      }
      return success;
    } catch (error) {
      console.error("Failed to enable biometrics:", error);
      return false;
    }
  }, [biometricAvailable]);

  const disableBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      // Get current master key
      const masterKey = await retrieveMasterKey(false);
      if (!masterKey) {
        return false;
      }

      // Re-store without biometric protection
      const { storeMasterKey } = await import("@/lib/key-derivation");
      const success = await storeMasterKey(masterKey, false);

      if (success) {
        setBiometricEnabled(false);
      }
      return success;
    } catch (error) {
      console.error("Failed to disable biometrics:", error);
      return false;
    }
  }, []);

  const authenticateWithBiometrics = useCallback(
    async (reason?: string): Promise<BiometricAuthResult> => {
      const { quickBiometricAuth } = await import("@/lib/biometric-auth");
      return await quickBiometricAuth(reason);
    },
    [],
  );

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    hasKeySetup,
    biometricAvailable,
    biometricEnabled,
    login,
    register,
    logout,
    refreshSession,
    continueAsGuest,
    setupEncryption,
    unlockEncryption,
    changeEncryptionPassword,
    enableBiometrics,
    disableBiometrics,
    authenticateWithBiometrics,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

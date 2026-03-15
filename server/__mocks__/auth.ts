import { vi } from "vitest";

export const authenticateToken = vi.fn((req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token === "valid-test-token") {
    req.user = { id: "test-user-id", email: "test@example.com" };
    next();
  } else {
    return res.status(401).json({
      error: "User not authenticated",
    });
  }
});

export const authRateLimit = vi.fn((req: any, res: any, next: any) => next());
export const verifyAccessToken = vi.fn(() => ({
  id: "test-user-id",
  email: "test@example.com",
}));

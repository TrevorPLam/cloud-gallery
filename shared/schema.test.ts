import { describe, it, expect } from "vitest";
import { users, insertUserSchema, type InsertUser, type User } from "./schema";
import { z } from "zod";

describe("users table schema", () => {
  it("should have all required columns", () => {
    expect(users).toBeDefined();
    expect(users.id).toBeDefined();
    expect(users.username).toBeDefined();
    expect(users.password).toBeDefined();
  });

  it("should have correct column types", () => {
    const columns = users;
    expect(columns.id.dataType).toBe("string");
    expect(columns.username.dataType).toBe("string");
    expect(columns.password.dataType).toBe("string");
  });
});

describe("insertUserSchema", () => {
  it("should validate correct user data", () => {
    const validUser = {
      username: "testuser",
      password: "password123",
    };

    const result = insertUserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("testuser");
      expect(result.data.password).toBe("password123");
    }
  });

  it("should reject missing username", () => {
    const invalidUser = {
      password: "password123",
    };

    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it("should reject missing password", () => {
    const invalidUser = {
      username: "testuser",
    };

    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it("should reject empty object", () => {
    const result = insertUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should allow empty string username", () => {
    const user = {
      username: "",
      password: "password",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  it("should allow empty string password", () => {
    const user = {
      username: "user",
      password: "",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  it("should allow very long username", () => {
    const user = {
      username: "a".repeat(10000),
      password: "password",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  it("should allow very long password", () => {
    const user = {
      username: "user",
      password: "p".repeat(100000),
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  it("should allow unicode characters", () => {
    const user = {
      username: "用户名🎉",
      password: "密码🔒",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("用户名🎉");
      expect(result.data.password).toBe("密码🔒");
    }
  });

  it("should allow special characters", () => {
    const user = {
      username: "user@example.com",
      password: "p@$$w0rd!#",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  it("should reject null values", () => {
    const user = {
      username: null,
      password: "password",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(false);
  });

  it("should reject undefined values", () => {
    const user = {
      username: "user",
      password: undefined,
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(false);
  });

  it("should reject number values", () => {
    const user = {
      username: 12345,
      password: "password",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(false);
  });

  it("should ignore extra fields (pick only username and password)", () => {
    const user = {
      username: "user",
      password: "pass",
      id: "should-be-ignored",
      extraField: "ignored",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        username: "user",
        password: "pass",
      });
      expect((result.data as any).id).toBeUndefined();
      expect((result.data as any).extraField).toBeUndefined();
    }
  });
});

describe("InsertUser type", () => {
  it("should allow valid user data", () => {
    const user: InsertUser = {
      username: "testuser",
      password: "password123",
    };

    expect(user.username).toBe("testuser");
    expect(user.password).toBe("password123");
  });

  it("should be compatible with zod schema", () => {
    const user: InsertUser = {
      username: "user",
      password: "pass",
    };

    const result = insertUserSchema.parse(user);
    expect(result).toEqual(user);
  });
});

describe("User type", () => {
  it("should include id field", () => {
    const user: User = {
      id: "123",
      username: "testuser",
      password: "password123",
    };

    expect(user.id).toBe("123");
    expect(user.username).toBe("testuser");
    expect(user.password).toBe("password123");
  });

  it("should require all fields", () => {
    // TypeScript compilation test - this would fail at compile time
    const user: User = {
      id: "abc",
      username: "user",
      password: "pass",
    };

    expect(user).toBeDefined();
  });
});

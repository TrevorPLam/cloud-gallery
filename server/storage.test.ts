import { describe, it, expect, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import type { InsertUser, User } from "@shared/schema";

describe("MemStorage", () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  describe("createUser", () => {
    it("should create a user with a generated ID", async () => {
      const insertUser: InsertUser = {
        username: "testuser",
        password: "password123",
      };

      const user = await storage.createUser(insertUser);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe("testuser");
      expect(user.password).toBe("password123");
      expect(typeof user.id).toBe("string");
      expect(user.id.length).toBeGreaterThan(0);
    });

    it("should create multiple users with unique IDs", async () => {
      const user1 = await storage.createUser({
        username: "user1",
        password: "pass1",
      });
      const user2 = await storage.createUser({
        username: "user2",
        password: "pass2",
      });

      expect(user1.id).not.toBe(user2.id);
      expect(user1.username).toBe("user1");
      expect(user2.username).toBe("user2");
    });

    it("should preserve all user fields", async () => {
      const insertUser: InsertUser = {
        username: "fulluser",
        password: "securepassword",
      };

      const user = await storage.createUser(insertUser);

      expect(user.username).toBe(insertUser.username);
      expect(user.password).toBe(insertUser.password);
    });
  });

  describe("getUser", () => {
    it("should return undefined for non-existent user", async () => {
      const user = await storage.getUser("non-existent-id");
      expect(user).toBeUndefined();
    });

    it("should return user by ID after creation", async () => {
      const created = await storage.createUser({
        username: "testuser",
        password: "password123",
      });

      const retrieved = await storage.getUser(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.username).toBe("testuser");
      expect(retrieved?.password).toBe("password123");
    });

    it("should return correct user when multiple users exist", async () => {
      const user1 = await storage.createUser({
        username: "user1",
        password: "pass1",
      });
      const user2 = await storage.createUser({
        username: "user2",
        password: "pass2",
      });
      const user3 = await storage.createUser({
        username: "user3",
        password: "pass3",
      });

      const retrieved2 = await storage.getUser(user2.id);
      expect(retrieved2?.username).toBe("user2");
      expect(retrieved2?.password).toBe("pass2");
    });
  });

  describe("getUserByUsername", () => {
    it("should return undefined for non-existent username", async () => {
      const user = await storage.getUserByUsername("nonexistent");
      expect(user).toBeUndefined();
    });

    it("should return user by username after creation", async () => {
      await storage.createUser({
        username: "testuser",
        password: "password123",
      });

      const retrieved = await storage.getUserByUsername("testuser");

      expect(retrieved).toBeDefined();
      expect(retrieved?.username).toBe("testuser");
      expect(retrieved?.password).toBe("password123");
    });

    it("should return correct user when multiple users exist", async () => {
      await storage.createUser({ username: "alice", password: "pass1" });
      await storage.createUser({ username: "bob", password: "pass2" });
      await storage.createUser({ username: "charlie", password: "pass3" });

      const bob = await storage.getUserByUsername("bob");
      expect(bob).toBeDefined();
      expect(bob?.username).toBe("bob");
      expect(bob?.password).toBe("pass2");
    });

    it("should be case-sensitive", async () => {
      await storage.createUser({
        username: "TestUser",
        password: "password123",
      });

      const lowerCase = await storage.getUserByUsername("testuser");
      const upperCase = await storage.getUserByUsername("TESTUSER");
      const correctCase = await storage.getUserByUsername("TestUser");

      expect(lowerCase).toBeUndefined();
      expect(upperCase).toBeUndefined();
      expect(correctCase).toBeDefined();
      expect(correctCase?.username).toBe("TestUser");
    });

    it("should handle special characters in username", async () => {
      const specialUsername = "user@example.com";
      await storage.createUser({
        username: specialUsername,
        password: "password123",
      });

      const retrieved = await storage.getUserByUsername(specialUsername);
      expect(retrieved).toBeDefined();
      expect(retrieved?.username).toBe(specialUsername);
    });
  });

  describe("IStorage interface compliance", () => {
    it("should implement all IStorage methods", () => {
      expect(storage.getUser).toBeDefined();
      expect(storage.getUserByUsername).toBeDefined();
      expect(storage.createUser).toBeDefined();
      expect(typeof storage.getUser).toBe("function");
      expect(typeof storage.getUserByUsername).toBe("function");
      expect(typeof storage.createUser).toBe("function");
    });
  });

  describe("edge cases", () => {
    it("should handle empty username", async () => {
      const user = await storage.createUser({
        username: "",
        password: "password",
      });
      expect(user.username).toBe("");

      const retrieved = await storage.getUserByUsername("");
      expect(retrieved).toBeDefined();
      expect(retrieved?.username).toBe("");
    });

    it("should handle empty password", async () => {
      const user = await storage.createUser({
        username: "user",
        password: "",
      });
      expect(user.password).toBe("");
    });

    it("should handle very long username", async () => {
      const longUsername = "a".repeat(1000);
      const user = await storage.createUser({
        username: longUsername,
        password: "pass",
      });
      expect(user.username).toBe(longUsername);

      const retrieved = await storage.getUserByUsername(longUsername);
      expect(retrieved?.username).toBe(longUsername);
    });

    it("should handle very long password", async () => {
      const longPassword = "p".repeat(10000);
      const user = await storage.createUser({
        username: "user",
        password: longPassword,
      });
      expect(user.password).toBe(longPassword);
    });

    it("should handle unicode characters in username", async () => {
      const unicodeUsername = "用户名🎉";
      const user = await storage.createUser({
        username: unicodeUsername,
        password: "pass",
      });
      expect(user.username).toBe(unicodeUsername);

      const retrieved = await storage.getUserByUsername(unicodeUsername);
      expect(retrieved?.username).toBe(unicodeUsername);
    });
  });
});

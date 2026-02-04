// AI-META-BEGIN
// AI-META: In-memory storage implementation for user data (development/testing)
// OWNERSHIP: server/storage
// ENTRYPOINTS: imported by server routes for user CRUD operations
// DEPENDENCIES: shared/schema (User types), crypto (UUID generation)
// DANGER: in-memory storage loses data on restart; passwords stored in map without encryption; not production-ready
// CHANGE-SAFETY: safe to add methods to IStorage interface; do not remove existing methods; consider DB migration for production
// TESTS: unit tests for CRUD operations, check:types
// AI-META-END

import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

// AI-NOTE: MemStorage provides in-memory persistence for development; replace with database-backed implementation for production
export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  // AI-NOTE: UUIDs prevent ID collision in distributed scenarios; consider hashing passwords before storage
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();

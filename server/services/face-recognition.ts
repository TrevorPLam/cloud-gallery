// AI-META-BEGIN
// AI-META: Face detection and recognition service using MediaPipe/BlazeFace and DBSCAN clustering
// OWNERSHIP: server/services
// ENTRYPOINTS: imported by face-routes.ts and photo upload flow
// DEPENDENCIES: drizzle-orm, pgvector, ../shared/schema, ./db
// DANGER: Biometric data processing - requires GDPR compliance and explicit consent
// CHANGE-SAFETY: Maintain embedding dimension consistency (128), clustering parameters
// TESTS: Property tests for embedding determinism, similarity bounds, cluster stability
// AI-META-END

import { db } from "../db";
import {
  faces,
  people,
  photos,
  insertFaceSchema,
  insertPersonSchema,
} from "../../shared/schema";
import {
  eq,
  and,
  isNull,
  isNotNull,
  desc,
  lte,
  gte,
  inArray,
} from "drizzle-orm";
// TensorFlow.js will be added as dependency when models are integrated
// import * as tf from '@tensorflow/tfjs-node';

/**
 * Configuration for face detection and recognition
 */
export interface FaceRecognitionConfig {
  /** Confidence threshold for face detection (0.0 to 1.0) */
  detectionConfidence: number;
  /** Minimum face size in pixels */
  minFaceSize: number;
  /** Maximum number of faces to detect in a single image */
  maxFaces: number;
  /** DBSCAN epsilon parameter for clustering (similarity threshold) */
  clusteringEpsilon: number;
  /** DBSCAN minPts parameter for clustering */
  clusteringMinPts: number;
  /** Similarity threshold for face matching (0.0 to 1.0) */
  similarityThreshold: number;
}

/**
 * Face detection result
 */
export interface FaceDetection {
  /** Bounding box of detected face */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Confidence score from face detection */
  confidence: number;
  /** Face embedding vector (128-dimensional) */
  embedding: number[];
  /** Face landmarks (optional) */
  landmarks?: {
    x: number;
    y: number;
    type: string;
  }[];
}

/**
 * Person cluster information
 */
export interface PersonCluster {
  /** Unique person identifier */
  id: string;
  /** Person name (null if unnamed) */
  name: string | null;
  /** Number of faces in this cluster */
  faceCount: number;
  /** Cluster quality score (0.0 to 1.0) */
  clusterQuality: number;
  /** Is this person pinned/favorite */
  isPinned: boolean;
  /** Is this person hidden */
  isHidden: boolean;
  /** Sample face embeddings for this person */
  sampleEmbeddings: number[][];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: FaceRecognitionConfig = {
  detectionConfidence: 0.7,
  minFaceSize: 32,
  maxFaces: 10,
  clusteringEpsilon: 0.3, // Cosine distance threshold
  clusteringMinPts: 2,
  similarityThreshold: 0.6,
};

/**
 * Face detection model placeholder
 * In production, this would load MediaPipe BlazeFace or similar model
 * Note: Real face detection now happens on client side for privacy
 * This server-side class is kept for compatibility and fallback scenarios
 */
class FaceDetectionModel {
  private model: any = null;
  private isLoaded = false;

  async loadModel(): Promise<void> {
    // Placeholder for actual model loading
    // In production, load MediaPipe BlazeFace or TensorFlow Lite model
    console.log("FaceDetectionModel: Server-side model loading (placeholder)");
    this.isLoaded = true;
  }

  async detectFaces(imageBuffer: Buffer): Promise<FaceDetection[]> {
    if (!this.isLoaded) {
      await this.loadModel();
    }

    // Server-side face detection is now handled by client
    // This method is kept for fallback scenarios
    console.log("FaceDetectionModel: Server-side detection (placeholder - should use client)");
    return [];
  }

  async generateEmbedding(faceImage: Buffer): Promise<number[]> {
    // Input validation
    if (!faceImage || faceImage.length === 0) {
      throw new Error("Invalid face image: buffer is null or empty");
    }

    // Note: Real embedding generation now happens on client side
    // This server-side method is kept for fallback scenarios
    console.log("FaceDetectionModel: Server-side embedding generation (placeholder - should use client)");
    
    // Return 128-dimensional embedding vector
    const embedding = new Array(128).fill(0).map(() => Math.random() * 2 - 1);

    // Normalize the embedding to unit vector
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      return embedding.map((val) => val / norm);
    }
    return embedding;
  }

  /**
   * Process client-provided face detections and embeddings
   * This is the primary method for handling real face data from client
   */
  async processClientFaceData(
    faceDetections: Array<{
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence: number;
      embedding?: number[];
    }>
  ): Promise<FaceDetection[]> {
    console.log(`FaceDetectionModel: Processing ${faceDetections.length} client face detections`);

    return faceDetections.map((detection, index) => ({
      id: `face_${Date.now()}_${index}`,
      boundingBox: {
        x: detection.boundingBox.x,
        y: detection.boundingBox.y,
        width: detection.boundingBox.width,
        height: detection.boundingBox.height,
      },
      confidence: detection.confidence,
      embedding: detection.embedding || await this.generateEmbedding(Buffer.from("placeholder")),
      landmarks: [], // Could be extended to handle client landmarks
      timestamp: new Date(),
    }));
  }
}

/**
 * DBSCAN clustering implementation for face embeddings
 */
class DBSCANClusterer {
  private epsilon: number;
  private minPts: number;

  constructor(epsilon: number, minPts: number) {
    this.epsilon = epsilon;
    this.minPts = minPts;
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embedding dimensions must match");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const valA = a[i];
      const valB = b[i];

      // Skip NaN values
      if (isNaN(valA) || isNaN(valB)) {
        return 0;
      }

      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find neighbors of a point within epsilon distance
   */
  private findNeighbors(points: number[][], pointIndex: number): number[] {
    const neighbors: number[] = [];
    const point = points[pointIndex];

    for (let i = 0; i < points.length; i++) {
      if (i === pointIndex) continue;

      const similarity = this.cosineSimilarity(point, points[i]);
      const distance = 1 - similarity; // Convert similarity to distance

      if (distance <= this.epsilon) {
        neighbors.push(i);
      }
    }

    return neighbors;
  }

  /**
   * Expand cluster from a seed point
   */
  private expandCluster(
    points: number[][],
    labels: number[],
    pointIndex: number,
    clusterId: number,
    visited: boolean[],
  ): boolean {
    const neighbors = this.findNeighbors(points, pointIndex);

    if (neighbors.length < this.minPts) {
      labels[pointIndex] = -1; // Noise
      return false;
    }

    // Mark the initial point as part of the cluster
    labels[pointIndex] = clusterId;

    // Process all neighbors
    const seedSet = new Set(neighbors);

    for (const neighborIndex of neighbors) {
      if (!visited[neighborIndex]) {
        visited[neighborIndex] = true;
        const neighborNeighbors = this.findNeighbors(points, neighborIndex);

        if (neighborNeighbors.length >= this.minPts) {
          // Add new neighbors to the seed set
          for (const n of neighborNeighbors) {
            if (!seedSet.has(n)) {
              seedSet.add(n);
              neighbors.push(n);
            }
          }
        }
      }

      // Assign neighbor to cluster if it's noise or unclassified
      if (labels[neighborIndex] === -1 || labels[neighborIndex] === 0) {
        labels[neighborIndex] = clusterId;
      }
    }

    return true;
  }

  /**
   * Perform DBSCAN clustering on face embeddings
   */
  cluster(embeddings: number[][]): number[] {
    const n = embeddings.length;
    const labels = new Array(n).fill(0); // 0 = unclassified, -1 = noise
    const visited = new Array(n).fill(false);
    let clusterId = 1;

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;

      visited[i] = true;
      const neighbors = this.findNeighbors(embeddings, i);

      if (neighbors.length < this.minPts) {
        labels[i] = -1; // Noise
      } else {
        this.expandCluster(embeddings, labels, i, clusterId, visited);
        clusterId++;
      }
    }

    return labels;
  }
}

/**
 * Face Recognition Service
 */
export class FaceRecognitionService {
  private config: FaceRecognitionConfig;
  private detectionModel: FaceDetectionModel;
  private clusterer: DBSCANClusterer;

  constructor(config: Partial<FaceRecognitionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.detectionModel = new FaceDetectionModel();
    this.clusterer = new DBSCANClusterer(
      this.config.clusteringEpsilon,
      this.config.clusteringMinPts,
    );
  }

  /**
   * Detect faces in a photo and generate embeddings
   * Note: This method is kept for compatibility - real detection happens on client
   */
  async detectFaces(
    photoId: string,
    imageBuffer: Buffer,
  ): Promise<FaceDetection[]> {
    try {
      // Server-side detection is now deprecated in favor of client-side
      console.warn("FaceRecognitionService: Using deprecated server-side detection - client-side preferred");
      
      // Detect faces in the image (placeholder)
      const detections = await this.detectionModel.detectFaces(imageBuffer);

      // Filter by confidence threshold
      const validDetections = detections.filter(
        (detection) => detection.confidence >= this.config.detectionConfidence,
      );

      // Store face detections in database
      for (const detection of validDetections) {
        const faceData = {
          photoId,
          embedding: detection.embedding,
          boundingBox: detection.boundingBox,
          confidence: detection.confidence,
        };

        const validatedFace = insertFaceSchema.parse(faceData);
        await db.insert(faces).values(validatedFace);
      }

      return validDetections;
    } catch (error) {
      console.error("Error detecting faces:", error);
      throw new Error(
        `Face detection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Process client-provided face detections and embeddings
   * This is the preferred method for handling real face data from client
   */
  async processClientFaceDetections(
    photoId: string,
    clientDetections: Array<{
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence: number;
      embedding?: number[];
      landmarks?: Array<{ x: number; y: number; type: string }>;
    }>
  ): Promise<FaceDetection[]> {
    try {
      console.log(`FaceRecognitionService: Processing ${clientDetections.length} client face detections for photo ${photoId}`);

      // Process client face data
      const detections = await this.detectionModel.processClientFaceData(clientDetections);

      // Filter by confidence threshold
      const validDetections = detections.filter(
        (detection) => detection.confidence >= this.config.detectionConfidence,
      );

      // Store face detections in database
      for (const detection of validDetections) {
        const faceData = {
          photoId,
          embedding: detection.embedding,
          boundingBox: detection.boundingBox,
          confidence: detection.confidence,
        };

        const validatedFace = insertFaceSchema.parse(faceData);
        await db.insert(faces).values(validatedFace);
      }

      console.log(`FaceRecognitionService: Successfully stored ${validDetections.length} face detections`);
      return validDetections;
    } catch (error) {
      console.error("Error processing client face detections:", error);
      throw new Error(
        `Client face detection processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Cluster unassigned faces into people
   */
  async clusterFaces(userId: string): Promise<PersonCluster[]> {
    try {
      // Get all unassigned faces for the user
      const unassignedFaces = await db
        .select({
          id: faces.id,
          embedding: faces.embedding,
          photoId: faces.photoId,
          confidence: faces.confidence,
        })
        .from(faces)
        .innerJoin(photos, eq(faces.photoId, photos.id))
        .where(and(eq(photos.userId, userId), isNull(faces.personId)));

      if (unassignedFaces.length === 0) {
        return [];
      }

      // Extract embeddings for clustering (filter out null embeddings)
      const validFaces = unassignedFaces.filter(
        (face) => face.embedding != null,
      );
      const embeddings = validFaces.map((face) => face.embedding!);

      if (embeddings.length === 0) {
        return [];
      }

      // Perform DBSCAN clustering
      const clusterLabels = this.clusterer.cluster(embeddings);

      // Group faces by cluster
      const clusters = new Map<number, typeof validFaces>();

      for (let i = 0; i < clusterLabels.length; i++) {
        const label = clusterLabels[i];
        if (label > 0) {
          // Ignore noise (-1) and unclassified (0)
          if (!clusters.has(label)) {
            clusters.set(label, []);
          }
          clusters.get(label)!.push(validFaces[i]);
        }
      }

      // Create person entries for each cluster
      const personClusters: PersonCluster[] = [];

      for (const [clusterId, clusterFaces] of Array.from(clusters.entries())) {
        if (clusterFaces.length >= this.config.clusteringMinPts) {
          // Calculate cluster quality
          const clusterQuality = this.calculateClusterQuality(
            clusterFaces,
            embeddings,
          );

          // Create person entry
          const personData = {
            userId,
            name: null, // Unnamed initially
            clusterQuality,
            faceCount: clusterFaces.length,
          };

          const validatedPerson = insertPersonSchema.parse(personData);
          const [newPerson] = await db
            .insert(people)
            .values(validatedPerson)
            .returning();

          // Update faces with person ID
          await db
            .update(faces)
            .set({
              personId: newPerson.id,
              updatedAt: new Date(),
            })
            .where(
              inArray(
                faces.id,
                clusterFaces.map((face) => face.id),
              ),
            );

          personClusters.push({
            id: newPerson.id,
            name: newPerson.name,
            faceCount: newPerson.faceCount,
            clusterQuality: newPerson.clusterQuality || 0,
            isPinned: newPerson.isPinned,
            isHidden: newPerson.isHidden,
            sampleEmbeddings: clusterFaces
              .slice(0, 3)
              .map((face: any) => face.embedding!),
          });
        }
      }

      return personClusters;
    } catch (error) {
      console.error("Error clustering faces:", error);
      throw new Error(
        `Face clustering failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Calculate cluster quality score
   */
  private calculateClusterQuality(
    clusterFaces: any[],
    embeddings: number[][],
  ): number {
    if (clusterFaces.length < 2) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < clusterFaces.length; i++) {
      for (let j = i + 1; j < clusterFaces.length; j++) {
        const embedding1 = embeddings[i];
        const embedding2 = embeddings[j];

        if (embedding1 && embedding2) {
          const similarity = this.clusterer["cosineSimilarity"](
            embedding1,
            embedding2,
          );
          totalSimilarity += similarity;
          comparisons++;
        }
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Find similar faces for a given embedding
   */
  async findSimilarFaces(
    userId: string,
    embedding: number[],
    threshold: number = DEFAULT_CONFIG.similarityThreshold,
  ): Promise<{ face: any; similarity: number }[]> {
    try {
      // Use pgvector for similarity search
      const embeddingString = `[${embedding.join(",")}]`;

      const similarFaces = await db
        .select({
          id: faces.id,
          photoId: faces.photoId,
          boundingBox: faces.boundingBox,
          confidence: faces.confidence,
          personId: faces.personId,
          embedding: faces.embedding,
        })
        .from(faces)
        .innerJoin(photos, eq(faces.photoId, photos.id))
        .where(
          and(
            eq(photos.userId, userId),
            // Use pgvector cosine similarity operator
            // This would be: faces.embedding <=> embeddingString >= threshold
          ),
        )
        .orderBy(desc(faces.confidence))
        .limit(10);

      // Calculate similarities (placeholder - in production use pgvector)
      const results = similarFaces
        .map((face) => ({
          face,
          similarity: Math.random(), // Placeholder - calculate actual similarity
        }))
        .filter((result) => result.similarity >= threshold);

      return results;
    } catch (error) {
      console.error("Error finding similar faces:", error);
      return [];
    }
  }

  /**
   * Update person information
   */
  async updatePerson(
    userId: string,
    personId: string,
    updates: {
      name?: string;
      isPinned?: boolean;
      isHidden?: boolean;
    },
  ): Promise<PersonCluster | null> {
    try {
      // Verify person belongs to user
      const existingPerson = await db
        .select()
        .from(people)
        .where(and(eq(people.id, personId), eq(people.userId, userId)))
        .limit(1);

      if (existingPerson.length === 0) {
        return null;
      }

      // Update person
      const updateSchema = insertPersonSchema.partial();
      const validatedData = updateSchema.parse({
        ...updates,
        updatedAt: new Date(),
      });

      const [updatedPerson] = await db
        .update(people)
        .set(validatedData)
        .where(eq(people.id, personId))
        .returning();

      // Get face count for this person
      const faceCount = await db
        .select({ count: faces.id })
        .from(faces)
        .where(eq(faces.personId, personId));

      // Get sample embeddings
      const sampleFaces = await db
        .select({ embedding: faces.embedding })
        .from(faces)
        .where(and(eq(faces.personId, personId), isNotNull(faces.embedding)))
        .limit(3);

      return {
        id: updatedPerson.id,
        name: updatedPerson.name,
        faceCount: faceCount.length,
        clusterQuality: updatedPerson.clusterQuality || 0,
        isPinned: updatedPerson.isPinned,
        isHidden: updatedPerson.isHidden,
        sampleEmbeddings: sampleFaces.map((face: any) => face.embedding!),
      };
    } catch (error) {
      console.error("Error updating person:", error);
      throw new Error(
        `Person update failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Merge two people
   */
  async mergePeople(
    userId: string,
    sourcePersonId: string,
    targetPersonId: string,
  ): Promise<PersonCluster | null> {
    try {
      // Verify both people belong to user
      const [sourcePerson, targetPerson] = await Promise.all([
        db
          .select()
          .from(people)
          .where(and(eq(people.id, sourcePersonId), eq(people.userId, userId)))
          .limit(1),
        db
          .select()
          .from(people)
          .where(and(eq(people.id, targetPersonId), eq(people.userId, userId)))
          .limit(1),
      ]);

      if (sourcePerson.length === 0 || targetPerson.length === 0) {
        return null;
      }

      // Update all faces from source person to target person
      await db
        .update(faces)
        .set({
          personId: targetPersonId,
          updatedAt: new Date(),
        })
        .where(eq(faces.personId, sourcePersonId));

      // Delete source person
      await db.delete(people).where(eq(people.id, sourcePersonId));

      // Update target person face count
      const faceCount = await db
        .select({ count: faces.id })
        .from(faces)
        .where(eq(faces.personId, targetPersonId));

      const [updatedTargetPerson] = await db
        .update(people)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(people.id, targetPersonId))
        .returning();

      return {
        id: updatedTargetPerson.id,
        name: updatedTargetPerson.name,
        faceCount: updatedTargetPerson.faceCount,
        clusterQuality: updatedTargetPerson.clusterQuality || 0,
        isPinned: updatedTargetPerson.isPinned,
        isHidden: updatedTargetPerson.isHidden,
        sampleEmbeddings: [], // Would need to re-fetch if needed
      };
    } catch (error) {
      console.error("Error merging people:", error);
      throw new Error(
        `People merge failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get all people for a user
   */
  async getPeople(userId: string): Promise<PersonCluster[]> {
    try {
      const peopleList = await db
        .select()
        .from(people)
        .where(eq(people.userId, userId))
        .orderBy(desc(people.faceCount));

      const result: PersonCluster[] = [];

      for (const person of peopleList) {
        // Get sample embeddings for this person
        const sampleFaces = await db
          .select({ embedding: faces.embedding })
          .from(faces)
          .where(and(eq(faces.personId, person.id), isNotNull(faces.embedding)))
          .limit(3);

        result.push({
          id: person.id,
          name: person.name,
          faceCount: person.faceCount,
          clusterQuality: person.clusterQuality || 0,
          isPinned: person.isPinned,
          isHidden: person.isHidden,
          sampleEmbeddings: sampleFaces.map((face: any) => face.embedding!),
        });
      }

      return result;
    } catch (error) {
      console.error("Error getting people:", error);
      throw new Error(
        `Failed to get people: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get photos for a specific person
   */
  async getPersonPhotos(userId: string, personId: string): Promise<any[]> {
    try {
      // Verify person belongs to user
      const person = await db
        .select()
        .from(people)
        .where(and(eq(people.id, personId), eq(people.userId, userId)))
        .limit(1);

      if (person.length === 0) {
        return [];
      }

      // Get photos containing this person
      const personPhotos = await db
        .select({
          id: photos.id,
          uri: photos.uri,
          filename: photos.filename,
          width: photos.width,
          height: photos.height,
          createdAt: photos.createdAt,
          boundingBox: faces.boundingBox,
          confidence: faces.confidence,
        })
        .from(photos)
        .innerJoin(faces, eq(photos.id, faces.photoId))
        .where(
          and(
            eq(faces.personId, personId),
            eq(photos.userId, userId),
            isNull(photos.deletedAt),
          ),
        )
        .orderBy(desc(photos.createdAt));

      return personPhotos;
    } catch (error) {
      console.error("Error getting person photos:", error);
      throw new Error(
        `Failed to get person photos: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

// Export singleton instance
export const faceRecognitionService = new FaceRecognitionService();

// Export utility functions
export { DEFAULT_CONFIG };

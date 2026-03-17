// AI-META-BEGIN
// AI-META: DBSCAN clustering algorithm for automatic person grouping with cosine similarity
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by PeopleScreen and face management services
// DEPENDENCIES: face-embeddings.ts, Platform, AsyncStorage
// DANGER: Biometric data clustering - requires GDPR compliance and privacy controls
// CHANGE-SAFETY: Maintain epsilon=0.3, minPts=2 parameters for consistent clustering
// TESTS: client/lib/ml/face-clustering.test.ts
// AI-META-END

import AsyncStorage from "@react-native-async-storage/async-storage";
import { FaceEmbedding, FaceEmbeddingService } from "./face-embeddings";

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface Person {
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
  /** Cluster creation timestamp */
  createdAt: number;
  /** Last updated timestamp */
  updatedAt: number;
}

export interface ClusterResult {
  /** Array of person clusters */
  people: Person[];
  /** Number of unclustered faces */
  unclusteredCount: number;
  /** Clustering metadata */
  metadata: {
    totalFaces: number;
    clusteringTime: number;
    epsilon: number;
    minPts: number;
    algorithm: "dbscan";
  };
}

export interface FaceClusteringConfig {
  /** DBSCAN epsilon parameter (cosine similarity threshold) */
  epsilon: number;
  /** DBSCAN minPts parameter (minimum points for cluster) */
  minPts: number;
  /** Minimum cluster quality threshold */
  minClusterQuality: number;
  /** Maximum number of sample embeddings per person */
  maxSampleEmbeddings: number;
  /** Whether to persist clusters to storage */
  persistClusters: boolean;
}

export interface FaceClusteringStats {
  totalClusters: number;
  totalFaces: number;
  averageClusterSize: number;
  averageClusterQuality: number;
  clusteringTime: number;
  lastClusteringTimestamp: number;
}

// ─────────────────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  CLUSTERS: "@face_clusters",
  CONFIG: "@face_clustering_config",
  STATS: "@face_clustering_stats",
} as const;

// ─────────────────────────────────────────────────────────
// FACE CLUSTERING SERVICE
// ─────────────────────────────────────────────────────────

export class FaceClusteringService {
  private config: FaceClusteringConfig;
  private embeddingService = new FaceEmbeddingService();
  private stats: FaceClusteringStats = {
    totalClusters: 0,
    totalFaces: 0,
    averageClusterSize: 0,
    averageClusterQuality: 0,
    clusteringTime: 0,
    lastClusteringTimestamp: 0,
  };

  constructor(config: Partial<FaceClusteringConfig> = {}) {
    this.config = {
      epsilon: 0.3, // Cosine similarity threshold (based on research)
      minPts: 2, // Minimum points for cluster (based on research)
      minClusterQuality: 0.7,
      maxSampleEmbeddings: 5,
      persistClusters: true,
      ...config,
    };

    this.loadPersistedData();
  }

  // ─── CLUSTERING ALGORITHMS ─────────────────────────────────

  /**
   * Cluster face embeddings using DBSCAN algorithm
   */
  async clusterFaces(embeddings: FaceEmbedding[]): Promise<ClusterResult> {
    const startTime = Date.now();

    try {
      // Extract embedding vectors
      const vectors = embeddings.map((e) => e.vector);

      // Run DBSCAN clustering
      const clusters = this._dbscanClustering(vectors);

      // Convert clusters to Person objects
      const people = this._clustersToPeople(clusters, embeddings);

      // Calculate clustering metadata
      const clusteringTime = Date.now() - startTime;
      const unclusteredCount =
        embeddings.length -
        people.reduce((sum, person) => sum + person.faceCount, 0);

      const result: ClusterResult = {
        people,
        unclusteredCount,
        metadata: {
          totalFaces: embeddings.length,
          clusteringTime,
          epsilon: this.config.epsilon,
          minPts: this.config.minPts,
          algorithm: "dbscan",
        },
      };

      // Update statistics
      this._updateStats(result);

      // Persist clusters if enabled
      if (this.config.persistClusters) {
        await this._persistClusters(result.people);
      }

      console.log("FaceClusteringService: Clustering completed", {
        clusters: people.length,
        unclustered: unclusteredCount,
        time: clusteringTime,
      });

      return result;
    } catch (error) {
      console.error("FaceClusteringService: Clustering failed:", error);
      throw error;
    }
  }

  /**
   * DBSCAN clustering implementation with cosine similarity
   */
  private _dbscanClustering(vectors: number[][]): number[][] {
    const n = vectors.length;
    const visited = new Array(n).fill(false);
    const clusters: number[][] = [];
    const noise: number[] = [];

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;

      visited[i] = true;
      const neighbors = this._getNeighbors(vectors, i);

      if (neighbors.length < this.config.minPts) {
        noise.push(i);
      } else {
        const cluster = [i];
        this._expandCluster(vectors, cluster, neighbors, visited);
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Get neighbors of a point within epsilon distance
   */
  private _getNeighbors(vectors: number[][], pointIndex: number): number[] {
    const neighbors: number[] = [];
    const point = vectors[pointIndex];

    for (let i = 0; i < vectors.length; i++) {
      if (i === pointIndex) continue;

      const similarity = FaceEmbeddingService.cosineSimilarity(
        point,
        vectors[i],
      );
      const distance = 1 - similarity; // Convert similarity to distance

      if (distance <= this.config.epsilon) {
        neighbors.push(i);
      }
    }

    return neighbors;
  }

  /**
   * Expand cluster by adding reachable points
   */
  private _expandCluster(
    vectors: number[][],
    cluster: number[],
    neighbors: number[],
    visited: boolean[],
  ): void {
    let i = 0;
    while (i < neighbors.length) {
      const neighborIndex = neighbors[i];

      if (!visited[neighborIndex]) {
        visited[neighborIndex] = true;
        const neighborNeighbors = this._getNeighbors(vectors, neighborIndex);

        if (neighborNeighbors.length >= this.config.minPts) {
          neighbors.push(
            ...neighborNeighbors.filter((n) => !neighbors.includes(n)),
          );
        }
      }

      if (!cluster.includes(neighborIndex)) {
        cluster.push(neighborIndex);
      }

      i++;
    }
  }

  /**
   * Convert cluster indices to Person objects
   */
  private _clustersToPeople(
    clusters: number[][],
    embeddings: FaceEmbedding[],
  ): Person[] {
    return clusters.map((cluster, index) => {
      const clusterEmbeddings = cluster.map((i) => embeddings[i]);

      // Calculate cluster quality
      const quality = this._calculateClusterQuality(clusterEmbeddings);

      // Select sample embeddings (representative faces)
      const sampleEmbeddings = this._selectSampleEmbeddings(clusterEmbeddings);

      return {
        id: this._generatePersonId(index),
        name: null, // Unnamed by default
        faceCount: cluster.length,
        clusterQuality: quality,
        isPinned: false,
        isHidden: false,
        sampleEmbeddings,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });
  }

  /**
   * Calculate cluster quality score
   */
  private _calculateClusterQuality(embeddings: FaceEmbedding[]): number {
    if (embeddings.length < 2) return 1.0;

    // Calculate intra-cluster similarity
    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const similarity = FaceEmbeddingService.cosineSimilarity(
          embeddings[i].vector,
          embeddings[j].vector,
        );
        totalSimilarity += similarity;
        pairCount++;
      }
    }

    const averageSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;

    // Factor in embedding qualities
    const averageQuality =
      embeddings.reduce((sum, e) => sum + e.quality, 0) / embeddings.length;

    // Combined quality score
    return averageSimilarity * 0.7 + averageQuality * 0.3;
  }

  /**
   * Select representative sample embeddings for the person
   */
  private _selectSampleEmbeddings(embeddings: FaceEmbedding[]): number[][] {
    if (embeddings.length <= this.config.maxSampleEmbeddings) {
      return embeddings.map((e) => e.vector);
    }

    // Sort by quality and select top embeddings
    const sortedEmbeddings = [...embeddings].sort(
      (a, b) => b.quality - a.quality,
    );
    return sortedEmbeddings
      .slice(0, this.config.maxSampleEmbeddings)
      .map((e) => e.vector);
  }

  /**
   * Generate unique person ID
   */
  private _generatePersonId(index: number): string {
    return `person_${Date.now()}_${index}`;
  }

  // ─── PERSON MANAGEMENT ─────────────────────────────────────

  /**
   * Update person information
   */
  async updatePerson(
    personId: string,
    updates: Partial<Person>,
  ): Promise<Person | null> {
    const clusters = await this.loadClusters();
    const personIndex = clusters.findIndex((p) => p.id === personId);

    if (personIndex === -1) {
      return null;
    }

    const updatedPerson = {
      ...clusters[personIndex],
      ...updates,
      updatedAt: Date.now(),
    };
    clusters[personIndex] = updatedPerson;

    await this._persistClusters(clusters);
    return updatedPerson;
  }

  /**
   * Merge two people
   */
  async mergePeople(
    sourcePersonId: string,
    targetPersonId: string,
  ): Promise<Person | null> {
    const clusters = await this.loadClusters();
    const sourcePerson = clusters.find((p) => p.id === sourcePersonId);
    const targetPerson = clusters.find((p) => p.id === targetPersonId);

    if (!sourcePerson || !targetPerson) {
      return null;
    }

    // Merge sample embeddings
    const mergedEmbeddings = [
      ...targetPerson.sampleEmbeddings,
      ...sourcePerson.sampleEmbeddings,
    ].slice(0, this.config.maxSampleEmbeddings);

    // Update target person
    const mergedPerson: Person = {
      ...targetPerson,
      faceCount: targetPerson.faceCount + sourcePerson.faceCount,
      sampleEmbeddings: mergedEmbeddings,
      updatedAt: Date.now(),
    };

    // Remove source person
    const filteredClusters = clusters.filter((p) => p.id !== sourcePersonId);
    const targetIndex = filteredClusters.findIndex(
      (p) => p.id === targetPersonId,
    );
    filteredClusters[targetIndex] = mergedPerson;

    await this._persistClusters(filteredClusters);
    return mergedPerson;
  }

  /**
   * Delete person
   */
  async deletePerson(personId: string): Promise<boolean> {
    const clusters = await this.loadClusters();
    const filteredClusters = clusters.filter((p) => p.id !== personId);

    if (filteredClusters.length === clusters.length) {
      return false; // Person not found
    }

    await this._persistClusters(filteredClusters);
    return true;
  }

  /**
   * Find similar faces to a query embedding
   */
  async findSimilarFaces(
    queryEmbedding: number[],
    threshold: number = 0.8,
  ): Promise<Person[]> {
    const clusters = await this.loadClusters();
    const similarPeople: Person[] = [];

    for (const person of clusters) {
      let maxSimilarity = 0;

      // Check similarity against sample embeddings
      for (const sampleEmbedding of person.sampleEmbeddings) {
        const similarity = FaceEmbeddingService.cosineSimilarity(
          queryEmbedding,
          sampleEmbedding,
        );
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      if (maxSimilarity >= threshold) {
        similarPeople.push(person);
      }
    }

    return similarPeople.sort((a, b) => b.clusterQuality - a.clusterQuality);
  }

  // ─── STORAGE OPERATIONS ───────────────────────────────────

  /**
   * Load persisted clusters
   */
  async loadClusters(): Promise<Person[]> {
    if (!this.config.persistClusters) {
      return [];
    }

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CLUSTERS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("FaceClusteringService: Failed to load clusters:", error);
      return [];
    }
  }

  /**
   * Persist clusters to storage
   */
  private async _persistClusters(clusters: Person[]): Promise<void> {
    if (!this.config.persistClusters) {
      return;
    }

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CLUSTERS,
        JSON.stringify(clusters),
      );
    } catch (error) {
      console.error(
        "FaceClusteringService: Failed to persist clusters:",
        error,
      );
    }
  }

  /**
   * Load persisted configuration
   */
  private async loadPersistedData(): Promise<void> {
    try {
      // Load configuration
      const configData = await AsyncStorage.getItem(STORAGE_KEYS.CONFIG);
      if (configData) {
        this.config = { ...this.config, ...JSON.parse(configData) };
      }

      // Load statistics
      const statsData = await AsyncStorage.getItem(STORAGE_KEYS.STATS);
      if (statsData) {
        this.stats = { ...this.stats, ...JSON.parse(statsData) };
      }
    } catch (error) {
      console.error(
        "FaceClusteringService: Failed to load persisted data:",
        error,
      );
    }
  }

  /**
   * Persist configuration
   */
  async persistConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CONFIG,
        JSON.stringify(this.config),
      );
    } catch (error) {
      console.error("FaceClusteringService: Failed to persist config:", error);
    }
  }

  /**
   * Clear all persisted data
   */
  async clearPersistedData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.CLUSTERS,
        STORAGE_KEYS.CONFIG,
        STORAGE_KEYS.STATS,
      ]);
    } catch (error) {
      console.error(
        "FaceClusteringService: Failed to clear persisted data:",
        error,
      );
    }
  }

  // ─── STATISTICS AND MONITORING ─────────────────────────────

  /**
   * Update clustering statistics
   */
  private _updateStats(result: ClusterResult): void {
    this.stats.totalClusters = result.people.length;
    this.stats.totalFaces = result.metadata.totalFaces;
    this.stats.clusteringTime = result.metadata.clusteringTime;
    this.stats.lastClusteringTimestamp = Date.now();

    if (result.people.length > 0) {
      this.stats.averageClusterSize =
        result.people.reduce((sum, p) => sum + p.faceCount, 0) /
        result.people.length;
      this.stats.averageClusterQuality =
        result.people.reduce((sum, p) => sum + p.clusterQuality, 0) /
        result.people.length;
    }

    // Persist statistics
    this._persistStats();
  }

  /**
   * Persist statistics
   */
  private async _persistStats(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.STATS,
        JSON.stringify(this.stats),
      );
    } catch (error) {
      console.error("FaceClusteringService: Failed to persist stats:", error);
    }
  }

  /**
   * Get clustering statistics
   */
  getStats(): FaceClusteringStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalClusters: 0,
      totalFaces: 0,
      averageClusterSize: 0,
      averageClusterQuality: 0,
      clusteringTime: 0,
      lastClusteringTimestamp: 0,
    };
    this._persistStats();
  }

  // ─── CONFIGURATION ────────────────────────────────────────

  /**
   * Update clustering configuration
   */
  updateConfig(newConfig: Partial<FaceClusteringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.persistConfig();
  }

  /**
   * Get current configuration
   */
  getConfig(): FaceClusteringConfig {
    return { ...this.config };
  }

  // ─── CLEANUP ────────────────────────────────────────────

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.embeddingService.cleanup();
  }
}

// ─────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────

let faceClusteringInstance: FaceClusteringService | null = null;

/**
 * Get singleton instance of FaceClusteringService
 */
export function getFaceClusteringService(
  config?: Partial<FaceClusteringConfig>,
): FaceClusteringService {
  if (!faceClusteringInstance) {
    faceClusteringInstance = new FaceClusteringService(config);
  }
  return faceClusteringInstance;
}

/**
 * Cleanup singleton instance
 */
export async function cleanupFaceClusteringService(): Promise<void> {
  if (faceClusteringInstance) {
    await faceClusteringInstance.cleanup();
    faceClusteringInstance = null;
  }
}

/**
 * Reset singleton instance (testing only)
 */
export function resetFaceClusteringServiceForTesting(): void {
  faceClusteringInstance = null;
}

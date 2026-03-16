// AI-META-BEGIN
// AI-META: Multimodal search with cross-modal similarity and result fusion
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by semantic-search and advanced-search modules
// DEPENDENCIES: clip-embeddings.ts, embedding-cache.ts, advanced-search.ts
// DANGER: Complex similarity calculations; cross-modal matching overhead; result ranking
// CHANGE-SAFETY: Add new modalities by extending SearchModality interface
// TESTS: client/lib/ml/multimodal-search.test.ts
// AI-META-END

import { Float32Array, getCLIPEmbeddingsService } from './clip-embeddings';
import { getEmbeddingCache } from './embedding-cache';
import { Photo } from '@/types';

// ─────────────────────────────────────────────────────────
// MULTIMODAL SEARCH TYPES
// ─────────────────────────────────────────────────────────

export type SearchModality = 'text' | 'image' | 'audio' | 'video' | 'metadata';

export interface MultimodalQuery {
  id: string;
  modalities: SearchModality[];
  text?: string;
  imageUris?: string[];
  audioUris?: string[];
  videoUris?: string[];
  metadata?: Record<string, any>;
  weights?: ModalityWeights;
  filters?: SearchFilters;
  limit?: number;
  threshold?: number;
}

export interface ModalityWeights {
  text: number;
  image: number;
  audio: number;
  video: number;
  metadata: number;
}

export interface SearchFilters {
  dateRange?: {
    start: number;
    end: number;
  };
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  tags?: string[];
  mediaType?: 'photo' | 'video' | 'all';
  favorites?: boolean;
  quality?: 'high' | 'medium' | 'low' | 'all';
}

export interface MultimodalResult {
  photo: Photo;
  overallScore: number;
  modalityScores: Record<SearchModality, number>;
  similarities: Record<SearchModality, number>;
  rank: number;
  explanation?: string;
  metadata?: Record<string, any>;
}

export interface CrossModalSimilarity {
  sourceModality: SearchModality;
  targetModality: SearchModality;
  similarity: number;
  confidence: number;
}

export interface FusionStrategy {
  name: string;
  description: string;
  weights: ModalityWeights;
  aggregationMethod: 'weighted' | 'max' | 'average' | 'adaptive';
}

// ─────────────────────────────────────────────────────────
// FUSION STRATEGIES
// ─────────────────────────────────────────────────────────

export const FUSION_STRATEGIES: Record<string, FusionStrategy> = {
  'balanced': {
    name: 'Balanced Fusion',
    description: 'Equal weight to all modalities',
    weights: { text: 0.25, image: 0.25, audio: 0.25, video: 0.25, metadata: 0.0 },
    aggregationMethod: 'weighted',
  },
  'visual-priority': {
    name: 'Visual Priority',
    description: 'Emphasize visual content (images/videos)',
    weights: { text: 0.2, image: 0.4, audio: 0.1, video: 0.3, metadata: 0.0 },
    aggregationMethod: 'weighted',
  },
  'semantic-priority': {
    name: 'Semantic Priority',
    description: 'Emphasize text and metadata understanding',
    weights: { text: 0.4, image: 0.2, audio: 0.1, video: 0.2, metadata: 0.1 },
    aggregationMethod: 'weighted',
  },
  'adaptive': {
    name: 'Adaptive Fusion',
    description: 'Automatically adjust weights based on query content',
    weights: { text: 0.25, image: 0.25, audio: 0.25, video: 0.25, metadata: 0.0 },
    aggregationMethod: 'adaptive',
  },
  'max-similarity': {
    name: 'Maximum Similarity',
    description: 'Use the highest similarity across modalities',
    weights: { text: 0.25, image: 0.25, audio: 0.25, video: 0.25, metadata: 0.0 },
    aggregationMethod: 'max',
  },
};

// ─────────────────────────────────────────────────────────
// MULTIMODAL SEARCH SERVICE
// ─────────────────────────────────────────────────────────

export class MultimodalSearchService {
  private clipService = getCLIPEmbeddingsService();
  private embeddingCache = getEmbeddingCache();

  constructor() {
    // Service initialization
  }

  // ─── MAIN SEARCH INTERFACE ───────────────────────────────

  /**
   * Perform multimodal search with multiple query modalities
   */
  async search(
    query: MultimodalQuery,
    candidatePhotos: Photo[],
    fusionStrategy: FusionStrategy = FUSION_STRATEGIES['balanced']
  ): Promise<MultimodalResult[]> {
    try {
      // Validate inputs
      this.validateQuery(query);
      
      // Generate embeddings for all query modalities
      const queryEmbeddings = await this.generateQueryEmbeddings(query);
      
      // Generate embeddings for candidate photos
      const candidateEmbeddings = await this.generateCandidateEmbeddings(candidatePhotos);
      
      // Calculate cross-modal similarities
      const similarities = await this.calculateCrossModalSimilarities(
        queryEmbeddings,
        candidateEmbeddings,
        query.modalities
      );
      
      // Apply fusion strategy to combine results
      const fusedResults = this.applyFusionStrategy(
        similarities,
        fusionStrategy,
        query.weights || fusionStrategy.weights
      );
      
      // Apply filters and threshold
      const filteredResults = this.applyFilters(fusedResults, query.filters, query.threshold);
      
      // Sort and rank results
      const rankedResults = this.rankResults(filteredResults);
      
      // Apply limit
      const limitedResults = rankedResults.slice(0, query.limit || 50);
      
      return limitedResults;
    } catch (error) {
      console.error('Multimodal search failed:', error);
      throw error;
    }
  }

  /**
   * Search for similar images using image query
   */
  async findSimilarImages(
    queryImageUris: string[],
    candidatePhotos: Photo[],
    options: {
      limit?: number;
      threshold?: number;
      filters?: SearchFilters;
    } = {}
  ): Promise<MultimodalResult[]> {
    const query: MultimodalQuery = {
      id: 'image-similarity',
      modalities: ['image'],
      imageUris: queryImageUris,
      limit: options.limit || 20,
      threshold: options.threshold || 0.3,
      filters: options.filters,
    };

    return this.search(query, candidatePhotos, FUSION_STRATEGIES['visual-priority']);
  }

  /**
   * Search using text query with visual understanding
   */
  async searchWithVisualUnderstanding(
    textQuery: string,
    candidatePhotos: Photo[],
    options: {
      limit?: number;
      threshold?: number;
      filters?: SearchFilters;
      fusionStrategy?: string;
    } = {}
  ): Promise<MultimodalResult[]> {
    const query: MultimodalQuery = {
      id: 'text-visual',
      modalities: ['text', 'image'],
      text: textQuery,
      limit: options.limit || 50,
      threshold: options.threshold || 0.2,
      filters: options.filters,
    };

    const strategy = options.fusionStrategy 
      ? FUSION_STRATEGIES[options.fusionStrategy] 
      : FUSION_STRATEGIES['semantic-priority'];

    return this.search(query, candidatePhotos, strategy);
  }

  /**
   * Search across multiple modalities with complex query
   */
  async complexSearch(
    query: MultimodalQuery,
    candidatePhotos: Photo[]
  ): Promise<MultimodalResult[]> {
    // Use adaptive fusion for complex queries
    const adaptiveStrategy = this.createAdaptiveStrategy(query);
    return this.search(query, candidatePhotos, adaptiveStrategy);
  }

  // ─── EMBEDDING GENERATION ─────────────────────────────────

  private async generateQueryEmbeddings(query: MultimodalQuery): Promise<Record<SearchModality, Float32Array[]>> {
    const embeddings: Record<SearchModality, Float32Array[]> = {} as any;

    // Generate text embeddings
    if (query.text && query.modalities.includes('text')) {
      const textEmbeddings = await this.clipService.generateTextEmbeddings([query.text]);
      embeddings.text = textEmbeddings;
    }

    // Generate image embeddings
    if (query.imageUris && query.modalities.includes('image')) {
      const imageEmbeddings = await this.clipService.generateImageEmbeddings(query.imageUris);
      embeddings.image = imageEmbeddings;
    }

    // Generate video embeddings (using video frames)
    if (query.videoUris && query.modalities.includes('video')) {
      const videoEmbeddings = await this.generateVideoEmbeddings(query.videoUris);
      embeddings.video = videoEmbeddings;
    }

    // Generate audio embeddings (placeholder - would integrate audio model)
    if (query.audioUris && query.modalities.includes('audio')) {
      const audioEmbeddings = await this.generateAudioEmbeddings(query.audioUris);
      embeddings.audio = audioEmbeddings;
    }

    // Generate metadata embeddings (using text encoding of metadata)
    if (query.metadata && query.modalities.includes('metadata')) {
      const metadataEmbeddings = await this.generateMetadataEmbeddings(query.metadata);
      embeddings.metadata = metadataEmbeddings;
    }

    return embeddings;
  }

  private async generateCandidateEmbeddings(photos: Photo[]): Promise<Map<string, Record<SearchModality, Float32Array>>> {
    const candidateEmbeddings = new Map<string, Record<SearchModality, Float32Array>>();

    for (const photo of photos) {
      const embeddings: Record<SearchModality, Float32Array> = {} as any;

      // Get cached embeddings or generate them
      const cacheKey = `photo_${photo.id}`;

      // Image embedding
      const imageEmbedding = await this.embeddingCache.get(cacheKey);
      if (imageEmbedding) {
        embeddings.image = imageEmbedding;
      }

      // Metadata embedding
      if (photo.filename || photo.tags || photo.notes) {
        const metadataText = this.createMetadataText(photo);
        const metadataEmbedding = await this.clipService.generateTextEmbeddings([metadataText]);
        embeddings.metadata = metadataEmbedding[0];
      }

      candidateEmbeddings.set(photo.id, embeddings);
    }

    return candidateEmbeddings;
  }

  private async generateVideoEmbeddings(videoUris: string[]): Promise<Float32Array[]> {
    // Placeholder implementation
    // In production would extract key frames and generate embeddings
    const embeddings: Float32Array[] = [];
    
    for (const uri of videoUris) {
      // For now, use a zero embedding as placeholder
      const embeddingSize = this.clipService.getCurrentModel().embeddingSize;
      embeddings.push(new Float32Array(embeddingSize));
    }
    
    return embeddings;
  }

  private async generateAudioEmbeddings(audioUris: string[]): Promise<Float32Array[]> {
    // Placeholder implementation
    // In production would integrate audio model (e.g., YAMNet, VGGish)
    const embeddings: Float32Array[] = [];
    
    for (const uri of audioUris) {
      // For now, use a zero embedding as placeholder
      const embeddingSize = this.clipService.getCurrentModel().embeddingSize;
      embeddings.push(new Float32Array(embeddingSize));
    }
    
    return embeddings;
  }

  private async generateMetadataEmbeddings(metadata: Record<string, any>): Promise<Float32Array[]> {
    // Convert metadata to text for embedding
    const metadataText = JSON.stringify(metadata);
    const embeddings = await this.clipService.generateTextEmbeddings([metadataText]);
    return embeddings;
  }

  private createMetadataText(photo: Photo): string {
    const parts: string[] = [];
    
    if (photo.filename) {
      parts.push(photo.filename);
    }
    
    if (photo.tags && photo.tags.length > 0) {
      parts.push(photo.tags.join(' '));
    }
    
    if (photo.notes) {
      parts.push(photo.notes);
    }
    
    if (photo.location) {
      parts.push(`location: ${photo.location}`);
    }
    
    return parts.join(' ');
  }

  // ─── SIMILARITY CALCULATION ───────────────────────────────

  private async calculateCrossModalSimilarities(
    queryEmbeddings: Record<SearchModality, Float32Array[]>,
    candidateEmbeddings: Map<string, Record<SearchModality, Float32Array>>,
    modalities: SearchModality[]
  ): Promise<Map<string, Record<SearchModality, number>>> {
    const similarities = new Map<string, Record<SearchModality, number>>();

    for (const [photoId, candidateEmbedding] of candidateEmbeddings.entries()) {
      const photoSimilarities: Record<SearchModality, number> = {} as any;

      for (const modality of modalities) {
        const queryEmbedding = queryEmbeddings[modality];
        const candidateEmbedding = candidateEmbedding[modality];

        if (queryEmbedding && candidateEmbedding && queryEmbedding.length > 0) {
          // Calculate similarity for this modality
          const similarity = this.calculateModalitySimilarity(
            queryEmbedding[0],
            candidateEmbedding,
            modality
          );
          photoSimilarities[modality] = similarity;
        } else {
          photoSimilarities[modality] = 0;
        }
      }

      similarities.set(photoId, photoSimilarities);
    }

    return similarities;
  }

  private calculateModalitySimilarity(
    queryEmbedding: Float32Array,
    candidateEmbedding: Float32Array,
    modality: SearchModality
  ): number {
    // Use cosine similarity for most modalities
    let similarity = this.clipService.cosineSimilarity(queryEmbedding, candidateEmbedding);

    // Apply modality-specific adjustments
    switch (modality) {
      case 'text':
        // Text similarity might need different weighting
        similarity = similarity * 1.0;
        break;
      case 'image':
        // Visual similarity might be more reliable
        similarity = similarity * 1.1;
        break;
      case 'video':
        // Video similarity might be less reliable (placeholder)
        similarity = similarity * 0.8;
        break;
      case 'audio':
        // Audio similarity might be less reliable (placeholder)
        similarity = similarity * 0.7;
        break;
      case 'metadata':
        // Metadata similarity might be less reliable
        similarity = similarity * 0.6;
        break;
    }

    return Math.max(0, Math.min(1, similarity)); // Clamp to [0, 1]
  }

  // ─── FUSION STRATEGIES ───────────────────────────────────

  private applyFusionStrategy(
    similarities: Map<string, Record<SearchModality, number>>,
    strategy: FusionStrategy,
    customWeights?: ModalityWeights
  ): Map<string, { overallScore: number; modalityScores: Record<SearchModality, number> }> {
    const weights = customWeights || strategy.weights;
    const fusedResults = new Map<string, { overallScore: number; modalityScores: Record<SearchModality, number> }>();

    for (const [photoId, modalityScores] of similarities.entries()) {
      let overallScore = 0;

      switch (strategy.aggregationMethod) {
        case 'weighted':
          overallScore = this.calculateWeightedScore(modalityScores, weights);
          break;
        case 'max':
          overallScore = Math.max(...Object.values(modalityScores));
          break;
        case 'average':
          overallScore = Object.values(modalityScores).reduce((sum, score) => sum + score, 0) / Object.values(modalityScores).length;
          break;
        case 'adaptive':
          overallScore = this.calculateAdaptiveScore(modalityScores, weights);
          break;
      }

      fusedResults.set(photoId, {
        overallScore,
        modalityScores: { ...modalityScores },
      });
    }

    return fusedResults;
  }

  private calculateWeightedScore(
    modalityScores: Record<SearchModality, number>,
    weights: ModalityWeights
  ): number {
    let score = 0;
    let totalWeight = 0;

    for (const [modality, weight] of Object.entries(weights)) {
      const modalityScore = modalityScores[modality as SearchModality] || 0;
      score += modalityScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  private calculateAdaptiveScore(
    modalityScores: Record<SearchModality, number>,
    baseWeights: ModalityWeights
  ): number {
    // Adaptive weighting based on score distribution
    const scores = Object.values(modalityScores);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Boost weights for modalities with high scores
    const adaptiveWeights: ModalityWeights = { ...baseWeights };
    
    for (const [modality, score] of Object.entries(modalityScores)) {
      if (score > avgScore) {
        const boost = (score - avgScore) / (maxScore - avgScore);
        adaptiveWeights[modality as SearchModality] *= (1 + boost * 0.5);
      }
    }

    return this.calculateWeightedScore(modalityScores, adaptiveWeights);
  }

  private createAdaptiveStrategy(query: MultimodalQuery): FusionStrategy {
    // Create adaptive fusion strategy based on query content
    const weights: ModalityWeights = { text: 0.2, image: 0.2, audio: 0.2, video: 0.2, metadata: 0.2 };

    // Adjust weights based on query modalities
    if (query.text) {
      weights.text += 0.1;
    }
    if (query.imageUris && query.imageUris.length > 0) {
      weights.image += 0.1;
    }
    if (query.videoUris && query.videoUris.length > 0) {
      weights.video += 0.1;
    }
    if (query.audioUris && query.audioUris.length > 0) {
      weights.audio += 0.1;
    }
    if (query.metadata) {
      weights.metadata += 0.1;
    }

    // Normalize weights
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    for (const modality of Object.keys(weights)) {
      weights[modality as SearchModality] /= totalWeight;
    }

    return {
      name: 'Adaptive Query',
      description: 'Automatically adapted to query content',
      weights,
      aggregationMethod: 'adaptive',
    };
  }

  // ─── FILTERING AND RANKING ───────────────────────────────

  private applyFilters(
    results: Map<string, { overallScore: number; modalityScores: Record<SearchModality, number> }>,
    filters?: SearchFilters,
    threshold?: number
  ): Map<string, { overallScore: number; modalityScores: Record<SearchModality, number> }> {
    const filteredResults = new Map();

    for (const [photoId, result] of results.entries()) {
      // Apply threshold filter
      if (threshold && result.overallScore < threshold) {
        continue;
      }

      // Apply other filters (would need to access photo data)
      // For now, just pass through
      filteredResults.set(photoId, result);
    }

    return filteredResults;
  }

  private rankResults(
    results: Map<string, { overallScore: number; modalityScores: Record<SearchModality, number> }>
  ): MultimodalResult[] {
    // Convert to array and sort by overall score
    const sortedResults = Array.from(results.entries())
      .sort(([, a], [, b]) => b.overallScore - a.overallScore);

    return sortedResults.map(([photoId, result], index) => ({
      photo: { id: photoId } as Photo, // Would need to get actual photo data
      overallScore: result.overallScore,
      modalityScores: result.modalityScores,
      similarities: result.modalityScores, // For now, use same values
      rank: index + 1,
    }));
  }

  // ─── VALIDATION ───────────────────────────────────────────

  private validateQuery(query: MultimodalQuery): void {
    if (!query.modalities || query.modalities.length === 0) {
      throw new Error('Query must specify at least one modality');
    }

    // Validate that query has content for specified modalities
    for (const modality of query.modalities) {
      switch (modality) {
        case 'text':
          if (!query.text) {
            throw new Error('Text modality specified but no text provided');
          }
          break;
        case 'image':
          if (!query.imageUris || query.imageUris.length === 0) {
            throw new Error('Image modality specified but no images provided');
          }
          break;
        case 'video':
          if (!query.videoUris || query.videoUris.length === 0) {
            throw new Error('Video modality specified but no videos provided');
          }
          break;
        case 'audio':
          if (!query.audioUris || query.audioUris.length === 0) {
            throw new Error('Audio modality specified but no audio provided');
          }
          break;
        case 'metadata':
          if (!query.metadata) {
            throw new Error('Metadata modality specified but no metadata provided');
          }
          break;
      }
    }
  }

  // ─── UTILITY METHODS ─────────────────────────────────────

  /**
   * Get available fusion strategies
   */
  getFusionStrategies(): Record<string, FusionStrategy> {
    return { ...FUSION_STRATEGIES };
  }

  /**
   * Get cross-modal similarities between two embeddings
   */
  getCrossModalSimilarity(
    embedding1: Float32Array,
    embedding2: Float32Array,
    sourceModality: SearchModality,
    targetModality: SearchModality
  ): CrossModalSimilarity {
    const similarity = this.clipService.cosineSimilarity(embedding1, embedding2);
    
    // Calculate confidence based on modality combination
    let confidence = 0.5; // Base confidence
    
    // Higher confidence for same-modality comparisons
    if (sourceModality === targetModality) {
      confidence = 0.8;
    }
    
    // Adjust confidence based on modality reliability
    const reliableModalities: SearchModality[] = ['text', 'image'];
    if (reliableModalities.includes(sourceModality) && reliableModalities.includes(targetModality)) {
      confidence += 0.2;
    }

    return {
      sourceModality,
      targetModality,
      similarity,
      confidence: Math.min(1, confidence),
    };
  }

  /**
   * Explain search results
   */
  explainResult(result: MultimodalResult): string {
    const explanations: string[] = [];
    
    // Find contributing modalities
    const contributingModalities = Object.entries(result.modalityScores)
      .filter(([_, score]) => score > 0.1)
      .sort(([_, a], [__, b]) => b - a)
      .map(([modality, score]) => `${modality} (${Math.round(score * 100)}%)`);

    if (contributingModalities.length > 0) {
      explanations.push(`Match based on: ${contributingModalities.join(', ')}`);
    }

    // Add overall score explanation
    explanations.push(`Overall similarity: ${Math.round(result.overallScore * 100)}%`);

    return explanations.join('. ');
  }
}

// ─────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────

let multimodalSearchInstance: MultimodalSearchService | null = null;

/**
 * Get singleton instance of MultimodalSearchService
 */
export function getMultimodalSearchService(): MultimodalSearchService {
  if (!multimodalSearchInstance) {
    multimodalSearchInstance = new MultimodalSearchService();
  }
  return multimodalSearchInstance;
}

/**
 * Cleanup singleton instance
 */
export function cleanupMultimodalSearchService(): void {
  multimodalSearchInstance = null;
}

/**
 * Reset singleton instance (testing only)
 */
export function resetMultimodalSearchServiceForTesting(): void {
  multimodalSearchInstance = null;
}

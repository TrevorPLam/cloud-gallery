/**
 * Performance test data generators
 * Provides realistic test data for performance benchmarks
 */

// Define types locally to avoid import issues
interface Photo {
  id: string;
  uri: string;
  width: number;
  height: number;
  size: number;
  createdAt: number;
  modifiedAt: number;
  isFavorite: boolean;
  metadata?: {
    description?: string;
    tags?: string[];
    location?: {
      city?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
    };
  };
}

interface Album {
  id: string;
  name: string;
  description?: string;
  photoIds: string[];
  createdAt: number;
  modifiedAt: number;
  coverPhotoId?: string;
}

/**
 * Generate test photos with realistic properties
 */
export function generateTestPhotos(
  count: number,
  options: {
    minSize?: number;
    maxSize?: number;
    minDimensions?: [number, number];
    maxDimensions?: [number, number];
    includeMetadata?: boolean;
  } = {},
): Photo[] {
  const {
    minSize = 1024 * 1024, // 1MB
    maxSize = 10 * 1024 * 1024, // 10MB
    minDimensions = [800, 600],
    maxDimensions = [4000, 3000],
    includeMetadata = true,
  } = options;

  const tags = [
    "vacation",
    "family",
    "nature",
    "city",
    "portrait",
    "landscape",
    "sunset",
    "beach",
    "mountain",
    "food",
    "travel",
    "wildlife",
    "architecture",
    "street",
    "night",
  ];
  const locations = [
    { city: "New York", country: "USA", latitude: 40.7128, longitude: -74.006 },
    { city: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
    { city: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 },
    { city: "London", country: "UK", latitude: 51.5074, longitude: -0.1278 },
    {
      city: "Sydney",
      country: "Australia",
      latitude: -33.8688,
      longitude: 151.2093,
    },
  ];

  return Array.from({ length: count }, (_, i) => {
    const width =
      minDimensions[0] + Math.random() * (maxDimensions[0] - minDimensions[0]);
    const height =
      minDimensions[1] + Math.random() * (maxDimensions[1] - minDimensions[1]);
    const size = minSize + Math.random() * (maxSize - minSize);
    const location = locations[i % locations.length];
    const photoTags = [tags[i % tags.length], tags[(i + 1) % tags.length]];

    const basePhoto: Photo = {
      id: `perf_photo_${i}`,
      uri: `file://performance/photo_${i}.jpg`,
      width: Math.round(width),
      height: Math.round(height),
      size: Math.round(size),
      createdAt: Date.now() - i * 1000 * 60, // 1 minute apart
      modifiedAt: Date.now() - i * 1000 * 60,
      isFavorite: i % 10 === 0, // 10% favorites
      albumIds: [`album_${Math.floor(i / 10)}`], // 10 photos per album
    };

    if (includeMetadata) {
      basePhoto.metadata = {
        description: `Performance test photo ${i} with realistic metadata`,
        tags: photoTags,
        location: {
          latitude: location.latitude + (Math.random() - 0.5) * 0.1,
          longitude: location.longitude + (Math.random() - 0.5) * 0.1,
          city: location.city,
          country: location.country,
        },
        fileFormat: "JPEG",
        hasAlpha: false,
      };
    }

    return basePhoto;
  });
}

/**
 * Generate test albums with realistic properties
 */
export function generateTestAlbums(
  count: number,
  photosPerAlbum: number = 10,
): Album[] {
  const albumNames = [
    "Summer Vacation 2024",
    "Family Reunion",
    "European Adventure",
    "Nature Photography",
    "City Explorations",
    "Food & Culinary",
    "Wildlife Safari",
    "Architectural Wonders",
    "Street Photography",
    "Night Scenes",
    "Mountain Landscapes",
    "Beach Days",
    "Travel Memories",
    "Holiday Celebrations",
    "Artistic Portraits",
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `perf_album_${i}`,
    name: albumNames[i % albumNames.length],
    description: `Performance test album ${i} with ${photosPerAlbum} photos`,
    photoIds: Array.from(
      { length: photosPerAlbum },
      (_, j) => `perf_photo_${i * photosPerAlbum + j}`,
    ),
    coverPhotoId: `perf_photo_${i * photosPerAlbum}`,
    createdAt: Date.now() - i * 1000 * 60 * 60, // 1 hour apart
    modifiedAt: Date.now() - i * 1000 * 60 * 60,
    isShared: i % 5 === 0, // 20% shared
    shareToken: i % 5 === 0 ? `share_token_${i}` : undefined,
  }));
}

/**
 * Generate search queries for performance testing
 */
export function generateSearchQueries(count: number) {
  const baseTerms = [
    "vacation",
    "family",
    "nature",
    "city",
    "portrait",
    "landscape",
    "sunset",
    "beach",
    "mountain",
    "food",
    "travel",
    "wildlife",
    "architecture",
    "street",
    "night",
  ];
  const qualifiers = [
    "2023",
    "2024",
    "summer",
    "winter",
    "spring",
    "fall",
    "new",
    "old",
    "favorite",
    "recent",
  ];

  return Array.from({ length: count }, (_, i) => ({
    text: `${baseTerms[i % baseTerms.length]} ${qualifiers[i % qualifiers.length]}`,
    filters: {
      tags: [baseTerms[i % baseTerms.length]],
      dateRange: {
        start: new Date(2024, 0, 1).getTime(),
        end: new Date(2024, 11, 31).getTime(),
      },
      favorites: i % 10 === 0,
      albums: [`perf_album_${Math.floor(i / 10)}`],
    },
    limit: 20 + (i % 80), // 20-100 results
    offset: (i % 5) * 20, // Pagination
  }));
}

/**
 * Generate batch operations for testing
 */
export function generateBatchOperations(
  count: number,
  operationType: "add" | "update" | "delete" = "add",
) {
  return Array.from({ length: count }, (_, i) => ({
    type: operationType,
    id: operationType === "add" ? `batch_photo_${i}` : `perf_photo_${i}`,
    data:
      operationType === "delete"
        ? null
        : {
            uri: `file://batch/photo_${i}.jpg`,
            width: 1920 + (i % 1000),
            height: 1080 + (i % 1000),
            size: 1024 * 1024 * (2 + (i % 5)),
            createdAt: Date.now() - i * 1000,
            metadata: {
              description: `Batch operation photo ${i}`,
              tags: [`batch_tag_${i % 10}`],
            },
          },
  }));
}

/**
 * Generate realistic user data for testing
 */
export function generateTestUsers(count: number) {
  const firstNames = [
    "John",
    "Jane",
    "Mike",
    "Sarah",
    "David",
    "Emily",
    "Chris",
    "Lisa",
    "Tom",
    "Anna",
  ];
  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `perf_user_${i}`,
    email: `user${i}@performance-test.com`,
    username: `perfuser${i}`,
    displayName: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=perfuser${i}`,
    preferences: {
      theme: i % 2 === 0 ? "light" : "dark",
      autoBackup: i % 3 === 0,
      storageWarning: true,
      photoQuality: "high",
      syncFrequency: "daily",
    },
    stats: {
      photoCount: 100 + i * 50,
      albumCount: 5 + (i % 10),
      storageUsed: (100 + i * 50) * 1024 * 1024 * 2, // ~2MB per photo
      lastActive: Date.now() - i * 1000 * 60 * 60, // 1 hour apart
    },
    createdAt: Date.now() - i * 1000 * 60 * 60 * 24, // 1 day apart
  }));
}

/**
 * Generate stress test data with extreme values
 */
export function generateStressTestData() {
  return {
    // Very large dataset
    largePhotoSet: generateTestPhotos(10000, {
      minSize: 5 * 1024 * 1024, // 5MB
      maxSize: 20 * 1024 * 1024, // 20MB
      minDimensions: [2000, 1500],
      maxDimensions: [6000, 4000],
      includeMetadata: true,
    }),

    // Many small operations
    manySmallOps: generateBatchOperations(1000, "add"),

    // Complex search queries
    complexQueries: Array.from({ length: 100 }, (_, i) => ({
      text: `complex search ${i} with many terms and filters`,
      filters: {
        tags: [`tag_${i % 20}`, `category_${i % 10}`, `type_${i % 5}`],
        dateRange: {
          start: new Date(2020, 0, 1).getTime(),
          end: new Date(2024, 11, 31).getTime(),
        },
        sizeRange: {
          min: 1024 * 1024,
          max: 10 * 1024 * 1024,
        },
        dimensions: {
          minWidth: 800,
          maxWidth: 4000,
          minHeight: 600,
          maxHeight: 3000,
        },
        favorites: i % 3 === 0,
        albums: Array.from(
          { length: 5 },
          (_, j) => `perf_album_${(i + j) % 50}`,
        ),
      },
      limit: 100,
      offset: (i % 10) * 100,
      sortBy: ["createdAt", "size", "width"][i % 3],
      sortOrder: ["asc", "desc"][i % 2],
    })),

    // Memory pressure data
    memoryPressure: Array.from({ length: 1000 }, (_, i) => ({
      id: `memory_test_${i}`,
      data: "A".repeat(10000), // 10KB per item
      metadata: {
        largeField: "B".repeat(5000), // 5KB
        nested: {
          deep: Array.from({ length: 100 }, (_, j) => ({
            value: `nested_value_${i}_${j}`,
            data: "C".repeat(100),
          })),
        },
      },
    })),
  };
}

/**
 * Performance test scenarios
 */
export const performanceScenarios = {
  // Cold start: First load with empty cache
  coldStart: {
    photoCount: 100,
    albumCount: 10,
    cacheState: "empty",
  },

  // Warm start: Subsequent load with cached data
  warmStart: {
    photoCount: 1000,
    albumCount: 50,
    cacheState: "warm",
  },

  // Heavy load: Large dataset processing
  heavyLoad: {
    photoCount: 10000,
    albumCount: 500,
    cacheState: "warm",
  },

  // Memory pressure: Limited memory scenario
  memoryPressure: {
    photoCount: 5000,
    albumCount: 200,
    cacheState: "limited",
    memoryLimit: 100 * 1024 * 1024, // 100MB
  },

  // Concurrent operations: Multiple simultaneous actions
  concurrent: {
    photoCount: 1000,
    albumCount: 50,
    concurrentOperations: 10,
    operationType: "mixed",
  },
} as const;

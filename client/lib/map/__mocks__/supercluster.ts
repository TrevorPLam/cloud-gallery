// Mock implementation of supercluster for testing
export default class Supercluster {
  constructor(options: any) {
    // Mock constructor
  }

  load(points: any[]) {
    // Mock load method
  }

  getClusters(bbox: number[], zoom: number) {
    // If bounds are all zeros, return empty array
    if (bbox.every((coord) => coord === 0)) {
      return [];
    }

    // Mock clusters - return some test data
    return [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [bbox[0] || 0, bbox[1] || 0],
        },
        properties: {
          photoId: "test-photo-1",
          photoUri: "test://photo1.jpg",
          createdAt: Date.now(),
          cluster: false,
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [bbox[2] || 0, bbox[3] || 0],
        },
        properties: {
          cluster: true,
          cluster_id: 1,
          point_count: 5,
          point_count_abbreviated: "5",
        },
      },
    ];
  }

  getLeaves(clusterId: number, limit = 10, offset = 0) {
    // Mock getLeaves method
    return [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [0, 0],
        },
        properties: {
          photoId: "test-photo-1",
          photoUri: "test://photo1.jpg",
          createdAt: Date.now(),
        },
      },
    ];
  }

  getClusterExpansionZoom(clusterId: number) {
    // Mock expansion zoom
    return 15;
  }

  static Cluster = Supercluster;
}

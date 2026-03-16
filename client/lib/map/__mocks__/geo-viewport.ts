// Mock implementation of @mapbox/geo-viewport for testing
export default function bounds(
  center: [number, number],
  zoom: number,
  dimensions: [number, number]
): [number, number, number, number] {
  // Mock bounds calculation
  return [
    center[0] - 0.1,
    center[1] - 0.1,
    center[0] + 0.1,
    center[1] + 0.1,
  ];
}

// Add bounds function to the default export
bounds.bounds = function(
  center: [number, number],
  zoom: number,
  dimensions: [number, number]
): [number, number, number, number] {
  return bounds(center, zoom, dimensions);
};

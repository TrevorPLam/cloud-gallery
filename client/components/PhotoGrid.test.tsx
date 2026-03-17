/**
 * Accessibility tests for PhotoGrid component
 *
 * Purpose: Test WCAG 2.1 AA compliance for photo grid accessibility
 * Standards: WCAG 2.1 AA, React Native accessibility best practices
 */

import { render } from "@testing-library/react-native";
import { vi, expect, describe, it, beforeEach } from "vitest";
import { PhotoGrid } from "./PhotoGrid";
import { Photo } from "@/types";
import { ThemedText } from "./ThemedText";
import {
  AccessibilityTester,
  AccessibilityPatterns,
} from "../test-utils/accessibility-testing-simple";

// Mock photo data for testing
const mockPhotos: Photo[] = [
  {
    id: "1",
    uri: "https://example.com/photo1.jpg",
    width: 800,
    height: 600,
    createdAt: Date.now() - 86400000, // Yesterday
    modifiedAt: Date.now() - 86400000,
    filename: "photo1.jpg",
    isFavorite: false,
    albumIds: [],
  },
  {
    id: "2",
    uri: "https://example.com/photo2.jpg",
    width: 1200,
    height: 800,
    createdAt: Date.now() - 172800000, // 2 days ago
    modifiedAt: Date.now() - 172800000,
    filename: "photo2.jpg",
    isFavorite: true,
    albumIds: [],
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      city: "New York",
      country: "United States",
    },
  },
  {
    id: "3",
    uri: "https://example.com/photo3.jpg",
    width: 600,
    height: 400,
    createdAt: Date.now() - 259200000, // 3 days ago
    modifiedAt: Date.now() - 259200000,
    filename: "photo3.jpg",
    isFavorite: false,
    albumIds: [],
    camera: {
      make: "Apple",
      model: "iPhone 14 Pro",
    },
  },
];

describe("PhotoGrid Accessibility", () => {
  const mockOnPhotoPress = vi.fn();
  const mockOnPhotoLongPress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Standard accessibility test with WCAG 2.1 AA compliance
  it("should be accessible with basic photo data", async () => {
    await AccessibilityTester.expectNoViolations(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />,
    );
  });

  // Test with grouped data
  it("should be accessible with grouped photos", async () => {
    const groupedData = [
      { title: "Today", data: [mockPhotos[0]] },
      { title: "Yesterday", data: [mockPhotos[1], mockPhotos[2]] },
    ];

    await AccessibilityTester.expectNoViolations(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
        groupedData={groupedData}
        showSectionHeaders={true}
      />,
    );
  });

  // Test interactive element patterns for photo items
  it("should pass interactive element tests for photo items", async () => {
    await AccessibilityPatterns.testInteractiveElement(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />,
    );
  });

  // Custom accessibility assertion
  it("should be accessible with custom matcher", async () => {
    const component = (
      <PhotoGrid
        photos={mockPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />
    );
    await expect(component).toBeAccessible();
  });

  // Test that photo items have proper accessibility roles
  it("should have button roles for photo items", () => {
    const { getAllByRole } = render(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />,
    );

    const photoItems = getAllByRole("button");
    expect(photoItems).toHaveLength(mockPhotos.length);
    
    photoItems.forEach((item) => {
      expect(item.props.accessible).toBe(true);
      expect(item.props.accessibilityRole).toBe("button");
    });
  });

  // Test accessibility labels are present and non-empty
  it("should have meaningful accessibility labels for photos", () => {
    const { getAllByRole } = render(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />,
    );

    const photoItems = getAllByRole("button");
    
    photoItems.forEach((item, index) => {
      const label = item.props.accessibilityLabel;
      expect(label).toBeDefined();
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe("Photo");
      expect(label).not.toBe("Image");
    });
  });

  // Test accessibility labels include date information
  it("should include date information in accessibility labels", () => {
    const { getAllByRole } = render(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />,
    );

    const photoItems = getAllByRole("button");
    
    photoItems.forEach((item) => {
      const label = item.props.accessibilityLabel;
      // Should contain "Photo from" and date information
      expect(label).toMatch(/Photo from/);
      expect(label).toMatch(/\d{4}/); // Year should be present
    });
  });

  // Test accessibility labels include location when available
  it("should include location information in accessibility labels when available", () => {
    const { getAllByRole } = render(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />,
    );

    const photoItems = getAllByRole("button");
    const photoWithLocation = photoItems.find((item) => 
      item.props.accessibilityLabel.includes("New York")
    );
    
    expect(photoWithLocation).toBeDefined();
    expect(photoWithLocation!.props.accessibilityLabel).toMatch(/taken in/);
  });

  // Test accessibility hints are provided
  it("should provide accessibility hints for photo interactions", () => {
    const { getAllByRole } = render(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />,
    );

    const photoItems = getAllByRole("button");
    
    photoItems.forEach((item) => {
      expect(item.props.accessibilityHint).toBe("Opens photo to view in detail");
    });
  });

  // Test favorite photos have accessible favorite indicators
  it("should handle favorite photos accessibly", () => {
    const { getAllByRole, queryByTestId } = render(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />,
    );

    const favoritePhoto = mockPhotos.find(p => p.isFavorite);
    if (favoritePhoto) {
      const favoriteIcon = queryByTestId(`photo-item-${favoritePhoto.id}`);
      expect(favoriteIcon).toBeTruthy();
    }
  });

  // Test empty state accessibility
  it("should handle empty photo list accessibly", async () => {
    const emptyListComponent = <ThemedText>No photos available</ThemedText>;

    await AccessibilityTester.expectNoViolations(
      <PhotoGrid
        photos={[]}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
        ListEmptyComponent={emptyListComponent}
      />,
    );
  });

  // Test accessibility with different screen sizes (responsive columns)
  it("should maintain accessibility with responsive layouts", async () => {
    // Mock different screen widths by testing with different photo counts
    const manyPhotos = Array.from({ length: 20 }, (_, i) => ({
      ...mockPhotos[0],
      id: `photo-${i}`,
      uri: `https://example.com/photo${i}.jpg`,
    }));

    await AccessibilityTester.expectNoViolations(
      <PhotoGrid
        photos={manyPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />,
    );
  });

  // Test performance with accessibility labels
  it("should generate accessibility labels efficiently", () => {
    const startTime = performance.now();
    
    render(
      <PhotoGrid
        photos={mockPhotos}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />,
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render within reasonable time (performance requirement)
    expect(renderTime).toBeLessThan(100); // 100ms threshold
  });

  // Test accessibility with complex photo metadata
  it("should handle complex photo metadata accessibly", async () => {
    const photoWithComplexMetadata: Photo = {
      ...mockPhotos[0],
      location: {
        latitude: 51.5074,
        longitude: -0.1278,
        address: "221B Baker Street",
        city: "London",
        country: "United Kingdom",
      },
      camera: {
        make: "Canon",
        model: "EOS R5",
        iso: 400,
        aperture: "f/2.8",
        shutter: "1/125",
        focalLength: 50,
      },
      tags: ["vacation", "europe"],
      notes: "Beautiful sunset",
    };

    await AccessibilityTester.expectNoViolations(
      <PhotoGrid
        photos={[photoWithComplexMetadata]}
        onPhotoPress={mockOnPhotoPress}
        onPhotoLongPress={mockOnPhotoLongPress}
      />,
    );
  });
});

describe("PhotoGrid Accessibility Label Generation", () => {
  // Test the utility functions directly
  it("should generate appropriate labels for photos with different metadata", () => {
    const { generatePhotoAccessibilityLabel } = require("@/lib/photo-descriptions");
    
    // Photo with only date
    const photoWithDate = mockPhotos[0];
    const labelWithDate = generatePhotoAccessibilityLabel(photoWithDate);
    expect(labelWithDate).toMatch(/Photo from \w+ \d{1,2}, \d{4}/);
    
    // Photo with location
    const photoWithLocation = mockPhotos[1];
    const labelWithLocation = generatePhotoAccessibilityLabel(photoWithLocation);
    expect(labelWithLocation).toMatch(/taken in/);
    expect(labelWithLocation).toContain("New York");
    
    // Photo with camera info
    const photoWithCamera = mockPhotos[2];
    const labelWithCamera = generatePhotoAccessibilityLabel(photoWithCamera);
    expect(labelWithCamera).toMatch(/taken with/);
    expect(labelWithCamera).toContain("Apple");
  });

  it("should generate concise labels appropriately", () => {
    const { generateConcisePhotoLabel } = require("@/lib/photo-descriptions");
    
    // Photo with location
    const photoWithLocation = mockPhotos[1];
    const conciseLabel = generateConcisePhotoLabel(photoWithLocation);
    expect(conciseLabel).toMatch(/in \w+/);
    expect(conciseLabel.length).toBeLessThan(50); // Should be concise
  });
});

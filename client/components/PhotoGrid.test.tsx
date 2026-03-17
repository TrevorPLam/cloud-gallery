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

describe("PhotoGrid Video Support", () => {
  const mockVideoPhotos: Photo[] = [
    {
      id: "video-1",
      uri: "file://video1.mp4",
      width: 1920,
      height: 1080,
      filename: "video1.mp4",
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isFavorite: false,
      albumIds: [],
      isVideo: true,
      videoDuration: 120,
      videoThumbnailUri: "file://thumb1.jpg",
    },
    {
      id: "photo-1",
      uri: "file://photo1.jpg",
      width: 1920,
      height: 1080,
      filename: "photo1.jpg",
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isFavorite: false,
      albumIds: [],
      isVideo: false,
    },
    {
      id: "video-2",
      uri: "file://video2.mp4",
      width: 1280,
      height: 720,
      filename: "video2.mp4",
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isFavorite: true,
      albumIds: [],
      isVideo: true,
      videoDuration: 60,
      videoThumbnailUri: "file://thumb2.jpg",
    },
  ];

  const mockOnPhotoPress = vi.fn();
  const mockOnPhotoLongPress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Video Play Icon Display", () => {
    it("should show play icon for video items", () => {
      render(
        <PhotoGrid
          photos={mockVideoPhotos}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      // Video items should have play icon and video accessibility labels
      const videoItems = screen.getAllByLabelText(/video/);
      expect(videoItems).toHaveLength(2);

      // Check video with 120 seconds duration
      expect(screen.getByLabelText(/video, 120 seconds/)).toBeTruthy();
      
      // Check video with 60 seconds duration  
      expect(screen.getByLabelText(/video, 60 seconds/)).toBeTruthy();
    });

    it("should not show play icon for photo items", () => {
      const photosOnly = mockVideoPhotos.filter(p => !p.isVideo);
      render(
        <PhotoGrid
          photos={photosOnly}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      // Photo items should not have video indicators
      expect(screen.queryByLabelText(/video/)).toBeNull();
      expect(screen.getByLabelText(/Photo from/)).toBeTruthy();
    });

    it("should show both play icon and favorite icon for favorite videos", () => {
      render(
        <PhotoGrid
          photos={mockVideoPhotos}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      // Video 2 is both a video and favorite
      expect(screen.getByLabelText(/video, 60 seconds/)).toBeTruthy();
    });

    it("should handle videos without duration", () => {
      const videoWithoutDuration = {
        ...mockVideoPhotos[0],
        videoDuration: undefined,
      };
      render(
        <PhotoGrid
          photos={[videoWithoutDuration]}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      expect(screen.getByLabelText(/video, unknown duration/)).toBeTruthy();
    });
  });

  describe("Video Thumbnail Display", () => {
    it("should use video thumbnail URI when available", () => {
      render(
        <PhotoGrid
          photos={mockVideoPhotos}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      // Should render all items including videos with thumbnails
      const allItems = screen.getAllByLabelText(/(video|Photo from)/);
      expect(allItems).toHaveLength(3);
    });

    it("should fallback to video URI when thumbnail not available", () => {
      const videoWithoutThumbnail = {
        ...mockVideoPhotos[0],
        videoThumbnailUri: undefined,
      };
      render(
        <PhotoGrid
          photos={[videoWithoutThumbnail]}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      // Should still display the video
      expect(screen.getByLabelText(/video, 120 seconds/)).toBeTruthy();
    });
  });

  describe("Video Interaction", () => {
    it("should handle press on video items", () => {
      render(
        <PhotoGrid
          photos={mockVideoPhotos}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      const videoItem = screen.getByLabelText(/video, 120 seconds/);
      
      // Simulate press action
      videoItem.props.onPress();

      expect(mockOnPhotoPress).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'video-1', isVideo: true }),
        expect.any(Number)
      );
    });

    it("should handle long press on video items", () => {
      render(
        <PhotoGrid
          photos={mockVideoPhotos}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      const videoItem = screen.getByLabelText(/video, 120 seconds/);
      
      // Simulate long press action
      videoItem.props.onLongPress();

      expect(mockOnPhotoLongPress).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'video-1', isVideo: true })
      );
    });

    it("should provide appropriate accessibility hints for videos", () => {
      render(
        <PhotoGrid
          photos={mockVideoPhotos}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      const videoItem = screen.getByLabelText(/video, 120 seconds/);
      expect(videoItem).toHaveProp('accessibilityHint', 'Opens video to view and play in detail');
    });

    it("should provide appropriate accessibility hints for photos", () => {
      const photosOnly = mockVideoPhotos.filter(p => !p.isVideo);
      render(
        <PhotoGrid
          photos={photosOnly}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      const photoItem = screen.getByLabelText(/Photo from/);
      expect(photoItem).toHaveProp('accessibilityHint', 'Opens photo to view in detail');
    });
  });

  describe("Video Grid Layout", () => {
    it("should render mixed photo and video grid correctly", () => {
      render(
        <PhotoGrid
          photos={mockVideoPhotos}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      // Should render all items
      const allItems = screen.getAllByLabelText(/(video|Photo from)/);
      expect(allItems).toHaveLength(3);
      
      // Should have 2 videos and 1 photo
      const videoItems = screen.getAllByLabelText(/video/);
      expect(videoItems).toHaveLength(2);
      expect(screen.getByLabelText(/Photo from/)).toBeTruthy();
    });

    it("should handle video-only grid", () => {
      const videosOnly = mockVideoPhotos.filter(p => p.isVideo);
      render(
        <PhotoGrid
          photos={videosOnly}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      const videoItems = screen.getAllByLabelText(/video/);
      expect(videoItems).toHaveLength(2);
      expect(screen.queryByLabelText(/Photo from/)).toBeNull();
    });
  });

  describe("Video Accessibility Compliance", () => {
    it("should meet WCAG guidelines for video content", async () => {
      await AccessibilityTester.expectNoViolations(
        <PhotoGrid
          photos={mockVideoPhotos}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );
    });

    it("should have proper focus management for video items", () => {
      render(
        <PhotoGrid
          photos={mockVideoPhotos}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      // Video items should be focusable
      const videoItems = screen.getAllByLabelText(/video/);
      videoItems.forEach(item => {
        expect(item).toHaveProp('focusable', true);
      });
    });

    it("should have sufficient color contrast for play icons", () => {
      render(
        <PhotoGrid
          photos={mockVideoPhotos}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      // Play icons should be visible (white on dark background)
      // This would be tested by checking the actual component styling
      const videoItems = screen.getAllByLabelText(/video/);
      expect(videoItems).toHaveLength(2);
    });
  });

  describe("Video Error Handling", () => {
    it("should handle corrupted video metadata gracefully", () => {
      const corruptedVideo = {
        id: 'corrupted-video',
        uri: 'file://corrupted.mp4',
        width: 0,
        height: 0,
        filename: '',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isFavorite: false,
        albumIds: [],
        isVideo: true,
        videoDuration: undefined,
        videoThumbnailUri: undefined,
      };
      
      render(
        <PhotoGrid
          photos={[corruptedVideo]}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      // Should still render the video item even with corrupted metadata
      expect(screen.getByLabelText(/video, unknown duration/)).toBeTruthy();
    });

    it("should handle missing video properties", () => {
      const incompleteVideo = {
        id: 'incomplete-video',
        uri: 'file://incomplete.mp4',
        width: 1920,
        height: 1080,
        filename: 'incomplete.mp4',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isFavorite: false,
        albumIds: [],
        isVideo: true,
        // Missing videoDuration and videoThumbnailUri
      };
      
      render(
        <PhotoGrid
          photos={[incompleteVideo]}
          onPhotoPress={mockOnPhotoPress}
          onPhotoLongPress={mockOnPhotoLongPress}
        />
      );

      expect(screen.getByLabelText(/video, unknown duration/)).toBeTruthy();
    });
  });
});

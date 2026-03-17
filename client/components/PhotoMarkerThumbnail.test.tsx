// AI-META-BEGIN
// AI-META: Test suite for PhotoMarkerThumbnail component
// OWNERSHIP: client/components
// ENTRYPOINTS: Test runner for photo marker rendering and accessibility
// DEPENDENCIES: @testing-library/react-native, vitest, mocks
// DANGER: Image loading complexity; ensure proper mocking
// CHANGE-SAFETY: Safe to add tests; maintain mock contracts
// TESTS: Component rendering, accessibility, press handling, styling
// AI-META-END

import { render, fireEvent } from "@testing-library/react-native";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PhotoMarkerThumbnail from "../PhotoMarkerThumbnail";

// Mock expo-image
vi.mock("expo-image", () => ({
  Image: "Image",
}));

// Mock theme hook
vi.mock("@/hooks/useTheme", () => ({
  useTheme: vi.fn(() => ({
    theme: {
      backgroundDefault: "#ffffff",
      backgroundSecondary: "#f0f0f0",
    },
  })),
}));

describe("PhotoMarkerThumbnail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    uri: "https://example.com/test-photo.jpg",
    size: 40,
  };

  describe("Rendering", () => {
    it("renders correctly with default props", () => {
      const { getByTestId } = render(<PhotoMarkerThumbnail {...defaultProps} />);
      
      expect(getByTestId("photo-marker-thumbnail")).toBeTruthy();
    });

    it("renders with custom size", () => {
      const { getByTestId } = render(
        <PhotoMarkerThumbnail {...defaultProps} size={60} />
      );
      
      const container = getByTestId("photo-marker-thumbnail");
      expect(container.props.style.width).toBe(60);
      expect(container.props.style.height).toBe(60);
      expect(container.props.style.borderRadius).toBe(30);
    });

    it("renders Image component with correct props", () => {
      const { getByTestId } = render(<PhotoMarkerThumbnail {...defaultProps} />);
      
      const image = getByTestId("photo-marker-image");
      expect(image.props.source.uri).toBe(defaultProps.uri);
      expect(image.props.contentFit).toBe("cover");
      expect(image.props.cachePolicy).toBe("memory-disk");
    });

    it("applies theme-based styling", () => {
      const { getByTestId } = render(<PhotoMarkerThumbnail {...defaultProps} />);
      
      const container = getByTestId("photo-marker-thumbnail");
      expect(container.props.style.backgroundColor).toBe("#f0f0f0");
      expect(container.props.style.borderColor).toBe("#ffffff");
    });
  });

  describe("Accessibility", () => {
    it("has correct accessibility role when onPress is provided", () => {
      const mockOnPress = vi.fn();
      const { getByLabelText } = render(
        <PhotoMarkerThumbnail 
          {...defaultProps} 
          onPress={mockOnPress}
          accessibilityLabel="Test photo marker"
          accessibilityHint="Tap to view photo"
        />
      );
      
      const marker = getByLabelText("Test photo marker");
      expect(marker.props.accessible).toBe(true);
      expect(marker.props.accessibilityRole).toBe("button");
      expect(marker.props.accessibilityHint).toBe("Tap to view photo");
    });

    it("has default accessibility labels when not provided", () => {
      const { getByLabelText, getByHintText } = render(
        <PhotoMarkerThumbnail {...defaultProps} />
      );
      
      expect(getByLabelText("Photo location marker")).toBeTruthy();
      expect(getByHintText("Tap to preview photo")).toBeTruthy();
    });

    it("is not accessible when onPress is not provided", () => {
      const { getByTestId } = render(<PhotoMarkerThumbnail {...defaultProps} />);
      
      const marker = getByTestId("photo-marker-thumbnail");
      expect(marker.props.accessible).toBe(false);
    });

    it("uses custom accessibility labels when provided", () => {
      const mockOnPress = vi.fn();
      const { getByLabelText } = render(
        <PhotoMarkerThumbnail 
          {...defaultProps} 
          onPress={mockOnPress}
          accessibilityLabel="Photo at Golden Gate Bridge"
          accessibilityHint="Tap to see full photo"
        />
      );
      
      expect(getByLabelText("Photo at Golden Gate Bridge")).toBeTruthy();
      expect(getByLabelText("Photo at Golden Gate Bridge").props.accessibilityHint).toBe("Tap to see full photo");
    });
  });

  describe("Interaction", () => {
    it("calls onPress when touched", () => {
      const mockOnPress = vi.fn();
      const { getByTestId } = render(
        <PhotoMarkerThumbnail 
          {...defaultProps} 
          onPress={mockOnPress}
        />
      );
      
      const marker = getByTestId("photo-marker-thumbnail");
      fireEvent(marker, "touchEnd");
      
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it("does not call onPress when not provided", () => {
      const { getByTestId } = render(<PhotoMarkerThumbnail {...defaultProps} />);
      
      const marker = getByTestId("photo-marker-thumbnail");
      expect(() => {
        fireEvent(marker, "touchEnd");
      }).not.toThrow();
    });

    it("handles multiple presses correctly", () => {
      const mockOnPress = vi.fn();
      const { getByTestId } = render(
        <PhotoMarkerThumbnail 
          {...defaultProps} 
          onPress={mockOnPress}
        />
      );
      
      const marker = getByTestId("photo-marker-thumbnail");
      
      fireEvent(marker, "touchEnd");
      fireEvent(marker, "touchEnd");
      fireEvent(marker, "touchEnd");
      
      expect(mockOnPress).toHaveBeenCalledTimes(3);
    });
  });

  describe("Styling", () => {
    it("has correct container dimensions for different sizes", () => {
      const sizes = [30, 40, 50, 60];
      
      sizes.forEach(size => {
        const { getByTestId } = render(
          <PhotoMarkerThumbnail {...defaultProps} size={size} />
        );
        
        const container = getByTestId("photo-marker-thumbnail");
        expect(container.props.style.width).toBe(size);
        expect(container.props.style.height).toBe(size);
        expect(container.props.style.borderRadius).toBe(size / 2);
      });
    });

    it("has correct image dimensions (container size - 4)", () => {
      const { getByTestId } = render(<PhotoMarkerThumbnail {...defaultProps} size={50} />);
      
      const image = getByTestId("photo-marker-image");
      expect(image.props.style.width).toBe(46);
      expect(image.props.style.height).toBe(46);
      expect(image.props.style.borderRadius).toBe(23);
    });

    it("has shadow/elevation properties", () => {
      const { getByTestId } = render(<PhotoMarkerThumbnail {...defaultProps} />);
      
      const container = getByTestId("photo-marker-thumbnail");
      expect(container.props.style.shadowColor).toBe("#000");
      expect(container.props.style.shadowOffset).toEqual({ width: 0, height: 2 });
      expect(container.props.style.shadowOpacity).toBe(0.2);
      expect(container.props.style.shadowRadius).toBe(4);
      expect(container.props.style.elevation).toBe(3);
    });

    it("has overflow hidden for circular shape", () => {
      const { getByTestId } = render(<PhotoMarkerThumbnail {...defaultProps} />);
      
      const container = getByTestId("photo-marker-thumbnail");
      expect(container.props.style.overflow).toBe("hidden");
    });
  });

  describe("Props", () => {
    it("accepts and uses all required props", () => {
      const mockOnPress = vi.fn();
      const props = {
        uri: "https://example.com/custom.jpg",
        size: 45,
        onPress: mockOnPress,
        accessibilityLabel: "Custom marker",
        accessibilityHint: "Custom hint",
      };
      
      const { getByTestId, getByLabelText } = render(
        <PhotoMarkerThumbnail {...props} />
      );
      
      const container = getByTestId("photo-marker-thumbnail");
      expect(container.props.style.width).toBe(45);
      expect(container.props.style.height).toBe(45);
      
      const image = getByTestId("photo-marker-image");
      expect(image.props.source.uri).toBe("https://example.com/custom.jpg");
      
      expect(getByLabelText("Custom marker")).toBeTruthy();
      expect(getByLabelText("Custom marker").props.accessibilityHint).toBe("Custom hint");
    });

    it("works with minimal props", () => {
      const { getByTestId } = render(
        <PhotoMarkerThumbnail uri="https://example.com/minimal.jpg" />
      );
      
      expect(getByTestId("photo-marker-thumbnail")).toBeTruthy();
      expect(getByTestId("photo-marker-image")).toBeTruthy();
    });

    it("handles empty accessibility labels gracefully", () => {
      const mockOnPress = vi.fn();
      const { getByTestId } = render(
        <PhotoMarkerThumbnail 
          {...defaultProps} 
          onPress={mockOnPress}
          accessibilityLabel=""
          accessibilityHint=""
        />
      );
      
      const marker = getByTestId("photo-marker-thumbnail");
      expect(marker.props.accessible).toBe(true);
      expect(marker.props.accessibilityRole).toBe("button");
    });
  });

  describe("Error Handling", () => {
    it("handles invalid URI gracefully", () => {
      const { getByTestId } = render(
        <PhotoMarkerThumbnail {...defaultProps} uri="" />
      );
      
      expect(getByTestId("photo-marker-thumbnail")).toBeTruthy();
      expect(getByTestId("photo-marker-image")).toBeTruthy();
    });

    it("handles zero size gracefully", () => {
      const { getByTestId } = render(
        <PhotoMarkerThumbnail {...defaultProps} size={0} />
      );
      
      const container = getByTestId("photo-marker-thumbnail");
      expect(container.props.style.width).toBe(0);
      expect(container.props.style.height).toBe(0);
      expect(container.props.style.borderRadius).toBe(0);
    });

    it("handles negative size gracefully", () => {
      const { getByTestId } = render(
        <PhotoMarkerThumbnail {...defaultProps} size={-10} />
      );
      
      const container = getByTestId("photo-marker-thumbnail");
      expect(container.props.style.width).toBe(-10);
      expect(container.props.style.height).toBe(-10);
      expect(container.props.style.borderRadius).toBe(-5);
    });
  });
});

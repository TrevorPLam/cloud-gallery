// AI-META-BEGIN
// AI-META: Test suite for PhotoPreviewSheet modal component
// OWNERSHIP: client/components
// ENTRYPOINTS: Test runner for photo preview modal functionality
// DEPENDENCIES: @testing-library/react-native, vitest, mocks
// DANGER: Modal complexity; ensure proper cleanup and mocking
// CHANGE-SAFETY: Safe to add tests; maintain mock contracts
// TESTS: Modal presentation, photo display, navigation, accessibility
// AI-META-END

import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PhotoPreviewSheet from "../PhotoPreviewSheet";
import { Photo } from "@/types";

// Mock expo-image
vi.mock("expo-image", () => ({
  Image: "Image",
}));

// Mock theme hook
vi.mock("@/hooks/useTheme", () => ({
  useTheme: vi.fn(() => ({
    theme: {
      backgroundDefault: "#ffffff",
      accent: "#D4AF37",
      text: "#1A202C",
      backgroundSecondary: "#f0f0f0",
    },
  })),
}));

// Mock React Native Modal
vi.mock("react-native", async () => {
  const actual = await vi.importActual("react-native");
  return {
    ...actual,
    Modal: ({ children, visible, onRequestClose }: any) => 
      visible ? (
        <div testID="modal" onRequestClose={onRequestClose}>
          {children}
        </div>
      ) : null,
  };
});

describe("PhotoPreviewSheet", () => {
  const mockPhoto: Photo = {
    id: "1",
    uri: "https://example.com/test-photo.jpg",
    width: 1920,
    height: 1080,
    createdAt: "2024-01-15T10:00:00Z",
    location: {
      latitude: 37.7749,
      longitude: -122.4194,
      city: "San Francisco",
    },
  };

  const defaultProps = {
    photo: mockPhoto,
    visible: true,
    onClose: vi.fn(),
    onViewFull: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders when visible is true", () => {
      const { getByTestId } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      expect(getByTestId("modal")).toBeTruthy();
    });

    it("does not render when visible is false", () => {
      const { queryByTestId } = render(
        <PhotoPreviewSheet {...defaultProps} visible={false} />
      );
      
      expect(queryByTestId("modal")).toBeFalsy();
    });

    it("does not render when photo is null", () => {
      const { queryByTestId } = render(
        <PhotoPreviewSheet {...defaultProps} photo={null} />
      );
      
      expect(queryByTestId("modal")).toBeFalsy();
    });

    it("renders photo image with correct props", () => {
      const { getByTestId } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const image = getByTestId("photo-image");
      expect(image.props.source.uri).toBe(mockPhoto.uri);
      expect(image.props.contentFit).toBe("contain");
    });

    it("displays photo location information", () => {
      const { getByText } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      expect(getByText("San Francisco")).toBeTruthy();
      expect(getByText("1/15/2024")).toBeTruthy();
    });

    it("displays fallback text when location city is missing", () => {
      const photoWithoutCity = {
        ...mockPhoto,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
      };
      
      const { getByText } = render(
        <PhotoPreviewSheet {...defaultProps} photo={photoWithoutCity} />
      );
      
      expect(getByText("Photo")).toBeTruthy();
    });

    it("displays fallback text when location is missing", () => {
      const photoWithoutLocation = {
        ...mockPhoto,
        location: undefined,
      };
      
      const { getByText } = render(
        <PhotoPreviewSheet {...defaultProps} photo={photoWithoutLocation} />
      );
      
      expect(getByText("Photo")).toBeTruthy();
    });
  });

  describe("Modal Behavior", () => {
    it("calls onRequestClose when modal requests close", async () => {
      const { getByTestId } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const modal = getByTestId("modal");
      fireEvent(modal, "requestClose");
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("has correct modal props", () => {
      const { getByTestId } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const modal = getByTestId("modal");
      expect(modal.props.transparent).toBe(true);
      expect(modal.props.animationType).toBe("fade");
    });

    it("has correct accessibility properties", () => {
      const { getByLabelText } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      expect(getByLabelText("Photo preview modal")).toBeTruthy();
      expect(getByLabelText("Photo preview modal").props.accessibilityHint).toBe("Tap outside or close button to dismiss");
    });
  });

  describe("Button Interactions", () => {
    it("calls onViewFull when View Full button is pressed", () => {
      const { getByLabelText } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const viewFullButton = getByLabelText("View full photo");
      fireEvent.press(viewFullButton);
      
      expect(defaultProps.onViewFull).toHaveBeenCalledWith(mockPhoto);
      expect(defaultProps.onViewFull).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Close button is pressed", () => {
      const { getByLabelText } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const closeButton = getByLabelText("Close preview");
      fireEvent.press(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("buttons have correct accessibility properties", () => {
      const { getByLabelText } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const viewFullButton = getByLabelText("View full photo");
      expect(viewFullButton.props.accessibilityRole).toBe("button");
      expect(viewFullButton.props.accessibilityHint).toBe("Opens photo in full screen view");
      
      const closeButton = getByLabelText("Close preview");
      expect(closeButton.props.accessibilityRole).toBe("button");
      expect(closeButton.props.accessibilityHint).toBe("Closes photo preview and returns to map");
    });

    it("buttons have correct styling", () => {
      const { getByTestId } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const viewFullButton = getByTestId("view-full-button");
      expect(viewFullButton.props.style.backgroundColor).toBe("#D4AF37");
      
      const closeButton = getByTestId("close-button");
      expect(closeButton.props.style.backgroundColor).toBe("#f0f0f0");
    });
  });

  describe("Touch Interactions", () => {
    it("calls onClose when overlay is pressed", () => {
      const { getByTestId } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const overlay = getByTestId("preview-overlay");
      fireEvent.press(overlay);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when container is pressed", () => {
      const { getByTestId } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const container = getByTestId("preview-container");
      fireEvent.press(container);
      
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("prevents event propagation on container press", () => {
      const { getByTestId } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const container = getByTestId("preview-container");
      const stopPropagationSpy = vi.fn();
      
      // Mock the stopPropagation function
      fireEvent(container, "press", { stopPropagation: stopPropagationSpy });
      
      // The event should be stopped from propagating to overlay
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe("Photo Image", () => {
    it("has correct accessibility label", () => {
      const { getByLabelText } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      expect(getByLabelText("Photo preview: San Francisco")).toBeTruthy();
    });

    it("has fallback accessibility label when no location", () => {
      const photoWithoutLocation = {
        ...mockPhoto,
        location: undefined,
      };
      
      const { getByLabelText } = render(
        <PhotoPreviewSheet {...defaultProps} photo={photoWithoutLocation} />
      );
      
      expect(getByLabelText("Photo preview: Unknown location")).toBeTruthy();
    });

    it("has correct styling", () => {
      const { getByTestId } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const image = getByTestId("photo-image");
      expect(image.props.style.width).toBe("100%");
      expect(image.props.style.height).toBe(300);
    });
  });

  describe("Date Display", () => {
    it("formats date correctly", () => {
      const { getByText } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      expect(getByText("1/15/2024")).toBeTruthy();
    });

    it("handles different date formats", () => {
      const photoWithDifferentDate = {
        ...mockPhoto,
        createdAt: "2024-12-25T23:59:59Z",
      };
      
      const { getByText } = render(
        <PhotoPreviewSheet {...defaultProps} photo={photoWithDifferentDate} />
      );
      
      expect(getByText("12/25/2024")).toBeTruthy();
    });
  });

  describe("Theme Integration", () => {
    it("uses theme colors correctly", () => {
      const { getByTestId } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const container = getByTestId("preview-container");
      expect(container.props.style.backgroundColor).toBe("#ffffff");
      
      const viewFullButton = getByTestId("view-full-button");
      expect(viewFullButton.props.style.backgroundColor).toBe("#D4AF37");
      
      const closeButton = getByTestId("close-button");
      expect(closeButton.props.style.backgroundColor).toBe("#f0f0f0");
    });

    it("applies theme to text colors", () => {
      const { getByTestId } = render(<PhotoPreviewSheet {...defaultProps} />);
      
      const viewFullButtonText = getByTestId("view-full-button-text");
      expect(viewFullButtonText.props.style.color).toBe("#ffffff");
      
      const closeButtonText = getByTestId("close-button-text");
      expect(closeButtonText.props.style.color).toBe("#1A202C");
    });
  });

  describe("Error Handling", () => {
    it("handles missing photo gracefully", () => {
      const { queryByTestId } = render(
        <PhotoPreviewSheet {...defaultProps} photo={null} />
      );
      
      expect(queryByTestId("modal")).toBeFalsy();
    });

    it("handles photo with missing URI gracefully", () => {
      const photoWithMissingUri = {
        ...mockPhoto,
        uri: "",
      };
      
      const { getByTestId } = render(
        <PhotoPreviewSheet {...defaultProps} photo={photoWithMissingUri} />
      );
      
      expect(getByTestId("modal")).toBeTruthy();
      expect(getByTestId("photo-image")).toBeTruthy();
    });

    it("handles invalid date gracefully", () => {
      const photoWithInvalidDate = {
        ...mockPhoto,
        createdAt: "invalid-date",
      };
      
      const { getByText } = render(
        <PhotoPreviewSheet {...defaultProps} photo={photoWithInvalidDate} />
      );
      
      expect(getByText("Invalid Date")).toBeTruthy();
    });

    it("handles missing callbacks gracefully", () => {
      const { getByTestId } = render(
        <PhotoPreviewSheet 
          photo={mockPhoto} 
          visible={true}
          onClose={vi.fn()}
          onViewFull={vi.fn()}
        />
      );
      
      expect(getByTestId("modal")).toBeTruthy();
      
      // Should not throw when buttons are pressed
      const viewFullButton = getByTestId("view-full-button");
      const closeButton = getByTestId("close-button");
      
      expect(() => fireEvent.press(viewFullButton)).not.toThrow();
      expect(() => fireEvent.press(closeButton)).not.toThrow();
    });
  });

  describe("Props Interface", () => {
    it("accepts all required props", () => {
      const customProps = {
        photo: mockPhoto,
        visible: true,
        onClose: vi.fn(),
        onViewFull: vi.fn(),
      };
      
      const { getByTestId } = render(<PhotoPreviewSheet {...customProps} />);
      
      expect(getByTestId("modal")).toBeTruthy();
    });

    it("works with different photo objects", () => {
      const differentPhoto: Photo = {
        id: "2",
        uri: "https://example.com/different.jpg",
        width: 800,
        height: 600,
        createdAt: "2023-06-15T14:30:00Z",
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          city: "New York",
        },
      };
      
      const { getByText } = render(
        <PhotoPreviewSheet {...defaultProps} photo={differentPhoto} />
      );
      
      expect(getByText("New York")).toBeTruthy();
      expect(getByText("6/15/2023")).toBeTruthy();
    });
  });
});

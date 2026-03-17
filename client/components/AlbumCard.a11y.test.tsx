import { render } from "@testing-library/react-native";
import { AlbumCard } from "./AlbumCard";
import { Album } from "@/types";

// Mock the dependencies that might cause issues
jest.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: () => 80,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 44,
    bottom: 34,
    left: 0,
    right: 0,
  }),
}));

jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      backgroundDefault: "#ffffff",
      backgroundTertiary: "#f5f5f5",
      text: "#000000",
      textSecondary: "#666666",
    },
  }),
}));

describe("AlbumCard Accessibility", () => {
  const mockAlbum: Album = {
    id: "album-1",
    title: "Vacation Photos",
    photoIds: ["photo-1", "photo-2", "photo-3"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockOnPress = jest.fn();
  const mockOnLongPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have proper accessibility role as button", () => {
    const { getByRole } = render(
      <AlbumCard album={mockAlbum} onPress={mockOnPress} />
    );

    const button = getByRole("button");
    expect(button).toBeTruthy();
    expect(button.props.accessible).toBe(true);
  });

  it("should have descriptive accessibility label with album title and photo count", () => {
    const { getByRole } = render(
      <AlbumCard album={mockAlbum} onPress={mockOnPress} />
    );

    const button = getByRole("button");
    expect(button.props.accessibilityLabel).toBe(
      "Album: Vacation Photos with 3 photos"
    );
  });

  it("should have accessibility hint explaining the action", () => {
    const { getByRole } = render(
      <AlbumCard album={mockAlbum} onPress={mockOnPress} />
    );

    const button = getByRole("button");
    expect(button.props.accessibilityHint).toBe("Opens album to view photos");
  });

  it("should handle singular photo count correctly", () => {
    const singlePhotoAlbum: Album = {
      ...mockAlbum,
      title: "Solo Photo",
      photoIds: ["photo-1"],
    };

    const { getByRole } = render(
      <AlbumCard album={singlePhotoAlbum} onPress={mockOnPress} />
    );

    const button = getByRole("button");
    expect(button.props.accessibilityLabel).toBe(
      "Album: Solo Photo with 1 photo"
    );
  });

  it("should have proper testID for testing", () => {
    const { getByTestId } = render(
      <AlbumCard album={mockAlbum} onPress={mockOnPress} />
    );

    const albumCard = getByTestId("album-card-album-1");
    expect(albumCard).toBeTruthy();
  });

  it("should maintain press functionality with accessibility", () => {
    const { getByRole } = render(
      <AlbumCard album={mockAlbum} onPress={mockOnPress} />
    );

    const button = getByRole("button");
    
    // Simulate press
    button.props.onPress();
    expect(mockOnPress).toHaveBeenCalledWith(mockAlbum);
  });

  it("should handle long press accessibility", () => {
    const { getByRole } = render(
      <AlbumCard 
        album={mockAlbum} 
        onPress={mockOnPress} 
        onLongPress={mockOnLongPress}
      />
    );

    const button = getByRole("button");
    
    // Simulate long press
    if (button.props.onLongPress) {
      button.props.onLongPress();
      expect(mockOnLongPress).toHaveBeenCalledWith(mockAlbum);
    }
  });

  it("should work with albums without cover photos", () => {
    const albumWithoutCover: Album = {
      ...mockAlbum,
      coverPhotoUri: undefined,
    };

    const { getByRole } = render(
      <AlbumCard album={albumWithoutCover} onPress={mockOnPress} />
    );

    const button = getByRole("button");
    expect(button).toBeTruthy();
    expect(button.props.accessibilityLabel).toBe(
      "Album: Vacation Photos with 3 photos"
    );
  });

  it("should have accessible content for screen readers", () => {
    const { getByRole } = render(
      <AlbumCard album={mockAlbum} onPress={mockOnPress} />
    );

    const button = getByRole("button");
    
    // Verify all accessibility properties are present
    expect(button.props.accessible).toBe(true);
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).toBeTruthy();
    expect(button.props.accessibilityHint).toBeTruthy();
    expect(typeof button.props.accessibilityLabel).toBe("string");
    expect(typeof button.props.accessibilityHint).toBe("string");
  });
});

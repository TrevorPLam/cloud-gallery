import { render } from "@testing-library/react-native";
import { FloatingActionButton } from "./FloatingActionButton";

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

describe("FloatingActionButton Accessibility", () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have proper accessibility role as button", () => {
    const { getByRole } = render(
      <FloatingActionButton onPress={mockOnPress} />
    );

    const button = getByRole("button");
    expect(button).toBeTruthy();
    expect(button.props.accessible).toBe(true);
  });

  it("should have default accessibility label for plus icon", () => {
    const { getByRole } = render(
      <FloatingActionButton onPress={mockOnPress} />
    );

    const button = getByRole("button");
    expect(button.props.accessibilityLabel).toBe("Upload photos");
  });

  it("should have custom accessibility label for different icons", () => {
    const { getByRole } = render(
      <FloatingActionButton onPress={mockOnPress} icon="camera" />
    );

    const button = getByRole("button");
    expect(button.props.accessibilityLabel).toBe("Add camera");
  });

  it("should have accessibility hint explaining the action", () => {
    const { getByRole } = render(
      <FloatingActionButton onPress={mockOnPress} />
    );

    const button = getByRole("button");
    expect(button.props.accessibilityHint).toBe("Opens photo upload interface");
  });

  it("should have proper testID for testing", () => {
    const { getByTestId } = render(
      <FloatingActionButton onPress={mockOnPress} />
    );

    const fab = getByTestId("fab-upload");
    expect(fab).toBeTruthy();
  });

  it("should maintain press functionality with accessibility", () => {
    const { getByRole } = render(
      <FloatingActionButton onPress={mockOnPress} />
    );

    const button = getByRole("button");
    
    // Simulate press
    button.props.onPress();
    expect(mockOnPress).toHaveBeenCalled();
  });

  it("should have accessible content for screen readers", () => {
    const { getByRole } = render(
      <FloatingActionButton onPress={mockOnPress} />
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

  it("should work with different icon types", () => {
    const icons = ["plus", "camera", "image", "settings"] as const;
    
    icons.forEach((icon) => {
      const { getByRole } = render(
        <FloatingActionButton onPress={mockOnPress} icon={icon} />
      );

      const button = getByRole("button");
      if (icon === "plus") {
        expect(button.props.accessibilityLabel).toBe("Upload photos");
      } else {
        expect(button.props.accessibilityLabel).toBe(`Add ${icon}`);
      }
    });
  });

  it("should handle press animations with accessibility", () => {
    const { getByRole } = render(
      <FloatingActionButton onPress={mockOnPress} />
    );

    const button = getByRole("button");
    
    // Verify press handlers exist
    expect(button.props.onPressIn).toBeTruthy();
    expect(button.props.onPressOut).toBeTruthy();
    expect(button.props.onPress).toBeTruthy();
  });

  it("should maintain focusability for keyboard navigation", () => {
    const { getByRole } = render(
      <FloatingActionButton onPress={mockOnPress} />
    );

    const button = getByRole("button");
    expect(button.props.focusable).toBe(true);
  });

  it("should have proper accessibility structure", () => {
    const { getByRole } = render(
      <FloatingActionButton onPress={mockOnPress} />
    );

    const button = getByRole("button");
    
    // Verify the button follows accessibility best practices
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).not.toMatch(/button$/i); // Should not end with "button"
    expect(button.props.accessibilityHint).toMatch(/opens/i); // Should describe action outcome
  });
});

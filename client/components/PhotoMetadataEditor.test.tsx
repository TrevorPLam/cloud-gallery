// AI-META-BEGIN
// AI-META: Unit tests for PhotoMetadataEditor ML labels functionality
// OWNERSHIP: client/components
// ENTRYPOINTS: test runner
// DEPENDENCIES: vitest, @testing-library/react-native, react-test-renderer
// DANGER: Tests must cover ML label editing edge cases
// CHANGE-SAFETY: Add tests for new ML label features
// TESTS: npm run test
// AI-META-END

import { describe, it, expect, vi, beforeEach, waitFor } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { PhotoMetadataEditor } from "./PhotoMetadataEditor";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Text, View } from "react-native";

// Mock dependencies
vi.mock("@/hooks/useTheme");
vi.mock("@/components/ThemedText", () => {
  return {
    ThemedText: ({ children, ...props }: React.ComponentProps<typeof Text>) => (
      <Text {...props}>{children}</Text>
    ),
  };
});

vi.mock("@/components/ThemedView", () => {
  return {
    ThemedView: ({ children, ...props }: React.ComponentProps<typeof View>) => (
      <View {...props}>{children}</View>
    ),
  };
});

// Mock the native modules that PhotoMetadataEditor uses
vi.mock("expo-blur", () => ({
  BlurView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
}));

vi.mock("@expo/vector-icons", () => ({
  Feather: ({ name, ...props }: any) => <Text {...props}>{name}</Text>,
}));

const mockTheme = {
  backgroundSecondary: "#ffffff",
  backgroundDefault: "#f5f5f5",
  text: "#000000",
  textSecondary: "#666666",
  border: "#e0e0e0",
  accent: "#007AFF",
};

describe("PhotoMetadataEditor ML Labels", () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnMlLabelsUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTheme).mockReturnValue({
      theme: mockTheme,
      isDark: false,
    });
  });

  const renderEditor = (props = {}) => {
    const defaultProps = {
      visible: true,
      onClose: mockOnClose,
      onSave: mockOnSave,
      initialTags: ["vacation", "beach"],
      initialNotes: "Great vacation!",
      initialMlLabels: ["outdoor", "sunset", "ocean"],
      onMlLabelsUpdate: mockOnMlLabelsUpdate,
      ...props,
    };

    return render(<PhotoMetadataEditor {...defaultProps} />);
  };

  describe("ML Labels Display", () => {
    it("should display initial ML labels correctly", () => {
      const { getByPlaceholderText } = renderEditor();

      const mlLabelsInput = getByPlaceholderText(
        "AI labels will appear here...",
      );
      expect(mlLabelsInput.props.value).toBe("outdoor, sunset, ocean");
    });

    it("should show empty ML labels input when no labels provided", () => {
      const { getByPlaceholderText } = renderEditor({
        initialMlLabels: undefined,
      });

      const mlLabelsInput = getByPlaceholderText(
        "AI labels will appear here...",
      );
      expect(mlLabelsInput.props.value).toBe("");
    });

    it("should display ML labels section title", () => {
      const { getByText } = renderEditor();

      expect(getByText("AI Detected Labels")).toBeTruthy();
      expect(
        getByText("Objects and scenes detected by AI (comma separated)"),
      ).toBeTruthy();
    });
  });

  describe("ML Labels Editing", () => {
    it("should allow editing ML labels", async () => {
      const { getByPlaceholderText } = renderEditor();

      const mlLabelsInput = getByPlaceholderText(
        "AI labels will appear here...",
      );
      await fireEvent.changeText(mlLabelsInput, "mountain, forest, hiking");

      expect(mlLabelsInput.props.value).toBe("mountain, forest, hiking");
    });

    it("should call onMlLabelsUpdate when saving with ML label changes", async () => {
      const { getByPlaceholderText, getByText } = renderEditor();

      // Change ML labels
      const mlLabelsInput = getByPlaceholderText(
        "AI labels will appear here...",
      );
      await fireEvent.changeText(mlLabelsInput, "mountain, forest");

      // Save
      const saveButton = getByText("Save");
      await fireEvent.press(saveButton);

      expect(mockOnMlLabelsUpdate).toHaveBeenCalledWith(["mountain", "forest"]);
    });

    it("should not call onMlLabelsUpdate when ML labels unchanged", async () => {
      const { getByText } = renderEditor();

      // Save without changing ML labels
      const saveButton = getByText("Save");
      await fireEvent.press(saveButton);

      expect(mockOnMlLabelsUpdate).not.toHaveBeenCalled();
    });

    it("should handle empty ML labels correctly", async () => {
      const { getByPlaceholderText, getByText } = renderEditor();

      // Clear ML labels
      const mlLabelsInput = getByPlaceholderText(
        "AI labels will appear here...",
      );
      await fireEvent.changeText(mlLabelsInput, "");

      // Save
      const saveButton = getByText("Save");
      await fireEvent.press(saveButton);

      expect(mockOnMlLabelsUpdate).toHaveBeenCalledWith([]);
    });

    it("should trim whitespace and filter empty strings from ML labels", async () => {
      const { getByPlaceholderText, getByText } = renderEditor();

      // Add labels with extra whitespace and empty entries
      const mlLabelsInput = getByPlaceholderText(
        "AI labels will appear here...",
      );
      await fireEvent.changeText(mlLabelsInput, " mountain , , forest ,  , hiking ");

      // Save
      const saveButton = getByText("Save");
      await fireEvent.press(saveButton);

      expect(mockOnMlLabelsUpdate).toHaveBeenCalledWith([
        "mountain",
        "forest",
        "hiking",
      ]);
    });
  });

  describe("State Management", () => {
    it("should reset ML labels when modal opens with new data", async () => {
      const { rerender, getByPlaceholderText } = renderEditor({
        initialMlLabels: ["outdoor", "sunset"],
      });

      // Initial state
      let mlLabelsInput = getByPlaceholderText("AI labels will appear here...");
      expect(mlLabelsInput.props.value).toBe("outdoor, sunset");

      // Change labels
      await fireEvent.changeText(mlLabelsInput, "mountain, forest");

      // Reopen with different initial labels
      rerender(
        <PhotoMetadataEditor
          visible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          initialTags={["vacation"]}
          initialNotes="Notes"
          initialMlLabels={["beach", "ocean"]}
          onMlLabelsUpdate={mockOnMlLabelsUpdate}
        />,
      );

      // Should reset to new initial labels
      mlLabelsInput = getByPlaceholderText("AI labels will appear here...");
      expect(mlLabelsInput.props.value).toBe("beach, ocean");
    });

    it("should not reset ML labels when modal is not visible", () => {
      const { rerender, getByPlaceholderText } = renderEditor({
        visible: true,
        initialMlLabels: ["outdoor", "sunset"],
      });

      // Change labels
      const mlLabelsInput = getByPlaceholderText(
        "AI labels will appear here...",
      );
      fireEvent.changeText(mlLabelsInput, "mountain, forest");

      // Hide modal
      rerender(
        <PhotoMetadataEditor
          visible={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
          initialTags={["vacation"]}
          initialNotes="Notes"
          initialMlLabels={["beach", "ocean"]}
          onMlLabelsUpdate={mockOnMlLabelsUpdate}
        />,
      );

      // Should not reset when not visible
      expect(mlLabelsInput.props.value).toBe("mountain, forest");
    });
  });

  describe("Integration with Save Function", () => {
    it("should call onSave with tags and notes along with ML labels update", async () => {
      const { getByPlaceholderText, getByText } = renderEditor();

      // Change all fields
      const tagsInput = getByPlaceholderText("Add tags...");
      const notesInput = getByPlaceholderText("Add notes...");
      const mlLabelsInput = getByPlaceholderText(
        "AI labels will appear here...",
      );

      await fireEvent.changeText(tagsInput, "family, fun");
      await fireEvent.changeText(notesInput, "Amazing trip!");
      await fireEvent.changeText(mlLabelsInput, "mountain, hiking");

      // Save
      const saveButton = getByText("Save");
      await fireEvent.press(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        ["family", "fun"],
        "Amazing trip!",
      );
      expect(mockOnMlLabelsUpdate).toHaveBeenCalledWith(["mountain", "hiking"]);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should work without onMlLabelsUpdate callback", async () => {
      const { getByPlaceholderText, getByText } = renderEditor({
        onMlLabelsUpdate: undefined,
      });

      // Change ML labels and save
      const mlLabelsInput = getByPlaceholderText(
        "AI labels will appear here...",
      );
      await fireEvent.changeText(mlLabelsInput, "mountain, forest");

      const saveButton = getByText("Save");
      await fireEvent.press(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
      // Should not throw error without onMlLabelsUpdate
    });
  });
});

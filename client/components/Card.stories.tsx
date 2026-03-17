/**
 * Visual regression stories for Card component
 *
 * Purpose: Visual testing with Storybook/Chromatic integration
 * Usage: Run visual tests to catch UI regressions
 * Standards: Consistent appearance across themes and elevations
 */

import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";
import {
  createVisualTest,
  visualTestPatterns,
  chromaticConfig,
} from "../test-utils/visual-testing";

// Mock theme hook for visual testing
const mockTheme = {
  backgroundRoot: "#ffffff",
  backgroundDefault: "#f8fafc",
  backgroundSecondary: "#f1f5f9",
  backgroundTertiary: "#e2e8f0",
  text: "#1e293b",
  textSecondary: "#64748b",
};

const mockUseTheme = () => ({ theme: mockTheme });

// Mock the theme hook for visual testing (for TypeScript compilation)
// In runtime, this will be handled by Storybook's mock system

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  parameters: {
    // Visual testing parameters
    chromatic: {
      delay: 300, // Wait for animations
      disableSnapshot: false,
    },
    // Viewport parameters for different screen sizes
    viewport: {
      viewports: {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
      },
    },
  },
  argTypes: {
    elevation: {
      control: "select",
      options: [1, 2, 3],
      description: "Elevation level affects background color",
    },
    title: { control: "text" },
    description: { control: "text" },
    onPress: { action: "pressed" },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

// Basic visual tests
export const Default: Story = {
  args: {
    elevation: 1,
    title: "Card Title",
    description: "This is a card description",
    onPress: () => {},
  },
};

export const Elevation1: Story = {
  args: {
    elevation: 1,
    title: "Elevation 1 Card",
    description: "Uses backgroundDefault color",
    onPress: () => {},
  },
};

export const Elevation2: Story = {
  args: {
    elevation: 2,
    title: "Elevation 2 Card",
    description: "Uses backgroundSecondary color",
    onPress: () => {},
  },
};

export const Elevation3: Story = {
  args: {
    elevation: 3,
    title: "Elevation 3 Card",
    description: "Uses backgroundTertiary color",
    onPress: () => {},
  },
};

// Content variations
export const TitleOnly: Story = {
  args: {
    elevation: 1,
    title: "Title Only Card",
    onPress: () => {},
  },
};

export const DescriptionOnly: Story = {
  args: {
    elevation: 1,
    description: "Description only card without title",
    onPress: () => {},
  },
};

export const WithChildren: Story = {
  args: {
    elevation: 2,
    title: "Card with Children",
    description: "This card has custom content",
    onPress: () => {},
  },
  render: (args) => (
    <Card {...args}>
      <div
        style={{
          padding: "16px",
          backgroundColor: "#e2e8f0",
          borderRadius: "8px",
        }}
      >
        <p>Custom child content</p>
      </div>
    </Card>
  ),
};

export const LongContent: Story = {
  args: {
    elevation: 1,
    title: "Card with Very Long Title That Might Wrap",
    description:
      "This is a very long description that should wrap properly and demonstrate how the card handles overflow text in various scenarios.",
    onPress: () => {},
  },
};

// Interactive states
export const Pressable: Story = {
  args: {
    elevation: 1,
    title: "Pressable Card",
    description: "Click to test press animation",
    onPress: () => {},
  },
};

export const NonPressable: Story = {
  args: {
    elevation: 1,
    title: "Non-Pressable Card",
    description: "No press handler, no interaction",
  },
};

// Visual regression test suite
export const VisualRegression: Story = {
  render: () => {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "16px",
        }}
      >
        <h3>Elevation Levels</h3>
        {visualTestPatterns
          .variants(Card, {
            title: "Elevation Test",
            description: "Testing elevation colors",
            onPress: () => {},
          })
          .map((variant, index) => (
            <div key={index} style={{ marginBottom: "8px" }}>
              <Card {...variant.props} />
            </div>
          ))}

        <h3>Content Variations</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Card elevation={1} title="Title Only" onPress={() => {}} />
          <Card
            elevation={1}
            description="Description Only"
            onPress={() => {}}
          />
          <Card
            elevation={1}
            title="Both"
            description="Title and description"
            onPress={() => {}}
          />
        </div>
      </div>
    );
  },
  parameters: {
    chromatic: {
      // Capture all variants in a single screenshot
      disableSnapshot: false,
      delay: 500,
    },
  },
};

// Dark theme test
export const DarkTheme: Story = {
  args: {
    elevation: 2,
    title: "Dark Theme Card",
    description: "Testing dark theme appearance",
    onPress: () => {},
  },
  parameters: {
    backgrounds: {
      default: "dark",
    },
  },
};

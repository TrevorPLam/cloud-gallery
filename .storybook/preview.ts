/**
 * Storybook preview configuration
 *
 * Purpose: Global Storybook settings for visual testing
 * Usage: Configures themes, viewports, and Chromatic parameters
 * Standards: Consistent visual testing environment
 */

import type { Preview } from "@storybook/react";
import { themes } from "@storybook/theming";

const preview: Preview = {
  parameters: {
    // Theme configuration
    docs: {
      theme: themes.light,
    },

    // Viewport configuration for mobile testing
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: {
            width: "375px",
            height: "667px",
          },
        },
        tablet: {
          name: "Tablet",
          styles: {
            width: "768px",
            height: "1024px",
          },
        },
        desktop: {
          name: "Desktop",
          styles: {
            width: "1200px",
            height: "800px",
          },
        },
      },
      defaultViewport: "mobile",
    },

    // Chromatic configuration
    chromatic: {
      // Global delay for animations
      delay: 300,
      // Capture all viewports for responsive testing
      viewports: ["mobile", "tablet", "desktop"],
      // Skip stories that are marked as disabled
      disableSnapshot: false,
    },

    // Controls configuration
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    // Background configuration for theme testing
    backgrounds: {
      default: "light",
      values: [
        {
          name: "light",
          value: "#ffffff",
        },
        {
          name: "dark",
          value: "#333333",
        },
      ],
    },
  },

  // Global decorators
  decorators: [
    (Story) => {
      // In a real React environment, this would return JSX
      // For TypeScript compilation, we'll use a simple function
      return Story();
    },
  ],

  // Global tags
  tags: ["autodocs"],
};

export default preview;

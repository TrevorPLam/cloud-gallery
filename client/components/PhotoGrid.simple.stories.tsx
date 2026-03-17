/**
 * Visual regression stories for PhotoGrid component
 *
 * Purpose: Visual testing with Storybook/Chromatic integration
 * Usage: Run visual tests to catch UI regressions
 * Standards: Consistent appearance across different photo layouts
 */

import type { Meta, StoryObj } from "@storybook/react";
import { PhotoGrid } from "./PhotoGrid";
import { Photo } from "@/types";

// Mock photo data for visual testing
const mockPhotos: Photo[] = Array.from({ length: 6 }, (_, i) => ({
  id: `photo-${i + 1}`,
  uri: `https://picsum.photos/200/200?random=${i + 1}`,
  width: 200,
  height: 200,
  createdAt: new Date(Date.now() - i * 1000000).toISOString(),
  updatedAt: new Date(Date.now() - i * 1000000).toISOString(),
  isFavorite: i % 3 === 0,
  metadata: {
    size: 1024 * 100,
    format: "jpeg",
  },
}));

const meta: Meta<typeof PhotoGrid> = {
  title: "Components/PhotoGrid",
  component: PhotoGrid,
  parameters: {
    chromatic: {
      delay: 500,
      disableSnapshot: false,
    },
    viewport: {
      viewports: {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
        desktop: { width: 1200, height: 800 },
      },
      defaultViewport: "mobile",
    },
  },
  argTypes: {
    photos: { control: "object" },
    onPhotoPress: { action: "photoPressed" },
    onPhotoLongPress: { action: "photoLongPressed" },
  },
};

export default meta;
type Story = StoryObj<typeof PhotoGrid>;

export const Default: Story = {
  args: {
    photos: mockPhotos,
    onPhotoPress: (photo, index) =>
      console.log("Photo pressed:", photo.id, index),
  },
};

export const Empty: Story = {
  args: {
    photos: [],
    onPhotoPress: () => {},
  },
  parameters: {
    chromatic: {
      delay: 200,
    },
  },
};

export const WithFavorites: Story = {
  args: {
    photos: mockPhotos.filter((photo) => photo.isFavorite),
    onPhotoPress: () => {},
  },
};

export const MobileView: Story = {
  args: {
    photos: mockPhotos,
    onPhotoPress: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile",
    },
  },
};

export const TabletView: Story = {
  args: {
    photos: mockPhotos,
    onPhotoPress: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};

export const DesktopView: Story = {
  args: {
    photos: mockPhotos,
    onPhotoPress: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: "desktop",
    },
  },
};

/**
 * Visual regression stories for AlbumCard component
 *
 * Purpose: Visual testing with Storybook/Chromatic integration
 * Usage: Run visual tests to catch UI regressions
 * Standards: Consistent appearance across different album states
 */

import type { Meta, StoryObj } from "@storybook/react";
import { AlbumCard } from "./AlbumCard";
import { Album } from "@/types";

// Mock album data for visual testing
const mockAlbums: Album[] = [
  {
    id: "album-1",
    title: "Summer Vacation 2023",
    photoIds: ["photo-1", "photo-2", "photo-3"],
    coverPhotoUri: "https://picsum.photos/400/225?random=1",
    createdAt: new Date("2023-07-15").toISOString(),
    updatedAt: new Date("2023-07-15").toISOString(),
  },
  {
    id: "album-2",
    title: "Family Photos",
    photoIds: ["photo-4", "photo-5"],
    coverPhotoUri: "https://picsum.photos/400/225?random=2",
    createdAt: new Date("2023-06-20").toISOString(),
    updatedAt: new Date("2023-06-20").toISOString(),
  },
  {
    id: "album-3",
    title: "Empty Album",
    photoIds: [],
    coverPhotoUri: undefined,
    createdAt: new Date("2023-08-01").toISOString(),
    updatedAt: new Date("2023-08-01").toISOString(),
  },
];

const meta: Meta<typeof AlbumCard> = {
  title: "Components/AlbumCard",
  component: AlbumCard,
  parameters: {
    chromatic: {
      delay: 300,
      disableSnapshot: false,
    },
    viewport: {
      viewports: {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
      },
      defaultViewport: "mobile",
    },
  },
  argTypes: {
    album: { control: "object" },
    onPress: { action: "albumPressed" },
    onLongPress: { action: "albumLongPressed" },
  },
};

export default meta;
type Story = StoryObj<typeof AlbumCard>;

export const Default: Story = {
  args: {
    album: mockAlbums[0],
    onPress: (album) => console.log("Album pressed:", album.title),
  },
};

export const WithCoverPhoto: Story = {
  args: {
    album: mockAlbums[1],
    onPress: () => {},
  },
};

export const WithoutCoverPhoto: Story = {
  args: {
    album: mockAlbums[2], // Empty album
    onPress: () => {},
  },
};

export const SinglePhoto: Story = {
  args: {
    album: mockAlbums[1], // 2 photos
    onPress: () => {},
  },
};

export const MultiplePhotos: Story = {
  args: {
    album: {
      ...mockAlbums[0],
      photoIds: ["photo-1", "photo-2", "photo-3", "photo-4", "photo-5"],
    },
    onPress: () => {},
  },
};

export const LongTitle: Story = {
  args: {
    album: {
      ...mockAlbums[0],
      title:
        "Very Long Album Title That Should Wrap Properly Across Multiple Lines",
    },
    onPress: () => {},
  },
};

export const MobileView: Story = {
  args: {
    album: mockAlbums[0],
    onPress: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile",
    },
  },
};

export const TabletView: Story = {
  args: {
    album: mockAlbums[0],
    onPress: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};

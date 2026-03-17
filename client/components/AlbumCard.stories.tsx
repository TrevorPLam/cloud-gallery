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
import { chromaticConfig } from "../test-utils/visual-testing";

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
    title: "Nature Photography",
    photoIds: ["photo-6", "photo-7", "photo-8", "photo-9", "photo-10"],
    coverPhotoUri: "https://picsum.photos/400/225?random=3",
    createdAt: new Date("2023-05-10").toISOString(),
    updatedAt: new Date("2023-05-10").toISOString(),
  },
  {
    id: "album-4",
    title: "Empty Album",
    photoIds: [],
    coverPhotoUri: undefined,
    createdAt: new Date("2023-08-01").toISOString(),
    updatedAt: new Date("2023-08-01").toISOString(),
  },
  {
    id: "album-5",
    title: "Very Long Album Title That Should Wrap Properly",
    photoIds: Array.from({ length: 100 }, (_, i) => `photo-long-${i}`),
    coverPhotoUri: "https://picsum.photos/400/225?random=4",
    createdAt: new Date("2023-04-15").toISOString(),
    updatedAt: new Date("2023-04-15").toISOString(),
  },
];

// Mock theme hook
const mockTheme = {
  backgroundRoot: "#ffffff",
  backgroundDefault: "#f8fafc",
  backgroundSecondary: "#f1f5f9",
  backgroundTertiary: "#e2e8f0",
  text: "#1e293b",
  textSecondary: "#64748b",
};

const mockUseTheme = () => ({ theme: mockTheme });

// Mock the useTheme hook and Platform
jest.mock("@/hooks/useTheme", () => ({
  useTheme: mockUseTheme,
}));

jest.mock("react-native", () => ({
  ...jest.requireActual("react-native"),
  Platform: { OS: "web" },
}));

const meta: Meta<typeof AlbumCard> = {
  title: "Components/AlbumCard",
  component: AlbumCard,
  parameters: {
    // Visual testing parameters
    chromatic: {
      delay: 300, // Wait for images to load
      disableSnapshot: false,
    },
    // Viewport parameters for different screen sizes
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

// Basic visual tests
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
    album: mockAlbums[3], // Empty album
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
    album: mockAlbums[2], // 5 photos
    onPress: () => {},
  },
};

export const ManyPhotos: Story = {
  args: {
    album: mockAlbums[4], // 100 photos
    onPress: () => {},
  },
};

// Content variations
export const LongTitle: Story = {
  args: {
    album: mockAlbums[4],
    onPress: () => {},
  },
};

export const ShortTitle: Story = {
  args: {
    album: {
      ...mockAlbums[0],
      title: "Trip",
    },
    onPress: () => {},
  },
};

// Interactive states
export const WithLongPress: Story = {
  args: {
    album: mockAlbums[0],
    onPress: () => {},
    onLongPress: (album) => console.log("Album long pressed:", album.title),
  },
};

export const WithoutLongPress: Story = {
  args: {
    album: mockAlbums[0],
    onPress: () => {},
  },
};

// Visual regression test suite
export const VisualRegression: Story = {
  render: () => {
    return (
      <div style={{ padding: "16px" }}>
        <h3>Album Card Variations</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {mockAlbums.map((album, index) => (
            <div key={album.id} style={{ maxWidth: "300px" }}>
              <h4>{album.title}</h4>
              <AlbumCard
                album={album}
                onPress={() => {}}
                onLongPress={() => {}}
              />
            </div>
          ))}
        </div>
      </div>
    );
  },
  parameters: {
    chromatic: {
      disableSnapshot: false,
      delay: 500,
    },
  },
};

// Responsive tests
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

// Dark theme test
export const DarkTheme: Story = {
  args: {
    album: mockAlbums[0],
    onPress: () => {},
  },
  parameters: {
    backgrounds: {
      default: "dark",
    },
  },
};

// Performance test with multiple cards
export const MultipleCards: Story = {
  render: () => {
    return (
      <div style={{ padding: "16px" }}>
        <h3>Multiple Album Cards</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "16px",
          }}
        >
          {mockAlbums.slice(0, 3).map((album) => (
            <AlbumCard key={album.id} album={album} onPress={() => {}} />
          ))}
        </div>
      </div>
    );
  },
  parameters: {
    chromatic: {
      delay: 500,
    },
  },
};

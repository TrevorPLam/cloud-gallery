/**
 * Visual regression stories for PhotoGrid component
 * 
 * Purpose: Visual testing with Storybook/Chromatic integration
 * Usage: Run visual tests to catch UI regressions
 * Standards: Consistent appearance across different photo layouts
 */

import type { Meta, StoryObj } from '@storybook/react';
import { PhotoGrid } from './PhotoGrid';
import { Photo } from '@/types';
import { chromaticConfig } from '../test-utils/visual-testing';

// Mock photo data for visual testing
const mockPhotos: Photo[] = Array.from({ length: 12 }, (_, i) => ({
  id: `photo-${i + 1}`,
  uri: `https://picsum.photos/200/200?random=${i + 1}`,
  width: 200,
  height: 200,
  createdAt: new Date(Date.now() - i * 1000000).toISOString(),
  updatedAt: new Date(Date.now() - i * 1000000).toISOString(),
  isFavorite: i % 3 === 0, // Every 3rd photo is favorite
  metadata: {
    size: 1024 * 100, // 100KB
    format: 'jpeg',
  },
}));

// Mock grouped data
const mockGroupedData = [
  {
    title: 'Today',
    data: mockPhotos.slice(0, 3),
  },
  {
    title: 'Yesterday',
    data: mockPhotos.slice(3, 7),
  },
  {
    title: 'This Week',
    data: mockPhotos.slice(7, 12),
  },
];

// Mock theme and hooks
const mockTheme = {
  backgroundRoot: '#ffffff',
  backgroundDefault: '#f8fafc',
  backgroundSecondary: '#f1f5f9',
  backgroundTertiary: '#e2e8f0',
  text: '#1e293b',
  textSecondary: '#64748b',
};

const mockUseTheme = () => ({ theme: mockTheme });
const mockUseWindowDimensions = () => ({ width: 375, height: 667 });

// Mock the hooks
jest.mock('@/hooks/useTheme', () => ({
  useTheme: mockUseTheme,
}));

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  useWindowDimensions: mockUseWindowDimensions,
  Platform: { OS: 'web' },
}));

const meta: Meta<typeof PhotoGrid> = {
  title: 'Components/PhotoGrid',
  component: PhotoGrid,
  parameters: {
    // Visual testing parameters
    chromatic: {
      delay: 500, // Wait for images to load
      disableSnapshot: false,
    },
    // Viewport parameters for different screen sizes
    viewport: {
      viewports: {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
        desktop: { width: 1200, height: 800 },
      },
      defaultViewport: 'mobile',
    },
  },
  argTypes: {
    photos: { control: 'object' },
    groupedData: { control: 'object' },
    showSectionHeaders: { control: 'boolean' },
    onPhotoPress: { action: 'photoPressed' },
    onPhotoLongPress: { action: 'photoLongPressed' },
  },
};

export default meta;
type Story = StoryObj<typeof PhotoGrid>;

// Basic visual tests
export const Default: Story = {
  args: {
    photos: mockPhotos.slice(0, 6),
    onPhotoPress: (photo, index) => console.log('Photo pressed:', photo.id, index),
  },
};

export const Empty: Story = {
  args: {
    photos: [],
    onPhotoPress: () => {},
  },
  parameters: {
    chromatic: {
      delay: 200, // Less delay for empty state
    },
  },
};

export const WithFavorites: Story = {
  args: {
    photos: mockPhotos.filter(photo => photo.isFavorite),
    onPhotoPress: () => {},
  },
};

export const LargeGrid: Story = {
  args: {
    photos: mockPhotos,
    onPhotoPress: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
};

// Grouped data tests
export const GroupedWithHeaders: Story = {
  args: {
    groupedData: mockGroupedData,
    showSectionHeaders: true,
    onPhotoPress: () => {},
  },
};

export const GroupedWithoutHeaders: Story = {
  args: {
    groupedData: mockGroupedData,
    showSectionHeaders: false,
    onPhotoPress: () => {},
  },
};

// Responsive tests
export const MobileView: Story = {
  args: {
    photos: mockPhotos.slice(0, 9),
    onPhotoPress: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
  },
};

export const TabletView: Story = {
  args: {
    photos: mockPhotos.slice(0, 9),
    onPhotoPress: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

export const DesktopView: Story = {
  args: {
    photos: mockPhotos.slice(0, 9),
    onPhotoPress: () => {},
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
};

// Performance tests
export const ManyPhotos: Story = {
  args: {
    photos: Array.from({ length: 50 }, (_, i) => ({
      ...mockPhotos[0],
      id: `photo-many-${i}`,
      uri: `https://picsum.photos/200/200?random=${i + 100}`,
    })),
    onPhotoPress: () => {},
  },
  parameters: {
    chromatic: {
      delay: 1000, // More time for many images
    },
  },
};

// Visual regression test suite
export const VisualRegression: Story = {
  render: () => {
    return (
      <div style={{ padding: '16px' }}>
        <h3>Grid Layouts</h3>
        <div style={{ marginBottom: '32px' }}>
          <h4>Small Grid (3 photos)</h4>
          <div style={{ height: '200px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
            <PhotoGrid 
              photos={mockPhotos.slice(0, 3)} 
              onPhotoPress={() => {}} 
            />
          </div>
        </div>
        
        <div style={{ marginBottom: '32px' }}>
          <h4>Medium Grid (6 photos)</h4>
          <div style={{ height: '300px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
            <PhotoGrid 
              photos={mockPhotos.slice(0, 6)} 
              onPhotoPress={() => {}} 
            />
          </div>
        </div>
        
        <div style={{ marginBottom: '32px' }}>
          <h4>Grouped with Headers</h4>
          <div style={{ height: '400px', border: '1px solid #e2e8f0' }}>
            <PhotoGrid 
              groupedData={mockGroupedData} 
              showSectionHeaders={true}
              onPhotoPress={() => {}} 
            />
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    chromatic: {
      disableSnapshot: false,
      delay: 1000,
    },
  },
};

// Dark theme test
export const DarkTheme: Story = {
  args: {
    photos: mockPhotos.slice(0, 6),
    onPhotoPress: () => {},
  },
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};

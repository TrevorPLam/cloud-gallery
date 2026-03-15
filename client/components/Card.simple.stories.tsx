/**
 * Visual regression stories for Card component
 * 
 * Purpose: Visual testing with Storybook/Chromatic integration
 * Usage: Run visual tests to catch UI regressions
 * Standards: Consistent appearance across themes and elevations
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
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
    },
  },
  argTypes: {
    elevation: { 
      control: 'select',
      options: [1, 2, 3],
    },
    title: { control: 'text' },
    description: { control: 'text' },
    onPress: { action: 'pressed' },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

// Basic visual tests
export const Default: Story = {
  args: {
    elevation: 1,
    title: 'Card Title',
    description: 'This is a card description',
    onPress: () => {},
  },
};

export const Elevation1: Story = {
  args: {
    elevation: 1,
    title: 'Elevation 1 Card',
    description: 'Uses backgroundDefault color',
    onPress: () => {},
  },
};

export const Elevation2: Story = {
  args: {
    elevation: 2,
    title: 'Elevation 2 Card',
    description: 'Uses backgroundSecondary color',
    onPress: () => {},
  },
};

export const Elevation3: Story = {
  args: {
    elevation: 3,
    title: 'Elevation 3 Card',
    description: 'Uses backgroundTertiary color',
    onPress: () => {},
  },
};

export const TitleOnly: Story = {
  args: {
    elevation: 1,
    title: 'Title Only Card',
    onPress: () => {},
  },
};

export const DescriptionOnly: Story = {
  args: {
    elevation: 1,
    description: 'Description only card without title',
    onPress: () => {},
  },
};

export const LongContent: Story = {
  args: {
    elevation: 1,
    title: 'Card with Very Long Title That Might Wrap',
    description: 'This is a very long description that should wrap properly and demonstrate how the card handles overflow text in various scenarios.',
    onPress: () => {},
  },
};

export const NonPressable: Story = {
  args: {
    elevation: 1,
    title: 'Non-Pressable Card',
    description: 'No press handler, no interaction',
  },
};

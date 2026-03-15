/**
 * Visual regression stories for Button component
 * 
 * Purpose: Visual testing with Storybook/Chromatic integration
 * Usage: Run visual tests to catch UI regressions
 * Standards: Consistent appearance across themes and states
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { visualTestPatterns } from '../test-utils/visual-testing';

// Mock Storybook configuration for React Native
const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
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
    title: { control: 'text' },
    variant: { 
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    onPress: { action: 'pressed' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Basic visual tests
export const Default: Story = {
  args: {
    title: 'Default Button',
    onPress: () => {},
  },
};

export const Secondary: Story = {
  args: {
    title: 'Secondary Button',
    variant: 'secondary',
    onPress: () => {},
  },
};

export const Outline: Story = {
  args: {
    title: 'Outline Button',
    variant: 'outline',
    onPress: () => {},
  },
};

// State variations
export const Pressed: Story = {
  args: {
    title: 'Pressed State',
    onPress: () => {},
  },
  parameters: {
    chromatic: { delay: 100 }, // Capture pressed state
  },
};

export const Disabled: Story = {
  args: {
    title: 'Disabled Button',
    disabled: true,
    onPress: () => {},
  },
};

export const Loading: Story = {
  args: {
    title: 'Loading...',
    loading: true,
    onPress: () => {},
  },
};

// Size variations
export const Small: Story = {
  args: {
    title: 'Small Button',
    size: 'small',
    onPress: () => {},
  },
};

export const Large: Story = {
  args: {
    title: 'Large Button',
    size: 'large',
    onPress: () => {},
  },
};

// Content variations
export const ShortText: Story = {
  args: {
    title: 'OK',
    onPress: () => {},
  },
};

export const LongText: Story = {
  args: {
    title: 'This is a very long button title that might wrap',
    onPress: () => {},
  },
};

// Theme variations (would require theme provider)
export const DarkTheme: Story = {
  args: {
    title: 'Dark Theme Button',
    onPress: () => {},
  },
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};

// Visual regression test suite
export const VisualRegression: Story = {
  render: () => {
    // This story combines multiple variants for comprehensive visual testing
    return (
      <>
        {visualTestPatterns.states(Button, { title: 'Test', onPress: () => {} }).map((variant, index) => (
          <Button key={index} {...variant.props} style={{ marginBottom: 8 }} />
        ))}
        {visualTestPatterns.sizes(Button, { title: 'Size Test', onPress: () => {} }).map((variant, index) => (
          <Button key={index} {...variant.props} style={{ marginBottom: 8 }} />
        ))}
      </>
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

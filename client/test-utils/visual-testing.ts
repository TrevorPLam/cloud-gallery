/**
 * Visual Testing Utilities
 * 
 * Purpose: Helper functions for creating comprehensive visual test stories
 * Usage: Generate test patterns for component states, sizes, and variations
 * Standards: Consistent visual testing patterns across components
 */

import type { ComponentType } from 'react';

export interface VisualTestVariant<T = {}> {
  name: string;
  props: T;
}

export interface VisualTestPatterns<T = {}> {
  states: (component: ComponentType<T>, baseProps: T) => VisualTestVariant<T>[];
  sizes: (component: ComponentType<T>, baseProps: T) => VisualTestVariant<T>[];
  variants: (component: ComponentType<T>, baseProps: T) => VisualTestVariant<T>[];
}

/**
 * Creates visual test patterns for common component properties
 */
export const visualTestPatterns = {
  /**
   * Generate state variations (loading, disabled, pressed)
   */
  states: <T>(component: ComponentType<T>, baseProps: T): VisualTestVariant<T>[] => {
    const variants: VisualTestVariant<T>[] = [];
    
    // Default state
    variants.push({
      name: 'Default',
      props: baseProps,
    });
    
    // Loading state (if supported)
    if ('loading' in baseProps) {
      variants.push({
        name: 'Loading',
        props: { ...baseProps, loading: true } as T,
      });
    }
    
    // Disabled state (if supported)
    if ('disabled' in baseProps) {
      variants.push({
        name: 'Disabled',
        props: { ...baseProps, disabled: true } as T,
      });
    }
    
    // Error state (if supported)
    if ('error' in baseProps) {
      variants.push({
        name: 'Error',
        props: { ...baseProps, error: true } as T,
      });
    }
    
    return variants;
  },
  
  /**
   * Generate size variations (small, medium, large)
   */
  sizes: <T>(component: ComponentType<T>, baseProps: T): VisualTestVariant<T>[] => {
    const variants: VisualTestVariant<T>[] = [];
    
    if ('size' in baseProps) {
      const sizes = ['small', 'medium', 'large'] as const;
      
      sizes.forEach((size) => {
        variants.push({
          name: `Size ${size.charAt(0).toUpperCase() + size.slice(1)}`,
          props: { ...baseProps, size } as T,
        });
      });
    } else {
      // If no size prop, just add default
      variants.push({
        name: 'Default Size',
        props: baseProps,
      });
    }
    
    return variants;
  },
  
  /**
   * Generate variant variations (primary, secondary, outline, ghost)
   */
  variants: <T>(component: ComponentType<T>, baseProps: T): VisualTestVariant<T>[] => {
    const variants: VisualTestVariant<T>[] = [];
    
    if ('variant' in baseProps) {
      const variantTypes = ['primary', 'secondary', 'outline', 'ghost'] as const;
      
      variantTypes.forEach((variant) => {
        variants.push({
          name: `Variant ${variant.charAt(0).toUpperCase() + variant.slice(1)}`,
          props: { ...baseProps, variant } as T,
        });
      });
    } else {
      // If no variant prop, just add default
      variants.push({
        name: 'Default Variant',
        props: baseProps,
      });
    }
    
    return variants;
  },
};

/**
 * Creates a comprehensive visual test story
 */
export const createVisualTest = <T>(
  component: ComponentType<T>,
  baseProps: T,
  options?: {
    includeStates?: boolean;
    includeSizes?: boolean;
    includeVariants?: boolean;
  }
) => {
  const { includeStates = true, includeSizes = true, includeVariants = true } = options || {};
  
  const allVariants: VisualTestVariant<T>[] = [];
  
  if (includeStates) {
    allVariants.push(...visualTestPatterns.states(component, baseProps));
  }
  
  if (includeSizes) {
    allVariants.push(...visualTestPatterns.sizes(component, baseProps));
  }
  
  if (includeVariants) {
    allVariants.push(...visualTestPatterns.variants(component, baseProps));
  }
  
  return allVariants;
};

/**
 * Chromatic configuration helpers
 */
export const chromaticConfig = {
  /**
   * Disable snapshots for animated components
   */
  disableForAnimated: {
    chromatic: {
      disableSnapshot: true,
    },
  },
  
  /**
   * Add delay for components with animations
   */
  delayForAnimations: (delay: number = 300) => ({
    chromatic: {
      delay,
    },
  }),
  
  /**
   * Configure multiple viewports for responsive testing
   */
  responsiveViewports: {
    chromatic: {
      viewports: ['mobile', 'tablet', 'desktop'],
    },
  },
  
  /**
   * Configure theme testing
   */
  themeTesting: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#333333' },
      ],
    },
  },
};

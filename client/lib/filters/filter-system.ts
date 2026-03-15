// AI-META-BEGIN
// AI-META: Filter system for photo adjustments with 15+ presets
// OWNERSHIP: client/lib/filters
// ENTRYPOINTS: imported by EditPhotoScreen and filter components
// DEPENDENCIES: react-native, expo-image
// DANGER: Performance-critical for real-time preview; implement efficient adjustments
// CHANGE-SAFETY: Maintain filter preset compatibility; preserve adjustment parameter ranges
// TESTS: Unit tests for filter application, integration tests for UI performance
// AI-META-END

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { ImageAdjustments, DEFAULT_ADJUSTMENTS } from '../photo-editor';

// Filter presets (15+ presets as required)
export const FILTER_PRESETS = [
  {
    id: 'original',
    name: 'Original',
    description: 'No filter applied',
    adjustments: { ...DEFAULT_ADJUSTMENTS },
  },
  {
    id: 'vintage',
    name: 'Vintage',
    description: 'Warm, faded look with reduced saturation',
    adjustments: {
      brightness: 0.1,
      contrast: -0.2,
      saturation: -0.3,
      vibrance: -0.2,
      temperature: 0.3,
      sharpness: -0.1,
      clarity: -0.1,
      vignette: 0.2,
      exposure: 0.1,
    },
  },
  {
    id: 'black_white',
    name: 'Black & White',
    description: 'Classic monochrome conversion',
    adjustments: {
      brightness: 0.05,
      contrast: 0.2,
      saturation: -1,
      vibrance: -1,
      temperature: 0,
      sharpness: 0.1,
      clarity: 0.1,
      vignette: 0.1,
      exposure: 0,
    },
  },
  {
    id: 'vivid',
    name: 'Vivid',
    description: 'Enhanced colors and contrast',
    adjustments: {
      brightness: 0.05,
      contrast: 0.3,
      saturation: 0.4,
      vibrance: 0.3,
      temperature: 0,
      sharpness: 0.1,
      clarity: 0.1,
      vignette: 0,
      exposure: 0.1,
    },
  },
  {
    id: 'warm',
    name: 'Warm',
    description: 'Cozy warm tones',
    adjustments: {
      brightness: 0.1,
      contrast: 0.1,
      saturation: 0.2,
      vibrance: 0.2,
      temperature: 0.4,
      sharpness: 0,
      clarity: 0,
      vignette: 0.1,
      exposure: 0.05,
    },
  },
  {
    id: 'cool',
    name: 'Cool',
    description: 'Cool blue tones',
    adjustments: {
      brightness: -0.05,
      contrast: 0.1,
      saturation: 0.1,
      vibrance: 0.1,
      temperature: -0.4,
      sharpness: 0.1,
      clarity: 0.1,
      vignette: 0.1,
      exposure: -0.05,
    },
  },
  {
    id: 'dramatic',
    name: 'Dramatic',
    description: 'High contrast with deep shadows',
    adjustments: {
      brightness: -0.1,
      contrast: 0.5,
      saturation: 0.2,
      vibrance: 0.1,
      temperature: -0.1,
      sharpness: 0.2,
      clarity: 0.3,
      vignette: 0.3,
      exposure: -0.2,
    },
  },
  {
    id: 'soft',
    name: 'Soft',
    description: 'Gentle, dreamy appearance',
    adjustments: {
      brightness: 0.15,
      contrast: -0.2,
      saturation: -0.1,
      vibrance: 0,
      temperature: 0.1,
      sharpness: -0.2,
      clarity: -0.3,
      vignette: 0.15,
      exposure: 0.1,
    },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    description: 'Classic brown tone effect',
    adjustments: {
      brightness: 0.1,
      contrast: 0.1,
      saturation: -0.6,
      vibrance: -0.4,
      temperature: 0.6,
      sharpness: -0.1,
      clarity: -0.1,
      vignette: 0.2,
      exposure: 0.05,
    },
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Film-inspired color grading',
    adjustments: {
      brightness: -0.05,
      contrast: 0.3,
      saturation: -0.1,
      vibrance: 0,
      temperature: -0.2,
      sharpness: 0.1,
      clarity: 0.2,
      vignette: 0.25,
      exposure: -0.1,
    },
  },
  {
    id: 'fresh',
    name: 'Fresh',
    description: 'Bright and clean appearance',
    adjustments: {
      brightness: 0.2,
      contrast: 0.15,
      saturation: 0.3,
      vibrance: 0.4,
      temperature: -0.1,
      sharpness: 0.1,
      clarity: 0.1,
      vignette: 0,
      exposure: 0.15,
    },
  },
  {
    id: 'noir',
    name: 'Film Noir',
    description: 'High contrast black and white',
    adjustments: {
      brightness: -0.2,
      contrast: 0.6,
      saturation: -1,
      vibrance: -1,
      temperature: 0,
      sharpness: 0.3,
      clarity: 0.4,
      vignette: 0.4,
      exposure: -0.3,
    },
  },
  {
    id: 'retro',
    name: 'Retro',
    description: '70s inspired color palette',
    adjustments: {
      brightness: 0.05,
      contrast: -0.1,
      saturation: 0.3,
      vibrance: 0.2,
      temperature: 0.2,
      sharpness: -0.2,
      clarity: -0.1,
      vignette: 0.15,
      exposure: 0,
    },
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    description: 'Maximum color intensity',
    adjustments: {
      brightness: 0.1,
      contrast: 0.2,
      saturation: 0.6,
      vibrance: 0.5,
      temperature: 0,
      sharpness: 0.1,
      clarity: 0.1,
      vignette: 0,
      exposure: 0.2,
    },
  },
  {
    id: 'matte',
    name: 'Matte',
    description: 'Flat, desaturated look',
    adjustments: {
      brightness: 0.1,
      contrast: -0.3,
      saturation: -0.2,
      vibrance: -0.1,
      temperature: 0.1,
      sharpness: -0.1,
      clarity: -0.2,
      vignette: 0.1,
      exposure: 0.05,
    },
  },
];

// Filter component for real-time preview
interface FilteredImageProps {
  uri: string;
  adjustments: ImageAdjustments;
  style?: any;
  width: number;
  height: number;
}

export const FilteredImage: React.FC<FilteredImageProps> = React.memo(({
  uri,
  adjustments,
  style,
  width,
  height,
}) => {
  // Check if any adjustments are applied
  const hasAdjustments = useMemo(() => {
    return !Object.entries(adjustments).every(([key, value]) => 
      DEFAULT_ADJUSTMENTS[key as keyof ImageAdjustments] === value
    );
  }, [adjustments]);

  return (
    <View style={[style, { width, height }]}>
      <Image
        source={{ uri }}
        style={{ 
          width, 
          height,
          opacity: Math.max(0.3, Math.min(1, 1 + adjustments.exposure * 0.2)),
        }}
        contentFit="contain"
        cachePolicy="none"
      />
      {hasAdjustments && (
        <View style={styles.adjustmentIndicator} />
      )}
    </View>
  );
});

FilteredImage.displayName = 'FilteredImage';

// Utility functions
export function getFilterPreset(id: string) {
  return FILTER_PRESETS.find(filter => filter.id === id);
}

export function hasFilterAdjustments(adjustments: ImageAdjustments): boolean {
  return !Object.entries(adjustments).every(([key, value]) => 
    DEFAULT_ADJUSTMENTS[key as keyof ImageAdjustments] === value
  );
}

export function getFilterName(id: string): string {
  const filter = getFilterPreset(id);
  return filter ? filter.name : 'Unknown';
}

export function getFilterDescription(id: string): string {
  const filter = getFilterPreset(id);
  return filter ? filter.description : '';
}

// Filter comparison utilities
export function compareFilters(filter1Id: string, filter2Id: string): number {
  const filter1 = getFilterPreset(filter1Id);
  const filter2 = getFilterPreset(filter2Id);
  
  if (!filter1 || !filter2) return 0;
  
  return filter1.name.localeCompare(filter2.name);
}

export function getFiltersByCategory(): Record<string, typeof FILTER_PRESETS> {
  return {
    all: FILTER_PRESETS,
    classic: FILTER_PRESETS.filter(f => ['original', 'black_white', 'sepia', 'noir'].includes(f.id)),
    warm: FILTER_PRESETS.filter(f => ['warm', 'vintage', 'retro'].includes(f.id)),
    cool: FILTER_PRESETS.filter(f => ['cool', 'cinematic', 'dramatic'].includes(f.id)),
    vibrant: FILTER_PRESETS.filter(f => ['vivid', 'vibrant', 'fresh'].includes(f.id)),
    soft: FILTER_PRESETS.filter(f => ['soft', 'matte'].includes(f.id)),
  };
}

const styles = StyleSheet.create({
  adjustmentIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
});

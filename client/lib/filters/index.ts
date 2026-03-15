// AI-META-BEGIN
// AI-META: Filter system using react-native-gl-image-filters for GPU-accelerated image processing
// OWNERSHIP: client/lib/filters
// ENTRYPOINTS: imported by EditPhotoScreen and filter components
// DEPENDENCIES: react-native-gl-image-filters, react-native-reanimated
// DANGER: Performance-critical for real-time preview; memory usage for large images
// CHANGE-SAFETY: Maintain filter preset compatibility; preserve adjustment parameter ranges
// TESTS: Unit tests for filter application, integration tests for GPU performance
// AI-META-END

import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface } from '@react-native-community/gl';
import ImageFilters from 'react-native-gl-image-filters';
import { Image } from 'expo-image';

import { ImageAdjustments, DEFAULT_ADJUSTMENTS } from '../photo-editor';

// Convert our adjustment ranges to GL filter ranges
export function convertToGLFilters(adjustments: ImageAdjustments) {
  return {
    // Convert -1 to 1 range to GL filter ranges
    brightness: adjustments.brightness, // GL: -1 to 1
    contrast: adjustments.contrast,     // GL: -1 to 1  
    saturation: adjustments.saturation, // GL: -1 to 1
    hue: adjustments.temperature * 0.5, // GL: -2 to 2, our temp is -1 to 1
    sepia: 0, // We'll implement sepia as a separate filter
    blur: 0,   // Blur not in our adjustments
    sharpen: adjustments.sharpness, // GL: -1 to 1
    negative: 0, // Not in our adjustments
    exposure: adjustments.exposure * 0.5, // GL: -2 to 2, our exposure is -2 to 2
    temperature: adjustments.temperature, // GL: -1 to 1
  };
}

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
  const glFilters = useMemo(() => convertToGLFilters(adjustments), [adjustments]);

  const renderImage = useCallback(() => (
    <Image
      source={{ uri }}
      style={{ width, height }}
      contentFit="contain"
      cachePolicy="none"
    />
  ), [uri, width, height]);

  // Check if any adjustments are applied
  const hasAdjustments = useMemo(() => {
    return !Object.entries(adjustments).every(([key, value]) => 
      DEFAULT_ADJUSTMENTS[key as keyof ImageAdjustments] === value
    );
  }, [adjustments]);

  // If no adjustments, show original image
  if (!hasAdjustments) {
    return (
      <View style={[style, { width, height }]}>
        {renderImage()}
      </View>
    );
  }

  return (
    <View style={[style, { width, height }]}>
      <Surface style={{ width, height }}>
        <ImageFilters {...glFilters}>
          {renderImage()}
        </ImageFilters>
      </Surface>
    </View>
  );
});

FilteredImage.displayName = 'FilteredImage';

// Preset filter components for common effects
export const VintageFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const vintageAdjustments: ImageAdjustments = {
    brightness: 0.1,
    contrast: -0.2,
    saturation: -0.3,
    vibrance: -0.2,
    temperature: 0.3,
    sharpness: -0.1,
    clarity: -0.1,
    vignette: 0.2,
    exposure: 0.1,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={vintageAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const BlackWhiteFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const bwAdjustments: ImageAdjustments = {
    brightness: 0.05,
    contrast: 0.2,
    saturation: -1,
    vibrance: -1,
    temperature: 0,
    sharpness: 0.1,
    clarity: 0.1,
    vignette: 0.1,
    exposure: 0,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={bwAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const VividFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const vividAdjustments: ImageAdjustments = {
    brightness: 0.05,
    contrast: 0.3,
    saturation: 0.4,
    vibrance: 0.3,
    temperature: 0,
    sharpness: 0.1,
    clarity: 0.1,
    vignette: 0,
    exposure: 0.1,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={vividAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const WarmFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const warmAdjustments: ImageAdjustments = {
    brightness: 0.1,
    contrast: 0.1,
    saturation: 0.2,
    vibrance: 0.2,
    temperature: 0.4,
    sharpness: 0,
    clarity: 0,
    vignette: 0.1,
    exposure: 0.05,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={warmAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const CoolFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const coolAdjustments: ImageAdjustments = {
    brightness: -0.05,
    contrast: 0.1,
    saturation: 0.1,
    vibrance: 0.1,
    temperature: -0.4,
    sharpness: 0.1,
    clarity: 0.1,
    vignette: 0.1,
    exposure: -0.05,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={coolAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const DramaticFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const dramaticAdjustments: ImageAdjustments = {
    brightness: -0.1,
    contrast: 0.5,
    saturation: 0.2,
    vibrance: 0.1,
    temperature: -0.1,
    sharpness: 0.2,
    clarity: 0.3,
    vignette: 0.3,
    exposure: -0.2,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={dramaticAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const SoftFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const softAdjustments: ImageAdjustments = {
    brightness: 0.15,
    contrast: -0.2,
    saturation: -0.1,
    vibrance: 0,
    temperature: 0.1,
    sharpness: -0.2,
    clarity: -0.3,
    vignette: 0.15,
    exposure: 0.1,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={softAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const SepiaFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const sepiaAdjustments: ImageAdjustments = {
    brightness: 0.1,
    contrast: 0.1,
    saturation: -0.6,
    vibrance: -0.4,
    temperature: 0.6,
    sharpness: -0.1,
    clarity: -0.1,
    vignette: 0.2,
    exposure: 0.05,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={sepiaAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const CinematicFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const cinematicAdjustments: ImageAdjustments = {
    brightness: -0.05,
    contrast: 0.3,
    saturation: -0.1,
    vibrance: 0,
    temperature: -0.2,
    sharpness: 0.1,
    clarity: 0.2,
    vignette: 0.25,
    exposure: -0.1,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={cinematicAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const FreshFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const freshAdjustments: ImageAdjustments = {
    brightness: 0.2,
    contrast: 0.15,
    saturation: 0.3,
    vibrance: 0.4,
    temperature: -0.1,
    sharpness: 0.1,
    clarity: 0.1,
    vignette: 0,
    exposure: 0.15,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={freshAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const NoirFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const noirAdjustments: ImageAdjustments = {
    brightness: -0.2,
    contrast: 0.6,
    saturation: -1,
    vibrance: -1,
    temperature: 0,
    sharpness: 0.3,
    clarity: 0.4,
    vignette: 0.4,
    exposure: -0.3,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={noirAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const RetroFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const retroAdjustments: ImageAdjustments = {
    brightness: 0.05,
    contrast: -0.1,
    saturation: 0.3,
    vibrance: 0.2,
    temperature: 0.2,
    sharpness: -0.2,
    clarity: -0.1,
    vignette: 0.15,
    exposure: 0,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={retroAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const VibrantFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const vibrantAdjustments: ImageAdjustments = {
    brightness: 0.1,
    contrast: 0.2,
    saturation: 0.6,
    vibrance: 0.5,
    temperature: 0,
    sharpness: 0.1,
    clarity: 0.1,
    vignette: 0,
    exposure: 0.2,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={vibrantAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

export const MatteFilter: React.FC<{ uri: string; style?: any; width: number; height: number }> = React.memo((props) => {
  const matteAdjustments: ImageAdjustments = {
    brightness: 0.1,
    contrast: -0.3,
    saturation: -0.2,
    vibrance: -0.1,
    temperature: 0.1,
    sharpness: -0.1,
    clarity: -0.2,
    vignette: 0.1,
    exposure: 0.05,
  };

  return (
    <FilteredImage
      uri={props.uri}
      adjustments={matteAdjustments}
      style={props.style}
      width={props.width}
      height={props.height}
    />
  );
});

// Utility functions
export function getFilterComponent(filterId: string) {
  const filterMap: Record<string, React.FC<{ uri: string; style?: any; width: number; height: number }>> = {
    vintage: VintageFilter,
    black_white: BlackWhiteFilter,
    vivid: VividFilter,
    warm: WarmFilter,
    cool: CoolFilter,
    dramatic: DramaticFilter,
    soft: SoftFilter,
    sepia: SepiaFilter,
    cinematic: CinematicFilter,
    fresh: FreshFilter,
    noir: NoirFilter,
    retro: RetroFilter,
    vibrant: VibrantFilter,
    matte: MatteFilter,
  };

  return filterMap[filterId] || null;
}

export function hasFilterAdjustments(adjustments: ImageAdjustments): boolean {
  return !Object.entries(adjustments).every(([key, value]) => 
    DEFAULT_ADJUSTMENTS[key as keyof ImageAdjustments] === value
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

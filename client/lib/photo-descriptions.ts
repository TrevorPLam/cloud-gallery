// AI-META-BEGIN
// AI-META: Utility functions for generating meaningful accessibility labels for photos
// OWNERSHIP: client/lib (accessibility utilities)
// ENTRYPOINTS: Used by PhotoGrid component for screen reader support
// DEPENDENCIES: @/types, React (for memoization)
// DANGER: Performance-sensitive - called for every photo in grid
// CHANGE-SAFETY: Safe to modify label generation logic; maintain backward compatibility
// TESTS: Test with various photo metadata combinations; verify non-empty strings
// AI-META-END

import { useMemo } from 'react';
import { Photo } from '@/types';

/**
 * Generates a meaningful accessibility label for a photo based on its metadata.
 * Labels include date and optionally location information.
 * 
 * @param photo - The photo object to generate a label for
 * @returns A descriptive string for screen readers
 * 
 * @example
 * ```typescript
 * const label = generatePhotoAccessibilityLabel(photo);
 * // Returns: "Photo from March 15, 2026 taken in New York"
 * // Or: "Photo from March 15, 2026"
 * ```
 */
export function generatePhotoAccessibilityLabel(photo: Photo): string {
  const date = new Date(photo.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Check for location information
  if (photo.location) {
    const { city, country } = photo.location;
    if (city && country) {
      return `Photo from ${date} taken in ${city}, ${country}`;
    } else if (city) {
      return `Photo from ${date} taken in ${city}`;
    } else if (country) {
      return `Photo from ${date} taken in ${country}`;
    }
  }

  // Check for camera information as fallback
  if (photo.camera?.make && photo.camera?.model) {
    return `Photo from ${date} taken with ${photo.camera.make} ${photo.camera.model}`;
  }

  // Default label with just date
  return `Photo from ${date}`;
}

/**
 * React hook for generating accessibility labels with memoization.
 * This prevents recalculating labels on every render for the same photo.
 * 
 * @param photo - The photo object to generate a label for
 * @returns A memoized descriptive string for screen readers
 */
export function usePhotoAccessibilityLabel(photo: Photo): string {
  return useMemo(() => generatePhotoAccessibilityLabel(photo), [
    photo.id,
    photo.createdAt,
    photo.location?.city,
    photo.location?.country,
    photo.camera?.make,
    photo.camera?.model
  ]);
}

/**
 * Generates a concise accessibility label for photos in grids where space is limited.
 * Uses shorter date format and prioritizes location over camera info.
 * 
 * @param photo - The photo object to generate a label for
 * @returns A concise descriptive string for screen readers
 */
export function generateConcisePhotoLabel(photo: Photo): string {
  const date = new Date(photo.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  if (photo.location?.city) {
    return `${date} in ${photo.location.city}`;
  }

  return `Photo ${date}`;
}

/**
 * React hook for concise labels with memoization.
 * 
 * @param photo - The photo object to generate a label for
 * @returns A memoized concise descriptive string
 */
export function useConcisePhotoLabel(photo: Photo): string {
  return useMemo(() => generateConcisePhotoLabel(photo), [
    photo.id,
    photo.createdAt,
    photo.location?.city
  ]);
}

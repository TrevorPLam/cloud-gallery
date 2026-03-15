// AI-META-BEGIN
// AI-META: Adjustment controls for photo editing with configuration and utilities
// OWNERSHIP: client/lib/adjustments
// ENTRYPOINTS: imported by EditPhotoScreen and adjustment components
// DEPENDENCIES: react-native, expo-image
// DANGER: Performance-critical for real-time preview; optimize slider interactions
// CHANGE-SAFETY: Maintain adjustment parameter ranges and validation
// TESTS: Unit tests for adjustment controls, integration tests for slider performance
// AI-META-END

import { ImageAdjustments, DEFAULT_ADJUSTMENTS } from "./photo-editor";

// Adjustment control configuration
export interface AdjustmentConfig {
  id: keyof ImageAdjustments;
  name: string;
  icon: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  description: string;
  category: "light" | "color" | "detail";
}

export const ADJUSTMENT_CONFIGS: AdjustmentConfig[] = [
  // Light adjustments
  {
    id: "brightness",
    name: "Brightness",
    icon: "sun",
    min: -1,
    max: 1,
    step: 0.01,
    defaultValue: 0,
    description: "Adjust overall brightness",
    category: "light",
  },
  {
    id: "contrast",
    name: "Contrast",
    icon: "circle",
    min: -1,
    max: 1,
    step: 0.01,
    defaultValue: 0,
    description: "Adjust difference between light and dark areas",
    category: "light",
  },
  {
    id: "exposure",
    name: "Exposure",
    icon: "aperture",
    min: -2,
    max: 2,
    step: 0.02,
    defaultValue: 0,
    description: "Adjust exposure compensation",
    category: "light",
  },
  // Color adjustments
  {
    id: "saturation",
    name: "Saturation",
    icon: "droplet",
    min: -1,
    max: 1,
    step: 0.01,
    defaultValue: 0,
    description: "Adjust color intensity",
    category: "color",
  },
  {
    id: "vibrance",
    name: "Vibrance",
    icon: "palette",
    min: -1,
    max: 1,
    step: 0.01,
    defaultValue: 0,
    description: "Adjust saturation of muted colors",
    category: "color",
  },
  {
    id: "temperature",
    name: "Temperature",
    icon: "thermometer",
    min: -1,
    max: 1,
    step: 0.01,
    defaultValue: 0,
    description: "Adjust color temperature (warm/cool)",
    category: "color",
  },
  // Detail adjustments
  {
    id: "sharpness",
    name: "Sharpness",
    icon: "focus",
    min: -1,
    max: 1,
    step: 0.01,
    defaultValue: 0,
    description: "Adjust image sharpness",
    category: "detail",
  },
  {
    id: "clarity",
    name: "Clarity",
    icon: "layers",
    min: -1,
    max: 1,
    step: 0.01,
    defaultValue: 0,
    description: "Adjust mid-tone contrast",
    category: "detail",
  },
  {
    id: "vignette",
    name: "Vignette",
    icon: "circle",
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 0,
    description: "Add dark corners",
    category: "detail",
  },
];

// Adjustment reset utilities
export function resetAdjustmentsToDefault(): ImageAdjustments {
  return { ...DEFAULT_ADJUSTMENTS };
}

export function resetAdjustmentsCategory(
  adjustments: ImageAdjustments,
  category: "light" | "color" | "detail",
): ImageAdjustments {
  const reset = { ...adjustments };

  ADJUSTMENT_CONFIGS.filter((config) => config.category === category).forEach(
    (config) => {
      reset[config.id] = config.defaultValue;
    },
  );

  return reset;
}

// Adjustment validation utilities
export function validateAdjustmentValue(
  adjustment: keyof ImageAdjustments,
  value: number,
): number {
  const config = ADJUSTMENT_CONFIGS.find((c) => c.id === adjustment);
  if (!config) return DEFAULT_ADJUSTMENTS[adjustment];

  return Math.max(config.min, Math.min(config.max, value));
}

export function hasAdjustmentChanges(adjustments: ImageAdjustments): boolean {
  return !Object.entries(adjustments).every(
    ([key, value]) =>
      DEFAULT_ADJUSTMENTS[key as keyof ImageAdjustments] === value,
  );
}

// Adjustment comparison utilities
export function compareAdjustments(
  adjustments1: ImageAdjustments,
  adjustments2: ImageAdjustments,
): boolean {
  return Object.keys(adjustments1).every(
    (key) =>
      adjustments1[key as keyof ImageAdjustments] ===
      adjustments2[key as keyof ImageAdjustments],
  );
}

export function getAdjustmentChanges(
  from: ImageAdjustments,
  to: ImageAdjustments,
): Partial<ImageAdjustments> {
  const changes: Partial<ImageAdjustments> = {};

  Object.keys(to).forEach((key) => {
    const adjustmentKey = key as keyof ImageAdjustments;
    if (from[adjustmentKey] !== to[adjustmentKey]) {
      changes[adjustmentKey] = to[adjustmentKey];
    }
  });

  return changes;
}

// Adjustment presets
export const ADJUSTMENT_PRESETS = {
  reset: DEFAULT_ADJUSTMENTS,
  autoEnhance: {
    brightness: 0.1,
    contrast: 0.15,
    saturation: 0.2,
    vibrance: 0.1,
    temperature: 0.05,
    sharpness: 0.1,
    clarity: 0.1,
    vignette: 0,
    exposure: 0.05,
  } as ImageAdjustments,
  vivid: {
    brightness: 0.05,
    contrast: 0.2,
    saturation: 0.4,
    vibrance: 0.3,
    temperature: 0,
    sharpness: 0.1,
    clarity: 0.1,
    vignette: 0,
    exposure: 0.1,
  } as ImageAdjustments,
  soft: {
    brightness: 0.1,
    contrast: -0.1,
    saturation: -0.1,
    vibrance: 0,
    temperature: 0.1,
    sharpness: -0.1,
    clarity: -0.2,
    vignette: 0.1,
    exposure: 0.05,
  } as ImageAdjustments,
  dramatic: {
    brightness: -0.05,
    contrast: 0.3,
    saturation: 0.1,
    vibrance: 0,
    temperature: -0.1,
    sharpness: 0.2,
    clarity: 0.2,
    vignette: 0.2,
    exposure: -0.1,
  } as ImageAdjustments,
};

// Utility functions for adjustment calculations
export function clampAdjustment(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeAdjustment(
  value: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number,
): number {
  const normalized = (value - inputMin) / (inputMax - inputMin);
  return outputMin + normalized * (outputMax - outputMin);
}

// Get adjustment config by ID
export function getAdjustmentConfig(
  id: keyof ImageAdjustments,
): AdjustmentConfig | undefined {
  return ADJUSTMENT_CONFIGS.find((config) => config.id === id);
}

// Get adjustments by category
export function getAdjustmentsByCategory(
  category: "light" | "color" | "detail",
): AdjustmentConfig[] {
  return ADJUSTMENT_CONFIGS.filter((config) => config.category === category);
}

// Format adjustment value for display
export function formatAdjustmentValue(
  value: number,
  config: AdjustmentConfig,
): string {
  if (config.id === "vignette") {
    return `${Math.round(value * 100)}%`;
  }

  if (value === config.defaultValue) {
    return "Auto";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

// Check if adjustment is at default value
export function isAdjustmentAtDefault(
  adjustment: keyof ImageAdjustments,
  value: number,
): boolean {
  const config = getAdjustmentConfig(adjustment);
  return config ? value === config.defaultValue : false;
}

// Get adjustment percentage for slider display
export function getAdjustmentPercentage(
  value: number,
  config: AdjustmentConfig,
): number {
  return ((value - config.min) / (config.max - config.min)) * 100;
}

// Convert percentage back to adjustment value
export function percentageToAdjustmentValue(
  percentage: number,
  config: AdjustmentConfig,
): number {
  const value = config.min + (percentage / 100) * (config.max - config.min);
  return Math.round(value / config.step) * config.step;
}

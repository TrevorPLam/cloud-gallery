// AI-META-BEGIN
// AI-META: WCAG 2.2 compliant color contrast validation utilities
// OWNERSHIP: client/lib (accessibility utilities)
// ENTRYPOINTS: Used by theme system, tests, and development tools
// DEPENDENCIES: None (pure mathematical functions)
// DANGER: Changes affect accessibility compliance across entire app
// CHANGE-SAFETY: Safe to enhance; breaking changes require test updates
// TESTS: Unit tests with known WCAG contrast values, integration with theme system
// AI-META-END

/**
 * WCAG 2.2 Color Contrast Validation Utilities
 * 
 * Implements WCAG 2.2 contrast ratio calculations and validation
 * Supports AA and AAA levels for normal and large text
 * Includes focus state contrast validation for interactive elements
 */

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface ContrastResult {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
  passesAALarge: boolean;
  passesAAALarge: boolean;
  wcagLevel: 'A' | 'AA' | 'AAA' | 'FAIL';
  foreground: string;
  background: string;
}

export interface ContrastViolation {
  foreground: string;
  background: string;
  ratio: number;
  expectedLevel: 'AA' | 'AAA';
  actualLevel: 'FAIL';
  isLargeText: boolean;
  context: string;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ContrastViolation[];
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
}

export interface FocusColors {
  default: string;
  focus: string;
  background: string;
}

/**
 * Convert hex color to RGB
 * Supports 3-digit (#fff), 6-digit (#ffffff), and 8-digit (#ffffff80) hex formats
 */
export function hexToRgb(hex: string): RGBColor | null {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Handle 3-digit hex (#fff -> #ffffff)
  if (cleanHex.length === 3) {
    const expanded = cleanHex.split('').map(char => char + char).join('');
    return hexToRgb('#' + expanded);
  }
  
  // Handle 6-digit hex (#ffffff)
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return null;
    }
    
    return { r, g, b };
  }
  
  // Handle 8-digit hex with alpha (#ffffff80) - ignore alpha for contrast
  if (cleanHex.length === 8) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return null;
    }
    
    return { r, g, b };
  }
  
  return null;
}

/**
 * Calculate relative luminance according to WCAG 2.2 formula
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * Where R, G, B are defined with gamma correction
 */
export function calculateRelativeLuminance(rgb: RGBColor): number {
  const { r, g, b } = rgb;
  
  // Normalize RGB values to 0-1 range
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  
  // Apply gamma correction for each channel
  const rCorrected = rNorm <= 0.03928 
    ? rNorm / 12.92 
    : Math.pow((rNorm + 0.055) / 1.055, 2.4);
  
  const gCorrected = gNorm <= 0.03928 
    ? gNorm / 12.92 
    : Math.pow((gNorm + 0.055) / 1.055, 2.4);
  
  const bCorrected = bNorm <= 0.03928 
    ? bNorm / 12.92 
    : Math.pow((bNorm + 0.055) / 1.055, 2.4);
  
  // Calculate relative luminance using WCAG coefficients
  return 0.2126 * rCorrected + 0.7152 * gCorrected + 0.0722 * bCorrected;
}

/**
 * Calculate contrast ratio between two colors
 * Formula: (L1 + 0.05) / (L2 + 0.05)
 * Where L1 is the lighter color and L2 is the darker color
 */
export function calculateContrastRatio(foreground: string, background: string): ContrastResult | null {
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);
  
  if (!fgRgb || !bgRgb) {
    return null;
  }
  
  const fgLuminance = calculateRelativeLuminance(fgRgb);
  const bgLuminance = calculateRelativeLuminance(bgRgb);
  
  // Determine lighter and darker colors for ratio calculation
  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);
  
  // Calculate contrast ratio using WCAG formula
  const ratio = (lighter + 0.05) / (darker + 0.05);
  
  // Round to 2 decimal places for consistency
  const roundedRatio = Math.round(ratio * 100) / 100;
  
  // Check WCAG compliance levels
  const passesAA = roundedRatio >= 4.5;
  const passesAAA = roundedRatio >= 7.0;
  const passesAALarge = roundedRatio >= 3.0;
  const passesAAALarge = roundedRatio >= 4.5;
  
  // Determine WCAG level
  let wcagLevel: 'A' | 'AA' | 'AAA' | 'FAIL';
  if (passesAAA) {
    wcagLevel = 'AAA';
  } else if (passesAA) {
    wcagLevel = 'AA';
  } else if (passesAALarge) {
    wcagLevel = 'A'; // Large text only
  } else {
    wcagLevel = 'FAIL';
  }
  
  return {
    ratio: roundedRatio,
    passesAA,
    passesAAA,
    passesAALarge,
    passesAAALarge,
    wcagLevel,
    foreground,
    background
  };
}

/**
 * Validate contrast for normal text (WCAG AA: 4.5:1, AAA: 7:1)
 */
export function validateNormalTextContrast(foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): ContrastResult | null {
  const result = calculateContrastRatio(foreground, background);
  
  if (!result) {
    return null;
  }
  
  const requiredRatio = level === 'AAA' ? 7.0 : 4.5;
  const passes = result.ratio >= requiredRatio;
  
  return {
    ...result,
    wcagLevel: passes ? level : 'FAIL'
  };
}

/**
 * Validate contrast for large text (18pt+ or 14pt+ bold)
 * WCAG AA: 3:1, AAA: 4.5:1
 */
export function validateLargeTextContrast(foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): ContrastResult | null {
  const result = calculateContrastRatio(foreground, background);
  
  if (!result) {
    return null;
  }
  
  const requiredRatio = level === 'AAA' ? 4.5 : 3.0;
  const passes = result.ratio >= requiredRatio;
  
  return {
    ...result,
    wcagLevel: passes ? level : 'FAIL'
  };
}

/**
 * Validate focus indicator contrast (WCAG 2.4.13: 3:1 minimum)
 * Focus indicators must have sufficient contrast against both foreground and background
 */
export function validateFocusContrast(focusColor: string, foreground: string, background: string): {
  focusOnForeground: ContrastResult | null;
  focusOnBackground: ContrastResult | null;
  passes: boolean;
} {
  const focusOnForeground = calculateContrastRatio(focusColor, foreground);
  const focusOnBackground = calculateContrastRatio(focusColor, background);
  
  const passes = (focusOnForeground?.ratio ?? 0) >= 3.0 && 
                (focusOnBackground?.ratio ?? 0) >= 3.0;
  
  return {
    focusOnForeground,
    focusOnBackground,
    passes
  };
}

/**
 * Validate all color combinations in a theme object
 * Checks text colors, interactive elements, and focus states
 */
export function validateThemeColors(theme: Record<string, string>, themeName: string = 'theme'): ValidationResult {
  const violations: ContrastViolation[] = [];
  let totalChecks = 0;
  let passedChecks = 0;
  
  // Define critical color combinations to check
  const colorChecks = [
    { foreground: 'text', background: 'backgroundDefault', context: 'body text' },
    { foreground: 'textSecondary', background: 'backgroundDefault', context: 'secondary text' },
    { foreground: 'buttonText', background: 'accent', context: 'button text on accent' },
    { foreground: 'link', background: 'backgroundDefault', context: 'link text' },
    { foreground: 'tabIconSelected', background: 'backgroundDefault', context: 'selected tab icon' },
    { foreground: 'error', background: 'backgroundDefault', context: 'error message' },
    { foreground: 'success', background: 'backgroundDefault', context: 'success message' },
  ];
  
  // Check each color combination
  for (const check of colorChecks) {
    const foreground = theme[check.foreground];
    const background = theme[check.background];
    
    if (!foreground || !background) {
      continue; // Skip if colors don't exist in theme
    }
    
    totalChecks++;
    const result = calculateContrastRatio(foreground, background);
    
    if (!result || !result.passesAA) {
      violations.push({
        foreground,
        background,
        ratio: result?.ratio ?? 0,
        expectedLevel: 'AA',
        actualLevel: 'FAIL',
        isLargeText: false,
        context: `${themeName} - ${check.context}`
      });
    } else {
      passedChecks++;
    }
  }
  
  // Check focus indicator contrast if accent color exists
  if (theme.accent && theme.backgroundDefault) {
    totalChecks++;
    const focusResult = validateFocusContrast(theme.accent, theme.text, theme.backgroundDefault);
    
    if (!focusResult.passes) {
      violations.push({
        foreground: theme.accent,
        background: theme.backgroundDefault,
        ratio: Math.min(focusResult.focusOnForeground?.ratio ?? 0, focusResult.focusOnBackground?.ratio ?? 0),
        expectedLevel: 'AA',
        actualLevel: 'FAIL',
        isLargeText: false,
        context: `${themeName} - focus indicator`
      });
    } else {
      passedChecks++;
    }
  }
  
  const failedChecks = totalChecks - passedChecks;
  const isValid = violations.length === 0;
  
  return {
    isValid,
    violations,
    totalChecks,
    passedChecks,
    failedChecks
  };
}

/**
 * Generate a contrast report for development and CI/CD
 */
export function generateContrastReport(results: ValidationResult[]): {
  summary: {
    totalThemes: number;
    validThemes: number;
    invalidThemes: number;
    totalViolations: number;
  };
  violations: ContrastViolation[];
  recommendations: string[];
} {
  const totalThemes = results.length;
  const validThemes = results.filter(r => r.isValid).length;
  const invalidThemes = results.filter(r => !r.isValid).length;
  const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
  
  const violations = results.flatMap(r => r.violations);
  
  const recommendations: string[] = [];
  
  if (totalViolations > 0) {
    recommendations.push('Adjust color values to meet WCAG AA contrast requirements (4.5:1 for normal text)');
    recommendations.push('Consider using darker text colors or lighter background colors');
    recommendations.push('Test contrast with real users and screen readers');
    
    if (violations.some(v => v.context.includes('focus'))) {
      recommendations.push('Ensure focus indicators have 3:1 contrast against both foreground and background');
    }
  }
  
  if (validThemes === totalThemes && totalThemes > 0) {
    recommendations.push('All themes meet WCAG AA contrast requirements');
    recommendations.push('Consider testing for AAA level compliance for enhanced accessibility');
  }
  
  return {
    summary: {
      totalThemes,
      validThemes,
      invalidThemes,
      totalViolations
    },
    violations,
    recommendations
  };
}

/**
 * Memoized contrast calculation for performance optimization
 */
const contrastCache = new Map<string, ContrastResult>();

export function calculateContrastRatioCached(foreground: string, background: string): ContrastResult | null {
  const cacheKey = `${foreground}-${background}`;
  
  if (contrastCache.has(cacheKey)) {
    return contrastCache.get(cacheKey)!;
  }
  
  const result = calculateContrastRatio(foreground, background);
  
  if (result) {
    contrastCache.set(cacheKey, result);
  }
  
  return result;
}

/**
 * Clear the contrast calculation cache
 * Useful for testing or when color schemes change
 */
export function clearContrastCache(): void {
  contrastCache.clear();
}

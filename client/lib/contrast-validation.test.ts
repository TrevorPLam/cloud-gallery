/**
 * WCAG 2.2 Color Contrast Validation Tests
 * 
 * Comprehensive test suite for contrast calculation algorithms
 * Tests mathematical accuracy, edge cases, and WCAG compliance
 */

import { describe, it, expect, test } from 'vitest';
import {
  hexToRgb,
  calculateRelativeLuminance,
  calculateContrastRatio,
  validateNormalTextContrast,
  validateLargeTextContrast,
  validateFocusContrast,
  validateThemeColors,
  generateContrastReport,
  calculateContrastRatioCached,
  clearContrastCache,
  type ContrastResult,
  type ValidationResult
} from '@/lib/contrast-validation';

describe('hexToRgb', () => {
  it('should convert 6-digit hex colors to RGB', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('should convert 3-digit hex colors to RGB', () => {
    expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#F00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#0F0')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#00F')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('should handle 8-digit hex colors with alpha', () => {
    expect(hexToRgb('#FF0000FF')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00FF0080')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000FF40')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('should handle hex colors without # prefix', () => {
    expect(hexToRgb('000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('should return null for invalid hex colors', () => {
    expect(hexToRgb('#GGGGGG')).toBeNull();
    expect(hexToRgb('#ZZZ')).toBeNull();
    expect(hexToRgb('invalid')).toBeNull();
    expect(hexToRgb('#1234')).toBeNull();
    expect(hexToRgb('#12345')).toBeNull();
    expect(hexToRgb('#1234567')).toBeNull();
  });
});

describe('calculateRelativeLuminance', () => {
  it('should calculate luminance for pure black', () => {
    const luminance = calculateRelativeLuminance({ r: 0, g: 0, b: 0 });
    expect(luminance).toBe(0);
  });

  it('should calculate luminance for pure white', () => {
    const luminance = calculateRelativeLuminance({ r: 255, g: 255, b: 255 });
    expect(luminance).toBeCloseTo(1, 4);
  });

  it('should calculate luminance for middle gray', () => {
    const luminance = calculateRelativeLuminance({ r: 128, g: 128, b: 128 });
    expect(luminance).toBeGreaterThan(0.1);
    expect(luminance).toBeLessThan(0.9);
  });

  it('should follow WCAG luminance coefficients', () => {
    // Test that green has highest contribution (0.7152)
    const redLuminance = calculateRelativeLuminance({ r: 255, g: 0, b: 0 });
    const greenLuminance = calculateRelativeLuminance({ r: 0, g: 255, b: 0 });
    const blueLuminance = calculateRelativeLuminance({ r: 0, g: 0, b: 255 });

    expect(greenLuminance).toBeGreaterThan(redLuminance);
    expect(greenLuminance).toBeGreaterThan(blueLuminance);
    expect(redLuminance).toBeGreaterThan(blueLuminance);
  });
});

describe('calculateContrastRatio', () => {
  it('should calculate maximum contrast for black on white', () => {
    const result = calculateContrastRatio('#000000', '#FFFFFF');
    expect(result).toBeTruthy();
    expect(result!.ratio).toBeCloseTo(21, 0);
    expect(result!.passesAA).toBe(true);
    expect(result!.passesAAA).toBe(true);
    expect(result!.wcagLevel).toBe('AAA');
  });

  it('should calculate minimum contrast for white on black', () => {
    const result = calculateContrastRatio('#FFFFFF', '#000000');
    expect(result).toBeTruthy();
    expect(result!.ratio).toBeCloseTo(21, 0);
    expect(result!.passesAA).toBe(true);
    expect(result!.passesAAA).toBe(true);
    expect(result!.wcagLevel).toBe('AAA');
  });

  it('should calculate zero contrast for identical colors', () => {
    const result = calculateContrastRatio('#FF0000', '#FF0000');
    expect(result).toBeTruthy();
    expect(result!.ratio).toBeCloseTo(1, 0);
    expect(result!.passesAA).toBe(false);
    expect(result!.passesAAA).toBe(false);
    expect(result!.wcagLevel).toBe('FAIL');
  });

  it('should correctly identify AA compliance', () => {
    // Test a known AA-compliant combination
    const result = calculateContrastRatio('#000000', '#F0F0F0');
    expect(result).toBeTruthy();
    expect(result!.passesAA).toBe(true);
    expect(result!.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('should correctly identify non-compliant combinations', () => {
    // Test a known non-compliant combination
    const result = calculateContrastRatio('#808080', '#F0F0F0');
    expect(result).toBeTruthy();
    expect(result!.passesAA).toBe(false);
    expect(result!.ratio).toBeLessThan(4.5);
  });

  it('should return null for invalid colors', () => {
    expect(calculateContrastRatio('invalid', '#FFFFFF')).toBeNull();
    expect(calculateContrastRatio('#000000', 'invalid')).toBeNull();
    expect(calculateContrastRatio('invalid', 'invalid')).toBeNull();
  });

  it('should handle edge cases with very light colors', () => {
    const result = calculateContrastRatio('#FFFFFE', '#FFFFFF');
    expect(result).toBeTruthy();
    expect(result!.ratio).toBeCloseTo(1.01, 1);
  });

  it('should handle edge cases with very dark colors', () => {
    const result = calculateContrastRatio('#000001', '#000000');
    expect(result).toBeTruthy();
    expect(result!.ratio).toBeCloseTo(1.01, 1);
  });
});

describe('validateNormalTextContrast', () => {
  it('should validate AA compliance for normal text', () => {
    const result = validateNormalTextContrast('#000000', '#FFFFFF');
    expect(result).toBeTruthy();
    expect(result!.passesAA).toBe(true);
    expect(result!.wcagLevel).toBe('AA');
  });

  it('should validate AAA compliance for normal text', () => {
    const result = validateNormalTextContrast('#000000', '#FFFFFF', 'AAA');
    expect(result).toBeTruthy();
    expect(result!.passesAAA).toBe(true);
    expect(result!.wcagLevel).toBe('AAA');
  });

  it('should fail non-compliant combinations', () => {
    const result = validateNormalTextContrast('#808080', '#F0F0F0');
    expect(result).toBeTruthy();
    expect(result!.passesAA).toBe(false);
    expect(result!.wcagLevel).toBe('FAIL');
  });
});

describe('validateLargeTextContrast', () => {
  it('should validate AA compliance for large text (3:1)', () => {
    const result = validateLargeTextContrast('#000000', '#CCCCCC');
    expect(result).toBeTruthy();
    expect(result!.passesAALarge).toBe(true);
    expect(result!.wcagLevel).toBe('AA');
  });

  it('should validate AAA compliance for large text (4.5:1)', () => {
    const result = validateLargeTextContrast('#000000', '#FFFFFF', 'AAA');
    expect(result).toBeTruthy();
    expect(result!.passesAAALarge).toBe(true);
    expect(result!.wcagLevel).toBe('AAA');
  });

  it('should fail non-compliant large text combinations', () => {
    const result = validateLargeTextContrast('#999999', '#CCCCCC');
    expect(result).toBeTruthy();
    expect(result!.passesAALarge).toBe(false);
    expect(result!.wcagLevel).toBe('FAIL');
  });
});

describe('validateFocusContrast', () => {
  it('should validate focus indicator contrast', () => {
    const result = validateFocusContrast('#0066CC', '#000000', '#FFFFFF');
    expect(result.focusOnForeground).toBeTruthy();
    expect(result.focusOnBackground).toBeTruthy();
    expect(result.passes).toBe(true);
  });

  it('should fail focus indicator with insufficient contrast', () => {
    const result = validateFocusContrast('#CCCCCC', '#FFFFFF', '#F0F0F0');
    expect(result.focusOnForeground).toBeTruthy();
    expect(result.focusOnBackground).toBeTruthy();
    expect(result.passes).toBe(false);
  });

  it('should handle null results gracefully', () => {
    const result = validateFocusContrast('invalid', '#000000', '#FFFFFF');
    expect(result.focusOnForeground).toBeNull();
    expect(result.focusOnBackground).toBeNull();
    expect(result.passes).toBe(false);
  });
});

describe('validateThemeColors', () => {
  it('should validate a complete theme', () => {
    const theme = {
      text: '#000000',
      textSecondary: '#666666',
      buttonText: '#FFFFFF',
      tabIconSelected: '#000000',
      link: '#0066CC',
      accent: '#D4AF37',
      backgroundDefault: '#FFFFFF',
      backgroundSecondary: '#F7FAFC',
      backgroundTertiary: '#EDF2F7',
      border: '#E2E8F0',
      success: '#48BB78',
      error: '#F56565',
      overlay: 'rgba(0,0,0,0.5)'
    };

    const result = validateThemeColors(theme, 'test-theme');
    expect(result.totalChecks).toBeGreaterThan(0);
    expect(result.passedChecks).toBeGreaterThanOrEqual(0);
    expect(result.failedChecks).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.violations)).toBe(true);
  });

  it('should handle incomplete themes gracefully', () => {
    const theme = {
      text: '#000000',
      backgroundDefault: '#FFFFFF'
    };

    const result = validateThemeColors(theme, 'incomplete-theme');
    expect(result.totalChecks).toBeGreaterThan(0);
    expect(result.isValid).toBeDefined();
  });

  it('should identify contrast violations', () => {
    const theme = {
      text: '#CCCCCC', // Light gray on white background - should fail
      backgroundDefault: '#FFFFFF',
      buttonText: '#FFFFFF',
      accent: '#D4AF37'
    };

    const result = validateThemeColors(theme, 'bad-theme');
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.isValid).toBe(false);
    
    const violation = result.violations[0];
    expect(violation.expectedLevel).toBe('AA');
    expect(violation.actualLevel).toBe('FAIL');
    expect(violation.ratio).toBeLessThan(4.5);
  });
});

describe('generateContrastReport', () => {
  it('should generate report for valid themes', () => {
    const validResult: ValidationResult = {
      isValid: true,
      violations: [],
      totalChecks: 10,
      passedChecks: 10,
      failedChecks: 0
    };

    const report = generateContrastReport([validResult]);
    expect(report.summary.totalThemes).toBe(1);
    expect(report.summary.validThemes).toBe(1);
    expect(report.summary.invalidThemes).toBe(0);
    expect(report.summary.totalViolations).toBe(0);
    expect(report.violations).toHaveLength(0);
    expect(report.recommendations).toContain('All themes meet WCAG AA contrast requirements');
  });

  it('should generate report for invalid themes', () => {
    const invalidResult: ValidationResult = {
      isValid: false,
      violations: [
        {
          foreground: '#CCCCCC',
          background: '#FFFFFF',
          ratio: 2.5,
          expectedLevel: 'AA',
          actualLevel: 'FAIL',
          isLargeText: false,
          context: 'test-theme - body text'
        }
      ],
      totalChecks: 10,
      passedChecks: 9,
      failedChecks: 1
    };

    const report = generateContrastReport([invalidResult]);
    expect(report.summary.totalThemes).toBe(1);
    expect(report.summary.validThemes).toBe(0);
    expect(report.summary.invalidThemes).toBe(1);
    expect(report.summary.totalViolations).toBe(1);
    expect(report.violations).toHaveLength(1);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('should aggregate multiple theme results', () => {
    const results: ValidationResult[] = [
      {
        isValid: true,
        violations: [],
        totalChecks: 10,
        passedChecks: 10,
        failedChecks: 0
      },
      {
        isValid: false,
        violations: [
          {
            foreground: '#CCCCCC',
            background: '#FFFFFF',
            ratio: 2.5,
            expectedLevel: 'AA',
            actualLevel: 'FAIL',
            isLargeText: false,
            context: 'test-theme - body text'
          }
        ],
        totalChecks: 8,
        passedChecks: 7,
        failedChecks: 1
      }
    ];

    const report = generateContrastReport(results);
    expect(report.summary.totalThemes).toBe(2);
    expect(report.summary.validThemes).toBe(1);
    expect(report.summary.invalidThemes).toBe(1);
    expect(report.summary.totalViolations).toBe(1);
  });
});

describe('calculateContrastRatioCached', () => {
  beforeEach(() => {
    clearContrastCache();
  });

  it('should cache contrast calculations', () => {
    const result1 = calculateContrastRatioCached('#000000', '#FFFFFF');
    const result2 = calculateContrastRatioCached('#000000', '#FFFFFF');
    
    expect(result1).toEqual(result2);
    // Both should have the same ratio (cached result)
  });

  it('should handle different color orders', () => {
    const result1 = calculateContrastRatioCached('#000000', '#FFFFFF');
    const result2 = calculateContrastRatioCached('#FFFFFF', '#000000');
    
    expect(result1?.ratio).toEqual(result2?.ratio);
  });

  it('should cache different combinations separately', () => {
    const result1 = calculateContrastRatioCached('#000000', '#FFFFFF');
    const result2 = calculateContrastRatioCached('#FF0000', '#FFFFFF');
    
    expect(result1?.ratio).not.toEqual(result2?.ratio);
  });

  it('should clear cache properly', () => {
    calculateContrastRatioCached('#000000', '#FFFFFF');
    calculateContrastRatioCached('#FF0000', '#FFFFFF');
    
    clearContrastCache();
    
    // After clearing cache, calculations should still work
    const result = calculateContrastRatioCached('#000000', '#FFFFFF');
    expect(result).toBeTruthy();
    expect(result!.ratio).toBeCloseTo(21, 0);
  });
});

describe('WCAG Compliance Edge Cases', () => {
  it('should handle boundary cases for AA compliance', () => {
    // Test exactly 4.5:1 ratio
    const nearBoundary = calculateContrastRatio('#585858', '#FFFFFF');
    expect(nearBoundary).toBeTruthy();
    expect(nearBoundary!.ratio).toBeGreaterThanOrEqual(4.4);
    expect(nearBoundary!.ratio).toBeLessThanOrEqual(4.6);
  });

  it('should handle boundary cases for AAA compliance', () => {
    // Test exactly 7:1 ratio
    const nearBoundary = calculateContrastRatio('#373737', '#FFFFFF');
    expect(nearBoundary).toBeTruthy();
    expect(nearBoundary!.ratio).toBeGreaterThanOrEqual(6.8);
    expect(nearBoundary!.ratio).toBeLessThanOrEqual(7.2);
  });

  it('should handle large text boundary cases', () => {
    // Test exactly 3:1 ratio for large text
    const largeTextBoundary = calculateContrastRatio('#767676', '#FFFFFF');
    expect(largeTextBoundary).toBeTruthy();
    expect(largeTextBoundary!.ratio).toBeGreaterThanOrEqual(2.8);
    expect(largeTextBoundary!.ratio).toBeLessThanOrEqual(3.2);
  });
});

describe('Performance Tests', () => {
  it('should handle large numbers of calculations efficiently', () => {
    const colors = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
    const startTime = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      for (const fg of colors) {
        for (const bg of colors) {
          calculateContrastRatio(fg, bg);
        }
      }
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete 64,000 calculations in reasonable time
    expect(duration).toBeLessThan(1000); // Less than 1 second
  });

  it('should be more efficient with caching', () => {
    const colors = ['#000000', '#FFFFFF', '#FF0000', '#00FF00'];
    const iterations = 1000;
    
    // Without cache
    clearContrastCache();
    const startTime1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const fg of colors) {
        for (const bg of colors) {
          calculateContrastRatio(fg, bg);
        }
      }
    }
    const endTime1 = performance.now();
    const withoutCache = endTime1 - startTime1;
    
    // With cache
    clearContrastCache();
    const startTime2 = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const fg of colors) {
        for (const bg of colors) {
          calculateContrastRatioCached(fg, bg);
        }
      }
    }
    const endTime2 = performance.now();
    const withCache = endTime2 - startTime2;
    
    // Cached version should be faster
    expect(withCache).toBeLessThan(withoutCache);
  });
});

describe('Error Handling', () => {
  it('should handle malformed hex strings gracefully', () => {
    expect(hexToRgb('#')).toBeNull();
    expect(hexToRgb('#F')).toBeNull();
    expect(hexToRgb('#FF')).toBeNull();
    expect(hexToRgb('#FFF0')).toBeNull();
    expect(hexToRgb('#FFF00')).toBeNull();
    expect(hexToRgb('#FFFFF0')).toBeNull();
  });

  it('should handle extreme RGB values', () => {
    expect(calculateRelativeLuminance({ r: -1, g: 0, b: 0 })).toBeGreaterThanOrEqual(0);
    expect(calculateRelativeLuminance({ r: 0, g: 256, b: 0 })).toBeLessThanOrEqual(1);
    expect(calculateRelativeLuminance({ r: 0, g: 0, b: 300 })).toBeLessThanOrEqual(1);
  });

  it('should handle NaN values in RGB', () => {
    expect(calculateRelativeLuminance({ r: NaN, g: 128, b: 128 })).toBeGreaterThanOrEqual(0);
    expect(calculateRelativeLuminance({ r: 128, g: NaN, b: 128 })).toBeGreaterThanOrEqual(0);
    expect(calculateRelativeLuminance({ r: 128, g: 128, b: NaN })).toBeGreaterThanOrEqual(0);
  });
});

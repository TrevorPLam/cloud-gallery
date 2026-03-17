/**
 * Theme System Contrast Validation Integration Tests
 * 
 * Tests the integration of contrast validation with the theme system
 * Validates real theme colors and development-time warnings
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ThemeValidation, validateThemeContrast, Colors } from '@/constants/theme';
import { useTheme, useThemeWithContrast, useContrastMonitor } from '@/hooks/useTheme';

// Mock console methods to capture development warnings
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('ThemeValidation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock development mode
    vi.stubGlobal('__DEV__', true);
  });

  afterEach(() => {
    mockConsoleWarn.mockClear();
    mockConsoleLog.mockClear();
  });

  describe('ThemeValidation.validateTheme', () => {
    it('should validate light theme colors', () => {
      const result = ThemeValidation.validateTheme('light');
      
      expect(result).toBeDefined();
      expect(result.totalChecks).toBeGreaterThan(0);
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.violations)).toBe(true);
      expect(result.passedChecks + result.failedChecks).toBe(result.totalChecks);
    });

    it('should validate dark theme colors', () => {
      const result = ThemeValidation.validateTheme('dark');
      
      expect(result).toBeDefined();
      expect(result.totalChecks).toBeGreaterThan(0);
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.violations)).toBe(true);
      expect(result.passedChecks + result.failedChecks).toBe(result.totalChecks);
    });

    it('should validate both themes consistently', () => {
      const lightResult = ThemeValidation.validateTheme('light');
      const darkResult = ThemeValidation.validateTheme('dark');
      
      expect(lightResult.totalChecks).toBe(darkResult.totalChecks);
      expect(typeof lightResult.isValid).toBe('boolean');
      expect(typeof darkResult.isValid).toBe('boolean');
    });

    it('should provide detailed violation information', () => {
      const result = ThemeValidation.validateTheme('light');
      
      if (result.violations.length > 0) {
        const violation = result.violations[0];
        expect(violation).toHaveProperty('foreground');
        expect(violation).toHaveProperty('background');
        expect(violation).toHaveProperty('ratio');
        expect(violation).toHaveProperty('expectedLevel');
        expect(violation).toHaveProperty('actualLevel');
        expect(violation).toHaveProperty('context');
        expect(violation).toHaveProperty('isLargeText');
        
        expect(typeof violation.ratio).toBe('number');
        expect(violation.ratio).toBeGreaterThan(0);
        expect(['AA', 'AAA', 'FAIL']).toContain(violation.expectedLevel);
        expect(['AA', 'AAA', 'FAIL']).toContain(violation.actualLevel);
      }
    });
  });

  describe('ThemeValidation.validateAllThemes', () => {
    it('should validate both themes and generate summary', () => {
      const result = ThemeValidation.validateAllThemes();
      
      expect(result).toHaveProperty('light');
      expect(result).toHaveProperty('dark');
      expect(result).toHaveProperty('summary');
      
      expect(result.light).toBeDefined();
      expect(result.dark).toBeDefined();
      expect(result.summary).toBeDefined();
      
      // Summary should aggregate results
      expect(result.summary.totalThemes).toBe(2);
      expect(result.summary.validThemes).toBeGreaterThanOrEqual(0);
      expect(result.summary.invalidThemes).toBeGreaterThanOrEqual(0);
      expect(result.summary.totalViolations).toBeGreaterThanOrEqual(0);
    });

    it('should calculate summary correctly', () => {
      const result = ThemeValidation.validateAllThemes();
      const { summary } = result;
      
      const expectedValid = result.light.isValid && result.dark.isValid ? 2 : 
                           result.light.isValid || result.dark.isValid ? 1 : 0;
      const expectedInvalid = 2 - expectedValid;
      
      expect(summary.validThemes).toBe(expectedValid);
      expect(summary.invalidThemes).toBe(expectedInvalid);
      expect(summary.totalViolations).toBe(result.light.violations.length + result.dark.violations.length);
    });
  });

  describe('ThemeValidation.getContrastViolations', () => {
    it('should aggregate violations from both themes', () => {
      const violations = ThemeValidation.getContrastViolations();
      
      expect(Array.isArray(violations)).toBe(true);
      
      const allThemesResult = ThemeValidation.validateAllThemes();
      const expectedViolations = [...allThemesResult.light.violations, ...allThemesResult.dark.violations];
      
      expect(violations).toHaveLength(expectedViolations.length);
    });

    it('should provide context for each violation', () => {
      const violations = ThemeValidation.getContrastViolations();
      
      violations.forEach(violation => {
        expect(violation.context).toContain('light') || expect(violation.context).toContain('dark');
        expect(typeof violation.context).toBe('string');
        expect(violation.context.length).toBeGreaterThan(0);
      });
    });
  });

  describe('ThemeValidation.isCompliant', () => {
    it('should check AA compliance by default', () => {
      const isCompliant = ThemeValidation.isCompliant();
      expect(typeof isCompliant).toBe('boolean');
    });

    it('should check AA compliance explicitly', () => {
      const isAACompliant = ThemeValidation.isCompliant('AA');
      expect(typeof isAACompliant).toBe('boolean');
    });

    it('should check AAA compliance', () => {
      const isAAACompliant = ThemeValidation.isCompliant('AAA');
      expect(typeof isAAACompliant).toBe('boolean');
    });

    it('should be more strict for AAA compliance', () => {
      const isAACompliant = ThemeValidation.isCompliant('AA');
      const isAAACompliant = ThemeValidation.isCompliant('AAA');
      
      // AAA should be equal or more strict than AA
      expect(isAAACompliant).toBeLessThanOrEqual(isAACompliant);
    });
  });
});

describe('validateThemeContrast Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('__DEV__', true);
  });

  it('should log warnings in development mode when violations exist', () => {
    // Mock a theme with violations
    const mockThemeValidation = {
      getContrastViolations: () => [
        {
          foreground: '#CCCCCC',
          background: '#FFFFFF',
          ratio: 2.5,
          expectedLevel: 'AA',
          actualLevel: 'FAIL',
          isLargeText: false,
          context: 'light - body text'
        }
      ]
    };
    
    vi.mocked(ThemeValidation).getContrastViolations = mockThemeValidation.getContrastViolations;
    
    validateThemeContrast();
    
    expect(mockConsoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Theme Color Contrast Warnings')
    );
    expect(mockConsoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Some color combinations may not meet WCAG 2.2 AA requirements')
    );
  });

  it('should log success message when no violations exist', () => {
    // Mock a theme without violations
    const mockThemeValidation = {
      getContrastViolations: () => []
    };
    
    vi.mocked(ThemeValidation).getContrastViolations = mockThemeValidation.getContrastViolations;
    
    validateThemeContrast();
    
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('All theme colors meet WCAG 2.2 AA contrast requirements')
    );
  });

  it('should not log in production mode', () => {
    vi.stubGlobal('__DEV__', false);
    
    validateThemeContrast();
    
    expect(mockConsoleWarn).not.toHaveBeenCalled();
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });
});

describe('useTheme Hook Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide theme information', () => {
    const { result } = renderHook(() => useTheme());
    
    expect(result.current).toHaveProperty('theme');
    expect(result.current).toHaveProperty('isDark');
    expect(result.current).toHaveProperty('colorScheme');
    
    expect(typeof result.current.isDark).toBe('boolean');
    expect(['light', 'dark', null]).toContain(result.current.colorScheme);
    expect(result.current.theme).toBeDefined();
  });

  it('should provide valid theme object', () => {
    const { result } = renderHook(() => useTheme());
    
    const { theme } = result.current;
    expect(theme).toHaveProperty('text');
    expect(theme).toHaveProperty('backgroundDefault');
    expect(theme).toHaveProperty('accent');
    expect(typeof theme.text).toBe('string');
    expect(typeof theme.backgroundDefault).toBe('string');
  });
});

describe('useThemeWithContrast Hook Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide contrast validation information', () => {
    const { result } = renderHook(() => useThemeWithContrast());
    
    expect(result.current).toHaveProperty('theme');
    expect(result.current).toHaveProperty('isDark');
    expect(result.current).toHaveProperty('colorScheme');
    expect(result.current).toHaveProperty('contrastValidation');
    
    const { contrastValidation } = result.current;
    expect(contrastValidation).toHaveProperty('isValid');
    expect(contrastValidation).toHaveProperty('violations');
    expect(contrastValidation).toHaveProperty('isAACompliant');
    expect(contrastValidation).toHaveProperty('isAAACompliant');
    
    expect(typeof contrastValidation.isValid).toBe('boolean');
    expect(Array.isArray(contrastValidation.violations)).toBe(true);
    expect(typeof contrastValidation.isAACompliant).toBe('boolean');
    expect(typeof contrastValidation.isAAACompliant).toBe('boolean');
  });

  it('should provide consistent results with ThemeValidation', () => {
    const { result } = renderHook(() => useThemeWithContrast());
    const { contrastValidation } = result.current;
    
    const expectedValidation = ThemeValidation.validateTheme(
      result.current.isDark ? 'dark' : 'light'
    );
    
    expect(contrastValidation.isValid).toBe(expectedValidation.isValid);
    expect(contrastValidation.violations).toHaveLength(expectedValidation.violations.length);
  });
});

describe('useContrastMonitor Hook Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide comprehensive contrast monitoring', () => {
    const { result } = renderHook(() => useContrastMonitor());
    
    expect(result.current).toHaveProperty('isValid');
    expect(result.current).toHaveProperty('violations');
    expect(result.current).toHaveProperty('isAACompliant');
    expect(result.current).toHaveProperty('isAAACompliant');
    expect(result.current).toHaveProperty('totalViolations');
    expect(result.current).toHaveProperty('criticalViolations');
    expect(result.current).toHaveProperty('warnings');
    expect(result.current).toHaveProperty('getViolationsByContext');
    expect(result.current).toHaveProperty('generateReport');
    
    expect(typeof result.current.totalViolations).toBe('number');
    expect(typeof result.current.criticalViolations).toBe('number');
    expect(typeof result.current.warnings).toBe('number');
    expect(typeof result.current.getViolationsByContext).toBe('function');
    expect(typeof result.current.generateReport).toBe('function');
  });

  it('should categorize violations correctly', () => {
    const { result } = renderHook(() => useContrastMonitor());
    
    const violations = result.current.violations;
    const critical = result.current.criticalViolations;
    const warnings = result.current.warnings;
    
    // Critical violations should be those with ratio < 3.0
    expect(critical).toBe(violations.filter(v => v.ratio < 3.0).length);
    
    // Warnings should be those with ratio between 3.0 and 4.5
    expect(warnings).toBe(violations.filter(v => v.ratio >= 3.0 && v.ratio < 4.5).length);
    
    // Total should match
    expect(result.current.totalViolations).toBe(violations.length);
  });

  it('should categorize violations by context', () => {
    const { result } = renderHook(() => useContrastMonitor());
    
    const byContext = result.current.getViolationsByContext();
    
    expect(byContext).toHaveProperty('text');
    expect(byContext).toHaveProperty('button');
    expect(byContext).toHaveProperty('link');
    expect(byContext).toHaveProperty('focus');
    expect(byContext).toHaveProperty('other');
    
    expect(Array.isArray(byContext.text)).toBe(true);
    expect(Array.isArray(byContext.button)).toBe(true);
    expect(Array.isArray(byContext.link)).toBe(true);
    expect(Array.isArray(byContext.focus)).toBe(true);
    expect(Array.isArray(byContext.other)).toBe(true);
  });

  it('should generate detailed reports', () => {
    const { result } = renderHook(() => useContrastMonitor());
    
    const report = result.current.generateReport();
    
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('byContext');
    expect(report).toHaveProperty('violations');
    
    const { summary } = report;
    expect(summary).toHaveProperty('totalViolations');
    expect(summary).toHaveProperty('isAACompliant');
    expect(summary).toHaveProperty('isAAACompliant');
    expect(summary).toHaveProperty('worstRatio');
    expect(summary).toHaveProperty('bestRatio');
    
    expect(typeof summary.totalViolations).toBe('number');
    expect(typeof summary.isAACompliant).toBe('boolean');
    expect(typeof summary.isAAACompliant).toBe('boolean');
    expect(typeof summary.worstRatio).toBe('number');
    expect(typeof summary.bestRatio).toBe('number');
    
    // Best ratio should be >= worst ratio
    expect(summary.bestRatio).toBeGreaterThanOrEqual(summary.worstRatio);
  });
});

describe('Real Theme Colors Validation', () => {
  it('should validate actual light theme colors', () => {
    const result = ThemeValidation.validateTheme('light');
    
    // Check that all expected color keys exist in the theme
    const lightTheme = Colors.light;
    expect(lightTheme).toHaveProperty('text');
    expect(lightTheme).toHaveProperty('textSecondary');
    expect(lightTheme).toHaveProperty('buttonText');
    expect(lightTheme).toHaveProperty('backgroundDefault');
    expect(lightTheme).toHaveProperty('accent');
    expect(lightTheme).toHaveProperty('link');
    expect(lightTheme).toHaveProperty('success');
    expect(lightTheme).toHaveProperty('error');
    
    // Validate that colors are valid hex values
    Object.values(lightTheme).forEach(color => {
      if (typeof color === 'string' && !color.startsWith('rgba')) {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
    
    // Check validation result
    expect(result.totalChecks).toBeGreaterThan(0);
    expect(typeof result.isValid).toBe('boolean');
  });

  it('should validate actual dark theme colors', () => {
    const result = ThemeValidation.validateTheme('dark');
    
    // Check that all expected color keys exist in the theme
    const darkTheme = Colors.dark;
    expect(darkTheme).toHaveProperty('text');
    expect(darkTheme).toHaveProperty('textSecondary');
    expect(darkTheme).toHaveProperty('buttonText');
    expect(darkTheme).toHaveProperty('backgroundDefault');
    expect(darkTheme).toHaveProperty('accent');
    expect(darkTheme).toHaveProperty('link');
    expect(darkTheme).toHaveProperty('success');
    expect(darkTheme).toHaveProperty('error');
    
    // Validate that colors are valid hex values
    Object.values(darkTheme).forEach(color => {
      if (typeof color === 'string' && !color.startsWith('rgba')) {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
    
    // Check validation result
    expect(result.totalChecks).toBeGreaterThan(0);
    expect(typeof result.isValid).toBe('boolean');
  });

  it('should have consistent color keys across themes', () => {
    const lightKeys = Object.keys(Colors.light).sort();
    const darkKeys = Object.keys(Colors.dark).sort();
    
    expect(lightKeys).toEqual(darkKeys);
    expect(lightKeys.length).toBeGreaterThan(0);
  });

  it('should provide meaningful context for violations', () => {
    const result = ThemeValidation.validateAllThemes();
    
    if (result.summary.totalViolations > 0) {
      result.summary.violations.forEach(violation => {
        expect(violation.context).toMatch(/^(light|dark) - .+$/);
        expect(violation.context.length).toBeGreaterThan(0);
        
        // Context should be descriptive
        const contextParts = violation.context.split(' - ');
        expect(contextParts).toHaveLength(2);
        expect(['light', 'dark']).toContain(contextParts[0]);
        expect(contextParts[1].length).toBeGreaterThan(0);
      });
    }
  });
});

// AI-META-BEGIN
// AI-META: Central theme hook providing color scheme and theme object
// OWNERSHIP: client/hooks (theming)
// ENTRYPOINTS: Used by nearly all components for styling
// DEPENDENCIES: useColorScheme, Colors constants, contrast validation
// DANGER: Fallback to "light" if colorScheme is null; theme structure must match Colors
// CHANGE-SAFETY: Safe to modify; changing fallback or theme structure affects entire app
// TESTS: Test light/dark mode switching, verify all color keys exist, test contrast validation
// AI-META-END

import { useState } from "react";
import { Colors, ThemeValidation, type ValidationResult } from "@/constants/theme";
import { useColorScheme } from "@/hooks/useColorScheme";

export interface ThemeResult {
  theme: typeof Colors.light | typeof Colors.dark;
  isDark: boolean;
  colorScheme: "light" | "dark" | null;
}

export interface ThemeWithContrastResult extends ThemeResult {
  contrastValidation: {
    isValid: boolean;
    violations: import("@/lib/contrast-validation").ContrastViolation[];
    isAACompliant: boolean;
    isAAACompliant: boolean;
  };
}

export function useTheme(): ThemeResult {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  // AI-NOTE: Fallback to light theme if colorScheme is null (edge case)
  const theme = Colors[colorScheme ?? "light"];

  return {
    theme,
    isDark,
    colorScheme,
  };
}

/**
 * Enhanced theme hook with contrast validation for development and testing
 * Provides real-time contrast compliance information
 */
export function useThemeWithContrast(): ThemeWithContrastResult {
  const baseTheme = useTheme();
  
  // Get contrast validation for current theme
  const currentThemeValidation = ThemeValidation.validateTheme(baseTheme.isDark ? 'dark' : 'light');
  
  // Check overall compliance
  const isAACompliant = ThemeValidation.isCompliant('AA');
  const isAAACompliant = ThemeValidation.isCompliant('AAA');
  
  return {
    ...baseTheme,
    contrastValidation: {
      isValid: currentThemeValidation.isValid,
      violations: currentThemeValidation.violations,
      isAACompliant,
      isAAACompliant,
    }
  };
}

/**
 * Hook for theme switching with contrast validation
 * Warns if switched theme has contrast issues
 */
export function useThemeSwitcher() {
  const { isDark, theme } = useTheme();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const switchTheme = (newScheme: "light" | "dark") => {
    const validation = ThemeValidation.validateTheme(newScheme);
    
    if (!validation.isValid && __DEV__) {
      const errors = validation.violations.map(v => 
        `${v.context}: ${v.ratio}:1 (needs 4.5:1)`
      );
      setValidationErrors(errors);
      
      console.warn('⚠️ Theme has contrast issues:', errors);
    } else {
      setValidationErrors([]);
    }
    
    // Note: Actual theme switching would need to be implemented
    // This is a placeholder for the switching logic
    return validation;
  };

  return {
    isDark,
    theme,
    switchTheme,
    validationErrors,
    hasValidationErrors: validationErrors.length > 0,
  };
}

/**
 * Hook for monitoring theme contrast compliance in real-time
 * Useful for development tools and accessibility testing
 */
export function useContrastMonitor() {
  const { contrastValidation } = useThemeWithContrast();
  
  return {
    ...contrastValidation,
    totalViolations: contrastValidation.violations.length,
    criticalViolations: contrastValidation.violations.filter(v => v.ratio < 3.0),
    warnings: contrastValidation.violations.filter(v => v.ratio >= 3.0 && v.ratio < 4.5),
    
    /**
     * Get violations by context type
     */
    getViolationsByContext: () => {
      const violations = contrastValidation.violations;
      return {
        text: violations.filter(v => v.context.includes('text')),
        button: violations.filter(v => v.context.includes('button')),
        link: violations.filter(v => v.context.includes('link')),
        focus: violations.filter(v => v.context.includes('focus')),
        other: violations.filter(v => 
          !v.context.includes('text') && 
          !v.context.includes('button') && 
          !v.context.includes('link') &&
          !v.context.includes('focus')
        ),
      };
    },
    
    /**
     * Generate accessibility report
     */
    generateReport: () => {
      const violations = contrastValidation.violations;
      const byContext = contrastValidation.violations.reduce((acc, v) => {
        const context = v.context.split(' - ')[0] || 'other';
        acc[context] = (acc[context] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        summary: {
          totalViolations: violations.length,
          isAACompliant: contrastValidation.isAACompliant,
          isAAACompliant: contrastValidation.isAAACompliant,
          worstRatio: Math.min(...violations.map(v => v.ratio)),
          bestRatio: Math.max(...violations.map(v => v.ratio)),
        },
        byContext,
        violations: violations.map(v => ({
          context: v.context,
          ratio: v.ratio,
          colors: `${v.foreground} on ${v.background}`,
          severity: v.ratio < 3.0 ? 'critical' : v.ratio < 4.5 ? 'warning' : 'info',
        })),
      };
    },
  };
}

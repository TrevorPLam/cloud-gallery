#!/usr/bin/env node

/**
 * Color Contrast Testing Script for Cloud Gallery
 * 
 * Automated WCAG 2.2 contrast validation for CI/CD pipelines
 * Tests all theme combinations and generates compliance reports
 * 
 * Usage: node scripts/test-contrast.js [--json] [--threshold=4.5] [--level=AA]
 */

const fs = require('fs');
const path = require('path');

// Import contrast validation utilities
const contrastValidation = require('../client/lib/contrast-validation.ts');

// Configuration
const CONFIG = {
  themesPath: path.join(__dirname, '../client/constants/theme.ts'),
  outputPath: path.join(__dirname, '../contrast-report.json'),
  threshold: 4.5, // WCAG AA minimum
  level: 'AA', // AA or AAA
  json: false
};

// Parse command line arguments
const args = process.argv.slice(2);
args.forEach(arg => {
  if (arg === '--json') CONFIG.json = true;
  if (arg.startsWith('--threshold=')) CONFIG.threshold = parseFloat(arg.split('=')[1]);
  if (arg.startsWith('--level=')) CONFIG.level = arg.split('=')[1].toUpperCase();
});

/**
 * Extract theme colors from the theme file
 */
function extractThemeColors() {
  try {
    const themeFile = fs.readFileSync(CONFIG.themesPath, 'utf8');
    
    // Extract Colors object using regex
    const colorsMatch = themeFile.match(/export const Colors = \{([\s\S]*?)\};/);
    if (!colorsMatch) {
      throw new Error('Could not find Colors object in theme file');
    }
    
    const colorsText = colorsMatch[0];
    
    // Parse light and dark themes
    const lightMatch = colorsText.match(/light:\s*\{([\s\S]*?)\}/);
    const darkMatch = colorsText.match(/dark:\s*\{([\s\S]*?)\}/);
    
    if (!lightMatch || !darkMatch) {
      throw new Error('Could not find light/dark theme definitions');
    }
    
    // Extract color values using regex
    const extractColors = (themeText) => {
      const colors = {};
      const colorRegex = /(\w+):\s*["#]([^"]+)["#]/g;
      let match;
      
      while ((match = colorRegex.exec(themeText)) !== null) {
        colors[match[1]] = match[2];
      }
      
      return colors;
    };
    
    return {
      light: extractColors(lightMatch[1]),
      dark: extractColors(darkMatch[1])
    };
  } catch (error) {
    console.error('❌ Error extracting theme colors:', error.message);
    process.exit(1);
  }
}

/**
 * Run contrast validation on all themes
 */
function runContrastValidation() {
  console.log('🎨 Running WCAG 2.2 Color Contrast Validation');
  console.log(`📊 Threshold: ${CONFIG.threshold}:1 (${CONFIG.level} level)`);
  console.log('');
  
  const themes = extractThemeColors();
  const results = [];
  
  // Validate light theme
  console.log('☀️  Testing Light Theme...');
  const lightResult = contrastValidation.validateThemeColors(themes.light, 'light');
  results.push(lightResult);
  
  console.log(`   Checks: ${lightResult.passedChecks}/${lightResult.totalChecks} passed`);
  if (lightResult.violations.length > 0) {
    console.log(`   ❌ ${lightResult.violations.length} violations found`);
  } else {
    console.log('   ✅ All checks passed');
  }
  
  // Validate dark theme
  console.log('');
  console.log('🌙 Testing Dark Theme...');
  const darkResult = contrastValidation.validateThemeColors(themes.dark, 'dark');
  results.push(darkResult);
  
  console.log(`   Checks: ${darkResult.passedChecks}/${darkResult.totalChecks} passed`);
  if (darkResult.violations.length > 0) {
    console.log(`   ❌ ${darkResult.violations.length} violations found`);
  } else {
    console.log('   ✅ All checks passed');
  }
  
  // Generate report
  const report = contrastValidation.generateContrastReport(results);
  
  console.log('');
  console.log('📋 Summary:');
  console.log(`   Themes tested: ${report.summary.totalThemes}`);
  console.log(`   Valid themes: ${report.summary.validThemes}`);
  console.log(`   Invalid themes: ${report.summary.invalidThemes}`);
  console.log(`   Total violations: ${report.summary.totalViolations}`);
  
  // Show violations if any exist
  if (report.violations.length > 0) {
    console.log('');
    console.log('❌ Contrast Violations:');
    report.violations.forEach((violation, index) => {
      console.log(`   ${index + 1}. ${violation.context}`);
      console.log(`      Ratio: ${violation.ratio}:1 (Expected: ${violation.expectedLevel})`);
      console.log(`      Colors: ${violation.foreground} on ${violation.background}`);
    });
    
    console.log('');
    console.log('💡 Recommendations:');
    report.recommendations.forEach(rec => {
      console.log(`   • ${rec}`);
    });
  }
  
  // Save JSON report if requested
  if (CONFIG.json) {
    const reportData = {
      timestamp: new Date().toISOString(),
      config: {
        threshold: CONFIG.threshold,
        level: CONFIG.level
      },
      themes: {
        light: themes.light,
        dark: themes.dark
      },
      results: results,
      report: report
    };
    
    fs.writeFileSync(CONFIG.outputPath, JSON.stringify(reportData, null, 2));
    console.log('');
    console.log(`📄 JSON report saved to: ${CONFIG.outputPath}`);
  }
  
  // Exit with error code if violations exist
  if (report.summary.totalViolations > 0) {
    console.log('');
    console.log('❌ Contrast validation failed');
    process.exit(1);
  } else {
    console.log('');
    console.log('✅ All contrast checks passed');
    process.exit(0);
  }
}

/**
 * Validate a specific color pair
 */
function validateColorPair(foreground, background) {
  const result = contrastValidation.calculateContrastRatio(foreground, background);
  
  if (!result) {
    console.error('❌ Invalid color format');
    process.exit(1);
  }
  
  console.log(`🎨 Contrast Analysis:`);
  console.log(`   Foreground: ${foreground}`);
  console.log(`   Background: ${background}`);
  console.log(`   Ratio: ${result.ratio}:1`);
  console.log(`   WCAG AA: ${result.passesAA ? '✅' : '❌'}`);
  console.log(`   WCAG AAA: ${result.passesAAA ? '✅' : '❌'}`);
  console.log(`   Large Text AA: ${result.passesAALarge ? '✅' : '❌'}`);
  console.log(`   Large Text AAA: ${result.passesAAALarge ? '✅' : '❌'}`);
  console.log(`   Level: ${result.wcagLevel}`);
}

// Check for specific color pair validation
if (args.length === 2 && !args[0].startsWith('--')) {
  validateColorPair(args[0], args[1]);
} else {
  runContrastValidation();
}

#!/usr/bin/env node

// AI-META-BEGIN
// AI-META: Advanced developer tooling with code generation, refactoring assistance, and productivity analytics
// OWNERSHIP: scripts/developer-tools
// ENTRYPOINTS: npm run dev:tools, npm run dev:analyze, npm run dev:generate
// DEPENDENCIES: Node.js fs, path, child_process, AI/ML libraries for code analysis
// DANGER: Code generation modifies files; refactoring may break existing code; requires careful validation
// CHANGE-SAFETY: Add new tools by extending DeveloperTools class; code generation templates are configurable
// TESTS: scripts/developer-tools.test.ts, verify code generation and refactoring safety
// AI-META-END

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

class DeveloperTools {
  constructor(options = {}) {
    this.options = {
      projectRoot: process.cwd(),
      enableAIGeneration: true,
      enableRefactoring: true,
      enableAnalysis: true,
      enableProductivityTracking: true,
      codeStyle: 'typescript-react',
      maxFileSize: 100000, // 100KB
      excludePatterns: ['node_modules', 'dist', 'build', '.git'],
      ...options
    };

    this.metrics = {
      startTime: Date.now(),
      filesAnalyzed: 0,
      linesOfCode: 0,
      complexityScore: 0,
      maintainabilityIndex: 0,
      codeSmells: [],
      suggestions: [],
      refactorings: [],
      generatedCode: [],
      productivityScore: 0
    };

    this.codePatterns = new Map();
    this.refactoringRules = new Map();
    this.productivityData = new Map();
    
    this.initializePatterns();
    this.initializeRefactoringRules();
  }

  initializePatterns() {
    // Common code patterns for detection and generation
    this.codePatterns.set('react-component', {
      template: `import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface {{componentName}}Props {
  // Define your props here
}

const {{componentName}}: React.FC<{{componentName}}Props> = (props) => {
  return (
    <View style={styles.container}>
      <Text>{{componentName}}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default {{componentName}};`,
      description: 'React functional component with TypeScript'
    });

    this.codePatterns.set('react-hook', {
      template: `import { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

export const use{{hookName}} = () => {
  const [state, setState] = useState(null);

  useEffect(() => {
    // Add your effect logic here
  }, []);

  return {
    state,
    setState
  };
};`,
      description: 'Custom React hook with TypeScript'
    });

    this.codePatterns.set('api-service', {
      template: `import { {{httpMethod}} } from './api-client';

export interface {{serviceName}}Request {
  // Define request interface
}

export interface {{serviceName}}Response {
  // Define response interface
}

export class {{serviceName}}Service {
  private static instance: {{serviceName}}Service;

  static getInstance(): {{serviceName}}Service {
    if (!{{serviceName}}Service.instance) {
      {{serviceName}}Service.instance = new {{serviceName}}Service();
    }
    return {{serviceName}}Service.instance;
  }

  async {{methodName}}(request: {{serviceName}}Request): Promise<{{serviceName}}Response> {
    try {
      const response = await {{httpMethod}}<{{serviceName}}Response>('/{{endpoint}}', request);
      return response.data;
    } catch (error) {
      throw new Error(\`{{serviceName}} service error: \${error.message}\`);
    }
  }
}

export const {{serviceName}} = {{serviceName}}Service.getInstance();`,
      description: 'API service class with TypeScript'
    });

    this.codePatterns.set('test-component', {
      template: `import React from 'react';
import { render, screen } from '@testing-library/react-native';
import {{componentName}} from '../{{componentName}}';

describe('{{componentName}}', () => {
  it('renders correctly', () => {
    render(<{{componentName}} />);
    
    expect(screen.getByText('{{componentName}}')).toBeTruthy();
  });

  it('handles user interactions', () => {
    // Add interaction tests here
  });
});`,
      description: 'React Native component test with Testing Library'
    });
  }

  initializeRefactoringRules() {
    // Refactoring rules for automatic code improvement
    this.refactoringRules.set('convert-to-arrow-function', {
      description: 'Convert function declarations to arrow functions',
      pattern: /function\s+(\w+)\s*\(([^)]*)\)\s*\s*{/g,
      replacement: 'const $1 = ($2) => {',
      priority: 1
    });

    this.refactoringRules.set('add-missing-types', {
      description: 'Add missing TypeScript types',
      pattern: /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*{/g,
      replacement: 'const $1: ($2) => void = ($2) => {',
      priority: 2
    });

    this.refactoringRules.set('extract-constant', {
      description: 'Extract magic numbers to constants',
      pattern: /(\d+)/g,
      context: 'magic-number',
      replacement: 'CONSTANT_NAME',
      priority: 3
    });

    this.refactoringRules.set('add-jsdoc', {
      description: 'Add JSDoc comments to functions',
      pattern: /\/\*\*[\s\S]*?\*\/\s*(?:async\s+)?(?:function|const)\s+(\w+)/g,
      replacement: '/**\n * $1 description\n * @param {...} description\n * @returns {...} description\n */\n',
      priority: 4
    });
  }

  async analyzeCodebase() {
    console.log('🔍 Analyzing codebase...');
    
    const files = this.findCodeFiles();
    
    for (const file of files) {
      await this.analyzeFile(file);
    }
    
    this.calculateMetrics();
    this.generateSuggestions();
    
    console.log('✅ Codebase analysis completed');
    return this.metrics;
  }

  findCodeFiles() {
    const files = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    
    const scanDirectory = (dir) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          if (!this.options.excludePatterns.some(pattern => item.name.includes(pattern))) {
            scanDirectory(fullPath);
          }
        } else if (extensions.some(ext => item.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };
    
    scanDirectory(this.options.projectRoot);
    return files;
  }

  async analyzeFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const stats = fs.statSync(filePath);
      
      if (stats.size > this.options.maxFileSize) {
        console.warn(`⚠️ Skipping large file: ${filePath}`);
        return;
      }
      
      const analysis = {
        path: filePath,
        size: stats.size,
        lines: content.split('\n').length,
        complexity: this.calculateComplexity(content),
        maintainability: this.calculateMaintainability(content),
        codeSmells: this.detectCodeSmells(content),
        patterns: this.detectPatterns(content),
        dependencies: this.extractDependencies(content)
      };
      
      this.metrics.filesAnalyzed++;
      this.metrics.linesOfCode += analysis.lines;
      this.metrics.complexityScore += analysis.complexity;
      
      // Store analysis for later use
      this.productivityData.set(filePath, analysis);
      
    } catch (error) {
      console.error(`❌ Error analyzing file ${filePath}:`, error.message);
    }
  }

  calculateComplexity(content) {
    let complexity = 1; // Base complexity
    
    // Cognitive complexity indicators
    const complexityPatterns = [
      /if\s*\(/g,
      /else\s+if/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /do\s*{/g,
      /switch\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /&&/g,
      /\|\|/g,
      /\?/g,
      /try\s*{/g
    ];
    
    for (const pattern of complexityPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  calculateMaintainability(content) {
    // Simplified maintainability index calculation
    const lines = content.split('\n').length;
    const complexity = this.calculateComplexity(content);
    const comments = (content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length;
    
    // Halstead Volume (simplified)
    const operators = (content.match(/[+\-*\/=<>!&|]+/g) || []).length;
    const operands = (content.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []).length;
    const volume = (operators + operands) * Math.log2(operators + operands || 1);
    
    // Maintainability Index (simplified)
    const maintainability = Math.max(0, 171 - 5.2 * Math.log(volume) - 0.23 * complexity - 16.2 * Math.log(lines));
    
    return Math.min(100, maintainability);
  }

  detectCodeSmells(content) {
    const smells = [];
    
    // Long method
    const lines = content.split('\n').length;
    if (lines > 50) {
      smells.push({
        type: 'long-method',
        severity: 'medium',
        message: `Method is ${lines} lines long (consider refactoring)`
      });
    }
    
    // Too many parameters
    const paramMatch = content.match(/function\s+\w+\s*\(([^)]*)\)/);
    if (paramMatch && paramMatch[1].split(',').length > 5) {
      smells.push({
        type: 'too-many-parameters',
        severity: 'medium',
        message: 'Function has too many parameters (consider using an object)'
      });
    }
    
    // Duplicate code (simplified)
    const linesArray = content.split('\n');
    const duplicateLines = linesArray.filter((line, index) => 
      linesArray.indexOf(line) !== index && line.trim().length > 10
    );
    
    if (duplicateLines.length > 5) {
      smells.push({
        type: 'duplicate-code',
        severity: 'low',
        message: `${duplicateLines.length} lines may be duplicated`
      });
    }
    
    // Magic numbers
    const magicNumbers = content.match(/\b\d{2,}\b/g);
    if (magicNumbers && magicNumbers.length > 3) {
      smells.push({
        type: 'magic-numbers',
        severity: 'low',
        message: `${magicNumbers.length} magic numbers found (extract to constants)`
      });
    }
    
    return smells;
  }

  detectPatterns(content) {
    const detectedPatterns = [];
    
    for (const [patternName, pattern] of this.codePatterns) {
      // Simple pattern detection based on keywords
      const keywords = pattern.description.toLowerCase().split(' ');
      const contentLower = content.toLowerCase();
      
      const matchCount = keywords.reduce((count, keyword) => {
        return count + (contentLower.includes(keyword) ? 1 : 0);
      }, 0);
      
      if (matchCount > keywords.length * 0.5) {
        detectedPatterns.push({
          name: patternName,
          confidence: matchCount / keywords.length,
          description: pattern.description
        });
      }
    }
    
    return detectedPatterns;
  }

  extractDependencies(content) {
    const dependencies = [];
    
    // Import statements
    const importMatches = content.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      dependencies.push(...importMatches.map(match => match.split("'")[1] || match.split('"')[1]));
    }
    
    // Require statements
    const requireMatches = content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    if (requireMatches) {
      dependencies.push(...requireMatches.map(match => match.split("'")[1] || match.split('"')[1]));
    }
    
    return [...new Set(dependencies)];
  }

  calculateMetrics() {
    if (this.metrics.filesAnalyzed === 0) return;
    
    // Average complexity
    this.metrics.complexityScore = Math.round(this.metrics.complexityScore / this.metrics.filesAnalyzed);
    
    // Average maintainability
    const totalMaintainability = Array.from(this.productivityData.values())
      .reduce((sum, analysis) => sum + analysis.maintainability, 0);
    this.metrics.maintainabilityIndex = Math.round(totalMaintainability / this.metrics.filesAnalyzed);
    
    // Total code smells
    this.metrics.codeSmells = Array.from(this.productivityData.values())
      .flatMap(analysis => analysis.codeSmells);
    
    // Productivity score (simplified)
    const qualityScore = (this.metrics.maintainabilityIndex + (100 - this.metrics.complexityScore)) / 2;
    const codeQualityBonus = this.metrics.codeSmells.length === 0 ? 10 : -this.metrics.codeSmells.length;
    this.metrics.productivityScore = Math.max(0, Math.min(100, qualityScore + codeQualityBonus));
  }

  generateSuggestions() {
    this.metrics.suggestions = [];
    
    // Code quality suggestions
    if (this.metrics.maintainabilityIndex < 70) {
      this.metrics.suggestions.push({
        type: 'quality',
        priority: 'high',
        message: 'Low maintainability index detected. Consider refactoring complex functions.',
        action: 'refactor'
      });
    }
    
    if (this.metrics.complexityScore > 20) {
      this.metrics.suggestions.push({
        type: 'complexity',
        priority: 'medium',
        message: 'High complexity detected. Break down large functions into smaller ones.',
        action: 'refactor'
      });
    }
    
    // Pattern-based suggestions
    const commonPatterns = this.getCommonPatterns();
    if (commonPatterns.length > 0) {
      this.metrics.suggestions.push({
        type: 'patterns',
        priority: 'low',
        message: `Common patterns detected: ${commonPatterns.map(p => p.name).join(', ')}`,
        action: 'generate'
      });
    }
    
    // Dependency suggestions
    const allDependencies = Array.from(this.productivityData.values())
      .flatMap(analysis => analysis.dependencies);
    const uniqueDependencies = [...new Set(allDependencies)];
    
    if (uniqueDependencies.length > 50) {
      this.metrics.suggestions.push({
        type: 'dependencies',
        priority: 'medium',
        message: `High dependency count (${uniqueDependencies.length}). Consider tree shaking.`,
        action: 'optimize'
      });
    }
  }

  getCommonPatterns() {
    const patternCounts = new Map();
    
    for (const analysis of this.productivityData.values()) {
      for (const pattern of analysis.patterns) {
        const count = patternCounts.get(pattern.name) || 0;
        patternCounts.set(pattern.name, count + pattern.confidence);
      }
    }
    
    return Array.from(patternCounts.entries())
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  async generateCode(patternName, options = {}) {
    if (!this.options.enableAIGeneration) {
      throw new Error('AI code generation is disabled');
    }
    
    const pattern = this.codePatterns.get(patternName);
    if (!pattern) {
      throw new Error(`Unknown pattern: ${patternName}`);
    }
    
    let code = pattern.template;
    
    // Replace placeholders
    const replacements = {
      componentName: options.componentName || 'NewComponent',
      hookName: options.hookName || 'useCustomHook',
      serviceName: options.serviceName || 'ApiService',
      methodName: options.methodName || 'fetchData',
      httpMethod: options.httpMethod || 'get',
      endpoint: options.endpoint || 'api/data',
      ...options
    };
    
    for (const [placeholder, value] of Object.entries(replacements)) {
      const regex = new RegExp(`{{${placeholder}}}`, 'g');
      code = code.replace(regex, value);
    }
    
    const generatedCode = {
      pattern: patternName,
      code,
      timestamp: Date.now(),
      options
    };
    
    this.metrics.generatedCode.push(generatedCode);
    
    console.log(`✅ Generated ${patternName} code`);
    return generatedCode;
  }

  async refactorCode(filePath, rules = []) {
    if (!this.options.enableRefactoring) {
      throw new Error('Refactoring is disabled');
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    let refactoredContent = content;
    const appliedRefactorings = [];
    
    const rulesToApply = rules.length > 0 
      ? rules.map(name => this.refactoringRules.get(name)).filter(Boolean)
      : Array.from(this.refactoringRules.values());
    
    for (const rule of rulesToApply) {
      try {
        const matches = refactoredContent.match(rule.pattern);
        if (matches) {
          refactoredContent = refactoredContent.replace(rule.pattern, rule.replacement);
          appliedRefactorings.push({
            rule: rule.description,
            matches: matches.length
          });
        }
      } catch (error) {
        console.warn(`⚠️ Refactoring rule failed: ${rule.description}`, error.message);
      }
    }
    
    if (appliedRefactorings.length > 0) {
      // Create backup
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.writeFileSync(backupPath, content);
      
      // Write refactored code
      fs.writeFileSync(filePath, refactoredContent);
      
      console.log(`✅ Refactored ${filePath} with ${appliedRefactorings.length} rules`);
      
      const refactoring = {
        filePath,
        backupPath,
        appliedRefactorings,
        timestamp: Date.now()
      };
      
      this.metrics.refactorings.push(refactoring);
      return refactoring;
    } else {
      console.log(`ℹ️ No refactoring needed for ${filePath}`);
      return null;
    }
  }

  async generateComponent(componentName, options = {}) {
    const generated = await this.generateCode('react-component', {
      componentName,
      ...options
    });
    
    const filePath = path.join(this.options.projectRoot, 'client', 'components', `${componentName}.tsx`);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, generated.code);
    
    console.log(`✅ Generated component: ${filePath}`);
    return { ...generated, filePath };
  }

  async generateHook(hookName, options = {}) {
    const generated = await this.generateCode('react-hook', {
      hookName,
      ...options
    });
    
    const filePath = path.join(this.options.projectRoot, 'client', 'hooks', `${hookName}.ts`);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, generated.code);
    
    console.log(`✅ Generated hook: ${filePath}`);
    return { ...generated, filePath };
  }

  async generateService(serviceName, options = {}) {
    const generated = await this.generateCode('api-service', {
      serviceName,
      ...options
    });
    
    const filePath = path.join(this.options.projectRoot, 'client', 'services', `${serviceName}.ts`);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, generated.code);
    
    console.log(`✅ Generated service: ${filePath}`);
    return { ...generated, filePath };
  }

  async generateTest(componentName, options = {}) {
    const generated = await this.generateCode('test-component', {
      componentName,
      ...options
    });
    
    const filePath = path.join(this.options.projectRoot, 'client', 'components', '__tests__', `${componentName}.test.tsx`);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, generated.code);
    
    console.log(`✅ Generated test: ${filePath}`);
    return { ...generated, filePath };
  }

  getProductivityReport() {
    const endTime = Date.now();
    const duration = endTime - this.metrics.startTime;
    
    return {
      summary: {
        duration: duration,
        filesAnalyzed: this.metrics.filesAnalyzed,
        linesOfCode: this.metrics.linesOfCode,
        productivityScore: this.metrics.productivityScore,
        maintainabilityIndex: this.metrics.maintainabilityIndex,
        complexityScore: this.metrics.complexityScore
      },
      codeQuality: {
        codeSmells: this.metrics.codeSmells.length,
        suggestions: this.metrics.suggestions.length,
        refactorings: this.metrics.refactorings.length
      },
      generatedCode: {
        totalGenerated: this.metrics.generatedCode.length,
        patterns: this.metrics.generatedCode.map(g => g.pattern)
      },
      recommendations: this.metrics.suggestions
    };
  }

  async saveReport() {
    const report = this.getProductivityReport();
    const reportPath = path.join(this.options.projectRoot, 'developer-tools-report.json');
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Developer tools report saved to: ${reportPath}`);
    return reportPath;
  }

  printSummary() {
    const report = this.getProductivityReport();
    
    console.log('\n📊 Developer Tools Summary');
    console.log('='.repeat(50));
    console.log(`⏱️ Analysis Duration: ${(report.summary.duration / 1000).toFixed(2)}s`);
    console.log(`📁 Files Analyzed: ${report.summary.filesAnalyzed}`);
    console.log(`📝 Lines of Code: ${report.summary.linesOfCode.toLocaleString()}`);
    console.log(`🎯 Productivity Score: ${report.summary.productivityScore}/100`);
    console.log(`🔧 Maintainability Index: ${report.summary.maintainabilityIndex}/100`);
    console.log(`🧠 Complexity Score: ${report.summary.complexityScore}`);
    
    console.log('\n📈 Code Quality:');
    console.log(`   Code Smells: ${report.codeQuality.codeSmells}`);
    console.log(`   Suggestions: ${report.codeQuality.suggestions}`);
    console.log(`   Refactorings: ${report.codeQuality.refactorings}`);
    
    if (report.generatedCode.totalGenerated > 0) {
      console.log('\n✨ Generated Code:');
      console.log(`   Total Generated: ${report.generatedCode.totalGenerated}`);
      console.log(`   Patterns: ${report.generatedCode.patterns.join(', ')}`);
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`   ${index + 1}. ${icon} ${rec.message} (${rec.action})`);
      });
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const options = {
    enableAIGeneration: !args.includes('--no-ai'),
    enableRefactoring: !args.includes('--no-refactor'),
    enableAnalysis: !args.includes('--no-analysis'),
    enableProductivityTracking: !args.includes('--no-tracking')
  };
  
  const tools = new DeveloperTools(options);
  
  try {
    switch (command) {
      case 'analyze':
        await tools.analyzeCodebase();
        await tools.saveReport();
        tools.printSummary();
        break;
        
      case 'generate':
        if (args[1] === 'component') {
          const componentName = args[2] || 'NewComponent';
          await tools.generateComponent(componentName);
        } else if (args[1] === 'hook') {
          const hookName = args[2] || 'useCustomHook';
          await tools.generateHook(hookName);
        } else if (args[1] === 'service') {
          const serviceName = args[2] || 'ApiService';
          await tools.generateService(serviceName);
        } else if (args[1] === 'test') {
          const componentName = args[2] || 'Component';
          await tools.generateTest(componentName);
        } else {
          console.error('❌ Unknown generation type. Use: component, hook, service, or test');
          process.exit(1);
        }
        break;
        
      case 'refactor':
        const filePath = args[1];
        const rules = args.slice(2);
        
        if (!filePath) {
          console.error('❌ File path required for refactoring');
          process.exit(1);
        }
        
        await tools.refactorCode(filePath, rules);
        break;
        
      case 'report':
        await tools.analyzeCodebase();
        await tools.saveReport();
        console.log('📊 Report generated');
        break;
        
      default:
        console.log('🛠️ Cloud Gallery Developer Tools');
        console.log('');
        console.log('Usage:');
        console.log('  npm run dev:tools analyze                    - Analyze codebase');
        console.log('  npm run dev:tools generate component <name> - Generate component');
        console.log('  npm run dev:tools generate hook <name>       - Generate hook');
        console.log('  npm run dev:tools generate service <name>    - Generate service');
        console.log('  npm run dev:tools generate test <name>       - Generate test');
        console.log('  npm run dev:tools refactor <file> [rules]    - Refactor file');
        console.log('  npm run dev:tools report                     - Generate report');
        console.log('');
        console.log('Options:');
        console.log('  --no-ai         Disable AI code generation');
        console.log('  --no-refactor   Disable refactoring');
        console.log('  --no-analysis   Disable code analysis');
        console.log('  --no-tracking   Disable productivity tracking');
        break;
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Developer tools error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DeveloperTools;

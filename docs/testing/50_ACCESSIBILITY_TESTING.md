# Accessibility Testing Guide

This guide covers accessibility testing practices for Cloud Gallery to ensure WCAG 2.1 AA compliance.

## 🎯 Overview

Accessibility testing ensures that the Cloud Gallery app is usable by people with disabilities. We follow WCAG 2.1 AA guidelines and test both automatically and manually.

## 🛠️ Tools & Libraries

### Core Libraries
- **vitest-axe**: axe-core integration for Vitest (replaces deprecated @axe-core/react)
- **React Native Testing Library**: Component testing with accessibility support
- **Custom accessibility utilities**: React Native specific testing helpers (`client/test-utils/accessibility-testing.ts`)

### Platform-Specific Tools
- **iOS**: Accessibility Inspector
- **Android**: Accessibility Scanner
- **Web**: axe browser extension

## 📋 Test Categories

### 1. Automated Tests
Run automatically in CI/CD pipeline:

```bash
# Run all accessibility tests
npm run test:accessibility

# Run with coverage
npm run test:accessibility -- --coverage
```

### 2. Visual Accessibility Tests
Screen reader compatibility and visual accessibility:

```bash
# Run visual regression tests with accessibility checks
npm run test:visual
```

### 3. Manual Tests
Manual testing with assistive technologies:

#### Screen Reader Testing
- **iOS**: VoiceOver
- **Android**: TalkBack
- **Web**: NVDA, JAWS, VoiceOver

#### Keyboard Navigation Testing
- Tab order logic
- Focus management
- Keyboard shortcuts

#### Visual Accessibility Testing
- Color contrast (4.5:1 minimum)
- Text resizing (200% zoom)
- High contrast mode

## 🧪 Test Patterns

### Component Accessibility Tests

```typescript
import { render } from '@testing-library/react-native';
import { AccessibilityTester, AccessibilityPatterns } from '../test-utils/accessibility-testing';
import { Button } from './Button';

describe('Button Accessibility', () => {
  // Standard accessibility test with WCAG 2.1 AA compliance
  it('should be accessible', async () => {
    const { container } = render(
      <Button title="Submit" onPress={() => {}} />
    );
    
    await AccessibilityTester.expectNoViolations(container);
  });

  // Test interactive element patterns
  it('should pass interactive element tests', async () => {
    await AccessibilityPatterns.testInteractiveElement(
      <Button title="Submit Form" onPress={() => {}} />
    );
  });

  // Custom accessibility assertion
  it('should be accessible with custom matcher', async () => {
    const component = <Button title="Submit" onPress={() => {}} />;
    await expect(component).toBeAccessible();
  });

  // Specific accessibility properties
  it('should have proper accessibility label', () => {
    const { getByRole } = render(<Button title="Submit Form" onPress={() => {}} />);
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Submit Form');
  });
});
```

### Screen Reader Tests

```typescript
it('should be screen reader friendly', () => {
  const { getByLabelText } = render(
    <Button title="Upload Photo" onPress={() => {}} />
  );
  
  const button = getByLabelText('Upload Photo');
  expect(button).toBeTruthy();
  expect(button.props.accessible).toBe(true);
});
```

### Focus Management Tests

```typescript
it('should manage focus correctly', async () => {
  const { getByRole } = render(<Button title="Submit" onPress={() => {}} />);
  const button = getByRole('button');
  
  // Test focusability
  expect(button.props.focusable).toBe(true);
  
  // Test focus trap in modals (if applicable)
  // Test focus restoration after modal close
});
```

## 📊 Accessibility Requirements

### Mandatory Tests
All components must pass:

1. **Semantic markup**: Proper roles and labels
2. **Keyboard accessibility**: Full keyboard navigation
3. **Screen reader support**: Meaningful announcements
4. **Color contrast**: WCAG AA compliance
5. **Touch targets**: Minimum 44x44 points

### Recommended Tests
Where applicable:

1. **Voice control**: Voice command support
2. **Switch control**: External switch device support
3. **Reduced motion**: Respect motion preferences
4. **High contrast**: High contrast mode support

## 🔧 Implementation Guidelines

### Accessibility Props

```typescript
// Required accessibility props
interface AccessibleComponent {
  accessible?: boolean;          // Default: true
  accessibilityLabel?: string;   // Required for interactive elements
  accessibilityHint?: string;    // For complex interactions
  accessibilityRole?: string;    // button, link, etc.
  accessibilityState?: {         // Component state
    disabled?: boolean;
    selected?: boolean;
    busy?: boolean;
    checked?: 'mixed' | boolean;
  };
}
```

### Testing Checklist

#### ✅ Interactive Elements
- [ ] Has accessibility label or title
- [ ] Has appropriate role
- [ ] State is properly announced
- [ ] Touch target ≥44x44 points

#### ✅ Images & Media
- [ ] Meaningful images have descriptions
- [ ] Decorative images marked as such
- [ ] Videos have captions
- [ ] Audio content has transcripts

#### ✅ Forms
- [ ] All fields have labels
- [ ] Error messages are accessible
- [ ] Required fields are indicated
- [ ] Form validation is accessible

#### ✅ Navigation
- [ ] Logical tab order
- [ ] Skip links available
- [ ] Breadcrumb navigation
- [ ] Focus indicators visible

## 🚀 CI/CD Integration

### Automated Checks
```yaml
# .github/workflows/test-coverage.yml (updated with accessibility)
name: Test Coverage and Accessibility
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:accessibility
      - run: npm run test:visual
      - name: Upload accessibility results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: accessibility-results
          path: coverage/
```

### Failure Thresholds
- **Critical violations**: 0 allowed (blocks merge)
- **Serious violations**: 0 allowed (blocks merge)  
- **Moderate violations**: 5 allowed (warning)
- **Minor violations**: 10 allowed (warning)
- **Accessibility score**: Minimum 90% required

### Coverage Requirements
- **New components**: 100% accessibility test coverage
- **Existing components**: Minimum 80% accessibility test coverage
- **Critical paths**: 100% manual testing required

## 📱 Platform-Specific Considerations

### React Native Specific
- Use `accessibilityLabel` instead of `alt` text
- Implement `accessibilityRole` for custom components
- Handle `accessibilityElementsHidden` for modal overlays
- Support `accessibilityIgnoresInvertColors` for iOS

### Web Platform
- Test with axe-core integration
- Validate HTML semantic structure
- Test ARIA attributes and roles
- Verify keyboard navigation patterns

## 🔍 Debugging Tools

### React Native
```typescript
// Enable accessibility inspector in development
if (__DEV__) {
  console.log('Accessibility Inspector enabled');
}
```

### Browser Tools
- axe DevTools browser extension
- Chrome DevTools Accessibility panel
- Firefox Accessibility Inspector
- VoiceOver screen reader (macOS)

## 📚 Resources

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [axe-core Documentation](https://www.deque.com/axe-core-documentation/)

### Tools
- [Accessibility Inspector (iOS)](https://developer.apple.com/documentation/accessibility/accessibility_inspector)
- [Accessibility Scanner (Android)](https://play.google.com/store/apps/details?id=com.google.android.apps.accessibility.auditor)
- [WAVE Web Accessibility Tool](https://wave.webaim.org/)

### Testing Libraries
- [vitest-axe](https://github.com/chaance/vitest-axe) - axe-core integration for Vitest
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

## 🎯 Success Metrics

### Quantitative Metrics
- **Accessibility test coverage**: >90%
- **Automated test pass rate**: 100%
- **Manual test completion**: 100% for critical paths
- **Bug fix time**: <48 hours for accessibility issues

### Qualitative Metrics
- **Screen reader usability**: Smooth navigation
- **Keyboard navigation**: Complete functionality
- **Visual accessibility**: Clear contrast and readability
- **User feedback**: Positive accessibility experience

## 🔄 Continuous Improvement

### Regular Reviews
- Monthly accessibility audit
- User testing with assistive technology users
- Component library accessibility review
- Documentation updates

### Training & Resources
- Team accessibility training sessions
- Accessibility guidelines documentation
- Best practices sharing
- External accessibility conferences and workshops

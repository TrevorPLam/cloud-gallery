# Visual Testing Guide

This guide covers visual regression testing practices for Cloud Gallery to ensure UI consistency across updates.

## 🎯 Overview

Visual testing catches UI regressions that traditional unit tests might miss, ensuring consistent appearance across platforms, themes, and screen sizes.

## 🛠️ Tools & Libraries

### Core Libraries
- **Chromatic**: Visual regression testing platform
- **Storybook**: Component development and testing environment
- **Custom visual utilities**: React Native specific testing helpers

### Platform-Specific Tools
- **iOS**: Fastlane screenshots
- **Android**: Gradle screenshot tests
- **Web**: Percy, Chromatic

## 📋 Test Categories

### 1. Component Visual Tests
Individual component appearance testing:

```bash
# Run visual tests locally
npm run test:visual

# Run in CI
npm run test:visual:ci
```

### 2. Integration Visual Tests
Multi-component interaction testing:

```bash
# Test complete user flows
npm run test:visual:flows
```

### 3. Cross-Platform Tests
Consistency across iOS, Android, and Web:

```bash
# Test all platforms
npm run test:visual:platforms
```

## 🧪 Test Patterns

### Component Stories

```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    chromatic: {
      delay: 300,        // Wait for animations
      disableSnapshot: false,
      viewports: [375, 768, 1024], // Mobile, tablet, desktop
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Basic variants
export const Default: Story = {
  args: { title: 'Default', onPress: () => {} },
};

export const Secondary: Story = {
  args: { title: 'Secondary', variant: 'secondary', onPress: () => {} },
};

// State variations
export const Pressed: Story = {
  args: { title: 'Pressed', onPress: () => {} },
  parameters: { chromatic: { delay: 100 } },
};

export const Disabled: Story = {
  args: { title: 'Disabled', disabled: true, onPress: () => {} },
};
```

### Visual Test Utilities

```typescript
// test-utils/visual-testing.tsx
export interface VisualTestStory {
  name: string;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
  variants?: Array<{
    name: string;
    props: Record<string, any>;
  }>;
}

export function createVisualTest(config: VisualTestStory) {
  return {
    default: config.component,
    ...(config.variants?.reduce((acc, variant) => {
      acc[variant.name] = { ...config.props, ...variant.props };
      return acc;
    }, {}) || {}),
  };
}

// Common test patterns
export const visualTestPatterns = {
  states: (component, baseProps) => [
    { name: 'Default', props: baseProps },
    { name: 'Pressed', props: { ...baseProps, pressed: true } },
    { name: 'Disabled', props: { ...baseProps, disabled: true } },
    { name: 'Loading', props: { ...baseProps, loading: true } },
  ],
  
  themes: (component, baseProps) => [
    { name: 'Light', props: { ...baseProps, theme: 'light' } },
    { name: 'Dark', props: { ...baseProps, theme: 'dark' } },
  ],
  
  sizes: (component, baseProps) => [
    { name: 'Small', props: { ...baseProps, size: 'small' } },
    { name: 'Medium', props: { ...baseProps, size: 'medium' } },
    { name: 'Large', props: { ...baseProps, size: 'large' } },
  ],
};
```

### Complex Component Testing

```typescript
// PhotoGrid.stories.tsx
export const VisualRegression: Story = {
  render: () => (
    <PhotoGrid
      photos={generateMockPhotos(12)}
      onPhotoPress={() => {}}
      selectedPhotos={new Set(['1', '3'])}
      selectionMode={true}
    />
  ),
  parameters: {
    chromatic: {
      // Capture multiple states
      disableSnapshot: false,
      delay: 500,
      viewports: [375, 768], // Mobile and tablet
    },
  },
};
```

## 📱 Platform-Specific Testing

### React Native Visual Testing

```typescript
// Native screenshot capture
export const captureNativeScreenshot = async (component: React.ReactElement) => {
  if (Platform.OS === 'ios') {
    return await captureIosScreenshot(component);
  } else {
    return await captureAndroidScreenshot(component);
  }
};

// iOS Fastlane integration
const captureIosScreenshot = async (component) => {
  // Use Fastlane snapshot or Xcode UI Tests
  return 'ios-screenshot-data';
};

// Android Gradle integration
const captureAndroidScreenshot = async (component) => {
  // Use Android screenshot tests or Espresso
  return 'android-screenshot-data';
};
```

### Web Visual Testing

```typescript
// Web screenshot capture with Puppeteer
export const captureWebScreenshot = async (url: string, selector: string) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForSelector(selector);
  const screenshot = await page.screenshot({ encoding: 'base64' });
  await browser.close();
  return screenshot;
};
```

## 🔧 Configuration

### Chromatic Configuration

```json
// .chromaticrc.json
{
  "projectToken": "chpt_project_token_placeholder",
  "buildScriptName": "expo:static:build",
  "onlyChanged": true,
  "externals": ["public/**", "assets/**"],
  "skip": ["**/*.test.ts", "**/*.test.tsx", "**/*.stories.tsx"],
  "storybookConfigDir": ".storybook",
  "exitZeroOnChanges": false,
  "exitOnceUploaded": true,
  "autoAcceptChanges": false
}
```

### Storybook Configuration

```typescript
// .storybook/main.ts
export default {
  stories: ['../client/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-viewport',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: async (config) => {
    // Configure for React Native Web compatibility
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native': 'react-native-web',
    };
    return config;
  },
};
```

## 📊 Test Coverage

### Required Components
All UI components must have visual tests for:

1. **Default appearance**: Standard rendering
2. **State variations**: Loading, disabled, pressed, error
3. **Theme variations**: Light and dark themes
4. **Size variations**: Small, medium, large sizes
5. **Content variations**: Different text lengths, empty states

### Optional Components
Where applicable:

1. **Animation states**: Loading, transitions
2. **Platform differences**: iOS vs Android
3. **Responsive layouts**: Different screen sizes
4. **Internationalization**: RTL languages, different text lengths

## 🔍 Debugging Visual Tests

### Local Development

```bash
# Run Storybook locally
npm run storybook

# Run visual tests with debugging
npm run test:visual -- --debug

# Update snapshots (careful!)
npm run test:visual -- --update-snapshots
```

### Common Issues

#### 1. Animation Timing
```typescript
// Wait for animations to complete
parameters: {
  chromatic: { delay: 500 }
}
```

#### 2. Async Content
```typescript
// Handle loading states
export const WithLoading: Story = {
  render: () => {
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      setTimeout(() => setLoading(false), 1000);
    }, []);
    
    return <PhotoGrid loading={loading} />;
  },
  parameters: {
    chromatic: { delay: 1500 }
  },
};
```

#### 3. Platform Differences
```typescript
// Platform-specific stories
export const IosVariant: Story = {
  ...Default,
  parameters: {
    chromatic: { viewports: [375] } // iPhone dimensions
  }
};

export const AndroidVariant: Story = {
  ...Default,
  parameters: {
    chromatic: { viewports: [360] } // Android dimensions
  }
};
```

## 🚀 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/visual-testing.yml
name: Visual Testing
on: [push, pull_request]

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run expo:static:build
      - run: npm run build-storybook
      - uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          buildScriptName: build-storybook
          exitZeroOnChanges: false
          exitOnceUploaded: true
          onlyChanged: true
```

### Review Process

1. **Automated checks**: Visual tests run on every PR
2. **Manual review**: Team reviews visual changes
3. **Approval required**: Visual changes require team approval
4. **Documentation**: Update stories for new components

## 📱 Cross-Platform Considerations

### React Native Specific

```typescript
// Platform-specific rendering
export const PlatformSpecific: Story = {
  render: () => (
    <View>
      {Platform.OS === 'ios' && <IosButton />}
      {Platform.OS === 'android' && <AndroidButton />}
    </View>
  ),
  parameters: {
    chromatic: {
      // Test both platforms
      viewports: [375, 360],
    },
  },
};
```

### Web Compatibility

```typescript
// Web-specific features
export const WebFeatures: Story = {
  render: () => (
    <div>
      <Button title="Hover me" />
      <Tooltip content="Web tooltip" />
    </div>
  ),
  parameters: {
    chromatic: {
      // Test hover states
      hoverSelector: '.button',
    },
  },
};
```

## 📚 Best Practices

### 1. Story Organization
- Group related stories
- Use descriptive names
- Include edge cases
- Document complex interactions

### 2. Test Stability
- Use deterministic data
- Avoid time-dependent tests
- Handle async operations properly
- Wait for animations

### 3. Performance
- Limit story complexity
- Use efficient mocking
- Optimize screenshot capture
- Cache expensive operations

### 4. Maintenance
- Review failing tests regularly
- Update stories with component changes
- Document visual decisions
- Keep stories up to date

## 🔍 Monitoring & Analytics

### Test Metrics
- **Test execution time**: <30 seconds per component
- **Snapshot size**: <1MB per story
- **Coverage**: 100% of UI components
- **Flakiness**: <1% test failure rate

### Quality Metrics
- **Visual consistency**: 100% platform alignment
- **Regression detection**: All visual changes caught
- **Review time**: <24 hours for visual changes
- **User feedback**: Positive visual experience

## 🔄 Continuous Improvement

### Regular Reviews
- Weekly visual test review
- Monthly component audit
- Quarterly design system review
- Annual accessibility audit

### Tool Updates
- Keep Chromatic updated
- Update Storybook regularly
- Monitor new visual testing tools
- Evaluate platform changes

### Team Training
- Visual testing best practices
- Storybook usage workshops
- Design system alignment
- Cross-platform considerations

## 📚 Resources

### Documentation
- [Chromatic Documentation](https://www.chromatic.com/docs)
- [Storybook for React Native](https://storybook.js.org/docs/react-native)
- [Visual Testing Best Practices](https://storybook.js.org/docs/essentials/visual-testing)

### Tools
- [Chromatic](https://www.chromatic.com/)
- [Storybook](https://storybook.js.org/)
- [Percy](https://percy.io/)
- [Applitools](https://applitools.com/)

### Examples
- [Cloud Gallery Stories](./client/components/*.stories.tsx)
- [Visual Test Patterns](./client/test-utils/visual-testing.tsx)
- [Platform-Specific Tests](./client/test-utils/platform-testing.tsx)

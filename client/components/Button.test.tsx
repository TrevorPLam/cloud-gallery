/**
 * Accessibility tests for Button component
 * 
 * Purpose: Demonstrate accessibility testing patterns
 * Standards: WCAG 2.1 AA compliance
 */

import { render } from '@testing-library/react-native';
import { Button } from './Button';
import { createAccessibilityTest, checkAccessibility } from '../test-utils/accessibility';

describe('Button Accessibility', () => {
  // Standard accessibility test
  createAccessibilityTest(
    'renders accessible button',
    () => render(<Button title="Test Button" onPress={() => {}} />)
  );

  // Test specific accessibility properties
  it('should have accessibility label', () => {
    const { getByRole } = render(<Button title="Submit Form" onPress={() => {}} />);
    
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Submit Form');
  });

  it('should be focusable and have role', () => {
    const { getByRole } = render(<Button title="Test" onPress={() => {}} />);
    
    const button = getByRole('button');
    expect(button.props.accessible).toBe(true);
    expect(button.props.focusable).toBe(true);
  });

  it('should handle disabled state accessibly', () => {
    const { getByRole } = render(<Button title="Disabled" disabled onPress={() => {}} />);
    
    const button = getByRole('button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('should provide accessibility hint for complex actions', () => {
    const { getByRole } = render(
      <Button title="Delete" accessibilityHint="Deletes selected items permanently" onPress={() => {}} />
    );
    
    const button = getByRole('button');
    expect(button.props.accessibilityHint).toBe('Deletes selected items permanently');
  });

  // Custom accessibility test with additional checks
  createAccessibilityTest(
    'button with loading state',
    () => render(<Button title="Loading" loading onPress={() => {}} />),
    (result) => {
      // Additional accessibility checks specific to loading state
      expect(result.passes).toBe(true);
    }
  );
});

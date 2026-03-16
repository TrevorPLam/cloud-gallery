import { render } from '@testing-library/react-native';
import { Button } from './Button';

describe('Button Accessibility', () => {
  // Test basic accessibility properties
  it('should have proper accessibility role', () => {
    const { getByRole } = render(<Button onPress={() => {}}>Submit Form</Button>);
    
    const button = getByRole('button');
    expect(button).toBeTruthy();
    expect(button.props.accessible).toBe(true);
  });

  it('should be focusable and have role', () => {
    const { getByRole } = render(<Button onPress={() => {}}>Test</Button>);
    
    const button = getByRole('button');
    expect(button.props.accessible).toBe(true);
    expect(button.props.focusable).toBe(true);
  });

  it('should handle disabled state accessibly', () => {
    const { getByRole } = render(<Button onPress={() => {}} disabled>Disabled</Button>);
    
    const button = getByRole('button');
    expect(button.props.disabled).toBe(true);
  });

  it('should provide accessibility hint for complex actions', () => {
    const { getByRole } = render(
      <Button onPress={() => {}} accessibilityHint="Deletes selected items permanently">
        Delete
      </Button>
    );
    
    const button = getByRole('button');
    expect(button.props.accessibilityHint).toBe('Deletes selected items permanently');
  });

  it('should have accessible text content', () => {
    const { getByText } = render(<Button onPress={() => {}}>Submit Form</Button>);
    
    const buttonText = getByText('Submit Form');
    expect(buttonText).toBeTruthy();
  });

  it('should support accessibility label', () => {
    const { getByRole } = render(
      <Button onPress={() => {}} accessibilityLabel="Submit button">
        Submit
      </Button>
    );
    
    const button = getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Submit button');
  });
});

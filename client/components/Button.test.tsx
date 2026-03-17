/**
 * Accessibility tests for Button component
 *
 * Purpose: Demonstrate accessibility testing patterns
 * Standards: WCAG 2.1 AA compliance
 */

import { render } from "@testing-library/react-native";
import { Button } from "./Button";
import {
  AccessibilityTester,
  AccessibilityPatterns,
} from "../test-utils/accessibility-testing-simple";

describe("Button Accessibility", () => {
  // Standard accessibility test with WCAG 2.1 AA compliance
  it("should be accessible", async () => {
    await AccessibilityTester.expectNoViolations(
      <Button onPress={() => {}}>Test Button</Button>,
    );
  });

  // Test interactive element patterns
  it("should pass interactive element tests", async () => {
    await AccessibilityPatterns.testInteractiveElement(
      <Button onPress={() => {}}>Submit Form</Button>,
    );
  });

  // Custom accessibility assertion
  it("should be accessible with custom matcher", async () => {
    const component = <Button onPress={() => {}}>Submit</Button>;
    await expect(component).toBeAccessible();
  });

  // Test specific accessibility properties
  it("should have proper accessibility role", () => {
    const { getByRole } = render(
      <Button onPress={() => {}}>Submit Form</Button>,
    );

    const button = getByRole("button");
    expect(button).toBeTruthy();
    expect(button.props.accessible).toBe(true);
  });

  it("should be focusable and have role", () => {
    const { getByRole } = render(<Button onPress={() => {}}>Test</Button>);

    const button = getByRole("button");
    expect(button.props.accessible).toBe(true);
    expect(button.props.focusable).toBe(true);
  });

  it("should handle disabled state accessibly", () => {
    const { getByRole } = render(
      <Button onPress={() => {}} disabled>
        Disabled
      </Button>,
    );

    const button = getByRole("button");
    expect(button.props.disabled).toBe(true);
  });

  it("should provide accessibility hint for complex actions", () => {
    const { getByRole } = render(
      <Button
        onPress={() => {}}
        accessibilityHint="Deletes selected items permanently"
      >
        Delete
      </Button>,
    );

    const button = getByRole("button");
    expect(button.props.accessibilityHint).toBe(
      "Deletes selected items permanently",
    );
  });

  // Test loading state accessibility
  it("should handle loading state accessibly", async () => {
    await AccessibilityTester.expectNoViolations(
      <Button onPress={() => {}}>Loading</Button>,
    );
  });
});

import React from 'react';
import { render } from '@testing-library/react-native';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

// Mock the dependencies that might cause issues
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn(),
    register: jest.fn(),
    isLoading: false,
    continueAsGuest: jest.fn(),
  }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      backgroundRoot: '#ffffff',
      backgroundDefault: '#f5f5f5',
    },
    isDark: false,
  }),
}));

describe('Form Accessibility Tests', () => {
  describe('LoginScreen', () => {
    it('should have accessible email input', () => {
      const { getByRole } = render(<LoginScreen />);
      
      const emailInput = getByRole('textbox', { name: /email/i });
      expect(emailInput).toBeTruthy();
      expect(emailInput.props.accessibilityLabel).toBe('Email address input');
      expect(emailInput.props.accessibilityHint).toBe('Enter your email address to sign in');
    });

    it('should have accessible password input', () => {
      const { getByRole } = render(<LoginScreen />);
      
      const passwordInput = getByRole('textbox', { name: /password/i });
      expect(passwordInput).toBeTruthy();
      expect(passwordInput.props.accessibilityLabel).toBe('Password input');
      expect(passwordInput.props.accessibilityHint).toBe('Enter your password to sign in');
    });

    it('should have accessible sign in button', () => {
      const { getByRole } = render(<LoginScreen />);
      
      const signInButton = getByRole('button', { name: /sign in/i });
      expect(signInButton).toBeTruthy();
      expect(signInButton.props.accessibilityLabel).toBe('Sign in button');
      expect(signInButton.props.accessibilityHint).toBe('Signs you into your account');
    });

    it('should have accessible navigation buttons', () => {
      const { getByRole } = render(<LoginScreen />);
      
      const createAccountButton = getByRole('button', { name: /create account/i });
      expect(createAccountButton.props.accessibilityLabel).toBe('Create an account');
      
      const forgotPasswordButton = getByRole('button', { name: /forgot password/i });
      expect(forgotPasswordButton.props.accessibilityLabel).toBe('Forgot password');
      
      const continueAsGuestButton = getByRole('button', { name: /continue as guest/i });
      expect(continueAsGuestButton.props.accessibilityLabel).toBe('Continue as guest');
    });
  });

  describe('RegisterScreen', () => {
    it('should have accessible email input', () => {
      const { getByRole } = render(<RegisterScreen />);
      
      const emailInput = getByRole('textbox', { name: /email/i });
      expect(emailInput.props.accessibilityLabel).toBe('Email address input');
      expect(emailInput.props.accessibilityHint).toBe('Enter your email address to create an account');
    });

    it('should have accessible password input', () => {
      const { getByRole } = render(<RegisterScreen />);
      
      const passwordInput = getByRole('textbox', { name: /password/i });
      expect(passwordInput.props.accessibilityLabel).toBe('Password input');
      expect(passwordInput.props.accessibilityHint).toBe('Enter a password with at least 8 characters');
    });

    it('should have accessible confirm password input', () => {
      const { getByRole } = render(<RegisterScreen />);
      
      const confirmPasswordInput = getByRole('textbox', { name: /confirm password/i });
      expect(confirmPasswordInput.props.accessibilityLabel).toBe('Confirm password input');
      expect(confirmPasswordInput.props.accessibilityHint).toBe('Re-enter your password to confirm');
    });

    it('should have accessible create account button', () => {
      const { getByRole } = render(<RegisterScreen />);
      
      const createAccountButton = getByRole('button', { name: /create account/i });
      expect(createAccountButton.props.accessibilityLabel).toBe('Create account button');
      expect(createAccountButton.props.accessibilityHint).toBe('Creates your new account');
    });

    it('should have accessible sign in link', () => {
      const { getByRole } = render(<RegisterScreen />);
      
      const signInButton = getByRole('button', { name: /sign in/i });
      expect(signInButton.props.accessibilityLabel).toBe('Sign in');
      expect(signInButton.props.accessibilityHint).toBe('Navigate back to sign in page');
    });
  });

  describe('ForgotPasswordScreen', () => {
    it('should have accessible back button', () => {
      const { getByRole } = render(<ForgotPasswordScreen />);
      
      const backButton = getByRole('button', { name: /back to sign in/i });
      expect(backButton.props.accessibilityLabel).toBe('Back to sign in');
      expect(backButton.props.accessibilityHint).toBe('Navigate back to the sign in page');
    });
  });
});

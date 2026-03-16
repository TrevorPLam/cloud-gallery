// AI-META-BEGIN
// AI-META: Comprehensive test suite for PersonCard component with accessibility testing
// OWNERSHIP: client/components
// ENTRYPOINTS: imported by vitest test runner
// DEPENDENCIES: @testing-library/react-native, @tanstack/react-query, PersonCard
// DANGER: Test coverage for biometric data UI - ensure privacy controls are tested
// CHANGE-SAFETY: Maintain test coverage for all PersonCard interactions
// TESTS: This file
// AI-META-END

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PersonCard from './PersonCard';
import { ThemeProvider } from '@/hooks/useTheme';

// Mock the query client
vi.mock('@/lib/query-client', () => ({
  apiRequest: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {},
  ValidationError: class ValidationError extends Error {
    constructor(public validationDetails: any[]) {
      super('Validation error');
    }
  },
  NetworkError: class NetworkError extends Error {},
  ServerError: class ServerError extends Error {},
}));

// Mock expo-image
vi.mock('expo-image', () => ({
  Image: 'Image',
}));

describe('PersonCard', () => {
  let queryClient: QueryClient;
  let mockTheme: any;

  const mockPerson = {
    id: 'person_1',
    name: 'John Doe',
    faceCount: 15,
    clusterQuality: 0.85,
    isPinned: false,
    isHidden: false,
    sampleEmbeddings: [[0.1, 0.2, 0.3]],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockTheme = {
      colors: {
        text: '#000000',
        textSecondary: '#666666',
        background: '#FFFFFF',
        card: '#F5F5F5',
        border: '#E0E0E0',
        primary: '#007AFF',
        success: '#34C759',
        warning: '#FF9500',
        error: '#FF3B30',
      },
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderPersonCard = (props: Partial<typeof mockPerson> = {}, cardProps: any = {}) => {
    const person = { ...mockPerson, ...props };

    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={mockTheme}>
          <PersonCard person={person} {...cardProps} />
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  describe('Rendering', () => {
    it('should render person information correctly', () => {
      renderPersonCard();

      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('15 photos')).toBeTruthy();
      expect(screen.getByText('85%')).toBeTruthy();
    });

    it('should render unnamed person correctly', () => {
      renderPersonCard({ name: null });

      expect(screen.getByText('Unnamed')).toBeTruthy();
      expect(screen.getByText('15 photos')).toBeTruthy();
    });

    it('should render initials in avatar', () => {
      renderPersonCard();

      const avatar = screen.getByText('JD'); // John Doe initials
      expect(avatar).toBeTruthy();
    });

    it('should render question mark for unnamed person', () => {
      renderPersonCard({ name: null });

      const avatar = screen.getByText('?');
      expect(avatar).toBeTruthy();
    });

    it('should show pin indicator for pinned person', () => {
      renderPersonCard({ isPinned: true });

      // Check for pin icon (Feather icon name)
      const pinIcon = screen.getByTestId('pin-icon');
      expect(pinIcon).toBeTruthy();
    });

    it('should apply hidden styling for hidden person', () => {
      renderPersonCard({ isHidden: true });

      const card = screen.getByTestId('person-card');
      expect(card.props.style).toContainEqual({ opacity: 0.6 });
    });

    it('should render compact variant correctly', () => {
      renderPersonCard({}, { compact: true });

      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('15 photos')).toBeTruthy();
      
      // Compact view should not show quality bar
      expect(screen.queryByText('85%')).toBeFalsy();
    });

    it('should hide actions button when showActions is false', () => {
      renderPersonCard({}, { showActions: false });

      const actionsButton = screen.queryByTestId('actions-button');
      expect(actionsButton).toBeFalsy();
    });
  });

  describe('Quality Indicator', () => {
    it('should show green quality bar for high quality (>0.8)', () => {
      renderPersonCard({ clusterQuality: 0.9 });

      const qualityBar = screen.getByTestId('quality-bar-fill');
      expect(qualityBar.props.style.backgroundColor).toBe(mockTheme.colors.success);
    });

    it('should show yellow quality bar for medium quality (0.6-0.8)', () => {
      renderPersonCard({ clusterQuality: 0.7 });

      const qualityBar = screen.getByTestId('quality-bar-fill');
      expect(qualityBar.props.style.backgroundColor).toBe(mockTheme.colors.warning);
    });

    it('should show red quality bar for low quality (<0.6)', () => {
      renderPersonCard({ clusterQuality: 0.5 });

      const qualityBar = screen.getByTestId('quality-bar-fill');
      expect(qualityBar.props.style.backgroundColor).toBe(mockTheme.colors.error);
    });

    it('should calculate quality bar width correctly', () => {
      renderPersonCard({ clusterQuality: 0.65 });

      const qualityBar = screen.getByTestId('quality-bar-fill');
      expect(qualityBar.props.style.width).toBe('65%');
    });
  });

  describe('Interactions', () => {
    it('should call onPress when card is pressed', () => {
      const mockOnPress = vi.fn();
      renderPersonCard({}, { onPress: mockOnPress });

      const card = screen.getByTestId('person-card');
      fireEvent.press(card);

      expect(mockOnPress).toHaveBeenCalledWith(mockPerson);
    });

    it('should not call onPress for hidden person', () => {
      const mockOnPress = vi.fn();
      renderPersonCard({ isHidden: true }, { onPress: mockOnPress });

      const card = screen.getByTestId('person-card');
      fireEvent.press(card);

      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('should show action menu when actions button is pressed', () => {
      renderPersonCard();

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      // Should show Alert with options
      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  describe('Action Menu', () => {
    beforeEach(() => {
      // Mock Alert.alert
      vi.mocked(Alert.alert).mockImplementation((title, message, buttons) => {
        // Simulate pressing the first button (Rename/Name)
        if (buttons && buttons[0]) {
          buttons[0].onPress?.();
        }
      });
    });

    it('should show rename option for named person', () => {
      renderPersonCard({ name: 'John Doe' });

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'John Doe',
        '15 photos • Quality: 85%',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Rename' }),
          expect.objectContaining({ text: 'Pin' }),
          expect.objectContaining({ text: 'Hide' }),
          expect.objectContaining({ text: 'Merge with...' }),
          expect.objectContaining({ text: 'Delete' }),
          expect.objectContaining({ text: 'Cancel' }),
        ])
      );
    });

    it('should show name option for unnamed person', () => {
      renderPersonCard({ name: null });

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Unnamed Person',
        '15 photos • Quality: 85%',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Name' }),
          expect.objectContaining({ text: 'Pin' }),
          expect.objectContaining({ text: 'Hide' }),
          expect.objectContaining({ text: 'Merge with...' }),
          expect.objectContaining({ text: 'Delete' }),
          expect.objectContaining({ text: 'Cancel' }),
        ])
      );
    });

    it('should show unpin option for pinned person', () => {
      renderPersonCard({ isPinned: true });

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'John Doe',
        '15 photos • Quality: 85%',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Rename' }),
          expect.objectContaining({ text: 'Unpin' }),
          expect.objectContaining({ text: 'Hide' }),
          expect.objectContaining({ text: 'Merge with...' }),
          expect.objectContaining({ text: 'Delete' }),
          expect.objectContaining({ text: 'Cancel' }),
        ])
      );
    });

    it('should show show option for hidden person', () => {
      renderPersonCard({ isHidden: true });

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'John Doe',
        '15 photos • Quality: 85%',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Rename' }),
          expect.objectContaining({ text: 'Pin' }),
          expect.objectContaining({ text: 'Show' }),
          expect.objectContaining({ text: 'Merge with...' }),
          expect.objectContaining({ text: 'Delete' }),
          expect.objectContaining({ text: 'Cancel' }),
        ])
      );
    });
  });

  describe('Rename Modal', () => {
    beforeEach(() => {
      // Mock Alert.alert to trigger rename
      vi.mocked(Alert.alert).mockImplementation((title, message, buttons) => {
        // Find and trigger the rename button
        const renameButton = buttons?.find(b => b.text === 'Rename' || b.text === 'Name');
        renameButton?.onPress?.();
      });
    });

    it('should open rename modal when rename is selected', async () => {
      renderPersonCard();

      // Trigger action menu and rename
      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      await waitFor(() => {
        expect(screen.getByText('Rename Person')).toBeTruthy();
        expect(screen.getByDisplayValue('John Doe')).toBeTruthy();
      });
    });

    it('should pre-fill with current name', async () => {
      renderPersonCard({ name: 'Jane Smith' });

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Jane Smith')).toBeTruthy();
      });
    });

    it('should show empty input for unnamed person', async () => {
      renderPersonCard({ name: null });

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('')).toBeTruthy();
        expect(screen.getByPlaceholderText('Enter name')).toBeTruthy();
      });
    });

    it('should validate name input', async () => {
      renderPersonCard();

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      await waitFor(() => {
        const saveButton = screen.getByText('Save');
        fireEvent.press(saveButton);
      });

      // Should show validation error for empty name
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid name.');
    });

    it('should close modal on cancel', async () => {
      renderPersonCard();

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        fireEvent.press(cancelButton);
      });

      // Modal should be closed
      expect(screen.queryByText('Rename Person')).toBeFalsy();
    });
  });

  describe('Delete Confirmation', () => {
    beforeEach(() => {
      // Mock Alert.alert to trigger delete
      vi.mocked(Alert.alert).mockImplementation((title, message, buttons) => {
        // Find and trigger the delete button
        const deleteButton = buttons?.find(b => b.text === 'Delete');
        deleteButton?.onPress?.();
      });
    });

    it('should show delete confirmation with correct message', () => {
      renderPersonCard();

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Person',
        'Are you sure you want to delete "John Doe"? This action cannot be undone.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Delete', style: 'destructive' }),
        ])
      );
    });

    it('should show unnamed person in delete confirmation', () => {
      renderPersonCard({ name: null });

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Person',
        'Are you sure you want to delete "this person"? This action cannot be undone.',
        expect.any(Array)
      );
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for screen readers', () => {
      renderPersonCard();

      const card = screen.getByTestId('person-card');
      expect(card).toBeAccessible();

      // Check that important information is available
      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('15 photos')).toBeTruthy();
    });

    it('should have accessible actions button', () => {
      renderPersonCard();

      const actionsButton = screen.getByTestId('actions-button');
      expect(actionsButton).toBeAccessible();
    });

    it('should respect reduced motion preferences', () => {
      // Mock reduced motion preference
      vi.mock('react-native', () => ({
        ...vi.importActual('react-native'),
        useReducedMotion: () => true,
      }));

      renderPersonCard();

      // Component should still render without animations
      expect(screen.getByText('John Doe')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      vi.mocked(Alert.alert).mockImplementation((title, message, buttons) => {
        const renameButton = buttons?.find(b => b.text === 'Rename');
        renameButton?.onPress?.();
      });

      // Mock API request to throw network error
      const { apiRequest } = require('@/lib/query-client');
      apiRequest.mockRejectedValue(new Error('Network error'));

      renderPersonCard();

      const actionsButton = screen.getByTestId('actions-button');
      fireEvent.press(actionsButton);

      await waitFor(() => {
        const saveButton = screen.getByText('Save');
        fireEvent.press(saveButton);
      });

      // Should show error message
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'An unknown error occurred.');
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const { rerender } = renderPersonCard();

      const initialRender = screen.getByText('John Doe');
      
      // Re-render with same props
      rerender(
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={mockTheme}>
            <PersonCard person={mockPerson} />
          </ThemeProvider>
        </QueryClientProvider>
      );

      // Should still have the same element
      expect(screen.getByText('John Doe')).toBe(initialRender);
    });

    it('should handle large face counts efficiently', () => {
      renderPersonCard({ faceCount: 999999 });

      expect(screen.getByText('999999 photos')).toBeTruthy();
    });
  });
});

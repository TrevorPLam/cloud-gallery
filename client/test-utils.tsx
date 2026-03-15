/**
 * Standardized test utilities for React Native components
 */

import { QueryClient } from "@tanstack/react-query";
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { render } from "@testing-library/react-native";

/**
 * Creates a test query client with consistent v5 configuration
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // v5: was cacheTime in v4
        staleTime: 0,
      },
      mutations: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

/**
 * Standard test wrapper with all required providers
 */
interface TestWrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

export function TestWrapper({ children, queryClient = createTestQueryClient() }: TestWrapperProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          {children}
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/**
 * Standard render function with providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { queryClient = createTestQueryClient() }: { queryClient?: QueryClient } = {}
) {
  return render(ui, { wrapper: ({ children }) => <TestWrapper queryClient={queryClient}>{children}</TestWrapper> });
}

/**
 * Navigation mock utilities
 */
export const createNavigationMocks = () => {
  const mockNavigate = vi.fn();
  const mockGoBack = vi.fn();
  const mockSetOptions = vi.fn();
  const mockRoute = { params: {} };

  return {
    mockNavigate,
    mockGoBack,
    mockSetOptions,
    mockRoute,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      setOptions: mockSetOptions,
    }),
    useRoute: () => mockRoute,
  };
};

/**
 * Reset all mocks between tests
 */
export function resetAllMocks() {
  vi.clearAllMocks();
}

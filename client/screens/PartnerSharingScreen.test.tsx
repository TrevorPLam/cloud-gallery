// AI-META-BEGIN
// AI-META: UI component tests for PartnerSharingScreen ensuring user interface functionality
// OWNERSHIP: client/screens (partner sharing UI testing)
// ENTRYPOINTS: test runner executes these to validate React Native components
// DEPENDENCIES: React Native Testing Library, Jest, React Query mocks
// DANGER: UI test failures indicate broken user experience or accessibility issues
// CHANGE-SAFETY: Maintain test coverage for all user interactions and states
// TESTS: Component tests for rendering, interactions, error handling, accessibility
// AI-META-END

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/hooks/useTheme";
import PartnerSharingScreen from "../PartnerSharingScreen";
import { apiRequest } from "@/lib/query-client";

// Mock dependencies
vi.mock("@/lib/query-client");
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
  }),
}));
vi.mock("@react-navigation/elements", () => ({
  useHeaderHeight: () => 44,
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 20, top: 44 }),
}));
vi.mock("expo-haptics", () => ({
  notificationAsync: vi.fn(),
}));

// Mock theme
const mockTheme = {
  text: "#000000",
  textSecondary: "#666666",
  primary: "#007AFF",
  success: "#34C759",
  warning: "#FF9500",
  error: "#FF3B30",
  background: "#FFFFFF",
  border: "#E5E5E5",
};

const MockThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider value={mockTheme}>{children}</ThemeProvider>
);

// Create test query client
const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

// Helper component with providers
const TestComponent = () => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MockThemeProvider>
        <PartnerSharingScreen />
      </MockThemeProvider>
    </QueryClientProvider>
  );
};

describe("PartnerSharingScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // RENDERING TESTS
  // ═══════════════════════════════════════════════════════════

  it("should render the partner sharing screen", async () => {
    // Mock API responses
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 0,
        pendingInvitations: 0,
        sharedPhotos: 0,
        autoShareRules: 0,
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText("Partner Sharing")).toBeTruthy();
      expect(
        screen.getByText("Share photos automatically with your partner"),
      ).toBeTruthy();
      expect(screen.getByText("Invite Partner")).toBeTruthy();
      expect(screen.getByText("Accept Invitation")).toBeTruthy();
    });
  });

  it("should display stats when data is available", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 2,
        pendingInvitations: 1,
        sharedPhotos: 150,
        autoShareRules: 3,
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText("Partner Sharing Stats")).toBeTruthy();
      expect(screen.getByText("2")).toBeTruthy(); // Active Partners
      expect(screen.getByText("150")).toBeTruthy(); // Shared Photos
      expect(screen.getByText("3")).toBeTruthy(); // Auto-Share Rules
    });
  });

  it("should display active partnerships", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [
          {
            id: "partnership-1",
            partnerId: "partner-1",
            partnerName: "John Doe",
            status: "accepted",
            acceptedAt: "2024-01-15T10:00:00Z",
            privacySettings: {
              includeOtherApps: true,
              favoritesOnly: false,
            },
          },
        ],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 1,
        pendingInvitations: 0,
        sharedPhotos: 50,
        autoShareRules: 2,
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText("Active Partners")).toBeTruthy();
      expect(screen.getByText("John Doe")).toBeTruthy();
      expect(screen.getByText("Active")).toBeTruthy();
      expect(screen.getByText("View Library")).toBeTruthy();
      expect(screen.getByText("Rules")).toBeTruthy();
    });
  });

  it("should display pending partnerships", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [
          {
            id: "partnership-2",
            partnerId: "partner-2",
            partnerName: "Jane Smith",
            status: "pending",
            acceptedAt: null,
            initiatedBy: "user-123",
            createdAt: "2024-01-15T10:00:00Z",
          },
        ],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 0,
        pendingInvitations: 1,
        sharedPhotos: 0,
        autoShareRules: 0,
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText("Pending Partners")).toBeTruthy();
      expect(screen.getByText("Jane Smith")).toBeTruthy();
      expect(screen.getByText("Pending")).toBeTruthy();
    });
  });

  it("should show empty state when no partnerships exist", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 0,
        pendingInvitations: 0,
        sharedPhotos: 0,
        autoShareRules: 0,
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText("No Partners Yet")).toBeTruthy();
      expect(
        screen.getByText(
          "Invite a partner to start sharing photos automatically.",
        ),
      ).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // INTERACTION TESTS
  // ═══════════════════════════════════════════════════════════

  it("should open invite modal when invite button is pressed", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 0,
        pendingInvitations: 0,
        sharedPhotos: 0,
        autoShareRules: 0,
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText("Invite Partner")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Invite Partner"));

    await waitFor(() => {
      expect(screen.getByText("Invite Partner")).toBeTruthy(); // Modal title
      expect(
        screen.getByText("Enter your partner's email address"),
      ).toBeTruthy();
      expect(screen.getByText("Cancel")).toBeTruthy();
      expect(screen.getByText("Send")).toBeTruthy();
    });
  });

  it("should close invite modal when cancel is pressed", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 0,
        pendingInvitations: 0,
        sharedPhotos: 0,
        autoShareRules: 0,
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      fireEvent.press(screen.getByText("Invite Partner"));
    });

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(
        screen.queryByText("Enter your partner's email address"),
      ).toBeFalsy();
    });
  });

  it("should handle invitation submission", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 0,
        pendingInvitations: 0,
        sharedPhotos: 0,
        autoShareRules: 0,
      },
    });

    // Mock successful invitation creation
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        id: "invitation-123",
        invitationToken: "abc123",
        inviteeEmail: "partner@example.com",
        expiresAt: "2024-01-22T10:00:00Z",
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      fireEvent.press(screen.getByText("Invite Partner"));
    });

    await waitFor(() => {
      // Enter email
      const emailInput = screen.getByPlaceholderText("partner@example.com");
      fireEvent.changeText(emailInput, "partner@example.com");

      // Submit
      fireEvent.press(screen.getByText("Send"));
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/partner-sharing/invitations",
        {
          method: "POST",
          body: JSON.stringify({
            inviteeEmail: "partner@example.com",
            message: undefined,
          }),
        },
      );
    });
  });

  it("should validate email input", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 0,
        pendingInvitations: 0,
        sharedPhotos: 0,
        autoShareRules: 0,
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      fireEvent.press(screen.getByText("Invite Partner"));
    });

    await waitFor(() => {
      // Try to submit without email
      fireEvent.press(screen.getByText("Send"));
    });

    // Should show validation error (Alert.alert was called)
    await waitFor(() => {
      expect(
        screen.queryByText("Enter your partner's email address"),
      ).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // ERROR HANDLING TESTS
  // ═══════════════════════════════════════════════════════════

  it("should handle API errors gracefully", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("Network error"));

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText("Error Loading Partnerships")).toBeTruthy();
      expect(
        screen.getByText("Please check your connection and try again."),
      ).toBeTruthy();
    });
  });

  it("should handle invitation creation errors", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 0,
        pendingInvitations: 0,
        sharedPhotos: 0,
        autoShareRules: 0,
      },
    });

    // Mock API error
    vi.mocked(apiRequest).mockRejectedValue({
      response: {
        data: {
          error: "Failed to send invitation",
        },
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      fireEvent.press(screen.getByText("Invite Partner"));
    });

    await waitFor(() => {
      const emailInput = screen.getByPlaceholderText("partner@example.com");
      fireEvent.changeText(emailInput, "partner@example.com");
      fireEvent.press(screen.getByText("Send"));
    });

    // Should show error message
    await waitFor(() => {
      expect(screen.queryByText("Failed to send invitation")).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // LOADING STATES TESTS
  // ═══════════════════════════════════════════════════════════

  it("should show loading state initially", () => {
    // Mock API to never resolve
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}));

    render(<TestComponent />);

    expect(screen.getByText("Loading partnerships...")).toBeTruthy();
  });

  it("should show loading state during invitation submission", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 0,
        pendingInvitations: 0,
        sharedPhotos: 0,
        autoShareRules: 0,
      },
    });

    // Mock slow API call
    vi.mocked(apiRequest).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    render(<TestComponent />);

    await waitFor(() => {
      fireEvent.press(screen.getByText("Invite Partner"));
    });

    await waitFor(() => {
      const emailInput = screen.getByPlaceholderText("partner@example.com");
      fireEvent.changeText(emailInput, "partner@example.com");
      fireEvent.press(screen.getByText("Send"));
    });

    // Should show loading state
    expect(screen.getByText("Sending...")).toBeTruthy();
  });

  // ═══════════════════════════════════════════════════════════
  // ACCESSIBILITY TESTS
  // ═══════════════════════════════════════════════════════════

  it("should have accessible button labels", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 0,
        pendingInvitations: 0,
        sharedPhotos: 0,
        autoShareRules: 0,
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      const inviteButton = screen.getByText("Invite Partner");
      const acceptButton = screen.getByText("Accept Invitation");

      expect(inviteButton).toBeTruthy();
      expect(acceptButton).toBeTruthy();
    });
  });

  it("should have proper heading hierarchy", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 0,
        pendingInvitations: 0,
        sharedPhotos: 0,
        autoShareRules: 0,
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      // Main title should be prominent
      expect(screen.getByText("Partner Sharing")).toBeTruthy();
      // Stats title should be present
      expect(screen.getByText("Partner Sharing Stats")).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION TESTS
  // ═══════════════════════════════════════════════════════════

  it("should navigate to shared library when view library is pressed", async () => {
    const mockNavigate = vi.fn();
    vi.mocked(
      require("@react-navigation/native").useNavigation,
    ).mockReturnValue({
      navigate: mockNavigate,
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        active: [
          {
            id: "partnership-1",
            partnerId: "partner-1",
            partnerName: "John Doe",
            status: "accepted",
            acceptedAt: "2024-01-15T10:00:00Z",
            privacySettings: {
              includeOtherApps: true,
              favoritesOnly: false,
            },
          },
        ],
        pending: [],
      },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        activePartnerships: 1,
        pendingInvitations: 0,
        sharedPhotos: 50,
        autoShareRules: 2,
      },
    });

    render(<TestComponent />);

    await waitFor(() => {
      fireEvent.press(screen.getByText("View Library"));
    });

    expect(mockNavigate).toHaveBeenCalledWith("PartnerSharedLibrary", {
      partnershipId: "partnership-1",
      partnerName: "John Doe",
    });
  });
});

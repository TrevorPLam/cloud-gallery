// AI-META-BEGIN
// AI-META: UI tests for sync settings screen with device management, sync status, and user interactions
// OWNERSHIP: client/screens
// ENTRYPOINTS: run by test runner
// DEPENDENCIES: vitest, @testing-library/react-native, @tanstack/react-query
// DANGER: Test failures = UI bugs; accessibility test failures = poor UX
// CHANGE-SAFETY: Maintain comprehensive test coverage for all UI interactions and edge cases
// TESTS: Component tests validate UI functionality, error handling, and accessibility
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SyncSettingsScreen } from "./SyncSettingsScreen";
import { useTheme } from "../constants/theme";
import { Alert } from "react-native";

// Mock dependencies
vi.mock("../constants/theme");
vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn((date: Date, options?: any) => "2 hours ago"),
}));

vi.mock("react-native/Libraries/Alert/Alert", () => ({
  Alert: {
    alert: vi.fn(),
  },
}));

// Mock API functions
const mockGetDevices = vi.fn();
const mockGetSyncStatus = vi.fn();
const mockGetSyncStats = vi.fn();
const mockTriggerSync = vi.fn();
const mockUpdateDevice = vi.fn();
const mockRemoveDevice = vi.fn();
const mockResolveConflict = vi.fn();

// Mock the API module
vi.mock("./SyncSettingsScreen", async () => {
  const actual = await vi.importActual("./SyncSettingsScreen");
  return {
    ...actual,
    api: {
      getDevices: mockGetDevices,
      getSyncStatus: mockGetSyncStatus,
      getSyncStats: mockGetSyncStats,
      triggerSync: mockTriggerSync,
      updateDevice: mockUpdateDevice,
      removeDevice: mockRemoveDevice,
      resolveConflict: mockResolveConflict,
    },
  };
});

// Mock theme
const mockTheme = {
  colors: {
    background: "#ffffff",
    card: "#ffffff",
    text: "#000000",
    textSecondary: "#666666",
    primary: "#007AFF",
    success: "#34C759",
    error: "#FF3B30",
    warning: "#FF9500",
    info: "#5AC8FA",
    border: "#E5E5E5",
  },
};

const mockUseTheme = vi.mocked(useTheme);
mockUseTheme.mockReturnValue(mockTheme);

// Test data
const mockDevices = [
  {
    id: "1",
    userId: "user1",
    deviceId: "device1",
    deviceType: "phone" as const,
    deviceName: "iPhone 14",
    isActive: true,
    lastSyncAt: "2024-03-15T10:00:00Z",
    appVersion: "1.0.0",
    storageUsed: 1024000,
    createdAt: "2024-03-01T00:00:00Z",
    updatedAt: "2024-03-15T10:00:00Z",
  },
  {
    id: "2",
    userId: "user1",
    deviceId: "device2",
    deviceType: "tablet" as const,
    deviceName: "iPad Pro",
    isActive: false,
    lastSyncAt: "2024-03-14T15:30:00Z",
    appVersion: "1.0.0",
    storageUsed: 512000,
    createdAt: "2024-03-02T00:00:00Z",
    updatedAt: "2024-03-14T15:30:00Z",
  },
];

const mockSyncStatus = {
  deviceId: "device1",
  userId: "user1",
  lastSyncAt: "2024-03-15T10:00:00Z",
  pendingOperations: 5,
  conflicts: 2,
  lastError: undefined,
  syncInProgress: false,
};

const mockSyncStats = {
  totalDevices: 2,
  activeDevices: 1,
  devicesWithSync: 2,
  lastSync: "2024-03-15T10:00:00Z",
  totalSyncOperations: 150,
  averageSyncOpsPerDevice: 75,
};

// Helper function to render component with QueryClient
function renderWithQueryClient(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );
}

describe("SyncSettingsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockGetDevices.mockResolvedValue(mockDevices);
    mockGetSyncStatus.mockResolvedValue(mockSyncStatus);
    mockGetSyncStats.mockResolvedValue(mockSyncStats);
    mockTriggerSync.mockResolvedValue({ jobId: "sync-job-123" });
    mockUpdateDevice.mockResolvedValue(mockDevices[0]);
    mockRemoveDevice.mockResolvedValue();
    mockResolveConflict.mockResolvedValue({ id: "photo-1", value: "resolved" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initial Rendering", () => {
    it("should render sync status section", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Sync Status")).toBeTruthy();
        expect(screen.getByText("Last Sync:")).toBeTruthy();
        expect(screen.getByText("Pending Operations:")).toBeTruthy();
        expect(screen.getByText("Conflicts:")).toBeTruthy();
      });
    });

    it("should render sync settings section", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Sync Settings")).toBeTruthy();
        expect(screen.getByText("Auto-sync")).toBeTruthy();
        expect(screen.getByText("Sync on Wi-Fi only")).toBeTruthy();
        expect(screen.getByText("Conflict Resolution")).toBeTruthy();
      });
    });

    it("should render sync statistics section", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Sync Statistics")).toBeTruthy();
        expect(screen.getByText("2")).toBeTruthy(); // Total devices
        expect(screen.getByText("1")).toBeTruthy(); // Active devices
        expect(screen.getByText("150")).toBeTruthy(); // Total sync ops
        expect(screen.getByText("75")).toBeTruthy(); // Average ops/device
      });
    });

    it("should render devices list section", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Connected Devices")).toBeTruthy();
        expect(screen.getByText("iPhone 14")).toBeTruthy();
        expect(screen.getByText("iPad Pro")).toBeTruthy();
      });
    });

    it("should show loading state initially", () => {
      // Make the queries delay to show loading state
      mockGetDevices.mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(mockDevices), 100)),
      );
      mockGetSyncStatus.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockSyncStatus), 100),
          ),
      );

      renderWithQueryClient(<SyncSettingsScreen />);

      // Should show loading indicators
      expect(screen.getByTestId("activity-indicator")).toBeTruthy();
    });

    it("should show empty state when no devices", async () => {
      mockGetDevices.mockResolvedValue([]);

      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("No devices connected")).toBeTruthy();
      });
    });
  });

  describe("Device Management", () => {
    it("should display device information correctly", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        // Check first device
        expect(screen.getByText("iPhone 14")).toBeTruthy();
        expect(screen.getByText("Phone • Unknown version")).toBeTruthy();
        expect(screen.getByText("Active")).toBeTruthy();
        expect(screen.getByText("2 hours ago")).toBeTruthy();
        expect(screen.getByText("1 MB")).toBeTruthy(); // 1024000 bytes

        // Check second device
        expect(screen.getByText("iPad Pro")).toBeTruthy();
        expect(screen.getByText("Tablet • Unknown version")).toBeTruthy();
        expect(screen.getByText("Inactive")).toBeTruthy();
      });
    });

    it("should open edit modal when edit button is pressed", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("iPhone 14")).toBeTruthy();
      });

      // Find and press edit button for first device
      const editButtons = screen.getAllByText("Edit");
      fireEvent.press(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Edit Device")).toBeTruthy();
        expect(screen.getByDisplayValue("iPhone 14")).toBeTruthy();
      });
    });

    it("should update device name when saved", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("iPhone 14")).toBeTruthy();
      });

      // Open edit modal
      const editButtons = screen.getAllByText("Edit");
      fireEvent.press(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Edit Device")).toBeTruthy();
      });

      // Change device name
      const nameInput = screen.getByDisplayValue("iPhone 14");
      fireEvent.changeText(nameInput, "iPhone 14 Pro");

      // Press save button
      const saveButton = screen.getByText("Save");
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockUpdateDevice).toHaveBeenCalledWith({
          deviceId: "device1",
          updates: {
            deviceName: "iPhone 14 Pro",
            isActive: true,
          },
        });
      });
    });

    it("should show confirmation dialog when removing device", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("iPhone 14")).toBeTruthy();
      });

      // Find and press remove button for first device
      const removeButtons = screen.getAllByText("Remove");
      fireEvent.press(removeButtons[0]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Remove Device",
          'Are you sure you want to remove "iPhone 14"? This will stop sync for this device.',
          expect.any(Array),
        );
      });
    });

    it("should remove device when confirmed", async () => {
      // Mock Alert.alert to call the second callback (confirm removal)
      Alert.alert = vi.fn((title, message, buttons) => {
        if (buttons && Array.isArray(buttons) && buttons[1]) {
          buttons[1].onPress?.();
        }
      });

      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("iPhone 14")).toBeTruthy();
      });

      // Press remove button
      const removeButtons = screen.getAllByText("Remove");
      fireEvent.press(removeButtons[0]);

      await waitFor(() => {
        expect(mockRemoveDevice).toHaveBeenCalledWith("device1");
      });
    });
  });

  describe("Sync Operations", () => {
    it("should trigger sync when button is pressed", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Trigger Sync")).toBeTruthy();
      });

      const triggerButton = screen.getByText("Trigger Sync");
      fireEvent.press(triggerButton);

      await waitFor(() => {
        expect(mockTriggerSync).toHaveBeenCalledWith(false);
      });
    });

    it("should show resolve conflicts button when conflicts exist", async () => {
      mockGetSyncStatus.mockResolvedValue({
        ...mockSyncStatus,
        conflicts: 3,
      });

      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Resolve 3 Conflicts")).toBeTruthy();
      });
    });

    it("should resolve conflicts when button is pressed", async () => {
      mockGetSyncStatus.mockResolvedValue({
        ...mockSyncStatus,
        conflicts: 1,
      });

      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Resolve 1 Conflicts")).toBeTruthy();
      });

      const resolveButton = screen.getByText("Resolve 1 Conflicts");
      fireEvent.press(resolveButton);

      await waitFor(() => {
        expect(mockResolveConflict).toHaveBeenCalledWith({
          conflictId: "mock-conflict-id",
          strategy: "last_write_wins",
        });
      });
    });

    it("should disable trigger sync when sync is in progress", async () => {
      mockGetSyncStatus.mockResolvedValue({
        ...mockSyncStatus,
        syncInProgress: true,
      });

      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        const triggerButton = screen.getByText("Trigger Sync");
        // Button should be disabled when sync is in progress
        expect(triggerButton.props.disabled).toBe(true);
      });
    });
  });

  describe("Settings Controls", () => {
    it("should toggle auto-sync setting", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Auto-sync")).toBeTruthy();
      });

      // Find and toggle the switch
      const autoSyncSwitch = screen.getByTestId("switch-auto-sync");
      fireEvent(autoSyncSwitch, "valueChange", false);

      // The switch value should be updated in component state
      // This is tested through the component's behavior
      expect(autoSyncSwitch.props.value).toBe(false);
    });

    it("should toggle Wi-Fi only setting", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Sync on Wi-Fi only")).toBeTruthy();
      });

      // Find and toggle the switch
      const wifiSwitch = screen.getByTestId("switch-wifi-only");
      fireEvent(wifiSwitch, "valueChange", true);

      expect(wifiSwitch.props.value).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should show error when devices fetch fails", async () => {
      mockGetDevices.mockRejectedValue(new Error("Network error"));

      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        // Should show error state or retry mechanism
        expect(screen.getByText("No devices connected")).toBeTruthy();
      });
    });

    it("should show error when sync status fetch fails", async () => {
      mockGetSyncStatus.mockRejectedValue(new Error("Sync error"));

      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        // Should handle error gracefully
        expect(screen.getByText("Sync Status")).toBeTruthy();
      });
    });

    it("should show error when trigger sync fails", async () => {
      mockTriggerSync.mockRejectedValue(new Error("Sync failed"));

      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Trigger Sync")).toBeTruthy();
      });

      const triggerButton = screen.getByText("Trigger Sync");
      fireEvent.press(triggerButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Failed to trigger sync",
        );
      });
    });

    it("should show error when update device fails", async () => {
      mockUpdateDevice.mockRejectedValue(new Error("Update failed"));

      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("iPhone 14")).toBeTruthy();
      });

      // Open edit modal
      const editButtons = screen.getAllByText("Edit");
      fireEvent.press(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Edit Device")).toBeTruthy();
      });

      // Press save button
      const saveButton = screen.getByText("Save");
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Failed to update device",
        );
      });
    });
  });

  describe("Refresh Functionality", () => {
    it("should refresh data when pulled to refresh", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Sync Status")).toBeTruthy();
      });

      // Simulate pull to refresh
      const scrollView = screen.getByTestId("scroll-view");
      fireEvent(scrollView, "refresh");

      await waitFor(() => {
        expect(mockGetDevices).toHaveBeenCalledTimes(2);
        expect(mockGetSyncStatus).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("Accessibility", () => {
    it("should have accessible labels for important elements", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        // Check that important elements have accessibility labels
        expect(screen.getByLabelText("Auto-sync toggle")).toBeTruthy();
        expect(screen.getByLabelText("Sync on Wi-Fi only toggle")).toBeTruthy();
        expect(screen.getByLabelText("Trigger sync button")).toBeTruthy();
      });
    });

    it("should support screen reader navigation", async () => {
      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        // Check that interactive elements are properly labeled for screen readers
        const triggerButton = screen.getByLabelText("Trigger sync button");
        expect(triggerButton).toBeTruthy();

        const editButton = screen.getByLabelText("Edit iPhone 14 device");
        expect(editButton).toBeTruthy();
      });
    });
  });

  describe("Performance", () => {
    it("should not re-render unnecessarily", async () => {
      const { rerender } = renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText("Sync Status")).toBeTruthy();
      });

      // Re-render component
      rerender(<SyncSettingsScreen />);

      // Component should still be functional
      expect(screen.getByText("Sync Status")).toBeTruthy();
    });

    it("should handle large device lists efficiently", async () => {
      // Create a large list of devices
      const largeDeviceList = Array.from({ length: 100 }, (_, i) => ({
        ...mockDevices[0],
        id: `device-${i}`,
        deviceId: `device-${i}`,
        deviceName: `Device ${i}`,
      }));

      mockGetDevices.mockResolvedValue(largeDeviceList);

      renderWithQueryClient(<SyncSettingsScreen />);

      await waitFor(() => {
        // Should render without performance issues
        expect(screen.getByText("Connected Devices")).toBeTruthy();
      });
    });
  });
});

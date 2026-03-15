// BackupScreen UI tests for Cloud Gallery

import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Alert } from "react-native";
import { BackupScreen } from "./BackupScreen";
import { ThemeProvider, defaultTheme } from "../constants/theme";
import { apiRequest } from "@/lib/query-client";
import { createTestQueryClient } from "../test-utils";

// Mock the API client instead of the component itself
vi.mock("@/lib/query-client", () => ({
  apiRequest: vi.fn(),
}));

// Mock Alert
vi.mock("react-native", () => {
  const ReactNative = vi.importActual("react-native");
  return {
    ...ReactNative as any,
    Alert: {
      alert: vi.fn(),
    },
  };
});

// Mock date-fns
vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn((date, options) => "2 hours ago"),
}));

// Mock expo-vector-icons
vi.mock("@expo/vector-icons", () => ({
  Ionicons: {
    glyphMap: {
      "checkmark-circle": "checkmark-circle",
      "close-circle": "close-circle",
      time: "time",
      "ellipsis-circle": "ellipsis-circle",
      trash: "trash",
    },
  },
}));

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>
  </QueryClientProvider>
);

describe("BackupScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful API responses using apiRequest
    vi.mocked(apiRequest).mockResolvedValue([
      {
        id: "backup-1",
        userId: "user-1",
        type: "full",
        status: "completed",
        size: 1024 * 1024,
        fileCount: 100,
        cloudKey: "backups/user-1/backup-1.enc",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T01:00:00Z",
      },
      {
        id: "backup-2",
        userId: "user-1",
        type: "incremental",
        status: "failed",
        size: 0,
        fileCount: 0,
        cloudKey: "",
        createdAt: "2024-01-02T00:00:00Z",
        errorMessage: "Network error",
      },
    ]);

    api.getBackupStats.mockResolvedValue({
      totalBackups: 2,
      completedBackups: 1,
      failedBackups: 1,
      totalSize: 1024 * 1024,
      lastBackup: "2024-01-01T01:00:00Z",
    });

    api.getBackupConfig.mockResolvedValue({
      autoBackupEnabled: false,
      retentionDays: 30,
      maxBackupSize: 100 * 1024 * 1024,
      supportedTypes: ["full", "incremental"],
      totalBackups: 2,
    });
  });

  describe("Rendering", () => {
    it("should render backup statistics correctly", async () => {
      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Backup Statistics")).toBeTruthy();
        expect(screen.getByText("2")).toBeTruthy(); // Total backups
        expect(screen.getByText("1")).toBeTruthy(); // Completed backups
        expect(screen.getByText("1")).toBeTruthy(); // Failed backups
        expect(screen.getByText("1.0 MB")).toBeTruthy(); // Total size
      });
    });

    it("should render backup actions correctly", async () => {
      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Backup Actions")).toBeTruthy();
        expect(screen.getByText("Start Incremental Backup")).toBeTruthy();
        expect(screen.getByText("Start Full Backup")).toBeTruthy();
        expect(screen.getByText("Automatic Backup")).toBeTruthy();
      });
    });

    it("should render backup history correctly", async () => {
      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Backup History")).toBeTruthy();
        expect(screen.getByText("FULL")).toBeTruthy();
        expect(screen.getByText("INCREMENTAL")).toBeTruthy();
        expect(screen.getByText("completed")).toBeTruthy();
        expect(screen.getByText("failed")).toBeTruthy();
        expect(screen.getByText("Network error")).toBeTruthy();
      });
    });

    it("should show loading state initially", () => {
      const { api } = require("./BackupScreen");
      api.listBackups.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<BackupScreen />, { wrapper: TestWrapper });

      expect(screen.getByText("Loading backup information...")).toBeTruthy();
    });

    it("should show empty state when no backups exist", async () => {
      const { api } = require("./BackupScreen");
      api.listBackups.mockResolvedValue([]);

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(
          screen.getByText("No backups yet. Start your first backup above."),
        ).toBeTruthy();
      });
    });
  });

  describe("Backup Actions", () => {
    it("should start incremental backup when button is pressed", async () => {
      const { api } = require("./BackupScreen");
      api.startBackup.mockResolvedValue({ backupId: "new-backup-1" });

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Start Incremental Backup")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Start Incremental Backup"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Start Backup",
          "Are you sure you want to start a incremental backup?",
          expect.any(Array),
        );
      });

      // Confirm the alert
      const alertCalls = vi.mocked(Alert.alert).mock.calls;
      const confirmCallback = alertCalls[alertCalls.length - 1][2][1].onPress;
      confirmCallback();

      await waitFor(() => {
        expect(api.startBackup).toHaveBeenCalledWith("incremental");
      });
    });

    it("should start full backup when button is pressed", async () => {
      const { api } = require("./BackupScreen");
      api.startBackup.mockResolvedValue({ backupId: "new-backup-2" });

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Start Full Backup")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Start Full Backup"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Start Backup",
          "Are you sure you want to start a full backup?",
          expect.any(Array),
        );
      });

      // Confirm the alert
      const alertCalls = vi.mocked(Alert.alert).mock.calls;
      const confirmCallback = alertCalls[alertCalls.length - 1][2][1].onPress;
      confirmCallback();

      await waitFor(() => {
        expect(api.startBackup).toHaveBeenCalledWith("full");
      });
    });

    it("should show success alert when backup starts successfully", async () => {
      const { api } = require("./BackupScreen");
      api.startBackup.mockResolvedValue({ backupId: "new-backup-1" });

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Start Incremental Backup")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Start Incremental Backup"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Start Backup",
          "Are you sure you want to start a incremental backup?",
          expect.any(Array),
        );
      });

      // Confirm the alert
      const alertCalls = vi.mocked(Alert.alert).mock.calls;
      const confirmCallback = alertCalls[alertCalls.length - 1][2][1].onPress;
      confirmCallback();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Success",
          "Backup started with ID: new-backup-1",
        );
      });
    });

    it("should show error alert when backup fails to start", async () => {
      const { api } = require("./BackupScreen");
      api.startBackup.mockRejectedValue(new Error("Network error"));

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Start Incremental Backup")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Start Incremental Backup"));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Start Backup",
          "Are you sure you want to start a incremental backup?",
          expect.any(Array),
        );
      });

      // Confirm the alert
      const alertCalls = vi.mocked(Alert.alert).mock.calls;
      const confirmCallback = alertCalls[alertCalls.length - 1][2][1].onPress;
      confirmCallback();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Failed to start backup",
        );
      });
    });
  });

  describe("Backup Management", () => {
    it("should show delete button for completed backups", async () => {
      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(1); // Only for completed backup
      });
    });

    it("should delete backup when delete button is pressed", async () => {
      const { api } = require("./BackupScreen");
      api.deleteBackup.mockResolvedValue();

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(1);
      });

      fireEvent.press(screen.getAllByText("Delete")[0]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Delete Backup",
          "Are you sure you want to delete this backup? This action cannot be undone.",
          expect.any(Array),
        );
      });

      // Confirm the alert
      const alertCalls = vi.mocked(Alert.alert).mock.calls;
      const confirmCallback = alertCalls[alertCalls.length - 1][2][1].onPress;
      confirmCallback();

      await waitFor(() => {
        expect(api.deleteBackup).toHaveBeenCalledWith("backup-1");
      });
    });

    it("should show success alert when backup is deleted successfully", async () => {
      const { api } = require("./BackupScreen");
      api.deleteBackup.mockResolvedValue();

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(1);
      });

      fireEvent.press(screen.getAllByText("Delete")[0]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Delete Backup",
          "Are you sure you want to delete this backup? This action cannot be undone.",
          expect.any(Array),
        );
      });

      // Confirm the alert
      const alertCalls = vi.mocked(Alert.alert).mock.calls;
      const confirmCallback = alertCalls[alertCalls.length - 1][2][1].onPress;
      confirmCallback();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Success",
          "Backup deleted successfully",
        );
      });
    });
  });

  describe("Automatic Backup", () => {
    it("should show schedule modal when auto backup is enabled", async () => {
      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Automatic Backup")).toBeTruthy();
      });

      // Find and toggle the switch
      const switches = screen.getAllByRole("switch");
      expect(switches.length).toBeGreaterThan(0);

      fireEvent(switches[0], "valueChange", true);

      await waitFor(() => {
        expect(screen.getByText("Schedule Automatic Backup")).toBeTruthy();
        expect(screen.getByText("Enter a cron expression")).toBeTruthy();
        expect(screen.getByText("Cancel")).toBeTruthy();
        expect(screen.getByText("Schedule")).toBeTruthy();
      });
    });

    it("should schedule backup when schedule button is pressed", async () => {
      const { api } = require("./BackupScreen");
      api.scheduleBackup.mockResolvedValue();

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Automatic Backup")).toBeTruthy();
      });

      // Enable auto backup to show modal
      const switches = screen.getAllByRole("switch");
      fireEvent(switches[0], "valueChange", true);

      await waitFor(() => {
        expect(screen.getByText("Schedule")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Schedule"));

      await waitFor(() => {
        expect(api.scheduleBackup).toHaveBeenCalledWith("0 2 * * *");
      });
    });

    it("should cancel scheduled backup when switch is turned off", async () => {
      const { api } = require("./BackupScreen");
      api.cancelScheduledBackup.mockResolvedValue();

      // Mock config with auto backup enabled
      api.getBackupConfig.mockResolvedValue({
        autoBackupEnabled: true,
        retentionDays: 30,
        maxBackupSize: 100 * 1024 * 1024,
        supportedTypes: ["full", "incremental"],
        totalBackups: 2,
      });

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Automatic Backup")).toBeTruthy();
      });

      // Find and toggle the switch off
      const switches = screen.getAllByRole("switch");
      fireEvent(switches[0], "valueChange", false);

      await waitFor(() => {
        expect(api.cancelScheduledBackup).toHaveBeenCalled();
      });
    });
  });

  describe("Pull to Refresh", () => {
    it("should refresh data when pulled down", async () => {
      const { api } = require("./BackupScreen");

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText("Backup Statistics")).toBeTruthy();
      });

      // Clear mock calls to test refresh
      api.listBackups.mockClear();
      api.getBackupStats.mockClear();

      // Simulate pull to refresh
      const scrollView = screen.getByTestId("scrollView");
      fireEvent(scrollView, "refresh");

      await waitFor(() => {
        expect(api.listBackups).toHaveBeenCalled();
        expect(api.getBackupStats).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      const { api } = require("./BackupScreen");
      api.listBackups.mockRejectedValue(new Error("Network error"));
      api.getBackupStats.mockRejectedValue(new Error("Network error"));

      render(<BackupScreen />, { wrapper: TestWrapper });

      // Should not crash and should show some UI
      await waitFor(() => {
        expect(screen.queryByText("Loading backup information...")).toBeFalsy();
      });
    });

    it("should handle delete backup error", async () => {
      const { api } = require("./BackupScreen");
      api.deleteBackup.mockRejectedValue(new Error("Delete failed"));

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getAllByText("Delete")).toHaveLength(1);
      });

      fireEvent.press(screen.getAllByText("Delete")[0]);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Delete Backup",
          "Are you sure you want to delete this backup? This action cannot be undone.",
          expect.any(Array),
        );
      });

      // Confirm the alert
      const alertCalls = vi.mocked(Alert.alert).mock.calls;
      const confirmCallback = alertCalls[alertCalls.length - 1][2][1].onPress;
      confirmCallback();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Failed to delete backup",
        );
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper accessibility labels", async () => {
      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Start Incremental Backup/i }),
        ).toBeTruthy();
        expect(
          screen.getByRole("button", { name: /Start Full Backup/i }),
        ).toBeTruthy();
        expect(
          screen.getByRole("switch", { name: /Automatic Backup/i }),
        ).toBeTruthy();
      });
    });

    it("should announce backup status changes", async () => {
      const { api } = require("./BackupScreen");
      api.startBackup.mockResolvedValue({ backupId: "new-backup-1" });

      render(<BackupScreen />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Start Incremental Backup/i }),
        ).toBeTruthy();
      });

      fireEvent.press(
        screen.getByRole("button", { name: /Start Incremental Backup/i }),
      );

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });
  });
});

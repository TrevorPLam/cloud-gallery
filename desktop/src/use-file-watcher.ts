import { useState, useEffect, useCallback } from "react";
import { DesktopFileService, FileEvent } from "./file-service";

export const useDesktopFileWatcher = (watchPath?: string) => {
  const [isWatching, setIsWatching] = useState(false);
  const [fileEvents, setFileEvents] = useState<FileEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const fileService = DesktopFileService.getInstance();

  const initialize = useCallback(async () => {
    if (isInitialized) return;

    try {
      await fileService.initialize();
      setIsInitialized(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to initialize file service",
      );
    }
  }, [fileService, isInitialized]);

  const startWatching = useCallback(
    async (path: string) => {
      try {
        setError(null);
        await fileService.startWatching(path);
        setIsWatching(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to start watching",
        );
      }
    },
    [fileService],
  );

  const stopWatching = useCallback(
    async (path: string) => {
      try {
        await fileService.stopWatching(path);
        setIsWatching(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to stop watching",
        );
      }
    },
    [fileService],
  );

  const clearEvents = useCallback(() => {
    setFileEvents([]);
  }, []);

  const getEventStats = useCallback(() => {
    const stats = fileEvents.reduce(
      (acc, event) => {
        const type = event.event_type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total: fileEvents.length,
      byType: stats,
      recent: fileEvents.slice(-10).reverse(),
    };
  }, [fileEvents]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!watchPath || !isInitialized) return;

    const handleFileChange = (event: FileEvent) => {
      setFileEvents((prev) => [...prev.slice(-199), event]); // Keep last 200 events
    };

    fileService.onFileChange("desktop-hook", handleFileChange);

    return () => {
      fileService.offFileChange("desktop-hook");
    };
  }, [watchPath, fileService, isInitialized]);

  return {
    isInitialized,
    isWatching,
    fileEvents,
    error,
    supportedExtensions: fileService.getSupportedExtensions(),
    startWatching,
    stopWatching,
    clearEvents,
    getEventStats,
    isSupportedFile: fileService.isSupportedFile.bind(fileService),
  };
};

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHistoryLog,
  fetchHistoryLogs,
  updateHistoryByJobId,
  updateHistoryLog,
  type CreateHistoryLogInput,
  type HistoryLog,
  type UpdateHistoryLogInput,
} from "@/lib/history";

interface HistoryContextValue {
  isOpen: boolean;
  openHistory: () => void;
  closeHistory: () => void;
  logs: HistoryLog[];
  isLoading: boolean;
  isConfigured: boolean;
  refreshHistory: () => void;
  logActivity: (input: CreateHistoryLogInput) => Promise<HistoryLog | null>;
  updateActivity: (
    id: string,
    updates: UpdateHistoryLogInput,
  ) => Promise<HistoryLog | null>;
  updateActivityByJobId: (
    jobId: string,
    updates: UpdateHistoryLogInput,
  ) => Promise<HistoryLog | null>;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const isConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["history-logs"],
    queryFn: () => fetchHistoryLogs(100),
    enabled: isConfigured,
    staleTime: 10_000,
  });

  const refreshHistory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["history-logs"] });
  }, [queryClient]);

  const openHistory = useCallback(() => {
    setIsOpen(true);
    refreshHistory();
  }, [refreshHistory]);

  const closeHistory = useCallback(() => setIsOpen(false), []);

  const logActivity = useCallback(
    async (input: CreateHistoryLogInput) => {
      const entry = await createHistoryLog(input);
      if (entry) refreshHistory();
      return entry;
    },
    [refreshHistory],
  );

  const updateActivity = useCallback(
    async (id: string, updates: UpdateHistoryLogInput) => {
      const entry = await updateHistoryLog(id, updates);
      if (entry) refreshHistory();
      return entry;
    },
    [refreshHistory],
  );

  const updateActivityByJobId = useCallback(
    async (jobId: string, updates: UpdateHistoryLogInput) => {
      const entry = await updateHistoryByJobId(jobId, updates);
      if (entry) refreshHistory();
      return entry;
    },
    [refreshHistory],
  );

  const value = useMemo(
    () => ({
      isOpen,
      openHistory,
      closeHistory,
      logs,
      isLoading,
      isConfigured,
      refreshHistory,
      logActivity,
      updateActivity,
      updateActivityByJobId,
    }),
    [
      isOpen,
      openHistory,
      closeHistory,
      logs,
      isLoading,
      isConfigured,
      refreshHistory,
      logActivity,
      updateActivity,
      updateActivityByJobId,
    ],
  );

  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) {
    throw new Error("useHistory must be used within HistoryProvider");
  }
  return ctx;
}

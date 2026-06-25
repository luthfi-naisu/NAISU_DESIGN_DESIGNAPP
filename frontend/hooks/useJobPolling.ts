"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export function useJobPolling(jobId: string | null, intervalMs = 2000) {
  const [job, setJob] = useState<Awaited<ReturnType<typeof api.getJob>> | null>(
    null,
  );

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    const poll = async () => {
      try {
        const data = await api.getJob(jobId);
        if (active) setJob(data);
        if (data.status === "done" || data.status === "failed") {
          clearInterval(timer);
        }
      } catch {
        /* retry */
      }
    };
    poll();
    const timer = setInterval(poll, intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [jobId, intervalMs]);

  return job;
}

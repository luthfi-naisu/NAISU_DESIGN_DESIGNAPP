import { getSupabase } from "@/lib/supabase";

export type HistoryLogType =
  | "youtube-to-gif"
  | "mp4-to-gif"
  | "upload-mp4"
  | "asset-search"
  | "shutterstock-license"
  | "ai-video"
  | "upscale";

export type HistoryLogStatus = "queued" | "processing" | "done" | "failed";

export interface HistoryLog {
  id: string;
  created_at: string;
  updated_at: string;
  type: HistoryLogType;
  status: HistoryLogStatus;
  title: string;
  description: string | null;
  input_summary: string | null;
  job_id: string | null;
  result_url: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface CreateHistoryLogInput {
  type: HistoryLogType;
  status?: HistoryLogStatus;
  title: string;
  description?: string;
  input_summary?: string;
  job_id?: string;
  result_url?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateHistoryLogInput {
  status?: HistoryLogStatus;
  title?: string;
  description?: string;
  result_url?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export async function createHistoryLog(
  input: CreateHistoryLogInput,
): Promise<HistoryLog | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const row = {
    type: input.type,
    status: input.status ?? "processing",
    title: input.title,
    description: input.description ?? null,
    input_summary: input.input_summary ?? null,
    job_id: input.job_id ?? null,
    result_url: input.result_url ?? null,
    error_message: input.error_message ?? null,
    metadata: input.metadata ?? {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("history_logs")
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("[history] create failed:", error.message);
    return null;
  }

  return data as HistoryLog;
}

export async function updateHistoryLog(
  id: string,
  updates: UpdateHistoryLogInput,
): Promise<HistoryLog | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("history_logs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[history] update failed:", error.message);
    return null;
  }

  return data as HistoryLog;
}

export async function updateHistoryByJobId(
  jobId: string,
  updates: UpdateHistoryLogInput,
): Promise<HistoryLog | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("history_logs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[history] update by job_id failed:", error.message);
    return null;
  }

  return data as HistoryLog | null;
}

export async function fetchHistoryLogs(limit = 50): Promise<HistoryLog[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("history_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[history] fetch failed:", error.message);
    return [];
  }

  return (data ?? []) as HistoryLog[];
}

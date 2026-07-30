"use client";

import {
  Clock,
  Film,
  ImageUp,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
  Youtube,
} from "lucide-react";
import { useHistory } from "@/contexts/HistoryContext";
import type { HistoryLog, HistoryLogType } from "@/lib/history";
import { Button } from "@/components/ui/button";

const TYPE_LABELS: Record<HistoryLogType, string> = {
  "youtube-to-gif": "YouTube → GIF",
  "mp4-to-gif": "MP4 → GIF",
  "upload-mp4": "Upload MP4",
  "asset-search": "Stock Search",
  "shutterstock-license": "Stock License",
  "ai-video": "AI Video",
  upscale: "Upscale",
};

function TypeIcon({ type }: { type: HistoryLogType }) {
  switch (type) {
    case "youtube-to-gif":
      return <Youtube className="h-4 w-4" />;
    case "mp4-to-gif":
    case "upload-mp4":
      return <Upload className="h-4 w-4" />;
    case "asset-search":
    case "shutterstock-license":
      return <Film className="h-4 w-4" />;
    case "ai-video":
      return <Sparkles className="h-4 w-4" />;
    case "upscale":
      return <ImageUp className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    done: "bg-green-500/15 text-green-400",
    failed: "bg-red-500/15 text-red-400",
    processing: "bg-blue-500/15 text-blue-400",
    queued: "bg-yellow-500/15 text-yellow-400",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HistoryLogItem({ log }: { log: HistoryLog }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 rounded-md bg-accent p-1.5 text-muted-foreground">
            <TypeIcon type={log.type} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{log.title}</p>
            <p className="text-xs text-muted-foreground">
              {TYPE_LABELS[log.type]}
            </p>
          </div>
        </div>
        <StatusBadge status={log.status} />
      </div>

      {log.input_summary && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {log.input_summary}
        </p>
      )}

      {log.description && (
        <p className="text-xs text-muted-foreground">{log.description}</p>
      )}

      {log.error_message && (
        <p className="text-xs text-red-400">{log.error_message}</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-muted-foreground">
          {formatTime(log.created_at)}
        </span>
        {log.result_url && log.status === "done" && (
          <a
            href={log.result_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Lihat hasil
          </a>
        )}
      </div>
    </div>
  );
}

export function HistoryLogsPanel() {
  const {
    isOpen,
    closeHistory,
    logs,
    isLoading,
    isConfigured,
    refreshHistory,
  } = useHistory();

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 md:bg-black/40"
        onClick={closeHistory}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-xl"
        role="dialog"
        aria-label="History logs"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-lg font-semibold">History Logs</h2>
            <p className="text-sm text-muted-foreground">
              Riwayat aktivitas disimpan di Supabase
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshHistory()}
              disabled={isLoading}
              aria-label="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeHistory}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!isConfigured && (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Supabase belum dikonfigurasi. Tambahkan{" "}
              <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
              <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di{" "}
              <code className="text-xs">frontend/.env.local</code>, lalu jalankan
              SQL di <code className="text-xs">scripts/supabase-schema.sql</code>.
            </div>
          )}

          {isConfigured && isLoading && logs.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {isConfigured && !isLoading && logs.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Belum ada history. Setelah submit data, log akan muncul di sini.
            </div>
          )}

          {logs.map((log) => <HistoryLogItem key={log.id} log={log} />)}
        </div>
      </aside>
    </>
  );
}

export function ViewHistoryButton({
  className,
  variant = "outline",
  size = "sm",
}: {
  className?: string;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}) {
  const { openHistory } = useHistory();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={openHistory}
    >
      <Clock className="mr-2 h-4 w-4" />
      Lihat History
    </Button>
  );
}

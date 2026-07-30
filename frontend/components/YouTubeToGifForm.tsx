"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileVideo, Loader2 } from "lucide-react";
import { api, parseTimestamp } from "@/lib/api-client";
import type { SelectedMedia } from "@/components/MediaDropzone";
import { ViewHistoryButton } from "@/components/HistoryLogsPanel";
import { useHistory } from "@/contexts/HistoryContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface YouTubeToGifFormProps {
  initialUrl?: string;
  localVideo?: SelectedMedia | null;
}

export function YouTubeToGifForm({
  initialUrl = "",
  localVideo = null,
}: YouTubeToGifFormProps) {
  const { logActivity, updateActivityByJobId } = useHistory();
  const [url, setUrl] = useState(initialUrl);
  const [startTime, setStartTime] = useState("0:00");
  const [endTime, setEndTime] = useState("0:05");
  const [removeBackground, setRemoveBackground] = useState(false);
  const [width, setWidth] = useState(480);
  const [quality, setQuality] = useState<"standard" | "maximum">("standard");
  const [jobId, setJobId] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(
    localVideo?.localPath ?? null,
  );
  const [jobStatus, setJobStatus] = useState<{
    status: string;
    progress: number;
    message: string;
    error: string | null;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    if (localVideo?.localPath) setLocalPath(localVideo.localPath);
  }, [localVideo]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback(
    (id: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const job = await api.getJob(id);
          setJobStatus({
            status: job.status,
            progress: job.progress,
            message: job.message,
            error: job.error,
          });
          if (job.status === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            await updateActivityByJobId(id, {
              status: "done",
              description: job.message,
              result_url: api.gifDownloadUrl(id),
            });
          } else if (job.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            await updateActivityByJobId(id, {
              status: "failed",
              error_message: job.error ?? job.message,
            });
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
    },
    [updateActivityByJobId],
  );

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadMp4(file),
    onSuccess: (data) => setLocalPath(data.local_path),
  });

  const youtubeMutation = useMutation({
    mutationFn: async () => {
      const start = parseTimestamp(startTime);
      const end = parseTimestamp(endTime);
      return api.youtubeToGif({
        url,
        start_time: start,
        end_time: end,
        remove_background: removeBackground,
        width,
        quality,
      });
    },
    onSuccess: async (data) => {
      setJobId(data.job_id);
      setJobStatus({
        status: data.status,
        progress: 0,
        message: "Job queued...",
        error: null,
      });
      await logActivity({
        type: "youtube-to-gif",
        status: "processing",
        title: "YouTube → GIF",
        input_summary: `${url} (${startTime} – ${endTime})`,
        job_id: data.job_id,
        metadata: {
          width,
          quality,
          remove_background: removeBackground,
        },
      });
      startPolling(data.job_id);
    },
  });

  const isProcessing =
    youtubeMutation.isPending ||
    uploadMutation.isPending ||
    Boolean(
      jobStatus && !["done", "failed"].includes(jobStatus.status),
    );

  const handleConvert = async () => {
    if (localPath || localVideo) {
      try {
        let path = localPath;
        if (!path && localVideo?.file) {
          const uploaded = await uploadMutation.mutateAsync(localVideo.file);
          path = uploaded.local_path;
          setLocalPath(path);
        }
        if (!path) return;
        const data = await api.mp4ToGif({
          local_path: path,
          remove_background: removeBackground,
          width,
          quality,
        });
        setJobId(data.job_id);
        setJobStatus({
          status: data.status,
          progress: 0,
          message: "Converting MP4 to GIF...",
          error: null,
        });
        await logActivity({
          type: "mp4-to-gif",
          status: "processing",
          title: "MP4 → GIF",
          input_summary: localVideo?.file.name ?? path,
          job_id: data.job_id,
          metadata: { width, quality, remove_background: removeBackground },
        });
        startPolling(data.job_id);
      } catch (err) {
        setJobStatus({
          status: "failed",
          progress: 0,
          message: "Conversion failed",
          error: (err as Error).message,
        });
        await logActivity({
          type: "mp4-to-gif",
          status: "failed",
          title: "MP4 → GIF",
          input_summary: localVideo?.file.name ?? localPath ?? "local file",
          error_message: (err as Error).message,
        });
      }
      return;
    }
    youtubeMutation.mutate();
  };

  const activeError = youtubeMutation.error || uploadMutation.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>YouTube / MP4 to GIF</CardTitle>
        <CardDescription>
          YouTube segment atau file MP4 lokal → GIF berkualitas tinggi
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {localVideo && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileVideo className="h-4 w-4" />
              File lokal: {localVideo.file.name}
            </div>
            <video
              src={localVideo.previewUrl}
              controls
              className="max-h-40 w-full rounded-md border bg-black"
            />
          </div>
        )}

        {!localVideo && (
          <>
            <div className="space-y-2">
              <Label htmlFor="yt-url">YouTube URL</Label>
              <Input
                id="yt-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Start Time</Label>
                <Input
                  id="start"
                  placeholder="0:00 or seconds"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End Time</Label>
                <Input
                  id="end"
                  placeholder="0:05 or seconds"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="width">Output Width (px)</Label>
          <Input
            id="width"
            type="number"
            min={120}
            max={1920}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="alpha"
            checked={removeBackground}
            onCheckedChange={(v) => setRemoveBackground(v === true)}
          />
          <Label htmlFor="alpha">
            Transparent GIF (Alpha Matting / BiRefNet)
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="quality"
            checked={quality === "maximum"}
            onCheckedChange={(v) =>
              setQuality(v === true ? "maximum" : "standard")
            }
          />
          <Label htmlFor="quality">Maximum quality (gifski if available)</Label>
        </div>

        <Button
          onClick={handleConvert}
          disabled={
            isProcessing || (!localVideo && !localPath && !url)
          }
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Convert to GIF"
          )}
        </Button>

        {activeError && (
          <p className="text-sm text-red-400">
            {(activeError as Error).message}
          </p>
        )}

        {jobStatus && (
          <div className="space-y-2 rounded-md border border-border p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{jobStatus.message}</span>
              <span className="capitalize">{jobStatus.status}</span>
            </div>
            <Progress value={jobStatus.progress} />
            {jobStatus.error && (
              <p className="text-sm text-red-400">{jobStatus.error}</p>
            )}
            {jobStatus.status === "done" && jobId && (
              <div className="space-y-3 pt-2">
                <img
                  src={api.gifDownloadUrl(jobId)}
                  alt="Generated GIF"
                  className="max-h-64 rounded-md border"
                />
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary">
                    <a href={api.gifDownloadUrl(jobId)} download>
                      Download GIF
                    </a>
                  </Button>
                  <ViewHistoryButton />
                </div>
              </div>
            )}
            {jobStatus.status === "failed" && (
              <ViewHistoryButton className="mt-2" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

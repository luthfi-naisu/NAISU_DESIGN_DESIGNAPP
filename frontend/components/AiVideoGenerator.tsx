"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

export function AiVideoGenerator() {
  const [prompt, setPrompt] = useState("");
  const [useComfyui, setUseComfyui] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<{
    status: string;
    progress: number;
    message: string;
    error: string | null;
    result_path: string | null;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: comfyui } = useQuery({
    queryKey: ["comfyui-status"],
    queryFn: () => api.comfyuiStatus(),
    staleTime: 30_000,
  });

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job = await api.getJob(id);
        setJobStatus({
          status: job.status,
          progress: job.progress,
          message: job.message,
          error: job.error,
          result_path: job.result_path,
        });
        if (job.status === "done" || job.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
  }, []);

  const mutation = useMutation({
    mutationFn: () =>
      api.generateVideo({
        prompt,
        image_size: "1280x720",
        use_comfyui: useComfyui,
      }),
    onSuccess: (data) => {
      setJobId(data.job_id);
      setJobStatus({
        status: data.status,
        progress: 0,
        message: "Submitting to SiliconFlow...",
        error: null,
        result_path: null,
      });
      startPolling(data.job_id);
    },
  });

  const gifMutation = useMutation({
    mutationFn: (localPath: string) =>
      api.mp4ToGif({ local_path: localPath, remove_background: false }),
  });

  const isProcessing =
    mutation.isPending ||
    (jobStatus && !["done", "failed"].includes(jobStatus.status));

  return (
    <Card>
      <CardHeader>
        <CardTitle>DiT AI Video Generation</CardTitle>
        <CardDescription>
          Generate video from text via SiliconFlow (Wan 2.1). Optional ComfyUI
          local fallback when available.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            id="prompt"
            placeholder="A cinematic shot of clouds moving over mountains at sunset..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        {comfyui?.available && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="comfyui"
              checked={useComfyui}
              onCheckedChange={(v) => setUseComfyui(v === true)}
            />
            <Label htmlFor="comfyui">Use Local ComfyUI (127.0.0.1:8188)</Label>
          </div>
        )}

        <Button
          onClick={() => mutation.mutate()}
          disabled={!prompt || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Video
            </>
          )}
        </Button>

        {mutation.error && (
          <p className="text-sm text-red-400">
            {(mutation.error as Error).message}
          </p>
        )}

        {jobStatus && (
          <div className="space-y-2 rounded-md border border-border p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{jobStatus.message}</span>
              <span className="capitalize">{jobStatus.status}</span>
            </div>
            <Progress value={jobStatus.progress || 10} />
            {jobStatus.error && (
              <p className="text-sm text-red-400">{jobStatus.error}</p>
            )}
            {jobStatus.status === "done" && jobStatus.result_path && (
              <div className="space-y-3 pt-2">
                <p className="text-sm text-green-400">
                  Video saved: {jobStatus.result_path}
                </p>
                <Button
                  variant="secondary"
                  disabled={gifMutation.isPending}
                  onClick={() => gifMutation.mutate(jobStatus.result_path!)}
                >
                  {gifMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Convert to GIF
                </Button>
                {gifMutation.data && (
                  <Button asChild variant="outline">
                    <a
                      href={api.gifDownloadUrl(gifMutation.data.job_id)}
                      download
                    >
                      Download GIF
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

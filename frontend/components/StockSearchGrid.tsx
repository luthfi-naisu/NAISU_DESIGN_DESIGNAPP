"use client";

import { useEffect, useState } from "react";
import { useJobPolling } from "@/hooks/useJobPolling";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { ViewHistoryButton } from "@/components/HistoryLogsPanel";
import { useHistory } from "@/contexts/HistoryContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Video = {
  id: string;
  description: string;
  duration: number;
  preview_url: string;
  thumbnail_url: string;
  asset_page: string;
};

export function StockSearchGrid() {
  const { logActivity, updateActivityByJobId } = useHistory();
  const [query, setQuery] = useState("");
  const [searchId, setSearchId] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [licensed, setLicensed] = useState<Record<string, string>>({});
  const [gifJobId, setGifJobId] = useState<string | null>(null);
  const gifJob = useJobPolling(gifJobId);

  useEffect(() => {
    if (!gifJobId || !gifJob) return;
    if (gifJob.status === "done") {
      void updateActivityByJobId(gifJobId, {
        status: "done",
        description: "GIF conversion selesai",
        result_url: api.gifDownloadUrl(gifJobId),
      });
    } else if (gifJob.status === "failed") {
      void updateActivityByJobId(gifJobId, {
        status: "failed",
        error_message: gifJob.error ?? "GIF conversion failed",
      });
    }
  }, [gifJobId, gifJob, updateActivityByJobId]);

  const searchMutation = useMutation({
    mutationFn: () => api.searchAssets(query),
    onSuccess: async (data) => {
      setVideos(data.videos);
      setSearchId(data.search_id);
      await logActivity({
        type: "asset-search",
        status: "done",
        title: "Stock Search",
        input_summary: query,
        description: `${data.total_count} hasil ditemukan`,
        metadata: { search_id: data.search_id, total_count: data.total_count },
      });
    },
    onError: async (err) => {
      await logActivity({
        type: "asset-search",
        status: "failed",
        title: "Stock Search",
        input_summary: query,
        error_message: (err as Error).message,
      });
    },
  });

  const licenseMutation = useMutation({
    mutationFn: (videoId: string) =>
      api.licenseAsset({
        video_id: videoId,
        search_id: searchId,
      }),
    onSuccess: async (data) => {
      setLicensed((prev) => ({
        ...prev,
        [data.video_id]: data.local_path,
      }));
      await logActivity({
        type: "shutterstock-license",
        status: "done",
        title: "Stock License",
        input_summary: `Video ID ${data.video_id}`,
        description: "Video berhasil dilicense & download",
        job_id: data.job_id,
        metadata: {
          video_id: data.video_id,
          license_id: data.license_id,
          local_path: data.local_path,
        },
      });
    },
    onError: async (err, videoId) => {
      await logActivity({
        type: "shutterstock-license",
        status: "failed",
        title: "Stock License",
        input_summary: `Video ID ${videoId}`,
        error_message: (err as Error).message,
      });
    },
  });

  const gifMutation = useMutation({
    mutationFn: (localPath: string) =>
      api.mp4ToGif({ local_path: localPath, remove_background: false }),
    onSuccess: async (data) => {
      setGifJobId(data.job_id);
      await logActivity({
        type: "mp4-to-gif",
        status: "processing",
        title: "Stock → GIF",
        input_summary: "Licensed stock video",
        job_id: data.job_id,
      });
    },
    onError: async (err) => {
      await logActivity({
        type: "mp4-to-gif",
        status: "failed",
        title: "Stock → GIF",
        error_message: (err as Error).message,
      });
    },
  });

  const showHistoryCta =
    searchMutation.isSuccess ||
    licenseMutation.isSuccess ||
    gifJob?.status === "done" ||
    gifJob?.status === "failed";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Stock Asset Discovery</CardTitle>
          <CardDescription>
            Search Shutterstock videos. Preview watermarked clips, then license to
            download and convert to GIF.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search stock videos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchMutation.mutate()}
            />
            <Button
              onClick={() => searchMutation.mutate()}
              disabled={!query || searchMutation.isPending}
            >
              {searchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          {searchMutation.error && (
            <p className="mt-2 text-sm text-red-400">
              {(searchMutation.error as Error).message}
            </p>
          )}
          {showHistoryCta && (
            <div className="mt-3">
              <ViewHistoryButton />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <Card key={video.id} className="overflow-hidden">
            <div className="relative aspect-video bg-black">
              {video.preview_url ? (
                <video
                  src={video.preview_url}
                  poster={video.thumbnail_url}
                  controls
                  muted
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={video.thumbnail_url}
                  alt={video.description}
                  className="h-full w-full object-cover"
                />
              )}
              <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs">
                {licensed[video.id] ? "Licensed" : "Preview"}
              </span>
            </div>
            <CardContent className="space-y-3 p-4">
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {video.description || `Video ${video.id}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {video.duration}s ·{" "}
                <a
                  href={video.asset_page}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Shutterstock
                </a>
              </p>
              {!licensed[video.id] ? (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={licenseMutation.isPending}
                  onClick={() => licenseMutation.mutate(video.id)}
                >
                  {licenseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "License & Download"
                  )}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    disabled={gifMutation.isPending}
                    onClick={() => gifMutation.mutate(licensed[video.id])}
                  >
                    Convert to GIF
                  </Button>
                  {gifJobId && gifJob?.status === "done" && (
                    <div className="flex flex-col gap-2">
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <a href={api.gifDownloadUrl(gifJobId)} download>
                          Download GIF
                        </a>
                      </Button>
                      <ViewHistoryButton className="w-full" />
                    </div>
                  )}
                  {gifJobId && gifJob && gifJob.status !== "done" && (
                    <p className="text-xs text-muted-foreground">
                      Converting... {Math.round(gifJob.progress)}%
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

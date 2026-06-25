"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileVideo, ImageIcon, Loader2, Upload, X, Youtube } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ACCEPT =
  ".mp4,.mov,.webm,.jpg,.jpeg,.png,video/mp4,video/quicktime,video/webm,image/jpeg,image/png";

function isVideoFile(file: File) {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|mov|webm|m4v)$/i.test(file.name)
  );
}

function isImageFile(file: File) {
  return (
    file.type.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(file.name)
  );
}

export interface SelectedMedia {
  file: File;
  kind: "video" | "image";
  previewUrl: string;
  localPath?: string;
}

interface MediaDropzoneProps {
  onYouTubeUrl?: (url: string) => void;
  onMediaSelected?: (media: SelectedMedia) => void;
}

export function MediaDropzone({
  onYouTubeUrl,
  onMediaSelected,
}: MediaDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selected, setSelected] = useState<SelectedMedia | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadMp4(file),
  });

  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      if (isVideoFile(file)) {
        const previewUrl = URL.createObjectURL(file);
        setSelected({ file, kind: "video", previewUrl });

        try {
          const result = await uploadMutation.mutateAsync(file);
          const media: SelectedMedia = {
            file,
            kind: "video",
            previewUrl,
            localPath: result.local_path,
          };
          setSelected(media);
          onMediaSelected?.(media);
        } catch (err) {
          setError(
            (err as Error).message ||
              "Upload gagal. Pastikan backend berjalan di port 8001.",
          );
          onMediaSelected?.({ file, kind: "video", previewUrl });
        }
        return;
      }

      if (isImageFile(file)) {
        const previewUrl = URL.createObjectURL(file);
        const media: SelectedMedia = { file, kind: "image", previewUrl };
        setSelected(media);
        onMediaSelected?.(media);
        return;
      }

      setError("Format tidak didukung. Gunakan MP4, JPG, atau PNG.");
    },
    [onMediaSelected, uploadMutation],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = "";
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (text.includes("youtube.com") || text.includes("youtu.be")) {
      onYouTubeUrl?.(text.trim());
      return;
    }
    const item = e.clipboardData.files?.[0];
    if (item) void processFile(item);
  };

  const clearSelection = () => {
    if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
    setSelected(null);
    setError(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Unified Input</CardTitle>
        <CardDescription>
          Klik atau drag & drop file MP4, JPG, PNG — atau paste URL YouTube
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={handleInputChange}
        />

        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openFilePicker();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handlePaste}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
          ) : (
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
          )}
          <p className="text-sm font-medium text-foreground">
            {isDragActive ? "Lepaskan file di sini..." : "Klik untuk pilih file"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            atau drag & drop MP4, JPG, PNG
          </p>
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Youtube className="h-3 w-3" />
            Paste URL YouTube untuk auto-fill
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {selected && (
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                {selected.kind === "video" ? (
                  <FileVideo className="h-4 w-4 text-primary" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-primary" />
                )}
                <span className="font-medium">{selected.file.name}</span>
                <span className="text-muted-foreground">
                  ({(selected.file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelection();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {selected.kind === "video" ? (
              <video
                src={selected.previewUrl}
                controls
                className="max-h-48 w-full rounded-md border bg-black"
              />
            ) : (
              <img
                src={selected.previewUrl}
                alt={selected.file.name}
                className="max-h-48 w-full rounded-md border object-contain"
              />
            )}

            {selected.kind === "video" && selected.localPath && (
              <p className="mt-2 text-xs text-green-400">
                Upload berhasil — lanjut ke tab YouTube GIF untuk convert
              </p>
            )}
            {selected.kind === "image" && (
              <p className="mt-2 text-xs text-green-400">
                Gambar siap — buka tab Upscale untuk enhance
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function UpscalePanel({ initialFile }: { initialFile?: File | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => api.upscale(file),
    onSuccess: (data) => {
      setResult(`data:image/png;base64,${data.base64}`);
    },
  });

  const handleFile = useCallback(
    (file: File) => {
      if (!isImageFile(file)) return;
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
      mutation.mutate(file);
    },
    [mutation],
  );

  useEffect(() => {
    if (initialFile && isImageFile(initialFile)) {
      handleFile(initialFile);
    }
  }, [initialFile, handleFile]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Image Upscaler</CardTitle>
        <CardDescription>
          Enhance low-resolution images with Replicate Real-ESRGAN
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 hover:border-primary/50"
        >
          {mutation.isPending ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Klik atau drop gambar untuk upscale (4x)
          </p>
        </div>

        {mutation.error && (
          <p className="text-sm text-red-400">
            {(mutation.error as Error).message}
          </p>
        )}

        {(preview || result) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {preview && (
              <div>
                <p className="mb-2 text-sm font-medium">Original</p>
                <img src={preview} alt="Original" className="rounded-md border" />
              </div>
            )}
            {result && (
              <div>
                <p className="mb-2 text-sm font-medium">Upscaled</p>
                <img src={result} alt="Upscaled" className="rounded-md border" />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

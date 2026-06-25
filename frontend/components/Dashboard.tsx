"use client";

import { Film, ImageUp, Sparkles, Youtube } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YouTubeToGifForm } from "@/components/YouTubeToGifForm";
import { StockSearchGrid } from "@/components/StockSearchGrid";
import { AiVideoGenerator } from "@/components/AiVideoGenerator";
import {
  MediaDropzone,
  UpscalePanel,
  type SelectedMedia,
} from "@/components/MediaDropzone";
import { useState } from "react";

export function Dashboard() {
  const [ytUrl, setYtUrl] = useState("");
  const [activeTab, setActiveTab] = useState("youtube");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(
    null,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card p-6 md:block">
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight">Design App</h1>
          <p className="text-sm text-muted-foreground">
            Media processing studio
          </p>
        </div>
        <nav className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-foreground">
            <Film className="h-4 w-4" /> Local-first pipeline
          </p>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <MediaDropzone
            onYouTubeUrl={(url) => {
              setYtUrl(url);
              setActiveTab("youtube");
            }}
            onMediaSelected={(media) => {
              setSelectedMedia(media);
              if (media.kind === "video") {
                setActiveTab("youtube");
              } else {
                setImageFile(media.file);
                setActiveTab("upscale");
              }
            }}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="youtube" className="gap-1">
                <Youtube className="h-4 w-4" />
                <span className="hidden sm:inline">YouTube GIF</span>
              </TabsTrigger>
              <TabsTrigger value="stock" className="gap-1">
                <Film className="h-4 w-4" />
                <span className="hidden sm:inline">Stock</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">AI Video</span>
              </TabsTrigger>
              <TabsTrigger value="upscale" className="gap-1">
                <ImageUp className="h-4 w-4" />
                <span className="hidden sm:inline">Upscale</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="youtube">
              <YouTubeToGifForm
                initialUrl={ytUrl}
                localVideo={selectedMedia?.kind === "video" ? selectedMedia : null}
              />
            </TabsContent>
            <TabsContent value="stock">
              <StockSearchGrid />
            </TabsContent>
            <TabsContent value="ai">
              <AiVideoGenerator />
            </TabsContent>
            <TabsContent value="upscale">
              <UpscalePanel initialFile={imageFile} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

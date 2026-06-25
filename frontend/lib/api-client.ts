const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || body.message || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(String(detail), response.status);
  }
  return response.json() as Promise<T>;
}

export const api = {
  baseUrl: API_URL,

  health: () => fetch(`${API_URL}/health`).then(handleResponse),

  youtubeToGif: (body: {
    url: string;
    start_time: number;
    end_time: number;
    remove_background: boolean;
    width?: number;
    fps?: number;
    quality?: string;
  }) =>
    fetch(`${API_URL}/api/v1/pipeline/youtube-to-gif`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleResponse<{ job_id: string; status: string }>),

  mp4ToGif: (body: {
    local_path: string;
    remove_background: boolean;
    width?: number;
    fps?: number;
    quality?: string;
  }) =>
    fetch(`${API_URL}/api/v1/pipeline/mp4-to-gif`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleResponse<{ job_id: string; status: string }>),

  getJob: (jobId: string) =>
    fetch(`${API_URL}/api/v1/jobs/${jobId}`).then(
      handleResponse<{
        id: string;
        status: string;
        progress: number;
        message: string;
        error: string | null;
        result_path: string | null;
        meta: Record<string, unknown>;
      }>,
    ),

  gifDownloadUrl: (jobId: string) =>
    `${API_URL}/api/v1/files/${jobId}/output.gif`,

  searchAssets: (q: string, page = 1) =>
    fetch(
      `${API_URL}/api/v1/assets/search?q=${encodeURIComponent(q)}&page=${page}`,
    ).then(
      handleResponse<{
        search_id: string | null;
        total_count: number;
        videos: Array<{
          id: string;
          description: string;
          duration: number;
          aspect_ratio: string;
          preview_url: string;
          thumbnail_url: string;
          contributor: string;
          asset_page: string;
        }>;
      }>,
    ),

  licenseAsset: (body: {
    video_id: string;
    size?: string;
    search_id?: string | null;
  }) =>
    fetch(`${API_URL}/api/v1/assets/license`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(
      handleResponse<{
        job_id: string;
        video_id: string;
        license_id: string;
        local_path: string;
      }>,
    ),

  generateVideo: (body: {
    prompt: string;
    image_size?: string;
    use_comfyui?: boolean;
  }) =>
    fetch(`${API_URL}/api/v1/assets/generate-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleResponse<{ job_id: string; status: string }>),

  comfyuiStatus: () =>
    fetch(`${API_URL}/api/v1/assets/comfyui/status`).then(
      handleResponse<{ enabled: boolean; available: boolean; host: string }>,
    ),

  upscale: (file: File, scale = 4) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_URL}/api/v1/ai/upscale?scale=${scale}`, {
      method: "POST",
      body: form,
    }).then(
      handleResponse<{ local_path: string; base64: string }>,
    );
  },

  uploadMp4: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_URL}/api/v1/upload/mp4`, {
      method: "POST",
      body: form,
    }).then(handleResponse<{ local_path: string; filename: string }>);
  },
};

export function parseTimestamp(value: string): number {
  const trimmed = value.trim();
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const num = parseFloat(trimmed);
  if (Number.isNaN(num)) throw new Error("Invalid timestamp");
  return num;
}

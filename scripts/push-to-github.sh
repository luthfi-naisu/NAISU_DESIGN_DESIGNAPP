#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/luthfi-naisu/NAISU_DESIGN_DESIGNAPP.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

if ! command -v git >/dev/null 2>&1; then
  echo "Git belum terinstall."
  echo "Jalankan: xcode-select --install"
  echo "Lalu ulangi script ini."
  exit 1
fi

if [ ! -d .git ]; then
  git init -b main
fi

git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"

git add -A
git status

if git diff --cached --quiet; then
  echo "Tidak ada perubahan untuk di-commit."
else
  git commit -m "$(cat <<'EOF'
Initial commit: Design App web platform.

Next.js frontend with unified media dropzone, YouTube/MP4 to GIF pipeline,
Shutterstock stock search, SiliconFlow AI video generation, and Replicate upscale.
FastAPI backend with yt-dlp, rembg, FFmpeg GIF encoder, and job polling.
EOF
)"
fi

echo ""
echo "Pushing ke $REPO_URL ..."
git push -u origin main

echo ""
echo "Selesai! Repository: $REPO_URL"

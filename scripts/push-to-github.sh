#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/luthfi-naisu/NAISU_DESIGN_DESIGNAPP.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUGITE_GIT="$ROOT/.tools/node_modules/dugite/git/bin"

cd "$ROOT"

# Prefer system git, fallback to portable git (dugite)
if command -v git >/dev/null 2>&1; then
  GIT=git
elif [ -x "$DUGITE_GIT/git" ]; then
  export PATH="$DUGITE_GIT:$PATH"
  export GIT_EXEC_PATH="$ROOT/.tools/node_modules/dugite/git/libexec/git-core"
  GIT=git
else
  echo "Git tidak ditemukan."
  echo "Install Xcode CLT: xcode-select --install"
  echo "Atau install dugite: npm install dugite --prefix .tools"
  exit 1
fi

if [ ! -d .git ]; then
  $GIT init -b main
fi

$GIT remote remove origin 2>/dev/null || true
$GIT remote add origin "$REPO_URL"

$GIT add -A

if ! $GIT diff --cached --quiet; then
  $GIT commit -m "$(cat <<'EOF'
Initial commit: Design App web platform.

Next.js frontend with unified media dropzone, YouTube/MP4 to GIF pipeline,
Shutterstock stock search, SiliconFlow AI video generation, and Replicate upscale.
FastAPI backend with yt-dlp, rembg, FFmpeg GIF encoder, and job polling.
EOF
)"
fi

echo ""
echo "Pushing ke $REPO_URL ..."
echo "Jika diminta login:"
echo "  Username: GitHub username Anda"
echo "  Password: Personal Access Token (bukan password akun)"
echo "  Buat token di: https://github.com/settings/tokens"
echo ""

$GIT push -u origin main

echo ""
echo "Selesai! Repository: $REPO_URL"

#!/usr/bin/env bash
# Deploy frontend to Vercel (requires: npx vercel login)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"

if ! command -v npx >/dev/null 2>&1; then
  echo "Node/npx required."
  exit 1
fi

echo "Deploying from frontend/ (Root Directory should be 'frontend' in Vercel dashboard)"
npx vercel@39 deploy --prod --yes

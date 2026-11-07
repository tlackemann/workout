#!/usr/bin/env bash
# Build locally, ship only what the server needs, install production deps there, restart.
#   npm run deploy
#   DEPLOY_HOST=tom@192.168.0.113 DEPLOY_DIR=/var/www/workout npm run deploy
#   npm run deploy -- --dry-run      # show what would be uploaded, change nothing
set -euo pipefail

HOST="${DEPLOY_HOST:-tom@192.168.0.113}"
DIR="${DEPLOY_DIR:-/var/www/workout}"
SERVICE="${DEPLOY_SERVICE:-gym-tv}"
PORT="${DEPLOY_PORT:-8787}"
DRY_RUN="${1:-}"

cd "$(dirname "$0")/.."

# What the server runs: built SPA + media, migrations, and the server/core/data source
# (Node 24 runs .ts directly). The database and node_modules on the server are never touched.
rsync_opts=(
  # Don't copy local owner/group/modes: new files take the server directory's group (setgid)
  # and stay group-writable, so a shared group like www-data keeps working across deploys.
  --no-owner --no-group --chmod=D2775,F664
  # Setting a directory's mtime requires owning it; with shared-group deploys we may not own
  # /var/www/workout itself (rsync would fail with code 23). File times are still preserved.
  --omit-dir-times
  --filter='P /data/'
  --filter='P /node_modules/'
  --exclude='*.test.ts' --exclude='*.test.tsx'
  --include='/package.json' --include='/package-lock.json'
  --include='/dist/***' --include='/drizzle/***'
  --include='/src/' --include='/src/core/***' --include='/src/data/***' --include='/src/server/***'
  --exclude='*'
)

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  rsync -az --delete --dry-run --itemize-changes "${rsync_opts[@]}" ./ "$HOST:$DIR/"
  exit 0
fi

npm run build
rsync -az --delete --info=stats1 "${rsync_opts[@]}" ./ "$HOST:$DIR/"

# -t so sudo can prompt for your password if it needs one.
ssh -t "$HOST" "set -e
  cd '$DIR'
  npm ci --omit=dev --no-audit --no-fund
  sudo systemctl restart '$SERVICE'
  sleep 2
  curl -fsS 'http://127.0.0.1:$PORT/api/health' && echo && echo 'Deployed ✔'"

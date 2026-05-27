#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

git fetch origin
git checkout main
git pull --ff-only origin main

corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @thunder-uno/game-server build
corepack pnpm --filter @thunder-uno/client-web build

pm2 startOrRestart ecosystem.config.cjs --only game-server --update-env
pm2 save
pm2 status game-server

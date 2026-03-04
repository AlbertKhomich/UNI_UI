#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-uni-ui-app}"
RUN_E2E="${RUN_E2E:-0}"

echo "[1/5] Installing dependencies"
npm ci

echo "[2/5] Running unit/integration tests"
npm run test

if [[ "$RUN_E2E" == "1" ]]; then
  echo "[3/5] Running end-to-end tests"
  npm run test:e2e
else
  echo "[3/5] Skipping end-to-end tests (set RUN_E2E=1 to enable)"
fi

echo "[4/5] Building application"
npm run build

echo "[5/5] Restarting PM2 app: $APP_NAME"
pm2 restart "$APP_NAME"
pm2 status
pm2 logs "$APP_NAME" --lines 80 --nostream

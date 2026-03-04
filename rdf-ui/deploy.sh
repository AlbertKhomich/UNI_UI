#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-uni-ui-app}"
RUN_E2E="${RUN_E2E:-0}"

echo "[1/6] Installing dependencies"
npm ci

echo "[2/6] Running lint checks"
npm run lint

echo "[3/6] Running unit/integration tests"
npm run test

if [[ "$RUN_E2E" == "1" ]]; then
  echo "[4/6] Running end-to-end tests"
  npm run test:e2e
else
  echo "[4/6] Skipping end-to-end tests (set RUN_E2E=1 to enable)"
fi

echo "[5/6] Building application"
npm run build

echo "[6/6] Restarting PM2 app: $APP_NAME"
pm2 restart "$APP_NAME"
pm2 status
pm2 logs "$APP_NAME" --lines 80 --nostream

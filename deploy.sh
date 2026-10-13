#!/usr/bin/env bash
set -e

echo "=== [1/5] Pulling latest changes from Git ==="
git fetch origin main
git reset --hard origin/main

echo "=== [2/5] Installing dependencies ==="
npm install

echo "=== [3/5] Pushing Prisma database schema ==="
npx prisma db push

echo "=== [4/5] Building Next.js application ==="
npm run build

echo "=== [5/5] Reloading or starting application via PM2 ==="
if pm2 describe track-kerjaan > /dev/null 2>&1; then
  echo "Process track-kerjaan found. Restarting..."
  pm2 restart track-kerjaan
else
  echo "Process track-kerjaan not found. Starting fresh..."
  PORT=${PORT:-3005} pm2 start npm --name "track-kerjaan" -- run start
fi
pm2 save

echo "=== Deployment completed successfully! ==="

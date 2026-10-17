#!/usr/bin/env bash
set -e

echo "=== [1/5] Pulling latest changes ==="
git pull origin main

echo "=== [2/5] Prisma generate ==="
npx prisma generate

echo "=== [3/5] Prisma db push ==="
npx prisma db push

echo "=== [4/5] Building Next.js ==="
npm run build

echo "=== [5/5] Restarting PM2 ==="
pm2 restart 5

echo "=== Deploy complete! ==="

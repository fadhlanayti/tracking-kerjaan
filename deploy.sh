#!/usr/bin/env bash
set -e

echo "=== [1/5] Pulling latest changes from Git ==="
git pull origin main

echo "=== [2/5] Installing dependencies ==="
npm install

echo "=== [3/5] Pushing Prisma database schema ==="
npx prisma db push

echo "=== [4/5] Building Next.js application ==="
npm run build

echo "=== [5/5] Restarting PM2 process ==="
pm2 restart track-kerjaan || pm2 restart all

echo "=== Deployment completed successfully! ==="

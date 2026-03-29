#!/usr/bin/env bash
set -euo pipefail

echo "==> Building frontend..."
cd frontend
npm run build
cd ..

echo "==> Embedding frontend into backend..."
rm -rf backend/internal/server/frontend
cp -r frontend/dist backend/internal/server/frontend

echo "==> Building backend..."
cd backend
go build -o abbado ./cmd/abbado
cd ..

echo "==> Done: backend/abbado"

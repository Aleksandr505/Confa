#!/usr/bin/env bash
set -euo pipefail

REG="${REGISTRY:-YOUR_DH_USERNAME}"
TAG="${TAG:-1.0.0}"

source ./deploy/client.build.env
CLIENT_ARGS=( --build-arg VITE_API_BASE="$VITE_API_BASE"
              --build-arg VITE_LIVEKIT_WS_URL="$VITE_LIVEKIT_WS_URL" )

# Spring Boot build
( cd backend && ./mvnw -q -DskipTests package )
cp backend/api/target/*.jar backend/api/target/app.jar

docker buildx create --use --name mybuilder >/dev/null 2>&1 || true

# API
docker buildx build --platform linux/amd64,linux/arm64 -t "$REG/api:$TAG" -f backend/api/Dockerfile backend/api --push

# CLIENT
docker buildx build --platform linux/amd64,linux/arm64 -t "$REG/client:$TAG" -f frontend/client/Dockerfile frontend/client \
  "${CLIENT_ARGS[@]}" --push

echo "Pushed: $REG/api:$TAG, $REG/client:$TAG"

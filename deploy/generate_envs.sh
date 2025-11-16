#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-prod}"

mkdir -p deploy

# ---------- Runtime (Compose) ----------
cat > deploy/.env <<'EOF'
# Runtime/Compose
API_IMAGE=yourusername/api:latest
CLIENT_IMAGE=yourusername/client:latest

APP_PORT=8080
APP_NAME=api
ACTIVE_PROFILES=prod

DB_HOST=mysql
DB_PORT=3306
DB_NAME=mydb
DB_USERNAME=myuser
DB_PASSWORD=mypassword
DB_ROOT_PASSWORD=rootpassword

PASSWORD_ENCODER_SECRET=change_me
JWT_SECRET=change_me
JWT_ACCESS_EXPIRATION=PT30M
JWT_REFRESH_EXPIRATION=PT12H

LIVEKIT_API_KEY=change_me
LIVEKIT_API_SECRET=change_me
EOF

# ---------- Build-time (Vite) ----------
cat > deploy/client.build.env <<'EOF'
# Build-time envs for Vite (client)
VITE_API_BASE=http://api:8080
VITE_LIVEKIT_WS_URL=wss://your.example.ru
EOF

echo "Generated deploy/.env, client.build.env for PROFILE=$PROFILE"

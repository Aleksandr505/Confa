# 🚀 Deployment Guide

Current canonical deployment runbook: [`../docs/operations/deployment.md`](../docs/operations/deployment.md).
Treat the rest of this file as legacy orientation if it conflicts with the runbook or current files in `deploy/`.

This document describes how to build, configure, and deploy the full application stack — including the backend (Spring Boot), frontend (Client & Admin, both built with React + Vite), and Docker Compose configuration.

---

## 🗁️ Project Structure

```
project-root/
├── backend/
│   └── api/                # Spring Boot backend
│       ├── Dockerfile
│       ├── pom.xml
│       └── src/...
├── frontend/
│   ├── client/             # Client SPA (Vite + React)
│   │   └── Dockerfile
│   └── admin/              # Admin SPA (Vite + React)
│       └── Dockerfile
└── deploy/
    ├── generate_envs.sh    # Script to generate environment files
    ├── build_push.sh       # Script to build & push Docker images
    ├── docker-compose.yml  # Production Docker Compose stack
    ├── .env                # Generated runtime env file
    ├── client.build.env    # Generated client build env file
    └── admin.build.env     # Generated admin build env file
```

---

## ⚙️ Initial Setup

Before running the scripts, make sure they are executable.\
If you see this error:

```
zsh: permission denied: ./generate_envs.sh
```

Run the following command to fix permissions:

```bash
chmod +x deploy/generate_envs.sh deploy/build_push.sh
```

---

## 🧬 Step 1: Generate Environment Files

The `generate_envs.sh` script automatically creates:

- `deploy/.env` — runtime environment for **Docker Compose** (backend & DB)
- `deploy/client.build.env` — build-time variables for **Client SPA**
- `deploy/admin.build.env` — build-time variables for **Admin SPA**

### Run:

```bash
./deploy/generate_envs.sh prod
```

or for local development:

```bash
./deploy/generate_envs.sh dev
```

After execution, you should see:

```
Generated deploy/.env, client.build.env, admin.build.env for PROFILE=prod
```

> ⚠️ **Important:** Before deployment, edit the generated `.env` file and replace placeholder secrets\
> (`JWT_SECRET`, `LIVEKIT_API_KEY`, etc.) with real values.

---

## 🏗️ Step 2: Build and Push Docker Images

The script `build_push.sh` builds and pushes the following Docker images:

- `api` — Spring Boot backend
- `client` — frontend SPA for users
- `admin` — admin panel SPA

### 1️⃣ Log in to Docker Hub

```bash
docker login
```

### 2️⃣ Build & Push Images

```bash
REGISTRY=your_dockerhub_username TAG=1.0.0 ./deploy/build_push.sh
```

After successful execution, you’ll see something like:

```
Pushed: your_dockerhub_username/api:1.0.0, your_dockerhub_username/client:1.0.0, your_dockerhub_username/admin:1.0.0
```

---

## 🧰 Step 3: Run Local Database (Optional)

If you want to test the Spring Boot backend locally without deploying everything,\
you can launch only the MySQL database from `backend/docker-compose.yml`:

```bash
cd backend
docker compose up -d
```

This will start a local MySQL instance with the same credentials as in your `.env`.

---

## ☁️ Step 4: Deploy to Server (Production)

1. Copy these files to your deployment directory on the server, e.g.:

   ```
   /opt/your-app/deploy/
   ```

   Files to copy:

   ```
   docker-compose.yml
   .env
   ```

2. On the server, run:

   ```bash
   cd /opt/your-app/deploy
   docker compose --env-file .env pull
   docker compose --env-file .env up -d
   ```

3. Check that containers are running:

   ```bash
   docker ps
   ```

4. View backend logs:

   ```bash
   docker compose logs -f api
   ```

---

## 🧠 Useful Commands

| Command                             | Description                    |
| ----------------------------------- | ------------------------------ |
| `docker compose ps`                 | Show running containers        |
| `docker compose down`               | Stop and remove all containers |
| `docker compose logs -f`            | Stream logs                    |
| `docker exec -it api sh`            | Enter backend container        |
| `docker compose --profile db up -d` | Start MySQL profile only       |

---

## 🌐 Environment Variables Overview

| Variable                        | Description               | Used in            |
| ------------------------------- | ------------------------- | ------------------ |
| `APP_PORT`                      | Backend port              | backend/api        |
| `DB_HOST`, `DB_PORT`            | MySQL connection          | backend/api        |
| `DB_USERNAME`, `DB_PASSWORD`    | Database credentials      | backend/api        |
| `JWT_SECRET`, `LIVEKIT_API_KEY` | App secrets               | backend/api        |
| `VITE_API_BASE`                 | Base API URL for frontend | client/admin build |
| `VITE_LIVEKIT_WS_URL`           | LiveKit WebSocket URL     | client/admin build |

---

## 🔧 Full Workflow Example

```bash
# 1. Generate environment files
./deploy/generate_envs.sh prod

# 2. Build and push all Docker images
REGISTRY=yourdockerhub TAG=1.0.0 ./deploy/build_push.sh

# 3. On the server: pull and start containers
docker compose --env-file ./deploy/.env pull
docker compose --env-file ./deploy/.env up -d
```

---

## 🔧 Migrations after deploy

Download library `mysql-connector-j-8.3.0.jar` and put it to the directory `deploy/libs`

```bash
cd deploy
```

```bash
docker run --rm \
-v "../backend/api/src/main/resources":/liquibase/changelog \
--network shared_web \
liquibase/liquibase:latest \
--url="jdbc:mysql://mysql:3306/${DB_NAME}" \
--changeLogFile="space/confa/api/db/changelog/liquibase-changelog.yaml" \
--username="${DB_USERNAME}" \
--password="${DB_PASSWORD}" \
update
```

---

## 📞 Notes

- `VITE_*` variables are **baked in at build time** (used by Vite during `npm run build`).\
  If you need dynamic runtime configuration (changing API endpoint without rebuilding),\
  you can use the \`\`\*\* + config.js\*\* runtime injection pattern for Nginx.

- `.env` files should **not be committed** to version control.\
  Add this to `.gitignore`:

  ```
  /deploy/.env
  /deploy/*.build.env
  ```

- Each environment (dev, staging, prod) can have its own `.env` and build envs.

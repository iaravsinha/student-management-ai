# Student Management System with AI Assistant

Production-oriented monorepo with:
- `frontend` (Next.js)
- `backend` (FastAPI + PostgreSQL + Redis)
- `ai-service` (FastAPI assistant, connected to backend data)

This repository is now wired for secure auth defaults:
- public self-signup is disabled
- first admin is created once via bootstrap endpoint
- after bootstrap, only admins can create new users
- role permissions are centralized and exposed through `/auth/permissions`
- user/data changes and AI actions are stored in database audit logs
- admins can bulk-import students from `.xlsx` files
- the AI assistant returns structured commands before executing allowed operations

## Prerequisites

- Docker Desktop (with Docker Compose v2)
- Node.js 20+ (only if running frontend outside Docker)
- Python 3.11+ (only if running services outside Docker)

## 1) Initialize From Scratch (Docker Local)

Windows (PowerShell) commands are shown first, with Unix alternatives where needed.

1. Copy env file:

```bash
# PowerShell (Windows)
Copy-Item .env.example .env

# Bash/macOS/Linux
cp .env.example .env
```

2. Open `.env` in your editor and set these values (this is where you enter keys/secrets):
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `DATABASE_URL` (compose-local example: `postgresql+psycopg2://<user>:<pass>@db:5432/<db>`)
- `REDIS_URL` (compose-local example: `redis://redis:6379/0`)
- `JWT_SECRET` (use a long random value, 32+ chars)
- `BACKEND_CORS_ORIGINS` (comma-separated, include `http://localhost:3000`)
- `LLM_PROVIDER` (`openrouter`, `groq`, or `gemini`)
- `LLM_MODEL` (model name for your provider)
- one provider key matching `LLM_PROVIDER`:
  - `OPENROUTER_API_KEY` for OpenRouter
  - `GROQ_API_KEY` for Groq
  - `GEMINI_API_KEY` for Gemini

`OPENAI_API_KEY` is optional/legacy and is not required for the current command flow.

3. Start stack:

```bash
docker compose up -d --build
```

The backend now runs `alembic upgrade head` automatically on startup.

4. Bootstrap first admin (only works if no admin exists yet):

```bash
# PowerShell (Windows)
Invoke-RestMethod -Method Post http://localhost:8000/auth/bootstrap-admin `
  -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"ChangeMe123!"}'

# curl alternative
curl -X POST http://localhost:8000/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}'
```

5. Login from UI:
- Frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`
- AI health: `http://localhost:8001/health/live`

## 2) Admin User Provisioning (After Bootstrap)

Use an admin access token:

```bash
curl -X POST http://localhost:8000/auth/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@example.com","password":"Teacher123!","role":"teacher","is_active":true}'
```

Notes:
- `POST /auth/register` is intentionally blocked.
- `/signup` frontend page is informational only.

## 3) Local Deployment (Docker Dev Stack)

- Start: `make up`
- Stop: `make down`
- Logs: `make logs`
- Status: `make ps`

Services:
- frontend: `3000`
- backend: `8000`
- ai-service: `8001`
- postgres: `5432`
- redis: `6379`

If `make` is unavailable on Windows, use direct Docker commands:
- Start: `docker compose up -d --build`
- Stop: `docker compose down`
- Logs: `docker compose logs -f --tail=150`
- Status: `docker compose ps`

## 4) Production Deployment (Nginx Reverse Proxy)

1. Prepare `.env` with production values:
- strong `JWT_SECRET`
- production DB/Redis URLs
- `NEXT_PUBLIC_BACKEND_URL=/api`
- `NEXT_PUBLIC_AI_SERVICE_URL=/ai`
- `BACKEND_CORS_ORIGINS=https://<your-domain>`

2. Deploy:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3. Verify:
- app root via nginx: `http://<host>/`
- backend live: `http://<host>/api/health/live`
- ai live: `http://<host>/ai/health/live`

TLS enablement:
- mount certs under `docker/certs`
- enable `443` mapping in `docker-compose.prod.yml`
- uncomment SSL server block in `docker/nginx.conf`

## 5) Test and Validation Checklist

### Service Health

```bash
curl http://localhost:8000/health/live
curl http://localhost:8001/health/live
```

### Auth Flow

1. Bootstrap admin (once)
2. `POST /auth/login` with admin credentials
3. `GET /auth/me` with bearer token

### Core API Flow

- Create/list students (`/students`)
- Mark attendance and read percentage (`/attendance`)
- Check timetable endpoints (`/timetable`)

### AI Flow

Use logged-in frontend and open `/chat`, or call directly:

```bash
curl -X POST http://localhost:8001/ai/query \
  -H "Authorization: Bearer <USER_OR_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"student_id":1,"query":"Show weak subjects"}'
```

Attendance command preparation:

```bash
curl -X POST http://localhost:8001/ai/query \
  -H "Authorization: Bearer <TEACHER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"timetable_id":1,"date":"2026-05-02","query":"Mark all present except roll 4 5 6","execute":false}'
```

Set `execute` to `true` only when the selected teacher is allowed to mark that class. The AI service sends structured commands through the backend, where RBAC and class ownership checks are enforced.

Key placement reminder:
- frontend/backend/ai-service all read from root `.env` when running through Docker Compose.
- do not place API keys inside `frontend/.env`; keep provider keys only in root `.env`.

### Bulk Student Import

Admins can upload `students.xlsx` to:

```bash
curl -X POST http://localhost:8000/students/import \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -F "file=@students.xlsx"
```

Required columns: `name`, `email`, `department`, `batch_year`, `semester`.

## 6) Useful Commands

- `make build` - build dev images
- `make migrate-create` - generate alembic migration
- `make migrate-upgrade` - apply migrations
- `make up-prod` - start production compose stack
- `make down-prod` - stop production compose stack
- `make logs-prod` - production logs

## 7) Non-Docker Local Dev (Optional)

Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

AI service:
```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```


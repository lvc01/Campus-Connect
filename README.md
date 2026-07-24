# CU Campus Connect

A verified, university-email-only social platform for Chandigarh University (CU) students — combining a social feed, clubs & societies, events, academic resources, marketplace, and real-time messaging in one platform.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router) + Tailwind CSS |
| **Backend** | FastAPI (Python 3.12) + Gunicorn |
| **Database** | PostgreSQL 16 + SQLAlchemy 2.0 (async) |
| **Cache / PubSub** | Redis 7 |
| **Auth** | JWT (access + refresh tokens in httpOnly cookies) + OTP email verification |
| **Real-time** | WebSockets (chat + notifications) |
| **File Storage** | Cloudflare R2 / S3-compatible |
| **Reverse Proxy** | nginx (TLS, rate limiting, CSP) |
| **Deployment** | Docker Compose |

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone and enter the project
cd "Campus Connect"

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, JWT secrets, OTP method, etc.

# 3. Start services (builds API + frontend images)
docker compose up --build

# 4. Open API docs
open http://localhost:8000/docs
```

### Option 2: Manual Setup (Development)

```bash
# 1. Start PostgreSQL and Redis (ensure they're running locally)

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env   # edit DATABASE_URL, REDIS_URL, etc.
alembic upgrade head
uvicorn app.main:app --reload --port 8001

# 3. Frontend (separate terminal)
cd frontend
npm ci
npm run dev
```

### Quick start (backend + frontend together)

From the project root, after the manual setup above is complete:

```bash
./dev.sh
```

This runs the API on `http://localhost:8001` and the web app on `http://localhost:3000` in the same terminal, with prefixed output and combined Ctrl-C shutdown. Use `./stop.sh` to clean up any stray processes.

Flags: `./dev.sh --backend-only`, `./dev.sh --frontend-only`, `./dev.sh --no-color`.
Env overrides: `BACKEND_PORT=8001`, `FRONTEND_PORT=3000`, `LOG_DIR=/tmp`.

## Services

| Service | Port | Description |
|---------|------|-------------|
| `nginx` | 80, 443 | Reverse proxy, TLS termination, rate limiting |
| `api` | 8000 (internal) | FastAPI backend (4 Gunicorn workers) |
| `frontend` | 3000 (internal) | Next.js production server |
| `db` | 5432 (internal) | PostgreSQL 16 |
| `redis` | 6379 (internal) | Redis 7 (PubSub + rate limiting + presence) |
| `migrate` | — | One-shot Alembic migration (runs before API starts) |
| `pgbackup` | — | Daily Postgres backups with retention |
| `certbot` | — | Automatic TLS certificate renewal |

## API Documentation

Once the server is running, visit:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

## Project Structure

```
backend/
├── alembic/              # Database migrations
├── app/
│   ├── api/v1/           # Route handlers (auth, users, ...)
│   ├── core/             # Database, security, dependencies, exceptions
│   ├── models/           # SQLAlchemy ORM models
│   ├── schemas/          # Pydantic request/response models
│   ├── services/         # Business logic layer
│   ├── utils/            # Pagination, validators, helpers
│   └── websocket/        # WebSocket manager + handler
├── Dockerfile            # Multi-stage production image (gunicorn)
└── tests/                # Pytest test suite

frontend/
├── src/                  # Next.js App Router pages & components
├── Dockerfile            # Multi-stage production image (standalone)
└── package.json
```

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

## Environment Variables

See [`.env.example`](.env.example) for the full list.

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://...` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `REDIS_ENABLED` | Enable Redis (false for local dev without Redis) | `true` |
| `JWT_ACCESS_SECRET` | Secret key for access tokens | — |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | — |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated university email domains | `cuchd.in` |
| `OTP_DELIVERY_METHOD` | `console` for dev, `smtp` for production | `console` |
| `CORS_ORIGINS` | Allowed frontend origins | `http://localhost:3000` |
| `STORAGE_PROVIDER` | `local` or `s3` | `local` |
| `ENVIRONMENT` | `development`, `staging`, or `production` | `development` |

## License

Private — All rights reserved.


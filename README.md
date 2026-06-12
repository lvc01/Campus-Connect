# CU Campus Connect

A verified, university-email-only social platform for Chandigarh University (CU) students — combining a social feed, clubs & societies, events, academic resources, marketplace, and real-time messaging in one platform.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS |
| **Backend** | FastAPI (Python 3.12) |
| **Database** | PostgreSQL 16 + SQLAlchemy 2.0 (async) |
| **Auth** | JWT (access + refresh tokens) + OTP email verification |
| **Real-time** | WebSockets (chat + notifications) |
| **File Storage** | Cloudflare R2 |
| **Deployment** | Docker + Railway / Render |

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone and enter the project
cd "Campus Connect"

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env with your settings

# 3. Start services
docker-compose up --build

# 4. Open API docs
open http://localhost:8000/docs
```

### Option 2: Manual Setup

```bash
# 1. Start PostgreSQL (ensure it's running on port 5432)

# 2. Create virtual environment
cd backend
python -m venv .venv
source .venv/bin/activate  # macOS/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy environment variables
cp ../.env.example ../.env
# Edit .env with your database URL

# 5. Run database migrations
alembic upgrade head

# 6. Start the development server
uvicorn app.main:app --reload --port 8001
```

### Quick start (backend + frontend together)

From the project root, after the manual setup above is complete:

```bash
./dev.sh
```

This runs the API on `http://localhost:8001` and the web app on `http://localhost:3000` in the same terminal, with prefixed output and combined Ctrl-C shutdown. Use `./stop.sh` to clean up any stray processes.

Flags: `./dev.sh --backend-only`, `./dev.sh --frontend-only`, `./dev.sh --no-color`.
Env overrides: `BACKEND_PORT=8001`, `FRONTEND_PORT=3000`, `LOG_DIR=/tmp`.

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
│   └── utils/            # Pagination, validators, helpers
└── tests/                # Pytest test suite
```

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://...` |
| `JWT_ACCESS_SECRET` | Secret key for access tokens | — |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | — |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated university email domains | `cuchd.in` |
| `OTP_DELIVERY_METHOD` | `console` for dev, `smtp` for production | `console` |
| `CORS_ORIGINS` | Allowed frontend origins | `http://localhost:3000` |

See [`.env.example`](.env.example) for the full list.

## License

Private — All rights reserved.

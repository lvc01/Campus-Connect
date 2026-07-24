# Campus Connect — Free-tier Deployment Guide

Everything below runs on free tiers only. No credit card required for any of
the providers (except Cloudflare R2, where the free tier asks for one but
never charges it).

## Architecture at a glance

```
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│  Vercel (Free)     │     │  Render (Free)     │     │  Supabase (Free)   │
│  Next.js frontend  │ ──► │  FastAPI backend   │ ──► │  Postgres          │
│  https://*.vercel  │     │  *.onrender.com    │     │  500MB              │
└────────────────────┘     └────────────────────┘     └────────────────────┘
                                  │
                                  ├──► Upstash Redis (Free) — rate-limit + WS pubsub
                                  │
                                  ├──► Cloudflare R2 (Free) — uploaded media
                                  │
                                  └──► Upstash Search (Free) — full-text search
                                                                  (or ILIKE fallback)

UptimeRobot (Free) pings https://<srv>.onrender.com/api/v1/health/ping every
5 minutes to defeat Render's 15-minute idle sleep.
```

## Account setup (≈ 25 minutes, parallel)

1. Create accounts on **Supabase**, **Upstash (Redis + Search)**, **R2**,
   **Vercel**, **Render**, **UptimeRobot**.
2. Generate credentials locally:
   ```bash
   echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
   echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
   ```

## Database (Supabase)

1. Create a `project` (free). Use the **Direct connection** pool (port 5432),
   not the transactional pool — we use asyncpg, which plays well with both,
   but direct gives us the full 60-conn budget.
2. Copy the schema:
   ```bash
   # From your local dev Postgres
   python backend/scripts/dump_schema.py > infra/schema.sql
   ```
3. In the Supabase SQL Editor, paste + run `infra/schema.sql`.
4. Stamp the alembic head against the production DB the first time you
   boot the Render service — the startup command does this through
   `scripts/create_all_schema.py`.

## Backend (Render)

1. Sign in at render.com with GitHub.
2. New → **Blueprint** → point at this repo → use `infra/render.yaml`.
3. Once the service is created, populate **Environment Variables** with
   the values from `.env.production.example`.
4. First deploy runs `create_all_schema.py` then `uvicorn`.
5. Verify: `curl https://<srv>.onrender.com/api/v1/health/ping` returns 200.

## Frontend (Vercel)

1. Import this repo from GitHub.
2. Framework preset: **Next.js**, Root dir: `frontend`.
3. Environment variable: `BACKEND_INTERNAL_URL=https://<srv>.onrender.com`.
4. Vercel build runs `next build`. Output `standalone` is configured in
   `next.config.ts` but Vercel uses its' own server runtime, so this is
   a graceful default.
5. Hit the Vercel URL — login as `rohan.sharma@cuchd.in` / `password123`
   to validate cookies over the cross-site boundary.

## PWA validation

- **Lighthouse / Chrome DevTools** → Application tab should list a
  registered service worker `/sw.js` + a valid manifest.
- **Mobile install:**
  - **iOS Safari** → Share → "Add to Home Screen".
  - **Android Chrome** → install pill or menu → "Install app".

## Worker / search

- The server itself runs the APScheduler-driven reindex at startup. No
  separate Render service required. Saves hours against the free budget.

## Keep-alive ping

- **UptimeRobot** free plan:
  - Monitor URL: `https://<srv>.onrender.com/api/v1/health/ping`
  - Monitoring interval: **5 minutes** (prevents Render sleep).
- If you have your own monitor (`cron-job.org` etc.), `infra/keep_alive.sh`
  is the canonical curl pattern.

## QR code

1. Visit https://www.qrcode-monkey.com/ (free, no signup).
2. Paste your deployed Vercel URL.
3. Download the PNG; drop into the repo as `qr.png`.
4. Embed in README for easy phone-scan demos.

## Cross-site auth — what changed

The frontend (Vercel) and backend (Render) live on different domains.
Cookies must be `Secure + SameSite=None` so browsers accept them across
origins. The backend (`backend/app/api/v1/auth.py`) now sets:

```python
is_prod = settings.ENVIRONMENT == "production"
same_site = "none" if is_prod else "lax"
secure = is_prod
```

Locally, behavior is unchanged (`SameSite=Lax`, no `Secure`) to keep dev
tunnels working. The CSRF double-submit middleware
(`backend/app/core/csrf.py`) is still active — the JS client must echo
the `cc_csrf` cookie value as the `X-CSRF-Token` header on every state-
changing request.

## Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend dies after 1 deploy | DB migrations failed, exception in startup | Render logs → check the create_all output |
| Login redirects to "no cookie" | CORS_ORIGINS missing | Add `https://<vercel-name>.vercel.app` to Render env |
| Vercel → 504 on /api/v1 | Backend sleeping | UptimeRobot ping was off; wait 30s + reload |
| SW registers then disappears | Next.js dev mode | The init only runs in production by default |
| 404 on /manifest.webmanifest | Build cache stale | `vercel --prod` or trigger manual deploy |
| Alembic errors in startup | Not running create_all_schema | Confirm `startCommand` in render.yaml |

## Smoke checklist

```bash
# Replace with your real values.
API=https://<srv>.onrender.com
WEB=https://<name>.vercel.app

# Health
curl -fsS "$API/api/v1/health/ping"  # → 200

# Cross-site cookie
curl -fsSL -c /tmp/cookies.txt -X POST "$WEB/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"rohan.sharma@cuchd.in","password":"password123"}'

# Brand new redirect should keep cookies
grep cc_access_token /tmp/cookies.txt  # → present
```

🎉 Done.

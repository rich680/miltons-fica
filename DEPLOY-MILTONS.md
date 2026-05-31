# Miltons Matsemela — FICA Portal Deploy Guide

## Overview
This is a branded demo instance of the FICA Compliance Portal for Miltons Matsemela.
- Frontend: Netlify (React/Vite SPA)
- Backend:  Railway (Node/Express API)
- Database: Railway PostgreSQL
- Storage:  Cloudflare R2 (shared bucket, separate folder prefix)

---

## Step 1 — Create Railway project

1. Go to https://railway.app → New Project → Empty Project
2. Name it: `miltons-fica`
3. Add a service → Database → PostgreSQL
4. Add a service → Empty Service → name it `api`
5. In the api service → Settings → Source: GitHub repo (push this repo to GitHub first)
6. Set root directory: `/` (server.js is at root)
7. Copy the DATABASE_URL from the Postgres service → add as env var on the api service

**Required env vars on Railway api service:**
```
DATABASE_URL=         (auto-set from Postgres)
JWT_SECRET=           (any long random string)
EMAIL_USER=           (Gmail address for notifications)
EMAIL_PASS=           (Gmail App Password)
R2_ACCOUNT_ID=        (Cloudflare R2 — can reuse TP account, different prefix)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
FRONTEND_URL=         (set after Netlify deploy)
```

---

## Step 2 — Push to GitHub

```bash
cd "Miltons-Demo"
git remote add origin https://github.com/YOUR_USERNAME/miltons-fica.git
git push -u origin main
```

---

## Step 3 — Deploy frontend to Netlify

1. Go to https://app.netlify.com → Add new site → Import from Git
2. Select the `miltons-fica` repo
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variable:
   ```
   VITE_API_URL=https://YOUR-RAILWAY-URL.railway.app
   ```
6. Deploy — note the Netlify URL (e.g. `https://miltons-fica.netlify.app`)
7. Go back to Railway → api service → add env var:
   ```
   FRONTEND_URL=https://miltons-fica.netlify.app
   ```

---

## Step 4 — Seed a demo manager account

After the Railway service is running, hit the API once to initialise the DB:
```
GET https://YOUR-RAILWAY-URL.railway.app/health
```

Then create the first manager login via the `/api/auth/register` endpoint or
directly insert into the `users` table via Railway's Postgres console:

```sql
INSERT INTO users (name, email, password_hash, role)
VALUES ('Demo Manager', 'demo@miltons.law.za', '<bcrypt hash>', 'manager');
```

Or use the Agents page once logged in as any existing manager.

---

## Demo credentials (set these up before Thursday)
| Name | Email | Role |
|------|-------|------|
| Demo Manager | demo@miltons.law.za | manager |
| Demo Agent   | agent@miltons.law.za | agent |

---

## Brand colours reference
| Element | Hex |
|---------|-----|
| Sidebar / background | `#0D0D0D` |
| Primary orange (buttons, active nav) | `#e77204` |
| Orange hover | `#c56003` |
| White text | `#f1f5f9` |
| Muted text | `#8a8a8a` |

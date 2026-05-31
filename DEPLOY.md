# MM FICA Compliance — Deploy Guide

## Stack Overview

| Layer | Technology | Host |
|-------|-----------|------|
| Frontend | React 18 + Vite | Netlify |
| Backend API | Express 5 (Node.js) | Railway |
| Database | PostgreSQL | Railway |

---

## Local Development

### Prerequisites
- Node.js 18+
- A running PostgreSQL instance (or Railway dev environment)

### Setup

```bash
cd "Miltons-FICA Compliance"
npm install
```

Create a `.env` file in the project root (gitignored):

```
VITE_API_URL=http://localhost:3001
DATABASE_URL=postgresql://user:password@localhost:5432/tp_fica
JWT_SECRET=your-secret-key
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
```

Start the backend:
```bash
node server.js
```

Start the frontend (separate terminal):
```bash
npm run dev
```

Open http://localhost:5173

**Demo credentials:**
- Manager: richard@trustproperty.co.za / Trust@2026
- Agent: agent1@trustproperty.co.za / Agent@2026

---

## Production Deployment

### Backend — Railway

The backend (server.js) is deployed on Railway using Nixpacks.

**Environment variables to set in Railway dashboard:**
```
DATABASE_URL        (auto-set by Railway PostgreSQL plugin)
JWT_SECRET          your-secret-key
EMAIL_USER          your@gmail.com
EMAIL_PASS          your-gmail-app-password
NODE_ENV            production
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD  true
PUPPETEER_EXECUTABLE_PATH         /usr/bin/chromium
```

**Deploy:** Push to `main` branch on GitHub — Railway auto-deploys.

Health check endpoint: `GET /api/health`

---

### Frontend — Netlify

The frontend (React/Vite) is deployed on Netlify.

`netlify.toml` handles build config and SPA redirects automatically:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true"
  PUPPETEER_SKIP_DOWNLOAD = "true"
  VITE_API_URL = "https://mm-fica-compliance-production.up.railway.app"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Deploy:** Push to `main` branch — Netlify auto-deploys.

> Note: `VITE_API_URL` is baked into the bundle at build time. If the Railway URL changes, update `netlify.toml` and redeploy.

---

## Git Workflow

This project uses a CIFS-mounted folder. Due to filesystem constraints, **always commit and push from the Windows terminal**, not from bash:

```
git add .
git commit -m "your message"
git push origin main
```

Both Netlify and Railway will auto-deploy on push to `main`.

---

## App Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | /dashboard | KPI overview — parties screened, docs pending, risk breakdown |
| Clients | /clients | Identity registry — client details stored once, reused across transactions |
| Transactions | /transactions | Transaction register — add parties, track compliance per deal |
| Screening | /screening | 6-step guided workflow: Select Party → FIC → UN → PEP → Adverse Media → Confirm |
| Risk Rating | /risk-rating | Weighted risk matrix — Low / Medium / High per party |
| UBO / Entities | /ubo | Ultimate Beneficial Owner register for companies and trusts |
| Reports | /reports | FICA compliance report per transaction |
| PEP Auth | /pep-auth | Manager queue for PEP authorisation requests |
| Agents | /agents | User management (manager role only) |

---

## Architecture Notes

- **transaction_parties** is the core compliance table. Each party represents a client in a specific role on a specific transaction. Screening results, documents, and risk ratings are stored per party — not per client — so the same client can have fresh compliance records on each deal.
- **Re-screening** is flagged automatically if a client's last screening was more than 12 months ago.
- **PEP flow** requires senior management authorisation before screening can be finalised. Managers are notified by email.

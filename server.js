/** v2 - agency staff routes included
 * MM FICA Compliance — Backend API Server
 * Express + PostgreSQL + Puppeteer
 * Start: node server.js  |  Runs on: http://localhost:3001
 */

import express from 'express'
import cors from 'cors'
import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import multer from 'multer'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Cloudflare R2 client ────────────────────────────────────────────────────
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})
const R2_BUCKET = process.env.R2_BUCKET || 'mm-fica-docs'
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const app = express()
const PORT = process.env.PORT || 3001

// ── Database ──────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
})

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'agent',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      id_number VARCHAR(100) DEFAULT '',
      type VARCHAR(50) DEFAULT 'Individual SA',
      agent_id INTEGER,
      date_of_birth DATE,
      place_of_birth VARCHAR(100) DEFAULT '',
      nationality VARCHAR(100) DEFAULT '',
      fic_status VARCHAR(20) DEFAULT 'pending',
      un_status VARCHAR(20) DEFAULT 'pending',
      pep_status VARCHAR(20) DEFAULT 'pending',
      adverse_media_status VARCHAR(20) DEFAULT 'pending',
      risk_score INTEGER,
      risk_rating VARCHAR(20),
      risk_criteria JSONB DEFAULT '{}',
      screening_notes TEXT DEFAULT '',
      review_date DATE,
      docs JSONB DEFAULT '{}',
      fic_screenshot TEXT,
      un_screenshot TEXT,
      screening_date DATE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE clients ADD COLUMN IF NOT EXISTS ubos JSONB DEFAULT '[]';
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS pep_form JSONB DEFAULT NULL;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS pep_auth_status VARCHAR(20) DEFAULT NULL;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS transaction_id INTEGER DEFAULT NULL;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS pep_auth_note TEXT DEFAULT NULL;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS pep_auth_by INTEGER DEFAULT NULL;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS pep_auth_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS otp_lease JSONB DEFAULT NULL;

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER,
      type VARCHAR(100) DEFAULT '',
      property VARCHAR(255) DEFAULT '',
      value BIGINT DEFAULT 0,
      status VARCHAR(50) DEFAULT 'In Progress',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transaction_parties (
      id SERIAL PRIMARY KEY,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      role VARCHAR(50) DEFAULT 'Buyer',
      fic_status VARCHAR(20) DEFAULT 'pending',
      un_status VARCHAR(20) DEFAULT 'pending',
      pep_status VARCHAR(20) DEFAULT 'pending',
      adverse_media_status VARCHAR(20) DEFAULT 'pending',
      fic_screenshot TEXT,
      un_screenshot TEXT,
      risk_score INTEGER,
      risk_rating VARCHAR(20),
      risk_criteria JSONB DEFAULT '{}',
      screening_notes TEXT DEFAULT '',
      screening_date DATE,
      review_date DATE,
      docs JSONB DEFAULT '{}',
      pep_form JSONB,
      pep_auth_status VARCHAR(20),
      pep_auth_note TEXT,
      pep_auth_by INTEGER,
      pep_auth_at TIMESTAMP,
      ubos JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(transaction_id, client_id)
    );

    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
    ALTER TABLE transaction_parties ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
    ALTER TABLE transaction_parties ADD COLUMN IF NOT EXISTS screening_reminded_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE transaction_parties ADD COLUMN IF NOT EXISTS risk_reminded_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE transaction_parties ADD COLUMN IF NOT EXISTS docs_reminded_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS overdue_reminded_at TIMESTAMP DEFAULT NULL;

    -- Agency Staff
    ALTER TABLE agency_staff ADD COLUMN IF NOT EXISTS dob DATE DEFAULT NULL;
    CREATE TABLE IF NOT EXISTS agency_staff (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name         VARCHAR(255) NOT NULL,
      id_number    VARCHAR(50),
      role         VARCHAR(100),
      start_date   DATE,
      id_doc_url   TEXT,
      status       VARCHAR(20) DEFAULT 'active',
      created_at   TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS staff_screenings (
      id           SERIAL PRIMARY KEY,
      staff_id     INTEGER NOT NULL REFERENCES agency_staff(id) ON DELETE CASCADE,
      year         INTEGER NOT NULL,
      tfs_status   VARCHAR(20) DEFAULT 'pending',
      un_status    VARCHAR(20) DEFAULT 'pending',
      tfs_screenshot TEXT,
      un_screenshot  TEXT,
      notes        TEXT DEFAULT '',
      screened_at  TIMESTAMP DEFAULT NOW(),
      screened_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      screened_by_name VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER,
      user_name    VARCHAR(100),
      action       VARCHAR(60) NOT NULL,
      entity_type  VARCHAR(50),
      entity_id    INTEGER,
      entity_label VARCHAR(255),
      detail       TEXT,
      created_at   TIMESTAMP DEFAULT NOW()
    );
  `)

  // Seed default manager
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@miltons.law.za'])
  if (rows.length === 0) {
    const hash = bcrypt.hashSync('Trust@2026', 10)
    await pool.query('INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4)',
      ['Richard', 'admin@miltons.law.za', hash, 'manager'])
    console.log('[DB]   Default manager created')
  }
  console.log('[DB]   Ready')

  // Auto-import all users into agency_staff if not already present
  const { rows: allUsers } = await pool.query('SELECT id, name FROM users')
  for (const u of allUsers) {
    const { rows: existing } = await pool.query('SELECT id FROM agency_staff WHERE user_id = $1', [u.id])
    if (existing.length === 0) {
      await pool.query('INSERT INTO agency_staff (user_id, name) VALUES ($1, $2)', [u.id, u.name])
      console.log(`[DB]   Auto-imported user ${u.name} to agency_staff`)
    }
  }
}

// ── Email ─────────────────────────────────────────────────────────────────────
// Resend HTTP API (avoids Railway SMTP port blocks)
import { Resend } from 'resend'
import cron from 'node-cron'

// SMTP_FROM must be a domain verified in Resend. If unset, fall back to
// Resend's shared test sender so emails actually arrive during setup.
const EMAIL_FROM = process.env.SMTP_FROM || 'onboarding@resend.dev'
const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

async function sendPepAlert({ clientName, agentName }) {
  if (!resendClient) {
    console.log('[Email] Resend not configured — skipping PEP alert email')
    return
  }
  try {
    const { rows: managers } = await pool.query(`SELECT email, name FROM users WHERE role = 'manager'`)
    if (managers.length === 0) return
    const to = managers.map(m => m.email)
    const from = EMAIL_FROM
    await resendClient.emails.send({
      from,
      to,
      subject: `PEP Authorisation Required — ${clientName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <div style="background:#111111;padding:20px 24px;border-radius:8px 8px 0 0">
            <h2 style="color:#fff;margin:0;font-size:1.1rem">MM FICA Compliance — PEP Alert</h2>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
            <p style="margin:0 0 12px;color:#374151">A client has been flagged as a <strong>Politically Exposed Person (PEP)</strong> and requires your authorisation before screening can be completed.</p>
            <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
              <tr><td style="padding:8px 0;color:#6b7280;width:120px">Client</td><td style="padding:8px 0;color:#111827;font-weight:600">${clientName}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Submitted by</td><td style="padding:8px 0;color:#111827">${agentName}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0;color:#111827">${new Date().toLocaleDateString('en-ZA')}</td></tr>
            </table>
            <div style="margin-top:20px;padding:14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px">
              <strong style="color:#b91c1c">Action Required:</strong>
              <span style="color:#7f1d1d"> Please log in to the MM FICA Compliance app and navigate to <em>PEP Authorisations</em> to review and approve or reject this screening.</span>
            </div>
          </div>
        </div>
      `,
    })
    console.log(`[Email] PEP alert sent to ${to.join(', ')}`)
  } catch (err) {
    console.error('[Email] Failed to send PEP alert:', err.message)
  }
}

const OVERDUE_DAYS = 14

// ── Reminder Email Helpers ────────────────────────────────────────────────────

function overdueEmailHtml({ agentName, items, forManager = false }) {
  const intro = forManager
    ? `The following compliance items are overdue across all transactions:`
    : `You have compliance items that are now overdue and require your attention:`
  const rows = items.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#111827;font-weight:600">${item.clientName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#374151">${item.transaction}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#374151">${item.type}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#dc2626;font-weight:700">${item.daysOverdue}d overdue</td>
      ${forManager ? `<td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#6b7280">${item.agentName || ''}</td>` : ''}
    </tr>`).join('')
  const headers = forManager
    ? '<th style="padding:10px 12px;background:#f1f5f9;text-align:left">Client</th><th style="padding:10px 12px;background:#f1f5f9;text-align:left">Transaction</th><th style="padding:10px 12px;background:#f1f5f9;text-align:left">Issue</th><th style="padding:10px 12px;background:#f1f5f9;text-align:left">Overdue</th><th style="padding:10px 12px;background:#f1f5f9;text-align:left">Agent</th>'
    : '<th style="padding:10px 12px;background:#f1f5f9;text-align:left">Client</th><th style="padding:10px 12px;background:#f1f5f9;text-align:left">Transaction</th><th style="padding:10px 12px;background:#f1f5f9;text-align:left">Issue</th><th style="padding:10px 12px;background:#f1f5f9;text-align:left">Overdue</th>'
  return `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
      <div style="background:#111111;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0;font-size:1.1rem">MM FICA Compliance — Overdue Items</h2>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 16px;color:#374151">Hi ${agentName},</p>
        <p style="margin:0 0 16px;color:#374151">${intro}</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.875rem;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0">
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:20px;padding:14px;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px">
          <strong style="color:#92400e">Action Required:</strong>
          <span style="color:#78350f"> Please log in to the MM FICA Compliance portal and complete the outstanding items.</span>
        </div>
        <p style="margin:16px 0 0;font-size:0.75rem;color:#9ca3af">This is an automated reminder from the MM FICA Compliance system.</p>
      </div>
    </div>`
}

async function sendOverdueReminders() {
  if (!resendClient) {
    console.log('[Reminders] Resend not configured — skipping')
    return
  }
  const from = EMAIL_FROM
  const cutoff = `NOW() - INTERVAL '${OVERDUE_DAYS} days'`
  const managerItems = []

  try {
    // ── 1. Screening overdue ─────────────────────────────────────────────────
    const { rows: screeningOverdue } = await pool.query(`
      SELECT p.id, p.fic_status, p.un_status, p.created_at,
             c.name AS client_name,
             t.property AS tx_property,
             u.email AS agent_email, u.name AS agent_name
      FROM transaction_parties p
      JOIN clients c ON c.id = p.client_id
      JOIN transactions t ON t.id = p.transaction_id
      LEFT JOIN users u ON u.id = t.agent_id
      WHERE (p.fic_status = 'pending' OR p.un_status = 'pending')
        AND p.created_at < ${cutoff}
        AND p.screening_reminded_at IS NULL
    `)

    // ── 2. Risk assessment not done ──────────────────────────────────────────
    const { rows: riskOverdue } = await pool.query(`
      SELECT p.id, p.created_at,
             c.name AS client_name,
             t.property AS tx_property,
             u.email AS agent_email, u.name AS agent_name
      FROM transaction_parties p
      JOIN clients c ON c.id = p.client_id
      JOIN transactions t ON t.id = p.transaction_id
      LEFT JOIN users u ON u.id = t.agent_id
      WHERE (p.risk_rating IS NULL OR p.risk_rating = '')
        AND p.created_at < ${cutoff}
        AND p.risk_reminded_at IS NULL
    `)

    // ── 3. No documents uploaded ─────────────────────────────────────────────
    const { rows: docsOverdue } = await pool.query(`
      SELECT p.id, p.created_at,
             c.name AS client_name,
             t.property AS tx_property,
             u.email AS agent_email, u.name AS agent_name
      FROM transaction_parties p
      JOIN clients c ON c.id = p.client_id
      JOIN transactions t ON t.id = p.transaction_id
      LEFT JOIN users u ON u.id = t.agent_id
      WHERE (p.docs IS NULL OR p.docs = '{}'::jsonb OR jsonb_typeof(p.docs) = 'null')
        AND p.created_at < ${cutoff}
        AND p.docs_reminded_at IS NULL
    `)

    // ── 4. Transaction In Progress too long ──────────────────────────────────
    const { rows: txOverdue } = await pool.query(`
      SELECT t.id, t.property, t.created_at,
             u.email AS agent_email, u.name AS agent_name
      FROM transactions t
      LEFT JOIN users u ON u.id = t.agent_id
      WHERE t.status = 'In Progress'
        AND t.created_at < ${cutoff}
        AND t.overdue_reminded_at IS NULL
    `)

    // ── Group all items by agent email ────────────────────────────────────────
    const byAgent = {}
    const now = new Date()

    function addItem(agentEmail, agentName, item) {
      if (!agentEmail) return
      if (!byAgent[agentEmail]) byAgent[agentEmail] = { agentName, items: [] }
      byAgent[agentEmail].items.push(item)
      managerItems.push({ ...item, agentName })
    }

    for (const r of screeningOverdue) {
      const daysOverdue = Math.floor((now - new Date(r.created_at)) / 86400000) - OVERDUE_DAYS
      addItem(r.agent_email, r.agent_name, { clientName: r.client_name, transaction: r.tx_property, type: 'Screening incomplete', daysOverdue })
      await pool.query(`UPDATE transaction_parties SET screening_reminded_at = NOW() WHERE id = $1`, [r.id])
    }
    for (const r of riskOverdue) {
      const daysOverdue = Math.floor((now - new Date(r.created_at)) / 86400000) - OVERDUE_DAYS
      addItem(r.agent_email, r.agent_name, { clientName: r.client_name, transaction: r.tx_property, type: 'Risk assessment missing', daysOverdue })
      await pool.query(`UPDATE transaction_parties SET risk_reminded_at = NOW() WHERE id = $1`, [r.id])
    }
    for (const r of docsOverdue) {
      const daysOverdue = Math.floor((now - new Date(r.created_at)) / 86400000) - OVERDUE_DAYS
      addItem(r.agent_email, r.agent_name, { clientName: r.client_name, transaction: r.tx_property, type: 'No documents uploaded', daysOverdue })
      await pool.query(`UPDATE transaction_parties SET docs_reminded_at = NOW() WHERE id = $1`, [r.id])
    }
    for (const r of txOverdue) {
      const daysOverdue = Math.floor((now - new Date(r.created_at)) / 86400000) - OVERDUE_DAYS
      addItem(r.agent_email, r.agent_name, { clientName: r.property, transaction: r.property, type: 'Transaction In Progress too long', daysOverdue })
      await pool.query(`UPDATE transactions SET overdue_reminded_at = NOW() WHERE id = $1`, [r.id])
    }

    // ── Send per-agent emails ─────────────────────────────────────────────────
    for (const [agentEmail, { agentName, items }] of Object.entries(byAgent)) {
      await resendClient.emails.send({
        from,
        to: [agentEmail],
        subject: `[MM FICA] ${items.length} overdue compliance item${items.length > 1 ? 's' : ''} — action required`,
        html: overdueEmailHtml({ agentName, items }),
      })
      console.log(`[Reminders] Sent ${items.length} overdue item(s) to agent ${agentEmail}`)
    }

    // ── Send manager summary ──────────────────────────────────────────────────
    if (managerItems.length > 0) {
      const { rows: managers } = await pool.query(`SELECT email, name FROM users WHERE role = 'manager'`)
      for (const mgr of managers) {
        await resendClient.emails.send({
          from,
          to: [mgr.email],
          subject: `[MM FICA] Compliance overdue summary — ${managerItems.length} item${managerItems.length > 1 ? 's' : ''}`,
          html: overdueEmailHtml({ agentName: mgr.name, items: managerItems, forManager: true }),
        })
        console.log(`[Reminders] Sent summary of ${managerItems.length} overdue item(s) to manager ${mgr.email}`)
      }
    }

    if (managerItems.length === 0) {
      console.log('[Reminders] No newly overdue items found')
    }
  } catch (err) {
    console.error('[Reminders] Error running overdue check:', err.message)
  }
}

async function sendStaffFlagAlert({ staffName, lists, screenedByName }) {
  if (!resendClient) return
  try {
    const { rows: managers } = await pool.query(`SELECT email, name FROM users WHERE role = 'manager'`)
    if (managers.length === 0) return
    const from = EMAIL_FROM
    const to = managers.map(m => m.email)
    await resendClient.emails.send({
      from, to,
      subject: `[MM FICA] ALERT — Staff member flagged: ${staffName}`,
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <div style="background:#7f1d1d;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0;font-size:1.1rem">MM FICA — Agency Staff Screening Alert</h2>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          <p style="margin:0 0 12px;color:#374151">A staff member has been <strong style="color:#dc2626">flagged</strong> during their annual TFS/UN screening and requires immediate attention.</p>
          <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
            <tr><td style="padding:8px 0;color:#6b7280;width:130px">Staff Member</td><td style="padding:8px 0;color:#111827;font-weight:700">${staffName}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Flagged On</td><td style="padding:8px 0;color:#dc2626;font-weight:600">${lists.join(', ')}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Screened By</td><td style="padding:8px 0;color:#111827">${screenedByName}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0;color:#111827">${new Date().toLocaleDateString('en-ZA')}</td></tr>
          </table>
          <div style="margin-top:20px;padding:14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px">
            <strong style="color:#b91c1c">Action Required:</strong>
            <span style="color:#7f1d1d"> Log in to the MM FICA Compliance portal → Agency Staff and review this staff member's screening result immediately.</span>
          </div>
        </div>
      </div>`,
    })
    console.log(`[Email] Staff flag alert sent for ${staffName}`)
  } catch (err) {
    console.error('[Email] Staff flag alert failed:', err.message)
  }
}

// Annual staff screening reminder — 14 days before 1 March (i.e. 14 February)
cron.schedule('0 8 14 2 *', async () => {
  if (!resendClient) return
  try {
    const currentYear = new Date().getFullYear()
    const { rows: unscreened } = await pool.query(`
      SELECT s.name FROM agency_staff s
      WHERE s.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM staff_screenings ss
          WHERE ss.staff_id = s.id AND ss.year = $1
            AND (ss.tfs_status = 'clear' OR ss.un_status = 'clear')
        )
      ORDER BY s.name
    `, [currentYear])
    if (unscreened.length === 0) return
    const { rows: managers } = await pool.query(`SELECT email, name FROM users WHERE role = 'manager'`)
    const list = unscreened.map(r => `<li style="margin:4px 0;color:#374151">${r.name}</li>`).join('')
    for (const mgr of managers) {
      await resendClient.emails.send({
        from: EMAIL_FROM,
        to: [mgr.email],
        subject: `[MM FICA] Annual staff screening due in 14 days — ${unscreened.length} staff member${unscreened.length > 1 ? 's' : ''} pending`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <div style="background:#111111;padding:20px 24px;border-radius:8px 8px 0 0">
            <h2 style="color:#fff;margin:0;font-size:1.1rem">MM FICA — Annual Staff Screening Reminder</h2>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
            <p style="color:#374151">Hi ${mgr.name},</p>
            <p style="color:#374151">The annual staff TFS/UN screening is due in <strong>14 days (1 March ${currentYear})</strong>. The following staff members have not yet been screened this year:</p>
            <ul style="margin:12px 0;padding-left:20px">${list}</ul>
            <p style="color:#374151">Please log in and complete the screening via <em>Agency Staff</em> before the deadline.</p>
          </div>
        </div>`,
      })
    }
    console.log(`[Reminders] Annual staff screening reminder sent — ${unscreened.length} pending`)
  } catch (err) {
    console.error('[Reminders] Staff annual reminder failed:', err.message)
  }
})

// Run every hour — fires within 60 min of an item crossing the 14-day threshold
cron.schedule('0 * * * *', () => {
  console.log('[Reminders] Running hourly overdue check…')
  sendOverdueReminders()
})

// Also expose a manual trigger endpoint for testing
app.get('/api/reminders/run', async (req, res) => {
  await sendOverdueReminders()
  res.json({ ok: true, message: 'Reminder check completed — check server logs' })
})


// ── Audit log helper ─────────────────────────────────────────────────────────
async function logAudit(userId, userName, action, entityType, entityId, entityLabel, detail = null) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, entity_label, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId || null, userName || null, action,
       entityType || null, entityId ? Number(entityId) : null,
       entityLabel || null, detail || null]
    )
  } catch (err) {
    console.error('[Audit] Log failed:', err.message)
  }
}

// ── Chromium detection (supports Nix/Railway, Debian, and bundled) ────────────
function findChromium() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH
  const candidates = [
    '/nix/var/nix/profiles/default/bin/chromium',
    '/etc/profiles/per-user/root/bin/chromium',
    '/run/current-system/sw/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  for (const bin of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try { return execSync(`which ${bin}`).toString().trim() } catch {}
  }
  return undefined
}
const CHROMIUM_PATH = findChromium()
console.log(`[Chrome] Using: ${CHROMIUM_PATH || 'Puppeteer bundled'}`)

// ── Screenshots dir ───────────────────────────────────────────────────────────
const SCREENSHOTS_DIR = path.join(__dirname, 'public', 'screenshots')
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://mm-fica-compliance.netlify.app',
  /\.netlify\.app$/,
]
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    const ok = ALLOWED_ORIGINS.some(o => typeof o === 'string' ? o === origin : o.test(origin))
    cb(ok ? null : new Error('Not allowed by CORS'), ok)
  }
}))
app.use(express.json({ limit: '10mb' }))
app.use('/screenshots', express.static(SCREENSHOTS_DIR))

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    const user = rows[0]
    console.log('[Login] User found:', !!user, 'email:', email)
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })
    const valid = bcrypt.compareSync(password, user.password)
    console.log('[Login] Password valid:', valid)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })
    logAudit(user.id, user.name, 'LOGIN', 'user', user.id, user.email).catch(() => {})
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Users (manager only) ──────────────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at')
    res.json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/users', async (req, res) => {
  const { name, email, password, role = 'agent' } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' })
  try {
    const hash = bcrypt.hashSync(password, 10)
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
      [name, email, hash, role]
    )
    // Auto-add new user to agency_staff
    await pool.query('INSERT INTO agency_staff (user_id, name) VALUES ($1, $2)', [rows[0].id, name])
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' })
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/users/:id', async (req, res) => {
  const { name, email, role, password } = req.body
  try {
    let q, params
    if (password) {
      const hash = bcrypt.hashSync(password, 10)
      q = 'UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email), role=COALESCE($3,role), password=$4 WHERE id=$5 RETURNING id, name, email, role, created_at'
      params = [name, email, role, hash, req.params.id]
    } else {
      q = 'UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email), role=COALESCE($3,role) WHERE id=$4 RETURNING id, name, email, role, created_at'
      params = [name, email, role, req.params.id]
    }
    const { rows } = await pool.query(q, params)
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' })
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Clients ───────────────────────────────────────────────────────────────────
app.get('/api/clients', async (req, res) => {
  const { userId, role } = req.query
  try {
    let q = `SELECT c.*, COUNT(p.id)::int AS party_count
             FROM clients c LEFT JOIN transaction_parties p ON p.client_id = c.id
             GROUP BY c.id ORDER BY c.created_at DESC`
    let params = []
    if (role === 'agent' && userId) {
      q = `SELECT c.*, COUNT(p.id)::int AS party_count
           FROM clients c LEFT JOIN transaction_parties p ON p.client_id = c.id
           WHERE c.agent_id = $1
           GROUP BY c.id ORDER BY c.created_at DESC`
      params = [userId]
    }
    const { rows } = await pool.query(q, params)
    res.json(rows.map(r => ({ ...dbToClient(r), partyCount: r.party_count || 0 })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/clients', async (req, res) => {
  const c = req.body
  try {
    const { rows } = await pool.query(`
      INSERT INTO clients (name, id_number, type, agent_id, date_of_birth, place_of_birth, nationality, docs)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [c.name, c.idNumber||'', c.type||'Individual SA', c.agentId||null,
       c.dateOfBirth||null, c.placeOfBirth||'', c.nationality||'',
       JSON.stringify(c.docs||{})]
    )
    logAudit(c.actorId, c.actorName, 'CLIENT_CREATED', 'client', rows[0].id, rows[0].name).catch(() => {})
    res.json(dbToClient(rows[0]))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/clients/:id', async (req, res) => {
  const u = req.body
  try {
    const { rows } = await pool.query(`
      UPDATE clients SET
        name           = COALESCE($1, name),
        id_number      = COALESCE($2, id_number),
        type           = COALESCE($3, type),
        agent_id       = COALESCE($4, agent_id),
        date_of_birth  = COALESCE($5, date_of_birth),
        place_of_birth = COALESCE($6, place_of_birth),
        nationality    = COALESCE($7, nationality)
      WHERE id = $8 RETURNING *`,
      [u.name, u.idNumber, u.type, u.agentId,
       u.dateOfBirth || null, u.placeOfBirth || null, u.nationality || null,
       req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' })
    const { rows: pc } = await pool.query('SELECT COUNT(*)::int AS party_count FROM transaction_parties WHERE client_id = $1', [req.params.id])
    logAudit(u.actorId, u.actorName, 'CLIENT_UPDATED', 'client', rows[0].id, rows[0].name).catch(() => {})
    res.json({ ...dbToClient(rows[0]), partyCount: pc[0]?.party_count || 0 })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const { actorId, actorName, clientName } = req.query
    await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id])
    logAudit(actorId, actorName, 'CLIENT_DELETED', 'client', req.params.id, clientName || null).catch(() => {})
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── PEP Authorisation ─────────────────────────────────────────────────────────

app.post('/api/clients/:id/pep-auth', async (req, res) => {
  const { action, note, managerId } = req.body
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' })
  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  try {
    const { rows } = await pool.query(`
      UPDATE clients
      SET pep_auth_status = $1, pep_auth_note = $2, pep_auth_by = $3, pep_auth_at = NOW()
      WHERE id = $4 RETURNING *
    `, [newStatus, note || '', managerId || null, req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Client not found' })
    res.json(dbToClient(rows[0]))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Transactions ──────────────────────────────────────────────────────────────
app.get('/api/transactions', async (req, res) => {
  const { userId, role } = req.query
  try {
    let q = 'SELECT t.* FROM transactions t ORDER BY t.created_at DESC'
    let params = []
    if (role === 'agent' && userId) {
      q = 'SELECT t.* FROM transactions t JOIN clients c ON t.client_id = c.id WHERE c.agent_id = $1 ORDER BY t.created_at DESC'
      params = [userId]
    }
    const { rows } = await pool.query(q, params)
    res.json(rows.map(dbToTx))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/transactions', async (req, res) => {
  const t = req.body
  try {
    const { rows } = await pool.query(
      'INSERT INTO transactions (client_id, type, property, value, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [t.clientId||null, t.type||'', t.property||'', t.value||0, t.status||'In Progress']
    )
    logAudit(t.actorId, t.actorName, 'TX_CREATED', 'transaction', rows[0].id, rows[0].property || rows[0].type).catch(() => {})
    res.json(dbToTx(rows[0]))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/transactions/:id', async (req, res) => {
  const t = req.body
  try {
    const { rows } = await pool.query(
      'UPDATE transactions SET type=COALESCE($1,type), property=COALESCE($2,property), value=COALESCE($3,value), status=COALESCE($4,status), notes=COALESCE($5,notes) WHERE id=$6 RETURNING *',
      [t.type, t.property, t.value, t.status, t.notes !== undefined ? t.notes : null, req.params.id]
    )
    logAudit(t.actorId, t.actorName, 'TX_UPDATED', 'transaction', rows[0].id, rows[0].property || rows[0].type).catch(() => {})
    res.json(dbToTx(rows[0]))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { actorId, actorName, label } = req.query
    await pool.query('DELETE FROM transactions WHERE id = $1', [req.params.id])
    logAudit(actorId, actorName, 'TX_DELETED', 'transaction', req.params.id, label || null).catch(() => {})
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Transaction OTP/Lease document ─────────────────────────────────────────
app.post('/api/transactions/:id/upload-otp', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params
    if (!req.file) return res.status(400).json({ error: 'file required' })
    const ext = req.file.originalname.split('.').pop().toLowerCase()
    const key = `transactions/${id}/otp-lease-${Date.now()}.${ext}`
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }))
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 604800 })
    const docData = {
      status: 'uploaded',
      filename: req.file.originalname,
      key,
      url,
      uploadedAt: new Date().toISOString().slice(0, 10),
      verifiedAt: null,
    }
    const { rows } = await pool.query(
      'UPDATE transactions SET otp_lease = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(docData), id]
    )
    const actorId = req.body?.actorId
    const actorName = req.body?.actorName
    logAudit(actorId, actorName, 'OTP_UPLOADED', 'transaction', Number(id),
      `Transaction ${id} — OTP/Lease`, req.file.originalname).catch(() => {})
    res.json(dbToTx(rows[0]))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/api/transactions/:id/otp', async (req, res) => {
  try {
    const { docData } = req.body
    const { rows } = await pool.query(
      'UPDATE transactions SET otp_lease = $1 WHERE id = $2 RETURNING *',
      [docData === null ? null : JSON.stringify(docData), req.params.id]
    )
    const { actorId, actorName } = req.body || {}
    const otpAction = docData === null ? 'OTP_DELETED' : (docData?.status === 'verified' ? 'OTP_VERIFIED' : 'OTP_UPDATED')
    logAudit(actorId, actorName, otpAction, 'transaction', Number(req.params.id),
      `Transaction ${req.params.id} — OTP/Lease`).catch(() => {})
    res.json(dbToTx(rows[0]))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── DB row → frontend object helpers ─────────────────────────────────────────
function dbToClient(r) {
  return {
    id: r.id, name: r.name, idNumber: r.id_number, type: r.type,
    agentId: r.agent_id,
    dateOfBirth: r.date_of_birth ? r.date_of_birth.toISOString().split('T')[0] : '',
    placeOfBirth: r.place_of_birth || '', nationality: r.nationality || '',
    ficStatus: r.fic_status, unStatus: r.un_status,
    pepStatus: r.pep_status, adverseMediaStatus: r.adverse_media_status,
    riskScore: r.risk_score, riskRating: r.risk_rating,
    riskCriteria: r.risk_criteria || {},
    screeningNotes: r.screening_notes || '',
    notes: r.notes || '',
    reviewDate: r.review_date ? r.review_date.toISOString().split('T')[0] : null,
    docs: r.docs || {},
    ficScreenshot: r.fic_screenshot || null,
    unScreenshot: r.un_screenshot || null,
    screeningDate: r.screening_date ? r.screening_date.toISOString().split('T')[0] : null,
    ubos: Array.isArray(r.ubos) ? r.ubos : (r.ubos || []),
    pepForm: r.pep_form || null,
    transactionId: r.transaction_id || null,
    pepAuthStatus: r.pep_auth_status || null,
    pepAuthNote: r.pep_auth_note || null,
    pepAuthBy: r.pep_auth_by || null,
    pepAuthAt: r.pep_auth_at ? r.pep_auth_at.toISOString() : null,
    createdAt: r.created_at ? r.created_at.toISOString().split('T')[0] : '',
  }
}

function dbToTx(r) {
  return {
    id: r.id, clientId: r.client_id, type: r.type,
    property: r.property, value: Number(r.value), status: r.status,
    notes: r.notes || '',
    createdAt: r.created_at ? r.created_at.toISOString().split('T')[0] : '',
    otpLease: r.otp_lease || null,
  }
}

function dbToParty(r) {
  return {
    id: r.id,
    transactionId: r.transaction_id,
    clientId: r.client_id,
    role: r.role || 'Buyer',
    // denormalised from JOIN
    clientName: r.client_name || null,
    clientIdNumber: r.id_number || null,
    idNumber: r.id_number || null,
    clientType: r.client_type || null,
    clientDob: r.date_of_birth ? r.date_of_birth.toISOString().split('T')[0] : null,
    clientPob: r.place_of_birth || null,
    clientNationality: r.nationality || null,
    agentId: r.agent_id || null,
    transactionProperty: r.property || null,
    transactionType: r.tx_type || null,
    transactionValue: r.tx_value ? Number(r.tx_value) : null,
    // compliance
    ficStatus: r.fic_status || 'pending',
    unStatus: r.un_status || 'pending',
    pepStatus: r.pep_status || 'pending',
    adverseMediaStatus: r.adverse_media_status || 'pending',
    ficScreenshot: r.fic_screenshot || null,
    unScreenshot: r.un_screenshot || null,
    riskScore: r.risk_score || null,
    riskRating: r.risk_rating || null,
    riskCriteria: r.risk_criteria || {},
    screeningNotes: r.screening_notes || '',
    screeningDate: r.screening_date ? r.screening_date.toISOString().split('T')[0] : null,
    reviewDate: r.review_date ? r.review_date.toISOString().split('T')[0] : null,
    docs: r.docs || {},
    pepForm: r.pep_form || null,
    pepAuthStatus: r.pep_auth_status || null,
    pepAuthNote: r.pep_auth_note || null,
    pepAuthBy: r.pep_auth_by || null,
    pepAuthAt: r.pep_auth_at ? r.pep_auth_at.toISOString() : null,
    ubos: Array.isArray(r.ubos) ? r.ubos : (r.ubos || []),
    createdAt: r.created_at ? r.created_at.toISOString().split('T')[0] : '',
  }
}

async function getPartyById(id) {
  const { rows } = await pool.query(`
    SELECT p.*, c.name AS client_name, c.id_number, c.type AS client_type, c.agent_id,
           c.date_of_birth, c.place_of_birth, c.nationality,
           t.property, t.type AS tx_type, t.value AS tx_value
    FROM transaction_parties p
    JOIN clients c ON p.client_id = c.id
    JOIN transactions t ON p.transaction_id = t.id
    WHERE p.id = $1
  `, [id])
  return rows[0] ? dbToParty(rows[0]) : null
}

// ── Transaction Parties ───────────────────────────────────────────────────────
const PARTY_JOIN = `
  SELECT p.*, c.name AS client_name, c.id_number, c.type AS client_type, c.agent_id,
         c.date_of_birth, c.place_of_birth, c.nationality,
         t.property, t.type AS tx_type, t.value AS tx_value
  FROM transaction_parties p
  JOIN clients c ON p.client_id = c.id
  JOIN transactions t ON p.transaction_id = t.id
`

app.get('/api/parties', async (req, res) => {
  const { transactionId, clientId, userId, role } = req.query
  try {
    const conds = []; const params = []
    if (transactionId) { params.push(transactionId); conds.push(`p.transaction_id = $${params.length}`) }
    if (clientId)      { params.push(clientId);      conds.push(`p.client_id = $${params.length}`) }
    if (role === 'agent' && userId) { params.push(userId); conds.push(`c.agent_id = $${params.length}`) }
    const where = conds.length ? ' WHERE ' + conds.join(' AND ') : ''
    const { rows } = await pool.query(PARTY_JOIN + where + ' ORDER BY p.created_at DESC', params)
    res.json(rows.map(dbToParty))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/parties', async (req, res) => {
  const { transactionId, clientId, role } = req.body
  if (!transactionId || !clientId) return res.status(400).json({ error: 'transactionId and clientId required' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO transaction_parties (transaction_id, client_id, role, docs)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [transactionId, clientId, role || 'Buyer', JSON.stringify(
        Object.fromEntries(['SA ID / Passport','Proof of Address (≤3 months)','Source of Funds Declaration','Signed OTP / Lease','FIC Questionnaire'].map(d => [d, false]))
      )]
    )
    const party = await getPartyById(rows[0].id)
    logAudit(req.body.actorId, req.body.actorName, 'PARTY_ADDED', 'party', party.id,
      `${party.clientName} — ${party.transactionProperty || 'tx ' + transactionId}`).catch(() => {})
    res.json(party)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'This client is already a party on this transaction' })
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/parties/:id', async (req, res) => {
  const u = req.body
  try {
    await pool.query(`
      UPDATE transaction_parties SET
        role                 = COALESCE($1,  role),
        fic_status           = COALESCE($2,  fic_status),
        un_status            = COALESCE($3,  un_status),
        pep_status           = COALESCE($4,  pep_status),
        adverse_media_status = COALESCE($5,  adverse_media_status),
        fic_screenshot       = COALESCE($6,  fic_screenshot),
        un_screenshot        = COALESCE($7,  un_screenshot),
        risk_score           = COALESCE($8,  risk_score),
        risk_rating          = COALESCE($9,  risk_rating),
        risk_criteria        = COALESCE($10, risk_criteria),
        screening_notes      = COALESCE($11, screening_notes),
        screening_date       = COALESCE($12, screening_date),
        review_date          = COALESCE($13, review_date),
        docs                 = COALESCE($14, docs),
        pep_form             = COALESCE($15, pep_form),
        pep_auth_status      = COALESCE($16, pep_auth_status),
        ubos                 = COALESCE($17, ubos)
      WHERE id = $18`,
      [
        u.role,
        u.ficStatus, u.unStatus, u.pepStatus, u.adverseMediaStatus,
        u.ficScreenshot, u.unScreenshot,
        u.riskScore, u.riskRating,
        u.riskCriteria !== undefined ? JSON.stringify(u.riskCriteria) : null,
        u.screeningNotes,
        u.screeningDate || null,
        u.reviewDate    || null,
        u.docs          !== undefined ? JSON.stringify(u.docs)    : null,
        u.pepForm       !== undefined ? JSON.stringify(u.pepForm) : null,
        u.pepAuthStatus !== undefined ? u.pepAuthStatus           : null,
        u.ubos          !== undefined ? JSON.stringify(u.ubos)    : null,
        req.params.id,
      ]
    )
    const party = await getPartyById(req.params.id)
    if (!party) return res.status(404).json({ error: 'Party not found' })
    // Email managers when PEP flagged
    if (u.pepAuthStatus === 'pending') {
      const { rows: agentRows } = await pool.query('SELECT name FROM users WHERE id = $1', [party.agentId])
      sendPepAlert({ clientName: party.clientName, agentName: agentRows[0]?.name || 'Agent' }).catch(() => {})
    }
    // Audit log key compliance actions
    const label = `${party.clientName} — ${party.transactionProperty || 'tx ' + party.transactionId}`
    if (u.riskRating !== undefined && u.riskRating !== null) {
      logAudit(u.actorId, u.actorName, 'RISK_RATED', 'party', party.id,
        label, `Rating: ${u.riskRating} (score ${u.riskScore})`).catch(() => {})
    } else if (u.ficStatus !== undefined || u.unStatus !== undefined) {
      const detail = [
        u.ficStatus  ? `FIC: ${u.ficStatus}`  : null,
        u.unStatus   ? `UN: ${u.unStatus}`    : null,
        u.pepAuthStatus ? `PEP auth: ${u.pepAuthStatus}` : null,
      ].filter(Boolean).join(', ')
      if (detail) logAudit(u.actorId, u.actorName, 'SCREENING_SAVED', 'party', party.id, label, detail).catch(() => {})
    }
    if (u.pepAuthStatus === 'pending') {
      logAudit(u.actorId, u.actorName, 'PEP_FLAGGED', 'party', party.id, label).catch(() => {})
    }
    res.json(party)
  } catch (err) { res.status(500).json({ error: err.message }) }
})



// ── R2 file upload ──────────────────────────────────────────────────────────
// Upload a document file to R2, store URL in party docs JSON
app.post('/api/parties/:id/upload', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params
    const { docName } = req.body
    if (!req.file || !docName) return res.status(400).json({ error: 'file and docName required' })

    const ext = req.file.originalname.split('.').pop().toLowerCase()
    const key = `parties/${id}/${Date.now()}-${docName.replace(/[^a-z0-9]/gi, '_')}.${ext}`

    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }))

    // Generate a signed URL valid for 7 days
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 604800 })

    const docData = {
      status: 'uploaded',
      filename: req.file.originalname,
      key,
      url,
      uploadedAt: new Date().toISOString().slice(0, 10),
      verifiedAt: null,
    }

    await pool.query(
      `UPDATE transaction_parties
       SET docs = COALESCE(docs, '{}'::jsonb) || jsonb_build_object($1::text, $2::jsonb)
       WHERE id = $3`,
      [docName, JSON.stringify(docData), id]
    )

    const party = await getPartyById(id)
    if (!party) return res.status(404).json({ error: 'Party not found' })
    const actorId = req.body?.actorId
    const actorName = req.body?.actorName
    const docLabel = `${party.clientName} — ${docName}`
    logAudit(actorId, actorName, 'DOC_UPLOADED', 'party', Number(id), docLabel, req.file.originalname).catch(() => {})
    res.json(party)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Refresh a signed URL (they expire after 7 days)
app.get('/api/parties/:id/doc-url', async (req, res) => {
  try {
    const { key } = req.query
    if (!key) return res.status(400).json({ error: 'key required' })
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 604800 })
    res.json({ url })
  } catch (err) { res.status(500).json({ error: err.message }) }
})


// R2 file cleanup (fire-and-forget friendly)
app.post('/api/parties/:id/doc-delete', async (req, res) => {
  try {
    const { key } = req.body
    if (key) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    }
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Single-document patch — avoids re-sending the entire docs JSON on every upload
app.patch('/api/parties/:id/notes', async (req, res) => {
  const { notes, actorId, actorName } = req.body
  try {
    await pool.query('UPDATE transaction_parties SET notes = $1 WHERE id = $2', [notes || '', req.params.id])
    logAudit(actorId, actorName, 'PARTY_NOTES_UPDATED', 'party', req.params.id, null).catch(() => {})
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/api/parties/:id/doc', async (req, res) => {
  const { docName, docData } = req.body
  if (!docName) return res.status(400).json({ error: 'docName required' })
  try {
    await pool.query(
      `UPDATE transaction_parties
       SET docs = COALESCE(docs, '{}'::jsonb) || jsonb_build_object($1::text, $2::jsonb)
       WHERE id = $3`,
      [docName, docData === null ? 'null' : JSON.stringify(docData), req.params.id]
    )
    const party = await getPartyById(req.params.id)
    if (!party) return res.status(404).json({ error: 'Party not found' })
    const { actorId, actorName } = req.body
    const patchAction = docData === null ? 'DOC_DELETED' : (docData?.status === 'verified' ? 'DOC_VERIFIED' : 'DOC_UPLOADED')
    logAudit(actorId, actorName, patchAction, 'party', party.id,
      `${party.clientName} — ${docName}`).catch(() => {})
    res.json(party)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/parties/:id', async (req, res) => {
  try {
    const { actorId, actorName, label } = req.query
    await pool.query('DELETE FROM transaction_parties WHERE id = $1', [req.params.id])
    logAudit(actorId, actorName, 'PARTY_REMOVED', 'party', req.params.id, label || null).catch(() => {})
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Direct GET purge — open in browser to force cleanup
app.get('/api/pep-pending/purge-now', async (req, res) => {
  try {
    const r1 = await pool.query(`DELETE FROM transaction_parties WHERE pep_auth_status = 'pending' OR (pep_status = 'flagged' AND pep_auth_status IS NULL)`)
    const r2 = await pool.query(`UPDATE clients SET pep_auth_status = NULL, pep_form = NULL, pep_status = NULL WHERE pep_auth_status = 'pending' OR pep_status = 'flagged'`)
    res.json({ ok: true, deleted_parties: r1.rowCount, cleared_clients: r2.rowCount })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Debug: show raw pep-pending rows
app.get('/api/pep-pending/debug', async (req, res) => {
  try {
    const tp = await pool.query(`SELECT id, client_id, pep_status, pep_auth_status FROM transaction_parties WHERE pep_auth_status = 'pending' OR (pep_status = 'flagged' AND pep_auth_status IS NULL)`)
    const cl = await pool.query(`SELECT id, name, pep_auth_status FROM clients WHERE pep_auth_status = 'pending'`)
    res.json({ transaction_parties: tp.rows, clients: cl.rows })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Purge all stale PEP-pending entries from both tables
app.delete('/api/pep-pending/stale', async (req, res) => {
  try {
    const r1 = await pool.query(`DELETE FROM transaction_parties WHERE pep_auth_status = 'pending' OR (pep_status = 'flagged' AND pep_auth_status IS NULL)`)
    const r2 = await pool.query(`UPDATE clients SET pep_auth_status = NULL, pep_form = NULL, pep_status = NULL WHERE pep_auth_status = 'pending' OR pep_status = 'flagged'`)
    res.json({ deleted_parties: r1.rowCount, cleared_clients: r2.rowCount })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/parties/:id/pep-auth', async (req, res) => {
  const { action, note, managerId } = req.body
  if (!['approve', 'reject', 'dismiss'].includes(action)) return res.status(400).json({ error: 'action must be approve, reject or dismiss' })
  try {
    if (action === 'dismiss') {
      await pool.query(
        `UPDATE transaction_parties SET pep_status=NULL, pep_auth_status=NULL, pep_auth_note=NULL, pep_auth_by=NULL, pep_auth_at=NULL WHERE id=$1`,
        [req.params.id]
      )
      return res.json({ ok: true, id: Number(req.params.id) })
    }
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    await pool.query(
      `UPDATE transaction_parties SET pep_auth_status=$1, pep_auth_note=$2, pep_auth_by=$3, pep_auth_at=NOW() WHERE id=$4`,
      [newStatus, note || '', managerId || null, req.params.id]
    )
    const party = await getPartyById(req.params.id)
    if (!party) return res.status(404).json({ error: 'Party not found' })
    const pepLabel = `${party.clientName} — ${party.transactionProperty || 'tx ' + party.transactionId}`
    const pepAction = action === 'approve' ? 'PEP_APPROVED' : 'PEP_REJECTED'
    logAudit(managerId, null, pepAction, 'party', party.id, pepLabel, note || null).catch(() => {})
    res.json(party)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Updated pep-pending — uses transaction_parties
app.get('/api/pep-pending', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      ${PARTY_JOIN}
      LEFT JOIN users u ON c.agent_id = u.id
      WHERE p.pep_auth_status = 'pending'
         OR (p.pep_status = 'flagged' AND p.pep_auth_status IS NULL)
      ORDER BY p.created_at DESC
    `)
    res.json(rows.map(r => ({ ...dbToParty(r), agentName: r.agent_name || 'Unknown' })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Audit Log ────────────────────────────────────────────────────────────────
app.get('/api/audit', async (req, res) => {
  const { userId, role, action, dateFrom, dateTo, limit = 500 } = req.query
  try {
    const conds = []; const params = []
    // Agents see only their own entries; managers see all
    if (role === 'agent' && userId) {
      params.push(userId); conds.push(`al.user_id = $${params.length}`)
    }
    if (action) { params.push(action); conds.push(`al.action = $${params.length}`) }
    if (dateFrom) { params.push(dateFrom); conds.push(`al.created_at >= $${params.length}`) }
    if (dateTo)   { params.push(dateTo + ' 23:59:59'); conds.push(`al.created_at <= $${params.length}`) }
    const where = conds.length ? ' WHERE ' + conds.join(' AND ') : ''
    params.push(Number(limit) || 500)
    const { rows } = await pool.query(
      `SELECT al.*, u.name AS resolved_user_name
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${params.length}`,
      params
    )
    res.json(rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      userName: r.resolved_user_name || r.user_name || 'System',
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      entityLabel: r.entity_label,
      detail: r.detail,
      createdAt: r.created_at ? r.created_at.toISOString() : null,
    })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Test email ───────────────────────────────────────────────────────────────
app.get('/api/test-email', async (req, res) => {
  if (!resendClient) {
    return res.json({ ok: false, message: 'Resend not configured — add RESEND_API_KEY to Railway env vars' })
  }
  try {
    const from = EMAIL_FROM
    const to   = process.env.SMTP_USER || 'admin@miltons.law.za'
    await resendClient.emails.send({
      from,
      to,
      subject: 'MM FICA — Email test',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="background:#111111;padding:16px 20px;border-radius:8px;margin-bottom:16px">
          <h2 style="color:#fff;margin:0;font-size:1rem">MM FICA Compliance — Email Test</h2>
        </div>
        <p style="color:#374151">This is a test email sent from your Railway server via Resend.</p>
        <p style="color:#374151"><strong>Email is working correctly.</strong></p>
        <p style="color:#94a3b8;font-size:0.85rem">Sent: ${new Date().toLocaleString('en-ZA')}</p>
      </div>`,
    })
    console.log('[Email] Test email sent successfully via Resend')
    res.json({ ok: true, message: `Test email sent to ${to}` })
  } catch (err) {
    console.error('[Email] Test email failed:', err.message)
    res.json({ ok: false, message: err.message })
  }
})

// ── Health ────────────────────────────────────────────────────────────────────
// ── Agency Staff ─────────────────────────────────────────────────────────────

app.get('/api/agency-staff', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
             u.email AS user_email,
             (SELECT json_agg(ss ORDER BY ss.screened_at DESC)
              FROM staff_screenings ss WHERE ss.staff_id = s.id) AS screenings
      FROM agency_staff s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.name
    `)
    res.json(rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      idNumber: r.id_number || '',
      role: r.role || '',
      startDate: r.start_date ? r.start_date.toISOString().slice(0,10) : null,
      dob: r.dob ? r.dob.toISOString().slice(0,10) : null,
      idDocUrl: r.id_doc_url || null,
      status: r.status || 'active',
      userEmail: r.user_email || null,
      screenings: r.screenings || [],
      createdAt: r.created_at,
    })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/agency-staff', async (req, res) => {
  const { name, idNumber, role, startDate, dob, actorId, actorName } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO agency_staff (name, id_number, role, start_date, dob) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, idNumber||null, role||null, startDate||null, dob||null]
    )
    logAudit(actorId, actorName, 'STAFF_CREATED', 'agency_staff', rows[0].id, name).catch(()=>{})
    res.json({ id: rows[0].id, name: rows[0].name, idNumber: rows[0].id_number||'', role: rows[0].role||'', startDate: rows[0].start_date, dob: rows[0].dob ? rows[0].dob.toISOString().slice(0,10) : null, status: rows[0].status, screenings: [] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/agency-staff/:id', async (req, res) => {
  const { name, idNumber, role, startDate, dob, status, actorId, actorName } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE agency_staff SET name=COALESCE($1,name), id_number=COALESCE($2,id_number), role=COALESCE($3,role), start_date=COALESCE($4,start_date), dob=COALESCE($5,dob), status=COALESCE($6,status) WHERE id=$7 RETURNING *`,
      [name||null, idNumber||null, role||null, startDate||null, dob||null, status||null, req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    logAudit(actorId, actorName, 'STAFF_UPDATED', 'agency_staff', rows[0].id, rows[0].name).catch(()=>{})
    res.json({ id: rows[0].id, name: rows[0].name, idNumber: rows[0].id_number||'', role: rows[0].role||'', startDate: rows[0].start_date, dob: rows[0].dob ? rows[0].dob.toISOString().slice(0,10) : null, status: rows[0].status })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Upload ID document for staff member
app.post('/api/agency-staff/:id/upload-id', upload.single('file'), async (req, res) => {
  const { id } = req.params
  const { actorId, actorName } = req.body
  if (!req.file) return res.status(400).json({ error: 'No file' })
  try {
    const ext = req.file.originalname.split('.').pop()
    const key = `staff-id/${id}-${Date.now()}.${ext}`
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: req.file.buffer, ContentType: req.file.mimetype }))
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 3600 * 24 * 7 })
    await pool.query('UPDATE agency_staff SET id_doc_url = $1 WHERE id = $2', [key, id])
    logAudit(actorId, actorName, 'STAFF_DOC_UPLOADED', 'agency_staff', Number(id), req.file.originalname).catch(()=>{})
    res.json({ url, key })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/agency-staff/:id/doc-url', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id_doc_url FROM agency_staff WHERE id = $1', [req.params.id])
    if (!rows[0]?.id_doc_url) return res.json({ url: null })
    const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: rows[0].id_doc_url }), { expiresIn: 3600 * 24 * 7 })
    res.json({ url })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Record a screening result
app.post('/api/agency-staff/:id/screen', async (req, res) => {
  const { tfsStatus, unStatus, tfsScreenshot, unScreenshot, notes, actorId, actorName } = req.body
  const year = new Date().getFullYear()
  try {
    const { rows: staff } = await pool.query('SELECT name FROM agency_staff WHERE id = $1', [req.params.id])
    if (staff.length === 0) return res.status(404).json({ error: 'Staff not found' })

    // Upsert: replace existing screening for this year
    await pool.query(`DELETE FROM staff_screenings WHERE staff_id = $1 AND year = $2`, [req.params.id, year])
    const { rows } = await pool.query(
      `INSERT INTO staff_screenings (staff_id, year, tfs_status, un_status, tfs_screenshot, un_screenshot, notes, screened_by, screened_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.id, year, tfsStatus||'pending', unStatus||'pending', tfsScreenshot||null, unScreenshot||null, notes||'', actorId||null, actorName||'']
    )
    logAudit(actorId, actorName, 'STAFF_SCREENED', 'agency_staff', Number(req.params.id), staff[0].name).catch(()=>{})

    // Send flag alert if any list returned flagged
    if (tfsStatus === 'flagged' || unStatus === 'flagged') {
      const flaggedLists = []
      if (tfsStatus === 'flagged') flaggedLists.push('TFS (FIC)')
      if (unStatus === 'flagged') flaggedLists.push('UN Sanctions')
      sendStaffFlagAlert({ staffName: staff[0].name, lists: flaggedLists, screenedByName: actorName || 'Unknown' })
    }

    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Auto-screen a staff member against TFS + UN (same engine as client screening)
app.post('/api/agency-staff/:id/auto-screen', async (req, res) => {
  const { actorId, actorName } = req.body
  try {
    const { rows: staff } = await pool.query('SELECT * FROM agency_staff WHERE id = $1', [req.params.id])
    if (staff.length === 0) return res.status(404).json({ error: 'Staff not found' })
    const member = staff[0]
    const name   = member.name
    const idNum  = member.id_number || ''
    const dob    = member.dob ? member.dob.toISOString().slice(0,10) : null
    const year   = new Date().getFullYear()

    console.log(`[StaffScreen] Starting auto-screen for ${name}`)

    // Run TFS and UN searches in parallel
    const [tfsResult, unResult] = await Promise.all([
      runSearch({ url: 'https://tfs.fic.gov.za/Pages/Search', clientName: name, idNumber: idNum, dateOfBirth: dob })
        .catch(err => ({ result: 'pending', error: err.message, screenshot: null, screenshotBase64: null })),
      (async () => {
        try {
          const xml     = await getUNList()
          const matches = searchUNXML(xml, name)
          const ts       = Date.now()
          const safeName = name.replace(/[^a-zA-Z0-9]/g, '_')
          const filename = `UN_${safeName}_${ts}.png`
          const filepath = path.join(SCREENSHOTS_DIR, filename)
          await generateUNReport(name, matches, filepath)
          const base64 = fs.readFileSync(filepath).toString('base64')
          return { result: matches.length > 0 ? 'flagged' : 'clear', matchCount: matches.length,
                   screenshot: `/screenshots/${filename}`, screenshotBase64: `data:image/png;base64,${base64}` }
        } catch (err) {
          return { result: 'pending', error: err.message, screenshot: null, screenshotBase64: null }
        }
      })()
    ])

    const tfsStatus = tfsResult.result === 'clear' ? 'clear' : tfsResult.result === 'flagged' ? 'flagged' : 'pending'
    const unStatus  = unResult.result  === 'clear' ? 'clear' : unResult.result  === 'flagged' ? 'flagged' : 'pending'

    // Upload screenshots to R2 for permanent storage
    let tfsKey = null, unKey = null
    const ts = Date.now()
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_')

    if (tfsResult.screenshotBase64) {
      try {
        const buf = Buffer.from(tfsResult.screenshotBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
        tfsKey = `staff-screens/TFS_${safeName}_${year}_${ts}.png`
        await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: tfsKey, Body: buf, ContentType: 'image/png' }))
      } catch (e) { console.error('[StaffScreen] TFS R2 upload failed:', e.message) }
    }
    if (unResult.screenshotBase64) {
      try {
        const buf = Buffer.from(unResult.screenshotBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
        unKey = `staff-screens/UN_${safeName}_${year}_${ts}.png`
        await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: unKey, Body: buf, ContentType: 'image/png' }))
      } catch (e) { console.error('[StaffScreen] UN R2 upload failed:', e.message) }
    }

    // Upsert screening record for this year
    await pool.query(`DELETE FROM staff_screenings WHERE staff_id = $1 AND year = $2`, [req.params.id, year])
    const { rows: saved } = await pool.query(
      `INSERT INTO staff_screenings (staff_id, year, tfs_status, un_status, tfs_screenshot, un_screenshot, screened_by, screened_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, year, tfsStatus, unStatus, tfsKey, unKey, actorId||null, actorName||'']
    )

    logAudit(actorId, actorName, 'STAFF_AUTO_SCREENED', 'agency_staff', Number(req.params.id), name,
      `TFS: ${tfsStatus}, UN: ${unStatus}`).catch(()=>{})

    // Send flag alert if needed
    if (tfsStatus === 'flagged' || unStatus === 'flagged') {
      const flaggedLists = []
      if (tfsStatus === 'flagged') flaggedLists.push('TFS (FIC)')
      if (unStatus === 'flagged') flaggedLists.push('UN Sanctions')
      sendStaffFlagAlert({ staffName: name, lists: flaggedLists, screenedByName: actorName || 'Unknown' })
    }

    // Return result with signed URLs for immediate display
    const result = { ...saved[0], tfsScreenshotBase64: tfsResult.screenshotBase64, unScreenshotBase64: unResult.screenshotBase64 }
    if (tfsKey) {
      result.tfsUrl = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: tfsKey }), { expiresIn: 3600 * 24 })
        .catch(() => null)
    }
    if (unKey) {
      result.unUrl = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: unKey }), { expiresIn: 3600 * 24 })
        .catch(() => null)
    }
    res.json(result)
  } catch (err) {
    console.error('[StaffScreen] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Get signed download URLs for a staff screening's screenshots
app.get('/api/agency-staff/screening/:screeningId/urls', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT tfs_screenshot, un_screenshot FROM staff_screenings WHERE id = $1', [req.params.screeningId])
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const r = rows[0]
    const result = {}
    if (r.tfs_screenshot) {
      result.tfsUrl = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: r.tfs_screenshot }), { expiresIn: 3600 * 24 })
        .catch(() => null)
    }
    if (r.un_screenshot) {
      result.unUrl = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: r.un_screenshot }), { expiresIn: 3600 * 24 })
        .catch(() => null)
    }
    res.json(result)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// When a new user is created, auto-add to agency_staff
// (hook into existing POST /api/users — add after user creation)


// ── Import Historical Screening ───────────────────────────────────────────────
// POST /api/import-screening
// multipart/form-data fields: clientName, idNumber, clientType, screeningDate,
//   tfsResult, unResult, actorId, actorName
// files: tfsScreenshot (optional), unScreenshot (optional), scorecard (optional)
app.post('/api/import-screening',
  upload.fields([
    { name: 'tfsScreenshot', maxCount: 1 },
    { name: 'unScreenshot',  maxCount: 1 },
    { name: 'scorecard',     maxCount: 1 },
  ]),
  async (req, res) => {
    const { clientName, idNumber, clientType, screeningDate, tfsResult, unResult, actorId, actorName } = req.body
    if (!clientName) return res.status(400).json({ error: 'clientName required' })
    const files = req.files || {}
    try {
      // 1. Find or create client
      let clientId
      const { rows: existing } = await pool.query(
        `SELECT id FROM clients WHERE LOWER(name) = LOWER($1) OR (id_number IS NOT NULL AND id_number = $2)`,
        [clientName, idNumber || '___NO_MATCH___']
      )
      if (existing.length > 0) {
        clientId = existing[0].id
      } else {
        const { rows: created } = await pool.query(
          `INSERT INTO clients (name, id_number, client_type) VALUES ($1,$2,$3) RETURNING id`,
          [clientName, idNumber || null, clientType || 'Individual SA']
        )
        clientId = created[0].id
        logAudit(actorId, actorName, 'CLIENT_CREATED', 'clients', clientId, clientName).catch(() => {})
      }

      // 2. Find or create a "Historical Import" transaction for this client
      let txId
      const { rows: txRows } = await pool.query(
        `SELECT t.id FROM transactions t
         JOIN transaction_parties tp ON tp.transaction_id = t.id
         WHERE t.type = 'Historical Import' AND tp.client_id = $1
         LIMIT 1`,
        [clientId]
      )
      if (txRows.length > 0) {
        txId = txRows[0].id
      } else {
        const { rows: newTx } = await pool.query(
          `INSERT INTO transactions (type, property, value, status, agent_id)
           VALUES ('Historical Import', 'Imported Record', 0, 'in_progress', $1) RETURNING id`,
          [actorId || null]
        )
        txId = newTx[0].id
      }

      // 3. Find or create party record
      let partyId
      const { rows: partyRows } = await pool.query(
        `SELECT id FROM transaction_parties WHERE transaction_id = $1 AND client_id = $2 LIMIT 1`,
        [txId, clientId]
      )
      if (partyRows.length > 0) {
        partyId = partyRows[0].id
      } else {
        const { rows: newParty } = await pool.query(
          `INSERT INTO transaction_parties (transaction_id, client_id, role, fic_status, un_status)
           VALUES ($1, $2, 'Buyer', 'pending', 'pending') RETURNING id`,
          [txId, clientId]
        )
        partyId = newParty[0].id
      }

      // 4. Upload files to R2
      const ts = Date.now()
      const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_')
      const date = screeningDate ? screeningDate.replace(/-/g, '') : new Date().toISOString().slice(0,10).replace(/-/g,'')
      let tfsKey = null, unKey = null, scorecardKey = null

      if (files.tfsScreenshot?.[0]) {
        tfsKey = `imports/TFS_${safeName}_${date}_${ts}.jpg`
        await r2.send(new PutObjectCommand({
          Bucket: R2_BUCKET, Key: tfsKey,
          Body: files.tfsScreenshot[0].buffer,
          ContentType: files.tfsScreenshot[0].mimetype || 'image/jpeg'
        }))
      }
      if (files.unScreenshot?.[0]) {
        unKey = `imports/UN_${safeName}_${date}_${ts}.jpg`
        await r2.send(new PutObjectCommand({
          Bucket: R2_BUCKET, Key: unKey,
          Body: files.unScreenshot[0].buffer,
          ContentType: files.unScreenshot[0].mimetype || 'image/jpeg'
        }))
      }
      if (files.scorecard?.[0]) {
        scorecardKey = `imports/SCORECARD_${safeName}_${date}_${ts}.pdf`
        await r2.send(new PutObjectCommand({
          Bucket: R2_BUCKET, Key: scorecardKey,
          Body: files.scorecard[0].buffer,
          ContentType: 'application/pdf'
        }))
      }

      // 5. Save screening record on party
      const sDate = screeningDate || new Date().toISOString().slice(0,10)
      await pool.query(
        `UPDATE transaction_parties SET
           fic_status = $1, un_status = $2,
           fic_screenshot = COALESCE($3, fic_screenshot),
           un_screenshot  = COALESCE($4, un_screenshot),
           reviewed_at    = $5
         WHERE id = $6`,
        [tfsResult || 'clear', unResult || 'clear', tfsKey, unKey, sDate, partyId]
      )

      // 6. Save scorecard as a document on the party if provided
      if (scorecardKey) {
        await pool.query(
          `UPDATE transaction_parties SET docs = COALESCE(docs,'{}') || $1::jsonb WHERE id = $2`,
          [JSON.stringify({ scorecard: { key: scorecardKey, uploadedAt: new Date().toISOString(), name: 'Historical Scorecard' } }), partyId]
        ).catch(() => {}) // best-effort
      }

      logAudit(actorId, actorName, 'SCREENING_IMPORTED', 'transaction_parties', partyId, clientName,
        `TFS: ${tfsResult}, UN: ${unResult}, date: ${sDate}`).catch(() => {})

      res.json({ ok: true, clientId, partyId, txId, tfsKey, unKey, scorecardKey })
    } catch (err) {
      console.error('[ImportScreening]', err.message)
      res.status(500).json({ error: err.message })
    }
  }
)

app.get('/api/health', (req, res) => res.json({ ok: true }))

// ── FIC Search (Puppeteer) ────────────────────────────────────────────────────
async function runSearch({ url, clientName, idNumber, dateOfBirth, nationality, placeOfBirth, type }) {
  const isEntity = type === 'entity'
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 1500))

    if (isEntity) {
      const entityTab = await page.$('a[href="#tabs-2"]')
      if (entityTab) { await entityTab.click(); await new Promise(r => setTimeout(r, 800)) }
      const entityInputs = await page.$$('#tabs-2 input')
      if (entityInputs[0]) {
        await entityInputs[0].click({ clickCount: 3 })
        await entityInputs[0].type(clientName, { delay: 50 })
      }
    } else {
      const allInputs = await page.$$('input[type="text"], input:not([type])')
      const personData = [
        { idx: 0, value: clientName },
        { idx: 1, value: idNumber || '' },
        { idx: 2, value: placeOfBirth || '' },
        { idx: 3, value: dateOfBirth ? dateOfBirth.split('-').reverse().join('/') : '' },
        { idx: 4, value: nationality || '' },
      ]
      for (const f of personData) {
        if (!f.value || !allInputs[f.idx]) continue
        await allInputs[f.idx].click({ clickCount: 3 })
        await allInputs[f.idx].type(f.value, { delay: 40 })
        await new Promise(r => setTimeout(r, 150))
      }
    }

    await new Promise(r => setTimeout(r, 500))
    // Click the correct search button for the active tab
    const btnLabel = isEntity ? 'Search Entity' : 'Search Person'
    const searchBtn = await page.$(`input[value="${btnLabel}"]`)
    if (searchBtn) {
      await searchBtn.click()
    } else {
      // Fallback: find any visible search button matching the tab
      const allBtns = await page.$$('input[type="button"], button')
      for (const btn of allBtns) {
        const val = await page.evaluate(el => el.value || el.textContent || '', btn)
        if (val.toLowerCase().includes('search') && val.toLowerCase().includes(isEntity ? 'entity' : 'person')) {
          await btn.click(); break
        }
      }
    }

    await new Promise(r => setTimeout(r, 4000))

    const ts = Date.now()
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `${safeName}_${ts}.png`
    const filepath = path.join(SCREENSHOTS_DIR, filename)
    await page.screenshot({ path: filepath, fullPage: true })

    const { status, matchCount } = await page.evaluate(() => {
      const bodyText = (document.body.innerText || '').toLowerCase()
      if (bodyText.includes('enter name or identification')) return { status: 'clear', matchCount: 0 }
      if (bodyText.includes('no results')) return { status: 'clear', matchCount: 0 }
      const HEADERS = ['name', 'id number', 'title', 'designation', 'date of birth', 'place of birth', 'nationality']
      const rows = Array.from(document.querySelectorAll('table tr'))
      let count = 0
      for (const row of rows) {
        const text = row.innerText.trim().toLowerCase()
        if (!text) continue
        const isHeader = HEADERS.some(k => text === k || text.startsWith(k + '\t') || text.startsWith(k + ' '))
        if (!isHeader && row.cells.length > 1) count++
      }
      return { status: count > 0 ? 'flagged' : 'clear', matchCount: count }
    })

    const base64 = fs.readFileSync(filepath).toString('base64')
    return { screenshot: `/screenshots/${filename}`, screenshotBase64: `data:image/png;base64,${base64}`, result: status, matchCount }
  } finally {
    await browser.close()
  }
}

app.post('/api/fic-search', async (req, res) => {
  const { clientName, idNumber, dateOfBirth, nationality, placeOfBirth, type } = req.body
  if (!clientName) return res.status(400).json({ error: 'clientName required' })
  console.log(`[FIC]  Searching: ${clientName}`)
  try {
    const result = await runSearch({ url: 'https://tfs.fic.gov.za/Pages/Search', clientName, idNumber, dateOfBirth, nationality, placeOfBirth, type })
    console.log(`[FIC]  Done: ${result.result}`)
    logAudit(req.body.actorId, req.body.actorName, 'FIC_SEARCH', 'client', req.body.entityId || null,
      clientName, `Result: ${result.result} (${result.matchCount} matches)`).catch(() => {})
    res.json(result)
  } catch (err) {
    console.error('[FIC]  Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Risk Score Card PDF ───────────────────────────────────────────────────────
const CLIENT_TYPE_LABELS = {
  ct_sa_natural:     'SA Natural Person (Citizen / Permanent Resident)',
  ct_cc:             'Close Corporation (CC)',
  ct_sa_company:     'SA Company (Pty Ltd / Ltd)',
  ct_prof_partner:   'Professional Partnership',
  ct_listed:         'Listed Company (JSE or equivalent)',
  ct_sa_trust:       'SA Trust',
  ct_sa_partner:     'Ordinary Partnership',
  ct_foreign_fatf:   'Foreign Natural Person (FATF country)',
  ct_principal:      'Principal / Agent Relationship',
  ct_dom_pip:        'Domestic Prominent Influential Person (PIP)',
  ct_foreign_entity: 'Foreign FATF Member Entity',
  ct_foreign_pep:    'Foreign Prominent Public Official (PEP)',
  ct_foreign_trust:  'Foreign Trust',
  ct_non_fatf:       'Non-FATF Country Client',
}
const CLIENT_TYPE_WEIGHTS = {
  ct_sa_natural:1, ct_cc:1, ct_sa_company:1, ct_prof_partner:1, ct_listed:1,
  ct_sa_trust:2, ct_sa_partner:2, ct_foreign_fatf:2, ct_principal:2, ct_dom_pip:2, ct_foreign_entity:2,
  ct_foreign_pep:3, ct_foreign_trust:3, ct_non_fatf:3,
}
const DC_LABELS  = { dc_face: 'Face to Face', dc_nonface: 'Non-Face to Face' }
const DC_WEIGHTS = { dc_face: 1, dc_nonface: 2 }
const CONDUCT_LABELS = {
  co_employed:'Employed', co_self_employed:'Self-Employed', co_retired:'Retired',
  co_nonresident:'Non-Resident / Foreign Address', co_crossborder:'Cross-Border Transaction',
  co_thirdparty:'Third Party Payment', co_complex:'Complex Ownership Structure',
  co_unemployed:'Unemployed', co_cash:'Cash Payment', co_crypto:'Cryptocurrency / Digital Assets',
  co_unwilling:'Unwillingness to Provide Due Diligence Documents',
  co_suspicion:'Suspicion of Money Laundering / Terrorist Financing',
  co_secrecy:'Secrecy / Lack of Transparency', co_evasive:'Evasiveness or Inconsistent Information',
}
const CONDUCT_WEIGHTS = {
  co_employed:1, co_self_employed:1, co_retired:1,
  co_nonresident:2, co_crossborder:2, co_thirdparty:2, co_complex:2,
  co_unemployed:3, co_cash:3, co_crypto:3, co_unwilling:3, co_suspicion:3, co_secrecy:3, co_evasive:3,
}
const RISK_COLOR = { Low: '#16a34a', Medium: '#d97706', High: '#dc2626' }
const RISK_BG    = { Low: '#f0fdf4', Medium: '#fffbeb', High: '#fef2f2' }

function buildRiskPdfHtml({ clientName, idNumber, clientTypes, deliveryChannel, conduct, score, riskLabel, riskCode, riskDesc }) {
  const today = new Date().toLocaleDateString('en-ZA', { day:'2-digit', month:'long', year:'numeric' })
  const rc = RISK_COLOR[riskLabel] || '#374151'
  const rb = RISK_BG[riskLabel] || '#f8fafc'

  const ctMax = clientTypes.length ? Math.max(...clientTypes.map(id => CLIENT_TYPE_WEIGHTS[id] || 0)) : 0
  const dcW   = DC_WEIGHTS[deliveryChannel] || 0
  const coMax = conduct.length ? Math.max(...conduct.map(id => CONDUCT_WEIGHTS[id] || 0)) : 0

  function itemRow(label, weight, checked) {
    const wc = weight === 1 ? '#16a34a' : weight === 2 ? '#d97706' : '#dc2626'
    const wb = weight === 1 ? '#f0fdf4' : weight === 2 ? '#fffbeb' : '#fef2f2'
    return `<tr>
      <td style="padding:5px 10px;vertical-align:middle">
        <span style="display:inline-block;width:14px;height:14px;border:2px solid ${checked ? wc : '#d1d5db'};border-radius:3px;background:${checked ? wc : '#fff'};vertical-align:middle;margin-right:8px;"></span>
        <span style="color:${checked ? '#0f172a' : '#9ca3af'};font-weight:${checked ? 600 : 400}">${label}</span>
      </td>
      <td style="padding:5px 10px;text-align:center">
        <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:${wb};color:${wc};border:1px solid ${wc}40">
          ${weight === 1 ? 'Low' : weight === 2 ? 'Medium' : 'High'}
        </span>
      </td>
    </tr>`
  }

  const ctRows   = Object.entries(CLIENT_TYPE_LABELS).map(([id, lbl]) => itemRow(lbl, CLIENT_TYPE_WEIGHTS[id], clientTypes.includes(id))).join('')
  const coRows   = Object.entries(CONDUCT_LABELS).map(([id, lbl]) => itemRow(lbl, CONDUCT_WEIGHTS[id], conduct.includes(id))).join('')
  const dcRows   = Object.entries(DC_LABELS).map(([id, lbl]) => {
    const w = DC_WEIGHTS[id]; const checked = deliveryChannel === id
    const wc = w === 1 ? '#16a34a' : '#d97706'
    const wb = w === 1 ? '#f0fdf4' : '#fffbeb'
    return `<tr>
      <td style="padding:5px 10px;vertical-align:middle">
        <span style="display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid ${checked ? wc : '#d1d5db'};background:${checked ? wc : '#fff'};vertical-align:middle;margin-right:8px"></span>
        <span style="color:${checked ? '#0f172a' : '#9ca3af'};font-weight:${checked ? 600 : 400}">${lbl}</span>
      </td>
      <td style="padding:5px 10px;text-align:center">
        <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:${wb};color:${wc};border:1px solid ${wc}40">${w === 1 ? 'Low' : 'Medium'}</span>
      </td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #374151; background: #fff; padding: 24px; }
  .header { background: #0f172a; color: #fff; padding: 18px 24px; border-radius: 8px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-title { font-size: 20px; font-weight: 700; }
  .header-sub { font-size: 11px; opacity: 0.65; margin-top: 4px; }
  .header-right { text-align: right; font-size: 11px; opacity: 0.7; }
  .client-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; gap: 32px; }
  .client-field { }
  .client-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 3px; }
  .client-value { font-weight: 700; font-size: 14px; color: #0f172a; }
  .result-box { border-radius: 8px; padding: 14px 20px; margin-bottom: 16px; display: flex; gap: 32px; align-items: center; background: ${rb}; border: 2px solid ${rc}40; }
  .result-score { font-size: 42px; font-weight: 900; color: ${rc}; line-height: 1; }
  .result-score span { font-size: 14px; font-weight: 400; color: #94a3b8; margin-left: 3px; }
  .result-label { font-size: 22px; font-weight: 800; color: ${rc}; }
  .result-code { font-weight: 700; color: ${rc}; font-size: 13px; }
  .result-desc { font-size: 11px; color: #64748b; margin-top: 2px; }
  .score-breakdown { display: flex; gap: 10px; margin-bottom: 16px; }
  .score-pill { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 7px; padding: 8px 12px; text-align: center; }
  .score-pill-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
  .score-pill-value { font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 2px; }
  .section { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
  .section-head { background: #f8fafc; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 10px; }
  .section-num { width: 24px; height: 24px; border-radius: 50%; background: #111111; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; flex-shrink: 0; }
  .section-title { font-weight: 700; color: #0f172a; font-size: 13px; }
  .section-sub { font-size: 11px; color: #64748b; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; }
  tr:nth-child(even) { background: #f9fafb; }
  .score-col { width: 100px; }
  .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
</style>
</head><body>

<div class="header">
  <div>
    <div class="header-title">FICA Risk Score Card</div>
    <div class="header-sub">Miltons Matsemela | Version 1.3 | Compliance Assessment</div>
  </div>
  <div class="header-right">
    <div>Date: ${today}</div>
    <div style="margin-top:4px">Confidential — Internal Use Only</div>
  </div>
</div>

<div class="client-box">
  <div class="client-field"><div class="client-label">Client Name</div><div class="client-value">${clientName}</div></div>
  ${idNumber ? `<div class="client-field"><div class="client-label">ID / Reg Number</div><div class="client-value">${idNumber}</div></div>` : ''}
</div>

<div class="result-box">
  <div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Total Risk Score</div>
    <div class="result-score">${score}<span>/8</span></div></div>
  <div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Risk Rating</div>
    <div class="result-label">${riskLabel} Risk</div></div>
  <div><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Due Diligence Level</div>
    <div class="result-code">${riskCode}</div><div class="result-desc">${riskDesc}</div></div>
</div>

<div class="score-breakdown">
  <div class="score-pill"><div class="score-pill-label">Client Type</div><div class="score-pill-value">${ctMax}</div></div>
  <div class="score-pill"><div class="score-pill-label">Delivery Channel</div><div class="score-pill-value">${dcW}</div></div>
  <div class="score-pill"><div class="score-pill-label">Conduct &amp; Attributes</div><div class="score-pill-value">${coMax}</div></div>
</div>

<div class="section">
  <div class="section-head">
    <div class="section-num">1</div>
    <div><div class="section-title">Client Type</div><div class="section-sub">Highest-risk selected item determines section score</div></div>
  </div>
  <table><thead><tr><th style="padding:6px 10px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;border-bottom:1px solid #e2e8f0">Category</th><th style="padding:6px 10px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600;border-bottom:1px solid #e2e8f0;width:100px">Risk Level</th></tr></thead>
  <tbody>${ctRows}</tbody></table>
</div>

<div class="section">
  <div class="section-head">
    <div class="section-num">2</div>
    <div><div class="section-title">Delivery Channel</div></div>
  </div>
  <table><thead><tr><th style="padding:6px 10px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;border-bottom:1px solid #e2e8f0">Channel</th><th style="padding:6px 10px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600;border-bottom:1px solid #e2e8f0;width:100px">Risk Level</th></tr></thead>
  <tbody>${dcRows}</tbody></table>
</div>

<div class="section">
  <div class="section-head">
    <div class="section-num">3</div>
    <div><div class="section-title">Client Conduct &amp; Attributes</div><div class="section-sub">Highest-risk selected item determines section score</div></div>
  </div>
  <table><thead><tr><th style="padding:6px 10px;text-align:left;font-size:11px;color:#94a3b8;font-weight:600;border-bottom:1px solid #e2e8f0">Attribute</th><th style="padding:6px 10px;text-align:center;font-size:11px;color:#94a3b8;font-weight:600;border-bottom:1px solid #e2e8f0;width:100px">Risk Level</th></tr></thead>
  <tbody>${coRows}</tbody></table>
</div>

<div class="footer">
  <span>Generated by Miltons Matsemela FICA Compliance Portal</span>
  <span>This document is for internal compliance purposes only</span>
</div>

</body></html>`
}

app.post('/api/risk-pdf', async (req, res) => {
  const { clientName, idNumber, clientTypes, deliveryChannel, conduct, score, riskLabel, riskCode, riskDesc } = req.body
  if (!clientName) return res.status(400).json({ error: 'clientName required' })
  console.log(`[RiskPDF] Generating for: ${clientName}`)
  try {
    const html = buildRiskPdfHtml({ clientName, idNumber, clientTypes, deliveryChannel, conduct, score, riskLabel, riskCode, riskDesc })
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    })
    await browser.close()
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="RiskScoreCard_${safeName}.pdf"`)
    res.send(Buffer.from(pdfBuffer))
    console.log(`[RiskPDF] Done: ${clientName}`)
  } catch (err) {
    console.error('[RiskPDF] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── UN Sanctions ──────────────────────────────────────────────────────────────
const UN_XML_URL  = 'https://scsanctions.un.org/resources/xml/en/consolidated.xml'
const UN_XML_PATH = path.join(__dirname, 'public', 'un_sanctions.xml')
const UN_CACHE_MS = 24 * 60 * 60 * 1000

async function getUNList() {
  const needsRefresh = !fs.existsSync(UN_XML_PATH) ||
    (Date.now() - fs.statSync(UN_XML_PATH).mtimeMs > UN_CACHE_MS)
  if (needsRefresh) {
    console.log('[UN]   Downloading latest sanctions list…')
    const res = await fetch(UN_XML_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compliance research)' } })
    if (!res.ok) throw new Error(`Failed to download UN list: ${res.status}`)
    fs.writeFileSync(UN_XML_PATH, await res.text(), 'utf8')
    console.log('[UN]   List downloaded and cached')
  }
  return fs.readFileSync(UN_XML_PATH, 'utf8')
}

function searchUNXML(xml, clientName) {
  const normalise = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim()
  const searchTokens = normalise(clientName).split(/\s+/).filter(t => t.length > 1)
  const matches = []
  const entityRegex = /<(INDIVIDUAL|ENTITY)>([\s\S]*?)<\/\1>/g
  let m
  while ((m = entityRegex.exec(xml)) !== null) {
    const block = m[2]
    const blockNorm = normalise(block)
    const score = searchTokens.filter(t => blockNorm.includes(t)).length
    if (score >= Math.max(1, searchTokens.length - 1)) {
      const firstName  = (block.match(/<FIRST_NAME>([^<]*)<\/FIRST_NAME>/)  || [])[1] || ''
      const lastName   = (block.match(/<SECOND_NAME>([^<]*)<\/SECOND_NAME>/) || [])[1] || (block.match(/<THIRD_NAME>([^<]*)<\/THIRD_NAME>/) || [])[1] || ''
      const entityName = (block.match(/<NAME_ORIGINAL_SCRIPT>([^<]*)/) || [])[1] || (block.match(/<NAME_OF_ENTITY>([^<]*)<\/NAME_OF_ENTITY>/) || [])[1] || ''
      const listedOn   = (block.match(/<LISTED_ON>([^<]*)<\/LISTED_ON>/) || [])[1] || ''
      const nationality= (block.match(/<NATIONALITY[^>]*>[\s\S]*?<VALUE>([^<]*)<\/VALUE>/) || [])[1] || ''
      matches.push({ name: entityName || [firstName, lastName].filter(Boolean).join(' '), listedOn, nationality, type: m[1], score })
    }
  }
  matches.sort((a, b) => b.score - a.score)
  return matches.slice(0, 5)
}

async function generateUNReport(clientName, matches, screenshotPath) {
  const resultHTML = matches.length > 0
    ? matches.map(m => `<tr style="background:#fef2f2"><td style="padding:8px 12px;border-bottom:1px solid #fecaca;font-weight:700;color:#dc2626">${m.name}</td><td style="padding:8px 12px;border-bottom:1px solid #fecaca">${m.type}</td><td style="padding:8px 12px;border-bottom:1px solid #fecaca">${m.nationality}</td><td style="padding:8px 12px;border-bottom:1px solid #fecaca">${m.listedOn}</td></tr>`).join('')
    : `<tr><td colspan="4" style="padding:16px;text-align:center;color:#16a34a;font-weight:700">✅ No matches found — ${clientName} does not appear on the UN Consolidated Sanctions List</td></tr>`
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;margin:0;padding:24px;background:#fff}.header{background:#111111;color:#fff;padding:16px 20px;border-radius:8px;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f8fafc;padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0;color:#64748b}</style></head><body><div class="header"><div style="font-size:18px;font-weight:700">UN Consolidated Sanctions List</div><div style="opacity:.8;font-size:12px;margin-top:4px">Search: ${clientName} — ${new Date().toLocaleDateString('en-ZA')}</div></div><table><thead><tr><th>Name</th><th>Type</th><th>Nationality</th><th>Listed On</th></tr></thead><tbody>${resultHTML}</tbody></table></body></html>`
  const browser = await puppeteer.launch({ headless: true, executablePath: CHROMIUM_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1000, height: 600 })
  await page.setContent(html, { waitUntil: 'networkidle0' })
  await page.screenshot({ path: screenshotPath, fullPage: true })
  await browser.close()
}

app.post('/api/un-search', async (req, res) => {
  const { clientName } = req.body
  if (!clientName) return res.status(400).json({ error: 'clientName required' })
  console.log(`[UN]   Searching: ${clientName}`)
  try {
    const xml     = await getUNList()
    const matches = searchUNXML(xml, clientName)
    const ts       = Date.now()
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `UN_${safeName}_${ts}.png`
    const filepath = path.join(SCREENSHOTS_DIR, filename)
    await generateUNReport(clientName, matches, filepath)
    const base64 = fs.readFileSync(filepath).toString('base64')
    logAudit(req.body.actorId, req.body.actorName, 'UN_SEARCH', 'client', req.body.entityId || null,
      clientName, `Result: ${matches.length > 0 ? 'flagged' : 'clear'} (${matches.length} matches)`).catch(() => {})
    res.json({ screenshot: `/screenshots/${filename}`, screenshotBase64: `data:image/png;base64,${base64}`, result: matches.length > 0 ? 'flagged' : 'clear', matchCount: matches.length, matches })
  } catch (err) {
    console.error('[UN]   Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅  MM FICA API running on http://localhost:${PORT}`)
  })
}).catch(err => {
  console.error('DB init failed:', err.message)
  // Start anyway if no DB (allows local dev without Postgres)
  console.error('Starting server without DB connection...')
  app.listen(PORT, () => {
    console.log(`\n⚠️  MM FICA API running (no DB) on http://localhost:${PORT}`)
  })
})

/**
 * FIC TFS Portal — Automated Search & Screenshot
 * Miltons Matsemela Compliance Tool
 *
 * Usage:
 *   node fic-search.js "John Smith"
 *   node fic-search.js "Sunset Properties" --entity
 *
 * Requires: npm install puppeteer
 */

import puppeteer from 'puppeteer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Client data lookup ───────────────────────────────────────────────────────
// Add your clients here — name must match what you pass on the command line
const CLIENTS = {
  'John Smith': {
    name: 'John',
    surname: 'Smith',
    idNumber: '8001015009087',
    dateOfBirth: '1980-01-15',
    nationality: 'South African',
  },
  'Sunset Properties (Pty) Ltd': {
    name: 'Sunset Properties (Pty) Ltd',
    type: 'entity',
  },
}

// ─── Helper: fill a field by its label text ──────────────────────────────────
async function fillByLabel(page, labelText, value) {
  if (!value) return false
  const filled = await page.evaluate((labelText, value) => {
    const labels = Array.from(document.querySelectorAll('label'))
    const label = labels.find(l => l.textContent.trim().toLowerCase().includes(labelText.toLowerCase()))
    if (!label) return false
    const input = label.control ||
      (label.htmlFor ? document.getElementById(label.htmlFor) : null) ||
      label.parentElement?.querySelector('input, textarea') ||
      label.nextElementSibling
    if (!input) return false
    input.focus()
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, labelText, value)
  return filled
}

// ─── Helper: fill nth input directly ─────────────────────────────────────────
async function fillNthInput(page, index, value) {
  if (!value) return
  await page.evaluate((index, value) => {
    const inputs = Array.from(document.querySelectorAll(
      '#tabs-1 input[type="text"], #tabs-1 input:not([type])'
    ))
    if (inputs[index]) {
      inputs[index].focus()
      inputs[index].value = value
      inputs[index].dispatchEvent(new Event('input', { bubbles: true }))
      inputs[index].dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, index, value)
}

// ─── Main search function ─────────────────────────────────────────────────────
async function ficSearch(clientName, isEntity = false) {
  const clientData = CLIENTS[clientName] || { name: clientName }
  const isEntityType = isEntity || clientData.type === 'entity'

  console.log(`\n🔍 FIC TFS Search`)
  console.log(`   Client : ${clientName}`)
  if (clientData.idNumber) console.log(`   ID     : ${clientData.idNumber}`)
  if (clientData.dateOfBirth) console.log(`   DOB    : ${clientData.dateOfBirth}`)
  console.log('─'.repeat(50))

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 920 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 920 })

  try {
    // 1. Load portal
    console.log('⏳ Opening FIC TFS portal...')
    await page.goto('https://tfs.fic.gov.za/Pages/Search', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
    await new Promise(r => setTimeout(r, 1500))
    console.log('✓ Portal loaded')

    if (isEntityType) {
      // ── Entity search ──
      console.log('   Mode: Entity search')
      const entityTab = await page.$('a[href="#tabs-2"]')
      if (entityTab) await entityTab.click()
      await new Promise(r => setTimeout(r, 800))

      await page.evaluate((name) => {
        const inputs = Array.from(document.querySelectorAll(
          '#tabs-2 input[type="text"], #tabs-2 input:not([type])'
        ))
        if (inputs[0]) {
          inputs[0].focus()
          inputs[0].value = name
          inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
          inputs[0].dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, clientData.name || clientName)
      console.log(`✓ Entity name entered`)

    } else {
      // ── Person search ──
      console.log('   Mode: Person search')

      // Try label-based approach first, fall back to positional
      const fields = [
        { label: 'name',                   value: clientName,            index: 0 },
        { label: 'identification number',  value: clientData.idNumber,   index: 1 },
        { label: 'place of birth',         value: clientData.placeOfBirth, index: 2 },
        { label: 'date of birth',          value: clientData.dateOfBirth, index: 3 },
        { label: 'nationality',            value: clientData.nationality, index: 4 },
      ]

      for (const field of fields) {
        if (!field.value) continue
        const ok = await fillByLabel(page, field.label, field.value)
        if (!ok) await fillNthInput(page, field.index, field.value)
        console.log(`✓ ${field.label}: ${field.value}`)
        await new Promise(r => setTimeout(r, 200))
      }
    }

    // 2. Screenshot with form filled
    await new Promise(r => setTimeout(r, 500))

    // 3. Click Search button
    const clicked = await page.evaluate((isEntity) => {
      const tabId = isEntity ? '#tabs-2' : '#tabs-1'
      const btns = Array.from(document.querySelectorAll(
        `${tabId} input[type="button"], ${tabId} button, ${tabId} input[type="submit"]`
      ))
      const btn = btns.find(b => (b.value || b.textContent || '').toLowerCase().includes('search'))
      if (btn) { btn.click(); return true }
      // fallback: any search button on page
      const all = Array.from(document.querySelectorAll('input[type="button"], button'))
      const any = all.find(b => (b.value || b.textContent || '').toLowerCase().includes('search'))
      if (any) { any.click(); return true }
      return false
    }, isEntityType)

    if (clicked) {
      console.log('✓ Search submitted')
    } else {
      // Fallback: press Enter in the first input
      await page.keyboard.press('Return')
      console.log('✓ Search submitted (Enter key)')
    }

    // 4. Wait for results to render
    console.log('⏳ Waiting for results...')
    await new Promise(r => setTimeout(r, 4000))

    // 5. Save screenshot
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `FIC_Search_${safeName}_${timestamp}.png`
    const outputPath = path.join(__dirname, filename)

    await page.screenshot({ path: outputPath, fullPage: true })
    console.log(`✓ Screenshot saved: ${filename}`)

    // 6. Read results text
    const summary = await page.evaluate(() => {
      const resultArea = document.querySelector('#tabs-1 table, #tabs-2 table')
      return resultArea ? resultArea.innerText.trim() : ''
    })

    if (summary && summary.replace(/\s|Name|ID Number|Title/g, '').length > 10) {
      console.log('\n⚠️  RESULTS FOUND — review screenshot carefully')
      console.log(summary.slice(0, 500))
    } else {
      console.log('\n✅ CLEAR — No matches found on FIC TFS list')
    }

    return { filename, outputPath }

  } finally {
    await new Promise(r => setTimeout(r, 1000))
    await browser.close()
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const clientName = args.find(a => !a.startsWith('--'))
const isEntity = args.includes('--entity')

if (!clientName) {
  console.error('❌  Usage: node fic-search.js "Client Name" [--entity]')
  console.error('   Examples:')
  console.error('     node fic-search.js "John Smith"')
  console.error('     node fic-search.js "Sunset Properties (Pty) Ltd" --entity')
  process.exit(1)
}

ficSearch(clientName, isEntity)
  .then(({ filename }) => console.log(`\n✅  Done — screenshot saved as: ${filename}`))
  .catch(err => { console.error('❌  Error:', err.message); process.exit(1) })

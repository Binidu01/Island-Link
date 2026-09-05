import { Hono } from 'hono'
import { getEnv, requireEnv } from 'bini-env'

const app = new Hono()

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface EmailRequestBody {
  to?: string
  subject?: string
  html?: string
  text?: string
}

interface BrevoResponse {
  messageId: string
}

// ─────────────────────────────────────────────
// BREVO SEND
// ─────────────────────────────────────────────
async function sendBrevoEmail(
  apiKey: string,
  fromEmail: string,
  senderName: string,
  to: string,
  subject: string,
  html?: string,
  text?: string
): Promise<BrevoResponse> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      `Brevo API error ${res.status}: ${(body as any).message || res.statusText}`
    )
  }

  return res.json() as Promise<BrevoResponse>
}

// ─────────────────────────────────────────────
// RATE LIMIT
// ─────────────────────────────────────────────
const rateMap = new Map<string, { count: number; ts: number }>()
const RATE_LIMIT = 5
const WINDOW_MS = 60_000

function getClientIP(c: any): string {
  return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)

  if (!entry) {
    rateMap.set(ip, { count: 1, ts: now })
    return true
  }

  if (now - entry.ts > WINDOW_MS) {
    rateMap.set(ip, { count: 1, ts: now })
    return true
  }

  if (entry.count >= RATE_LIMIT) return false

  entry.count++
  return true
}

// ─────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────
function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
}

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s
}

// ─────────────────────────────────────────────
// POST /api/email
// ─────────────────────────────────────────────
app.post('/email', async (c) => {
  // ⭐ EXACTLY the same pattern as chat.ts
  const ctx = c as any

  try {
    const ip = getClientIP(c)

    if (!checkRateLimit(ip)) {
      return c.json({ ok: false, error: 'Rate limit exceeded' }, 429)
    }

    const body = (await c.req.json()) as EmailRequestBody

    const to = String(body?.to ?? '').trim()
    const subjectRaw = String(body?.subject ?? '').trim()
    const htmlRaw = body?.html ? String(body.html) : ''
    const textRaw = body?.text ? String(body.text) : ''

    // ───── VALIDATION ─────
    if (!isEmail(to)) {
      return c.json({ ok: false, error: 'Invalid email address' }, 400)
    }

    if (!subjectRaw) {
      return c.json({ ok: false, error: 'Missing subject' }, 400)
    }

    if (!htmlRaw && !textRaw) {
      return c.json({ ok: false, error: 'Missing email content' }, 400)
    }

    // ───── SANITIZE ─────
    const subject = clamp(subjectRaw, 140)
    const text = textRaw ? clamp(textRaw, 10_000) : undefined
    const html = htmlRaw ? clamp(sanitizeHtml(htmlRaw), 50_000) : undefined

    // ───── ENV (EXACTLY the same pattern as chat.ts) ─────
    const apiKey = requireEnv(ctx, 'BREVO_API_KEY')
    const fromEmail = requireEnv(ctx, 'FROM_EMAIL')
    const senderName = requireEnv(ctx, 'SENDER_NAME')

    // ───── SEND ─────
    const result = await sendBrevoEmail(apiKey, fromEmail, senderName, to, subject, html, text)

    return c.json({ ok: true, messageId: result.messageId }, 200)
  } catch (err: any) {
    // ⭐ EXACTLY the same error handling as chat.ts
    if (err.message?.includes('[bini-env] Missing required')) {
      console.error('❌ Missing env var:', err.message)
      return c.json({ ok: false, error: 'Email service misconfigured' }, 500)
    }

    console.error('EMAIL_ERROR:', err.message)
    return c.json({ ok: false, error: err?.message || 'Internal server error' }, 500)
  }
})

// ─────────────────────────────────────────────
// GET /api/email (HEALTH CHECK)
// ─────────────────────────────────────────────
app.get('/email', (c) => {
  return c.json({
    ok: true,
    service: 'email',
    status: 'operational',
    timestamp: Date.now(),
  })
})

// ─────────────────────────────────────────────
// DEBUG ENDPOINT (EXACTLY the same pattern as chat.ts)
// ─────────────────────────────────────────────
app.get('/email-debug', (c) => {
  const ctx = c as any
  
  // ⭐ EXACTLY the same pattern as chat.ts
  const apiKey = getEnv(ctx, 'BREVO_API_KEY')
  const fromEmail = getEnv(ctx, 'FROM_EMAIL')
  const senderName = getEnv(ctx, 'SENDER_NAME')
  
  return c.json({
    env_status: {
      BREVO_API_KEY: apiKey ? `✅ Found (${apiKey.substring(0, 10)}...)` : '❌ Missing',
      FROM_EMAIL: fromEmail || '❌ Missing',
      SENDER_NAME: senderName || '❌ Missing'
    },
    status: (apiKey && fromEmail && senderName) ? '✅ Ready to send emails!' : '❌ Missing environment variables',
    tip: 'Using the exact same pattern as working chat.ts API'
  })
})

export default app
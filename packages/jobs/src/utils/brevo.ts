import type { CreateEmailOptions } from 'resend'
import { env } from '@ticketur/env/core'

const ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

/**
 * Brevo is the standby transport behind Resend (see ./email.ts). It is a
 * separate account on a paid plan, so it is not subject to the daily ceiling
 * that stops Resend's free tier at ~200 messages a day — which is what makes
 * it useful as a fallback rather than just a second way to fail.
 *
 * It is optional: with BREVO_API_KEY unset the fallback is simply off and a
 * Resend failure surfaces as it always did.
 */
export function brevoConfigured(): boolean {
  return Boolean(env.BREVO_API_KEY)
}

/**
 * Resend takes the sender as one RFC 5322 string ("Ticketeur <no@reply>");
 * Brevo wants the name and the address as separate fields. A bare address with
 * no display name is also valid, hence the fallback branch.
 */
function parseSender(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/)
  const email = match?.[2]?.trim()
  if (!email) return { email: from.trim() }
  const name = match?.[1]?.replace(/^"|"$/g, '').trim()
  return name ? { name, email } : { email }
}

function toList(to: CreateEmailOptions['to']): { email: string }[] {
  if (!to) return []
  return (Array.isArray(to) ? to : [to]).map((email) => ({ email }))
}

/**
 * Brevo's v3 API has no CID support — their own documentation says to host the
 * image and reference an absolute URL instead. An <img src="cid:…"> left in the
 * body renders as a broken-image icon, which is worse than no image, so inline
 * references are stripped on the way out. The file still travels as a normal
 * attachment, and Gmail (the bulk of this audience) previews an attached image
 * inside the message anyway.
 */
function stripInlineImageRefs(html: string): string {
  return html
    .replace(/<p>\s*<img[^>]+src=["']cid:[^"']*["'][^>]*>\s*<\/p>/gi, '')
    .replace(/<img[^>]+src=["']cid:[^"']*["'][^>]*>/gi, '')
}

type BrevoAttachment = { name: string; content?: string; url?: string }

function toAttachments(
  attachments: CreateEmailOptions['attachments']
): BrevoAttachment[] | undefined {
  if (!attachments?.length) return undefined
  const mapped: BrevoAttachment[] = []
  for (const a of attachments) {
    const name = typeof a.filename === 'string' ? a.filename : 'attachment'
    if (a.path) {
      mapped.push({ name, url: a.path })
      continue
    }
    if (!a.content) continue
    const content =
      typeof a.content === 'string'
        ? a.content
        : Buffer.from(
            a.content instanceof ArrayBuffer
              ? new Uint8Array(a.content)
              : a.content
          ).toString('base64')
    mapped.push({ name, content })
  }
  return mapped.length > 0 ? mapped : undefined
}

export class BrevoError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'BrevoError'
  }
}

/**
 * Sends one message through Brevo, translating the Resend payload shape the
 * rest of this package already speaks. Returns Brevo's messageId.
 *
 * Note there is no idempotency key: Brevo has no equivalent. That is why the
 * fallback in ./email.ts is reached only for errors that prove Resend sent
 * nothing (its quota and rate-limit refusals, which are rejected before any
 * message leaves). Falling back on an *ambiguous* Resend failure would risk
 * delivering the same message twice.
 */
export async function sendViaBrevo(
  payload: CreateEmailOptions
): Promise<string> {
  const apiKey = env.BREVO_API_KEY
  if (!apiKey) throw new BrevoError('BREVO_API_KEY is not set', 0)

  const html = typeof payload.html === 'string' ? payload.html : undefined
  const text = typeof payload.text === 'string' ? payload.text : undefined

  // CreateEmailOptions is a union: its template variant makes `from` and
  // `subject` optional and carries no body we could re-render here, because
  // the template lives inside Resend. Refuse such a payload loudly rather than
  // send Brevo a half-built message.
  if (!payload.from || !payload.subject || (!html && !text)) {
    throw new BrevoError(
      'This email cannot be sent through Brevo: it needs an explicit from, ' +
        'subject and html/text body (a Resend-hosted template has none).',
      0
    )
  }

  const body: Record<string, unknown> = {
    sender: parseSender(payload.from),
    to: toList(payload.to),
    subject: payload.subject,
    ...(html ? { htmlContent: stripInlineImageRefs(html) } : {}),
    ...(text ? { textContent: text } : {}),
  }

  const replyTo = Array.isArray(payload.replyTo)
    ? payload.replyTo[0]
    : payload.replyTo
  if (replyTo) body.replyTo = { email: replyTo }
  if (payload.headers) body.headers = payload.headers

  const attachment = toAttachments(payload.attachments)
  if (attachment) body.attachment = attachment

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json().catch(() => ({}))) as {
    messageId?: string
    code?: string
    message?: string
  }

  if (!res.ok) {
    // Brevo answers every bad credential with the same opaque "Key not found",
    // whether the value is wrong, quoted, truncated, or the base64 MCP key
    // pasted by mistake. Say which so the next person does not have to bisect
    // it against the live API.
    const hint =
      res.status === 401
        ? ' — check BREVO_API_KEY is the raw xkeysib-… value: not the base64' +
          ' MCP key, not wrapped in quotes, and not truncated'
        : ''
    throw new BrevoError(
      `Brevo rejected the email: ${json.code ?? res.status} - ${json.message ?? 'no detail'}${hint}`,
      res.status
    )
  }

  return json.messageId ?? ''
}

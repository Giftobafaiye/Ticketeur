import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'

import { db } from '@ticketur/db'

export const dynamic = 'force-dynamic'

// Longest a probe waits on the shared Postgres before the app reports itself
// unhealthy. Bounds the route so an external monitor always gets an answer
// within its own timeout instead of hanging on a stalled database.
const DB_CHECK_TIMEOUT_MS = 2000

async function isDatabaseReachable(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), DB_CHECK_TIMEOUT_MS)
  })

  try {
    // The `.catch` keeps a connection error from surfacing as an unhandled
    // rejection when the timeout wins the race.
    return await Promise.race([
      db
        .execute(sql`select 1`)
        .then(() => true)
        .catch(() => false),
      timedOut,
    ])
  } finally {
    clearTimeout(timer)
  }
}

// Public readiness probe for external uptime monitors. The app reads the shared
// Postgres on its core request paths, so a database it cannot reach means
// production is failing every request even while the process is up; returning
// 503 surfaces that where a liveness-only check would stay green. It exposes
// reachability only, never data.
export async function GET() {
  const database = await isDatabaseReachable()

  return NextResponse.json(
    {
      status: database ? 'ok' : 'error',
      checks: { database: database ? 'ok' : 'error' },
    },
    {
      status: database ? 200 : 503,
      headers: { 'cache-control': 'no-store' },
    }
  )
}

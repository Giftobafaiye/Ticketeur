#!/usr/bin/env node
// Applies the drizzle migration set in ./drizzle.
//
// Vercel runs this package's `db:migrate` from the ticketeur-landing install
// command on every deployment, including preview deployments built from
// un-reviewed branches. DATABASE_URL is scoped to preview and points at the
// production database, so a preview build would otherwise apply unreviewed
// migrations to production. Only a production build (or a local/CI run, where
// VERCEL_ENV is unset) is allowed to migrate.
import { spawnSync } from 'node:child_process'

const vercelEnv = process.env.VERCEL_ENV

if (vercelEnv && vercelEnv !== 'production') {
  console.log(
    `Skipping database migrations: VERCEL_ENV=${vercelEnv}. ` +
      'Preview and development deployments must not mutate the production database.',
  )
  process.exit(0)
}

const result = spawnSync('drizzle-kit', ['migrate'], { stdio: 'inherit' })

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)

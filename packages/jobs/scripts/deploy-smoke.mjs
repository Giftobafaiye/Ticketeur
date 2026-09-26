#!/usr/bin/env node
// Triggers the `deploy-smoke` task on the revision production is now serving
// and fails unless the run reaches COMPLETED. The release workflow runs this
// immediately after `trigger deploy`, so a revision that publishes clean but
// cannot execute (a bad dependency, a runtime fault the indexer cannot see) is
// caught before it becomes the only transport for signup, reset and 2FA email.
import { runs, tasks } from '@trigger.dev/sdk'

const TASK_ID = 'deploy-smoke'
const POLL_INTERVAL_MS = 2_000
const TIMEOUT_MS = 180_000

if (!process.env.TRIGGER_SECRET_KEY) {
  console.error(
    'TRIGGER_SECRET_KEY is not set, so the deployed worker cannot be ' +
      'exercised. Add a production Trigger.dev key with trigger access to ' +
      'the Production environment.'
  )
  process.exit(1)
}

const version = process.env.GITHUB_SHA ?? undefined

let handle
try {
  handle = await tasks.trigger(TASK_ID, version ? { version } : {})
} catch (error) {
  console.error(`Could not trigger ${TASK_ID}:`, error)
  process.exit(1)
}

console.log(
  `Triggered ${TASK_ID} as run ${handle.id}` +
    (version ? ` for version ${version}` : '')
)

const deadline = Date.now() + TIMEOUT_MS

while (true) {
  let run
  try {
    run = await runs.retrieve(handle.id)
  } catch (error) {
    console.error(`Could not read run ${handle.id}:`, error)
    process.exit(1)
  }

  if (run.isCompleted) {
    if (run.isSuccess) {
      console.log(
        `Run ${handle.id} completed on version ${run.version ?? 'unknown'}.`
      )
      process.exit(0)
    }

    console.error(
      `Run ${handle.id} finished as ${run.status} on version ` +
        `${run.version ?? 'unknown'}; the deployed worker did not execute the ` +
        'smoke task.'
    )
    if (run.error?.message) console.error(run.error.message)
    process.exit(1)
  }

  if (Date.now() >= deadline) {
    console.error(
      `Run ${handle.id} did not finish within ${TIMEOUT_MS / 1000}s ` +
        `(still ${run.status}); the deployed worker is not serving runs.`
    )
    process.exit(1)
  }

  await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
}

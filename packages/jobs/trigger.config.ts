import { defineConfig } from '@trigger.dev/sdk'

export default defineConfig({
  // Project ref. Prefer TRIGGER_PROJECT_ID (set in local .env), and fall back
  // to Trigger's own TRIGGER_PROJECT_REF — which is what the CI deploy provides.
  // Without the fallback `project` is undefined in CI and `trigger deploy`
  // crashes with "Cannot read properties of undefined (reading 'string')".
  project:
    process.env.TRIGGER_PROJECT_ID ?? process.env.TRIGGER_PROJECT_REF ?? '',
  runtime: 'node-24',
  logLevel: 'log',
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ['./src/tasks'],
})

import 'dotenv/config'
import { z } from 'zod'
import { createEnv } from '@t3-oss/env-core'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_API_KEY: z.string().min(1),
    APP_URLS: z
      .string()
      .default('http://localhost:3000')
      .transform((val) => val.split(',').map((url) => url.trim())),
    GOOGLE_CLIENT_ID: z.string().optional().default(''),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
    RESEND_API_KEY: z.string().min(1),
    TRIGGER_PROJECT_ID: z.string().min(1),
    TRIGGER_SECRET_KEY: z.string().optional(),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    FLW_PUBLIC_KEY: z.string().optional(),
    FLW_SECRET_KEY: z.string().optional(),
    FLW_SECRET_HASH: z.string().optional(),
    // Axiom observability (OpenTelemetry traces + structured logs). Optional
    // so local dev and CI builds without Axiom configured are a graceful no-op.
    AXIOM_TOKEN: z.string().optional(),
    AXIOM_DATASET: z.string().optional(),
    AXIOM_HOST: z.string().default('api.axiom.co'),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: true,
})

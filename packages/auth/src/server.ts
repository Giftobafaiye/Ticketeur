import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, twoFactor, emailOTP } from 'better-auth/plugins'
import { tasks } from '@trigger.dev/sdk'

import { db } from '@ticketur/db'
import { env } from '@ticketur/env/core'

import {
  ac,
  attendee,
  organizer,
  vendor,
  admin as adminRole,
} from './permissions'
import { userAdditionalFields } from './fields'

export function createAuth(cookiePrefix: string) {
  return betterAuth({
    appName: 'Ticketur',
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: 'pg' }),

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await tasks.trigger('send-password-reset', {
          email: user.email,
          name: user.name,
          resetUrl: url,
        })
      },
    },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      },
    },

    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        otpLength: 6,
        expiresIn: 600,
        async sendVerificationOTP({ email, otp, type }) {
          await tasks.trigger('send-verification-otp', {
            email,
            otp,
            type,
          })
        },
      }),
      twoFactor({
        issuer: 'Ticketur',
        otpOptions: {
          sendOTP: async ({ user, otp }) => {
            await tasks.trigger('send-two-factor-otp', {
              email: user.email,
              otp,
            })
          },
        },
      }),
      admin({
        ac,
        roles: {
          attendee,
          organizer,
          vendor,
          admin: adminRole,
        },
        defaultRole: 'attendee',
        adminRoles: ['admin'],
      }),
    ],

    user: {
      additionalFields: userAdditionalFields,
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const allowed = ['attendee', 'organizer', 'vendor']
            const requested = (user as unknown as Record<string, unknown>)
              .requestedRole
            const candidate = typeof requested === 'string' ? requested : ''
            const role = allowed.includes(candidate) ? candidate : 'attendee'
            return { data: { ...user, role, vendorApprovalStatus: null } }
          },
          after: async (user) => {
            void tasks.trigger('send-welcome', {
              email: user.email,
              name: user.name,
            })
          },
        },
      },
    },

    advanced: {
      cookiePrefix,
    },
    trustedOrigins: [...(env.APP_URLS ?? []), env.BETTER_AUTH_URL],
  })
}

export type Auth = ReturnType<typeof createAuth>
export type Session = Awaited<ReturnType<Auth['api']['getSession']>>

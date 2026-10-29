import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, twoFactor, emailOTP, oauthPopup } from 'better-auth/plugins'
import {
  dispatchPasswordReset,
  dispatchTwoFactorOtp,
  dispatchVerificationOtp,
  dispatchWelcome,
} from './notify'

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

export type SocialProviderId = 'google' | 'apple' | 'facebook'

/** The social sign-in providers whose credentials are configured. */
export function enabledSocialProviders(): SocialProviderId[] {
  const configured: [SocialProviderId, string, string][] = [
    ['google', env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET],
    ['apple', env.APPLE_CLIENT_ID, env.APPLE_CLIENT_SECRET],
    ['facebook', env.FACEBOOK_CLIENT_ID, env.FACEBOOK_CLIENT_SECRET],
  ]
  return configured
    .filter(([, id, secret]) => Boolean(id && secret))
    .map(([provider]) => provider)
}

export function createAuth(cookiePrefix: string) {
  return betterAuth({
    appName: 'Ticketur',
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: 'pg' }),

    emailVerification: {
      // Signup verification is owned by the emailOTP plugin below
      // (overrideDefaultEmailVerification + sendVerificationOnSignUp). Setting
      // sendOnSignUp here too would double up the signup email, so it's left off.
      autoSignInAfterVerification: true,
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await dispatchPasswordReset({
          email: user.email,
          name: user.name,
          resetUrl: url,
        })
      },
    },

    // A provider is on exactly when its credentials are set; the sign-in
    // pages ask enabledSocialProviders() which buttons to draw, so a button
    // never leads to a provider that isn't configured.
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        enabled: enabledSocialProviders().includes('google'),
      },
      apple: {
        clientId: env.APPLE_CLIENT_ID,
        clientSecret: env.APPLE_CLIENT_SECRET,
        enabled: enabledSocialProviders().includes('apple'),
      },
      facebook: {
        clientId: env.FACEBOOK_CLIENT_ID,
        clientSecret: env.FACEBOOK_CLIENT_SECRET,
        enabled: enabledSocialProviders().includes('facebook'),
      },
    },

    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        otpLength: 6,
        expiresIn: 600,
        async sendVerificationOTP({ email, otp, type }) {
          await dispatchVerificationOtp({
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
            await dispatchTwoFactorOtp({
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
      oauthPopup(),
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
            // Consent is only ever what the person ticked, and it is stamped
            // with when they gave it.
            const marketingOptIn =
              (user as unknown as Record<string, unknown>).marketingOptIn ===
              true
            return {
              data: {
                ...user,
                role,
                vendorApprovalStatus: null,
                marketingOptIn,
                marketingConsentAt: marketingOptIn ? new Date() : null,
              },
            }
          },
          after: async (user) => {
            // Fire-and-forget: a failed welcome email must not fail signup,
            // but the rejection still has to be reported instead of unhandled.
            void dispatchWelcome({
              email: user.email,
              name: user.name,
            }).catch((error: unknown) => {
              console.error('[auth] welcome email failed', error)
            })
          },
        },
        update: {
          // Two-factor sign-in is not optional for admins. Granting the role
          // turns it on, and an admin cannot switch it off for themselves.
          // The admin app's proxy refuses an admin session without it, so a
          // write that bypasses this hook (a direct DB update) locks the
          // account out of the console rather than letting it in unguarded.
          before: async (data, ctx) => {
            const adminDisablingOwn2fa =
              ctx?.path === '/two-factor/disable' &&
              ctx.context.session?.user.role === 'admin'
            if (data.role === 'admin' || adminDisablingOwn2fa) {
              return { data: { ...data, twoFactorEnabled: true } }
            }
          },
        },
      },
    },

    advanced: {
      cookiePrefix,
    },
    // env.BETTER_AUTH_URL is optional in @ticketur/env/core (the Trigger.dev
    // worker loads that module without it), so drop it when it is unset.
    trustedOrigins: [
      ...(env.APP_URLS ?? []),
      env.BETTER_AUTH_URL,
      // Apple returns to the callback with a form POST from its own origin.
      enabledSocialProviders().includes('apple')
        ? 'https://appleid.apple.com'
        : undefined,
    ].filter((origin): origin is string => origin !== undefined),
  })
}

export type Auth = ReturnType<typeof createAuth>
export type Session = Awaited<ReturnType<Auth['api']['getSession']>>

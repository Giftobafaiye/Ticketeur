import { and, eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { account, user } from '@ticketur/db'

import { createTRPCRouter, protectedProcedure } from '../../trpc'

// Roles a person may pick for themselves. `admin` is deliberately absent — it
// is seeded, never self-assigned.
const selectableRole = z.enum(['attendee', 'organizer', 'vendor'])

export const accountProfileRouter = createTRPCRouter({
  // The signed-in person's own account, for /account and /account/settings.
  get: protectedProcedure.query(async ({ ctx }) => {
    const [me] = await ctx.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        createdAt: user.createdAt,
        twoFactorEnabled: user.twoFactorEnabled,
        marketingOptIn: user.marketingOptIn,
        marketingConsentAt: user.marketingConsentAt,
      })
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1)
    if (!me) throw new TRPCError({ code: 'NOT_FOUND' })

    // Whether a password exists to change: someone who signed up with Google
    // has no credential account.
    const [credential] = await ctx.db
      .select({ id: account.id })
      .from(account)
      .where(
        and(eq(account.userId, me.id), eq(account.providerId, 'credential'))
      )
      .limit(1)

    return { ...me, hasPassword: Boolean(credential) }
  }),

  updateName: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(user.id, ctx.session.user.id))
      return { name: input.name }
    }),

  // Marketing email consent: given or withdrawn by the person themselves,
  // stamped with when.
  setMarketingOptIn: protectedProcedure
    .input(z.object({ optIn: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const at = new Date()
      await ctx.db
        .update(user)
        .set({
          marketingOptIn: input.optIn,
          marketingConsentAt: at,
          updatedAt: at,
        })
        .where(eq(user.id, ctx.session.user.id))
      return { optIn: input.optIn, at }
    }),

  // Onboarding for social sign-ups. A Google sign-up carries no requestedRole
  // (the field is parsed from the provider profile, which has no such claim),
  // so the create hook falls back to `attendee` for everyone. This lets a brand
  // new user pick the role they actually came for.
  chooseRole: protectedProcedure
    .input(
      z.object({
        role: selectableRole,
        // A social sign-up never saw the sign-up form's consent box; this is
        // where it is asked instead. Only an explicit tick is recorded.
        marketingOptIn: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const current = ctx.session.user.role ?? 'attendee'
      // Only the default role can be traded in. Anyone already holding a real
      // role (or an admin) must go through moderation, not this endpoint.
      if (current !== 'attendee') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Your account role is already set.',
        })
      }

      await ctx.db
        .update(user)
        .set({
          role: input.role,
          // Mirrors what the signup form records, so the two paths agree.
          requestedRole: input.role,
          // A vendor is not pending until they save a profile — same as the
          // email signup path (see vendor.profile.save).
          vendorApprovalStatus: null,
          ...(input.marketingOptIn && {
            marketingOptIn: true,
            marketingConsentAt: new Date(),
          }),
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.session.user.id))

      return { role: input.role }
    }),
})

export type AccountProfileRouter = typeof accountProfileRouter

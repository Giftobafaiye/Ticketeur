import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { normalizeWebUrl } from '../../lib/web-url'

import { user } from '@ticketur/db'

import { createTRPCRouter, vendorProcedure } from '../../trpc'

// A link as people paste it ("facebook.com/mybiz" included), stored as an
// absolute http(s) URL. Empty clears it. See normalizeWebUrl.
const optionalUrl = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return ''
    const url = normalizeWebUrl(value)
    if (!url) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a web link, e.g. facebook.com/yourpage',
      })
      return z.NEVER
    }
    return url
  })
  .optional()

const profileInput = z.object({
  businessName: z.string().trim().min(1),
  businessLocation: z.string().trim().min(1),
  businessCategory: z.string().trim().min(1),
  phone: z.string().trim().max(32).optional(),
  tagline: z.string().trim().max(160),
  businessDescription: z.string().trim().max(2000),
  instagramUrl: optionalUrl,
  websiteUrl: optionalUrl,
  twitterUrl: optionalUrl,
  facebookUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  // A phone number, rendered as a wa.me link on the public profile.
  whatsapp: z.string().trim().max(32).optional(),
  logoUrl: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  expertise: z.string().trim().max(60),
  focus: z.string().trim().max(60),
  experience: z.string().trim().max(60),
  showcaseImages: z.array(z.string()).max(12).default([]),
})

export const vendorProfileRouter = createTRPCRouter({
  get: vendorProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        businessName: user.businessName,
        businessLocation: user.vendorLocation,
        businessCategory: user.businessCategory,
        phone: user.vendorPhone,
        businessDescription: user.businessDescription,
        tagline: user.vendorTagline,
        instagramUrl: user.vendorInstagramUrl,
        websiteUrl: user.vendorWebsiteUrl,
        twitterUrl: user.vendorTwitterUrl,
        facebookUrl: user.vendorFacebookUrl,
        tiktokUrl: user.vendorTiktokUrl,
        linkedinUrl: user.vendorLinkedinUrl,
        youtubeUrl: user.vendorYoutubeUrl,
        whatsapp: user.vendorWhatsapp,
        bannerUrl: user.vendorBannerUrl,
        expertise: user.vendorExpertise,
        focus: user.vendorFocus,
        experience: user.vendorExperience,
        showcaseImages: user.vendorShowcaseImages,
        approvalStatus: user.vendorApprovalStatus,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1)

    return rows[0] ?? null
  }),

  update: vendorProcedure
    .input(profileInput)
    .mutation(async ({ ctx, input }) => {
      // Read current approval state so we don't bump approved vendors back
      // to pending on minor edits.
      const [current] = await ctx.db
        .select({ approvalStatus: user.vendorApprovalStatus })
        .from(user)
        .where(eq(user.id, ctx.session.user.id))
        .limit(1)

      // Saving the profile is the explicit "submit for review" step.
      // - null  → first save, mark pending and surface in admin queue
      // - rejected → resubmit after fixes, mark pending again
      // - pending → still pending, no-op
      // - approved → leave as approved (small edits don't reset)
      const nextApprovalStatus =
        current?.approvalStatus === 'approved'
          ? 'approved'
          : ('pending' as const)

      await ctx.db
        .update(user)
        .set({
          businessName: input.businessName,
          vendorLocation: input.businessLocation,
          businessCategory: input.businessCategory,
          vendorPhone: input.phone ?? null,
          businessDescription: input.businessDescription,
          vendorTagline: input.tagline,
          vendorInstagramUrl: input.instagramUrl ?? null,
          vendorWebsiteUrl: input.websiteUrl ?? null,
          vendorTwitterUrl: input.twitterUrl ?? null,
          vendorFacebookUrl: input.facebookUrl ?? null,
          vendorTiktokUrl: input.tiktokUrl ?? null,
          vendorLinkedinUrl: input.linkedinUrl ?? null,
          vendorYoutubeUrl: input.youtubeUrl ?? null,
          vendorWhatsapp: input.whatsapp ?? null,
          image: input.logoUrl ?? null,
          vendorBannerUrl: input.bannerUrl ?? null,
          vendorExpertise: input.expertise,
          vendorFocus: input.focus,
          vendorExperience: input.experience,
          vendorShowcaseImages: input.showcaseImages,
          vendorApprovalStatus: nextApprovalStatus,
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.session.user.id))

      return { ok: true, approvalStatus: nextApprovalStatus }
    }),
})

export type VendorProfileRouter = typeof vendorProfileRouter

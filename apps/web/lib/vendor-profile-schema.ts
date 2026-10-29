import { z } from 'zod'

import { normalizeWebUrl } from '@ticketur/api/lib/web-url'

export const VENDOR_BUSINESS_CATEGORIES = [
  'Food & Drink',
  'Apparel',
  'Beverages',
  'Decor',
  'Entertainment',
  'Merchandise',
  'Photography',
  'Lighting',
  'Other',
] as const

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

export const vendorProfileSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name required'),
  businessLocation: z.string().trim().min(1, 'Location required'),
  businessCategory: z.string().trim().min(1, 'Category required'),
  // Short tagline shown on the public vendor hero card (max ~160 chars).
  tagline: z.string().trim().max(160, 'Keep your tagline under 160 characters'),
  businessDescription: z
    .string()
    .trim()
    .max(2000, 'Keep your description under 2000 characters'),
  // Contact + socials shown on the public vendor profile.
  phone: z.string().trim().max(32).optional(),
  whatsapp: z.string().trim().max(32).optional(),
  instagramUrl: optionalUrl,
  websiteUrl: optionalUrl,
  twitterUrl: optionalUrl,
  facebookUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  logoUrl: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  // Surfaced on public page as the three highlight stats.
  expertise: z.string().trim().max(60, 'Keep it under 60 characters'),
  focus: z.string().trim().max(60, 'Keep it under 60 characters'),
  experience: z.string().trim().max(60, 'Keep it under 60 characters'),
  showcaseImages: z.array(z.string()).max(12),
})

export type VendorProfileValues = z.infer<typeof vendorProfileSchema>

export const VENDOR_PROFILE_DEFAULTS: VendorProfileValues = {
  businessName: '',
  businessLocation: '',
  businessCategory: '',
  tagline: '',
  businessDescription: '',
  phone: '',
  whatsapp: '',
  instagramUrl: '',
  websiteUrl: '',
  twitterUrl: '',
  facebookUrl: '',
  tiktokUrl: '',
  linkedinUrl: '',
  youtubeUrl: '',
  logoUrl: null,
  bannerUrl: null,
  expertise: '',
  focus: '',
  experience: '',
  showcaseImages: [],
}

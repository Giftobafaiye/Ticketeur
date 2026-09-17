import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

// ─── Core Better Auth Tables ───────────────────────────────────────────────

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  // admin plugin
  role: text('role').default('attendee'),
  banned: boolean('banned'),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  // two-factor plugin
  twoFactorEnabled: boolean('two_factor_enabled'),
  // role requested at signup — gets copied to `role` by a databaseHook
  // after validation. See packages/auth/src/server.ts.
  requestedRole: text('requested_role'),
  // organizer role fields
  orgName: text('org_name'),
  orgType: text('org_type'),
  // vendor role fields
  businessName: text('business_name'),
  businessCategory: text('business_category'),
  businessDescription: text('business_description'),
  // Public profile extras shown on /vendors/[id]
  vendorTagline: text('vendor_tagline'),
  vendorLocation: text('vendor_location'),
  vendorPhone: text('vendor_phone'),
  vendorBannerUrl: text('vendor_banner_url'),
  vendorInstagramUrl: text('vendor_instagram_url'),
  vendorWebsiteUrl: text('vendor_website_url'),
  // Socials shown on the public vendor profile. WhatsApp is a phone number
  // (rendered as a wa.me link); the rest are profile URLs.
  vendorTwitterUrl: text('vendor_twitter_url'),
  vendorFacebookUrl: text('vendor_facebook_url'),
  vendorTiktokUrl: text('vendor_tiktok_url'),
  vendorLinkedinUrl: text('vendor_linkedin_url'),
  vendorYoutubeUrl: text('vendor_youtube_url'),
  vendorWhatsapp: text('vendor_whatsapp'),
  vendorExpertise: text('vendor_expertise'),
  vendorFocus: text('vendor_focus'),
  vendorExperience: text('vendor_experience'),
  vendorShowcaseImages: jsonb('vendor_showcase_images')
    .$type<string[]>()
    .notNull()
    .default([]),
  // vendor approval gate — null when not a vendor; 'pending' until admin approves
  vendorApprovalStatus: text('vendor_approval_status').$type<
    'pending' | 'approved' | 'rejected'
  >(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  // admin plugin
  impersonatedBy: text('impersonated_by'),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

// ─── Two-Factor Plugin ─────────────────────────────────────────────────────

export const twoFactor = pgTable(
  'two_factor',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    verified: boolean('verified').notNull().default(false),
    // Two-factor lockout (better-auth 1.7+): failed verification attempts are
    // counted, and past the threshold verification is locked until
    // `locked_until`. Better Auth writes to both on the failed-attempt path.
    failedVerificationCount: integer('failed_verification_count')
      .notNull()
      .default(0),
    lockedUntil: timestamp('locked_until'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  },
  (t) => [
    index('two_factor_secret_idx').on(t.secret),
    index('two_factor_user_idx').on(t.userId),
  ]
)

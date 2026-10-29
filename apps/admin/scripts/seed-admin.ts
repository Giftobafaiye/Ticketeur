/**
 * Seed a platform admin user.
 *
 * Run from monorepo root:
 *   pnpm --filter=admin seed:admin
 *
 * Required:
 *   ADMIN_SEED_PASSWORD  at least 14 characters. There is deliberately no
 *                        default: a default password lives in the public
 *                        source, so any admin seeded with it is one anybody
 *                        can sign in as.
 * Optional:
 *   ADMIN_SEED_EMAIL     default admin@useticketeur.com
 *   ADMIN_SEED_NAME      default Platform Admin
 *
 * Every admin has two-factor sign-in on (a code emailed at each sign-in); the
 * admin console refuses an admin session without it.
 *
 * Idempotent: if a user with that email already exists, it just promotes
 * them to `role = 'admin'` (and sets emailVerified + 2FA) — no password reset.
 */

import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'

import { db, user as userTable, account as accountTable } from '@ticketur/db'

const EMAIL = process.env.ADMIN_SEED_EMAIL ?? 'admin@useticketeur.com'
const PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? ''
const MIN_PASSWORD_LENGTH = 14
const NAME = process.env.ADMIN_SEED_NAME ?? 'Platform Admin'

async function main() {
  if (PASSWORD.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_SEED_PASSWORD must be set and at least ${MIN_PASSWORD_LENGTH} characters long.`
    )
  }

  const existing = await db
    .select({ id: userTable.id, role: userTable.role })
    .from(userTable)
    .where(eq(userTable.email, EMAIL))
    .limit(1)

  const now = new Date()

  if (existing.length > 0) {
    const row = existing[0]!
    if (row.role !== 'admin') {
      await db
        .update(userTable)
        .set({
          role: 'admin',
          emailVerified: true,
          twoFactorEnabled: true,
          updatedAt: now,
        })
        .where(eq(userTable.id, row.id))
      console.log(`Promoted existing user to admin: ${EMAIL}`)
    } else {
      console.log(`Admin already exists: ${EMAIL}`)
    }
    return
  }

  const userId = randomUUID()
  const accountId = randomUUID()
  const hashed = await hashPassword(PASSWORD)

  await db.transaction(async (tx) => {
    await tx.insert(userTable).values({
      id: userId,
      name: NAME,
      email: EMAIL,
      emailVerified: true,
      image: null,
      role: 'admin',
      twoFactorEnabled: true,
      createdAt: now,
      updatedAt: now,
    })

    await tx.insert(accountTable).values({
      id: accountId,
      accountId: userId,
      providerId: 'credential',
      userId,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    })
  })

  console.log(`Seeded admin: ${EMAIL}`)
  console.log(`Sign in at /sign-in (admin app — port 3001).`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

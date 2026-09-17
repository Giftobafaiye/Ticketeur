/**
 * Seed a platform admin user.
 *
 * Run from monorepo root:
 *   pnpm --filter=admin seed:admin
 *
 * Defaults:
 *   email    admin@useticketeur.com
 *   password ChangeMe!2026   (override via ADMIN_SEED_PASSWORD)
 *
 * Idempotent: if a user with that email already exists, it just promotes
 * them to `role = 'admin'` (and sets emailVerified true) — no password reset.
 */

import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'

import { db, user as userTable, account as accountTable } from '@ticketur/db'

const EMAIL = process.env.ADMIN_SEED_EMAIL ?? 'admin@useticketeur.com'
const PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? 'ChangeMe!2026'
const NAME = process.env.ADMIN_SEED_NAME ?? 'Platform Admin'

async function main() {
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
        .set({ role: 'admin', emailVerified: true, updatedAt: now })
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
      twoFactorEnabled: false,
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
  console.log(`Password: ${PASSWORD}`)
  console.log(`Sign in at /sign-in (admin app — port 3001).`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

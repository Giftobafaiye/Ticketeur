-- Two-factor sign-in is mandatory for admins: the admin console refuses an
-- admin session without it. Switch it on for every existing admin so they are
-- asked for an emailed code at their next sign-in instead of being locked out.
UPDATE "user" SET "two_factor_enabled" = true WHERE "role" = 'admin';

# DOCUMENTATION.md

## 1. What this project is

This is a standalone authentication system with its own user interface, built as a reusable starter kit rather than a commercial product. It handles account creation, sign in, forgot password, password reset, and email verification, and ends at a placeholder dashboard that shows only the signed-in user's name and a sign out button.

The stack is locked: Next.js (App Router), TypeScript, Prisma, and PostgreSQL. Every form submission runs through Next.js Server Actions, not a separate REST API layer.

The intent is that a developer can copy this repository into a new project, point it at a fresh database, and have a working, secure auth layer without rebuilding signup, login, verification, and reset from scratch. There is no business model, pricing, or billing anywhere in this project — see Section 8 of the PRD for why that's a firm decision, not an open question.

Two documents govern this project: the PRD (`PRD.md`) defines what gets built and why. `AGENTS.md` defines how the coding agent is allowed to build it — locked tools, hard rules, folder structure, and what counts as done. This file, `DOCUMENTATION.md`, explains the result to a person reading the finished code.

## 2. How to run it

**Prerequisites**
- Node.js (current LTS)
- PostgreSQL instance (local or hosted)
- npm

**Steps**
1. Clone the repository.
2. Run `npm install`. This installs only the locked stack: Next.js, TypeScript, Prisma, the PostgreSQL client, Zod, and bcrypt. No other framework or ORM is present.
3. Copy `.env.example` to `.env`. Fill in:
   - `DATABASE_URL` — your PostgreSQL connection string.
   - The transactional email provider key. The PRD defaults this to Resend (Section 12, Assumptions), pending confirmation — see Section 14 Open Questions in the PRD if this hasn't been settled yet.
4. Run `npx prisma migrate dev` to apply the schema in `prisma/schema.prisma` and create the database tables.
5. Run `npm run dev` to start the app locally.
6. Open the app. It opens directly into the create account screen — there is no landing or marketing page.

If any local database tool is missing (Postgres client, Prisma CLI), install it as part of this setup — the project does not assume it's pre-installed.

## 3. The flow, step by step

**New user (FR-1.1 through FR-1.8, FR-5.1 through FR-5.6)**
1. User fills in name, email, password, and confirmation on the create account screen.
2. On success, the account is created with `emailVerified = false`, and a 6-digit code is emailed. The user is redirected to email verification.
3. If the user enters the correct code before it expires, `emailVerified` flips to `true`, a session is created, and the user lands on the dashboard.
4. If the code is wrong or expired, the user retries or uses the resend control, which is disabled for 60 seconds after each send.
5. Only one valid, unexpired code exists for a user at any time — requesting a new one always invalidates the old one.

**Returning user (FR-2.1 through FR-2.5)**
1. User submits email and password on the sign in screen.
2. If credentials are invalid, a single generic error is shown — it never reveals whether the email exists.
3. If credentials are valid but the account isn't verified yet, the user is sent to email verification instead of the dashboard.
4. If credentials are valid and verified, a session is created and the user lands on the dashboard.

**Forgotten password (FR-3.1 through FR-4.4)**
1. User submits their email on the forgot password screen.
2. The response is identical whether or not the email exists in the system.
3. If it exists and is verified, a single-use reset link is emailed, valid for 1 hour.
4. The reset form validates the token both when the page loads and again when the form is submitted, so a token that expires mid-form-fill still gets rejected.
5. On a successful reset, the new password is saved and every existing session for that user is deleted, forcing a fresh sign in everywhere.

**Direct dashboard access (FR-7.1, FR-6.2)**
Anyone without a valid session who requests the dashboard URL directly is redirected to sign in before any dashboard content renders — no flash of protected content.

**Sign out (FR-6.3, FR-6.4)**
The sign out button deletes the session server-side and clears the cookie. If the session was already expired or gone, sign out still succeeds cleanly instead of erroring.

## 4. Data model

Five tables, all defined in `prisma/schema.prisma`, matching PRD Section 10 exactly.

```prisma
model User {
  id             String   @id @default(cuid())
  name           String
  email          String   @unique
  passwordHash   String
  emailVerified  Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  sessions            Session[]
  verificationCodes   VerificationCode[]
  passwordResetTokens PasswordResetToken[]
  rateLimitEntries    RateLimitEntry[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

model VerificationCode {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash  String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

// RateLimitEntry.userId is null for IP-keyed entries (anonymous, pre-auth
// attempts) and set for email-keyed entries where the user exists.
// IP and email limits for the same action are two separate rows:
//   { key: "ip:1.2.3.4",        action: "signin" }
//   { key: "email:user@x.com",  action: "signin" }
model RateLimitEntry {
  id           String   @id @default(cuid())
  key          String
  action       String
  userId       String?
  user         User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  attemptCount Int      @default(1)
  windowStart  DateTime @default(now())

  @@unique([key, action])
  @@index([windowStart])
}
```

`User` holds the account. `Session` backs the httpOnly cookie, so sessions are revocable server-side rather than being stateless JWTs. `VerificationCode` and `PasswordResetToken` never store the raw code or token — only a hash, for the reason explained in Section 5. `RateLimitEntry` tracks both IP-based and email-based attempt counts, using an atomic upsert to avoid race conditions under concurrent requests.

## 5. Password hashing: what and why

Passwords are hashed with **bcrypt**, minimum 10 salt rounds, before they're ever written to `User.passwordHash`. Plaintext passwords are never logged and never returned in any server action response, error or otherwise.

Bcrypt was chosen because it's deliberately slow and its cost factor is adjustable. A fast hash (like a single round of SHA-256) can be brute-forced at billions of attempts per second on modern hardware if the database ever leaks. Bcrypt's cost factor makes that same attack computationally expensive per guess, and the cost can be raised later as hardware gets faster, without changing the algorithm.

The same reasoning extends to verification codes and reset tokens: they're stored as hashes (`codeHash`, `tokenHash`), not raw values. The raw value only ever exists in the outbound email. If the database is ever exposed, an attacker gets hashes they can't directly use to sign in, verify an account, or reset a password — they'd still have to brute-force each one individually, and rate limiting (Section 7 of the PRD) makes that impractical within the code's 15-minute or token's 1-hour expiry window.

## 6. What this project doesn't cover

This is Phase 1 only. The following are explicitly out of scope and were not built:

- Social or OAuth login (Google, GitHub, etc.)
- Two-factor authentication
- Account lockout after repeated failed attempts — only rate limiting is enforced
- Any settings or account management screen
- Profile editing, including changing the name shown on the dashboard
- Admin tools or user management of any kind
- An audit log of auth events (failed logins, resets, signups)
- Redis or any external rate-limiting service — rate limiting runs on a Postgres table
- A landing page or marketing page — the app opens directly into the auth flow
- Any dashboard functionality beyond showing the user's name and a sign out button
- A billing, pricing, or subscription model of any kind

All of the above are documented as Phase 2 candidates in PRD Section 13, not omissions by accident.

## 7. What I'd do differently

If I could change one thing about this build, it would be adding the `AuthEvent` audit log table in Phase 1 instead of deferring it to Phase 2. Right now, the only record of a failed login, a brute-force attempt on a verification code, or a password reset is an ephemeral rate-limit counter that gets cleaned up after 24 hours — so if something suspicious happens today, there is no way to investigate it next week. Audit logging is cheap to add while the schema is still young and there's no production data to migrate around, and it gets significantly more expensive to retrofit once the app is live and every write path needs to be touched to add logging without breaking anything. Deferring it made sense for scope discipline, but it's the one deferral I'd reconsider first if the project moves toward real users sooner than expected.
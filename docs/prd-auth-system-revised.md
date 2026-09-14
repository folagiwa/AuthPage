# Product Requirements Document: Standalone Authentication System (Revised)

*Revision note: this version incorporates all fixes agreed during the structured review session. Every change is a direct result of a specific objection raised and resolved in that review.*

## 1. Product Summary
A self-contained authentication module built with Next.js (App Router), TypeScript, Prisma, and PostgreSQL. It provides account creation, sign in, email verification, and password reset, ending at a placeholder dashboard that displays the signed-in user's name and a sign out button. It contains no other product functionality.

This is a reusable starter kit, not a standalone commercial product. "Reusable" means: a developer copies the repository, sets new environment variables, runs the Prisma migrations, and has a working auth system in a new project. Reuse is not delivered as a published package in Phase 1.

Phase 1 includes packaging deliverables to support this: a `.env.example` file, a setup README covering install, migrate, seed, and run steps, and confirmation that no hardcoded values block reuse in a new project.

## 2. Problem Statement
Every new Next.js project that needs user accounts rebuilds the same flows: signup, login, email verification, password reset, session handling, and route protection. Doing this correctly (secure password storage, single-use tokens, session revocation, no user-enumeration leaks) takes real effort and is easy to get subtly wrong. This system solves that once, correctly, so it can be reused instead of rebuilt.

**This PRD has two audiences, and requirements are written for each separately:**
1. **Developers** who adopt this kit into a new project. They are served by clean code, documentation, and a working schema (see Section 1 packaging requirements).
2. **End users** who create accounts within whatever product is eventually built on top of this kit. They are served by the functional requirements in Section 5.

## 3. Goals and Non-Goals

**Goals**
- A new user can register, verify their email, and land on the dashboard.
- A returning user can sign in with email and password.
- A user who forgets their password can request a reset, use the emailed link, and sign in with the new password.
- The dashboard route is inaccessible without a valid session and redirects unauthenticated visitors to sign in.
- Sign out fully invalidates the session, both client-side and server-side.
- All flows work correctly against the locked stack: Next.js App Router, TypeScript, Prisma, PostgreSQL.
- A developer can integrate this kit into a new project using only the README.

**Non-Goals**
- No social or OAuth login (Google, GitHub, etc.) in phase 1.
- No user roles, permissions, or multi-tenancy.
- No account lockout after repeated failed logins in phase 1.
- No profile editing, avatar upload, or account settings beyond what is listed.
- **Name is captured once at signup and is not editable in Phase 1.** No profile management screen exists. This is an accepted limitation of the placeholder dashboard, revisited in Phase 2.
- No real dashboard functionality. The dashboard is a placeholder only.
- No admin panel or user management interface.
- No native app or embedded webview support in Phase 1 (see Section 4).

## 4. User Personas

**Persona 1: New user**
Someone creating an account for the first time. Needs a fast, low-friction signup and a clear verification step. Will abandon if the code is hard to find or the resend control is confusing.

**Persona 2: Returning user**
Someone with an existing verified account. Wants to sign in quickly and rarely thinks about the auth system at all unless something goes wrong.

**Persona 3: Locked-out user**
Someone who forgot their password. Arrives anxious or mildly frustrated. Needs the reset flow to be obvious, forgiving of typos in email entry, and quick to complete.

**Device and context requirement:** All flows must be responsive and function correctly on both desktop and mobile web. Reset and verification flows must work correctly when opened in a different browser context than where they were initiated (for example, a reset link opened in a mobile browser after the request was made on desktop). No native app or embedded webview support is assumed in Phase 1. This is a known UX risk area, cross-referenced in Section 9.

If this kit ends up serving an end-user product, these personas represent that product's end users, not the developer using the kit itself (see Section 2 audience split).

## 5. Functional Requirements

### 5.1 Create Account
- FR-1.1: Form collects name, email, password, and password confirmation.
- FR-1.2: Email must be a valid email format; reject invalid formats client-side and server-side.
- FR-1.3: Password must be at least 8 characters and contain at least one letter and one number. Reject otherwise with a specific inline error.
- FR-1.4: Password and confirmation must match. Reject otherwise with a specific inline error.
- FR-1.5: If the email is already registered **and verified**, return a generic error ("unable to create account with this email") without confirming the account exists. This check applies only when `emailVerified = true` for the existing record (see FR-1.8 for the unverified case).
- FR-1.6: On success, create a User record with `emailVerified = false`, hash the password with bcrypt before storage, generate a 6-digit verification code, store it with a 15-minute expiry, send it by email, and redirect to the email verification screen. User creation and verification code generation happen inside a single Prisma transaction (see Section 7).
- FR-1.7: Do not create a session or allow dashboard access until email is verified.
- FR-1.8 (new): If a submitted email matches an existing User record where `emailVerified = false`, treat this as a fresh signup attempt: overwrite the pending record's name and password hash, invalidate any existing verification code, issue a new one, and proceed as in FR-1.6. This prevents an abandoned, never-verified signup from permanently blocking that email address for its real owner.

### 5.2 Sign In
- FR-2.1: Form collects email and password.
- FR-2.2: On invalid credentials, return a single generic error ("invalid email or password") that does not reveal whether the email exists.
- FR-2.3 (revised): On valid credentials with `emailVerified = false`:
  - If an unexpired verification code already exists for the user, do **not** generate a new one. Redirect to email verification and show a message: "A code was already sent, check your email or request a new one."
  - If no unexpired code exists, generate a new one, invalidate any prior unexpired codes for that user, send it by email, and redirect to email verification.
- FR-2.4: On valid credentials with `emailVerified = true`, create a session record, set an httpOnly session cookie, and redirect to the dashboard.
- FR-2.5: Apply rate limiting per IP and per email on this endpoint (see Technical Requirements).

**Verification code invariant (applies across FR-1.6, FR-2.3, and Section 5.5):** At most one valid, unexpired verification code exists per user at any time. Issuing a new code always invalidates prior unexpired codes for that user.

### 5.3 Forgot Password (request form)
- FR-3.1: Form collects email only.
- FR-3.2: Regardless of whether the email exists in the system, show the same confirmation message ("if an account exists for this email, a reset link has been sent").
- FR-3.3: If the email exists and is verified, generate a single-use reset token, store its hash with a 1-hour expiry, and email a reset link containing the raw token.
- FR-3.4: Apply rate limiting per IP and per email on this endpoint.

### 5.4 Reset Password (from emailed link)
- FR-4.1: The link contains a token in the URL. On page load, validate the token server-side (exists, not expired, not already used) before rendering the form. If invalid or expired, show an error state with a link back to the forgot password screen.
- FR-4.2: Form collects new password and confirmation, with the same password rules as FR-1.3 and FR-1.4.
- FR-4.3 (revised): Token validity (exists, not expired, not used) is re-checked server-side **at submission time**, not only at page load. If invalid at submission, reject with the same error state as FR-4.1; do not silently succeed on a stale page-load validation. If valid, hash and store the new password, mark the token as used, delete all existing sessions for that user, and redirect to sign in with a success message.
- FR-4.4: A used or expired token cannot be reused, even if resubmitted.

### 5.5 Email Verification
- FR-5.1: Screen shows a 6-digit code entry field and a resend control.
- FR-5.2: On correct code within the expiry window, set `emailVerified = true` on the user, create a session, set the session cookie, and redirect to the dashboard.
- FR-5.3: On incorrect code, show an inline error and allow retry without penalty beyond rate limiting.
- FR-5.4: On expired code, show an inline error prompting the user to request a new one.
- FR-5.5: Resend control is disabled for 60 seconds after each send, with a visible countdown. Each resend invalidates the previous code and issues a new one with a fresh 15-minute expiry, consistent with the verification code invariant stated in Section 5.2.
- FR-5.6: Apply rate limiting on both code verification attempts and resend requests.

### 5.6 Dashboard (placeholder)
- FR-6.1: Displays the signed-in user's name and a sign out button. No other content or navigation.
- FR-6.2: Route is protected by middleware. Any request without a valid session cookie redirects to sign in.
- FR-6.3: Sign out button triggers session deletion server-side, clears the session cookie, and redirects to sign in.
- FR-6.4 (new): If a session has already expired or been invalidated when the sign out action is triggered, the action succeeds idempotently (clears cookie, redirects to sign in) without error. No client-side polling for session expiry is required in Phase 1 — expiry is only enforced on next navigation or request.

### 5.7 Cross-cutting
- FR-7.1: A signed-out user who directly navigates to the dashboard URL is redirected to sign in, with no flash of dashboard content.
- FR-7.2: A signed-in, verified user who navigates to create account or sign in is redirected to the dashboard.
- FR-7.3: All forms show field-level validation errors before submission where feasible, and server-side validation errors after submission.

## 6. AI Processing Pipeline
N/A. This product contains no AI-driven functionality. Every flow (signup, sign in, verification, reset) is deterministic application logic against a Postgres database.

## 7. Technical Requirements

**Stack:** Next.js App Router, TypeScript, Prisma, PostgreSQL.

**Routing structure**
- `/signup` — create account
- `/signin` — sign in
- `/forgot-password` — request form
- `/reset-password?token=...` — reset form
- `/verify-email` — code entry and resend
- `/dashboard` — protected placeholder
- Route groups: `(auth)` for public auth screens, `(protected)` for the dashboard.

**Server logic**
- Use Next.js Server Actions for all form submissions (create account, sign in, forgot password, reset password, verify code, resend code, sign out). No separate REST API layer needed for phase 1.
- All input validation (email format, password rules, field presence) enforced server-side with a schema validation library (e.g., Zod), not just client-side.

**Session handling**
- Session table in Postgres, keyed by a random session ID, storing `userId`, `expiresAt`, `createdAt`.
- Session ID stored in an httpOnly, secure, `SameSite=Lax` cookie. 7-day expiry, refreshed on activity.
- `middleware.ts` checks the session cookie against the database on every request to `/dashboard`; missing or invalid session redirects to `/signin`.
- **Runtime requirement (new):** `middleware.ts` must either (a) run in the Node.js runtime (`export const config = { runtime: 'nodejs' }`) to use the standard Prisma client directly, or (b) use an edge-compatible database driver or proxy (e.g., Prisma Accelerate, Neon's serverless driver) if Edge runtime is required. This decision must be made explicitly during implementation and documented in the README — it is not safe to leave to default behavior, since the standard Prisma client does not run in the Edge runtime without additional configuration.

**Rate limiting (revised)**
- Applied at the server action level, keyed independently by IP and by email/user, on: sign in, forgot password, verify code, resend code. IP and email limits are tracked as separate `RateLimitEntry` rows for the same action (see Section 10). A request is blocked if either limit is exceeded.
- Implemented via a Postgres-backed table using **atomic upsert operations** (`INSERT ... ON CONFLICT (key, action) DO UPDATE SET attemptCount = attemptCount + 1`) to avoid race conditions under concurrent requests. A naive read-then-increment pattern is explicitly disallowed because it allows an attacker to bypass limits at request boundaries.
- Windows are **fixed-window**: reset every 15 minutes (sign in, verify code) or every 1 hour (forgot password, resend), based on `windowStart`, recalculated when a request arrives after the window has elapsed.
- Suggested limits: 5 attempts per 15 minutes for sign in and code verification, 3 requests per hour for forgot password and resend.
- A scheduled cleanup (cron job, Postgres `pg_cron` extension, or a manual admin script if no scheduler is available) deletes `RateLimitEntry` rows where `windowStart` is older than 24 hours, to prevent unbounded table growth.
- Known Phase 1 limitation: acceptable for low-to-moderate traffic. Revisit with Redis or a dedicated store if the consuming product expects high concurrent auth traffic.

**Email sending**
- Integration point: a single `sendEmail(to, template, data)` function called from the create account, forgot password, and resend server actions. Provider is swappable behind this function.
- **Failure handling (new):** account creation (FR-1.6) wraps user creation and verification code generation in a single Prisma transaction. If `sendEmail` fails or times out, the transaction still commits (the account and code exist), but the response returns a clear error state directing the user to use the resend control on the verification screen, rather than failing signup outright.
- Provider choice: see Open Questions and Assumptions.

**Password handling**
- bcrypt for hashing, salt rounds 10 minimum.
- Passwords never logged or returned in any server action response.

## 8. Business Model
This is a decided position, not an open question: **this is an internal, reusable starter kit. No business model, pricing, or revenue applies.** This is decided by the absence of any named consuming product in this PRD's scope, not left as a soft default.

If a real product is later built on top of this kit, that product gets its own PRD with its own business model. This PRD's scope ends at the auth system and placeholder dashboard.

## 9. Risks

- **User enumeration:** forgot password and create account must not leak whether an email exists. Mitigated by FR-1.5 and FR-3.2, but requires care in error message wording and response timing (constant-time responses to avoid timing-based enumeration).
- **Verification code brute force:** 6-digit codes have 1,000,000 combinations; without rate limiting this is guessable within a short window. Mitigated by FR-5.6 and the rate limiting spec in Section 7. No account lockout exists in Phase 1, so this remains a residual risk. No audit trail exists in Phase 1 beyond ephemeral rate-limit counters (which are cleaned up after 24 hours); incident review after the fact is not possible. This is deferred to Phase 2 (see Section 13).
- **Session fixation/reuse after password reset:** mitigated by FR-4.3 (all sessions deleted on reset, re-validated at submission), but requires that this logic is not skipped in implementation.
- **Email deliverability:** verification and reset flows are blocked entirely if transactional email fails or lands in spam. **Mitigation in Phase 1: none beyond provider selection (see Assumptions). This is an accepted risk for Phase 1.** Phase 2 candidate: add a delivery status webhook from the provider to detect and surface bounces or failures to the user or a support channel.
- **Unverified account squatting (new):** a user could register an email and never verify it, which would permanently block that email from being used to create a new account, due to the unique constraint on `User.email`. **Mitigated by FR-1.8:** re-registration is allowed over an existing unverified record, overwriting the pending signup rather than rejecting it.
- **Token/code expiry drift:** if server and database clocks are not synchronized, expiry checks may behave inconsistently. Mitigated by using database-side timestamp functions rather than application server time where possible.
- **Cross-context flow failure:** a reset or verification flow started on one device/browser and completed on another may behave unexpectedly if state is assumed to persist client-side. Mitigated by keeping all flow state server-side (token/code validity), not in client memory. See Section 4.
- **No compliance review performed:** GDPR/data residency status is an open question; shipping without resolving it is a risk if end users are in regulated jurisdictions.

## 10. Prisma Data Model

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

// RateLimitEntry.userId is null for IP-keyed entries (anonymous, e.g. pre-auth
// signup or signin attempts before a user is identified) and set for email-keyed
// entries where the user exists. IP and email limits for the same action are
// tracked as two separate rows, e.g.:
//   { key: "ip:1.2.3.4",        action: "signin" }
//   { key: "email:user@x.com",  action: "signin" }
// A request is blocked if either row's attemptCount exceeds the limit for its window.
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

Codes and tokens are stored as hashes (`codeHash`, `tokenHash`), not raw values, so a database leak does not directly expose usable codes or tokens. The raw value is only ever sent by email and compared by re-hashing the user's submitted value.

The explicit `@@index([email])` on `User` from the prior schema draft was removed as redundant, since `@unique` already creates an implicit index in Postgres.

**Phase 2 schema addition (not built in Phase 1):** an `AuthEvent` audit log table (`userId` nullable, `type`, `ip`, `createdAt`) recording failed logins, password resets, and account creation, for basic security visibility. See Section 13.

## 11. Success Metrics

Split into two categories, since QA gates and directional metrics are not the same kind of measurement and should not be listed together.

**QA Acceptance Gates (binary pass/fail, required before ship)**
- Zero security defects on user enumeration checks (forgot password, create account) during QA.
- Zero unauthorized dashboard access in penetration/QA testing of the route protection middleware.
- Rate limiting verified to hold under concurrent-request testing (confirms the atomic upsert fix in Section 7 actually prevents bypass).

**Directional Metrics (measured post-launch or in usability testing, not hard gates)**
- Signup completion rate: percentage of users who start create account and reach the dashboard (target: >80% in testing).
- Verification code delivery time: under 30 seconds from request to email receipt in testing.
- Time to integrate this kit into a new project: measured via a single timed session with one developer unfamiliar with the codebase, following only the README, no other guidance. Target: under 1 day.

If this kit is later adopted into a real end-user product, replace the directional metrics with activation rate, weekly active users, and any relevant commercial metrics defined in that product's own PRD (see Section 8).

## 12. Assumptions

- Passwords: minimum 8 characters, at least one letter and one number. *(confirmed by user)*
- Sessions: httpOnly cookie backed by a Postgres session table, 7-day expiry, revocable server-side. *(confirmed by user)*
- Email verification: 6-digit numeric code, 15-minute expiry, 60-second resend cooldown. *(confirmed by user)*
- Password reset: single-use token, 1-hour expiry, invalidates all sessions on use. *(confirmed by user)*
- Forgot password never reveals account existence. *(confirmed by user)*
- bcrypt for password hashing. *(confirmed by user)*
- No social login in phase 1. *(confirmed by user)*
- No account lockout in phase 1, rate limiting only. *(confirmed by user)*
- Single generic user role, no multi-tenancy. *(confirmed by user)*
- **Assumption added by model:** rate limiting implemented via a Postgres table with atomic upserts rather than an external service (Redis, Upstash), to stay within the locked stack. Conservative, not maximally scalable, choice — flagged in Section 7.
- **Assumption added by model:** transactional email provider defaulted to Resend for the technical spec, chosen for its native fit with Next.js/TypeScript projects, pending confirmation.
- **Assumption added by model:** deployment target defaulted to Vercel, given the Next.js stack, pending confirmation.
- **Assumption added by model:** no compliance regime (GDPR, etc.) is targeted in phase 1, pending confirmation.
- **Assumption added by model:** verification codes and reset tokens stored as hashes rather than plaintext in the database.
- **Assumption added by model:** "reusable kit" means copy-and-configure, not a published package, in Phase 1.
- **Decided, not assumed:** business model is out of scope (Section 8). This was previously hedged and is now a firm decision.

## 13. Phased Roadmap

**Phase 1 (ship for this PRD)**
- All six screens: create account, sign in, forgot password, reset password, email verification, dashboard.
- Full session handling, route protection middleware (with explicit Edge/Node runtime decision documented), sign out, including idempotent sign-out on expired sessions (FR-6.4).
- Rate limiting on sign in, forgot password, verify code, resend code, using atomic upserts, fixed windows, and a scheduled cleanup job.
- Email sending integration for verification codes and reset links, with transactional account creation and failure handling.
- Unverified-account re-registration handling (FR-1.8).
- Full Prisma schema and migrations as specified in Section 10.
- Packaging deliverables: `.env.example`, setup README (install, migrate, seed, run), verification that no hardcoded values block reuse.
- No social login, no account lockout, no roles, no admin tools, no audit log.

**Phase 2 (explicitly out of scope for now)**
- Social/OAuth login providers.
- Account lockout after repeated failed attempts, beyond rate limiting.
- Password strength meter and stronger password policy options.
- Multi-device session management UI (view/revoke active sessions).
- Admin role and basic user management.
- `AuthEvent` audit log table for failed logins, password resets, and account creation (see Section 10).
- Email delivery status webhook to detect and surface bounces/failures (see Section 9).
- Replace Postgres-backed rate limiting with a dedicated store (e.g., Redis) if scale requires it.
- Profile editing (including name changes).
- Real dashboard functionality, once this kit is adopted into an actual product.

## 14. Open Questions

- Which transactional email provider should be used? Defaulted to Resend for now.
- Is any compliance requirement in scope (GDPR, data residency)? None assumed for Phase 1.
- Should brute-force protection go beyond rate limiting (e.g., temporary lockout, CAPTCHA) in Phase 1, or is that acceptably deferred to Phase 2?
- What is the deployment target? Defaulted to Vercel.
- Should the Postgres-backed rate limiting approach be accepted for Phase 1, or is an external store (Redis) required from the start due to expected scale?

*(The prior open question "is this a real product with a business model" has been removed — it was resolved as a firm decision in Section 8 during the review session, and leaving it here would contradict that decision.)*
